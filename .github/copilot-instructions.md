# StudioVerse Copilot Instructions


## Project identity

- This repository is for StudioVerse, a multi-tenant platform.
- StudioVerse is the umbrella platform name.
- Coaching Studio, Training Studio, and Recruitment Studio are tenant/product experiences built on the same shared platform.
- Use StudioVerse for platform-level references.
- Use Coaching Studio only when referring to the coaching tenant, coaching-facing content, or coaching-specific branding.
- Do not invent or use the name CoachingVerse.

## Architecture references

Use the project documents in the docs folder as source context before making structural decisions.

Primary references:
- Technical_stories_Master.md
- StudioVerse_Executive_Product_Document_v2.md
- StudioVerse_Technical_architecture_Master_part1.md
- StudioVerse_Technical_Architecture_Master_part2.md
- CoachingStudio_Database_Spec_MASTER.pdf

When implementing code, prefer these documents over assumptions.
If a requirement is unclear, preserve the current architecture and ask for clarification instead of inventing behavior.

Working epic references for implementation prompts:
- docs/T0.md
- docs/T1.md
- docs/T2.md
- docs/T3.md
- docs/T4.md
- docs/E0.md
- docs/E1.md

When an epic-specific markdown file exists, prefer it for implementation-level prompts.
Use the master architecture and product documents for broader platform context.

## Engineering principles

- Use Next.js App Router and TypeScript.
- Keep the code modular and organized by domain.
- Reuse shared components, utilities, constants, and services where possible.
- Do not place business logic directly inside UI components.
- Keep frontend, backend, and tenant-specific concerns clearly separated.
- Prefer small, maintainable files over large mixed-responsibility files.
- Follow the existing folder structure unless there is a strong documented reason to change it.

## Frontend rules

- Use the existing App Router structure under src/app.
- Keep page sections modular under feature or module folders.
- Keep UI components presentational where possible.
- Use centralized constants and utility helpers instead of duplicating values.
- Follow the documented frontend architecture and routing conventions from the technical architecture documents.
- Do not hardcode secrets, backend credentials, or privileged logic in the frontend.

## Backend rules

- Firebase is the backend foundation.
- Firestore is the primary database.
- Firebase Functions handle business logic.
- Firebase Auth handles authentication.
- Firebase Storage handles file and media storage where required.
- Do not move business rules into the frontend.
- Do not call external privileged services directly from the client when the architecture expects them to run through backend functions.
- Keep backend logic aligned with the documented service and function contracts.

## Tenant model

- This is a multi-tenant codebase.
- Tenant-specific folders and slugs such as coaching-studio may be valid and should not be renamed casually.
- Preserve tenant separation in content, assets, routing, and configuration.
- Do not collapse tenant-specific files into generic files unless the architecture clearly supports shared abstractions.
- When editing tenant code, keep shared platform logic separate from tenant branding and tenant content.

## Documentation behavior

- When generating code, align with the technical stories, technical architecture, executive product document, and database specification.
- Do not invent features that are not described in the project documents.
- If a requested feature is outside the current epic or document scope, say so clearly in comments or planning notes.
- Prefer implementation that matches the documented epics, stories, and architecture rather than generic boilerplate.

## Output style

- Prefer clear, production-friendly code over placeholder-heavy scaffolding.
- When asked to implement something, first suggest the files to create or update.
- Keep naming consistent with the existing project structure.
- Avoid unnecessary refactors outside the requested task.
- If a change may impact tenant routing, shared architecture, or Firebase integration, be conservative and highlight the risk.

## Response behavior

- Answer directly and concisely.
- Do not narrate your process with lines like "I’m pulling", "I’m reading", or "I have the substance".
- When asked for implementation help, first provide a short plan or file list, then generate code.
- When citing project files in chat, prefer concise references and avoid excessive line-by-line commentary unless requested.

Before making architecture, routing, folder structure, provider, naming, or implementation decisions, always consult the relevant Markdown files in `/docs`.

Priority order:
1. `docs/COPILOT_CONTEXT.md`
2. `docs/ARCHITECTURE_OVERVIEW.md`
3. `docs/StudioVerse_Technical_architecture_Master_part1.md`
4. `docs/StudioVerse_Technical_Architecture_Master_part2.md`
5. `docs/StudioVerse_Executive_Product_Document_v2.md`
6. `docs/Technical_stories_Master.md`

Implementation-specific context:
- Use `docs/T0.md` to `docs/T5.md` for technical epic implementation.
- Use `docs/E0.md` and `docs/E1.md` for functional epic implementation.

If a request affects architecture or implementation, briefly state which docs were consulted before proposing changes.
Do not guess when the answer is defined in `/docs`.