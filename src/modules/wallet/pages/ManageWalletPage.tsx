"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import {
  getCoinRequestsForCompanyContext,
  getWalletForUserContext,
  listWalletTransactionsForUserContext,
} from "@/services/wallet.service";
import type { WalletRecord, WalletTransactionRecord } from "@/types/wallet";
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

        setUserId(firebaseUser.uid);

        const companyIds = Array.from(
          new Set([firebaseUser.uid, profile?.userId].filter(Boolean) as string[])
        );

        // DEBUG
        console.log("[ManageWalletPage] Company context:", {
          firebaseUser_uid: firebaseUser.uid,
          profile_userId: profile?.userId,
          companyIds,
        });
        const results = await Promise.allSettled([
          getWalletForUserContext(userIds, tenantId),
          listWalletTransactionsForUserContext({ userIds, tenantId }),
          storedRoleRaw === "company" ? getCoinRequestsForCompanyContext(companyIds) : Promise.resolve([]),
        ]);

        const walletResult = results[0];
        const transactionsResult = results[1];
        const coinRequestsResult = results[2];

        if (walletResult.status === "fulfilled") {
          setWallet(walletResult.value);
        }

        if (transactionsResult.status === "fulfilled") {
          setTransactions(transactionsResult.value);
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
          </div>

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

          {!busy && transactions.length === 0 ? (
            <div className={styles.empty}>No wallet transaction records found yet.</div>
          ) : null}

          {!busy && transactions.length > 0 ? (
            <div className={styles.list}>
              {transactions.map((item) => (
                <article key={item.id} className={styles.item}>
                  <div className={styles.badgeRow}>
                    <span className={styles.badge}>{item.transactionType.toUpperCase()}</span>
                    {item.activityType ? <span className={styles.badge}>{String(item.activityType).toUpperCase()}</span> : null}
                  </div>
                  <h2 className={styles.itemTitle}>{item.reason || "Wallet transaction"}</h2>
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
    </main>
  );
}
