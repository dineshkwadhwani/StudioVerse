# Seed Context — StudioVerse

Status: Implemented and deployed to test + production  
Last Updated: 17 May 2026

---

## Overview

The Seed Data system consolidates all package and reference data seeding into a unified Firestore document model (`earningPackages/{tenantId}`) with dedicated Cloud Functions per package type. Each seed button seeds only its type into the shared document, eliminating cross-seeding and collection duplication.

---

## Package Types and Data Structure

All packages are stored in a single document: `earningPackages/{tenantId}`

### 1. Credit Packages (Coin Packages)
**Seed Button:** "Seed Credit Packages"  
**Callable:** `seedCreditPackages(tenantId)`  
**Field:** `creditPackages: CoinPackageRecord[]`

Default packages (5):
- Starter: 20 credits, ₹500
- Player: 50 credits, ₹1,200
- Champion: 100 credits, ₹2,000
- Pro: 250 credits, ₹4,000
- Elite: 500 credits, ₹7,500

**Record Structure:**
```typescript
CoinPackageRecord = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  imagePath?: string;
  credits: number;
  priceInr: number;
  status: "active" | "inactive";
  sortOrder: number;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 2. Promotion Packages
**Seed Button:** "Seed Promotion Packages"  
**Callable:** `seedPromotionPackages(tenantId)`  
**Field:** `promotionPackages: PromotionPackageRecord[]`

Default packages (3):
- Free Promotion Package for Program (1 month, 0 credits)
- Free Promotion Package for Assessment (1 month, 0 credits)
- Free Promotion Package for Event (1 month, 0 credits)

**Record Structure:**
```typescript
PromotionPackageRecord = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  imagePath?: string;
  resourceType: "program" | "assessment" | "event";
  durationValue: number;
  durationUnit: "month" | "week" | "day";
  costCredits: number;
  status: "active" | "inactive";
  sortOrder: number;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 3. Listing Packages
**Seed Button:** "Seed Listing Packages"  
**Callable:** `seedListingPackages(tenantId)`  
**Field:** `listingPackages: ListingPackageRecord[]`

Default packages (3):
- Free Listing Package for Program (1 month, 0 credits)
- Free Listing Package for Assessment (1 month, 0 credits)
- Free Listing Package for Event (1 month, 0 credits)

**Record Structure:**
```typescript
ListingPackageRecord = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  imagePath?: string;
  resourceType: "program" | "assessment" | "event";
  durationValue: number;
  durationUnit: "month" | "week" | "day";
  costCredits: number;
  status: "active" | "inactive";
  sortOrder: number;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 4. Bot Hero Packages
**Seed Button:** "Seed Bot Hero Packages"  
**Callable:** `seedBotPackages(tenantId)`  
**Field:** `botPackages: BotHeroPackageRecord[]`

Default packages (2):
- Free Bot Hero Package Basic: 1 week, 0 credits
- Free Bot Hero Package Basic: 1 week, 5 credits

**Record Structure:**
```typescript
BotHeroPackageRecord = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  imagePath?: string;
  durationValue: number;
  durationUnit: "month" | "week" | "day";
  credits: number;
  active: boolean;
  sortOrder: number;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 5. Lead Packages
**Seed Button:** "Seed Lead Packages"  
**Callable:** `seedLeadPackages(tenantId)`  
**Field:** `leadPackages: LeadPackageRecord[]`

Default packages (3):
- Company Lead: enabled=true, fee=1 credit
- Coach Lead: enabled=true, fee=1 credit
- Individual Lead: enabled=true, fee=1 credit

**Record Structure:**
```typescript
LeadPackageRecord = {
  id: string;
  name: string;
  userType: "company" | "professional" | "individual";
  enabled: boolean;
  leadFee: number;
  description?: string;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 6. Lead Fees (Legacy - kept for backward compatibility)
**Field:** `leadFees: LeadFeeRecord[]`  
**Note:** Not actively seeded; can be managed separately if needed.

**Record Structure:**
```typescript
LeadFeeRecord = {
  id: string;
  name: string;
  amount: number;
  description?: string;
}
```

---

## Implementation Details

### Unified Document Structure

All packages live in a single Firestore document:

```
earningPackages/{tenantId}
{
  tenantId: "coaching-studio",
  creditPackages: [...],
  promotionPackages: [...],
  listingPackages: [...],
  botPackages: [...],
  leadPackages: [...],
  leadFees: [],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Firestore Rules

```javascript
match /earningPackages/{tenantId} {
  allow read:   if isSignedIn();
  allow write:  if isSuperAdmin();
}
```

---

## Backend Implementation

### Files

- **Function Definitions:** `functions/src/admin/seedEarningPackages.ts`
- **Exports:** `functions/src/index.ts`

### Callables

Each callable is a dedicated Cloud Function (v2, asia-south1 region) that:
1. Authenticates as superadmin-only
2. Checks if the package type already exists in `earningPackages/{tenantId}`
3. If not seeded, writes only the requested package type array
4. Returns counts of all package types after seeding

**Function Signatures:**
```typescript
seedCreditPackages(tenantId: string) → SeedEarningPackagesResult
seedPromotionPackages(tenantId: string) → SeedEarningPackagesResult
seedListingPackages(tenantId: string) → SeedEarningPackagesResult
seedBotPackages(tenantId: string) → SeedEarningPackagesResult
seedLeadPackages(tenantId: string) → SeedEarningPackagesResult
seedEarningPackages(tenantId, seedType) → SeedEarningPackagesResult (legacy)
```

**Result Type:**
```typescript
SeedEarningPackagesResult = {
  status: "seeded" | "already-exists";
  creditPackages: number;
  listingPackages: number;
  promotionPackages: number;
  botPackages: number;
  leadPackages: number;
  leadFees: number;
  message: string;
}
```

---

## Frontend Implementation

### Service Layer

**File:** `src/services/earningPackages.service.ts`

Exports:
- `seedCreditPackages(tenantId)`
- `seedPromotionPackages(tenantId)`
- `seedListingPackages(tenantId)`
- `seedBotPackages(tenantId)`
- `seedLeadPackages(tenantId)`
- `getEarningPackages(tenantId)` — Reads the unified document

Each seed function uses a dedicated callable, with fallback to legacy `seedEarningPackages(seedType)` for backward compatibility.

### Seed Data Page

**File:** `src/modules/admin/SeedDataPage.tsx`

Features:
- Five distinct seed buttons (one per package type)
- Tenant selector (coaching-studio available)
- Status hydration on mount (checks which packages are seeded)
- Shows seeded count after clicking button
- Error handling with user-friendly messages

Button States:
- **Checking...** — Loading seed status
- **Seeding...** — Operation in progress
- **Seeded** — Already seeded (button disabled)
- **Seed [Type]** — Ready to seed

### Configuration

**File:** `src/config/seeds.config.ts`

```typescript
SEED_SCRIPTS: [
  {
    id: "earningPackages",
    displayName: "Credit Packages",
    callableName: "seedCreditPackages",
    tenants: ["coaching-studio"]
  },
  {
    id: "listingPackages",
    displayName: "Listing Packages",
    callableName: "seedListingPackages",
    tenants: ["coaching-studio"]
  },
  {
    id: "promotionPackages",
    displayName: "Promotion Packages",
    callableName: "seedPromotionPackages",
    tenants: ["coaching-studio"]
  },
  {
    id: "botPackages",
    displayName: "Bot Hero Packages",
    callableName: "seedBotPackages",
    tenants: ["coaching-studio"]
  },
  {
    id: "leadPackages",
    displayName: "Lead Packages",
    callableName: "seedLeadPackages",
    tenants: ["coaching-studio"]
  }
]
```

---

## Key Design Decisions

### 1. One Document, Multiple Arrays
All packages consolidated into a single `earningPackages/{tenantId}` document instead of separate collections.

**Benefits:**
- Single read for all earning data (1 Firestore read vs 5)
- Atomic writes within a transaction
- Clear tenant isolation
- Reduced cold-start latency

### 2. Type-Specific Callables
Each seed button has its own Cloud Function.

**Benefits:**
- No cross-seeding (button seeding Credit doesn't touch Promotion, etc.)
- Clear separation of concerns
- Easier to add/remove package types
- Backward compatible (legacy callable still works)

### 3. Idempotent Seeding
Repeated calls to the same seed function return status without duplicating data.

**Behavior:**
- First call: seeds data → status: "seeded"
- Subsequent calls: detects existing data → status: "already-exists"

### 4. No Legacy Collection Writes
New seed functions write only to `earningPackages/{tenantId}`, never to old collections like `coinPackages`.

**Reads** still support fallback (for backwards compat), but writes are consolidated.

---

## Read/Write Patterns

### Reading Packages

**Preferred (unified):**
```typescript
const earning = await getEarningPackages(tenantId);
const creditPkgs = earning?.creditPackages ?? [];
const leadPkgs = earning?.leadPackages ?? [];
```

**Legacy (for compatibility):**
```typescript
const coins = await listCoinPackages();
const promos = await listPromotionPackages();
```

Service helpers automatically try the unified doc first, then fall back to legacy collections.

### Seeding Packages

Each button calls its dedicated seed function:
```typescript
await seedCreditPackages("coaching-studio");
await seedLeadPackages("coaching-studio");
```

No need to specify seedType; the callable always knows its own type.

---

## Deployment Status

| Environment | Firestore Rules | Storage Rules | Functions | Status |
|---|---|---|---|---|
| **test** (studioverse-test) | ✅ Deployed | ✅ Deployed | ✅ All 5 callables live | Production-ready |
| **prod** (studioverse-18552) | ✅ Deployed | ✅ Deployed | ✅ All 5 callables live | Live |

**Last Deployment:** 17 May 2026

---

## Usage

### For SuperAdmins

1. Navigate to **Admin > Seed Data**
2. Select tenant (e.g., "Coaching Studio")
3. Click individual seed buttons:
   - "Seed Credit Packages" → Creates 5 default coin packages
   - "Seed Promotion Packages" → Creates 3 free promotion packages
   - "Seed Listing Packages" → Creates 3 free listing packages
   - "Seed Bot Hero Packages" → Creates 2 bot hero packages
   - "Seed Lead Packages" → Creates 3 lead fee packages (Company, Coach, Individual)

Each button seeding is independent; you can seed in any order.

### For Developers

To retrieve seeded packages:
```typescript
import { getEarningPackages } from "@/services/earningPackages.service";

const data = await getEarningPackages("coaching-studio");
console.log(data.creditPackages);  // CoinPackageRecord[]
console.log(data.leadPackages);    // LeadPackageRecord[]
```

To seed programmatically:
```typescript
import { seedLeadPackages } from "@/services/earningPackages.service";

const result = await seedLeadPackages("coaching-studio");
console.log(result.message);  // "Lead packages seeded successfully."
```

---

## Testing Checklist

- [x] Seed Credit Packages → Only creditPackages array written
- [x] Seed Promotion Packages → Only promotionPackages array written
- [x] Seed Listing Packages → Only listingPackages array written
- [x] Seed Bot Hero Packages → Only botPackages array written
- [x] Seed Lead Packages → Only leadPackages array written
- [x] No coinPackages collection created
- [x] Status hydration shows correct counts
- [x] Idempotency: re-seeding shows "Already seeded"
- [x] Firestore rules enforce superadmin write
- [x] Functions deployed to test
- [x] Functions deployed to prod
- [x] All builds pass (npm run build, npx tsc --noEmit)

---

## Future Enhancements

- Add UI for managing lead fees (currently in `leadFees` array)
- Add export/import seed templates per environment
- Add ability to revert/delete seeded packages from UI
- Add seed versioning/changelog tracking
- Add scheduled seed tasks for production rollouts
