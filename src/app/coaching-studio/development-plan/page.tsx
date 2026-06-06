import { getStudioConfig } from "@/config/studio";
import DevelopmentPlansPage from "@/modules/development/pages/DevelopmentPlansPage";

const config = getStudioConfig("coaching");

export default function CoachingStudioDevelopmentPlanRoutePage() {
  return <DevelopmentPlansPage tenantConfig={config} />;
}