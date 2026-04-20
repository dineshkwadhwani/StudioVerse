"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import {
  createScopedManagedUser,
  getUserById,
  listManagedUsersForCompany,
  listManagedUsersForProfessional,
  listProfessionalsForCoachDropdown,
  lookupScopedIndividualByPhone,
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

function getRoleDisplayLabel(
  role: "company" | "professional" | "individual",
  tenantConfig: TenantConfig
): string {
  if (role === "company") {
    return tenantConfig.roles.company;
  }
  return role === "professional" ? tenantConfig.roles.professional : tenantConfig.roles.individual;
}

type ManageUsersPageProps = {
  tenantConfig?: TenantConfig;
};

export default function ManageUsersPage({ tenantConfig = coachingTenantConfig }: ManageUsersPageProps) {
  const router = useRouter();
  const pathname = usePathname();
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

  const [scopeFilter, setScopeFilter] = useState<"all" | "professional" | "individual">("all");
  const [targetUserType, setTargetUserType] = useState<"professional" | "individual">("individual");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [coachProfessionalId, setCoachProfessionalId] = useState("");
  const [searchingPhone, setSearchingPhone] = useState(false);
  const [phoneLookupState, setPhoneLookupState] = useState<"idle" | "found" | "not-found">("idle");
  const [phoneLookupMessage, setPhoneLookupMessage] = useState("");

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
  const filteredUsers = useMemo(() => {
    if (scopeFilter === "all") return users;
    return users.filter((u) => u.userType === scopeFilter);
  }, [users, scopeFilter]);

  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";
  const isCoachingStudioRoute = pathname?.startsWith("/coaching-studio");
  const professionalLabel = isCoachingStudioRoute ? "Coach" : tenantConfig.roles.professional;
  const individualLabel = isCoachingStudioRoute ? "Coachee" : tenantConfig.roles.individual;

  const canCreateProfessional = creator?.role === "company";
  const showCoachDropdown = creator?.role === "company" && targetUserType === "individual";
  const detailsEnabled = phoneLookupState === "not-found";
  const isAssociationMode = phoneLookupState === "found";

  useEffect(() => {
    setPhoneLookupState("idle");
    setPhoneLookupMessage("");
  }, [phoneE164, targetUserType]);

  useEffect(() => {
    setPhoneLookupState("idle");
    setPhoneLookupMessage("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneE164("");
  }, [targetUserType]);

  async function handleSearchByPhone() {
    setError("");
    setSuccess("");

    const normalizedPhone = normalizePhone(phoneE164);
    if (!normalizedPhone) {
      setError("Phone number is required.");
      return;
    }

    setSearchingPhone(true);
    try {
      const result = await lookupScopedIndividualByPhone({
        targetUserType,
        phoneE164: normalizedPhone,
        coachProfessionalId: showCoachDropdown ? coachProfessionalId || undefined : undefined,
      });

      if (result.found) {
        const selectedLabel = targetUserType === "professional" ? professionalLabel : individualLabel;
        const foundFirst = result.user?.firstName?.trim() || "";
        const foundLast = result.user?.lastName?.trim() || "";
        const fallbackName = (result.user?.fullName || "").trim();
        const fallbackParts = fallbackName ? fallbackName.split(/\s+/) : [];
        const nextFirst = foundFirst || (fallbackParts[0] || "");
        const nextLast = foundLast || (fallbackParts.length > 1 ? fallbackParts.slice(1).join(" ") : "");

        setFirstName(nextFirst);
        setLastName(nextLast);
        setEmail(result.user?.email || "");
        setPhoneLookupState("found");
        setPhoneLookupMessage(`Found existing ${selectedLabel}, association will be created.`);
      } else {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhoneLookupState("not-found");
        const selectedLabel = targetUserType === "professional" ? professionalLabel : individualLabel;
        setPhoneLookupMessage(`${selectedLabel} not found, please enter the details.`);
      }
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : "Phone lookup failed.";
      setError(message);
      setPhoneLookupState("idle");
      setPhoneLookupMessage("");
    } finally {
      setSearchingPhone(false);
    }
  }

  async function handleCreateUser() {
    if (!creator) return;

    setError("");
    setSuccess("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phoneE164);

    if (!normalizedPhone) {
      setError("Phone number is required.");
      return;
    }

    if (phoneLookupState === "idle") {
      setError("Please click Search by Phone before creating this user.");
      return;
    }

    if (phoneLookupState === "not-found") {
      if (!normalizedFirstName || !normalizedLastName || !normalizedEmail) {
        setError("First name, last name, and email are required when no existing user is found.");
        return;
      }
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (creator.role === "professional" && targetUserType !== "individual") {
      setError(`${professionalLabel} can create only ${individualLabel} users.`);
      return;
    }

    setSaving(true);
    try {
      const result = await createScopedManagedUser({
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
      setPhoneLookupState("idle");
      setPhoneLookupMessage("");
      const roleLabel = getRoleDisplayLabel(targetUserType, tenantConfig);
      if (result.operation === "associated") {
        setSuccess(`Existing ${roleLabel} found by phone and associated successfully.`);
      } else {
        setSuccess(`${roleLabel} created successfully.`);
      }

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
                ? `Create ${professionalLabel}s and ${individualLabel}s in your Company scope.`
                : `Create ${individualLabel}s associated with your ${professionalLabel} scope.`}
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Create User Type</label>
              <select
                className={styles.select}
                value={targetUserType}
                onChange={(event) => setTargetUserType(event.target.value as "professional" | "individual")}
              >
                {canCreateProfessional ? <option value="professional">{professionalLabel}</option> : null}
                <option value="individual">{individualLabel}</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Phone Number</label>
              <input className={styles.input} value={phoneE164} onChange={(event) => setPhoneE164(event.target.value)} placeholder="+91..." />
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.searchButton} onClick={handleSearchByPhone} disabled={searchingPhone || !phoneE164.trim()}>
                {searchingPhone ? "Searching..." : "Search by Phone"}
              </button>
            </div>

            {phoneLookupState !== "idle" && phoneLookupMessage ? (
              <p className={phoneLookupState === "found" ? styles.lookupFound : styles.lookupInfo}>{phoneLookupMessage}</p>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label}>First Name</label>
              <input className={styles.input} value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={!detailsEnabled} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Last Name</label>
              <input className={styles.input} value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={!detailsEnabled} />
            </div>

            {showCoachDropdown ? (
              <div className={styles.field}>
                <label className={styles.label}>{`${professionalLabel} (Optional)`}</label>
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
              <label className={styles.label}>Email Address</label>
              <input className={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} type="email" disabled={!detailsEnabled} />
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleCreateUser} disabled={saving}>
                {saving ? "Creating..." : isAssociationMode ? "Create Association" : "Create User"}
              </button>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.title}>Users In Scope</h2>
            <p className={styles.subtitle}>
              {creator?.role === "company"
                ? `Showing ${professionalLabel}s and ${individualLabel}s from your Company.`
                : `Showing ${individualLabel}s associated with you.`}
            </p>

            {creator?.role === "company" && (
              <div className={styles.scopeFilterRow}>
                {(["all", "professional", "individual"] as const).map((option) => (
                  <label key={option} className={styles.scopeFilterLabel}>
                    <input
                      type="radio"
                      name="scopeFilter"
                      value={option}
                      checked={scopeFilter === option}
                      onChange={() => setScopeFilter(option)}
                      className={styles.scopeFilterRadio}
                    />
                    {option === "all" ? "All" : option === "professional" ? `${professionalLabel}s` : `${individualLabel}s`}
                  </label>
                ))}
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <p className={styles.empty}>No users found in your scope yet.</p>
            ) : (
              <div className={styles.usersList}>
                {filteredUsers.map((user) => (
                  <article key={user.id} className={styles.userRow}>
                    <p className={styles.userName}>{user.fullName}</p>
                    <p className={styles.userMeta}>Type: {getRoleDisplayLabel(user.userType, tenantConfig)}</p>
                    <p className={styles.userMeta}>{user.email}</p>
                    <p className={styles.userMeta}>{user.phoneE164}</p>
                    {creator?.role === "company" && user.userType === "individual" ? (
                      <p className={styles.userMeta}>
                        {`${professionalLabel}: ${coaches.find((coach) => coach.id === user.associatedProfessionalId)?.fullName || "Unassigned"}`}
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
