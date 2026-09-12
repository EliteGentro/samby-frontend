# Onboarding implementation and verification

This change completes the guided intake behavior in section 11 of the Samby v0.4 requirements. Existing parsers, review validators, and confirmed workspace records remain the data boundary.

## Design

The selected design retains the existing session draft and data editors. Question guidance belongs to a typed registry. Capabilities that provide a descriptive result carry presentation metadata, while their existing predicates still determine eligibility.

Four design candidates considered a reducer, a new collection of dataset drafts, typed stage registries, and a smaller extension of the current draft. An independent review selected the smaller extension. It avoids a stored-data migration and keeps the existing intake tests relevant.

Model the Domain shaped the question and stage registry. Separate Before Serializing Shared State gave the implementation owner the app files and the coordinator the browser acceptance tests. Prove It Works and Test Behavior, Not Implementation require browser actions and persisted record assertions before completion.

## Requirement coverage

| Requirements | Behavior checked |
| --- | --- |
| ONB-01, ONB-02 | Minimal context, sales-first or inventory-first entry, and optional deferral. |
| ONB-04, ONB-12 | Source and actual scope accompany supported results, including older sales. |
| ONB-05, ONB-07 | Question changes preserve drafts. Settings resumes intake. Confirming a block keeps other drafts. |
| ONB-08, ONB-09 | Manual fields and import mapping explain meanings. A coverage summary precedes explicit confirmation. |
| ONB-06, ONB-10, ONB-11, ONB-13 | Empty templates add no records. Unknown values stay distinct from confirmed zero. References and event meanings are retained. |
| ONB-14, ONB-15 | Setup, supported analysis, and scenario comparison remain distinct. The chosen question directs continuation. |

ONB-03 remains retired. General unconfirmed drafts use browser-session storage. This change does not extend draft retention to another device or browser session. CSV processing stays local. Excel preview uses the existing backend.

## Verification

Baseline before implementation was 103 passing frontend tests, including 21 onboarding and import tests. A local Playwright session reproduced the missing-profile bypass through the inventory shortcut.

Final validation passed on September 12, 2026.

| Check | Result |
| --- | --- |
| `npm run build` | Production build passed. |
| `npm run lint` | ESLint passed. |
| `npm test -- --run` | 126 tests passed across 19 files. |
| `npx playwright test e2e/onboarding.spec.ts e2e/app.spec.ts e2e/data-complete.spec.ts --reporter=line --workers=4` | 36 desktop and mobile tests passed. |
| `git diff --check` | No whitespace errors. |

The browser suite covers real CSV and Excel review, confirmation, business and demo isolation, Settings resume, question persistence, older aggregate sales, and negative opening cash. Correcting a pending manual sale leaves exactly two sales with amounts 100 and 50; the original two source rows remain in the review history.

Independent review found and resolved an unconfirmed currency-edit bypass and result navigation that ignored muted preferences. Additional regressions cover missing review drafts, profile permissions, configuration-only milestones, and retained drafts across stock, pool, finance, and sales forms. The scoped comment audit found no added comments or suppressions.

Layout checks at 1365×900, 768×1024, 390×844, and 740×380 found no horizontal dialog overflow. Final screenshots are [desktop](evidence-onboarding/desktop.png) and [mobile](evidence-onboarding/mobile.png).

The implementation and browser checks used separate file ownership. No backend contract migration was needed. Subsequent full-project checks and cleanup are recorded in [React Doctor verification](react-doctor-verification.md). No product decisions remain open within this scope.
