import ManageWalletPage from "@/modules/app-shell/ManageWalletPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioManageWalletRoutePage() {
  return <ManageWalletPage tenantConfig={config} />;
}
