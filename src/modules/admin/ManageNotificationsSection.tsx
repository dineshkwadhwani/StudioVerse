"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import styles from "./SuperAdminPortal.module.css";
import {
  createDefaultNotificationReminderDays,
  NOTIFICATION_CATEGORY_DEFINITIONS,
  createDefaultNotificationSettings,
  type NotificationCategory,
  type NotificationDomain,
} from "@/constants/notifications";
import {
  getTenantNotificationConfig,
  saveTenantNotificationSettings,
} from "@/services/notification-settings.service";
import type { NotificationReminderCategory, NotificationReminderDaysSettings } from "@/types/notification.types";

type TenantRecord = {
  id: string;
  tenantId: string;
  tenantName: string;
  domainName: string;
  rootContext: string;
  status: "active" | "inactive";
  landingConfig?: Record<string, unknown>;
  walletConfig?: Record<string, unknown>;
  mailConfig?: Record<string, unknown>;
  botConfig?: Record<string, unknown>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type ManageNotificationsSectionProps = {
  tenants: TenantRecord[];
  operatorId: string;
};

const REMINDER_DAY_CATEGORY_SET = new Set<NotificationReminderCategory>([
  "botHeroExpiringSoon",
  "promotionExpiringSoon",
  "listingExpiringSoon",
]);

type ReminderInputState = Record<NotificationReminderCategory, string>;

function formatReminderDaysInput(reminderDays: NotificationReminderDaysSettings): ReminderInputState {
  const defaults = createDefaultNotificationReminderDays();

  return {
    botHeroExpiringSoon: (reminderDays.botHeroExpiringSoon ?? defaults.botHeroExpiringSoon ?? []).join(","),
    promotionExpiringSoon: (reminderDays.promotionExpiringSoon ?? defaults.promotionExpiringSoon ?? []).join(","),
    listingExpiringSoon: (reminderDays.listingExpiringSoon ?? defaults.listingExpiringSoon ?? []).join(","),
  };
}

function parseReminderDaysInput(value: string): number[] {
  const entries = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error("Reminder days are required.");
  }

  const parsed = entries.map((item) => Number(item));
  if (parsed.some((item) => !Number.isInteger(item) || item <= 0)) {
    throw new Error("Reminder days must be positive whole numbers separated by commas.");
  }

  return Array.from(new Set(parsed.map((item) => Math.floor(item)))).sort((a, b) => b - a);
}

function isReminderDayCategory(key: NotificationCategory): key is NotificationReminderCategory {
  return REMINDER_DAY_CATEGORY_SET.has(key as NotificationReminderCategory);
}

export default function ManageNotificationsSection({
  tenants,
  operatorId,
}: ManageNotificationsSectionProps) {
  const activeTenants = useMemo(
    () => tenants.filter((tenant) => tenant.status === "active").sort((a, b) => a.tenantName.localeCompare(b.tenantName)),
    [tenants]
  );
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [toggles, setToggles] = useState(createDefaultNotificationSettings());
  const [reminderDays, setReminderDays] = useState<ReminderInputState>(formatReminderDaysInput(createDefaultNotificationReminderDays()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (activeTenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(activeTenants[0].tenantId);
    }
  }, [activeTenants]);

  useEffect(() => {
    if (!selectedTenantId) {
      setToggles(createDefaultNotificationSettings());
      setReminderDays(formatReminderDaysInput(createDefaultNotificationReminderDays()));
      return;
    }

    let cancelled = false;
    async function loadSettings(): Promise<void> {
      setLoading(true);
      setError("");
      setInfo("");

      try {
        const settings = await getTenantNotificationConfig(selectedTenantId);
        if (!cancelled) {
          setToggles(settings.toggles);
          setReminderDays(formatReminderDaysInput(settings.reminderDays));
        }
      } catch (loadError) {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load tenant notification settings.";
          setError(message);
          setToggles(createDefaultNotificationSettings());
          setReminderDays(formatReminderDaysInput(createDefaultNotificationReminderDays()));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId]);

  async function saveSettings(): Promise<void> {
    if (!selectedTenantId) {
      setError("Please select a tenant.");
      return;
    }

    setSaving(true);
    setError("");
    setInfo("");

    try {
      const normalizedReminderDays: NotificationReminderDaysSettings = {
        botHeroExpiringSoon: parseReminderDaysInput(reminderDays.botHeroExpiringSoon),
        promotionExpiringSoon: parseReminderDaysInput(reminderDays.promotionExpiringSoon),
        listingExpiringSoon: parseReminderDaysInput(reminderDays.listingExpiringSoon),
      };

      await saveTenantNotificationSettings({
        tenantId: selectedTenantId,
        toggles,
        reminderDays: normalizedReminderDays,
        updatedBy: operatorId,
      });
      setReminderDays(formatReminderDaysInput(normalizedReminderDays));
      setInfo("Notification settings saved.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save notification settings.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function updateToggle(key: NotificationCategory, value: boolean): void {
    setToggles((prev) => ({ ...prev, [key]: value }));
  }

  function updateReminderDays(key: NotificationReminderCategory, value: string): void {
    setReminderDays((prev) => ({ ...prev, [key]: value }));
  }

  const groupedByDomain = useMemo(() => {
    const domains = new Map<NotificationDomain, Array<(typeof NOTIFICATION_CATEGORY_DEFINITIONS)[number]>>();
    NOTIFICATION_CATEGORY_DEFINITIONS.forEach((entry) => {
      if (!domains.has(entry.domain)) {
        domains.set(entry.domain, []);
      }
      const items = domains.get(entry.domain);
      if (items) {
        items.push(entry);
      }
    });
    return domains;
  }, []);

  const domainLabels: Record<NotificationDomain, string> = {
    onboarding: "🎓 Onboarding",
    assignments: "📋 Assignments",
    cohorts: "👥 Cohorts",
    promotion: "⭐ Promotions",
    botHero: "🤖 Bot Hero",
    wallet: "💰 Wallet & Credits",
    referrals: "🔗 Referrals",
    adminAlerts: "🚨 Admin Alerts",
    messages: "✉️ Messages",
  };

  const domainOrder: NotificationDomain[] = [
    "onboarding",
    "assignments",
    "cohorts",
    "referrals",
    "promotion",
    "botHero",
    "wallet",
    "adminAlerts",
  ];

  return (
    <article className={styles.card}>
      <h2>Notifications</h2>
      <p className={styles.subtitle}>
        Configure tenant-level email notification toggles. These settings are checked before every notification send.
      </p>

      <label className={styles.label} htmlFor="notification-tenant-select">
        Tenant
      </label>
      <select
        id="notification-tenant-select"
        className={styles.select}
        value={selectedTenantId}
        onChange={(event) => setSelectedTenantId(event.target.value)}
        disabled={loading || saving || activeTenants.length === 0}
      >
        {activeTenants.length === 0 ? <option value="">No active tenants</option> : null}
        {activeTenants.map((tenant) => (
          <option key={tenant.id} value={tenant.tenantId}>
            {tenant.tenantName} ({tenant.tenantId})
          </option>
        ))}
      </select>

      <div className={styles.userStack} style={{ marginTop: 12 }}>
        {domainOrder.map((domain) => {
          const domainItems = groupedByDomain.get(domain) ?? [];
          if (domainItems.length === 0) return null;

          return (
            <div key={domain} style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#333" }}>
                {domainLabels[domain] || domain}
              </h3>
              <div className={styles.userStack}>
                {domainItems.map((entry) => {
                  const reminderKey = isReminderDayCategory(entry.key) ? entry.key : null;

                  return (
                    <section key={entry.key} className={styles.userItem}>
                      <div>
                        <p className={styles.userName}>{entry.label}</p>
                        <p className={styles.userMeta}>{entry.description}</p>
                        {reminderKey ? (
                          <div style={{ marginTop: 10, maxWidth: 260 }}>
                            <label className={styles.label} htmlFor={`${reminderKey}-reminder-days`} style={{ marginBottom: 6, fontSize: 12 }}>
                              Expiry Reminder Days
                            </label>
                            <input
                              id={`${reminderKey}-reminder-days`}
                              className={styles.input}
                              value={reminderDays[reminderKey]}
                              onChange={(event) => updateReminderDays(reminderKey, event.target.value)}
                              disabled={loading || saving || !selectedTenantId}
                              placeholder="1,2,3"
                            />
                            <p className={styles.userMeta}>Comma-separated days before expiry, for example 1,2,3.</p>
                          </div>
                        ) : null}
                      </div>
                      <div className={styles.userActions}>
                        <label className={styles.radioPill}>
                          <input
                            type="checkbox"
                            checked={toggles[entry.key] !== false}
                            onChange={(event) => updateToggle(entry.key, event.target.checked)}
                            disabled={loading || saving || !selectedTenantId}
                          />
                          Enabled
                        </label>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ghostButton}
          onClick={() => {
            setToggles(createDefaultNotificationSettings());
            setReminderDays(formatReminderDaysInput(createDefaultNotificationReminderDays()));
          }}
          disabled={saving || loading}
        >
          Reset Defaults
        </button>
        <button type="button" className={styles.button} onClick={() => void saveSettings()} disabled={saving || loading || !selectedTenantId}>
          {saving ? "Saving..." : "Save Notification Settings"}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {info ? <p className={styles.info}>{info}</p> : null}
    </article>
  );
}
