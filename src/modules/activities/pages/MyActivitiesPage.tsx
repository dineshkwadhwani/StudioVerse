"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getAssignmentsForAssigneeContext, updateAssignmentStatus } from "@/services/assignment.service";
import { getUserProfile } from "@/services/profile.service";
import { getEvent } from "@/services/events.service";
import { getProgram } from "@/services/programs.service";
import type { AssignmentRecord, ActivityType, AssignmentStatus } from "@/types/assignment";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuGroups, getRoleMenuItems } from "../config/menuConfig";
import type { StudioUserRole } from "../config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import DetailModal, { type DetailItem } from "../components/DetailModal";
import styles from "./MyActivitiesPage.module.css";

type UserRole = StudioUserRole;

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
  if (!value) {
    return "-";
  }

  const maybeDate = "toDate" in value && typeof value.toDate === "function"
    ? value.toDate()
    : null;

  if (!maybeDate) {
    return "-";
  }

  return maybeDate.toLocaleString();
}

function formatStatusLabel(status: AssignmentStatus): string {
  if (status === "in_progress") return "In Progress";
  if (status === "recommended") return "Recommended";
  if (status === "registered") return "Registered";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Assigned";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveProgramVideoSource(rawUrl: string): { url: string; mode: "iframe" | "video" } {
  const normalized = rawUrl.trim();

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return { url: `https://www.youtube.com/embed/${videoId}?autoplay=1`, mode: "iframe" };
      }
    }

    if (host === "youtu.be") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      if (videoId) {
        return { url: `https://www.youtube.com/embed/${videoId}?autoplay=1`, mode: "iframe" };
      }
    }

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      if (videoId) {
        return { url: `https://player.vimeo.com/video/${videoId}?autoplay=1`, mode: "iframe" };
      }
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(parsed.pathname)) {
      return { url: normalized, mode: "video" };
    }

    return { url: normalized, mode: "iframe" };
  } catch {
    return { url: normalized, mode: "iframe" };
  }
}

function openProgramVideoPopup(videoUrl: string, activityTitle: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const popup = window.open(
    "",
    "program-video-launch",
    "popup=yes,width=1080,height=720,toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes"
  );

  if (!popup) {
    return false;
  }

  const source = resolveProgramVideoSource(videoUrl);
  const safeTitle = escapeHtml(activityTitle || "Program Video");
  const safeUrl = escapeHtml(source.url);
  const mediaMarkup = source.mode === "video"
    ? `<video src="${safeUrl}" controls autoplay playsinline style="width:100%;height:100%;background:#000"></video>`
    : `<iframe src="${safeUrl}" title="${safeTitle}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="no-referrer-when-downgrade" style="width:100%;height:100%;border:0;background:#000"></iframe>`;

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b1220; color: #fff; font-family: Arial, sans-serif; }
      .bar { height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid rgba(255,255,255,0.15); }
      .title { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .close { border: 0; background: #ffffff; color: #0b1220; width: 30px; height: 30px; border-radius: 999px; font-weight: 700; cursor: pointer; }
      .frame { height: calc(100% - 52px); }
    </style>
  </head>
  <body>
    <div class="bar">
      <div class="title">${safeTitle}</div>
      <button class="close" type="button" onclick="window.close()">x</button>
    </div>
    <div class="frame">${mediaMarkup}</div>
  </body>
</html>`);
  popup.document.close();
  popup.focus();
  return true;
}

type MyActivitiesPageProps = {
  tenantConfig?: TenantConfig;
};

export default function MyActivitiesPage({ tenantConfig = coachingTenantConfig }: MyActivitiesPageProps) {
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
  const [selectedFilter, setSelectedFilter] = useState<"all" | ActivityType>("all");
  const [currentUserId, setCurrentUserId] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [eventDetailItem, setEventDetailItem] = useState<DetailItem | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [eventActionMode, setEventActionMode] = useState<"default" | "recommend-only">("default");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
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
      setCurrentUserId(firebaseUser.uid);

      const storedUid = sessionStorage.getItem("cs_uid");
      const storedProfileId = sessionStorage.getItem("cs_profile_id");
      const storedPhone = sessionStorage.getItem("cs_phone");
      const storedEmail = sessionStorage.getItem("cs_email");

      try {
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        const assigneeIds = Array.from(
          new Set(
            [firebaseUser.uid, storedUid, storedProfileId, profile?.id, profile?.userId].filter(Boolean) as string[]
          )
        );

        const rows = await getAssignmentsForAssigneeContext({
          tenantId,
          assigneeIds,
          assigneePhone: profile?.phoneE164 || storedPhone || undefined,
          assigneeEmail: profile?.email || storedEmail || undefined,
        });

        setAssignments(rows);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load assignments.";
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
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";
  const detailUserType = role === "individual" ? "learner" : "coach";
  const filteredAssignments = useMemo(() => {
    if (selectedFilter === "all") {
      return assignments;
    }
    return assignments.filter((item) => item.activityType === selectedFilter);
  }, [assignments, selectedFilter]);

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

  function setAssignmentStatusLocal(assignmentId: string, status: AssignmentStatus): void {
    setAssignments((prev) =>
      prev.map((item) => (item.id === assignmentId ? { ...item, status } : item))
    );
  }

  async function handleUpdateStatus(item: AssignmentRecord, status: AssignmentStatus): Promise<void> {
    setActionBusyId(item.id);
    setError("");
    try {
      await updateAssignmentStatus({ assignmentId: item.id, status });
      setAssignmentStatusLocal(item.id, status);
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : "Failed to update activity status.";
      setError(message);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleLaunchAssessment(item: AssignmentRecord): Promise<void> {
    await handleUpdateStatus(item, "in_progress");
    router.push(`${basePath}/my-activities/assessment-launch/${item.id}`);
  }

  async function handleLaunchProgram(item: AssignmentRecord): Promise<void> {
    setActionBusyId(item.id);
    setError("");

    try {
      await updateAssignmentStatus({ assignmentId: item.id, status: "in_progress" });
      setAssignmentStatusLocal(item.id, "in_progress");

      const program = await getProgram(item.activityId);
      const videoUrl = program?.videoUrl?.trim();

      if (!videoUrl) {
        setError("Program video link is not configured for this activity.");
        return;
      }

      const opened = openProgramVideoPopup(videoUrl, item.activityTitle);
      if (!opened) {
        setError("Popup was blocked by the browser. Please allow popups for this site.");
      }
    } catch (launchError) {
      const message = launchError instanceof Error ? launchError.message : "Failed to launch program.";
      setError(message);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleOpenEventDetails(item: AssignmentRecord): Promise<void> {
    setActionBusyId(item.id);
    setError("");
    try {
      const event = await getEvent(item.activityId);
      if (!event) {
        setError("Event not found.");
        return;
      }

      const details: DetailItem = {
        id: event.id,
        type: "event",
        title: event.name,
        image: event.thumbnailUrl ?? "",
        description: event.shortDescription,
        details: event.details || event.longDescription,
        creditsRequired: event.creditsRequired,
        cost: event.cost,
        videoUrl: event.videoUrl ?? undefined,
        eventType: event.eventType,
        eventDate: event.eventDate ?? undefined,
        eventTime: event.eventTime ?? undefined,
        locationAddress: event.locationAddress,
        locationCity: event.locationCity,
      };

      setEventDetailItem(details);
      setEventActionMode(item.status === "registered" ? "recommend-only" : "default");
      setEventDetailOpen(true);
    } catch (detailsError) {
      const message = detailsError instanceof Error ? detailsError.message : "Failed to load event details.";
      setError(message);
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <main className={styles.page}>
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
                          <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>{item.label}</button>
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

      <div className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>My Activities</h1>
          <p className={styles.contextText}>
            {role === "company"
              ? "View all activities assigned to your company account, including programs, events, and assessments."
              : role === "professional"
              ? "View all activities assigned to you by your company, including programs, events, and assessments."
              : "View all activities assigned to you, including programs, events, and assessments."}
          </p>

          <div className={styles.radioRow}>
            {(["all", "assessment", "program", "event"] as const).map((type) => (
              <label key={type} className={styles.radioPill}>
                <input
                  type="radio"
                  name="assignment-type-filter"
                  checked={selectedFilter === type}
                  onChange={() => setSelectedFilter(type)}
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
            {selectedFilter !== "all"
              ? `Showing ${filteredAssignments.length} ${formatTypeLabel(selectedFilter).toLowerCase()} assignment(s).`
              : `Showing all ${filteredAssignments.length} assignment(s).`}
          </p>

          {busy ? <p className={styles.summary}>Loading assignments...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          {!busy && !error && filteredAssignments.length === 0 ? (
            <div className={styles.empty}>No assignments found for this filter.</div>
          ) : null}

          {!busy && !error && filteredAssignments.length > 0 ? (
            <div className={styles.list}>
              {filteredAssignments.map((item) => (
                <article key={item.id} className={styles.item}>
                  <h2 className={styles.itemTitle}>{item.activityTitle}</h2>
                  <p className={styles.itemMeta}>Type: {formatTypeLabel(item.activityType)}</p>
                  <p className={styles.itemMeta}>Assigned by: {item.assignerName || "-"}</p>
                  <p className={styles.itemMeta}>Credits: {item.creditsRequired}</p>
                  <p className={styles.itemMeta}>Status: {formatStatusLabel(item.status)}</p>
                  <p className={styles.itemMeta}>Assigned on: {formatDate(item.createdAt)}</p>

                  <div className={styles.actionRow}>
                    {item.activityType === "program" ? (
                      <>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => void handleLaunchProgram(item)}
                          disabled={actionBusyId === item.id}
                        >
                          Launch the program
                        </button>
                        {item.status !== "completed" ? (
                          <button
                            type="button"
                            className={styles.actionButton}
                            onClick={() => void handleUpdateStatus(item, "completed")}
                            disabled={actionBusyId === item.id}
                          >
                            Mark Complete
                          </button>
                        ) : null}
                      </>
                    ) : null}

                    {item.activityType === "assessment" ? (
                      <>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => void handleLaunchAssessment(item)}
                          disabled={actionBusyId === item.id}
                        >
                          Launch Assessment
                        </button>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => router.push(`${basePath}/my-activities/assessment-report/${item.id}`)}
                          disabled={item.status !== "completed"}
                        >
                          Open Report
                        </button>
                      </>
                    ) : null}

                    {item.activityType === "event" ? (
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => void handleOpenEventDetails(item)}
                        disabled={actionBusyId === item.id}
                      >
                        {item.status === "registered" ? "View Details" : "Open Details"}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <DetailModal
        item={eventDetailItem}
        isOpen={eventDetailOpen}
        onClose={() => setEventDetailOpen(false)}
        userType={detailUserType}
        isLoggedIn
        userId={currentUserId}
        userName={name}
        tenantId={tenantId}
        eventActionMode={eventActionMode}
      />
    </main>
  );
}
