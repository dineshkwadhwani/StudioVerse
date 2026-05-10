import SearchPage from "@/modules/app-shell/SearchPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioSearchRoutePage() {
  return <SearchPage tenantConfig={config} />;
}
