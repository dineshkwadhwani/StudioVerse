import AuthPage from "@/modules/app-shell/AuthPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioAuthPage() {
  return <AuthPage tenantConfig={config} />;
}
