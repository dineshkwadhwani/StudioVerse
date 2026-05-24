"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { config as tenantConfig } from "@/tenants/coaching-studio/config";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import referralStyles from "@/modules/referrals/pages/ManageReferralsPage.module.css";
import PromoteCoachPage from "./PromoteCoachPage";

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
  const [loading, setLoading] = useState(true);

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
        setName(profile?.fullName ?? "User");
        setUid(firebaseUser.uid);
        setAvatarUrl(profile?.profilePhotoUrl ?? "");
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [router, basePath]);

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
        <div className={dashboardStyles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{tenantConfig.labels.assessment}</Link>
            <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
            <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
          </nav>
          <ProfileDropdownMenu
            role={role}
            tenantId={tenantConfig.id}
            name={name}
            basePath={basePath}
            roleLabels={{
              company: tenantConfig.roles.company,
              professional: tenantConfig.roles.professional,
              individual: tenantConfig.roles.individual,
            }}
          />
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
