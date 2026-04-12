export type CoachingUserRole = "company" | "professional" | "individual";

export type CoachingMenuItem = {
  key: string;
  label: string;
  href: string;
};

const COMPANY_MENU: CoachingMenuItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/coaching-studio/dashboard" },
  { key: "update-profile", label: "Update Profile", href: "/coaching-studio/profile" },
  { key: "manage-users", label: "Manage Users", href: "/coaching-studio/dashboard" },
  { key: "manage-programs", label: "Manage Programs", href: "/coaching-studio/programs" },
  { key: "manage-events", label: "Manage Events", href: "/coaching-studio/events" },
  { key: "manage-wallet", label: "Manage Wallet", href: "/coaching-studio/manage-wallet" },
  { key: "manage-cohort", label: "Manage Cohort", href: "/coaching-studio/dashboard" },
  { key: "manage-individual", label: "Manage Individual", href: "/coaching-studio/dashboard" },
  { key: "assign-activity", label: "Assign Activity", href: "/coaching-studio/dashboard" },
  { key: "my-activities", label: "My activities", href: "/coaching-studio/my-activities" },
];

const PROFESSIONAL_MENU: CoachingMenuItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/coaching-studio/dashboard" },
  { key: "update-profile", label: "Update Profile", href: "/coaching-studio/profile" },
  { key: "manage-users", label: "Manage Users", href: "/coaching-studio/dashboard" },
  { key: "manage-programs", label: "Manage Programs", href: "/coaching-studio/programs" },
  { key: "manage-events", label: "Manage Events", href: "/coaching-studio/events" },
  { key: "manage-wallet", label: "Manage Wallet", href: "/coaching-studio/manage-wallet" },
  { key: "manage-cohort", label: "Manage Cohort", href: "/coaching-studio/dashboard" },
  { key: "manage-individual", label: "Manage Individual", href: "/coaching-studio/dashboard" },
  { key: "assign-activity", label: "Assign Activity", href: "/coaching-studio/dashboard" },
  { key: "my-activities", label: "My activities", href: "/coaching-studio/my-activities" },
];

const INDIVIDUAL_MENU: CoachingMenuItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/coaching-studio/dashboard" },
  { key: "update-profile", label: "Update Profile", href: "/coaching-studio/profile" },
  { key: "manage-wallet", label: "Manage Wallet", href: "/coaching-studio/manage-wallet" },
  { key: "assign-activity", label: "Assign Activity", href: "/coaching-studio/dashboard" },
  { key: "my-activities", label: "My activities", href: "/coaching-studio/my-activities" },
];

export function getRoleLabel(role: CoachingUserRole | null): string {
  if (role === "company") return "Coaching Company";
  if (role === "professional") return "Coach";
  if (role === "individual") return "Learner";
  return "Member";
}

export function getRoleMenuItems(role: CoachingUserRole | null): CoachingMenuItem[] {
  if (role === "company") return COMPANY_MENU;
  if (role === "professional") return PROFESSIONAL_MENU;
  if (role === "individual") return INDIVIDUAL_MENU;
  return INDIVIDUAL_MENU;
}
