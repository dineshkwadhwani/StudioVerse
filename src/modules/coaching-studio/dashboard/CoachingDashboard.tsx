"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { config } from "@/tenants/coaching-studio/config";
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
  { key: "manage-coaches", label: "Manage Coaches" },
  { key: "manage-cohort", label: "Manage Cohort" },
  { key: "manage-individuals", label: "Manage Individuals" },
  { key: "manage-tools", label: "Manage Tools" },
  { key: "manage-programs", label: "Manage Programs" },
  { key: "manage-events", label: "Manage Events" },
  { key: "assign-program", label: "Assign Program" },
  { key: "assign-tool", label: "Assign Tool" },
];

const PROFESSIONAL_MENU: MenuItem[] = [
  { key: "manage-cohort", label: "Manage Cohort" },
  { key: "manage-individuals", label: "Manage Individuals" },
  { key: "manage-tools", label: "Manage Tools" },
  { key: "manage-programs", label: "Manage Programs" },
  { key: "manage-events", label: "Manage Events" },
  { key: "assign-program", label: "Assign Program" },
  { key: "assign-tool", label: "Assign Tool" },
];

const INDIVIDUAL_MENU: MenuItem[] = [
  { key: "register-programs", label: "Register for Programs" },
  { key: "register-assessment", label: "Register for Assessment" },
  { key: "register-event", label: "Register for Event" },
  { key: "my-assignments", label: "My Assignments" },
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

export default function CoachingDashboard() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");
  const [activeKey, setActiveKey] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

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
    setName(storedName ?? "User");
  }, [router]);

  const menuItems = useMemo(() => getMenuItems(role), [role]);

  useEffect(() => {
    if (menuItems.length > 0 && !activeKey) {
      setActiveKey(menuItems[0].key);
    }
  }, [menuItems, activeKey]);

  const userInitials = useMemo(() => getInitials(name), [name]);
  const toolsLabel = config.landingContent?.displayLabels?.tools ?? "Assessment Centre";

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
                    onClick={() => {
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
          <h2 className={styles.sectionTitle}>
            {menuItems.find((m) => m.key === activeKey)?.label ?? "Dashboard"}
          </h2>
          <p className={styles.sectionHint}>
            This section is coming soon. Use the menu to navigate between actions.
          </p>
        </section>
      </div>
    </main>
  );
}
