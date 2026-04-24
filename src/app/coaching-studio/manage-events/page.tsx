import { config } from "@/tenants/coaching-studio/config";
import ManageEventsPage from "@/modules/events/pages/ManageEventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioManageEventsRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ManageEventsPage config={config} />
    </TenantGate>
  );
}
