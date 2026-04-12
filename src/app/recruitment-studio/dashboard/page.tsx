import DashboardPage from "@/modules/app-shell/DashboardPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioDashboardPage() {
  return <DashboardPage tenantConfig={config} />;
}
