import ManageReferralsPage from "@/modules/app-shell/ManageReferralsPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioManageReferralsRoutePage() {
  return <ManageReferralsPage tenantConfig={config} />;
}
