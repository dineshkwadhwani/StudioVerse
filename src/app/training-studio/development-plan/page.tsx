import { getStudioConfig } from "@/config/studio";
import DevelopmentPlansPage from "@/modules/development/pages/DevelopmentPlansPage";

const config = getStudioConfig("training");

export default function TrainingStudioDevelopmentPlanRoutePage() {
  return <DevelopmentPlansPage tenantConfig={config} />;
}