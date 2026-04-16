"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import {
  createScopedManagedUser,
  getUserById,
  listManagedUsersForCompany,
  listManagedUsersForProfessional,
  listProfessionalsForCoachDropdown,
  type ManagedUserRecord,
} from "@/services/manage-users.service";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./ManageUsersPage.module.css";

type UserRole = StudioUserRole;

type CreatorProfile = {
  id: string;
  userId: string;
  role: UserRole;
  tenantId: string;
  fullName: string;
  companyName?: string;
  associatedCompanyId?: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

type ManageUsersPageProps = {
  tenantConfig?: TenantConfig;
};

export default function ManageUsersPage({ tenantConfig = coachingTenantConfig }: ManageUsersPageProps) {
  const router = useRouter();
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;

  const [role, setRole] = useState<UserRole>("individual");
  const [name, setName] = useState("User");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [coaches, setCoaches] = useState<ManagedUserRecord[]>([]);

  const [targetUserType, setTargetUserType] = useState<"professional" | "individual">("individual");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [coachProfessionalId, setCoachProfessionalId] = useState("");

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    const storedRoleRaw = sessionStorage.getItem("cs_role");
    const storedName = sessionStorage.getItem("cs_name");

    if (!isUserRole(storedRoleRaw)) {
      router.replace(basePath);
      return;
    }

    setRole(storedRoleRaw);
    setName(storedName ?? "User");

    if (storedRoleRaw === "individual") {
      router.replace(`${basePath}/dashboard`);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const storedUid = sessionStorage.getItem("cs_uid");
        const storedProfileId = sessionStorage.getItem("cs_profile_id");
        const storedPhone = sessionStorage.getItem("cs_phone");

        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        if (!profile) {
          throw new Error("Unable to resolve your profile.");
        }

        const creatorDoc = await getUserById(profile.userId);
        const creatorProfile: CreatorProfile = {
          id: creatorDoc?.id ?? profile.id,
          userId: profile.userId,
          role: profile.userType,
          tenantId: profile.tenantId,
          fullName: profile.fullName,
          companyName: creatorDoc?.companyName || profile.companyName,
          associatedCompanyId: creatorDoc?.associatedCompanyId,
        };

        setCreator(creatorProfile);

        if (profile.userType === "company") {
          setTargetUserType("professional");
        }

        await loadManagedUsers(creatorProfile);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load Manage Users.";
        setError(message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  async function loadManagedUsers(currentCreator: CreatorProfile) {
    if (currentCreator.role === "company") {
      const managed = await listManagedUsersForCompany({
        tenantId: currentCreator.tenantId,
        companyId: currentCreator.id,
      });
      setUsers(managed);

      const professionals = await listProfessionalsForCoachDropdown({
        tenantId: currentCreator.tenantId,
        companyId: currentCreator.id,
      });
      setCoaches(professionals);
      return;
    }

    if (currentCreator.role === "professional") {
      const managed = await listManagedUsersForProfessional({
        professionalId: currentCreator.id,
      });
      setUsers(managed);
      setCoaches([]);
      return;
    }

    setUsers([]);
    setCoaches([]);
  }

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";

  const canCreateProfessional = creator?.role === "company";
  const showCoachDropdown = creator?.role === "company" && targetUserType === "individual";

  async function handleCreateUser() {
    if (!creator) return;

    setError("");
    setSuccess("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phoneE164);

    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !normalizedPhone) {
      setError("First name, last name, phone number, and email are required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (creator.role === "professional" && targetUserType !== "individual") {
      setError("Professional can create only Individual users.");
      return;
    }

    setSaving(true);
    try {
      await createScopedManagedUser({
        targetUserType,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        phoneE164: normalizedPhone,
        coachProfessionalId: showCoachDropdown ? coachProfessionalId || undefined : undefined,
      });

      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneE164("");
      setCoachProfessionalId("");
      setSuccess(`${targetUserType === "professional" ? "Professional" : "Individual"} created successfully.`);

      await loadManagedUsers(creator);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to create user.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    sessionStorage.clear();
    router.replace(basePath);
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>Loading Manage Users...</div>
        </div>
      </main>
    );
  }

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
                      <Link key={item.key} href={item.href} className={dashboardStyles.menuLink} onClick={() => setMenuOpen(false)}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
                <hr className={dashboardStyles.menuDivider} />
                <button type="button" className={dashboardStyles.menuItem} onClick={handleLogout}>Sign Out</button>
              </section>
            )}
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.grid}>
          <section className={styles.card}>
            <h1 className={styles.title}>Manage Users</h1>
            <p className={styles.subtitle}>
              {creator?.role === "company"
                ? "Create Professionals and Individuals in your Company scope."
                : "Create Individuals associated with your Professional scope."}
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Create User Type</label>
              <select
                className={styles.select}
                value={targetUserType}
                onChange={(event) => setTargetUserType(event.target.value as "professional" | "individual")}
              >
                {canCreateProfessional ? <option value="professional">Professional</option> : null}
                <option value="individual">Individual</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>First Name</label>
              <input className={styles.input} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Last Name</label>
              <input className={styles.input} value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>

            {showCoachDropdown ? (
              <div className={styles.field}>
                <label className={styles.label}>Coach (Optional)</label>
                <select
                  className={styles.select}
                  value={coachProfessionalId}
                  onChange={(event) => setCoachProfessionalId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.fullName}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label}>Phone Number</label>
              <input className={styles.input} value={phoneE164} onChange={(event) => setPhoneE164(event.target.value)} placeholder="+91..." />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Email Address</label>
              <input className={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleCreateUser} disabled={saving}>
                {saving ? "Creating..." : "Create User"}
              </button>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.title}>Users In Scope</h2>
            <p className={styles.subtitle}>
              {creator?.role === "company"
                ? "Showing Professionals and Individuals from your Company."
                : "Showing Individuals associated with you."}
            </p>

            {users.length === 0 ? (
              <p className={styles.empty}>No users found in your scope yet.</p>
            ) : (
              <div className={styles.usersList}>
                {users.map((user) => (
                  <article key={user.id} className={styles.userRow}>
                    <p className={styles.userName}>{user.fullName}</p>
                    <p className={styles.userMeta}>Type: {user.userType}</p>
                    <p className={styles.userMeta}>{user.email}</p>
                    <p className={styles.userMeta}>{user.phoneE164}</p>
                    {creator?.role === "company" && user.userType === "individual" ? (
                      <p className={styles.userMeta}>
                        Coach: {coaches.find((coach) => coach.id === user.associatedProfessionalId)?.fullName || "Unassigned"}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
