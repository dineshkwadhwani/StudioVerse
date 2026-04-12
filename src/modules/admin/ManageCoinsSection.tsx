"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  assignCoins,
  createWalletForUser,
  getWalletByUserId,
  listWallets,
  listUsersForCoinAssignment,
} from "@/services/wallet.service";
import type { WalletRecord, WalletUserType } from "@/types/wallet";

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
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedUserType, setSelectedUserType] = useState<WalletUserType>("company");
  const [walletFilterType, setWalletFilterType] = useState<"all" | WalletUserType>("all");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [coinsToAssign, setCoinsToAssign] = useState("10");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [walletExistsForSelectedUser, setWalletExistsForSelectedUser] = useState(false);
  const [walletSnapshot, setWalletSnapshot] = useState<{ issued: number; utilized: number; available: number } | null>(null);

  const filteredWallets = useMemo(() => {
    if (walletFilterType === "all") {
      return wallets;
    }

    return wallets.filter((wallet) => wallet.userType === walletFilterType);
  }, [walletFilterType, wallets]);

  async function refreshWallets(): Promise<void> {
    const rows = await listWallets();
    setWallets(rows);
  }

  function handleTenantChange(nextTenantId: string): void {
    console.log("[ManageCoins] tenant changed", { nextTenantId });
    setSelectedTenantId(nextTenantId);
  }

  function handleUserTypeChange(nextUserType: WalletUserType): void {
    console.log("[ManageCoins] user type changed", { nextUserType, selectedTenantId });
    setSelectedUserType(nextUserType);
  }

  useEffect(() => {
    void refreshWallets().catch((loadError) => {
      const message = loadError instanceof Error ? loadError.message : "Unknown error";
      setError(`Could not load wallets. ${message}`);
    });
  }, []);

  useEffect(() => {
    console.log("[ManageCoins] fetching users", {
      selectedTenantId,
      selectedUserType,
      tenantsCount: tenants.length,
    });

    setUsers([]);
    setSelectedUserId("");
    setWalletSnapshot(null);

    if (!selectedTenantId) {
      console.log("[ManageCoins] fetch skipped: tenant not selected");
      return;
    }

    let cancelled = false;
    setError("");

    listUsersForCoinAssignment({ tenantId: selectedTenantId, userType: selectedUserType })
      .then((rows) => {
        if (cancelled) return;
        console.log("[ManageCoins] users loaded", { count: rows.length, userIds: rows.map((r) => r.id) });
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
      setWalletExistsForSelectedUser(false);
      return;
    }

    getWalletByUserId(selectedUserId)
      .then((wallet) => {
        if (!wallet) {
          setWalletExistsForSelectedUser(false);
          setWalletSnapshot({ issued: 0, utilized: 0, available: 0 });
          return;
        }

        setWalletExistsForSelectedUser(true);
        setWalletSnapshot({
          issued: wallet.totalIssuedCoins,
          utilized: wallet.utilizedCoins,
          available: wallet.availableCoins,
        });
      })
      .catch(() => {
        setWalletExistsForSelectedUser(false);
        setWalletSnapshot(null);
      });
  }, [selectedUserId]);

  async function handleCreateWallet(): Promise<void> {
    const user = users.find((item) => item.id === selectedUserId);

    if (!selectedTenantId) {
      setError("Please select a tenant.");
      return;
    }
    if (!user) {
      setError("Please select a user.");
      return;
    }

    setBusy(true);
    setError("");
    setInfo("");

    try {
      await createWalletForUser({
        userId: user.id,
        tenantId: selectedTenantId,
        userType: selectedUserType,
        userName: user.name,
        createdBy: adminUserId,
      });

      const updatedWallet = await getWalletByUserId(user.id);
      setWalletExistsForSelectedUser(Boolean(updatedWallet));
      setWalletSnapshot({
        issued: updatedWallet?.totalIssuedCoins ?? 0,
        utilized: updatedWallet?.utilizedCoins ?? 0,
        available: updatedWallet?.availableCoins ?? 0,
      });
      await refreshWallets();
      setInfo(`Wallet created for ${user.name}.`);
      onCoinsAssigned?.();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create wallet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

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

      const updatedWallet = await getWalletByUserId(user.id);
      setWalletExistsForSelectedUser(Boolean(updatedWallet));
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

      <div className={styles.controlCard}>
        <p className={styles.subtitle}>Existing wallets</p>
        <div className={styles.radioRow}>
          {(["all", "company", "professional", "individual"] as const).map((value) => (
            <label key={value} className={styles.radioPill}>
              <input
                type="radio"
                name="wallet-filter"
                checked={walletFilterType === value}
                onChange={() => setWalletFilterType(value)}
              />
              {value === "all" ? "All" : value}
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
                  <p className={styles.userMeta}>Type: {wallet.userType}</p>
                </div>
                <div className={styles.userActions}>
                  <span className={styles.statusBadge}>Available {wallet.availableCoins}</span>
                  <span className={styles.statusBadge}>Utilized {wallet.utilizedCoins}</span>
                  <span className={styles.statusBadge}>Issued {wallet.totalIssuedCoins}</span>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className={styles.controlCard}>
        <p className={styles.subtitle}>Add wallet / assign coins</p>
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
          <button
            type="button"
            className={styles.button}
            onClick={handleCreateWallet}
            disabled={busy || !selectedUserId || walletExistsForSelectedUser}
          >
            {busy ? "Working..." : "Add Wallet"}
          </button>
          <button type="button" className={styles.button} onClick={handleAssign} disabled={busy || !selectedUserId}>
            {busy ? "Working..." : "Assign Coins"}
          </button>
        </div>
      </div>

      {walletSnapshot ? (
        <div className={styles.emptyCard}>
          <strong>Wallet Snapshot</strong>
          <p style={{ margin: "8px 0 0" }}>Issued: {walletSnapshot.issued}</p>
          <p style={{ margin: "4px 0 0" }}>Utilized: {walletSnapshot.utilized}</p>
          <p style={{ margin: "4px 0 0" }}>Available: {walletSnapshot.available}</p>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {info ? <p className={styles.info}>{info}</p> : null}
    </article>
  );
}
