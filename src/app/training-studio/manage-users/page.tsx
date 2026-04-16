import ManageUsersPage from "@/modules/app-shell/ManageUsersPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioManageUsersRoutePage() {
  return <ManageUsersPage tenantConfig={config} />;
}
