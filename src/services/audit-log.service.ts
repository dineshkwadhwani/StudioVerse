import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const DEFAULT_AUDIT_ACTION_TYPES = [
  "assignment.created",
  "program.published",
  "report.generated",
  "tool.submitted",
  "user.role_changed",
] as const;

export type AuditActionTypeFilter = "all" | string;

export type AuditLogFilters = {
  tenantId?: string | "all";
  fromDate?: string;
  toDate?: string;
  actionType?: AuditActionTypeFilter;
  actorSearch?: string;
};

export type AuditLogRecord = {
  id: string;
  tenantId: string;
  actionType: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date | null;
};

function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }

  return null;
}

function toFromTimestamp(dateText?: string): Timestamp | null {
  if (!dateText) {
    return null;
  }

  const startDate = new Date(`${dateText}T00:00:00.000`);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  return Timestamp.fromDate(startDate);
}

function toToTimestamp(dateText?: string): Timestamp | null {
  if (!dateText) {
    return null;
  }

  const endDate = new Date(`${dateText}T23:59:59.999`);
  if (Number.isNaN(endDate.getTime())) {
    return null;
  }

  return Timestamp.fromDate(endDate);
}

function normalizeActionType(value: unknown): string {
  const rawAction = String(value ?? "").trim();
  return rawAction;
}

function extractActorNameFromMetadata(metadata: Record<string, unknown>): string {
  const candidateKeys = ["actorName", "performedBy", "createdByName", "operatorName", "userName", "name"];
  for (const key of candidateKeys) {
    const value = String(metadata[key] ?? "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function resolveUserDisplayName(data: Record<string, unknown>): string {
  return String(data.fullName ?? data.name ?? data.firstName ?? "").trim();
}

async function resolveActorNameById(actorId: string): Promise<string> {
  const normalizedActorId = actorId.trim();
  if (!normalizedActorId) {
    return "";
  }

  const directSnap = await getDoc(doc(db, "users", normalizedActorId));
  if (directSnap.exists()) {
    const directName = resolveUserDisplayName(directSnap.data() as Record<string, unknown>);
    if (directName) {
      return directName;
    }
  }

  const byUserIdSnap = await getDocs(query(collection(db, "users"), where("userId", "==", normalizedActorId), limit(1)));
  if (!byUserIdSnap.empty) {
    const byUserIdName = resolveUserDisplayName(byUserIdSnap.docs[0].data() as Record<string, unknown>);
    if (byUserIdName) {
      return byUserIdName;
    }
  }

  const byUidSnap = await getDocs(query(collection(db, "users"), where("uid", "==", normalizedActorId), limit(1)));
  if (!byUidSnap.empty) {
    const byUidName = resolveUserDisplayName(byUidSnap.docs[0].data() as Record<string, unknown>);
    if (byUidName) {
      return byUidName;
    }
  }

  return "";
}

async function buildActorNameMap(actorIds: string[]): Promise<Map<string, string>> {
  const uniqueActorIds = Array.from(new Set(actorIds.map((item) => item.trim()).filter(Boolean)));
  const resolvedEntries = await Promise.all(
    uniqueActorIds.map(async (actorId) => {
      const name = await resolveActorNameById(actorId);
      return [actorId, name] as const;
    })
  );

  return new Map<string, string>(resolvedEntries.filter((entry) => Boolean(entry[1])));
}

function mapAuditLog(id: string, data: DocumentData): AuditLogRecord {
  const metadata = data.metadata;
  const safeMetadata = typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {};
  const tenantId = String(data.tenantId ?? data.studioType ?? "").trim();
  const actionType = normalizeActionType(data.actionType ?? data.action);
  const actorName = String(data.actorName ?? data.performedBy ?? "").trim() || extractActorNameFromMetadata(safeMetadata);

  return {
    id,
    tenantId,
    actionType,
    actorId: String(data.actorId ?? data.createdBy ?? data.userId ?? "").trim(),
    actorName,
    actorRole: String(data.actorRole ?? "").trim(),
    entityType: String(data.entityType ?? data.targetType ?? "").trim(),
    entityId: String(data.entityId ?? data.targetId ?? "").trim(),
    metadata: safeMetadata,
    createdAt: asDate(data.createdAt),
  };
}

export async function listAuditLogs(filters: AuditLogFilters): Promise<AuditLogRecord[]> {
  const constraints: QueryConstraint[] = [];

  const fromTs = toFromTimestamp(filters.fromDate);
  if (fromTs) {
    constraints.push(where("createdAt", ">=", fromTs));
  }

  const toTs = toToTimestamp(filters.toDate);
  if (toTs) {
    constraints.push(where("createdAt", "<=", toTs));
  }

  const logsRef = collection(db, "auditLogs");
  const logsQuery = constraints.length > 0 ? query(logsRef, ...constraints) : query(logsRef);
  const snap = await getDocs(logsQuery);

  const normalizedActionType = String(filters.actionType ?? "all").trim().toLowerCase();
  const normalizedActorSearch = String(filters.actorSearch ?? "").trim().toLowerCase();
  const normalizedTenant = String(filters.tenantId ?? "all").trim();

  const mapped = snap.docs.map((entry) => mapAuditLog(entry.id, entry.data()));
  const actorNameById = await buildActorNameMap(
    mapped
      .filter((record) => !record.actorName && Boolean(record.actorId))
      .map((record) => record.actorId)
  );

  const enriched = mapped.map((record) => {
    if (record.actorName) {
      return record;
    }

    const resolvedName = actorNameById.get(record.actorId) ?? "";
    return {
      ...record,
      actorName: resolvedName,
    };
  });

  return enriched
    .filter((record) => {
      if (normalizedTenant === "all" || !normalizedTenant) {
        return true;
      }
      return record.tenantId === normalizedTenant;
    })
    .filter((record) => {
      if (!normalizedActionType || normalizedActionType === "all") {
        return true;
      }
      return record.actionType.toLowerCase() === normalizedActionType;
    })
    .filter((record) => {
      if (!normalizedActorSearch) {
        return true;
      }

      const actorNameValue = record.actorName.toLowerCase();
      if (actorNameValue.includes(normalizedActorSearch)) {
        return true;
      }

      // Fallback when legacy audit rows do not carry actor display names.
      return !record.actorName && record.actorId.toLowerCase().includes(normalizedActorSearch);
    })
    .sort((left, right) => {
      const leftValue = left.createdAt ? left.createdAt.getTime() : 0;
      const rightValue = right.createdAt ? right.createdAt.getTime() : 0;
      return rightValue - leftValue;
    });
}
