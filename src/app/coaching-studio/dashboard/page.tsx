import DashboardPage from "@/modules/app-shell/DashboardPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioDashboardPage() {
  return <DashboardPage tenantConfig={config} />;
}
