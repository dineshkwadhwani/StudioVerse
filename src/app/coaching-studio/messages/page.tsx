import MessagesPage from "@/modules/app-shell/MessagesPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioMessagesRoutePage() {
  return <MessagesPage tenantConfig={config} />;
}
