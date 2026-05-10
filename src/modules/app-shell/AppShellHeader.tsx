"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { useClickOutside } from "@/hooks/useClickOutside";
import { getRoleLabel, getRoleMenuGroups, searchMenuConfigFromTenant } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import type { TenantConfig } from "@/types/tenant";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type Props = {
  tenantConfig: TenantConfig;
  role: StudioUserRole | null;
  name: string;
};

export default function AppShellHeader({ tenantConfig, role, name }: Props) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuGroups = useMemo(
    () => getRoleMenuGroups(role, { basePath, searchConfig: searchMenuConfigFromTenant(tenantConfig) }),
    [basePath, role, tenantConfig],
  );
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

  return (
    <header className={landingStyles.header} style={{ position: "sticky", top: 0, zIndex: 20 }}>
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
          <span className={landingStyles.brandSubtitle}>StudioVerse Platform</span>
        </div>
      </Link>
      <nav className={landingStyles.desktopNav}>
        <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
        <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
        <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
      </nav>
      <div className={dashboardStyles.rightControls}>
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
                <p className={dashboardStyles.menuRole}>
                  {getRoleLabel(role, {
                    company: tenantConfig.roles.company,
                    professional: tenantConfig.roles.professional,
                    individual: tenantConfig.roles.individual,
                  })}
                </p>
              </div>
              {roleMenuGroups.map((group) => (
                <div key={group.key} className={dashboardStyles.menuGroup}>
                  <p className={dashboardStyles.menuGroupTitle}>{group.label}</p>
                  {group.items.map((item) => (
                    <Fragment key={item.key}>
                      {item.type === "signout" && <hr className={dashboardStyles.menuDivider} />}
                      {item.type === "signout" ? (
                        <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          className={dashboardStyles.menuLink}
                          onClick={() => setMenuOpen(false)}
                        >
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
  );
}

export type AuthedSession = {
  uid: string;
  profileId: string;
  role: StudioUserRole;
  name: string;
  email: string;
  associatedCompanyId?: string;
  associatedProfessionalId?: string;
};

export function isStudioUserRole(value: unknown): value is StudioUserRole {
  return value === "company" || value === "professional" || value === "individual";
}

// Convenience hook: gates on auth + resolves the session info needed by the
// authenticated app-shell pages. Returns `null` while loading, redirects to
// the tenant landing page when not signed in.
export function useAuthedSession(args: { tenantConfig: TenantConfig }): {
  session: AuthedSession | null;
  loading: boolean;
  error: string;
} {
  const { tenantConfig } = args;
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;

  const [session, setSession] = useState<AuthedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isStudioUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    const role: StudioUserRole = storedRoleRaw;
    const fallbackName = storedName ?? "User";

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const { getUserProfile } = await import("@/services/profile.service");
        const storedProfileId = sessionStorage.getItem("cs_profile_id");
        const storedPhone = sessionStorage.getItem("cs_phone");
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });
        if (!profile) throw new Error("Unable to resolve your profile.");

        const userDocId = sessionStorage.getItem("cs_uid") ?? firebaseUser.uid;
        const { getUserById } = await import("@/services/manage-users.service");
        const userRecord = await getUserById(userDocId).catch(() => null);

        setSession({
          uid: firebaseUser.uid,
          profileId: profile.id,
          role,
          name: profile.fullName || fallbackName,
          email: profile.email || firebaseUser.email || "",
          associatedCompanyId: userRecord?.associatedCompanyId ?? undefined,
          associatedProfessionalId: userRecord?.associatedProfessionalId ?? undefined,
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  return { session, loading, error };
}
