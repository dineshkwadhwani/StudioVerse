"use client";

import { useState } from "react";
import type { TenantConfig } from "@/types/tenant";
import ManageProgramsPage from "@/modules/programs/pages/ManageProgramsPage";
import ManageEventsPage from "@/modules/events/pages/ManageEventsPage";
import ManageAssessmentsPage from "@/modules/assessments/pages/ManageAssessmentsPage";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import styles from "./ManageResourcesPage.module.css";

type ResourceTab = "programs" | "events" | "assessments";

const TAB_CONTEXT: Record<ResourceTab, string> = {
  programs: "Manage program resources, publishing status, and visibility in your workspace.",
  events: "Manage events, schedules, publishing status, and visibility in your workspace.",
  assessments: "Manage assessment resources, structure, and publishing controls in your workspace.",
};

type Props = {
  config: TenantConfig;
  showAssessments?: boolean;
};

export default function ManageResourcesPage({ config, showAssessments = false }: Props) {
  const [activeTab, setActiveTab] = useState<ResourceTab>("programs");
  const currentPage = activeTab === "assessments" ? "tools" : activeTab;

  return (
    <div className={styles.wrapper}>
      <TenantViewAllHeader
        config={config}
        currentPage={currentPage}
        onSignInRegister={() => undefined}
      />

      <div className={styles.shell}>
        <section className={styles.heroCard}>
          <h1 className={styles.title}>Manage Resources</h1>
          <p className={styles.subtitle}>{TAB_CONTEXT[activeTab]}</p>

          <div className={styles.tabBar} role="tablist" aria-label="Resource types">
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "programs" ? styles.active : ""}`}
              onClick={() => setActiveTab("programs")}
              role="tab"
              id="manage-resources-tab-programs"
              aria-selected={activeTab === "programs"}
              aria-controls="manage-resources-panel-programs"
            >
              Programs
            </button>
            <button
              type="button"
              className={`${styles.tab} ${activeTab === "events" ? styles.active : ""}`}
              onClick={() => setActiveTab("events")}
              role="tab"
              id="manage-resources-tab-events"
              aria-selected={activeTab === "events"}
              aria-controls="manage-resources-panel-events"
            >
              Events
            </button>
            {showAssessments && (
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "assessments" ? styles.active : ""}`}
                onClick={() => setActiveTab("assessments")}
                role="tab"
                id="manage-resources-tab-assessments"
                aria-selected={activeTab === "assessments"}
                aria-controls="manage-resources-panel-assessments"
              >
                Assessments
              </button>
            )}
          </div>
        </section>

        <section className={styles.contentCard}>
          <div className={styles.content}>
            {activeTab === "programs" && (
              <div
                role="tabpanel"
                id="manage-resources-panel-programs"
                aria-labelledby="manage-resources-tab-programs"
              >
                <ManageProgramsPage config={config} showHeader={false} />
              </div>
            )}
            {activeTab === "events" && (
              <div
                role="tabpanel"
                id="manage-resources-panel-events"
                aria-labelledby="manage-resources-tab-events"
              >
                <ManageEventsPage config={config} showHeader={false} />
              </div>
            )}
            {activeTab === "assessments" && showAssessments && (
              <div
                role="tabpanel"
                id="manage-resources-panel-assessments"
                aria-labelledby="manage-resources-tab-assessments"
              >
                <ManageAssessmentsPage config={config} showHeader={false} />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
