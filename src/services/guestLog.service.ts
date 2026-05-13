import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export type GuestLogCategory = "coaching-studio" | "training-studio" | "recruitment-studio" | "general";

export type GuestConversationEntry = {
  question: string;
  answer: string;
  category: GuestLogCategory;
  createdAt: string;
};

export type GuestLogRecord = {
  id: string;
  tenantId: string;
  botName: string;
  guestPhone: string;
  guestName: string;
  category: GuestLogCategory;
  categories: GuestLogCategory[];
  conversation: GuestConversationEntry[];
  conversationCount: number;
  lastConversationAt: Date | null;
};

export type GuestLogFilters = {
  tenantId?: string | "all";
  fromDate?: string;
  toDate?: string;
  category?: "all" | GuestLogCategory;
  phoneSearch?: string;
};

const KNOWN_CATEGORIES = new Set<GuestLogCategory>(["coaching-studio", "training-studio", "recruitment-studio", "general"]);

function toCategory(value: unknown): GuestLogCategory {
  if (typeof value === "string" && KNOWN_CATEGORIES.has(value as GuestLogCategory)) {
    return value as GuestLogCategory;
  }
  return "general";
}

function toDateFromTimestamp(value: unknown): Date | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }

  return null;
}

function mapLog(id: string, data: DocumentData): GuestLogRecord {
  const rawConversation = Array.isArray(data.conversation) ? data.conversation : [];
  const conversation: GuestConversationEntry[] = rawConversation
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        question: String(item.question ?? ""),
        answer: String(item.answer ?? ""),
        category: toCategory(item.category),
        createdAt: String(item.createdAt ?? ""),
      };
    });

  const categories = Array.isArray(data.categories)
    ? Array.from(new Set(data.categories.filter((item: unknown): item is GuestLogCategory => typeof item === "string" && KNOWN_CATEGORIES.has(item as GuestLogCategory))))
    : [];

  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    botName: String(data.botName ?? "Bot"),
    guestPhone: String(data.guestPhone ?? ""),
    guestName: String(data.guestName ?? "Guest"),
    category: toCategory(data.category),
    categories,
    conversation,
    conversationCount: Number(data.conversationCount ?? conversation.length ?? 0),
    lastConversationAt: toDateFromTimestamp(data.lastConversationAt),
  };
}

export async function listGuestLogs(filters: GuestLogFilters): Promise<GuestLogRecord[]> {
  const guestLogsRef = collection(db, "guestLogs");
  const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy>> = [];

  if (filters.tenantId && filters.tenantId !== "all") {
    constraints.push(where("tenantId", "==", filters.tenantId));
  }

  if (filters.fromDate) {
    const start = new Date(`${filters.fromDate}T00:00:00`);
    if (!Number.isNaN(start.getTime())) {
      constraints.push(where("lastConversationAt", ">=", start));
    }
  }

  if (filters.toDate) {
    const end = new Date(`${filters.toDate}T23:59:59.999`);
    if (!Number.isNaN(end.getTime())) {
      constraints.push(where("lastConversationAt", "<=", end));
    }
  }

  constraints.push(orderBy("lastConversationAt", "desc"));

  const snap = await getDocs(query(guestLogsRef, ...constraints));
  const records = snap.docs.map((row) => mapLog(row.id, row.data()));
  const normalizedPhoneSearch = String(filters.phoneSearch ?? "").replace(/\D/g, "").trim();

  return records
    .filter((record) => {
      if (!normalizedPhoneSearch) {
        return true;
      }

      const normalizedRecordPhone = record.guestPhone.replace(/\D/g, "");
      return normalizedRecordPhone.includes(normalizedPhoneSearch);
    })
    .filter((record) => {
      if (!filters.category || filters.category === "all") {
        return true;
      }

      return record.categories.includes(filters.category) || record.category === filters.category;
    });
}
