# StudioVerse — SuperAdmin Test Pack

Primary actor: SuperAdmin

## Journeys In Scope

- `SA-01` Create Tenant And Validate Settings
- `SA-02` Validate Activation Checklist Gate
- `SA-03` Ensure Treasury Wallet Exists
- `SA-04` Create Another SuperAdmin
- `SA-05` Create Company, Coach, And Individual From SuperAdmin
- `SA-06` Check Wallet Allocation And Treasury Debit Semantics
- `SA-07` Seed Reference Data
- `SA-08` Create Assessment And Verify Publish And Promote
- `SA-09` Create Program And Verify Publish And Promote
- `SA-10` Create Event And Verify Publish And Promote
- `SA-11` Approve Wallet, Bot, Cashout, Listing, And Promotion Requests
- `SA-12` Company Coin Request Approval

## Regression Order

1. Tenant bootstrap: `SA-01`, `SA-02`, `SA-03`
2. User and wallet governance: `SA-04`, `SA-05`, `SA-06`
3. Package and resource readiness: `SA-07`, `SA-08`, `SA-09`, `SA-10`
4. Approval operations: `SA-11`, `SA-12`

## Exit Criteria

- Tenant can be created, configured, and activated correctly.
- Treasury exists and opening balance is correct.
- Invitation and wallet behaviors match the creation path.
- Seeded packages are visible and reusable.
- SuperAdmin publish and promote actions surface content correctly.
- Approval queues update statuses and dependent balances correctly.
