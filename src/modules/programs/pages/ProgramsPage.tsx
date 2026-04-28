"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import { listPrograms } from "@/services/programs.service";
import {
  PROGRAM_DELIVERY_TYPE_LABELS,
  type ProgramDeliveryType,
  type ProgramRecord,
} from "@/types/program";
import LoginRegisterModal from "@/modules/auth/components/LoginRegisterModal";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import styles from "./ProgramsPage.module.css";

type Props = {
  config: TenantConfig;
};

type UserType = "coach" | "learner";
type UserRole = "company" | "professional" | "individual";

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isInTenantScope(record: Pick<ProgramRecord, "tenantId" | "tenantIds">, tenantId: string): boolean {
  const target = normalizeTenantToken(tenantId);
  if (normalizeTenantToken(record.tenantId) === target) {
    return true;
  }

  return (record.tenantIds ?? []).some((value) => normalizeTenantToken(value) === target);
}

function canViewVisibility(args: {
  visibility: ProgramRecord["visibility"];
  isLoggedIn: boolean;
  role: UserRole | null;
}): boolean {
  if (args.visibility !== "private") {
    return true;
  }

  return args.isLoggedIn && (args.role === "professional" || args.role === "individual");
}

export default function ProgramsPage({ config }: Props) {
  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<string>("all");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [guestUserType, setGuestUserType] = useState<UserType>("coach");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentUserName, setCurrentUserName] = useState<string | undefined>();

  useEffect(() => {
    let active = true;

    async function loadPublishedPrograms() {
      setIsLoading(true);

      try {
        const allPrograms = await listPrograms();
        const nextPrograms = allPrograms
          .filter((item) => isInTenantScope(item, config.id))
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setIsLoggedIn(!!firebaseUser);
      setCurrentUserId(firebaseUser?.uid);
        setCurrentUserName(
          firebaseUser?.displayName || sessionStorage.getItem("cs_name") || undefined
        );

      if (!firebaseUser) {
        setRole(null);
        return;
      }

      const storedRole = sessionStorage.getItem("cs_role");
      setRole(isUserRole(storedRole) ? storedRole : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("coachingStudioUserType");
    setGuestUserType(stored === "learner" ? "learner" : "coach");
  }, []);

  const effectiveUserType: UserType = isLoggedIn
    ? role === "individual"
      ? "learner"
      : "coach"
    : guestUserType;

  const handleItemClick = (item: ProgramRecord) => {
    if (!isLoggedIn) {
      const stored = localStorage.getItem("coachingStudioUserType");
      setGuestUserType(stored === "learner" ? "learner" : "coach");
    }

    const detailItem: DetailItem = {
      id: item.id,
      type: "program",
      title: item.name,
      image: item.thumbnailUrl || "",
      description: item.shortDescription || item.longDescription || "",
      details: item.details,
      creditsRequired: item.creditsRequired ?? 0,
      deliveryType: item.deliveryType,
      durationValue: item.durationValue,
      durationUnit: item.durationUnit,
      facilitatorName: item.facilitatorName || undefined,
      videoUrl: item.videoUrl || undefined,
    };

    setSelectedDetailItem(detailItem);
    setIsDetailModalOpen(true);
  };

  const deliveryTypeOptions = useMemo(() => {
    return Array.from(new Set(programs.map((item) => item.deliveryType))).sort((a, b) =>
      PROGRAM_DELIVERY_TYPE_LABELS[a as ProgramDeliveryType].localeCompare(
        PROGRAM_DELIVERY_TYPE_LABELS[b as ProgramDeliveryType],
      ),
    );
  }, [programs]);

  const visiblePrograms = useMemo(() => {
    const visibilityFiltered = programs.filter((item) =>
      canViewVisibility({ visibility: item.visibility, isLoggedIn, role }),
    );

    if (selectedDeliveryType === "all") {
      return visibilityFiltered;
    }

    return visibilityFiltered.filter((item) => item.deliveryType === selectedDeliveryType);
  }, [isLoggedIn, programs, role, selectedDeliveryType]);

  const heroImage =
    config.landingContent?.heroImages?.programs ||
    config.landingContent?.heroImages?.events ||
    config.landingContent?.heroImages?.tools ||
    "/tenants/coaching-studio/hero1.png";

  return (
    <main className={styles.page}>
      <TenantViewAllHeader
        config={config}
        currentPage="programs"
        onSignInRegister={() => setIsAuthModalOpen(true)}
      />

      <section className={styles.heroSection}>
        <div className={styles.heroText}>
          <span className={styles.heroTag}>View All Programs</span>
          <h1 className={styles.heroTitle}>Programs Designed for Measurable Leadership Growth</h1>
          <p className={styles.heroCopy}>
            {config.name} programs combine structured learning, practical application, and expert facilitation to
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
            alt={`${config.name} programs`}
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
                  <button
                    type="button"
                    className={landingStyles.tileButton}
                    onClick={() => handleItemClick(item)}
                  >
                    Find out more...
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <LoginRegisterModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <DetailModal
        item={selectedDetailItem}
        isOpen={isDetailModalOpen}
        userType={effectiveUserType}
        isLoggedIn={isLoggedIn}
        onAuthRequired={() => setIsAuthModalOpen(true)}
        userId={currentUserId}
        userName={currentUserName}
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
