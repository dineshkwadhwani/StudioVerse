import PromoteCoachRoutePage from "@/modules/bot/pages/PromoteCoachRoutePage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioPromoteCoachRoutePage() {
	return <PromoteCoachRoutePage tenantConfig={config} />;
}
