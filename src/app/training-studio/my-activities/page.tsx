import MyActivitiesPage from "@/modules/app-shell/MyActivitiesPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioMyActivitiesRoutePage() {
  return <MyActivitiesPage tenantConfig={config} />;
}
