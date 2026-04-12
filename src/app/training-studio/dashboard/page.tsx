import DashboardPage from "@/modules/app-shell/DashboardPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioDashboardPage() {
  return <DashboardPage tenantConfig={config} />;
}
