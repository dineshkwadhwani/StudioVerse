import MessagesPage from "@/modules/app-shell/MessagesPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioMessagesRoutePage() {
  return <MessagesPage tenantConfig={config} />;
}
