"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TenantConfig } from "@/types/tenant";
import { listPrograms } from "@/services/programs.service";
import {
  PROGRAM_DELIVERY_TYPE_LABELS,
  type ProgramDeliveryType,
  type ProgramRecord,
} from "@/types/program";
import landingStyles from "./CoachingLandingPage.module.css";
import styles from "./CoachingProgramsPage.module.css";

type Props = {
  config: TenantConfig;
};

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function CoachingProgramsPage({ config }: Props) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<string>("all");

  useEffect(() => {
    let active = true;

    async function loadPublishedPrograms() {
      setIsLoading(true);

      try {
        const allPrograms = await listPrograms();
        const targetTenant = normalizeTenantToken(config.id);
        const nextPrograms = allPrograms
          .filter((item) => normalizeTenantToken(item.tenantId) === targetTenant)
          .filter((item) => item.status === "published" && item.publicationState === "published")
          .sort((a, b) => {
            if (a.promoted !== b.promoted) {
              return a.promoted ? -1 : 1;
            }
            return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
          });

        if (active) {
          setPrograms(nextPrograms);
        }
      } catch {
        if (active) {
          setPrograms([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPublishedPrograms();

    return () => {
      active = false;
    };
  }, [config.id]);

  const deliveryTypeOptions = useMemo(() => {
    return Array.from(new Set(programs.map((item) => item.deliveryType))).sort((a, b) =>
      PROGRAM_DELIVERY_TYPE_LABELS[a as ProgramDeliveryType].localeCompare(
        PROGRAM_DELIVERY_TYPE_LABELS[b as ProgramDeliveryType],
      ),
    );
  }, [programs]);

  const visiblePrograms = useMemo(() => {
    if (selectedDeliveryType === "all") {
      return programs;
    }

    return programs.filter((item) => item.deliveryType === selectedDeliveryType);
  }, [programs, selectedDeliveryType]);

  const heroImage =
    config.landingContent?.heroImages?.programs ||
    config.landingContent?.heroImages?.events ||
    config.landingContent?.heroImages?.tools ||
    "/tenants/coaching-studio/hero1.png";

  return (
    <main className={styles.page}>
      <header className={landingStyles.nav}>
        <div className={landingStyles.brand}>
          <Image src={config.theme.logo} width={76} height={40} alt="Coaching Studio logo" className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>Coaching Studio</span>
            <span className={landingStyles.brandSubtitle}>Coaching | Growth | Potential</span>
          </div>
        </div>
        <Link href="/coaching-studio" className={styles.homeLink}>Home</Link>
      </header>

      <section className={styles.heroSection}>
        <div className={styles.heroText}>
          <span className={styles.heroTag}>View All Programs</span>
          <h1 className={styles.heroTitle}>Programs Designed for Measurable Leadership Growth</h1>
          <p className={styles.heroCopy}>
            Coaching Studio programs combine structured learning, practical application, and expert facilitation to
            help leaders improve real-world performance. Each published program is built to move beyond theory and
            drive change where it matters most: in teams, decision-making, and business outcomes.
          </p>
          <p className={styles.heroCopy}>
            Whether you are building first-time managers, accelerating executive capability, or strengthening team
            leadership, these programs deliver focused pathways that translate into sustained growth and impact.
          </p>
        </div>
        <div className={styles.heroImageWrap}>
          <img
            src={heroImage}
            alt="Coaching Studio programs"
            className={styles.heroImage}
          />
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.topFilterRow}>
          <h2 className={styles.title}>Published Programs</h2>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="programs-type-filter">Delivery Type</label>
            <select
              id="programs-type-filter"
              className={styles.filterSelect}
              value={selectedDeliveryType}
              onChange={(event) => setSelectedDeliveryType(event.target.value)}
            >
              <option value="all">All Types</option>
              {deliveryTypeOptions.map((deliveryType) => (
                <option key={deliveryType} value={deliveryType}>
                  {PROGRAM_DELIVERY_TYPE_LABELS[deliveryType as ProgramDeliveryType]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? <p className={styles.helper}>Loading programs...</p> : null}
        {!isLoading && programs.length === 0 ? <p className={styles.helper}>No published programs are available.</p> : null}
        {!isLoading && programs.length > 0 && visiblePrograms.length === 0 ? (
          <p className={styles.helper}>No programs found for the selected delivery type.</p>
        ) : null}

        {!isLoading && visiblePrograms.length > 0 ? (
          <div className={styles.grid}>
            {visiblePrograms.map((item) => (
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
                  <p className={styles.meta}>Type: {PROGRAM_DELIVERY_TYPE_LABELS[item.deliveryType]}</p>
                  <p className={styles.meta}>
                    Duration: {item.durationValue} {item.durationUnit}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
