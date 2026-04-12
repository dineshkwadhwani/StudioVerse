import type { TenantConfig } from "@/types/tenant";
import TenantManageWalletPage from "@/modules/coaching-studio/ManageWalletPage";

type Props = { tenantConfig: TenantConfig };

export default function ManageWalletPage({ tenantConfig }: Props) {
  return <TenantManageWalletPage tenantConfig={tenantConfig} />;
}
