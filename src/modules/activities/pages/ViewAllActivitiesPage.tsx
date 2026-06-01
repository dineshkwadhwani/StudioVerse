"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import type { TenantConfig } from "@/types/tenant";
import type { ProgramRecord } from "@/types/program";
import type { EventRecord } from "@/types/event";
import type { AssessmentRecord } from "@/types/assessment";
import type { ActivityType } from "@/types/assignment";
import { auth, db } from "@/services/firebase";
import { listPrograms } from "@/services/programs.service";
import { listEvents } from "@/services/events.service";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import AssignmentModal from "@/modules/activities/components/AssignmentModal";
import DetailModal from "@/modules/activities/components/DetailModal";
import type { DetailItem } from "@/modules/activities/components/DetailModal";
import shellStyles from "@/modules/resources/pages/ManageResourcesPage.module.css";
import styles from "./AssignActivitiesPage.module.css";

type ResourceTab = "programs" | "events" | "assessments";

type ActivityCardItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  creditsRequired: number;
  cost?: number;
  details?: string;
  detailItem: DetailItem;
};

function getSearchableText(item: ActivityCardItem): string {
  const detail = item.detailItem;
  return [
    item.title,
    item.description,
    item.details,
    String(item.creditsRequired),
    typeof item.cost === "number" ? String(item.cost) : "",
    detail.title,
    detail.description,
    detail.details,
    detail.facilitatorName,
    detail.deliveryType,
    typeof detail.durationValue === "number" ? String(detail.durationValue) : "",
    detail.durationUnit,
    detail.eventType,
    detail.eventDate,
    detail.eventTime,
    detail.locationCity,
    detail.locationAddress,
    detail.assessmentContext,
    detail.assessmentBenefit,
    detail.assessmentType,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();
}

function toProgramCard(item: ProgramRecord): ActivityCardItem {
  return {
    id: item.id,
    title: item.name,
    description: item.shortDescription || item.longDescription || "Program",
    image: item.thumbnailUrl ?? "",
    creditsRequired: item.creditsRequired,
    details: item.details,
    detailItem: {
      id: item.id,
      type: "program",
      title: item.name,
      image: item.thumbnailUrl ?? "",
      description: item.shortDescription || item.longDescription || "Program",
      details: item.details,
      creditsRequired: item.creditsRequired,
      deliveryType: item.deliveryType,
      durationValue: item.durationValue,
      durationUnit: item.durationUnit,
      facilitatorName: item.facilitatorName ?? undefined,
      videoUrl: item.videoUrl ?? undefined,
    },
  };
}

function toEventCard(item: EventRecord): ActivityCardItem {
  return {
    id: item.id,
    title: item.name,
    description: item.shortDescription || item.longDescription || "Event",
    image: item.thumbnailUrl ?? "",
    creditsRequired: item.creditsRequired,
    cost: item.cost,
    details: item.details,
    detailItem: {
      id: item.id,
      type: "event",
      title: item.name,
      image: item.thumbnailUrl ?? "",
      description: item.shortDescription || item.longDescription || "Event",
      details: item.details,
      creditsRequired: item.creditsRequired,
      cost: item.cost,
      eventType: item.eventType,
      eventDate: item.eventDate ?? undefined,
      eventTime: item.eventTime ?? undefined,
      locationCity: item.locationCity,
      locationAddress: item.locationAddress,
    },
  };
}

function toAssessmentCard(item: AssessmentRecord, fallbackImage: string): ActivityCardItem {
  const imageUrl = item.assessmentImageUrl || fallbackImage;
  return {
    id: item.id,
    title: item.name,
    description: item.shortDescription || item.longDescription || "Assessment",
    image: imageUrl,
    creditsRequired: item.creditsRequired,
    detailItem: {
      id: item.id,
      type: "tool",
      title: item.name,
      image: imageUrl,
      description: item.shortDescription || item.longDescription || "Assessment",
      creditsRequired: item.creditsRequired,
      assessmentContext: item.assessmentContext,
      assessmentBenefit: item.assessmentBenefit,
      assessmentType: item.assessmentType,
    },
  };
}

function isPublishedPublic(status: string | undefined, publicationState: string | undefined, visibility: string | undefined): boolean {
  const isPublished = (status ?? "") === "published" || (publicationState ?? "") === "published";
  return isPublished && (visibility ?? "") === "public";
}

type Props = {
  tenantId: string;
  config?: TenantConfig;
  showHeader?: boolean;
};

const TAB_CONTEXT: Record<ResourceTab, string> = {
  programs: "Browse and register for programs.",
  events: "Browse and recommend events to others.",
  assessments: "Browse and try assessments.",
};

export default function ViewAllActivitiesPage({
  tenantId,
  config,
  showHeader = true,
}: Props) {
  const [activeTab, setActiveTab] = useState<ResourceTab>("programs");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [programs, setPrograms] = useState<ActivityCardItem[]>([]);
  const [events, setEvents] = useState<ActivityCardItem[]>([]);
  const [assessments, setAssessments] = useState<ActivityCardItem[]>([]);

  const [selectedItem, setSelectedItem] = useState<DetailItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"assign" | "recommend">("assign");
  const [selfAssign, setSelfAssign] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const sessionUserId = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return (
      auth.currentUser?.uid ||
      sessionStorage.getItem("cs_profile_id") ||
      ""
    ).trim();
  }, []);

  const heroImage = useMemo(() => {
    const tenantToken = (config?.id || tenantId || "coaching-studio").trim();
    return (
      config?.landingContent?.heroImages?.tools ||
      config?.landingContent?.heroImages?.programs ||
      config?.landingContent?.heroImages?.events ||
      `/tenants/${tenantToken}/hero2.png`
    );
  }, [config, tenantId]);

  useEffect(() => {
    if (!tenantId.trim()) {
      setError("Please select a tenant first.");
      setIsLoading(false);
      return;
    }

    if (!sessionUserId) {
      setError("You must be signed in to view activities.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const [programRows, eventRows, assessmentSnap] = await Promise.all([
          listPrograms(tenantId),
          listEvents(tenantId),
          getDocs(collection(db, "assessments")),
        ]);

        if (cancelled) {
          return;
        }

        // Filter public published activities
        const nextPrograms = programRows
          .filter((item) => item.tenantId === tenantId || (Array.isArray(item.tenantIds) && item.tenantIds.includes(tenantId)))
          .filter((item) => isPublishedPublic(item.status, item.publicationState, item.visibility))
          .map(toProgramCard);

        const nextEvents = eventRows
          .filter((item) => item.tenantId === tenantId || (Array.isArray(item.tenantIds) && item.tenantIds.includes(tenantId)))
          .filter((item) => isPublishedPublic(item.status, item.publicationState, item.visibility))
          .map(toEventCard);

        const assessmentRows = assessmentSnap.docs.map((row) => ({
          id: row.id,
          ...(row.data() as Omit<AssessmentRecord, "id">),
        }));

        const nextAssessments = assessmentRows
          .filter((item) => item.tenantId === tenantId || (Array.isArray(item.tenantIds) && item.tenantIds.includes(tenantId)))
          .filter((item) => isPublishedPublic(item.status, item.publicationState, item.visibility))
          .map((item) => toAssessmentCard(item, heroImage));

        setPrograms(nextPrograms);
        setEvents(nextEvents);
        setAssessments(nextAssessments);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load activities.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [tenantId, sessionUserId, heroImage]);

  const activityType: ActivityType = activeTab === "assessments" ? "assessment" : activeTab === "events" ? "event" : "program";

  const currentItems = activeTab === "programs" ? programs : activeTab === "events" ? events : assessments;

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedSearchQuery) {
      return currentItems;
    }

    return currentItems.filter((item) => getSearchableText(item).includes(normalizedSearchQuery));
  }, [currentItems, normalizedSearchQuery]);

  const handleActionClick = (item: DetailItem, action: "assign" | "recommend") => {
    setSelectedItem(item);
    setModalAction(action);
    setSelfAssign(true);
    setModalOpen(true);
  };

  return (
    <div className={shellStyles.wrapper}>
      {showHeader && config ? (
        <TenantViewAllHeader config={config} currentPage="programs" onSignInRegister={() => undefined} />
      ) : null}

      <div className={shellStyles.shell}>
        <section className={shellStyles.heroCard}>
          <h1 className={shellStyles.title}>View All Activities</h1>
          <p className={shellStyles.subtitle}>{TAB_CONTEXT[activeTab]}</p>

          <div className={shellStyles.tabBar} role="tablist" aria-label="Activity types">
            <button
              type="button"
              className={`${shellStyles.tab} ${activeTab === "programs" ? shellStyles.active : ""}`}
              onClick={() => setActiveTab("programs")}
            >
              Programs
            </button>
            <button
              type="button"
              className={`${shellStyles.tab} ${activeTab === "events" ? shellStyles.active : ""}`}
              onClick={() => setActiveTab("events")}
            >
              Events
            </button>
            <button
              type="button"
              className={`${shellStyles.tab} ${activeTab === "assessments" ? shellStyles.active : ""}`}
              onClick={() => setActiveTab("assessments")}
            >
              Assessments
            </button>
          </div>

          <div className={styles.searchRow}>
            <label htmlFor="view-all-activities-search" className={styles.searchLabel}>
              Search displayed {activeTab}
            </label>
            <div className={styles.searchControls}>
              <input
                id="view-all-activities-search"
                type="search"
                className={styles.searchInput}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setSearchQuery(searchInput);
                  }
                }}
                placeholder={`Search by title, description, facilitator, city, and more...`}
                aria-label={`Search ${activeTab}`}
              />
              <button
                type="button"
                className={styles.searchButton}
                onClick={() => setSearchQuery(searchInput)}
              >
                Search
              </button>
            </div>
          </div>
        </section>

        <section className={shellStyles.contentCard}>
          {isLoading ? <div className={styles.state}>Loading activities...</div> : null}
          {!isLoading && error ? <div className={styles.errorState}>{error}</div> : null}

          {!isLoading && !error ? (
            <div className={styles.grid}>
              {filteredItems.length === 0 ? (
                <div className={styles.state}>
                  {normalizedSearchQuery
                    ? `No ${activeTab} matched "${searchInput.trim()}".`
                    : "No published public items available."}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <article key={item.id} className={styles.card}>
                    {/* Image section */}
                    <div className={styles.cardImage}>
                      <img src={item.image} alt={item.title} />
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{item.title}</h3>
                      <p className={styles.cardDescription}>{item.description}</p>
                      <p className={styles.meta}>Credits: {item.creditsRequired}</p>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={() => {
                          setSelectedDetailItem(item.detailItem);
                          setDetailModalOpen(true);
                        }}
                      >
                        Find Out More
                      </button>

                      {activeTab === "programs" && (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleActionClick(item.detailItem, "assign")}
                        >
                          Register Now
                        </button>
                      )}

                      {activeTab === "events" && (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleActionClick(item.detailItem, "recommend")}
                        >
                          Recommend
                        </button>
                      )}

                      {activeTab === "assessments" && (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => handleActionClick(item.detailItem, "assign")}
                        >
                          Try Now
                        </button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </section>
      </div>

      <AssignmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        item={selectedItem}
        activityType={activityType}
        assigneeId={sessionUserId}
        assignerName={sessionUserId}
        assignerRole="individual"
        tenantId={tenantId}
        actionType={modalAction}
        selfAssign={selfAssign}
        onSuccess={() => {
          setModalOpen(false);
        }}
      />

      <DetailModal
        item={selectedDetailItem}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        userType="learner"
        isLoggedIn={true}
        userId={sessionUserId}
        tenantId={tenantId}
        userRole="individual"
      />
    </div>
  );
}
