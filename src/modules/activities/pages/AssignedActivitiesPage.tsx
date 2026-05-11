"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getAssignmentsForAssignerContext } from "@/services/assignment.service";
import { listProfessionalsForCoachDropdown } from "@/services/manage-users.service";
import { getUserProfile } from "@/services/profile.service";
import type { AssignmentRecord, ActivityType, AssignmentStatus } from "@/types/assignment";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "../config/menuConfig";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./AssignedActivitiesPage.module.css";

type UserRole = StudioUserRole;

type AssignedActivitiesPageProps = {
  tenantConfig?: TenantConfig;
  showHeader?: boolean;
  embedded?: boolean;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
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

type CoachFilterOption = {
  coachId: string;
  coachName: string;
  assignerIds: string[];
};

export default function AssignedActivitiesPage({
  tenantConfig = coachingTenantConfig,
  showHeader = true,
  embedded = false,
}: AssignedActivitiesPageProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;

  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | ActivityType>("all");
  const [coachFilters, setCoachFilters] = useState<CoachFilterOption[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("all");

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
    setCoachFilters([]);
    setSelectedCoachId("all");

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

        let assignerIds: string[] = [];

        if (storedRoleRaw === "company") {
          const companyId = profile?.id || storedProfileId || firebaseUser.uid;
          if (!companyId) {
            setAssignments([]);
            setCoachFilters([]);
            return;
          }

          const coaches = await listProfessionalsForCoachDropdown({ tenantId, companyId });
          const coachOptions: CoachFilterOption[] = coaches.map((coach) => ({
            coachId: coach.id,
            coachName: coach.fullName || coach.firstName || coach.email || "Coach",
            assignerIds: Array.from(new Set([coach.id, coach.userId].filter(Boolean))),
          }));

          setCoachFilters(coachOptions);
          assignerIds = Array.from(new Set(coachOptions.flatMap((coach) => coach.assignerIds)));
        } else {
          assignerIds = Array.from(
            new Set([
              firebaseUser.uid,
              storedProfileId,
              profile?.id,
              profile?.userId,
            ].filter(Boolean) as string[])
          );
        }

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

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";

  const coachNameByAssignerId = useMemo(() => {
    const mapping = new Map<string, string>();
    coachFilters.forEach((coach) => {
      coach.assignerIds.forEach((assignerId) => {
        mapping.set(assignerId, coach.coachName);
      });
    });
    return mapping;
  }, [coachFilters]);

  const filteredAssignments = useMemo(() => {
    const selectedCoach = coachFilters.find((coach) => coach.coachId === selectedCoachId);

    return assignments.filter((item) => {
      const typeMatches = selectedType === "all" || item.activityType === selectedType;
      const coachMatches =
        role !== "company" ||
        selectedCoachId === "all" ||
        (selectedCoach ? selectedCoach.assignerIds.includes(item.assignerId) : false);

      return typeMatches && coachMatches;
    });
  }, [assignments, coachFilters, role, selectedCoachId, selectedType]);

  return (
    <main className={`${styles.page} ${embedded ? styles.embeddedRoot : ""}`}>
      {showHeader ? (
      <header className={styles.toolbar}>
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
      ) : null}

      <div className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Assigned Activities</h1>
          <p className={styles.contextText}>
            {role === "company"
              ? "Track all activities your company has assigned to professionals and individuals, including status and reports."
              : "Track all activities you have assigned to individuals, including completion status and reports."}
          </p>

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

          {role === "company" && coachFilters.length > 0 ? (
            <div className={styles.coachFilterRow}>
              <label htmlFor="assigned-coach-filter" className={styles.coachFilterLabel}>
                Coach
              </label>
              <select
                id="assigned-coach-filter"
                className={styles.coachFilterSelect}
                value={selectedCoachId}
                onChange={(event) => setSelectedCoachId(event.target.value)}
              >
                <option value="all">All Coaches</option>
                {coachFilters.map((coach) => (
                  <option key={coach.coachId} value={coach.coachId}>
                    {coach.coachName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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
                  <p className={styles.itemMeta}>
                    Assigned by: {coachNameByAssignerId.get(item.assignerId) || item.assignerName || "-"}
                  </p>
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
