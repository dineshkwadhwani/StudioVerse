# StudioVerse — Role Test Pack Index

Status: Role-based split of the manual journey guide for workbook and execution use.

## Source Of Truth

Master journey guide:

- `docs/06-quality-testing/markdown/SUPERADMIN_AND_LANDING_TEST_JOURNEYS.md`

Role responsibility matrix:

- `docs/05-deployment/ROLE_RESPONSIBILITY_MATRIX.md`

## Role Packs

- `docs/06-quality-testing/markdown/ROLE_TEST_PACK_SUPERADMIN.md`
- `docs/06-quality-testing/markdown/ROLE_TEST_PACK_PUBLIC_LANDING.md`
- `docs/06-quality-testing/markdown/ROLE_TEST_PACK_COMPANY.md`
- `docs/06-quality-testing/markdown/ROLE_TEST_PACK_PROFESSIONAL.md`
- `docs/06-quality-testing/markdown/ROLE_TEST_PACK_INDIVIDUAL.md`

## Workbook-Ready Role Sheets

These CSV files are intended to become separate Excel tabs.

- `docs/06-quality-testing/testdata/ROLE_SHEET_MASTER.csv`
- `docs/06-quality-testing/testdata/ROLE_SHEET_SUPERADMIN.csv`
- `docs/06-quality-testing/testdata/ROLE_SHEET_PUBLIC_LANDING.csv`
- `docs/06-quality-testing/testdata/ROLE_SHEET_COMPANY.csv`
- `docs/06-quality-testing/testdata/ROLE_SHEET_PROFESSIONAL.csv`
- `docs/06-quality-testing/testdata/ROLE_SHEET_INDIVIDUAL.csv`

## Suggested Excel Tab Names

- `Master Tracker`
- `SuperAdmin`
- `Public Landing`
- `Company`
- `Professional`
- `Individual`

## Recommended Workflow

1. Maintain the end-to-end journey logic in `SUPERADMIN_AND_LANDING_TEST_JOURNEYS.md`.
2. Use the role packs for manual execution by business or QA owners.
3. Import `ROLE_SHEET_MASTER.csv` as the summary tab.
4. Import each role CSV into one workbook tab.
5. Execution columns are already included: owner, run date, result, defect id, and remarks.
