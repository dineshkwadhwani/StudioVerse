import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { consumeRateLimit } from "@/lib/rate-limit";

type GuestLogCategory = "coaching-studio" | "general";

type GuestLogPayload = {
  tenantId: string;
  botName: string;
  guestName: string;
  guestPhone: string;
  category: GuestLogCategory;
  userMessage: string;
  assistantMessage: string;
};

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function toCategory(value: unknown): GuestLogCategory | null {
  if (value === "coaching-studio" || value === "general") {
    return value;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rateLimit = consumeRateLimit({
    req,
    routeKey: "bot-guest-log",
    limit: 40,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rateLimit.retryAfterSec}s.` },
      { status: 429, headers: rateLimit.headers }
    );
  }

  try {
    const body = (await req.json()) as Partial<GuestLogPayload>;
    const tenantId = String(body.tenantId ?? "").trim();
    const botName = String(body.botName ?? "").trim();
    const guestName = String(body.guestName ?? "").trim();
    const guestPhoneRaw = String(body.guestPhone ?? "").trim();
    const guestPhone = normalizePhone(guestPhoneRaw);
    const userMessage = String(body.userMessage ?? "").trim();
    const assistantMessage = String(body.assistantMessage ?? "").trim();
    const category = toCategory(body.category);

    if (!tenantId || !botName || !guestName || !guestPhone || !userMessage || !assistantMessage || !category) {
      return NextResponse.json({ error: "Invalid guest log payload." }, { status: 400, headers: rateLimit.headers });
    }

    const logId = `${tenantId}__${guestPhone}`;
    const nowIso = new Date().toISOString();
    const entry = {
      question: userMessage,
      answer: assistantMessage,
      category,
      createdAt: nowIso,
    };

    const logRef = adminDb.collection("guestLogs").doc(logId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);

      if (!snap.exists) {
        tx.set(logRef, {
          tenantId,
          botName,
          guestPhone,
          guestName,
          category,
          categories: [category],
          date: nowIso,
          conversation: [entry],
          conversationCount: 1,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastConversationAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const data = snap.data() as {
        conversation?: unknown;
        categories?: unknown;
      };
      const previousConversation = Array.isArray(data.conversation) ? data.conversation : [];
      const nextConversation = [...previousConversation, entry].slice(-500);
      const previousCategories = Array.isArray(data.categories) ? data.categories.filter((item) => typeof item === "string") : [];
      const nextCategories = Array.from(new Set([...previousCategories, category]));

      tx.update(logRef, {
        botName,
        guestName,
        category,
        categories: nextCategories,
        date: nowIso,
        conversation: nextConversation,
        conversationCount: nextConversation.length,
        updatedAt: FieldValue.serverTimestamp(),
        lastConversationAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ ok: true }, { headers: rateLimit.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save guest log.";
    const isCredentialError = message.toLowerCase().includes("default credentials") || message.toLowerCase().includes("could not load");

    if (isCredentialError) {
      return NextResponse.json({ ok: false, warning: "Guest log persistence skipped in this environment." }, { status: 200, headers: rateLimit.headers });
    }

    return NextResponse.json({ error: message }, { status: 500, headers: rateLimit.headers });
  }
}