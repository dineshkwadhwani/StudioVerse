import ManageUsersPage from "@/modules/app-shell/ManageUsersPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioManageUsersRoutePage() {
  return <ManageUsersPage tenantConfig={config} />;
}
