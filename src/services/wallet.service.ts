import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { AssignCoinsInput, WalletRecord, WalletSummary, WalletUserType } from "@/types/wallet";

type AdminSelectableUser = {
  id: string;
  name: string;
  userType: WalletUserType;
  status: "active" | "inactive";
  tenantId?: string;
};

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

export async function getWalletByUserId(userId: string): Promise<WalletRecord | null> {
  if (!userId) return null;
  const snap = await getDoc(doc(db, "wallets", userId));
  if (!snap.exists()) return null;
  return mapWalletDoc(snap.id, snap.data() as Record<string, unknown>);
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

  const walletRef = doc(db, "wallets", input.userId);

  await runTransaction(db, async (transaction) => {
    const walletSnap = await transaction.get(walletRef);
    const current = walletSnap.exists() ? (walletSnap.data() as Record<string, unknown>) : null;

    const existingIssued = current ? toNumber(current.totalIssuedCoins) : 0;
    const existingUtilized = current ? toNumber(current.utilizedCoins) : 0;
    const existingAvailable = current ? toNumber(current.availableCoins) : 0;

    const nextIssued = existingIssued + input.coinsToAssign;
    const nextAvailable = existingAvailable + input.coinsToAssign;

    transaction.set(
      walletRef,
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
      walletId: input.userId,
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
