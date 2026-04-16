import ManageCohortsPage from "@/modules/app-shell/ManageCohortsPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioManageCohortsRoutePage() {
  return <ManageCohortsPage tenantConfig={config} />;
}
