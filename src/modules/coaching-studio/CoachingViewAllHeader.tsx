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
import { useTenantSearchConfig } from "@/hooks/useTenantSearchConfig";
import landingStyles from "./CoachingLandingPage.module.css";
import styles from "./CoachingViewAllHeader.module.css";
import { clearAuthSessionCookies } from "@/lib/auth/sessionCookies";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";

type ViewAllPage = "tools" | "programs" | "events";
type UserType = "coach" | "learner";
type UserRole = StudioUserRole;

type Props = {
  config: TenantConfig;
  currentPage: ViewAllPage;
  onSignInRegister: () => void;
};

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
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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
  const searchConfig = useTenantSearchConfig(tenantId);
  const roleMenuItems = useMemo(() => getRoleMenuItems(role, { basePath, searchConfig }), [basePath, role, searchConfig]);

  const navClass = (page: ViewAllPage): string => {
    return `${landingStyles.navLink} ${currentPage === page ? landingStyles.navLinkActive : ""}`;
  };

  async function handleSignOut() {
    await signOut(auth);
    sessionStorage.removeItem("cs_uid");
    sessionStorage.removeItem("cs_role");
    sessionStorage.removeItem("cs_name");
    clearAuthSessionCookies();
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
              <ProfileDropdownMenu
                role={role}
                tenantId={tenantId}
                name={name}
                basePath={basePath}
                roleLabels={{
                  company: config.roles.company,
                  professional: config.roles.professional,
                  individual: config.roles.individual,
                }}
              />
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

            <div className={styles.landingPageSection}>
              <p className={styles.landingPageSectionLabel}>Browse Activities</p>
              <Link href={`${basePath}/tools`} className={styles.landingPageLink} onClick={() => setIsMobileMenuOpen(false)}>{toolsLabel}</Link>
              <Link href={`${basePath}/programs`} className={styles.landingPageLink} onClick={() => setIsMobileMenuOpen(false)}>Programs</Link>
              <Link href={`${basePath}/events`} className={styles.landingPageLink} onClick={() => setIsMobileMenuOpen(false)}>Events</Link>
            </div>

            {isLoggedIn ? (
              <>
                <div className={styles.mobileMenuDivider} />
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
