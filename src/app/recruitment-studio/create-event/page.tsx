import { config } from "@/tenants/recruitment-studio/config";
import CreateEventPage from "@/modules/events/pages/CreateEventPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioCreateEventRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <CreateEventPage config={config} />
    </TenantGate>
  );
}
