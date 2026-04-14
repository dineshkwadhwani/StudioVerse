"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { validateProfileForm, createProfileFormValues, type ProfileFormErrors } from "@/lib/validation/profile.schema";
import { auth } from "@/services/firebase";
import {
  getUserProfile,
  saveUserProfile,
  splitProfileList,
  uploadProfilePhoto,
} from "@/services/profile.service";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { UserProfileFormValues, UserProfileRecord } from "@/types/profile";
import type { TenantConfig } from "@/types/tenant";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import styles from "./ProfilePage.module.css";

function getRoleLabel(role: UserProfileRecord["userType"]): string {
  if (role === "company") return "Coaching Company";
  if (role === "professional") return "Coach";
  return "Learner";
}

type ProfilePageProps = {
  tenantConfig?: TenantConfig;
};

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

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? "Assessment Centre";
  const brandSubtitle = "StudioVerse Platform";

  useEffect(() => {
    async function loadProfile() {
      const userId = sessionStorage.getItem("cs_uid");
      const profileId = sessionStorage.getItem("cs_profile_id") ?? undefined;
      const phoneE164 = sessionStorage.getItem("cs_phone") ?? undefined;

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

  const roleLabel = useMemo(() => (profile ? getRoleLabel(profile.userType) : "Profile"), [profile]);
  const isEmailLocked = useMemo(() => Boolean(profile?.email.trim()), [profile?.email]);

  function updateField<Key extends keyof UserProfileFormValues>(field: Key, value: UserProfileFormValues[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setPageError("");
    setInfo("");
  }

  async function persistProfile(overrides?: Partial<UserProfileFormValues>) {
    if (!profile) {
      throw new Error("Profile is not loaded.");
    }

    const nextValues = { ...formValues, ...overrides };
    const normalizedEmail = nextValues.email.trim().toLowerCase();

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
      websiteUrl: nextValues.websiteUrl,
      professionalHeadline: nextValues.professionalHeadline,
      expertiseAreas: splitProfileList(nextValues.expertiseAreas),
      certifications: splitProfileList(nextValues.certifications),
      coachingExperienceYears: nextValues.coachingExperienceYears,
      trainingExperienceYears: nextValues.trainingExperienceYears,
      industryFocus: nextValues.industryFocus,
      languagesSpoken: splitProfileList(nextValues.languagesSpoken),
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
        savedProfile.mandatoryProfileCompleted
          ? "Profile saved. You are ready for assignment workflows."
          : "Profile saved. Complete the mandatory section to unlock assignments.",
      );
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save your profile.");
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
      <header className={landingStyles.nav}>
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

        <div className={styles.navActions}>
          <nav className={landingStyles.desktopNav}>
            <Link href={`${basePath}/dashboard`} className={landingStyles.navLink}>Dashboard</Link>
            <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
            <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
            <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
          </nav>

          <button type="button" className={styles.signOutButton} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <section className={styles.shell}>
        <div className={styles.heroCard}>
          <div>
            <p className={styles.eyebrow}>My Profile</p>
            <h1 className={styles.title}>Update Profile</h1>
            <p className={styles.subtitle}>
              Complete the mandatory section first. The rest is optional, but richer profile data improves assessments and future recruitment outcomes.
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
                <small>{errors.companyName ?? (profile.userType === "company" ? "Required for company profiles." : "Optional for individuals and professionals.")}</small>
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Profile Photo</h2>
                <p>Optional, but useful for richer profile visibility later.</p>
              </div>
            </div>

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
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Profile Enrichment</h2>
                <p>Optional fields that improve assessment quality and future matching.</p>
              </div>
              <span className={styles.cardBadgeMuted}>Optional</span>
            </div>

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
              <label className={styles.field}>
                <span>Highest Degree Held</span>
                <input value={formValues.highestDegreeHeld} onChange={(event) => updateField("highestDegreeHeld", event.target.value)} placeholder="Highest degree held" />
              </label>
              <label className={styles.field}>
                <span>Field of Study</span>
                <input value={formValues.fieldOfStudy} onChange={(event) => updateField("fieldOfStudy", event.target.value)} placeholder="Field of study" />
              </label>
              <label className={styles.field}>
                <span>Years of Experience</span>
                <input value={formValues.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)} placeholder="e.g. 8" />
              </label>
              <label className={styles.field}>
                <span>Current Role / Designation</span>
                <input value={formValues.currentRole} onChange={(event) => updateField("currentRole", event.target.value)} placeholder="Current role" />
              </label>
              <label className={styles.field}>
                <span>LinkedIn URL</span>
                <input value={formValues.linkedinUrl} onChange={(event) => updateField("linkedinUrl", event.target.value)} placeholder="https://linkedin.com/in/..." />
                <small>{errors.linkedinUrl ?? "Optional."}</small>
              </label>
              <label className={styles.field}>
                <span>Website / Portfolio URL</span>
                <input value={formValues.websiteUrl} onChange={(event) => updateField("websiteUrl", event.target.value)} placeholder="https://example.com" />
                <small>{errors.websiteUrl ?? "Optional."}</small>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Short Bio / Summary</span>
                <textarea value={formValues.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder="Tell us a bit about yourself." rows={4} />
              </label>
            </div>
          </section>

          {profile.userType === "professional" ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Professional Details</h2>
                  <p>Future-ready fields for discovery and public profile scenarios.</p>
                </div>
              </div>

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Professional Headline</span>
                  <input value={formValues.professionalHeadline} onChange={(event) => updateField("professionalHeadline", event.target.value)} placeholder="Executive coach for emerging leaders" />
                </label>
                <label className={styles.field}>
                  <span>Expertise Areas</span>
                  <input value={formValues.expertiseAreas} onChange={(event) => updateField("expertiseAreas", event.target.value)} placeholder="Comma-separated values" />
                </label>
                <label className={styles.field}>
                  <span>Certifications</span>
                  <input value={formValues.certifications} onChange={(event) => updateField("certifications", event.target.value)} placeholder="Comma-separated values" />
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
                  <input value={formValues.industryFocus} onChange={(event) => updateField("industryFocus", event.target.value)} placeholder="Industry focus" />
                </label>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Languages Spoken</span>
                  <input value={formValues.languagesSpoken} onChange={(event) => updateField("languagesSpoken", event.target.value)} placeholder="Comma-separated values" />
                </label>
              </div>
            </section>
          ) : null}

          {profile.userType === "company" ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Company Details</h2>
                  <p>Foundational company profile fields for tenant identity.</p>
                </div>
              </div>

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
            </section>
          ) : null}

          <div className={styles.actionsRow}>
            <Link href={`${basePath}/dashboard`} className={styles.secondaryAction}>
              Back to dashboard
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