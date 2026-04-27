import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { CoinOrderRecord, CoinOrderStatus } from "@/types/coinOrder";
import type { WalletUserType } from "@/types/wallet";

const COLLECTION = "coinOrders";

function toStr(v: unknown): string {
  return String(v ?? "").trim();
}

function mapOrder(id: string, data: Record<string, unknown>): CoinOrderRecord {
  return {
    id,
    userId: toStr(data.userId),
    userName: toStr(data.userName),
    tenantId: toStr(data.tenantId),
    userType: (toStr(data.userType) || "individual") as WalletUserType,
    packageId: toStr(data.packageId),
    packageName: toStr(data.packageName),
    credits: typeof data.credits === "number" ? data.credits : Number(data.credits) || 0,
    priceInr: typeof data.priceInr === "number" ? data.priceInr : Number(data.priceInr) || 0,
    status: (toStr(data.status) || "pending") as CoinOrderStatus,
    createdAt: data.createdAt as CoinOrderRecord["createdAt"],
    updatedAt: data.updatedAt as CoinOrderRecord["updatedAt"],
  };
}

export async function createCoinOrder(input: {
  userId: string;
  userName: string;
  tenantId: string;
  userType: WalletUserType;
  packageId: string;
  packageName: string;
  credits: number;
  priceInr: number;
}): Promise<string> {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    ...input,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCoinOrderStatus(
  orderId: string,
  status: CoinOrderStatus
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, orderId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function listAllCoinOrders(): Promise<CoinOrderRecord[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>));
}

export async function listCoinOrdersForUser(userId: string): Promise<CoinOrderRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => mapOrder(d.id, d.data() as Record<string, unknown>));
}
