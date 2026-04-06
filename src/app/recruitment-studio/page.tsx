import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioPage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
        <h1>Recruitment Studio</h1>
        <p>Landing page content coming soon.</p>
      </main>
    </TenantGate>
  );
}