import type { TenantConfig } from "@/types/tenant";
import TenantManageUsersPage from "@/modules/users/pages/ManageUsersPage";

type Props = { tenantConfig: TenantConfig };

export default function ManageUsersPage({ tenantConfig }: Props) {
  return <TenantManageUsersPage tenantConfig={tenantConfig} />;
}
