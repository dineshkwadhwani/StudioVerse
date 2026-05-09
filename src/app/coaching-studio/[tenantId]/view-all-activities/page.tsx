import ViewAllActivitiesPage from "@/modules/activities/pages/ViewAllActivitiesPage";
import { config } from "@/tenants/coaching-studio/config";

export const metadata = {
  title: "View All Activities | Coaching Studio",
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
      config={config}
      showHeader={false}
    />
  );
}
