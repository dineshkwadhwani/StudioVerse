"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthedSession } from "@/modules/app-shell/AppShellHeader";
import type { TenantConfig } from "@/types/tenant";
import {
  listInboxMessages,
  listOutboxMessages,
  respondToMessage,
  unlockMessage,
} from "@/services/messages.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import { getUserProfile } from "@/services/profile.service";
import type { MessageRecord } from "@/types/message";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import s from "./MessagesPage.module.css";

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
  const [respondingId, setRespondingId] = useState("");
  const [respondError, setRespondError] = useState("");

  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const userId = session?.uid ?? "";
  const role = session?.role ?? null;
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;

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
          listInboxMessages({ tenantId, receiverUserId: userId }).catch(() => []),
          listOutboxMessages({ tenantId, senderUserId: userId }).catch(() => []),
          getWalletForUserContext(lookupIds, tenantId).catch(() => null),
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

  async function handleRespond(message: MessageRecord, responseType: "ignore" | "interested"): Promise<void> {
    setRespondingId(message.id);
    setRespondError("");
    try {
      const profile = await getUserProfile({ userId, tenantId });
      await respondToMessage({
        message,
        responseType,
        responderName: profile?.fullName ?? session?.name ?? "User",
        responderPhone: profile?.phone ?? "",
        responderEmail: profile?.email ?? "",
      });
      const updated = { ...message, responseType };
      setInbox((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
      setSelectedMessage(updated);
    } catch (err) {
      setRespondError(err instanceof Error ? err.message : "Failed to respond.");
    } finally {
      setRespondingId("");
    }
  }

  const list = tab === "inbox" ? inbox : outbox;

  return (
    <main className={s.page}>
      <header className={s.toolbar}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={tenantConfig.theme.logo} alt={`${tenantConfig.name} logo`} width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>StudioVerse Platform</span>
          </div>
        </Link>
        <div className={dashboardStyles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
            <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
            <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
          </nav>
          <ProfileDropdownMenu
            role={role}
            tenantId={tenantId}
            name={session?.name ?? "User"}
            basePath={basePath}
            roleLabels={{
              company: tenantConfig.roles.company,
              professional: tenantConfig.roles.professional,
              individual: tenantConfig.roles.individual,
            }}
          />
        </div>
      </header>

      <div className={s.shell}>
        {/* ── Hero card ─────────────────────────────────────── */}
        <section className={s.heroCard}>
          <h1 className={s.pageTitle}>Messages</h1>
          <p className={s.pageSubtitle}>
            View and manage your inbox and sent messages.
          </p>

          {loading ? <p className={s.infoText}>Loading session…</p> : null}
          {error ? <p className={s.errorText}>{error}</p> : null}

          {!loading && !error && session ? (
            <>
              <p className={s.walletBadge}>
                Credit balance: <strong>{walletBalance}</strong>
              </p>
              <div className={s.tabRow}>
                <button
                  type="button"
                  onClick={() => setTab("inbox")}
                  className={tab === "inbox" ? s.tabActive : s.tab}
                >
                  Inbox{inboxUnreadCount > 0 ? ` (${inboxUnreadCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("outbox")}
                  className={tab === "outbox" ? s.tabActive : s.tab}
                >
                  Outbox
                </button>
              </div>
            </>
          ) : null}
        </section>

        {/* ── Content card ──────────────────────────────────── */}
        {!loading && !error && session ? (
          <section className={s.contentCard}>
            {loadingMessages ? <p className={s.infoText}>Loading messages…</p> : null}
            {loadError ? <p className={s.errorText}>{loadError}</p> : null}

            {!loadingMessages && !loadError ? (
              list.length === 0 ? (
                <p className={s.emptyText}>No messages.</p>
              ) : (
                <ul className={s.messageList}>
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
          </section>
        ) : null}
      </div>

      {selectedMessage ? (
        <MessageDetailModal
          message={selectedMessage}
          direction={tab}
          tenantBasePath={basePath}
          walletBalance={walletBalance}
          unlocking={unlockingId === selectedMessage.id}
          unlockError={unlockError}
          onUnlock={() => void handleUnlock(selectedMessage)}
          responding={respondingId === selectedMessage.id}
          respondError={respondError}
          onRespond={(responseType) => void handleRespond(selectedMessage, responseType)}
          userRole={role}
          onClose={() => {
            setSelectedMessage(null);
            setUnlockError("");
            setRespondError("");
          }}
        />
      ) : null}
    </main>
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
      className={unread ? s.messageRowUnread : s.messageRow}
      onClick={onOpen}
    >
      <div className={s.messageRowInner}>
        <div className={s.messageRowContent}>
          <p className={s.messageSender}>
            {direction === "inbox" ? "From: " : "To: "}
            {counterparty}
          </p>
          <p className={s.messageSubject}>
            {locked ? "Locked message — unlock to read" : message.subject || "(no subject)"}
          </p>
        </div>
        {unread ? <span className={s.newBadge}>New</span> : null}
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
  responding,
  respondError,
  onRespond,
  userRole,
  onClose,
}: {
  message: MessageRecord;
  direction: Tab;
  tenantBasePath: string;
  walletBalance: number;
  unlocking: boolean;
  unlockError: string;
  onUnlock: () => void;
  responding: boolean;
  respondError: string;
  onRespond: (responseType: "ignore" | "interested") => void;
  userRole: string | null;
  onClose: () => void;
}) {
  const locked = direction === "inbox" && message.isLocked;
  const fee = message.unlockFeeCoins ?? 0;
  const insufficient = locked && fee > walletBalance;

  const canRespond =
    direction === "inbox" &&
    !locked &&
    !message.responseType &&
    (message.senderUserType === "professional" || message.senderUserType === "company") &&
    message.receiverUserType === "individual";

  return (
    <div role="dialog" aria-modal="true" className={s.modalBackdrop}>
      <div className={s.modalCard}>
        <h2 className={s.modalTitle}>
          {locked ? "Locked Message" : message.subject || "(no subject)"}
        </h2>
        <p className={s.modalMeta}>
          {direction === "inbox" ? "From: " : "To: "}
          <strong>
            {direction === "inbox"
              ? message.senderName || "Unknown"
              : message.receiverName || "Unknown"}
          </strong>
        </p>

        {locked ? (
          <div>
            <p className={s.lockedInfo}>
              This message is from an Individual. Unlock to view the full content.
            </p>
            <p className={s.lockedCost}>
              Cost: <strong>{fee}</strong> {fee === 1 ? "credit" : "credits"}
            </p>
            <p className={s.lockedBalance}>
              Available balance: <strong>{walletBalance}</strong>
            </p>
            {insufficient ? (
              <div className={s.insufficientWarning}>
                <p>Insufficient credits.</p>
                <Link href={`${tenantBasePath}/buy-coins`}>Buy Credits</Link>
              </div>
            ) : null}
            {unlockError ? <p className={s.errorText}>{unlockError}</p> : null}
          </div>
        ) : (
          <p className={s.modalBody}>{message.body}</p>
        )}

        {message.responseType ? (
          <p className={s.respondedBadge}>
            You responded: {message.responseType === "interested" ? "Interested" : "Ignored"}
          </p>
        ) : null}

        {canRespond ? (
          <div className={s.responseRow}>
            <button
              type="button"
              onClick={() => onRespond("ignore")}
              disabled={responding}
              className={s.ignoreButton}
            >
              {responding ? "Sending…" : "Ignore"}
            </button>
            <button
              type="button"
              onClick={() => onRespond("interested")}
              disabled={responding}
              className={s.interestedButton}
            >
              {responding ? "Sending…" : "Interested"}
            </button>
          </div>
        ) : null}

        {respondError ? <p className={s.errorText}>{respondError}</p> : null}

        <div className={s.modalActions}>
          <button
            type="button"
            onClick={onClose}
            disabled={unlocking || responding}
            className={s.modalCancelButton}
          >
            Close
          </button>
          {locked ? (
            <button
              type="button"
              onClick={onUnlock}
              disabled={unlocking || insufficient}
              className={s.modalConfirmButton}
            >
              {unlocking ? "Unlocking…" : "Unlock Message"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
