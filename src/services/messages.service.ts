import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
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

export async function respondToMessage(args: {
  message: MessageRecord;
  responseType: "ignore" | "interested";
  responderName: string;
  responderPhone: string;
  responderEmail: string;
}): Promise<void> {
  const { message, responseType, responderName, responderPhone, responderEmail } = args;

  await updateDoc(doc(db, "messages", message.id), {
    responseType,
    respondedAt: serverTimestamp(),
  });

  const body =
    responseType === "interested"
      ? `Thanks for connecting. I am interested. My phone number is ${responderPhone} and my email is ${responderEmail}. Lets connect.`
      : "The message has been read and the receiver did not respond.";

  await addDoc(collection(db, "messages"), {
    tenantId: message.tenantId,
    studioType: message.studioType ?? null,
    senderUserId: message.receiverUserId,
    senderUserType: message.receiverUserType,
    senderName: responderName,
    receiverUserId: message.senderUserId,
    receiverUserType: message.senderUserType,
    receiverName: message.senderName,
    templateKey: "auto_reply" as MessageTemplateKey,
    subject: `Re: ${message.subject}`,
    body,
    isLocked: false,
    createdAt: serverTimestamp(),
  });
}
