import { config } from "@/tenants/coaching-studio/config";
import CoachingEventsPage from "@/modules/coaching-studio/CoachingEventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioEventsPage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <CoachingEventsPage config={config} />
    </TenantGate>
  );
}
