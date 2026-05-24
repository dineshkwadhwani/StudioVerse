"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext, listWalletTransactionsForUserContext } from "@/services/wallet.service";
import type { WalletRecord, WalletTransactionRecord } from "@/types/wallet";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "./menuConfig";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import landingStyles from "./CoachingLandingPage.module.css";
import dashboardStyles from "./dashboard/CoachingDashboard.module.css";
import styles from "./ManageWalletPage.module.css";

type UserRole = StudioUserRole;

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
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
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
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

        const [resolvedWallet, resolvedTransactions] = await Promise.all([
          getWalletForUserContext(userIds, tenantId),
          listWalletTransactionsForUserContext({ userIds, tenantId }),
        ]);

        setWallet(resolvedWallet);
        setTransactions(resolvedTransactions);

        if (profile?.fullName) {
          setName(profile.fullName);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load wallet.";
        setError(message);
      } finally {
        setBusy(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";
  const isBusinessWalletRole = role === "company" || role === "professional";

  const visibleTransactions = useMemo(() => {
    if (!isBusinessWalletRole || transactionFlowFilter === "all") {
      return transactions;
    }

    return transactions.filter((item) => getTransactionFlowType(item.transactionType) === transactionFlowFilter);
  }, [isBusinessWalletRole, transactionFlowFilter, transactions]);

  return (
    <main className={styles.page}>
      <header className={landingStyles.nav}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={tenantConfig.theme.logo} alt={`${tenantConfig.name} logo`} width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>{brandSubtitle}</span>
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
            name={name}
            basePath={basePath}
            roleLabels={{
              company: tenantConfig.roles.company,
              professional: tenantConfig.roles.professional,
              individual: tenantConfig.roles.individual,
            }}
          />
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.card}>
          <h1 className={styles.title}>Manage Wallet</h1>
          <p className={styles.subtitle}>See your current balance and every place where coins were spent or added.</p>

          {busy ? <p className={styles.subtitle}>Loading wallet...</p> : null}
          {error ? <div className={styles.error}>{error}</div> : null}

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
                  </div>
                  <h2 className={styles.itemTitle}>Wallet transaction</h2>
                  <p className={styles.itemMeta}>Comment: {getTransactionComment(item)}</p>
                  <p className={styles.itemMeta}>Coins: {item.coins}</p>
                  <p className={styles.itemMeta}>User: {item.userName}</p>
                  <p className={styles.itemMeta}>Created on: {formatDate(item.createdAt)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
