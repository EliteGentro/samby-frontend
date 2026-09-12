# Samby v0.4

Samby is a local application for distributors and resellers. It starts with an empty business workspace, accepts reviewed sales and business records, and connects inventory and financial facts to saved forecast and scenario runs. A separate demonstration workspace contains synthetic records.

## Run locally

Start the integrated backend in a terminal from the sibling backend repository.

```bash
cd ../samby-backend
python3 -m venv .venv
.venv/bin/pip install -r prototype-requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Start this frontend in another terminal.

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

Open http://127.0.0.1:4173. The default service URL is `http://127.0.0.1:8001/api/prototype`. Override it with `VITE_ANALYSIS_URL` when needed. Account forms default to the same service; an explicit `VITE_API_URL` can override their base. Copy `.env.example` if configuring either value. The backend README lists the native runtime dependency for LightGBM on macOS.

The analytical service accepts local frontend origins on ports 4173 and 5173. See the [backend runtime guide](https://github.com/EliteGentro/samby-backend/blob/main/README-prototype.md) for database location, recovery and API details. Use a single service instance for the local SQLite database.

## Workflows

- Home, Inventory, Dashboards, Forecast & Simulate, Finance, Add-ons & Data, and Settings share one business model.
- Sales CSV parsing is local. XLS/XLSX parsing uses the backend, with worksheet selection and a real preview. Mapping, units, amount meanings, pending rows and exclusions require review before records are applied.
- Manual intake supports stock and costs, suppliers and purchases, shared inventory pools, receivables, payables, financing payments, operating obligations, recurring commitments, cash, budget and period-specific coverage.
- Naïve, seasonal-naïve, LightGBM and CatBoost execute on captured inputs. Advanced engines require at least 56 consecutive observed daily quantities before the start, use demand lags and calendar features, and retain a separate chronological 14-day evaluation with baseline comparisons. No calibrated probability interval is claimed.
- All eight focused questions and exploratory scenarios use the asynchronous shared simulation service. Definitions can be edited; submitted runs retain their original inputs, assumptions, dependencies and artifacts.
- Run history, replay, pinned-baseline comparisons, cancellation, archived records and scene manifests use persisted server resources. Three-dimensional rendering is outside this prototype.
- Historical inventory observations, receipt layers, costed sales and service observations support turnover/DIO, GMROI, observed fill/in-stock measures, aging and excess. Missing observations remain unknown; explicitly accepted constant estimates are labeled.
- Standardization preserves identities and original import cells. An owner or administrator can review naming, SKU, supplier, price/cost, purchasing-unit and unit-conversion proposals. Unit conversions require an explicit factor and source, adjust related quantities and unit costs together, and retain an audit.
- Finance separates invoice balances, provider availability, payables and financing, with aging, concentration and dated collection/payment timelines. Incomplete identified records retain unknown amounts until reviewed completion. Historical collections, provider availability and supplier payments use actual dated observations and keep the payment stages separate. Contractual terms feed scenarios only with explicit linkage and assumptions.

## Persistence and boundaries

Current business records and preferences are saved in the backend SQLite database. A private device key protects a guest workspace. Signing up claims it for an account; signing in on a different browser retrieves the account's workspace. Settings can grant an existing account a scoped role without sending an invitation email. Analytical requests require the same workspace access.

The frontend serializes saves using server revisions. Concurrent edits produce an explicit conflict rather than an overwrite. Unsaved drafts remain on the device, with export and retry controls. Loading the saved version requires confirmation before discarding a draft. Unconfirmed intake drafts remain local to their browser session. Business and demonstration workspaces remain separate.

Definitions, captured analytical inputs, run status and completed artifacts live in SQLite. Browser navigation, refresh or disconnection does not own or cancel execution. On restart, the worker resumes nonterminal work with the same captured inputs. Completed results remain immutable.

The application does not execute banking, accounting, purchasing, physical warehouse or payment transactions. Recording a receipt or transfer changes saved stock records. Historical cash and debt balances require actual historical evidence; current balances are never relabeled as old balances. Advanced allocation, live integrations, calibrated uncertainty and the 3D renderer remain explicit exclusions in the source specification.

Back up the SQLite database using the backend's documented backup command. Older UUID-only analytical namespaces require the explicit local ownership migration command before an account can access them; public requests cannot claim old history merely by knowing its identifier.

## Verification

```bash
npm run build
npm run lint
npm test -- --run
npm run test:e2e -- --reporter=line
```

The Playwright suite exercises data review, Standardization, desktop/mobile workflows, real advanced forecasts, account recovery across browser contexts, team permissions and conflicting revisions. The backend suite checks numerical models, financial and inventory consequences, access isolation, immutable lifecycle, dependencies and restart recovery. Run both services before browser tests.

The current [verification record](docs/completion-verification.md), [completion audit](docs/completion-audit.md), contracts and browser evidence are in `docs/`. The [v0.4 product requirements](docs/product-requirements.md) define the implemented scope. Earlier working notes remain local implementation history.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/domain/` | Business records, scoped selectors, capability registry and optional notices |
| `src/features/data/` | Resumable intake, parsing, interpretation and confirmation |
| `src/features/business/` | Operational views, dashboards, Finance, catalog and Settings |
| `src/features/analysis/` | Definitions, asynchronous history, detailed results and comparisons |
| `src/lib/analysis.ts` | Analytical service client and resource contracts |
| `src/lib/workspace-api.ts` and `workspace-sync.ts` | Private workspace access, durable saves, conflicts and offline drafts |
| `src/components/` | Shared accessible UI and account dialogs |
| `src/styles.css` | Responsive layout, semantic colors and motion preferences |

Unknown quantities use null rather than zero. Source records and hypothetical scenario assumptions remain separate. Current display preferences do not remove inputs or alter historical analytical results.
