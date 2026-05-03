import {
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { type NotificationCategory } from "@/constants/notifications";
import type { NotificationDeliveryStatus } from "@/types/notification.types";

export type NotificationLogFilter = {
  fromDate?: string;
  toDate?: string;
  notificationType?: NotificationCategory | "all";
  tenantId?: string | "all";
  recipientEmailSearch?: string;
};

export type NotificationLogListRecord = {
  id: string;
  tenantId: string;
  notificationType: string;
  recipientEmail: string;
  recipientName: string;
  status: NotificationDeliveryStatus;
  reason: string;
  providerMessageId: string;
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
    return ((value as { toDate: () => Date }).toDate());
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

function mapNotificationLog(id: string, data: DocumentData): NotificationLogListRecord {
  const metadata = data.metadata;
  return {
    id,
    tenantId: String(data.tenantId ?? "").trim(),
    notificationType: String(data.notificationType ?? "").trim(),
    recipientEmail: String(data.recipientEmail ?? "").trim(),
    recipientName: String(data.recipientName ?? "").trim(),
    status: (String(data.status ?? "failed") as NotificationDeliveryStatus),
    reason: String(data.reason ?? "").trim(),
    providerMessageId: String(data.providerMessageId ?? "").trim(),
    metadata: typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {},
    createdAt: asDate(data.createdAt),
  };
}

export async function listNotificationLogs(filters: NotificationLogFilter): Promise<NotificationLogListRecord[]> {
  const constraints: QueryConstraint[] = [];

  const fromTs = toFromTimestamp(filters.fromDate);
  if (fromTs) {
    constraints.push(where("createdAt", ">=", fromTs));
  }

  const toTs = toToTimestamp(filters.toDate);
  if (toTs) {
    constraints.push(where("createdAt", "<=", toTs));
  }

  if (filters.notificationType && filters.notificationType !== "all") {
    constraints.push(where("notificationType", "==", filters.notificationType));
  }

  if (filters.tenantId && filters.tenantId !== "all") {
    constraints.push(where("tenantId", "==", filters.tenantId));
  }

  const logsRef = collection(db, "notificationLogs");
  const logsQuery = constraints.length > 0 ? query(logsRef, ...constraints) : query(logsRef);
  const snap = await getDocs(logsQuery);

  const normalizedEmailSearch = String(filters.recipientEmailSearch ?? "").trim().toLowerCase();

  return snap.docs
    .map((entry) => mapNotificationLog(entry.id, entry.data()))
    .filter((record) => {
      if (!normalizedEmailSearch) {
        return true;
      }

      return record.recipientEmail.toLowerCase().includes(normalizedEmailSearch);
    })
    .sort((a, b) => {
      const left = a.createdAt ? a.createdAt.getTime() : 0;
      const right = b.createdAt ? b.createdAt.getTime() : 0;
      return right - left;
    });
}
