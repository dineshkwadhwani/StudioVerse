import Link from "next/link";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioPrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px", fontFamily: "sans-serif" }}>
      <h1>{config.name} Privacy Policy</h1>
      <p>This privacy policy page is shared and tenant-branded. Full legal copy can be added per tenant.</p>
      <Link href={`/${config.id}`}>Back to {config.name}</Link>
    </main>
  );
}
