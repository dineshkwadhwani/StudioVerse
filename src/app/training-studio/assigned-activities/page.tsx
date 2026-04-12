import AssignedActivitiesPage from "@/modules/app-shell/AssignedActivitiesPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioAssignedActivitiesRoutePage() {
  return <AssignedActivitiesPage tenantConfig={config} />;
}
