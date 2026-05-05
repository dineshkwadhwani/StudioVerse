import ViewProfilePage from "@/modules/profile/pages/ViewProfilePage";
import { config } from "@/tenants/training-studio/config";

export default async function TrainingStudioViewProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  return <ViewProfilePage tenantConfig={config} profileId={profileId} />;
}
