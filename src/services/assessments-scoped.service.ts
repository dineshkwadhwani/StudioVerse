/**
 * Scope-aware Assessment service for role-based filtering
 * Used by Manage Assessments pages to show user-appropriate assessments
 */

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import { getUserById, listManagedUsersForCompany } from "@/services/manage-users.service";
import type { AssessmentRecord } from "@/types/assessment";

export type UserScopeContext = {
  userId: string;
  role: "superadmin" | "company" | "professional" | "individual";
  tenantId: string;
};

/**
 * Get assessments visible to a user based on their role and ownership
 * 
 * SuperAdmin: All assessments in the tenant
 * Company: Assessments owned by company + assessments owned by their coaches
 * Professional (with company): Assessments they own + assessments owned by their company
 * Professional (solo): Assessments they own only
 * Individual: Empty list (individuals don't manage assessments)
 */
export async function getScopedAssessments(
  context: UserScopeContext,
  options?: {
    filterByOwnershipOnly?: boolean; // If true, only show owned/managed, not view-all
  }
): Promise<AssessmentRecord[]> {
  // Individuals cannot manage assessments
  if (context.role === "individual") {
    return [];
  }

  const snapshot = await getDocs(collection(db, "assessments"));
  const allAssessments = snapshot.docs
    .map((row) => ({ id: row.id, ...(row.data() as Omit<AssessmentRecord, "id">) }))
    .filter((row) => row.tenantId === context.tenantId);

  // SuperAdmin sees all assessments
  if (context.role === "superadmin") {
    return allAssessments;
  }

  // For company and professional, need to fetch user details
  const userRecord = await getUserById(context.userId);
  if (!userRecord) {
    return [];
  }

  if (context.role === "company") {
    const managedUsers = await listManagedUsersForCompany({
      tenantId: context.tenantId,
      companyId: userRecord.id,
    });
    const coachIds = new Set(
      managedUsers
        .filter((row) => row.userType === "professional")
        .map((row) => row.id)
    );

    return allAssessments.filter((assessment) => {
      if (assessment.ownershipScope === "tenant") {
        return assessment.ownerEntityId === userRecord.id;
      }
      if (assessment.ownershipScope === "professional") {
        return Boolean(assessment.ownerEntityId && coachIds.has(assessment.ownerEntityId));
      }
      return false;
    });
  }

  if (context.role === "professional") {
    const associatedCompanyId = userRecord.associatedCompanyId?.trim();
    return allAssessments.filter((assessment) => {
      if (assessment.ownershipScope === "professional") {
        return assessment.ownerEntityId === userRecord.id;
      }
      if (assessment.ownershipScope === "tenant") {
        if (associatedCompanyId) {
          return assessment.ownerEntityId === associatedCompanyId;
        }
        return false;
      }
      return false;
    });
  }

  return [];
}

/**
 * Check if a user owns/can edit a specific assessment
 */
export function canUserEditAssessment(
  assessment: AssessmentRecord,
  context: UserScopeContext
): boolean {
  if (context.role === "superadmin") {
    return true;
  }

  if (assessment.createdBy === context.userId) {
    return true;
  }

  return false;
}

/**
 * Check if a user can try/assign an assessment (i.e., doesn't own it)
 */
export function canUserTryOrAssignAssessment(
  assessment: AssessmentRecord,
  context: UserScopeContext
): boolean {
  // Users who don't own can try/assign
  return !canUserEditAssessment(assessment, context);
}
