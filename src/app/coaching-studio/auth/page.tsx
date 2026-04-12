import AuthPage from "@/modules/app-shell/AuthPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioAuthPage() {
  return <AuthPage tenantConfig={config} />;
}
