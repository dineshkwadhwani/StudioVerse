import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";
import { buildLeadUnlockId, type LeadUnlockRecord } from "@/types/lead";

export async function getLeadUnlock(args: {
  tenantId: string;
  unlockerUserId: string;
  leadUserId: string;
}): Promise<LeadUnlockRecord | null> {
  const id = buildLeadUnlockId(args);
  const snap = await getDoc(doc(db, "leadUnlocks", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<LeadUnlockRecord, "id">) };
}

export async function listLeadUnlocksFor(args: {
  tenantId: string;
  unlockerUserId: string;
}): Promise<LeadUnlockRecord[]> {
  const q = query(
    collection(db, "leadUnlocks"),
    where("tenantId", "==", args.tenantId),
    where("unlockerUserId", "==", args.unlockerUserId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeadUnlockRecord, "id">) }));
}

export type UnlockLeadResult = {
  status: "unlocked" | "already-unlocked" | "free";
  feeCoins: number;
  walletTransactionId?: string;
};

export async function unlockLead(args: {
  tenantId: string;
  leadUserId: string;
}): Promise<UnlockLeadResult> {
  const callable = httpsCallable<typeof args, UnlockLeadResult>(functions, "unlockLead");
  const result = await callable(args);
  return result.data;
}
