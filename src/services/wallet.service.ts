import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  query,
  where,
  addDoc,
  updateDoc,
  limit,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "@/services/firebase";
import { sendAdminAlertToMasterSuperadmin, sendNotificationToUser, sendNotificationEmail } from "@/services/notification.service";
import { functions } from "@/services/firebase";
import { isRedeemableSource, PROFILE_COMPLETION_REWARD_COINS } from "@/constants/wallet";
import type {
  AssignCoinsInput,
  WalletRecord,
  WalletSummary,
  WalletTransactionRecord,
  WalletUserType,
} from "@/types/wallet";
import type {
  CoinRequest,
  CoinRequestFormValues,
} from "@/types/coinRequest";
import type { CashoutConfig, CashoutRequest } from "@/types/cashoutRequest";

type AdminSelectableUser = {
  id: string;
  name: string;
  userType: WalletUserType;
  status: "active" | "inactive";
  tenantId?: string;
};

const issueRegistrationBonusCallable = httpsCallable<
  { userId: string; tenantId: string },
  { status: string; reason?: string }
>(functions, "issueRegistrationBonus");

const issueProfileCompletionRewardCallable = httpsCallable<
  { userId: string; tenantId: string },
  { status: "credited" | "already-credited" | "skipped"; reason?: string; rewardCoins?: number }
>(functions, "issueProfileCompletionReward");

const backfillTenantTreasuryWalletsCallable = httpsCallable<
  { tenantId?: string },
  { status: string; created?: number; skipped?: number }
>(functions, "backfillTenantTreasuryWallets");

const WALLET_ID_SEPARATOR = "::";
const TREASURY_WALLET_PREFIX = "treasury::";
const TREASURY_OWNER_USER_ID = "9767676738";
const DEFAULT_CASHOUT_CREDIT_COST = 25;
const DEFAULT_CASHBACK_PERCENTAGE = 80;
export const DEFAULT_MIN_CASHOUT_CREDITS = 40;

export function buildWalletId(userId: string, tenantId: string): string {
  return `${String(tenantId).trim()}${WALLET_ID_SEPARATOR}${String(userId).trim()}`;
}

export function buildTenantTreasuryWalletId(tenantId: string): string {
  return `${TREASURY_WALLET_PREFIX}${String(tenantId).trim()}`;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTenantKey(value: unknown): string {
  return normalizeString(value)
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_CASHBACK_PERCENTAGE;
  }

  return Math.min(100, Math.max(0, value));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function mapWalletDoc(id: string, data: Record<string, unknown>): WalletRecord {
  return {
    id,
    userId: String(data.userId ?? id),
    tenantId: String(data.tenantId ?? ""),
    userType: (data.userType as WalletUserType) ?? "individual",
    userName: String(data.userName ?? "User"),
    totalIssuedCoins: toNumber(data.totalIssuedCoins),
    utilizedCoins: toNumber(data.utilizedCoins),
    availableCoins: toNumber(data.availableCoins),
    createdBy: String(data.createdBy ?? ""),
    updatedBy: String(data.updatedBy ?? ""),
    createdAt: data.createdAt as WalletRecord["createdAt"],
    updatedAt: data.updatedAt as WalletRecord["updatedAt"],
  };
}

function mapWalletTransactionDoc(id: string, data: Record<string, unknown>): WalletTransactionRecord {
  return {
    id,
    walletId: String(data.walletId ?? ""),
    userId: String(data.userId ?? ""),
    tenantId: String(data.tenantId ?? ""),
    userType: (data.userType as WalletUserType) ?? "individual",
    userName: String(data.userName ?? "User"),
    transactionType: (data.transactionType as WalletTransactionRecord["transactionType"]) ?? "credit",
    reason: typeof data.reason === "string" ? data.reason : undefined,
    coins: toNumber(data.coins),
    source: typeof data.source === "string" ? (data.source as WalletTransactionRecord["source"]) : undefined,
    assignmentId: typeof data.assignmentId === "string" ? data.assignmentId : undefined,
    activityType: typeof data.activityType === "string" ? data.activityType : undefined,
    activityId: typeof data.activityId === "string" ? data.activityId : undefined,
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt as WalletTransactionRecord["createdAt"],
  };
}

async function resolveUserRecordByAnyId(userId: string): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const normalized = userId.trim();
  if (!normalized) {
    return null;
  }

  const directSnap = await getDoc(doc(db, "users", normalized));
  if (directSnap.exists()) {
    return { id: directSnap.id, data: directSnap.data() as Record<string, unknown> };
  }

  const byUserIdSnap = await getDocs(query(collection(db, "users"), where("userId", "==", normalized), limit(1)));
  if (!byUserIdSnap.empty) {
    const first = byUserIdSnap.docs[0];
    return { id: first.id, data: first.data() as Record<string, unknown> };
  }

  const byUidSnap = await getDocs(query(collection(db, "users"), where("uid", "==", normalized), limit(1)));
  if (!byUidSnap.empty) {
    const first = byUidSnap.docs[0];
    return { id: first.id, data: first.data() as Record<string, unknown> };
  }

  return null;
}

export async function getWalletByUserId(userId: string): Promise<WalletRecord | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, "wallets", userId));
  if (snap.exists()) {
    return mapWalletDoc(snap.id, snap.data() as Record<string, unknown>);
  }

  const byUserSnap = await getDocs(query(collection(db, "wallets"), where("userId", "==", userId)));
  if (byUserSnap.empty) return null;

  const first = byUserSnap.docs[0];
  return mapWalletDoc(first.id, first.data() as Record<string, unknown>);
}

export async function issueRegistrationBonusForUser(args: {
  userId: string;
  tenantId: string;
}): Promise<void> {
  const result = await issueRegistrationBonusCallable({
    userId: args.userId,
    tenantId: args.tenantId,
  });

  if (result.data?.status === "credited") {
    try {
      const userRecord = await resolveUserRecordByAnyId(args.userId);
      if (userRecord) {
        const userEmail = String(userRecord.data.email ?? "").trim().toLowerCase();
        const userName = String(userRecord.data.fullName ?? userRecord.data.name ?? "User").trim();

        if (userEmail) {
          const bonus = await getTenantRegistrationFreeCoins(args.tenantId);
          if (bonus > 0) {
            await sendNotificationEmail({
              tenantId: args.tenantId,
              notificationType: "registrationBonusIssued",
              recipientEmail: userEmail,
              recipientName: userName,
              templateVariables: {
                recipientName: userName,
                bonusCoins: String(bonus),
              },
              metadata: {
                userId: args.userId,
                bonusAmount: bonus,
              },
            });
          }
        }
      }
    } catch {
      // Registration bonus issuance should not fail if notification fails.
    }
  }
}

export async function issueProfileCompletionRewardForUser(args: {
  userId: string;
  tenantId: string;
}): Promise<"credited" | "already-credited" | "skipped"> {
  const result = await issueProfileCompletionRewardCallable({
    userId: args.userId,
    tenantId: args.tenantId,
  });

  const status = result.data?.status ?? "skipped";

  if (status === "credited") {
    try {
      const userRecord = await resolveUserRecordByAnyId(args.userId);
      if (userRecord) {
        const userEmail = String(userRecord.data.email ?? "").trim().toLowerCase();
        const userName = String(userRecord.data.fullName ?? userRecord.data.name ?? "User").trim();

        if (userEmail) {
          await sendNotificationEmail({
            tenantId: args.tenantId,
            notificationType: "profileCompletionRewardIssued",
            recipientEmail: userEmail,
            recipientName: userName,
            templateVariables: {
              recipientName: userName,
              bonusCoins: String(result.data?.rewardCoins ?? PROFILE_COMPLETION_REWARD_COINS),
            },
            metadata: {
              userId: args.userId,
              bonusAmount: result.data?.rewardCoins ?? PROFILE_COMPLETION_REWARD_COINS,
            },
          });
        }
      }
    } catch {
      // Reward issuance should not fail if notification fails.
    }
  }

  return status;
}

export async function getWalletByUserAndTenant(args: {
  userId: string;
  tenantId: string;
}): Promise<WalletRecord | null> {
  const userId = args.userId.trim();
  const tenantId = args.tenantId.trim();
  if (!userId || !tenantId) return null;

  const scopedWalletId = buildWalletId(userId, tenantId);
  const scopedSnap = await getDoc(doc(db, "wallets", scopedWalletId));
  if (scopedSnap.exists()) {
    return mapWalletDoc(scopedSnap.id, scopedSnap.data() as Record<string, unknown>);
  }

  try {
    const legacySnap = await getDoc(doc(db, "wallets", userId));
    if (legacySnap.exists()) {
      const legacyWallet = mapWalletDoc(legacySnap.id, legacySnap.data() as Record<string, unknown>);
      if (legacyWallet.tenantId === tenantId) {
        return legacyWallet;
      }
    }
  } catch {
    // Legacy wallet doc not readable (non-existent or no permission) — skip.
  }

  const byUserSnap = await getDocs(query(collection(db, "wallets"), where("userId", "==", userId)));
  const tenantWallet = byUserSnap.docs
    .map((entry) => mapWalletDoc(entry.id, entry.data() as Record<string, unknown>))
    .find((wallet) => wallet.tenantId === tenantId);

  return tenantWallet ?? null;
}

export async function getTenantRegistrationFreeCoins(tenantId: string): Promise<number> {
  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  return Math.max(
    0,
    Math.floor(Number(tenantSnap.data()?.walletConfig?.registrationFreeCoins ?? 10))
  );
}

export async function getTenantCashoutConfig(tenantId: string): Promise<CashoutConfig> {
  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  const walletConfig = tenantSnap.data()?.walletConfig as Record<string, unknown> | undefined;
  const cashoutConfig = walletConfig?.cashout as Record<string, unknown> | undefined;

  const creditCost = Math.max(
    0,
    Number(
      cashoutConfig?.creditCost
      ?? walletConfig?.cashoutCreditCost
      ?? DEFAULT_CASHOUT_CREDIT_COST
    )
  );

  const cashbackPercentage = clampPercentage(
    Number(
      cashoutConfig?.cashbackPercentage
      ?? walletConfig?.cashbackPercentage
      ?? DEFAULT_CASHBACK_PERCENTAGE
    )
  );

  const minimumCredits = Math.max(
    1,
    Math.floor(
      Number(
        cashoutConfig?.minimumCredits
        ?? walletConfig?.cashoutMinimumCredits
        ?? DEFAULT_MIN_CASHOUT_CREDITS
      )
    )
  );

  return {
    creditCost: Number.isFinite(creditCost) ? creditCost : DEFAULT_CASHOUT_CREDIT_COST,
    cashbackPercentage,
    minimumCredits: Number.isFinite(minimumCredits) ? minimumCredits : DEFAULT_MIN_CASHOUT_CREDITS,
  };
}

export async function getWalletForUserContext(userIds: string[], tenantId?: string): Promise<WalletRecord | null> {
  for (const userId of userIds.map((item) => item.trim()).filter(Boolean)) {
    const wallet = tenantId
      ? await getWalletByUserAndTenant({ userId, tenantId })
      : await getWalletByUserId(userId);
    if (wallet) {
      return wallet;
    }
  }

  return null;
}

/**
 * Idempotent: creates a zero-balance wallet for a user if one does not already exist.
 * Safe to call on every login for pre-provisioned users created by the assignment flow.
 */
export async function ensureWalletExists(args: {
  userId: string;
  lookupUserIds?: string[];
  tenantId: string;
  userType: WalletUserType;
  userName: string;
}): Promise<void> {
  const existing = await getWalletForUserContext([
    args.userId,
    ...(args.lookupUserIds ?? []),
  ], args.tenantId);
  if (existing) return;
  try {
    await createWalletForUser({
      userId: args.userId,
      tenantId: args.tenantId,
      userType: args.userType,
      userName: args.userName,
      createdBy: "system",
    });
  } catch {
    // Creation race (parallel login) — safe to ignore.
  }
}

export async function listWallets(): Promise<WalletRecord[]> {
  const snap = await getDocs(collection(db, "wallets"));
  return snap.docs
    .map((entry) => mapWalletDoc(entry.id, entry.data() as Record<string, unknown>))
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

function toTransactionMillis(value: WalletTransactionRecord["createdAt"]): number {
  if (!value || !("toMillis" in value) || typeof value.toMillis !== "function") {
    return 0;
  }

  return value.toMillis();
}

export async function listWalletTransactionsForUserContext(args: {
  userIds: string[];
  tenantId?: string;
  includeTreasury?: boolean;
}): Promise<WalletTransactionRecord[]> {
  const normalizedIds = Array.from(new Set(args.userIds.map((id) => id.trim()).filter(Boolean)));

  try {
    const results = await Promise.allSettled(
      normalizedIds.flatMap((userId) => [
        getDocs(query(collection(db, "walletTransactions"), where("userId", "==", userId))),
        getDocs(query(collection(db, "walletTransactions"), where("createdBy", "==", userId))),
      ])
    );

    const allMatched = results
      .filter((r): r is PromiseFulfilledResult<QuerySnapshot> => r.status === "fulfilled")
      .flatMap((r) =>
        r.value.docs.map((entry: QueryDocumentSnapshot) => mapWalletTransactionDoc(entry.id, entry.data() as Record<string, unknown>))
      )
      .filter((item) => args.includeTreasury || !item.walletId.startsWith(TREASURY_WALLET_PREFIX))
      .reduce<WalletTransactionRecord[]>((acc, item) => {
        if (!acc.some((existing) => existing.id === item.id)) {
          acc.push(item);
        }
        return acc;
      }, []);

    const tenantMatched = args.tenantId
      ? allMatched.filter((item) => item.tenantId === args.tenantId)
      : allMatched;

    return (tenantMatched.length > 0 ? tenantMatched : allMatched)
      .sort((a, b) => toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt));
  } catch (error) {
    console.error("[listWalletTransactionsForUserContext] error:", error);
    return [];
  }
}

export async function listWalletSummary(tenantId?: string): Promise<WalletSummary> {
  const q = tenantId
    ? query(collection(db, "wallets"), where("tenantId", "==", tenantId))
    : collection(db, "wallets");
  const snap = await getDocs(q);
  let totalIssuedCoins = 0;
  let totalUtilizedCoins = 0;

  snap.docs.forEach((item) => {
    const data = item.data() as Record<string, unknown>;
    totalIssuedCoins += toNumber(data.totalIssuedCoins);
    totalUtilizedCoins += toNumber(data.utilizedCoins);
  });

  return { totalIssuedCoins, totalUtilizedCoins };
}

export async function listUsersForCoinAssignment(args: {
  tenantId: string;
  userType: WalletUserType;
}): Promise<AdminSelectableUser[]> {
  const selectedTenant = normalizeTenantKey(args.tenantId);
  const selectedUserType = normalizeString(args.userType);

  const q = query(
    collection(db, "users"),
    where("tenantId", "==", args.tenantId)
  );
  const snap = await getDocs(q);
  let candidates = snap.docs.map((entry) => ({
    id: entry.id,
    ...(entry.data() as Omit<AdminSelectableUser, "id">),
  }));

  if (candidates.length === 0) {
    // Fallback for data drift (case/spacing or legacy tenantId storage differences).
    const allUsersSnap = await getDocs(collection(db, "users"));
    candidates = allUsersSnap.docs.map((entry) => ({
      id: entry.id,
      ...(entry.data() as Omit<AdminSelectableUser, "id">),
    }));
  }

  const results = candidates
    .filter(
      (user) =>
        normalizeTenantKey(user.tenantId) === selectedTenant &&
        normalizeString(user.userType) === selectedUserType &&
        (typeof user.status === "undefined" || normalizeString(user.status) === "active")
    )
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return results;
}

export async function assignCoins(input: AssignCoinsInput): Promise<void> {
  if (input.coinsToAssign <= 0) {
    throw new Error("Coins to assign must be greater than 0.");
  }

  const scopedWalletId = buildWalletId(input.userId, input.tenantId);
  const scopedWalletRef = doc(db, "wallets", scopedWalletId);
  const legacyWalletRef = doc(db, "wallets", input.userId);

  const scopedPreCheck = await getDoc(scopedWalletRef).catch(() => null);
  const needsLegacyCheck = !scopedPreCheck?.exists();

  await runTransaction(db, async (transaction) => {
    const scopedSnap = await transaction.get(scopedWalletRef);

    let legacySnap: { exists: () => boolean; data: () => Record<string, unknown> | undefined } | null = null;
    if (needsLegacyCheck) {
      try {
        legacySnap = await transaction.get(legacyWalletRef);
      } catch {
        legacySnap = null;
      }
    }

    const scopedCurrent = scopedSnap.exists() ? (scopedSnap.data() as Record<string, unknown>) : null;
    const legacyCurrent = legacySnap?.exists() ? (legacySnap.data() as Record<string, unknown>) : null;
    const legacyTenantId = String(legacyCurrent?.tenantId ?? "");
    const useLegacy = !scopedCurrent && legacyCurrent && legacyTenantId === input.tenantId;
    const current = scopedCurrent ?? (useLegacy ? legacyCurrent : null);
    const targetWalletRef = useLegacy ? legacyWalletRef : scopedWalletRef;
    const targetWalletId = useLegacy ? input.userId : scopedWalletId;

    const existingIssued = current ? toNumber(current.totalIssuedCoins) : 0;
    const existingUtilized = current ? toNumber(current.utilizedCoins) : 0;
    const existingAvailable = current ? toNumber(current.availableCoins) : 0;

    const nextIssued = existingIssued + input.coinsToAssign;
    const nextAvailable = existingAvailable + input.coinsToAssign;

    transaction.set(
      targetWalletRef,
      {
        userId: input.userId,
        tenantId: input.tenantId,
        userType: input.userType,
        userName: input.userName,
        totalIssuedCoins: nextIssued,
        utilizedCoins: existingUtilized,
        availableCoins: nextAvailable,
        createdBy: current?.createdBy ?? input.assignedBy,
        updatedBy: input.assignedBy,
        createdAt: current?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const txRef = doc(collection(db, "walletTransactions"));
    transaction.set(txRef, {
      walletId: targetWalletId,
      userId: input.userId,
      tenantId: input.tenantId,
      userType: input.userType,
      userName: input.userName,
      transactionType: "credit",
      coins: input.coinsToAssign,
      createdBy: input.assignedBy,
      createdAt: serverTimestamp(),
    });
  });
}

export async function createWalletForUser(input: {
  userId: string;
  tenantId: string;
  userType: WalletUserType;
  userName: string;
  createdBy: string;
  initialCoins?: number;
  reason?: string;
  source?: "registration" | "referral" | "assignment" | "promotion" | "manual_offline_allocation";
}): Promise<void> {
  const scopedWalletId = buildWalletId(input.userId, input.tenantId);
  const scopedWalletRef = doc(db, "wallets", scopedWalletId);
  const legacyWalletRef = doc(db, "wallets", input.userId);
  const initialCoins = Math.max(0, Math.floor(Number(input.initialCoins ?? 0)));

  const scopedPreCheck = await getDoc(scopedWalletRef).catch(() => null);
  const needsLegacyCheck = !scopedPreCheck?.exists();

  await runTransaction(db, async (transaction) => {
    const scopedSnap = await transaction.get(scopedWalletRef);

    let legacyData: Record<string, unknown> | null = null;
    if (needsLegacyCheck) {
      try {
        const legacySnap = await transaction.get(legacyWalletRef);
        legacyData = legacySnap.exists() ? (legacySnap.data() as Record<string, unknown>) : null;
      } catch {
        legacyData = null;
      }
    }

    const sameTenantLegacyExists = Boolean(legacyData && String(legacyData.tenantId ?? "") === input.tenantId);

    if (scopedSnap.exists() || sameTenantLegacyExists) {
      throw new Error("Wallet already exists for this user.");
    }

    transaction.set(scopedWalletRef, {
      userId: input.userId,
      tenantId: input.tenantId,
      userType: input.userType,
      userName: input.userName,
      totalIssuedCoins: initialCoins,
      utilizedCoins: 0,
      availableCoins: initialCoins,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (initialCoins > 0) {
      const txRef = doc(collection(db, "walletTransactions"));
      transaction.set(txRef, {
        walletId: scopedWalletId,
        userId: input.userId,
        tenantId: input.tenantId,
        userType: input.userType,
        userName: input.userName,
        transactionType: "credit",
        reason: input.reason ?? "Registration bonus",
        source: input.source ?? "manual_offline_allocation",
        coins: initialCoins,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
      });
    }
  });
}

export async function ensureTenantTreasuryWallet(input: {
  tenantId: string;
  createdBy: string;
  openingCoins: number;
}): Promise<void> {
  const tenantId = input.tenantId.trim();
  if (!tenantId) {
    throw new Error("tenantId is required.");
  }

  const openingCoins = Math.max(0, Math.floor(Number(input.openingCoins ?? 0)));
  const treasuryWalletId = buildTenantTreasuryWalletId(tenantId);
  const treasuryRef = doc(db, "wallets", treasuryWalletId);

  await runTransaction(db, async (transaction) => {
    const treasurySnap = await transaction.get(treasuryRef);
    if (treasurySnap.exists()) {
      return;
    }

    transaction.set(treasuryRef, {
      userId: TREASURY_OWNER_USER_ID,
      tenantId,
      userType: "superadmin",
      userName: "Tenant Treasury",
      totalIssuedCoins: openingCoins,
      utilizedCoins: 0,
      availableCoins: openingCoins,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (openingCoins > 0) {
      const txRef = doc(collection(db, "walletTransactions"));
      transaction.set(txRef, {
        walletId: treasuryWalletId,
        userId: TREASURY_OWNER_USER_ID,
        tenantId,
        userType: "superadmin",
        userName: "Tenant Treasury",
        transactionType: "credit",
        reason: "Tenant treasury opening balance",
        source: "manual_offline_allocation",
        coins: openingCoins,
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
      });
    }
  });
}

export async function backfillTenantTreasuryWallets(tenantId?: string): Promise<{
  status: string;
  created: number;
  skipped: number;
}> {
  const result = await backfillTenantTreasuryWalletsCallable(tenantId ? { tenantId } : {});
  const data = result.data ?? { status: "ok", created: 0, skipped: 0 };
  return {
    status: String(data.status ?? "ok"),
    created: Number(data.created ?? 0),
    skipped: Number(data.skipped ?? 0),
  };
}

// ========== Cashout Request Functions ==========

function mapCashoutRequestDoc(id: string, data: Record<string, unknown>): CashoutRequest {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    requesterUserId: String(data.requesterUserId ?? ""),
    requesterName: String(data.requesterName ?? ""),
    requesterCompanyName:
      typeof data.requesterCompanyName === "string"
        ? data.requesterCompanyName
        : undefined,
    requesterUserType: (data.requesterUserType as CashoutRequest["requesterUserType"]) ?? "professional",
    requesterAssociatedCompanyId:
      typeof data.requesterAssociatedCompanyId === "string"
        ? data.requesterAssociatedCompanyId
        : data.requesterAssociatedCompanyId === null
          ? null
          : undefined,
    creditsRequested: toNumber(data.creditsRequested),
    creditCost: toNumber(data.creditCost),
    cashbackPercentage: toNumber(data.cashbackPercentage),
    grossAmountRs: toNumber(data.grossAmountRs),
    payoutAmountRs: toNumber(data.payoutAmountRs),
    status: (data.status as CashoutRequest["status"]) ?? "pending",
    requestComment: typeof data.requestComment === "string" ? data.requestComment : undefined,
    approvalComment: typeof data.approvalComment === "string" ? data.approvalComment : undefined,
    denialReason: typeof data.denialReason === "string" ? data.denialReason : undefined,
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : undefined,
    approvedAt: data.approvedAt as CashoutRequest["approvedAt"],
    deniedBy: typeof data.deniedBy === "string" ? data.deniedBy : undefined,
    deniedAt: data.deniedAt as CashoutRequest["deniedAt"],
    payoutProvider: typeof data.payoutProvider === "string" ? data.payoutProvider : undefined,
    payoutStatus: typeof data.payoutStatus === "string" ? data.payoutStatus : undefined,
    payoutReference: typeof data.payoutReference === "string" ? data.payoutReference : undefined,
    walletTransactionId: typeof data.walletTransactionId === "string" ? data.walletTransactionId : undefined,
    refundTransactionId: typeof data.refundTransactionId === "string" ? data.refundTransactionId : undefined,
    createdAt: data.createdAt as CashoutRequest["createdAt"],
    updatedAt: data.updatedAt as CashoutRequest["updatedAt"],
  };
}

export async function createCashoutRequest(args: {
  tenantId: string;
  requesterUserId: string;
  requesterName: string;
  creditsRequested: number;
  requestComment?: string;
}): Promise<string> {
  const tenantId = args.tenantId.trim();
  const requesterUserId = args.requesterUserId.trim();
  const requesterName = args.requesterName.trim() || "User";
  const creditsRequested = Math.floor(Number(args.creditsRequested));

  if (!tenantId || !requesterUserId) {
    throw new Error("tenantId and requesterUserId are required.");
  }

  const cashoutConfig = await getTenantCashoutConfig(tenantId);
  const minimumCredits = cashoutConfig.minimumCredits;

  if (!Number.isFinite(creditsRequested) || creditsRequested < minimumCredits) {
    throw new Error(`Minimum ${minimumCredits} credits are required for cashout.`);
  }

  const requesterRecord = await resolveUserRecordByAnyId(requesterUserId);
  if (!requesterRecord) {
    throw new Error("Requester profile could not be resolved.");
  }

  const requesterUserType = String(requesterRecord.data.userType ?? "").trim();
  const requesterTenantId = String(requesterRecord.data.tenantId ?? "").trim();
  const requesterAssociatedCompanyId = String(requesterRecord.data.associatedCompanyId ?? "").trim();
  const requesterCompanyName = String(requesterRecord.data.companyName ?? "").trim();
  const requesterCanonicalUserId =
    String(requesterRecord.data.userId ?? requesterRecord.id).trim() || requesterRecord.id;

  if (requesterTenantId !== tenantId) {
    throw new Error("Requester belongs to a different tenant.");
  }

  const isCompany = requesterUserType === "company";
  const isIndependentProfessional = requesterUserType === "professional" && !requesterAssociatedCompanyId;

  if (!isCompany && !isIndependentProfessional) {
    throw new Error("Cashout is allowed only for company users and independent coaches.");
  }

  // Calculate redeemable balance from wallet transactions
  const txQuery = query(
    collection(db, "walletTransactions"),
    where("userId", "==", requesterCanonicalUserId),
    where("tenantId", "==", tenantId),
    where("transactionType", "==", "credit")
  );
  const txSnap = await getDocs(txQuery);

  let redeemableBalance = 0;
  let nonRedeemableBalance = 0;

  txSnap.docs.forEach((entry) => {
    const txData = entry.data() as Record<string, unknown>;
    const coins = toNumber(txData.coins);
    const source = String(txData.source ?? "");

    if (isRedeemableSource(source)) {
      redeemableBalance += coins;
    } else {
      nonRedeemableBalance += coins;
    }
  });

  // Check if requested credits exceed redeemable balance
  if (redeemableBalance < creditsRequested) {
    throw new Error(
      `Insufficient redeemable credits. Requested: ${creditsRequested}, Redeemable balance: ${redeemableBalance}. ` +
      `Non-redeemable credits (registration, referral bonuses): ${nonRedeemableBalance}. ` +
      `You can use non-redeemable credits within the platform but they cannot be cashed out.`
    );
  }

  const grossAmountRs = roundMoney(creditsRequested * cashoutConfig.creditCost);
  const payoutAmountRs = roundMoney(grossAmountRs * (cashoutConfig.cashbackPercentage / 100));

  const requestRef = doc(collection(db, "cashoutRequests"));
  const scopedWalletId = buildWalletId(requesterCanonicalUserId, tenantId);
  const scopedWalletRef = doc(db, "wallets", scopedWalletId);
  const legacyWalletRef = doc(db, "wallets", requesterCanonicalUserId);

  const scopedPreCheck = await getDoc(scopedWalletRef).catch(() => null);
  const needsLegacyCheck = !scopedPreCheck?.exists();

  await runTransaction(db, async (transaction) => {
    const scopedSnap = await transaction.get(scopedWalletRef);

    let legacyData: Record<string, unknown> | null = null;
    if (needsLegacyCheck) {
      try {
        const legacySnap = await transaction.get(legacyWalletRef);
        legacyData = legacySnap.exists() ? (legacySnap.data() as Record<string, unknown>) : null;
      } catch {
        legacyData = null;
      }
    }

    const scopedData = scopedSnap.exists() ? (scopedSnap.data() as Record<string, unknown>) : null;
    const useLegacy = !scopedData && Boolean(legacyData && String(legacyData.tenantId ?? "") === tenantId);
    const current = scopedData ?? (useLegacy ? legacyData : null);

    if (!current) {
      throw new Error("Requester wallet not found.");
    }

    const targetWalletRef = useLegacy ? legacyWalletRef : scopedWalletRef;
    const targetWalletId = useLegacy ? requesterCanonicalUserId : scopedWalletId;
    const availableCoins = toNumber(current.availableCoins);
    const utilizedCoins = toNumber(current.utilizedCoins);

    if (availableCoins < creditsRequested) {
      throw new Error(`Insufficient wallet balance. Requested: ${creditsRequested}, Available: ${availableCoins}.`);
    }

    transaction.set(
      targetWalletRef,
      {
        availableCoins: availableCoins - creditsRequested,
        utilizedCoins: utilizedCoins + creditsRequested,
        updatedBy: requesterUserId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const walletTxRef = doc(collection(db, "walletTransactions"));
    transaction.set(walletTxRef, {
      walletId: targetWalletId,
      userId: requesterCanonicalUserId,
      tenantId,
      userType: current.userType,
      userName: String(current.userName ?? requesterName),
      transactionType: "debit",
      reason: `Cashout request submitted (${creditsRequested} credits)` ,
      source: "cashout",
      coins: creditsRequested,
      createdBy: requesterUserId,
      createdAt: serverTimestamp(),
    });

    transaction.set(requestRef, {
      tenantId,
      requesterUserId: requesterCanonicalUserId,
      requesterName,
      requesterCompanyName: isCompany ? (requesterCompanyName || requesterName) : "",
      requesterUserType: isCompany ? "company" : "professional",
      requesterAssociatedCompanyId: requesterAssociatedCompanyId || null,
      creditsRequested,
      creditCost: cashoutConfig.creditCost,
      cashbackPercentage: cashoutConfig.cashbackPercentage,
      grossAmountRs,
      payoutAmountRs,
      requestComment: args.requestComment?.trim() || "",
      status: "pending",
      walletTransactionId: walletTxRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  try {
    await sendNotificationToUser({
      tenantId,
      userId: requesterCanonicalUserId,
      notificationType: "cashoutRequested",
      templateVariables: {
        recipientName: requesterName,
        creditsRequested,
        payoutAmountRs,
      },
      metadata: {
        requestId: requestRef.id,
      },
    });

    await sendAdminAlertToMasterSuperadmin({
      tenantId,
      notificationType: "adminCashoutAlert",
      templateVariables: {
        tenantName: tenantId,
      },
      metadata: {
        requestId: requestRef.id,
      },
    });
  } catch {
    // Cashout request creation should not fail if notifications fail.
  }
  });

  return requestRef.id;
}

export async function listCashoutRequests(args?: {
  tenantId?: string;
  requesterUserId?: string;
}): Promise<CashoutRequest[]> {
  if (args?.requesterUserId) {
    const snap = await getDocs(
      query(collection(db, "cashoutRequests"), where("requesterUserId", "==", args.requesterUserId))
    );

    const records = snap.docs
      .map((entry) => mapCashoutRequestDoc(entry.id, entry.data() as Record<string, unknown>))
      .filter((entry) => !args.tenantId || entry.tenantId === args.tenantId);

    return records.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt);
    });
  }

  if (args?.tenantId) {
    const snap = await getDocs(query(collection(db, "cashoutRequests"), where("tenantId", "==", args.tenantId)));
    return snap.docs
      .map((entry) => mapCashoutRequestDoc(entry.id, entry.data() as Record<string, unknown>))
      .sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt);
      });
  }

  const snap = await getDocs(collection(db, "cashoutRequests"));
  return snap.docs
    .map((entry) => mapCashoutRequestDoc(entry.id, entry.data() as Record<string, unknown>))
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt);
    });
}

export async function listCashoutRequestsForUserContext(args: {
  userIds: string[];
  tenantId?: string;
}): Promise<CashoutRequest[]> {
  const normalizedIds = Array.from(new Set(args.userIds.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    normalizedIds.map((requesterUserId) => listCashoutRequests({ requesterUserId, tenantId: args.tenantId }))
  );

  const deduped = snapshots.flat().reduce<CashoutRequest[]>((acc, item) => {
    if (!acc.some((existing) => existing.id === item.id)) {
      acc.push(item);
    }
    return acc;
  }, []);

  return deduped.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt);
  });
}

export async function approveCashoutRequest(args: {
  requestId: string;
  approvedBy: string;
  comment?: string;
}): Promise<void> {
  const requestRef = doc(db, "cashoutRequests", args.requestId);
  let requesterUserId = "";
  let tenantId = "";
  let requesterName = "User";
  let payoutAmountRs = 0;
  let payoutReference = "";

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error("Cashout request not found.");
    }

    const requestData = requestSnap.data() as Record<string, unknown>;
    const status = String(requestData.status ?? "pending");
    requesterUserId = String(requestData.requesterUserId ?? "").trim();
    tenantId = String(requestData.tenantId ?? "").trim();
    requesterName = String(requestData.requesterName ?? "User").trim() || "User";
    payoutAmountRs = Number(requestData.payoutAmountRs ?? 0);
    payoutReference = `placeholder_${args.requestId}`;

    if (status !== "pending") {
      throw new Error(`Cannot approve request with status: ${status}`);
    }

    transaction.update(requestRef, {
      status: "approved",
      approvalComment: args.comment?.trim() || "Approved",
      approvedBy: args.approvedBy,
      approvedAt: serverTimestamp(),
      payoutProvider: "razorpay",
      payoutStatus: "queued_placeholder",
      payoutReference,
      updatedAt: serverTimestamp(),
    });
  });

  if (tenantId && requesterUserId) {
    try {
      await sendNotificationToUser({
        tenantId,
        userId: requesterUserId,
        notificationType: "cashoutApproved",
        templateVariables: {
          recipientName: requesterName,
          payoutAmountRs,
          payoutReference,
        },
        metadata: {
          requestId: args.requestId,
        },
      });
    } catch {
      // Approval should not fail if notification fails.
    }
  }
}

export async function denyCashoutRequest(args: {
  requestId: string;
  deniedBy: string;
  reason: string;
}): Promise<void> {
  const reason = args.reason.trim();
  if (!reason) {
    throw new Error("Denial reason is required.");
  }

  const requestRef = doc(db, "cashoutRequests", args.requestId);
  let requesterUserId = "";
  let tenantId = "";
  let requesterName = "User";

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) {
      throw new Error("Cashout request not found.");
    }

    const requestData = requestSnap.data() as Record<string, unknown>;
    const status = String(requestData.status ?? "pending");
    requesterUserId = String(requestData.requesterUserId ?? "").trim();
    tenantId = String(requestData.tenantId ?? "").trim();
    requesterName = String(requestData.requesterName ?? "User").trim() || "User";
    if (status !== "pending") {
      throw new Error(`Cannot deny request with status: ${status}`);
    }

    const txTenantId = String(requestData.tenantId ?? "").trim();
    const txRequesterUserId = String(requestData.requesterUserId ?? "").trim();
    const creditsRequested = Math.floor(Number(requestData.creditsRequested ?? 0));

    if (!txTenantId || !txRequesterUserId || creditsRequested <= 0) {
      throw new Error("Cashout request data is invalid.");
    }

    const scopedWalletId = buildWalletId(txRequesterUserId, txTenantId);
    const scopedWalletRef = doc(db, "wallets", scopedWalletId);
    const legacyWalletRef = doc(db, "wallets", txRequesterUserId);

    const [scopedSnap, legacySnap] = await Promise.all([
      transaction.get(scopedWalletRef),
      transaction.get(legacyWalletRef),
    ]);

    const scopedData = scopedSnap.exists() ? (scopedSnap.data() as Record<string, unknown>) : null;
    const legacyData = legacySnap.exists() ? (legacySnap.data() as Record<string, unknown>) : null;
    const useLegacy = !scopedData && Boolean(legacyData && String(legacyData.tenantId ?? "") === txTenantId);
    const current = scopedData ?? (useLegacy ? legacyData : null);

    if (!current) {
      throw new Error("Requester wallet not found for refund.");
    }

    const targetWalletRef = useLegacy ? legacyWalletRef : scopedWalletRef;
    const targetWalletId = useLegacy ? txRequesterUserId : scopedWalletId;
    const currentAvailable = toNumber(current.availableCoins);
    const currentUtilized = toNumber(current.utilizedCoins);

    transaction.set(
      targetWalletRef,
      {
        availableCoins: currentAvailable + creditsRequested,
        utilizedCoins: Math.max(0, currentUtilized - creditsRequested),
        updatedBy: args.deniedBy,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const refundTxRef = doc(collection(db, "walletTransactions"));
    transaction.set(refundTxRef, {
      walletId: targetWalletId,
      userId: txRequesterUserId,
      tenantId: txTenantId,
      userType: current.userType,
      userName: String(current.userName ?? requestData.requesterName ?? "User"),
      transactionType: "credit",
      reason: `Cashout denied: ${reason}`,
      source: "cashout",
      coins: creditsRequested,
      createdBy: args.deniedBy,
      createdAt: serverTimestamp(),
    });

    transaction.update(requestRef, {
      status: "denied",
      denialReason: reason,
      approvalComment: reason,
      deniedBy: args.deniedBy,
      deniedAt: serverTimestamp(),
      refundTransactionId: refundTxRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  if (tenantId && requesterUserId) {
    try {
      await sendNotificationToUser({
        tenantId,
        userId: requesterUserId,
        notificationType: "cashoutDenied",
        templateVariables: {
          recipientName: requesterName,
          reason,
        },
        metadata: {
          requestId: args.requestId,
        },
      });
    } catch {
      // Denial should not fail if notification fails.
    }
  }
}

// ========== Coin Request Functions ==========

function mapCoinRequestDoc(id: string, data: Record<string, unknown>): CoinRequest {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    requesterProfessionalId: String(data.requesterProfessionalId ?? ""),
    requesterName: String(data.requesterName ?? ""),
    companyId: String(data.companyId ?? ""),
    companyName: String(data.companyName ?? ""),
    amount: toNumber(data.amount),
    message: typeof data.message === "string" ? data.message : undefined,
    status: (data.status as CoinRequest["status"]) ?? "pending",
    approvalComment: typeof data.approvalComment === "string" ? data.approvalComment : undefined,
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : undefined,
    approvedAt: data.approvedAt as CoinRequest["approvedAt"],
    deniedBy: typeof data.deniedBy === "string" ? data.deniedBy : undefined,
    deniedAt: data.deniedAt as CoinRequest["deniedAt"],
    createdAt: data.createdAt as CoinRequest["createdAt"],
    updatedAt: data.updatedAt as CoinRequest["updatedAt"],
  };
}

export async function requestCoins(args: {
  tenantId: string;
  professionalId: string;
  professionalName: string;
  companyId: string;
  companyName: string;
  amount: number;
  message?: string;
}): Promise<string> {
  if (args.amount <= 0) {
    throw new Error("Coin amount must be greater than 0");
  }

  const coinRequestRef = collection(db, "coinRequests");
  const docRef = await addDoc(coinRequestRef, {
    tenantId: args.tenantId,
    requesterProfessionalId: args.professionalId,
    requesterName: args.professionalName,
    companyId: args.companyId,
    companyName: args.companyName,
    amount: args.amount,
    message: args.message || "",
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await sendNotificationToUser({
      tenantId: args.tenantId,
      userId: args.professionalId,
      notificationType: "coinRequestSubmitted",
      templateVariables: {
        recipientName: args.professionalName,
        amount: args.amount,
      },
      metadata: {
        requestId: docRef.id,
      },
    });
  } catch {
    // Coin request creation should not fail if notification fails.
  }

  return docRef.id;
}

export async function getCoinRequestsForCompany(companyId: string): Promise<CoinRequest[]> {
  if (!companyId) return [];

  const q = query(
    collection(db, "coinRequests"),
    where("companyId", "==", companyId)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map((entry) => mapCoinRequestDoc(entry.id, entry.data() as Record<string, unknown>))
    .sort((a, b) => {
      // Sort pending first, then by date descending
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt);
    });
}

export async function getCoinRequestsForCompanyContext(companyIds: string[]): Promise<CoinRequest[]> {
  const normalizedIds = Array.from(new Set(companyIds.map((id) => id.trim()).filter(Boolean)));
  if (normalizedIds.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    normalizedIds.map((companyId) =>
      getDocs(query(collection(db, "coinRequests"), where("companyId", "==", companyId)))
    )
  );

  const results = snapshots
    .flatMap((snap) => snap.docs.map((entry) => mapCoinRequestDoc(entry.id, entry.data() as Record<string, unknown>)))
    .reduce<CoinRequest[]>((acc, item) => {
      if (!acc.some((existing) => existing.id === item.id)) {
        acc.push(item);
      }
      return acc;
    }, [])
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt);
    });

  return results;
}

export async function getCoinRequestsForProfessional(professionalId: string): Promise<CoinRequest[]> {
  if (!professionalId) return [];

  const q = query(
    collection(db, "coinRequests"),
    where("requesterProfessionalId", "==", professionalId)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map((entry) => mapCoinRequestDoc(entry.id, entry.data() as Record<string, unknown>))
    .sort((a, b) => toTransactionMillis(b.createdAt) - toTransactionMillis(a.createdAt));
}

export async function approveCoinRequest(args: {
  requestId: string;
  approvedBy: string;
  comment?: string;
}): Promise<void> {
  const requestRef = doc(db, "coinRequests", args.requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error("Coin request not found");
  }

  const requestData = requestSnap.data() as Record<string, unknown>;
  const status = requestData.status as string;

  if (status !== "pending") {
    throw new Error(`Cannot approve request with status: ${status}`);
  }

  const companyId = String(requestData.companyId ?? "");
  const professionalId = String(requestData.requesterProfessionalId ?? "");
  const amount = toNumber(requestData.amount);
  const tenantId = String(requestData.tenantId ?? "").trim();
  const requesterName = String(requestData.requesterName ?? "User").trim() || "User";

  if (amount <= 0) {
    throw new Error("Invalid coin amount");
  }

  // Transfer coins from company to professional
  await transferCoins({
    fromUserId: companyId,
    toUserId: professionalId,
    tenantId: String(requestData.tenantId ?? ""),
    amount: amount,
    reason: `Coin request approved: ${String(requestData.requesterName ?? "")}`,
    transactionType: "transfer",
    initiatedBy: args.approvedBy,
  });

  // Update request status
  await updateDoc(requestRef, {
    status: "approved",
    approvedBy: args.approvedBy,
    approvalComment: args.comment || "",
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (tenantId && professionalId) {
    try {
      await sendNotificationToUser({
        tenantId,
        userId: professionalId,
        notificationType: "coinRequestApproved",
        templateVariables: {
          recipientName: requesterName,
          amount,
        },
        metadata: {
          requestId: args.requestId,
        },
      });
    } catch {
      // Approval should not fail if notification fails.
    }
  }
}

export async function denyCoinRequest(args: {
  requestId: string;
  deniedBy: string;
  reason?: string;
}): Promise<void> {
  const requestRef = doc(db, "coinRequests", args.requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error("Coin request not found");
  }

  const requestData = requestSnap.data() as Record<string, unknown>;
  const status = requestData.status as string;
  const tenantId = String(requestData.tenantId ?? "").trim();
  const professionalId = String(requestData.requesterProfessionalId ?? "").trim();
  const requesterName = String(requestData.requesterName ?? "User").trim() || "User";
  const denialReason = args.reason || "Request denied";

  if (status !== "pending") {
    throw new Error(`Cannot deny request with status: ${status}`);
  }

  await updateDoc(requestRef, {
    status: "denied",
    deniedBy: args.deniedBy,
    approvalComment: denialReason,
    deniedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (tenantId && professionalId) {
    try {
      await sendNotificationToUser({
        tenantId,
        userId: professionalId,
        notificationType: "coinRequestDenied",
        templateVariables: {
          recipientName: requesterName,
          reason: denialReason,
        },
        metadata: {
          requestId: args.requestId,
        },
      });
    } catch {
      // Denial should not fail if notification fails.
    }
  }
}

async function transferCoins(args: {
  fromUserId: string;
  toUserId: string;
  tenantId: string;
  amount: number;
  reason: string;
  transactionType: "transfer";
  initiatedBy: string;
}): Promise<void> {
  if (args.amount <= 0) {
    throw new Error("Transfer amount must be greater than 0");
  }

  const fromScopedId = buildWalletId(args.fromUserId, args.tenantId);
  const toScopedId = buildWalletId(args.toUserId, args.tenantId);
  const fromWalletRef = doc(db, "wallets", fromScopedId);
  const toWalletRef = doc(db, "wallets", toScopedId);
  const fromLegacyWalletRef = doc(db, "wallets", args.fromUserId);
  const toLegacyWalletRef = doc(db, "wallets", args.toUserId);

  await runTransaction(db, async (transaction) => {
    const [fromScopedSnap, toScopedSnap, fromLegacySnap, toLegacySnap] = await Promise.all([
      transaction.get(fromWalletRef),
      transaction.get(toWalletRef),
      transaction.get(fromLegacyWalletRef),
      transaction.get(toLegacyWalletRef),
    ]);

    const fromScopedData = fromScopedSnap.exists() ? (fromScopedSnap.data() as Record<string, unknown>) : null;
    const toScopedData = toScopedSnap.exists() ? (toScopedSnap.data() as Record<string, unknown>) : null;
    const fromLegacyData = fromLegacySnap.exists() ? (fromLegacySnap.data() as Record<string, unknown>) : null;
    const toLegacyData = toLegacySnap.exists() ? (toLegacySnap.data() as Record<string, unknown>) : null;

    const fromData = fromScopedData
      ?? (fromLegacyData && String(fromLegacyData.tenantId ?? "") === args.tenantId ? fromLegacyData : null);
    const toData = toScopedData
      ?? (toLegacyData && String(toLegacyData.tenantId ?? "") === args.tenantId ? toLegacyData : null);

    if (!fromData) {
      throw new Error("Sender wallet not found");
    }

    if (!toData) {
      throw new Error("Recipient wallet not found");
    }

    const useLegacyFrom = !fromScopedData && Boolean(fromLegacyData && String(fromLegacyData.tenantId ?? "") === args.tenantId);
    const useLegacyTo = !toScopedData && Boolean(toLegacyData && String(toLegacyData.tenantId ?? "") === args.tenantId);
    const fromTargetRef = useLegacyFrom ? fromLegacyWalletRef : fromWalletRef;
    const toTargetRef = useLegacyTo ? toLegacyWalletRef : toWalletRef;
    const fromWalletId = useLegacyFrom ? args.fromUserId : fromScopedId;
    const toWalletId = useLegacyTo ? args.toUserId : toScopedId;

    const fromAvailable = toNumber(fromData.availableCoins);
    const toAvailable = toNumber(toData.availableCoins);

    if (fromAvailable < args.amount) {
      throw new Error("Insufficient coins for transfer");
    }

    // Update sender wallet
    transaction.set(
      fromTargetRef,
      {
        availableCoins: fromAvailable - args.amount,
        utilizedCoins: toNumber(fromData.utilizedCoins) + args.amount,
        updatedBy: args.initiatedBy,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Update recipient wallet
    transaction.set(
      toTargetRef,
      {
        availableCoins: toAvailable + args.amount,
        updatedBy: args.initiatedBy,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Create sender transaction record (Sent)
    const senderTxRef = doc(collection(db, "walletTransactions"));
    transaction.set(senderTxRef, {
      walletId: fromWalletId,
      userId: args.fromUserId,
      tenantId: fromData.tenantId,
      userType: fromData.userType,
      userName: fromData.userName,
      transactionType: "sent",
      coins: args.amount,
      reason: args.reason,
      createdBy: args.initiatedBy,
      createdAt: serverTimestamp(),
    });

    // Create recipient transaction record (Received)
    const recipientTxRef = doc(collection(db, "walletTransactions"));
    transaction.set(recipientTxRef, {
      walletId: toWalletId,
      userId: args.toUserId,
      tenantId: toData.tenantId,
      userType: toData.userType,
      userName: toData.userName,
      transactionType: "received",
      coins: args.amount,
      reason: args.reason,
      createdBy: args.initiatedBy,
      createdAt: serverTimestamp(),
    });
  });
}
