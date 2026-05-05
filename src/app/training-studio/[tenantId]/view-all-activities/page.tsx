import ViewAllActivitiesPage from "@/modules/activities/pages/ViewAllActivitiesPage";
import { TENANT_CONFIG } from "@/tenants/training-studio/config";

export const metadata = {
  title: "View All Activities | Training Studio",
};

type Props = {
  params: Promise<{
    tenantId: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { tenantId } = await params;

  return (
    <ViewAllActivitiesPage
      tenantId={tenantId}
      config={TENANT_CONFIG}
      showHeader={false}
    />
  );
}
