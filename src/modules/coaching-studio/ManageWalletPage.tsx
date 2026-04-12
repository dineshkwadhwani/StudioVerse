"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext, listWalletTransactionsForUserContext } from "@/services/wallet.service";
import type { WalletRecord, WalletTransactionRecord } from "@/types/wallet";
import { config } from "@/tenants/coaching-studio/config";
import { getRoleLabel, getRoleMenuItems } from "./menuConfig";
import type { CoachingUserRole } from "./menuConfig";
import landingStyles from "./CoachingLandingPage.module.css";
import dashboardStyles from "./dashboard/CoachingDashboard.module.css";
import styles from "./ManageWalletPage.module.css";

type UserRole = CoachingUserRole;

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

export default function ManageWalletPage() {
  const router = useRouter();
  const [name, setName] = useState("User");
  const [role, setRole] = useState<UserRole>("individual");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace("/coaching-studio");
      return;
    }

    setRole(storedRoleRaw);
    setName(storedName ?? "User");
    setBusy(true);
    setError("");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/coaching-studio");
        return;
      }

      const storedUid = sessionStorage.getItem("cs_uid");
      const storedProfileId = sessionStorage.getItem("cs_profile_id");
      const storedPhone = sessionStorage.getItem("cs_phone");

      try {
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId: "coaching-studio",
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        const userIds = Array.from(
          new Set([firebaseUser.uid, storedUid, storedProfileId, profile?.id, profile?.userId].filter(Boolean) as string[])
        );

        const [resolvedWallet, resolvedTransactions] = await Promise.all([
          getWalletForUserContext(userIds),
          listWalletTransactionsForUserContext({ userIds, tenantId: "coaching-studio" }),
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
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuItems = useMemo(() => getRoleMenuItems(role), [role]);

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace("/coaching-studio");
  }

  return (
    <main className={styles.page}>
      <header className={landingStyles.nav}>
        <Link href="/coaching-studio" className={landingStyles.brand}>
          <Image src={config.theme.logo} alt="Coaching Studio logo" width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>Coaching Studio</span>
            <span className={landingStyles.brandSubtitle}>Coaching | Growth | Potential</span>
          </div>
        </Link>

        <div className={dashboardStyles.rightControls}>
          <nav className={landingStyles.desktopNav}>
            <Link href="/coaching-studio/tools" className={landingStyles.navLink}>Assessment Centre</Link>
            <Link href="/coaching-studio/programs" className={landingStyles.navLink}>Programs</Link>
            <Link href="/coaching-studio/events" className={landingStyles.navLink}>Events</Link>
          </nav>

          <div className={dashboardStyles.profileArea} ref={menuRef}>
            <button type="button" className={dashboardStyles.profileButton} onClick={() => setMenuOpen((prev) => !prev)}>
              {initials} ▾
            </button>
            {menuOpen && (
              <section className={dashboardStyles.menuPanel}>
                <div className={dashboardStyles.menuUser}>
                  <p className={dashboardStyles.menuName}>{name}</p>
                  <p className={dashboardStyles.menuRole}>{getRoleLabel(role)}</p>
                </div>
                <p className={dashboardStyles.menuTitle}>Menu</p>
                {roleMenuItems.map((item) => (
                  <Link key={item.key} href={item.href} className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}
                <hr className={dashboardStyles.menuDivider} />
                <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>Sign Out</button>
              </section>
            )}
          </div>
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
