import { config } from "@/tenants/recruitment-studio/config";
import BuyCoinsPage from "@/modules/wallet/pages/BuyCoinsPage";

export const metadata = {
  title: "Buy Coins - Recruitment Studio",
};

export default function Page() {
  return <BuyCoinsPage tenantId={config.id} />;
}
