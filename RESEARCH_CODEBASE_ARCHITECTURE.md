# StudioVerse Codebase Research: Role Architecture & Component Patterns

<!-- markdownlint-disable MD012 MD013 MD022 MD026 MD032 -->

**Date:** April 23, 2026  
**Scope:** User role determination, manage pages, component reuse, data models  
**Status:** Comprehensive baseline established

---

## 1. User Role & Scope Architecture

### 1.1 Role Types & Classification

StudioVerse uses **four stable internal roles** (from `docs/ARCHITECTURE_OVERVIEW.md`):

- `superadmin` — Platform administrator
- `company` — Organization/Company entity
- `professional` — Coach/Service Provider (role label varies by tenant)
- `individual` — Learner/End User (role label varies by tenant)

**Type Definition:** [src/types/profile.ts](src/types/profile.ts#L1-L10)

```typescript
export const PROFILE_USER_TYPES = ["company", "professional", "individual"] as const;
export type ProfileUserType = (typeof PROFILE_USER_TYPES)[number];

export type UserProfileRecord = {
  id: string;
  userId: string;
  tenantId: string;
  profileType: ProfileUserType;
  userType: ProfileUserType;  // Primary role indicator
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  phoneE164: string;
  // ... additional fields
  mandatoryProfileCompleted: boolean;
  profileCompletionPercent: number;
  assignmentEligible: boolean;
  status: "active" | "inactive";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
```

### 1.2 How User Role is Determined & Stored

#### Determination Flow

1. **Registration/Auth:** User creates profile via `AuthWizard.tsx` or `LoginRegisterModal.tsx`
2. **Profile Service:** Role extracted from `UserProfileRecord.userType` field in Firestore
3. **Session Storage:** Role cached in browser session after successful login

#### Session Storage Keys

[src/modules/auth/components/AuthWizard.tsx](src/modules/auth/components/AuthWizard.tsx#L45-L52)

```typescript
sessionStorage.setItem("cs_uid", profile.userId);              // Firebase UID
sessionStorage.setItem("cs_profile_id", profile.id);          // Profile doc ID
sessionStorage.setItem("cs_role", profile.userType);          // ROLE STORED HERE
sessionStorage.setItem("cs_name", profile.fullName);
sessionStorage.setItem("cs_email", profile.email);
sessionStorage.setItem("cs_phone", profile.phoneE164);
```

#### Retrieval Pattern

All major pages retrieve role from session before rendering. Example from **ManageUsersPage**:
[src/modules/users/pages/ManageUsersPage.tsx](src/modules/users/pages/ManageUsersPage.tsx#L103-L112)

```typescript
useEffect(() => {
  const storedRoleRaw = sessionStorage.getItem("cs_role");
  const storedName = sessionStorage.getItem("cs_name");

  if (!isUserRole(storedRoleRaw)) {
    router.replace(basePath);
    return;
  }
  setRole(storedRoleRaw);
}, [basePath, router, tenantId]);
```

### 1.3 Company-to-Professional/Individual Relationships

#### Data Model

Users collection stores association via two fields:

```typescript
// From manage-users.service.ts mapping
associatedCompanyId?: string;           // Professional/Individual → Company ID
associatedProfessionalId?: string | null; // Individual → Professional ID
```

#### Company-Professional Association

[src/services/manage-users.service.ts](src/services/manage-users.service.ts#L127-L146) — `listManagedUsersForCompany()`

```typescript
export async function listManagedUsersForCompany(args: {
  tenantId: string;
  companyId: string;
}): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(query(collection(db, "users"), where("tenantId", "==", args.tenantId)));
  return snap.docs
    .map((row) => mapManagedUser(row.id, row.data() as Record<string, unknown>))
    .filter(
      (row) =>
        (row.userType === "professional" || row.userType === "individual") &&
        row.associatedCompanyId === args.companyId  // SCOPING BY COMPANY
    )
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}
```

#### Professional-Individual Association

[src/services/manage-users.service.ts](src/services/manage-users.service.ts#L148-L161) — `listManagedUsersForProfessional()`

```typescript
export async function listManagedUsersForProfessional(args: {
  professionalId: string;
}): Promise<ManagedUserRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("associatedProfessionalId", "==", args.professionalId)  // SCOPING BY PROFESSIONAL
    )
  );
  return snap.docs
    .map((row) => mapManagedUser(row.id, row.data() as Record<string, unknown>))
    .filter((row) => row.userType === "individual")
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}
```

#### User Creation with Association

[src/services/manage-users.service.ts](src/services/manage-users.service.ts#L161+) — `createScopedManagedUser()`

When a Company creates a Professional, or a Professional creates an Individual:

- Stores `associatedCompanyId` in the created user's document
- Stores `associatedProfessionalId` if Professional creates Individual
- Sets `createdByUserId` and `createdByRole` to track provenance

---

## 2. Current Manage Page Structure

### 2.1 Manage Pages Map

| Page | Route | Module | File | Access Control |
| ---- | ----- | ------ | ---- | -------------- |
| **Manage Users** | `/:tenant/manage-users` | users | [ManageUsersPage.tsx](src/modules/users/pages/ManageUsersPage.tsx) | Company, Professional |
| **Manage Wallet** | `/:tenant/manage-wallet` | wallet | [ManageWalletPage.tsx](src/modules/wallet/pages/ManageWalletPage.tsx) | All roles |
| **Manage Cohorts** | `/:tenant/manage-cohorts` | cohorts | [ManageCohortsPage.tsx](src/modules/app-shell/ManageCohortsPage.tsx) | Company, Professional |
| **Manage Referrals** | `/:tenant/manage-referrals` | ? | [ManageReferralsPage.tsx](src/modules/app-shell/ManageReferralsPage.tsx) | Company, Professional, Individual |
| **SuperAdmin Portal** | `/admin` | admin | [SuperAdminPortal.tsx](src/modules/admin/SuperAdminPortal.tsx) | superadmin only |

### 2.2 Routing Structure

**Tenant-specific routes** defined in `src/app/<tenant-id>/`

[src/app/coaching-studio/manage-users/page.tsx](src/app/coaching-studio/manage-users/page.tsx)

```typescript
import ManageUsersPage from "@/modules/app-shell/ManageUsersPage";
import { coachingTenantConfig } from "@/tenants/coaching-studio/config";

export default function CoachingStudioManageUsersRoutePage() {
  return <ManageUsersPage tenantConfig={coachingTenantConfig} />;
}
```

All three studios (coaching, training, recruitment) have identical route files that delegate to shared modules.

### 2.3 Authorization & Access Control Pattern

#### Pattern: Role Check + Route Guard

[src/modules/users/pages/ManageUsersPage.tsx](src/modules/users/pages/ManageUsersPage.tsx#L103-L118)

```typescript
useEffect(() => {
  const storedRoleRaw = sessionStorage.getItem("cs_role");
  
  if (!isUserRole(storedRoleRaw)) {
    router.replace(basePath);
    return;
  }

  setRole(storedRoleRaw);

  // Redirect Individual (non-manager) users away
  if (storedRoleRaw === "individual") {
    router.replace(`${basePath}/dashboard`);
    return;
  }

  // Load profile and fetch managed users based on role
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      router.replace(basePath);
      return;
    }
    // ... load managed users using role-specific service
  });
}, [basePath, router, tenantId]);
```

#### Backend Security

Firestore rules in **firestore.rules** enforce role-scoped access at document level:

```javascript
function isCompanyUser() {
  return isSignedIn() && currentUserType() == "company";
}

function isProfessionalUser() {
  return isSignedIn() && currentUserType() == "professional";
}

match /coinRequests/{requestId} {
  allow create: if isProfessionalUser()
    && request.resource.data.requesterProfessionalId == request.auth.uid
    && request.resource.data.tenantId == currentTenantId()
    && request.resource.data.companyId == currentCompanyId();

  allow update: if isCompanyUser()
    && (resource.data.companyId == request.auth.uid 
        || resource.data.companyId == currentCompanyId());
}
```

### 2.4 Role-Based Data Filtering

#### ManageUsersPage: Role Determines Available Actions

[src/modules/users/pages/ManageUsersPage.tsx](src/modules/users/pages/ManageUsersPage.tsx#L90-L102)

```typescript
const creator: CreatorProfile = {
  id: creatorDoc?.id ?? profile.id,
  userId: profile.userId,
  role: profile.userType,           // THIS DETERMINES ACCESS
  tenantId: profile.tenantId,
  fullName: profile.fullName,
  companyName: creatorDoc?.companyName || profile.companyName,
  associatedCompanyId: creatorDoc?.associatedCompanyId,
};

if (profile.userType === "company") {
  setTargetUserType("professional");  // Company can create Professionals
}

// Load appropriate managed users based on role
if (currentCreator.role === "company") {
  const managed = await listManagedUsersForCompany({
    tenantId: currentCreator.tenantId,
    companyId: currentCreator.id,
  });
} else if (currentCreator.role === "professional") {
  const managed = await listManagedUsersForProfessional({
    professionalId: currentCreator.id,
  });
}
```

#### ManageWalletPage: Role Determines Visible Actions

[src/modules/wallet/pages/ManageWalletPage.tsx](src/modules/wallet/pages/ManageWalletPage.tsx#L110-L130)

```typescript
{role === "professional" && (
  <Link href={`${basePath}/request-coins`} className={styles.button}>
    📬 Request Coins
  </Link>
)}

{role === "company" && (
  <button type="button" className={styles.button} onClick={() => setCoinRequestsModalOpen(true)}>
    👉 View Coin Requests
    {pendingCoinRequestCount > 0 ? ` (${pendingCoinRequestCount})` : ""}
  </button>
)}
```

### 2.5 SuperAdmin Portal Access Control

[src/modules/admin/SuperAdminPortal.tsx](src/modules/admin/SuperAdminPortal.tsx#L241-L270)

```typescript
async function ensureSuperadminProfile(firebaseUser: User): Promise<AppUser> {
  const userRef = doc(db, "users", firebaseUser.uid);
  
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error("Superadmin profile not found");
  }

  const data = snap.data() as Record<string, unknown>;
  if (data.userType !== "superadmin") {
    throw new Error("Not a superadmin user");
  }

  return mapAppUser(snap.id, data);
}
```

The SuperAdmin portal reads/writes directly to users, wallets, programs, events, assessments collections with full administrative access.

---

## 3. Grid/Tile Components

### 3.1 Tile Component Structure

#### Shared Tile Styles (Reused Across Pages)

[src/modules/landing/pages/LandingPage.module.css](src/modules/landing/pages/LandingPage.module.css#L343-L406)

```css
.tile {
  display: flex;
  flex-direction: column;
  background: var(--surface-card);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.tileImage {
  width: 100%;
  height: 200px;
  object-fit: cover;
  background: var(--surface);
}

.tileBody {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tileTitle {
  font-weight: 700;
  font-size: 1.1rem;
  margin: 0 0 8px 0;
  color: var(--ink-strong);
}

.tileCopy {
  color: var(--ink-soft);
  font-size: 0.95rem;
  margin: 0 0 12px 0;
  flex: 1;
}

.tileButton {
  border: 1px solid var(--brand-primary);
  border-radius: 6px;
  padding: 10px 16px;
  background: white;
  color: var(--brand-primary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tileButton:hover {
  background: linear-gradient(90deg, #1f5c9c 0%, #2bb6d1 100%);
  color: white;
}
```

### 3.2 Grid Layout Patterns

#### 4-Column Responsive Grid (Desktop/Tablet/Mobile)

[src/modules/events/pages/EventsPage.module.css](src/modules/events/pages/EventsPage.module.css#L129-L176)

```css
.grid {
  gap: 24px;
  display: grid;
  margin: 20px 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 1200px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

### 3.3 Component Reuse Across Pages

#### Programs/Events/Assessments Use Identical Tile Pattern

**ProgramsPage:**
[src/modules/programs/pages/ProgramsPage.tsx](src/modules/programs/pages/ProgramsPage.tsx#L163-L195)

```typescript
{visiblePrograms.map((item) => (
  <article key={item.id} className={landingStyles.tile}>
    <div className={styles.cardImageWrap}>
      <img className={styles.cardImage} src={item.thumbnailUrl || heroImage} alt={item.name} />
    </div>
    <div className={landingStyles.tileBody}>
      <h3 className={landingStyles.tileTitle}>{item.name}</h3>
      <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
      <p className={styles.meta}>Type: {PROGRAM_DELIVERY_TYPE_LABELS[item.deliveryType]}</p>
      <p className={styles.meta}>Duration: {item.durationValue} {item.durationUnit}</p>
      <button type="button" className={landingStyles.tileButton} onClick={() => handleItemClick(item)}>
        Find out more...
      </button>
    </div>
  </article>
))}
```

**EventsPage:**
[src/modules/events/pages/EventsPage.tsx](src/modules/events/pages/EventsPage.tsx#L215-L247)

```typescript
{visibleEvents.map((item) => (
  <article key={item.id} className={landingStyles.tile}>
    <div className={styles.cardImageWrap}>
      <img className={styles.cardImage} src={item.thumbnailUrl || ...} alt={item.name} />
    </div>
    <div className={landingStyles.tileBody}>
      <h3 className={landingStyles.tileTitle}>{item.name}</h3>
      <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
      <p className={styles.meta}>{item.locationCity || "City TBA"} | {item.locationAddress || "Address TBA"}</p>
      <p className={styles.meta}>Type: {EVENT_TYPE_LABELS[item.eventType]}</p>
      <button type="button" className={landingStyles.tileButton} onClick={() => handleItemClick(item)}>
        Find out more...
      </button>
    </div>
  </article>
))}
```

#### Shared DetailModal Component

Both Programs and Events use the same modal:

[src/modules/activities/components/DetailModal.tsx](src/modules/activities/components/DetailModal.tsx)

```typescript
export type DetailItem = {
  id: string;
  type: "program" | "event" | "tool";
  title: string;
  image: string;
  description: string;
  details: string;
  creditsRequired: number;
  deliveryType?: ProgramDeliveryType;
  durationValue?: number;
  durationUnit?: ProgramDurationUnit;
  facilitatorName?: string;
  videoUrl?: string;
  cost?: number;
  eventType?: EventType;
  eventDate?: string;
  eventTime?: string;
  locationCity?: string;
  locationAddress?: string;
};

export default function DetailModal({
  item,
  isOpen,
  userType,
  isLoggedIn,
  onAuthRequired,
  userId,
  userName,
  userRole,
  tenantId,
  onClose,
}: DetailModalProps) {
  // Renders details for program, event, or tool
  // Shows assignment/enrollment CTA based on userType
}
```

### 3.4 Reusable Filter Components

#### Delivery Type Filter (ProgramsPage)

[src/modules/programs/pages/ProgramsPage.tsx](src/modules/programs/pages/ProgramsPage.tsx#L138-L160)

```typescript
const deliveryTypeOptions = useMemo(() => {
  return Array.from(new Set(programs.map((item) => item.deliveryType))).sort(...);
}, [programs]);

// In render:
<select
  id="programs-type-filter"
  className={styles.filterSelect}
  value={selectedDeliveryType}
  onChange={(event) => setSelectedDeliveryType(event.target.value)}
>
  <option value="all">All Types</option>
  {deliveryTypeOptions.map((deliveryType) => (
    <option key={deliveryType} value={deliveryType}>
      {PROGRAM_DELIVERY_TYPE_LABELS[deliveryType]}
    </option>
  ))}
</select>
```

#### City Filter (EventsPage)

[src/modules/events/pages/EventsPage.tsx](src/modules/events/pages/EventsPage.tsx#L178-L200)

```typescript
const cityOptions = useMemo(() => {
  return Array.from(
    new Set(events.map((item) => item.locationCity.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));
}, [events]);

// In render:
<select
  id="events-city-filter"
  className={styles.filterSelect}
  value={selectedCity}
  onChange={(event) => setSelectedCity(event.target.value)}
>
  <option value="all">All Cities</option>
  {cityOptions.map((city) => (
    <option key={city} value={city}>{city}</option>
  ))}
</select>
```

---

## 4. Programs/Events/Assessments Data Model

### 4.1 Ownership Scope & Creator Info

#### Programs Data Model

[src/types/program.ts](src/types/program.ts#L1-L56)

```typescript
export const PROGRAM_OWNERSHIP_SCOPES = ["platform", "company", "professional"] as const;
export const PROGRAM_CATALOG_VISIBILITY = ["tenant_wide", "company_only", "professional_only"] as const;
export const PROGRAM_PUBLICATION_STATES = ["draft", "published", "pending_publication_review", "rejected_publication"] as const;

export type ProgramRecord = {
  id: string;
  tenantId: string;
  tenantIds?: string[];                      // Multi-tenant support
  name: string;
  shortDescription: string;
  longDescription: string;
  deliveryType: ProgramDeliveryType;
  durationValue: number;
  durationUnit: ProgramDurationUnit;
  details: string;
  
  // Creator/Ownership fields:
  ownershipScope: ProgramOwnershipScope;      // "platform" | "company" | "professional"
  ownerEntityId: string | null;               // Company ID or Professional ID
  catalogVisibility: ProgramCatalogVisibility; // Who can see it
  
  // Audit fields:
  createdBy: string;                          // User ID who created
  updatedBy: string;                          // User ID who last updated
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  
  status: ProgramStatus;                      // "draft" | "published" | "inactive" | "archived"
  publicationState: ProgramPublicationState;  // "published" for visibility
  promoted: boolean;                          // Elevation to landing page
};
```

#### Events Data Model

[src/types/event.ts](src/types/event.ts#L1-L80)

```typescript
export const EVENT_OWNERSHIP_SCOPES = ["platform", "company", "professional"] as const;
export const EVENT_CATALOG_VISIBILITY = ["tenant_wide", "company_only", "professional_only"] as const;

export type EventRecord = {
  id: string;
  tenantId: string;
  tenantIds?: string[];                  // Multi-tenant support
  name: string;
  eventType: EventType;                  // "classroom_session" | "webinar" | "workshop"
  eventSource: EventSource;              // "studioverse_manager" | "external"
  shortDescription: string;
  longDescription: string;
  
  // Date/Time:
  eventDate: string | null;              // ISO date yyyy-MM-dd
  eventTime: string | null;              // HH:mm
  eventDateTime: string | null;          // ISO datetime for sorting
  
  // Location:
  locationAddress: string;
  locationCity: string;
  
  // Creator/Ownership:
  ownershipScope: EventOwnershipScope;    // "platform" | "company" | "professional"
  ownerEntityId: string | null;           // Company ID or Professional ID
  catalogVisibility: EventCatalogVisibility;
  
  // Audit:
  createdBy: string;
  updatedBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  
  status: EventStatus;                   // "published" | "draft" | "cancelled" | "archived"
  publicationState: EventPublicationState;
  promoted: boolean;
};
```

#### Assessments Data Model

[src/types/assessment.ts](src/types/assessment.ts#L1-L60)

```typescript
export type AssessmentOwnershipScope = "platform" | "tenant" | "professional";

export type AssessmentRecord = {
  id: string;
  tenantId: string;
  tenantIds?: string[];                      // Multi-tenant support
  name: string;
  shortDescription: string;
  longDescription: string;
  
  assessmentType: AssessmentType;            // "self-awareness" | "capability" | etc.
  renderStyle: AssessmentRenderStyle;        // "gamified-drag-drop" | etc.
  reportStyle: AssessmentReportStyle;        // "development-template" | etc.
  
  creditsRequired: number;
  questionBankCount: number;
  questionsPerAttempt: number;
  
  // Creator/Ownership:
  ownershipScope: AssessmentOwnershipScope;  // "platform" | "tenant" | "professional"
  ownerEntityId: string;                     // Professional ID or Company ID
  
  // Audit:
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp | null;
  
  status: AssessmentStatus;                  // "draft" | "active" | "archived"
  publicationState: AssessmentPublicationState;
};
```

### 4.2 How Creator Info is Used & Verified

#### Creating Program with Ownership

[src/services/programs.service.ts](src/services/programs.service.ts#L171-L200)

The client sends form values to Firebase callable:

```typescript
function sanitizePayload(input: ProgramWriteInput): Record<string, unknown> {
  return {
    tenantId: input.tenantId,
    tenantIds: input.tenantIds,
    name: input.name,
    
    ownershipScope: input.ownershipScope,    // SET BY ADMIN
    ownerEntityId: nullToUndef(input.ownerEntityId),  // Company/Prof ID
    catalogVisibility: input.catalogVisibility,
    publicationState: input.publicationState,
    
    // ... other fields, timestamps omitted (server sets)
  };
}

export async function createProgram(input: ProgramWriteInput): Promise<{ id: string }> {
  const result = await createProgramCallable(sanitizePayload(input));
  return { id: result.data.id };
}
```

#### Backend Validation (Firebase Function)

Backend functions validate that:

- `createdBy` is set to the authenticated user ID
- `ownerEntityId` matches a valid Company or Professional
- `ownershipScope` is valid for the creator's role (company/professional/superadmin)
- audit logging captures all changes

### 4.3 Multi-Tenant Content Sharing

#### Feature: Programs/Events/Assessments Published to Multiple Tenants

[From COPILOT_CONTEXT.md § April 19, 2026]

```typescript
export type ProgramRecord = {
  tenantId: string;                         // Primary/locked tenant
  tenantIds?: string[];                     // Secondary tenant IDs
  // ...
};

export type ProgramFormValues = {
  tenantId: string;
  tenantIds: string[];                      // All tenant selections
  // ...
};
```

#### Admin Portal Tenant Selector

[src/modules/admin/SuperAdminPortal.tsx](src/modules/admin/SuperAdminPortal.tsx) — Tenant management section

During **create**: All tenant checkboxes are editable  
During **edit**: Primary tenant locked (shows "Primary (locked)" badge), secondary tenants editable

#### Scope Matching Logic

[src/modules/events/pages/EventsPage.tsx](src/modules/events/pages/EventsPage.tsx#L28-L39)

```typescript
function normalizeTenantToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isInTenantScope(record: Pick<EventRecord, "tenantId" | "tenantIds">, tenantId: string): boolean {
  const target = normalizeTenantToken(tenantId);
  if (normalizeTenantToken(record.tenantId) === target) {
    return true;
  }
  return (record.tenantIds ?? []).some((value) => normalizeTenantToken(value) === target);
}
```

### 4.4 Filtering Programs/Events/Assessments by Ownership

#### Example: Listing Published Programs for Tenant

[src/modules/programs/pages/ProgramsPage.tsx](src/modules/programs/pages/ProgramsPage.tsx#L74-L100)

```typescript
async function loadPublishedPrograms() {
  setIsLoading(true);
  try {
    const allPrograms = await listPrograms();
    const nextPrograms = allPrograms
      .filter((item) => isInTenantScope(item, config.id))              // TENANT SCOPE
      .filter((item) => item.status === "published" && item.publicationState === "published")  // PUBLICATION STATE
      .sort((a, b) => {
        if (a.promoted !== b.promoted) {
          return a.promoted ? -1 : 1;
        }
        return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
      });
    setPrograms(nextPrograms);
  } catch {
    setPrograms([]);
  }
}
```

#### Service Layer Filtering

[src/services/programs.service.ts](src/services/programs.service.ts#L116-L138)

```typescript
function matchesTenantScope(args: {
  primaryTenantId: string;
  tenantIds?: string[];
  selectedTenantId: string;
}): boolean {
  if (args.primaryTenantId === args.selectedTenantId) {
    return true;
  }
  if (!Array.isArray(args.tenantIds) || args.tenantIds.length === 0) {
    return false;
  }
  return args.tenantIds.includes(args.selectedTenantId);
}

export async function listPrograms(tenantId?: string): Promise<ProgramRecord[]> {
  const constraints: QueryConstraint[] = [orderBy("updatedAt", "desc")];
  const snapshot = await getDocs(query(collection(db, "programs"), ...constraints));
  const rows = snapshot.docs.map((item) => mapProgram(item.id, item.data()));

  if (!tenantId) {
    return rows;
  }

  return rows.filter((item) =>
    matchesTenantScope({
      primaryTenantId: item.tenantId,
      tenantIds: item.tenantIds,
      selectedTenantId: tenantId,
    })
  );
}
```

---

## 5. Summary of Component Reuse Opportunities

### 5.1 Shared Tile Component (Opportunity for Extraction)

**Current State:**

- Tile markup repeated in ProgramsPage, EventsPage, ToolsPage
- Tile styles defined in LandingPage.module.css and reused via import

**Reuse Pattern:**

```typescript
// src/modules/activities/components/ActivityTile.tsx (COULD BE CREATED)
export type ActivityTileProps = {
  item: ProgramRecord | EventRecord | AssessmentRecord;
  onClick: (item) => void;
  image?: string;
  meta?: React.ReactNode;
};

export default function ActivityTile({ item, onClick, image, meta }: ActivityTileProps) {
  return (
    <article className={landingStyles.tile}>
      <img className={styles.image} src={image} alt={item.name} />
      <div className={landingStyles.tileBody}>
        <h3 className={landingStyles.tileTitle}>{item.name}</h3>
        <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
        {meta}
        <button className={landingStyles.tileButton} onClick={() => onClick(item)}>
          Find out more...
        </button>
      </div>
    </article>
  );
}
```

### 5.2 Shared Filter Logic

**Current State:**

- Delivery Type filter (ProgramsPage)
- City filter (EventsPage)
- User Type filter (ManageWalletPage, ManageUsersPage)

**Reuse Pattern:**

```typescript
// Generic filter hook
export function useUniqueValues<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return useMemo(() => {
    return Array.from(new Set(items.map(item => item[key]))).sort();
  }, [items, key]);
}
```

### 5.3 Shared DetailModal

**Current State:**
Already centralized in [src/modules/activities/components/DetailModal.tsx](src/modules/activities/components/DetailModal.tsx)

Used consistently across:

- ProgramsPage
- EventsPage
- ToolsPage (Assessments)

**Recommendation:** Keep as-is. This is a best practice.

---

## 6. File Structure Summary

### Key Service Files

- [src/services/programs.service.ts](src/services/programs.service.ts) — List/create/update programs
- [src/services/events.service.ts](src/services/events.service.ts) — List/create/update events
- [src/services/profile.service.ts](src/services/profile.service.ts) — User profile and role determination
- [src/services/manage-users.service.ts](src/services/manage-users.service.ts) — Company/Professional user management
- [src/services/wallet.service.ts](src/services/wallet.service.ts) — Wallet and coin transactions

### Key Type Files

- [src/types/profile.ts](src/types/profile.ts) — User roles and profile schema
- [src/types/program.ts](src/types/program.ts) — Program ownership and scoping
- [src/types/event.ts](src/types/event.ts) — Event ownership and scoping
- [src/types/assessment.ts](src/types/assessment.ts) — Assessment ownership and scoping
- [src/types/cohort.ts](src/types/cohort.ts) — Cohort creator role and association
- [src/types/wallet.ts](src/types/wallet.ts) — Wallet user types and transactions

### Key Component Files

- [src/modules/app-shell/ManageUsersPage.tsx](src/modules/app-shell/ManageUsersPage.tsx) — Wrapper
- [src/modules/users/pages/ManageUsersPage.tsx](src/modules/users/pages/ManageUsersPage.tsx) — Implementation
- [src/modules/wallet/pages/ManageWalletPage.tsx](src/modules/wallet/pages/ManageWalletPage.tsx) — Wallet management
- [src/modules/programs/pages/ProgramsPage.tsx](src/modules/programs/pages/ProgramsPage.tsx) — Program listing
- [src/modules/events/pages/EventsPage.tsx](src/modules/events/pages/EventsPage.tsx) — Event listing
- [src/modules/admin/SuperAdminPortal.tsx](src/modules/admin/SuperAdminPortal.tsx) — Admin controls

### Configuration Files

- [src/config/studio.ts](src/config/studio.ts) — Studio configuration resolver
- [src/tenants/coaching-studio/config.ts](src/tenants/coaching-studio/config.ts) — Tenant-specific config
- [src/modules/activities/config/menuConfig.ts](src/modules/activities/config/menuConfig.ts) — Role-based menu

---

## 7. Implementation Readiness

### Ready to Implement

✅ User role determination is documented and working  
✅ Company/Professional/Individual associations are fully scoped  
✅ Manage pages follow consistent access control patterns  
✅ Grid/Tile components are reusable (DetailModal already centralized)  
✅ Data models include creator/ownership fields  
✅ Multi-tenant scoping is implemented and verified  
✅ Session storage stores and retrieves roles correctly  

### Next Steps for Feature Work

1. Identify specific manage page features to implement (e.g., "Manage Programs for Company")
2. Leverage existing `listManagedUsersForCompany()` pattern for content queries
3. Reuse `DetailModal` component for detail views
4. Apply existing grid/filter patterns from EventsPage and ProgramsPage
5. Follow ManageUsersPage access control pattern for authorization

---

**Research completed:** April 23, 2026
