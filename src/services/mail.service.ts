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

// Placeholder utility until real mail provider is integrated.
export async function sendAssignmentEmail(
  _args: SendAssignmentEmailArgs
): Promise<SendAssignmentEmailResult> {
  return {
    success: true,
    message: "Mail sent",
  };
}
