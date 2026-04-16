import ManageUsersPage from "@/modules/app-shell/ManageUsersPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioManageUsersRoutePage() {
  return <ManageUsersPage tenantConfig={config} />;
}
