import { config } from "@/tenants/training-studio/config";
import EventsPage from "@/modules/app-shell/EventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioEventsPage() {
  return (
    <TenantGate rootContext="training-studio">
      <EventsPage tenantConfig={config} />
    </TenantGate>
  );
}
