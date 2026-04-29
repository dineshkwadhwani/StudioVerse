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
  runTransaction,
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
import CreditPackagesSection from "./CreditPackagesSection";
import PromotionPackagesSection from "./PromotionPackagesSection";
import PromotionRequestsSection from "./PromotionRequestsSection";
import ManageOrdersSection from "./ManageOrdersSection";
import { listAllReferrals, sendReferralReminders } from "@/services/referral.service";
import { getTenantRegistrationFreeCoins, listWalletSummary } from "@/services/wallet.service";
import { getAssignmentsForAssignerContext } from "@/services/assignment.service";
import type { AssignmentRecord } from "@/types/assignment";
import type { ReferredType, ReferralRecord, ReferralStatus } from "@/types/referral";
import type { WalletUserType } from "@/types/wallet";
import { useClickOutside } from "@/hooks/useClickOutside";
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
  | "referrals"
  | "assigned-activities"
  | "assign-activity"
  | "credit-packages"
  | "promotion-packages"
  | "promotion-requests"
  | "orders";

type AppUserType = "superadmin" | "company" | "professional" | "individual";
type UsersFilter = "all" | AppUserType;
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
  landingConfig?: {
    sections?: { programs: boolean; tools: boolean; events: boolean };
    carouselItemLimits?: { programs: number; tools: number; events: number };
    displayLabels?: { programs?: string; tools?: string; events?: string };
    sectionIntros?: { programs?: string; tools?: string; events?: string };
  };
  walletConfig?: {
    registrationFreeCoins?: number;
    referralFreeCoins?: number;
  };
  mailConfig?: {
    enabled?: boolean;
    fromEmail?: string;
    fromName?: string;
  };
  botConfig?: {
    visible?: boolean;
    studioBotEnabled?: boolean;
    professionalBotEnabled?: boolean;
    personaName?: string;
      personaAvatar?: string;
    messageCap?: number;
  };
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

type TenantLandingFormState = {
  sectionPrograms: boolean;
  sectionTools: boolean;
  sectionEvents: boolean;
  carouselPrograms: number;
  carouselTools: number;
  carouselEvents: number;
  labelPrograms: string;
  labelTools: string;
  labelEvents: string;
  introPrograms: string;
  introTools: string;
  introEvents: string;
};

type TenantWalletFormState = {
  registrationFreeCoins: number;
  referralFreeCoins: number;
};

type TenantMailFormState = {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
};

type TenantBotFormState = {
  visible: boolean;
  studioBotEnabled: boolean;
  professionalBotEnabled: boolean;
  personaName: string;
    personaAvatar: string;
  messageCap: number;
};

type TenantFormState = {
  tenantId: string;
  tenantName: string;
  domainName: string;
  rootContext: string;
  status: Status;
  landingConfig: TenantLandingFormState;
  walletConfig: TenantWalletFormState;
  mailConfig: TenantMailFormState;
  botConfig: TenantBotFormState;
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
  referralsMade: number;
  referralsJoined: number;
};

type ReferralRoleFilter = "all" | "company" | "professional" | "individual";
type ReferralTypeFilter = "all" | ReferredType;
type ReferralStatusFilter = "all" | ReferralStatus;

const MENU_ITEMS: { key: MenuKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "profile", label: "Update Profile" },
  { key: "users", label: "Users" },
  { key: "tenants", label: "Tenants" },
  { key: "tools", label: "Assessment" },
  { key: "programs", label: "Programs" },
  { key: "events", label: "Events" },
  { key: "coins", label: "Wallet" },
  { key: "credit-packages", label: "Credit Packages" },
  { key: "promotion-packages", label: "Promotion Package" },
  { key: "orders", label: "Orders" },
  { key: "referrals", label: "References" },
  { key: "assigned-activities", label: "Assigned Activities" },
  { key: "assign-activity", label: "Assign Activity" },
  { key: "promotion-requests", label: "Promotion Requests" },
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
    itemKeys: [
      "users",
      "tenants",
      "tools",
      "programs",
      "events",
      "coins",
      "credit-packages",
      "promotion-packages",
      "orders",
      "referrals"
    ],
  },
  {
    key: "actions",
    label: "Actions",
    itemKeys: ["assigned-activities", "assign-activity", "promotion-requests"],
  },
];

function formatAssignedAt(value: AssignmentRecord["createdAt"]): string {
  if (!value || !("toDate" in value) || typeof value.toDate !== "function") {
    return "-";
  }

  return value.toDate().toLocaleString();
}

function getUsersFilterLabel(value: UsersFilter): string {
  if (value === "all") return "All";
  if (value === "superadmin") return "Super Admin";
  if (value === "company") return "Company";
  if (value === "professional") return "Professional";
  return "Individual";
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
  landingConfig: {
    sectionPrograms: true,
    sectionTools: true,
    sectionEvents: true,
    carouselPrograms: 8,
    carouselTools: 8,
    carouselEvents: 8,
    labelPrograms: "Programs",
    labelTools: "Tools",
    labelEvents: "Events",
    introPrograms: "Each programme pairs a clear commercial use case with a polished learner experience.",
    introTools: "Every tool supports stronger diagnostics, better reporting, and premium client journeys.",
    introEvents: "From roundtables to showcases, each event is designed for practical outcomes.",
  },
  walletConfig: {
    registrationFreeCoins: 10,
    referralFreeCoins: 5,
  },
  mailConfig: {
    enabled: false,
    fromEmail: "",
    fromName: "",
  },
  botConfig: {
    visible: false,
    studioBotEnabled: false,
    professionalBotEnabled: false,
    personaName: "",
      personaAvatar: "",
    messageCap: 5,
  },
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
  referralsMade: 0,
  referralsJoined: 0,
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
  const [promotionRequestsTenantId, setPromotionRequestsTenantId] = useState<string>("");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(EMPTY_DASHBOARD_STATS);

  const [usersFilter, setUsersFilter] = useState<UsersFilter>("all");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [assignedActivities, setAssignedActivities] = useState<AssignmentRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [referralRoleFilter, setReferralRoleFilter] = useState<ReferralRoleFilter>("all");
  const [referralTypeFilter, setReferralTypeFilter] = useState<ReferralTypeFilter>("all");
  const [referralStatusFilter, setReferralStatusFilter] = useState<ReferralStatusFilter>("all");
  const [referralTenantFilter, setReferralTenantFilter] = useState<string>("all");
  const [selectedReferralIds, setSelectedReferralIds] = useState<string[]>([]);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(EMPTY_USER_FORM);
  const [tenantForm, setTenantForm] = useState<TenantFormState>(EMPTY_TENANT_FORM);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

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

  const filteredUsers = useMemo(() => {
    if (usersFilter === "all") {
      return users;
    }

    return users.filter((entry) => entry.userType === usersFilter);
  }, [users, usersFilter]);

  const existingCompaniesForTenant = useMemo(() => {
    if (!userForm.tenantId) {
      return [];
    }

    const companyNames = users
      .filter((entry) => entry.userType === "company" && entry.tenantId === userForm.tenantId)
      .map((entry) => (entry.companyName || entry.name || "").trim())
      .filter(Boolean);

    return Array.from(new Set(companyNames)).sort((a, b) => a.localeCompare(b));
  }, [userForm.tenantId, users]);

  const normalizedUserPhone = useMemo(() => normalizePhone(userForm.phoneE164), [userForm.phoneE164]);

  const existingPhoneUser = useMemo(() => {
    if (!normalizedUserPhone || normalizedUserPhone === "+") {
      return null;
    }

    return (
      users.find((entry) => entry.phoneE164 === normalizedUserPhone && entry.id !== userForm.id) ?? null
    );
  }, [normalizedUserPhone, userForm.id, users]);

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

    void (async () => {
      await Promise.all([loadUsers(), loadTenants()]);
    })();
  }, [profile, activeMenu]);

  useEffect(() => {
    if (userForm.userType === "superadmin") {
      if (userForm.tenantId !== "platform" || userForm.companyName) {
        setUserForm((prev) => ({ ...prev, tenantId: "platform", companyName: "" }));
      }
      return;
    }

    if (userForm.tenantId === "platform") {
      setUserForm((prev) => ({ ...prev, tenantId: "", companyName: "" }));
    }
  }, [userForm.companyName, userForm.tenantId, userForm.userType]);

  useEffect(() => {
    if (userForm.userType === "company") {
      return;
    }

    if (userForm.companyName && !existingCompaniesForTenant.includes(userForm.companyName)) {
      setUserForm((prev) => ({ ...prev, companyName: "" }));
    }
  }, [existingCompaniesForTenant, userForm.companyName, userForm.userType]);

  useEffect(() => {
    if (!profile || (activeMenu !== "tenants" && activeMenu !== "coins" && activeMenu !== "referrals")) {
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

  useEffect(() => {
    if (!profile || activeMenu !== "referrals") {
      return;
    }

    void loadReferrals();
  }, [profile, activeMenu, referralRoleFilter, referralStatusFilter, referralTypeFilter, referralTenantFilter]);

    useEffect(() => {
      if (!userModalOpen && !tenantModalOpen) {
        return;
      }

      function handleEscape(event: KeyboardEvent) {
        if (event.key !== "Escape") {
          return;
        }

        if (tenantModalOpen) {
          setTenantModalOpen(false);
          return;
        }

        if (userModalOpen) {
          setUserModalOpen(false);
        }
      }

      window.addEventListener("keydown", handleEscape);
      return () => {
        window.removeEventListener("keydown", handleEscape);
      };
    }, [tenantModalOpen, userModalOpen]);

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

  async function loadUsers() {
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
      const [walletSummary, allReferrals] = await Promise.all([
        listWalletSummary(),
        listAllReferrals(),
      ]);

      const users = usersSnap.docs.map((entry) => entry.data() as Omit<AppUser, "id">);
      const referralsMade = allReferrals.length;
      const referralsJoined = allReferrals.filter((r) => r.status === "joined").length;

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
        referralsMade,
        referralsJoined,
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

  async function loadReferrals() {
    try {
      const rows = await listAllReferrals({
        referrerRole: referralRoleFilter,
        referredType: referralTypeFilter,
        status: referralStatusFilter,
        tenantId: referralTenantFilter !== "all" ? referralTenantFilter : undefined,
      });
      setReferrals(rows);
      setSelectedReferralIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load referrals.";
      setAuthError(message);
      setReferrals([]);
    }
  }

  async function handleSuperAdminReminderSend() {
    if (!profile || selectedReferralIds.length === 0) {
      return;
    }

    setBusy(true);
    setAuthError("");
    setInfo("");

    try {
      const sentCount = await sendReferralReminders({
        referralIds: selectedReferralIds,
        actorUserId: profile.id,
      });
      setInfo(`Reminder placeholder sent for ${sentCount} referral${sentCount === 1 ? "" : "s"}.`);
      await loadReferrals();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send referral reminders.";
      setAuthError(message);
    } finally {
      setBusy(false);
    }
  }

  function openAddUserModal() {
    setUserForm({ ...EMPTY_USER_FORM, userType: usersFilter === "all" ? "individual" : usersFilter });
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
      landingConfig: {
        sectionPrograms: target.landingConfig?.sections?.programs ?? true,
        sectionTools: target.landingConfig?.sections?.tools ?? true,
        sectionEvents: target.landingConfig?.sections?.events ?? true,
        carouselPrograms: target.landingConfig?.carouselItemLimits?.programs ?? 8,
        carouselTools: target.landingConfig?.carouselItemLimits?.tools ?? 8,
        carouselEvents: target.landingConfig?.carouselItemLimits?.events ?? 8,
        labelPrograms: target.landingConfig?.displayLabels?.programs ?? "Programs",
        labelTools: target.landingConfig?.displayLabels?.tools ?? "Tools",
        labelEvents: target.landingConfig?.displayLabels?.events ?? "Events",
        introPrograms:
          target.landingConfig?.sectionIntros?.programs ??
          "Each programme pairs a clear commercial use case with a polished learner experience.",
        introTools:
          target.landingConfig?.sectionIntros?.tools ??
          "Every tool supports stronger diagnostics, better reporting, and premium client journeys.",
        introEvents:
          target.landingConfig?.sectionIntros?.events ??
          "From roundtables to showcases, each event is designed for practical outcomes.",
      },
      walletConfig: {
        registrationFreeCoins: target.walletConfig?.registrationFreeCoins ?? 10,
        referralFreeCoins: target.walletConfig?.referralFreeCoins ?? 5,
      },
      mailConfig: {
        enabled: target.mailConfig?.enabled ?? false,
        fromEmail: target.mailConfig?.fromEmail ?? "",
        fromName: target.mailConfig?.fromName ?? "",
      },
      botConfig: {
        visible: target.botConfig?.visible ?? false,
        studioBotEnabled: target.botConfig?.studioBotEnabled ?? false,
        professionalBotEnabled: target.botConfig?.professionalBotEnabled ?? false,
        personaName: target.botConfig?.personaName ?? "",
          personaAvatar: target.botConfig?.personaAvatar ?? "",
        messageCap: target.botConfig?.messageCap ?? 5,
      },
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
      const trimmedName = userForm.name.trim();
      const normalizedPhone = normalizePhone(userForm.phoneE164);
      const normalizedEmail = userForm.email.trim();
      const normalizedTenantId = userForm.userType === "superadmin" ? "platform" : userForm.tenantId.trim();
      const normalizedCompanyName = userForm.companyName.trim();

      if (!trimmedName) {
        throw new Error("Name is required.");
      }

      if (!normalizedPhone || normalizedPhone === "+" || normalizedPhone.length < 10) {
        throw new Error("Phone number is required and must be valid.");
      }

      if (existingPhoneUser) {
        throw new Error("This phone number is already linked to another user.");
      }

      if (!normalizedTenantId) {
        throw new Error("Tenant is required.");
      }

      if (userForm.userType === "company" && !normalizedCompanyName) {
        throw new Error("Company name is required when user type is company.");
      }

      const payload = {
        name: trimmedName,
        email: normalizedEmail,
        phoneE164: normalizedPhone,
        userType: userForm.userType,
        status: userForm.status,
        tenantId: normalizedTenantId,
        companyName: normalizedCompanyName || "",
        createdBy: profile.id,
        updatedAt: serverTimestamp(),
      };

      if (userForm.id) {
        await updateDoc(doc(db, "users", userForm.id), payload);
      } else {
        const userRef = doc(collection(db, "users"));

        await setDoc(userRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });

        const isWalletEligible =
          userForm.userType === "company"
          || userForm.userType === "professional"
          || userForm.userType === "individual";

        if (isWalletEligible) {
          const registrationCoins = await getTenantRegistrationFreeCoins(normalizedTenantId);
          const userType = userForm.userType as WalletUserType;
          const walletRef = doc(db, "wallets", userRef.id);

          await runTransaction(db, async (transaction) => {
            const walletSnap = await transaction.get(walletRef);
            if (walletSnap.exists()) {
              return;
            }

            transaction.set(walletRef, {
              userId: userRef.id,
              tenantId: normalizedTenantId,
              userType,
              userName: trimmedName,
              totalIssuedCoins: registrationCoins,
              utilizedCoins: 0,
              availableCoins: registrationCoins,
              createdBy: profile.id,
              updatedBy: profile.id,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            if (registrationCoins > 0) {
              const walletTxRef = doc(collection(db, "walletTransactions"));
              transaction.set(walletTxRef, {
                walletId: userRef.id,
                userId: userRef.id,
                tenantId: normalizedTenantId,
                userType,
                userName: trimmedName,
                transactionType: "credit",
                coins: registrationCoins,
                reason: "Initial wallet issuance",
                createdBy: profile.id,
                createdAt: serverTimestamp(),
              });
            }
          });
        }
      }

      setUserModalOpen(false);
      // Reset form after successful save
      setUserForm({
        ...EMPTY_USER_FORM,
        userType: usersFilter === "all" ? "individual" : usersFilter,
      });
      setInfo("User saved.");
      await loadUsers();
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
        landingConfig: {
          sections: {
            programs: tenantForm.landingConfig.sectionPrograms,
            tools: tenantForm.landingConfig.sectionTools,
            events: tenantForm.landingConfig.sectionEvents,
          },
          carouselItemLimits: {
            programs: tenantForm.landingConfig.carouselPrograms,
            tools: tenantForm.landingConfig.carouselTools,
            events: tenantForm.landingConfig.carouselEvents,
          },
          displayLabels: {
            programs: tenantForm.landingConfig.labelPrograms.trim() || "Programs",
            tools: tenantForm.landingConfig.labelTools.trim() || "Tools",
            events: tenantForm.landingConfig.labelEvents.trim() || "Events",
          },
          sectionIntros: {
            programs:
              tenantForm.landingConfig.introPrograms.trim() ||
              "Each programme pairs a clear commercial use case with a polished learner experience.",
            tools:
              tenantForm.landingConfig.introTools.trim() ||
              "Every tool supports stronger diagnostics, better reporting, and premium client journeys.",
            events:
              tenantForm.landingConfig.introEvents.trim() ||
              "From roundtables to showcases, each event is designed for practical outcomes.",
          },
        },
        walletConfig: {
          registrationFreeCoins: Math.max(0, Math.floor(tenantForm.walletConfig.registrationFreeCoins)),
          referralFreeCoins: Math.max(0, Math.floor(tenantForm.walletConfig.referralFreeCoins)),
        },
        mailConfig: {
          enabled: tenantForm.mailConfig.enabled,
          fromEmail: tenantForm.mailConfig.fromEmail.trim().toLowerCase(),
          fromName: tenantForm.mailConfig.fromName.trim(),
        },
        botConfig: {
          visible: tenantForm.botConfig.visible,
          studioBotEnabled: tenantForm.botConfig.studioBotEnabled,
          professionalBotEnabled: tenantForm.botConfig.professionalBotEnabled,
          personaName: tenantForm.botConfig.personaName.trim(),
                    personaAvatar: tenantForm.botConfig.personaAvatar.trim(),
          messageCap: Math.max(1, Math.min(20, tenantForm.botConfig.messageCap)),
        },
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

          <div className={styles.profileArea} ref={menuRef}>
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
                <button type="button" className={styles.statTileButton} onClick={() => openDashboardMenu("referrals")}>
                  <p className={styles.statLabel}>Referrals Joined / Made</p>
                  <p className={styles.statValue}>{dashboardStats.referralsJoined}/{dashboardStats.referralsMade}</p>
                </button>
              </div>
            </article>
          ) : null}

          {activeMenu === "promotion-requests" ? (
            <PromotionRequestsSection operatorId={profile.id} />
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
            <div className={styles.usersGrid}>
              {/* Left Card: Manage Users Form */}
              <section className={styles.card}>
                <h2 className={styles.title}>Manage Users</h2>
                <p className={styles.subtitle}>Create or add users to the platform.</p>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="create-user-type">
                    Create User Type
                  </label>
                  <select
                    id="create-user-type"
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
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-tenant-id-input">
                    Tenant
                  </label>
                  <select
                    id="user-tenant-id-input"
                    className={styles.select}
                    value={userForm.userType === "superadmin" ? "platform" : userForm.tenantId}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, tenantId: event.target.value }))}
                    disabled={userForm.userType === "superadmin"}
                  >
                    <option value="">Select tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.tenantId}>
                        {tenant.tenantName} ({tenant.tenantId})
                      </option>
                    ))}
                    {userForm.userType === "superadmin" ? <option value="platform">Platform</option> : null}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-company-name-input">
                    Company
                  </label>
                  {userForm.userType === "company" ? (
                    <input
                      id="user-company-name-input"
                      className={styles.input}
                      placeholder="Company name"
                      value={userForm.companyName}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    />
                  ) : (
                    <select
                      id="user-company-name-input"
                      className={styles.select}
                      value={userForm.companyName}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, companyName: event.target.value }))}
                      disabled={!userForm.tenantId || userForm.userType === "superadmin"}
                    >
                      <option value="">No company</option>
                      {existingCompaniesForTenant.map((companyName) => (
                        <option key={companyName} value={companyName}>
                          {companyName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-name-input">
                    Name
                  </label>
                  <input
                    id="user-name-input"
                    className={styles.input}
                    placeholder="Full name"
                    value={userForm.name}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-phone-input">
                    Phone Number
                  </label>
                  <input
                    id="user-phone-input"
                    className={styles.input}
                    placeholder="+91..."
                    value={userForm.phoneE164}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, phoneE164: event.target.value }))}
                  />
                  {existingPhoneUser ? (
                    <p className={styles.error}>Phone already exists for user: {existingPhoneUser.name}</p>
                  ) : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-status-input">
                    Status
                  </label>
                  <select
                    id="user-status-input"
                    className={styles.select}
                    value={userForm.status}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value as Status }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-email-input">
                    Email Address
                  </label>
                  <input
                    id="user-email-input"
                    className={styles.input}
                    type="email"
                    placeholder="user@example.com (optional)"
                    value={userForm.email}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.button} onClick={saveUser} disabled={busy}>
                    {busy ? "Creating..." : "Create User"}
                  </button>
                </div>

                {authError && <p className={styles.error}>{authError}</p>}
                {info && <p className={styles.info}>{info}</p>}
              </section>

              {/* Right Card: Users List with Filter */}
              <section className={styles.card}>
                <h2 className={styles.title}>Users In Scope</h2>
                <p className={styles.subtitle}>View and manage existing users by type.</p>

                <div className={styles.filterRow}>
                  {(["all", "superadmin", "company", "professional", "individual"] as UsersFilter[]).map((value) => (
                    <label
                      key={value}
                      className={`${styles.filterPill} ${usersFilter === value ? styles.filterPillActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="users-filter"
                        checked={usersFilter === value}
                        onChange={() => setUsersFilter(value)}
                        className={styles.filterRadio}
                      />
                      <span>{getUsersFilterLabel(value)}</span>
                    </label>
                  ))}
                </div>

                {filteredUsers.length === 0 ? (
                  <div className={styles.emptyCard}>No records found.</div>
                ) : (
                  <div className={styles.userStack}>
                    {filteredUsers.map((item) => (
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
              </section>
            </div>
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

          {activeMenu === "credit-packages" ? <CreditPackagesSection operatorId={profile.id} /> : null}

          {activeMenu === "promotion-packages" ? (
            <PromotionPackagesSection
              operatorId={profile.id}
              onOpenPromotionRequests={(tenantId) => {
                setPromotionRequestsTenantId(tenantId ?? "");
                setActiveMenu("promotion-requests");
              }}
            />
          ) : null}
          {activeMenu === "promotion-requests" ? (
            <PromotionRequestsSection
              operatorId={profile.id}
              initialTenantId={promotionRequestsTenantId || undefined}
              onBack={() => setActiveMenu("promotion-packages")}
            />
          ) : null}
          {activeMenu === "orders" ? <ManageOrdersSection /> : null}

          {activeMenu === "programs" ? <ProgramsSection tenants={tenants} /> : null}

          {activeMenu === "events" ? (
            <EventsSection tenants={tenants} />
          ) : null}

          {activeMenu === "referrals" ? (
            <article className={styles.card}>
              <h2>Manage Referrals</h2>
              <p className={styles.subtitle}>
                View platform-wide referrals, filter by role/type/status, and send reminder placeholder mails.
              </p>

              <div className={styles.controlCard}>
                <p className={styles.filterLabel}>Tenant</p>
                <select
                  className={styles.select}
                  value={referralTenantFilter}
                  onChange={(event) => setReferralTenantFilter(event.target.value)}
                >
                  <option value="all">All</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.tenantName}</option>
                  ))}
                </select>

                <p className={styles.filterLabel}>Referrers</p>
                <div className={styles.radioRow}>
                  {(["all", "company", "professional", "individual"] as ReferralRoleFilter[]).map((value) => (
                    <label key={value} className={styles.radioPill}>
                      <input
                        type="radio"
                        name="referral-role-filter"
                        checked={referralRoleFilter === value}
                        onChange={() => setReferralRoleFilter(value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>

                <p className={styles.filterLabel}>Referrals</p>
                <div className={styles.radioRow}>
                  {(["all", "coach", "individual"] as ReferralTypeFilter[]).map((value) => (
                    <label key={value} className={styles.radioPill}>
                      <input
                        type="radio"
                        name="referral-type-filter"
                        checked={referralTypeFilter === value}
                        onChange={() => setReferralTypeFilter(value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>

                <p className={styles.filterLabel}>Status</p>
                <div className={styles.radioRow}>
                  {(["all", "referred", "reminded", "joined"] as ReferralStatusFilter[]).map((value) => (
                    <label key={value} className={styles.radioPill}>
                      <input
                        type="radio"
                        name="referral-status-filter"
                        checked={referralStatusFilter === value}
                        onChange={() => setReferralStatusFilter(value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy || selectedReferralIds.length === 0}
                    onClick={handleSuperAdminReminderSend}
                  >
                    Send Reminder
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setSelectedReferralIds(referrals.map((entry) => entry.id))}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setSelectedReferralIds([])}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              {referrals.length === 0 ? (
                <div className={styles.emptyCard}>No referrals found.</div>
              ) : (
                <div className={styles.userStack}>
                  {referrals.map((item) => (
                    <section key={item.id} className={styles.userItem}>
                      <div>
                        <p className={styles.userName}>{item.referredEmail || item.referredPhone}</p>
                        <p className={styles.userMeta}>Referred Type: {item.referredType}</p>
                        <p className={styles.userMeta}>Referrer: {item.referrerName} ({item.referrerRole})</p>
                        <p className={styles.userMeta}>Phone: {item.referredPhone}</p>
                      </div>

                      <div className={styles.userActions}>
                        <label className={styles.radioPill}>
                          <input
                            type="checkbox"
                            checked={selectedReferralIds.includes(item.id)}
                            disabled={item.status === "joined"}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedReferralIds((prev) => Array.from(new Set([...prev, item.id])));
                                return;
                              }
                              setSelectedReferralIds((prev) => prev.filter((id) => id !== item.id));
                            }}
                          />
                          Select
                        </label>
                        <span className={styles.statusBadge}>{item.status}</span>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </article>
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
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setUserModalOpen(false);
            }
          }}
        >
          <section className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>{userForm.id ? "Edit User" : "Add User"}</h3>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setUserModalOpen(false)}
                aria-label="Close user modal"
              >
                x
              </button>
            </div>

            <div className={styles.modalBody}>

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
            </div>
          </section>
        </div>
      ) : null}

      {tenantModalOpen ? (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTenantModalOpen(false);
            }
          }}
        >
          <section className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Tenant</h3>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setTenantModalOpen(false)}
                aria-label="Close tenant modal"
              >
                x
              </button>
            </div>

            <div className={styles.modalBody}>

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

            <section className={styles.tenantConfigBlock}>
              <h4 className={styles.tenantConfigTitle}>Landing Page Configuration</h4>

              <p className={styles.tenantSubLabel}>Visible Sections</p>
              <div className={styles.radioRow}>
                <label className={styles.radioPill}>
                  <input
                    type="checkbox"
                    checked={tenantForm.landingConfig.sectionPrograms}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, sectionPrograms: event.target.checked } }))}
                  />
                  Programs
                </label>
                <label className={styles.radioPill}>
                  <input
                    type="checkbox"
                    checked={tenantForm.landingConfig.sectionTools}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, sectionTools: event.target.checked } }))}
                  />
                  Tools
                </label>
                <label className={styles.radioPill}>
                  <input
                    type="checkbox"
                    checked={tenantForm.landingConfig.sectionEvents}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, sectionEvents: event.target.checked } }))}
                  />
                  Events
                </label>
              </div>

              <div className={styles.tenantConfigGrid}>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="carousel-programs">
                    Programs Limit
                  </label>
                  <input
                    id="carousel-programs"
                    type="number"
                    min={1}
                    max={50}
                    className={`${styles.input} ${styles.compactInput}`}
                    value={tenantForm.landingConfig.carouselPrograms}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, carouselPrograms: Number(event.target.value) } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="carousel-tools">
                    Tools Limit
                  </label>
                  <input
                    id="carousel-tools"
                    type="number"
                    min={1}
                    max={50}
                    className={`${styles.input} ${styles.compactInput}`}
                    value={tenantForm.landingConfig.carouselTools}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, carouselTools: Number(event.target.value) } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="carousel-events">
                    Events Limit
                  </label>
                  <input
                    id="carousel-events"
                    type="number"
                    min={1}
                    max={50}
                    className={`${styles.input} ${styles.compactInput}`}
                    value={tenantForm.landingConfig.carouselEvents}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, carouselEvents: Number(event.target.value) } }))}
                  />
                </div>
              </div>

              <div className={styles.tenantConfigGrid}>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="label-programs">
                    Programs Section Label
                  </label>
                  <input
                    id="label-programs"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. Learning Journeys"
                    value={tenantForm.landingConfig.labelPrograms}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, labelPrograms: event.target.value } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="label-tools">
                    Tools Section Label
                  </label>
                  <input
                    id="label-tools"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. Assessment Centre"
                    value={tenantForm.landingConfig.labelTools}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, labelTools: event.target.value } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="label-events">
                    Events Section Label
                  </label>
                  <input
                    id="label-events"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. Live Sessions"
                    value={tenantForm.landingConfig.labelEvents}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, labelEvents: event.target.value } }))}
                  />
                </div>
              </div>

              <p className={styles.tenantSubLabel}>Section Intro Copy</p>
              <div className={styles.tenantConfigStack}>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="intro-programs">
                    Programs Intro
                  </label>
                  <textarea
                    id="intro-programs"
                    className={`${styles.input} ${styles.compactInput} ${styles.compactTextarea}`}
                    value={tenantForm.landingConfig.introPrograms}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, introPrograms: event.target.value } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="intro-tools">
                    Tools Intro
                  </label>
                  <textarea
                    id="intro-tools"
                    className={`${styles.input} ${styles.compactInput} ${styles.compactTextarea}`}
                    value={tenantForm.landingConfig.introTools}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, introTools: event.target.value } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="intro-events">
                    Events Intro
                  </label>
                  <textarea
                    id="intro-events"
                    className={`${styles.input} ${styles.compactInput} ${styles.compactTextarea}`}
                    value={tenantForm.landingConfig.introEvents}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, landingConfig: { ...prev.landingConfig, introEvents: event.target.value } }))}
                  />
                </div>
              </div>
            </section>

            <section className={styles.tenantConfigBlock}>
              <p className={styles.tenantSubLabel}>Wallet Configuration</p>
              <div className={styles.tenantConfigGrid}>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="registration-coins">
                    Registration Free Coins
                  </label>
                  <input
                    id="registration-coins"
                    type="number"
                    min={0}
                    max={1000}
                    className={`${styles.input} ${styles.compactInput}`}
                    value={tenantForm.walletConfig.registrationFreeCoins}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, walletConfig: { ...prev.walletConfig, registrationFreeCoins: Number(event.target.value) } }))}
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="referral-coins">
                    Referral Free Coins
                  </label>
                  <input
                    id="referral-coins"
                    type="number"
                    min={0}
                    max={1000}
                    className={`${styles.input} ${styles.compactInput}`}
                    value={tenantForm.walletConfig.referralFreeCoins}
                    onChange={(event) => setTenantForm((prev) => ({ ...prev, walletConfig: { ...prev.walletConfig, referralFreeCoins: Number(event.target.value) } }))}
                  />
                </div>
              </div>
            </section>

            <section className={styles.tenantConfigBlock}>
              <p className={styles.tenantSubLabel}>Mail Configuration</p>
              <div className={styles.tenantToggleRow}>
                <label className={styles.tenantToggleLabel}>
                  <input
                    type="checkbox"
                    checked={tenantForm.mailConfig.enabled}
                    onChange={(e) =>
                      setTenantForm((prev) => ({
                        ...prev,
                        mailConfig: { ...prev.mailConfig, enabled: e.target.checked },
                      }))
                    }
                  />
                  Enable Mail Sending
                </label>
              </div>

              <div className={styles.tenantConfigGrid}>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="mail-from-email">
                    From Email
                  </label>
                  <input
                    id="mail-from-email"
                    type="email"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. contact@coachingstudio.in"
                    value={tenantForm.mailConfig.fromEmail}
                    onChange={(e) =>
                      setTenantForm((prev) => ({
                        ...prev,
                        mailConfig: { ...prev.mailConfig, fromEmail: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="mail-from-name">
                    From Name
                  </label>
                  <input
                    id="mail-from-name"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. Coaching Studio"
                    value={tenantForm.mailConfig.fromName}
                    onChange={(e) =>
                      setTenantForm((prev) => ({
                        ...prev,
                        mailConfig: { ...prev.mailConfig, fromName: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className={styles.tenantConfigBlock}>
              <p className={styles.tenantSubLabel}>Bot Configuration</p>
              <div className={styles.tenantToggleRow}>
                <label className={styles.tenantToggleLabel}>
                  <input type="checkbox" checked={tenantForm.botConfig.visible} onChange={(e) => setTenantForm((prev) => ({ ...prev, botConfig: { ...prev.botConfig, visible: e.target.checked } }))} />
                  Bot Visible
                </label>
                <label className={styles.tenantToggleLabel}>
                  <input type="checkbox" checked={tenantForm.botConfig.studioBotEnabled} onChange={(e) => setTenantForm((prev) => ({ ...prev, botConfig: { ...prev.botConfig, studioBotEnabled: e.target.checked } }))} />
                  Studio Bot
                </label>
                <label className={styles.tenantToggleLabel}>
                  <input type="checkbox" checked={tenantForm.botConfig.professionalBotEnabled} onChange={(e) => setTenantForm((prev) => ({ ...prev, botConfig: { ...prev.botConfig, professionalBotEnabled: e.target.checked } }))} />
                  Professional Bot
                </label>
              </div>
              <div className={styles.tenantConfigGrid}>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="bot-persona-name">Persona Name</label>
                  <input
                    id="bot-persona-name"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. Coach Dinesh"
                    value={tenantForm.botConfig.personaName}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, botConfig: { ...prev.botConfig, personaName: e.target.value } }))}
                  />
                </div>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="bot-persona-avatar">Persona Avatar Path</label>
                  <input
                    id="bot-persona-avatar"
                    className={`${styles.input} ${styles.compactInput}`}
                    placeholder="e.g. /tenants/coaching-studio/bot.png"
                    value={tenantForm.botConfig.personaAvatar}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, botConfig: { ...prev.botConfig, personaAvatar: e.target.value } }))}
                  />
                </div>
                <div className={styles.compactField}>
                  <label className={styles.compactLabel} htmlFor="bot-message-cap">Message Cap</label>
                  <input
                    id="bot-message-cap"
                    type="number"
                    min={1}
                    max={20}
                    className={`${styles.input} ${styles.compactInput}`}
                    value={tenantForm.botConfig.messageCap}
                    onChange={(e) => setTenantForm((prev) => ({ ...prev, botConfig: { ...prev.botConfig, messageCap: Number(e.target.value) } }))}
                  />
                </div>
              </div>
            </section>

            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={saveTenant} disabled={busy}>
                Save Tenant
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => setTenantModalOpen(false)}>
                Cancel
              </button>
            </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
