import ManageReferralsPage from "@/modules/app-shell/ManageReferralsPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioManageReferralsRoutePage() {
  return <ManageReferralsPage tenantConfig={config} />;
}
