import AuthPage from "@/modules/app-shell/AuthPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioAuthPage() {
  return <AuthPage tenantConfig={config} />;
}
