"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import { getScopedEvents, canUserEditEvent, type UserScopeContext } from "@/services/events-scoped.service";
import type { EventRecord } from "@/types/event";
import {
  EVENT_TYPE_LABELS,
  EVENT_VISIBILITY_LABELS,
  type EventType,
} from "@/types/event";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import styles from "@/modules/programs/pages/ManageProgramsPage.module.css";

type Props = {
  config: TenantConfig;
  showHeader?: boolean;
};

type UserRole = "company" | "professional" | "individual" | "superadmin";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "company" ||
    value === "professional" ||
    value === "individual" ||
    value === "superadmin"
  );
}

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isInTenantScope(
  record: Pick<EventRecord, "tenantId" | "tenantIds">,
  tenantId: string
): boolean {
  const target = normalizeTenantToken(tenantId);
  if (normalizeTenantToken(record.tenantId) === target) {
    return true;
  }

  return (record.tenantIds ?? []).some((value) => normalizeTenantToken(value) === target);
}

export default function ManageEventsPage({ config, showHeader = true }: Props) {
  const router = useRouter();
  const tenantId = config.id;
  const basePath = `/${tenantId}`;

  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  // Check auth and role
  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    if (storedRoleRaw === "individual") {
      // Individuals can't manage events
      router.replace(`${basePath}/events`);
      return;
    }

    setUserRole(storedRoleRaw);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      setCurrentUserId(firebaseUser.uid);
    });

    return () => unsubscribe();
  }, [basePath, router]);

  // Load events when user is determined
  useEffect(() => {
    if (!currentUserId || !userRole || (userRole !== "superadmin" && userRole !== "company" && userRole !== "professional")) {
      return;
    }

    const resolvedUserId = currentUserId;
    const resolvedRole = userRole;

    async function loadScopedEvents() {
      setIsLoading(true);
      setError("");

      try {
        const scopeContext: UserScopeContext = {
          userId: resolvedUserId,
          role: resolvedRole,
          tenantId,
        };

        const scopedEvents = await getScopedEvents(scopeContext);

        // Filter by tenant scope
        const nextEvents = scopedEvents
          .filter((item) => isInTenantScope(item, tenantId))
          .sort((a, b) => {
            return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
          });

        setEvents(nextEvents);
      } catch (err) {
        console.error("Failed to load events:", err);
        setError("Failed to load events");
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadScopedEvents();
  }, [currentUserId, userRole, tenantId]);

  const handleItemClick = (item: EventRecord) => {
    const detailItem: DetailItem = {
      id: item.id,
      type: "event",
      title: item.name,
      image: item.thumbnailUrl || "",
      description: item.shortDescription || item.longDescription || "",
      details: item.details,
      creditsRequired: item.creditsRequired ?? 0,
      eventType: item.eventType,
      videoUrl: item.videoUrl || undefined,
    };

    setSelectedDetailItem(detailItem);
    setIsDetailModalOpen(true);
  };

  const visibleEvents = showHeader
    ? selectedEventType === "all"
      ? events
      : events.filter((item) => item.eventType === selectedEventType)
    : events;

  const eventTypeOptions = Array.from(new Set(events.map((item) => item.eventType)))
    .sort((a, b) =>
      EVENT_TYPE_LABELS[a as EventType].localeCompare(
        EVENT_TYPE_LABELS[b as EventType]
      )
    );

  const heroImage =
    config.landingContent?.heroImages?.events ||
    config.landingContent?.heroImages?.programs ||
    config.landingContent?.heroImages?.tools ||
    "/tenants/coaching-studio/hero1.png";

  return (
    <main className={styles.page}>
      {showHeader ? (
        <TenantViewAllHeader
          config={config}
          currentPage="events"
          onSignInRegister={() => {}}
        />
      ) : null}

      <section className={styles.content}>
        <article className={styles.manageCard}>
          <h2 className={styles.sectionHeading}>Manage Events</h2>
          <p className={styles.sectionSubtitle}>
            Create tenant-wide Events for StudioVerse tenants. Publish to make them visible; promote to elevate them on the landing page.
          </p>

          <div className={styles.controlCard}>
            <div className={styles.topControlsRow}>
              {showHeader ? (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel} htmlFor="events-type-filter">
                    Event Type
                  </label>
                  <select
                    id="events-type-filter"
                    className={styles.filterSelect}
                    value={selectedEventType}
                    onChange={(event) => setSelectedEventType(event.target.value)}
                  >
                    <option value="all">All Types</option>
                    {eventTypeOptions.map((eventType) => (
                      <option key={eventType} value={eventType}>
                        {EVENT_TYPE_LABELS[eventType as EventType]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => {
                    // TODO: Navigate to create event page
                    alert("Create event feature coming soon");
                  }}
                >
                  Add Event
                </button>
              </div>
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {isLoading ? <p className={styles.emptyCard}>Loading events...</p> : null}
          {!isLoading && events.length === 0 ? (
            <p className={styles.emptyCard}>No events found for your roles and scope.</p>
          ) : null}
          {!isLoading && showHeader && events.length > 0 && visibleEvents.length === 0 ? (
            <p className={styles.emptyCard}>No events found for the selected event type.</p>
          ) : null}

          {!isLoading && visibleEvents.length > 0 ? (
            <div className={styles.grid}>
            {visibleEvents.map((item) => {
              const canEdit = userRole && currentUserId ? canUserEditEvent(item, { userId: currentUserId, role: userRole as any, tenantId }) : false;

              return (
                <article key={item.id} className={landingStyles.tile}>
                  <div className={styles.cardImageWrap}>
                    <img
                      className={styles.cardImage}
                      src={item.thumbnailUrl || heroImage}
                      alt={item.name}
                      loading="lazy"
                    />
                  </div>
                  <div className={landingStyles.tileBody}>
                    <h3 className={landingStyles.tileTitle}>{item.name}</h3>
                    <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
                    <p className={styles.meta}>Type: {EVENT_TYPE_LABELS[item.eventType]}</p>
                    <p className={styles.meta}>
                      Date: {item.eventDate || "TBD"}
                    </p>
                    <p className={styles.meta}>Status: {item.status}</p>
                    <p className={styles.meta}>Visibility: {EVENT_VISIBILITY_LABELS[item.visibility]}</p>
                    <div className={styles.buttonGroup}>
                      {userRole === "superadmin" ? (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => router.push("/admin")}
                        >
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => handleItemClick(item)}
                          >
                            Try
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => handleItemClick(item)}
                          >
                            Assign
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() => router.push("/admin")}
                            >
                              Edit
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          ) : null}
        </article>
      </section>

      <DetailModal
        item={selectedDetailItem}
        isOpen={isDetailModalOpen}
        userType="coach"
        isLoggedIn={!!currentUserId}
        onAuthRequired={() => {}}
        userId={currentUserId}
        userRole={userRole ?? undefined}
        tenantId={config.id}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailItem(null);
        }}
      />
    </main>
  );
}
