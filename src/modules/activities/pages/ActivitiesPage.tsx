"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import AssignActivitiesPage from "@/modules/activities/pages/AssignActivitiesPage";
import MyActivitiesPage from "@/modules/activities/pages/MyActivitiesPage";
import AssignedActivitiesPage from "@/modules/activities/pages/AssignedActivitiesPage";
import styles from "@/modules/resources/pages/ManageResourcesPage.module.css";

type ActivitiesTab = "my-activities" | "assign-activity" | "assigned-activities";

type Props = {
  config: TenantConfig;
};

function normalizeRole(value: string | null): StudioUserRole | null {
  if (value === "company" || value === "professional" || value === "individual") {
    return value;
  }
  return null;
}

function normalizeTab(value: string | null): ActivitiesTab {
  if (value === "assign-activity" || value === "assigned-activities") {
    return value;
  }
  return "my-activities";
}

const TAB_CONTEXT: Record<ActivitiesTab, string> = {
  "my-activities": "Track your own activities, statuses, and next actions from one place.",
  "assign-activity": "Assign published public resources to learners across your tenant workspace.",
  "assigned-activities": "Monitor activities you have assigned and open reports where available.",
};

export default function ActivitiesPage({ config }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = normalizeTab(searchParams.get("tab"));
  const [activeTab, setActiveTab] = useState<ActivitiesTab>(initialTab);
  const [role, setRole] = useState<StudioUserRole | null>(null);

  useEffect(() => {
    setRole(normalizeRole(sessionStorage.getItem("cs_role")));
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const canManageAssignments = role === "company" || role === "professional";

  useEffect(() => {
    if (role === "individual") {
      router.replace(`/${config.id}/my-activities`);
    }
  }, [config.id, role, router]);

  const currentPage = useMemo(() => {
    if (activeTab === "assign-activity") {
      return "programs";
    }
    if (activeTab === "assigned-activities") {
      return "events";
    }
    return "tools";
  }, [activeTab]);

  return (
    <div className={styles.wrapper}>
      <TenantViewAllHeader config={config} currentPage={currentPage} onSignInRegister={() => undefined} />

      <div className={styles.shell}>
        <section className={styles.heroCard}>
          <h1 className={styles.title}>Activities</h1>
          <p className={styles.subtitle}>{TAB_CONTEXT[activeTab]}</p>

          <div className={styles.tabBar} role="tablist" aria-label="Activities tabs">
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "my-activities" ? styles.active : ""}`}
              onClick={() => setActiveTab("my-activities")}
              role="tab"
              id="activities-tab-my"
              aria-selected={activeTab === "my-activities"}
              aria-controls="activities-panel-my"
            >
              My Activities
            </button>
            {canManageAssignments ? (
              <>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === "assign-activity" ? styles.active : ""}`}
                  onClick={() => setActiveTab("assign-activity")}
                  role="tab"
                  id="activities-tab-assign"
                  aria-selected={activeTab === "assign-activity"}
                  aria-controls="activities-panel-assign"
                >
                  Assign Activities
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${activeTab === "assigned-activities" ? styles.active : ""}`}
                  onClick={() => setActiveTab("assigned-activities")}
                  role="tab"
                  id="activities-tab-assigned"
                  aria-selected={activeTab === "assigned-activities"}
                  aria-controls="activities-panel-assigned"
                >
                  Assigned Activities
                </button>
              </>
            ) : null}
          </div>
        </section>

        <section className={styles.contentCard}>
          <div className={styles.content}>
            {activeTab === "my-activities" ? (
              <div role="tabpanel" id="activities-panel-my" aria-labelledby="activities-tab-my">
                <MyActivitiesPage tenantConfig={config} showHeader={false} embedded />
              </div>
            ) : null}

            {activeTab === "assign-activity" && canManageAssignments ? (
              <div role="tabpanel" id="activities-panel-assign" aria-labelledby="activities-tab-assign">
                <AssignActivitiesPage tenantId={config.id} config={config} showHeader={false} embedded />
              </div>
            ) : null}

            {activeTab === "assigned-activities" && canManageAssignments ? (
              <div role="tabpanel" id="activities-panel-assigned" aria-labelledby="activities-tab-assigned">
                <AssignedActivitiesPage tenantConfig={config} showHeader={false} embedded />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
