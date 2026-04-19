import { config } from "@/tenants/training-studio/config";
import RequestCoinsPage from "@/modules/wallet/pages/RequestCoinsPage";

export const metadata = {
  title: "Request Coins - Training Studio",
};

export default function Page() {
  return <RequestCoinsPage tenantConfig={config} />;
}
