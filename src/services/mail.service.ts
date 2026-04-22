import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { getTenantConfigById } from "@/tenants";
import type { ActivityType } from "@/types/assignment";

type SendAssignmentEmailArgs = {
  tenantId: string;
  mailConfig: TenantMailConfig;
  assignerName: string;
  assigneeEmail: string;
  assigneeName: string;
  activityType: ActivityType;
  activityTitle: string;
};

type SendAssignmentEmailResult = {
  success: boolean;
  message: string;
  skipped?: boolean;
  providerMessageId?: string;
};

type SendReferralInviteEmailArgs = {
  mailConfig: TenantMailConfig;
  referredEmail: string;
  referredPhone: string;
  referredType: "coach" | "individual";
  tenantId: string;
  referrerName: string;
};

type SendReferralReminderEmailArgs = {
  mailConfig: TenantMailConfig;
  referralId: string;
  referredEmail: string;
  referredPhone: string;
  referredType: "coach" | "individual";
  tenantId: string;
};

export type TenantMailConfig = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
};

type SendTenantEmailArgs = {
  mailConfig: TenantMailConfig;
  name: string;
  email: string;
  subject: string;
  body: string;
};

type MailApiResponse = {
  ok?: boolean;
  messageId?: string;
  error?: string;
  detail?: string;
};

const DEFAULT_MAIL_CONFIG: TenantMailConfig = {
  enabled: false,
  fromEmail: "",
  fromName: "",
};

const DEFAULT_ASSIGNMENT_SUBJECT = "Coaching Studio : An activity has been assigned";
const DEFAULT_ASSIGNMENT_BODY = [
  "Dear {{assigneeName}}",
  "An activity has been assigned to you by {{assignerName}}. Please log in to Coaching Studio (www.coachingstudio.in) to complete the activity.",
  "",
  "Coaching Studio Team.",
].join("\n");

function renderMailTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => values[key] ?? "");
}

export async function getTenantMailConfig(tenantId: string): Promise<TenantMailConfig> {
  if (!tenantId.trim()) {
    return DEFAULT_MAIL_CONFIG;
  }

  const tenantSnap = await getDoc(doc(db, "tenants", tenantId.trim()));
  const mailData = tenantSnap.data()?.mailConfig as
    | { enabled?: unknown; fromEmail?: unknown; fromName?: unknown }
    | undefined;

  return {
    enabled: Boolean(mailData?.enabled),
    fromEmail: String(mailData?.fromEmail ?? "").trim(),
    fromName: String(mailData?.fromName ?? "").trim(),
  };
}

export async function sendTenantEmail(args: SendTenantEmailArgs): Promise<SendAssignmentEmailResult> {
  const mailConfig = args.mailConfig;

  if (!mailConfig.enabled) {
    return {
      success: true,
      skipped: true,
      message: "Mail is disabled for this tenant.",
    };
  }

  if (!mailConfig.fromEmail || !mailConfig.fromName) {
    return {
      success: false,
      message: "Tenant mail sender is not configured. Please set From Email and From Name in Manage Tenant.",
    };
  }

  const response = await fetch("/api/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toEmail: args.email,
      toName: args.name,
      fromEmail: mailConfig.fromEmail,
      fromName: mailConfig.fromName,
      subject: args.subject,
      body: args.body,
    }),
  });

  const data = (await response.json()) as MailApiResponse;
  if (!response.ok || !data.ok) {
    return {
      success: false,
      message: `Mail send failed: ${data.error ?? "Unknown error"}${data.detail ? ` (${data.detail})` : ""}`,
    };
  }

  return {
    success: true,
    message: "Mail sent",
    providerMessageId: data.messageId,
  };
}

export async function sendAssignmentEmail(
  args: SendAssignmentEmailArgs
): Promise<SendAssignmentEmailResult> {
  const tenantConfig = getTenantConfigById(args.tenantId);
  const template = tenantConfig?.mailTemplates?.assignmentNotification;

  const subjectTemplate = template?.subject ?? DEFAULT_ASSIGNMENT_SUBJECT;
  const bodyTemplate = template?.body ?? DEFAULT_ASSIGNMENT_BODY;

  const subject = renderMailTemplate(subjectTemplate, {
    assigneeName: args.assigneeName,
    assignerName: args.assignerName,
    activityTitle: args.activityTitle,
    activityType: args.activityType,
  });

  const body = renderMailTemplate(bodyTemplate, {
    assigneeName: args.assigneeName,
    assignerName: args.assignerName,
    activityTitle: args.activityTitle,
    activityType: args.activityType,
  });

  return sendTenantEmail({
    mailConfig: args.mailConfig,
    name: args.assigneeName,
    email: args.assigneeEmail,
    subject,
    body,
  });
}

export async function sendReferralInviteEmail(
  args: SendReferralInviteEmailArgs
): Promise<SendAssignmentEmailResult> {
  const referredRoleLabel = args.referredType === "coach" ? "coach" : "individual";
  const subject = "You have been referred to StudioVerse";
  const body = [
    "Hi,",
    "",
    `${args.referrerName} has referred you as a ${referredRoleLabel}.`,
    `Tenant: ${args.tenantId}`,
    `Phone: ${args.referredPhone}`,
    "",
    "Please complete your registration to get started.",
  ].join("\n");

  return sendTenantEmail({
    mailConfig: args.mailConfig,
    name: args.referredEmail,
    email: args.referredEmail,
    subject,
    body,
  });
}

export async function sendReferralReminderEmail(
  args: SendReferralReminderEmailArgs
): Promise<SendAssignmentEmailResult> {
  const subject = "Reminder: complete your StudioVerse referral signup";
  const body = [
    "Hi,",
    "",
    `This is a reminder for referral ID ${args.referralId}.`,
    `Tenant: ${args.tenantId}`,
    `Role: ${args.referredType === "coach" ? "coach" : "individual"}`,
    `Phone: ${args.referredPhone}`,
    "",
    "Please finish your onboarding at the earliest.",
  ].join("\n");

  return sendTenantEmail({
    mailConfig: args.mailConfig,
    name: args.referredEmail,
    email: args.referredEmail,
    subject,
    body,
  });
}
