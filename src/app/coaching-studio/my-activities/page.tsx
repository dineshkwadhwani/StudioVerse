import MyActivitiesPage from "@/modules/app-shell/MyActivitiesPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioMyActivitiesRoutePage() {
  return <MyActivitiesPage tenantConfig={config} />;
}
