"use client";

import { useEffect, useMemo, useState } from "react";
import type { TenantConfig } from "@/types/tenant";
import { listEvents, listLandingPageEvents } from "@/services/events.service";
import { EVENT_TYPE_LABELS, type EventRecord } from "@/types/event";
import LoginRegisterModal from "./auth/LoginRegisterModal";
import CoachingViewAllHeader from "./CoachingViewAllHeader";
import landingStyles from "./CoachingLandingPage.module.css";
import styles from "./CoachingEventsPage.module.css";

type Props = {
  config: TenantConfig;
};

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function CoachingEventsPage({ config }: Props) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPublishedEvents() {
      setIsLoading(true);

      try {
        let nextEvents = await listLandingPageEvents(config.id);

        if (nextEvents.length === 0) {
          const allEvents = await listEvents();
          const targetTenant = normalizeTenantToken(config.id);
          nextEvents = allEvents
            .filter((item) => normalizeTenantToken(item.tenantId) === targetTenant)
            .filter((item) => item.status === "published" && item.publicationState === "published")
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

        if (active) {
          setEvents(nextEvents);
        }
      } catch {
        if (active) {
          setEvents([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadPublishedEvents();

    return () => {
      active = false;
    };
  }, [config.id]);

  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(events.map((item) => item.locationCity.trim()).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));
  }, [events]);

  const visibleEvents = useMemo(() => {
    if (selectedCity === "all") {
      return events;
    }

    return events.filter((item) => item.locationCity.trim().toLowerCase() === selectedCity.toLowerCase());
  }, [events, selectedCity]);

  const heroImage =
    config.landingContent?.heroImages?.events ||
    config.landingContent?.heroImages?.programs ||
    config.landingContent?.heroImages?.tools ||
    "/tenants/coaching-studio/hero3.png";

  return (
    <main className={styles.page}>
      <CoachingViewAllHeader
        config={config}
        currentPage="events"
        onSignInRegister={() => setIsAuthModalOpen(true)}
      />

      <section className={styles.heroSection}>
        <div className={styles.heroText}>
          <span className={styles.heroTag}>View All Events</span>
          <h1 className={styles.heroTitle}>Events That Build Capability, Community, and Momentum</h1>
          <p className={styles.heroCopy}>
            Coaching Studio events are curated learning experiences where leaders, coaches, and professionals come
            together to exchange practical insights, build stronger networks, and apply new ideas immediately.
          </p>
          <p className={styles.heroCopy}>
            From expert-led webinars to hands-on workshops and focused classroom sessions, every published event is
            designed to create measurable value: sharper leadership decisions, stronger team performance, and faster
            growth outcomes.
          </p>
        </div>
        <div className={styles.heroImageWrap}>
          <img
            src={heroImage}
            alt="Coaching Studio events"
            className={styles.heroImage}
          />
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.topFilterRow}>
          <h2 className={styles.title}>Published Events</h2>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="events-city-filter">City</label>
            <select
              id="events-city-filter"
              className={styles.filterSelect}
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
            >
              <option value="all">All Cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? <p className={styles.helper}>Loading events...</p> : null}
        {!isLoading && events.length === 0 ? <p className={styles.helper}>No published events are available.</p> : null}
        {!isLoading && events.length > 0 && visibleEvents.length === 0 ? (
          <p className={styles.helper}>No events found for the selected city.</p>
        ) : null}

        {!isLoading && visibleEvents.length > 0 ? (
          <div className={styles.grid}>
            {visibleEvents.map((item) => (
              <article key={item.id} className={landingStyles.tile}>
                <div className={styles.cardImageWrap}>
                  <img
                    className={styles.cardImage}
                    src={item.thumbnailUrl || "/tenants/coaching-studio/events/default.svg"}
                    alt={item.name}
                    loading="lazy"
                  />
                </div>
                <div className={landingStyles.tileBody}>
                  <h3 className={landingStyles.tileTitle}>{item.name}</h3>
                  <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
                  <p className={styles.meta}>{item.locationCity || "City TBA"} | {item.locationAddress || "Address TBA"}</p>
                  <p className={styles.meta}>Type: {EVENT_TYPE_LABELS[item.eventType]}</p>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <LoginRegisterModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </main>
  );
}
