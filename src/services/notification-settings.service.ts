import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { createDefaultNotificationSettings, type NotificationCategory, NOTIFICATION_CATEGORIES } from "@/constants/notifications";
import type { NotificationToggleSettings } from "@/types/notification.types";

function normalizeTenantId(tenantId: string): string {
  return tenantId.trim();
}

function normalizeStoredToggles(raw: unknown): NotificationToggleSettings {
  const defaults = createDefaultNotificationSettings();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const source = raw as Record<string, unknown>;
  for (const key of NOTIFICATION_CATEGORIES) {
    if (typeof source[key] === "boolean") {
      defaults[key] = source[key] as boolean;
    }
  }

  return defaults;
}

export async function getTenantNotificationSettings(tenantId: string): Promise<NotificationToggleSettings> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return createDefaultNotificationSettings();
  }

  const tenantSnap = await getDoc(doc(db, "tenants", normalizedTenantId));
  const rawToggles = tenantSnap.data()?.notificationSettings?.toggles as unknown;
  return normalizeStoredToggles(rawToggles);
}

export async function saveTenantNotificationSettings(args: {
  tenantId: string;
  toggles: NotificationToggleSettings;
  updatedBy: string;
}): Promise<void> {
  const normalizedTenantId = normalizeTenantId(args.tenantId);
  if (!normalizedTenantId) {
    throw new Error("tenantId is required.");
  }

  const normalizedToggles = normalizeStoredToggles(args.toggles);

  await setDoc(
    doc(db, "tenants", normalizedTenantId),
    {
      notificationSettings: {
        toggles: normalizedToggles,
        updatedBy: args.updatedBy,
        updatedAt: serverTimestamp(),
      },
      updatedBy: args.updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function isNotificationEnabled(tenantId: string, notificationType: NotificationCategory): Promise<boolean> {
  const settings = await getTenantNotificationSettings(tenantId);
  return settings[notificationType] !== false;
}
