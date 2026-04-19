import type { ActivityType } from "@/types/assignment";

type SendAssignmentEmailArgs = {
  assigneeEmail: string;
  assigneeName: string;
  activityType: ActivityType;
  activityTitle: string;
};

type SendAssignmentEmailResult = {
  success: boolean;
  message: string;
};

type SendReferralInviteEmailArgs = {
  referredEmail: string;
  referredPhone: string;
  referredType: "coach" | "individual";
  tenantId: string;
  referrerName: string;
};

type SendReferralReminderEmailArgs = {
  referralId: string;
  referredEmail: string;
  referredPhone: string;
  referredType: "coach" | "individual";
  tenantId: string;
};

// Placeholder utility until real mail provider is integrated.
export async function sendAssignmentEmail(
  args: SendAssignmentEmailArgs
): Promise<SendAssignmentEmailResult> {
  void args;
  return {
    success: true,
    message: "Mail sent",
  };
}

export async function sendReferralInviteEmail(
  args: SendReferralInviteEmailArgs
): Promise<SendAssignmentEmailResult> {
  void args;
  return {
    success: true,
    message: "Referral invite mail placeholder triggered",
  };
}

export async function sendReferralReminderEmail(
  args: SendReferralReminderEmailArgs
): Promise<SendAssignmentEmailResult> {
  void args;
  return {
    success: true,
    message: "Referral reminder mail placeholder triggered",
  };
}
