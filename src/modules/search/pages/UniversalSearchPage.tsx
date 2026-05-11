"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuthedSession } from "@/modules/app-shell/AppShellHeader";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import {
  searchPrograms,
  searchAssessments,
  searchEvents,
  searchUsers,
  getTenantSearchConfig,
  type TenantSearchConfig,
  type ProgramSearchResult,
  type AssessmentSearchResult,
  type EventSearchResult,
  type UserSearchResult,
} from "@/services/search.service";
import { getTenantLeadConfig, resolveLeadUnlockFee, type TenantLeadConfig } from "@/services/lead-config.service";
import { listLeadUnlocksFor, unlockLead } from "@/services/leads.service";
import { listOutboxMessages, sendIntroMessage } from "@/services/messages.service";
import { getUserProfile } from "@/services/profile.service";
import { getWalletForUserContext } from "@/services/wallet.service";
import type { MessageTemplateKey } from "@/types/message";
import ProfileDropdownMenu from "@/modules/app-shell/ProfileDropdownMenu";
import landingStyles from "@/modules/landing/pages/LandingPage.module.css";
import dashboardStyles from "@/modules/dashboard/pages/DashboardPage.module.css";
import s from "./UniversalSearchPage.module.css";

type Props = { tenantConfig: TenantConfig };

export type SearchCategory =
  | "programs"
  | "assessments"
  | "events"
  | "coaches"
  | "companies"
  | "individuals";

const ALL_CATEGORIES: { key: SearchCategory; label: string }[] = [
  { key: "programs", label: "Programs" },
  { key: "assessments", label: "Assessments" },
  { key: "events", label: "Events" },
  { key: "coaches", label: "Coaches" },
  { key: "companies", label: "Companies" },
  { key: "individuals", label: "Individuals" },
];

export function getAllowedCategories(role: StudioUserRole | null): SearchCategory[] {
  const base: SearchCategory[] = ["programs", "assessments", "events", "coaches"];
  if (role === "individual") return [...base, "companies"];
  if (role === "company" || role === "professional") return [...base, "individuals"];
  return base;
}

function getTenantEnabledCategories(
  searchConfig: TenantSearchConfig | null | undefined,
): SearchCategory[] {
  if (!searchConfig?.enabled) return [];
  const enabled: SearchCategory[] = [];
  if (searchConfig.programs) enabled.push("programs");
  if (searchConfig.assessments) enabled.push("assessments");
  if (searchConfig.events) enabled.push("events");
  if (searchConfig.professional) enabled.push("coaches");
  if (searchConfig.company) enabled.push("companies");
  if (searchConfig.individual) enabled.push("individuals");
  return enabled;
}

export default function UniversalSearchPage({ tenantConfig }: Props) {
  const { session, loading, error } = useAuthedSession({ tenantConfig });
  const role = session?.role ?? null;
  const tenantId = tenantConfig.id;
  const basePath = `/${tenantId}`;
  const toolsLabel = tenantConfig.landingContent?.displayLabels?.tools ?? tenantConfig.labels.assessment;

  const [searchConfig, setSearchConfig] = useState<TenantSearchConfig | null>(null);

  useEffect(() => {
    getTenantSearchConfig(tenantId).then(setSearchConfig);
  }, [tenantId]);

  const allowedCategories = useMemo(() => {
    const roleAllowed = getAllowedCategories(role);
    const tenantEnabled = new Set(getTenantEnabledCategories(searchConfig));
    return roleAllowed.filter((cat) => tenantEnabled.has(cat));
  }, [role, searchConfig]);
  const searchEnabled = searchConfig?.enabled === true;
  const searchConfigLoading = searchConfig === null;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<SearchCategory>>(() => new Set(allowedCategories));
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [validationError, setValidationError] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [programs, setPrograms] = useState<ProgramSearchResult[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSearchResult[]>([]);
  const [events, setEvents] = useState<EventSearchResult[]>([]);
  const [coaches, setCoaches] = useState<UserSearchResult[]>([]);
  const [companies, setCompanies] = useState<UserSearchResult[]>([]);
  const [individuals, setIndividuals] = useState<UserSearchResult[]>([]);
  const [leadConfig, setLeadConfig] = useState<TenantLeadConfig | null>(null);
  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set());
  const [unlockingId, setUnlockingId] = useState<string>("");
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [unlockModal, setUnlockModal] = useState<UserSearchResult | null>(null);
  const [unlockModalError, setUnlockModalError] = useState("");
  const [sentToSet, setSentToSet] = useState<Set<string>>(new Set());
  const [senderProfileFields, setSenderProfileFields] = useState<{
    headline: string;
    expertise: string[];
    certifications: string[];
  }>({ headline: "", expertise: [], certifications: [] });
  const [messageModal, setMessageModal] = useState<UserSearchResult | null>(null);

  const unlockerUserId = session?.uid ?? "";

  useEffect(() => {
    if (!unlockerUserId) return;
    let cancelled = false;
    void (async () => {
      try {
        const profileId = session?.profileId;
        const lookupIds = [unlockerUserId, ...(profileId ? [profileId] : [])];
        const [config, existing, wallet, outbox, profile] = await Promise.all([
          getTenantLeadConfig(tenantId),
          listLeadUnlocksFor({ tenantId, unlockerUserId }),
          getWalletForUserContext(lookupIds, tenantId).catch(() => null),
          listOutboxMessages({ tenantId, senderUserId: unlockerUserId }).catch(() => []),
          getUserProfile({ userId: unlockerUserId, tenantId, profileId }),
        ]);
        if (cancelled) return;
        setLeadConfig(config);
        setUnlockedSet(new Set(existing.map((entry) => entry.leadUserId)));
        setWalletBalance(wallet?.availableCoins ?? 0);
        setSentToSet(new Set(outbox.map((entry) => entry.receiverUserId)));
        setSenderProfileFields({
          headline: profile?.professionalHeadline ?? "",
          expertise: profile?.expertiseAreas ?? [],
          certifications: profile?.certifications ?? [],
        });
      } catch (loadError) {
        if (!cancelled) {
          setSearchError(
            loadError instanceof Error ? loadError.message : "Failed to load lead config."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, unlockerUserId, session?.profileId]);

  useEffect(() => {
    setSelected(new Set(allowedCategories));
  }, [allowedCategories]);

  function toggleCategory(key: SearchCategory): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    setValidationError("");
    setSearchError("");
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setValidationError("Please enter at least 2 characters to search.");
      return;
    }
    if (selected.size === 0) {
      setValidationError("Select at least one category to search.");
      return;
    }
    setSubmittedQuery(trimmed);
    void runSearch(trimmed, new Set(selected));
  }

  async function runSearch(queryString: string, categories: Set<SearchCategory>): Promise<void> {
    setSearching(true);
    setSearchError("");
    try {
      const tasks: Promise<void>[] = [];
      if (categories.has("programs")) {
        tasks.push(
          searchPrograms({ tenantId, queryString }).then((rows) => setPrograms(rows))
        );
      } else {
        setPrograms([]);
      }
      if (categories.has("assessments")) {
        tasks.push(
          searchAssessments({ tenantId, queryString }).then((rows) => setAssessments(rows))
        );
      } else {
        setAssessments([]);
      }
      if (categories.has("events")) {
        tasks.push(
          searchEvents({ tenantId, queryString }).then((rows) => setEvents(rows))
        );
      } else {
        setEvents([]);
      }
      if (categories.has("coaches")) {
        const enforceUnassociated = role === "company" || role === "professional";
        tasks.push(
          searchUsers({
            tenantId,
            queryString,
            targetUserType: "professional",
            enforceUnassociated,
            excludeUserId: unlockerUserId,
          }).then((rows) => setCoaches(rows))
        );
      } else {
        setCoaches([]);
      }
      if (categories.has("companies") && role === "individual") {
        tasks.push(
          searchUsers({
            tenantId,
            queryString,
            targetUserType: "company",
            enforceUnassociated: false,
            excludeUserId: unlockerUserId,
          }).then((rows) => setCompanies(rows))
        );
      } else {
        setCompanies([]);
      }
      if (categories.has("individuals") && (role === "company" || role === "professional")) {
        tasks.push(
          searchUsers({
            tenantId,
            queryString,
            targetUserType: "individual",
            enforceUnassociated: true,
            excludeUserId: unlockerUserId,
          }).then((rows) => setIndividuals(rows))
        );
      } else {
        setIndividuals([]);
      }
      await Promise.all(tasks);
    } catch (loadError) {
      setSearchError(
        loadError instanceof Error ? loadError.message : "Search failed. Please try again."
      );
    } finally {
      setSearching(false);
    }
  }

  function openUnlockModal(user: UserSearchResult): void {
    setUnlockModalError("");
    setUnlockModal(user);
  }

  async function confirmUnlock(): Promise<void> {
    if (!unlockModal || !leadConfig) return;
    const fee = feeFor(unlockModal.userType);
    if (fee > walletBalance) {
      setUnlockModalError("Insufficient credits.");
      return;
    }
    const leadUserId = unlockModal.id;
    setUnlockingId(leadUserId);
    setUnlockModalError("");
    try {
      const result = await unlockLead({ tenantId, leadUserId });
      setUnlockedSet((prev) => {
        const next = new Set(prev);
        next.add(leadUserId);
        return next;
      });
      if (result.feeCoins > 0) {
        setWalletBalance((prev) => Math.max(0, prev - result.feeCoins));
      }
      setUnlockModal(null);
    } catch (unlockError) {
      setUnlockModalError(
        unlockError instanceof Error ? unlockError.message : "Unlock failed."
      );
    } finally {
      setUnlockingId("");
    }
  }

  function buildTemplate(
    templateKey: MessageTemplateKey,
    senderName: string,
    receiverName: string,
  ): { subject: string; body: string } | null {
    const safeSender = senderName || "a member";
    const safeReceiver = receiverName || "there";
    if (templateKey === "coach_company_t1") {
      return {
        subject: `Hello from ${safeSender}`,
        body: `Hello ${safeReceiver}, I am Coach ${safeSender}. I would be glad to assist you in your development journey. Let me know if you would like to connect.`,
      };
    }
    if (templateKey === "coach_company_t2") {
      const headline = senderProfileFields.headline.trim();
      const skills = senderProfileFields.expertise.filter(Boolean).slice(0, 3).join(", ");
      const credential = senderProfileFields.certifications.filter(Boolean)[0] ?? "";
      if (!headline || !skills) {
        return null;
      }
      const credSentence = credential ? ` I have ${credential}.` : "";
      return {
        subject: `Personal note from ${safeSender}`,
        body: `Hello ${safeReceiver}, I am ${safeSender}, a ${headline} with expertise in ${skills}.${credSentence} I believe I can support your growth journey. I would love to connect and explore how I can help.`,
      };
    }
    return {
      subject: `Introduction from ${safeSender}`,
      body: `Hi, I am ${safeSender}. I would like to connect.`,
    };
  }

  async function handleSendMessage(
    receiver: UserSearchResult,
    templateKey: MessageTemplateKey,
  ): Promise<{ ok: boolean; error?: string }> {
    const senderName = session?.name ?? "Member";
    const built = buildTemplate(templateKey, senderName, receiver.fullName);
    if (!built) {
      return {
        ok: false,
        error: "Please complete your profile (headline, expertise) to use this template.",
      };
    }
    try {
      const result = await sendIntroMessage({
        tenantId,
        receiverUserId: receiver.id,
        templateKey,
        subject: built.subject,
        body: built.body,
      });
      setSentToSet((prev) => {
        const next = new Set(prev);
        next.add(receiver.id);
        return next;
      });
      return { ok: true, error: result.status === "duplicate" ? "Message already sent." : undefined };
    } catch (sendError) {
      return {
        ok: false,
        error: sendError instanceof Error ? sendError.message : "Failed to send message.",
      };
    }
  }

  function leadKindForUserType(
    userType: UserSearchResult["userType"],
  ): "coach" | "company" | "individual" {
    if (userType === "professional") return "coach";
    if (userType === "company") return "company";
    return "individual";
  }

  function feeFor(userType: UserSearchResult["userType"]): number {
    if (!leadConfig) return 0;
    return resolveLeadUnlockFee(leadConfig, leadKindForUserType(userType));
  }

  function isUnlocked(user: UserSearchResult, viewerRole: StudioUserRole | null): boolean {
    if (viewerRole === "individual" && (user.userType === "professional" || user.userType === "company")) {
      return true;
    }
    if (feeFor(user.userType) === 0) return true;
    return unlockedSet.has(user.id);
  }

  return (
    <main className={s.page}>
      <header className={s.toolbar}>
        <Link href={basePath} className={landingStyles.brand}>
          <Image src={tenantConfig.theme.logo} alt={`${tenantConfig.name} logo`} width={76} height={40} className={landingStyles.logo} />
          <div className={landingStyles.brandText}>
            <span className={landingStyles.brandTitle}>{tenantConfig.name}</span>
            <span className={landingStyles.brandSubtitle}>StudioVerse Platform</span>
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
            name={session?.name ?? "User"}
            basePath={basePath}
            roleLabels={{
              company: tenantConfig.roles.company,
              professional: tenantConfig.roles.professional,
              individual: tenantConfig.roles.individual,
            }}
          />
        </div>
      </header>

      <div className={s.shell}>
        {/* ── Hero card ─────────────────────────────────────── */}
        <section className={s.heroCard}>
          <h1 className={s.pageTitle}>Search</h1>
          <p className={s.pageSubtitle}>
            Search programs, assessments, events, and people across the platform.
          </p>

          {loading || searchConfigLoading ? <p className={s.infoText}>Loading…</p> : null}
          {error ? <p className={s.errorText}>{error}</p> : null}

          {!loading && !searchConfigLoading && !error && session && !searchEnabled ? (
            <p className={s.infoText}>Search is not available on this tenant.</p>
          ) : null}

          {!loading && !searchConfigLoading && !error && session && searchEnabled ? (
            <form onSubmit={handleSubmit} className={s.searchForm}>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search programs, assessments, events, people…"
                className={s.searchInput}
              />

              <div className={s.categoryRow}>
                {ALL_CATEGORIES.filter((cat) => allowedCategories.includes(cat.key)).map((cat) => (
                  <label
                    key={cat.key}
                    className={selected.has(cat.key) ? s.categoryPillActive : s.categoryPill}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(cat.key)}
                      onChange={() => toggleCategory(cat.key)}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>

              <div className={s.submitRow}>
                <button type="submit" className={s.submitButton}>
                  Search
                </button>
              </div>

              {validationError ? (
                <p className={s.validationError}>{validationError}</p>
              ) : null}
            </form>
          ) : null}
        </section>

        {/* ── Content card (results) ────────────────────────── */}
        {!loading && !searchConfigLoading && !error && session && searchEnabled ? (
          <section className={s.contentCard}>
            {!submittedQuery ? (
              <p className={s.infoText}>Enter a query above to start searching.</p>
            ) : null}
            {searching ? <p className={s.searchingText}>Searching…</p> : null}
            {searchError ? <p className={s.errorText}>{searchError}</p> : null}

            {submittedQuery && !searching && !searchError ? (
              <>
                {selected.has("programs") ? (
                    <ResultGroup title="Programs" empty="No matching programs.">
                      {programs.map((program) => (
                        <ResourceCard
                          key={program.id}
                          name={program.name}
                          shortDescription={program.shortDescription}
                          metadata={program.deliveryType}
                          thumbnailUrl={program.thumbnailUrl}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                  {selected.has("assessments") ? (
                    <ResultGroup title="Assessments" empty="No matching assessments.">
                      {assessments.map((assessment) => (
                        <ResourceCard
                          key={assessment.id}
                          name={assessment.name}
                          shortDescription={assessment.shortDescription}
                          metadata={null}
                          thumbnailUrl={null}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                  {selected.has("events") ? (
                    <ResultGroup title="Events" empty="No matching events.">
                      {events.map((event) => (
                        <ResourceCard
                          key={event.id}
                          name={event.name}
                          shortDescription={event.shortDescription}
                          metadata={event.locationCity || event.eventType}
                          thumbnailUrl={event.thumbnailUrl}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                  {selected.has("coaches") ? (
                    <ResultGroup title="Coaches" empty="No matching coaches.">
                      {coaches.map((user) => (
                        <LeadTile
                          key={user.id}
                          user={user}
                          unlocked={isUnlocked(user, role)}
                          fee={feeFor(user.userType)}
                          unlocking={unlockingId === user.id}
                          onUnlock={() => openUnlockModal(user)}
                          onSendMessage={() => setMessageModal(user)}
                          alreadySent={sentToSet.has(user.id)}
                          basePath={basePath}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                  {selected.has("companies") && role === "individual" ? (
                    <ResultGroup title="Companies" empty="No matching companies.">
                      {companies.map((user) => (
                        <LeadTile
                          key={user.id}
                          user={user}
                          unlocked={isUnlocked(user, role)}
                          fee={feeFor(user.userType)}
                          unlocking={unlockingId === user.id}
                          onUnlock={() => openUnlockModal(user)}
                          onSendMessage={() => setMessageModal(user)}
                          alreadySent={sentToSet.has(user.id)}
                          basePath={basePath}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                  {selected.has("individuals") && (role === "company" || role === "professional") ? (
                    <ResultGroup title="Individuals" empty="No matching individuals.">
                      {individuals.map((user) => (
                        <LeadTile
                          key={user.id}
                          user={user}
                          unlocked={isUnlocked(user, role)}
                          fee={feeFor(user.userType)}
                          unlocking={unlockingId === user.id}
                          onUnlock={() => openUnlockModal(user)}
                          onSendMessage={() => setMessageModal(user)}
                          alreadySent={sentToSet.has(user.id)}
                          basePath={basePath}
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                </>
              ) : null}
          </section>
        ) : null}
      </div>
      {unlockModal ? (
        <UnlockModal
          tenantBasePath={`/${tenantId}`}
          fee={feeFor(unlockModal.userType)}
          balance={walletBalance}
          name={unlockModal.fullName || "this lead"}
          unlocking={unlockingId === unlockModal.id}
          errorMessage={unlockModalError}
          onCancel={() => {
            setUnlockModal(null);
            setUnlockModalError("");
          }}
          onConfirm={() => void confirmUnlock()}
        />
      ) : null}
      {messageModal ? (
        <SendMessageModal
          receiver={messageModal}
          senderRole={role}
          alreadySent={sentToSet.has(messageModal.id)}
          onCancel={() => setMessageModal(null)}
          onSend={(templateKey) => handleSendMessage(messageModal, templateKey)}
        />
      ) : null}
    </main>
  );
}

function ResultGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some((item) => item != null && item !== false);

  return (
    <div className={s.resultGroup}>
      <h2 className={s.resultGroupTitle}>{title}</h2>
      {hasItems ? (
        <div className={s.resultGrid}>{children}</div>
      ) : (
        <p className={s.emptyResult}>{empty}</p>
      )}
    </div>
  );
}

function ResourceCard({
  name,
  shortDescription,
  metadata,
  thumbnailUrl,
}: {
  name: string;
  shortDescription: string;
  metadata: string | null;
  thumbnailUrl: string | null;
}) {
  return (
    <article className={s.resourceCard}>
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt={name} className={s.resourceThumb} />
      ) : null}
      <h3 className={s.resourceName}>{name}</h3>
      {metadata ? <p className={s.resourceMeta}>{metadata}</p> : null}
      {shortDescription ? <p className={s.resourceDesc}>{shortDescription}</p> : null}
    </article>
  );
}

function LeadTile({
  user,
  unlocked,
  fee,
  unlocking,
  onUnlock,
  onSendMessage,
  alreadySent,
  basePath,
}: {
  user: UserSearchResult;
  unlocked: boolean;
  fee: number;
  unlocking: boolean;
  onUnlock: () => void;
  onSendMessage: () => void;
  alreadySent: boolean;
  basePath: string;
}) {
  if (!unlocked) {
    return (
      <article className={s.leadTileLocked}>
        <div className={s.lockedAvatar} />
        <p className={s.lockedTitle}>Unlock this Lead</p>
        <p className={s.lockedCost}>
          {fee} {fee === 1 ? "Credit" : "Credits"} to Unlock
        </p>
        <button
          type="button"
          onClick={onUnlock}
          disabled={unlocking}
          className={s.unlockButton}
        >
          {unlocking ? "Unlocking…" : "Unlock"}
        </button>
      </article>
    );
  }

  return (
    <article className={s.leadTile}>
      <div className={s.leadHeader}>
        {user.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profilePhotoUrl} alt={user.fullName} className={s.leadAvatar} />
        ) : (
          <div className={s.leadAvatarPlaceholder}>
            {(user.fullName || "?").trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h3 className={s.leadName}>{user.fullName || "Member"}</h3>
          {user.professionalHeadline ? (
            <p className={s.leadHeadline}>{user.professionalHeadline}</p>
          ) : null}
        </div>
      </div>
      <div className={s.leadActions}>
        <Link href={`${basePath}/view-profile/${user.id}`} className={s.viewProfileButton}>
          View Profile
        </Link>
        <button
          type="button"
          onClick={onSendMessage}
          disabled={alreadySent}
          className={s.sendMessageButton}
        >
          {alreadySent ? "Message Sent" : "Send Message"}
        </button>
      </div>
    </article>
  );
}

function UnlockModal({
  tenantBasePath,
  fee,
  balance,
  name,
  unlocking,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  tenantBasePath: string;
  fee: number;
  balance: number;
  name: string;
  unlocking: boolean;
  errorMessage: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const insufficient = balance < fee;
  return (
    <div role="dialog" aria-modal="true" className={s.modalBackdrop}>
      <div className={s.modalCard}>
        <h2 className={s.modalTitle}>Unlock {name}?</h2>
        <p className={s.unlockCostText}>
          Cost: <strong>{fee}</strong> {fee === 1 ? "credit" : "credits"}
        </p>
        <p className={s.unlockBalanceText}>
          Available balance: <strong>{balance}</strong>
        </p>
        {insufficient ? (
          <div className={s.insufficientWarning}>
            <p>Insufficient credits.</p>
            <Link href={`${tenantBasePath}/buy-coins`}>Buy Credits</Link>
          </div>
        ) : null}
        {errorMessage ? <p className={s.feedbackError}>{errorMessage}</p> : null}
        <div className={s.modalActions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={unlocking}
            className={s.modalCancelButton}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={unlocking || insufficient}
            className={s.modalConfirmButton}
          >
            {unlocking ? "Unlocking…" : "Confirm Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SendMessageModal({
  receiver,
  senderRole,
  alreadySent,
  onCancel,
  onSend,
}: {
  receiver: UserSearchResult;
  senderRole: StudioUserRole | null;
  alreadySent: boolean;
  onCancel: () => void;
  onSend: (templateKey: MessageTemplateKey) => Promise<{ ok: boolean; error?: string }>;
}) {
  const isCoachOrCompany = senderRole === "professional" || senderRole === "company";
  const defaultTemplate: MessageTemplateKey = isCoachOrCompany ? "coach_company_t1" : "individual_t1";
  const [templateKey, setTemplateKey] = useState<MessageTemplateKey>(defaultTemplate);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSend(): Promise<void> {
    setSending(true);
    setFeedback(null);
    const result = await onSend(templateKey);
    setSending(false);
    if (result.ok) {
      setFeedback({ ok: true, message: result.error ?? "Message sent." });
    } else {
      setFeedback({ ok: false, message: result.error ?? "Failed to send message." });
    }
  }

  return (
    <div role="dialog" aria-modal="true" className={s.modalBackdrop}>
      <div className={`${s.modalCard} ${s.modalCardWide}`}>
        <h2 className={s.modalTitle}>
          Send Message to {receiver.fullName || "Member"}
        </h2>

        {alreadySent ? (
          <p className={s.infoText}>You have already sent a message to this user.</p>
        ) : null}

        {isCoachOrCompany ? (
          <div className={s.templateSection}>
            <p className={s.templateLabel}>Choose a template:</p>
            <label className={s.templateOption}>
              <input
                type="radio"
                name="template"
                value="coach_company_t1"
                checked={templateKey === "coach_company_t1"}
                onChange={() => setTemplateKey("coach_company_t1")}
              />{" "}
              Generic intro (Hello + offer to help)
            </label>
            <label className={s.templateOption}>
              <input
                type="radio"
                name="template"
                value="coach_company_t2"
                checked={templateKey === "coach_company_t2"}
                onChange={() => setTemplateKey("coach_company_t2")}
              />{" "}
              Personalised (uses your headline + expertise)
            </label>
          </div>
        ) : (
          <p className={s.infoText}>A short introduction will be sent on your behalf.</p>
        )}

        {feedback ? (
          <p className={feedback.ok ? s.feedbackSuccess : s.feedbackError}>
            {feedback.message}
          </p>
        ) : null}

        <div className={s.modalActions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className={s.modalCancelButton}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || alreadySent || (feedback?.ok === true)}
            className={s.modalConfirmButton}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
