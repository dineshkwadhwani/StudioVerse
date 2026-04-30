"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { getUserById, type ManagedUserRecord } from "@/services/manage-users.service";
import {
  getCohortDetail,
  listCohortsForScope,
  listProfessionalsForCohortScope,
  saveCohort,
  searchIndividualsForCohort,
} from "@/services/cohorts.service";
import {
  MIN_COHORT_MEMBER_COUNT,
  type CohortCreatorRole,
  type CohortDetail,
  type CohortListItem,
  type NewCohortIndividualInput,
} from "@/types/cohort";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";
import { getRoleLabel, getRoleMenuGroups } from "@/modules/activities/config/menuConfig";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import { useClickOutside } from "@/hooks/useClickOutside";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import styles from "./ManageCohortsPage.module.css";

type UserRole = StudioUserRole;

type CreatorProfile = {
  id: string;
  role: CohortCreatorRole;
  tenantId: string;
  fullName: string;
  associatedCompanyId?: string;
};

type SelectedIndividual = {
  id: string;
  fullName: string;
  email: string;
  phoneE164: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual";
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length > 10 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type Props = {
  tenantConfig?: TenantConfig;
};

export default function ManageCohortsPage({ tenantConfig = coachingTenantConfig }: Props) {
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
  const [cohorts, setCohorts] = useState<CohortListItem[]>([]);
  const [professionals, setProfessionals] = useState<ManagedUserRecord[]>([]);

  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [cohortName, setCohortName] = useState("");
  const [professionalId, setProfessionalId] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ManagedUserRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAddNewPrompt, setShowAddNewPrompt] = useState(false);
  const [showInlineNewForm, setShowInlineNewForm] = useState(false);

  const [selectedIndividuals, setSelectedIndividuals] = useState<SelectedIndividual[]>([]);
  const [pendingIndividuals, setPendingIndividuals] = useState<NewCohortIndividualInput[]>([]);

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

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
        const storedProfileId = sessionStorage.getItem("cs_profile_id");
        const storedPhone = sessionStorage.getItem("cs_phone");

        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId,
          phoneE164: storedPhone ?? undefined,
          profileId: storedProfileId ?? undefined,
        });

        if (!profile || (profile.userType !== "company" && profile.userType !== "professional")) {
          throw new Error(`Cohort Management is available only for ${tenantConfig.roles.company} and ${tenantConfig.roles.professional} users.`);
        }

        const creatorDoc = await getUserById(profile.userId);
        const creatorProfile: CreatorProfile = {
          id: creatorDoc?.id ?? profile.id,
          role: profile.userType,
          tenantId: profile.tenantId,
          fullName: profile.fullName,
          associatedCompanyId: creatorDoc?.associatedCompanyId,
        };

        setCreator(creatorProfile);
        await loadScreenData(creatorProfile);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load cohorts.";
        setError(message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantId]);

  async function loadScreenData(currentCreator: CreatorProfile) {
    const [scopeCohorts, scopeProfessionals] = await Promise.all([
      listCohortsForScope({
        role: currentCreator.role,
        tenantId: currentCreator.tenantId,
        actorUserId: currentCreator.id,
      }),
      currentCreator.role === "company"
        ? listProfessionalsForCohortScope({
            tenantId: currentCreator.tenantId,
            companyId: currentCreator.id,
          })
        : Promise.resolve([]),
    ]);

    setCohorts(scopeCohorts);
    setProfessionals(scopeProfessionals);
  }

  function resetForm() {
    setEditingCohortId(null);
    setCohortName("");
    setProfessionalId("");
    setSearchTerm("");
    setSearchResults([]);
    setShowAddNewPrompt(false);
    setShowInlineNewForm(false);
    setSelectedIndividuals([]);
    setPendingIndividuals([]);
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setNewEmail("");
  }

  async function handleEditCohort(cohortId: string) {
    setError("");
    setSuccess("");

    const detail = await getCohortDetail(cohortId);
    if (!detail) {
      setError("Cohort not found.");
      return;
    }

    hydrateFormForEdit(detail);
  }

  function hydrateFormForEdit(detail: CohortDetail) {
    setEditingCohortId(detail.id);
    setCohortName(detail.name);
    setProfessionalId(detail.professionalId ?? "");
    setSelectedIndividuals(
      detail.members.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        phoneE164: member.phoneE164,
      }))
    );
    setPendingIndividuals([]);
    setShowAddNewPrompt(false);
    setShowInlineNewForm(false);
    setSearchTerm("");
    setSearchResults([]);
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setNewEmail("");
  }

  async function handleSearchIndividuals() {
    if (!creator) {
      return;
    }

    setError("");
    setSuccess("");

    if (!searchTerm.trim()) {
      setError("Enter phone number or email to search.");
      return;
    }

    setSearching(true);
    try {
      const results = await searchIndividualsForCohort({
        role: creator.role,
        tenantId: creator.tenantId,
        companyId: creator.role === "company" ? creator.id : creator.associatedCompanyId,
        professionalId: creator.role === "professional" ? creator.id : professionalId || undefined,
        searchTerm,
      });

      setSearchResults(results);
      setShowAddNewPrompt(results.length === 0);
      setShowInlineNewForm(false);
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : "Search failed.";
      setError(message);
    } finally {
      setSearching(false);
    }
  }

  function addExistingIndividual(row: ManagedUserRecord) {
    if (selectedIndividuals.some((entry) => entry.id === row.id)) {
      return;
    }

    setSelectedIndividuals((prev) => [
      ...prev,
      {
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        phoneE164: row.phoneE164,
      },
    ]);
  }

  function removeSelectedIndividual(id: string) {
    setSelectedIndividuals((prev) => prev.filter((entry) => entry.id !== id));
  }

  function removePendingIndividual(email: string, phoneE164: string) {
    setPendingIndividuals((prev) =>
      prev.filter((entry) => !(entry.email.toLowerCase() === email.toLowerCase() && normalizePhone(entry.phoneE164) === normalizePhone(phoneE164)))
    );
  }

  function handleAddNewPendingIndividual() {
    const firstName = newFirstName.trim();
    const lastName = newLastName.trim();
    const email = newEmail.trim().toLowerCase();
    const phoneE164 = normalizePhone(newPhone);

    if (!firstName || !lastName || !email || !phoneE164) {
      setError(`First name, last name, phone number, and email are required for new ${individualLabel}s.`);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(`Please enter a valid email address for the new ${individualLabel}.`);
      return;
    }

    const duplicateInPending = pendingIndividuals.some(
      (entry) => entry.email.toLowerCase() === email || normalizePhone(entry.phoneE164) === phoneE164
    );

    const duplicateInSelected = selectedIndividuals.some(
      (entry) => entry.email.toLowerCase() === email || normalizePhone(entry.phoneE164) === phoneE164
    );

    if (duplicateInPending || duplicateInSelected) {
      setError(`This ${individualLabel} is already part of the cohort selection.`);
      return;
    }

    setPendingIndividuals((prev) => [
      ...prev,
      {
        firstName,
        lastName,
        email,
        phoneE164,
      },
    ]);

    setError("");
    setNewFirstName("");
    setNewLastName("");
    setNewPhone("");
    setNewEmail("");
    setShowInlineNewForm(false);
  }

  async function handleSaveCohort() {
    if (!creator) {
      return;
    }

    setError("");
    setSuccess("");

    if (!cohortName.trim()) {
      setError("Cohort name is required.");
      return;
    }

    const totalIndividuals = selectedIndividuals.length + pendingIndividuals.length;
    if (totalIndividuals < MIN_COHORT_MEMBER_COUNT) {
      setError(`A cohort must include at least ${MIN_COHORT_MEMBER_COUNT} ${individualLabel}s.`);
      return;
    }

    setSaving(true);
    try {
      const result = await saveCohort({
        cohortId: editingCohortId ?? undefined,
        tenantId: creator.tenantId,
        creatorUserId: creator.id,
        creatorRole: creator.role,
        creatorCompanyId: creator.associatedCompanyId,
        name: cohortName,
        professionalId: creator.role === "company" ? professionalId || null : undefined,
        existingIndividualIds: selectedIndividuals.map((entry) => entry.id),
        newIndividuals: pendingIndividuals,
      });

      await loadScreenData(creator);
      setSuccess(
        editingCohortId
          ? `Cohort updated successfully. Current status: ${result.status}.`
          : `Cohort created successfully. Current status: ${result.status}.`
      );
      resetForm();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save cohort.";
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

  const initials = useMemo(() => getInitials(name), [name]);
  const roleMenuGroups = useMemo(() => getRoleMenuGroups(role, { basePath }), [basePath, role]);
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;
  const brandSubtitle = "StudioVerse Platform";
  const professionalLabel = tenantConfig.roles.professional;
  const individualLabel = tenantConfig.roles.individual;

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>Loading Cohort Management...</div>
        </div>
      </main>
    );
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
        <div className={styles.grid}>
          <section className={styles.card}>
            <h1 className={styles.title}>{editingCohortId ? "Edit Cohort" : "Create Cohort"}</h1>
            <p className={styles.contextText}>
              {creator?.role === "company"
                ? `Create and manage cohorts, assign ${professionalLabel}s, and group ${individualLabel}s across your company.`
                : `Create cohorts, add ${individualLabel}s, and manage your coaching groups in one place.`}
            </p>
            <p className={styles.subtitle}>
              {`A Cohort requires more than one ${individualLabel} and becomes Active only when a ${professionalLabel} is assigned.`}
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Cohort Name</label>
              <input className={styles.input} value={cohortName} onChange={(event) => setCohortName(event.target.value)} />
            </div>

            {creator?.role === "company" ? (
              <div className={styles.field}>
                <label className={styles.label}>{`${professionalLabel} (Optional)`}</label>
                <select className={styles.select} value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
                  <option value="">Unassigned (Cohort remains inactive)</option>
                  {professionals.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.fullName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className={styles.helper}>{`As a ${professionalLabel}, you are automatically assigned to the Cohort.`}</p>
            )}

            <div className={styles.field}>
              <label className={styles.label}>{`Search ${individualLabel} by Phone or Email`}</label>
              <div className={styles.searchRow}>
                <input className={styles.input} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Enter phone or email" />
                <button type="button" className={styles.searchButton} onClick={handleSearchIndividuals} disabled={searching}>
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>

            {searchResults.length > 0 ? (
              <div className={styles.searchResults}>
                {searchResults.map((entry) => (
                  <article key={entry.id} className={styles.searchItem}>
                    <div>
                      <p className={styles.cohortName}>{entry.fullName}</p>
                      <p className={styles.searchMeta}>{entry.email || entry.phoneE164}</p>
                    </div>
                    <button type="button" className={styles.secondaryButton} onClick={() => addExistingIndividual(entry)}>
                      Add
                    </button>
                  </article>
                ))}
              </div>
            ) : null}

            {showAddNewPrompt ? (
              <div className={styles.inlineNewCard}>
                <p className={styles.helper}>{`No ${individualLabel} match found. Do you want to add a new ${individualLabel}?`}</p>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setShowInlineNewForm(true)}>
                    {`Yes, Add New ${individualLabel}`}
                  </button>
                </div>
              </div>
            ) : null}

            {showInlineNewForm ? (
              <div className={styles.inlineNewCard}>
                <p className={styles.sectionTitle}>{`New ${individualLabel} Details`}</p>
                <div className={styles.inlineGrid}>
                  <input className={styles.input} value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} placeholder="First Name" />
                  <input className={styles.input} value={newLastName} onChange={(event) => setNewLastName(event.target.value)} placeholder="Last Name" />
                  <input className={styles.input} value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="Phone Number" />
                  <input className={styles.input} value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Email Address" />
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.secondaryButton} onClick={handleAddNewPendingIndividual}>Add to Cohort</button>
                </div>
              </div>
            ) : null}

            <p className={styles.sectionTitle}>{`Selected Existing ${individualLabel}s (${selectedIndividuals.length})`}</p>
            <div className={styles.chips}>
              {selectedIndividuals.map((entry) => (
                <span key={entry.id} className={styles.chip}>
                  {entry.fullName}
                  <button type="button" className={styles.chipRemove} onClick={() => removeSelectedIndividual(entry.id)}>
                    x
                  </button>
                </span>
              ))}
            </div>

            <p className={styles.sectionTitle}>{`Pending New ${individualLabel}s (${pendingIndividuals.length})`}</p>
            <div className={styles.chips}>
              {pendingIndividuals.map((entry) => (
                <span key={`${entry.email}-${entry.phoneE164}`} className={styles.chip}>
                  {`${entry.firstName} ${entry.lastName}`}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => removePendingIndividual(entry.email, entry.phoneE164)}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={handleSaveCohort} disabled={saving}>
                {saving ? "Saving..." : editingCohortId ? "Update Cohort" : "Create Cohort"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={resetForm}>
                Clear
              </button>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.title}>Cohorts In Scope</h2>
            <p className={styles.subtitle}>
              {creator?.role === "company"
                ? "Showing Company cohorts."
                : `Showing cohorts where you are the assigned ${professionalLabel}.`}
            </p>

            {cohorts.length === 0 ? (
              <p className={styles.empty}>No cohorts found in your scope yet.</p>
            ) : (
              <div className={styles.cohortList}>
                {cohorts.map((entry) => (
                  <article key={entry.id} className={styles.cohortRow}>
                    <div className={styles.rowTop}>
                      <p className={styles.cohortName}>{entry.name}</p>
                      <span className={`${styles.status} ${styles[`status${entry.status}`]}`}>{entry.status}</span>
                    </div>
                    <p className={styles.meta}>Members: {entry.memberCount}</p>
                    <p className={styles.meta}>{`${professionalLabel}: ${entry.professionalName || "Unassigned"}`}</p>
                    <div className={styles.actions}>
                      <button type="button" className={styles.secondaryButton} onClick={() => void handleEditCohort(entry.id)}>
                        Edit Cohort
                      </button>
                    </div>
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
