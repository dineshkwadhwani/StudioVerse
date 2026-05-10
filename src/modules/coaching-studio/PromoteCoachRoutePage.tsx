"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { config as tenantConfig } from "@/tenants/coaching-studio/config";
import { getRoleLabel, getRoleMenuGroups, searchMenuConfigFromTenant } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import referralStyles from "@/modules/referrals/pages/ManageReferralsPage.module.css";
import PromoteCoachPage from "./PromoteCoachPage";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isRole(v: unknown): v is StudioUserRole {
  return v === "company" || v === "professional" || v === "individual";
}

export default function PromoteCoachRoutePage() {
  const router = useRouter();
  const basePath = `/${tenantConfig.id}`;

  const [role, setRole] = useState<StudioUserRole>("professional");
  const [name, setName] = useState("User");
  const [uid, setUid] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(`${basePath}/auth`);
        return;
      }
      try {
        const profile = await getUserProfile({ userId: firebaseUser.uid });
        const userRole = isRole(profile?.userType) ? profile.userType : "professional";
        if (userRole !== "professional") {
          router.replace(`${basePath}/dashboard`);
          return;
        }
        setRole(userRole);
        setName(profile?.name ?? "User");
        setUid(firebaseUser.uid);
        setAvatarUrl(profile?.profilePhotoUrl ?? "");
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [router, basePath]);

  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath, searchConfig: searchMenuConfigFromTenant(tenantConfig) }), [role, basePath]);
  const initials = useMemo(() => getInitials(name), [name]);

  async function handleSignOut() {
    await signOut(auth);
    router.replace(`${basePath}/auth`);
  }

  if (loading) return null;

  return (
    <main className={referralStyles.page}>
      <header className={referralStyles.toolbar}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={tenantConfig.theme.logo} alt={`${tenantConfig.name} logo`} width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>StudioVerse Platform</span>
          </div>
        </Link>
        <nav className={landingStyles.desktopNav}>
          <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{tenantConfig.labels.assessment}</Link>
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
                          <button type="button" className={dashboardStyles.menuItem} onClick={() => void handleSignOut()}>{item.label}</button>
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

      <div className={referralStyles.shell}>
        <PromoteCoachPage
          tenantConfig={tenantConfig}
          currentUser={{ uid, name, avatarUrl: avatarUrl || undefined }}
        />
      </div>
    </main>
  );
}
