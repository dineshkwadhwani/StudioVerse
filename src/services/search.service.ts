import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import { listPrograms } from "@/services/programs.service";
import { listEvents } from "@/services/events.service";
import type { ProgramRecord } from "@/types/program";
import type { EventRecord } from "@/types/event";
import type { AssessmentRecord } from "@/types/assessment";
import type { ManageUserRole } from "@/services/manage-users.service";

function toLowerSafe(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function matchesAny(haystack: string[], tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const hay = haystack.map((value) => value.toLowerCase());
  return tokens.some((token) => hay.some((field) => field.includes(token)));
}

export type ProgramSearchResult = ProgramRecord;
export type EventSearchResult = EventRecord;
export type AssessmentSearchResult = AssessmentRecord;

export async function searchPrograms(args: {
  tenantId: string;
  queryString: string;
}): Promise<ProgramSearchResult[]> {
  const tokens = tokenize(args.queryString);
  if (tokens.length === 0) return [];

  const all = await listPrograms(args.tenantId);
  return all.filter((program) => {
    if (program.visibility !== "public") return false;
    if (program.status !== "published") return false;
    return matchesAny(
      [program.name, program.shortDescription, program.longDescription, program.deliveryType],
      tokens
    );
  });
}

export async function searchEvents(args: {
  tenantId: string;
  queryString: string;
}): Promise<EventSearchResult[]> {
  const tokens = tokenize(args.queryString);
  if (tokens.length === 0) return [];

  const all = await listEvents(args.tenantId);
  return all.filter((event) => {
    if (event.visibility !== "public") return false;
    if (event.status !== "published") return false;
    return matchesAny(
      [
        event.name,
        event.shortDescription,
        event.longDescription,
        event.locationCity,
        event.eventType,
      ],
      tokens
    );
  });
}

export async function searchAssessments(args: {
  tenantId: string;
  queryString: string;
}): Promise<AssessmentSearchResult[]> {
  const tokens = tokenize(args.queryString);
  if (tokens.length === 0) return [];

  const snapshot = await getDocs(
    query(collection(db, "assessments"), where("tenantId", "==", args.tenantId))
  );
  const records: AssessmentRecord[] = snapshot.docs.map((row) => ({
    id: row.id,
    ...(row.data() as Omit<AssessmentRecord, "id">),
  }));

  return records.filter((assessment) => {
    if (toLowerSafe(assessment.visibility) !== "public") return false;
    if (toLowerSafe(assessment.status) !== "published") return false;
    return matchesAny(
      [assessment.name, assessment.shortDescription, assessment.longDescription],
      tokens
    );
  });
}

export type UserSearchResult = {
  id: string;
  userType: ManageUserRole;
  fullName: string;
  email: string;
  professionalHeadline: string;
  bio: string;
  expertiseAreas: string[];
  certifications: string[];
  profilePhotoUrl: string | null;
  associatedCompanyId: string | null;
  associatedProfessionalId: string | null;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapUserDoc(id: string, data: Record<string, unknown>): UserSearchResult {
  const userType = (data.userType ?? data.profileType ?? data.role) as string | undefined;
  return {
    id,
    userType: (userType === "company" || userType === "professional" ? userType : "individual") as ManageUserRole,
    fullName: typeof data.fullName === "string" ? data.fullName : "",
    email: typeof data.email === "string" ? data.email : "",
    professionalHeadline: typeof data.professionalHeadline === "string" ? data.professionalHeadline : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    expertiseAreas: toStringArray(data.expertiseAreas),
    certifications: toStringArray(data.certifications),
    profilePhotoUrl:
      typeof data.profilePhotoUrl === "string" ? data.profilePhotoUrl : null,
    associatedCompanyId:
      typeof data.associatedCompanyId === "string" && data.associatedCompanyId
        ? data.associatedCompanyId
        : null,
    associatedProfessionalId:
      typeof data.associatedProfessionalId === "string" && data.associatedProfessionalId
        ? data.associatedProfessionalId
        : null,
  };
}

export async function searchUsers(args: {
  tenantId: string;
  queryString: string;
  targetUserType: ManageUserRole;
  enforceUnassociated: boolean;
  excludeUserId?: string;
}): Promise<UserSearchResult[]> {
  const tokens = tokenize(args.queryString);
  if (tokens.length === 0) return [];

  const snapshot = await getDocs(
    query(collection(db, "users"), where("tenantId", "==", args.tenantId))
  );
  const records = snapshot.docs.map((row) => mapUserDoc(row.id, row.data()));

  return records.filter((user) => {
    if (user.id === args.excludeUserId) return false;
    if (user.userType !== args.targetUserType) return false;
    if (args.enforceUnassociated) {
      if (user.associatedProfessionalId) return false;
      if (user.associatedCompanyId) return false;
    }
    return matchesAny(
      [
        user.fullName,
        user.professionalHeadline,
        user.bio,
        ...user.expertiseAreas,
        ...user.certifications,
      ],
      tokens
    );
  });
}
