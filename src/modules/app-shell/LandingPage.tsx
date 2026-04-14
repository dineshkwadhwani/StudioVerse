import type { TenantConfig } from "@/types/tenant";
import TenantLandingPage from "@/modules/landing/pages/LandingPage";

type Props = { tenantConfig: TenantConfig };

export default function LandingPage({ tenantConfig }: Props) {
  return <TenantLandingPage config={tenantConfig} />;
}
