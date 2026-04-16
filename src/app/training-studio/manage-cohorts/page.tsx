import ManageCohortsPage from "@/modules/app-shell/ManageCohortsPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioManageCohortsRoutePage() {
  return <ManageCohortsPage tenantConfig={config} />;
}
