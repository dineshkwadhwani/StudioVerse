import { config } from "@/tenants/recruitment-studio/config";
import ManageEventsPage from "@/modules/events/pages/ManageEventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioManageEventsRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ManageEventsPage config={config} />
    </TenantGate>
  );
}
