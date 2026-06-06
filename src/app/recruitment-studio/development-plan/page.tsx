import { getStudioConfig } from "@/config/studio";
import DevelopmentPlansPage from "@/modules/development/pages/DevelopmentPlansPage";

const config = getStudioConfig("recruitment");

export default function RecruitmentStudioDevelopmentPlanRoutePage() {
  return <DevelopmentPlansPage tenantConfig={config} />;
}