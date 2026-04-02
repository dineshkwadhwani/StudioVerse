"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TenantConfig } from "@/types/tenant";
import styles from "./CoachingLandingPage.module.css";
import { truncateWords, useCarousel, useItemsPerView } from "./useCarousel";

type Props = {
  config: TenantConfig;
};

type SectionKey = "programs" | "tools" | "events";

const sectionMeta: Record<SectionKey, { title: string; intro: string; viewAllPath: string; darkTile?: boolean }> = {
  programs: {
    title: "Signature programmes designed for leadership growth and transformation.",
    intro: "Each programme pairs a clear commercial use case with a polished learner experience.",
    viewAllPath: "/coaching-studio/programs",
  },
  tools: {
    title: "Assessment and delivery tools built for measurable coaching outcomes.",
    intro: "Every tool supports stronger diagnostics, better reporting, and premium client journeys.",
    viewAllPath: "/coaching-studio/tools",
    darkTile: true,
  },
  events: {
    title: "Curated events that connect leaders, coaches, and growth-focused teams.",
    intro: "From roundtables to showcases, each event is designed for practical outcomes.",
    viewAllPath: "/coaching-studio/events",
  },
};

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

export default function CoachingLandingPage({ config }: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const perView = useItemsPerView();

  const landing = config.landingContent;
  const programs = landing?.programs ?? [];
  const tools = landing?.tools ?? [];
  const events = landing?.events ?? [];

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
          <Image src={config.theme.logo} width={76} height={40} alt="Coach Studio logo" className={styles.logo} />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Coach Studio</span>
            <span className={styles.brandSubtitle}>Coaching | Growth | Potential</span>
          </div>
        </div>

        <nav className={styles.desktopNav}>
          <a href="#programs" className={styles.navLink}>
            Programs
          </a>
          <a href="#tools" className={styles.navLink}>
            Tools
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
          <a href="#programs" onClick={() => setIsMobileMenuOpen(false)}>
            Programs
          </a>
          <a href="#tools" onClick={() => setIsMobileMenuOpen(false)}>
            Tools
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
          <span className={styles.heroLabel}>Enterprise Coaching Platform</span>
          <h1>Deliver premium coaching journeys with clarity, scale, and business impact.</h1>
          <p className={styles.heroCopy}>
            Coaching Studio combines leadership programmes, measurable tools, and curated events into a
            single experience for coaching firms, enterprise teams, and growth-focused professionals.
          </p>
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
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="Login or Register">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Login or Register</h2>
              <button type="button" className={styles.modalClose} onClick={() => setIsAuthOpen(false)}>
                &times;
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
