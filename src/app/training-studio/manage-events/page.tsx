import { config } from "@/tenants/training-studio/config";
import ManageEventsPage from "@/modules/events/pages/ManageEventsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioManageEventsRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ManageEventsPage config={config} />
    </TenantGate>
  );
}
