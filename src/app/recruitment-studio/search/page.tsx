import SearchPage from "@/modules/app-shell/SearchPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioSearchRoutePage() {
  return <SearchPage tenantConfig={config} />;
}
