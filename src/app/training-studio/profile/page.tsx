import ProfilePage from "@/modules/app-shell/ProfilePage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioProfilePage() {
  return <ProfilePage tenantConfig={config} />;
}
