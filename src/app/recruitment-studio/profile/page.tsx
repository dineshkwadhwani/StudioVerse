import ProfilePage from "@/modules/app-shell/ProfilePage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioProfilePage() {
  return <ProfilePage tenantConfig={config} />;
}
