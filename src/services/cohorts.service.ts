import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { buildWalletId } from "@/services/wallet.service";
import {
  getUserById,
  listManagedUsersForCompany,
  listManagedUsersForProfessional,
  listProfessionalsForCoachDropdown,
  type ManagedUserRecord,
} from "@/services/manage-users.service";
import {
  MIN_COHORT_MEMBER_COUNT,
  type CohortAssignmentPayload,
  type CohortCreatorRole,
  type CohortDetail,
  type CohortListItem,
  type CohortMemberRecord,
  type CohortMemberUser,
  type CohortRecord,
  type CohortStatus,
  type NewCohortIndividualInput,
  type SaveCohortInput,
} from "@/types/cohort";

type UserDocData = Record<string, unknown>;

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

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

function mapCohort(id: string, data: Record<string, unknown>): CohortRecord {
  return {
    id,
    tenantId: toStringValue(data.tenantId),
    companyId: toStringValue(data.companyId),
    name: toStringValue(data.name),
    professionalId: toStringValue(data.professionalId) || null,
    status: (toStringValue(data.status) || "inactive") as CohortStatus,
    memberCount: typeof data.memberCount === "number" ? data.memberCount : 0,
    createdByUserId: toStringValue(data.createdByUserId),
    createdByRole: (toStringValue(data.createdByRole) || "company") as CohortCreatorRole,
    createdAt: data.createdAt as CohortRecord["createdAt"],
    updatedAt: data.updatedAt as CohortRecord["updatedAt"],
  };
}

function mapCohortMember(id: string, data: Record<string, unknown>): CohortMemberRecord {
  return {
    id,
    cohortId: toStringValue(data.cohortId),
    individualUserId: toStringValue(data.individualUserId),
    addedByUserId: toStringValue(data.addedByUserId),
    addedAt: data.addedAt as CohortMemberRecord["addedAt"],
  };
}

function mapUserToCohortMember(id: string, data: UserDocData): CohortMemberUser {
  const firstName = toStringValue(data.firstName);
  const lastName = toStringValue(data.lastName);
  const fullName =
    toStringValue(data.fullName || data.name) || `${firstName} ${lastName}`.trim();

  return {
    id,
    userId: toStringValue(data.userId || data.uid || id),
    firstName,
    lastName,
    fullName,
    email: normalizeEmail(toStringValue(data.email)),
    phoneE164: normalizePhone(toStringValue(data.phoneE164 || data.phone)),
  };
}

function computeStatus(memberCount: number, professionalId?: string | null): CohortStatus {
  if (memberCount >= 2 && professionalId) {
    return "active";
  }

  return "inactive";
}

async function listUsersByTenant(tenantId: string): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(query(collection(db, "users"), where("tenantId", "==", tenantId)));

  return snap.docs.map((row) => {
    const data = row.data() as Record<string, unknown>;

    const firstName = toStringValue(data.firstName);
    const lastName = toStringValue(data.lastName);
    const fullName =
      toStringValue(data.fullName || data.name) || `${firstName} ${lastName}`.trim();

    return {
      id: row.id,
      userId: toStringValue(data.userId || data.uid || row.id),
      tenantId: toStringValue(data.tenantId),
      userType:
        toStringValue(data.userType || data.profileType || data.role) === "professional"
          ? "professional"
          : "individual",
      status: toStringValue(data.status) === "inactive" ? "inactive" : "active",
      firstName,
      lastName,
      fullName,
      email: normalizeEmail(toStringValue(data.email)),
      phoneE164: normalizePhone(toStringValue(data.phoneE164 || data.phone)),
      associatedProfessionalId: toStringValue(data.associatedProfessionalId) || null,
      associatedCompanyId: toStringValue(data.associatedCompanyId) || undefined,
      companyName: toStringValue(data.companyName) || undefined,
      createdByUserId: toStringValue(data.createdByUserId) || undefined,
      createdByRole: toStringValue(data.createdByRole) || undefined,
      createdAt: data.createdAt as ManagedUserRecord["createdAt"],
      updatedAt: data.updatedAt as ManagedUserRecord["updatedAt"],
    } as ManagedUserRecord;
  });
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function resolveNewIndividuals(args: {
  tenantId: string;
  creatorUserId: string;
  creatorRole: CohortCreatorRole;
  companyId: string;
  professionalId?: string | null;
  pending: NewCohortIndividualInput[];
}): Promise<{ existingIds: string[]; toCreate: Array<{ id: string; payload: Record<string, unknown> }> }> {
  if (args.pending.length === 0) {
    return { existingIds: [], toCreate: [] };
  }

  const tenantUsers = await listUsersByTenant(args.tenantId);
  const existingIds: string[] = [];
  const toCreate: Array<{ id: string; payload: Record<string, unknown> }> = [];

  for (const entry of args.pending) {
    const email = normalizeEmail(entry.email);
    const phoneE164 = normalizePhone(entry.phoneE164);

    if (!email || !phoneE164) {
      continue;
    }

    const matched = tenantUsers.find(
      (user) =>
        user.userType === "individual" &&
        user.status === "active" &&
        (user.email === email || user.phoneE164 === phoneE164)
    );

    if (matched) {
      existingIds.push(matched.id);
      continue;
    }

    const userRef = doc(collection(db, "users"));
    const fullName = `${entry.firstName.trim()} ${entry.lastName.trim()}`.trim();

    toCreate.push({
      id: userRef.id,
      payload: {
        userId: userRef.id,
        uid: userRef.id,
        tenantId: args.tenantId,
        userType: "individual",
        profileType: "individual",
        status: "active",
        firstName: entry.firstName.trim(),
        lastName: entry.lastName.trim(),
        fullName,
        name: fullName,
        email,
        phoneE164,
        phone: phoneE164,
        assignmentEligible: true,
        mandatoryProfileCompleted: false,
        profileCompletionPercent: 50,
        associatedCompanyId: args.companyId,
        associatedProfessionalId: args.professionalId || null,
        createdByUserId: args.creatorUserId,
        createdByRole: args.creatorRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  return { existingIds: dedupeStrings(existingIds), toCreate };
}

export async function listIndividualsForCohortScope(args: {
  role: CohortCreatorRole;
  tenantId: string;
  companyId?: string;
  professionalId?: string;
}): Promise<ManagedUserRecord[]> {
  if (args.role === "company") {
    if (!args.companyId) {
      return [];
    }

    return listManagedUsersForCompany({
      tenantId: args.tenantId,
      companyId: args.companyId,
    }).then((rows) => rows.filter((row) => row.userType === "individual" && row.status === "active"));
  }

  if (!args.professionalId) {
    return [];
  }

  return listManagedUsersForProfessional({
    professionalId: args.professionalId,
  }).then((rows) => rows.filter((row) => row.userType === "individual" && row.status === "active"));
}

export async function searchIndividualsForCohort(args: {
  role: CohortCreatorRole;
  tenantId: string;
  companyId?: string;
  professionalId?: string;
  searchTerm: string;
}): Promise<ManagedUserRecord[]> {
  const normalized = args.searchTerm.trim().toLowerCase();
  const normalizedPhone = normalizePhone(normalized);

  if (!normalized) {
    return [];
  }

  const scopeUsers = await listIndividualsForCohortScope(args);

  const scopedMatches = scopeUsers.filter(
    (user) => user.email === normalized || normalizePhone(user.phoneE164) === normalizedPhone
  );

  if (scopedMatches.length > 0 || args.role !== "professional") {
    return scopedMatches;
  }

  // Fallback for professional search: include active tenant individuals in same company scope
  // so existing users remain discoverable even before explicit professional back-association.
  const tenantUsers = await listUsersByTenant(args.tenantId);
  const fallbackMatches = tenantUsers
    .filter((user) => user.userType === "individual" && user.status === "active")
    .filter((user) => !args.companyId || user.associatedCompanyId === args.companyId)
    .filter((user) => user.email === normalized || normalizePhone(user.phoneE164) === normalizedPhone);

  return fallbackMatches;
}

export async function listProfessionalsForCohortScope(args: {
  tenantId: string;
  companyId: string;
}): Promise<ManagedUserRecord[]> {
  return listProfessionalsForCoachDropdown(args);
}

export async function listCohortsForScope(args: {
  role: CohortCreatorRole;
  tenantId: string;
  actorUserId: string;
  status?: CohortStatus;
}): Promise<CohortListItem[]> {
  const snap = await getDocs(query(collection(db, "cohorts"), where("tenantId", "==", args.tenantId)));

  const rows = snap.docs.map((entry) => mapCohort(entry.id, entry.data() as Record<string, unknown>));

  const scoped = rows.filter((cohort) => {
    if (args.role === "company") {
      return cohort.companyId === args.actorUserId;
    }

    return cohort.professionalId === args.actorUserId;
  });

  const statusFiltered = args.status ? scoped.filter((cohort) => cohort.status === args.status) : scoped;

  const professionalIds = dedupeStrings(
    statusFiltered.map((cohort) => cohort.professionalId || "")
  );

  const professionalNames = new Map<string, string>();

  await Promise.all(
    professionalIds.map(async (professionalId) => {
      const userSnap = await getDoc(doc(db, "users", professionalId));
      if (!userSnap.exists()) {
        return;
      }

      const data = userSnap.data() as UserDocData;
      const fullName =
        toStringValue(data.fullName || data.name) ||
        `${toStringValue(data.firstName)} ${toStringValue(data.lastName)}`.trim();
      professionalNames.set(professionalId, fullName || "Professional");
    })
  );

  return statusFiltered
    .map((cohort) => ({
      ...cohort,
      professionalName: cohort.professionalId ? professionalNames.get(cohort.professionalId) : undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getCohortDetail(cohortId: string): Promise<CohortDetail | null> {
  const cohortSnap = await getDoc(doc(db, "cohorts", cohortId));
  if (!cohortSnap.exists()) {
    return null;
  }

  const cohort = mapCohort(cohortSnap.id, cohortSnap.data() as Record<string, unknown>);
  const memberSnap = await getDocs(query(collection(db, "cohortMembers"), where("cohortId", "==", cohortId)));
  const memberRows = memberSnap.docs.map((entry) => mapCohortMember(entry.id, entry.data() as Record<string, unknown>));

  const users = await Promise.all(
    memberRows.map(async (member) => {
      const userSnap = await getDoc(doc(db, "users", member.individualUserId));
      if (!userSnap.exists()) {
        return null;
      }

      return mapUserToCohortMember(userSnap.id, userSnap.data() as UserDocData);
    })
  );

  const members = users.filter(Boolean) as CohortMemberUser[];
  const professionalName = cohort.professionalId
    ? (() => {
        const match = users.find((entry) => entry?.userId === cohort.professionalId);
        return match?.fullName;
      })()
    : undefined;

  return {
    ...cohort,
    professionalName,
    members,
  };
}

export async function saveCohort(args: SaveCohortInput): Promise<CohortDetail> {
  const cohortName = args.name.trim();
  if (!cohortName) {
    throw new Error("Cohort name is required.");
  }

  const companyId = args.creatorRole === "company" ? args.creatorUserId : (args.creatorCompanyId ?? "");
  if (!companyId) {
    throw new Error("Unable to resolve company scope for cohort.");
  }

  const requestedProfessionalId =
    args.creatorRole === "professional"
      ? args.creatorUserId
      : (args.professionalId?.trim() || null);

  let resolvedProfessionalId: string | null = null;
  if (requestedProfessionalId) {
    const professional = await getUserById(requestedProfessionalId);
    if (!professional) {
      throw new Error("Selected Professional could not be resolved.");
    }

    if (professional.userType !== "professional") {
      throw new Error("Selected user is not a Professional.");
    }

    if (professional.status !== "active") {
      throw new Error("Selected Professional is inactive.");
    }

    if (professional.tenantId !== args.tenantId) {
      throw new Error("Selected Professional belongs to a different tenant.");
    }

    if (args.creatorRole === "company" && professional.associatedCompanyId !== companyId) {
      throw new Error("Selected Professional does not belong to your company scope.");
    }

    // Use canonical user document id for cohort association storage.
    resolvedProfessionalId = professional.id;
  }

  const normalizedExistingIds = dedupeStrings(args.existingIndividualIds);

  const pending = await resolveNewIndividuals({
    tenantId: args.tenantId,
    creatorUserId: args.creatorUserId,
    creatorRole: args.creatorRole,
    companyId,
    professionalId: resolvedProfessionalId,
    pending: args.newIndividuals,
  });

  const allMemberIds = dedupeStrings([
    ...normalizedExistingIds,
    ...pending.existingIds,
    ...pending.toCreate.map((entry) => entry.id),
  ]);

  if (allMemberIds.length < MIN_COHORT_MEMBER_COUNT) {
    throw new Error(`A cohort must include at least ${MIN_COHORT_MEMBER_COUNT} Individuals.`);
  }

  const status = computeStatus(allMemberIds.length, resolvedProfessionalId);

  const cohortRef = args.cohortId ? doc(db, "cohorts", args.cohortId) : doc(collection(db, "cohorts"));

  const batch = writeBatch(db);

  if (args.cohortId) {
    const existingMemberSnap = await getDocs(
      query(collection(db, "cohortMembers"), where("cohortId", "==", args.cohortId))
    );

    existingMemberSnap.docs.forEach((entry) => {
      batch.delete(entry.ref);
    });

    batch.update(cohortRef, {
      name: cohortName,
      professionalId: resolvedProfessionalId,
      status,
      memberCount: allMemberIds.length,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(cohortRef, {
      tenantId: args.tenantId,
      companyId,
      name: cohortName,
      professionalId: resolvedProfessionalId,
      status,
      memberCount: allMemberIds.length,
      createdByUserId: args.creatorUserId,
      createdByRole: args.creatorRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  pending.toCreate.forEach((entry) => {
    const userRef = doc(db, "users", entry.id);
    batch.set(userRef, entry.payload);

    const walletRef = doc(db, "wallets", buildWalletId(entry.id, args.tenantId));
    batch.set(walletRef, {
      userId: entry.id,
      tenantId: args.tenantId,
      userType: "individual",
      userName: `${toStringValue(entry.payload.firstName)} ${toStringValue(entry.payload.lastName)}`.trim(),
      totalIssuedCoins: 0,
      utilizedCoins: 0,
      availableCoins: 0,
      createdBy: args.creatorUserId,
      updatedBy: args.creatorUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  allMemberIds.forEach((memberId) => {
    const cohortMemberRef = doc(collection(db, "cohortMembers"));

    batch.set(cohortMemberRef, {
      cohortId: cohortRef.id,
      individualUserId: memberId,
      addedByUserId: args.creatorUserId,
      addedAt: serverTimestamp(),
    });

    if (resolvedProfessionalId) {
      const userRef = doc(db, "users", memberId);
      batch.set(userRef, {
        associatedProfessionalId: resolvedProfessionalId,
        associatedCompanyId: companyId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  });

  await batch.commit();

  const detail = await getCohortDetail(cohortRef.id);
  if (!detail) {
    throw new Error("Cohort saved but could not be loaded.");
  }

  return detail;
}

export async function getCohortAssignmentPayload(args: {
  tenantId: string;
  cohortId: string;
  role: CohortCreatorRole;
  actorUserId: string;
}): Promise<CohortAssignmentPayload> {
  const detail = await getCohortDetail(args.cohortId);

  if (!detail) {
    throw new Error("Cohort not found.");
  }

  if (detail.tenantId !== args.tenantId) {
    throw new Error("Cohort does not belong to this tenant.");
  }

  if (args.role === "company" && detail.companyId !== args.actorUserId) {
    throw new Error("You do not have access to this cohort.");
  }

  if (args.role === "professional" && detail.professionalId !== args.actorUserId) {
    throw new Error("You can assign only cohorts associated with you.");
  }

  if (detail.status !== "active") {
    throw new Error("Only active cohorts can be assigned activities.");
  }

  if (detail.members.length < MIN_COHORT_MEMBER_COUNT) {
    throw new Error(`A cohort must include at least ${MIN_COHORT_MEMBER_COUNT} Individuals.`);
  }

  return {
    cohortId: detail.id,
    cohortName: detail.name,
    members: detail.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      firstName: member.firstName,
      lastName: member.lastName,
      fullName: member.fullName,
      email: member.email,
      phoneE164: member.phoneE164,
    })),
  };
}
