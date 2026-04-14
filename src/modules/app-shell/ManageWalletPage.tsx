import type { TenantConfig } from "@/types/tenant";
import TenantManageWalletPage from "@/modules/wallet/pages/ManageWalletPage";

type Props = { tenantConfig: TenantConfig };

export default function ManageWalletPage({ tenantConfig }: Props) {
  return <TenantManageWalletPage tenantConfig={tenantConfig} />;
}
