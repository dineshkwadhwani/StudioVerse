# StudioVerse: User Role & Manage Page Architecture Diagram

<!-- markdownlint-disable MD013 MD040 -->

## 1. User Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Signs Up/In                                                       │
│         ↓                                                                │
│  Firebase Auth (phone number + OTP)                                     │
│         ↓                                                                │
│  Profile Created/Retrieved from Firestore                               │
│         ↓                                                                │
│  UserProfileRecord.userType determined:                                 │
│     ├─ "company" → Company admin                                        │
│     ├─ "professional" → Coach/Service Provider                          │
│     ├─ "individual" → Learner/End User                                  │
│     └─ "superadmin" → Platform admin (manually set)                     │
│         ↓                                                                │
│  Session Storage Updated:                                               │
│     ├─ cs_uid (Firebase UID)                                            │
│     ├─ cs_profile_id (Profile doc ID)                                   │
│     ├─ cs_role ← USER TYPE STORED HERE                                  │
│     ├─ cs_name (Full name)                                              │
│     ├─ cs_email                                                         │
│     └─ cs_phone (E.164 format)                                          │
│         ↓                                                                │
│  App Routing & Menu Generated Based on Role                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Role-Based User Hierarchy & Associations

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  COMPANY (userType = "company")                                            │
│  ├─ Fields: userId, tenantId, companyName, email, phone                    │
│  ├─ Scopes: tenantId (belongs to one tenant)                               │
│  │                                                                          │
│  ├─→ Creates PROFESSIONAL(s)                                               │
│  │   ├─ Professional.associatedCompanyId = company.id                      │
│  │   ├─ Professional.tenantId = same as company.tenantId                   │
│  │   │                                                                      │
│  │   └─→ Professional Creates INDIVIDUAL(s)                                │
│  │       ├─ Individual.associatedProfessionalId = professional.id          │
│  │       ├─ Individual.associatedCompanyId = company.id (inherited)        │
│  │       └─ Individual.tenantId = same tenant                              │
│  │                                                                          │
│  └─→ Creates INDIVIDUAL(s) Directly                                        │
│      ├─ Individual.associatedCompanyId = company.id                        │
│      └─ Individual.tenantId = same as company.tenantId                     │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PROFESSIONAL (userType = "professional")                                  │
│  ├─ Fields: userId, tenantId, companyName (coach name), email, phone      │
│  ├─ Associations: associatedCompanyId (belongs to one company)             │
│  │                                                                          │
│  └─→ Creates INDIVIDUAL(s)                                                 │
│      ├─ Individual.associatedProfessionalId = professional.id              │
│      ├─ Individual.associatedCompanyId = professional.associatedCompanyId  │
│      └─ Individual.tenantId = professional.tenantId                        │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INDIVIDUAL (userType = "individual")                                      │
│  ├─ Fields: userId, tenantId, fullName, email, phone                       │
│  ├─ Associations:                                                          │
│  │  ├─ associatedProfessionalId (optional - coach parent)                  │
│  │  └─ associatedCompanyId (company parent, or inherited via coach)        │
│  │                                                                          │
│  └─ No users report to Individual                                          │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Manage Page Access Control Matrix

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Route                   │ Page                │ CanAccess        │ See Own? │
├────────────────────────────────────────────────────────────────────────────┤
│ /manage-users           │ Manage Users        │ Co,Pr            │ Yes      │
│ /manage-wallet          │ Manage Wallet       │ All              │ Yes      │
│ /manage-cohorts         │ Manage Cohorts      │ Co,Pr            │ Yes      │
│ /manage-referrals       │ Manage Referrals    │ All              │ Yes      │
│ /programs               │ Browse Programs     │ All              │ Filtered │
│ /events                 │ Browse Events       │ All              │ Filtered │
│ /tools                  │ Browse Assessments  │ All              │ Filtered │
│ /admin                  │ SuperAdmin Portal   │ SuperAdmin       │ N/A      │
└────────────────────────────────────────────────────────────────────────────┘

Legend: Co = Company, Pr = Professional, In = Individual, All = All roles
        Filtered = Shows only items visible to that role/company
```

---

## 4. Manage Users Page: Role-Based Data Filtering

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  URL: /coaching-studio/manage-users                                     │
│  Role Check:                                                             │
│    ├─ If role === "individual" → REDIRECT to /dashboard                 │
│    └─ If role === "company" or "professional" → ALLOW                   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Load User Data Based on Role:                                          │
│                                                                          │
│  IF role === "company"                                                  │
│  ├─ Load via: listManagedUsersForCompany({                              │
│  │                tenantId: currentTenant,                             │
│  │                companyId: currentUser.id                            │
│  │              })                                                      │
│  ├─ Returns: All Professionals + Individuals where                      │
│  │            associatedCompanyId === company.id                        │
│  ├─ Can Create: Professional or Individual                              │
│  └─ Coin Request Access: Can APPROVE/DENY requests from Professionals  │
│                                                                          │
│  ELSE IF role === "professional"                                        │
│  ├─ Load via: listManagedUsersForProfessional({                         │
│  │                professionalId: currentUser.id                        │
│  │              })                                                      │
│  ├─ Returns: Only Individuals where                                     │
│  │            associatedProfessionalId === professional.id              │
│  ├─ Can Create: Individual only                                         │
│  └─ Coin Request Access: Can REQUEST coins from associated Company      │
│                                                                          │
│  ELSE                                                                    │
│  ├─ No managed users available → Empty list                             │
│  └─ Cannot create users                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Manage Wallet Page: Role-Based Wallet Visibility

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  URL: /coaching-studio/manage-wallet                                    │
│  Access: ALL roles (company, professional, individual)                  │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Show Wallet Summary:                                                   │
│  ├─ Available Coins                                                     │
│  ├─ Total Issued Coins                                                  │
│  └─ Utilized Coins                                                      │
│                                                                          │
│  Show Transaction History:                                              │
│  └─ All wallet transactions for current user, sorted by date            │
│                                                                          │
│  Show Actions Based on Role:                                            │
│                                                                          │
│  IF role === "professional"                                             │
│  ├─ 💳 Buy Coins (link to buy-coins page)                               │
│  └─ 📬 Request Coins (link to request-coins page)                       │
│                                                                          │
│  ELSE IF role === "company"                                             │
│  ├─ 💳 Buy Coins                                                        │
│  └─ 👉 View Coin Requests (shows pending requests from Professionals)   │
│         ├─ Displays count badge (e.g., "(3)")                          │
│         ├─ Opens modal with request list                                │
│         └─ Can Approve/Deny each request                                │
│                                                                          │
│  ELSE IF role === "individual"                                          │
│  └─ Read-only view of own wallet                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Programs/Events/Assessments: Creator & Ownership Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PROGRAM RECORD                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Ownership Scoping:                                                     │
│  ├─ ownershipScope: "platform" | "company" | "professional"             │
│  │                  (WHO OWNS THIS? EVERYONE? COMPANY? COACH?)           │
│  │                                                                       │
│  └─ ownerEntityId: string | null                                        │
│     └─ IF ownershipScope="company"        → ownerEntityId = Company.id  │
│     └─ IF ownershipScope="professional"   → ownerEntityId = Coach.id    │
│     └─ IF ownershipScope="platform"       → ownerEntityId = null        │
│                                                                          │
│  Visibility Scoping:                                                    │
│  ├─ tenantId: "coaching-studio" (PRIMARY - locked in edit)              │
│  │                                                                       │
│  ├─ tenantIds?: ["training-studio", ...] (SECONDARY - editable)         │
│  │                                                                       │
│  └─ catalogVisibility: "tenant_wide" | "company_only" | "professional_only"  │
│     (WHO CAN SEE THIS IN THE CATALOG?)                                  │
│                                                                          │
│  Publication Status:                                                    │
│  ├─ status: "published" | "draft" | "inactive" | "archived"              │
│  └─ publicationState: "published" | "draft" | "pending_publication_review" │
│     (PUBLISHED? DRAFT PENDING? REJECTED?)                               │
│                                                                          │
│  Creator Audit Trail:                                                   │
│  ├─ createdBy: userId (WHO CREATED?)                                    │
│  ├─ updatedBy: userId (LAST PERSON TO EDIT?)                            │
│  ├─ createdAt: timestamp                                                │
│  └─ updatedAt: timestamp                                                │
│                                                                          │
│  Promotion:                                                             │
│  └─ promoted: boolean                                                   │
│     (IF TRUE & PUBLISHED → SHOW ON LANDING PAGE)                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Listing Programs/Events: Visibility Filter Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  Load All Programs/Events from Firestore                                │
│         ↓                                                                │
│  [[FILTER 1]] Tenant Scope:                                             │
│  ├─ Keep if: record.tenantId === requestedTenant                        │
│  ├─ OR: record.tenantIds?.includes(requestedTenant)                     │
│  └─ DISCARD everything else                                             │
│         ↓                                                                │
│  [[FILTER 2]] Publication State:                                        │
│  ├─ Keep if: record.status === "published"                              │
│  ├─ AND: record.publicationState === "published"                        │
│  └─ DISCARD drafts, pending, rejected, archived                         │
│         ↓                                                                │
│  [[FILTER 3]] Promotion (for Landing Page):                             │
│  ├─ Sort by: promoted DESC, then updatedAt DESC                         │
│  ├─ (Promoted items appear first)                                       │
│  └─ Use first N items on landing carousel                               │
│         ↓                                                                │
│  Display in Grid/Tile Format                                            │
│                                                                          │
│  User Clicks "Find out more..." → Open DetailModal                      │
│         ↓                                                                │
│  DetailModal Shows Full Details + Enroll/Assign CTA                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Grid & Tile Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LandingPage.module.css (SHARED STYLES)                                  │
│                                                                          │
│  .tile {                                                                │
│    display: flex;                                                       │
│    flex-direction: column;                                              │
│    background: var(--surface-card);                                     │
│    border-radius: 12px;                                                │
│    gap: 0;                                                              │
│  }                                                                       │
│                                                                          │
│  [Image Container] ─────────────────┐                                  │
│  ┌──────────────────────────────────┤ .cardImageWrap                   │
│  │ <img> (200px height, cover)      │ .cardImage                       │
│  └──────────────────────────────────┤                                  │
│  [Content Container] ───────────────┐                                  │
│  ┌──────────────────────────────────┤ .tileBody                        │
│  │ <h3> Title  (.tileTitle)         │                                  │
│  │ <p> Description  (.tileCopy)     │                                  │
│  │ <p> Meta/Details (.meta)         │                                  │
│  │ <button> CTA  (.tileButton)      │                                  │
│  └──────────────────────────────────┘                                  │
│                                                                          │
│  RESPONSIVE GRID:                                                       │
│  ├─ Desktop (>1200px): 4 columns                                        │
│  ├─ Tablet (768-1200px): 2 columns                                      │
│  └─ Mobile (<768px): 1 column                                           │
│                                                                          │
│  REUSED BY:                                                             │
│  ├─ ProgramsPage.tsx                                                    │
│  ├─ EventsPage.tsx                                                      │
│  ├─ ToolsPage.tsx                                                       │
│  └─ [Any carousel on landing]                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. DetailModal Component (Shared)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DetailModal.tsx                                 │
│                   src/modules/activities/components/                     │
│                                                                          │
│  INPUT: DetailItem {                                                    │
│    type: "program" | "event" | "tool"                                   │
│    title, image, description, details                                   │
│    deliveryType? (program)                                              │
│    duration? (program)                                                  │
│    eventDate?, eventTime?, location? (event)                            │
│    creditsRequired, cost                                                │
│  }                                                                       │
│                                                                          │
│  RENDERING LOGIC:                                                       │
│  ├─ Switch on item.type                                                 │
│  │  ├─ "program" → Show delivery type, duration, facilitator            │
│  │  ├─ "event" → Show date, time, location, cost                        │
│  │  └─ "tool" → Show assessment context, benefit                        │
│  │                                                                       │
│  ├─ Show enrollment CTA based on userType:                              │
│  │  ├─ If guest → "Sign in to enroll" button                            │
│  │  ├─ If loggedIn → "Enroll" or "Assign to user" button                │
│  │  └─ Calls backend to create assignment or enrollment record          │
│  │                                                                       │
│  └─ Show rich details section with formatted text                       │
│                                                                          │
│  USED BY:                                                               │
│  ├─ ProgramsPage (type="program")                                       │
│  ├─ EventsPage (type="event")                                           │
│  └─ ToolsPage (type="tool")                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Filter Component Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  STEP 1: Extract Unique Values                                          │
│  ─────────────────────────────────                                      │
│  const options = useMemo(() => {                                        │
│    return Array.from(                                                   │
│      new Set(items.map(item => item.fieldName))                         │
│    ).sort();                                                            │
│  }, [items]);                                                           │
│                                                                          │
│  STEP 2: Render Dropdown                                                │
│  ────────────────────────                                               │
│  <select value={selected} onChange={(e) => setSelected(e.target.value)}>
│    <option value="all">All {TypeName}s</option>                         │
│    {options.map(opt =>                                                  │
│      <option key={opt} value={opt}>{opt}</option>                       │
│    )}                                                                    │
│  </select>                                                              │
│                                                                          │
│  STEP 3: Filter Items                                                   │
│  ────────────────────                                                   │
│  const filtered = useMemo(() => {                                       │
│    if (selected === "all") return items;                                │
│    return items.filter(item =>                                          │
│      item.fieldName === selected                                        │
│    );                                                                    │
│  }, [items, selected]);                                                 │
│                                                                          │
│  STEP 4: Render Filtered Grid                                           │
│  ──────────────────────────────                                         │
│  <div className={styles.grid}>                                          │
│    {filtered.map(item => <Tile key={item.id} item={item} />)}           │
│  </div>                                                                  │
│                                                                          │
│  INSTANTIATIONS:                                                        │
│  ├─ ProgramsPage: Delivery Type                                         │
│  ├─ EventsPage: City Location                                           │
│  └─ [Any page with faceted browsing]                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Session Storage → Role-Based Routing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  sessionStorage Contains:                                               │
│  ├─ cs_uid = "abc123def456"                                             │
│  ├─ cs_profile_id = "prof_789"                                          │
│  ├─ cs_role = "professional" ← KEY FOR ROUTING                          │
│  ├─ cs_name = "John Smith"                                              │
│  ├─ cs_email = "john@example.com"                                       │
│  └─ cs_phone = "+919876543210"                                          │
│                                                                          │
│  App Checks Role:                                                       │
│  ├─ if (role === "individual") → Show Individual menu                   │
│  │  ├─ Dashboard                                                        │
│  │  ├─ Profile                                                          │
│  │  ├─ Wallet                                                           │
│  │  ├─ Referrals                                                        │
│  │  └─ NO "Manage Users" or "Manage Cohorts"                            │
│  │                                                                       │
│  ├─ else if (role === "professional") → Show Professional menu          │
│  │  ├─ Dashboard                                                        │
│  │  ├─ Profile                                                          │
│  │  ├─ Manage Users (can create Individuals)                            │
│  │  ├─ Manage Referrals                                                 │
│  │  ├─ Wallet (can request coins)                                       │
│  │  ├─ Manage Cohorts                                                   │
│  │  └─ Assign Activity                                                  │
│  │                                                                       │
│  ├─ else if (role === "company") → Show Company menu                    │
│  │  ├─ Dashboard                                                        │
│  │  ├─ Profile                                                          │
│  │  ├─ Manage Users (can create Prof + Individual)                      │
│  │  ├─ Manage Referrals                                                 │
│  │  ├─ Wallet (can view coin requests)                                  │
│  │  ├─ Manage Cohorts                                                   │
│  │  └─ Assign Activity                                                  │
│  │                                                                       │
│  └─ else if (role === "superadmin") → Show Admin Portal                 │
│     ├─ Dashboard (platform stats)                                       │
│     ├─ Manage Users (all users)                                         │
│     ├─ Manage Tenants (config per tenant)                               │
│     ├─ Programs (create/edit/delete)                                    │
│     ├─ Events (create/edit/delete)                                      │
│     ├─ Assessments (create/edit/delete)                                 │
│     ├─ Wallet (issue coins)                                             │
│     └─ Referrals (view all)                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**This document provides a visual reference for understanding how roles, associations, managing pages, and components fit together in StudioVerse.**
