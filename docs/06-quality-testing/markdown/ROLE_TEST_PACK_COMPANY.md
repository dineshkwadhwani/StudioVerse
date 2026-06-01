# StudioVerse — Company Test Pack

Primary actor: Company user

## Journeys In Scope

- `AUTH-01` Register As Company
- `PRO-01` Update Profile Details
- `PRO-02` Validate Completion Percentage And Eligibility
- `PRO-03` Upload Photograph
- `CRE-01` Company Creates Coach
- `CRE-02` Company Creates Individual
- `CRE-04` Company Creates Program And Event
- `SA-12` Company Coin Request Approval

## Regression Order

1. Registration and entry: `AUTH-01`
2. Profile readiness: `PRO-01`, `PRO-02`, `PRO-03`
3. User management: `CRE-01`, `CRE-02`
4. Resource creation: `CRE-04`
5. Wallet approval flow: `SA-12`

## Exit Criteria

- Company self-registration is valid and wallet-bearing.
- Profile readiness status behaves correctly.
- Company can create only the allowed scoped users.
- Publish and promote requests flow into admin approvals correctly.
- Company can approve Professional coin requests within its scope.
