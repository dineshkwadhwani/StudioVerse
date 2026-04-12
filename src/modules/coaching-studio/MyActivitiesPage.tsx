"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getAssignmentsForAssigneeContext } from "@/services/assignment.service";
import { getUserProfile } from "@/services/profile.service";
import type { AssignmentRecord, ActivityType } from "@/types/assignment";
import { config } from "@/tenants/coaching-studio/config";
import landingStyles from "./CoachingLandingPage.module.css";
import dashboardStyles from "./dashboard/CoachingDashboard.module.css";
import styles from "./MyActivitiesPage.module.css";

type UserRole = "company" | "professional" | "individual";

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getRoleLabel(role: UserRole): string {
  if (role === "company") return "Coaching Company";
  if (role === "professional") return "Coach";
  return "Learner";
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

export default function MyActivitiesPage() {
  const router = useRouter();
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | ActivityType>("all");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace("/coaching-studio");
      return;
    }

    setName(storedName ?? "User");
    setRole(storedRoleRaw);

    setBusy(true);
    setError("");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/coaching-studio");
        return;
      }

      const storedUid = sessionStorage.getItem("cs_uid");
      const storedProfileId = sessionStorage.getItem("cs_profile_id");
      const storedPhone = sessionStorage.getItem("cs_phone");
      const storedEmail = sessionStorage.getItem("cs_email");

      try {
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId: "coaching-studio",
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        const assigneeIds = Array.from(
          new Set(
            [firebaseUser.uid, storedUid, storedProfileId, profile?.id, profile?.userId].filter(Boolean) as string[]
          )
        );

        const rows = await getAssignmentsForAssigneeContext({
          tenantId: "coaching-studio",
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
  }, [router]);

  const initials = useMemo(() => getInitials(name), [name]);
  const filteredAssignments = useMemo(() => {
    if (selectedFilter === "all") {
      return assignments;
    }
    return assignments.filter((item) => item.activityType === selectedFilter);
  }, [assignments, selectedFilter]);

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace("/coaching-studio");
  }

  return (
    <main className={styles.page}>
      <header className={landingStyles.nav}>
        <Link href="/coaching-studio" className={landingStyles.brand}>
          <Image
            src={config.theme.logo}
            alt="Coaching Studio logo"
            width={76}
            height={40}
            className={landingStyles.logo}
          />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>Coaching Studio</span>
            <span className={landingStyles.brandSubtitle}>Coaching | Growth | Potential</span>
          </div>
        </Link>

        <div className={dashboardStyles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href="/coaching-studio/tools" className={landingStyles.navLink}>Assessment Centre</Link>
            <Link href="/coaching-studio/programs" className={landingStyles.navLink}>Programs</Link>
            <Link href="/coaching-studio/events" className={landingStyles.navLink}>Events</Link>
          </nav>

          <div className={dashboardStyles.profileArea}>
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
                  <p className={dashboardStyles.menuRole}>{getRoleLabel(role)}</p>
                </div>

                <p className={dashboardStyles.menuTitle}>Menu</p>
                <Link href="/coaching-studio/dashboard" className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/coaching-studio/profile" className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                  Update Profile
                </Link>
                <Link href="/coaching-studio/my-activities" className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                  My activities
                </Link>

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
          <h1 className={styles.title}>My activities</h1>
          <p className={styles.subtitle}>All assignments made to your account are shown below.</p>

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
                  <p className={styles.itemMeta}>Status: {item.status}</p>
                  <p className={styles.itemMeta}>Assigned on: {formatDate(item.createdAt)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
