# Samby v0.4 integrated implementation verification

This pass implements the previously missing local frontend and backend workflows from the product requirements. The completion gate is usable input → reviewed meaning → persisted records → actual computation → reopenable output. The earlier count of 117 requirement identifiers was an index, not evidence that every capability existed.

## Implemented behavior

| Area | Current behavior | Main evidence |
| --- | --- | --- |
| Current records and accounts | Private guest workspace registration, durable revision-checked saves, account ownership and cross-browser access, scoped team roles, logout/revocation, reversible archive and export/backup | Platform tests; workspace-sync tests; desktop/mobile platform journeys |
| Save recovery | Serialized saves, local unsaved drafts, visible offline/conflict state, no silent overwrite, explicit saved-version reload | Workspace-sync tests; stale revision API/browser journey |
| Intake | Native CSV/XLS/XLSX parsing, worksheet selection, mapping, amount meanings, confirmation and retained source rows; manual financial, inventory, supplier and history inputs | Intake tests; native workbook and historical metrics journeys |
| Inventory and historical metrics | Actual historical cost observations/declared interval estimates, turnover/DIO/GMROI, receipt age/excess, requested-demand service measurements and dated consequences, supplier delivery/lead-time measures | Literal numerical tests; reviewed-input browser journeys |
| Financial records | Distinct receivable/provider/payable stages, nullable incomplete records, aging/concentration, separate expected timelines, dated historical collection/availability/payment observations | Finance numerical/component tests; incomplete-record and history browser journeys |
| Forecasting | Naïve, seasonal naïve, LightGBM and CatBoost execute on captured supplied observations; real chronological holdout metrics, model versions and dated evidence retained | Installed-model tests; advanced forecast browser journey |
| Simulations | Eight focused questions plus Explore, policy/purchase/terms/discount/credit/payment controls, 1–365 daily dates, actual inventory/cash/debt consequences, partial-scope notices | Engine arithmetic tests; all-question live browser harness |
| Analytical lifecycle | Immutable run inputs/results, asynchronous worker, idempotency, dependencies, pinned compatible baselines, cancellation/recovery, original/current reruns and history | Worker/store tests; live navigation/reload/rerun comparisons |
| Standardization | Explicit reviewed edits for names, identifiers, supplier/price/cost/unit fields; provenance-backed conversion factors update current linked quantities and costs atomically; historical runs remain unchanged | Domain tests; desktop/mobile approval and conversion journeys |
| Interface | Seven modules, separated demo, accessible dialogs, responsive tables, role-aware actions, visible saves and material limitations; lazy feature loading | Production build, lint, component tests, desktop/mobile and visual checks |

## Final verification

All checks below ran against the integrated local source on 2026-09-12.

| Check | Result |
| --- | --- |
| `npm run build` | Passed. Initial JavaScript: 316.18 kB, gzip 99.22 kB. Large feature views load separately. |
| `npm run lint` | Passed. |
| `npx vitest run` | 103 passed across 18 frontend test files. |
| `.venv/bin/python -m pytest -q` | 120 passed. Two upstream test-client deprecation warnings; no failures. |
| Complete desktop/mobile Playwright coverage | All 40 checks passed: 38 in the full sweep, then the remaining two passed after correcting a stale test selector to the actual “Review cash” button. The application did not change for that correction. |
| Live analytical browser harness | 20 successful outcomes and no page errors, including all eight focused questions, Explore, policy/terms/credit/payment controls, reload/history and comparisons. |
| Saved stockout metadata | Exact zero-stock dates, phases, locations and sources survive refresh; source sales and forecast quantities remain unchanged. |
| Manual UI inspection | Finance balances and debt panels inspected at normal width and 390px; responsive controls and contained tables remain readable. Temporary viewport override restored. |
| Repository whitespace checks | `git diff --check` passed in both repositories. |

The finance-role rerun also proves that reviewed cash intake saves without changing administrator notification preferences or the business profile. Account recovery, private namespace access, stale writes, nullable financial records and historical payment stages are exercised against real server responses. Model tests execute the installed libraries rather than substituting predictions.

The browser commands were `npx playwright test --workers=4 --reporter=line --output=test-results-final` and the targeted correction run `npx playwright test e2e/platform.spec.ts --grep 'finance member' --reporter=line --output=test-results-finance-role`. The analytical command and individual outcomes are retained in [analytical-verification.md](analytical-verification.md). [Desktop model evidence](evidence-completion/desktop-lightgbm-business-result.png) and [mobile model evidence](evidence-completion/mobile-catboost-business-result.png) come from the final browser sweep. [Structured outcomes](evidence-completion/checks.json) record the checks and source fingerprint.

## Explicit boundaries

The application runs locally against SQLite and a local worker. It is not deployed to a production host. Live banking/accounting connections, financial transaction execution, physical warehouse execution, advanced routing, a 3D renderer, LLM recommendations, calibrated uncertainty and model optimization remain exclusions in the supplied specification. Saved allowlisted scene manifests and the full 2D analytical result are implemented.

Packaging includes the model and spreadsheet dependencies; the Docker image declares the required Linux OpenMP library. A container build, production deployment, load test and independent accessibility certification were not performed. Recorded supplier history currently stores one receipt observation per order and explicitly does not reconstruct undocumented partial-receipt timelines.

Advanced forecasts use a documented fixed daily lag/calendar feature contract and require sufficient compatible observed history. They do not invent external drivers or promise forecast accuracy. Financial and historical metrics expose the supported supplied subset, missing coverage, period and working units. Current records cannot reconstruct earlier balances without appropriate historical evidence.

Guest access depends on retaining the device credential. Account access is tested across browser contexts. The local service retains data indefinitely until an authorized operator manages its database; archive is reversible. No password-recovery email provider or live integration is configured. Older unprotected analytical namespaces require the explicit local ownership migration command and an existing intended account, preserving historical run IDs.

## Design and implementation decisions

The existing ui-ux-pro-max design system was retained. New controls use visible labels, explicit confirmations for changing source meaning, accessible dialogs, touch-sized actions, contained table scrolling and reduced-motion support. Core balances precede secondary intake details.

The Model the Domain principle shaped explicit financial stages and unknown values. Separate Before Serializing Shared State shaped independent agent ownership and revision-checked writes. Prove It Works shaped real model execution, literal arithmetic tests and browser journeys. Experience First shaped progressive entry and a clearly separated demo. Contracts and decisions are preserved in [platform-contract.md](platform-contract.md), [analytical-contract-v2.md](analytical-contract-v2.md) and [decisions.tsv](decisions.tsv).
