export type StudioUserRole = "company" | "professional" | "individual";

export type StudioMenuItem = {
  key: string;
  label: string;
  href: string;
};

export type StudioMenuGroupName = "my-account" | "manage" | "actions";

export type StudioMenuGroup = {
  key: StudioMenuGroupName;
  label: string;
  items: StudioMenuItem[];
};

// Backward-compatible aliases for existing imports.
export type CoachingUserRole = StudioUserRole;
export type CoachingMenuItem = StudioMenuItem;

type MenuOptions = {
  basePath?: string;
};

type RoleLabels = {
  company: string;
  professional: string;
  individual: string;
};

const DEFAULT_BASE_PATH = "/coaching-studio";

const DEFAULT_ROLE_LABELS: RoleLabels = {
  company: "Coaching Company",
  professional: "Coach",
  individual: "Learner",
};

function buildPath(basePath: string, suffix: string): string {
  return `${basePath}${suffix}`;
}

function getCompanyMenu(basePath: string): StudioMenuGroup[] {
  return [
    {
      key: "my-account",
      label: "My Account",
      items: [
        { key: "dashboard", label: "Dashboard", href: buildPath(basePath, "/dashboard") },
        { key: "update-profile", label: "Profile", href: buildPath(basePath, "/profile") },
        { key: "manage-wallet", label: "Wallet", href: buildPath(basePath, "/manage-wallet") },
        { key: "manage-referrals", label: "References", href: buildPath(basePath, "/manage-referrals") },
      ],
    },
    {
      key: "manage",
      label: "Manage",
      items: [
        { key: "manage-users", label: "Users", href: buildPath(basePath, "/manage-users") },
        { key: "manage-programs", label: "Programs", href: buildPath(basePath, "/manage-programs") },
        { key: "manage-events", label: "Events", href: buildPath(basePath, "/manage-events") },
        { key: "manage-cohort", label: "Cohort", href: buildPath(basePath, "/manage-cohorts") },
      ],
    },
    {
      key: "actions",
      label: "Actions",
      items: [
        { key: "assign-activity", label: "Assign Activity", href: buildPath(basePath, "/dashboard") },
        { key: "assigned-activities", label: "Assigned Activities", href: buildPath(basePath, "/assigned-activities") },
        { key: "my-activities", label: "My activities", href: buildPath(basePath, "/my-activities") },
      ],
    },
  ];
}

function getProfessionalMenu(basePath: string): StudioMenuGroup[] {
  return [
    {
      key: "my-account",
      label: "My Account",
      items: [
        { key: "dashboard", label: "Dashboard", href: buildPath(basePath, "/dashboard") },
        { key: "update-profile", label: "Profile", href: buildPath(basePath, "/profile") },
        { key: "manage-wallet", label: "Wallet", href: buildPath(basePath, "/manage-wallet") },
        { key: "manage-referrals", label: "References", href: buildPath(basePath, "/manage-referrals") },
      ],
    },
    {
      key: "manage",
      label: "Manage",
      items: [
        { key: "manage-users", label: "Users", href: buildPath(basePath, "/manage-users") },
        { key: "manage-programs", label: "Programs", href: buildPath(basePath, "/manage-programs") },
        { key: "manage-events", label: "Events", href: buildPath(basePath, "/manage-events") },
        { key: "manage-cohort", label: "Cohort", href: buildPath(basePath, "/manage-cohorts") },
      ],
    },
    {
      key: "actions",
      label: "Actions",
      items: [
        { key: "assign-activity", label: "Assign Activity", href: buildPath(basePath, "/dashboard") },
        { key: "assigned-activities", label: "Assigned Activities", href: buildPath(basePath, "/assigned-activities") },
        { key: "my-activities", label: "My activities", href: buildPath(basePath, "/my-activities") },
      ],
    },
  ];
}

function getIndividualMenu(basePath: string): StudioMenuGroup[] {
  return [
    {
      key: "my-account",
      label: "My Account",
      items: [
        { key: "dashboard", label: "Dashboard", href: buildPath(basePath, "/dashboard") },
        { key: "update-profile", label: "Profile", href: buildPath(basePath, "/profile") },
        { key: "manage-wallet", label: "Wallet", href: buildPath(basePath, "/manage-wallet") },
        { key: "manage-referrals", label: "References", href: buildPath(basePath, "/manage-referrals") },
      ],
    },
    {
      key: "actions",
      label: "Actions",
      items: [
        { key: "my-activities", label: "My activities", href: buildPath(basePath, "/my-activities") },
      ],
    },
  ];
}

export function getRoleLabel(
  role: StudioUserRole | null,
  labels: RoleLabels = DEFAULT_ROLE_LABELS
): string {
  if (role === "company") return labels.company;
  if (role === "professional") return labels.professional;
  if (role === "individual") return labels.individual;
  return "Member";
}

export function getRoleMenuItems(
  role: StudioUserRole | null,
  options: MenuOptions = {}
): StudioMenuItem[] {
  return getRoleMenuGroups(role, options).flatMap((group) => group.items);
}

export function getRoleMenuGroups(
  role: StudioUserRole | null,
  options: MenuOptions = {}
): StudioMenuGroup[] {
  const basePath = options.basePath ?? DEFAULT_BASE_PATH;
  if (role === "company") return getCompanyMenu(basePath);
  if (role === "professional") return getProfessionalMenu(basePath);
  return getIndividualMenu(basePath);
}
