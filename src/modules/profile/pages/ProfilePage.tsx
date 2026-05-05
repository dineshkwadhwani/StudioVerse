"use client";

import { ChangeEvent, Fragment, FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { validateProfileForm, createProfileFormValues, type ProfileFormErrors } from "@/lib/validation/profile.schema";
import { auth } from "@/services/firebase";
import { PROFILE_COMPLETION_REWARD_COINS } from "@/constants/wallet";
import {
  getUserProfile,
  saveUserProfile,
  splitProfileList,
  uploadProfilePhoto,
} from "@/services/profile.service";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { UserProfileFormValues, UserProfileRecord } from "@/types/profile";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  AVAILABILITY_OPTIONS,
  COACHING_METHOD_OPTIONS,
  COMPETENCY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  EXPERIENCE_YEARS_OPTIONS,
  EXPERTISE_LEVEL_OPTIONS,
  FIELD_OF_STUDY_OPTIONS,
  HIGHEST_DEGREE_OPTIONS,
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function parseMultiSelectValue(value: string): string[] {
  return splitProfileList(value);
}

function joinMultiSelectValue(values: string[]): string {
  return values.join(", ");
}

type ProfilePageProps = {
  tenantConfig?: TenantConfig;
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

export default function ProfilePage({ tenantConfig = coachingTenantConfig }: ProfilePageProps) {
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? "Assessment Centre";
  const brandSubtitle = "StudioVerse Platform";

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

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
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [role, basePath]);
  const initials = useMemo(() => getInitials(name), [name]);

  function scrollToFeedbackBanner() {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function updateField<Key extends keyof UserProfileFormValues>(field: Key, value: UserProfileFormValues[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
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
        <small>{helperText}</small>
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
      coachCredentials: splitProfileList(nextValues.coachCredentials),
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

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
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

          <div className={dashboardStyles.profileArea} ref={menuRef}>
            <button
              type="button"
              className={dashboardStyles.profileButton}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {initials} ▾
            </button>

            {menuOpen && (
              <section className={dashboardStyles.menuPanel}>
                <div className={dashboardStyles.menuUser}>
                  <p className={dashboardStyles.menuName}>{name}</p>
                  <p className={dashboardStyles.menuRole}>{getRoleLabel(role, {
                    company: tenantConfig.roles.company,
                    professional: tenantConfig.roles.professional,
                    individual: tenantConfig.roles.individual,
                  })}</p>
                </div>

                {roleMenuGroups.map((group) => (
                  <div key={group.key} className={dashboardStyles.menuGroup}>
                    <p className={dashboardStyles.menuGroupTitle}>{group.label}</p>
                    {group.items.map((item) => (
                      <Fragment key={item.key}>
                        {item.type === "signout" && <hr className={dashboardStyles.menuDivider} />}
                        {item.type === "signout" ? (
                          <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>{item.label}</button>
                        ) : (
                          <Link href={item.href} className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                            {item.label}
                          </Link>
                        )}
                      </Fragment>
                    ))}
                  </div>
                ))}
              </section>
            )}
          </div>
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
                  value={formValues.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={isEmailLocked}
                  readOnly={isEmailLocked}
                  placeholder={isEmailLocked ? "Email address" : "Enter your email address"}
                />
                <small>
                  {errors.email
                    ?? (isEmailLocked
                      ? "Identity-controlled and not editable once saved."
                      : "Required. Once saved, this email cannot be changed.")}
                </small>
              </label>

              <label className={styles.field}>
                <span>City</span>
                <input
                  value={formValues.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="Enter your city"
                />
                <small>{errors.city ?? "Required before assignments can be enabled."}</small>
              </label>

              <label className={styles.field}>
                <span>Name of Company</span>
                <input
                  value={formValues.companyName}
                  onChange={(event) => updateField("companyName", event.target.value)}
                  placeholder={profile.userType === "company" ? "Required for company profiles" : "Optional"}
                />
                <small>{errors.companyName ?? (profile.userType === "company" ? "Required for company profiles." : "Add your organization if relevant.")}</small>
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
                <p>Supported: image files uploaded to Firebase Storage.</p>
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
                <select value={formValues.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)}>
                  <option value="">Select years of experience</option>
                  {EXPERIENCE_YEARS_OPTIONS.map((experienceOption) => (
                    <option key={experienceOption} value={experienceOption}>{experienceOption}</option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Current Role / Designation</span>
                <input value={formValues.currentRole} onChange={(event) => updateField("currentRole", event.target.value)} placeholder="Current role" />
              </label>
              <label className={styles.field}>
                <span>LinkedIn URL</span>
                <input
                  value={formValues.linkedinUrl}
                  onChange={(event) => updateField("linkedinUrl", event.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
                <small>{errors.linkedinUrl ?? "Add your public LinkedIn profile if you want to strengthen discoverability."}</small>
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
                  value={formValues.youtubeChannel}
                  onChange={(event) => updateField("youtubeChannel", event.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                />
                <small>{errors.youtubeChannel ?? "Share your YouTube channel if you publish coaching content."}</small>
              </label>
              <label className={styles.field}>
                <span>Website / Portfolio URL</span>
                <input
                  value={formValues.websiteUrl}
                  onChange={(event) => updateField("websiteUrl", event.target.value)}
                  placeholder="https://example.com"
                />
                <small>{errors.websiteUrl ?? "Share your personal site, portfolio, or company page if relevant."}</small>
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
              badge="Matching Ready"
            >
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Certifications</span>
                  <input value={formValues.certifications} onChange={(event) => updateField("certifications", event.target.value)} placeholder="Comma-separated values" />
                  <small>Formal certificates from institutions (for example ICF ACC/PCC, SHRM, PMP).</small>
                </label>
                <label className={styles.field}>
                  <span>Coaching Experience</span>
                  <input value={formValues.coachingExperienceYears} onChange={(event) => updateField("coachingExperienceYears", event.target.value)} placeholder="e.g. 5 years" />
                </label>
                <label className={styles.field}>
                  <span>Training Experience</span>
                  <input value={formValues.trainingExperienceYears} onChange={(event) => updateField("trainingExperienceYears", event.target.value)} placeholder="e.g. 3 years" />
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
                  <span>Coach Experience Summary</span>
                  <input value={formValues.coachExperienceSummary} onChange={(event) => updateField("coachExperienceSummary", event.target.value)} placeholder="e.g. 250+ 1:1 coaching hours" />
                </label>
                <label className={styles.field}>
                  <span>Primary Industry</span>
                  <input
                    value={formValues.industryFocus || formValues.coachPrimaryIndustry}
                    readOnly
                    disabled
                    placeholder="Derived from Industry Focus"
                  />
                </label>
                <label className={styles.field}>
                  <span>Industry Experience</span>
                  <input value={formValues.coachIndustryExperience} onChange={(event) => updateField("coachIndustryExperience", event.target.value)} placeholder="e.g. 12 years" />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Coaching Methods</span>
                  {renderMultiSelect(
                    "coachMethods",
                    COACHING_METHOD_OPTIONS,
                    "Select the coaching methods you actively use.",
                  )}
                </label>
                <label className={styles.field}>
                  <span>Credentials</span>
                  <input value={formValues.coachCredentials} onChange={(event) => updateField("coachCredentials", event.target.value)} placeholder="ICF PCC, NLP Practitioner" />
                  <small>Broader credentials like licenses, memberships, and recognized practice affiliations.</small>
                </label>
                <label className={styles.field}>
                  <span>Outcome Focus</span>
                  <input value={formValues.coachOutcomeFocus} onChange={(event) => updateField("coachOutcomeFocus", event.target.value)} placeholder="Promotion readiness, leadership confidence" />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Availability Preferences</span>
                  {renderMultiSelect(
                    "coachAvailability",
                    AVAILABILITY_OPTIONS,
                    "Pick all preferred coaching slots (includes US Eastern Time to support international assignments).",
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
              badge="Matching Ready"
            >
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Purpose on StudioVerse</span>
                  <select value={formValues.individualPortalPurpose} onChange={(event) => updateField("individualPortalPurpose", event.target.value)}>
                    <option value="">Select your purpose</option>
                    {PURPOSE_OPTIONS.map((purposeOption) => (
                      <option key={purposeOption} value={purposeOption}>{purposeOption}</option>
                    ))}
                  </select>
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
                  <span>Learning Preferences</span>
                  <input value={formValues.individualLearningPreferences} onChange={(event) => updateField("individualLearningPreferences", event.target.value)} placeholder="Hands-on, reflective journaling" />
                </label>
                <label className={styles.field}>
                  <span>Weekly Time Commitment</span>
                  <input value={formValues.individualTimeCommitment} onChange={(event) => updateField("individualTimeCommitment", event.target.value)} placeholder="2-3 hours per week" />
                </label>
                <label className={styles.field}>
                  <span>Preferred Session Format</span>
                  <input value={formValues.individualPreferredSessionFormat} onChange={(event) => updateField("individualPreferredSessionFormat", event.target.value)} placeholder="1:1 virtual, cohort-based" />
                </label>
                <label className={styles.field}>
                  <span>Target Outcomes</span>
                  <input value={formValues.individualTargetOutcomes} onChange={(event) => updateField("individualTargetOutcomes", event.target.value)} placeholder="Promotion, confidence, role clarity" />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Current Goals</span>
                  <textarea value={formValues.individualGoals} onChange={(event) => updateField("individualGoals", event.target.value)} placeholder="Describe what you want to achieve in the next 3-6 months." rows={3} />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Current Challenges</span>
                  <textarea value={formValues.individualCurrentChallenges} onChange={(event) => updateField("individualCurrentChallenges", event.target.value)} placeholder="Describe blockers that coaching or learning should address." rows={3} />
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
                  <span>Expertise Areas</span>
                  {renderMultiSelect(
                    "expertiseAreas",
                    COMPETENCY_OPTIONS,
                    "Select growth areas relevant for matching with coaches.",
                  )}
                </label>

                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Target Audience</span>
                  {renderMultiSelect(
                    "individualTargetAudience",
                    TARGET_AUDIENCE_OPTIONS,
                    "Select the audience category closest to your context.",
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