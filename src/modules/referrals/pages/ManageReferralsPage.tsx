"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { createReferral, listReferralsForUser } from "@/services/referral.service";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import type { ReferredType, ReferralRecord } from "@/types/referral";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./ManageReferralsPage.module.css";

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

function formatDate(value: ReferralRecord["createdAt"]): string {
  if (!value || !("toDate" in value) || typeof value.toDate !== "function") {
    return "-";
  }
  return value.toDate().toLocaleString();
}

type ManageReferralsPageProps = {
  tenantConfig?: TenantConfig;
};

export default function ManageReferralsPage({ tenantConfig = coachingTenantConfig }: ManageReferralsPageProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;

  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);

  const [referredType, setReferredType] = useState<ReferredType>("individual");
  const [referredEmail, setReferredEmail] = useState("");
  const [referredPhone, setReferredPhone] = useState("");

  const [filterType, setFilterType] = useState<ReferredType | "all">("all");
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    setRole(storedRoleRaw);
    setName(storedName ?? "User");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const storedProfileId = sessionStorage.getItem("cs_profile_id");
        const storedPhone = sessionStorage.getItem("cs_phone");

        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        if (!profile) {
          throw new Error("Unable to resolve your profile.");
        }

        setProfileId(profile.id);
        if (profile.fullName) {
          setName(profile.fullName);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load profile.";
        setError(message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  useEffect(() => {
    if (!profileId) {
      return;
    }

    void (async () => {
      try {
        const rows = await listReferralsForUser({
          referrerUserId: profileId,
          referredType: filterType,
        });
        setReferrals(rows);
      } catch {
        setReferrals([]);
      }
    })();
  }, [profileId, filterType]);

  async function handleCreateReferral() {
    if (!profileId) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await createReferral({
        tenantId,
        referrerUserId: profileId,
        referrerName: name,
        referrerRole: role,
        referredType,
        referredEmail,
        referredPhone,
      });

      setReferredEmail("");
      setReferredPhone("");
      setSuccess("Referral created. Invite sent. Your reward coins will be added once they join.");

      const rows = await listReferralsForUser({
        referrerUserId: profileId,
        referredType: filterType,
      });
      setReferrals(rows);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create referral.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={tenantConfig.theme.logo} alt={`${tenantConfig.name} logo`} width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>{brandSubtitle}</span>
          </div>
        </Link>
        <nav className={landingStyles.desktopNav}>
          <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
          <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
          <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
        </nav>

        <div className={dashboardStyles.rightControls}>

          <div className={dashboardStyles.profileArea} ref={menuRef}>
            <button type="button" className={dashboardStyles.profileButton} onClick={() => setMenuOpen((prev) => !prev)}>
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
        <section className={styles.card}>
          <h1 className={styles.title}>Manage Referrals</h1>
          <p className={styles.contextText}>
            {role === "company"
              ? "Track referrals submitted by your professionals and monitor referral-driven growth across your company."
              : "Refer coaches and individuals to the platform, earn credits for each referral, and track their progress here."}
          </p>
          <p className={styles.note}>
            Every referral gives you 10 coins now, and you receive 5 extra coins when that referral joins.
          </p>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="referred-type">Are you referring a coach or an individual?</label>
              <select
                id="referred-type"
                className={styles.select}
                value={referredType}
                onChange={(event) => setReferredType(event.target.value as ReferredType)}
              >
                <option value="coach">Coach</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="referred-email">Referred Email</label>
              <input
                id="referred-email"
                type="email"
                className={styles.input}
                value={referredEmail}
                onChange={(event) => setReferredEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="referred-phone">Referred Phone</label>
              <input
                id="referred-phone"
                className={styles.input}
                value={referredPhone}
                onChange={(event) => setReferredPhone(event.target.value)}
                placeholder="+91XXXXXXXXXX"
              />
            </div>
          </div>

          <button type="button" className={styles.button} onClick={handleCreateReferral} disabled={busy || loading || !profileId}>
            {busy ? "Creating..." : "Create New Referral"}
          </button>

          {error ? <p className={styles.error}>{error}</p> : null}
          {success ? <p className={styles.success}>{success}</p> : null}

          <div className={styles.controls}>
            <div className={styles.radioRow}>
              {(["all", "coach", "individual"] as const).map((value) => (
                <label key={value} className={styles.radioPill}>
                  <input
                    type="radio"
                    name="referral-filter"
                    checked={filterType === value}
                    onChange={() => setFilterType(value)}
                  />
                  {value === "all" ? "All" : value}
                </label>
              ))}
            </div>
          </div>

          {loading ? <p className={styles.subtitle}>Loading referrals...</p> : null}

          {!loading && referrals.length === 0 ? <div className={styles.empty}>No referrals found yet.</div> : null}

          {!loading && referrals.length > 0 ? (
            <div className={styles.list}>
              {referrals.map((item) => (
                <article key={item.id} className={styles.item}>
                  <div>
                    <p className={styles.name}>{item.referredEmail || item.referredPhone}</p>
                    <p className={styles.meta}>Type: {item.referredType === "coach" ? "Coach" : "Individual"}</p>
                    <p className={styles.meta}>Phone: {item.referredPhone}</p>
                    <p className={styles.meta}>Created on: {formatDate(item.createdAt)}</p>
                  </div>
                  <span className={styles.status}>{item.status}</span>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
