import { config } from "@/tenants/training-studio/config";
import BotWidget from "@/modules/bot/BotWidget";

export default function TrainingStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BotWidget tenantConfig={config} currentUser={null} />
    </>
  );
}
