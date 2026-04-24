import { config } from "@/tenants/training-studio/config";
import ManageAssessmentsPage from "@/modules/assessments/pages/ManageAssessmentsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioManageAssessmentsRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ManageAssessmentsPage config={config} />
    </TenantGate>
  );
}
