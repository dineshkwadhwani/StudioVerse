import AssignedActivitiesPage from "@/modules/app-shell/AssignedActivitiesPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioAssignedActivitiesRoutePage() {
  return <AssignedActivitiesPage tenantConfig={config} />;
}
