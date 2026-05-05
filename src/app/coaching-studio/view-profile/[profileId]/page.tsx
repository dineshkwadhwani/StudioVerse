import ViewProfilePage from "@/modules/profile/pages/ViewProfilePage";
import { config } from "@/tenants/coaching-studio/config";

export default async function CoachingStudioViewProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  return <ViewProfilePage tenantConfig={config} profileId={profileId} />;
}
