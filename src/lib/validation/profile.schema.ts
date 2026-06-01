import { z } from "zod";
import { formatExperienceValue } from "@/lib/profile/experience";
import {
  DEFAULT_PROFILE_FORM_VALUES,
  type UserProfileFormValues,
  type UserProfileRecord,
} from "@/types/profile";

export type ProfileFormErrors = Partial<Record<keyof UserProfileFormValues | "form", string>>;

const upToTwoDecimalPlacesPattern = /^\d+(?:\.\d{1,2})?$/;

const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^https?:\/\//i.test(value),
    "Enter a valid URL starting with http:// or https://",
  );

const baseProfileSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required.")
    .email("Enter a valid email address."),
  city: z.string().trim().min(1, "City is required."),
  linkedinUrl: optionalUrlSchema,
  youtubeChannel: optionalUrlSchema,
  websiteUrl: optionalUrlSchema,
  profilePhotoUrl: optionalUrlSchema,
});

export function createProfileFormValues(profile?: UserProfileRecord | null): UserProfileFormValues {
  if (!profile) {
    return { ...DEFAULT_PROFILE_FORM_VALUES };
  }

  const combinedCertifications = Array.from(new Set([
    ...profile.certifications,
    ...profile.coachCredentials,
  ]));

  return {
    fullName: profile.fullName,
    userType: profile.userType,
    email: profile.email,
    phoneE164: profile.phoneE164,
    profilePhotoUrl: profile.profilePhotoUrl ?? "",
    companyName: profile.companyName,
    companyPosition: profile.companyPosition,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    city: profile.city,
    state: profile.state,
    country: profile.country,
    postalCode: profile.postalCode,
    highestDegreeHeld: profile.highestDegreeHeld,
    fieldOfStudy: profile.fieldOfStudy,
    yearsOfExperience: formatExperienceValue(profile.yearsOfExperience),
    currentRole: profile.currentRole,
    bio: profile.bio,
    linkedinUrl: profile.linkedinUrl,
    instagramHandle: profile.instagramHandle,
    youtubeChannel: profile.youtubeChannel,
    websiteUrl: profile.websiteUrl,
    professionalHeadline: profile.professionalHeadline,
    expertiseAreas: (profile.expertiseAreas.length > 0 ? profile.expertiseAreas : profile.coachExpertiseAreas).join(", "),
    certifications: combinedCertifications.join(", "),
    coachingExperienceYears: formatExperienceValue(profile.coachingExperienceYears),
    trainingExperienceYears: formatExperienceValue(profile.trainingExperienceYears),
    industryFocus: profile.industryFocus,
    languagesSpoken: profile.languagesSpoken.join(", "),
    coachExperienceSummary: profile.coachExperienceSummary,
    coachPrimaryIndustry: profile.coachPrimaryIndustry,
    coachIndustryExperience: formatExperienceValue(profile.coachIndustryExperience),
    coachExpertiseAreas: profile.coachExpertiseAreas.join(", "),
    coachCoachingAreas: profile.coachCoachingAreas.join(", "),
    coachMethods: profile.coachMethods.join(", "),
    coachTargetAudience: profile.coachTargetAudience.join(", "),
    coachSessionFormats: profile.coachSessionFormats.join(", "),
    coachServicesOther: profile.coachServicesOther,
    coachCredentials: profile.coachCredentials.join(", "),
    coachOutcomeFocus: profile.coachOutcomeFocus,
    coachAvailability: profile.coachAvailability,
    individualPortalPurpose: profile.individualPortalPurpose,
    individualExperienceLevel: profile.individualExperienceLevel,
    individualExpertiseLevel: profile.individualExpertiseLevel,
    individualDevelopmentAreas: profile.individualDevelopmentAreas.join(", "),
    individualLearningPreferences: profile.individualLearningPreferences.join(", "),
    individualTargetAudience: profile.individualTargetAudience.join(", "),
    individualGoals: profile.individualGoals,
    individualTimeCommitment: profile.individualTimeCommitment,
    individualPreferredSessionFormat: profile.individualPreferredSessionFormat,
    individualTargetOutcomes: profile.individualTargetOutcomes.join(", "),
    individualCurrentChallenges: profile.individualCurrentChallenges,
    companyLegalName: profile.companyLegalName,
    companyDisplayName: profile.companyDisplayName,
    companyType: profile.companyType,
    companyDescription: profile.companyDescription,
    industry: profile.industry,
    employeeCountRange: profile.employeeCountRange,
    primaryContactName: profile.primaryContactName,
  };
}

export function validateProfileForm(values: UserProfileFormValues): ProfileFormErrors {
  const errors: ProfileFormErrors = {};

  const parsed = baseProfileSchema.safeParse({
    email: values.email,
    city: values.city,
    linkedinUrl: values.linkedinUrl,
    youtubeChannel: values.youtubeChannel,
    websiteUrl: values.websiteUrl,
    profilePhotoUrl: values.profilePhotoUrl,
  });

  if (!parsed.success) {
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as keyof UserProfileFormValues | undefined;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    });
  }

  if (values.userType === "company" && !values.companyName.trim()) {
    errors.companyName = "Company name is required for company profiles.";
  }

  const decimalExperienceFields: Array<keyof Pick<
    UserProfileFormValues,
    "yearsOfExperience" | "coachingExperienceYears" | "trainingExperienceYears" | "coachIndustryExperience"
  >> = [
    "yearsOfExperience",
    "coachingExperienceYears",
    "trainingExperienceYears",
    "coachIndustryExperience",
  ];

  decimalExperienceFields.forEach((field) => {
    const value = values[field].trim();
    if (value && !upToTwoDecimalPlacesPattern.test(value)) {
      errors[field] = "Enter a valid number with up to 2 decimal places.";
    }
  });

  return errors;
}