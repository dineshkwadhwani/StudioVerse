"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  assignCoins,
  backfillTenantTreasuryWallets,
  getWalletByUserAndTenant,
  listCashoutRequestsForUserContext,
  listWalletTransactionsForUserContext,
  listWallets,
  listUsersForCoinAssignment,
} from "@/services/wallet.service";
import type { CashoutRequest } from "@/types/cashoutRequest";
import type { WalletRecord, WalletTransactionRecord, WalletUserType } from "@/types/wallet";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type UserOption = {
  id: string;
  name: string;
  userType: WalletUserType;
  status: "active" | "inactive";
  tenantId?: string;
};

type ManageCoinsSectionProps = {
  tenants: TenantOption[];
  adminUserId: string;
  onCoinsAssigned?: () => void;
};

const USER_TYPES: Array<{ value: WalletUserType; label: string }> = [
  { value: "company", label: "Company" },
  { value: "professional", label: "Professional" },
  { value: "individual", label: "Individual" },
];

export default function ManageCoinsSection({ tenants, adminUserId, onCoinsAssigned }: ManageCoinsSectionProps) {
  type WalletFilterType = "all" | WalletUserType | "treasury";

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedUserType, setSelectedUserType] = useState<WalletUserType>("company");
  const [walletFilterType, setWalletFilterType] = useState<WalletFilterType>("all");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [coinsToAssign, setCoinsToAssign] = useState("10");
  const [busy, setBusy] = useState(false);
  const [walletDetailOpen, setWalletDetailOpen] = useState(false);
  const [walletDetailBusy, setWalletDetailBusy] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletRecord | null>(null);
  const [walletDetailTransactions, setWalletDetailTransactions] = useState<WalletTransactionRecord[]>([]);
  const [walletDetailCashoutRequests, setWalletDetailCashoutRequests] = useState<CashoutRequest[]>([]);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [walletSnapshot, setWalletSnapshot] = useState<{ issued: number; utilized: number; available: number } | null>(null);

  const isTreasuryWallet = (wallet: WalletRecord): boolean =>
    wallet.id.startsWith("treasury::") || wallet.userName === "Tenant Treasury";

  const treasuryWallets = useMemo(() => wallets.filter((wallet) => isTreasuryWallet(wallet)), [wallets]);

  const filteredWallets = useMemo(() => {
    if (walletFilterType === "all") {
      return wallets;
    }

    if (walletFilterType === "treasury") {
      return wallets.filter((wallet) => isTreasuryWallet(wallet));
    }

    return wallets.filter((wallet) => wallet.userType === walletFilterType);
  }, [walletFilterType, wallets]);

  const walletDetailCashoutStatusByTransactionId = useMemo(() => {
    return walletDetailCashoutRequests.reduce<Record<string, CashoutRequest["status"]>>((acc, request) => {
      if (request.walletTransactionId) {
        acc[request.walletTransactionId] = request.status;
      }
      return acc;
    }, {});
  }, [walletDetailCashoutRequests]);

  async function openWalletDetail(wallet: WalletRecord): Promise<void> {
    setSelectedWallet(wallet);
    setWalletDetailOpen(true);
    setWalletDetailBusy(true);
    setError("");

    const normalizedUserIds = Array.from(new Set([
      wallet.userId,
      wallet.id,
      wallet.id.includes("::") ? wallet.id.split("::").pop() ?? "" : "",
    ].map((item) => item.trim()).filter(Boolean)));

    try {
      const [transactions, cashoutRequests] = await Promise.all([
        listWalletTransactionsForUserContext({ userIds: normalizedUserIds, tenantId: wallet.tenantId || undefined, includeTreasury: true }),
        listCashoutRequestsForUserContext({ userIds: normalizedUserIds, tenantId: wallet.tenantId || undefined }),
      ]);
      setWalletDetailTransactions(transactions);
      setWalletDetailCashoutRequests(cashoutRequests);
    } catch (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Failed to load wallet details.";
      setError(message);
      setWalletDetailTransactions([]);
      setWalletDetailCashoutRequests([]);
    } finally {
      setWalletDetailBusy(false);
    }
  }

  async function refreshWallets(): Promise<void> {
    const rows = await listWallets();
    setWallets(rows);
  }

  function handleTenantChange(nextTenantId: string): void {
    setSelectedTenantId(nextTenantId);
  }

  function handleUserTypeChange(nextUserType: WalletUserType): void {
    setSelectedUserType(nextUserType);
  }

  useEffect(() => {
    void (async () => {
      try {
        await backfillTenantTreasuryWallets();
      } catch {
        // Keep wallet view working even if treasury backfill is unavailable.
      }

      await refreshWallets();
    })().catch((loadError) => {
      const message = loadError instanceof Error ? loadError.message : "Unknown error";
      setError(`Could not load wallets. ${message}`);
    });
  }, []);

  useEffect(() => {
    setUsers([]);
    setSelectedUserId("");
    setWalletSnapshot(null);

    if (!selectedTenantId) {
      return;
    }

    let cancelled = false;
    setError("");

    listUsersForCoinAssignment({ tenantId: selectedTenantId, userType: selectedUserType })
      .then((rows) => {
        if (cancelled) return;
        setUsers(rows);
        setSelectedUserId(rows[0]?.id ?? "");
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error(loadError);
        setUsers([]);
        setSelectedUserId("");
        const message = loadError instanceof Error ? loadError.message : "Unknown error";
        setError(`Could not load users for the selected tenant and user type. ${message}`);
      });

    return () => { cancelled = true; };
  }, [selectedTenantId, selectedUserType]);

  useEffect(() => {
    if (!selectedUserId) {
      setWalletSnapshot(null);
      return;
    }

    getWalletByUserAndTenant({ userId: selectedUserId, tenantId: selectedTenantId })
      .then((wallet) => {
        if (!wallet) {
          setWalletSnapshot({ issued: 0, utilized: 0, available: 0 });
          return;
        }

        setWalletSnapshot({
          issued: wallet.totalIssuedCoins,
          utilized: wallet.utilizedCoins,
          available: wallet.availableCoins,
        });
      })
      .catch(() => {
        setWalletSnapshot(null);
      });
  }, [selectedUserId]);

  async function handleAssign(): Promise<void> {
    const user = users.find((item) => item.id === selectedUserId);
    const coins = parseInt(coinsToAssign, 10);

    if (!selectedTenantId) {
      setError("Please select a tenant.");
      return;
    }
    if (!user) {
      setError("Please select a user.");
      return;
    }
    if (!coins || coins <= 0) {
      setError("Please enter a valid positive coin count.");
      return;
    }

    setBusy(true);
    setError("");
    setInfo("");

    try {
      await assignCoins({
        userId: user.id,
        tenantId: selectedTenantId,
        userType: selectedUserType,
        userName: user.name,
        coinsToAssign: coins,
        assignedBy: adminUserId,
      });

      const updatedWallet = await getWalletByUserAndTenant({ userId: user.id, tenantId: selectedTenantId });
      setWalletSnapshot({
        issued: updatedWallet?.totalIssuedCoins ?? 0,
        utilized: updatedWallet?.utilizedCoins ?? 0,
        available: updatedWallet?.availableCoins ?? 0,
      });
      await refreshWallets();

      setInfo(`Assigned ${coins} coins to ${user.name}.`);
      onCoinsAssigned?.();
    } catch (assignError) {
      const message = assignError instanceof Error ? assignError.message : "Failed to assign coins.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Wallet</h2>

      <div className={styles.usersGrid}>
        {/* Left panel — assign coins */}
        <div className={styles.controlCard}>
          <p className={styles.subtitle}>Assign credits to a user</p>

          <label className={styles.label} htmlFor="coins-tenant">Tenant</label>
          <select
            id="coins-tenant"
            className={styles.select}
            value={selectedTenantId}
            onChange={(event) => handleTenantChange(event.target.value)}
          >
            <option value="">Select tenant</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.tenantId}>{tenant.tenantName}</option>
            ))}
          </select>

          <label className={styles.label} htmlFor="coins-user-type">User Type</label>
          <select
            id="coins-user-type"
            className={styles.select}
            value={selectedUserType}
            onChange={(event) => handleUserTypeChange(event.target.value as WalletUserType)}
          >
            {USER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <label className={styles.label} htmlFor="coins-user">User</label>
          <select
            id="coins-user"
            className={styles.select}
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">Select user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>

          <label className={styles.label} htmlFor="coins-count">Coins to assign</label>
          <input
            id="coins-count"
            className={styles.input}
            type="number"
            min={1}
            value={coinsToAssign}
            onChange={(event) => setCoinsToAssign(event.target.value)}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={handleAssign} disabled={busy || !selectedUserId}>
              {busy ? "Working..." : "Assign Credits"}
            </button>
          </div>

          {walletSnapshot ? (
            <div className={styles.emptyCard} style={{ marginTop: "12px" }}>
              <strong>Wallet Snapshot</strong>
              <p style={{ margin: "8px 0 0" }}>Issued: {walletSnapshot.issued}</p>
              <p style={{ margin: "4px 0 0" }}>Utilized: {walletSnapshot.utilized}</p>
              <p style={{ margin: "4px 0 0" }}>Available: {walletSnapshot.available}</p>
            </div>
          ) : null}

          {error ? <p className={styles.error}>{error}</p> : null}
          {info ? <p className={styles.info}>{info}</p> : null}
        </div>

        {/* Right panel — wallet list with filter */}
        <div className={styles.controlCard}>
          <p className={styles.subtitle}>All wallets (including Treasury)</p>

          {treasuryWallets.length > 0 ? (
            <div className={styles.emptyCard} style={{ marginBottom: "12px" }}>
              <strong>Treasury Wallets</strong>
              {treasuryWallets.map((wallet) => (
                <p key={wallet.id} style={{ margin: "6px 0 0" }}>
                  {wallet.tenantId || "-"}: Available {wallet.availableCoins} / Issued {wallet.totalIssuedCoins}
                </p>
              ))}
            </div>
          ) : null}

          <div className={styles.radioRow}>
            {(["all", "treasury", "company", "professional", "individual"] as const).map((value) => (
              <label key={value} className={styles.radioPill}>
                <input
                  type="radio"
                  name="wallet-filter"
                  checked={walletFilterType === value}
                  onChange={() => setWalletFilterType(value)}
                />
                {value === "all"
                  ? "All"
                  : value === "treasury"
                    ? "Treasury"
                    : value.charAt(0).toUpperCase() + value.slice(1)}
              </label>
            ))}
          </div>

          {filteredWallets.length === 0 ? (
            <div className={styles.emptyCard}>No wallets found for the selected filter.</div>
          ) : (
            <div className={styles.userStack}>
              {filteredWallets.map((wallet) => (
                <section key={wallet.id} className={styles.userItem}>
                  <div>
                    <p className={styles.userName}>{wallet.userName}</p>
                    <p className={styles.userMeta}>User ID: {wallet.userId}</p>
                    <p className={styles.userMeta}>Tenant: {wallet.tenantId || "-"}</p>
                    <p className={styles.userMeta}>Type: {isTreasuryWallet(wallet) ? "treasury" : wallet.userType}</p>
                  </div>
                  <div className={styles.userActions}>
                    <span className={styles.statusBadge}>Available {wallet.availableCoins}</span>
                    <span className={styles.statusBadge}>Utilized {wallet.utilizedCoins}</span>
                    <span className={styles.statusBadge}>Issued {wallet.totalIssuedCoins}</span>
                    <button
                      type="button"
                      className={styles.rowAction}
                      onClick={() => void openWalletDetail(wallet)}
                    >
                      View Details
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {walletDetailOpen && selectedWallet ? (
        <div className={styles.modalOverlay}>
          <section className={styles.modal} style={{ width: "min(920px, 100%)" }}>
            <div className={styles.modalHeader}>
              <h3>{selectedWallet.userName} - Wallet Details</h3>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  setWalletDetailOpen(false);
                  setSelectedWallet(null);
                  setWalletDetailTransactions([]);
                  setWalletDetailCashoutRequests([]);
                }}
                aria-label="Close wallet details"
              >
                x
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.emptyCard} style={{ marginBottom: 12 }}>
                <p style={{ margin: 0 }}>Tenant: {selectedWallet.tenantId || "-"}</p>
                <p style={{ margin: "6px 0 0" }}>User ID: {selectedWallet.userId}</p>
                <p style={{ margin: "6px 0 0" }}>Type: {selectedWallet.userType}</p>
              </div>

              <div className={styles.usersGrid} style={{ marginBottom: 12 }}>
                <div className={styles.emptyCard}><strong>Available</strong><p style={{ margin: "8px 0 0" }}>{selectedWallet.availableCoins}</p></div>
                <div className={styles.emptyCard}><strong>Utilized</strong><p style={{ margin: "8px 0 0" }}>{selectedWallet.utilizedCoins}</p></div>
                <div className={styles.emptyCard}><strong>Total Issued</strong><p style={{ margin: "8px 0 0" }}>{selectedWallet.totalIssuedCoins}</p></div>
              </div>

              {walletDetailBusy ? (
                <div className={styles.emptyCard}>Loading wallet activity...</div>
              ) : walletDetailTransactions.length === 0 ? (
                <div className={styles.emptyCard}>No wallet transaction records found yet.</div>
              ) : (
                <div className={styles.userStack}>
                  {walletDetailTransactions.map((tx) => (
                    <section key={tx.id} className={styles.userItem}>
                      <div>
                        <p className={styles.userName}>{tx.reason || "Wallet transaction"}</p>
                        <p className={styles.userMeta}>Credits: {tx.coins}</p>
                        <p className={styles.userMeta}>User: {tx.userName}</p>
                      </div>
                      <div className={styles.userActions}>
                        <span className={styles.statusBadge}>{tx.transactionType.toUpperCase()}</span>
                        {tx.activityType ? <span className={styles.statusBadge}>{String(tx.activityType).toUpperCase()}</span> : null}
                        {walletDetailCashoutStatusByTransactionId[tx.id] ? (
                          <span className={styles.statusBadge}>CASHOUT {String(walletDetailCashoutStatusByTransactionId[tx.id]).toUpperCase()}</span>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
