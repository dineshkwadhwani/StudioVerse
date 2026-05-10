"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShellHeader, { useAuthedSession } from "@/modules/app-shell/AppShellHeader";
import type { TenantConfig } from "@/types/tenant";
import {
  listInboxMessages,
  listOutboxMessages,
  unlockMessage,
} from "@/services/messages.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import type { MessageRecord } from "@/types/message";

type Props = { tenantConfig: TenantConfig };
type Tab = "inbox" | "outbox";

export default function MessagesPage({ tenantConfig }: Props) {
  const { session, loading, error } = useAuthedSession({ tenantConfig });
  const [tab, setTab] = useState<Tab>("inbox");
  const [inbox, setInbox] = useState<MessageRecord[]>([]);
  const [outbox, setOutbox] = useState<MessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<MessageRecord | null>(null);
  const [unlockingId, setUnlockingId] = useState("");
  const [unlockError, setUnlockError] = useState("");

  const tenantId = tenantConfig.id;
  const userId = session?.uid ?? "";

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setLoadError("");
    void (async () => {
      try {
        const profileId = session?.profileId;
        const lookupIds = [userId, ...(profileId ? [profileId] : [])];
        const [inboxRows, outboxRows, wallet] = await Promise.all([
          listInboxMessages({ tenantId, receiverUserId: userId }),
          listOutboxMessages({ tenantId, senderUserId: userId }),
          getWalletForUserContext(lookupIds, tenantId),
        ]);
        if (cancelled) return;
        setInbox(inboxRows);
        setOutbox(outboxRows);
        setWalletBalance(wallet?.availableCoins ?? 0);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load messages.");
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, userId, session?.profileId]);

  const inboxUnreadCount = inbox.filter((m) => !m.readAt).length;

  async function handleUnlock(message: MessageRecord): Promise<void> {
    setUnlockingId(message.id);
    setUnlockError("");
    try {
      const result = await unlockMessage({ messageId: message.id });
      setInbox((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, isLocked: false, unlockFeeCoins: result.feeCoins }
            : m,
        ),
      );
      setSelectedMessage((prev) =>
        prev && prev.id === message.id
          ? { ...prev, isLocked: false, unlockFeeCoins: result.feeCoins }
          : prev,
      );
      if (result.feeCoins > 0) {
        setWalletBalance((prev) => Math.max(0, prev - result.feeCoins));
      }
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Unlock failed.");
    } finally {
      setUnlockingId("");
    }
  }

  const list = tab === "inbox" ? inbox : outbox;

  return (
    <div>
      <AppShellHeader
        tenantConfig={tenantConfig}
        role={session?.role ?? null}
        name={session?.name ?? "User"}
      />
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Messages</h1>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, borderBottom: "1px solid #e5e5e5" }}>
          <TabButton
            active={tab === "inbox"}
            onClick={() => setTab("inbox")}
            label={`Inbox${inboxUnreadCount > 0 ? ` (${inboxUnreadCount})` : ""}`}
          />
          <TabButton
            active={tab === "outbox"}
            onClick={() => setTab("outbox")}
            label="Outbox"
          />
        </div>
        {loading ? <p>Loading session…</p> : null}
        {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
        {loadingMessages ? <p style={{ color: "#666" }}>Loading messages…</p> : null}
        {loadError ? <p style={{ color: "#b00020" }}>{loadError}</p> : null}

        {!loading && !error && !loadingMessages && !loadError ? (
          list.length === 0 ? (
            <p style={{ color: "#888" }}>No messages.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {list.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  direction={tab}
                  onOpen={() => setSelectedMessage(message)}
                />
              ))}
            </ul>
          )
        ) : null}
      </main>

      {selectedMessage ? (
        <MessageDetailModal
          message={selectedMessage}
          direction={tab}
          tenantBasePath={`/${tenantId}`}
          walletBalance={walletBalance}
          unlocking={unlockingId === selectedMessage.id}
          unlockError={unlockError}
          onUnlock={() => void handleUnlock(selectedMessage)}
          onClose={() => {
            setSelectedMessage(null);
            setUnlockError("");
          }}
        />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 14px",
        border: 0,
        background: "transparent",
        fontWeight: active ? 700 : 400,
        borderBottom: active ? "2px solid #1a73e8" : "2px solid transparent",
        color: active ? "#1a73e8" : "#444",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function MessageRow({
  message,
  direction,
  onOpen,
}: {
  message: MessageRecord;
  direction: Tab;
  onOpen: () => void;
}) {
  const counterparty =
    direction === "inbox"
      ? message.senderName || "Unknown sender"
      : message.receiverName || "Unknown recipient";
  const locked = direction === "inbox" && message.isLocked;
  const unread = direction === "inbox" && !message.readAt;

  return (
    <li
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        background: unread ? "#f5f9ff" : "#fff",
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontWeight: 600, margin: 0 }}>
            {direction === "inbox" ? "From: " : "To: "}
            {counterparty}
          </p>
          <p style={{ fontSize: 14, color: "#444", margin: "4px 0 0" }}>
            {locked ? "🔒 Locked message — unlock to read" : message.subject || "(no subject)"}
          </p>
        </div>
        {unread ? (
          <span
            style={{
              alignSelf: "center",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#1a73e8",
              color: "#fff",
            }}
          >
            New
          </span>
        ) : null}
      </div>
    </li>
  );
}

function MessageDetailModal({
  message,
  direction,
  tenantBasePath,
  walletBalance,
  unlocking,
  unlockError,
  onUnlock,
  onClose,
}: {
  message: MessageRecord;
  direction: Tab;
  tenantBasePath: string;
  walletBalance: number;
  unlocking: boolean;
  unlockError: string;
  onUnlock: () => void;
  onClose: () => void;
}) {
  const locked = direction === "inbox" && message.isLocked;
  const fee = message.unlockFeeCoins ?? 0;
  const insufficient = locked && fee > walletBalance;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: "min(560px, 92vw)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>
          {locked ? "🔒 Locked Message" : message.subject || "(no subject)"}
        </h2>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px" }}>
          {direction === "inbox" ? "From: " : "To: "}
          <strong>
            {direction === "inbox"
              ? message.senderName || "Unknown"
              : message.receiverName || "Unknown"}
          </strong>
        </p>

        {locked ? (
          <div style={{ marginBottom: 14 }}>
            <p style={{ color: "#444", marginBottom: 6 }}>
              This message is from an Individual. Unlock to view the full content.
            </p>
            <p style={{ color: "#444", marginBottom: 6 }}>
              Cost: <strong>{fee}</strong> {fee === 1 ? "credit" : "credits"}
            </p>
            <p style={{ color: "#444", marginBottom: 10 }}>
              Available balance: <strong>{walletBalance}</strong>
            </p>
            {insufficient ? (
              <div
                style={{
                  background: "#fff5f5",
                  border: "1px solid #f3c2c2",
                  padding: 10,
                  borderRadius: 6,
                  marginBottom: 10,
                }}
              >
                <p style={{ margin: 0, color: "#b00020" }}>Insufficient credits.</p>
                <Link href={`${tenantBasePath}/buy-coins`} style={{ color: "#1a73e8" }}>
                  Buy Credits
                </Link>
              </div>
            ) : null}
            {unlockError ? <p style={{ color: "#b00020" }}>{unlockError}</p> : null}
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <p style={{ whiteSpace: "pre-wrap", color: "#222", lineHeight: 1.5 }}>
              {message.body}
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={unlocking}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            Close
          </button>
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              disabled={unlocking || insufficient}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: 0,
                background: insufficient ? "#aaa" : "#1a73e8",
                color: "#fff",
                cursor: unlocking ? "wait" : insufficient ? "not-allowed" : "pointer",
              }}
            >
              {unlocking ? "Unlocking…" : "Unlock Message"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
