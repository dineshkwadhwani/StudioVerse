// Re-export barrel — canonical menu config lives in @/modules/activities/config/menuConfig.
export {
  getRoleLabel,
  getRoleMenuItems,
  getRoleMenuGroups,
} from "@/modules/activities/config/menuConfig";

export type {
  StudioUserRole,
  StudioMenuItem,
  StudioMenuGroup,
  StudioMenuGroupName,
  CoachingUserRole,
  CoachingMenuItem,
} from "@/modules/activities/config/menuConfig";
