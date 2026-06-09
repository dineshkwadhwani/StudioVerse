import { auth, db } from "@/services/firebase";
import {
  collection,
  getDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { createInvitation } from "@/services/invitations.service";
import { getTenantMailConfig, sendInvitationEmail } from "@/services/mail.service";
import { getTenantConfigById } from "@/tenants";

export type ManageUserRole = "company" | "professional" | "individual";

export type ManagedUserRecord = {
  id: string;
  userId: string;
  uid?: string;
  tenantId: string;
  userType: ManageUserRole;
  status: "active" | "inactive";
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
  companyName?: string;
  associatedProfessionalId?: string | null;
  associatedCompanyId?: string;
  associatedCompanyIds?: string[];
  createdByUserId?: string;
  createdByRole?: string;
  isPending?: boolean;
  invitationId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CreateManagedUserInput = {
  targetUserType: "professional" | "individual";
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
  coachProfessionalId?: string;
};

export type CreateScopedManagedUserResult = {
  operation: "created" | "associated";
  user: ManagedUserRecord;
};

export type ScopedPhoneLookupResult = {
  found: boolean;
  user?: ManagedUserRecord;
};

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length > 10 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapManagedUser(id: string, data: Record<string, unknown>): ManagedUserRecord {
  const firstName = toStringValue(data.firstName);
  const lastName = toStringValue(data.lastName);
  const fullName = toStringValue(data.fullName || `${firstName} ${lastName}`.trim());

  return {
    id,
    userId: toStringValue(data.userId || data.uid || id),
    uid: toStringValue(data.uid) || undefined,
    tenantId: toStringValue(data.tenantId),
    userType:
      toStringValue(data.userType || data.profileType || data.role) === "company"
        ? "company"
        : toStringValue(data.userType || data.profileType || data.role) === "professional"
          ? "professional"
          : "individual",
    status: toStringValue(data.status) === "inactive" ? "inactive" : "active",
    firstName,
    lastName,
    fullName,
    email: toStringValue(data.email),
    phoneE164: toStringValue(data.phoneE164 || data.phone),
    companyName: toStringValue(data.companyName) || undefined,
    associatedProfessionalId: toStringValue(data.associatedProfessionalId) || null,
    associatedCompanyId: toStringValue(data.associatedCompanyId) || undefined,
    associatedCompanyIds: Array.isArray(data.associatedCompanyIds)
      ? (data.associatedCompanyIds as unknown[])
          .map((entry) => toStringValue(entry))
          .filter((entry) => entry.length > 0)
      : undefined,
    createdByUserId: toStringValue(data.createdByUserId) || undefined,
    createdByRole: toStringValue(data.createdByRole) || undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

function mapInvitationAsManagedUser(id: string, data: Record<string, unknown>): ManagedUserRecord {
  const firstName = toStringValue(data.firstName);
  const lastName = toStringValue(data.lastName);
  const fullName = toStringValue(data.fullName || `${firstName} ${lastName}`.trim());

  const userType =
    toStringValue(data.userType || data.role) === "professional" ? "professional" : "individual";

  return {
    id,
    userId: id,
    uid: undefined,
    tenantId: toStringValue(data.tenantId),
    userType,
    status: "active",
    firstName,
    lastName,
    fullName,
    email: toStringValue(data.email),
    phoneE164: toStringValue(data.phoneE164 || data.phone),
    companyName: toStringValue(data.companyName) || undefined,
    associatedProfessionalId: toStringValue(data.associatedProfessionalId) || null,
    associatedCompanyId: toStringValue(data.associatedCompanyId) || undefined,
    createdByUserId: toStringValue(data.createdByUserId) || undefined,
    createdByRole: toStringValue(data.createdByRole) || undefined,
    isPending: true,
    invitationId: id,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

async function callScopedManagedUserApi<T>(body: Record<string, unknown>): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/users/create-scoped", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Scoped user request failed.");
  }

  return payload as T;
}

async function listPendingInvitationsForCompany(args: {
  tenantId: string;
  companyId: string;
}): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, "invitations"),
      where("tenantId", "==", args.tenantId),
      where("associatedCompanyId", "==", args.companyId),
      where("status", "==", "pending")
    )
  );
  return snap.docs.map((row) => mapInvitationAsManagedUser(row.id, row.data() as Record<string, unknown>));
}

async function listPendingInvitationsForProfessional(args: {
  professionalId: string;
}): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, "invitations"),
      where("associatedProfessionalId", "==", args.professionalId),
      where("status", "==", "pending")
    )
  );
  return snap.docs.map((row) => mapInvitationAsManagedUser(row.id, row.data() as Record<string, unknown>));
}

export async function getUserById(userId: string): Promise<ManagedUserRecord | null> {
  const directDocSnap = await getDoc(doc(db, "users", userId));
  if (directDocSnap.exists()) {
    return mapManagedUser(directDocSnap.id, directDocSnap.data() as Record<string, unknown>);
  }

  const directSnap = await getDocs(query(collection(db, "users"), where("userId", "==", userId), limit(1)));
  if (!directSnap.empty) {
    const row = directSnap.docs[0];
    return mapManagedUser(row.id, row.data() as Record<string, unknown>);
  }

  const uidSnap = await getDocs(query(collection(db, "users"), where("uid", "==", userId), limit(1)));
  if (!uidSnap.empty) {
    const row = uidSnap.docs[0];
    return mapManagedUser(row.id, row.data() as Record<string, unknown>);
  }

  return null;
}

export async function listManagedUsersForCompany(args: {
  tenantId: string;
  companyId: string;
}): Promise<ManagedUserRecord[]> {
  const [snap, pending] = await Promise.all([
    getDocs(query(collection(db, "users"), where("tenantId", "==", args.tenantId))),
    listPendingInvitationsForCompany({ tenantId: args.tenantId, companyId: args.companyId }),
  ]);
  const claimed = snap.docs
    .map((row) => mapManagedUser(row.id, row.data() as Record<string, unknown>))
    .filter(
      (row) =>
        (row.userType === "professional" || row.userType === "individual") &&
        row.associatedCompanyId === args.companyId
    );
  return [...claimed, ...pending].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function listManagedUsersForProfessional(args: {
  professionalId: string;
}): Promise<ManagedUserRecord[]> {
  const idCandidates = new Set<string>([toStringValue(args.professionalId)]);
  const professional = await getUserById(args.professionalId);

  if (professional) {
    idCandidates.add(toStringValue(professional.id));
    idCandidates.add(toStringValue(professional.userId));
    if (professional.uid) {
      idCandidates.add(toStringValue(professional.uid));
    }
  }

  const normalizedIds = Array.from(idCandidates).filter(Boolean);

  const snaps = await Promise.all(
    normalizedIds.map((professionalId) =>
      getDocs(
        query(
          collection(db, "users"),
          where("associatedProfessionalId", "==", professionalId)
        )
      )
    )
  );

  const merged = new Map<string, ManagedUserRecord>();
  for (const snap of snaps) {
    snap.docs.forEach((row) => {
      const mapped = mapManagedUser(row.id, row.data() as Record<string, unknown>);
      merged.set(mapped.id, mapped);
    });
  }

  const pendingSnaps = await Promise.all(
    normalizedIds.map((professionalId) =>
      listPendingInvitationsForProfessional({ professionalId })
    )
  );
  for (const list of pendingSnaps) {
    for (const row of list) {
      merged.set(row.id, row);
    }
  }

  return Array.from(merged.values())
    .filter((row) => row.userType === "individual")
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function listProfessionalsForCoachDropdown(args: {
  tenantId: string;
  companyId: string;
}): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(query(collection(db, "users"), where("tenantId", "==", args.tenantId)));
  return snap.docs
    .map((row) => mapManagedUser(row.id, row.data() as Record<string, unknown>))
    .filter(
      (row) =>
        row.userType === "professional" &&
        row.status === "active" &&
        (!row.associatedCompanyId || row.associatedCompanyId === args.companyId)
    )
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function createScopedManagedUser(input: CreateManagedUserInput): Promise<CreateScopedManagedUserResult> {
  const response = await callScopedManagedUserApi<{
    operation: "created" | "associated";
    user: Record<string, unknown>;
  }>({
    action: "create",
    targetUserType: input.targetUserType,
    firstName: toStringValue(input.firstName),
    lastName: toStringValue(input.lastName),
    email: normalizeEmail(input.email),
    phoneE164: normalizePhone(input.phoneE164),
    coachProfessionalId: input.coachProfessionalId?.trim() || undefined,
  });

  return {
    operation: response.operation,
    user: mapManagedUser(String(response.user.id ?? ""), response.user),
  };
}

export async function lookupScopedIndividualByPhone(input: {
  targetUserType: "professional" | "individual";
  phoneE164: string;
  coachProfessionalId?: string;
}): Promise<ScopedPhoneLookupResult> {
  const response = await callScopedManagedUserApi<{
    found: boolean;
    user?: Record<string, unknown>;
  }>({
    action: "lookup",
    targetUserType: input.targetUserType,
    firstName: "",
    lastName: "",
    email: "",
    phoneE164: normalizePhone(input.phoneE164),
    coachProfessionalId: input.coachProfessionalId?.trim() || undefined,
  });

  if (!response.found || !response.user) {
    return { found: false };
  }

  return {
    found: true,
    user: mapManagedUser(String(response.user.id ?? ""), response.user),
  };
}
