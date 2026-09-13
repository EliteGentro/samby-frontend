# Samby v0.4

Samby is a local application for distributors and resellers. It starts with an empty business workspace, accepts reviewed sales and business records, and connects inventory and financial facts to saved forecast and scenario runs. A separate demonstration workspace contains synthetic records.

## Run locally

Requires Node 22 or newer and npm 10 or newer (verified on Node 22.13 and npm 11).

Start the backend first, from the sibling repository. It owns the database and every analytical run.

```bash
cd ../samby-backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log
```

On Windows the interpreter lives in `.venv\Scripts\` instead of `.venv/bin/`. The backend README lists the native runtime dependency for LightGBM on macOS.

Then start this frontend in a second terminal.

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173. The backend only accepts browser origins on ports 5173 and 4173, so keep the dev server on one of them; `npm run dev -- --port 4173` is the supported alternative.

The frontend reads its service URL from `VITE_BACKEND_URL`, falling back to `http://127.0.0.1:8001/api/prototype`. Copy `.env.example` to `.env` to override it. The older `VITE_API_URL` and `VITE_ANALYSIS_URL` names still resolve, in that order, for existing deployments.

Use a single backend instance: it owns the run queue and the worker that resumes unfinished work. See the [backend runtime guide](https://github.com/EliteGentro/samby-backend/blob/main/README-prototype.md) for database location, recovery and API details.

`npm run preview` serves the production build. `npm run demo:csv` regenerates `demo-csv/` from the demonstration workspace.

## External dependencies

Everything the browser loads is bundled or served from this repository. Fonts, brand assets and 3D models are local files; the application makes no third-party network request of its own.

### Runtime

| Package | Why it is here |
| --- | --- |
| `react`, `react-dom` | Application runtime |
| `radix-ui` | Accessible dialog, collapsible and primitive behavior |
| `lucide-react` | Icon set |
| `three` | Warehouse playback of saved run scene manifests |
| `react-markdown`, `remark-gfm` | Renders Samby Guide answers |
| `@fontsource/geist-mono` | Monospace face, bundled instead of fetched |
| `class-variance-authority`, `cn`, `tw-animate-css` | Variant, class-merging and animation helpers |

### Build and test

Vite 8 with `@vitejs/plugin-react`, TypeScript 6, Tailwind CSS 4 through `@tailwindcss/vite` with shadcn component scaffolding, Vitest with Testing Library and jsdom, Playwright for browser journeys, and ESLint with typescript-eslint.

### External services

| Service | Required | Notes |
| --- | --- | --- |
| Samby backend | Yes | Owns records, analytical runs and workbook parsing |
| OpenRouter | Only for Samby Guide | Reached by the backend; the frontend never holds the key |

The application performs no banking, accounting, purchasing or payment transaction.

## File structure

```
samby-frontend/
├─ src/
│  ├─ App.tsx                  Shell, routing, workspace state, intake dialogs
│  ├─ main.tsx                 Entry for index.html
│  ├─ styles.css               Layout, design tokens, light and dark themes
│  ├─ auth/                    Account session context
│  ├─ components/              Shared panels, modals, sortable tables, brand, dev panel
│  │  └─ ui/                   Primitives: button, card, progress, select, disclosure
│  ├─ domain/                  Records, scoped selectors, capability registry, notices
│  ├─ features/
│  │  ├─ analysis/             Definitions, asynchronous runs, results, comparisons
│  │  │  └─ warehouse/         Three.js playback of saved scene manifests
│  │  ├─ assistant/            Samby Guide dialog, markdown, first-visit orientation
│  │  ├─ business/             Home, Inventory, Dashboards, Finance, Add-ons, Settings
│  │  └─ data/                 Onboarding, resumable intake, CSV and workbook review
│  ├─ lib/                     Backend clients, durable sync, config, theme, helpers
│  └─ test/                    Vitest setup
├─ e2e/                        Playwright journeys
├─ docs/                       Product requirements, contracts, verification evidence
├─ demo-csv/                   Generated sample files for the demonstration workspace
├─ design-system/              Design references
├─ public/                     Brand assets, 3D models, import templates
├─ index.html                  Application entry
├─ warehouse.html              Separate 3D playback entry
└─ vite.config.ts              Build targets, path alias and Vitest configuration
```

Tests sit next to the code they cover as `*.test.ts` and `*.test.tsx`.

| Path | Responsibility |
| --- | --- |
| `src/domain/workspace.ts` | Workspace shape, capability registry, readiness and mute rules |
| `src/domain/capability-matrix.ts` | The 46 canonical capabilities and their minimum-input checks |
| `src/domain/selectors.ts` | Scoped reads that every view and dashboard shares |
| `src/features/data/` | Resumable intake, parsing, interpretation and confirmation |
| `src/features/business/` | Operational views, dashboards, Finance, catalog and Settings |
| `src/features/analysis/` | Definitions, asynchronous history, detailed results and comparisons |
| `src/lib/analysis.ts` | Analytical service client and resource contracts |
| `src/lib/workspace-api.ts`, `src/lib/workspace-sync.ts` | Private access, durable saves, conflicts and offline drafts |
| `src/lib/assistant-api.ts` | Samby Guide sessions, messages and speech |
| `src/components/workspace-ui.tsx` | Panels, metric cards and modals, including capability gating |
| `src/styles.css` | Responsive layout, semantic colors and motion preferences |

Unknown quantities use null rather than zero. Source records and hypothetical scenario assumptions remain separate. Current display preferences do not remove inputs or alter historical analytical results.

## Persistence and boundaries

Current business records and preferences are saved in the backend PostgreSQL database. A private device key protects a guest workspace. Signing up claims it for an account; signing in on a different browser retrieves the account's workspace. Settings can grant an existing account a scoped role without sending an invitation email. Analytical requests require the same workspace access.

The frontend serializes saves using server revisions. Concurrent edits produce an explicit conflict rather than an overwrite. Unsaved drafts remain on the device, with export and retry controls. Loading the saved version requires confirmation before discarding a draft. Unconfirmed intake drafts remain local to their browser session. Business and demonstration workspaces remain separate.

Definitions, captured analytical inputs, run status and completed artifacts live in the same database. Browser navigation, refresh or disconnection does not own or cancel execution. On restart, the worker resumes nonterminal work with the same captured inputs. Completed results remain immutable.

The application does not execute banking, accounting, purchasing, physical warehouse or payment transactions. Recording a receipt or transfer changes saved stock records. Historical cash and debt balances require actual historical evidence; current balances are never relabeled as old balances. Advanced allocation, live integrations, calibrated uncertainty and the 3D renderer remain explicit exclusions in the source specification.

Back up the database with Neon branches, point-in-time restore or a PostgreSQL-native dump, as the backend README describes. Older UUID-only analytical namespaces require the explicit local ownership migration command before an account can access them; public requests cannot claim old history merely by knowing its identifier.

## Verification

```bash
npm run build
npm run lint
npm test -- --run
npm run test:e2e -- --reporter=line
```

The Playwright suite exercises data review, Standardization, desktop/mobile workflows, real advanced forecasts, account recovery across browser contexts, team permissions and conflicting revisions. The backend suite checks numerical models, financial and inventory consequences, access isolation, immutable lifecycle, dependencies and restart recovery. Run both services before browser tests.

The current [verification record](docs/completion-verification.md), [completion audit](docs/completion-audit.md), contracts and browser evidence are in `docs/`. The [v0.4 product requirements](docs/product-requirements.md) define the implemented scope. Earlier working notes remain local implementation history.
