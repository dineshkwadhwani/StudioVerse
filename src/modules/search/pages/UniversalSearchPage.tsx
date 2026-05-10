"use client";

import { useEffect, useMemo, useState } from "react";
import AppShellHeader, { useAuthedSession } from "@/modules/app-shell/AppShellHeader";
import type { TenantConfig } from "@/types/tenant";
import type { StudioUserRole } from "@/modules/activities/config/menuConfig";
import {
  searchPrograms,
  searchAssessments,
  searchEvents,
  searchUsers,
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
import Link from "next/link";
import type { MessageTemplateKey } from "@/types/message";

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
  searchConfig: TenantConfig["searchConfig"] | undefined,
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

  const allowedCategories = useMemo(() => {
    const roleAllowed = getAllowedCategories(role);
    const tenantEnabled = new Set(getTenantEnabledCategories(tenantConfig.searchConfig));
    return roleAllowed.filter((cat) => tenantEnabled.has(cat));
  }, [role, tenantConfig.searchConfig]);
  const searchEnabled = tenantConfig.searchConfig?.enabled === true;
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

  const tenantId = tenantConfig.id;
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
          getWalletForUserContext(lookupIds, tenantId),
          listOutboxMessages({ tenantId, senderUserId: unlockerUserId }),
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

  // Sync selected set when role/allowedCategories change.
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
      // Coaches search: visible to all roles. Coach/Company searcher => unassociated only.
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
      // Companies search: Individual searcher only.
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
      // Individuals search: Coach/Company searcher only, unassociated.
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
    // individual_t1
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
    // Individual viewing Coach/Company => always unlocked.
    if (viewerRole === "individual" && (user.userType === "professional" || user.userType === "company")) {
      return true;
    }
    if (feeFor(user.userType) === 0) return true;
    return unlockedSet.has(user.id);
  }

  return (
    <div>
      <AppShellHeader tenantConfig={tenantConfig} role={role} name={session?.name ?? "User"} />
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Search</h1>
        {loading ? <p>Loading…</p> : null}
        {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}

        {!loading && !error && session && !searchEnabled ? (
          <p style={{ color: "#888", marginTop: 16 }}>
            Search is not available on this tenant.
          </p>
        ) : null}

        {!loading && !error && session && searchEnabled ? (
          <>
            <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search programs, assessments, events, people…"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: 16,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                }}
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
                {ALL_CATEGORIES.filter((cat) => allowedCategories.includes(cat.key)).map((cat) => (
                  <label
                    key={cat.key}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 999,
                      background: selected.has(cat.key) ? "#eef4ff" : "#fff",
                    }}
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

              <div style={{ marginTop: 14 }}>
                <button
                  type="submit"
                  style={{
                    padding: "10px 18px",
                    fontSize: 15,
                    border: 0,
                    borderRadius: 8,
                    background: "#1a73e8",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Search
                </button>
              </div>

              {validationError ? (
                <p style={{ color: "#b00020", marginTop: 8 }}>{validationError}</p>
              ) : null}
            </form>

            <section style={{ marginTop: 28 }}>
              {!submittedQuery ? (
                <p style={{ color: "#888" }}>Enter a query above to start searching.</p>
              ) : null}
              {searching ? <p style={{ color: "#666" }}>Searching…</p> : null}
              {searchError ? <p style={{ color: "#b00020" }}>{searchError}</p> : null}

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
                        />
                      ))}
                    </ResultGroup>
                  ) : null}
                </>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
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
    </div>
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
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>{title}</h2>
      {hasItems ? (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          }}
        >
          {children}
        </div>
      ) : (
        <p style={{ color: "#999" }}>{empty}</p>
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
    <article
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 12,
        background: "#fff",
      }}
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={name}
          style={{
            width: "100%",
            height: 120,
            objectFit: "cover",
            borderRadius: 6,
            marginBottom: 8,
          }}
        />
      ) : null}
      <h3 style={{ fontSize: 16, margin: 0 }}>{name}</h3>
      {metadata ? (
        <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>{metadata}</p>
      ) : null}
      {shortDescription ? (
        <p style={{ fontSize: 13, color: "#444", margin: "8px 0" }}>{shortDescription}</p>
      ) : null}
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
}: {
  user: UserSearchResult;
  unlocked: boolean;
  fee: number;
  unlocking: boolean;
  onUnlock: () => void;
  onSendMessage: () => void;
  alreadySent: boolean;
}) {
  if (!unlocked) {
    return (
      <article
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 10,
          padding: 14,
          background: "#fafafa",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#ddd",
            margin: "0 auto 10px",
            filter: "blur(4px)",
          }}
        />
        <p style={{ fontWeight: 600, marginBottom: 6 }}>🔒 Unlock this Lead</p>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
          {fee} {fee === 1 ? "Credit" : "Credits"} to Unlock
        </p>
        <button
          type="button"
          onClick={onUnlock}
          disabled={unlocking}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            border: 0,
            borderRadius: 6,
            background: "#1a73e8",
            color: "#fff",
            cursor: unlocking ? "wait" : "pointer",
          }}
        >
          {unlocking ? "Unlocking…" : "Unlock"}
        </button>
      </article>
    );
  }

  return (
    <article
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {user.profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profilePhotoUrl}
            alt={user.fullName}
            style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#e0e0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              color: "#666",
            }}
          >
            {(user.fullName || "?").trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h3 style={{ fontSize: 15, margin: 0 }}>{user.fullName || "Member"}</h3>
          {user.professionalHeadline ? (
            <p style={{ fontSize: 12, color: "#666", margin: "2px 0 0" }}>
              {user.professionalHeadline}
            </p>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 12,
            border: "1px solid #ddd",
            borderRadius: 6,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          View Profile
        </button>
        <button
          type="button"
          onClick={onSendMessage}
          disabled={alreadySent}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: 12,
            border: 0,
            borderRadius: 6,
            background: alreadySent ? "#9aa" : "#1a73e8",
            color: "#fff",
            cursor: alreadySent ? "not-allowed" : "pointer",
          }}
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
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: "min(420px, 92vw)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Unlock {name}?</h2>
        <p style={{ color: "#444", marginBottom: 6 }}>
          Cost: <strong>{fee}</strong> {fee === 1 ? "credit" : "credits"}
        </p>
        <p style={{ color: "#444", marginBottom: 14 }}>
          Available balance: <strong>{balance}</strong>
        </p>
        {insufficient ? (
          <div style={{ background: "#fff5f5", border: "1px solid #f3c2c2", padding: 10, borderRadius: 6, marginBottom: 12 }}>
            <p style={{ margin: 0, color: "#b00020" }}>Insufficient credits.</p>
            <Link href={`${tenantBasePath}/buy-coins`} style={{ color: "#1a73e8" }}>
              Buy Credits
            </Link>
          </div>
        ) : null}
        {errorMessage ? <p style={{ color: "#b00020" }}>{errorMessage}</p> : null}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={unlocking}
            style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={unlocking || insufficient}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: 0,
              background: insufficient ? "#aaa" : "#1a73e8",
              color: "#fff",
              cursor: unlocking ? "wait" : insufficient ? "not-allowed" : "pointer",
            }}
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
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 24,
          width: "min(480px, 92vw)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>
          Send Message to {receiver.fullName || "Member"}
        </h2>

        {alreadySent ? (
          <p style={{ color: "#666", marginBottom: 12 }}>
            You have already sent a message to this user.
          </p>
        ) : null}

        {isCoachOrCompany ? (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Choose a template:</p>
            <label style={{ display: "block", marginBottom: 8 }}>
              <input
                type="radio"
                name="template"
                value="coach_company_t1"
                checked={templateKey === "coach_company_t1"}
                onChange={() => setTemplateKey("coach_company_t1")}
              />{" "}
              Generic intro (Hello + offer to help)
            </label>
            <label style={{ display: "block" }}>
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
          <p style={{ fontSize: 13, color: "#444", marginBottom: 14 }}>
            A short introduction will be sent on your behalf.
          </p>
        )}

        {feedback ? (
          <p
            style={{
              color: feedback.ok ? "#0a7d2c" : "#b00020",
              marginBottom: 10,
            }}
          >
            {feedback.message}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || alreadySent || (feedback?.ok === true)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: 0,
              background: sending || alreadySent || feedback?.ok ? "#aaa" : "#1a73e8",
              color: "#fff",
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
