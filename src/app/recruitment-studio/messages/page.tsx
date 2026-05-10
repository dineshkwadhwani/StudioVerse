import MessagesPage from "@/modules/app-shell/MessagesPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioMessagesRoutePage() {
  return <MessagesPage tenantConfig={config} />;
}
