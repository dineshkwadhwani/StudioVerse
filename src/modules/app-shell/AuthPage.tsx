import Image from "next/image";
import Link from "next/link";
import type { TenantConfig } from "@/types/tenant";
import AuthWizard from "@/modules/coaching-studio/auth/AuthWizard";

type Props = {
  tenantConfig: TenantConfig;
};

export default function AuthPage({ tenantConfig }: Props) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eaf6ff 0%, #dcecf8 48%, #e8f5ff 100%)",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Image src="/sv_logo.png" alt="StudioVerse" width={40} height={40} style={{ borderRadius: 10, border: "1px solid #c6dcea", background: "#fff" }} />
            <div>
              <div style={{ fontWeight: 800, color: "#133a56" }}>{tenantConfig.name}</div>
              <div style={{ fontSize: "0.85rem", color: "#4d6e86" }}>Login / Registration</div>
            </div>
          </div>

          <Link href={`/${tenantConfig.id}`} style={{ color: "#1f5c9c", fontWeight: 700, textDecoration: "none" }}>
            Back to landing page
          </Link>
        </header>

        <section
          style={{
            maxWidth: 760,
            margin: "0 auto",
            background: "#fff",
            border: "1px solid #c6dcea",
            borderRadius: 28,
            boxShadow: "0 18px 36px rgba(19, 58, 86, 0.14)",
            padding: "24px",
          }}
        >
          <h1 style={{ margin: 0, color: "#133a56" }}>Sign In / Register</h1>
          <p style={{ color: "#4d6e86", marginTop: 8 }}>
            Verify your mobile number, complete your profile, and continue to your {tenantConfig.name} dashboard.
          </p>
          <AuthWizard tenantConfig={tenantConfig} />
        </section>
      </div>
    </main>
  );
}
