import CoachingLandingPage from "@/modules/coaching-studio/CoachingLandingPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioPage() {
  return <CoachingLandingPage config={config} />;
}