import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenantByHost } from "@/lib/tenant/routing";
import ContactForm from "./ContactForm";
import styles from "./StudioVersePage.module.css";

export const metadata = {
  title: "StudioVerse — One Platform, Every Studio",
  description:
    "StudioVerse powers professional studios across coaching, training, recruitment, HR, fitness, and teaching — all from one intelligent platform.",
};

const STUDIOS = [
  {
    id: "coaching-studio",
    name: "Coaching Studio",
    subtitle: "For Coaches & Coaching Companies",
    tagline: "The platform for coaches and coaching companies to manage the skills of their clients. Assess individuals and run their transformation through structured programs and live events.",
    icon: "🎯",
    image: "/coaching-studio.png",
    href: "/coaching-studio",
    live: true,
  },
  {
    id: "recruitment-studio",
    name: "Recruitment Studio",
    subtitle: "For Recruiters & Talent Teams",
    tagline: "The platform for recruiters to evaluate candidates and find the best available talent. Screen, assess, and place top resources with structured pipelines and smart workflows.",
    icon: "🔍",
    image: "/recruitment-studio.png",
    href: "/recruitment-studio",
    live: true,
  },
  {
    id: "training-studio",
    name: "Training Studio",
    subtitle: "For Trainers & Learning Organizations",
    tagline: "The platform for trainers and L&D teams to design and deliver world-class learning programs. Run cohorts, track engagement, and measure outcomes across your entire organisation.",
    icon: "📚",
    image: "/training-studio.png",
    href: "/training-studio",
    live: true,
  },
  {
    id: "hr-studio",
    name: "HR Studio",
    subtitle: "For HR Teams & People Operations",
    tagline: "The platform for HR professionals to streamline every people touchpoint — from onboarding and performance to engagement and development — in one connected workspace.",
    icon: "👥",
    image: "/hr-studio.png",
    href: "#",
    live: false,
  },
  {
    id: "fitness-studio",
    name: "Fitness Studio",
    subtitle: "For Physical Trainers & Gym Instructors",
    tagline: "The platform for physical trainers, gym instructors, and dieticians to deliver programs and training plans to their clients, and track their progress end-to-end.",
    icon: "💪",
    image: "/fitness-studio.png",
    href: "#",
    live: false,
  },
  {
    id: "teaching-studio",
    name: "Teaching Studio",
    subtitle: "For Teachers, Tutors & Academicians",
    tagline: "The platform for teachers, tutors, and academicians to help students improve through ad-hoc assessments, structured learning paths, and targeted video-based knowledge delivery.",
    icon: "🎓",
    image: "/teaching-studio.png",
    href: "#",
    live: false,
  },
];

export default async function Home() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const tenant = resolveTenantByHost(host);

  if (tenant) {
    redirect(`/${tenant.id}`);
  }

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navBrand}>
          <Image src="/sv_logo.png" alt="StudioVerse" width={36} height={36} className={styles.navLogo} />
          <span className={styles.navWordmark}>StudioVerse</span>
        </Link>
        <ul className={styles.navLinks}>
          <li><a href="#studios" className={styles.navLink}>Studios</a></li>
          <li><a href="#about" className={styles.navLink}>About</a></li>
          <li><a href="#contact" className={styles.navLink}>Contact</a></li>
          <li><a href="#studios" className={styles.navCta}>Explore Studios</a></li>
        </ul>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />

        <div className={styles.heroContent}>
          <div className={styles.heroEyebrow}>
            <span className={styles.heroDot} />
            Now live across 3 studios
          </div>
          <h1 className={styles.heroTitle}>
            One Platform.<br />Every Studio.
          </h1>
          <p className={styles.heroSubtitle}>
            StudioVerse is the intelligent multi-studio platform that powers coaching, training,
            recruitment, and beyond — with shared infrastructure, smart tooling, and a seamless
            experience for every role.
          </p>
          <div className={styles.heroActions}>
            <a href="#studios" className={styles.heroPrimary}>
              Explore Studios →
            </a>
            <a href="#about" className={styles.heroSecondary}>
              Learn More
            </a>
          </div>
        </div>

        <div className={styles.heroMosaic}>
          <div className={styles.mosaicCell}>
            <Image src="/coaching-studio.png" alt="" fill sizes="400px" style={{ objectFit: "cover" }} />
          </div>
          <div className={styles.mosaicCell}>
            <Image src="/recruitment-studio.png" alt="" fill sizes="200px" style={{ objectFit: "cover" }} />
          </div>
          <div className={styles.mosaicCell}>
            <Image src="/training-studio.png" alt="" fill sizes="200px" style={{ objectFit: "cover" }} />
          </div>
          <div className={styles.mosaicCell}>
            <Image src="/hr-studio.png" alt="" fill sizes="200px" style={{ objectFit: "cover" }} />
          </div>
          <div className={styles.mosaicCell}>
            <Image src="/fitness-studio.png" alt="" fill sizes="400px" style={{ objectFit: "cover" }} />
          </div>
          <div className={styles.mosaicCell}>
            <Image src="/teaching-studio.png" alt="" fill sizes="400px" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className={styles.statsStrip}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>6</span>
          <span className={styles.statLabel}>Studios</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>3</span>
          <span className={styles.statLabel}>Live Now</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>1</span>
          <span className={styles.statLabel}>Platform</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>∞</span>
          <span className={styles.statLabel}>Possibilities</span>
        </div>
      </div>

      {/* ── STUDIOS ── */}
      <section id="studios" className={styles.section}>
        <div className={styles.studiosHeader}>
          <span className={styles.sectionEyebrow}>Studios</span>
          <h2 className={styles.sectionTitle}>
            Find Your <span>Studio</span>
          </h2>
          <p className={styles.sectionBody}>
            Each StudioVerse deployment is purpose-built for its domain — sharing the same
            intelligent core while delivering a tailored experience for coaches, trainers,
            recruiters, and every professional in between.
          </p>
        </div>

        <div className={styles.studiosGrid}>
          {STUDIOS.map((studio) => {
            const cardBody = (
              <>
                <div className={styles.studioImageWrap}>
                  <Image
                    src={studio.image}
                    alt={studio.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div className={styles.studioImageOverlay} />
                </div>
                <div className={styles.studioCardBody}>
                  <div className={styles.studioMeta}>
                    <span className={styles.studioIcon}>{studio.icon}</span>
                    {studio.live ? (
                      <span className={`${styles.studioBadge} ${styles.badgeLive}`}>Live</span>
                    ) : (
                      <span className={`${styles.studioBadge} ${styles.badgeSoon}`}>Coming Soon</span>
                    )}
                  </div>
                  <h3 className={styles.studioName}>{studio.name}</h3>
                  <p className={styles.studioSubtitle}>{studio.subtitle}</p>
                  <p className={styles.studioTagline}>{studio.tagline}</p>
                  {studio.live && (
                    <span className={styles.studioArrow}>Open Studio →</span>
                  )}
                </div>
              </>
            );

            return studio.live ? (
              <Link key={studio.id} href={studio.href} className={styles.studioCard}>
                {cardBody}
              </Link>
            ) : (
              <div key={studio.id} className={`${styles.studioCard} ${styles.studioCardDisabled}`}>
                {cardBody}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className={`${styles.section} ${styles.aboutSection}`}>
        <div className={styles.aboutGrid}>
          <div>
            <span className={styles.sectionEyebrow}>About</span>
            <h2 className={styles.sectionTitle}>
              Built for the <span>Modern Studio</span>
            </h2>
            <p className={styles.sectionBody}>
              StudioVerse is a multi-tenant platform that gives every type of professional studio
              the infrastructure they need to grow — without building it from scratch.
              One codebase. One intelligent core. Purpose-configured for each domain.
            </p>

            <div className={styles.aboutFeatures}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🏗️</div>
                <div className={styles.featureText}>
                  <h4>Shared Infrastructure</h4>
                  <p>Auth, wallets, assignments, referrals, and AI — built once, available everywhere across every studio deployment.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🎨</div>
                <div className={styles.featureText}>
                  <h4>Purpose-Built Experiences</h4>
                  <p>Each studio is tailored to its domain with custom roles, workflows, terminology, and branding out of the box.</p>
                </div>
              </div>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>🤖</div>
                <div className={styles.featureText}>
                  <h4>AI at the Core</h4>
                  <p>From intelligent assessments and AI-generated reports to persona-driven studio bots — intelligence is built in, not bolted on.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.aboutImage}>
            <Image
              src="/studioverse.png"
              alt="StudioVerse platform"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className={`${styles.section} ${styles.contactSection}`}>
        <span className={styles.sectionEyebrow}>Contact</span>
        <h2 className={styles.sectionTitle}>
          Get in <span>Touch</span>
        </h2>
        <p className={styles.sectionBody} style={{ margin: "0 auto" }}>
          Interested in bringing StudioVerse to your organisation, or want to learn more
          about a specific studio? We&apos;d love to hear from you.
        </p>

        <ContactForm />
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand}>
          <Image src="/sv_logo.png" alt="StudioVerse" width={28} height={28} className={styles.footerLogo} />
          <span className={styles.footerWordmark}>StudioVerse</span>
        </Link>
        <p className={styles.footerCopy}>© {new Date().getFullYear()} StudioVerse. All rights reserved.</p>
        <ul className={styles.footerLinks}>
          <li><a href="#studios">Studios</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </footer>

    </div>
  );
}
