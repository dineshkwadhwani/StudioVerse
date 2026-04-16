import { auth, db } from "@/services/firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";

export type ManageUserRole = "company" | "professional" | "individual";

export type ManagedUserRecord = {
  id: string;
  userId: string;
  tenantId: string;
  userType: "professional" | "individual";
  status: "active" | "inactive";
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
  companyName?: string;
  associatedProfessionalId?: string | null;
  associatedCompanyId?: string;
  createdByUserId?: string;
  createdByRole?: string;
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

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapManagedUser(id: string, data: Record<string, unknown>): ManagedUserRecord {
  const firstName = toStringValue(data.firstName);
  const lastName = toStringValue(data.lastName);
  const fullName = toStringValue(data.fullName || data.name || `${firstName} ${lastName}`.trim());

  return {
    id,
    userId: toStringValue(data.userId || data.uid || id),
    tenantId: toStringValue(data.tenantId),
    userType:
      toStringValue(data.userType || data.profileType || data.role) === "professional"
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
    createdByUserId: toStringValue(data.createdByUserId) || undefined,
    createdByRole: toStringValue(data.createdByRole) || undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

export async function getUserById(userId: string): Promise<ManagedUserRecord | null> {
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
  const snap = await getDocs(query(collection(db, "users"), where("tenantId", "==", args.tenantId)));
  return snap.docs
    .map((row) => mapManagedUser(row.id, row.data() as Record<string, unknown>))
    .filter(
      (row) =>
        (row.userType === "professional" || row.userType === "individual") &&
        row.associatedCompanyId === args.companyId
    )
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function listManagedUsersForProfessional(args: {
  professionalId: string;
}): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("associatedProfessionalId", "==", args.professionalId)
    )
  );

  return snap.docs
    .map((row) => mapManagedUser(row.id, row.data() as Record<string, unknown>))
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
        row.associatedCompanyId === args.companyId
    )
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function createScopedManagedUser(input: CreateManagedUserInput): Promise<ManagedUserRecord> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/users/create-scoped", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const raw = await response.text();
  let parsed: { error?: string; requestId?: string; user?: ManagedUserRecord } = {};
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      // keep default
    }
  }

  if (!response.ok || !parsed.user) {
    const message =
      parsed.error ||
      `Failed to create user (HTTP ${response.status}).`;
    throw new Error(parsed.requestId ? `${message} (Request ID: ${parsed.requestId})` : message);
  }

  return parsed.user;
}
