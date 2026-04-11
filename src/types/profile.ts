import type { Timestamp } from "firebase/firestore";

export const PROFILE_USER_TYPES = ["company", "professional", "individual"] as const;

export type ProfileUserType = (typeof PROFILE_USER_TYPES)[number];
export type ProfileStatus = "active" | "inactive";

export type UserProfileRecord = {
  id: string;
  userId: string;
  tenantId: string;
  profileType: ProfileUserType;
  userType: ProfileUserType;
  fullName: string;
  name: string;
  email: string;
  phone: string;
  phoneE164: string;
  companyName: string;
  companyPosition: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  profilePhotoUrl: string | null;
  highestDegreeHeld: string;
  fieldOfStudy: string;
  yearsOfExperience: string;
  currentRole: string;
  bio: string;
  skills: string[];
  linkedinUrl: string;
  websiteUrl: string;
  professionalHeadline: string;
  expertiseAreas: string[];
  certifications: string[];
  coachingExperienceYears: string;
  trainingExperienceYears: string;
  industryFocus: string;
  languagesSpoken: string[];
  publicProfileReady: boolean;
  companyLegalName: string;
  companyDisplayName: string;
  companyType: string;
  companyLogoUrl: string | null;
  companyDescription: string;
  industry: string;
  employeeCountRange: string;
  primaryContactName: string;
  mandatoryProfileCompleted: boolean;
  profileCompletionPercent: number;
  assignmentEligible: boolean;
  status: ProfileStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type UserProfileSaveInput = {
  profileId?: string;
  userId: string;
  tenantId: string;
  userType: ProfileUserType;
  fullName: string;
  email: string;
  phoneE164: string;
  companyName?: string;
  companyPosition?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  profilePhotoUrl?: string | null;
  highestDegreeHeld?: string;
  fieldOfStudy?: string;
  yearsOfExperience?: string;
  currentRole?: string;
  bio?: string;
  skills?: string[];
  linkedinUrl?: string;
  websiteUrl?: string;
  professionalHeadline?: string;
  expertiseAreas?: string[];
  certifications?: string[];
  coachingExperienceYears?: string;
  trainingExperienceYears?: string;
  industryFocus?: string;
  languagesSpoken?: string[];
  publicProfileReady?: boolean;
  companyLegalName?: string;
  companyDisplayName?: string;
  companyType?: string;
  companyLogoUrl?: string | null;
  companyDescription?: string;
  industry?: string;
  employeeCountRange?: string;
  primaryContactName?: string;
  status?: ProfileStatus;
};

export type UserProfileFormValues = {
  fullName: string;
  userType: ProfileUserType;
  email: string;
  phoneE164: string;
  profilePhotoUrl: string;
  companyName: string;
  companyPosition: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  highestDegreeHeld: string;
  fieldOfStudy: string;
  yearsOfExperience: string;
  currentRole: string;
  bio: string;
  linkedinUrl: string;
  websiteUrl: string;
  professionalHeadline: string;
  expertiseAreas: string;
  certifications: string;
  coachingExperienceYears: string;
  trainingExperienceYears: string;
  industryFocus: string;
  languagesSpoken: string;
  companyLegalName: string;
  companyDisplayName: string;
  companyType: string;
  companyDescription: string;
  industry: string;
  employeeCountRange: string;
  primaryContactName: string;
};

export const DEFAULT_PROFILE_FORM_VALUES: UserProfileFormValues = {
  fullName: "",
  userType: "individual",
  email: "",
  phoneE164: "",
  profilePhotoUrl: "",
  companyName: "",
  companyPosition: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  highestDegreeHeld: "",
  fieldOfStudy: "",
  yearsOfExperience: "",
  currentRole: "",
  bio: "",
  linkedinUrl: "",
  websiteUrl: "",
  professionalHeadline: "",
  expertiseAreas: "",
  certifications: "",
  coachingExperienceYears: "",
  trainingExperienceYears: "",
  industryFocus: "",
  languagesSpoken: "",
  companyLegalName: "",
  companyDisplayName: "",
  companyType: "",
  companyDescription: "",
  industry: "",
  employeeCountRange: "",
  primaryContactName: "",
};