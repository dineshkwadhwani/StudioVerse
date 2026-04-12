import { config } from "@/tenants/recruitment-studio/config";
import EventsPage from "@/modules/app-shell/EventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioEventsPage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <EventsPage tenantConfig={config} />
    </TenantGate>
  );
}
