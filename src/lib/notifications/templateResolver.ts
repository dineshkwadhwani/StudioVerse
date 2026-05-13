import type { NotificationCategory } from "@/constants/notifications";
import { getTenantConfigById } from "@/tenants";
import type { NotificationTemplate, NotificationTemplateMap } from "@/types/notification.types";
import coachingNotificationTemplates from "@/tenants/coaching-studio/notification-templates.json";
import trainingNotificationTemplates from "@/tenants/training-studio/notification-templates.json";
import recruitmentNotificationTemplates from "@/tenants/recruitment-studio/notification-templates.json";

const DEFAULT_TENANT_ID = "coaching-studio";

const TEMPLATE_MAP_BY_TENANT: Record<string, NotificationTemplateMap> = {
  "coaching-studio": coachingNotificationTemplates as NotificationTemplateMap,
  "training-studio": trainingNotificationTemplates as NotificationTemplateMap,
  "recruitment-studio": recruitmentNotificationTemplates as NotificationTemplateMap,
};

export function getTenantDisplayName(tenantId: string): string {
  return getTenantConfigById(tenantId)?.name ?? tenantId;
}

export function resolveTemplateMapForTenant(tenantId: string): NotificationTemplateMap {
  return TEMPLATE_MAP_BY_TENANT[tenantId] ?? TEMPLATE_MAP_BY_TENANT[DEFAULT_TENANT_ID];
}

export function resolveTemplateForTenant(
  tenantId: string,
  notificationType: NotificationCategory | string,
): NotificationTemplate | undefined {
  const tenantTemplates = resolveTemplateMapForTenant(tenantId);
  const fallbackTemplates = TEMPLATE_MAP_BY_TENANT[DEFAULT_TENANT_ID];
  return tenantTemplates[notificationType] ?? fallbackTemplates[notificationType];
}
