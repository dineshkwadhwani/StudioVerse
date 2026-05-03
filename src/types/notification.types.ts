export type NotificationDomain =
  | "onboarding"
  | "assignments"
  | "cohorts"
  | "promotion"
  | "botHero"
  | "wallet"
  | "referrals"
  | "adminAlerts";

export type NotificationDeliveryStatus = "sent" | "blocked" | "failed";

export type NotificationTemplate = {
  subject: string;
  body: string;
};

export type NotificationTemplateMap = Record<string, NotificationTemplate>;

export type NotificationToggleSettings = Record<string, boolean>;

export type NotificationSettingsRecord = {
  tenantId: string;
  toggles: NotificationToggleSettings;
  updatedBy?: string;
  updatedAt?: unknown;
};

export type NotificationLogRecord = {
  tenantId: string;
  notificationType: string;
  recipientEmail: string;
  recipientName?: string;
  status: NotificationDeliveryStatus;
  reason?: string;
  providerMessageId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: unknown;
};
