"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { config as tenantConfig } from "@/tenants/coaching-studio/config";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
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

  const roleMenuGroups = getRoleMenuGroups(role, { basePath });

  async function handleSignOut() {
    await signOut(auth);
    router.replace(`${basePath}/auth`);
  }

  if (loading) return null;

  return (
    <div className={landingStyles.page}>
      <header className={landingStyles.header}>
        <div className={landingStyles.headerLeft}>
          <Image src="/tenants/coaching-studio/logo.png" alt={tenantConfig.name} width={120} height={36} />
        </div>
        <div className={dashboardStyles.profileArea} ref={menuRef}>
          <button
            type="button"
            className={dashboardStyles.profileButton}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Open user menu"
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} width={36} height={36} className={dashboardStyles.profileAvatar} />
            ) : (
              <span className={dashboardStyles.profileInitials}>{getInitials(name)}</span>
            )}
          </button>

          {menuOpen && (
            <div className={dashboardStyles.profileDropdown}>
              <div className={dashboardStyles.dropdownUserInfo}>
                <span className={dashboardStyles.dropdownName}>{name}</span>
                <span className={dashboardStyles.dropdownRole}>{getRoleLabel(role)}</span>
              </div>
              {roleMenuGroups.map((group) => (
                <div key={group.key} className={dashboardStyles.dropdownGroup}>
                  <span className={dashboardStyles.dropdownGroupLabel}>{group.label}</span>
                  {group.items.map((item) => {
                    if (item.type === "signout") {
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={dashboardStyles.dropdownItem}
                          onClick={() => void handleSignOut()}
                        >
                          {item.label}
                        </button>
                      );
                    }
                    return (
                      <a key={item.key} href={item.href} className={dashboardStyles.dropdownItem}>
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className={dashboardStyles.main}>
        <PromoteCoachPage
          tenantConfig={tenantConfig}
          currentUser={{ uid, name, avatarUrl: avatarUrl || undefined }}
        />
      </main>
    </div>
  );
}
