import ManageReferralsPage from "@/modules/app-shell/ManageReferralsPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioManageReferralsRoutePage() {
  return <ManageReferralsPage tenantConfig={config} />;
}
