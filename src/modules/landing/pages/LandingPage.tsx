"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import type { TenantConfig } from "@/types/tenant";
import type { EventType } from "@/types/event";
import type { AssessmentRecord } from "@/types/assessment";
import { listPrograms } from "@/services/programs.service";
import { listEvents, listLandingPageEvents } from "@/services/events.service";
import { auth, db } from "@/services/firebase";
import { getRoleLabel, getRoleMenuGroups, getRoleMenuItems } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import styles from "./LandingPage.module.css";
import headerStyles from "@/modules/landing/components/ViewAllHeader.module.css";
import { truncateWords, useCarousel, useItemsPerView } from "../hooks/useCarousel";
import LoginRegisterModal from "@/modules/auth/components/LoginRegisterModal";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";

type Props = {
  config: TenantConfig;
};

type SectionKey = "tools" | "programs" | "events";
type UserType = "coach" | "learner";
type UserRole = StudioUserRole;
type CarouselItem = {
  name: string;
  image: string;
  title: string;
  description: string;
  type: "program" | "tool" | "event";
  creditsRequired?: number;
  cost?: number;
  details?: string;
  videoUrl?: string;
  // Program-specific
  deliveryType?: string;
  durationValue?: number;
  durationUnit?: string;
  facilitatorName?: string;
  // Event-specific
  eventType?: EventType;
  eventDate?: string;
  eventTime?: string;
  locationCity?: string;
  locationAddress?: string;
  // Tool-specific
  assessmentContext?: string;
  assessmentBenefit?: string;
  assessmentType?: string;
};
type EventLandingItem = CarouselItem & { promoted: boolean };

function getInitialUserType(storageKey: string): UserType {
  if (typeof window === "undefined") {
    return "coach";
  }

  const stored = localStorage.getItem(storageKey);
  return stored === "coach" || stored === "learner" ? stored : "coach";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function repeatToCount(items: CarouselItem[], limit?: number): CarouselItem[] {
  if (typeof limit !== "number" || limit <= 0) {
    return items;
  }
  if (items.length === 0) {
    return [];
  }
  const target = Math.floor(limit);
  const result: CarouselItem[] = [];
  for (let i = 0; i < target; i += 1) {
    result.push(items[i % items.length]);
  }
  return result;
}

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isInTenantScope(
  record: Pick<AssessmentRecord, "tenantId" | "tenantIds">,
  tenantId: string,
): boolean {
  const target = normalizeTenantToken(tenantId);
  if (normalizeTenantToken(record.tenantId) === target) {
    return true;
  }

  return (record.tenantIds ?? []).some(
    (value) => normalizeTenantToken(value) === target,
  );
}

const DEFAULT_SECTION_INTROS = {
  tools: "Every tool supports stronger diagnostics, better reporting, and premium client journeys.",
  programs: "Each programme pairs a clear commercial use case with a polished learner experience.",
  events: "From roundtables to showcases, each event is designed for practical outcomes.",
};

function getSectionMeta(
  labels: { tools: string; programs: string; events: string },
  intros: { tools: string; programs: string; events: string },
  basePath: string,
): Record<SectionKey, { title: string; intro: string; viewAllPath: string; darkTile?: boolean; navLabel?: string }> {
  return {
    tools: {
      title: `${labels.tools} built to assess coachees, surface gaps, and accelerate growth.`,
      intro: intros.tools,
      viewAllPath: `${basePath}/tools`,
      navLabel: labels.tools,
    },
    programs: {
      title: `Signature ${labels.programs.toLowerCase()} designed for leadership growth and transformation.`,
      intro: intros.programs,
      viewAllPath: `${basePath}/programs`,
      darkTile: true,
      navLabel: labels.programs,
    },
    events: {
      title: `Curated ${labels.events.toLowerCase()} that connect leaders, coaches, and growth-focused teams.`,
      intro: intros.events,
      viewAllPath: `${basePath}/events`,
      navLabel: labels.events,
    },
  };
}

function CarouselSection({
  id,
  items,
  title,
  intro,
  viewAllPath,
  perView,
  onItemClick,
  darkTile,
}: {
  id: string;
  items: CarouselItem[];
  title: string;
  intro: string;
  viewAllPath: string;
  perView: number;
  onItemClick: (item: CarouselItem) => void;
  darkTile?: boolean;
}) {
  const { index, next, prev } = useCarousel(items.length, perView, 5000);
  const slideWidth = 100 / perView;



  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionIntro}>
            {intro} {" "}
            <Link href={viewAllPath} className={styles.viewAllInline}>
              View All
            </Link>
          </p>
        </div>
      </div>

      <div className={styles.carouselWrap}>
        <button type="button" className={styles.arrow} onClick={prev} aria-label={`Previous ${id}`}>
          &#8249;
        </button>
        <div className={styles.trackViewport}>
          <div className={styles.track} style={{ transform: `translateX(-${index * slideWidth}%)` }}>
            {items.map((item, itemIndex) => (
              <article key={`${item.name}-${itemIndex}`} className={styles.slide} style={{ flex: `0 0 ${slideWidth}%` }}>
                <div className={`${styles.tile} ${darkTile ? styles.tileDark : ""}`}>
                  {item.image ? (
                    <img src={item.image} alt={item.title} className={styles.tileImage} />
                  ) : null}
                  <div className={styles.tileBody}>
                    <h3 className={styles.tileTitle}>{item.title}</h3>
                    <p className={styles.tileCopy}>{truncateWords(item.description, 10)}</p>
                    <button type="button" className={styles.tileButton} onClick={() => onItemClick(item)}>
                      Find out more...
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <button type="button" className={styles.arrow} onClick={next} aria-label={`Next ${id}`}>
          &#8250;
        </button>
      </div>
    </section>
  );
}

function AssessLearnTransformTimeline({ userType }: { userType: UserType }) {
  const isCoach = userType === "coach";

  return (
    <section className={styles.altTimeline}>
      <h2 className={styles.altTimelineTitle}>
        {isCoach ? "Empower Through Coaching" : "Grow Through Learning"}
      </h2>
      <div className={styles.timelineContainer}>
        <div className={styles.timelineStep}>
          <div className={styles.timelineNumber}>1</div>
          <div className={styles.timelineContent}>
            <h3>Assess</h3>
            <p>
              {isCoach
                ? "Diagnose coaching needs and identify growth opportunities for your coachees with precision diagnostics."
                : "Assess your current capabilities and identify skill gaps compared to industry benchmarks."}
            </p>
          </div>
        </div>

        <div className={styles.timelineArrow} aria-hidden="true" />

        <div className={styles.timelineStep}>
          <div className={styles.timelineNumber}>2</div>
          <div className={styles.timelineContent}>
            <h3>Learn</h3>
            <p>
              {isCoach
                ? "Leverage best-in-class programmes and deliver your own curated content — using diagnostic tools to deepen coaching impact and drive measurable outcomes."
                : "Access tailored programmes and tools matched to your development priorities."}
            </p>
          </div>
        </div>

        <div className={styles.timelineArrow} aria-hidden="true" />

        <div className={styles.timelineStep}>
          <div className={styles.timelineNumber}>3</div>
          <div className={styles.timelineContent}>
            <h3>Transform</h3>
            <p>
              {isCoach
                ? "Create structured transformation plans for each coachee, track their progress milestone by milestone, and scale your coaching impact with confidence."
                : "Demonstrate growth, achieve goals, and unlock your leadership potential."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({ config }: Props) {
  const tenantId = config.id;
  const basePath = `/${tenantId}`;
  const userTypeStorageKey = `${tenantId}:userType`;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [userType, setUserType] = useState<UserType>(() => getInitialUserType(userTypeStorageKey));
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  useClickOutside(mobileMenuRef, () => setIsMobileMenuOpen(false), isMobileMenuOpen);
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole | null>(null);
  const [programItemsFromDb, setProgramItemsFromDb] = useState<CarouselItem[]>([]);
  const [toolItemsFromDb, setToolItemsFromDb] = useState<CarouselItem[]>([]);
  const [eventItemsFromDb, setEventItemsFromDb] = useState<EventLandingItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [dbLandingConfig, setDbLandingConfig] = useState<{
    sections?: { programs: boolean; tools: boolean; events: boolean };
    carouselItemLimits?: { programs: number; tools: number; events: number };
    displayLabels?: { programs?: string; tools?: string; events?: string };
    sectionIntros?: { programs?: string; tools?: string; events?: string };
  } | null>(null);
  const perView = useItemsPerView();

  useEffect(() => {
    async function fetchTenantLandingConfig() {
      try {
        const snap = await getDoc(doc(db, "tenants", config.id));
        if (snap.exists()) {
          const data = snap.data();
          if (data.landingConfig) {
            setDbLandingConfig(data.landingConfig as typeof dbLandingConfig);
          }
        }
      } catch {
        // Silently fall back to static config if Firestore fetch fails
      }
    }
    void fetchTenantLandingConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  const handleItemClick = (item: CarouselItem) => {
    const detailItem: DetailItem = {
      id: item.name,
      type: item.type,
      title: item.title,
      image: item.image,
      description: item.description,
      details: item.details,
      creditsRequired: item.creditsRequired ?? 0,
      cost: item.cost,
      deliveryType: item.deliveryType,
      durationValue: item.durationValue,
      durationUnit: item.durationUnit,
      facilitatorName: item.facilitatorName,
      videoUrl: item.videoUrl,
      eventType: item.eventType,
      eventDate: item.eventDate,
      eventTime: item.eventTime,
      locationCity: item.locationCity,
      locationAddress: item.locationAddress,
      assessmentContext: item.assessmentContext,
      assessmentBenefit: item.assessmentBenefit,
      assessmentType: item.assessmentType,
    };

    setSelectedDetailItem(detailItem);
    setIsDetailModalOpen(true);
  };

  // Save userType to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(userTypeStorageKey, userType);
    }
  }, [userType, userTypeStorageKey]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setIsLoggedIn(false);
        setMenuOpen(false);
        setName("User");
        setRole(null);
        setCurrentUserId(undefined);
        return;
      }

      const sessionUid = sessionStorage.getItem("cs_uid");
      const storedName = sessionStorage.getItem("cs_name");
      const storedRole = sessionStorage.getItem("cs_role");
      const resolvedRole = storedRole === "company" || storedRole === "professional" || storedRole === "individual"
        ? storedRole
        : null;
      const hasActiveSession = Boolean(storedRole || storedName || sessionUid);

      if (!hasActiveSession) {
        setIsLoggedIn(false);
        setMenuOpen(false);
        setName("User");
        setRole(null);
        setCurrentUserId(undefined);
        return;
      }

      setIsLoggedIn(true);
      setName(storedName?.trim() || firebaseUser.displayName || "User");
      setRole(resolvedRole);
      setCurrentUserId(firebaseUser.uid);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadToolsForLanding(): Promise<void> {
      try {
        const snapshot = await getDocs(collection(db, "assessments"));
        const allAssessments = snapshot.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<AssessmentRecord, "id">),
        }));

        const tenantAssessments = allAssessments.filter((item) =>
          isInTenantScope(item, config.id),
        );

        const promoted = tenantAssessments.filter((item) => Boolean((item as unknown as { promoted?: boolean }).promoted));
        const published = tenantAssessments.filter(
          (item) => item.publicationState === "published" || item.status === "active",
        );
        const source = promoted.length > 0 ? promoted : published;

        const mapped: CarouselItem[] = source
          .sort((a, b) => (b.updatedAt?.toDate().getTime() ?? 0) - (a.updatedAt?.toDate().getTime() ?? 0))
          .map((item) => ({
            name: item.id,
            type: "tool" as const,
            image: item.assessmentImageUrl || config.landingContent?.heroImages?.tools || "",
            title: item.name,
            description: item.shortDescription || item.longDescription || "",
            details: item.assessmentContext,
            creditsRequired: item.creditsRequired ?? 0,
            assessmentContext: item.assessmentContext,
            assessmentBenefit: item.assessmentBenefit,
            assessmentType: item.assessmentType,
          }));

        if (!cancelled) {
          setToolItemsFromDb(mapped);
        }
      } catch (error) {
        console.error("Failed to load assessments for landing page:", error);
        if (!cancelled) {
          setToolItemsFromDb([]);
        }
      }
    }

    async function loadProgramsForLanding(): Promise<void> {
      try {
        const allPrograms = await listPrograms();
        const targetTenant = normalizeTenantToken(config.id);

        const tenantPrograms = allPrograms.filter((program) => {
          const currentTenant = normalizeTenantToken(program.tenantId);
          return currentTenant === targetTenant;
        });

        // If at least one promoted program exists, show promoted only; otherwise
        // show tenant programs so the section is never blank while data is being curated.
        const promotedPrograms = tenantPrograms.filter((program) => program.promoted);
        const sourcePrograms = promotedPrograms.length > 0 ? promotedPrograms : tenantPrograms;

        const mappedPrograms: CarouselItem[] = sourcePrograms.map((program) => ({
          name: program.id,
          type: "program" as const,
          image: program.thumbnailUrl || config.landingContent?.heroImages?.programs || "",
          title: program.name,
          description: program.shortDescription || program.longDescription || "",
          details: program.details,
          creditsRequired: program.creditsRequired,
          deliveryType: program.deliveryType,
          durationValue: program.durationValue,
          durationUnit: program.durationUnit,
          facilitatorName: program.facilitatorName || undefined,
          videoUrl: program.videoUrl || undefined,
        }));

        if (!cancelled) {
          setProgramItemsFromDb(mappedPrograms);
        }
      } catch (error) {
        console.error("Failed to load programs for landing page:", error);
        if (!cancelled) {
          setProgramItemsFromDb([]);
        }
      }
    }

    void loadToolsForLanding();
    void loadProgramsForLanding();

    return () => {
      cancelled = true;
    };
  }, [
    config.id,
    config.landingContent?.heroImages?.tools,
    config.landingContent?.heroImages?.programs,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadEventsForLanding(): Promise<void> {
      try {
        let events = await listLandingPageEvents(config.id);

        // Fallback for tenant-id format mismatches (e.g. coaching-studio vs coachingstudio).
        if (events.length === 0) {
          const allEvents = await listEvents();
          const targetTenant = normalizeTenantToken(config.id);
          events = allEvents
            .filter((event) => normalizeTenantToken(event.tenantId) === targetTenant)
            .filter((event) => event.status === "published" && event.publicationState === "published")
            .sort((a, b) => {
              if (a.promoted !== b.promoted) {
                return a.promoted ? -1 : 1;
              }
              const aTime = a.eventDateTime ?? "";
              const bTime = b.eventDateTime ?? "";
              if (aTime < bTime) return -1;
              if (aTime > bTime) return 1;
              return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
            });
        }

        const mapped: EventLandingItem[] = events.map((event) => {
          // Parse event date and time from eventDateTime ISO string
          let eventDate: string | undefined;
          let eventTime: string | undefined;
          if (event.eventDateTime) {
            const dt = new Date(event.eventDateTime);
            eventDate = dt.toISOString().split("T")[0];
            eventTime = dt.toTimeString().slice(0, 5);
          }

          return {
            name: event.id,
            type: "event" as const,
            image: event.thumbnailUrl || config.landingContent?.heroImages?.events || "",
            title: event.name,
            description: event.shortDescription || event.longDescription || "",
            details: event.details,
            creditsRequired: event.creditsRequired ?? 0,
            cost: event.cost ?? 0,
            eventType: event.eventType,
            eventDate,
            eventTime,
            locationCity: event.locationCity,
            locationAddress: event.locationAddress,
            videoUrl: event.videoUrl || undefined,
            promoted: event.promoted,
          };
        });

        if (!cancelled) {
          setEventItemsFromDb(mapped);
        }
      } catch (error) {
        console.error("Failed to load events for landing page:", error);
        if (!cancelled) {
          setEventItemsFromDb([]);
        }
      }
    }

    void loadEventsForLanding();

    return () => {
      cancelled = true;
    };
  }, [config.id, config.landingContent?.heroImages?.events]);

  const landing = config.landingContent;
  // Landing config: DB values take precedence; fall back to static config
  const activeLandingConfig = dbLandingConfig ?? {};
  const activeSections = activeLandingConfig.sections ?? landing?.sections;
  const activeCarouselLimits = activeLandingConfig.carouselItemLimits ?? landing?.carouselItemLimits;
  const activeDisplayLabels = activeLandingConfig.displayLabels ?? landing?.displayLabels;
  const activeSectionIntros = activeLandingConfig.sectionIntros;
  const programsLimit = activeCarouselLimits?.programs;
  const toolsLimit = activeCarouselLimits?.tools;
  const eventsLimit = activeCarouselLimits?.events;

  const programs = useMemo(() => {
    return repeatToCount(programItemsFromDb, programsLimit);
  }, [programItemsFromDb, programsLimit]);

  const tools = useMemo(() => {
    return repeatToCount(toolItemsFromDb, toolsLimit);
  }, [toolItemsFromDb, toolsLimit]);

  const eventSource = useMemo<EventLandingItem[]>(() => {
    return eventItemsFromDb;
  }, [eventItemsFromDb]);

  const events = useMemo(() => {
    return repeatToCount(eventSource, eventsLimit);
  }, [eventSource, eventsLimit]);

  const sectionLabels = useMemo(() => ({
    tools: activeDisplayLabels?.tools ?? landing?.displayLabels?.tools ?? "Tools",
    programs: activeDisplayLabels?.programs ?? landing?.displayLabels?.programs ?? "Programs",
    events: activeDisplayLabels?.events ?? landing?.displayLabels?.events ?? "Events",
  }), [activeDisplayLabels?.events, activeDisplayLabels?.programs, activeDisplayLabels?.tools, landing?.displayLabels?.events, landing?.displayLabels?.programs, landing?.displayLabels?.tools]);
  const sectionIntros = useMemo(() => ({
    tools: activeSectionIntros?.tools ?? DEFAULT_SECTION_INTROS.tools,
    programs: activeSectionIntros?.programs ?? DEFAULT_SECTION_INTROS.programs,
    events: activeSectionIntros?.events ?? DEFAULT_SECTION_INTROS.events,
  }), [activeSectionIntros?.events, activeSectionIntros?.programs, activeSectionIntros?.tools]);
  const sectionMeta = useMemo(() => getSectionMeta(sectionLabels, sectionIntros, basePath), [basePath, sectionIntros, sectionLabels]);
  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuItems = useMemo(() => getRoleMenuItems(role, { basePath }), [basePath, role]);
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);
  const brandSubtitle = "StudioVerse Platform";
  const supportEmail = `contact@${config.domain.replace(/^www\./, "")}`;
  const effectiveUserType: UserType = isLoggedIn
    ? role === "individual"
      ? "learner"
      : "coach"
    : userType;

  const heroMessages = {
    coach: {
      label: `${config.roles.professional} Platform`,
      title: `Your Playground for ${config.roles.professional} Excellence`,
      copy: `${config.name} is your workspace for delivering premium growth journeys. Leverage best-in-class programs or deliver your own, use powerful diagnostic tools to assess your participants, and host curated events in one place to scale your impact.`,
    },
    learner: {
      label: "Learning Platform",
      title: "Unlock Your Leadership Potential",
      copy: `${config.name} connects you with expert-designed programs, proven assessment tools, and industry leaders. Assess your capabilities, close gaps, and transform into the leader you aspire to be.`,
    },
  };

  const currentHero = heroMessages[userType];

  const heroCards = useMemo(
    () => [
      {
        image: landing?.heroImages?.programs,
        label: "Programmes + cohorts",
        className: styles.heroCardOne,
      },
      {
        image: landing?.heroImages?.tools,
        label: "Tool-powered outcomes",
        className: styles.heroCardTwo,
      },
      {
        image: landing?.heroImages?.events,
        label: "Events that convert",
        className: styles.heroCardThree,
      },
    ],
    [landing?.heroImages?.events, landing?.heroImages?.programs, landing?.heroImages?.tools]
  );

  async function handleSignOut() {
    await signOut(auth);
    sessionStorage.removeItem("cs_uid");
    sessionStorage.removeItem("cs_role");
    sessionStorage.removeItem("cs_name");
    setMenuOpen(false);
    setIsMobileMenuOpen(false);
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href={basePath} className={styles.brand}>
          <Image src={config.theme.logo} width={76} height={40} alt={`${config.name} logo`} className={styles.logo} />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>{config.name}</span>
            <span className={styles.brandSubtitle}>{brandSubtitle}</span>
          </div>
        </Link>

        <nav className={styles.desktopNav}>
          <a href="#tools" className={styles.navLink}>
            {sectionMeta.tools.navLabel}
          </a>
          <a href="#programs" className={styles.navLink}>
            {sectionMeta.programs.navLabel}
          </a>
          <a href="#events" className={styles.navLink}>
            {sectionMeta.events.navLabel}
          </a>

          {!isLoggedIn ? (
            <button type="button" className={styles.authBtn} onClick={() => setIsAuthModalOpen(true)}>
              Sign In / Register
            </button>
          ) : (
            <div className={headerStyles.desktopAuthWrap}>
              <div className={headerStyles.profileArea} ref={menuRef}>
                <button type="button" className={headerStyles.profileButton} onClick={() => setMenuOpen((prev) => !prev)}>
                  {initials} ▾
                </button>

                {menuOpen ? (
                  <section className={headerStyles.menuPanel}>
                    <div className={headerStyles.menuUser}>
                      <p className={headerStyles.menuName}>{name}</p>
                      <p className={headerStyles.menuRole}>{getRoleLabel(role, {
                        company: config.roles.company,
                        professional: config.roles.professional,
                        individual: config.roles.individual,
                      })}</p>
                    </div>

                    {roleMenuGroups.map((group) => (
                      <div key={group.key} className={headerStyles.menuGroup}>
                        <p className={headerStyles.menuGroupTitle}>{group.label}</p>
                        {group.items.map((item) => (
                          <Link
                            key={item.key}
                            href={item.href}
                            className={headerStyles.menuLink}
                            onClick={() => setMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ))}
                    <hr className={headerStyles.menuDivider} />
                    <button type="button" className={headerStyles.menuItem} onClick={handleSignOut}>
                      Sign Out
                    </button>
                  </section>
                ) : null}
              </div>
            </div>
          )}
        </nav>

        <button
          type="button"
          className={styles.mobileMenuBtn}
          aria-label="Open navigation"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          &#9776;
        </button>
      </header>

      {isMobileMenuOpen && (
        <>
          <div className={styles.mobileMenuBackdrop} ref={mobileMenuRef} onClick={() => setIsMobileMenuOpen(false)} />
          <div className={styles.mobileMenu}>
            <a href="#tools" onClick={() => setIsMobileMenuOpen(false)}>
              {sectionMeta.tools.navLabel}
            </a>
            <a href="#programs" onClick={() => setIsMobileMenuOpen(false)}>
              {sectionMeta.programs.navLabel}
            </a>
            <a href="#events" onClick={() => setIsMobileMenuOpen(false)}>
              {sectionMeta.events.navLabel}
            </a>

            {isLoggedIn ? (
              <>
                <div className={headerStyles.mobileMenuUser}>
                  <p className={headerStyles.mobileMenuName}>{name}</p>
                  <p className={headerStyles.mobileMenuRole}>{getRoleLabel(role, {
                    company: config.roles.company,
                    professional: config.roles.professional,
                    individual: config.roles.individual,
                  })}</p>
                </div>
                {roleMenuItems.map((item) => (
                  <Link key={item.key} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                <button type="button" onClick={handleSignOut}>Sign Out</button>
              </>
            ) : (
              <button type="button" onClick={() => {
                setIsAuthModalOpen(true);
                setIsMobileMenuOpen(false);
              }}>
                Sign In / Register
              </button>
            )}
          </div>
        </>
      )}

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          {!isLoggedIn && (
            <div className={styles.userTypeSelector}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${userType === "coach" ? styles.toggleActive : ""}`}
                onClick={() => setUserType("coach")}
              >
                I am a {config.roles.professional}
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${userType === "learner" ? styles.toggleActive : ""}`}
                onClick={() => setUserType("learner")}
              >
                I am a {config.roles.individual}
              </button>
            </div>
          )}
          <span className={styles.heroLabel}>{currentHero.label}</span>
          <h1>{currentHero.title}</h1>
          <p className={styles.heroCopy}>{currentHero.copy}</p>
        </div>

        <div className={styles.heroVisual}>
          {heroCards.map((card) => (
            <div key={card.label} className={`${styles.heroCard} ${card.className}`}>
              {card.image ? <img src={card.image} alt={card.label} /> : null}
              <span className={styles.heroBadge}>{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      <AssessLearnTransformTimeline userType={userType} />

      {activeSections?.tools !== false && tools.length > 0 && (
        <CarouselSection
          id="tools"
          items={tools}
          title={sectionMeta.tools.title}
          intro={sectionMeta.tools.intro}
          viewAllPath={sectionMeta.tools.viewAllPath}
          perView={perView}
          darkTile={sectionMeta.tools.darkTile}
          onItemClick={handleItemClick}
        />
      )}

      {activeSections?.programs !== false && programs.length > 0 && (
        <CarouselSection
          id="programs"
          items={programs}
          title={sectionMeta.programs.title}
          intro={sectionMeta.programs.intro}
          viewAllPath={sectionMeta.programs.viewAllPath}
          perView={perView}
          darkTile={sectionMeta.programs.darkTile}
          onItemClick={handleItemClick}
        />
      )}

      {activeSections?.events !== false && events.length > 0 && (
        <CarouselSection
          id="events"
          items={events}
          title={sectionMeta.events.title}
          intro={sectionMeta.events.intro}
          viewAllPath={sectionMeta.events.viewAllPath}
          perView={perView}
          onItemClick={handleItemClick}
        />
      )}

      <footer className={styles.footer}>
        <p className={styles.footerLine}>
          <span>&copy; {new Date().getFullYear()} {config.name}. All rights reserved.</span>
          <Link href={`${basePath}/privacy-policy`}>Privacy Policy</Link>
          <a href="tel:+919604188725">+91 9604188725</a>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
      </footer>

      <LoginRegisterModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <DetailModal
        item={selectedDetailItem}
        isOpen={isDetailModalOpen}
        userType={effectiveUserType}
        isLoggedIn={isLoggedIn}
        onAuthRequired={() => setIsAuthModalOpen(true)}
        userId={currentUserId}
        userName={name}
        userRole={role ?? undefined}
        tenantId={config.id}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailItem(null);
        }}
      />
    </main>
  );
}
