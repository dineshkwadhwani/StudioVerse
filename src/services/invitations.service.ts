import { db } from "@/services/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from "firebase/firestore";
import type {
  InvitationCreateInput,
  InvitationRecord,
  InvitationStatus,
} from "@/types/invitation";

const INVITATIONS_COLLECTION = "invitations";

function mapInvitation(id: string, data: Record<string, unknown>): InvitationRecord {
  return {
    invitationId: id,
    tenantId: String(data.tenantId ?? ""),
    userType: (data.userType as InvitationRecord["userType"]) ?? "individual",
    role: (data.role as InvitationRecord["role"]) ?? "individual",
    firstName: String(data.firstName ?? ""),
    lastName: String(data.lastName ?? ""),
    fullName: String(data.fullName ?? ""),
    name: String(data.name ?? ""),
    email: String(data.email ?? ""),
    phoneE164: String(data.phoneE164 ?? ""),
    phone: String(data.phone ?? data.phoneE164 ?? ""),
    associatedCompanyId: (data.associatedCompanyId as string | null) ?? null,
    associatedProfessionalId: (data.associatedProfessionalId as string | null) ?? null,
    companyName: String(data.companyName ?? ""),
    createdByUserId: String(data.createdByUserId ?? ""),
    createdByRole: (data.createdByRole as InvitationRecord["createdByRole"]) ?? "company",
    status: (data.status as InvitationStatus) ?? "pending",
    claimedUid: (data.claimedUid as string | null) ?? null,
    claimedUserId: (data.claimedUserId as string | null) ?? null,
    claimedAt: (data.claimedAt as Timestamp | null) ?? null,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

export async function createInvitation(input: InvitationCreateInput): Promise<InvitationRecord> {
  const invitationsRef = collection(db, INVITATIONS_COLLECTION);
  const docRef = await addDoc(invitationsRef, {
    ...input,
    status: "pending" as InvitationStatus,
    claimedUid: null,
    claimedUserId: null,
    claimedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const created = await getDoc(docRef);
  return mapInvitation(docRef.id, (created.data() ?? {}) as Record<string, unknown>);
}

export async function findPendingInvitationByPhone(args: {
  tenantId: string;
  phoneE164: string;
}): Promise<InvitationRecord | null> {
  const q = query(
    collection(db, INVITATIONS_COLLECTION),
    where("tenantId", "==", args.tenantId),
    where("phoneE164", "==", args.phoneE164),
    where("status", "==", "pending"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  const docSnap = snap.docs[0];
  return mapInvitation(docSnap.id, docSnap.data() as Record<string, unknown>);
}

export async function findInvitationByEmailOrPhone(args: {
  tenantId: string;
  email?: string;
  phoneE164?: string;
}): Promise<InvitationRecord | null> {
  if (args.phoneE164) {
    const byPhone = await findPendingInvitationByPhone({
      tenantId: args.tenantId,
      phoneE164: args.phoneE164,
    });
    if (byPhone) return byPhone;
  }
  if (args.email) {
    const q = query(
      collection(db, INVITATIONS_COLLECTION),
      where("tenantId", "==", args.tenantId),
      where("email", "==", args.email.toLowerCase()),
      where("status", "==", "pending"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return mapInvitation(docSnap.id, docSnap.data() as Record<string, unknown>);
    }
  }
  return null;
}

export async function getInvitationById(id: string): Promise<InvitationRecord | null> {
  const ref = doc(db, INVITATIONS_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapInvitation(snap.id, snap.data() as Record<string, unknown>);
}
