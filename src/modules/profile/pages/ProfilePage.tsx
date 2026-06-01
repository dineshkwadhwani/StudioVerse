"use client";

import { ChangeEvent, FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatExperienceValue } from "@/lib/profile/experience";
import { validateProfileForm, createProfileFormValues, type ProfileFormErrors } from "@/lib/validation/profile.schema";
import { PROFILE_COMPLETION_REWARD_COINS } from "@/constants/wallet";
import {
  getUserProfile,
  saveUserProfile,
  splitProfileList,
  uploadProfilePhoto,
} from "@/services/profile.service";

import type { UserProfileFormValues, UserProfileRecord } from "@/types/profile";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import {
  AVAILABILITY_OPTIONS,
  COACH_PURPOSE_OPTIONS,
  COACH_OUTCOME_FOCUS_GROUPS,
  COACHING_METHOD_OPTIONS,
  COMPANY_PURPOSE_OPTIONS,
  COMPETENCY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  EXPERTISE_LEVEL_OPTIONS,
  FIELD_OF_STUDY_OPTIONS,
  HIGHEST_DEGREE_OPTIONS,
  INDIVIDUAL_CHALLENGES_OPTIONS,
  INDIVIDUAL_IDENTITY_OPTIONS,
  INDIVIDUAL_PURPOSE_OPTIONS,
  INDUSTRY_OPTIONS,
  LANGUAGE_OPTIONS,
  PURPOSE_OPTIONS,
  SERVICE_PROVIDED_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "@/modules/profile/profileOptions";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./ProfilePage.module.css";

type UserRole = StudioUserRole;

function getProfileRoleLabel(role: UserProfileRecord["userType"]): string {
  if (role === "company") return "Coaching Company";
  if (role === "professional") return "Coach";
  return "Learner";
}

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function parseMultiSelectValue(value: string): string[] {
  return splitProfileList(value);
}

function joinMultiSelectValue(values: string[]): string {
  return values.join(", ");
}

const DECIMAL_EXPERIENCE_PATTERN = /^(?:\d+(?:\.\d{0,2})?|\.\d{0,2})$/;

type ProfilePageProps = {
  tenantConfig: TenantConfig;
};

type CollapsibleSectionProps = {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
};

function CollapsibleSection({ title, description, badge, children }: CollapsibleSectionProps) {
  return (
    <details className={`${styles.card} ${styles.accordionCard}`} open>
      <summary className={styles.accordionSummary}>
        <div className={styles.cardHeader}>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {badge ? <span className={styles.cardBadgeMuted}>{badge}</span> : null}
        </div>
      </summary>
      <div className={styles.accordionBody}>{children}</div>
    </details>
  );
}

export default function ProfilePage({ tenantConfig }: ProfilePageProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [formValues, setFormValues] = useState<UserProfileFormValues>(createProfileFormValues());
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pageError, setPageError] = useState("");
  const [info, setInfo] = useState("");
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? "Assessment Centre";
  const brandSubtitle = "StudioVerse Platform";

  useEffect(() => {
    async function loadProfile() {
      const userId = sessionStorage.getItem("cs_uid");
      const profileId = sessionStorage.getItem("cs_profile_id") ?? undefined;
      const phoneE164 = sessionStorage.getItem("cs_phone") ?? undefined;
      const storedRole = sessionStorage.getItem("cs_role");
      const storedName = sessionStorage.getItem("cs_name");

      if (isUserRole(storedRole)) {
        setRole(storedRole);
      }
      setName(storedName ?? "User");

      if (!userId) {
        router.replace(`${basePath}/auth`);
        return;
      }

      try {
        const resolvedProfile = await getUserProfile({
          userId,
          tenantId,
          phoneE164,
          profileId,
        });

        if (!resolvedProfile) {
          router.replace(`${basePath}/auth`);
          return;
        }

        setProfile(resolvedProfile);
        setFormValues(createProfileFormValues(resolvedProfile));
      } catch (error) {
        setPageError(error instanceof Error ? error.message : "Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [basePath, router, tenantId]);

  const roleLabel = useMemo(() => (profile ? getProfileRoleLabel(profile.userType) : "Profile"), [profile]);
  const isEmailLocked = useMemo(() => Boolean(profile?.email.trim()), [profile?.email]);

  function scrollToFeedbackBanner() {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // The order here must match the order fields appear in the form DOM.
  const ERROR_FIELD_ORDER: (keyof typeof errors)[] = [
    "email",
    "city",
    "companyName",
    "yearsOfExperience",
    "coachingExperienceYears",
    "trainingExperienceYears",
    "coachIndustryExperience",
    "linkedinUrl",
    "youtubeChannel",
    "websiteUrl",
    "profilePhotoUrl",
  ];

  function scrollToFirstError(nextErrors: ProfileFormErrors) {
    if (typeof window === "undefined") return;

    const firstKey = ERROR_FIELD_ORDER.find((key) => Boolean(nextErrors[key]));
    if (!firstKey) return;

    window.requestAnimationFrame(() => {
      const el = document.getElementById(`profile-field-${firstKey}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    });
  }

  function updateField<Key extends keyof UserProfileFormValues>(field: Key, value: UserProfileFormValues[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setPageError("");
    setInfo("");
  }

  function updateDecimalExperienceField(field: keyof UserProfileFormValues, value: string) {
    if (value && !DECIMAL_EXPERIENCE_PATTERN.test(value)) {
      return;
    }

    updateField(field, value);
  }

  function formatDecimalExperienceField(field: keyof UserProfileFormValues) {
    updateField(
      field,
      formatExperienceValue(String(formValues[field] ?? "")) as UserProfileFormValues[typeof field],
    );
  }

  const URL_FIELDS: (keyof UserProfileFormValues)[] = ["linkedinUrl", "youtubeChannel", "websiteUrl", "profilePhotoUrl"];

  function updateUrlField(field: keyof UserProfileFormValues, value: string) {
    const trimmed = value.trim();
    const isValidUrl = !trimmed || /^https?:\/\//i.test(trimmed);
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: trimmed && !isValidUrl ? "Enter a valid URL starting with http:// or https://" : undefined,
      form: undefined,
    }));
    setPageError("");
    setInfo("");
  }

  function toggleMultiSelectField(field: keyof UserProfileFormValues, option: string) {
    const currentValues = parseMultiSelectValue(String(formValues[field] ?? ""));
    const nextValues = currentValues.includes(option)
      ? currentValues.filter((item) => item !== option)
      : [...currentValues, option];
    updateField(field, joinMultiSelectValue(nextValues) as UserProfileFormValues[keyof UserProfileFormValues]);
  }

  function isMultiSelectChecked(field: keyof UserProfileFormValues, option: string): boolean {
    return parseMultiSelectValue(String(formValues[field] ?? "")).includes(option);
  }

  function renderMultiSelect(
    field: keyof UserProfileFormValues,
    options: readonly string[],
    helperText: string,
  ) {
    return (
      <div className={styles.multiSelectField}>
        <small className={styles.multiSelectHelper}>{helperText}</small>
        <div className={styles.chipGroup}>
          {options.map((option) => {
            const checked = isMultiSelectChecked(field, option);
            return (
              <label key={option} className={checked ? styles.chipActive : styles.chip}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMultiSelectField(field, option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  function renderGroupedMultiSelect(
    field: keyof UserProfileFormValues,
    groups: readonly { title: string; options: readonly string[] }[],
    helperText: string,
  ) {
    return (
      <div className={styles.multiSelectField}>
        <small className={styles.multiSelectHelper}>{helperText}</small>
        {groups.map((group) => (
          <div key={group.title} className={styles.multiSelectGroup}>
            <p className={styles.multiSelectGroupTitle}>{group.title}</p>
            <div className={styles.chipGroup}>
              {group.options.map((option) => {
                const checked = isMultiSelectChecked(field, option);
                return (
                  <label key={option} className={checked ? styles.chipActive : styles.chip}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMultiSelectField(field, option)}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  async function persistProfile(overrides?: Partial<UserProfileFormValues>) {
    if (!profile) {
      throw new Error("Profile is not loaded.");
    }

    const nextValues = { ...formValues, ...overrides };
    const normalizedEmail = nextValues.email.trim().toLowerCase();
    const selectedServices = splitProfileList(nextValues.coachSessionFormats);
    const coachServicesOther = selectedServices.includes("Other")
      ? nextValues.coachServicesOther
      : "";

    const savedProfile = await saveUserProfile({
      profileId: profile.id,
      userId: profile.userId,
      tenantId: profile.tenantId,
      userType: profile.userType,
      fullName: profile.fullName,
      email: normalizedEmail,
      phoneE164: profile.phoneE164,
      profilePhotoUrl: nextValues.profilePhotoUrl || null,
      companyName: nextValues.companyName,
      companyPosition: nextValues.companyPosition,
      addressLine1: nextValues.addressLine1,
      addressLine2: nextValues.addressLine2,
      city: nextValues.city,
      state: nextValues.state,
      country: nextValues.country,
      postalCode: nextValues.postalCode,
      highestDegreeHeld: nextValues.highestDegreeHeld,
      fieldOfStudy: nextValues.fieldOfStudy,
      yearsOfExperience: nextValues.yearsOfExperience,
      currentRole: nextValues.currentRole,
      bio: nextValues.bio,
      linkedinUrl: nextValues.linkedinUrl,
      instagramHandle: nextValues.instagramHandle,
      youtubeChannel: nextValues.youtubeChannel,
      websiteUrl: nextValues.websiteUrl,
      professionalHeadline: nextValues.professionalHeadline,
      expertiseAreas: splitProfileList(nextValues.expertiseAreas),
      certifications: splitProfileList(nextValues.certifications),
      coachingExperienceYears: nextValues.coachingExperienceYears,
      trainingExperienceYears: nextValues.trainingExperienceYears,
      industryFocus: nextValues.industryFocus,
      languagesSpoken: splitProfileList(nextValues.languagesSpoken),
      coachExperienceSummary: nextValues.coachExperienceSummary,
      coachPrimaryIndustry: nextValues.industryFocus || nextValues.coachPrimaryIndustry,
      coachIndustryExperience: nextValues.coachIndustryExperience,
      coachExpertiseAreas: splitProfileList(nextValues.expertiseAreas),
      coachCoachingAreas: splitProfileList(nextValues.expertiseAreas),
      coachMethods: splitProfileList(nextValues.coachMethods),
      coachTargetAudience: splitProfileList(nextValues.coachTargetAudience),
      coachSessionFormats: selectedServices,
      coachServicesOther,
      coachCredentials: splitProfileList(nextValues.certifications),
      coachOutcomeFocus: nextValues.coachOutcomeFocus,
      coachAvailability: joinMultiSelectValue(splitProfileList(nextValues.coachAvailability)),
      individualPortalPurpose: nextValues.individualPortalPurpose,
      individualExperienceLevel: nextValues.individualExperienceLevel,
      individualExpertiseLevel: nextValues.individualExpertiseLevel,
      individualDevelopmentAreas: splitProfileList(nextValues.individualDevelopmentAreas),
      individualLearningPreferences: splitProfileList(nextValues.individualLearningPreferences),
      individualTargetAudience: splitProfileList(nextValues.individualTargetAudience),
      individualGoals: nextValues.individualGoals,
      individualTimeCommitment: nextValues.individualTimeCommitment,
      individualPreferredSessionFormat: nextValues.individualPreferredSessionFormat,
      individualTargetOutcomes: splitProfileList(nextValues.individualTargetOutcomes),
      individualCurrentChallenges: nextValues.individualCurrentChallenges,
      companyLegalName: nextValues.companyLegalName,
      companyDisplayName: nextValues.companyDisplayName || nextValues.companyName,
      companyType: nextValues.companyType || profile.companyType,
      companyDescription: nextValues.companyDescription,
      industry: nextValues.industry,
      employeeCountRange: nextValues.employeeCountRange,
      primaryContactName: nextValues.primaryContactName,
      status: profile.status,
    });

    setProfile(savedProfile);
    setFormValues(createProfileFormValues(savedProfile));
    sessionStorage.setItem("cs_profile_id", savedProfile.id);
    sessionStorage.setItem("cs_name", savedProfile.fullName);
    sessionStorage.setItem("cs_email", savedProfile.email);
    sessionStorage.setItem("cs_phone", savedProfile.phoneE164);
    return savedProfile;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateProfileForm(formValues);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Keep validation feedback close to each field to avoid users missing errors in long forms.
      setPageError("");
      setInfo("");
      scrollToFirstError(nextErrors);
      return;
    }

    setSaving(true);
    setPageError("");
    setInfo("");

    try {
      const savedProfile = await persistProfile();
      setErrors({});
      setInfo(
        savedProfile.profileCompletionRewardStatus === "credited"
          ? `Profile saved. You are ready for assignment workflows. You received ${PROFILE_COMPLETION_REWARD_COINS} credits for completing your profile to 100%.`
          : savedProfile.mandatoryProfileCompleted
            ? savedProfile.profileCompletionPercent === 100
              ? "Profile saved. You are ready for assignment workflows. Your profile is now 100% complete."
              : "Profile saved. You are ready for assignment workflows."
            : "Profile saved. Complete the mandatory section to unlock assignments.",
      );
      scrollToFeedbackBanner();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save your profile.");
      scrollToFeedbackBanner();
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) {
      return;
    }

    setUploadingPhoto(true);
    setPageError("");
    setInfo("");

    try {
      const url = await uploadProfilePhoto({
        tenantId: profile.tenantId,
        userId: profile.userId,
        file,
      });
      await persistProfile({ profilePhotoUrl: url });
      setInfo("Profile photo uploaded.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to upload profile photo.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  }

  if (loading) {
    return <main className={styles.loadingState}>Loading your profile…</main>;
  }

  if (!profile) {
    return <main className={styles.loadingState}>Profile not found.</main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image
            src={tenantConfig.theme.logo}
            alt={`${tenantConfig.name} logo`}
            width={76}
            height={40}
            className={landingStyles.logo}
          />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>{brandSubtitle}</span>
          </div>
        </Link>

        <div className={dashboardStyles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
            <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
            <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
          </nav>

          <ProfileDropdownMenu
            role={role}
            tenantId={tenantId}
            name={name}
            basePath={basePath}
            roleLabels={{
              company: tenantConfig.roles.company,
              professional: tenantConfig.roles.professional,
              individual: tenantConfig.roles.individual,
            }}
          />
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.heroCard}>
          <div>
            <h1 className={styles.title}>Update Profile</h1>
            <p className={styles.subtitle}>
              {profile?.userType === "company"
                ? "Manage your company profile and team information."
                : profile?.userType === "professional"
                  ? "Update your professional details and coaching preferences."
                  : "Complete your profile to enable better recommendations."}
            </p>
          </div>

          <div className={styles.statusGrid}>
            <article className={styles.statusTile}>
              <span className={styles.statusLabel}>Role</span>
              <strong>{roleLabel}</strong>
            </article>
            <article className={styles.statusTile}>
              <span className={styles.statusLabel}>Mandatory section</span>
              <strong>{profile.mandatoryProfileCompleted ? "Complete" : "Needs attention"}</strong>
            </article>
            <article className={styles.statusTile}>
              <span className={styles.statusLabel}>Assignment eligibility</span>
              <strong>{profile.assignmentEligible ? "Eligible" : "Blocked until complete"}</strong>
            </article>
            <article className={styles.statusTile}>
              <span className={styles.statusLabel}>Profile completion</span>
              <strong>{profile.profileCompletionPercent}%</strong>
            </article>
          </div>
        </div>

        {pageError ? <p className={styles.errorBanner}>{pageError}</p> : null}
        {info ? <p className={styles.infoBanner}>{info}</p> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Mandatory Details</h2>
                <p>These fields control profile completion and assignment readiness.</p>
              </div>
              <span className={styles.cardBadge}>Required</span>
            </div>

            <div className={styles.identityGrid}>
              <label className={styles.field}>
                <span>Name</span>
                <input value={formValues.fullName} disabled readOnly />
                <small>Identity-controlled and not editable.</small>
              </label>

              <label className={styles.field}>
                <span>User Type</span>
                <input value={roleLabel} disabled readOnly />
                <small>Derived from your platform registration.</small>
              </label>

              <label className={styles.field}>
                <span>Phone</span>
                <input value={formValues.phoneE164} disabled readOnly />
                <small>Identity-controlled and not editable.</small>
              </label>

              <label className={styles.field}>
                <span>Email Address</span>
                <input
                  id="profile-field-email"
                  className={errors.email ? styles.inputError : undefined}
                  value={formValues.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={isEmailLocked}
                  readOnly={isEmailLocked}
                  placeholder={isEmailLocked ? "Email address" : "Enter your email address"}
                />
                <small className={errors.email ? styles.fieldError : undefined}>
                  {errors.email
                    ?? (isEmailLocked
                      ? "Identity-controlled and not editable once saved."
                      : "Required. Once saved, this email cannot be changed.")}
                </small>
              </label>

              <label className={styles.field}>
                <span>City</span>
                <input
                  id="profile-field-city"
                  className={errors.city ? styles.inputError : undefined}
                  value={formValues.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="Enter your city"
                />
                <small className={errors.city ? styles.fieldError : undefined}>{errors.city ?? "Required before assignments can be enabled."}</small>
              </label>

              <label className={styles.field}>
                <span>Name of Company</span>
                <input
                  id="profile-field-companyName"
                  className={errors.companyName ? styles.inputError : undefined}
                  value={formValues.companyName}
                  onChange={(event) => updateField("companyName", event.target.value)}
                  placeholder={profile.userType === "company" ? "Required for company profiles" : "Optional"}
                />
                <small className={errors.companyName ? styles.fieldError : undefined}>{errors.companyName ?? (profile.userType === "company" ? "Required for company profiles." : "Add your organization if relevant.")}</small>
              </label>
            </div>
          </section>

          <CollapsibleSection
            title="Profile Photo"
            description="Useful for richer profile visibility later."
          >
            <div className={styles.photoSection}>
              <div className={styles.photoPreview}>
                {formValues.profilePhotoUrl ? (
                  <Image src={formValues.profilePhotoUrl} alt="Profile" fill sizes="120px" />
                ) : (
                  <span>{profile.fullName.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className={styles.photoActions}>
                <label className={styles.uploadButton}>
                  <input type="file" accept="image/*" onChange={handlePhotoSelected} hidden />
                  {uploadingPhoto ? "Uploading…" : "Upload profile photo"}
                </label>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Address Details"
            description="Location details used for profile completeness and logistics context."
          >
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Address</span>
                <input value={formValues.addressLine1} onChange={(event) => updateField("addressLine1", event.target.value)} placeholder="Address line 1" />
              </label>
              <label className={styles.field}>
                <span>Address Line 2</span>
                <input value={formValues.addressLine2} onChange={(event) => updateField("addressLine2", event.target.value)} placeholder="Address line 2" />
              </label>
              <label className={styles.field}>
                <span>State / Province</span>
                <input value={formValues.state} onChange={(event) => updateField("state", event.target.value)} placeholder="State or province" />
              </label>
              <label className={styles.field}>
                <span>Country</span>
                <input value={formValues.country} onChange={(event) => updateField("country", event.target.value)} placeholder="Country" />
              </label>
              <label className={styles.field}>
                <span>Postal Code</span>
                <input value={formValues.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} placeholder="Postal code" />
              </label>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Profile Enrichment"
            description="Professional details that improve matching quality while reducing data-entry errors."
          >
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Highest Degree Held</span>
                <select value={formValues.highestDegreeHeld} onChange={(event) => updateField("highestDegreeHeld", event.target.value)}>
                  <option value="">Select highest degree</option>
                  {HIGHEST_DEGREE_OPTIONS.map((degreeOption) => (
                    <option key={degreeOption} value={degreeOption}>{degreeOption}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Field of Study</span>
                <select value={formValues.fieldOfStudy} onChange={(event) => updateField("fieldOfStudy", event.target.value)}>
                  <option value="">Select field of study</option>
                  {FIELD_OF_STUDY_OPTIONS.map((fieldOption) => (
                    <option key={fieldOption} value={fieldOption}>{fieldOption}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Years of Experience</span>
                <input
                  id="profile-field-yearsOfExperience"
                  className={errors.yearsOfExperience ? styles.inputError : undefined}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={formValues.yearsOfExperience}
                  onChange={(event) => updateDecimalExperienceField("yearsOfExperience", event.target.value)}
                  onBlur={() => formatDecimalExperienceField("yearsOfExperience")}
                  placeholder="e.g. 6.66"
                />
                <small className={errors.yearsOfExperience ? styles.fieldError : undefined}>
                  {errors.yearsOfExperience ?? "Enter up to 2 decimal places."}
                </small>
              </label>
              <label className={styles.field}>
                <span>Current Role / Designation</span>
                <input value={formValues.currentRole} onChange={(event) => updateField("currentRole", event.target.value)} placeholder="Current role" />
              </label>
              <label className={styles.field}>
                <span>LinkedIn URL</span>
                <input
                  id="profile-field-linkedinUrl"
                  className={errors.linkedinUrl ? styles.inputError : undefined}
                  value={formValues.linkedinUrl}
                  onChange={(event) => updateUrlField("linkedinUrl", event.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
                <small className={errors.linkedinUrl ? styles.fieldError : undefined}>{errors.linkedinUrl ?? "Add your public LinkedIn profile if you want to strengthen discoverability."}</small>
              </label>
              <label className={styles.field}>
                <span>Instagram Handle</span>
                <input
                  value={formValues.instagramHandle}
                  onChange={(event) => updateField("instagramHandle", event.target.value)}
                  placeholder="@yourhandle"
                />
                <small>Public creator or social profile, if relevant.</small>
              </label>
              <label className={styles.field}>
                <span>YouTube Channel URL</span>
                <input
                  id="profile-field-youtubeChannel"
                  className={errors.youtubeChannel ? styles.inputError : undefined}
                  value={formValues.youtubeChannel}
                  onChange={(event) => updateUrlField("youtubeChannel", event.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                />
                <small className={errors.youtubeChannel ? styles.fieldError : undefined}>{errors.youtubeChannel ?? "Share your YouTube channel if you publish coaching content."}</small>
              </label>
              <label className={styles.field}>
                <span>Website / Portfolio URL</span>
                <input
                  id="profile-field-websiteUrl"
                  className={errors.websiteUrl ? styles.inputError : undefined}
                  value={formValues.websiteUrl}
                  onChange={(event) => updateUrlField("websiteUrl", event.target.value)}
                  placeholder="https://example.com"
                />
                <small className={errors.websiteUrl ? styles.fieldError : undefined}>{errors.websiteUrl ?? "Share your personal site, portfolio, or company page if relevant."}</small>
              </label>
              {profile.userType === "professional" ? (
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Professional Headline</span>
                  <input value={formValues.professionalHeadline} onChange={(event) => updateField("professionalHeadline", event.target.value)} placeholder="Executive coach for emerging leaders" />
                </label>
              ) : null}
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Short Bio / Summary</span>
                <textarea value={formValues.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder="Tell us a bit about yourself." rows={4} />
              </label>
            </div>
          </CollapsibleSection>

          {profile.userType === "professional" ? (
            <CollapsibleSection
              title="Coach Profile Details"
              description="Use structured selections for cleaner matching and fewer errors."
            >
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Coaching Experience (Years)</span>
                  <input
                    id="profile-field-coachingExperienceYears"
                    className={errors.coachingExperienceYears ? styles.inputError : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    value={formValues.coachingExperienceYears}
                    onChange={(event) => updateDecimalExperienceField("coachingExperienceYears", event.target.value)}
                    onBlur={() => formatDecimalExperienceField("coachingExperienceYears")}
                    placeholder="e.g. 6.66"
                    inputMode="decimal"
                  />
                  <small className={errors.coachingExperienceYears ? styles.fieldError : undefined}>{errors.coachingExperienceYears ?? "Enter up to 2 decimal places."}</small>
                </label>
                <label className={styles.field}>
                  <span>Coach Experience Summary</span>
                  <input value={formValues.coachExperienceSummary} onChange={(event) => updateField("coachExperienceSummary", event.target.value)} placeholder="e.g. 250+ 1:1 coaching hours" />
                </label>
                <label className={styles.field}>
                  <span>Training Experience (Years)</span>
                  <input
                    id="profile-field-trainingExperienceYears"
                    className={errors.trainingExperienceYears ? styles.inputError : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    value={formValues.trainingExperienceYears}
                    onChange={(event) => updateDecimalExperienceField("trainingExperienceYears", event.target.value)}
                    onBlur={() => formatDecimalExperienceField("trainingExperienceYears")}
                    placeholder="e.g. 6.66"
                    inputMode="decimal"
                  />
                  <small className={errors.trainingExperienceYears ? styles.fieldError : undefined}>{errors.trainingExperienceYears ?? "Enter up to 2 decimal places."}</small>
                </label>
                <label className={styles.field}>
                  <span>Certifications / Credentials</span>
                  <input value={formValues.certifications} onChange={(event) => updateField("certifications", event.target.value)} placeholder="Comma-separated values" />
                  <small>Include certifications, licenses, memberships, and recognized practice affiliations.</small>
                </label>
                <label className={styles.field}>
                  <span>Industry Focus</span>
                  <select
                    value={formValues.industryFocus}
                    onChange={(event) => {
                      updateField("industryFocus", event.target.value);
                      updateField("industry", event.target.value);
                    }}
                  >
                    <option value="">Select an industry</option>
                    {INDUSTRY_OPTIONS.map((industryOption) => (
                      <option key={industryOption} value={industryOption}>{industryOption}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Industry Experience</span>
                  <input
                    id="profile-field-coachIndustryExperience"
                    className={errors.coachIndustryExperience ? styles.inputError : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    value={formValues.coachIndustryExperience}
                    onChange={(event) => updateDecimalExperienceField("coachIndustryExperience", event.target.value)}
                    onBlur={() => formatDecimalExperienceField("coachIndustryExperience")}
                    placeholder="e.g. 6.66"
                    inputMode="decimal"
                  />
                  <small className={errors.coachIndustryExperience ? styles.fieldError : undefined}>{errors.coachIndustryExperience ?? "Enter up to 2 decimal places."}</small>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Coaching Methods</span>
                  {renderMultiSelect(
                    "coachMethods",
                    COACHING_METHOD_OPTIONS,
                    "Select the coaching methods you actively use.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide} ${styles.sectionBlock}`}>
                  <span>Purpose on Coaching Studio</span>
                  {renderMultiSelect(
                    "individualPortalPurpose",
                    COACH_PURPOSE_OPTIONS,
                    "Select all purposes that apply to your coaching practice.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide} ${styles.sectionBlock}`}>
                  <span>Outcome Focus</span>
                  {renderGroupedMultiSelect(
                    "coachOutcomeFocus",
                    COACH_OUTCOME_FOCUS_GROUPS,
                    "Select all outcome focus areas relevant to your coaching practice.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide} ${styles.sectionBlock}`}>
                  <span>Availability Preferences</span>
                  {renderMultiSelect(
                    "coachAvailability",
                    AVAILABILITY_OPTIONS,
                    "Choose all availability preferences that apply.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Expertise Areas</span>
                  {renderMultiSelect(
                    "expertiseAreas",
                    COMPETENCY_OPTIONS,
                    "Choose all applicable coaching competencies.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Languages Spoken</span>
                  {renderMultiSelect(
                    "languagesSpoken",
                    LANGUAGE_OPTIONS,
                    "Select all languages you can coach in.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Target Audience</span>
                  {renderMultiSelect(
                    "coachTargetAudience",
                    TARGET_AUDIENCE_OPTIONS,
                    "Select the audiences you primarily coach.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Services Provided</span>
                  {renderMultiSelect(
                    "coachSessionFormats",
                    SERVICE_PROVIDED_OPTIONS,
                    "Select all services you currently offer.",
                  )}
                </label>

                {isMultiSelectChecked("coachSessionFormats", "Other") ? (
                  <label className={`${styles.field} ${styles.fieldWide}`}>
                    <span>Other Service (Please specify)</span>
                    <input
                      value={formValues.coachServicesOther}
                      onChange={(event) => updateField("coachServicesOther", event.target.value)}
                      placeholder="Specify any additional service"
                    />
                  </label>
                ) : null}
              </div>
            </CollapsibleSection>
          ) : null}

          {profile.userType === "individual" ? (
            <CollapsibleSection
              title="Individual Matching Profile"
              description="Keep your preferences structured so recommendations are more accurate."
            >
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Purpose on Coaching Studio</span>
                  {renderMultiSelect(
                    "individualPortalPurpose",
                    INDIVIDUAL_PURPOSE_OPTIONS,
                    "Select all purposes that apply to you.",
                  )}
                </label>
                <label className={styles.field}>
                  <span>Experience Level</span>
                  <select value={formValues.individualExperienceLevel} onChange={(event) => updateField("individualExperienceLevel", event.target.value)}>
                    <option value="">Select your experience level</option>
                    {EXPERIENCE_LEVEL_OPTIONS.map((experienceLevelOption) => (
                      <option key={experienceLevelOption} value={experienceLevelOption}>{experienceLevelOption}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Expertise Level</span>
                  <select value={formValues.individualExpertiseLevel} onChange={(event) => updateField("individualExpertiseLevel", event.target.value)}>
                    <option value="">Select your expertise level</option>
                    {EXPERTISE_LEVEL_OPTIONS.map((expertiseLevelOption) => (
                      <option key={expertiseLevelOption} value={expertiseLevelOption}>{expertiseLevelOption}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Industry</span>
                  <select
                    value={formValues.industryFocus || formValues.industry}
                    onChange={(event) => {
                      updateField("industryFocus", event.target.value);
                      updateField("industry", event.target.value);
                    }}
                  >
                    <option value="">Select an industry</option>
                    {INDUSTRY_OPTIONS.map((industryOption) => (
                      <option key={industryOption} value={industryOption}>{industryOption}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Development Areas</span>
                  <input value={formValues.individualDevelopmentAreas} onChange={(event) => updateField("individualDevelopmentAreas", event.target.value)} placeholder="Communication, strategic thinking" />
                </label>
                <label className={styles.field}>
                  <span>Learning Preference</span>
                  <select value={formValues.individualLearningPreferences} onChange={(event) => updateField("individualLearningPreferences", event.target.value)}>
                    <option value="">Select preferred coaching format</option>
                    {SERVICE_PROVIDED_OPTIONS.map((serviceOption) => (
                      <option key={serviceOption} value={serviceOption}>{serviceOption}</option>
                    ))}
                  </select>
                  <small>Choose the coaching format you prefer working in.</small>
                </label>
                <label className={styles.field}>
                  <span>Weekly Time Commitment</span>
                  <input value={formValues.individualTimeCommitment} onChange={(event) => updateField("individualTimeCommitment", event.target.value)} placeholder="2-3 hours per week" />
                </label>
                <label className={styles.field}>
                  <span>Your Category</span>
                  <select value={formValues.individualTargetAudience} onChange={(event) => updateField("individualTargetAudience", event.target.value)}>
                    <option value="">Select the category that best describes you</option>
                    {INDIVIDUAL_IDENTITY_OPTIONS.map((identityOption) => (
                      <option key={identityOption} value={identityOption}>{identityOption}</option>
                    ))}
                  </select>
                  <small>This helps us match you with the right coaches and programs.</small>
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Purpose on Coaching Studio</span>
                  {renderMultiSelect(
                    "individualPortalPurpose",
                    INDIVIDUAL_PURPOSE_OPTIONS,
                    "Select all purposes that apply to you.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Availability Preferences</span>
                  {renderMultiSelect(
                    "coachAvailability",
                    AVAILABILITY_OPTIONS,
                    "Select the time slots that work for you.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Target Outcomes</span>
                  {renderGroupedMultiSelect(
                    "individualTargetOutcomes",
                    COACH_OUTCOME_FOCUS_GROUPS,
                    "Select target outcomes you want to work on.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Current Challenges</span>
                  {renderMultiSelect(
                    "individualCurrentChallenges",
                    INDIVIDUAL_CHALLENGES_OPTIONS,
                    "Select the challenges you want coaching to help address.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Languages Spoken</span>
                  {renderMultiSelect(
                    "languagesSpoken",
                    LANGUAGE_OPTIONS,
                    "Select all languages you are comfortable with.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Desired Coach&apos;s Expertise Area</span>
                  {renderMultiSelect(
                    "expertiseAreas",
                    COMPETENCY_OPTIONS,
                    "Select the expertise areas you want your coach to specialise in.",
                  )}
                </label>
              </div>
            </CollapsibleSection>
          ) : null}

          {profile.userType === "company" ? (
            <CollapsibleSection
              title="Company Details"
              description="Foundational company profile fields for tenant identity."
            >
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Company Legal Name</span>
                  <input value={formValues.companyLegalName} onChange={(event) => updateField("companyLegalName", event.target.value)} placeholder="Legal entity name" />
                </label>
                <label className={styles.field}>
                  <span>Company Display Name</span>
                  <input value={formValues.companyDisplayName} onChange={(event) => updateField("companyDisplayName", event.target.value)} placeholder="Display name" />
                </label>
                <label className={styles.field}>
                  <span>Company Type</span>
                  <input value={formValues.companyType} onChange={(event) => updateField("companyType", event.target.value)} placeholder="Coaching provider" />
                </label>
                <label className={styles.field}>
                  <span>Contact Person Name</span>
                  <input value={formValues.primaryContactName} onChange={(event) => updateField("primaryContactName", event.target.value)} placeholder="Primary contact" />
                </label>
                <label className={styles.field}>
                  <span>Industry</span>
                  <input value={formValues.industry} onChange={(event) => updateField("industry", event.target.value)} placeholder="Industry" />
                </label>
                <label className={styles.field}>
                  <span>Number of Employees</span>
                  <input value={formValues.employeeCountRange} onChange={(event) => updateField("employeeCountRange", event.target.value)} placeholder="e.g. 51-200" />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Company Description</span>
                  <textarea value={formValues.companyDescription} onChange={(event) => updateField("companyDescription", event.target.value)} placeholder="Describe the company." rows={4} />
                </label>
                <label className={`${styles.field} ${styles.fieldWide} ${styles.sectionBlock}`}>
                  <span>Purpose on Coaching Studio</span>
                  {renderMultiSelect(
                    "individualPortalPurpose",
                    COMPANY_PURPOSE_OPTIONS,
                    "Select all purposes that apply to your company.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide} ${styles.sectionBlock}`}>
                  <span>Outcome Focus</span>
                  {renderGroupedMultiSelect(
                    "coachOutcomeFocus",
                    COACH_OUTCOME_FOCUS_GROUPS,
                    "Select outcome focus areas your company specializes in.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Expertise Areas</span>
                  {renderMultiSelect(
                    "expertiseAreas",
                    COMPETENCY_OPTIONS,
                    "Select expertise areas your company offers.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Target Audience</span>
                  {renderMultiSelect(
                    "coachTargetAudience",
                    TARGET_AUDIENCE_OPTIONS,
                    "Select the audiences your company serves.",
                  )}
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Services Provided</span>
                  {renderMultiSelect(
                    "coachSessionFormats",
                    SERVICE_PROVIDED_OPTIONS,
                    "Select all services your company offers.",
                  )}
                </label>
              </div>
            </CollapsibleSection>
          ) : null}

          <div className={styles.actionsRow}>
            <Link href={`${basePath}/dashboard`} className={styles.secondaryAction}>
              Back to dashboard
            </Link>
            <Link href={`${basePath}/view-profile/${profile.id}?from=profile`} className={styles.secondaryAction}>
              View Profile
            </Link>
            <button type="submit" className={styles.primaryAction} disabled={saving || uploadingPhoto}>
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}