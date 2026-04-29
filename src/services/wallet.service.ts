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
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "@/services/firebase";
import { functions } from "@/services/firebase";
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

const WALLET_ID_SEPARATOR = "::";
const TREASURY_WALLET_PREFIX = "treasury::";

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
    assignmentId: typeof data.assignmentId === "string" ? data.assignmentId : undefined,
    activityType: typeof data.activityType === "string" ? data.activityType : undefined,
    activityId: typeof data.activityId === "string" ? data.activityId : undefined,
    createdBy: String(data.createdBy ?? ""),
    createdAt: data.createdAt as WalletTransactionRecord["createdAt"],
  };
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
  await issueRegistrationBonusCallable({
    userId: args.userId,
    tenantId: args.tenantId,
  });
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

  const legacySnap = await getDoc(doc(db, "wallets", userId));
  if (legacySnap.exists()) {
    const legacyWallet = mapWalletDoc(legacySnap.id, legacySnap.data() as Record<string, unknown>);
    if (legacyWallet.tenantId === tenantId) {
      return legacyWallet;
    }
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
}): Promise<WalletTransactionRecord[]> {
  const normalizedIds = Array.from(new Set(args.userIds.map((id) => id.trim()).filter(Boolean)));

  try {
    const snapshots = await Promise.all(
      normalizedIds.flatMap((userId) => {
        const queries = [
          getDocs(query(collection(db, "walletTransactions"), where("userId", "==", userId))),
          getDocs(query(collection(db, "walletTransactions"), where("createdBy", "==", userId))),
          getDocs(query(collection(db, "walletTransactions"), where("walletId", "==", userId))),
        ];

        if (args.tenantId) {
          queries.push(
            getDocs(
              query(
                collection(db, "walletTransactions"),
                where("walletId", "==", buildWalletId(userId, args.tenantId))
              )
            )
          );
        }

        return queries;
      })
    );

    const allMatched = snapshots
      .flatMap((snapshot) =>
        snapshot.docs.map((entry) => mapWalletTransactionDoc(entry.id, entry.data() as Record<string, unknown>))
      )
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

export async function listWalletSummary(): Promise<WalletSummary> {
  const snap = await getDocs(collection(db, "wallets"));
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
  console.log("[listUsersForCoinAssignment] selected", {
    tenantId: args.tenantId,
    userType: args.userType,
    tenantQueryDocs: snap.size,
  });

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
    console.log("[listUsersForCoinAssignment] fallback to full users scan", {
      totalUsers: allUsersSnap.size,
    });
  }

  const results = candidates
    .filter(
      (user) =>
        normalizeTenantKey(user.tenantId) === selectedTenant &&
        normalizeString(user.userType) === selectedUserType &&
        (typeof user.status === "undefined" || normalizeString(user.status) === "active")
    )
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  console.log("[listUsersForCoinAssignment] filtered", {
    count: results.length,
    selectedTenantCanonical: selectedTenant,
    users: results.map((u) => ({
      id: u.id,
      name: u.name,
      tenantId: u.tenantId,
      tenantIdCanonical: normalizeTenantKey(u.tenantId),
      userType: u.userType,
    })),
  });
  return results;
}

export async function assignCoins(input: AssignCoinsInput): Promise<void> {
  if (input.coinsToAssign <= 0) {
    throw new Error("Coins to assign must be greater than 0.");
  }

  const scopedWalletId = buildWalletId(input.userId, input.tenantId);
  const scopedWalletRef = doc(db, "wallets", scopedWalletId);
  const legacyWalletRef = doc(db, "wallets", input.userId);

  await runTransaction(db, async (transaction) => {
    const [scopedSnap, legacySnap] = await Promise.all([
      transaction.get(scopedWalletRef),
      transaction.get(legacyWalletRef),
    ]);

    const scopedCurrent = scopedSnap.exists() ? (scopedSnap.data() as Record<string, unknown>) : null;
    const legacyCurrent = legacySnap.exists() ? (legacySnap.data() as Record<string, unknown>) : null;
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

  await runTransaction(db, async (transaction) => {
    const [scopedSnap, legacySnap] = await Promise.all([
      transaction.get(scopedWalletRef),
      transaction.get(legacyWalletRef),
    ]);
    const legacyData = legacySnap.exists() ? (legacySnap.data() as Record<string, unknown>) : null;
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
      userId: treasuryWalletId,
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
        userId: treasuryWalletId,
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

  console.log("[wallet.requestCoins] Writing coin request with companyId:", args.companyId);

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

  console.log("[wallet.requestCoins] Created request with ID:", docRef.id);
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
  
  console.log("[getCoinRequestsForCompanyContext] Querying with companyIds:", normalizedIds);
  
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

  console.log("[getCoinRequestsForCompanyContext] Found", results.length, "requests:", results.map((r) => ({ id: r.id, companyId: r.companyId, status: r.status })));
  
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

  if (status !== "pending") {
    throw new Error(`Cannot deny request with status: ${status}`);
  }

  await updateDoc(requestRef, {
    status: "denied",
    deniedBy: args.deniedBy,
    approvalComment: args.reason || "Request denied",
    deniedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
