import type { Metadata } from "next";
import { config } from "@/tenants/coaching-studio/config";
import BotWidget from "@/modules/bot/BotWidgetNoSSR";
import { TenantProvider } from "@/lib/tenant/context";
import { BrandingProvider } from "@/lib/tenant/BrandingProvider";
import { buildTenantMetadata } from "@/lib/tenant/seo";

export const metadata: Metadata = buildTenantMetadata(config);

export default function CoachingStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider tenantConfig={config}>
      <BrandingProvider>
        {children}
        <BotWidget currentUser={null} />
      </BrandingProvider>
    </TenantProvider>
  );
}
