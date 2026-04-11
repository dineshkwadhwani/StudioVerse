"use client";

import { config } from "@/tenants/coaching-studio/config";
import { useEffect, useMemo, useState } from "react";
import CoachingViewAllHeader from "@/modules/coaching-studio/CoachingViewAllHeader";
import DetailModal, { type DetailItem } from "@/modules/coaching-studio/DetailModal";
import LoginRegisterModal from "@/modules/coaching-studio/auth/LoginRegisterModal";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { AssessmentRecord } from "@/types/assessment";
import landingStyles from "@/modules/coaching-studio/CoachingLandingPage.module.css";
import styles from "@/modules/coaching-studio/CoachingProgramsPage.module.css";

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type UserType = "coach" | "learner";
type UserRole = "company" | "professional" | "individual";

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

export default function CoachingStudioToolsPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [guestUserType, setGuestUserType] = useState<UserType>("coach");
  const toolsLabel = config.landingContent?.displayLabels?.tools ?? "Assessment Centre";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setIsLoggedIn(!!firebaseUser);

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

  const handleItemClick = (item: AssessmentRecord) => {
    if (!isLoggedIn) {
      const stored = localStorage.getItem("coachingStudioUserType");
      setGuestUserType(stored === "learner" ? "learner" : "coach");
    }

    const detailItem: DetailItem = {
      id: item.id,
      type: "tool",
      title: item.name,
      image: item.assessmentImageUrl || "",
      description: item.shortDescription || item.longDescription || "",
      details: item.assessmentContext,
      creditsRequired: item.creditsRequired ?? 0,
      assessmentContext: item.assessmentContext,
      assessmentBenefit: item.assessmentBenefit,
      assessmentType: item.assessmentType,
    };

    setSelectedDetailItem(detailItem);
    setIsDetailModalOpen(true);
  };

  useEffect(() => {
    let active = true;

    async function loadAssessments() {
      setIsLoading(true);

      try {
        const snap = await getDocs(collection(db, "assessments"));
        const rows = snap.docs.map((entry) => ({
          id: entry.id,
          ...(entry.data() as Omit<AssessmentRecord, "id">),
        }));

        const targetTenant = normalizeTenantToken(config.id);
        const nextRows = rows
          .filter((item) => normalizeTenantToken(item.tenantId) === targetTenant)
          .sort((a, b) => (b.updatedAt?.toDate().getTime() ?? 0) - (a.updatedAt?.toDate().getTime() ?? 0));

        if (active) {
          setAssessments(nextRows);
        }
      } catch {
        if (active) {
          setAssessments([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAssessments();

    return () => {
      active = false;
    };
  }, []);

  const heroImage = useMemo(() => {
    return (
      config.landingContent?.heroImages?.tools ||
      config.landingContent?.heroImages?.programs ||
      config.landingContent?.heroImages?.events ||
      "/tenants/coaching-studio/hero2.png"
    );
  }, []);

  return (
    <main className={styles.page}>
      <CoachingViewAllHeader
        config={config}
        currentPage="tools"
        onSignInRegister={() => setIsAuthModalOpen(true)}
      />

      <section className={styles.heroSection}>
        <div className={styles.heroText}>
          <span className={styles.heroTag}>View All {toolsLabel}</span>
          <h1 className={styles.heroTitle}>Assessments Designed to Reveal Strengths and Growth Gaps</h1>
          <p className={styles.heroCopy}>
            Explore diagnostic assessments created by experts to evaluate leadership behaviors, capabilities, and
            development priorities. Each assessment provides actionable insight you can use immediately.
          </p>
        </div>
        <div className={styles.heroImageWrap}>
          <img src={heroImage} alt={toolsLabel} className={styles.heroImage} />
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.topFilterRow}>
          <h2 className={styles.title}>Available Assessments</h2>
        </div>

        {isLoading ? <p className={styles.helper}>Loading assessments...</p> : null}
        {!isLoading && assessments.length === 0 ? (
          <p className={styles.helper}>No assessments are currently available.</p>
        ) : null}

        {!isLoading && assessments.length > 0 ? (
          <div className={styles.grid}>
            {assessments.map((item) => (
              <article key={item.id} className={landingStyles.tile}>
                <div className={styles.cardImageWrap}>
                  <img
                    className={styles.cardImage}
                    src={item.assessmentImageUrl || heroImage}
                    alt={item.name}
                    loading="lazy"
                  />
                </div>
                <div className={landingStyles.tileBody}>
                  <h3 className={landingStyles.tileTitle}>{item.name}</h3>
                  <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
                  <p className={styles.meta}>Type: {item.assessmentType}</p>
                  <p className={styles.meta}>Questions: {item.questionBankCount}</p>
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
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailItem(null);
        }}
      />
    </main>
  );
}
