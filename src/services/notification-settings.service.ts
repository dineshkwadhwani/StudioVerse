import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import {
  createDefaultNotificationReminderDays,
  createDefaultNotificationSettings,
  NOTIFICATION_REMINDER_DAY_DEFAULTS,
  type NotificationCategory,
  NOTIFICATION_CATEGORIES,
} from "@/constants/notifications";
import type {
  NotificationReminderCategory,
  NotificationReminderDaysSettings,
  NotificationSettingsRecord,
  NotificationToggleSettings,
} from "@/types/notification.types";

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

function normalizeReminderDaysEntry(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) {
    return [...fallback];
  }

  const normalized = Array.from(
    new Set(
      raw
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
        .map((value) => Math.floor(value))
    )
  ).sort((a, b) => b - a);

  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeStoredReminderDays(raw: unknown): NotificationReminderDaysSettings {
  const defaults = createDefaultNotificationReminderDays();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const source = raw as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(NOTIFICATION_REMINDER_DAY_DEFAULTS) as Array<[NotificationReminderCategory, number[]]>) {
    defaults[key] = normalizeReminderDaysEntry(source[key], fallback);
  }

  return defaults;
}

export async function getTenantNotificationConfig(tenantId: string): Promise<NotificationSettingsRecord> {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!normalizedTenantId) {
    return {
      tenantId: "",
      toggles: createDefaultNotificationSettings(),
      reminderDays: createDefaultNotificationReminderDays(),
    };
  }

  const tenantSnap = await getDoc(doc(db, "tenants", normalizedTenantId));
  const notificationSettings = tenantSnap.data()?.notificationSettings as Record<string, unknown> | undefined;

  return {
    tenantId: normalizedTenantId,
    toggles: normalizeStoredToggles(notificationSettings?.toggles),
    reminderDays: normalizeStoredReminderDays(notificationSettings?.reminderDays),
    updatedBy: typeof notificationSettings?.updatedBy === "string" ? notificationSettings.updatedBy : undefined,
    updatedAt: notificationSettings?.updatedAt,
  };
}

export async function getTenantNotificationSettings(tenantId: string): Promise<NotificationToggleSettings> {
  const settings = await getTenantNotificationConfig(tenantId);
  return settings.toggles;
}

export async function saveTenantNotificationSettings(args: {
  tenantId: string;
  toggles: NotificationToggleSettings;
  reminderDays?: NotificationReminderDaysSettings;
  updatedBy: string;
}): Promise<void> {
  const normalizedTenantId = normalizeTenantId(args.tenantId);
  if (!normalizedTenantId) {
    throw new Error("tenantId is required.");
  }

  const normalizedToggles = normalizeStoredToggles(args.toggles);
  const normalizedReminderDays = normalizeStoredReminderDays(args.reminderDays);

  await setDoc(
    doc(db, "tenants", normalizedTenantId),
    {
      notificationSettings: {
        toggles: normalizedToggles,
        reminderDays: normalizedReminderDays,
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
