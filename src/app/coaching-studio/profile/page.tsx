import ProfilePage from "@/modules/app-shell/ProfilePage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioProfilePage() {
  return <ProfilePage tenantConfig={config} />;
}