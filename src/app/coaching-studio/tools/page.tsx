"use client";

import { config } from "@/tenants/coaching-studio/config";
import { useState } from "react";
import CoachingViewAllHeader from "@/modules/coaching-studio/CoachingViewAllHeader";
import LoginRegisterModal from "@/modules/coaching-studio/auth/LoginRegisterModal";

export default function CoachingStudioToolsPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const toolsLabel = config.landingContent?.displayLabels?.tools ?? "Tools";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eaf6ff 0%, #dcecf8 48%, #e8f5ff 100%)",
      }}
    >
      <CoachingViewAllHeader
        config={config}
        currentPage="tools"
        onSignInRegister={() => setIsAuthModalOpen(true)}
      />

      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.25rem" }}>
        <h1 style={{ margin: 0, color: "#133a56" }}>{toolsLabel}</h1>
        <p style={{ color: "#4d6e86" }}>
          This is the View All page for {toolsLabel}. Catalog content is being integrated.
        </p>
      </section>

      <LoginRegisterModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </main>
  );
}
