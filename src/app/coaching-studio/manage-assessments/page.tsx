import { config } from "@/tenants/coaching-studio/config";
import ManageAssessmentsPage from "@/modules/assessments/pages/ManageAssessmentsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioManageAssessmentsRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ManageAssessmentsPage config={config} />
    </TenantGate>
  );
}
