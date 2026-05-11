import { config } from "@/tenants/coaching-studio/config";
import CreateEventPage from "@/modules/events/pages/CreateEventPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioCreateEventRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <CreateEventPage config={config} />
    </TenantGate>
  );
}
