"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import { getAssignmentsForAssigneeContext, getAssignmentsForAssignerContext } from "@/services/assignment.service";
import { listProfessionalsForCoachDropdown } from "@/services/manage-users.service";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { UserProfileRecord } from "@/types/profile";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuItems } from "@/modules/activities/config/menuConfig";
import { getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole, StudioMenuItem, StudioMenuGroup } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import styles from "./DashboardPage.module.css";

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

function isAssignmentAction(key: string): boolean {
  return key === "assign-activity";
}

function getInitialMenuItem(role: UserRole): StudioMenuItem | null {
  const items = getRoleMenuItems(role, { basePath: `/${coachingTenantConfig.id}` });
  return items[0] ?? null;
}

type DashboardProps = {
  tenantConfig?: TenantConfig;
};

export default function DashboardPage({ tenantConfig = coachingTenantConfig }: DashboardProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");
  const [activeKey, setActiveKey] = useState<string>(() => getInitialMenuItem("individual")?.key ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  const [wallet, setWallet] = useState<{ issued: number; utilized: number; available: number } | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activitySummary, setActivitySummary] = useState<{
    total: number;
    assigned: number;
    recommended: number;
    completed: number;
  }>({
    total: 0,
    assigned: 0,
    recommended: 0,
    completed: 0,
  });
  const [assignedBySummary, setAssignedBySummary] = useState<{
    total: number;
    pending: number;
    completed: number;
  } | null>(null);

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");
    const storedUid = sessionStorage.getItem("cs_uid");
    const storedProfileId = sessionStorage.getItem("cs_profile_id") ?? undefined;
    const storedPhone = sessionStorage.getItem("cs_phone") ?? undefined;
    const storedEmail = sessionStorage.getItem("cs_email") ?? undefined;

    if (!storedRoleRaw) {
      router.replace(basePath);
      return;
    }

    if (!isUserRole(storedRoleRaw)) {
      sessionStorage.removeItem("cs_role");
      router.replace(basePath);
      return;
    }

    queueMicrotask(() => {
      setRole(storedRoleRaw);
      setName(storedName ?? "User");
      setActiveKey(getInitialMenuItem(storedRoleRaw)?.key ?? "");
    });

    if (storedUid) {
      getWalletForUserContext([storedUid, storedProfileId ?? ""])
        .then((walletData) => {
          if (!walletData) {
            setWallet({ issued: 0, utilized: 0, available: 0 });
            return;
          }
          setWallet({
            issued: walletData.totalIssuedCoins,
            utilized: walletData.utilizedCoins,
            available: walletData.availableCoins,
          });
        })
        .catch(() => {
          setWallet(null);
        });

      getUserProfile({
        userId: storedUid,
        tenantId,
        phoneE164: storedPhone,
        profileId: storedProfileId,
      })
        .then((resolvedProfile) => {
          setProfile(resolvedProfile);
          setProfileStatus("ready");

          if (resolvedProfile) {
            setName(resolvedProfile.fullName || storedName || "User");
            sessionStorage.setItem("cs_profile_id", resolvedProfile.id);
            sessionStorage.setItem("cs_name", resolvedProfile.fullName);
          }

          if (storedRoleRaw === "company" || storedRoleRaw === "professional") {
            void (async () => {
              try {
                let assignerIds: string[] = [];

                if (storedRoleRaw === "company") {
                  const companyId = resolvedProfile?.id || storedProfileId || storedUid;
                  if (!companyId) {
                    setAssignedBySummary({ total: 0, pending: 0, completed: 0 });
                    return;
                  }

                  const coaches = await listProfessionalsForCoachDropdown({ tenantId, companyId });
                  assignerIds = Array.from(
                    new Set(coaches.flatMap((coach) => [coach.id, coach.userId]).filter(Boolean))
                  );
                } else {
                  assignerIds = Array.from(
                    new Set([storedUid, storedProfileId, resolvedProfile?.id, resolvedProfile?.userId].filter(Boolean) as string[])
                  );
                }

                if (assignerIds.length === 0) {
                  setAssignedBySummary({ total: 0, pending: 0, completed: 0 });
                  return;
                }

                const rows = await getAssignmentsForAssignerContext({ tenantId, assignerIds });
                setAssignedBySummary({
                  total: rows.length,
                  pending: rows.filter((r) => r.status === "assigned").length,
                  completed: rows.filter((r) => r.status === "completed").length,
                });
              } catch {
                setAssignedBySummary({ total: 0, pending: 0, completed: 0 });
              }
            })();
          }

          const assigneeIds = Array.from(
            new Set([storedUid, storedProfileId, resolvedProfile?.id, resolvedProfile?.userId].filter(Boolean) as string[])
          );

          return getAssignmentsForAssigneeContext({
            tenantId,
            assigneeIds,
            assigneePhone: resolvedProfile?.phoneE164 || storedPhone,
            assigneeEmail: resolvedProfile?.email || storedEmail,
          });
        })
        .then((rows) => {
          const total = rows.length;
          const assigned = rows.filter((item) => item.status === "assigned").length;
          const recommended = rows.filter((item) => item.status === "recommended").length;
          const completed = rows.filter((item) => item.status === "completed").length;
          setActivitySummary({ total, assigned, recommended, completed });
        })
        .catch(() => {
          setProfileStatus("error");
          setActivitySummary({ total: 0, assigned: 0, recommended: 0, completed: 0 });
        });
    } else {
      router.replace(`${basePath}/auth`);
    }
  }, [basePath, router, tenantId]);

  const menuGroups = useMemo<StudioMenuGroup[]>(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);

  const userInitials = useMemo(() => getInitials(name), [name]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? "Assessment Centre";
  const profileIncomplete = Boolean(profile && !profile.mandatoryProfileCompleted);
  const brandSubtitle = "StudioVerse Platform";

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
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

        <div className={styles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href={`${basePath}/tools`} className={landingStyles.navLink}>
              {toolsLabel}
            </Link>
            <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
            <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
          </nav>

          <div className={styles.profileArea} ref={menuRef}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {userInitials} ▾
            </button>

            {menuOpen && (
              <section className={styles.menuPanel}>
                <div className={styles.menuUser}>
                  <p className={styles.menuName}>{name}</p>
                  <p className={styles.menuRole}>{getRoleLabel(role, {
                    company: tenantConfig.roles.company,
                    professional: tenantConfig.roles.professional,
                    individual: tenantConfig.roles.individual,
                  })}</p>
                </div>

                {menuGroups.map((group) => (
                  <div key={group.key} className={styles.menuGroup}>
                    <p className={styles.menuGroupTitle}>{group.label}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`${styles.menuItem} ${activeKey === item.key ? styles.menuItemActive : ""}`}
                        disabled={role === "individual" && profileIncomplete && isAssignmentAction(item.key)}
                        onClick={() => {
                          if (item.href !== `${basePath}/dashboard`) {
                            setMenuOpen(false);
                            router.push(item.href);
                            return;
                          }
                          setActiveKey(item.key);
                          setMenuOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}

                <hr className={styles.menuDivider} />

                <button type="button" className={styles.menuItem} onClick={handleLogout}>
                  Sign Out
                </button>
              </section>
            )}
          </div>
        </div>
      </header>

      <nav className={styles.mobileTopNav}>
        <Link href={`${basePath}/tools`}>{toolsLabel}</Link>
        <Link href={`${basePath}/programs`}>Programs</Link>
        <Link href={`${basePath}/events`}>Events</Link>
      </nav>

      {/* Profile incomplete banner */}
      {profileIncomplete && (
        <div className={styles.profileIncompleteBanner}>
          <span>⚠️ Your profile is incomplete.</span>
          <span> Please complete your basic profile (email and city) to assign or perform activities.</span>
          <Link href={`${basePath}/profile`} className={styles.profileIncompleteBannerLink}>
            Complete Profile →
          </Link>
        </div>
      )}

      {/* Content */}
      <div className={styles.shell}>
        <section className={styles.contentCard}>
          <h1 className={styles.dashboardTitle}>Dashboard</h1>

          <div className={styles.summaryStack}>
            <article className={styles.summaryCard}>
              <p className={styles.summaryTitle}>Profile Status</p>
              <div className={styles.summaryStats}>
                <p>Completion: <strong>{profileStatus === "ready" && profile ? `${profile.profileCompletionPercent}%` : "-"}</strong></p>
                <p>Mandatory: <strong>{profileStatus === "ready" && profile ? (profile.mandatoryProfileCompleted ? "Complete" : "Incomplete") : "-"}</strong></p>
                <p>Assignments: <strong>{profileStatus === "ready" && profile ? (profile.assignmentEligible ? "Enabled" : "Blocked") : "-"}</strong></p>
              </div>
              <Link href={`${basePath}/profile`} className={styles.summaryAction}>
                Update Profile
              </Link>
            </article>

            <article className={styles.summaryCard}>
              <p className={styles.summaryTitle}>My Wallet</p>
              <div className={styles.summaryStats}>
                <p>Available: <strong>{wallet?.available ?? 0}</strong></p>
                <p>Utilized: <strong>{wallet?.utilized ?? 0}</strong></p>
                <p>Total Issued: <strong>{wallet?.issued ?? 0}</strong></p>
              </div>
              <Link href={`${basePath}/manage-wallet`} className={styles.summaryAction}>
                Manage Wallet
              </Link>
            </article>

            {assignedBySummary !== null && (role === "company" || role === "professional") && (
              <article className={styles.summaryCard}>
                <p className={styles.summaryTitle}>Assigned Activities</p>
                <div className={styles.summaryStats}>
                  <p>Total Assigned: <strong>{assignedBySummary.total}</strong></p>
                  <p>Pending: <strong>{assignedBySummary.pending}</strong></p>
                  <p>Completed: <strong>{assignedBySummary.completed}</strong></p>
                </div>
                <Link href={`${basePath}/assigned-activities`} className={styles.summaryAction}>
                  View All
                </Link>
              </article>
            )}

            <article className={styles.summaryCard}>
              <p className={styles.summaryTitle}>My activities</p>
              <div className={styles.summaryStats}>
                <p>Total: <strong>{activitySummary.total}</strong></p>
                <p>Assigned: <strong>{activitySummary.assigned}</strong></p>
                <p>Recommended: <strong>{activitySummary.recommended}</strong></p>
                <p>Completed: <strong>{activitySummary.completed}</strong></p>
              </div>
              <Link href={`${basePath}/my-activities`} className={styles.summaryAction}>
                Complete now
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
