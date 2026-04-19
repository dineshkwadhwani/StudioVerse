import { config } from "@/tenants/recruitment-studio/config";
import RequestCoinsPage from "@/modules/wallet/pages/RequestCoinsPage";

export const metadata = {
  title: "Request Coins - Recruitment Studio",
};

export default function Page() {
  return <RequestCoinsPage tenantConfig={config} />;
}
