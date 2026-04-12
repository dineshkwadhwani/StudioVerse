"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import { config } from "@/tenants/coaching-studio/config";
import type { UserProfileRecord } from "@/types/profile";
import landingStyles from "../CoachingLandingPage.module.css";
import styles from "./CoachingDashboard.module.css";

type UserRole = "company" | "professional" | "individual";

type MenuItem = {
  key: string;
  label: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

const COMPANY_MENU: MenuItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "update-profile", label: "Update Profile" },
  { key: "manage-users", label: "Manage Users" },
  { key: "manage-programs", label: "Manage Programs" },
  { key: "manage-events", label: "Manage Events" },
  { key: "manage-wallet", label: "Manage Wallet" },
  { key: "manage-cohort", label: "Manage Cohort" },
  { key: "manage-individual", label: "Manage Individual" },
  { key: "assign-activity", label: "Assign Activity" },
  { key: "my-activities", label: "My activities" },
];

const PROFESSIONAL_MENU: MenuItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "update-profile", label: "Update Profile" },
  { key: "manage-users", label: "Manage Users" },
  { key: "manage-programs", label: "Manage Programs" },
  { key: "manage-events", label: "Manage Events" },
  { key: "manage-wallet", label: "Manage Wallet" },
  { key: "manage-cohort", label: "Manage Cohort" },
  { key: "manage-individual", label: "Manage Individual" },
  { key: "assign-activity", label: "Assign Activity" },
  { key: "my-activities", label: "My activities" },
];

const INDIVIDUAL_MENU: MenuItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "update-profile", label: "Update Profile" },
  { key: "manage-wallet", label: "Manage Wallet" },
  { key: "assign-activity", label: "Assign Activity" },
  { key: "my-activities", label: "My activities" },
];

function getMenuItems(role: UserRole): MenuItem[] {
  if (role === "company") return COMPANY_MENU;
  if (role === "professional") return PROFESSIONAL_MENU;
  return INDIVIDUAL_MENU;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getRoleLabel(role: UserRole): string {
  if (role === "company") return "Coaching Company";
  if (role === "professional") return "Coach";
  return "Learner";
}

function isAssignmentAction(key: string): boolean {
  return key === "assign-activity";
}

export default function CoachingDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");
  const [activeKey, setActiveKey] = useState<string>(() => getMenuItems("individual")[0]?.key ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [wallet, setWallet] = useState<{ issued: number; utilized: number; available: number } | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");
    const storedUid = sessionStorage.getItem("cs_uid");
    const storedProfileId = sessionStorage.getItem("cs_profile_id") ?? undefined;
    const storedPhone = sessionStorage.getItem("cs_phone") ?? undefined;

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
      const items = getMenuItems(storedRoleRaw);
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
        })
        .catch(() => {
          setProfileStatus("error");
        });
    } else {
      router.replace("/coaching-studio/auth");
    }
  }, [router]);

  const menuItems = useMemo(() => getMenuItems(role), [role]);

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

          <div className={styles.profileArea}>
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
                      if (item.key === "update-profile") {
                        setMenuOpen(false);
                        router.push("/coaching-studio/profile");
                        return;
                      }
                      if (item.key === "my-activities") {
                        setMenuOpen(false);
                        router.push("/coaching-studio/my-activities");
                        return;
                      }
                      if (item.key === "manage-wallet") {
                        setMenuOpen(false);
                        router.push("/coaching-studio/manage-wallet");
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
          {profileIncomplete ? (
            <article className={styles.alertCard}>
              <div>
                <p className={styles.alertEyebrow}>Profile completion required</p>
                <h2 className={styles.alertTitle}>Complete your mandatory profile details before assignments can be enabled.</h2>
                <p className={styles.alertCopy}>
                  City is still required, and adding more profile detail improves assessments and future referrals.
                </p>
              </div>
              <Link href="/coaching-studio/profile" className={styles.alertAction}>
                Update Profile
              </Link>
            </article>
          ) : null}

          {profileStatus === "ready" && profile ? (
            <article className={styles.profileSummaryCard}>
              <p className={styles.walletTitle}>Profile Status</p>
              <div className={styles.walletStats}>
                <p>Completion: <strong>{profile.profileCompletionPercent}%</strong></p>
                <p>Mandatory: <strong>{profile.mandatoryProfileCompleted ? "Complete" : "Incomplete"}</strong></p>
                <p>Assignments: <strong>{profile.assignmentEligible ? "Enabled" : "Blocked"}</strong></p>
              </div>
            </article>
          ) : null}

          {wallet ? (
            <article className={styles.walletCard}>
              <p className={styles.walletTitle}>My Wallet</p>
              <div className={styles.walletStats}>
                <p>Available: <strong>{wallet.available}</strong></p>
                <p>Utilized: <strong>{wallet.utilized}</strong></p>
                <p>Total Issued: <strong>{wallet.issued}</strong></p>
              </div>
            </article>
          ) : null}

          <h2 className={styles.sectionTitle}>
            {menuItems.find((m) => m.key === activeKey)?.label ?? "Dashboard"}
          </h2>
          <p className={styles.sectionHint}>
            {role === "individual" && profileIncomplete && isAssignmentAction(activeKey)
              ? "Complete your mandatory profile details before registering for assignments."
              : "This section is coming soon. Use the menu to navigate between actions."}
          </p>
        </section>
      </div>
    </main>
  );
}
