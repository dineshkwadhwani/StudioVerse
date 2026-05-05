import ViewProfilePage from "@/modules/profile/pages/ViewProfilePage";
import { config } from "@/tenants/recruitment-studio/config";

export default async function RecruitmentStudioViewProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  return <ViewProfilePage tenantConfig={config} profileId={profileId} />;
}
