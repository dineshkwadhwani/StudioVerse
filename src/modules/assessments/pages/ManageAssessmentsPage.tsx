"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import {
  getScopedAssessments,
  canUserEditAssessment,
  type UserScopeContext,
} from "@/services/assessments-scoped.service";
import type { AssessmentRecord } from "@/types/assessment";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import styles from "@/modules/programs/pages/ManageProgramsPage.module.css";

type Props = {
  config: TenantConfig;
  showHeader?: boolean;
};

type UserRole = "company" | "professional" | "individual" | "superadmin";

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual" || value === "superadmin";
}

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isInTenantScope(record: Pick<AssessmentRecord, "tenantId" | "tenantIds">, tenantId: string): boolean {
  const target = normalizeTenantToken(tenantId);
  if (normalizeTenantToken(record.tenantId) === target) {
    return true;
  }
  return (record.tenantIds ?? []).some((value) => normalizeTenantToken(value) === target);
}

export default function ManageAssessmentsPage({ config, showHeader = true }: Props) {
  const router = useRouter();
  const tenantId = config.id;
  const basePath = `/${tenantId}`;

  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    if (storedRoleRaw === "individual") {
      router.replace(`${basePath}/tools`);
      return;
    }

    setUserRole(storedRoleRaw);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }
      setCurrentUserId(firebaseUser.uid);
    });

    return () => unsubscribe();
  }, [basePath, router]);

  useEffect(() => {
    if (!currentUserId || !userRole || (userRole !== "superadmin" && userRole !== "company" && userRole !== "professional")) {
      return;
    }

    const resolvedUserId = currentUserId;
    const resolvedRole = userRole;

    async function loadScopedAssessments() {
      setIsLoading(true);
      setError("");

      try {
        const scopeContext: UserScopeContext = {
          userId: resolvedUserId,
          role: resolvedRole,
          tenantId,
        };

        const scoped = await getScopedAssessments(scopeContext);
        const nextAssessments = scoped
          .filter((item) => isInTenantScope(item, tenantId))
          .sort((a, b) => {
            const left = (a.updatedAt && "toDate" in a.updatedAt ? a.updatedAt.toDate().getTime() : 0) || 0;
            const right = (b.updatedAt && "toDate" in b.updatedAt ? b.updatedAt.toDate().getTime() : 0) || 0;
            return right - left;
          });

        setAssessments(nextAssessments);
      } catch (loadError) {
        console.error(loadError);
        setError("Failed to load assessments.");
        setAssessments([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadScopedAssessments();
  }, [currentUserId, tenantId, userRole]);

  const typeOptions = useMemo(() => {
    return Array.from(new Set(assessments.map((item) => item.assessmentType))).sort((a, b) => a.localeCompare(b));
  }, [assessments]);

  const visibleAssessments = useMemo(() => {
    if (selectedType === "all") {
      return assessments;
    }
    return assessments.filter((item) => item.assessmentType === selectedType);
  }, [assessments, selectedType]);

  const heroImage =
    config.landingContent?.heroImages?.tools ||
    config.landingContent?.heroImages?.programs ||
    config.landingContent?.heroImages?.events ||
    "/tenants/coaching-studio/hero2.png";

  return (
    <main className={styles.page}>
      {showHeader ? (
        <TenantViewAllHeader config={config} currentPage="tools" onSignInRegister={() => undefined} />
      ) : null}

      <section className={styles.content}>
        <article className={styles.manageCard}>
          <h2 className={styles.sectionHeading}>Manage Assessments</h2>
          <p className={styles.sectionSubtitle}>
            Create tenant-wide Assessments for StudioVerse tenants. Publish to make them visible; promote to elevate them on the landing page.
          </p>

          <div className={styles.controlCard}>
            <div className={styles.topControlsRow}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="assessment-type-filter">Assessment Type</label>
                <select
                  id="assessment-type-filter"
                  className={styles.filterSelect}
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                >
                  <option value="all">All Types</option>
                  {typeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.addButton} onClick={() => router.push("/admin")}>Add Assessment</button>
              </div>
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {isLoading ? <p className={styles.emptyCard}>Loading assessments...</p> : null}
          {!isLoading && assessments.length === 0 ? <p className={styles.emptyCard}>No assessments found for your scope.</p> : null}

          {!isLoading && visibleAssessments.length > 0 ? (
            <div className={styles.grid}>
            {visibleAssessments.map((item) => {
              const canEdit = userRole && currentUserId
                ? canUserEditAssessment(item, { userId: currentUserId, role: userRole, tenantId })
                : false;

              return (
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
                    <p className={styles.meta}>Status: {item.status}</p>
                    <p className={styles.meta}>Visibility: {item.visibility === "private" ? "Private" : "Public"}</p>
                    <p className={styles.meta}>Created By: {item.createdBy}</p>
                    <div className={styles.buttonGroup}>
                      {userRole === "superadmin" ? (
                        <button type="button" className={styles.primaryButton} onClick={() => router.push("/admin")}>
                          Edit
                        </button>
                      ) : (
                        <>
                          <button type="button" className={styles.secondaryButton}>Try</button>
                          <button type="button" className={styles.secondaryButton}>Assign</button>
                          {canEdit ? (
                            <button type="button" className={styles.primaryButton} onClick={() => router.push("/admin")}>
                              Edit
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
