import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db } from "@/services/firebase";
import { storage } from "@/services/firebase";
import { issueRegistrationBonusForUser } from "@/services/wallet.service";
import type {
  ProfileUserType,
  UserProfileRecord,
  UserProfileSaveInput,
} from "@/types/profile";

type ProfileDocData = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function toNullableString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function isProfileUserType(value: unknown): value is ProfileUserType {
  return value === "company" || value === "professional" || value === "individual";
}

function resolveUserType(data: ProfileDocData): ProfileUserType {
  if (isProfileUserType(data.userType)) {
    return data.userType;
  }

  if (isProfileUserType(data.profileType)) {
    return data.profileType;
  }

  if (isProfileUserType(data.role)) {
    return data.role;
  }

  return "individual";
}

function isCompletedValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return normalizeString(value).length > 0;
}

function getMandatoryFieldValues(profile: UserProfileRecord): unknown[] {
  if (profile.userType === "company") {
    return [
      profile.fullName,
      profile.userType,
      profile.companyName,
      profile.city,
      profile.phoneE164,
      profile.email,
    ];
  }

  return [profile.fullName, profile.userType, profile.city, profile.phoneE164, profile.email];
}

function getTrackedFieldValues(profile: UserProfileRecord): unknown[] {
  if (profile.userType === "company") {
    return [
      profile.fullName,
      profile.userType,
      profile.companyName,
      profile.city,
      profile.phoneE164,
      profile.email,
      profile.addressLine1,
      profile.state,
      profile.country,
      profile.postalCode,
      profile.companyDescription,
      profile.industry,
      profile.employeeCountRange,
      profile.primaryContactName,
      profile.websiteUrl,
    ];
  }

  if (profile.userType === "professional") {
    return [
      profile.fullName,
      profile.userType,
      profile.city,
      profile.phoneE164,
      profile.email,
      profile.companyName,
      profile.addressLine1,
      profile.highestDegreeHeld,
      profile.fieldOfStudy,
      profile.yearsOfExperience,
      profile.currentRole,
      profile.bio,
      profile.linkedinUrl,
      profile.professionalHeadline,
      profile.expertiseAreas,
      profile.certifications,
      profile.coachingExperienceYears,
      profile.trainingExperienceYears,
      profile.industryFocus,
      profile.languagesSpoken,
    ];
  }

  return [
    profile.fullName,
    profile.userType,
    profile.city,
    profile.phoneE164,
    profile.email,
    profile.companyName,
    profile.addressLine1,
    profile.highestDegreeHeld,
    profile.fieldOfStudy,
    profile.yearsOfExperience,
    profile.currentRole,
    profile.bio,
    profile.skills,
    profile.linkedinUrl,
  ];
}

function applyComputedFields(profile: UserProfileRecord): UserProfileRecord {
  const mandatoryFieldValues = getMandatoryFieldValues(profile);
  const trackedFieldValues = getTrackedFieldValues(profile);
  const completedTrackedFields = trackedFieldValues.filter((value) => isCompletedValue(value)).length;
  const completionPercent = trackedFieldValues.length === 0
    ? 0
    : Math.round((completedTrackedFields / trackedFieldValues.length) * 100);
  const mandatoryProfileCompleted = mandatoryFieldValues.every((value) => isCompletedValue(value));

  return {
    ...profile,
    mandatoryProfileCompleted,
    profileCompletionPercent: completionPercent,
    assignmentEligible: mandatoryProfileCompleted,
  };
}

function mapUserProfile(id: string, data: ProfileDocData): UserProfileRecord {
  const userType = resolveUserType(data);
  const fullName = normalizeString(data.fullName ?? data.name);
  const companyName = normalizeString(
    data.companyName ?? data.companyDisplayName ?? data.companyLegalName,
  );
  const phoneE164 = normalizeString(data.phoneE164 ?? data.phone);

  return applyComputedFields({
    id,
    userId: normalizeString(data.userId ?? data.uid ?? id),
    tenantId: normalizeString(data.tenantId),
    profileType: userType,
    userType,
    fullName,
    name: fullName,
    email: normalizeString(data.email),
    phone: phoneE164,
    phoneE164,
    companyName,
    companyPosition: normalizeString(data.companyPosition ?? data.position),
    addressLine1: normalizeString(data.addressLine1 ?? data.address),
    addressLine2: normalizeString(data.addressLine2),
    city: normalizeString(data.city),
    state: normalizeString(data.state),
    country: normalizeString(data.country),
    postalCode: normalizeString(data.postalCode),
    profilePhotoUrl: toNullableString(data.profilePhotoUrl),
    highestDegreeHeld: normalizeString(data.highestDegreeHeld),
    fieldOfStudy: normalizeString(data.fieldOfStudy),
    yearsOfExperience: normalizeString(data.yearsOfExperience),
    currentRole: normalizeString(data.currentRole),
    bio: normalizeString(data.bio),
    skills: normalizeStringArray(data.skills),
    linkedinUrl: normalizeString(data.linkedinUrl),
    websiteUrl: normalizeString(data.websiteUrl),
    professionalHeadline: normalizeString(data.professionalHeadline),
    expertiseAreas: normalizeStringArray(data.expertiseAreas),
    certifications: normalizeStringArray(data.certifications),
    coachingExperienceYears: normalizeString(data.coachingExperienceYears),
    trainingExperienceYears: normalizeString(data.trainingExperienceYears),
    industryFocus: normalizeString(data.industryFocus),
    languagesSpoken: normalizeStringArray(data.languagesSpoken),
    publicProfileReady: Boolean(data.publicProfileReady),
    companyLegalName: normalizeString(data.companyLegalName),
    companyDisplayName: normalizeString(data.companyDisplayName ?? companyName),
    companyType: normalizeString(data.companyType ?? userType),
    companyLogoUrl: toNullableString(data.companyLogoUrl),
    companyDescription: normalizeString(data.companyDescription),
    industry: normalizeString(data.industry),
    employeeCountRange: normalizeString(data.employeeCountRange),
    primaryContactName: normalizeString(data.primaryContactName),
    mandatoryProfileCompleted: Boolean(data.mandatoryProfileCompleted),
    profileCompletionPercent:
      typeof data.profileCompletionPercent === "number" ? data.profileCompletionPercent : 0,
    assignmentEligible: Boolean(data.assignmentEligible),
    status: data.status === "inactive" ? "inactive" : "active",
    createdAt: data.createdAt as UserProfileRecord["createdAt"],
    updatedAt: data.updatedAt as UserProfileRecord["updatedAt"],
  });
}

async function resolveProfileSnapshot(args: {
  userId: string;
  tenantId?: string;
  phoneE164?: string;
  profileId?: string;
}): Promise<QueryDocumentSnapshot | null> {
  if (args.profileId) {
    const directSnap = await getDoc(doc(db, "users", args.profileId));
    if (directSnap.exists()) {
      return directSnap;
    }
  }

  const userDoc = await getDoc(doc(db, "users", args.userId));
  if (userDoc.exists()) {
    return userDoc;
  }

  const uidQuery = query(collection(db, "users"), where("uid", "==", args.userId), limit(1));
  const uidSnap = await getDocs(uidQuery);
  if (!uidSnap.empty) {
    return uidSnap.docs[0];
  }

  if (args.phoneE164 && args.tenantId) {
    const phoneQuery = query(
      collection(db, "users"),
      where("phoneE164", "==", args.phoneE164),
      where("tenantId", "==", args.tenantId),
      limit(1),
    );
    const phoneSnap = await getDocs(phoneQuery);
    if (!phoneSnap.empty) {
      return phoneSnap.docs[0];
    }
  }

  return null;
}

function toProfileDocData(input: UserProfileSaveInput, current?: UserProfileRecord): ProfileDocData {
  const fullName = normalizeString(input.fullName || current?.fullName);
  const userType = input.userType ?? current?.userType ?? "individual";
  const companyName = normalizeString(input.companyName ?? current?.companyName);
  const profile = applyComputedFields({
    id: input.profileId ?? current?.id ?? input.userId,
    userId: input.userId,
    tenantId: normalizeString(input.tenantId || current?.tenantId),
    profileType: userType,
    userType,
    fullName,
    name: fullName,
    email: normalizeString(input.email || current?.email),
    phone: normalizeString(input.phoneE164 || current?.phoneE164),
    phoneE164: normalizeString(input.phoneE164 || current?.phoneE164),
    companyName,
    companyPosition: normalizeString(input.companyPosition ?? current?.companyPosition),
    addressLine1: normalizeString(input.addressLine1 ?? current?.addressLine1),
    addressLine2: normalizeString(input.addressLine2 ?? current?.addressLine2),
    city: normalizeString(input.city ?? current?.city),
    state: normalizeString(input.state ?? current?.state),
    country: normalizeString(input.country ?? current?.country),
    postalCode: normalizeString(input.postalCode ?? current?.postalCode),
    profilePhotoUrl: input.profilePhotoUrl ?? current?.profilePhotoUrl ?? null,
    highestDegreeHeld: normalizeString(input.highestDegreeHeld ?? current?.highestDegreeHeld),
    fieldOfStudy: normalizeString(input.fieldOfStudy ?? current?.fieldOfStudy),
    yearsOfExperience: normalizeString(input.yearsOfExperience ?? current?.yearsOfExperience),
    currentRole: normalizeString(input.currentRole ?? current?.currentRole),
    bio: normalizeString(input.bio ?? current?.bio),
    skills: input.skills ?? current?.skills ?? [],
    linkedinUrl: normalizeString(input.linkedinUrl ?? current?.linkedinUrl),
    websiteUrl: normalizeString(input.websiteUrl ?? current?.websiteUrl),
    professionalHeadline: normalizeString(input.professionalHeadline ?? current?.professionalHeadline),
    expertiseAreas: input.expertiseAreas ?? current?.expertiseAreas ?? [],
    certifications: input.certifications ?? current?.certifications ?? [],
    coachingExperienceYears: normalizeString(
      input.coachingExperienceYears ?? current?.coachingExperienceYears,
    ),
    trainingExperienceYears: normalizeString(
      input.trainingExperienceYears ?? current?.trainingExperienceYears,
    ),
    industryFocus: normalizeString(input.industryFocus ?? current?.industryFocus),
    languagesSpoken: input.languagesSpoken ?? current?.languagesSpoken ?? [],
    publicProfileReady: input.publicProfileReady ?? current?.publicProfileReady ?? false,
    companyLegalName: normalizeString(input.companyLegalName ?? current?.companyLegalName),
    companyDisplayName: normalizeString(
      input.companyDisplayName ?? current?.companyDisplayName ?? companyName,
    ),
    companyType: normalizeString(input.companyType ?? current?.companyType ?? userType),
    companyLogoUrl: input.companyLogoUrl ?? current?.companyLogoUrl ?? null,
    companyDescription: normalizeString(input.companyDescription ?? current?.companyDescription),
    industry: normalizeString(input.industry ?? current?.industry),
    employeeCountRange: normalizeString(input.employeeCountRange ?? current?.employeeCountRange),
    primaryContactName: normalizeString(input.primaryContactName ?? current?.primaryContactName),
    mandatoryProfileCompleted: false,
    profileCompletionPercent: 0,
    assignmentEligible: false,
    status: input.status ?? current?.status ?? "active",
    createdAt: current?.createdAt,
    updatedAt: current?.updatedAt,
  });

  return {
    uid: profile.userId,
    userId: profile.userId,
    tenantId: profile.tenantId,
    profileType: profile.profileType,
    userType: profile.userType,
    role: profile.userType,
    fullName: profile.fullName,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    phoneE164: profile.phoneE164,
    companyName: profile.companyName,
    companyPosition: profile.companyPosition,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    address: profile.addressLine1,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    postalCode: profile.postalCode,
    profilePhotoUrl: profile.profilePhotoUrl,
    highestDegreeHeld: profile.highestDegreeHeld,
    fieldOfStudy: profile.fieldOfStudy,
    yearsOfExperience: profile.yearsOfExperience,
    currentRole: profile.currentRole,
    bio: profile.bio,
    skills: profile.skills,
    linkedinUrl: profile.linkedinUrl,
    websiteUrl: profile.websiteUrl,
    professionalHeadline: profile.professionalHeadline,
    expertiseAreas: profile.expertiseAreas,
    certifications: profile.certifications,
    coachingExperienceYears: profile.coachingExperienceYears,
    trainingExperienceYears: profile.trainingExperienceYears,
    industryFocus: profile.industryFocus,
    languagesSpoken: profile.languagesSpoken,
    publicProfileReady: profile.publicProfileReady,
    companyLegalName: profile.companyLegalName,
    companyDisplayName: profile.companyDisplayName,
    companyType: profile.companyType,
    companyLogoUrl: profile.companyLogoUrl,
    companyDescription: profile.companyDescription,
    industry: profile.industry,
    employeeCountRange: profile.employeeCountRange,
    primaryContactName: profile.primaryContactName,
    mandatoryProfileCompleted: profile.mandatoryProfileCompleted,
    profileCompletionPercent: profile.profileCompletionPercent,
    assignmentEligible: profile.assignmentEligible,
    status: profile.status,
  };
}

export function splitProfileList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function uploadProfilePhoto(args: {
  tenantId: string;
  userId: string;
  file: File;
}): Promise<string> {
  const extension = args.file.name.split(".").pop()?.trim().toLowerCase() || "jpg";
  const photoRef = ref(storage, `profiles/${args.tenantId}/${args.userId}/profile.${extension}`);
  await uploadBytes(photoRef, args.file, { contentType: args.file.type || "image/jpeg" });
  return getDownloadURL(photoRef);
}

export async function getUserProfile(args: {
  userId: string;
  tenantId?: string;
  phoneE164?: string;
  profileId?: string;
}): Promise<UserProfileRecord | null> {
  const snapshot = await resolveProfileSnapshot(args);
  if (!snapshot) {
    return null;
  }

  return mapUserProfile(snapshot.id, snapshot.data() as ProfileDocData);
}

export async function getUserProfileByPhone(args: {
  phoneE164: string;
  tenantId: string;
}): Promise<UserProfileRecord | null> {
  const phoneQuery = query(
    collection(db, "users"),
    where("phoneE164", "==", args.phoneE164),
    where("tenantId", "==", args.tenantId),
    limit(1),
  );
  const snapshot = await getDocs(phoneQuery);

  if (snapshot.empty) {
    return null;
  }

  return mapUserProfile(snapshot.docs[0].id, snapshot.docs[0].data() as ProfileDocData);
}

export async function saveUserProfile(input: UserProfileSaveInput): Promise<UserProfileRecord> {
  const existingSnapshot = await resolveProfileSnapshot({
    userId: input.userId,
    tenantId: input.tenantId,
    phoneE164: input.phoneE164,
    profileId: input.profileId,
  });
  const current = existingSnapshot
    ? mapUserProfile(existingSnapshot.id, existingSnapshot.data() as ProfileDocData)
    : undefined;
  const resolvedUserType = input.userType ?? current?.userType ?? "individual";
  const resolvedEmail = normalizeString(input.email ?? current?.email).toLowerCase();

  if (resolvedUserType === "company") {
    if (!resolvedEmail) {
      throw new Error("Email address is required for company registration.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail)) {
      throw new Error("Please enter a valid email address.");
    }
  }

  const targetRef: DocumentReference = existingSnapshot
    ? doc(db, "users", existingSnapshot.id)
    : doc(db, "users", input.userId);
  const payload = toProfileDocData(input, current);

  await setDoc(
    targetRef,
    {
      ...payload,
      createdAt: current?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(targetRef);
  const savedProfile = mapUserProfile(savedSnapshot.id, savedSnapshot.data() as ProfileDocData);

  // Auto-create the wallet for brand-new registrations with the tenant's configured signup bonus.
  // Only runs when current is undefined (first save, not a profile update).
  // Superadmin role is excluded — superadmins do not hold coaching wallets.
  const walletEligibleTypes = ["company", "professional", "individual"] as const;
  if (!current && walletEligibleTypes.includes(savedProfile.userType)) {
    try {
      await issueRegistrationBonusForUser({
        userId: savedProfile.userId,
        tenantId: savedProfile.tenantId,
      });
    } catch {
      // Wallet already exists or creation failed — non-fatal, profile save still succeeds.
    }
  }

  return savedProfile;
}