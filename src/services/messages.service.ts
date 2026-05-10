import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";
import type { MessageRecord, MessageTemplateKey } from "@/types/message";

export async function listInboxMessages(args: {
  tenantId: string;
  receiverUserId: string;
}): Promise<MessageRecord[]> {
  const q = query(
    collection(db, "messages"),
    where("tenantId", "==", args.tenantId),
    where("receiverUserId", "==", args.receiverUserId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessageRecord, "id">) }));
}

export async function listOutboxMessages(args: {
  tenantId: string;
  senderUserId: string;
}): Promise<MessageRecord[]> {
  const q = query(
    collection(db, "messages"),
    where("tenantId", "==", args.tenantId),
    where("senderUserId", "==", args.senderUserId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessageRecord, "id">) }));
}

export type SendIntroMessageArgs = {
  tenantId: string;
  receiverUserId: string;
  templateKey: MessageTemplateKey;
  subject?: string;
  body?: string;
};

export type SendIntroMessageResult = {
  status: "sent" | "duplicate";
  messageId: string;
};

export async function sendIntroMessage(args: SendIntroMessageArgs): Promise<SendIntroMessageResult> {
  const callable = httpsCallable<SendIntroMessageArgs, SendIntroMessageResult>(
    functions,
    "sendIntroMessage",
  );
  const result = await callable(args);
  return result.data;
}

export type UnlockMessageResult = {
  status: "unlocked" | "already-unlocked" | "free";
  feeCoins: number;
  walletTransactionId?: string;
};

export async function unlockMessage(args: { messageId: string }): Promise<UnlockMessageResult> {
  const callable = httpsCallable<typeof args, UnlockMessageResult>(functions, "unlockMessage");
  const result = await callable(args);
  return result.data;
}
