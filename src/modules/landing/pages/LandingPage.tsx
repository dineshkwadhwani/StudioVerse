"use client";

import Image from "next/image";
import Link from "next/link";
import { Manrope, Fraunces } from "next/font/google";
import { useMemo, useRef, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import type { TenantConfig } from "@/types/tenant";
import type { EventType } from "@/types/event";
import type { AssessmentRecord } from "@/types/assessment";
import { listPrograms } from "@/services/programs.service";
import { listEvents, listLandingPageEvents } from "@/services/events.service";
import { auth, db } from "@/services/firebase";
import { getRoleLabel, getRoleMenuItems } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useTenantSearchConfig } from "@/hooks/useTenantSearchConfig";
import { useTenantReferralsConfig } from "@/hooks/useTenantReferralsConfig";
import styles from "./LandingPage.module.css";
import headerStyles from "@/modules/landing/components/ViewAllHeader.module.css";
import { truncateWords, useCarousel, useItemsPerView } from "../hooks/useCarousel";
import LoginRegisterModal from "@/modules/auth/components/LoginRegisterModal";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";

const landingSans = Manrope({
  subsets: ["latin"],
  variable: "--landing-font-sans",
  display: "swap",
});

const landingSerif = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal"],
  variable: "--landing-font-serif",
  display: "swap",
});

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
  tools: "Validated instruments to diagnose capability, surface blind spots, and inform every conversation.",
  programs: "Cohort-based programmes built with practitioners and grounded in published research.",
  events: "Live roundtables, masterclasses, and showcases hosted by senior practitioners.",
};

function getSectionMeta(
  labels: { tools: string; programs: string; events: string },
  intros: { tools: string; programs: string; events: string },
  basePath: string,
): Record<SectionKey, { title: string; intro: string; viewAllPath: string; darkTile?: boolean; navLabel?: string }> {
  return {
    tools: {
      title: labels.tools,
      intro: intros.tools,
      viewAllPath: `${basePath}/tools`,
      navLabel: labels.tools,
    },
    programs: {
      title: labels.programs,
      intro: intros.programs,
      viewAllPath: `${basePath}/programs`,
      darkTile: true,
      navLabel: labels.programs,
    },
    events: {
      title: labels.events,
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
  eyebrow,
}: {
  id: string;
  items: CarouselItem[];
  title: string;
  intro: string;
  viewAllPath: string;
  perView: number;
  onItemClick: (item: CarouselItem) => void;
  darkTile?: boolean;
  eyebrow?: string;
}) {
  const { index, next, prev } = useCarousel(items.length, perView, 5000);
  const slideWidth = 100 / perView;



  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderText}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionIntro}>{intro}</p>
        </div>
        <Link href={viewAllPath} className={styles.viewAllInline}>
          View all <span aria-hidden="true">&rarr;</span>
        </Link>
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
    <section id="method" className={styles.altTimeline}>
      <div className={styles.altTimelineInner}>
        <div className={styles.altTimelineHeader}>
          <span className={styles.eyebrow}>The Method</span>
          <h2 className={styles.altTimelineTitle}>
            {isCoach ? "A disciplined practice, end to end." : "A disciplined path, end to end."}
          </h2>
        </div>
        <ol className={styles.timelineContainer}>
          <li className={styles.timelineStep}>
            <span className={styles.timelineNumber}>01</span>
            <div className={styles.timelineContent}>
              <h3>Assess</h3>
              <p>
                {isCoach
                  ? "Diagnose capability with validated instruments — translate signal into a coaching plan."
                  : "Benchmark your capabilities against role-relevant standards and identify priority gaps."}
              </p>
            </div>
          </li>
          <li className={styles.timelineStep}>
            <span className={styles.timelineNumber}>02</span>
            <div className={styles.timelineContent}>
              <h3>Learn</h3>
              <p>
                {isCoach
                  ? "Curate programmes, deliver content, and run sessions with structure and measurable outcomes."
                  : "Move through programmes and live sessions built for working executives, not classrooms."}
              </p>
            </div>
          </li>
          <li className={styles.timelineStep}>
            <span className={styles.timelineNumber}>03</span>
            <div className={styles.timelineContent}>
              <h3>Transform</h3>
              <p>
                {isCoach
                  ? "Track outcomes per engagement, evidence your impact, and grow a defensible practice."
                  : "Demonstrate growth with portable evidence — credible to your sponsors and your future self."}
              </p>
            </div>
          </li>
        </ol>
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
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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
  const searchConfig = useTenantSearchConfig(tenantId);
  const referralsConfig = useTenantReferralsConfig(tenantId);

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

        const publicAssessments = tenantAssessments.filter((item) => item.visibility !== "private");
        const promoted = publicAssessments.filter((item) => Boolean((item as unknown as { promoted?: boolean }).promoted));
        const published = tenantAssessments.filter(
          (item) =>
            item.visibility !== "private" &&
            (item.publicationState === "published" || item.status === "published"),
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
          return currentTenant === targetTenant && program.visibility !== "private";
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
            .filter((event) => event.visibility !== "private")
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
  const roleMenuItems = useMemo(
    () => getRoleMenuItems(role, { basePath, searchConfig, referralsConfig }),
    [basePath, role, searchConfig, referralsConfig]
  );
  const brandSubtitle = "StudioVerse Platform";
  const supportEmail = `contact@${config.domain.replace(/^www\./, "")}`;
  const effectiveUserType: UserType = isLoggedIn
    ? role === "individual"
      ? "learner"
      : "coach"
    : userType;

  const heroMessages = {
    coach: {
      label: "Practitioner View",
      title: `Build a practice you can stand behind.`,
      copy: `Deliver best-in-class programmes, assess your clients with validated diagnostics, host signature events, and track outcomes — all in one practitioner-grade workspace.`,
      primaryCta: "Start your practice",
      secondaryCta: "How it works",
    },
    learner: {
      label: "Learner View",
      title: `Grow into the leader your career is waiting for.`,
      copy: `Benchmark your strengths with validated assessments, follow curated programmes, and join live sessions led by senior practitioners — a credible, evidence-led path forward.`,
      primaryCta: "Begin your journey",
      secondaryCta: "How it works",
    },
  };

  const currentHero = heroMessages[userType];

  const heroSlides = useMemo(() => {
    const slides: { image: string; label: string }[] = [];
    if (landing?.heroImages?.programs) {
      slides.push({ image: landing.heroImages.programs, label: sectionLabels.programs });
    }
    if (landing?.heroImages?.tools) {
      slides.push({ image: landing.heroImages.tools, label: sectionLabels.tools });
    }
    if (landing?.heroImages?.events) {
      slides.push({ image: landing.heroImages.events, label: sectionLabels.events });
    }
    return slides;
  }, [landing?.heroImages?.programs, landing?.heroImages?.tools, landing?.heroImages?.events, sectionLabels.programs, sectionLabels.tools, sectionLabels.events]);

  const [heroSlideIndex, setHeroSlideIndex] = useState(0);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const id = window.setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [heroSlides.length]);

  async function handleSignOut() {
    await signOut(auth);
    sessionStorage.removeItem("cs_uid");
    sessionStorage.removeItem("cs_role");
    sessionStorage.removeItem("cs_name");
    setIsMobileMenuOpen(false);
  }

  return (
    <main className={`${styles.page} ${landingSans.variable} ${landingSerif.variable}`}>
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
              <ProfileDropdownMenu
                role={role}
                tenantId={tenantId}
                name={name}
                basePath={basePath}
                roleLabels={{
                  company: config.roles.company,
                  professional: config.roles.professional,
                  individual: config.roles.individual,
                }}
              />
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
          <div className={styles.mobileMenuBackdrop} onClick={() => setIsMobileMenuOpen(false)} />
          <div className={styles.mobileMenu} ref={mobileMenuRef}>
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
                  item.type === "signout" ? (
                    <button key={item.key} type="button" onClick={handleSignOut}>{item.label}</button>
                  ) : (
                    <Link key={item.key} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                      {item.label}
                    </Link>
                  )
                ))}
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
            <>
              <span className={styles.userTypePrompt}>Choose your view</span>
              <div className={styles.userTypeSelector} role="tablist" aria-label="Audience">
                <button
                  type="button"
                  role="tab"
                  aria-selected={userType === "coach"}
                  className={`${styles.toggleBtn} ${userType === "coach" ? styles.toggleActive : ""}`}
                  onClick={() => setUserType("coach")}
                >
                  I am a {config.roles.professional}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={userType === "learner"}
                  className={`${styles.toggleBtn} ${userType === "learner" ? styles.toggleActive : ""}`}
                  onClick={() => setUserType("learner")}
                >
                  I am a {config.roles.individual}
                </button>
              </div>
            </>
          )}
          <span className={styles.heroLabel}>{currentHero.label}</span>
          <h1>{currentHero.title}</h1>
          <p className={styles.heroCopy}>{currentHero.copy}</p>
          <div className={styles.heroCtaRow}>
            {!isLoggedIn && (
              <button
                type="button"
                className={styles.primaryCta}
                onClick={() => setIsAuthModalOpen(true)}
              >
                {currentHero.primaryCta}
              </button>
            )}
            <a href="#method" className={styles.secondaryCta}>
              {currentHero.secondaryCta}
            </a>
          </div>
          <p className={styles.heroTrust}>
            Built with senior practitioners — designed for serious leadership work.
          </p>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.heroVisualPlate} aria-hidden="true" />
          <div className={styles.heroCarousel}>
            {heroSlides.map((slide, idx) => (
              <img
                key={slide.image}
                src={slide.image}
                alt=""
                className={`${styles.heroImage} ${idx === heroSlideIndex ? styles.heroImageActive : ""}`}
                aria-hidden={idx !== heroSlideIndex}
              />
            ))}
            {heroSlides[heroSlideIndex] ? (
              <span key={heroSlides[heroSlideIndex].label} className={styles.heroSlideLabel}>
                {heroSlides[heroSlideIndex].label}
              </span>
            ) : null}
            {heroSlides.length > 1 ? (
              <div className={styles.heroDots} role="tablist" aria-label="Hero slides">
                {heroSlides.map((slide, idx) => (
                  <button
                    key={slide.image}
                    type="button"
                    role="tab"
                    aria-selected={idx === heroSlideIndex}
                    aria-label={`Show ${slide.label}`}
                    className={`${styles.heroDot} ${idx === heroSlideIndex ? styles.heroDotActive : ""}`}
                    onClick={() => setHeroSlideIndex(idx)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className={styles.statsStrip} aria-label="At a glance">
        <div className={styles.statsStripInner}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>12,000+</span>
            <span className={styles.statLabel}>Assessments delivered</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>200+</span>
            <span className={styles.statLabel}>Certified practitioners</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>50+</span>
            <span className={styles.statLabel}>Enterprise engagements</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>30 yrs</span>
            <span className={styles.statLabel}>Practitioner research</span>
          </div>
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
          eyebrow="Diagnostic Tools"
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
          eyebrow="Curated Learning"
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
          eyebrow="Live Sessions"
        />
      )}

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image src={config.theme.logo} width={56} height={56} alt={`${config.name} logo`} className={styles.footerLogo} />
            <p className={styles.footerTagline}>
              A practitioner-grade platform for serious leadership work.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.footerColTitle}>Platform</h4>
            <Link href={`${basePath}/tools`}>{sectionMeta.tools.navLabel}</Link>
            <Link href={`${basePath}/programs`}>{sectionMeta.programs.navLabel}</Link>
            <Link href={`${basePath}/events`}>{sectionMeta.events.navLabel}</Link>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.footerColTitle}>Office</h4>
            <a href="tel:+919604188725">+91 9604188725</a>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </div>
          <div className={styles.footerCol}>
            <h4 className={styles.footerColTitle}>Legal</h4>
            <Link href={`${basePath}/privacy-policy`}>Privacy Policy</Link>
            <Link href={`${basePath}/terms-of-service`}>Terms of Service</Link>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>&copy; {new Date().getFullYear()} {config.name}. All rights reserved.</span>
          <span className={styles.footerStudio}>Powered by StudioVerse</span>
        </div>
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
