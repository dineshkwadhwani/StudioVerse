"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut,
  type User,
} from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import {
  MASTER_SUPERADMIN,
  MASTER_SUPERADMIN_PHONE_E164,
  normalizePhone,
} from "./masterData";
import ProgramsSection from "./ProgramsSection";
import EventsSection from "./EventsSection";
import AssessmentsSection from "./AssessmentsSection";
import ManageCoinsSection from "./ManageCoinsSection";
import { listWalletSummary } from "@/services/wallet.service";
import { getAssignmentsForAssignerContext } from "@/services/assignment.service";
import type { AssignmentRecord } from "@/types/assignment";
import styles from "./SuperAdminPortal.module.css";

type MenuKey =
  | "dashboard"
  | "profile"
  | "users"
  | "tenants"
  | "tools"
  | "programs"
  | "events"
  | "coins"
  | "assigned-activities"
  | "assign-activity";

type AppUserType = "superadmin" | "company" | "professional" | "individual";
type Status = "active" | "inactive";

type AppUser = {
  id: string;
  uid?: string;
  name: string;
  email: string;
  phoneE164: string;
  userType: AppUserType;
  status: Status;
  tenantId?: string;
  companyName?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type TenantRecord = {
  id: string;
  tenantId: string;
  tenantName: string;
  domainName: string;
  rootContext: string;
  status: Status;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type UserFormState = {
  id?: string;
  name: string;
  email: string;
  phoneE164: string;
  userType: AppUserType;
  status: Status;
  tenantId: string;
  companyName: string;
};

type TenantFormState = {
  tenantId: string;
  tenantName: string;
  domainName: string;
  rootContext: string;
  status: Status;
};

type DashboardStats = {
  tenants: number;
  programs: number;
  assessments: number;
  events: number;
  totalIssuedCoins: number;
  totalUtilizedCoins: number;
  companies: number;
  professionals: number;
  individuals: number;
};

const MENU_ITEMS: { key: MenuKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "profile", label: "Update Profile" },
  { key: "users", label: "Users" },
  { key: "tenants", label: "Tenants" },
  { key: "tools", label: "Assessment" },
  { key: "programs", label: "Programs" },
  { key: "events", label: "Events" },
  { key: "coins", label: "Wallet" },
  { key: "assigned-activities", label: "Assigned Activities" },
  { key: "assign-activity", label: "Assign Activity" },
];

const MENU_GROUPS: Array<{ key: string; label: string; itemKeys: MenuKey[] }> = [
  {
    key: "my-account",
    label: "My Account",
    itemKeys: ["dashboard", "profile"],
  },
  {
    key: "manage",
    label: "Manage",
    itemKeys: ["users", "tenants", "tools", "programs", "events", "coins"],
  },
  {
    key: "actions",
    label: "Actions",
    itemKeys: ["assigned-activities", "assign-activity"],
  },
];

function formatAssignedAt(value: AssignmentRecord["createdAt"]): string {
  if (!value || !("toDate" in value) || typeof value.toDate !== "function") {
    return "-";
  }

  return value.toDate().toLocaleString();
}

const EMPTY_USER_FORM: UserFormState = {
  name: "",
  email: "",
  phoneE164: "",
  userType: "individual",
  status: "active",
  tenantId: "",
  companyName: "",
};

const EMPTY_TENANT_FORM: TenantFormState = {
  tenantId: "",
  tenantName: "",
  domainName: "",
  rootContext: "",
  status: "active",
};

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  tenants: 0,
  programs: 0,
  assessments: 0,
  events: 0,
  totalIssuedCoins: 0,
  totalUtilizedCoins: 0,
  companies: 0,
  professionals: 0,
  individuals: 0,
};

async function ensureSuperadminProfile(firebaseUser: User): Promise<AppUser> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);
  const phoneE164 = normalizePhone(firebaseUser.phoneNumber ?? "");

  if (userSnap.exists()) {
    const existing = userSnap.data() as Omit<AppUser, "id">;
    if (existing.userType !== "superadmin") {
      throw new Error("This account is not a superadmin.");
    }
    if (existing.status !== "active") {
      throw new Error("This superadmin account is inactive.");
    }

    return { id: userSnap.id, ...existing };
  }

  if (phoneE164 === MASTER_SUPERADMIN_PHONE_E164) {
    const seedRecord = {
      uid: firebaseUser.uid,
      name: MASTER_SUPERADMIN.fullName,
      email: MASTER_SUPERADMIN.email,
      phoneE164: MASTER_SUPERADMIN_PHONE_E164,
      userType: "superadmin" as const,
      status: "active" as const,
      tenantId: "platform",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, seedRecord);

    return {
      id: firebaseUser.uid,
      ...seedRecord,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  const superadminByPhone = query(
    collection(db, "users"),
    where("userType", "==", "superadmin"),
    where("phoneE164", "==", phoneE164),
    where("status", "==", "active"),
    limit(1)
  );

  const matching = await getDocs(superadminByPhone);
  if (matching.empty) {
    throw new Error("No active superadmin registration found for this phone number.");
  }

  const matchedDoc = matching.docs[0];
  const matchedData = matchedDoc.data() as Omit<AppUser, "id">;

  await setDoc(
    userRef,
    {
      ...matchedData,
      uid: firebaseUser.uid,
      updatedAt: serverTimestamp(),
      createdAt: matchedData.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: firebaseUser.uid,
    ...matchedData,
    uid: firebaseUser.uid,
  };
}

export default function SuperAdminPortal() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [authError, setAuthError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("dashboard");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);

  const [usersFilter, setUsersFilter] = useState<AppUserType>("superadmin");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [assignedActivities, setAssignedActivities] = useState<AssignmentRecord[]>([]);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [tenantForm, setTenantForm] = useState<TenantFormState>(EMPTY_TENANT_FORM);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const userInitials = useMemo(() => {
    if (!profile?.name) {
      return "SA";
    }

    const parts = profile.name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return "SA";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [profile?.name]);

  function openDashboardMenu(menuKey: MenuKey, nextUsersFilter?: AppUserType) {
    if (nextUsersFilter) {
      setUsersFilter(nextUsersFilter);
    }
    setMenuOpen(false);
    setActiveMenu(menuKey);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        return;
      }

      setBusy(true);
      setAuthError("");
      try {
        const resolved = await ensureSuperadminProfile(firebaseUser);
        setProfile(resolved);
        setInfo("Superadmin authenticated.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to validate superadmin account.";
        setAuthError(message);
        await signOut(auth);
      } finally {
        setBusy(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (authUser || recaptchaRef.current || typeof window === "undefined") {
      return;
    }

    try {
      recaptchaRef.current = new RecaptchaVerifier(auth, "superadmin-recaptcha", {
        size: "normal",
      });
      recaptchaRef.current.render();
    } catch {
      setAuthError("Could not initialize OTP challenge.");
    }

    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, [authUser]);

  useEffect(() => {
    if (!profile || activeMenu !== "dashboard") {
      return;
    }

    void loadDashboardStats();
  }, [profile, activeMenu]);

  useEffect(() => {
    if (!profile || activeMenu !== "users") {
      return;
    }

    void loadUsers(usersFilter);
  }, [profile, activeMenu, usersFilter]);

  useEffect(() => {
    if (!profile || (activeMenu !== "tenants" && activeMenu !== "coins")) {
      return;
    }

    void loadTenants();
  }, [profile, activeMenu]);

  useEffect(() => {
    if (!profile || activeMenu !== "assigned-activities") {
      return;
    }

    void (async () => {
      try {
        const rows = await getAssignmentsForAssignerContext({
          tenantId: profile.tenantId || "platform",
          assignerIds: [profile.id, profile.uid ?? ""].filter(Boolean),
        });

        setAssignedActivities(rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load assigned activities.";
        setAuthError(message);
        setAssignedActivities([]);
      }
    })();
  }, [profile, activeMenu]);

  async function sendOtp() {
    if (!recaptchaRef.current) {
      setAuthError("OTP challenge is not ready. Reload this page once.");
      return;
    }

    setBusy(true);
    setAuthError("");
    setInfo("");

    try {
      const normalized = normalizePhone(phone);
      if (!normalized.startsWith("+") || normalized.length < 12) {
        throw new Error("Please enter a valid mobile number.");
      }

      const result = await signInWithPhoneNumber(auth, normalized, recaptchaRef.current);
      setConfirmation(result);
      setInfo("OTP sent. Enter the verification code to continue.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send OTP.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!confirmation) {
      setAuthError("Request OTP first.");
      return;
    }

    setBusy(true);
    setAuthError("");
    setInfo("");

    try {
      await confirmation.confirm(otp);
      setInfo("OTP verified successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid OTP.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  async function loadUsers(filterType: AppUserType) {
    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(usersRef);

      const mapped: AppUser[] = snap.docs
        .map((entry) => {
          const data = entry.data() as Omit<AppUser, "id">;
          return {
            id: entry.id,
            ...data,
          };
        })
        .filter((entry) => entry.userType === filterType)
        .sort((a, b) => a.name.localeCompare(b.name));

      setUsers(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load users.";
      setAuthError(message);
      setUsers([]);
    }
  }

  async function loadDashboardStats() {
    try {
      const [usersSnap, tenantsSnap, programsSnap, assessmentsSnap, eventsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "tenants")),
        getDocs(collection(db, "programs")),
        getDocs(collection(db, "assessments")),
        getDocs(collection(db, "events")),
      ]);
      const walletSummary = await listWalletSummary();

      const users = usersSnap.docs.map((entry) => entry.data() as Omit<AppUser, "id">);

      setDashboardStats({
        tenants: tenantsSnap.size,
        programs: programsSnap.size,
        assessments: assessmentsSnap.size,
        events: eventsSnap.size,
        totalIssuedCoins: walletSummary.totalIssuedCoins,
        totalUtilizedCoins: walletSummary.totalUtilizedCoins,
        companies: users.filter((entry) => entry.userType === "company").length,
        professionals: users.filter((entry) => entry.userType === "professional").length,
        individuals: users.filter((entry) => entry.userType === "individual").length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dashboard stats.";
      setAuthError(message);
      setDashboardStats(EMPTY_DASHBOARD_STATS);
    }
  }

  async function loadTenants() {
    try {
      const tenantsRef = collection(db, "tenants");
      const snap = await getDocs(tenantsRef);

      const mapped: TenantRecord[] = snap.docs
        .map((entry) => {
          const data = entry.data() as Omit<TenantRecord, "id">;
          return {
            id: entry.id,
            ...data,
          };
        })
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName));

      setTenants(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load tenants.";
      setAuthError(message);
      setTenants([]);
    }
  }

  function openAddUserModal() {
    setUserForm({ ...EMPTY_USER_FORM, userType: usersFilter });
    setUserModalOpen(true);
  }

  function openEditUserModal(target: AppUser) {
    setUserForm({
      id: target.id,
      name: target.name,
      email: target.email,
      phoneE164: target.phoneE164,
      userType: target.userType,
      status: target.status,
      tenantId: target.tenantId ?? "",
      companyName: target.companyName ?? "",
    });
    setUserModalOpen(true);
  }

  function openAddTenantModal() {
    setTenantForm({ ...EMPTY_TENANT_FORM });
    setTenantModalOpen(true);
  }

  function openEditTenantModal(target: TenantRecord) {
    setTenantForm({
      tenantId: target.tenantId,
      tenantName: target.tenantName,
      domainName: target.domainName,
      rootContext: target.rootContext,
      status: target.status,
    });
    setTenantModalOpen(true);
  }

  async function saveProfile() {
    if (!profile) {
      return;
    }

    setBusy(true);
    setAuthError("");
    setInfo("");

    try {
      await updateDoc(doc(db, "users", profile.id), {
        name: profile.name.trim(),
        email: profile.email.trim(),
        updatedAt: serverTimestamp(),
      });
      setInfo("Profile updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveUser() {
    if (!profile) {
      return;
    }

    setBusy(true);
    setAuthError("");
    setInfo("");

    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phoneE164: normalizePhone(userForm.phoneE164),
        userType: userForm.userType,
        status: userForm.status,
        tenantId: userForm.tenantId.trim() || "",
        companyName: userForm.companyName.trim() || "",
        createdBy: profile.id,
        updatedAt: serverTimestamp(),
      };

      if (userForm.id) {
        await updateDoc(doc(db, "users", userForm.id), payload);
      } else {
        await addDoc(collection(db, "users"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setUserModalOpen(false);
      setInfo("User saved.");
      await loadUsers(usersFilter);
      await loadDashboardStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save user.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTenant() {
    if (!profile) {
      return;
    }

    setBusy(true);
    setAuthError("");
    setInfo("");

    try {
      const tenantId = tenantForm.tenantId.trim().toLowerCase();
      const payload = {
        tenantId,
        tenantName: tenantForm.tenantName.trim(),
        domainName: tenantForm.domainName.trim(),
        rootContext: tenantForm.rootContext.trim(),
        status: tenantForm.status,
        updatedAt: serverTimestamp(),
        updatedBy: profile.id,
      };

      await setDoc(
        doc(db, "tenants", tenantId),
        {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: profile.id,
        },
        { merge: true }
      );

      setTenantModalOpen(false);
      setInfo("Tenant saved.");
      await loadTenants();
      await loadDashboardStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save tenant.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await signOut(auth);
    setMenuOpen(false);
    setInfo("Signed out.");
  }

  if (!authUser || !profile) {
    return (
      <main className={styles.page}>
        <section className={styles.authCard}>
          <h1 className={styles.title}>Superadmin Login</h1>
          <p className={styles.subtitle}>Use mobile OTP authentication to access StudioVerse admin controls.</p>

          <label className={styles.label} htmlFor="mobile-number">
            Mobile Number
          </label>
          <input
            id="mobile-number"
            className={styles.input}
            placeholder="Enter mobile number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <div id="superadmin-recaptcha" />

          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={sendOtp} disabled={busy}>
              {busy ? "Sending..." : "Send OTP"}
            </button>
          </div>

          <label className={styles.label} htmlFor="otp">
            Verification Code
          </label>
          <input
            id="otp"
            className={styles.input}
            placeholder="Enter OTP"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={verifyOtp} disabled={busy || !confirmation}>
              {busy ? "Verifying..." : "Verify OTP"}
            </button>
          </div>

          {authError ? <p className={styles.error}>{authError}</p> : null}
          {info ? <p className={styles.info}>{info}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.toolbar}>
          <div className={styles.brandBlock}>
            <Image
              src="/sv_logo.png"
              alt="StudioVerse"
              width={40}
              height={40}
              className={styles.brandLogo}
            />
          </div>

          <div className={styles.profileArea}>
            <button type="button" className={styles.profileButton} onClick={() => setMenuOpen((prev) => !prev)}>
              <span className={styles.profileInitials}>{userInitials}</span>
              <span aria-hidden="true"> ▾</span>
            </button>
            {menuOpen ? (
              <section className={styles.menuPanel}>
                <div className={styles.menuUser}>
                  <p className={styles.menuName}>{profile?.name ?? "Super Admin"}</p>
                  <p className={styles.menuRole}>Super Admin</p>
                </div>

                {MENU_GROUPS.map((group) => (
                  <div key={group.key} className={styles.menuGroup}>
                    <p className={styles.menuGroupTitle}>{group.label}</p>
                    {group.itemKeys.map((itemKey) => {
                      const item = MENU_ITEMS.find((entry) => entry.key === itemKey);
                      if (!item) {
                        return null;
                      }

                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`${styles.menuItem} ${activeMenu === item.key ? styles.menuItemActive : ""}`}
                          onClick={() => {
                            setActiveMenu(item.key);
                            setMenuOpen(false);
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <hr className={styles.menuDivider} />
                <button type="button" className={styles.menuItem} onClick={logout}>
                  Sign Out
                </button>
              </section>
            ) : null}
          </div>
        </header>

        <section className={styles.grid}>
          {activeMenu === "dashboard" ? (
            <article className={styles.card}>
              <h2>Dashboard</h2>
              <p className={styles.subtitle}>Platform-level overview across tenants, content, and user categories.</p>

              <div className={styles.dashboardGrid}>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("tenants")}>
                  <p className={styles.statLabel}>No of Tenants</p>
                  <p className={styles.statValue}>{dashboardStats.tenants}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("programs")}>
                  <p className={styles.statLabel}>Total Programs</p>
                  <p className={styles.statValue}>{dashboardStats.programs}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("tools")}>
                  <p className={styles.statLabel}>Total Assessments</p>
                  <p className={styles.statValue}>{dashboardStats.assessments}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("events")}>
                  <p className={styles.statLabel}>Total Events</p>
                  <p className={styles.statValue}>{dashboardStats.events}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("coins")}>
                  <p className={styles.statLabel}>Coins Utilized / Issued</p>
                  <p className={styles.statValue}>{dashboardStats.totalUtilizedCoins}/{dashboardStats.totalIssuedCoins}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("users", "company")}>
                  <p className={styles.statLabel}>No of Companies</p>
                  <p className={styles.statValue}>{dashboardStats.companies}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("users", "professional")}>
                  <p className={styles.statLabel}>No of Professionals</p>
                  <p className={styles.statValue}>{dashboardStats.professionals}</p>
                </button>
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("users", "individual")}>
                  <p className={styles.statLabel}>No of Individuals</p>
                  <p className={styles.statValue}>{dashboardStats.individuals}</p>
                </button>
              </div>
            </article>
          ) : null}

          {activeMenu === "profile" ? (
            <article className={styles.card}>
              <h2>Update Profile</h2>
              <label className={styles.label} htmlFor="profile-name">
                Name
              </label>
              <input
                id="profile-name"
                className={styles.input}
                value={profile.name}
                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              />

              <label className={styles.label} htmlFor="profile-email">
                Email
              </label>
              <input
                id="profile-email"
                className={styles.input}
                value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              />

              <div className={styles.actions}>
                <button type="button" className={styles.button} onClick={saveProfile} disabled={busy}>
                  Save Profile
                </button>
              </div>
            </article>
          ) : null}

          {activeMenu === "users" ? (
            <article className={styles.card}>
              <h2>Manage Users</h2>
              <p className={styles.subtitle}>List, add, and edit superadmins, companies, professionals, and individuals.</p>

              <div className={styles.controlCard}>
                <div className={styles.radioRow}>
                  {(["superadmin", "company", "professional", "individual"] as AppUserType[]).map((value) => (
                    <label key={value} className={styles.radioPill}>
                      <input
                        type="radio"
                        name="users-filter"
                        checked={usersFilter === value}
                        onChange={() => setUsersFilter(value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.button} onClick={openAddUserModal}>
                    Add User
                  </button>
                </div>
              </div>

              {users.length === 0 ? (
                <div className={styles.emptyCard}>No records found.</div>
              ) : (
                <div className={styles.userStack}>
                  {users.map((item) => (
                    <section key={item.id} className={styles.userItem}>
                      <div>
                        <p className={styles.userName}>{item.name}</p>
                        <p className={styles.userMeta}>{item.email}</p>
                        <p className={styles.userMeta}>{item.phoneE164}</p>
                      </div>

                      <div className={styles.userActions}>
                        <span className={styles.statusBadge}>{item.status}</span>
                        <button type="button" className={styles.rowAction} onClick={() => openEditUserModal(item)}>
                          Edit
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
          ) : null}

          {activeMenu === "tenants" ? (
            <article className={styles.card}>
              <h2>Manage Tenants</h2>
              <p className={styles.subtitle}>Add or update tenant metadata used for route/domain resolution and record scoping.</p>

              <div className={styles.controlCard}>
                <div className={styles.actions}>
                  <button type="button" className={styles.button} onClick={openAddTenantModal}>
                    Create Tenant
                  </button>
                </div>
              </div>

              {tenants.length === 0 ? (
                <div className={styles.emptyCard}>No tenants found.</div>
              ) : (
                <div className={styles.userStack}>
                  {tenants.map((item) => (
                    <section key={item.id} className={styles.userItem}>
                      <div>
                        <p className={styles.userName}>{item.tenantName}</p>
                        <p className={styles.userMeta}>Tenant ID: {item.tenantId}</p>
                        <p className={styles.userMeta}>Domain: {item.domainName || "-"}</p>
                        <p className={styles.userMeta}>Root Context: {item.rootContext || "-"}</p>
                      </div>

                      <div className={styles.userActions}>
                        <span className={styles.statusBadge}>{item.status}</span>
                        <button type="button" className={styles.rowAction} onClick={() => openEditTenantModal(item)}>
                          Edit
                        </button>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
          ) : null}

          {activeMenu === "tools" ? <AssessmentsSection tenants={tenants} /> : null}

          {activeMenu === "coins" ? (
            <ManageCoinsSection
              tenants={tenants}
              adminUserId={profile.id}
              onCoinsAssigned={() => {
                void loadDashboardStats();
              }}
            />
          ) : null}

          {activeMenu === "programs" ? <ProgramsSection tenants={tenants} /> : null}

          {activeMenu === "events" ? (
            <EventsSection tenants={tenants} />
          ) : null}

          {activeMenu === "assign-activity" ? (
            <article className={styles.card}>
              <h2>Assign Activity</h2>
              <p className={styles.subtitle}>
                Use the assessment, program, and event modules to assign activities across the platform.
              </p>
            </article>
          ) : null}

          {activeMenu === "assigned-activities" ? (
            <article className={styles.card}>
              <h2>Assigned Activities</h2>
              <p className={styles.subtitle}>Track activities assigned by your superadmin account and open reports where available.</p>

              {assignedActivities.length === 0 ? (
                <div className={styles.emptyCard}>No assigned activities found.</div>
              ) : (
                <div className={styles.userStack}>
                  {assignedActivities.map((item) => (
                    <section key={item.id} className={styles.userItem}>
                      <div>
                        <p className={styles.userName}>{item.activityTitle}</p>
                        <p className={styles.userMeta}>Type: {item.activityType}</p>
                        <p className={styles.userMeta}>Assigned to: {item.assigneeFullName || "-"}</p>
                        <p className={styles.userMeta}>Status: {item.status}</p>
                        <p className={styles.userMeta}>Assigned on: {formatAssignedAt(item.createdAt)}</p>
                      </div>

                      <div className={styles.userActions}>
                        {item.activityType === "assessment" ? (
                          <Link href={`/${item.tenantId}/my-activities/assessment-report/${item.id}`} className={styles.rowAction}>
                            Open Report
                          </Link>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
          ) : null}
        </section>

        {authError ? <p className={styles.error}>{authError}</p> : null}
        {info ? <p className={styles.info}>{info}</p> : null}
      </div>

      {userModalOpen ? (
        <div className={styles.modalOverlay}>
          <section className={styles.modal}>
            <h3>{userForm.id ? "Edit User" : "Add User"}</h3>

            <label className={styles.label} htmlFor="user-name">
              Name
            </label>
            <input
              id="user-name"
              className={styles.input}
              value={userForm.name}
              onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
            />

            <label className={styles.label} htmlFor="user-email">
              Email
            </label>
            <input
              id="user-email"
              className={styles.input}
              value={userForm.email}
              onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
            />

            <label className={styles.label} htmlFor="user-phone">
              Phone
            </label>
            <input
              id="user-phone"
              className={styles.input}
              value={userForm.phoneE164}
              onChange={(event) => setUserForm((prev) => ({ ...prev, phoneE164: event.target.value }))}
            />

            <label className={styles.label} htmlFor="user-type">
              Type
            </label>
            <select
              id="user-type"
              className={styles.select}
              value={userForm.userType}
              onChange={(event) =>
                setUserForm((prev) => ({ ...prev, userType: event.target.value as AppUserType }))
              }
            >
              <option value="superadmin">Superadmin</option>
              <option value="company">Company</option>
              <option value="professional">Professional</option>
              <option value="individual">Individual</option>
            </select>

            <label className={styles.label} htmlFor="user-status">
              Status
            </label>
            <select
              id="user-status"
              className={styles.select}
              value={userForm.status}
              onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value as Status }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <label className={styles.label} htmlFor="user-tenant-id">
              Tenant ID
            </label>
            <input
              id="user-tenant-id"
              className={styles.input}
              value={userForm.tenantId}
              onChange={(event) => setUserForm((prev) => ({ ...prev, tenantId: event.target.value }))}
            />

            <label className={styles.label} htmlFor="user-company-name">
              Company Name
            </label>
            <input
              id="user-company-name"
              className={styles.input}
              value={userForm.companyName}
              onChange={(event) => setUserForm((prev) => ({ ...prev, companyName: event.target.value }))}
            />

            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={saveUser} disabled={busy}>
                Save
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => setUserModalOpen(false)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {tenantModalOpen ? (
        <div className={styles.modalOverlay}>
          <section className={styles.modal}>
            <h3>Tenant</h3>

            <label className={styles.label} htmlFor="tenant-id">
              Tenant ID
            </label>
            <input
              id="tenant-id"
              className={styles.input}
              value={tenantForm.tenantId}
              onChange={(event) => setTenantForm((prev) => ({ ...prev, tenantId: event.target.value }))}
            />

            <label className={styles.label} htmlFor="tenant-name">
              Tenant Name
            </label>
            <input
              id="tenant-name"
              className={styles.input}
              value={tenantForm.tenantName}
              onChange={(event) => setTenantForm((prev) => ({ ...prev, tenantName: event.target.value }))}
            />

            <label className={styles.label} htmlFor="domain-name">
              Domain Name
            </label>
            <input
              id="domain-name"
              className={styles.input}
              value={tenantForm.domainName}
              onChange={(event) => setTenantForm((prev) => ({ ...prev, domainName: event.target.value }))}
            />

            <label className={styles.label} htmlFor="root-context">
              Root Context
            </label>
            <input
              id="root-context"
              className={styles.input}
              value={tenantForm.rootContext}
              onChange={(event) => setTenantForm((prev) => ({ ...prev, rootContext: event.target.value }))}
            />

            <label className={styles.label} htmlFor="tenant-status">
              Status
            </label>
            <select
              id="tenant-status"
              className={styles.select}
              value={tenantForm.status}
              onChange={(event) => setTenantForm((prev) => ({ ...prev, status: event.target.value as Status }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={saveTenant} disabled={busy}>
                Save Tenant
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => setTenantModalOpen(false)}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
