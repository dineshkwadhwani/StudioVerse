import type { TenantConfig } from "@/types/tenant";
import TenantEventsPage from "@/modules/coaching-studio/CoachingEventsPage";

type Props = { tenantConfig: TenantConfig };

export default function EventsPage({ tenantConfig }: Props) {
  return <TenantEventsPage config={tenantConfig} />;
}
