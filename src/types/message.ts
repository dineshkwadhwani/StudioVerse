import type { Timestamp } from "firebase/firestore";
import type { ProfileUserType } from "@/types/profile";

export type MessageTemplateKey =
  | "coach_company_t1"
  | "coach_company_t2"
  | "individual_t1";

export type MessageRecord = {
  id: string;
  tenantId: string;
  studioType?: string;
  senderUserId: string;
  senderUserType: ProfileUserType;
  senderName: string;
  senderEmail?: string;
  receiverUserId: string;
  receiverUserType: ProfileUserType;
  receiverName: string;
  receiverEmail?: string;
  templateKey: MessageTemplateKey;
  subject: string;
  body: string;
  // Lock state on the receiver inbox side. Coach/Company receivers seeing a
  // message from an Individual see it locked until they pay the unlock fee.
  isLocked: boolean;
  unlockedAt?: Timestamp;
  unlockFeeCoins?: number;
  unlockTransactionId?: string;
  readAt?: Timestamp;
  createdAt?: Timestamp;
};

export type MessageDirection = "inbox" | "outbox";
