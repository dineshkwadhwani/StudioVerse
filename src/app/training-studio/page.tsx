import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioPage() {
  return (
    <TenantGate rootContext="training-studio">
      <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
        <h1>Training Studio</h1>
        <p>Landing page content coming soon.</p>
      </main>
    </TenantGate>
  );
}