import { config } from "@/tenants/recruitment-studio/config";
import ManageAssessmentsPage from "@/modules/assessments/pages/ManageAssessmentsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioManageAssessmentsRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ManageAssessmentsPage config={config} />
    </TenantGate>
  );
}
