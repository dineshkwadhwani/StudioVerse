import { config } from "@/tenants/coaching-studio/config";
import BotWidget from "@/modules/bot/BotWidget";

export default function CoachingStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BotWidget tenantConfig={config} currentUser={null} />
    </>
  );
}
