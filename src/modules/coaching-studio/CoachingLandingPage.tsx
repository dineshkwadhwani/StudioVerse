"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { TenantConfig } from "@/types/tenant";
import styles from "./CoachingLandingPage.module.css";
import { truncateWords, useCarousel, useItemsPerView } from "./useCarousel";

type Props = {
  config: TenantConfig;
};

type SectionKey = "tools" | "programs" | "events";
type UserType = "coach" | "learner";

function getSectionMeta(toolsLabel: string): Record<SectionKey, { title: string; intro: string; viewAllPath: string; darkTile?: boolean; navLabel?: string }> {
  return {
    tools: {
      title: `${toolsLabel} built to assess coachees, surface gaps, and accelerate growth.`,
      intro: "Every tool supports stronger diagnostics, better reporting, and premium client journeys.",
      viewAllPath: "/coaching-studio/tools",
      darkTile: true,
      navLabel: toolsLabel,
    },
    programs: {
      title: "Signature programmes designed for leadership growth and transformation.",
      intro: "Each programme pairs a clear commercial use case with a polished learner experience.",
      viewAllPath: "/coaching-studio/programs",
      navLabel: "Programs",
    },
    events: {
      title: "Curated events that connect leaders, coaches, and growth-focused teams.",
      intro: "From roundtables to showcases, each event is designed for practical outcomes.",
      viewAllPath: "/coaching-studio/events",
      navLabel: "Events",
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
  onTryNow,
  darkTile,
}: {
  id: string;
  items: { name: string; image: string; title: string; description: string }[];
  title: string;
  intro: string;
  viewAllPath: string;
  perView: number;
  onTryNow: () => void;
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
            {items.map((item) => (
              <article key={item.name} className={styles.slide} style={{ flex: `0 0 ${slideWidth}%` }}>
                <div className={`${styles.tile} ${darkTile ? styles.tileDark : ""}`}>
                  <img src={item.image} alt={item.title} className={styles.tileImage} />
                  <div className={styles.tileBody}>
                    <h3 className={styles.tileTitle}>{item.title}</h3>
                    <p className={styles.tileCopy}>{truncateWords(item.description, 10)}</p>
                    <button type="button" className={styles.tileButton} onClick={onTryNow}>
                      Try Now
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

export default function CoachingLandingPage({ config }: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [userType, setUserType] = useState<UserType>("coach");
  const perView = useItemsPerView();

  // Load userType from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("coachingStudioUserType") as UserType | null;
      if (stored && (stored === "coach" || stored === "learner")) {
        setUserType(stored);
      }
    }
  }, []);

  // Save userType to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("coachingStudioUserType", userType);
    }
  }, [userType]);

  const landing = config.landingContent;
  const programs = landing?.programs ?? [];
  const tools = landing?.tools ?? [];
  const events = landing?.events ?? [];
  const toolsLabel = landing?.displayLabels?.tools ?? "Tools";
  const sectionMeta = useMemo(() => getSectionMeta(toolsLabel), [toolsLabel]);

  const isCoach = userType === "coach";

  const heroMessages = {
    coach: {
      label: "Coach Platform",
      title: "Your Playground for Coaching Excellence",
        copy: "Coaching Studio is your playground for delivering premium coaching journeys. Leverage best-in-class programmes or deliver your own, use powerful diagnostic tools to assess your coachees, and host curated events — all in one place to scale your coaching impact.",
    },
    learner: {
      label: "Learning Platform",
      title: "Unlock Your Leadership Potential",
      copy: "Coaching Studio connects you with expert-designed programmes, proven assessment tools, and industry leaders. Assess your capabilities, close gaps, and transform into the leader you aspire to be.",
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

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <div className={styles.brand}>
          <Image src={config.theme.logo} width={76} height={40} alt="Coaching Studio logo" className={styles.logo} />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Coaching Studio</span>
            <span className={styles.brandSubtitle}>Coaching | Growth | Potential</span>
          </div>
        </div>

        <div className={styles.userToggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${userType === "coach" ? styles.toggleActive : ""}`}
            onClick={() => setUserType("coach")}
          >
            I am a Coach
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${userType === "learner" ? styles.toggleActive : ""}`}
            onClick={() => setUserType("learner")}
          >
            I am a Learner
          </button>
        </div>

        <nav className={styles.desktopNav}>
          <a href="#tools" className={styles.navLink}>
            {sectionMeta.tools.navLabel}
          </a>
          <a href="#programs" className={styles.navLink}>
            Programs
          </a>
          <a href="#events" className={styles.navLink}>
            Events
          </a>
          <button type="button" className={styles.authBtn} onClick={() => setIsAuthOpen(true)}>
            Sign In / Register
          </button>
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
        <div className={styles.mobileMenu}>
          <div className={styles.mobileUserToggle}>
            <button
              type="button"
              className={`${styles.toggleBtn} ${styles.toggleSmall} ${userType === "coach" ? styles.toggleActive : ""}`}
              onClick={() => {
                setUserType("coach");
                setIsMobileMenuOpen(false);
              }}
            >
              I am a Coach
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${styles.toggleSmall} ${userType === "learner" ? styles.toggleActive : ""}`}
              onClick={() => {
                setUserType("learner");
                setIsMobileMenuOpen(false);
              }}
            >
              I am a Learner
            </button>
          </div>
          <a href="#tools" onClick={() => setIsMobileMenuOpen(false)}>
            {sectionMeta.tools.navLabel}
          </a>
          <a href="#programs" onClick={() => setIsMobileMenuOpen(false)}>
            Programs
          </a>
          <a href="#events" onClick={() => setIsMobileMenuOpen(false)}>
            Events
          </a>
          <button type="button" onClick={() => setIsAuthOpen(true)}>
            Sign In / Register
          </button>
        </div>
      )}

      <section className={styles.hero}>
        <div className={styles.heroLeft}>
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

      {landing?.sections?.tools !== false && tools.length > 0 && (
        <CarouselSection
          id="tools"
          items={tools}
          title={sectionMeta.tools.title}
          intro={sectionMeta.tools.intro}
          viewAllPath={sectionMeta.tools.viewAllPath}
          perView={perView}
          darkTile={sectionMeta.tools.darkTile}
          onTryNow={() => setIsAuthOpen(true)}
        />
      )}

      {landing?.sections?.programs !== false && programs.length > 0 && (
        <CarouselSection
          id="programs"
          items={programs}
          title={sectionMeta.programs.title}
          intro={sectionMeta.programs.intro}
          viewAllPath={sectionMeta.programs.viewAllPath}
          perView={perView}
          onTryNow={() => setIsAuthOpen(true)}
        />
      )}

      {landing?.sections?.events !== false && events.length > 0 && (
        <CarouselSection
          id="events"
          items={events}
          title={sectionMeta.events.title}
          intro={sectionMeta.events.intro}
          viewAllPath={sectionMeta.events.viewAllPath}
          perView={perView}
          onTryNow={() => setIsAuthOpen(true)}
        />
      )}

      <footer className={styles.footer}>
        <p className={styles.footerLine}>
          <span>&copy; {new Date().getFullYear()} Coaching Studio. All rights reserved.</span>
          <Link href="/coaching-studio/privacy-policy">Privacy Policy</Link>
          <a href="tel:+919604188725">+91 9604188725</a>
          <a href="mailto:contact@coachingstudio.com">contact@coachingstudio.com</a>
        </p>
      </footer>

      {isAuthOpen && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Login or Register"
          onClick={() => setIsAuthOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Login or Register</h2>
              <button type="button" className={styles.modalClose} onClick={() => setIsAuthOpen(false)}>
                &#10005;
              </button>
            </div>
            <p>This is a placeholder. Authentication screens will be added in the next iteration.</p>
            <div className={styles.modalActions}>
              <Link href="/coaching-studio/auth" className={styles.primaryCta}>
                Open Placeholder Page
              </Link>
              <button type="button" className={styles.secondaryCta} onClick={() => setIsAuthOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
