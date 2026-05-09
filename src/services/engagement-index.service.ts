import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export type EngagementTier = "active-user" | "moderate-user" | "occasional-visitor";

export type EngagementIndexResult = {
  tier: EngagementTier;
  score: number;
  breakdown: {
    profile: number;
    learning: number;
    creation: number;
    economy: number;
    social: number;
    communication: number;
  };
};

function getTierFromScore(score: number): EngagementTier {
  if (score >= 80) return "active-user";
  if (score >= 30) return "moderate-user";
  return "occasional-visitor";
}

async function getProfileSignal(userId: string): Promise<number> {
  let points = 0;
  
  try {
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
      const data = userSnap.data();
      
      // Mandatory profile complete
      if (data.mandatoryProfileCompleted) {
        points += 10;
      }
      
      // 100% profile complete
      if (data.profileCompletionPercent === 100) {
        points += 20;
      }
      
      // Profile photo uploaded
      if (data.profilePhotoUrl) {
        points += 5;
      }
    }
  } catch {
    // Silently fail profile signal
  }
  
  return Math.min(points, 35); // Cap at 35
}

async function getLearningSignal(userId: string): Promise<number> {
  let points = 0;
  
  try {
    // Assignments received
    const assignmentsSnap = await getDocs(
      query(collection(db, "assignments"), where("assigneeId", "==", userId))
    );
    const assignmentCount = Math.min(assignmentsSnap.size, 6); // 5 each, cap at 6 = 30
    points += assignmentCount * 5;
    
    // Assignments completed
    const completedSnap = await getDocs(
      query(
        collection(db, "assignments"),
        where("assigneeId", "==", userId),
        where("status", "==", "completed")
      )
    );
    const completedCount = Math.min(completedSnap.size, 5); // 10 each, cap at 5 = 50
    points += completedCount * 10;
  } catch {
    // Silently fail learning signal
  }
  
  return Math.min(points, 80); // Cap at 80
}

async function getCreationSignal(userId: string): Promise<number> {
  let points = 0;
  
  try {
    // Count created programs, events, assessments
    const [programsSnap, eventsSnap, assessmentsSnap] = await Promise.all([
      getDocs(query(collection(db, "programs"), where("createdBy", "==", userId))),
      getDocs(query(collection(db, "events"), where("createdBy", "==", userId))),
      getDocs(query(collection(db, "assessments"), where("createdBy", "==", userId))),
    ]);
    
    const createdCount = Math.min(
      programsSnap.size + eventsSnap.size + assessmentsSnap.size,
      3
    ); // 10 each, cap at 3 = 30
    points += createdCount * 10;
  } catch {
    // Silently fail creation signal
  }
  
  return Math.min(points, 30); // Cap at 30
}

async function getEconomySignal(userId: string): Promise<number> {
  let points = 0;
  
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    // Wallet transactions in last 30 days = recency signal
    const txSnap = await getDocs(
      query(
        collection(db, "walletTransactions"),
        where("userId", "==", userId),
        where("createdAt", ">=", Timestamp.fromDate(last30Days))
      )
    );
    
    if (txSnap.size > 0) {
      points += 10; // Just checking that there's activity
    }
  } catch {
    // Silently fail economy signal
  }
  
  return Math.min(points, 10); // Cap at 10
}

async function getSocialSignal(userId: string): Promise<number> {
  let points = 0;
  
  try {
    // Referrals created and converted
    const referralsSnap = await getDocs(
      query(collection(db, "referrals"), where("referrerUserId", "==", userId))
    );
    const referralCount = Math.min(referralsSnap.size, 3); // 15 each, cap at 3 = 45
    points += referralCount * 15;
    
    // Converted referrals (joined)
    const convertedSnap = await getDocs(
      query(
        collection(db, "referrals"),
        where("referrerUserId", "==", userId),
        where("status", "==", "joined")
      )
    );
    points += Math.min(convertedSnap.size, 2) * 10; // Bonus for conversions
  } catch {
    // Silently fail social signal
  }
  
  return Math.min(points, 65); // Cap at 65
}

async function getCommunicationSignal(userId: string): Promise<number> {
  let points = 0;
  
  try {
    // Successful email notifications sent (sent status = 10 points, one-time)
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
      const userEmail = String(userSnap.data().email ?? "").trim().toLowerCase();
      if (userEmail) {
        const notifSnap = await getDocs(
          query(
            collection(db, "notificationLogs"),
            where("recipientEmail", "==", userEmail),
            where("status", "==", "sent")
          )
        );
        if (notifSnap.size > 0) {
          points += 10;
        }
      }
    }
  } catch {
    // Silently fail communication signal
  }
  
  return Math.min(points, 10); // Cap at 10
}

export async function calculateEngagementIndex(userId: string): Promise<EngagementIndexResult> {
  const [
    profilePoints,
    learningPoints,
    creationPoints,
    economyPoints,
    socialPoints,
    communicationPoints,
  ] = await Promise.all([
    getProfileSignal(userId),
    getLearningSignal(userId),
    getCreationSignal(userId),
    getEconomySignal(userId),
    getSocialSignal(userId),
    getCommunicationSignal(userId),
  ]);

  const totalScore =
    profilePoints +
    learningPoints +
    creationPoints +
    economyPoints +
    socialPoints +
    communicationPoints;

  return {
    tier: getTierFromScore(totalScore),
    score: totalScore,
    breakdown: {
      profile: profilePoints,
      learning: learningPoints,
      creation: creationPoints,
      economy: economyPoints,
      social: socialPoints,
      communication: communicationPoints,
    },
  };
}
