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
        row.associatedCompanyId === args.companyId
    )
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function createScopedManagedUser(input: CreateManagedUserInput): Promise<CreateScopedManagedUserResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in.");
  }

  const creator = await getUserById(currentUser.uid);
  if (!creator) {
    throw new Error("Your profile could not be resolved.");
  }

  const creatorRole = creator.userType;
  if (creatorRole !== "company" && creatorRole !== "professional") {
    throw new Error("Only Company or Professional can create users.");
  }

  const targetUserType = input.targetUserType;
  if (targetUserType !== "professional" && targetUserType !== "individual") {
    throw new Error("Invalid target user type.");
  }

  if (creatorRole === "professional" && targetUserType !== "individual") {
    throw new Error(`Professional can create only Individual users. [svc creatorRole=${creatorRole} target=${targetUserType} creatorId=${creator.id}]`);
  }

  const tenantId = creator.tenantId;
  if (!tenantId) {
    throw new Error("Creator tenant is missing.");
  }

  const firstName = toStringValue(input.firstName);
  const lastName = toStringValue(input.lastName);
  const email = normalizeEmail(input.email);
  const phoneE164 = normalizePhone(input.phoneE164);

  const associatedCompanyId = creatorRole === "company" ? creator.id : creator.associatedCompanyId || null;

  let associatedProfessionalId: string | null = null; // null is safe for Firestore (unlike undefined)
  if (creatorRole === "company" && targetUserType === "individual" && input.coachProfessionalId?.trim()) {
    const coachId = input.coachProfessionalId.trim();
    const coach = await getUserById(coachId);
    if (!coach) {
      throw new Error("Selected coach not found.");
    }
    if (coach.userType !== "professional") {
      throw new Error("Selected coach is not a Professional.");
    }
    if (coach.tenantId !== tenantId || coach.associatedCompanyId !== creator.id) {
      throw new Error("Coach must belong to same Company.");
    }
    if (coach.status === "inactive") {
      throw new Error("Selected coach is inactive.");
    }
    associatedProfessionalId = coachId;
  }

  if (creatorRole === "professional" && targetUserType === "individual") {
    associatedProfessionalId = creator.id;
  }

  const existingByPhone = await getDocs(
    query(collection(db, "users"), where("phoneE164", "==", phoneE164), limit(1))
  );

  if (!existingByPhone.empty) {
    const existingRow = existingByPhone.docs[0];
    const existing = mapManagedUser(existingRow.id, existingRow.data() as Record<string, unknown>);

    if (existing.userType !== targetUserType) {
      throw new Error("The phone number belongs to a different user type.");
    }

    if (existing.tenantId && existing.tenantId !== tenantId) {
      throw new Error("This user belongs to another tenant and cannot be associated here.");
    }

    if (targetUserType === "professional" && creatorRole !== "company") {
      throw new Error("Only Company can associate Professional users.");
    }

    const updatePayload: Record<string, unknown> = {
      tenantId,
      ...(associatedCompanyId != null && { associatedCompanyId }),
      companyName: creator.companyName ?? existing.companyName ?? "",
      updatedAt: serverTimestamp(),
    };

    if (targetUserType === "individual") {
      if (creatorRole === "professional") {
        updatePayload.associatedProfessionalId = creator.id;
      } else if (associatedProfessionalId) {
        updatePayload.associatedProfessionalId = associatedProfessionalId;
      }
    }

    await setDoc(doc(db, "users", existing.id), updatePayload, { merge: true });
    const refreshed = await getUserById(existing.id);
    if (!refreshed) {
      throw new Error("Failed to refresh associated user.");
    }

    return {
      operation: "associated",
      user: refreshed,
    };
  }

  const existingInvitation = await getDocs(
    query(
      collection(db, "invitations"),
      where("phoneE164", "==", phoneE164),
      where("status", "==", "pending"),
      limit(1)
    )
  );

  if (!existingInvitation.empty) {
    const invitationRow = existingInvitation.docs[0];
    const invitationData = invitationRow.data() as Record<string, unknown>;
    const invitationTenantId = toStringValue(invitationData.tenantId);
    const invitationUserType = toStringValue(invitationData.userType);

    if (invitationUserType !== targetUserType) {
      throw new Error("The phone number is already invited as a different user type.");
    }
    if (invitationTenantId && invitationTenantId !== tenantId) {
      throw new Error("This phone is already invited under another tenant.");
    }
    if (targetUserType === "professional" && creatorRole !== "company") {
      throw new Error("Only Company can associate Professional users.");
    }

    const updatePayload: Record<string, unknown> = {
      tenantId,
      associatedCompanyId: associatedCompanyId ?? null,
      companyName: creator.companyName ?? toStringValue(invitationData.companyName) ?? "",
      updatedAt: serverTimestamp(),
    };
    if (targetUserType === "individual") {
      if (creatorRole === "professional") {
        updatePayload.associatedProfessionalId = creator.id;
      } else if (associatedProfessionalId) {
        updatePayload.associatedProfessionalId = associatedProfessionalId;
      }
    }
    await updateDoc(doc(db, "invitations", invitationRow.id), updatePayload);

    const refreshedSnap = await getDoc(doc(db, "invitations", invitationRow.id));
    const refreshed = mapInvitationAsManagedUser(
      invitationRow.id,
      (refreshedSnap.data() ?? {}) as Record<string, unknown>
    );
    return {
      operation: "associated",
      user: refreshed,
    };
  }

  if (!firstName || !lastName || !email || !phoneE164) {
    throw new Error("firstName, lastName, email, and phoneE164 are required when creating a new user.");
  }

  if (!isValidEmail(email)) {
    throw new Error("Invalid email format.");
  }

  const duplicateByEmail = await getDocs(
    query(collection(db, "users"), where("email", "==", email), limit(1))
  );
  if (!duplicateByEmail.empty) {
    throw new Error("A user with this email already exists.");
  }

  const duplicateInvitationByEmail = await getDocs(
    query(
      collection(db, "invitations"),
      where("email", "==", email),
      where("status", "==", "pending"),
      limit(1)
    )
  );
  if (!duplicateInvitationByEmail.empty) {
    throw new Error("An invitation with this email is already pending.");
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const invitation = await createInvitation({
    tenantId,
    userType: targetUserType,
    role: targetUserType,
    firstName,
    lastName,
    fullName,
    email,
    phoneE164,
    phone: phoneE164,
    associatedCompanyId: associatedCompanyId ?? null,
    associatedProfessionalId: associatedProfessionalId ?? null,
    companyName: creator.companyName ?? "",
    createdByUserId: creator.id,
    createdByRole: creatorRole,
  });

  try {
    const mailConfig = await getTenantMailConfig(tenantId);
    const tenantConfig = getTenantConfigById(tenantId);
    const roleLabel = targetUserType === "professional"
      ? tenantConfig?.roles.professional ?? "Coach"
      : tenantConfig?.roles.individual ?? "Coachee";
    await sendInvitationEmail({
      mailConfig,
      tenantId,
      inviteeEmail: email,
      inviteeName: fullName,
      inviterName: creator.fullName || creator.firstName || "A team member",
      roleLabel,
      phoneE164,
    });
  } catch (mailError) {
    console.warn("Failed to send invitation email", mailError);
  }

  return {
    operation: "created",
    user: mapInvitationAsManagedUser(invitation.invitationId, {
      tenantId: invitation.tenantId,
      userType: invitation.userType,
      role: invitation.role,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      fullName: invitation.fullName,
      email: invitation.email,
      phoneE164: invitation.phoneE164,
      phone: invitation.phone,
      companyName: invitation.companyName,
      associatedCompanyId: invitation.associatedCompanyId,
      associatedProfessionalId: invitation.associatedProfessionalId,
      createdByUserId: invitation.createdByUserId,
      createdByRole: invitation.createdByRole,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    }),
  };
}

export async function lookupScopedIndividualByPhone(input: {
  targetUserType: "professional" | "individual";
  phoneE164: string;
  coachProfessionalId?: string;
}): Promise<ScopedPhoneLookupResult> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in.");
  }

  // Get the current user's profile to extract tenantId
  const currentUserProfile = await getUserById(currentUser.uid);
  if (!currentUserProfile) {
    throw new Error("Your profile could not be resolved.");
  }

  // Query Firestore directly for a user with matching phone and tenant
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("phoneE164", "==", input.phoneE164),
      where("tenantId", "==", currentUserProfile.tenantId)
    )
  );

  if (!snap.empty) {
    const foundUser = mapManagedUser(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>);
    if (foundUser.userType === input.targetUserType) {
      return { found: true, user: foundUser };
    }
  }

  const invitationSnap = await getDocs(
    query(
      collection(db, "invitations"),
      where("phoneE164", "==", input.phoneE164),
      where("tenantId", "==", currentUserProfile.tenantId),
      where("status", "==", "pending"),
      limit(1)
    )
  );
  if (!invitationSnap.empty) {
    const invitation = mapInvitationAsManagedUser(
      invitationSnap.docs[0].id,
      invitationSnap.docs[0].data() as Record<string, unknown>
    );
    if (invitation.userType === input.targetUserType) {
      return { found: true, user: invitation };
    }
  }

  return { found: false };
}
