"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuItems } from "./menuConfig";
import type { StudioUserRole } from "./menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "./CoachingLandingPage.module.css";
import styles from "./CoachingViewAllHeader.module.css";

type ViewAllPage = "tools" | "programs" | "events";
type UserType = "coach" | "learner";
type UserRole = StudioUserRole;

type Props = {
  config: TenantConfig;
  currentPage: ViewAllPage;
  onSignInRegister: () => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function CoachingViewAllHeader({ config, currentPage, onSignInRegister }: Props) {
  const tenantId = config.id;
  const basePath = `/${tenantId}`;
  const userTypeStorageKey = `${tenantId}:userType`;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userType, setUserType] = useState<UserType>(() => {
    if (typeof window === "undefined") {
      return "coach";
    }

    const stored = localStorage.getItem(userTypeStorageKey);
    return stored === "learner" ? "learner" : "coach";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  useClickOutside(mobileMenuRef, () => setIsMobileMenuOpen(false), isMobileMenuOpen);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    localStorage.setItem(userTypeStorageKey, userType);
  }, [userType, userTypeStorageKey]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setIsLoggedIn(false);
        setMenuOpen(false);
        setName("User");
        setRole(null);
        return;
      }

      const sessionUid = sessionStorage.getItem("cs_uid");
      const storedName = sessionStorage.getItem("cs_name");
      const storedRole = sessionStorage.getItem("cs_role");
      const resolvedRole = storedRole === "company" || storedRole === "professional" || storedRole === "individual"
        ? storedRole
        : null;

      const hasActiveSession = Boolean(storedRole || storedName || sessionUid);

      if (!hasActiveSession) {
        setIsLoggedIn(false);
        setMenuOpen(false);
        setName("User");
        setRole(null);
        return;
      }

      setIsLoggedIn(true);
      setName(storedName?.trim() || firebaseUser.displayName || "User");
      setRole(resolvedRole);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toolsLabel = config.landingContent?.displayLabels?.tools ?? "Tools";
  const brandSubtitle = "StudioVerse Platform";
  const professionalLabel = config.roles.professional;
  const individualLabel = config.roles.individual;
  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuItems = useMemo(() => getRoleMenuItems(role, { basePath }), [basePath, role]);

  const navClass = (page: ViewAllPage): string => {
    return `${landingStyles.navLink} ${currentPage === page ? landingStyles.navLinkActive : ""}`;
  };

  async function handleSignOut() {
    await signOut(auth);
    sessionStorage.removeItem("cs_uid");
    sessionStorage.removeItem("cs_role");
    sessionStorage.removeItem("cs_name");
    setMenuOpen(false);
    setIsMobileMenuOpen(false);
  }

  return (
    <>
      <header className={landingStyles.nav}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={config.theme.logo} width={76} height={40} alt={`${config.name} logo`} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{config.name}</span>
            <span className={landingStyles.brandSubtitle}>{brandSubtitle}</span>
          </div>
        </Link>

        {!isLoggedIn ? (
          <div className={landingStyles.userToggle}>
            <button
              type="button"
              className={`${landingStyles.toggleBtn} ${userType === "coach" ? landingStyles.toggleActive : ""}`}
              onClick={() => setUserType("coach")}
            >
              I am a {professionalLabel}
            </button>
            <button
              type="button"
              className={`${landingStyles.toggleBtn} ${userType === "learner" ? landingStyles.toggleActive : ""}`}
              onClick={() => setUserType("learner")}
            >
              I am a {individualLabel}
            </button>
          </div>
        ) : null}

        <nav className={landingStyles.desktopNav}>
          <Link href={`${basePath}/tools`} className={navClass("tools")}>
            {toolsLabel}
          </Link>
          <Link href={`${basePath}/programs`} className={navClass("programs")}>Programs</Link>
          <Link href={`${basePath}/events`} className={navClass("events")}>Events</Link>

          {!isLoggedIn ? (
            <button type="button" className={landingStyles.authBtn} onClick={onSignInRegister}>
              Sign In / Register
            </button>
          ) : (
            <div className={styles.desktopAuthWrap}>
              <div className={styles.profileArea} ref={menuRef}>
                <button type="button" className={styles.profileButton} onClick={() => setMenuOpen((prev) => !prev)}>
                  {initials} ▾
                </button>

                {menuOpen ? (
                  <section className={styles.menuPanel}>
                    <div className={styles.menuUser}>
                      <p className={styles.menuName}>{name}</p>
                      <p className={styles.menuRole}>{getRoleLabel(role, {
                        company: config.roles.company,
                        professional: config.roles.professional,
                        individual: config.roles.individual,
                      })}</p>
                    </div>

                    <p className={styles.menuTitle}>Menu</p>
                    {roleMenuItems.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        className={styles.menuLink}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <hr className={styles.menuDivider} />
                    <button type="button" className={styles.menuItem} onClick={handleSignOut}>
                      Sign Out
                    </button>
                  </section>
                ) : null}
              </div>
            </div>
          )}
        </nav>

        <button
          type="button"
          className={landingStyles.mobileMenuBtn}
          aria-label="Open navigation"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          &#9776;
        </button>
      </header>

      {isMobileMenuOpen && (
        <>
          <div className={landingStyles.mobileMenuBackdrop} ref={mobileMenuRef} onClick={() => setIsMobileMenuOpen(false)} />
          <div className={landingStyles.mobileMenu}>
            {!isLoggedIn ? (
              <div className={landingStyles.mobileUserToggle}>
                <button
                  type="button"
                  className={`${landingStyles.toggleBtn} ${landingStyles.toggleSmall} ${userType === "coach" ? landingStyles.toggleActive : ""}`}
                  onClick={() => setUserType("coach")}
                >
                  I am a {professionalLabel}
                </button>
                <button
                  type="button"
                  className={`${landingStyles.toggleBtn} ${landingStyles.toggleSmall} ${userType === "learner" ? landingStyles.toggleActive : ""}`}
                  onClick={() => setUserType("learner")}
                >
                  I am a {individualLabel}
                </button>
              </div>
            ) : null}

            <Link href={`${basePath}/tools`} onClick={() => setIsMobileMenuOpen(false)}>{toolsLabel}</Link>
            <Link href={`${basePath}/programs`} onClick={() => setIsMobileMenuOpen(false)}>Programs</Link>
            <Link href={`${basePath}/events`} onClick={() => setIsMobileMenuOpen(false)}>Events</Link>

            {isLoggedIn ? (
              <>
                <div className={styles.mobileMenuUser}>
                  <p className={styles.mobileMenuName}>{name}</p>
                  <p className={styles.mobileMenuRole}>{getRoleLabel(role, {
                    company: config.roles.company,
                    professional: config.roles.professional,
                    individual: config.roles.individual,
                  })}</p>
                </div>
                {roleMenuItems.map((item) => (
                  <Link key={item.key} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                <button type="button" onClick={handleSignOut}>Sign Out</button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onSignInRegister();
                  setIsMobileMenuOpen(false);
                }}
              >
                Sign In / Register
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
