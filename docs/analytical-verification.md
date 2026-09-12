# Analytical verification

The analytical lane is implemented and frozen for the final aggregate check. Contract details and model documentation are in [analytical-contract-v2.md](analytical-contract-v2.md).

## Automated checks

- `samby-backend/.venv/bin/python -m pytest tests/prototype -q`: **115 passed**. This includes real installed LightGBM and CatBoost fitting, chronological holdout leakage checks, changed-data predictions, deterministic repetition, inventory/financial arithmetic, immutable snapshots, roles, submission idempotency and unit compatibility. The platform lane separately reports **120 passed** for the complete backend suite including the integrated account compatibility tests.
- `npx tsc -b --pretty false` in samby-frontend: passed.
- `npx vitest run src/features/analysis/analysis.test.tsx`: **20 passed**.
- `npx eslint src/features/analysis src/lib/analysis.ts`: passed.

## Actual UI journeys

`node docs/evidence-analysis/browser-smoke.mjs` completed **20 recorded outcomes with zero page errors**, using a fresh isolated demo workspace registered with its private workspace credential. It entered and reviewed customer payment terms through ordinary UI intake before running the analytical cases. No live account or external transaction was created.

The script executes all eight focused questions and Explore, naïve forecasting, a pinned forecast dependency, full saved results, original/current snapshot reruns, persisted baseline comparisons, archive/restore, deep-link refresh, route changes and a 390px viewport. It additionally exercises a fixed-quantity reorder rule with safety-stock/service targets and discount, derived customer and supplier payment schedules with explicit no-advance acceptance, additional credit sales with a 25% unpaid share, and a selected outgoing-payment date change without inventory. A business workspace cannot retrieve a demo run.

The JSON outcomes are in [evidence-analysis/results.json](evidence-analysis/results.json). Screenshots include [policy/terms summary](evidence-analysis/policy-terms-summary.png), [full policy/terms result](evidence-analysis/policy-terms-result.png), [new credit result](evidence-analysis/new-credit-result.png), [comparison](evidence-analysis/critical-collection-comparison.png), and [mobile forecast](evidence-analysis/forecast-mobile.png).

`node docs/evidence-analysis/stockout-forecast.mjs` verifies exact saved zero-stock observations and flags remain visible after refresh. Its source sales quantities remain unchanged, with a dedicated backend snapshot regression proving numerical equality. [Evidence](evidence-analysis/stockout-observations.json) and [screenshot](evidence-analysis/stockout-observations.png).

The root lane separately verified both advanced engines through reviewed 90-row business CSV intake and real browser execution in `samby-frontend/e2e/advanced-forecast.spec.ts`.

## Explicit boundary

The optional 3D renderer remains deferred as permitted by §16.9/A27. Saved scene manifests, allowlisted asset metadata, full expanded 2D charts and dated results are available. No optimizer, inferred default probability, automatic contract agreement, calibrated uncertainty interval or historical-to-future duplicate payment is claimed.
