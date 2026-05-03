import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { type NotificationCategory } from "@/constants/notifications";
import coachingNotificationTemplates from "@/tenants/coaching-studio/notification-templates.json";
import { getTenantMailConfig, sendTenantEmail } from "@/services/mail.service";
import { isNotificationEnabled } from "@/services/notification-settings.service";
import type { NotificationDeliveryStatus, NotificationTemplateMap } from "@/types/notification.types";

type TemplateVars = Record<string, string | number | boolean | null | undefined>;

type SendNotificationEmailArgs = {
  tenantId: string;
  notificationType: NotificationCategory;
  recipientEmail: string;
  recipientName: string;
  templateVariables?: TemplateVars;
  metadata?: Record<string, unknown>;
};

type SendNotificationEmailResult = {
  success: boolean;
  skipped?: boolean;
  message: string;
  providerMessageId?: string;
};

type NotificationRecipient = {
  userId: string;
  name: string;
  email: string;
};

const TEMPLATE_MAP_BY_TENANT: Record<string, NotificationTemplateMap> = {
  "coaching-studio": coachingNotificationTemplates as NotificationTemplateMap,
};

function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function resolveTemplatesForTenant(tenantId: string): NotificationTemplateMap {
  return TEMPLATE_MAP_BY_TENANT[tenantId] ?? TEMPLATE_MAP_BY_TENANT["coaching-studio"];
}

function normalizeTenantId(tenantId: string): string {
  return tenantId.trim();
}

async function logNotificationEvent(args: {
  tenantId: string;
  notificationType: NotificationCategory;
  recipientEmail: string;
  recipientName: string;
  status: NotificationDeliveryStatus;
  reason?: string;
  providerMessageId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  console.log(`[DEBUG][notificationLog] Writing: status=${args.status} type=${args.notificationType} recipient=${args.recipientEmail} reason="${args.reason ?? ""}"`);
  try {
    const docRef = await addDoc(collection(db, "notificationLogs"), {
      tenantId: args.tenantId,
      notificationType: args.notificationType,
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName,
      status: args.status,
      reason: args.reason ?? "",
      providerMessageId: args.providerMessageId ?? "",
      metadata: args.metadata ?? {},
      createdAt: serverTimestamp(),
    });
    console.log(`[DEBUG][notificationLog] Written to Firestore id=${docRef.id}`);
  } catch (err) {
    console.error("[DEBUG][notificationLog] Firestore write FAILED:", err);
    // Logging is best-effort and must never block user workflow.
  }
}

export async function sendNotificationEmail(args: SendNotificationEmailArgs): Promise<SendNotificationEmailResult> {
  const tenantId = normalizeTenantId(args.tenantId);
  console.log(`[DEBUG][sendNotificationEmail] type=${args.notificationType} tenant=${tenantId} recipient=${args.recipientEmail}`);
  if (!tenantId) {
    return { success: false, message: "tenantId is required." };
  }

  const mailConfig = await getTenantMailConfig(tenantId);
  console.log(`[DEBUG][sendNotificationEmail] mailConfig.enabled=${mailConfig.enabled}`);
  if (!mailConfig.enabled) {
    await logNotificationEvent({
      tenantId,
      notificationType: args.notificationType,
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName,
      status: "blocked",
      reason: "Tenant mail sending is disabled.",
      metadata: args.metadata,
    });

    return {
      success: true,
      skipped: true,
      message: "Mail sending is disabled for this tenant.",
    };
  }

  const enabled = await isNotificationEnabled(tenantId, args.notificationType);
  if (!enabled) {
    await logNotificationEvent({
      tenantId,
      notificationType: args.notificationType,
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName,
      status: "blocked",
      reason: "Notification toggle disabled for tenant.",
      metadata: args.metadata,
    });

    return {
      success: true,
      skipped: true,
      message: `Notification ${args.notificationType} is disabled for this tenant.`,
    };
  }

  const templates = resolveTemplatesForTenant(tenantId);
  const template = templates[args.notificationType];

  const templateVariables: TemplateVars = {
    recipientName: args.recipientName || "User",
    tenantId,
    ...args.templateVariables,
  };

  const subject = template
    ? renderTemplate(template.subject, templateVariables)
    : `Notification: ${args.notificationType}`;
  const body = template
    ? renderTemplate(template.body, templateVariables)
    : `Dear ${args.recipientName || "User"},\n\nYou have a new notification in Coaching Studio.\n\nWarm regards,\nTeam Coaching Studio`;

  const sendResult = await sendTenantEmail({
    mailConfig,
    name: args.recipientName || args.recipientEmail,
    email: args.recipientEmail,
    subject,
    body,
  });

  await logNotificationEvent({
    tenantId,
    notificationType: args.notificationType,
    recipientEmail: args.recipientEmail,
    recipientName: args.recipientName,
    status: sendResult.skipped ? "blocked" : sendResult.success ? "sent" : "failed",
    reason: sendResult.message,
    providerMessageId: sendResult.providerMessageId,
    metadata: args.metadata,
  });

  return {
    success: sendResult.success,
    skipped: sendResult.skipped,
    message: sendResult.message,
    providerMessageId: sendResult.providerMessageId,
  };
}

function mapUserRecipient(id: string, data: Record<string, unknown>): NotificationRecipient | null {
  const email = String(data.email ?? "").trim().toLowerCase();
  if (!email) {
    return null;
  }

  return {
    userId: String(data.userId ?? data.uid ?? id).trim() || id,
    name: String(data.fullName ?? data.name ?? "User").trim() || "User",
    email,
  };
}

export async function resolveUserNotificationRecipient(args: {
  userId: string;
  tenantId?: string;
}): Promise<NotificationRecipient | null> {
  const normalizedUserId = args.userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  const directSnap = await getDoc(doc(db, "users", normalizedUserId));
  if (directSnap.exists()) {
    const mapped = mapUserRecipient(directSnap.id, directSnap.data() as Record<string, unknown>);
    if (mapped && (!args.tenantId || String((directSnap.data() as Record<string, unknown>).tenantId ?? "") === args.tenantId)) {
      return mapped;
    }
  }

  const byUserIdSnap = await getDocs(query(collection(db, "users"), where("userId", "==", normalizedUserId), limit(1)));
  if (!byUserIdSnap.empty) {
    const row = byUserIdSnap.docs[0];
    if (!args.tenantId || String(row.data().tenantId ?? "") === args.tenantId) {
      return mapUserRecipient(row.id, row.data() as Record<string, unknown>);
    }
  }

  const byUidSnap = await getDocs(query(collection(db, "users"), where("uid", "==", normalizedUserId), limit(1)));
  if (!byUidSnap.empty) {
    const row = byUidSnap.docs[0];
    if (!args.tenantId || String(row.data().tenantId ?? "") === args.tenantId) {
      return mapUserRecipient(row.id, row.data() as Record<string, unknown>);
    }
  }

  return null;
}

export async function sendNotificationToUser(args: {
  tenantId: string;
  userId: string;
  notificationType: NotificationCategory;
  templateVariables?: TemplateVars;
  metadata?: Record<string, unknown>;
}): Promise<SendNotificationEmailResult> {
  const recipient = await resolveUserNotificationRecipient({
    userId: args.userId,
    tenantId: args.tenantId,
  });

  if (!recipient) {
    return {
      success: false,
      message: `No email recipient found for user ${args.userId}.`,
    };
  }

  return sendNotificationEmail({
    tenantId: args.tenantId,
    notificationType: args.notificationType,
    recipientEmail: recipient.email,
    recipientName: recipient.name,
    templateVariables: {
      recipientName: recipient.name,
      ...args.templateVariables,
    },
    metadata: args.metadata,
  });
}

export async function sendAdminAlertToMasterSuperadmin(args: {
  tenantId: string;
  notificationType: Extract<NotificationCategory, "adminCashoutAlert" | "adminBotHeroAlert" | "adminPromotionAlert">;
  templateVariables?: TemplateVars;
  metadata?: Record<string, unknown>;
}): Promise<SendNotificationEmailResult> {
  const superadminSnap = await getDocs(
    query(collection(db, "users"), where("userType", "==", "superadmin"), limit(5))
  );

  const recipientRow = superadminSnap.docs.find((entry) => String(entry.data().status ?? "active") === "active")
    ?? superadminSnap.docs[0];

  if (!recipientRow) {
    return {
      success: false,
      message: "No active master superadmin recipient found.",
    };
  }

  const recipient = mapUserRecipient(recipientRow.id, recipientRow.data() as Record<string, unknown>);
  if (!recipient) {
    return {
      success: false,
      message: "Master superadmin email is not configured.",
    };
  }

  return sendNotificationEmail({
    tenantId: args.tenantId,
    notificationType: args.notificationType,
    recipientEmail: recipient.email,
    recipientName: recipient.name,
    templateVariables: {
      recipientName: recipient.name,
      ...args.templateVariables,
    },
    metadata: args.metadata,
  });
}
