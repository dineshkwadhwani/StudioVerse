"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getAssignmentsForAssignerContext } from "@/services/assignment.service";
import { getUserProfile } from "@/services/profile.service";
import type { AssignmentRecord, ActivityType, AssignmentStatus } from "@/types/assignment";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuItems } from "./menuConfig";
import type { StudioUserRole } from "./menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "./CoachingLandingPage.module.css";
import dashboardStyles from "./dashboard/CoachingDashboard.module.css";
import styles from "./AssignedActivitiesPage.module.css";

type UserRole = StudioUserRole;

type AssignedActivitiesPageProps = {
  tenantConfig?: TenantConfig;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatTypeLabel(value: ActivityType): string {
  if (value === "assessment") return "Assessment";
  if (value === "program") return "Program";
  return "Event";
}

function formatDate(value: AssignmentRecord["createdAt"]): string {
  if (!value) return "-";
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return "-";
}

function formatStatusLabel(status: AssignmentStatus): string {
  if (status === "in_progress") return "In Progress";
  if (status === "recommended") return "Recommended";
  if (status === "registered") return "Registered";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Assigned";
}

function getStatusClassName(status: AssignmentStatus): string {
  if (status === "assigned") return `${styles.status} ${styles.statusAssigned}`;
  if (status === "in_progress" || status === "registered" || status === "recommended") {
    return `${styles.status} ${styles.statusInProgress}`;
  }
  if (status === "completed") return `${styles.status} ${styles.statusCompleted}`;
  return `${styles.status} ${styles.statusOther}`;
}

export default function AssignedActivitiesPage({ tenantConfig = coachingTenantConfig }: AssignedActivitiesPageProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;

  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | ActivityType>("all");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    // Only assignor roles should access this page.
    if (storedRoleRaw === "individual") {
      router.replace(`${basePath}/my-activities`);
      return;
    }

    setName(storedName ?? "User");
    setRole(storedRoleRaw);
    setBusy(true);
    setError("");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      try {
        const storedProfileId = sessionStorage.getItem("cs_profile_id") ?? "";
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          profileId: storedProfileId || undefined,
        });

        const assignerIds = Array.from(
          new Set([
            firebaseUser.uid,
            storedProfileId,
            profile?.id,
            profile?.userId,
          ].filter(Boolean) as string[])
        );

        const rows = await getAssignmentsForAssignerContext({ tenantId, assignerIds });
        setAssignments(rows);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load assigned activities.";
        setError(message);
      } finally {
        setBusy(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuItems = useMemo(() => getRoleMenuItems(role, { basePath }), [basePath, role]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";

  const filteredAssignments = useMemo(() => {
    if (selectedType === "all") {
      return assignments;
    }
    return assignments.filter((item) => item.activityType === selectedType);
  }, [assignments, selectedType]);

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

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

        <div className={dashboardStyles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
            <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
            <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
          </nav>

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
                  <p className={dashboardStyles.menuRole}>{getRoleLabel(role, {
                    company: tenantConfig.roles.company,
                    professional: tenantConfig.roles.professional,
                    individual: tenantConfig.roles.individual,
                  })}</p>
                </div>

                <p className={dashboardStyles.menuTitle}>Menu</p>
                {roleMenuItems.map((item) => (
                  <Link key={item.key} href={item.href} className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}

                <hr className={dashboardStyles.menuDivider} />
                <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>
                  Sign Out
                </button>
              </section>
            )}
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Assigned Activities</h1>
          <p className={styles.subtitle}>Track all activities you assigned to others, including status and report access.</p>

          <div className={styles.filterRow}>
            {(["all", "assessment", "program", "event"] as const).map((type) => (
              <label key={type} className={styles.filterPill}>
                <input
                  type="radio"
                  name="assigned-activity-type-filter"
                  checked={selectedType === type}
                  onChange={() => setSelectedType(type)}
                />
                {type === "all"
                  ? "All"
                  : type === "assessment"
                    ? "Assessments"
                    : type === "program"
                      ? "Programs"
                      : "Events"}
              </label>
            ))}
          </div>

          <p className={styles.summary}>
            {selectedType !== "all"
              ? `Showing ${filteredAssignments.length} ${formatTypeLabel(selectedType).toLowerCase()} assignment(s).`
              : `Showing all ${filteredAssignments.length} assignment(s).`}
          </p>

          {busy ? <p className={styles.summary}>Loading assigned activities...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          {!busy && !error && filteredAssignments.length === 0 ? (
            <div className={styles.empty}>No assigned activities found for this filter.</div>
          ) : null}

          {!busy && !error && filteredAssignments.length > 0 ? (
            <div className={styles.list}>
              {filteredAssignments.map((item) => (
                <article key={item.id} className={styles.item}>
                  <h2 className={styles.itemTitle}>{item.activityTitle}</h2>
                  <p className={styles.itemMeta}>Type: {formatTypeLabel(item.activityType)}</p>
                  <p className={styles.itemMeta}>Assigned to: {item.assigneeFullName || "-"}</p>
                  <p className={styles.itemMeta}>Assignee email: {item.assigneeEmail || "-"}</p>
                  <p className={styles.itemMeta}>Credits: {item.creditsRequired}</p>
                  <p className={styles.itemMeta}>Assigned on: {formatDate(item.createdAt)}</p>
                  <span className={getStatusClassName(item.status)}>{formatStatusLabel(item.status)}</span>

                  <div className={styles.actionRow}>
                    {item.activityType === "assessment" ? (
                      <Link href={`${basePath}/my-activities/assessment-report/${item.id}`} className={styles.linkButton}>
                        Open Report
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
