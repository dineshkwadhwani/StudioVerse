# Cohort Save Permission Error - Debugging Guide

## Issue Summary

Error: "Missing or Insufficient permission while saving a cohort"

Occurs when: Company user or Professional tries to save/edit a cohort with member changes.

---

## Root Cause Analysis

The `saveCohort()` function performs multiple Firestore operations:

1. **Create/Update Cohort** ✅
2. **Delete old cohortMembers** ← **LIKELY FAILING HERE**
3. **Create new cohortMembers** ← Or here
4. **Update users with associatedProfessionalId** ← Or here

### Problem: Backward Compatibility Gap

**Scenario**: Cohort has existing members from before May 16 changes.
- **Old cohortMembers** might not have:
  - `companyId` field
  - `professionalId` field  
  - `addedByUserId` field

**When saveCohort runs**:
- It tries to DELETE old members (line 503 in cohorts.service.ts)
- Delete rule checks: `resource.data.companyId == request.auth.uid`
- **Problem**: Old members don't have companyId field
- **Result**: Delete fails → "Missing permission" error

### Secondary Issues

The following also require permissions during save:

1. **Creating new cohortMembers**: Currently allows `isSignedIn()` ✅
   
2. **Updating users with professional association**:
   - Rule: `isCompanyUser() && resource.data.associatedCompanyId == request.auth.uid`
   - Issue: Might fail for users with existing (different) professional association
   - Fix needed: Allow company to SET professionalId on users they own

---

## Solution: Update Firestore Rules

### Fix 1: cohortMembers Delete (Backward Compatibility)

**File**: `firestore.rules` (line ~194)

**Current**:
```javascript
allow delete: if isSuperAdmin()
          || (isCompanyUser() && resource.data.companyId == request.auth.uid)
          || (isProfessionalUser() && resource.data.professionalId == request.auth.uid)
          || (isSignedIn() && resource.data.addedByUserId == request.auth.uid);
```

**Updated**:
```javascript
allow delete: if isSuperAdmin()
          || (isCompanyUser() && (
              resource.data.companyId == request.auth.uid
              || resource.data.get('companyId', null) == null  // Old data without companyId
            ))
          || (isProfessionalUser() && resource.data.professionalId == request.auth.uid)
          || (isSignedIn() && resource.data.addedByUserId == request.auth.uid);
```

**Why**: Allows deletion of old cohortMembers that lack companyId field (created before denormalization)

---

### Fix 2: Users Update (Professional Association)

**File**: `firestore.rules` (line ~62)

**Current**:
```javascript
allow update: if isSuperAdmin()
              || (isSignedIn() && request.auth.uid == userId)
              || (isSignedIn() && request.auth.uid == resource.data.uid)
              || (isCompanyUser() && resource.data.associatedCompanyId == request.auth.uid)
              || (isCompanyUser()
                  && resource.data.userType in ["professional", "individual"]
                  && resource.data.tenantId == currentTenantId()
                  && resource.data.get('associatedCompanyId', null) == null)
              || (isProfessionalUser() && resource.data.associatedProfessionalId == request.auth.uid)
              || (isProfessionalUser()
                  && resource.data.userType == "individual"
                  && resource.data.tenantId == currentTenantId()
                  && resource.data.get('associatedProfessionalId', null) == null);
```

**Updated**:
```javascript
allow update: if isSuperAdmin()
              || (isSignedIn() && request.auth.uid == userId)
              || (isSignedIn() && request.auth.uid == resource.data.uid)
              || (isCompanyUser() && resource.data.associatedCompanyId == request.auth.uid)
              || (isCompanyUser()
                  && resource.data.userType in ["professional", "individual"]
                  && resource.data.tenantId == currentTenantId()
                  && resource.data.get('associatedCompanyId', null) == null)
              || (isCompanyUser()
                  && resource.data.userType == "individual"
                  && resource.data.tenantId == currentTenantId()
                  && resource.data.associatedCompanyId == request.auth.uid)
              || (isProfessionalUser() && resource.data.associatedProfessionalId == request.auth.uid)
              || (isProfessionalUser()
                  && resource.data.userType == "individual"
                  && resource.data.tenantId == currentTenantId()
                  && resource.data.get('associatedProfessionalId', null) == null);
```

**Why**: Explicitly allows company to update `associatedProfessionalId` on users they own (even if reassigning from one professional to another)

---

## Testing the Fix

### Test Case 1: Edit Existing Cohort (with old members)

**Steps**:
1. Navigate to admin dashboard
2. Find existing cohort (created before May 16)
3. Click Edit
4. Change cohort name or professional
5. Click Save

**Expected**: ✅ Save succeeds (no permission error)

**Validation**: Check Firestore:
- Old cohortMembers deleted ✓
- New cohortMembers created ✓
- Cohort updated ✓

### Test Case 2: Create New Cohort

**Steps**:
1. Create new cohort
2. Add 3-4 individuals
3. Assign professional
4. Click Save

**Expected**: ✅ Save succeeds

### Test Case 3: Reassign Professional

**Steps**:
1. Edit existing cohort
2. Change assigned professional to different one
3. Click Save

**Expected**: ✅ User documents updated with new professionalId (no permission error)

---

## Deployment Instructions

### 1. Update firestore.rules

Edit `firestore.rules`:
- Line 194-201: Update cohortMembers delete rule (add backward compatibility)
- Line 62-79: Update users update rule (add professional reassignment support)

### 2. Deploy to Test

```bash
cd /Users/Dinesh.Wadhwani/Library/CloudStorage/OneDrive-NICELtd/Documents/Documents/Personal/TS/Git/StudioVerse

npx firebase deploy --only firestore:rules --project studioverse-test
```

Expected output: `✔ Deploy complete!`

### 3. Test in studioverse-test

- Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
- Reload app (Ctrl+R or Cmd+R)
- Run Test Cases 1-3 above

### 4. Deploy to Production

```bash
npx firebase deploy --only firestore:rules --project studioverse-18552
```

Expected output: `✔ Deploy complete!`

---

## Verification Checklist

- [ ] firestore.rules updated with both fixes
- [ ] TypeScript validation: `npx tsc --noEmit` passes
- [ ] Build validation: `npm run build` passes
- [ ] Deployed to studioverse-test: `firebase deploy --only firestore:rules --project studioverse-test`
- [ ] Browser cache cleared (test environment)
- [ ] Dev server restarted
- [ ] Test Case 1: Edit existing cohort (success)
- [ ] Test Case 2: Create new cohort (success)
- [ ] Test Case 3: Reassign professional (success)
- [ ] Deployed to studioverse-18552
- [ ] Permission error resolved in user workflow

---

## Rollback Plan

If the fix causes new issues:

```bash
# Revert rules from backup
git checkout firestore.rules

# Deploy reverted rules
npx firebase deploy --only firestore:rules --project studioverse-test
npx firebase deploy --only firestore:rules --project studioverse-18552
```

---

## Session Notes

**Date**: 16 May 2026  
**Issue**: Cohort save permission error persisting after May 16 fixes  
**Probable Cause**: Backward compatibility gap with old cohortMembers lacking denormalized fields  
**Status**: Solution identified; awaiting implementation and testing
