import ManageWalletPage from "@/modules/app-shell/ManageWalletPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioManageWalletRoutePage() {
  return <ManageWalletPage tenantConfig={config} />;
}
