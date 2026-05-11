"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import { getAssignmentsForAssigneeContext } from "@/services/assignment.service";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { UserProfileRecord } from "@/types/profile";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "../menuConfig";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import landingStyles from "../CoachingLandingPage.module.css";
import styles from "./CoachingDashboard.module.css";

type UserRole = StudioUserRole;

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

type DashboardProps = {
  tenantConfig?: TenantConfig;
};

export default function CoachingDashboard({ tenantConfig = coachingTenantConfig }: DashboardProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");

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
    });

    if (storedUid) {
      getWalletForUserContext([storedUid, storedProfileId ?? ""], tenantId)
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

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? "Assessment Centre";
  const brandSubtitle = "StudioVerse Platform";

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

          <ProfileDropdownMenu
            role={role}
            tenantId={tenantId}
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

      <nav className={styles.mobileTopNav}>
        <Link href={`${basePath}/tools`}>{toolsLabel}</Link>
        <Link href={`${basePath}/programs`}>Programs</Link>
        <Link href={`${basePath}/events`}>Events</Link>
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

            <article className={styles.summaryCard}>
              <p className={styles.summaryTitle}>My activities</p>
              <div className={styles.summaryStats}>
                <p>Total: <strong>{activitySummary.total}</strong></p>
                <p>Assigned: <strong>{activitySummary.assigned}</strong></p>
                <p>Recommended: <strong>{activitySummary.recommended}</strong></p>
                <p>Completed: <strong>{activitySummary.completed}</strong></p>
              </div>
              <Link href={role === "company" || role === "professional" ? `${basePath}/activities?tab=my-activities` : `${basePath}/my-activities`} className={styles.summaryAction}>
                Complete now
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
