import type { TenantConfig } from "@/types/tenant";
import TenantProgramsPage from "@/modules/coaching-studio/CoachingProgramsPage";

type Props = { tenantConfig: TenantConfig };

export default function ProgramsPage({ tenantConfig }: Props) {
  return <TenantProgramsPage config={tenantConfig} />;
}
