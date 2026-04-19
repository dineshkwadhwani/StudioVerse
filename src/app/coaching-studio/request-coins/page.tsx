import { config } from "@/tenants/coaching-studio/config";
import RequestCoinsPage from "@/modules/wallet/pages/RequestCoinsPage";

export const metadata = {
  title: "Request Coins - Coaching Studio",
};

export default function Page() {
  return <RequestCoinsPage tenantConfig={config} />;
}
