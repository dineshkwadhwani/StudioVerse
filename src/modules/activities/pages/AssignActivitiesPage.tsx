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
import { getUserById, listManagedUsersForCompany } from "@/services/manage-users.service";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import AssignmentModal from "@/modules/activities/components/AssignmentModal";
import DetailModal from "@/modules/activities/components/DetailModal";
import type { DetailItem } from "@/modules/activities/components/DetailModal";
import shellStyles from "@/modules/resources/pages/ManageResourcesPage.module.css";
import styles from "./AssignActivitiesPage.module.css";

type ResourceTab = "programs" | "events" | "assessments";
type SupportedRole = "superadmin" | "company" | "professional";

type OwnershipContext = {
  role: SupportedRole;
  companyIds: Set<string>;
  professionalIds: Set<string>;
  coachIds: Set<string>;
};

type Props = {
  tenantId: string;
  config?: TenantConfig;
  role?: SupportedRole;
  actorUserId?: string;
  actorName?: string;
  showHeader?: boolean;
  embedded?: boolean;
};

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

function normalizeSessionRole(raw: string): SupportedRole | null {
  const value = raw.trim();
  if (value === "superadmin" || value === "company" || value === "professional") {
    return value;
  }
  if (value === "coach") {
    return "professional";
  }
  return null;
}

const TAB_CONTEXT: Record<ResourceTab, string> = {
  programs: "Assign published public programs to a learner or register immediately.",
  events: "Register for public events or recommend them to another learner.",
  assessments: "Let learners try public assessments now or assign assessments directly.",
};

function toIdCandidates(values: Array<string | null | undefined>): Set<string> {
  const next = new Set<string>();
  values.forEach((entry) => {
    const value = typeof entry === "string" ? entry.trim() : "";
    if (value) {
      next.add(value);
    }
  });
  return next;
}

function isInTenantScope(primaryTenantId: string | undefined, tenantIds: string[] | undefined, tenantId: string): boolean {
  const primary = (primaryTenantId ?? "").trim();
  if (primary === tenantId) {
    return true;
  }

  return Array.isArray(tenantIds) && tenantIds.includes(tenantId);
}

function isPublishedPublic(status: string | undefined, publicationState: string | undefined, visibility: string | undefined): boolean {
  const isPublished = (status ?? "") === "published" || (publicationState ?? "") === "published";
  return isPublished && (visibility ?? "") === "public";
}

function canAccessByOwnership(scope: string | undefined, ownerEntityId: string | null | undefined, createdBy: string | undefined, context: OwnershipContext): boolean {
  if (context.role === "superadmin") {
    return true;
  }

  const owner = (ownerEntityId ?? "").trim();
  const creator = (createdBy ?? "").trim();

  const isCompanyOwned = Boolean(owner) && context.companyIds.has(owner);
  const isProfessionalOwned = Boolean(owner) && context.professionalIds.has(owner);
  const isCoachOwned = Boolean(owner) && context.coachIds.has(owner);
  const isCreatedByCompany = Boolean(creator) && context.companyIds.has(creator);
  const isCreatedByProfessional = Boolean(creator) && context.professionalIds.has(creator);
  const isCreatedByCoach = Boolean(creator) && context.coachIds.has(creator);

  // Tenant-scoped resources with no specific owner are accessible to all tenant members.
  const isUnownedTenantResource = !owner && (scope === "tenant" || scope === "company");

  if (context.role === "company") {
    if (scope === "platform" || isUnownedTenantResource) {
      return true;
    }
    if (scope === "company" || scope === "tenant") {
      return isCompanyOwned || isCreatedByCompany;
    }
    if (scope === "professional") {
      return isCoachOwned || isCreatedByCoach;
    }
    return isCompanyOwned || isCoachOwned || isCreatedByCompany || isCreatedByCoach;
  }

  if (scope === "platform" || isUnownedTenantResource) {
    return true;
  }
  if (scope === "professional") {
    return isProfessionalOwned || isCreatedByProfessional;
  }
  if (scope === "company" || scope === "tenant") {
    return isCompanyOwned || isCreatedByCompany;
  }
  return isProfessionalOwned || isCompanyOwned || isCreatedByProfessional || isCreatedByCompany;
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

export default function AssignActivitiesPage({
  tenantId,
  config,
  role,
  actorUserId,
  actorName,
  showHeader = true,
  embedded = false,
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

  const [refreshSeed, setRefreshSeed] = useState(0);

  const sessionRole = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    const roleFromSession = sessionStorage.getItem("cs_role") ?? "";
    const legacyRole = sessionStorage.getItem("cs_user_type") ?? "";
    return normalizeSessionRole(roleFromSession) ?? normalizeSessionRole(legacyRole);
  }, []);

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

  const sessionUserName = useMemo(() => {
    if (typeof window === "undefined") {
      return "User";
    }
    return (
      sessionStorage.getItem("cs_name") ||
      sessionStorage.getItem("cs_user_name") ||
      "User"
    ).trim() || "User";
  }, []);

  const effectiveRole: SupportedRole | null = role ?? sessionRole;
  const effectiveUserId = (actorUserId ?? sessionUserId).trim();
  const effectiveUserName = (actorName ?? sessionUserName).trim() || "User";

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

    if (
      (effectiveRole !== "superadmin" && effectiveRole !== "company" && effectiveRole !== "professional")
      || !effectiveUserId
    ) {
      setError("Assign Activities is available for Super Admin, Company, and Coach roles.");
      setIsLoading(false);
      return;
    }

    const resolvedRole: SupportedRole = effectiveRole;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const context: OwnershipContext = {
          role: resolvedRole,
          companyIds: new Set<string>(),
          professionalIds: new Set<string>(),
          coachIds: new Set<string>(),
        };

        if (resolvedRole === "superadmin") {
          context.companyIds = new Set<string>();
          context.professionalIds = toIdCandidates([effectiveUserId]);
        } else {
          const userRecord = await getUserById(effectiveUserId);
          if (!userRecord) {
            throw new Error("Unable to resolve your profile.");
          }

          if (resolvedRole === "company") {
            context.companyIds = toIdCandidates([
              userRecord.id,
              userRecord.userId,
              userRecord.uid,
              effectiveUserId,
            ]);

            const managedUsers = await listManagedUsersForCompany({
              tenantId,
              companyId: userRecord.id,
            });
            const coachCandidates: string[] = [];
            managedUsers
              .filter((entry) => entry.userType === "professional")
              .forEach((entry) => {
                coachCandidates.push(entry.id, entry.userId, entry.uid || "");
              });
            context.coachIds = toIdCandidates(coachCandidates);
            context.professionalIds = toIdCandidates([effectiveUserId]);
          }

          if (resolvedRole === "professional") {
            context.professionalIds = toIdCandidates([
              userRecord.id,
              userRecord.userId,
              userRecord.uid,
              effectiveUserId,
            ]);
            context.companyIds = toIdCandidates([userRecord.associatedCompanyId]);
          }
        }

        const [programRows, eventRows, assessmentSnap] = await Promise.all([
          listPrograms(tenantId),
          listEvents(tenantId),
          getDocs(collection(db, "assessments")),
        ]);

        if (cancelled) {
          return;
        }

        const nextPrograms = programRows
          .filter((item) => isInTenantScope(item.tenantId, item.tenantIds, tenantId))
          .filter((item) => isPublishedPublic(item.status, item.publicationState, item.visibility))
          .filter((item) => canAccessByOwnership(item.ownershipScope, item.ownerEntityId, item.createdBy, context))
          .map(toProgramCard);

        const nextEvents = eventRows
          .filter((item) => isInTenantScope(item.tenantId, item.tenantIds, tenantId))
          .filter((item) => isPublishedPublic(item.status, item.publicationState, item.visibility))
          .filter((item) => canAccessByOwnership(item.ownershipScope, item.ownerEntityId, item.createdBy, context))
          .map(toEventCard);

        const assessmentRows = assessmentSnap.docs.map((row) => ({
          id: row.id,
          ...(row.data() as Omit<AssessmentRecord, "id">),
        }));

        const nextAssessments = assessmentRows
          .filter((item) => isInTenantScope(item.tenantId, item.tenantIds, tenantId))
          .filter((item) => isPublishedPublic(item.status, item.publicationState, item.visibility))
          .filter((item) => canAccessByOwnership(item.ownershipScope, item.ownerEntityId, item.createdBy, context))
          .map((item) => toAssessmentCard(item, heroImage));

        setPrograms(nextPrograms);
        setEvents(nextEvents);
        setAssessments(nextAssessments);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load assignable activities.");
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
    }, [tenantId, effectiveRole, effectiveUserId, refreshSeed]);

  const activityType: ActivityType = activeTab === "assessments" ? "assessment" : activeTab === "events" ? "event" : "program";

  const currentItems = activeTab === "programs" ? programs : activeTab === "events" ? events : assessments;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedSearchQuery) {
      return currentItems;
    }

    return currentItems.filter((item) => getSearchableText(item).includes(normalizedSearchQuery));
  }, [currentItems, normalizedSearchQuery]);

  return (
    <div className={embedded ? styles.embeddedRoot : shellStyles.wrapper}>
      {showHeader && config ? (
        <TenantViewAllHeader config={config} currentPage="programs" onSignInRegister={() => undefined} />
      ) : null}

      <div className={shellStyles.shell}>
        <section className={shellStyles.heroCard}>
          <h1 className={shellStyles.title}>Assign Activities</h1>
          <p className={shellStyles.subtitle}>{TAB_CONTEXT[activeTab]}</p>

          <div className={shellStyles.tabBar} role="tablist" aria-label="Assignable activity types">
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
            <label htmlFor="assign-activities-search" className={styles.searchLabel}>
              Search displayed {activeTab}
            </label>
            <div className={styles.searchControls}>
              <input
                id="assign-activities-search"
                type="search"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search by title, description, facilitator, city, and more...`}
                aria-label={`Search ${activeTab}`}
              />
              <button
                type="button"
                className={styles.searchButton}
                onClick={() => setSearchQuery((prev) => prev.trim())}
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
                    ? `No ${activeTab} matched "${searchQuery.trim()}".`
                    : "No published public items available for this scope."}
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
        assigneeId={effectiveUserId}
        assignerName={effectiveUserName}
        assignerRole={effectiveRole ?? undefined}
        tenantId={tenantId}
        actionType={modalAction}
        selfAssign={selfAssign}
        onSuccess={() => {
          setModalOpen(false);
          setRefreshSeed((prev) => prev + 1);
        }}
      />

      <DetailModal
        item={selectedDetailItem}
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        userType={effectiveRole === "professional" ? "coach" : "learner"}
        isLoggedIn={true}
        userId={effectiveUserId}
        userName={effectiveUserName}
        userRole={effectiveRole ?? undefined}
        tenantId={tenantId}
      />
    </div>
  );
}
