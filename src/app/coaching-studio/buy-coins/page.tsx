import { config } from "@/tenants/coaching-studio/config";
import BuyCoinsPage from "@/modules/wallet/pages/BuyCoinsPage";

export const metadata = {
  title: "Buy Coins - Coaching Studio",
};

export default function Page() {
  return <BuyCoinsPage tenantId={config.id} />;
}
