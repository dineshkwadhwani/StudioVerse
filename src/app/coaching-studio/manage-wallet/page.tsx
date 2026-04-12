import ManageWalletPage from "@/modules/app-shell/ManageWalletPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioManageWalletRoutePage() {
  return <ManageWalletPage tenantConfig={config} />;
}
