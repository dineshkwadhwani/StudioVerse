"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { TenantConfig } from "@/types/tenant";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./ViewProfilePage.module.css";

type PublicProfileRecord = {
  id: string;
  tenantId: string;
  userType: string;
  fullName: string;
  city: string;
  state: string;
  country: string;
  companyName: string;
  currentRole: string;
  bio: string;
  professionalHeadline: string;
  profilePhotoUrl: string;
  highestDegreeHeld: string;
  fieldOfStudy: string;
  yearsOfExperience: string;
  industryFocus: string;
  languagesSpoken: string[];
  expertiseAreas: string[];
  coachTargetAudience: string[];
  coachMethods: string[];
  coachSessionFormats: string[];
  coachServicesOther: string;
  coachAvailability: string[];
  certifications: string[];
  coachCredentials: string[];
  coachOutcomeFocus: string;
  coachExperienceSummary: string;
  coachIndustryExperience: string;
  linkedinUrl: string;
  instagramHandle: string;
  youtubeChannel: string;
  websiteUrl: string;
  publicProfileReady: boolean;
};

type Props = {
  tenantConfig: TenantConfig;
  profileId: string;
};

type UserRole = StudioUserRole;

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function renderChips(values: string[]) {
  if (values.length === 0) {
    return <p className={styles.sectionText}>Not provided yet.</p>;
  }

  return (
    <div className={styles.chipList}>
      {values.map((value) => (
        <span key={value} className={styles.chip}>{value}</span>
      ))}
    </div>
  );
}

export default function ViewProfilePage({ tenantConfig, profileId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<PublicProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPreview = searchParams.get("from") === "profile";
  const basePath = `/${tenantConfig.id}`;
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? "Assessment Centre";

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    async function loadProfile() {
      const storedRole = sessionStorage.getItem("cs_role");
      const storedName = sessionStorage.getItem("cs_name");
      if (isUserRole(storedRole)) {
        setRole(storedRole);
      }
      setName(storedName ?? "User");

      try {
        const response = await fetch(`/api/public-profile/${tenantConfig.id}/${profileId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load profile.");
        }

        setProfile(data.profile as PublicProfileRecord);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [profileId, tenantConfig.id]);

  const servicesProvided = useMemo(() => {
    if (!profile) {
      return [];
    }

    return profile.coachServicesOther
      ? [...profile.coachSessionFormats, `Other: ${profile.coachServicesOther}`]
      : profile.coachSessionFormats;
  }, [profile]);

  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [role, basePath]);
  const initials = useMemo(() => getInitials(name), [name]);

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

  if (loading) {
    return <main className={styles.emptyState}>Loading profile…</main>;
  }

  if (error || !profile) {
    return <main className={styles.errorState}>{error || "Profile not found."}</main>;
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
            <span className={landingStyles.brandSubtitle}>Public Profile Preview</span>
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

      <div className={styles.shell}>
        {isPreview ? (
          <p className={styles.notice}>
            This is the public version of your profile. The more complete and specific your profile is, the easier it is for people to understand your expertise, trust your background, and decide to connect with confidence.
          </p>
        ) : null}

        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.kicker}>{profile.userType === "professional" ? "Coach Profile" : "Public Profile"}</p>
            <h1 className={styles.title}>{profile.fullName || "Profile"}</h1>
            {profile.professionalHeadline ? <p className={styles.headline}>{profile.professionalHeadline}</p> : null}
            <p className={styles.summary}>{profile.bio || "This profile is being updated. Check back soon for more details."}</p>
            <div className={styles.metaRow}>
              {profile.currentRole ? <span className={styles.metaPill}>{profile.currentRole}</span> : null}
              {profile.companyName ? <span className={styles.metaPill}>{profile.companyName}</span> : null}
              {profile.industryFocus ? <span className={styles.metaPill}>{profile.industryFocus}</span> : null}
              {profile.city || profile.country ? (
                <span className={styles.metaPill}>{[profile.city, profile.state, profile.country].filter(Boolean).join(", ")}</span>
              ) : null}
            </div>
          </div>

          <div className={styles.photoCard}>
            <div className={styles.photoWrap}>
              {profile.profilePhotoUrl ? (
                <Image src={profile.profilePhotoUrl} alt={profile.fullName} fill sizes="320px" />
              ) : (
                <div className={styles.initials}>{getInitials(profile.fullName)}</div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.snapshotSection}>
          <h2 className={styles.sectionTitle}>Quick Snapshot</h2>
          <div className={styles.statsGrid}>
            {profile.yearsOfExperience ? (
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Experience</span>
                <strong>{profile.yearsOfExperience}</strong>
              </div>
            ) : null}
            {profile.highestDegreeHeld ? (
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Education</span>
                <strong>{profile.highestDegreeHeld}</strong>
              </div>
            ) : null}
            {profile.fieldOfStudy ? (
              <div className={styles.statTile}>
                <span className={styles.statLabel}>Field of Study</span>
                <strong>{profile.fieldOfStudy}</strong>
              </div>
            ) : null}
            {!profile.yearsOfExperience && !profile.highestDegreeHeld && !profile.fieldOfStudy ? (
              <p className={styles.sectionText}>No snapshot details shared yet.</p>
            ) : null}
          </div>
        </section>

        <div className={styles.sectionGrid}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Expertise Areas</h2>
            {renderChips(profile.expertiseAreas)}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Languages</h2>
            {renderChips(profile.languagesSpoken)}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Target Audience</h2>
            {renderChips(profile.coachTargetAudience)}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Coaching Methods</h2>
            {renderChips(profile.coachMethods)}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Services Provided</h2>
            {renderChips(servicesProvided)}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Availability</h2>
            {renderChips(profile.coachAvailability)}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Credentials & Certifications</h2>
            {renderChips([...profile.certifications, ...profile.coachCredentials])}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Coaching Background</h2>
            <p className={styles.sectionText}>{profile.coachExperienceSummary || "Not provided yet."}</p>
            {profile.coachIndustryExperience ? (
              <p className={styles.sectionText}><strong>Industry Experience:</strong> {profile.coachIndustryExperience}</p>
            ) : null}
            {profile.coachOutcomeFocus ? (
              <p className={styles.sectionText}><strong>Outcome Focus:</strong> {profile.coachOutcomeFocus}</p>
            ) : null}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Links</h2>
            <div className={styles.linkList}>
              {profile.linkedinUrl ? <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a> : null}
              {profile.instagramHandle ? <span>{profile.instagramHandle}</span> : null}
              {profile.youtubeChannel ? <a href={profile.youtubeChannel} target="_blank" rel="noreferrer">YouTube Channel</a> : null}
              {profile.websiteUrl ? <a href={profile.websiteUrl} target="_blank" rel="noreferrer">Website / Portfolio</a> : null}
              {!profile.linkedinUrl && !profile.instagramHandle && !profile.youtubeChannel && !profile.websiteUrl ? <p className={styles.sectionText}>No public links shared yet.</p> : null}
            </div>
          </section>
        </div>

        <div className={styles.bottomActions}>
          <Link href={`${basePath}/profile`} className={styles.bottomBackAction}>Back to Update Profile</Link>
        </div>
      </div>
    </main>
  );
}
