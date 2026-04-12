import AssignedActivitiesPage from "@/modules/app-shell/AssignedActivitiesPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioAssignedActivitiesRoutePage() {
  return <AssignedActivitiesPage tenantConfig={config} />;
}
