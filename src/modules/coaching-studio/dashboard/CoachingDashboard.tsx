"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import { getAssignmentsForAssigneeContext } from "@/services/assignment.service";
import { config } from "@/tenants/coaching-studio/config";
import type { UserProfileRecord } from "@/types/profile";
import { getRoleLabel, getRoleMenuItems } from "../menuConfig";
import type { CoachingUserRole, CoachingMenuItem } from "../menuConfig";
import landingStyles from "../CoachingLandingPage.module.css";
import styles from "./CoachingDashboard.module.css";

type UserRole = CoachingUserRole;

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

function getInitialMenuItem(role: UserRole): CoachingMenuItem | null {
  const items = getRoleMenuItems(role);
  return items[0] ?? null;
}

export default function CoachingDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");
  const [activeKey, setActiveKey] = useState<string>(() => getInitialMenuItem("individual")?.key ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);
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

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");
    const storedUid = sessionStorage.getItem("cs_uid");
    const storedProfileId = sessionStorage.getItem("cs_profile_id") ?? undefined;
    const storedPhone = sessionStorage.getItem("cs_phone") ?? undefined;
    const storedEmail = sessionStorage.getItem("cs_email") ?? undefined;

    if (!storedRoleRaw) {
      router.replace("/coaching-studio");
      return;
    }

    if (!isUserRole(storedRoleRaw)) {
      sessionStorage.removeItem("cs_role");
      router.replace("/coaching-studio");
      return;
    }

    setRole(storedRoleRaw);
    setActiveKey((current) => {
      const items = getRoleMenuItems(storedRoleRaw);
      if (items.some((item) => item.key === current)) {
        return current;
      }
      return items[0]?.key ?? "";
    });
    setName(storedName ?? "User");

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
        tenantId: "coaching-studio",
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

          const assigneeIds = Array.from(
            new Set([storedUid, storedProfileId, resolvedProfile?.id, resolvedProfile?.userId].filter(Boolean) as string[])
          );

          return getAssignmentsForAssigneeContext({
            tenantId: "coaching-studio",
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
      router.replace("/coaching-studio/auth");
    }
  }, [router]);

  const menuItems = useMemo(() => getRoleMenuItems(role), [role]);

  const userInitials = useMemo(() => getInitials(name), [name]);
  const toolsLabel = config.landingContent?.displayLabels?.tools ?? "Assessment Centre";
  const profileIncomplete = Boolean(profile && !profile.mandatoryProfileCompleted);

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace("/coaching-studio");
  }

  return (
    <main className={styles.page}>
      <header className={landingStyles.nav}>
        <Link href="/coaching-studio" className={landingStyles.brand}>
          <Image
            src={config.theme.logo}
            alt="Coaching Studio logo"
            width={76}
            height={40}
            className={landingStyles.logo}
          />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>Coaching Studio</span>
            <span className={landingStyles.brandSubtitle}>Coaching | Growth | Potential</span>
          </div>
        </Link>

        <div className={styles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href="/coaching-studio/tools" className={landingStyles.navLink}>
              {toolsLabel}
            </Link>
            <Link href="/coaching-studio/programs" className={landingStyles.navLink}>Programs</Link>
            <Link href="/coaching-studio/events" className={landingStyles.navLink}>Events</Link>
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
                  <p className={styles.menuRole}>{getRoleLabel(role)}</p>
                </div>

                <p className={styles.menuTitle}>Actions</p>
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.menuItem} ${activeKey === item.key ? styles.menuItemActive : ""}`}
                    disabled={role === "individual" && profileIncomplete && isAssignmentAction(item.key)}
                    onClick={() => {
                      if (item.href !== "/coaching-studio/dashboard") {
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
        <Link href="/coaching-studio/tools">{toolsLabel}</Link>
        <Link href="/coaching-studio/programs">Programs</Link>
        <Link href="/coaching-studio/events">Events</Link>
      </nav>

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
              <Link href="/coaching-studio/profile" className={styles.summaryAction}>
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
              <Link href="/coaching-studio/manage-wallet" className={styles.summaryAction}>
                Manage Wallet
              </Link>
            </article>

            <article className={styles.summaryCard}>
              <p className={styles.summaryTitle}>My activities</p>
              <div className={styles.summaryStats}>
                <p>Total: <strong>{activitySummary.total}</strong></p>
                <p>Assigned: <strong>{activitySummary.assigned}</strong></p>
                <p>Recommended: <strong>{activitySummary.recommended}</strong></p>
                <p>Completed: <strong>{activitySummary.completed}</strong></p>
              </div>
              <Link href="/coaching-studio/my-activities" className={styles.summaryAction}>
                Complete now
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
