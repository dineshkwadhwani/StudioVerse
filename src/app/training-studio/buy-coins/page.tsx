import { config } from "@/tenants/training-studio/config";
import BuyCoinsPage from "@/modules/wallet/pages/BuyCoinsPage";

export const metadata = {
  title: "Buy Coins - Training Studio",
};

export default function Page() {
  return <BuyCoinsPage tenantId={config.id} />;
}
