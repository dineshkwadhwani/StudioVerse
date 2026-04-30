"use client";

import Image from "next/image";
import { Fragment, useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import {
  getDoc,
  doc,
} from "firebase/firestore";
import { auth } from "@/services/firebase";
import { db } from "@/services/firebase";
import type { TenantConfig } from "@/types/tenant";
import { getActiveBotHero } from "@/services/botHero.service";
import styles from "./BotWidget.module.css";

type BotMode = "studio" | "professional";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type GuestStep = "name" | "phone" | "ready";

type BotConfigRuntime = {
  visible: boolean;
  studioBotEnabled: boolean;
  professionalBotEnabled: boolean;
  personaName: string;
  personaAvatar?: string;
  messageCap: number;
};

type Props = {
  tenantConfig: TenantConfig;
  currentUser?: {
    uid: string;
    name: string;
    email: string;
    userType: string;
  } | null;
};

const DEFAULT_PERSONA = "Studio Assistant";
const DEFAULT_AVATAR = "/tenants/coaching-studio/bot.png";

function inferModeFromOpenEndedAnswer(
  answer: string,
  hasStudio: boolean,
  hasProfessional: boolean
): BotMode | null {
  if (hasStudio && !hasProfessional) return "studio";
  if (!hasStudio && hasProfessional) return "professional";

  const text = answer.toLowerCase();
  const studioSignals = [
    "coaching studio",
    "studio",
    "platform",
    "feature",
    "module",
    "dashboard",
    "program",
    "event",
    "assessment",
    "tenant",
    "wallet",
    "referral",
    "manage users",
    "login",
  ];
  const professionalSignals = [
    "advice",
    "coach me",
    "coaching advice",
    "guidance",
    "career",
    "goal",
    "mindset",
    "confidence",
    "communication",
    "motivation",
    "habit",
    "stress",
    "performance",
    "leadership",
  ];

  if (studioSignals.some((token) => text.includes(token))) return "studio";
  if (professionalSignals.some((token) => text.includes(token))) return "professional";
  return null;
}

function normalizeAssistantReply(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    // Put numbered items on separate lines when model returns them inline.
    .replace(/\s+(?=\d+\.\s)/g, "\n")
    // Put bullet items on separate lines when returned inline.
    .replace(/\s+(?=[-*]\s)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderInlineBold(text: string, keyPrefix: string): ReactNode {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g);
  return chunks.map((chunk, chunkIndex) => {
    const isBold = chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4;
    if (!isBold) {
      return <Fragment key={`${keyPrefix}-chunk-${chunkIndex}`}>{chunk}</Fragment>;
    }

    return <strong key={`${keyPrefix}-chunk-${chunkIndex}`}>{chunk.slice(2, -2)}</strong>;
  });
}

type MessageBlock = {
  type: "p" | "ul" | "ol";
  lines: string[];
};

function renderFormattedMessage(content: string): ReactNode {
  const lines = content.split("\n");
  const blocks: MessageBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") {
        last.lines.push(bulletMatch[1]);
      } else {
        blocks.push({ type: "ul", lines: [bulletMatch[1]] });
      }
      continue;
    }

    if (numberedMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ol") {
        last.lines.push(numberedMatch[1]);
      } else {
        blocks.push({ type: "ol", lines: [numberedMatch[1]] });
      }
      continue;
    }

    blocks.push({ type: "p", lines: [line] });
  }

  return blocks.map((block, blockIndex) => {
    if (block.type === "ul") {
      return (
        <ul key={`block-${blockIndex}`} className={styles.msgList}>
          {block.lines.map((item, itemIndex) => (
            <li key={`block-${blockIndex}-item-${itemIndex}`}>{renderInlineBold(item, `ul-${blockIndex}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    }

    if (block.type === "ol") {
      return (
        <ol key={`block-${blockIndex}`} className={styles.msgListOrdered}>
          {block.lines.map((item, itemIndex) => (
            <li key={`block-${blockIndex}-item-${itemIndex}`}>{renderInlineBold(item, `ol-${blockIndex}-${itemIndex}`)}</li>
          ))}
        </ol>
      );
    }

    const paragraph = block.lines[0];
    if (!paragraph.trim()) {
      return <div key={`block-${blockIndex}`} className={styles.msgSpacer} />;
    }

    return (
      <p key={`block-${blockIndex}`} className={styles.msgParagraph}>
        {renderInlineBold(paragraph, `p-${blockIndex}`)}
      </p>
    );
  });
}

export default function BotWidget({ tenantConfig, currentUser }: Props) {
  const [runtimeBotCfg, setRuntimeBotCfg] = useState<BotConfigRuntime>({
    visible: tenantConfig.botConfig?.visible ?? false,
    studioBotEnabled: tenantConfig.botConfig?.studioBotEnabled ?? false,
    professionalBotEnabled: tenantConfig.botConfig?.professionalBotEnabled ?? false,
    personaName: tenantConfig.botConfig?.personaName || DEFAULT_PERSONA,
    personaAvatar: tenantConfig.botConfig?.personaAvatar,
    messageCap: tenantConfig.botConfig?.messageCap ?? 5,
  });

  const [resolvedUser, setResolvedUser] = useState<Props["currentUser"]>(currentUser ?? null);

  useEffect(() => {
    let cancelled = false;

    async function loadTenantBotConfig() {
      try {
        const tenantSnap = await getDoc(doc(db, "tenants", tenantConfig.id));
        if (!tenantSnap.exists()) return;
        const data = tenantSnap.data() as Record<string, unknown>;
        const botConfig = (data.botConfig ?? {}) as Record<string, unknown>;
        if (cancelled) return;

        const loadedVisible = typeof botConfig.visible === "boolean" ? botConfig.visible : undefined;
        const loadedStudioEnabled =
          typeof botConfig.studioBotEnabled === "boolean" ? botConfig.studioBotEnabled : undefined;
        const loadedProfessionalEnabled =
          typeof botConfig.professionalBotEnabled === "boolean" ? botConfig.professionalBotEnabled : undefined;
        const loadedPersonaName =
          typeof botConfig.personaName === "string" ? botConfig.personaName.trim() : "";
        const loadedPersonaAvatar =
          typeof botConfig.personaAvatar === "string" ? botConfig.personaAvatar.trim() : "";
        const loadedMessageCap =
          typeof botConfig.messageCap === "number" && Number.isFinite(botConfig.messageCap)
            ? Math.max(1, Math.min(20, Math.floor(botConfig.messageCap)))
            : undefined;

        // Some older tenant docs may carry a default empty botConfig payload.
        // In that case, keep existing in-code defaults instead of turning the bot off after first render.
        const looksUnconfigured =
          loadedVisible === false &&
          loadedStudioEnabled === false &&
          loadedProfessionalEnabled === false &&
          !loadedPersonaName &&
          !loadedPersonaAvatar &&
          loadedMessageCap === 5;

        if (looksUnconfigured) {
          return;
        }

        setRuntimeBotCfg((prev) => ({
          visible: loadedVisible ?? prev.visible,
          studioBotEnabled: loadedStudioEnabled ?? prev.studioBotEnabled,
          professionalBotEnabled: loadedProfessionalEnabled ?? prev.professionalBotEnabled,
          personaName: loadedPersonaName || prev.personaName,
          personaAvatar: loadedPersonaAvatar || prev.personaAvatar,
          messageCap: loadedMessageCap ?? prev.messageCap,
        }));
      } catch (err) {
        console.error("Failed to load tenant bot config:", err);
      }
    }

    function resolveUserFromSession() {
      if (currentUser) {
        setResolvedUser(currentUser);
        return;
      }

      const uid = auth.currentUser?.uid || sessionStorage.getItem("cs_uid") || "";
      const name = sessionStorage.getItem("cs_name") || auth.currentUser?.displayName || "";
      const email = auth.currentUser?.email || sessionStorage.getItem("cs_email") || "";
      const userType = sessionStorage.getItem("cs_role") || "individual";

      if (uid && name) {
        setResolvedUser({ uid, name, email, userType });
      }
    }

    void loadTenantBotConfig();
    resolveUserFromSession();

    // Bot Hero override: if an active bot hero exists, override persona name and avatar.
    async function loadBotHeroOverride() {
      try {
        const hero = await getActiveBotHero(tenantConfig.id);
        if (hero && !cancelled) {
          setRuntimeBotCfg((prev) => ({
            ...prev,
            personaName: hero.professionalName || prev.personaName,
            personaAvatar: hero.professionalAvatar || prev.personaAvatar,
          }));
        }
      } catch {
        // Non-critical — fall back to tenant config silently.
      }
    }

    void loadBotHeroOverride();

    return () => {
      cancelled = true;
    };
  }, [tenantConfig.id, currentUser]);

  const botCfg = runtimeBotCfg;
  const hasStudio = botCfg.studioBotEnabled ?? false;
  const hasProfessional = botCfg.professionalBotEnabled ?? false;

  const personaName = botCfg.personaName || DEFAULT_PERSONA;
  const personaAvatar = botCfg.personaAvatar || tenantConfig.theme.logo || DEFAULT_AVATAR;
  const messageCap = botCfg.messageCap ?? 5;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BotMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [capReached, setCapReached] = useState(false);
  const [capEmailInput, setCapEmailInput] = useState("");
  const [capEmailSaved, setCapEmailSaved] = useState(false);
  const [referralDocId, setReferralDocId] = useState<string | null>(null);

  // Guest state
  const [guestStep, setGuestStep] = useState<GuestStep | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestTempInput, setGuestTempInput] = useState("");
  const [guestReady, setGuestReady] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = resolvedUser?.name ?? guestName;
  const isLoggedIn = !!resolvedUser;

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && mode && !loading) {
      inputRef.current?.focus();
    }
  }, [open, mode, loading]);

  function handleOpen() {
    setOpen(true);
    if (messages.length > 0) {
      return;
    }

    if (!isLoggedIn) {
      setGuestStep("name");
      setMessages([
        {
          role: "assistant",
          content: `Hi, I am ${personaName}. Welcome to ${tenantConfig.name}. Before we begin, may I know your name?`,
        },
      ]);
      return;
    }

    if (hasStudio && hasProfessional) {
      setMessages([
        {
          role: "assistant",
          content: `Hi ${displayName ? displayName.split(" ")[0] : "there"}, I am ${personaName}. Welcome to ${tenantConfig.name}. What can I do for you today? Do you have a question related to ${tenantConfig.name}, or would you like advice?`,
        },
      ]);
      return;
    }

    if (hasStudio) {
      startMode("studio");
      setMessages([
        {
          role: "assistant",
          content: `Hi ${displayName ? displayName.split(" ")[0] : "there"}, I am ${personaName}. I am here to help with anything related to ${tenantConfig.name}. What would you like to know?`,
        },
      ]);
      return;
    }

    if (hasProfessional) {
      startMode("professional");
      setMessages([
        {
          role: "assistant",
          content: `Hi ${displayName ? displayName.split(" ")[0] : "there"}, I am ${personaName}. I am here for thoughtful, practical advice. What are you working through right now?`,
        },
      ]);
    }
  }

  function handleClose() {
    setOpen(false);
  }

  function startMode(selectedMode: BotMode) {
    setMode(selectedMode);
  }

  async function createGuestReferral(name: string, phone: string) {
    try {
      const res = await fetch("/api/bot/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenantConfig.id,
          referredName: name,
          referredPhone: phone,
          source: "BOT",
        }),
      });

      const data = (await res.json()) as { referralId?: string; error?: string; warning?: string; code?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create referral.");
      }

      if (!data.referralId) {
        if (data.warning || data.code === "admin_credentials_missing") {
          console.warn("Guest referral persistence skipped:", data.warning ?? data.code);
          return;
        }
        throw new Error(data.error ?? "Failed to create referral.");
      }

      setReferralDocId(data.referralId);
    } catch (err) {
      console.error("Failed to create bot referral:", err);
    }
  }

  async function saveCapEmail(email: string) {
    if (!email.trim()) return;
    try {
      if (referralDocId) {
        const updateRes = await fetch("/api/bot/referral", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referralId: referralDocId,
            referredEmail: email.trim().toLowerCase(),
          }),
        });
        const updateData = (await updateRes.json()) as { error?: string; warning?: string; code?: string };
        if (!updateRes.ok) {
          throw new Error(updateData.error ?? "Failed to update referral email.");
        }

        if (updateData.warning || updateData.code === "admin_credentials_missing") {
          console.warn("Referral email update skipped:", updateData.warning ?? updateData.code);
        }
      } else if (isLoggedIn) {
        // Logged in user — create a record for follow-up
        const createRes = await fetch("/api/bot/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId: tenantConfig.id,
            referredName: resolvedUser?.name ?? "",
            referredEmail: email.trim().toLowerCase(),
            referredUserId: resolvedUser?.uid ?? "",
            source: "bot-cap",
          }),
        });
        const createData = (await createRes.json()) as { error?: string; warning?: string; code?: string };
        if (!createRes.ok) {
          throw new Error(createData.error ?? "Failed to create cap referral.");
        }

        if (createData.warning || createData.code === "admin_credentials_missing") {
          console.warn("Cap referral persistence skipped:", createData.warning ?? createData.code);
        }
      }
      setCapEmailSaved(true);
    } catch (err) {
      console.error("Failed to save cap email:", err);
    }
  }

  async function handleGuestInput() {
    const val = guestTempInput.trim();
    if (!val) return;

    if (guestStep === "name") {
      setGuestName(val);
      setGuestTempInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: val },
        { role: "assistant", content: `Lovely to meet you, ${val.split(" ")[0]}. Could you share your phone number so I can keep you updated?` },
      ]);
      setGuestStep("phone");
      return;
    }

    if (guestStep === "phone") {
      const assistantAfterName = `Lovely to meet you, ${guestName.split(" ")[0]}. Could you share your phone number so I can keep you updated?`;
      const assistantAfterPhone = `Thank you, ${guestName.split(" ")[0]}. I am ${personaName}. Welcome to ${tenantConfig.name}. What can I do for you today? Do you have a question related to ${tenantConfig.name}, or would you like advice?`;

      setGuestPhone(val);
      setGuestTempInput("");
      setGuestReady(true);
      setGuestStep("ready");
      await createGuestReferral(guestName, val);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: val },
        {
          role: "assistant",
          content: assistantAfterPhone,
        },
      ]);

      // Persist intake messages once phone is known so the full guest-bot exchange lives in one phone-based log.
      await saveGuestConversationLog({
        category: "general",
        userMessage: guestName,
        assistantMessage: assistantAfterName,
      });
      await saveGuestConversationLog({
        category: "general",
        userMessage: val,
        assistantMessage: assistantAfterPhone,
      });
      return;
    }
  }

  async function saveGuestConversationLog(args: {
    category: "coaching-studio" | "general";
    userMessage: string;
    assistantMessage: string;
  }): Promise<void> {
    if (isLoggedIn || !guestReady || !guestPhone || !guestName) {
      return;
    }

    try {
      await fetch("/api/bot/guest-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenantConfig.id,
          botName: personaName,
          guestName,
          guestPhone,
          category: args.category,
          userMessage: args.userMessage,
          assistantMessage: args.assistantMessage,
        }),
      });
    } catch (error) {
      console.error("Failed to save guest conversation log:", error);
    }
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || capReached) return;

    // Guest not ready yet — shouldn't happen but guard
    if (!isLoggedIn && guestStep !== "ready") return;

    const userMsg = input.trim();
    setInput("");

    if (!mode) {
      const selectedMode = inferModeFromOpenEndedAnswer(userMsg, hasStudio, hasProfessional);
      if (!selectedMode) {
        const followUpReply = `Thanks for sharing that. Just to make sure I support you the right way: is this about ${tenantConfig.name} features, or would you like personal ${tenantConfig.roles.professional.toLowerCase()} advice?`;
        setMessages((prev) => [
          ...prev,
          { role: "user", content: userMsg },
          {
            role: "assistant",
            content: followUpReply,
          },
        ]);

        if (!isLoggedIn && guestReady) {
          await saveGuestConversationLog({
            category: "general",
            userMessage: userMsg,
            assistantMessage: followUpReply,
          });
        }
        return;
      }

      const modeReply =
        selectedMode === "studio"
          ? `Perfect. I can help with ${tenantConfig.name} questions. Please share your question and I will guide you.`
          : `Great, I can help with practical advice. Tell me what situation you are facing, and I will support you step by step.`;

      setMode(selectedMode);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMsg },
        {
          role: "assistant",
          content: modeReply,
        },
      ]);

      if (!isLoggedIn && guestReady) {
        await saveGuestConversationLog({
          category: selectedMode === "studio" ? "coaching-studio" : "general",
          userMessage: userMsg,
          assistantMessage: modeReply,
        });
      }
      return;
    }

    const newMessages: ChatMessage[] = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(newMessages);

    const newCount = userMessageCount + 1;
    setUserMessageCount(newCount);

    setLoading(true);
    try {
      let context: string | undefined;

      if (mode === "studio") {
        const retrieveRes = await fetch("/api/bot/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: userMsg, tenantId: tenantConfig.id }),
        });
        const retrieveData = await retrieveRes.json() as { context?: string };
        context = retrieveData.context;
      }

      const res = await fetch("/api/bot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: newMessages,
          context,
          personaName,
          tenantName: tenantConfig.name,
          professionalRole: tenantConfig.roles.professional,
        }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      const reply = normalizeAssistantReply(data.reply ?? "I'm sorry, something went wrong.");

      if (!isLoggedIn && guestReady) {
        const category = mode === "studio" ? "coaching-studio" : "general";
        await saveGuestConversationLog({
          category,
          userMessage: userMsg,
          assistantMessage: reply,
        });
      }

      const withReply: ChatMessage[] = [...newMessages, { role: "assistant", content: reply }];

      if (newCount >= messageCap) {
        const capMsg: ChatMessage = {
          role: "assistant",
          content: isLoggedIn
            ? `I want to support you well, and this conversation is at my current limit. I will arrange a deeper follow-up and send details to your registered email.`
            : `I want to support you well, and this conversation is at my current limit. Please share your email, and I will send details to schedule a deeper conversation.`,
        };
        setMessages([...withReply, capMsg]);
        setCapReached(true);
        if (isLoggedIn && resolvedUser?.email) {
          await saveCapEmail(resolvedUser.email);
        }
      } else {
        setMessages(withReply);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "I hit a temporary issue while responding. Please try once more." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, capReached, mode, messages, userMessageCount, messageCap, isLoggedIn, tenantConfig, guestStep, resolvedUser, hasStudio, hasProfessional, guestReady, guestPhone, guestName, personaName]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoggedIn && guestStep !== "ready") {
        void handleGuestInput();
      } else {
        void sendMessage();
      }
    }
  }

  const showGuestCapture = open && !isLoggedIn && guestStep !== "ready";
  const showChat = open && (isLoggedIn || guestReady);

  // Determine input placeholder
  let placeholder = "Type a message...";
  if (!isLoggedIn) {
    if (guestStep === "name") placeholder = "Your name...";
    else if (guestStep === "phone") placeholder = "Your phone number (e.g. +91...)";
  } else if (!mode) {
    placeholder = `Tell me if this is about ${tenantConfig.name} or if you need advice...`;
  }

  // Keep hook order stable; visibility checks must run after hooks are initialized.
  if (!botCfg?.visible || (!hasStudio && !hasProfessional)) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        className={styles.trigger}
        onClick={open ? handleClose : handleOpen}
        aria-label={`Chat with ${personaName}`}
      >
        <Image src={personaAvatar} alt={personaName} width={56} height={56} className={styles.triggerImg} />
      </button>

      {/* Chat panel */}
      {open && (
        <div className={styles.panel}>
          {/* Header */}
          <div className={styles.header}>
            <Image src={personaAvatar} alt={personaName} width={36} height={36} className={styles.headerAvatar} />
            <div className={styles.headerInfo}>
              <p className={styles.headerName}>{personaName}</p>
              <p className={styles.headerSub}>{tenantConfig.name}</p>
            </div>
            <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label="Close chat">✕</button>
          </div>

          {/* Chat messages */}
          {(showGuestCapture || showChat) && (
            <div className={styles.messages}>
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? styles.userMsg : styles.botMsg}>
                  {msg.role === "assistant" ? (
                    <div className={styles.msgText}>{renderFormattedMessage(msg.content)}</div>
                  ) : (
                    <p className={styles.msgText}>{msg.content}</p>
                  )}
                </div>
              ))}
              {loading && (
                <div className={styles.botMsg}>
                  <p className={styles.msgText}>
                    <span className={styles.typing}>●●●</span>
                  </p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Cap email capture */}
          {capReached && !capEmailSaved && !isLoggedIn && (
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="email"
                placeholder="Your email address..."
                value={capEmailInput}
                onChange={(e) => setCapEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveCapEmail(capEmailInput);
                }}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={() => void saveCapEmail(capEmailInput)}
                disabled={!capEmailInput.trim()}
              >
                →
              </button>
            </div>
          )}
          {capReached && capEmailSaved && (
            <div className={styles.capThanks}>
              <p>Thank you! We&apos;ll be in touch soon. 👋</p>
            </div>
          )}
          {capReached && isLoggedIn && (
            <div className={styles.capThanks}>
              <p>Thank you! We&apos;ll reach out to schedule a deeper conversation. 👋</p>
            </div>
          )}

          {/* Normal input */}
          {!capReached && (showGuestCapture || showChat) && (
            <div className={styles.inputRow}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                placeholder={placeholder}
                value={showGuestCapture ? guestTempInput : input}
                onChange={(e) => showGuestCapture ? setGuestTempInput(e.target.value) : setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.sendBtn}
                onClick={() => showGuestCapture ? void handleGuestInput() : void sendMessage()}
                disabled={loading || (showGuestCapture ? !guestTempInput.trim() : !input.trim())}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
