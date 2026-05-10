import SearchPage from "@/modules/app-shell/SearchPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioSearchRoutePage() {
  return <SearchPage tenantConfig={config} />;
}
