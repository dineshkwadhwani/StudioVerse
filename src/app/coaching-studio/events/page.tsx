import { config } from "@/tenants/coaching-studio/config";
import EventsPage from "@/modules/app-shell/EventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioEventsPage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <EventsPage tenantConfig={config} />
    </TenantGate>
  );
}
