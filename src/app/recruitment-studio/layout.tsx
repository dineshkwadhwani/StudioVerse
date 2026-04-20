import { config } from "@/tenants/recruitment-studio/config";
import BotWidget from "@/modules/bot/BotWidget";

export default function RecruitmentStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BotWidget tenantConfig={config} currentUser={null} />
    </>
  );
}
