"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import { getScopedPrograms, canUserEditProgram, type UserScopeContext } from "@/services/programs-scoped.service";
import type { ProgramRecord } from "@/types/program";
import {
  PROGRAM_DELIVERY_TYPE_LABELS,
  PROGRAM_PROMOTION_STATUS_LABELS,
  PROGRAM_VISIBILITY_LABELS,
} from "@/types/program";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import styles from "./ManageProgramsPage.module.css";

type Props = {
  config: TenantConfig;
  showHeader?: boolean;
};

type UserRole = "company" | "professional" | "individual" | "superadmin";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === "company" ||
    value === "professional" ||
    value === "individual" ||
    value === "superadmin"
  );
}

function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isInTenantScope(
  record: Pick<ProgramRecord, "tenantId" | "tenantIds">,
  tenantId: string
): boolean {
  const target = normalizeTenantToken(tenantId);
  if (normalizeTenantToken(record.tenantId) === target) {
    return true;
  }

  return (record.tenantIds ?? []).some((value) => normalizeTenantToken(value) === target);
}

export default function ManageProgramsPage({ config, showHeader = true }: Props) {
  const router = useRouter();
  const tenantId = config.id;
  const basePath = `/${tenantId}`;

  const [programs, setPrograms] = useState<ProgramRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");

  // Check auth and role
  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    if (storedRoleRaw === "individual") {
      // Individuals can't manage programs
      router.replace(`${basePath}/programs`);
      return;
    }

    setUserRole(storedRoleRaw);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      setCurrentUserId(firebaseUser.uid);
    });

    return () => unsubscribe();
  }, [basePath, router]);

  // Load programs when user is determined
  useEffect(() => {
    if (!currentUserId || !userRole || (userRole !== "superadmin" && userRole !== "company" && userRole !== "professional")) {
      return;
    }

    const resolvedUserId = currentUserId;
    const resolvedRole = userRole;

    async function loadScopedPrograms() {
      setIsLoading(true);
      setError("");

      try {
        const scopeContext: UserScopeContext = {
          userId: resolvedUserId,
          role: resolvedRole,
          tenantId,
        };

        const scopedPrograms = await getScopedPrograms(scopeContext);

        // Filter by tenant scope
        const nextPrograms = scopedPrograms
          .filter((item) => isInTenantScope(item, tenantId))
          .sort((a, b) => {
            return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
          });

        setPrograms(nextPrograms);
      } catch (err) {
        console.error("Failed to load programs:", err);
        setError("Failed to load programs");
        setPrograms([]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadScopedPrograms();
  }, [currentUserId, userRole, tenantId]);

  const handleItemClick = (item: ProgramRecord) => {
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

  const visiblePrograms = programs;

  const programsSubtitle =
    userRole === "company"
      ? "Create and manage programs for your company teams, keep drafts in progress, and publish when they are ready."
      : userRole === "professional"
        ? "Create and manage programs in your assigned scope, keep drafts in progress, and publish when they are ready."
        : "Create and manage programs for your studio tenant, keep drafts in progress, and publish when they are ready.";

  const heroImage =
    config.landingContent?.heroImages?.programs ||
    config.landingContent?.heroImages?.events ||
    config.landingContent?.heroImages?.tools ||
    "/tenants/coaching-studio/hero1.png";

  return (
    <main className={styles.page}>
      {showHeader ? (
        <TenantViewAllHeader
          config={config}
          currentPage="programs"
          onSignInRegister={() => {}}
        />
      ) : null}

      <section className={styles.content}>
        <article className={styles.manageCard}>
          <h2 className={styles.sectionHeading}>Manage Programs</h2>
          <p className={styles.sectionSubtitle}>
            {programsSubtitle}
          </p>

          <div className={styles.controlCard}>
            <div className={styles.topControlsRow}>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => {
                    // TODO: Navigate to create program page
                    alert("Create program feature coming soon");
                  }}
                >
                  Add Program
                </button>
              </div>
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {isLoading ? <p className={styles.emptyCard}>Loading programs...</p> : null}
          {!isLoading && programs.length === 0 ? (
            <p className={styles.emptyCard}>No programs found for your roles and scope.</p>
          ) : null}

          {!isLoading && visiblePrograms.length > 0 ? (
            <div className={styles.grid}>
            {visiblePrograms.map((item) => {
              const canEdit = userRole && currentUserId ? canUserEditProgram(item, { userId: currentUserId, role: userRole as any, tenantId }) : false;

              return (
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
                    <p className={styles.meta}>Status: {item.status}</p>
                    <p className={styles.meta}>Promotion: {PROGRAM_PROMOTION_STATUS_LABELS[item.promotionStatus]}</p>
                    <p className={styles.meta}>Visibility: {PROGRAM_VISIBILITY_LABELS[item.visibility]}</p>
                    <div className={styles.buttonGroup}>
                      {userRole === "superadmin" ? (
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => router.push("/admin")}
                        >
                          Edit
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => handleItemClick(item)}
                          >
                            Try
                          </button>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => handleItemClick(item)}
                          >
                            Assign
                          </button>
                          {canEdit ? (
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() => router.push("/admin")}
                            >
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

      <DetailModal
        item={selectedDetailItem}
        isOpen={isDetailModalOpen}
        userType="coach"
        isLoggedIn={!!currentUserId}
        onAuthRequired={() => {}}
        userId={currentUserId}
        userRole={userRole ?? undefined}
        tenantId={config.id}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailItem(null);
        }}
      />
    </main>
  );
}
