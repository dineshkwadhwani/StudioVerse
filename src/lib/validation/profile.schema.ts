import { z } from "zod";
import {
  DEFAULT_PROFILE_FORM_VALUES,
  type UserProfileFormValues,
  type UserProfileRecord,
} from "@/types/profile";

export type ProfileFormErrors = Partial<Record<keyof UserProfileFormValues | "form", string>>;

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
  websiteUrl: optionalUrlSchema,
  profilePhotoUrl: optionalUrlSchema,
});

export function createProfileFormValues(profile?: UserProfileRecord | null): UserProfileFormValues {
  if (!profile) {
    return { ...DEFAULT_PROFILE_FORM_VALUES };
  }

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
    yearsOfExperience: profile.yearsOfExperience,
    currentRole: profile.currentRole,
    bio: profile.bio,
    linkedinUrl: profile.linkedinUrl,
    websiteUrl: profile.websiteUrl,
    professionalHeadline: profile.professionalHeadline,
    expertiseAreas: profile.expertiseAreas.join(", "),
    certifications: profile.certifications.join(", "),
    coachingExperienceYears: profile.coachingExperienceYears,
    trainingExperienceYears: profile.trainingExperienceYears,
    industryFocus: profile.industryFocus,
    languagesSpoken: profile.languagesSpoken.join(", "),
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

  return errors;
}