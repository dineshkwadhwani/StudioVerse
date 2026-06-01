import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ tenantId: string; profileId: string }> },
) {
  try {
    const { tenantId, profileId } = await context.params;
    const snapshot = await adminDb.collection("users").doc(profileId).get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const data = snapshot.data() ?? {};
    const profileTenantId = normalizeString(data.tenantId);

    if (profileTenantId !== tenantId) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        id: snapshot.id,
        tenantId: profileTenantId,
        userType: normalizeString(data.userType || data.profileType || data.role) || "individual",
        fullName: normalizeString(data.fullName || data.name),
        city: normalizeString(data.city),
        state: normalizeString(data.state),
        country: normalizeString(data.country),
        companyName: normalizeString(data.companyName || data.companyDisplayName),
        currentRole: normalizeString(data.currentRole),
        bio: normalizeString(data.bio),
        professionalHeadline: normalizeString(data.professionalHeadline),
        profilePhotoUrl: normalizeString(data.profilePhotoUrl),
        highestDegreeHeld: normalizeString(data.highestDegreeHeld),
        fieldOfStudy: normalizeString(data.fieldOfStudy),
        yearsOfExperience: normalizeString(data.yearsOfExperience),
        industryFocus: normalizeString(data.industryFocus || data.industry),
        languagesSpoken: normalizeStringArray(data.languagesSpoken),
        expertiseAreas: normalizeStringArray(data.expertiseAreas),
        coachTargetAudience: normalizeStringArray(data.coachTargetAudience),
        coachMethods: normalizeStringArray(data.coachMethods),
        coachSessionFormats: normalizeStringArray(data.coachSessionFormats),
        coachServicesOther: normalizeString(data.coachServicesOther),
        coachAvailability: normalizeStringArray(
          typeof data.coachAvailability === "string"
            ? data.coachAvailability.split(",").map((item: string) => item.trim())
            : data.coachAvailability,
        ),
        certifications: normalizeStringArray(data.certifications),
        coachCredentials: normalizeStringArray(data.coachCredentials),
        coachingExperienceYears: normalizeString(data.coachingExperienceYears),
        trainingExperienceYears: normalizeString(data.trainingExperienceYears),
        coachOutcomeFocus: normalizeString(data.coachOutcomeFocus),
        coachExperienceSummary: normalizeString(data.coachExperienceSummary),
        coachIndustryExperience: normalizeString(data.coachIndustryExperience),
        linkedinUrl: normalizeString(data.linkedinUrl),
        instagramHandle: normalizeString(data.instagramHandle),
        youtubeChannel: normalizeString(data.youtubeChannel),
        websiteUrl: normalizeString(data.websiteUrl),
        publicProfileReady: Boolean(data.publicProfileReady),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load public profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
