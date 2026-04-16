import ManageCohortsPage from "@/modules/app-shell/ManageCohortsPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioManageCohortsRoutePage() {
  return <ManageCohortsPage tenantConfig={config} />;
}
