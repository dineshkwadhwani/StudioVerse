/**
 * Scope-aware Event service for role-based filtering
 * Used by Manage Events pages to show user-appropriate events
 */

import { listEvents } from "@/services/events.service";
import { getUserById, listManagedUsersForCompany } from "@/services/manage-users.service";
import type { EventRecord } from "@/types/event";

export type UserScopeContext = {
  userId: string;
  role: "superadmin" | "company" | "professional" | "individual";
  tenantId: string;
};

/**
 * Get events visible to a user based on their role and ownership
 * 
 * SuperAdmin: All events in the tenant
 * Company: Events owned by company + events owned by their coaches
 * Professional (with company): Events they own + events owned by their company
 * Professional (solo): Events they own only
 * Individual: Empty list (individuals don't manage events)
 */
export async function getScopedEvents(
  context: UserScopeContext,
  options?: {
    filterByOwnershipOnly?: boolean; // If true, only show owned/managed, not view-all
  }
): Promise<EventRecord[]> {
  // Individuals cannot manage events
  if (context.role === "individual") {
    return [];
  }

  // Fetch all published + draft events for the tenant
  const allEvents = await listEvents(context.tenantId);

  // SuperAdmin sees all events
  if (context.role === "superadmin") {
    return allEvents;
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

    return allEvents.filter((event) => {
      if (event.ownershipScope === "company") {
        return event.ownerEntityId === userRecord.id;
      }
      if (event.ownershipScope === "professional") {
        return Boolean(event.ownerEntityId && coachIds.has(event.ownerEntityId));
      }
      return false;
    });
  }

  if (context.role === "professional") {
    const associatedCompanyId = userRecord.associatedCompanyId?.trim();

    return allEvents.filter((event) => {
      if (event.ownershipScope === "professional") {
        return event.ownerEntityId === userRecord.id;
      }

      if (event.ownershipScope === "company") {
        if (associatedCompanyId) {
          return event.ownerEntityId === associatedCompanyId;
        }
        return false;
      }

      return false;
    });
  }

  return [];
}

/**
 * Check if a user owns/can edit a specific event
 */
export function canUserEditEvent(
  event: EventRecord,
  context: UserScopeContext
): boolean {
  if (context.role === "superadmin") {
    return true;
  }

  if (event.createdBy === context.userId) {
    return true;
  }

  return false;
}

/**
 * Check if a user can try/assign an event (i.e., doesn't own it)
 */
export function canUserTryOrAssignEvent(
  event: EventRecord,
  context: UserScopeContext
): boolean {
  // Users who don't own can try/assign
  return !canUserEditEvent(event, context);
}
