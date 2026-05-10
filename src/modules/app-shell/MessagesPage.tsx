import type { TenantConfig } from "@/types/tenant";
import TenantMessagesPage from "@/modules/messages/pages/MessagesPage";

type Props = { tenantConfig: TenantConfig };

export default function MessagesPage({ tenantConfig }: Props) {
  return <TenantMessagesPage tenantConfig={tenantConfig} />;
}
