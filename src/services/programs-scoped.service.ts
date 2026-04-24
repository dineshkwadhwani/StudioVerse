/**
 * Scope-aware Program service for role-based filtering
 * Used by Manage Programs pages to show user-appropriate programs
 */

import { listPrograms } from "@/services/programs.service";
import { getUserById, listManagedUsersForCompany } from "@/services/manage-users.service";
import type { ProgramRecord } from "@/types/program";

export type UserScopeContext = {
  userId: string;
  role: "superadmin" | "company" | "professional" | "individual";
  tenantId: string;
};

/**
 * Get programs visible to a user based on their role and ownership
 * 
 * SuperAdmin: All programs in the tenant
 * Company: Programs owned by company + programs owned by their coaches
 * Professional (with company): Programs they own + programs owned by their company
 * Professional (solo): Programs they own only
 * Individual: Empty list (individuals don't manage programs)
 */
export async function getScopedPrograms(
  context: UserScopeContext,
  options?: {
    filterByOwnershipOnly?: boolean; // If true, only show owned/managed, not view-all
  }
): Promise<ProgramRecord[]> {
  // Individuals cannot manage programs
  if (context.role === "individual") {
    return [];
  }

  // Fetch all published + draft programs for the tenant
  const allPrograms = await listPrograms(context.tenantId);

  // SuperAdmin sees all programs
  if (context.role === "superadmin") {
    return allPrograms;
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

    return allPrograms.filter((program) => {
      if (program.ownershipScope === "company") {
        return program.ownerEntityId === userRecord.id;
      }
      if (program.ownershipScope === "professional") {
        return Boolean(program.ownerEntityId && coachIds.has(program.ownerEntityId));
      }
      return false;
    });
  }

  if (context.role === "professional") {
    const associatedCompanyId = userRecord.associatedCompanyId?.trim();

    return allPrograms.filter((program) => {
      if (program.ownershipScope === "professional") {
        return program.ownerEntityId === userRecord.id;
      }

      if (program.ownershipScope === "company") {
        // Associated coach can also manage company-owned programs.
        if (associatedCompanyId) {
          return program.ownerEntityId === associatedCompanyId;
        }
        return false;
      }

      return false;
    });
  }

  return [];
}

/**
 * Check if a user owns/can edit a specific program
 */
export function canUserEditProgram(
  program: ProgramRecord,
  context: UserScopeContext
): boolean {
  if (context.role === "superadmin") {
    return true;
  }

  if (program.createdBy === context.userId) {
    return true;
  }

  return false;
}

/**
 * Check if a user can try/assign a program (i.e., doesn't own it)
 */
export function canUserTryOrAssignProgram(
  program: ProgramRecord,
  context: UserScopeContext
): boolean {
  // Users who don't own can try/assign
  return !canUserEditProgram(program, context);
}
