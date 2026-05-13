# StudioVerse White-Label Foundation

## Scope

This document defines implementation boundaries for tenant white-labeling while preserving StudioVerse as the parent platform.

## Platform vs Tenant Boundaries

### Platform-level (StudioVerse, never rebranded)

- Platform architecture and shared app-shell behavior.
- Core internal role identifiers (`superadmin`, `company`, `professional`, `individual`).
- Security model, trust boundaries, and backend governance.
- Shared product capabilities and domain model behavior.

### Tenant-level (white-labeled)

- Tenant display name and branding skin.
- Theme tokens (colors and logos), icons, and image assets.
- UI labels and domain vocabulary.
- Tenant-facing metadata (titles, descriptions) and legal routes.
- Tenant-facing messaging templates (email/notification content).

## Canonical Tenant Contract

The tenant contract is defined in [src/types/tenant.ts](../src/types/tenant.ts) and currently uses code-based configs under [src/tenants](../src/tenants).

Contract areas:

- Identity: `id`, `name`, `domain`
- Platform boundary: `platform.name`
- Branding: `branding`
- Metadata/legal: `pageMeta`, `legal`
- UI vocabulary: `roles`, `labels`
- Feature toggles: `features`
- Optional behavior/config blocks: `searchConfig`, `botConfig`, `mailConfig`, `mailTemplates`, `landingContent`

## Runtime Resolution Rules

- Tenant must resolve from one of:
  - `NEXT_PUBLIC_TENANT_ID`
  - `NEXT_PUBLIC_STUDIO_TYPE` mapping
  - current host/domain mapping
- Hardcoded tenant fallback behavior is intentionally removed from resolver/config bootstrap.
- Middleware tenant checks are dynamic from configured tenant registry.

## Config vs Database Decision Status

Current decision: tenant branding and labels remain code-config based (`src/tenants/*/config.ts`) for now.

No new Firestore collections were introduced as part of items 1 to 5.

If runtime tenant administration is needed later, we can migrate selected tenant config surfaces to Firestore collections after explicit approval.
