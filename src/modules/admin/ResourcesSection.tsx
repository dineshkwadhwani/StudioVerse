"use client";

import { useState } from "react";
import ProgramsSection from "./ProgramsSection";
import EventsSection from "./EventsSection";
import AssessmentsSection from "./AssessmentsSection";
import styles from "./ResourcesSection.module.css";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type ResourcesSectionProps = {
  tenants?: TenantOption[];
};

type ResourceTab = "programs" | "events" | "assessments";

const TAB_CONTEXT: Record<ResourceTab, string> = {
  programs: "Manage program resources, publishing status, and visibility across tenants.",
  events: "Manage event resources, schedules, and publishing controls across tenants.",
  assessments: "Manage assessment resources, structure, and publishing controls across tenants.",
};

export default function ResourcesSection({ tenants }: ResourcesSectionProps) {
  const [activeTab, setActiveTab] = useState<ResourceTab>("programs");

  return (
    <div className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Manage Resources</h2>
        <p className={styles.contextText}>{TAB_CONTEXT[activeTab]}</p>

        <div className={styles.tabBar} role="tablist" aria-label="Resource types">
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "programs" ? styles.active : ""}`}
            onClick={() => setActiveTab("programs")}
            role="tab"
            id="resources-tab-programs"
            aria-selected={activeTab === "programs"}
            aria-controls="resources-panel-programs"
          >
            Programs
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "events" ? styles.active : ""}`}
            onClick={() => setActiveTab("events")}
            role="tab"
            id="resources-tab-events"
            aria-selected={activeTab === "events"}
            aria-controls="resources-panel-events"
          >
            Events
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "assessments" ? styles.active : ""}`}
            onClick={() => setActiveTab("assessments")}
            role="tab"
            id="resources-tab-assessments"
            aria-selected={activeTab === "assessments"}
            aria-controls="resources-panel-assessments"
          >
            Assessments
          </button>
        </div>
      </section>

      <section className={styles.contentCard}>
        <div className={styles.content}>
          {activeTab === "programs" && (
            <div
              role="tabpanel"
              id="resources-panel-programs"
              aria-labelledby="resources-tab-programs"
            >
              <ProgramsSection tenants={tenants} />
            </div>
          )}
          {activeTab === "events" && (
            <div
              role="tabpanel"
              id="resources-panel-events"
              aria-labelledby="resources-tab-events"
            >
              <EventsSection tenants={tenants} />
            </div>
          )}
          {activeTab === "assessments" && (
            <div
              role="tabpanel"
              id="resources-panel-assessments"
              aria-labelledby="resources-tab-assessments"
            >
              <AssessmentsSection tenants={tenants} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
