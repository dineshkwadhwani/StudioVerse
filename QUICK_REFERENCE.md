# Quick Reference: StudioVerse Architecture Cheat Sheet

<!-- markdownlint-disable MD013 -->

## User Roles

```text
superadmin    → Platform administrator
company       → Organization/Company (e.g., "Training Company")
professional  → Coach/Service Provider (e.g., "Coach")
individual    → Learner/End User (e.g., "Coachee")
```

**Stored in:** `sessionStorage.setItem("cs_role", userType)`  
**Source:** `UserProfileRecord.userType` from Firestore `/users/{userId}`

---

## Role → User Relationships

```text
Company
  ├── manages Professionals (associatedCompanyId = company.id)
  │   └── manages Individuals (via Professional or direct)
  └── manages Individuals (associatedCompanyId = company.id)

Professional
  └── manages Individuals (associatedProfessionalId = professional.id)

Individual
  └── no managed users
```

---

## Manage Pages

| Page | Path | Who Can Access | File |
| ---- | ---- | -------------- | ---- |
| Manage Users | `/:tenant/manage-users` | Company, Professional | `src/modules/users/pages/ManageUsersPage.tsx` |
| Manage Wallet | `/:tenant/manage-wallet` | All roles | `src/modules/wallet/pages/ManageWalletPage.tsx` |
| Manage Cohorts | `/:tenant/manage-cohorts` | Company, Professional | `src/modules/app-shell/ManageCohortsPage.tsx` |
| Manage Referrals | `/:tenant/manage-referrals` | All roles | `src/modules/app-shell/ManageReferralsPage.tsx` |

**Access Control Pattern:**

```typescript
const role = sessionStorage.getItem("cs_role");
if (role === "individual") {
  router.replace(`${basePath}/dashboard`); // redirect
}
```

---

## Data Models: Creator Info

### Programs, Events, Assessments

```typescript
ownershipScope: "platform" | "company" | "professional"
ownerEntityId: string | null          // Company ID or Professional ID
createdBy: string                     // User ID
tenantId: string                      // Primary tenant (locked in edit)
tenantIds?: string[]                  // Secondary tenants (editable)
status: "published" | "draft" | ...
publicationState: "published" | ...   // Must be "published" to show
```

**Example Query:**

```typescript
// Only show published items in tenant scope
.filter((item) => isInTenantScope(item, config.id))
.filter((item) => item.status === "published" && item.publicationState === "published")
```

---

## Tile Component Pattern (Reused)

**Used by:** ProgramsPage, EventsPage, ToolsPage  
**Styles:** `landingStyles.tile`, `landingStyles.tileBody`, `landingStyles.tileTitle`, `landingStyles.tileButton`

```jsx
<article className={landingStyles.tile}>
  <img className={cardImageClass} src={item.thumbnailUrl} alt={item.name} />
  <div className={landingStyles.tileBody}>
    <h3 className={landingStyles.tileTitle}>{item.name}</h3>
    <p className={landingStyles.tileCopy}>{item.shortDescription}</p>
    <p className={styles.meta}>Details...</p>
    <button className={landingStyles.tileButton} onClick={() => handleItemClick(item)}>
      Find out more...
    </button>
  </div>
</article>
```

**DetailModal (Shared):** `src/modules/activities/components/DetailModal.tsx`  
Accepts `type: "program" | "event" | "tool"` to render appropriate details.

---

## Filter Pattern (Reused)

```typescript
// 1. Extract unique values from list
const options = useMemo(() => {
  return Array.from(new Set(items.map(item => item.fieldName)))
    .sort((a, b) => a.localeCompare(b));
}, [items]);

// 2. Render dropdown
<select value={selected} onChange={(e) => setSelected(e.target.value)}>
  <option value="all">All</option>
  {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
</select>

// 3. Filter items
const filtered = useMemo(() => {
  if (selected === "all") return items;
  return items.filter(item => item.fieldName === selected);
}, [items, selected]);
```

**Used by:**

- ProgramsPage (delivery type filter)
- EventsPage (city filter)
- ManageWalletPage (user type filter)

---

## Session Storage Keys

```typescript
cs_uid         → Firebase UID (auth.currentUser.uid)
cs_profile_id  → Profile document ID
cs_role        → User type: "company" | "professional" | "individual"
cs_name        → User's full name
cs_email       → User's email
cs_phone       → User's phone (E.164 format)
```

**Set in:** `AuthWizard.tsx`, `LoginRegisterModal.tsx` after successful login  
**Retrieved in:** All authenticated pages to determine access and behavior

---

## Scoped User Queries

### Query Users by Company

```typescript
import { listManagedUsersForCompany } from '@/services/manage-users.service';

const users = await listManagedUsersForCompany({
  tenantId: "coaching-studio",
  companyId: creatorProfile.id
});
// Returns: Professional + Individual users with associatedCompanyId = companyId
```

### Query Users by Professional

```typescript
import { listManagedUsersForProfessional } from '@/services/manage-users.service';

const users = await listManagedUsersForProfessional({
  professionalId: creatorProfile.id
});
// Returns: Individual users with associatedProfessionalId = professionalId
```

### Query Programs/Events by Tenant Scope

```typescript
import { listPrograms } from '@/services/programs.service';

const programs = await listPrograms(tenantId);
// Returns: programs where tenantId matches OR tenantIds includes tenantId
```

---

## Backend Scoping: Firestore Rules Example

```javascript
function isProfessionalUser() {
  return isSignedIn() && currentUserType() == "professional";
}

function isCompanyUser() {
  return isSignedIn() && currentUserType() == "company";
}

match /coinRequests/{requestId} {
  allow create: if isProfessionalUser()
    && request.resource.data.requesterProfessionalId == request.auth.uid
    && request.resource.data.companyId == currentCompanyId();  // SCOPED
}
```

---

## Multi-Tenant Records

```typescript
// Primary tenant (locked in edit)
tenantId: "coaching-studio"

// Secondary tenants (editable in edit)
tenantIds: ["training-studio", "recruitment-studio"]

// Scope matching
function isInTenantScope(record, tenantId): boolean {
  return record.tenantId === tenantId || record.tenantIds?.includes(tenantId);
}
```

---

## Key Service Functions

| Function | In File | Purpose |
| -------- | ------- | ------- |
| `listManagedUsersForCompany()` | manage-users.service.ts | Get users managed by a company |
| `listManagedUsersForProfessional()` | manage-users.service.ts | Get individuals managed by a professional |
| `createScopedManagedUser()` | manage-users.service.ts | Create user with company/professional association |
| `listPrograms()` | programs.service.ts | List programs, optionally filtered by tenant |
| `listEvents()` | events.service.ts | List events, optionally filtered by tenant |
| `getUserProfile()` | profile.service.ts | Get user profile by ID or context |
| `getWalletForUserContext()` | wallet.service.ts | Get wallet for user by multiple ID types |

---

## Next Steps for Implementation

1. **Identify target page** (e.g., "Manage Programs for Company")
2. **Follow ManageUsersPage pattern:**
   - Check role from sessionStorage
   - Load user profile via `getUserProfile()`
   - Query data using scoped service (e.g., `listManagedUsersForCompany()`)
   - Render using shared tile/filter patterns
3. **Use existing DetailModal** for item details
4. **Apply existing grid/filter styles** from LandingPage.module.css
5. **Verify access control** in ManageUsersPage.tsx lines 103-118

---

**Last Updated:** April 23, 2026
