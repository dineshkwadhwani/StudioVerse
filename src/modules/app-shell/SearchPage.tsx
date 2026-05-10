import type { TenantConfig } from "@/types/tenant";
import UniversalSearchPage from "@/modules/search/pages/UniversalSearchPage";

type Props = { tenantConfig: TenantConfig };

export default function SearchPage({ tenantConfig }: Props) {
  return <UniversalSearchPage tenantConfig={tenantConfig} />;
}
