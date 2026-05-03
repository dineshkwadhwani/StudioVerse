import type { NotificationDomain, NotificationToggleSettings } from "@/types/notification.types";

export type { NotificationDomain };

export const NOTIFICATION_CATEGORY_DEFINITIONS = [
  { key: "onboardingWelcome", label: "Onboarding: Welcome", domain: "onboarding", description: "Send welcome email to the newly registered user." },
  { key: "onboardingActivation", label: "Onboarding: Activation", domain: "onboarding", description: "Send activation email to the auto-provisioned user." },
  { key: "managedUserWelcome", label: "Onboarding: Managed User Welcome", domain: "onboarding", description: "Send welcome email to the user created by a Company or Professional." },
  { key: "assignmentCreated", label: "Assignments: Created", domain: "assignments", description: "Send assignment email to the assignee when an assignment is created." },
  { key: "assignmentInProgress", label: "Assignments: In Progress", domain: "assignments", description: "Send status email to the assigner when an assignment moves to in progress." },
  { key: "assignmentCompleted", label: "Assignments: Completed", domain: "assignments", description: "Send status email to the assigner when an assignment is completed." },
  { key: "assignmentCancelled", label: "Assignments: Cancelled", domain: "assignments", description: "Send status email to the assigner when an assignment is cancelled." },
  { key: "cohortMemberAdded", label: "Cohorts: Member Added", domain: "cohorts", description: "Send email to the member who was added to the cohort." },
  { key: "cohortMemberRemoved", label: "Cohorts: Member Removed", domain: "cohorts", description: "Send email to the member who was removed from the cohort." },
  { key: "promotionRequested", label: "Promotion: Requested", domain: "promotion", description: "Send confirmation email to the requester and alert email to Super Admin when a promotion request is submitted." },
  { key: "promotionApproved", label: "Promotion: Approved", domain: "promotion", description: "Send decision email to the requester when a promotion request is approved." },
  { key: "promotionDenied", label: "Promotion: Denied", domain: "promotion", description: "Send decision email to the requester when a promotion request is denied." },
  { key: "botHeroRequested", label: "Bot Hero: Requested", domain: "botHero", description: "Send confirmation email to the requester and alert email to Super Admin when a Bot Hero request is submitted." },
  { key: "botHeroApproved", label: "Bot Hero: Approved", domain: "botHero", description: "Send decision email to the requesting professional when a Bot Hero request is approved." },
  { key: "botHeroDenied", label: "Bot Hero: Denied", domain: "botHero", description: "Send decision email to the requesting professional when a Bot Hero request is denied." },
  { key: "botHeroExpiringSoon", label: "Bot Hero: Expiring Soon", domain: "botHero", description: "Send reminder email to the active Bot Hero professional before the end date." },
  { key: "coinRequestSubmitted", label: "Wallet: Coin Request Submitted", domain: "wallet", description: "Send confirmation email to the requesting professional when a coin request is submitted." },
  { key: "coinRequestApproved", label: "Wallet: Coin Request Approved", domain: "wallet", description: "Send decision email to the requester when a coin request is approved." },
  { key: "coinRequestDenied", label: "Wallet: Coin Request Denied", domain: "wallet", description: "Send decision email to the requester when a coin request is denied." },
  { key: "cashoutRequested", label: "Wallet: Cashout Requested", domain: "wallet", description: "Send confirmation email to the requester and alert email to Super Admin when a cashout is requested." },
  { key: "cashoutApproved", label: "Wallet: Cashout Approved", domain: "wallet", description: "Send decision email to the requester when a cashout is approved." },
  { key: "cashoutDenied", label: "Wallet: Cashout Denied", domain: "wallet", description: "Send decision email to the requester when a cashout is denied." },
  { key: "registrationBonusIssued", label: "Wallet: Registration Bonus Issued", domain: "wallet", description: "Send wallet email to the user who received the registration bonus." },
  { key: "referralInviteSent", label: "Referrals: Invite Sent", domain: "referrals", description: "Send invite email to the referred contact." },
  { key: "referralReminderSent", label: "Referrals: Reminder Sent", domain: "referrals", description: "Send reminder email to the referred contact." },
  { key: "referralJoined", label: "Referrals: Joined", domain: "referrals", description: "Send update email to the referrer when the referred user joins." },
  { key: "adminCashoutAlert", label: "Admin Alert: Cashout", domain: "adminAlerts", description: "Send alert email to Super Admin about a new cashout request." },
  { key: "adminBotHeroAlert", label: "Admin Alert: Bot Hero", domain: "adminAlerts", description: "Send alert email to Super Admin about a new Bot Hero request." },
  { key: "adminPromotionAlert", label: "Admin Alert: Promotion", domain: "adminAlerts", description: "Send alert email to Super Admin about a new promotion request." },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  domain: NotificationDomain;
  description: string;
}>;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_DEFINITIONS)[number]["key"];

export const NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORY_DEFINITIONS.map((item) => item.key) as NotificationCategory[];

export function createDefaultNotificationSettings(): NotificationToggleSettings {
  return NOTIFICATION_CATEGORIES.reduce<NotificationToggleSettings>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}
