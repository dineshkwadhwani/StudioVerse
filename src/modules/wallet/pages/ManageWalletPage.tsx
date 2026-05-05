"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getUserById } from "@/services/manage-users.service";
import {
  createCashoutRequest,
  getCoinRequestsForCompanyContext,
  getTenantCashoutConfig,
  getWalletForUserContext,
  listCashoutRequestsForUserContext,
  listWalletTransactionsForUserContext,
} from "@/services/wallet.service";
import type { WalletRecord, WalletTransactionRecord } from "@/types/wallet";
import type { CashoutConfig, CashoutRequest } from "@/types/cashoutRequest";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuGroups, getRoleMenuItems } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./ManageWalletPage.module.css";
import CoinRequestsModal from "@/modules/wallet/components/CoinRequestsModal";

type UserRole = StudioUserRole;

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(value: WalletTransactionRecord["createdAt"]): string {
  if (!value || !("toDate" in value) || typeof value.toDate !== "function") {
    return "-";
  }
  return value.toDate().toLocaleString();
}

type TransactionFlowFilter = "all" | "debit" | "credit";

function getTransactionFlowType(transactionType: WalletTransactionRecord["transactionType"]): Exclude<TransactionFlowFilter, "all"> {
  return transactionType === "debit" || transactionType === "sent" ? "debit" : "credit";
}

function getTransactionComment(item: WalletTransactionRecord): string {
  const reason = item.reason?.trim();

  if (reason) {
    return reason;
  }

  if (item.source) {
    const normalizedSource = item.source.replace(/-/g, " ");
    return `Wallet transaction from ${normalizedSource}.`;
  }

  if (item.transactionType === "credit" || item.transactionType === "received") {
    return "Credits added to wallet.";
  }

  return "Credits deducted from wallet.";
}

type ManageWalletPageProps = {
  tenantConfig?: TenantConfig;
};

export default function ManageWalletPage({ tenantConfig = coachingTenantConfig }: ManageWalletPageProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [coinRequestsError, setCoinRequestsError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [companyRequestIds, setCompanyRequestIds] = useState<string[]>([]);
  const [coinRequestsModalOpen, setCoinRequestsModalOpen] = useState(false);
  const [pendingCoinRequestCount, setPendingCoinRequestCount] = useState(0);

  const [contextUserIds, setContextUserIds] = useState<string[]>([]);
  const [canCashout, setCanCashout] = useState(false);
  const [cashoutConfig, setCashoutConfig] = useState<CashoutConfig | null>(null);
  const [cashoutRequests, setCashoutRequests] = useState<CashoutRequest[]>([]);
  const [cashoutModalOpen, setCashoutModalOpen] = useState(false);
  const [cashoutCreditsInput, setCashoutCreditsInput] = useState("");
  const [cashoutNote, setCashoutNote] = useState("");
  const [cashoutBusy, setCashoutBusy] = useState(false);
  const [cashoutError, setCashoutError] = useState("");
  const [cashoutSuccess, setCashoutSuccess] = useState("");
  const [transactionFlowFilter, setTransactionFlowFilter] = useState<TransactionFlowFilter>("all");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    setRole(storedRoleRaw);
    setName(storedName ?? "User");
    setBusy(true);
    setError("");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      const storedUid = sessionStorage.getItem("cs_uid");
      const storedProfileId = sessionStorage.getItem("cs_profile_id");
      const storedPhone = sessionStorage.getItem("cs_phone");

      try {
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        const userIds = Array.from(
          new Set([firebaseUser.uid, storedUid, storedProfileId, profile?.id, profile?.userId].filter(Boolean) as string[])
        );

        setContextUserIds(userIds);
        setUserId(firebaseUser.uid);

        const resolvedUser = await getUserById(profile?.userId || firebaseUser.uid);
        const isCompanyUser = profile?.userType === "company";
        const isIndependentCoach = profile?.userType === "professional" && !resolvedUser?.associatedCompanyId;
        const allowCashout = Boolean(isCompanyUser || isIndependentCoach);

        setCanCashout(allowCashout);
        if (allowCashout) {
          const nextCashoutConfig = await getTenantCashoutConfig(tenantId);
          setCashoutConfig(nextCashoutConfig);
        } else {
          setCashoutConfig(null);
        }

        const companyIds = Array.from(
          new Set([firebaseUser.uid, profile?.userId].filter(Boolean) as string[])
        );

        const results = await Promise.allSettled([
          getWalletForUserContext(userIds, tenantId),
          listWalletTransactionsForUserContext({ userIds, tenantId }),
          listCashoutRequestsForUserContext({ userIds, tenantId }),
          storedRoleRaw === "company" ? getCoinRequestsForCompanyContext(companyIds) : Promise.resolve([]),
        ]);

        const walletResult = results[0];
        const transactionsResult = results[1];
        const cashoutRequestsResult = results[2];
        const coinRequestsResult = results[3];

        if (walletResult.status === "fulfilled") {
          setWallet(walletResult.value);
        }

        if (transactionsResult.status === "fulfilled") {
          setTransactions(transactionsResult.value);
        }

        if (cashoutRequestsResult.status === "fulfilled") {
          setCashoutRequests(cashoutRequestsResult.value);
        }

        if (coinRequestsResult.status === "fulfilled") {
          const coinRequests = coinRequestsResult.value;
          setCompanyRequestIds(companyIds);
          setPendingCoinRequestCount(coinRequests.filter((request) => request.status === "pending").length);
          setCoinRequestsError("");
        } else if (coinRequestsResult.status === "rejected") {
          const err = coinRequestsResult.reason;
          const coinRequestsErrorMsg = err instanceof Error ? err.message : String(err);
          console.warn("Failed to load coin requests:", coinRequestsErrorMsg);
          setCoinRequestsError(coinRequestsErrorMsg);
        }

        if (profile?.fullName) {
          setName(profile.fullName);
        }

        if (walletResult.status === "rejected" || transactionsResult.status === "rejected") {
          const walletErr = walletResult.status === "rejected" ? walletResult.reason : null;
          const transErr = transactionsResult.status === "rejected" ? transactionsResult.reason : null;
          const failedError = walletErr || transErr;
          const message = failedError instanceof Error ? failedError.message : "Failed to load wallet.";
          setError(message);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load profile.";
        setError(message);
      } finally {
        setBusy(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuItems = useMemo(() => getRoleMenuItems(role, { basePath }), [basePath, role]);
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

  async function refreshWalletAndTransactions(userIds: string[]) {
    const normalized = userIds.map((item) => item.trim()).filter(Boolean);
    if (normalized.length === 0) {
      return;
    }

    const [nextWallet, nextTransactions, nextCashoutRequests] = await Promise.all([
      getWalletForUserContext(normalized, tenantId),
      listWalletTransactionsForUserContext({ userIds: normalized, tenantId }),
      listCashoutRequestsForUserContext({ userIds: normalized, tenantId }),
    ]);

    setWallet(nextWallet);
    setTransactions(nextTransactions);
    setCashoutRequests(nextCashoutRequests);
  }

  async function handleCreateCashoutRequest() {
    if (!userId || !wallet || !cashoutConfig || !canCashout) {
      return;
    }

    const minimumCashoutCredits = cashoutConfig.minimumCredits;
    const credits = Math.floor(Number(cashoutCreditsInput));
    if (!Number.isFinite(credits) || credits < minimumCashoutCredits) {
      setCashoutError(`Minimum credits required for cashout is ${minimumCashoutCredits}. You currently have ${wallet.availableCoins}.`);
      return;
    }

    if (credits > wallet.availableCoins) {
      setCashoutError(`You only have ${wallet.availableCoins} credits available.`);
      return;
    }

    setCashoutBusy(true);
    setCashoutError("");
    setCashoutSuccess("");

    try {
      await createCashoutRequest({
        tenantId,
        requesterUserId: userId,
        requesterName: name,
        creditsRequested: credits,
        requestComment: cashoutNote.trim(),
      });

      await refreshWalletAndTransactions(contextUserIds.length > 0 ? contextUserIds : [userId]);

      setCashoutSuccess("Cashout request submitted. Credits have been held pending Super Admin review.");
      setCashoutCreditsInput("");
      setCashoutNote("");
      setCashoutModalOpen(false);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "Failed to submit cashout request.";
      setCashoutError(messageText);
    } finally {
      setCashoutBusy(false);
    }
  }

  const requestedCashoutCredits = Math.floor(Number(cashoutCreditsInput || 0));
  const estimatedGrossAmount = cashoutConfig
    ? Math.max(0, requestedCashoutCredits) * cashoutConfig.creditCost
    : 0;
  const estimatedPayoutAmount = cashoutConfig
    ? (estimatedGrossAmount * cashoutConfig.cashbackPercentage) / 100
    : 0;
  const estimatedMarkdown = Math.max(0, estimatedGrossAmount - estimatedPayoutAmount);
  const minimumCashoutCredits = cashoutConfig?.minimumCredits ?? 40;
  const hasMinimumCashoutBalance = Boolean(wallet && wallet.availableCoins >= minimumCashoutCredits);
  const cashoutStatusByWalletTransactionId = useMemo(() => {
    return cashoutRequests.reduce<Record<string, CashoutRequest["status"]>>((acc, request) => {
      if (request.walletTransactionId) {
        acc[request.walletTransactionId] = request.status;
      }
      return acc;
    }, {});
  }, [cashoutRequests]);

  const isBusinessWalletRole = role === "company" || role === "professional";

  const visibleTransactions = useMemo(() => {
    if (!isBusinessWalletRole || transactionFlowFilter === "all") {
      return transactions;
    }

    return transactions.filter((item) => getTransactionFlowType(item.transactionType) === transactionFlowFilter);
  }, [isBusinessWalletRole, transactionFlowFilter, transactions]);

  function handleCashoutButtonClick() {
    if (busy || !wallet || !cashoutConfig) {
      return;
    }

    if (!hasMinimumCashoutBalance) {
      setCashoutSuccess("");
      setCashoutError(`Minimum credits required for cashout is ${minimumCashoutCredits}. You currently have ${wallet.availableCoins}.`);
      return;
    }

    setCashoutError("");
    setCashoutSuccess("");
    setCashoutModalOpen(true);
  }

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={tenantConfig.theme.logo} alt={`${tenantConfig.name} logo`} width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>{brandSubtitle}</span>
          </div>
        </Link>
        <nav className={landingStyles.desktopNav}>
          <Link href={`${basePath}/tools`} className={landingStyles.navLink}>{toolsLabel}</Link>
          <Link href={`${basePath}/programs`} className={landingStyles.navLink}>Programs</Link>
          <Link href={`${basePath}/events`} className={landingStyles.navLink}>Events</Link>
        </nav>

        <div className={dashboardStyles.rightControls}>

          <div className={dashboardStyles.profileArea} ref={menuRef}>
            <button type="button" className={dashboardStyles.profileButton} onClick={() => setMenuOpen((prev) => !prev)}>
              {initials} ▾
            </button>
            {menuOpen && (
              <section className={dashboardStyles.menuPanel}>
                <div className={dashboardStyles.menuUser}>
                  <p className={dashboardStyles.menuName}>{name}</p>
                  <p className={dashboardStyles.menuRole}>{getRoleLabel(role, {
                    company: tenantConfig.roles.company,
                    professional: tenantConfig.roles.professional,
                    individual: tenantConfig.roles.individual,
                  })}</p>
                </div>
                {roleMenuGroups.map((group) => (
                  <div key={group.key} className={dashboardStyles.menuGroup}>
                    <p className={dashboardStyles.menuGroupTitle}>{group.label}</p>
                    {group.items.map((item) => (
                      <Fragment key={item.key}>
                        {item.type === "signout" && <hr className={dashboardStyles.menuDivider} />}
                        {item.type === "signout" ? (
                          <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>{item.label}</button>
                        ) : (
                          <Link href={item.href} className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                            {item.label}
                          </Link>
                        )}
                      </Fragment>
                    ))}
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Manage Wallet</h1>
          <p className={styles.contextText}>
            {role === "company"
              ? "Manage credit allocations, view transaction history, and respond to credit requests from your professionals."
              : role === "professional"
              ? "View your credit balance, request credits from your company, and track your transaction history."
              : "View your credit balance, purchase credits, and track your transaction history."}
          </p>

          <div className={styles.actionRow}>
            <Link href={`${basePath}/buy-coins`} className={styles.button}>
              Buy Credits
            </Link>
            {role === "professional" && (
              <Link href={`${basePath}/request-coins`} className={styles.button}>
                Request Credits
              </Link>
            )}
            {role === "company" && (
              <button
                type="button"
                className={styles.button}
                onClick={() => setCoinRequestsModalOpen(true)}
              >
                View Credit Requests
                {pendingCoinRequestCount > 0 ? ` (${pendingCoinRequestCount})` : ""}
              </button>
            )}
            {(role === "company" || role === "professional") && canCashout ? (
              <button
                type="button"
                className={styles.button}
                onClick={handleCashoutButtonClick}
              >
                Cashout Credits
              </button>
            ) : null}
          </div>

          {(role === "company" || role === "professional") && canCashout && !busy && wallet && cashoutConfig && !hasMinimumCashoutBalance ? (
            <p className={styles.subtitle}>
              Minimum {minimumCashoutCredits} credits are required for cashout. You currently have {wallet.availableCoins}.
            </p>
          ) : null}

          {busy ? <p className={styles.subtitle}>Loading wallet...</p> : null}
          {error ? <div className={styles.error}>{error}</div> : null}
          {cashoutError ? <div className={styles.error}>{cashoutError}</div> : null}
          {cashoutSuccess ? <div className={styles.empty}>{cashoutSuccess}</div> : null}

          {!busy && wallet ? (
            <div className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <p className={styles.summaryLabel}>Available</p>
                <p className={styles.summaryValue}>{wallet.availableCoins}</p>
              </article>
              <article className={styles.summaryCard}>
                <p className={styles.summaryLabel}>Utilized</p>
                <p className={styles.summaryValue}>{wallet.utilizedCoins}</p>
              </article>
              <article className={styles.summaryCard}>
                <p className={styles.summaryLabel}>Total Issued</p>
                <p className={styles.summaryValue}>{wallet.totalIssuedCoins}</p>
              </article>
            </div>
          ) : null}

          {!busy && isBusinessWalletRole && transactions.length > 0 ? (
            <div className={styles.transactionFilterRow}>
              <label className={styles.transactionFilterLabel} htmlFor="wallet-transaction-flow-filter">
                Transaction Type
              </label>
              <select
                id="wallet-transaction-flow-filter"
                className={styles.transactionFilterSelect}
                value={transactionFlowFilter}
                onChange={(event) => setTransactionFlowFilter(event.target.value as TransactionFlowFilter)}
              >
                <option value="all">All</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          ) : null}

          {!busy && visibleTransactions.length === 0 ? (
            <div className={styles.empty}>No wallet transaction records found for the selected filter.</div>
          ) : null}

          {!busy && visibleTransactions.length > 0 ? (
            <div className={styles.list}>
              {visibleTransactions.map((item) => (
                <article key={item.id} className={styles.item}>
                  <div className={styles.badgeRow}>
                    <span className={styles.badge}>{item.transactionType.toUpperCase()}</span>
                    {item.activityType ? <span className={styles.badge}>{String(item.activityType).toUpperCase()}</span> : null}
                    {cashoutStatusByWalletTransactionId[item.id] ? (
                      <span className={styles.badge}>CASHOUT {String(cashoutStatusByWalletTransactionId[item.id]).toUpperCase()}</span>
                    ) : null}
                  </div>
                  <h2 className={styles.itemTitle}>Wallet transaction</h2>
                  <p className={styles.itemMeta}>Comment: {getTransactionComment(item)}</p>
                  <p className={styles.itemMeta}>Credits: {item.coins}</p>
                  <p className={styles.itemMeta}>User: {item.userName}</p>
                  <p className={styles.itemMeta}>Created on: {formatDate(item.createdAt)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {userId && (
        <CoinRequestsModal
          companyIds={companyRequestIds.length > 0 ? companyRequestIds : [userId]}
          isOpen={coinRequestsModalOpen}
          onClose={() => setCoinRequestsModalOpen(false)}
          onPendingCountChange={(count) => setPendingCoinRequestCount(count)}
        />
      )}

      {cashoutModalOpen && wallet && cashoutConfig ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(19, 58, 86, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              boxShadow: "0 12px 24px rgba(19, 58, 86, 0.12)",
              width: "min(620px, 100%)",
              maxHeight: "86vh",
              overflow: "auto",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, color: "#133a56" }}>Cashout Credits</h2>
              <button
                type="button"
                onClick={() => setCashoutModalOpen(false)}
                style={{ border: 0, background: "transparent", color: "#4d6e86", fontSize: "1.4rem", cursor: "pointer" }}
              >
                x
              </button>
            </div>

            <p style={{ margin: "0 0 10px", color: "#4d6e86" }}>
              Available Credits: <strong>{wallet.availableCoins}</strong>
            </p>
            <p style={{ margin: "0 0 10px", color: "#4d6e86" }}>
              Credit Cost: <strong>Rs {cashoutConfig.creditCost.toFixed(2)}</strong> per credit
            </p>
            <p style={{ margin: "0 0 16px", color: "#4d6e86" }}>
              Cashback Percentage: <strong>{cashoutConfig.cashbackPercentage.toFixed(2)}%</strong>
            </p>

            <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#133a56" }} htmlFor="cashout-credits-input">
              Credits to Cashout
            </label>
            <input
              id="cashout-credits-input"
              type="number"
              min={minimumCashoutCredits}
              value={cashoutCreditsInput}
              onChange={(event) => setCashoutCreditsInput(event.target.value)}
              style={{
                width: "100%",
                border: "1px solid #c6dcea",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "8px",
                boxSizing: "border-box",
              }}
            />
            <p style={{ margin: "0 0 12px", color: "#4d6e86", fontSize: "0.9rem" }}>
              Minimum credits required: {minimumCashoutCredits}
            </p>

            <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, color: "#133a56" }} htmlFor="cashout-note-input">
              Note (optional)
            </label>
            <textarea
              id="cashout-note-input"
              rows={3}
              value={cashoutNote}
              onChange={(event) => setCashoutNote(event.target.value)}
              style={{
                width: "100%",
                border: "1px solid #c6dcea",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />

            <div style={{ border: "1px solid #d9e8f6", borderRadius: "10px", padding: "12px", marginBottom: "16px", background: "#f8fcff" }}>
              <p style={{ margin: "0 0 6px", color: "#133a56" }}>Gross Value: Rs {estimatedGrossAmount.toFixed(2)}</p>
              <p style={{ margin: "0 0 6px", color: "#133a56" }}>Markdown ({(100 - cashoutConfig.cashbackPercentage).toFixed(2)}%): Rs {estimatedMarkdown.toFixed(2)}</p>
              <p style={{ margin: 0, color: "#133a56", fontWeight: 700 }}>Estimated Payout: Rs {estimatedPayoutAmount.toFixed(2)}</p>
            </div>

            {cashoutError ? (
              <div style={{ border: "1px solid #efc4c4", background: "#fff5f5", color: "#8a2a2a", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                {cashoutError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setCashoutModalOpen(false)}
                style={{ border: "1px solid #c6dcea", background: "#fff", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateCashoutRequest()}
                disabled={cashoutBusy}
                style={{ border: 0, background: "linear-gradient(90deg, #1f5c9c 0%, #2bb6d1 100%)", color: "#fff", borderRadius: "8px", padding: "10px 14px", fontWeight: 700, cursor: cashoutBusy ? "not-allowed" : "pointer", opacity: cashoutBusy ? 0.7 : 1 }}
              >
                {cashoutBusy ? "Submitting..." : "Submit Cashout Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
