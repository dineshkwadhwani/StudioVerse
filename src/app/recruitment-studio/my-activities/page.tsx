import MyActivitiesPage from "@/modules/app-shell/MyActivitiesPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioMyActivitiesRoutePage() {
  return <MyActivitiesPage tenantConfig={config} />;
}
