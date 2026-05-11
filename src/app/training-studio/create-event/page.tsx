import { config } from "@/tenants/training-studio/config";
import CreateEventPage from "@/modules/events/pages/CreateEventPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioCreateEventRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <CreateEventPage config={config} />
    </TenantGate>
  );
}
