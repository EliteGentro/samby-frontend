# Samby — Commercial and Financial Intelligence for SMBs

**Product Requirements and Workflow Precursor**

| Document metadata | Value |
|---|---|
| Version | 0.4 — consistency correction and consolidation |
| Status | Working product requirements and execution contracts; not evidence of implementation or validation |
| Audience | Product owner, designer, domain reviewer, data-science/engine owner, and implementation author |
| Product stage | Mock-first MVP with a narrow durable, asynchronous forecast/simulation execution boundary |
| Initial customer focus | Mexican distributors and commercial resellers of non-perishable products, frequent replenishment, and B2B credit sales |
| Retained domain boundary | Non-perishable retail, wholesale, and e-commerce |
| Source for this revision | Supplied Samby v0.3 consolidated text and its consistency review |
| Historical references named by v0.3 | `Pasted markdown.md` v0.1; `Info (2)(1).pdf`; `Samby_Onboarding_Spec_v0.2_propuesta.md`; product-owner corrections recorded in v0.3 |

This is a complete replacement for the supplied v0.3 draft. It contains **24 numbered sections**. The supplied draft omitted sections 23, 25, 26, and 27 despite claiming to contain 27 sections. This revision newly defines section 23 from the retained requirements and explicit consistency decisions; it does not claim to recover the omitted source text. References to absent sections have been removed or redirected. Historical source documents named above were not independently revalidated in this revision.

Existing requirement identifiers and acceptance-scenario identifiers are retained. ONB-03 remains retired. New acceptance examples verify corrected contracts without reusing prior identifiers.

Version 0.4 consolidates financial objects, separates analytical eligibility from presentation controls, corrects cash prerequisites and inclusive date limits, supports pending forecast references, specifies exploratory-mode behavior, aligns dashboard time controls, and clarifies the minimum arithmetic and traceability contracts needed before a calculation is presented as functional. It preserves the sales-first journey, explicit-event scenarios, user-led decisions, and detailed saved simulation results.

**Contents**

- [1. Purpose of this document](#1-purpose-of-this-document)
- [2. Product summary](#2-product-summary)
- [3. Product vision](#3-product-vision)
- [4. Product principles](#4-product-principles)
- [5. Scope and boundaries](#5-scope-and-boundaries)
- [6. Users, roles, and permissions](#6-users-roles-and-permissions)
- [7. Product information architecture](#7-product-information-architecture)
- [8. Conceptual module responsibilities](#8-conceptual-module-responsibilities)
- [9. Core business objects](#9-core-business-objects)
- [10. Data dependency and unlocking model](#10-data-dependency-and-unlocking-model)
- [11. Onboarding workflow — progressive, sales-first entry](#11-onboarding-workflow--progressive-sales-first-entry)
- [12. Core workflows](#12-core-workflows)
- [13. Shared-inventory locations](#13-shared-inventory-locations)
- [14. Dashboard requirements](#14-dashboard-requirements)
- [15. Forecasting requirements](#15-forecasting-requirements)
- [16. Shared simulation requirements](#16-shared-simulation-requirements)
- [17. Finance, late payments and debt](#17-finance-late-payments-and-debt)
- [18. SKU Standardization requirements](#18-sku-standardization-requirements)
- [19. Mock-first delivery and persistence boundary](#19-mock-first-delivery-and-persistence-boundary)
- [20. Functional requirements catalog](#20-functional-requirements-catalog)
- [21. Acceptance scenarios for the precursor prototype](#21-acceptance-scenarios-for-the-precursor-prototype)
- [22. Product language and experience rules](#22-product-language-and-experience-rules)
- [23. Metric, time and consistency definitions](#23-metric-time-and-consistency-definitions)
- [24. Remaining decisions and implementation handoff](#24-remaining-decisions-and-implementation-handoff)

## 1. Purpose of this document

Define the product's behavior, workflows, data dependencies, module responsibilities, and delivery boundaries before a detailed implementation specification is written. The immediate goal is an editable, regenerable prototype with honest empty states, clearly identified mock processes, and a usable path from limited business data to a supported result.

Forecast and simulation work have a deliberate exception to the general mock-first boundary: definitions, execution runs, input snapshots, status, history, and completed results are durable records. Long-running work must continue without an open browser page. An engine handler coordinates asynchronous execution and retrieval. Numerical execution may initially use clearly labeled demo fixtures; a run presented as computed from user data must actually use the configured engine and those inputs.

The document does not prescribe frameworks, database or queue vendors, infrastructure providers, or the internal numerical model beyond the observable contracts required here. It does not authorize a general production backend. Section 19 is the canonical mock/functional/persistence boundary; section 24 identifies remaining decisions and when each must be resolved.

If a later implementation specification conflicts with this document, resolve and record the product decision explicitly. Within this document, canonical definitions should be referenced rather than copied into independently maintained rules:

| Subject | Canonical section |
|---|---|
| Navigation | 7 |
| Module responsibilities and forecast/event paths | 8 |
| Business objects and identity | 9 |
| Eligibility, warnings, activation, and dependencies | 10 |
| Onboarding interaction | 11 |
| Dashboard behavior | 14 |
| Shared execution lifecycle | 16.7 |
| Question and scene contracts | 16.8–16.10 |
| SKU Standardization approval | 18 |
| Mock/functional scope and persistence | 19 |
| Stable requirement IDs and acceptance examples | 20–21 |
| Metric and time definitions | 23 |

## 2. Product summary

Samby helps SMBs connect what they sell with what they must purchase, deliver, collect, and pay. Sales are the main axis; operational and financial records explain whether those sales can be fulfilled and when they may become available cash.

The three principal experiences are:

1. **Sales and operational foundation:** sales and identifiable products first, progressively enriched with stock, locations, suppliers, purchasing, customers, delivery, invoices, and payments.
2. **Visibility and dashboards:** separate Inventory and Finance dashboard families, with current and historical information and explicitly attributed financial planning summaries under section 14.
3. **Forecasting and scenario simulation:** demand-forecasting engines and declared business events feed one shared simulation framework. Saved definitions and runs let the user leave long-running work and revisit exact prior results.

Finance connects decisions to cash timing without becoming accounting software. Add-ons & Data explains optional capabilities and their required information. SKU Standardization is an opt-in module with review and approval before any application step.

A first useful result can come from sales history or another supported dataset. When intake is deferred, the journey ends in an honest empty state without claiming an analysis. Inventory, a full catalog, a forecast, and an integrated simulation are not universal onboarding prerequisites.

The priority decision workflows are evaluating a new order, planning replenishment, and analyzing a critical collection. Additional focused questions are defined once in section 16.8. Forecast engines produce demand; the shared simulator calculates consequences; an explanation layer describes the recorded inputs and results. A live LLM is not an MVP prerequisite.

Use these financial labels consistently:

- **Internal Debt:** customer-originated money still owed or collected but pending availability, represented by linked records without double counting.
- **External Debt:** amounts owed to suppliers. Expected recurring commitments remain distinguishable from confirmed payables.
- **Financing Debt:** borrowed funds and scheduled repayments.

Their canonical objects and calculation rules are in sections 9 and 23. Do not use bare “Debt” for a financing-only metric or mix these categories into an undefined total.

## 3. Product vision

An SMB should be able to start with its existing data, obtain a useful result, and progressively connect commercial decisions with inventory, purchasing, margin, and cash.

The product should help the owner understand recorded sales, stock availability, inventory tied up in slow-moving products, supplier timing, collection dependencies, and the resources needed to fulfill a proposed order. It should allow the owner to test replenishment timing and quantity, seasonal demand changes, slower supply, delayed collections, and the ability to cover recorded payroll, supplier, rent, and other obligations.

Scenario outcomes reveal dependencies and tradeoffs under stated assumptions. They do not guarantee collection, product availability, profitability, access to credit, or agreement to changed payment terms. The user remains the decision-maker.

## 4. Product principles

### 4.1 Start small and become more useful with data

A usable sales dataset and minimal business context can support a first sales analysis. Other supported starts are valid. Initial journey completion, first supported analysis, and first scenario comparison are separate milestones; postponing all data reaches only journey completion.

### 4.2 Unlock useful capabilities without disabled clutter

Main modules prioritize usable, active capabilities. Add-ons & Data holds the complete optional-capability catalog. Contextual explanations of missing prerequisites are allowed when needed to answer a selected question; they should not create a second catalog of disabled features throughout the app. Saved run history remains reachable regardless of current data eligibility or presentation preferences.

### 4.3 Presence determines eligibility; quality informs interpretation

Usable minimum inputs are evaluated for the relevant product, location, period, and scope. Coverage, freshness, consistency, and history beyond those minimums produce warnings. Missing indispensable inputs and uninterpretable records are different from low-quality but usable data. Preserve valid subsets and explain unsupported outputs. A checkbox or activation switch is not evidence that data exists.

### 4.4 Match the amount of detail to the task

Dashboard executive views prioritize a small set of relevant indicators. A completed simulation is an analysis workspace with expanded primary charts, events, assumptions, limitations, metrics, comparisons, and explanations. Section 16.5 defines required result sections; supplementary detail may be optional.

### 4.5 Explain boundaries and uncertainty

Show source, scope, cutoff, dated inputs, assumptions, and material omissions. Distinguish recorded facts, estimates, scenario assumptions, and demonstration output. Scenario ranges are not validated probabilities. Disabling notifications must not remove material limitation or provenance labels from a displayed result.

### 4.6 Keep decisions with the owner

Compare user-selected scenarios and metrics neutrally. Do not choose or execute a replenishment policy, mark a universally best option, or imply that proposed commercial terms are agreed. Explanations and data-entry suggestions are permitted; live LLM integration and automated business recommendations remain deferred under section 24.

### 4.7 Protect module responsibilities

Demand forecast outputs, model comparisons, error/bias diagnostics, intervals, and actual-versus-forecast views belong exclusively to Forecast & Simulate. Dashboards may summarize scheduled financial events and a selected saved simulation's financial results under section 14. They do not run a second calculation or display demand-model output. Finance owns financial data management and liquidity planning access.

### 4.8 Ask for data in context

Explain each field's meaning, unit or period, purpose, and whether it can be supplied later. Request only the additional information needed for the selected question. Initial onboarding does not require engine selection, replenishment policies, advanced permissions, or accounting configuration.

### 4.9 Preserve meaning

Unknown, confirmed zero, and confirmed absence during a specified period are distinct. Sales, orders, invoices, collections, available cash, and purchasing budgets are distinct. Examples and placeholders never become saved business values by default. Canonical object and metric rules appear in sections 9 and 23.

## 5. Scope and boundaries

### 5.1 In scope

- Complete navigation and screen structure, progressive onboarding, field help, intake review, resumable setup, and supported first results.
- Manual-entry and CSV/Excel interfaces, with simulated parsing disclosed before reliance on output.
- A separate coherent development/demo dataset; normal business intake never substitutes sample records for missing values.
- Product/SKU and stock visibility, multiple locations, and a basic shared-inventory pool.
- Inventory and Finance dashboard families with the periods and metrics in section 14.
- Naïve, seasonal-naïve, and an advanced LightGBM/CatBoost forecast family, with honest eligibility, provenance, and comparison.
- One shared simulator with forecast-driven and explicit-event paths, focused questions, exploratory mode, conditional controls, and detailed dated results.
- Durable forecast/scenario definitions, asynchronous runs, immutable submitted inputs, status retrieval, input/result provenance, history, and completed artifacts under section 16.7.
- A predefined future scene-data contract for supported focused questions. The 3D renderer remains deferred.
- Finance views for liquidity, Internal Debt, External Debt, Financing Debt, late payments, and operating commitments using coherent mock or genuinely supplied inputs.
- A mock normalized payment-provider source, with no live transactions or direct frontend provider access.
- Optional recurring supplier commitments with supplier, period/cadence, expected obligation where known, fulfillment state, linked records, and integrity warnings. Fulfillment and payment are separate.
- Add-ons & Data, an opt-in Standardization approval workflow, one administrator, and a future permission scaffold.

The feature-specific scope above does not imply that every calculation or intake operation is already functional. Section 19 assigns the delivery and persistence boundary.

### 5.2 Out of scope

- A general production backend, final storage architecture, data lake, production data pipeline, or authentication architecture for all modules.
- Automated production model training, hyperparameter optimization, unvalidated probabilistic or Monte Carlo claims, and production-grade optimization.
- Production purchasing, fulfillment, transfers, cycle counts, invoicing, collection, or debt servicing.
- Live accounting, banking, POS, ERP, marketplace, carrier, e-commerce, supplier, or payment-provider integrations and synchronization.
- Bookkeeping, general-ledger behavior, tax or payroll calculation/filing/execution. Recording existing obligation amounts and schedules for planning is in scope.
- Automated purchase orders, transfers, pricing changes, negotiations, collection messages, borrowing, payments, or provider transaction creation/capture/refund/settlement.
- Live LLM integration or automated policy recommendations/actions.
- Perishable stock, expiry, lots, FEFO, spoilage, manufacturing bills of material, and material-requirements planning.
- Advanced reservation, allocation, channel protection, transfer optimization, or fulfillment routing.
- A production Three.js renderer, geometry, camera behavior, interaction model, and art direction.
- Final production security, compliance, scale, performance, availability, audit, and disaster-recovery requirements beyond preserving analytical records consistently.

### 5.3 Future compatibility

The structure may accommodate richer optimization, validated uncertainty, recommendations, integrations, automated actions, perishable/manufacturing behavior, and 3D presentation later. These are extension points rather than current commitments.

### 5.4 Revision boundary

This revision corrects and consolidates the supplied product contract. It does not make ordinary imports, inventory mutations, payments, identity, or integrations production-grade. A labeled fixture may demonstrate behavior; an executed user-data run must meet the actual calculation, lifecycle, and provenance contracts.

## 6. Users, roles, and permissions

### 6.1 MVP user

One Administrator can access every module, use available prototype interactions, and approve or reject Standardization proposals. Data eligibility is determined by actual usable inputs. Any developer control that simulates readiness belongs only to the separate demo environment and cannot change the business workspace's factual readiness.

### 6.2 Permission scaffold

Associate every module and major action with a future permission. A read-only role-management preview is permitted; the prototype must not imply that live multi-user administration or enforcement already exists. Possible future roles include owner, finance manager, inventory manager, buyer, and location manager.

## 7. Product information architecture

Primary navigation:

1. Home
2. Inventory
3. Dashboards
4. Forecast & Simulate
5. Finance
6. Add-ons & Data
7. Settings

Dashboard hierarchy:

| Family | Subsections |
|---|---|
| Inventory | Executive; Inventory; Service; Suppliers |
| Finance | Executive; Liquidity; Internal Debt; External Debt |

Finance is the module name. Liquidity is a capability and a Finance-dashboard subsection. Retain LIQ requirement IDs for traceability. Financing Debt is separately identified within relevant Finance views and does not become supplier External Debt.

Home adapts to the available data: sales summary, stock visibility, a supported order/receivable summary, or an empty state with an entry/import action. Sales-first onboarding does not require another primary navigation destination.

Forecast & Simulate includes separate forecast and simulation history views. Their routes and saved-run detail remain accessible when source data is removed, an analytical capability is muted or retired, or another run is processing. New-execution eligibility is evaluated separately.

SKU Standardization can be launched from Add-ons & Data, Inventory, or import review as a separate opt-in workflow. Dashboard period selection is retained between subsections where its temporal meaning is applicable, as defined in section 14.

## 8. Conceptual module responsibilities

These boundaries describe product responsibility, not a required technology architecture. The shared execution lifecycle is defined in §16.7, the mock/functional and persistence boundaries in §19, and metric and time conventions in §23.

| Module | Responsible for | Must not be responsible for |
|---|---|---|
| Sales and inventory foundation | Sales records, incomplete but identifiable product profiles, inventory state, locations, shared-pool visibility, suppliers, purchasing, movement and order context. | Forecast model logic, scenario calculations, or deciding financial policy. |
| Onboarding and data intake | Minimal business context, optional first question, progressive entry, import review, field explanations, first supported result, and resumable configuration. | Requiring all datasets, loading fictitious business values, or choosing policies or forecast models for the user. |
| Data readiness and unlocking | Detecting usable fields, coverage, history, freshness and supported scope; determining analytical eligibility and explaining limitations. | Altering source records, treating unknown values as zero, or treating a module toggle as evidence of data. |
| Dashboards | Summarizing current and historical inventory and financial signals; separate Inventory and Finance executive summaries; reporting-period controls, drill-downs and nearby coverage, freshness and integrity warnings. Any permitted summary of a cash projection identifies its source, as-of date and planning horizon under §§14 and 23. | Producing demand forecasts, presenting demand-model comparisons or diagnostics, mutating inventory, executing payments, or choosing business actions. |
| Forecast coordinator | Eligible engine selection; common scope, cutoff, cadence and horizon; comparable demand outputs; saved definitions, runs, history and warnings. | Running inventory events, mutating source records, or requiring a forecast for a purely declared-event analysis. |
| Naïve engine | A baseline demand forecast from the most recent comparable observation. | Unsupported seasonality, advanced drivers, or simulation calculations. |
| Seasonal-naïve engine | A baseline demand forecast from a comparable prior seasonal period. | Learning nonlinear effects or running the simulation. |
| LightGBM/CatBoost engine | Advanced demand forecasting using supported structured history and selected drivers. | Acting as the simulator or being automatically described as superior. |
| Run orchestrator / engine handler | Creating execution runs from saved definitions and immutable input snapshots; queueing work; tracking dependencies; persisting transitions, errors and artifacts; exposing status; handling retries and cancellation under §16.7. | Owning business definitions, fabricating progress, rewriting completed inputs/results, or treating frontend navigation as cancellation. |
| Shared simulation | Combining a completed eligible forecast and/or explicit orders and cash events with applicable operational and financial assumptions; producing time series, event traces, question-specific metrics and saved scenario results. | Training forecasts, inventing omitted inputs, changing source records, or executing the user's decision. |
| Finance data and Liquidity capability | Inventory-linked cash position, purchase-versus-budget comparisons, Internal Debt/customer receivables, External Debt/supplier payables, Financing Debt, late payments and recurring supplier commitments where provided. | Becoming an accounting ledger, initiating payment-provider/bank/supplier transactions, or choosing financial actions for the user. |
| Internal Debt connector boundary | A normalized server-side representation of customer amounts outstanding or collected but still pending availability; links and allocation information that prevent duplicate counting; shielding the frontend and analytical engine from provider-specific structures. | Creating live payment transactions, allowing direct frontend calls to the provider, or changing provider records through dashboard interactions. |
| Explanation layer | Explaining input relationships, disclosed assumptions and already-produced results. Any future LLM consumes engine outputs. | Owning numerical truth, manufacturing missing data, labeling unvalidated scenarios as probabilities, or replacing owner judgment. |
| Add-ons & Data | The capability catalog, readiness explanations, activation preferences, lifecycle notices, manageable alerts, dependency view and links to contextual data intake. | Mutating source data itself, forecasting, simulating, applying standardization, or overriding analytical prerequisites. |
| SKU Standardization | Identifying suspected duplicate or inconsistent identifiers, names, units, categories, packs, suppliers and costs; proposing reviewable corrections. | Silent changes or taking over canonical inventory workflows. |
| Access-control scaffold | Associating modules and actions with future permissions. | Pretending that the MVP implements live multi-user identity enforcement. |
| Future 3D visual layer | Presenting the same saved simulation results using the predefined scene-manifest contract and applicable asset allowlist. | Owning calculations, requesting free-form assets, changing result meaning, or becoming necessary to understand a result. |

A live LLM implementation is not required. The eventual explanation layer reflects the broader product direction; the MVP explanation and numerical result must remain usable without it.

### 8.1 Forecasting-to-simulation separation

The forecast-driven path is:

1. Select the data scope and save a forecast definition.
2. Create and execute a forecast run through the shared run lifecycle.
3. Save a scenario referencing that forecast run. Saving may occur while the forecast is still pending.
4. Create a simulation run. If the forecast has not succeeded, the simulation enters `waiting_for_dependency` and does not consume numerical forecast output yet.
5. After dependency success, run the shared simulation against its recorded input basis and persist the time series and event results.
6. Present the detailed results and explanation. A future 3D presentation reads those same results through the scene manifest.

The explicit-event path is:

1. Declare an order, delivery, purchase, collection or payment event.
2. Review its amounts, quantities, dates, scope and assumptions, then save the scenario.
3. Create and execute a simulation run using the inputs required by the requested result families.
4. Persist and present the time series, event results and explanation. A future 3D presentation reads those same persisted results.

All eligible forecast engines feed the same simulation. A new engine must not require redesigning the simulation screens or result contract. Declared business events are not a forecasting engine and must not be relabeled as predicted demand. Combined forecast and declared-order inputs follow the overlap/reconciliation rules in §16; the same demand must not be counted twice.

An explicit-event cash scenario does not require unrelated sales history or replenishment policies. Forecast-driven replenishment requires an eligible forecast that has succeeded before numerical use, starting stock and the relevant supply/policy inputs. Other accepted demand bases follow the declared-input rules in §§10 and 16. Missing inventory data prevents unsupported fulfillment claims; missing opening cash prevents absolute cash-balance and sufficiency claims. Each result family has its own prerequisites.

If a forecast dependency fails or is cancelled, the simulation exposes that dependency failure without fabricated results. Replacing the dependency and rerunning follows §16.7; it does not rewrite an existing completed run.

Demo/precomputed runs use the same visible state/result contract and are labeled as demo. An actually submitted user-data run must not be substituted with unrelated fixture output.

## 9. Core business objects

These are conceptual business records, not a prescribed database schema. Fields describe useful content for the relevant capabilities, not a universal mandatory onboarding form. A record may be retained with incomplete fields; each requested output must independently satisfy §10. Product profiles may begin incomplete and be enriched later. Durable analytical records and their snapshots follow §19.

| Object | Meaning | Minimum or progressively useful fields |
|---|---|---|
| Business | The SMB using the product. | Name and working currency at initial setup; business type, planning cadence, channels, cash/credit sales profile and locations optional initially. |
| Product / SKU | An identifiable sellable item. | SKU or confirmed internal reference and name; unit, category, cost, selling price and active status when relevant. |
| Location | A store, warehouse, fulfillment node or channel-facing stock point. | Reference, name, type, active status and shared-pool participation when known. |
| Inventory position | Current stock for a product at a known location or explicitly aggregated business scope. | Product, interpretable on-hand or available quantity, unit, as-of date and scope; reserved, on-order, in-transit and backordered values when supplied. |
| Inventory movement | Evidence explaining a stock movement. | Date, product, location/scope, type, quantity, unit and reason/reference. |
| Demand / sales record | Observed sales and requested/fulfilled demand where known. | Date/period and product reference; quantity plus unit for volume analysis and/or amount for monetary analysis; location/channel, requested/fulfilled quantity, return/cancellation and stockout indicators when supplied. |
| Aggregate sales record | Sales amounts without product-level detail. | Date/period, amount, currency, amount definition and declared coverage; no invented SKU or quantity. |
| Customer order / order line | A known or proposed commercial commitment. | Reference, customer if known, product, quantity/unit, expected delivery date, price/amount when known, status and collection assumptions. |
| Delivery / fulfillment record | Product fulfillment linked to orders. | Order/line reference, product, quantity, relevant location, promised/actual date and partial-delivery status. |
| Supplier | An inventory source. | Name/reference, active status and default payment terms when supplied. |
| Supplier-product relationship | Purchasing conditions for a product and supplier. | Supplier, product, unit cost, quoted lead time and its starting event; MOQ, case pack and advance-payment/dependency conditions when relevant. |
| Purchase order / receipt | Order and delivery evidence. | Supplier, product, ordered/received quantities, order date, promised date, actual receipt date, status and related payment/receipt references. |
| Customer | A buying account for order and payment context. | Name/reference; segment, payment terms and payment-cycle/cutoff information when supplied. |
| Customer receivable | The canonical customer obligation still outstanding to the business. It is one component of Internal Debt. | Stable reference, customer/reference, original amount, outstanding amount, currency, due date when applicable, expected collection date when known, status, source type/reference and last-updated time; related invoice/order/delivery, approval status and cutoff information when supplied. |
| Customer invoice | A source document that establishes or documents a customer receivable; it is not a second independent receivable. | Invoice reference, linked receivable reference, customer, invoiced amount/currency, issue/due dates where known, related order/delivery and approval/cutoff information when supplied. |
| Customer collection / advance | An actual or expected customer receipt, including partial payments. | Stable reference, related order/invoice/receivable, amount/currency, actual/expected date, status, allocated amount and whether already reflected in the cash snapshot; provider reference when relevant. |
| Provider-pending customer funds | Customer-originated funds collected through a provider but not yet available to the business. This is a second, linked component of Internal Debt, distinct from the remaining customer obligation. | Stable provider/source reference, related collection and receivable/invoice references where applicable, amount/currency pending availability, status, expected availability date when known, amount made available and last-updated time. |
| Supplier payable / External Debt | The canonical amount currently owed by the business to a supplier. | Stable reference, supplier, original and outstanding amounts, currency, due date, planned/actual payment date when applicable, paid amount/status and source/bill/order references; delivery/payment dependencies when relevant. |
| Supplier bill | A source document that establishes or documents a supplier payable; it is not an additional payable or cash outflow. | Bill reference, linked payable reference, supplier, amount/currency, due date and related purchase/delivery references where supplied. |
| Recurring supplier commitment / Periodic Order | An expected recurring order or supplier commitment used to identify future obligations and missing fulfillment. | Reference, supplier, cadence or covered period, period start/end or expected date, expected order/obligation amount when known, active status, fulfilled/not-fulfilled status when recorded and linked payable/order reference where available. An unrecorded fulfillment status remains unknown. |
| Operating obligation | A cash commitment outside inventory purchasing. | Category such as payroll, rent, tax or other expense; amount/currency, due/planned payment date or known schedule, outstanding status and scope. |
| Financing Debt obligation | Borrowed funds and scheduled repayments, separate from supplier External Debt. | Reference, lender/name, balance/currency, next payment date and amount; interest rate, maturity and known repayment schedule when available. “Debt obligation” is an alias for this object only where explicitly identified as Financing Debt. |
| Cash snapshot | Available cash at a stated point in time. | Amount, currency, reference date and business/account/location scope; not a sales total or purchasing budget. |
| Cash-flow event | A dated expected receipt or payment used for planning. | Source reference, direction, pending amount/currency, date, status and whether its date/amount is an explicit assumption; links needed to prevent duplicate inclusion. |
| Purchasing budget | A user-assigned purchase limit, separate from cash. | Amount, currency, period, scope and which commitments are included. |
| Cash reserve target | The owner's chosen minimum cash to preserve. | Amount, currency, scope and horizon; unknown until supplied by the user. |
| Inventory policy | User-defined replenishment assumptions. | Scope, service target, reorder point, safety stock, order quantity and review cadence when relevant. |
| Forecast definition | Saved configuration for generating a demand forecast. | ID, name, scope, cutoff, cadence, horizon, engine family, supported selected drivers/parameters, source-data references, created/updated timestamps and archive state. |
| Forecast run | One execution of a saved forecast definition with immutable execution inputs. | Run ID, forecast-definition ID/version or snapshot, engine/version, durable input snapshot or versioned reference set, cutoff, cadence, horizon, status, dependency state if any, submitted/started/completed timestamps, error information, warnings, output-series references and provenance. Status changes follow §16.7; completed inputs/results are immutable. |
| Scenario | Saved editable assumptions and input basis for simulation or comparison. | ID, name, question key or exploration mode defined in §16.8, scope, cutoff, start/end dates, horizon, time grain, optional `forecast_run_id`, declared-event basis, changed assumptions, constraints, optional completed `baseline_run_id`, coverage notices, created/updated timestamps and archive state. A referenced forecast may be pending; numerical consumption waits for success. |
| Simulation run | One execution of a scenario snapshot/version. | Run ID, scenario ID and immutable snapshot/version, durable input snapshot/reference set, referenced forecast-run ID where applicable, completed baseline-run ID when comparing, status, timestamps, engine/version, warnings, failure reason, result-series/event-trace/summary references, provenance and applicable scene-manifest reference. |
| Simulation time series | Dated values produced by a simulation run. | Run ID, date/time key, scope key, metric key, value, unit, scenario/baseline identity, provenance and optional lower/upper bounds only when supported. |
| Simulation event result | A dated modeled or declared event explaining a simulated state change. | Run ID, event date/type, source/reference, quantity/amount, unit/currency, affected SKU/location/customer/supplier where relevant and before/after-state references where useful. |
| 3D scene manifest | A future presentation contract derived from a completed simulation run. | Run ID, question/mode identity and applicable allowed asset IDs, entity instances, time range/grain, event references and metric-series references under §16.9; no independent calculation. |
| Data-quality observation | A limitation affecting an input or result. | Field, object/scope, coverage/history/freshness or integrity issue, analytical consequence and suggested improvement. |
| Import review / intake batch | The user's interpretation and confirmation of a dataset. | Source/file/sheet, row meaning, column mapping, formats, declared coverage, accepted/pending/excluded records and confirmation state. |
| Onboarding progress | Resumable configuration context. | Business context, optional first question, reviewed datasets, mappings, postponed blocks, warnings and supported milestones within §19's persistence boundary. |

The eventual operational planning grain remains SKU × location × day. Sales-first intake may begin with aggregate amounts or broader periods. Do not invent product, location or daily historical breakdowns. Daily simulation inputs and any explicit allocation assumptions follow §§16 and 23.

### 9.1 Meaning, identity and traceability rules

A proposed order is not a completed historical sale; a sale is not an invoice receipt; an invoice is not cash; and an advance is not an additional sale. Preserve links between order, product, stock, purchase, delivery, invoice, receivable/payable and collection/payment when available, including partial events.

Internal Debt is the presentation of customer amounts still outstanding plus linked customer-originated funds collected but pending provider availability. They are different stages or portions of the same payment flow, not duplicate claims. When a linked collection settles part of a receivable into provider-pending funds, that amount leaves the outstanding receivable component before it enters the pending component. When it becomes available cash, it leaves the pending component. Preserve source identities and partial allocations. A record with unresolved overlap may be shown with a warning, but it must not be included twice in an aggregate or cash projection. Do not claim a reconciled total until the supported non-overlapping subset is identified.

Customer invoices and supplier bills are source documents linked to canonical receivables and payables. Their document amounts must not create additional obligations merely because both document and obligation records exist. Recurring commitments link to the resulting order/payable when one is created; the same obligation must not be added again as a separate recurring cash outflow. Fulfillment is separate from payment.

A receivable without an expected date can be recorded, but it stays outside a daily cash curve until a usable date or accepted date assumption exists. A due date must not silently become a guaranteed collection date. Undated and beyond-horizon records remain visible as such.

Cash already received and included in the opening snapshot must not be added again as a future inflow. A purchase represented by a payable must not also produce a duplicate outgoing event. Unknown information stays unknown; confirmed absence applies only to the stated category, scope and period. Cash timing and metric conventions follow §23.

Editing a forecast definition or scenario does not mutate existing run inputs or completed results. A user rerun creates a new immutable input snapshot and run identity under §16.7. A comparison pins an eligible completed `baseline_run_id`; editing or rerunning the baseline scenario does not silently change the reference. Historical outputs remain interpretable and accessible from their saved snapshots even when current source data, capability visibility or product lifecycle changes.

## 10. Data dependency and unlocking model

### 10.1 Analytical readiness and independent presentation states

Readiness is evaluated for each capability, requested output family, product, location, period and source coverage. It is not a global percentage of business setup completed. Selecting a dataset in a checklist, activating a module or possessing one incomplete record does not supply the fields required for a calculation.

| Data state | Meaning |
|---|---|
| Not Provided | The requested output lacks minimum usable inputs. The catalog explains how to supply them. Relevant intake can still accept incomplete records, and contextual help can explain the limitation for the selected question. |
| Available with Warning | Minimum usable inputs exist for the stated scope, but coverage, history, freshness, consistency, material omissions or explicit assumptions limit the result. |
| Available | Minimum usable inputs exist and no material quality warning has been detected for that scope. This does not guarantee accuracy or completeness. |

Quality warnings do not block an otherwise computable result. Missing indispensable inputs and uninterpretable records are not merely warnings about usable data: preserve the valid subset and state which outputs cannot be produced. Removing indispensable data triggers readiness re-evaluation for new/current analyses. A stale-but-usable input produces a warning. States can improve or regress as the underlying inputs change.

Record unknown/add later, confirmed zero and confirmed absence/not applicable in a stated period as different states. Preserve the distinction between source records, accepted assumptions, model estimates and demo values. A record-list view may be usable before totals, timelines or derived metrics are eligible; §10.3 defines these distinctions.

Every capability has three independent dimensions:

| Dimension | Values and owner | Effect |
|---|---|---|
| Analytical readiness | Not Provided, Available with Warning, Available; derived from actual usable inputs and supported scope. | Governs eligibility for new/current calculations and output families. Users change it by supplying or correcting inputs, not by overriding a badge. |
| Activation preference | On or muted; user-controlled after unlocking, default On at first unlock. | Governs presentation of current capability cards, metrics and optional notifications. Does not remove data, cancel jobs or change calculation dependencies. |
| Product lifecycle | Active, deprecated or retired; product-owner-controlled. | Active capabilities support new use. Deprecated capabilities remain usable with a successor/sunset notice. Retired capabilities do not accept new executions or reactivation, but their existing records and saved results remain accessible. |

Effective visibility of current analytical controls depends on readiness, activation and lifecycle together. On an initial unlock, a supported active/deprecated capability appears with its warnings and no extra setup. A user's existing mute preference is preserved when inputs change; supplying data does not silently undo it. An unsupported control is omitted from ordinary module surfaces rather than displayed as disabled clutter. Contextual explanations of missing inputs remain permitted when necessary to answer the user's selected question.

Saved-run history, run status and historical result details are exceptions to current-capability visibility gating. They remain reachable from Forecast & Simulate history and saved-run links regardless of current data removal, session-only onboarding state, muting or capability retirement. Reopening a result uses its recorded snapshot and limitations; it does not falsely mark current inputs ready. Current capability preferences must not cancel already-created jobs or alter their required lifecycle handling.

### 10.2 Warning content and material result limitations

Every data warning states what is missing or questionable, the affected scope, a plain-language coverage/history/freshness or integrity measure, the result affected, how to improve the information, and whether the supported analysis can continue.

Example: delivery history exists for 6 of 12 active suppliers. Reliability is shown only for those six suppliers. Other suppliers need an identified lead-time assumption if included in a relevant scenario. The user may continue with the supported scope or add receipt dates.

For cash planning, list omitted categories explicitly. For imports, distinguish accepted, pending and excluded records and require confirmation of exclusions. Never discard or silently repair a row to make a readiness indicator green.

Material limitation labels attached to a displayed result are part of that result. Provenance, assumptions, coverage gaps and exclusions remain visible even when the user dismisses, snoozes, mutes or disables optional alerts. Notification preferences control reminders and alerts; they do not erase analytical limitations or change readiness. Historical results preserve the limitations associated with their saved input basis.

### 10.3 Dependency matrix for user-facing variables

This matrix is the canonical product-level minimum-input contract for this revision. The capability registry and dependency view mirror it. Production parsing contracts and warning-severity thresholds remain decisions in §24. Each row enables only its stated result and scope; recording an object is not proof that every result using that object is computable. Monetary outputs need an understood compatible currency/amount basis, and quantity outputs need compatible units. Metric definitions and temporal bases follow §23.

| Variable or capability | Primary objects | Required information / unlock rule | Limitation or warning |
|---|---|---|---|
| Aggregate monetary sales summary | Aggregate sales | Usable date/period, amount, currency and understood row meaning. | No product-level demand, unit replenishment, cash collection or margin claims. |
| Product sales summary | Sales, product reference | Date/period, identifiable product and quantity with comparable unit and/or amount. | Amount-only data supports monetary results; quantity-only data does not support monetary totals. |
| Sales evolution | Dated sales | Comparable periods with known cadence and coverage. | One observation is not a trend; absent rows are not automatically zero-sales days. |
| Current stock visibility | Product, inventory position, location/scope | At least one identifiable product, interpretable quantity, unit, scope and as-of date; disclose an accepted estimated date. | Stale stock, unknown physical distribution, negative stock, or available quantity exceeding on hand. |
| Inventory value | Product, inventory position | Quantity and compatible unit cost for the displayed subset. | Unknown costs do not become zero; disclose partial valuation. |
| Gross margin | Sales/order, product costs | Compatible sales amount and cost basis for the same products, quantity, period and amount definition. | No margin for uncovered products; gross margin is not net profit or cash. |
| Turnover and DIO | Sales, costs, inventory snapshots | Dated cost of goods sold and average inventory at cost for the same period/scope. | Sparse snapshots, short period, partial costs or undefined denominator. |
| GMROI | Sales, costs, inventory snapshots | Gross profit and average inventory at cost for the same scope/period. | Incomplete returns/discounts/costs or undefined denominator. |
| In-stock/fill measures | Demand, fulfillment, availability | Requested and fulfilled quantities or time-based availability, as required by the selected metric. | Stockouts censor sales; sales alone do not establish requested demand. |
| Aged/excess inventory | Movements, inventory, policy | Current stock plus receipt/age history for aging; excess also requires a target or demand basis. | Inferred age or unknown target is disclosed; aging and excess are different concepts. |
| Demand-growth scenario control | Demand basis, scenario | A dated demand basis and an explicit growth assumption. | Sparse history and stockouts; assumed growth is not a validated forecast. Downstream inventory/cash results require their own inputs. |
| Seasonality control | Demand, calendar, scenario | Dated demand and a meaningful selectable seasonal interval. | Short history or gaps; seasonal-naïve still requires a comparable prior observation. |
| Price/discount scenario | Product, sales/order, scenario | Current or explicit scenario price and scoped quantities/demand basis. | No automatic causal demand response without supported evidence or an explicit assumption. |
| Supplier lead-time scenario control | Supplier-product, purchase/receipt | Quoted lead time, usable dated order/receipt history or an explicit scoped lead-time assumption, including the starting event. | Timing assumptions do not establish reliability or agreed terms; consequential outputs require inventory/demand/events as applicable. |
| Supplier reliability | Supplier, purchase/receipt | Usable promised/actual dates and quantities for the selected delivery measure and supported supplier subset. | Few completed orders or partial coverage; no fabricated supplier scores. |
| Service target | Policy, product/location | Defined scope and user-selected target. | No historical comparison where service records are absent. |
| Reorder point | Policy, scope | Existing value or explicit scenario entry. | Missing demand/lead-time support is disclosed; label manual assumptions. |
| Safety stock | Policy, scope | Existing or explicitly entered stock quantity with compatible unit. | Missing forecast-error or lead-time variability limits interpretation. |
| Order quantity | Policy, supplier-product | Existing or proposed quantity and unit. | Conflicts with MOQ, pack, budget or capacity must be visible. |
| MOQ/case pack | Supplier-product | At least one usable scoped purchasing constraint. | Missing or conflicting supplier-specific constraints. |
| Payment terms | Supplier/customer | Terms and the event/date convention from which they are counted. | Missing counterparties' terms stay unknown; pending negotiation is not confirmed. |
| Purchasing-budget comparison | Purchasing budget, purchases | Budget amount/period/scope and proposed or committed purchase amounts. | Shows spend against budget, never absolute cash or liquidity sufficiency. |
| Customer-payment delay | Receivable/collection, scenario | Identifiable outstanding or pending collection with usable amount/date and specified delay or alternative date. | Expected dates are estimates; a standalone delay without a cash event has no computable cash impact. Absolute cash results also require opening cash. |
| Incoming late payments | Customer, receivable | Amount outstanding, due date and current status. | Expected collection date may be missing; still show overdue amount without inventing collection timing. |
| Outgoing late payments | Supplier/obligation, payable | Amount outstanding, due date and current status. | Do not invent a missing planned payment date. |
| Financing Debt outlook | Financing Debt obligation | Balance and known next-payment amount/date for the timed outlook. | An incomplete schedule supports only the known period; interest/maturity may remain unknown. |
| Naïve forecast | Demand history | At least one comparable prior observation for the selected scope/cadence. | Very short history and censored observations; not evidence of a trend. |
| Seasonal-naïve forecast | Demand history, calendar | A comparable prior seasonal observation at the selected lag. | Missing seasonal periods or changed promotions; no fabricated seasonal history. |
| LightGBM/CatBoost forecast | Demand, product, location, selected drivers | The documented prerequisites of the configured advanced engine and its required selected drivers for the supported scope. | Exact production thresholds remain open in §24. Until an engine's prerequisites are defined and satisfied, it cannot be presented as an eligible executed user-data model. A file's mere existence does not unlock it. |
| Forecast-driven inventory simulation | Forecast, inventory, policy | Eligible forecast run that succeeds before numerical consumption, starting stock, relevant policy controls, scope and horizon. A pending reference can be saved and awaited. | Missing costs, suppliers or finance restrict the corresponding result families. |
| Declared-order scenario | Order, stock, purchases, optional finance | Product/quantity, delivery timing and stock/supply facts or explicit assumptions needed for the requested fulfillment outputs. | No sales history required merely to test a declared order; no full feasibility claim without the corresponding operational/financial inputs. |
| Critical-collection cash scenario | Receivable/collection, cash, obligations | Opening cash with reference date, a dated collection event, disclosed timed commitments and a changed collection assumption. | No inventory forecast required; omitted obligations prevent business-wide sufficiency claims. |
| Daily 30-day liquidity projection | Cash snapshot, dated receipts/payments | Opening cash with date/scope, at least one future timed cash-flow event and explicit review of included and omitted categories. | Missing payroll, rent, taxes, financing or other obligations means a partial projection. A purchasing budget never substitutes for cash. |
| Cash-gap date and amount | Supported daily cash projection | A computable daily balance curve; identify any below-zero dates and deficit under §23. | Report included scope and missing obligations even when the recorded curve contains no gap. |
| Additional liquidity to preserve reserve | Cash projection, reserve target | Usable cash curve and owner-selected reserve for the same scope/horizon. | Without a reserve, show only supported zero-cash-gap measures; do not invent a target. |
| Integrated commercial/operational/financial scenario | Order/demand, stock, purchases, costs, finance | Minimum inputs for every requested result family, with explicit assumptions and traceability. | Partial results remain useful but do not certify global business viability. |
| Cash sufficiency for payroll, suppliers and rent | Cash snapshot, operating obligations, supplier payables, receivables/collections | Opening cash with reference date and dated/scheduled events for the selected horizon; review payroll, supplier, rent and other relevant categories as supplied, confirmed absent or omitted. At least one future timed event is required for the projection. | Sufficiency is conditional on included categories and dates; omitted categories keep the result partial. Modeled levers are not instructions or guaranteed financing. |
| Replenishment timing and quantity | Demand forecast or accepted demand basis, inventory, supplier-product, purchasing constraints | Starting stock, usable demand path, supplier lead time, existing/on-order supply and applicable MOQ/case-pack/order constraints for the selected SKU/location/horizon. | Scenario-dependent stockout/service/cash tradeoffs; no universally optimal policy label. |
| Vacation/low-season/high-season demand change | Demand basis, calendar, scenario | Completed forecast or dated baseline demand series plus explicit dated multiplier/override or supported seasonal assumption. | Not a validated causal forecast unless the model supports that claim. Inventory/purchase/cash outputs require their own inputs; show changed dates and the comparison baseline. |
| Slower-supplier scenario | Supplier-product, purchase/receipt, inventory, demand basis | Usable lead time or explicit assumption, starting inventory, dated demand basis and open/planned replenishment events. | A slower lead-time assumption does not establish supplier unreliability; expose dated stockout/backorder and receipt effects where supported. |
| Customer-debt accumulation scenario | Receivables, customers, collections, optional cash snapshot/obligations | Current receivables plus explicit assumptions for new credit sales, delayed collections, unpaid share or shifted dates. Absolute cash balance/floor/gap also requires opening cash and dated obligations/events; a receipt-timing or amount delta alone must be labeled as such. | No invented default probabilities or collection behavior; separate receivable growth, sales and cash. |
| Supplier-order change stockout scenario | Inventory, supplier-product, purchase order, demand basis | Starting stock, current/proposed supplier order quantity and receipt date, usable demand path and applicable lead-time/MOQ/case-pack constraints. | May show dated stockout/lost/backordered units under the assumption; no unrecorded emergency supply. |
| Dashboard period filtering | Any dated object contributing to a metric | The metric's own minimums plus dates appropriate to its temporal basis under §23. | Disclose undated/excluded coverage, records outside range, timezone/date inconsistencies, short comparison history and partial quarters. Historical reporting periods do not silently become future planning horizons. |
| Internal Debt records and outputs | Customer receivable, collection, provider-pending customer funds | One identifiable record enables record visibility. A monetary subtotal requires usable non-overlapping amount/status/currency; overdue totals require due dates; expected collection/availability timelines require corresponding usable dates. | Missing dates stay unscheduled; flag stale synchronization, duplicate provider references, inconsistent amount/status/currency and partial customer coverage. An incomplete record does not unlock unsupported totals or timelines. |
| External Debt records and outputs | Supplier payable, linked bill/order/receipt | One identifiable payable enables record visibility. Monetary subtotals require usable outstanding amount/status/currency; supplier breakdowns require supplier identity; overdue/timed outputs require appropriate due/expected/planned dates. | Missing supplier/dates, negative or inconsistent amounts, duplicate references, stale payment status and inactive suppliers are disclosed. Preserve the calculable subset; do not invent missing values. |
| Recurring supplier commitments | Recurring commitment, supplier, linked order/receipt/payable | One identifiable active commitment enables record visibility. Period-level expected/fulfilled views require cadence or covered period and relevant status; monetary obligations require a known amount/currency; cash timing requires a usable event date and non-duplicate payable/event link. | Flag missing cadence/supplier/status, duplicates or overlapping periods, inconsistent linked fulfillment, missing expected order/payable links, past periods without status and inactive suppliers. Fulfilled never means paid without separate payment evidence. |

A partial cash projection can identify a gap in the recorded scenario. A positive balance in that projection does not certify that all real obligations are covered. Undated events stay pending scheduling or use an accepted date assumption; obligations beyond the horizon remain visible without being inserted into the modeled window.

### 10.4 Add-ons / Data Expansion catalog

Add-ons & Data explains what a capability needs, what it enables, the supported scope and limitations, and the user's presentation preferences. It implements “Unlock; do not punish” and “Presence unlocks; quality informs” using §§10.1–10.3. It does not introduce a second source of truth.

#### 10.4.1 Responsibility and boundaries

Add-ons & Data:

- Describes every optional capability, including currently supported, unavailable, deprecated and retired capabilities.
- States minimum fields and their owning objects, supported scopes and output-specific limitations.
- Shows readiness, activation and lifecycle separately.
- Allows activation/muting of an unlocked active or deprecated capability.
- Surfaces unlock, coverage/quality, freshness and lifecycle notices as manageable alerts.
- Provides the dependency view and links to the appropriate entry/import or external standardization workflow.

The full unavailable-capability catalog stays here. Other modules may explain why the selected question or output needs more information and link to intake, without advertising unrelated disabled features. Add-ons itself does not mutate source data, forecast, simulate or apply standardization; those actions remain owned by their respective workflows.

#### 10.4.2 Add-on card

Every card states:

- The business question and benefit.
- Minimum fields, their owning objects and the particular outputs they unlock.
- Available normal-business entry methods, such as manual entry or file upload, with any simulated processing labeled.
- Coverage, history and freshness improvements that would make the supported analysis more informative.
- Readiness, activation and lifecycle; deprecated cards include a successor and sunset date, and retired cards explain the successor/history path.
- A direct intake link for missing data or a link to the consuming module for available outputs.

Sample data is not a way to fill missing business inputs. If a demonstration action is offered, it opens a clearly separate demo context under §19 and never inserts its records into the ordinary business workspace.

The Recurring Supplier Commitments card explains supplier/cadence inputs, optional configuration during onboarding or later, period-level fulfillment states, the distinction between fulfillment and payment, links to resulting orders/payables, and applicable integrity checks. Internal Debt Integration is represented as an optional data-source capability when no connected provider exists; manually supplied receivables do not require that future integration.

#### 10.4.3 Readiness and lifecycle behavior

Use the independent dimensions and effective-visibility rules in §10.1. Product lifecycle does not change whether source fields exist. Retirement prevents new use of the retired capability, not access to previously saved analytical records or results. An administrator's prototype/demo controls may demonstrate readiness by changing isolated fixture inputs, but must not override field-based readiness for user data or imply that a switch supplies missing fields.

#### 10.4.4 Capability activation switch

An unlocked active/deprecated capability has an On/Muted presentation switch, defaulting to On at first unlock. Muted capabilities hide their current cards/metrics and stop optional capability alerts. Data, analytical eligibility, saved results and created jobs are unaffected; the user may unmute while the capability remains supported by its lifecycle. A Not Provided capability offers an intake path, not an activation switch.

Before muting, show any additional current displays affected by an explicitly declared display dependency. Computational dependencies alone do not cause downstream displays to go quiet: muting supplier-reliability cards, for example, does not remove usable supplier data from a cash scenario. Only declared display dependencies can suppress dependent presentation, and the affected items must be listed before confirmation. Reactivation restores the eligible displays without changing source records or recomputing a saved run.

Historical-run access and material limitation labels on any result that remains visible are not suppressed by muting, as specified in §§10.1–10.2.

#### 10.4.5 Alerts and notifications

Capability alerts have a type and severity. Data warnings follow §10.2. Non-warning notices explain what changed, affected scope and any useful next step without inventing a data defect.

| Type | Trigger |
|---|---|
| Unlock | Newly usable inputs make an output available for a stated scope; non-disruptive acknowledgement under DAT-05. |
| Coverage / quality warning | Supported outputs have partial coverage, short history, stale data, integrity issues or disclosed assumptions. |
| Data-freshness nudge | Inputs behind an active capability have not been updated within the business's planning cadence. |
| Lifecycle notice | Deprecation or retirement changes new-use availability; show the successor/sunset or history-access path as applicable. |

Optional alerts can be dismissed or snoozed and respect a global on/off preference and severity floor. These are presentation settings only. They do not change readiness, erase material result limitations, or suppress required run status/failure visibility. Notification-preference persistence follows §19 unless separately expanded by an implementation decision.

#### 10.4.6 Dependency view and capability registry

The dependency view is the user-facing read of §10.3, generated from a declarative capability registry. It distinguishes required data/computation inputs, beneficial optional inputs, and presentation-only dependencies.

- **Requires:** the minimum usable fields and source objects for each output family. For example, a daily liquidity projection requires dated/scoped opening cash, at least one future timed cash-flow event and explicit review of included/omitted categories. A purchasing budget instead supports purchase-versus-budget comparison. Selecting a missing field opens its entry/import workflow.
- **Feeds or improves:** downstream outputs that consume or may benefit from the data. For example, usable receipt evidence supports supplier reliability; appropriate order/receipt dates can also inform a lead-time assumption. A reliability score is not itself a universal prerequisite for liquidity.
- **Display dependencies:** explicitly declared relationships that affect presentation when a capability is muted. These do not change data or analytical requirements.

| Registry field | Meaning |
|---|---|
| Capability key | Stable identifier used across modules, alerts and saved references. |
| Business question | Plain-language question the capability answers. |
| Output families and scope | Outputs the capability can produce and the product/location/period/source scope to which readiness applies. |
| Required fields and owning objects | Minimum usable input contract mirroring §10.3. |
| Unlock rule | Per-output eligibility condition; distinguishes record visibility from calculated totals, timed outputs and advanced analyses. |
| Warning conditions | Coverage/history/freshness/integrity or assumption checks affecting supported outputs. |
| Analytical dependencies / feeds | Required and beneficial upstream/downstream capability or data relationships, explicitly distinguished. |
| Display dependencies | Optional presentation relationships affected by muting; separate from analytical dependencies. |
| Lifecycle | Active, deprecated with successor and sunset date, or retired with successor/history information. |
| Default activation | On at first unlock; user mute preference remains an independent setting. |

Registry and preference storage technology is not prescribed, and general preference persistence follows §19. This does not weaken the durable storage or historical accessibility required for forecast/scenario definitions and analytical runs.

Consuming modules apply three connections: eligible unmuted outputs appear where relevant; their warnings travel with them; and contextual missing-data links lead to the appropriate intake workflow. The catalog retains the capability's descriptive card even when its analytical output appears in a consuming module.

The separate demo context may use sample provider data. A future live application may use a server-side provider integration behind the normalized Internal Debt interface; the MVP does not perform provider transactions.

#### 10.4.7 Catalog coverage

Example optional capabilities include supplier reliability, seasonal forecasting, advanced forecasting, service analysis, price/promotion scenarios, liquidity projection, customer-payment-delay scenarios, Financing Debt outlook, recurring supplier commitments, Internal Debt Integration and SKU Standardization. Onboarding may explain the next information needed for its selected question. The complete unavailable-capability catalog remains in Add-ons & Data rather than appearing as disabled clutter on Home or in every module.

## 11. Onboarding workflow — progressive, sales-first entry

### 11.1 Purpose

Help the owner obtain a useful result from available information and understand the additional context needed to connect sales with fulfillment, purchasing, margin, and cash. The journey has four moments: minimal context → incorporate data → review interpretation → supported result or honest deferral. Additional datasets and a first scenario comparison are optional continuations.

Proposed opening copy:

> Empieza con los datos que ya tienes. Analiza tus ventas y agrega información para entender qué necesitas para cumplirlas y cuándo podrías disponer del dinero.

These are product-design requirements, not evidence that an intake process is implemented or validated.

### 11.2 Step 1 — Understand the business and its first question

Ask for business name and working currency. Business type, channels, cash/credit/mixed sales terms, and multiple-location context are optional. Do not require branches, warehouses, suppliers, or customers to be configured before proceeding.

Offer an optional selector:

| Proposed copy | Purpose |
|---|---|
| Entender mis ventas. | Prioritize descriptive sales intake. |
| Evaluar un nuevo pedido. | Prepare Q-NEW-ORDER. |
| Planear la reposición de productos. | Prepare Q-REPLENISH. |
| Analizar un cobro crítico. | Prepare Q-CRITICAL-COLLECTION. |

The selection prioritizes intake and the next action. It does not unlock a capability, select an algorithm, change commercial terms, or lock the owner into a business model. It can be changed without restarting.

Do not ask for forecast-engine selection, safety-stock policies, service targets, advanced permissions, or complete accounting settings here. Explain the primary 30-day liquidity horizon only where useful to the selected question.

### 11.3 Step 2 — Incorporate available information

The primary path is **Importar ventas desde CSV/Excel**. The alternative is **Capturar ventas manualmente**, with an editable table using the same business meanings and validation rules. The owner may instead start with inventory, an order, or a receivable, or postpone data entry. A future order is recorded as an order or explicit scenario assumption, not a historical sale.

Normal intake offers no sample-business substitute. Examples and templates are help content; the separate demo environment follows section 19.

| Field | Meaning and purpose | Requiredness and handling |
|---|---|---|
| Sale date or period | Places the record in time | Required for time-based results. Confirm transaction/day/aggregate-period granularity. |
| Product or identifiable reference | Groups records for an item | Required for product-level results, not aggregate monetary summaries. No completed catalog required. |
| Quantity sold and unit | Supports unit demand/volume analysis | Required for unit-based results. Pieces, boxes, and packs need a confirmed conversion before aggregation. |
| Sale amount and definition | Supports monetary sales analysis | Optional for quantity-only entry. Explain discounts, returns, taxes, and currency where supplied. |
| Location or channel | Supports a known breakdown | Optional. Missing detail supports only the declared aggregate scope. |
| Order/invoice/delivery/collection references | Enables later event traceability | Optional initially. Preserve supplied identifiers and their meanings. |

A dated amount without products or quantities can support an aggregate monetary summary. A single usable record can be displayed, but does not establish trend or seasonality. Forecast eligibility is separate.

Where no SKU exists, propose an internal reference for confirmation. Do not automatically merge similar product names. Missing rows are not zero-sales days unless source coverage supports that interpretation. Returns, cancellations, and pending orders retain their meaning and are not silently converted to fulfilled demand.

Every entry field explains its meaning, unit/period, analytical purpose, and whether it can be added later. A tooltip must add information beyond repeating the label. Example values are not saved defaults.

| Field | Proposed explanatory copy |
|---|---|
| Available stock | Cantidad que puedes utilizar para nuevos pedidos. Confirma si tu registro ya descuenta las unidades reservadas. |
| Expected collection date | Cuándo esperas recibir el dinero. Puede ser diferente del vencimiento de la factura. |
| Supplier lead time | Tiempo que tarda el proveedor en entregar. Indica desde qué momento se cuenta: pedido, anticipo u otro evento. |
| Available cash | Dinero disponible a la fecha indicada. No incluyas ventas que todavía no has cobrado. |
| Purchasing budget | Límite que asignas a compras durante este período. No necesariamente es dinero disponible en caja. |

### 11.4 Step 3 — Review interpretation before applying data

Show source/file/sheet, row meaning, column mapping, date/number formats, covered period, and product/location/channel scope. Permit corrections before applying the batch.

Proposed review copy:

> Relacionamos la columna «Total» con «Importe de venta». Confirma si representa una venta por fila o el total de una factura repetido en varias líneas.

Identify usable, pending, and excluded records with the consequences of each ambiguity. Do not silently reinterpret dates, merge products, convert units, discard records, or repeatedly sum invoice totals repeated across lines.

| Review state | Meaning |
|---|---|
| Desconocido / agregar después | The value is not known yet. |
| Cero confirmado | The numeric value is actually zero. |
| No existe / no aplica en este período | The owner confirms absence of the category for the specified period and scope. |

An omitted financing schedule does not confirm absence of borrowing. Empty costs and unchecked operating categories remain unknown. Quality warnings do not block product entry. Uninterpretable rows must be corrected or left pending/excluded with explicit confirmation; usable subsets may proceed.

Cancelling review applies no unconfirmed changes. Preserve the original interpretation and confirmed result distinctly within the documented persistence scope. Optional Standardization proposals use section 18; skipping them does not block onboarding.

Label mocked parsing **Simulated import / Importación simulada** before reliance on output. A filename does not prove parsing occurred. Never attribute demo row counts, extracted products, or sales totals to an unprocessed user file.

### 11.5 Step 4 — Review capabilities and obtain the first result

Summarize incorporated information, usable capabilities, source, scope, and limitations. With sales only, Home may show recorded products, covered periods, quantities by comparable unit, amounts where supplied, and evolution across comparable periods. It must not infer stock, margin, cash, or supplier performance. Aggregate inputs produce aggregate results.

Use section 10's eligibility rules. Unsupported metrics are omitted, or explained as unavailable when needed to answer the selected question. Do not substitute zero. Show one useful next action tied to that question.

| Completion action | Behavior |
|---|---|
| Ver mi análisis | Enter the supported result and complete the initial journey. |
| Agregar más información | Voluntarily continue the relevant intake block. |
| Continuar por ahora | When data is deferred, enter an honest empty state with a clear entry/import action. |

Do not require every warning to be fixed or a simulation to be run. The no-data path records deferral/journey completion, not first analysis.

### 11.6 Progressive expansion

The following blocks are independent, resumable, and deferrable. Order them by the selected question.

**A. Inventory and costs — Can I fulfill what I sell?** Capture product, quantity, whether it is on hand or already available, update date, and known location or aggregate scope. Request reservations, transit, costs, and prices only when needed. Do not infer current stock from sales or subtract reservations twice. An aggregate quantity does not prove local or on-time availability. Adding location detail must not duplicate aggregate stock.

**B. Purchasing and suppliers — What must I purchase, and when will it arrive?** Capture supplier-product relationships, unit cost, delivery lead time, payment terms, and open purchases. Request MOQ/pack constraints when testing them. Distinguish payment and delivery lead times and their starting events. Capture payment-before-dispatch/delivery dependencies where relevant. Quoted terms support explicit assumptions; historical reliability requires delivery evidence. Terms under negotiation remain hypothetical.

**C. Customers and collections — When might the sale become cash?** Capture customer/reference, invoice/reference, outstanding amount, due date, and expected collection date when known. Preserve advances and partial collections as linked receipts, not additional sales. Ask for invoice approval, payment cycles/cutoffs, delivery dependencies, and customer history contextually. A due date is not guaranteed availability; any scheduling assumption must be accepted and labeled. Do not apply external average delays or individual default probabilities without evidence.

**D. Finance — Is cash available before collection?** Capture scoped, dated cash, expected receipts, and scheduled payments for suppliers, payroll, rent, taxes, Financing Debt, and other operating commitments. Each category is provided, explicitly absent for a stated period, or unknown. Capture purchasing budget separately. Ask for an owner-selected reserve only for reserve outputs. Links between orders, invoices, collections, provider-pending funds, and payables follow sections 9 and 23 to prevent duplicate cash movements.

### 11.7 Data readiness

Use section 10's capability states and per-output prerequisite matrix rather than another independent unlock table. The intake review explains the consequence of those rules in plain language:

- Sales summaries describe recorded sales, not collected cash or stock availability.
- Forecast eligibility is model-specific; missing history is not manufactured.
- Stock visibility requires interpretable stock and scope, not an inferred warehouse distribution.
- Margin and valuation cover only products with compatible costs.
- Purchasing-budget comparisons do not establish liquidity.
- A daily cash curve requires dated opening cash, future timed events, and category-coverage review. Partial coverage remains partial even when the curve stays positive.
- Integrated scenarios display only supported result families, with material omissions visible.

Declining quality generates warnings where a result remains computable. Removing indispensable inputs changes eligibility for new work; it does not erase or hide historical run artifacts.

### 11.8 First guided decision and continuation

When the relevant inputs exist, offer the selected priority question. Reuse confirmed records, scope, dates, assumptions, and warnings; ask only for missing prerequisites. An order connects quantities and delivery/collection with stock and required purchases. Replenishment connects demand, stock, and supply/policy assumptions. Critical collection connects a dated receivable with opening cash and known commitments for absolute cash results.

Section 8.1 defines forecast-driven and explicit-event paths. Scenario changes do not modify real prices, orders, invoices, or agreed terms. Section 16 defines execution and result behavior; explanations do not require a live LLM.

Resume relevant intake from Add-ons & Data or Settings without restarting completed blocks. Section 19 defines session continuity versus durable analytical history. Newly available capabilities are acknowledged non-disruptively and displayed subject to activation/lifecycle preferences under section 10.

### 11.9 Observable milestones

Track initial journey completed, first supported analysis available, and first scenario compared separately. Deferral without usable data reaches only the first milestone. The owner should understand what is usable now, its limits, and the next relevant input. No business-impact, onboarding-time, or conversion target is claimed as validated.

## 12. Core workflows

### 12.1 Day-one workflow

Follow section 11: minimal context → optional question → supported data intake or deferral → interpretation review and confirmation → supported result or empty state. Standardization and further context are optional. No inventory configuration, forecast, or scenario is mandatory for initial entry.

### 12.2 Inventory review

Open Inventory, filter by product/category/supplier/location/channel, and move between shared-pool summary and known location contributions. SKU detail shows supplied inventory position, product information, recent mock movements, purchasing context, and data limitations. Available, reserved, on-order, and backordered quantities retain their distinct meanings. Record adjustment, Receive stock, and Transfer stock remain labeled prototype actions under section 19.

### 12.3 Dashboard review

Choose a family and subsection from section 7. Apply section 14's historical reporting period, balance as-of date, and separate planning horizon where relevant. Inspect supported indicators, comparisons, trends, exceptions, and nearby warnings. Drill into relevant records. A forecast-analysis link opens Forecast & Simulate; it does not embed model outputs in Dashboards.

### 12.4 Forecast selection and execution

Choose SKU/group/location/shared-pool/portfolio scope, cutoff, cadence, engine, and horizon. Show exact forecast dates, eligibility, model explanation, supported validation evidence, and warnings. Save the definition, create a run under section 16.7, and permit navigation away. Reopen dated results and prior runs through history. A scenario may reference a pending forecast; numerical simulation waits until it succeeds and satisfies the cadence/horizon contract in section 16.

### 12.5 Focused simulation

Choose a supported question from section 16.8. “Planear la reposición” and “¿Cuándo debería ordenar y cuánto debería pedir?” are two labels for Q-REPLENISH, not separate features. Choose scope, dates, horizon, and forecast/event input basis. Reuse entered records, expose only supported controls, and review assumptions and missing output families.

Save the definition and submit a simulation run under section 16.7. Processing does not trap the user or hide prior runs. On success, open the expanded result defined in section 16.5. Compare completed runs using pinned baseline identities and compatible dates/metrics. Show adjustable levers and modeled consequences without choosing a policy or implying agreement to proposed terms.

### 12.6 Exploratory simulation

Choose Explore outcomes using the explicit exploratory contract in section 16.8. Select scope, dates, supported input basis, and controls. Save and run a baseline and alternatives independently. Organize supported inventory, service, operations, economics, and liquidity results in expanded sections. Compare compatible completed runs without marking a winner. The first exploratory implementation uses the full 2D/text result and the explicit scene-support behavior in section 16.9.

### 12.7 Finance and liquidity planning

Open Finance. Review cash, a separately labeled purchasing budget, inventory cash tied up, Internal Debt, External Debt, Financing Debt, operating obligations, and omissions as supplied. A current balance, a historical flow, and a future scheduled movement use the distinct time controls in section 14.

The primary liquidity planning horizon is 30 days; next-7/30/60/90-day views are available where inputs support them. Other supported simulation horizons remain available through Forecast & Simulate. A run's fixed dates and result values do not change when the owner changes a dashboard filter.

Open a financial item to inspect amount, date meaning, status, related party, linked source, and warning. Expected recurring commitments are distinct from confirmed payables; fulfilled orders are not necessarily paid. Launch a scenario from relevant records without duplicating them. A computed planning result comes from the shared simulator; mock views follow section 19 and remain labeled. No financial transaction or negotiation is executed.

### 12.8 SKU Standardization

Launch the opt-in workflow from import review, Inventory, or Add-ons & Data. Follow the canonical proposal, review, confirmation, and mock-application behavior in section 18. Skipping or rejecting proposals does not block unrelated supported work.

### 12.9 Progressive unlocking

Adding or mapping data re-evaluates eligibility for its actual scope. Add-ons & Data updates readiness, explains newly supported outputs, and provides a contextual next intake action. Presentation follows activation/lifecycle preferences. A warning travels with any displayed result; no toggle supplies missing facts or removes saved history.

## 13. Shared-inventory locations

The MVP supports multiple locations and channels with a simplified shared inventory pool. A product can be stocked at multiple known locations. Show shared availability and contributing quantities; permit location/channel filters and scenario scope where inputs exist. Mock transfers demonstrate movement without implying advanced allocation or routing.

Preserve SKU × location as the operational concept even when a pooled summary is shown. Advanced reservation, allocation priority, channel protection, transfer optimization, and fulfillment routing remain out of scope. State any assumptions about transfers or cross-location fulfillment; a pool total does not prove on-time delivery at a particular branch.

### 13.1 Progressive location setup

Sales intake does not require named locations. A stock record with unknown physical distribution may use explicitly aggregated business scope. Do not invent a warehouse or present that aggregate as available at every branch. When the known location breakdown is added, reconcile its source coverage with the aggregate and avoid counting the same stock twice. Known pool totals and contributions must remain consistent.

## 14. Dashboard requirements

### 14.1 Structure and shared behavior

Use the two families and eight subsections in section 7. Each executive view contains at most **10** supported leading indicators; around 8 is a presentation target when useful, not a minimum requiring filler. Indicators belong to their family. Detailed subsections may contain additional supported metrics.

Every metric shows its definition, scope, period/as-of date, unit or currency, source/provenance, and applicable warning. Where supported, show equivalent-period comparison, trend, and exception count/value. Relevant drill-down dimensions remain available. Missing data does not become zero, and undefined denominators do not produce a numeric rate.

Demand forecast outputs, error/bias, intervals, model diagnostics, and actual-versus-forecast charts belong to Forecast & Simulate. Finance dashboards may display a financial summary from an explicitly selected succeeded simulation run. Identify the run, scenario, exact dates, scope, and provenance; link to the full result. Read the persisted value rather than recalculating it. Clearly labeled demonstration projection summaries remain allowed under section 19. Neither type may masquerade as a current fact or silently switch to a different run.

### 14.2 Time controls and comparisons

Separate three temporal concepts:

| Concept | Behavior |
|---|---|
| Historical reporting period | Rolling: Last 7 Days, Last 30 Days, Last 12 Months. Calendar: Current Quarter, Previous Quarter, selected year/quarter, and Last 4 Quarters where supported. Drives historical flows and period-based metrics. |
| Balance as-of date | For a historical period, use its end date, capped at the current business date for an unfinished current period. Use supported snapshots or reconstructable state; disclose the effective source date and staleness. Never sum balances or use later records as if they were known earlier. |
| Forward planning window | Separate start/end dates and horizon. Default 30 days; quick views support next 7/30/60/90 days. Applies to scheduled future movements. A persisted projection summary instead uses its selected run's fixed dates and cannot be re-filtered into a newly calculated result. |

The configured business calendar/timezone governs date boundaries. Rolling historical windows include the business date as the current, potentially partial day; expose exact dates. A selected complete quarter uses its full calendar dates. A current incomplete quarter ends at the current business date for observed results and is labeled partial. Quarter aggregation never fabricates missing history.

Historical flow metrics include activity in the reporting window. Snapshot and average-based metrics follow section 23. Undated records remain visible in a pending/undated context and their exclusion from timed totals is disclosed.

For rolling periods, compare with the immediately preceding non-overlapping equivalent window. For selected quarters, the default comparison is the previous quarter. If current-period coverage is partial, show that limitation and compare aligned elapsed coverage when available, or label the unequal coverage explicitly. Last 4 Quarters comparisons require usable history and identify partial quarters. Exact date boundaries must be visible.

Retain applicable selections between subsections. A historical reporting selection must not silently redefine the independent future horizon. A future run does not become a historical result because the user selects a past quarter. Scheduled-event summaries and saved projection summaries show their own date basis beside the metric.

### 14.3 Inventory Executive

Choose supported leading indicators from:

- Average inventory value, inventory turnover, DIO, and GMROI.
- Unit fill rate or in-stock rate.
- Estimated lost margin from observed unmet demand or a separately disclosed supported estimate.
- Aged/excess/at-risk inventory value, with the applicable age or target definition.
- Supplier on-time/in-full performance and lead-time/variability.
- Material inventory or reconciliation exceptions.

Pair turnover with service, margin, accuracy, and supplier context. Do not include cash balances, customer receivables, supplier-payment balances, Financing Debt, or forecast diagnostics/values in this executive view.

### 14.4 Inventory

Show supported stock by SKU/location/pool; valuation; days of supply; slow-moving, aged, and excess stock; shortages; negative inventory; reconciliation exceptions; SKU/category GMROI-versus-DIO comparisons; recent movements; and count/adjustment signals. Definitions and warning rules follow sections 10 and 23. Dashboard days of supply uses a declared historical demand basis; model-demand outputs remain in Forecast & Simulate.

### 14.5 Service

Show supported in-stock rate, unit fill rate, line/order fill, stockout incidence/duration, backorder aging, estimated lost units/margin, and customer order timing. Requested and fulfilled/delivery records must support the relevant rate. Sales alone do not establish unconstrained requested demand. Label estimation methods and stockout censoring. Historical service events use the reporting period.

### 14.6 Suppliers

Show on-time delivery, in-full delivery, quoted-versus-observed lead time, variability, supplier coverage, open purchase-order aging, exceptions, and supported inventory/safety-stock exposure to supplier uncertainty. Exposure derived from a demand-model simulation belongs in that run's result; this dashboard uses recorded inputs or explicitly described historical measures.

When enabled, recurring commitments add fulfilled/not-fulfilled periods, missed expected periods, and supplier-period integrity exceptions. Unreviewed future or incomplete periods are not silently classified as missed. Fulfillment is separate from payment status.

### 14.7 Finance Executive

Choose supported indicators from:

- Available cash at its stated date and scope.
- Purchasing budget and budget headroom, separately labeled from cash.
- Inventory cash tied up.
- Internal Debt outstanding, overdue, and expected availability within the forward planning window.
- External Debt outstanding, due, and overdue.
- Upcoming recurring supplier commitments, distinguishing expected commitments from confirmed payables.
- Financing Debt payments within the forward planning window.
- Cash floor/headroom from a selected saved projection where supported.

Do not include fill rate, stockout rate, supplier delivery reliability, inventory turnover as an operational ratio, or forecast-engine output/diagnostics. Direct inventory-to-cash measures may appear where their financial meaning is explicit.

### 14.8 Liquidity

Show available cash; separately labeled purchasing budget; inventory value/cash tied up; expected receipts; overdue customer amounts; planned supplier payments; overdue supplier amounts; Financing Debt balance/scheduled payments; and a selected projection's cash floor/headroom when available. Include coverage, pending undated amounts, and material omitted categories. Use section 23 definitions and section 14.2 temporal rules.

### 14.9 Internal Debt

Show supported outstanding customer receivables, overdue amounts, provider-pending/not-yet-available amounts, expected collections/availability by period, aging, customer concentration, status distribution, and amounts collected or made available during the historical reporting period. These categories follow the linked identity model in section 9 and are not blindly added across stages.

Display stale or inconsistent source warnings. A future provider integration supplies normalized server-side records; the frontend never directly calls the provider or creates, captures, modifies, refunds, or settles transactions.

### 14.10 External Debt

Show confirmed supplier amounts outstanding, currently due, overdue, due during the relevant window, supplier concentration, planned payments, aging, recurring commitments by period, fulfillment state, and integrity exceptions. Expected commitments without a confirmed payable are separately labeled and reconciled when the payable is created. Financing Debt is not merged into External Debt.

## 15. Forecasting requirements

### 15.1 Shared expectations

Forecasting produces dated demand estimates. It does not execute inventory events, choose a replenishment policy or calculate the complete business scenario. Every comparable forecast uses the same selected scope, data cutoff, cadence and horizon. Its result states those values and the exact forecast dates.

Each execution is a saved forecast run. The shared run lifecycle, immutable submitted inputs, dependency behavior, provenance, history and persistence requirements are defined in §16.7. A saved scenario may reference a pending forecast run, but numerical simulation may consume its forecast output only after that run succeeds.

Every eligible engine produces a dated demand forecast and an uncertainty representation only when supported. Stockout periods are flagged because observed sales may understate unconstrained demand. Missing indispensable observations prevent use of that engine for the affected scope; coverage and quality warnings do not block otherwise supported results. Eligibility follows §10.3.

The interface explains each engine's intended use and limitations. Naïve and seasonal-naïve remain available for comparison when eligible, subject to section 10's activation and lifecycle rules. An advanced engine is not presumed more accurate. Actual-versus-forecast and backtest measures appear only when they were genuinely calculated with a documented evaluation method; demo comparisons remain labeled. Production evaluation must use unseen time periods rather than random historical mixing. Production model training, optimization and hierarchical reconciliation remain outside the MVP.

### 15.2 Engine-specific responsibilities

| Engine | Intended use | Minimum conceptual input | MVP behavior |
| --- | --- | --- | --- |
| Naïve | Simple benchmark for a comparable short-horizon demand series | Most recent usable comparable demand observation for the selected scope and cadence | Execute or transparently demonstrate a coherent baseline; persist dated outputs and provenance. |
| Seasonal naïve | Repeating patterns with a meaningful seasonal interval | A usable comparable prior seasonal observation at the selected lag | Execute or transparently demonstrate the seasonal baseline; show coverage warnings without inventing missing seasonal observations. |
| LightGBM/CatBoost | Related SKU-location series and nonlinear known drivers such as price, promotion, calendar, availability, product, location and supply features | The supported implementation's documented history structure and all drivers selected for the run | May execute through the asynchronous engine handler. A demo build may use labeled precomputed output, but may not attribute it to unprocessed user records. |

LightGBM and CatBoost may remain alternatives within one advanced-engine family until the implementation specification chooses one or both. Training and model-selection details remain implementation decisions. Neither engine owns inventory-event simulation.

### 15.3 Forecast submission and dependency behavior

Starting a forecast creates a persisted run and returns its identifier before long-running computation finishes, following §16.7. Optional phases include validating inputs, preparing features, forecasting, aggregating and persisting results. A percentage is displayed only when the engine measures defensible progress.

The user can leave the page, refresh, reopen a previous run or return in a later ordinary browser session without cancelling the job or losing its history. Status transport may use polling with backoff, server-sent events, websockets or an equivalent mechanism.

User retry or rerun creates a new run. An internal worker attempt may resume the same nonterminal run without changing its submitted inputs, as specified in §16.7. A network retry of the same submission retrieves the same run through idempotency handling.

### 15.4 Forecast history and results

Forecast & Simulate includes a history view with name/scope, engine, cutoff, cadence, horizon, status, submitted/completed timestamps and warning state. Editing a forecast definition never changes a previous run.

A completed result includes:

- Historical demand through a visible context window and forecast values across the selected horizon.
- Supported uncertainty bands or another clearly defined range representation.
- Actual-versus-forecast or backtest information when genuinely available.
- Engine/version, execution mode, input provenance, cutoff, scope, cadence and exact horizon dates.
- Model/data warnings and stockout-censoring notices.
- A dated output table suitable for export or downstream simulation.

The result may use multiple full-width charts. A small summary chart is not a substitute for the full result when the user is evaluating a run. Demand-forecast outputs and model diagnostics remain in Forecast & Simulate; Finance dashboards may summarize a selected saved simulation's financial results under §17.4, without displaying demand-model outputs.

## 16. Shared simulation requirements

### 16.1 Purpose

The shared simulation tests supported commercial, inventory, supplier, receivable and cash consequences through time. Its forecast-driven path applies dated demand to operational inputs; its explicit-event path evaluates declared orders, purchases, deliveries, collections and obligations without inventing a forecast. Both create saved runs with dated state transitions, event traces, metrics and explanations.

Every run answers a stated question or supports exploratory comparison over an explicit date range. Deterministic timelines and assumption-based ranges are valid. Optimistic/base/pessimistic cases and user-entered ranges are not calibrated probabilities. Probability claims require separately validated modeling.

### 16.2 Inputs and computational eligibility

Inputs depend on the question and requested result families. §10.3 defines capability prerequisites; §16.8 maps questions to those prerequisites. Supported inputs include:

- A selected forecast-run reference and supported uncertainty representation when the question uses a forecast.
- Declared orders, quantities, delivery dates, purchases, collections, payments and obligations for an event basis.
- Starting on-hand, available, reserved, on-order, backordered or transfer stock, with interpretable units, scope and reference time.
- Dated demand growth or seasonal/vacation adjustments; price and discount assumptions.
- Supplier lead time, supported reliability information, payment prerequisites and purchasing constraints.
- Service target, reorder point, safety stock, order quantity, MOQ and case pack.
- Customer/supplier payment terms, invoice approval status, payment cutoffs, advances and partial payments or receipts.
- Purchasing budget with its own period and scope, separately from opening cash, currency, reference time and cash scope.
- Payroll, rent, taxes, other operating payments and financing-debt payments, with omissions explicitly reviewed.
- An owner-selected reserve when reserve-preservation outputs are requested.
- Explicit changes to collection timing, unpaid balances, supplier-order quantities or receipt dates.
- Scenario scope, cutoff, start/end dates, time grain and comparison baseline.

Source records remain unchanged when assumptions are overridden. Scenario definitions may reference a pending forecast. The submitted run pins that forecast's identifier and waits for its successful output before numerical use.

Functional inventory simulation requires a usable daily demand path covering every required date of the selected horizon. A coarser forecast may be allocated to days only through an explicitly accepted, documented allocation method whose version and weights are recorded with the run. Allocation conserves the source forecast total for each complete forecast period. For partially included periods, the full allocation basis and selected daily portion remain traceable. These daily values are derived forecast assumptions, not reconstructed historical sales. Missing forecast dates are not silently extended, interpolated or treated as zero. If coverage cannot be supplied or explicitly modeled, the affected run is unsupported until corrected.

When a forecast and committed orders cover overlapping demand, the run must declare the overlap treatment before computation. Supported implementations may offer a dated residual-demand rule, an explicitly justified additive basis, or standalone declared-order treatment. The product does not prescribe one universal algorithm. The selected method, event links and assumptions must prevent accidental double counting and be versioned in the run. If the implementation cannot determine or obtain an accepted treatment, it blocks that combined calculation while retaining supported alternatives.

The starting cash and inventory state must represent the start of the first simulation day. A source snapshot with a different reference time needs a traceable bridge of relevant movements or an explicit user-accepted estimate of the starting state. Unresolved differences prevent the affected absolute-state results; they do not invalidate unrelated analyses. §23 defines time and metric conventions.

### 16.3 Time axis, horizon and dates

The first functional implementation uses one calendar day per operational step. Every run shows its start date, end date, business calendar/timezone and exact daily step count before execution. The window is inclusive:

`daily_steps = calendar_days_between(start_date, end_date) + 1`

Supported presets are 7, 30, 60, 90, 180 and 365 daily steps. Custom windows contain 1–365 steps; `end_date = start_date + daily_steps − 1 calendar days`. A 365-step window ends 364 days after its start. For example, 90 daily steps run from 2026-09-12 through 2026-12-10.

Produce one dated state point per simulated day, including days with no modeled event. This complete modeled time axis does not reclassify missing historical source observations as zero demand. Events before the start or after the horizon remain visible as material context, but are not silently applied inside the window.

The question registry supplies default horizons. Cash-sufficiency and critical-collection questions default to 30 days; replenishment and general inventory questions normally use 90. A seasonal interval may justify a longer supported horizon. Extending the maximum requires later performance and model-validity work.

The daily cash curve does not establish intraday funding sufficiency. Where same-day inventory event order affects results, the functional engine must use a declared, versioned convention for receipts, reservations, demand and other movements. Record and disclose that convention; do not imply observed intraday ordering when only dates exist.

### 16.4 Result families

Show each supported result family relevant to the selected question. Missing prerequisites suppress the affected numerical result and explain its limitation; they do not manufacture a value.

| Family | Supported results |
| --- | --- |
| Inventory | On-hand, available and inventory position by date; minimum/maximum/average inventory; days of supply; zero-stock dates/duration; unmet-demand and backorder/lost-unit trajectories where distinguished; aged/excess stock when age/target inputs exist. |
| Service | Unit fill rate and meaningful time-based service measures; stockout-related unfulfilled units; lost units; backorders and aging; attainment of a defined user-selected service target. |
| Economics | Sales and gross profit where compatible price/cost inputs exist; model-included inventory costs; estimated lost margin attributable to modeled unmet demand; markdown/write-off only when supported and consistent with the non-perishable scope. |
| Liquidity and balances | Purchasing spend; inventory value tied up where supported; dated receipts/payments and closing cash; first gap and cash floor; additional liquidity to preserve an owner-selected reserve; receivable/Internal Debt movement; supplier/External Debt and other known obligations; separate purchasing-budget breaches. |
| Operations and supply | Order frequency, dates and scenario quantities; receipt dates; modeled expedite events; MOQ/case-pack effects; supplier-delay exposure; the effect of lead-time or order changes on inventory and service. |

Metric units, denominators, state conventions and financial distinctions follow §23. Zero available stock and unmet demand are distinct measures. An explanation layer may explain persisted numerical results but may not generate those numbers independently.

Show baseline and alternative results for their stated inputs, dates and constraints. Explain the construction of any assumption-based range. Do not derive gap probabilities, calibrated confidence intervals or customer-default likelihood from unvalidated scenarios.

### 16.5 Detailed result page and charts

A completed simulation is an analysis workspace. Its default vertical sequence is:

1. Direct answer with applicable dates, scope and limits.
2. Run/scenario identity, engine/version, execution mode, forecast-run reference where used, timestamps and input cutoff.
3. Submitted inputs and changed assumptions, with baseline values beside alternatives where applicable.
4. Primary question-specific time-series charts.
5. Event timeline/table for material orders, receipts, shortages, collections, payments and other modeled events.
6. Detailed family metrics, dated extrema, deltas and explanation.
7. Coverage, omissions, warnings and limitations.
8. Comparison with a selected baseline or another completed run, when a comparison is requested.

A future visualization entry may appear when a renderer is implemented for the question. An absent renderer does not add an empty 3D section or expose a technical scene-contract control in the ordinary result flow.

Primary business sections and charts are expanded by default. Charts are readable full-width or one per row, rather than compressed into miniature cards. Only supplementary logs, raw tables or advanced diagnostics may be collapsed after the detailed business result is presented.

The chart library includes the following when supported:

- Demand/forecast/fulfilled demand by date.
- On-hand and available inventory, zero-stock line and receipt markers.
- Backorder and lost-unit trajectories, distinguished explicitly.
- Purchase quantities, order dates and receipt-event timelines.
- Daily cash balance with zero and, when supplied, reserve lines.
- Cash inflows/outflows by date and useful category.
- Receivable/Internal Debt and overdue/expected-collection movement.
- Supplier payable/External Debt movement.
- Baseline-versus-alternative deltas for selected metrics.
- Supplier lead-time and receipt-date shifts.

Every chart identifies units, date range, scenario/baseline, material event markers and data provenance. Include a plain-language interpretation and access to its dated values. Do not imply finer precision than the time grain. Primary outputs are never optional merely because supplementary detail can be collapsed.

### 16.6 Comparison behavior

Compare completed runs with compatible scope, cutoff/start date, horizon, time grain, currency/units and metric definitions. Keep the forecast/event basis constant unless changing it is the explicit comparison variable; expose that difference.

An executed comparison pins `baseline_run_id` to a completed immutable run. A scenario definition may select or change a baseline, but a submitted run's baseline reference does not drift when that definition is edited. Both baseline and alternative must have their own persisted outputs before numerical deltas appear.

Show assumption differences before outcome differences. Let the user choose the metric or outcome family; show absolute values and deltas where useful. Explain tradeoffs neutrally, for example: “Scenario B shows fewer days of unmet demand and higher cash use over the same 90 days.” Do not mark a winner, recommend a policy or claim an optimum. Charts, tables, summaries, event traces and scene manifests read the same persisted result.

### 16.7 Canonical shared forecast/simulation run contract

This subsection governs both forecast and simulation execution. Their definitions remain editable; each submitted execution has its own persistent identity and immutable submitted input selection.

**Submission and snapshots.** A create-run request validates the request, saves the definition version/input snapshot and persists a run before returning its identifier through asynchronous semantics. A computationally unsupported request returns an actionable validation response instead of fabricated results. A valid dependency-waiting request may create a run before the referenced forecast succeeds.

The submitted input snapshot records scope, cutoff, dates/cadence, engine/version, parameters, selected assumptions, warnings/coverage, declared processing mode, forecast dependency and completed baseline-run reference where applicable. It contains the business inputs or pins durable immutable source versions sufficient to preserve and explain the analysis. Session-only onboarding records and mutable source pointers are not sufficient references for a durable run. Required source versions must be materialized or otherwise preserved at submission.

A pending forecast is pinned by its exact run ID. After success, its immutable output is resolved and recorded as dependency provenance without changing the selected forecast or other submitted assumptions. A worker must never substitute the latest version of a source, definition, forecast or baseline silently.

**Lifecycle.** Submitted inputs are immutable, but run status, timestamps, phases, internal attempts and artifact references evolve until a terminal state:

| State | Meaning |
| --- | --- |
| `queued` | Accepted and waiting for compute capacity. |
| `waiting_for_dependency` | Waiting for a pinned forecast or another explicitly declared supported prerequisite. |
| `running` | The engine is processing the run. |
| `succeeded` | Final artifacts are complete, persisted and immutable. |
| `failed` | Execution or a required dependency failed; an understandable category/message is persisted. |
| `cancelled` | A supported cancellation was accepted before successful completion. |

Draft is a definition state, not a run state. The normal path is queued → running → succeeded, with waiting when necessary. A successful dependency makes a waiting run eligible for queueing/running. Failure or cancellation of an indispensable dependency moves its dependent run to failed with an actionable dependency error. Completed terminal runs are not reopened for computation.

Optional phases include validating inputs, loading inputs, preparing features, constructing the timeline, forecasting/simulating, aggregating, generating a supported scene manifest and persisting results. Show last update time and a backend-provided phase where available. Do not invent percentage progress or present partial internal artifacts as final results.

**Idempotency, attempts and retry.** Repeating the same submit request with the same idempotency key returns the same run. Reusing a key for different inputs must not overwrite it or create ambiguous work. A user's retry, rerun or edited-definition execution creates a new run with a new input snapshot and a link to the previous run where appropriate. The user can choose the earlier snapshot or review updated inputs; that choice is explicit. Internal infrastructure retries/resumptions may keep the same nonterminal run only when they preserve its submitted inputs, track their attempts and avoid duplicate finalization. Exhausted retries, worker exceptions or timeouts produce a persisted failure rather than an indefinitely running run.

**Client and engine responsibilities.** The client can start a run, retrieve status by ID, leave the page, refresh, reopen history, inspect another run and return later. Browser connectivity is not required for the job to continue. The engine persists state transitions, timestamps, dependency state, errors and final artifact references. Final result resources are available only after success. Cancellation may be offered for queued, waiting or running work where the engine supports safe cancellation; the server's accepted state resolves completion/cancellation races.

**Persistence and history.** Forecast definitions, scenarios, runs and their result artifacts survive ordinary browser refreshes and sessions. History includes queued, waiting, running, succeeded, failed and cancelled runs; a new run does not replace older entries. Users may archive/hide a definition or run from the primary list without mutating completed results or deleting source business records. Final retention, deletion, audit, identity and cross-device policies remain §24 decisions.

Demo/precomputed runs follow this same identity, persistence and truthful provenance contract. They must not masquerade as computation against unprocessed user data. A functional user-data run obtains its outputs and reported execution status from the actual configured engine path.

### 16.8 Question registry

Question keys are stable; localized labels may change. All focused questions use their relevant §10.3 input rules plus §16.2 computational eligibility. Optional economics, service and finance outputs require their own prerequisites. The following are the complete eight focused questions and one exploratory mode for this version.

#### Q-NEW-ORDER — Evaluar un nuevo pedido

- **Inputs:** §10.3 declared-order and integrated-scenario rules: identifiable products/quantities, requested delivery dates, stock/supply facts or accepted assumptions; compatible costs/prices for margin; opening cash and timed payments/collections for a cash curve.
- **Primary outputs:** Fulfillment dates/shortfalls, required purchases, supplier timing, supported margin, purchase-payment timing and collection timing.
- **Horizon/charts:** Default 90 days; may extend through the final related collection within 365 daily steps. Inventory, purchase/receipt timeline and cash balance when supported.
- **Allowed assets:** `customer_order`, `warehouse`, `sku_stack`, `supplier_node`, `delivery_truck`, `cash_account`, `calendar_marker`.

#### Q-REPLENISH — Planear la reposición de productos

“¿Cuándo debería ordenar y cuánto debería pedir?” is an alternate label for this same question, not a second capability.

- **Inputs:** §10.3 replenishment timing/quantity: starting stock, usable daily demand, supplier lead time, open/planned supply and applicable purchasing constraints; relevant explicit inventory-policy settings.
- **Primary outputs:** Modeled reorder dates, scenario quantities, projected stock, unmet-demand/service effects, supplier receipts, purchase spend and supported cash effect.
- **Horizon/charts:** Default 90 days. Demand versus supply, inventory with order/receipt markers, purchase quantities and supported cash balance.
- **Allowed assets:** `warehouse`, `sku_stack`, `supplier_node`, `purchase_order`, `delivery_truck`, `stockout_marker`, `calendar_marker`.

#### Q-CRITICAL-COLLECTION — Analizar un cobro crítico

- **Inputs:** §10.3 critical-collection cash scenario: dated opening cash, identifiable pending collection with usable amount/date, changed timing assumption and reviewed timed commitments/omissions. Inventory and a sales forecast are not required.
- **Primary outputs:** Cash with and without the collection change, first gap, affected obligations and remaining receivable.
- **Horizon/charts:** Default 30 days. Cash balance, inflows/outflows and receivable balance.
- **Allowed assets:** `customer_node`, `invoice`, `receivable_balance`, `cash_account`, `cash_inflow`, `cash_outflow`, `calendar_marker`.

#### Q-CASH-SUFFICIENCY — ¿Voy a tener suficiente dinero para pagar nómina/empleados, proveedores y renta?

The question may continue: “Si no, ¿qué variables puedo probar para evitar llegar al faltante?”

- **Inputs:** §10.3 cash sufficiency and daily cash projection: opening cash, at least one dated receipt/payment, and category-coverage review. Payroll, supplier, rent and other relevant categories are supplied, confirmed absent for the window, or explicitly omitted. Expected receipts are included when present; their confirmed absence does not block an otherwise supported outflow-only scenario. A reserve is optional and owner-selected.
- **Primary outputs:** Daily coverage of recorded obligations, first gap/amount, cash floor, obligations at/after the gap and effects of user-selected changes to purchases, collections, advances or supplier-payment timing. Proposed changes are assumptions subject to agreement, not recommendations.
- **Horizon/charts:** Default 30 days. Cash with zero/reserve lines, categorized inflows/outflows, payable/receivable timing and cash deltas.
- **Allowed assets:** `cash_account`, `payroll_group`, `supplier_payable`, `rent_location`, `cash_inflow`, `cash_outflow`, `calendar_marker`.

#### Q-DEMAND-CHANGE — ¿Qué pasaría si la demanda cambia por periodo vacacional, temporada alta o temporada baja?

- **Inputs:** §10.3 demand-change rule: completed forecast or accepted dated baseline demand, an explicit dated multiplier/override or supported seasonal assumption, and inventory/supply inputs for operational effects.
- **Primary outputs:** Dated demand change, inventory trajectory, unmet-demand/excess effects, service, purchasing requirements and supported cash/economic effects. An assumption is not a validated causal forecast.
- **Horizon/charts:** Default 90 days; may extend for the selected period within 365 daily steps. Baseline versus changed demand, inventory, backorder/lost-unit trajectory and deltas.
- **Allowed assets:** `customer_demand`, `calendar_season`, `warehouse`, `sku_stack`, `purchase_order`, `stockout_marker`, `calendar_marker`.

#### Q-SLOW-SUPPLIER — ¿Qué pasa si uno de mis proveedores entrega más lento?

- **Inputs:** §10.3 slower-supplier rule: usable lead time or an explicit assumption, starting inventory, dated demand and open/planned replenishment events.
- **Primary outputs:** Shifted receipts, unmet-demand/backorder exposure, service changes, affected products/orders and supported purchase/cash timing changes. An assumed delay is not a historical reliability score.
- **Horizon/charts:** Default 90 days. Receipt shifts, inventory, backorder/stockout measures and baseline deltas.
- **Allowed assets:** `supplier_node`, `delivery_truck`, `delay_marker`, `warehouse`, `sku_stack`, `stockout_marker`, `calendar_marker`.

#### Q-CUSTOMER-DEBT — ¿Qué pasa si mis clientes empiezan a acumular deuda o a pagar más tarde?

- **Inputs:** §10.3 customer-debt accumulation: current receivables and explicit new-credit-sale, unpaid-share or collection-delay assumptions. Absolute cash balance/floor/gap outputs additionally require opening cash, timed collections/payments and coverage review. A supported receipt-timing or amount delta may be shown without opening cash when explicitly labeled as a flow delta rather than an absolute cash result.
- **Primary outputs:** Receivable/Internal Debt trajectory, supported overdue balances, delayed inflows, supported floor/gap effects and customer concentration. Do not infer default probabilities.
- **Horizon/charts:** Default 30 days for cash impact; 60/90-day alternatives when assumptions extend further. Receivables, expected versus delayed collections, supported cash and customer concentration.
- **Allowed assets:** `customer_node`, `invoice`, `receivable_balance`, `cash_account`, `cash_inflow`, `calendar_marker`.

#### Q-SUPPLIER-ORDER-STOCKOUT — ¿Me quedaré sin stock si cambio la cantidad o la fecha de mi pedido al proveedor?

- **Inputs:** §10.3 supplier-order-change rule: starting stock, usable daily demand, current/proposed supplier quantity and receipt date, and applicable lead-time/MOQ/case-pack constraints.
- **Primary outputs:** Zero-stock dates and duration, unmet/lost/backordered units, minimum inventory, receipt changes, service and supported purchasing cash effects. Do not assume unrecorded emergency supply.
- **Horizon/charts:** Default 90 days. Inventory, current versus changed order/receipt timeline, demand versus supply and backorder/lost-unit trajectory.
- **Allowed assets:** `supplier_node`, `purchase_order`, `delivery_truck`, `warehouse`, `sku_stack`, `stockout_marker`, `calendar_marker`.

#### Q-EXPLORE — Explorar resultados / Explore outcomes

- **Inputs:** The §10.3 minimums for each selected result family, with explicit scope, dates and accepted forecast/event basis. An initial baseline can run without a comparison reference. Alternatives can then pin that succeeded baseline_run_id and the user-selected changes.
- **Outputs:** All selected supported families in readable expanded sections, with dated series/events and comparisons between completed runs. Unsupported families remain unavailable with an explanation.
- **Horizon:** Default 90 days for inventory-led exploration or 30 for cash-only exploration; any supported window may be selected.
- **Scene contract:** `scene_manifest_supported = false`, `allowed_asset_ids = []` in this version. The scene resource reports that status for exploratory runs and does not infer a union of focused-question assets.

Price/discount, service target, reorder point, safety stock, demand growth and other eligible controls may appear within an appropriate question or exploration. They do not create additional top-level question keys automatically.

### 16.9 Future 3D scene contract

The 3D renderer is deferred. Standard 2D/text results remain authoritative, complete and accessible without it. Successful focused-question runs provide a scene-manifest resource from their persisted results; exploratory runs return the explicit unsupported status in §16.8. This manifest requirement does not require geometry, a Three.js implementation, camera behavior, final art direction or animations in the MVP.

The stable asset vocabulary is: `warehouse`, `sku_stack`, `supplier_node`, `delivery_truck`, `purchase_order`, `customer_order`, `customer_node`, `customer_demand`, `invoice`, `receivable_balance`, `cash_account`, `cash_inflow`, `cash_outflow`, `supplier_payable`, `payroll_group`, `rent_location`, `calendar_marker`, `calendar_season`, `delay_marker`, `stockout_marker`.

A supported manifest contains:

- Contract version, `scene_manifest_supported = true`, `run_id` and `question_key`.
- Start/end dates, time grain and the selected question's `allowed_asset_ids`.
- Entity instances with stable business/result references, using only allowed asset IDs.
- Time-keyed events referencing persisted simulation event IDs.
- Metric-series references required to visualize state through time.
- Asset metadata, without geometry files or rendering code.

The allowlist is a limit, not a requirement to fabricate every entity. Unsupported result families do not create scene instances or metric values. Free-form LLM/user text may not become an asset identifier. A future renderer visualizes persisted results and never recalculates inventory, cash, demand, debt or service. If 2D and 3D disagree, the persisted result is authoritative and the visualization is defective.

### 16.10 Conceptual resource/API contract

The exact framework and transport may change, but the implementation preserves equivalent behavior. These preferred paths define boundaries among client, engine and future visualization work.

| Method and resource | Required behavior |
| --- | --- |
| `POST /api/forecasts` | Save a forecast definition. |
| `GET /api/forecasts` | List saved forecast definitions. |
| `GET /api/forecasts/{forecast_id}` | Retrieve a definition. |
| `PATCH /api/forecasts/{forecast_id}` | Edit a definition without modifying previous runs. |
| `POST /api/forecasts/{forecast_id}/runs` | Create an asynchronous forecast run with idempotency handling. |
| `GET /api/forecast-runs` | List run history with status/scope/engine/date filters. |
| `GET /api/forecast-runs/{run_id}` | Retrieve status, timestamps, provenance, warnings, errors and result links. |
| `POST /api/forecast-runs/{run_id}/cancel` | Request cancellation where supported. |
| `GET /api/forecast-runs/{run_id}/series` | Retrieve completed dated forecast output and supported uncertainty fields. |
| `POST /api/scenarios` | Save a scenario definition. |
| `GET /api/scenarios` | List saved scenarios. |
| `GET /api/scenarios/{scenario_id}` | Retrieve a scenario. |
| `PATCH /api/scenarios/{scenario_id}` | Edit a scenario without modifying previous runs. |
| `POST /api/scenarios/{scenario_id}/runs` | Create an asynchronous simulation run with idempotency handling. |
| `GET /api/simulation-runs` | List history with question/status/scope/date filters. |
| `GET /api/simulation-runs/{run_id}` | Retrieve status, timestamps, dependency state, provenance, warnings, errors and result links. |
| `POST /api/simulation-runs/{run_id}/cancel` | Request cancellation where supported. |
| `GET /api/simulation-runs/{run_id}/results` | Retrieve completed metrics, extrema, deltas, assumptions and warnings. |
| `GET /api/simulation-runs/{run_id}/series` | Retrieve completed dated metric series. |
| `GET /api/simulation-runs/{run_id}/events` | Retrieve the completed dated event trace. |
| `GET /api/simulation-runs/{run_id}/scene-manifest` | Retrieve the focused-question manifest, or explicit unsupported status for `Q-EXPLORE`. |

Create-run normally returns HTTP 202 Accepted or equivalent semantics, with run ID, status and status/result links. Before success, final-result requests return the current nonfinal state without numerical final artifacts. §16.7 governs idempotency, terminal immutability and retries. Archive/hide behavior must preserve that contract; deletion, authorization and retention details remain implementation decisions.

### 16.11 Explicit-event dependencies and boundary cases

An order scenario may begin with a declared order instead of sales history. Fulfillment needs quantities, delivery timing, stock and supply; margin needs compatible prices/costs; absolute cash results need starting cash and timed receipts/payments. A collection-only scenario needs no inventory policy or fabricated demand.

Show supplied dependencies: order → required product → stock/purchase → supplier payment → delivery → invoice approval/payment cycle → collection. Partial deliveries and payments retain their dates and pending amounts. Supplier payment before dispatch is enforced only where that prerequisite is provided or accepted as an assumption.

A hypothetical advance requires customer agreement; a revised supplier term requires supplier agreement. Changing a scenario never edits the actual contract, invoice or payment. Expected collection after the horizon remains outstanding beyond it. Cash already included in the opening state is not added again. Linked orders, invoices, advances, receivables, purchases and payables must not create duplicate economic events.

Use §16.2 for forecast/order overlap and snapshot bridging, and §23 for daily accounting and metric conventions. Disclose the daily-resolution limit when same-day event order is unknown. A positive end-of-day balance alone does not prove that every payment could clear earlier that day.

## 17. Finance, late payments and debt

### 17.1 Purpose and module boundary

Finance connects sales and operating decisions with cash timing. It helps the owner understand how purchases, slow-moving stock, collections, supplier terms and obligations affect recorded commitments. Liquidity is its cash-planning capability, normally viewed over 30 daily steps; the module name is Finance.

This scope does not add bookkeeping, payroll execution, tax calculation, payments or credit brokerage. Forecast & Simulate owns saved analytical execution and detailed scenario comparison. Finance owns financial records and liquidity drill-down, and may present a saved result using its provenance.

### 17.2 Minimum information

Intake remains progressive. Relevant records include:

- Available cash with currency, scope and reference time; purchasing budget with a separate amount, scope and period.
- Inventory value when compatible quantities and costs exist.
- Receivables with outstanding amount, due date, expected collection/availability date and status where known.
- Supplier payables with outstanding amount, due date, planned payment date and status where known.
- Payroll, rent, taxes and other operating payments with usable amount/date or schedule.
- Financing-debt balance and known repayment amounts/dates; interest and maturity may remain unknown.
- Purchases, expected collections and other scenario events, linked to their originating records where applicable.
- An owner-selected reserve for reserve-preservation outputs.

A record may be stored before all downstream analytical fields are known. A daily cash projection requires dated opening cash, at least one usable future timed event and an explicit review of included, omitted and confirmed-absent categories. The opening state must satisfy §16.2 and §23. Incomplete coverage produces a partial projection. A purchasing budget alone supports a budget comparison, not an absolute cash curve. An unprovided operating category is unknown, not zero.

### 17.3 Required distinctions

Incoming late payment is a customer payment after its due date. Outgoing late payment is a late supplier/obligation payment, which can affect delivery, relationships or penalties where those consequences are supplied or modeled explicitly. These timing states do not define the financing category.

- **Internal Debt:** The product label for customer-originated amounts still owed or pending availability. Unpaid customer receivables and collected-but-unavailable provider funds are distinguishable stages and must not be counted twice.
- **External Debt:** The product label for confirmed supplier amounts owed. Expected recurring commitments are shown separately until they create a confirmed payable.
- **Financing Debt:** Loans or other financing balances and their repayment schedules. Keep them separate from supplier External Debt and invoice lateness.

Also distinguish sales, pending orders, invoices and receipts; gross profit and cash; due, expected/planned and actual dates; agreed and hypothetical terms; cash and purchasing budget; unknown, confirmed zero and confirmed absence within a scope/period.

Receivables without expected dates remain visible as unscheduled. Include only dated pending amounts in a cash projection, or use an explicit accepted date assumption. Advances and partial collections reduce the relevant pending amount and do not create additional sales. Amounts already included in starting cash are not projected again. Provider collection and later availability must form one traceable transition to available cash rather than duplicate inflows.

### 17.4 Outputs and disclosures

Where supported, show the daily cash balance, first deficit date/amount, cash floor/date and additional liquidity to preserve the owner's reserve. Definitions and denominators follow §23. Assumptions, timed events, coverage and material omissions remain visible next to their results.

Finance dashboards may summarize selected financial metrics from a succeeded saved simulation. The summary identifies the run, scenario, dates, scope, provenance, completion time and partial-coverage warnings, and links to the detailed result. Selecting a run does not silently relabel its future horizon as a historical dashboard period. These summaries may show cash, receivables/payables and directly relevant inventory value; demand-forecast series, model comparisons, forecast error/bias and model diagnostics remain in Forecast & Simulate.

A positive partial projection does not establish business-wide sufficiency. Inventory value is not immediately available cash. Proposed advances, deferred payments and financing are not assumed agreed or guaranteed. Collections moved beyond the horizon remain outstanding.

Contextual disclosures identify manually entered, imported, simulated, precomputed and actually executed information. The view is planning rather than a complete accounting cash-flow statement. Unknown operating obligations may materially change actual liquidity. The mock-first version includes no live bank/accounting integration and executes no payment, collection, borrowing or supplier action. Results are conditional comparisons, not guarantees of collection, financing or profitability. Population-level claims from illustrative background material must not become customer-specific delay or default assumptions.

## 18. SKU Standardization requirements

SKU Standardization is optional and separate from normal inventory operation. It identifies possible inconsistencies without silently correcting source business records or blocking otherwise usable analysis.

Supported proposal examples include duplicate/conflicting SKU identifiers; inconsistent product, category, brand or supplier names; inconsistent units; incompatible/missing case-pack or MOQ definitions; inconsistent cost/price formats; missing stable identifiers; and suspicious whitespace, capitalization, punctuation or formatting differences. Similar names alone do not prove that records represent the same product.

The canonical review-and-approval workflow is:

1. Identify a proposed correction and preserve the original values and source references.
2. Show the proposed value/change, reason, affected records, possible analytical benefit and any ambiguity. For merges or unit changes, show the affected identifiers/quantities and the supported conversion basis.
3. Let the administrator review proposals individually or as an explicitly identified set, edit proposed values, accept selected proposals, reject any proposal or leave it pending. Edited proposals are previewed again before confirmation. Rejection and deferral do not prevent use of unrelated supported capabilities.
4. Present a confirmation summarizing the exact selected changes before applying them. Approval of a suggestion list is not permission to add undisclosed changes.
5. Apply only confirmed changes through the supported standardization process. A mocked application is labeled and respects the prototype-session boundary; it must not claim a durable source-data correction that did not occur.
6. Re-evaluate affected mappings/capabilities and show the result. Preserve completed analytical-run inputs/results; later runs may use the approved revised data through new snapshots.

No source value, identifier, unit or quantity changes without explicit approval. Intake mapping confirmation does not authorize unrelated standardization proposals. Where session undo is provided, explain its scope; undo does not replace pre-application confirmation. Production audit, reversal and permanent merge behavior remain implementation decisions in §24.

## 19. Mock-first delivery and persistence boundary

### 19.1 Canonical delivery boundary

This table governs what may be mocked and what must persist. “In scope” does not mean “already implemented.” A build must state which computations and intake paths actually run.

| Area | Required behavior | Functional boundary | Persistence minimum |
|---|---|---|---|
| General onboarding | Progressive intake, review, confirmation, coverage, deferred blocks, and supported/empty result paths | Manual inputs may be usable; parsing/mapping may be simulated if disclosed before reliance | Retain state during the prototype session |
| Inventory operations | Coherent positions, movement demonstrations, and confirmations | Receiving, transferring, adjustments, and reconciliation actions may be mock interactions | Prototype-session continuity; no broader promise |
| Dashboards and ordinary Finance views | Coherent values, scope/date meaning, provenance, and warnings | May use labeled fixtures or genuinely supplied/calculated data; never attribute fixture metrics to arbitrary user data | Prototype-session continuity for general records/views |
| Forecast/scenario definitions | Saved editable configuration with durable identities and traceable input basis | Real resource persistence is required even where numerical examples use fixtures | Across refreshes and ordinary browser sessions |
| Forecast/simulation runs | Asynchronous resource lifecycle, durable status/history, fixed submitted input snapshot, dependencies, and final artifacts | A fixture run is labeled demo/precomputed. Any run labeled computed from user data must use the actual engine path | Across refreshes and ordinary sessions, independent of browser connection |
| Analytical input snapshots | Sufficient immutable source values, versions, assumptions, and identity links to explain/reproduce the submitted calculation | Durable snapshot or immutable, durably resolvable references; references to lost session-only objects are insufficient | Retained with the run and its artifacts |
| Standardization | Review, individual/group choice, confirmation, and visible application outcome | Application and audit summary may be mocked | Prototype-session continuity; production reversal/audit remains open |
| Integrations, identity, and roles | Clearly labeled normalized mock provider records and permission preview | No live provider actions, general synchronization, or implied multi-user enforcement | No production identity/synchronization promise |
| Future scene data | Stable focused-question manifest contract and declared unsupported exploratory scene behavior | Manifest reads the persisted result; renderer/geometry remain deferred | Manifest and its referenced run artifacts follow the run's retention boundary |

All applicable workflows need believable empty, loading/queued, success, warning, error, and confirmation states. Ordinary navigation does not cancel or reset a submitted analytical run. Definition changes do not rewrite previous runs. Section 16.7 defines the shared execution contract.

### 19.2 Truthful provenance

Use labels such as **Demo data**, **Prototype result**, **Simulated import**, or **Demo action** where they describe the actual process. Executed runs additionally identify engine/version and distinguish user-data computation from fixtures. Provenance should be visible near the relevant result without covering unrelated screens with repetitive warnings.

An uploaded filename is not successful ingestion. If parsing is mocked, never attribute extracted products, row counts, or analytical totals to the unprocessed file. Replacing a mock with a functional parser/calculator requires recording which path now runs and its supported input/calculation contract. Unsupported user inputs produce an explanation rather than unrelated fixture output.

### 19.3 Separate demonstration environment

Normal business onboarding, resumed intake, and Add-on cards do not offer sample data as a substitute for missing business records. A separately identified demo environment can use:

- 20–50 SKUs across several categories.
- At least two physical locations and one channel sharing inventory.
- 3–6 suppliers with varied lead times and delivery-history coverage.
- Stable, seasonal, and erratic dated sales.
- Stock, purchase orders, receipts, returns, adjustments, and stockout examples.
- Prices, costs, and discounts.
- On-time, overdue, and partially collected customer receivables.
- On-time and late supplier payables, and one or two Financing Debt obligations.
- Payroll/rent/other operating events plus deliberate category omissions.
- Data gaps, progressive eligibility, and reviewable Standardization issues.

A demo may use the Joyarte/Esmeralda illustrative persona named in the historical Info reference. Do not present the persona, growth narrative, or synthetic amounts as evidence of a validated customer. Examples and template values never enter business records automatically. Developer readiness controls and sample-provider actions remain in the demo context.

### 19.4 Numerical and cross-view consistency

Values referring to the same source facts, scope, date, and version must agree across Inventory, Dashboards, Finance, and the initial state of a run. Charts, metrics, tables, explanations, event traces, and scene manifests for one run read the same persisted result.

Later edits to current records may legitimately differ from an old run's immutable snapshot; show the old run's input date/version rather than updating its history. Mock alternatives must demonstrate coherent changes under their declared assumptions, not arbitrary unrelated totals.

### 19.5 State retention and history access

General onboarding preserves business context, question, entered fields, mappings, coverage, and deferred blocks during the prototype session. Returning through Add-ons & Data or Settings resumes the relevant block. Cross-session persistence for general business records is not implied.

Forecast/scenario definitions, all persisted run states, completed/failed/cancelled history, input snapshots, results, and provenance survive refreshes and ordinary sessions. Their durable identity and retrieval cannot depend solely on onboarding session data. Existing run detail/history is accessible even when current source data is missing, a capability is muted/retired, or a newer run is active. Readiness changes govern new executions; they do not erase historical evidence.

The owner may archive/hide a definition or run from the primary list through an explicit action; archived items remain retrievable until an explicit retention/deletion policy applies. Archiving is not source deletion or implicit job cancellation. The implementation must provide a retrieval path without requiring cross-device synchronization or full multi-user accounts. Those account, retention, deletion, and audit choices remain in section 24.

### 19.6 Functional release gate

Before a calculation is described as executed against user data, implement its supported input schema, per-output eligibility, compatible units/currency and dates, relevant formulas, overlap/deduplication behavior, and declared engine conventions. Persist their versions and assumptions with the run. Unsupported input combinations must be rejected for that output or explicitly excluded with the owner's informed scope confirmation; they must not trigger invented values.

This gate does not require every optional question, model, or operational mutation to become functional simultaneously. The build must make its supported paths and demo paths explicit while preserving the common resource contract.

## 20. Functional requirements catalog

This catalog is normative. The referenced sections define the detailed object, eligibility, lifecycle, time and persistence contracts; the acceptance scenarios exercise those same rules.

### Onboarding and data

- **ONB-01:** The administrator can obtain a first supported sales analysis with minimal business context and usable sales records, without mandatory inventory. A supported inventory-only start remains valid.
- **ONB-02:** Every optional dataset can be deferred. Completing the initial journey does not require all products, locations, financial categories, forecasts or a scenario.
- **ONB-03:** Retired: The former requirement to choose sample data instead of business data remains removed. This identifier is not reused. The normal-onboarding rule is specified in section 11.
- **ONB-04:** Before finishing, the product summarizes usable capabilities, their source/scope and warnings, with one next relevant action.
- **ONB-05:** Onboarding is resumable from Add-ons & Data or Settings within the general prototype persistence boundary in section 19; session continuity is the minimum.
- **ONB-06:** Normal onboarding must not load a sample business or fill unknown values with fictitious data.
- **ONB-07:** The user can optionally choose the first question and change it without restarting onboarding.
- **ONB-08:** Manual entry and import explain each field's meaning, unit, period, analytical use and requiredness.
- **ONB-09:** Data intake includes mapping/format/scope review, explicit accepted/pending/excluded records, and confirmation before applying changes.
- **ONB-10:** Unknown, confirmed zero, and confirmed absence during a stated period are distinct and are not substituted for one another.
- **ONB-11:** Entry and review distinguish sales, orders, deliveries, invoices, receipts and advances, and purchasing budget from available cash.
- **ONB-12:** Partial data enables only supported results for its actual scope; other metrics are not filled with invented values.
- **ONB-13:** Templates, examples, demo values and simulated processes are identified and not mixed into the user's records or misrepresented as real file processing.
- **ONB-14:** Initial journey completion, first supported analysis and first scenario comparison are separately observable milestones; deferral without data does not count as an analysis.
- **ONB-15:** The first decision reuses entered data and asks only for the additional inputs required by the selected question.
- **DAT-01:** Capability eligibility depends on usable minimum inputs and scope, never a dataset checkbox or presentation switch. Main-module visibility also respects activation and lifecycle rules in section 10; a presentation preference cannot supply or remove analytical inputs.
- **DAT-02:** Coverage, freshness and short-history warnings do not block supported use; uninterpretable records and absent indispensable inputs are handled explicitly.
- **DAT-03:** Every warning explains scope, analytical impact and a possible improvement.
- **DAT-04:** The unavailable-capability catalog lives in Add-ons & Data; contextual onboarding help does not create disabled clutter across the product.
- **DAT-05:** Newly eligible capabilities receive clear, non-disruptive messages under the activation and notification preferences in section 10.
- **DAT-06:** Readiness is tracked by capability and relevant product, location, period and source coverage rather than a single global completion percentage.
- **DAT-07:** Sales history does not implicitly create current stock, supplier reliability, customer-payment probabilities or daily breakdowns absent from the source.
- **DAT-08:** Every newly executed forecast has the required observations and drivers in its captured inputs; missing history is never manufactured. Persisted historical forecasts retain their own captured prerequisites and remain readable when current source availability changes.
- **DAT-09:** Undated cash events remain pending scheduling or use an explicit accepted date assumption; material exclusions are shown beside the cash projection.
- **DAT-10:** Removing an indispensable source input re-evaluates eligibility for new analyses and discloses the affected outputs. Persisted runs retain their captured inputs and historical results under sections 16.7 and 19; current readiness does not rewrite them or leave unsupported new analyses marked available.
- **DAT-11:** Source values and their meanings are preserved through review; merges, conversions, exclusions and standardization require the applicable confirmation.

### Inventory and locations

- **INV-01:** Inventory is identifiable by product/SKU and known location or explicitly aggregated scope. Unknown physical distribution is not invented; a confirmed pool preserves known location contributions.
- **INV-02:** The user can see total shared availability and the contributing-location breakdown where supplied; an unknown physical distribution remains explicitly unknown.
- **INV-03:** Inventory detail can show available, reserved, on-order, and backordered quantities when present.
- **INV-04:** The product demonstrates movements and reconciliation exceptions using mock records.
- **INV-05:** Advanced allocation and routing are explicitly outside the MVP.
- **INV-06:** Sales-first onboarding does not require current stock or location setup; subsequent inventory enrichment preserves quantity semantics and avoids duplicate aggregate/location stock.

### Dashboards

- **DSH-01:** Dashboards are divided into Inventory and Finance.
- **DSH-02:** Inventory contains Executive, Inventory, Service, and Suppliers subsections.
- **DSH-03:** Finance contains Executive, Liquidity, Internal Debt, and External Debt subsections.
- **DSH-04:** Each Executive subsection shows at most 10 supported leading indicators from its own dashboard family. Aim for roughly 8 when useful; show fewer when inputs or the selected scope support fewer, without padding missing metrics.
- **DSH-05:** Dashboards support historical Last 7 Days, Last 30 Days, and Last 12 Months rolling periods. Historical reporting periods, snapshot as-of dates and forward planning horizons remain distinct under sections 14 and 23.
- **DSH-06:** Dashboards support Current Quarter, Previous Quarter, a selected year/quarter, and previous-quarter comparison.
- **DSH-07:** Where sufficient history exists, Dashboard views may compare the Last 4 Quarters.
- **DSH-08:** Metrics retain the definitions, input requirements and warnings in sections 10, 14 and 23 after period filtering and dashboard restructuring.
- **DSH-09:** Metrics support relevant drill-downs and existing business-scope filters.
- **DSH-10:** A metric affected by incomplete, stale, inconsistent, or insufficient data shows a nearby warning.
- **DSH-11:** Snapshot, flow and average metrics follow section 23 and are not aggregated interchangeably. Historical balance reconstruction requires suitable historical inputs; a current balance is not relabeled as a prior-period balance.
- **DSH-12:** Demand-forecast outputs and forecast-model diagnostics appear only in Forecast & Simulate. Dashboard summaries of financial projections follow the saved-result provenance and horizon rules in section 14 and do not present demand forecasts.
- **DSH-13:** Dashboard values remain consistent with underlying Inventory, Finance and Forecast & Simulate records when they reference the same fact, scope and as-of date. A saved projection is identified separately from current facts.

### Forecasting

- **FRC-01:** Naïve, seasonal-naïve, and LightGBM/CatBoost are labeled as forecasting engines.
- **FRC-02:** Each engine has a separate responsibility and common output suitable for the shared simulation.
- **FRC-03:** The product explains intended use, requirements, and limitations for each engine.
- **FRC-04:** Eligible naïve baselines remain available for comparison, with main-module presentation governed by activation and lifecycle rules; they are not styled as inferior placeholders.
- **FRC-05:** The advanced engine is not described as automatically better.
- **FRC-06:** Forecast warnings identify short history, seasonality gaps, stockout censoring, or incomplete drivers.
- **FRC-07:** Every forecast execution creates a persisted run with an immutable input snapshot/reference set and engine/version, plus status, timestamps, warnings and dated output artifacts. Lifecycle metadata changes during execution; completed inputs and artifacts remain immutable under section 16.7.
- **FRC-08:** Forecast runs use asynchronous lifecycle states and do not require the browser request or page to remain open until computation finishes.
- **FRC-09:** The user can reopen prior forecast runs and compare completed forecasts after editing or rerunning the saved definition.
- **FRC-10:** Only a succeeded forecast run supplies numerical forecast input. A saved scenario may reference a pending forecast run; its simulation waits for that pinned dependency under section 16.7 rather than fabricating outputs.

### Simulation

- **SIM-01:** One shared simulation framework accepts the selected forecast in its forecast-driven path and explicitly declared business events in its event path.
- **SIM-02:** The user can begin with a focused question or exploratory analysis.
- **SIM-03:** Scenario controls appear when their minimum usable inputs or supported explicit assumptions exist for the selected scope. Presentation follows activation/lifecycle rules; missing prerequisites can be explained contextually without disabled-control clutter.
- **SIM-04:** The user can override available scenario assumptions without changing source records.
- **SIM-05:** Results lead with the selected question and keep primary charts, assumptions, event trace, metrics, limitations and explanations expanded by default. Supplementary detail may be optional; the primary result is never replaced by a short summary.
- **SIM-06:** Scenario comparisons use compatible scope, dates, daily grain and metric definitions. A baseline is a pinned succeeded run identified by baseline_run_id; compatibility and cadence conversion follow sections 16 and 23.
- **SIM-07:** The product does not select, recommend, or label a best policy.
- **SIM-08:** Limited quality or coverage produces non-blocking warnings for supported results. Missing indispensable inputs prevent only the unsupported result family; assumptions and omitted categories remain visible.
- **SIM-09:** Three.js remains an optional result visualization and not a calculation owner.
- **SIM-10:** A declared-order or collection scenario does not require an invented forecast; each requested result family keeps its own prerequisites.
- **SIM-11:** Known order, purchase, payment, delivery, invoice and collection dependencies are traceable, including partial events.
- **SIM-12:** Liquidity scenarios prioritize a daily 30-day view, showing assumptions, first gap, minimum balance and reserve-related shortfall where supported; other permitted horizons follow section 16.
- **SIM-13:** Unvalidated scenario ranges are not presented as calibrated probabilities.
- **SIM-14:** Scenario changes do not change real source records or imply agreement to proposed advances or payment terms.
- **SIM-15:** Every simulation execution creates a persisted run from a saved scenario and captured immutable inputs. Status and execution metadata change through the lifecycle; completed artifacts are immutable. Later definition edits do not rewrite prior inputs or results.
- **SIM-16:** Long-running simulation runs support queued, waiting_for_dependency, running, succeeded, failed and cancelled states and remain active when the user navigates away or refreshes.
- **SIM-17:** Forecast & Simulate exposes prior running and historical simulation runs so a new run never hides or replaces earlier analyses.
- **SIM-18:** Every simulation states start date, end date and daily grain. Presets are 7/30/60/90/180/365 days; custom horizons contain 1–365 inclusive daily dates. End date equals start date plus horizon_days minus 1; the maximum end date is start date plus 364 days.
- **SIM-19:** Completed simulation results use detailed vertically expanded sections with primary time-series charts, event trace, assumptions, limitations, metrics and dated explanations; a short summary is not a substitute for the detailed result.
- **SIM-20:** The focused question registry in section 16.8 covers new orders, critical collections, cash sufficiency for payroll/suppliers/rent, replenishment timing/quantity, vacation/season demand changes, slower suppliers, customer-debt accumulation and supplier-order changes affecting stockouts. Q-REPLENISH is the single replenishment question; exploratory analysis uses Q-EXPLORE.
- **SIM-21:** Primary charts are derived from persisted dated series and include the relevant inventory, demand, purchase/receipt, cash, receivable/payable, stockout/backorder and scenario-delta views for the selected question.
- **SIM-22:** Each focused question has the predefined future-3D asset allowlist in section 16.8, governed by the scene contract in section 16.9. A supported scene manifest reads persisted results and never recalculates outcomes. Q-EXPLORE initially has scene_manifest_supported=false and requires no scene manifest or renderer to complete or reopen its full 2D result.
- **SIM-23:** The implementation exposes equivalent forecast/scenario definition, asynchronous run-status, result-series, event-trace and scene-manifest resource endpoints as defined in section 16.10.
- **SIM-24:** Run creation protects against duplicate submissions using the section 16.7 idempotency contract. A user-requested retry, rerun or edited scenario creates a traceable new run; automatic recovery may resume the same execution attempt only with unchanged captured inputs and without overwriting completed artifacts.
- **SIM-25:** The UI may show a backend-provided phase but must not fabricate a precise progress percentage or present partial engine output as a final business result.

### Run orchestration

- **RUN-01:** Starting a forecast or simulation returns a persistent run identity before long-running computation finishes.
- **RUN-02:** The engine handler persists state transitions, timestamps, errors, dependency state and final artifact references.
- **RUN-03:** Browser navigation, refresh or closing the result page does not cancel the compute job.
- **RUN-04:** An unrecoverable worker exception or exhausted execution timeout produces a persistent failed state with an actionable error, rather than an indefinitely running run. Any bounded automatic recovery follows section 16.7 and does not change captured inputs.
- **RUN-05:** A user can open prior succeeded/failed/cancelled runs while another run is queued or running.
- **RUN-06:** Captured run inputs and completed artifacts are immutable. Execution status and metadata may advance during the lifecycle. A user rerun creates a new run and preserves history, including the pinned baseline and dependency references.

### Finance — legacy LIQ identifiers retained

- **LIQ-01:** Finance shows a daily 30-day cash outlook when opening cash has a reference date and scope, at least one usable future timed event exists, and included/omitted categories have been explicitly reviewed. Provenance and partial coverage remain visible.
- **LIQ-02:** Incoming and outgoing late payments distinguish cash-flow direction. Financing Debt distinguishes borrowed funds from customer receivables/Internal Debt and supplier obligations/External Debt. Lateness is a status and does not create an additional balance to count.
- **LIQ-03:** Purchasing budget influences budget comparisons and cash-timed purchases when appropriate; customer delays change the associated pending collection. A budget never substitutes for available cash.
- **LIQ-04:** The product identifies omissions and avoids presenting the outlook as complete accounting.
- **LIQ-05:** The MVP does not connect to accounting or banking software or execute transactions.
- **LIQ-06:** Intake supports supplier, payroll, rent, tax, Financing Debt and other operating commitments, with unknown omissions distinct from confirmed absence for the stated period and scope.
- **LIQ-07:** Cash already reflected in opening cash and linked advances/partial receipts must not be counted again. Linked invoice, collection and provider-pending records follow section 9 traceability rules so one underlying payment is not counted as multiple receivables or inflows.
- **LIQ-08:** Reserve-preservation outputs require an owner-selected reserve; no automatic reserve is invented.
- **LIQ-09:** Positive partial projections do not claim whole-business cash sufficiency; beyond-horizon and undated obligations remain visible.

### SKU Standardization

- **STD-01:** Standardization is an opt-in external module.
- **STD-02:** Proposed changes are reviewable and never silently applied.
- **STD-03:** Each proposal states its reason, affected records, and expected data-quality benefit.
- **STD-04:** The administrator can accept, reject, or edit proposals before a mock application step.

### Roles and prototype behavior

- **ROL-01:** One administrator can access all modules in the MVP.
- **ROL-02:** Modules and major actions are associated with a future permission scaffold.
- **ROL-03:** The prototype does not imply that live multi-user access control exists.
- **MCK-01:** Mock data and processes are identified as such.
- **MCK-02:** Mock workflows include believable states and internally consistent values.
- **MCK-03:** No general production backend or complex production logic is required outside the narrow stateful forecast/simulation execution, persistence and retrieval boundary in sections 16.7 and 19.
- **MCK-04:** Development/demo datasets are separate from the normal user business and never replace missing onboarding values.
- **MCK-05:** Unprocessed user files do not receive falsely attributed demo totals, extracted records or analytical results.
- **MCK-06:** General onboarding state requires prototype-session continuity. Forecast/scenario definitions and forecast/simulation run history persist across ordinary refreshes and sessions under sections 16.7 and 19.

### Add-ons & Data

- **ADD-01:** Add-ons & Data is the full catalog of optional capabilities and their readiness. Other screens may explain the prerequisites of a selected question or show a contextual entry link; unavailable capabilities do not become disabled destinations or repeated catalog clutter elsewhere.
- **ADD-02:** Each card states its business question, minimum fields and owning object, entry methods, coverage/history benefit, data state, and lifecycle stage (with successor and sunset date when deprecated).
- **ADD-03:** Add-ons & Data explains capability state and links to the owning entry/review workflows; it does not itself mutate source data, execute forecasts or simulations, apply standardization, or re-lock a computable capability because of a quality warning.
- **ADD-04:** Data state is derived from usable inputs and is not user-editable. Lifecycle stage is owner-controlled. Both are independent of the user-controlled activation preference, as defined in section 10.
- **ADD-05:** Each eligible active/deprecated capability has an on/muted activation preference, defaulting to on unless previously muted. Muting reversibly hides its main-module presentation and suppresses its optional alerts without changing source data, analytical eligibility or availability as a computational dependency. Saved runs remain accessible; retired capabilities cannot be reactivated for new execution.
- **ADD-06:** Before muting or disabling presentation, the dependency view lists affected displays. Declared downstream display suppression may hide affected widgets; it never removes data, disables valid calculations or hides run history. The user may proceed.
- **ADD-07:** Eligible, unmuted capabilities with an active/deprecated lifecycle surface outputs in their consuming modules with relevant warnings; catalog metadata remains in Add-ons & Data. Supplying inputs activates newly eligible capabilities by default, while preserving an existing muted preference. Retired capabilities permit no new execution; saved historical results remain readable.
- **ADD-08:** Optional capability notifications for unlocks, quality/coverage and freshness carry type and severity and may be dismissed or snoozed under a global on/off preference and severity floor. These presentation controls never suppress material inline warnings, omissions, assumptions or provenance on any displayed result, including historical runs.
- **ADD-09:** The dependency view is generated from the declarative capability registry implementing section 10.3, with requires/feeds relationships and no separate source of truth. Production persistence of catalog/preferences remains deferred within section 19; analytical run snapshots and history retain their required persistence.

## 21. Acceptance scenarios for the precursor prototype

These scenarios apply within the mock and functional boundaries in section 19. Numerical claims require the inputs and provenance stated by the relevant capability; analytical runs use section 16.7.

### Scenario A — Minimal-data start

Given an administrator provides the business name, currency and dated sales by identifiable product, without inventory, suppliers or costs, onboarding permits entry and shows the supported sales summary. It does not require opening stock or fabricate margin, cash or inventory. Optional expansion remains in Add-ons & Data.

### Scenario B — Partial supplier history

Given delivery history exists for only half of active suppliers, supplier reliability is available for that supported subset and a warning names the coverage. Scenario controls use supported supplier inputs or explicit assumptions for uncovered suppliers; the product invents no reliability scores and permits the supported analysis to continue.

### Scenario C — Forecast and simulation separation

Given multiple engines are eligible, the user selects a succeeded forecast run and uses the same inventory simulation framework. Changing the engine changes the demand input, not the simulation responsibility or workflow. Forecast and simulation scopes, dates and cadence are reconciled explicitly.

### Scenario D — User-led decision

Given two scenarios produce different service, inventory, profit, and liquidity outcomes, the product compares them neutrally and does not mark a winner or recommended option.

### Scenario E — Focused result

Given the user tests customer-payment delay, the result leads with collection timing and the supported cash effects; purchasing-budget headroom appears only when its own inputs exist. Primary charts, event trace, assumptions and limitations are expanded by default. Relevant inventory/service sections remain readable without displacing the selected question.

### Scenario F — Standardization consent

Given inconsistent SKU names and units are detected, the user can review and reject every proposed change. No source value changes without confirmation.

### Scenario G — Shared inventory

Given one SKU exists at two locations, the product shows a shared total and both location contributions. It does not claim to optimize allocation or fulfillment routing.

### Scenario H — Mock transparency

Given the user runs a mocked forecast, simulation, import, transfer or payment-related workflow, its provenance is clearly described and cannot be mistaken for live processing or an executed action. A simulated import must not claim to have extracted or analyzed the actual unprocessed file, and normal onboarding must not inject demo records.

### Scenario A2 — Inventory-only alternative

Given the user provides identifiable products and dated quantities at a known location or declared aggregate scope, but no sales history, the product shows supported stock visibility. It does not create sales or a demand forecast and allows later sales intake.

### Scenario A3 — Aggregate monetary sales

Given the file contains dates/periods and amounts without products or quantities, review confirms the row meaning and the product offers an aggregate monetary summary. It does not generate product-level demand, stock or unit-replenishment quantities.

### Scenario A4 — Unknown cost and operating category

Given costs are missing for some products and payroll has not been entered or explicitly declared absent, those costs remain unknown, margin is not calculated for the uncovered products, and any cash projection identifies payroll as omitted. Unknown fields are not converted to zero.

### Scenario A5 — Purchasing budget without cash

Given only a purchasing budget and proposed purchases are available, the product supports purchase-versus-budget comparison. Neither the dependency view nor a dataset checkbox unlocks an absolute cash curve, cash floor or business-wide liquidity verdict. Cash projection remains unavailable until dated/scoped opening cash, a future timed event and a category-coverage review exist.

### Scenario A6 — Ambiguous import

Given ambiguous dates, similar product names, repeated invoice totals or uninterpretable rows, the review identifies the affected records. The user may correct them or confirm continuation with a usable subset. No silent merge, unit conversion, exclusion or source-data correction occurs.

### Scenario A7 — Resume postponed setup

Given suppliers were postponed and the user returns from Settings or Add-ons & Data during the same prototype session, the purpose, mapped data, coverage and other completed blocks are retained. Only the relevant missing context is requested. A cross-session persistence promise is not implied.

### Scenario A8 — Templates and separated demo

Given the user views a template example or the team opens the hack demo, example values do not enter the ordinary business dataset. Normal onboarding has no sample-business substitute. The demonstration is clearly identified and can never be mistaken for a validated customer dataset.

### Scenario A9 — First declared-order comparison

Given the selected order has usable quantities, dates and the operational/financial inputs needed for the chosen outputs, the scenario reuses onboarding data. A hypothetical advance creates an alternative with visible assumptions, does not change the real invoice, and does not imply that the customer agreed. No sales forecast is fabricated merely to run the declared-order case.

### Scenario A10 — One of five locations

Given records cover one location of a business with five, the result identifies that scope and does not present the values as all five locations. Aggregate stock is not duplicated when its known location breakdown is added.

### Scenario A11 — Insufficient model inputs

Given sales are usable for a descriptive summary but a seasonal observation or other indispensable model input is missing, the summary remains available and the unsupported model does not produce a fabricated forecast. Supported baseline models may remain available with warnings.

### Scenario A12 — Advance already in opening cash

Given an order has an invoice and an advance that was already received before the opening cash snapshot, the cash projection includes only the remaining pending collection and relevant future payments. It does not add the advance again or count the invoice and order as separate cash inflows.

### Scenario A13 — Journey deferred without data

Given the user enters minimal context and postpones all datasets, onboarding can end at an honest empty state. Journey completion is recorded separately from first analysis and first scenario; no analytical result is invented.

### Scenario A14 — Partial cash projection and reserve

Given dated/scoped opening cash and one pending future movement exist, the coverage review identifies unknown rent and taxes. The product may show a partial projection with those exclusions beside it. A positive minimum balance does not certify sufficiency. Additional liquidity to preserve a reserve appears only after the owner supplies that reserve.

### Scenario A15 — Undated and beyond-horizon collections

Given one receivable lacks an expected date and another is expected after day 30, the first remains pending scheduling or uses an explicitly accepted date assumption; the second remains visible as outstanding beyond the horizon. Neither is silently counted as cash during the 30-day window.

### Scenario A16 — Critical collection without inventory

Given dated/scoped opening cash, a critical receivable, known timed operating payments and an explicit category-coverage review, but no stock or sales history, the user can compare collection dates. The result requires no forecast or stock setup and makes no unsupported inventory/fulfillment claim.

### Scenario A17 — Source removal after unlocking

Given a capability was available and an indispensable current source input is removed, eligibility for new analyses is re-evaluated and the affected outputs are explained. Previously saved runs remain readable with their captured inputs and results; their historical provenance is distinguished from current readiness. The product neither rewrites history nor preserves a stale available badge for unsupported new work.

### Scenario A18 — Long-running simulation survives navigation

Given a user starts a simulation whose engine remains running beyond the initial request, the UI receives a run ID, shows queued/running status, and allows the user to leave the page. Returning later reopens the same run. The browser is not required to stay connected and the run is not lost because the user viewed another module.

### Scenario A19 — Previous runs remain accessible

Given a scenario has two successful runs and a third running run, Forecast & Simulate lists all three with their own timestamps/status. Editing the scenario or starting the third run does not modify the first two completed results.

### Scenario A20 — Detailed time-based simulation result

Given a 90-day replenishment simulation succeeds, the result shows the exact 90 daily dates, projected inventory through time, order/receipt events, stockout/backorder behavior where applicable, key extrema and a dated explanation. The primary charts and assumptions are expanded by default rather than hidden in a summary card.

### Scenario A21 — Cash sufficiency question

Given dated/scoped opening cash, dated payroll, supplier and rent payments, expected receipts and an explicit included/omitted-category review, the user can ask whether recorded obligations can be paid. The result shows the daily cash curve, first gap if any, cash floor and obligations around the gap. If the user tests a changed purchase date or collection date, the product shows the modeled delta without claiming that the change is automatically advisable or contractually available.

### Scenario A22 — Demand-change question

Given a baseline demand path, starting inventory, the supply/purchasing inputs for the requested outcomes and an explicit vacation/low-season demand adjustment over selected dates, the simulation compares baseline and changed demand, inventory, stockout/excess and purchasing effects over the same horizon. The adjustment is labeled as an assumption unless produced by a validated model.

### Scenario A23 — Slower supplier question

Given starting stock, a dated demand path, supplier lead time with its starting convention, and open/planned replenishment events affected by that lead time, the user increases the lead time. The result shifts the applicable receipts and shows inventory, stockout/backorder and service effects by date. It does not reinterpret the assumption as historical supplier unreliability.

### Scenario A24 — Customer debt accumulation

Given current receivables and explicit dated assumptions for slower collections or added unpaid balances, the product shows the receivable/Internal Debt trajectory separately from sales. Absolute cash balances, cash floors and gaps additionally require dated/scoped opening cash, timed inflows/outflows and a category-coverage review. Without opening cash, supported collection-timing or cash-flow deltas are labeled as delta-only and never presented as an absolute cash balance or sufficiency verdict. No default probability is invented.

### Scenario A25 — Supplier order change and stockout

Given starting stock, a dated demand path, a supplier order and applicable lead-time/MOQ/case-pack constraints, the user changes the order quantity or receipt date. The result identifies whether and when stock reaches zero, the duration/units affected and the delta versus the baseline order.

### Scenario A26 — Forecast dependency waiting

Given a scenario references a forecast run that is queued or running, the definition can be saved and a submitted simulation enters waiting_for_dependency for that pinned run. It supplies no numerical forecast input until the dependency succeeds. Success may continue the simulation automatically; failure or cancellation exposes the dependency outcome and produces no fabricated numerical result. Replacement follows the new-run rules in section 16.7.

### Scenario A27 — Future 3D contract is bounded

Given a completed Q-SLOW-SUPPLIER run, the scene-manifest endpoint returns only asset IDs allowed for that question and references the same persisted dated results shown in 2D. No arbitrary generated asset is added and the absence of a 3D renderer does not prevent the user from reading the full result.

### Scenario A28 — Muting preserves calculations, history and material warnings

Given an eligible capability is on and supplies inputs to another analysis, muting it hides the declared main-module widgets and optional notifications after showing affected displays. Its source data and eligibility as a computational dependency remain unchanged; historical runs can still be opened. Every displayed dependent or historical result keeps its material inline coverage, omission, assumption and provenance notices, even with global notifications off.

### Scenario A29 — Lifecycle retirement

Given a capability is retired, its catalog entry identifies that lifecycle and any successor. No new run can execute it, regardless of available data or activation preference. Existing saved results remain accessible with their original engine/version and warnings.

### Scenario A30 — Inclusive simulation dates

Given a start date and a 365-day horizon, the result contains exactly 365 consecutive daily dates and ends at start plus 364 days. A one-day custom horizon has the same start and end date. A requested 366-day span is rejected with a clear correction; it is not silently truncated or executed. Every preset follows the same inclusive convention.

### Scenario A31 — Pinned baseline and compatible cadence

Given an alternative selects a succeeded baseline run, its saved baseline_run_id stays fixed when the baseline scenario definition is later edited or rerun. Comparisons use matching scope, date range, grain and definitions. If forecast cadence differs from daily simulation cadence, the required explicit conversion/coverage rule is applied and disclosed; absent a supported rule, the incompatible comparison or simulation does not run with invented daily values.

### Scenario A32 — Duplicate submission and retry

Given the same run-creation request is submitted twice with the same idempotency key and unchanged payload, the service returns the same run identity. Reusing that key with a changed payload is rejected. An automatic permitted recovery preserves the run's captured inputs; a user retry or changed scenario creates a new traceable run and retains the original status and artifacts in history.

### Scenario A33 — Exploratory run without a scene manifest

Given a Q-EXPLORE analysis has the inputs for its selected result families, it saves and completes using the normal asynchronous run contract. Its complete 2D time-series result and history remain available with scene_manifest_supported=false. A scene-manifest request returns an explicit unsupported outcome, without arbitrary assets, and does not fail or conceal the completed analysis.

### Scenario A34 — Historical period and forward horizon

Given the user selects Last 30 Days in a financial dashboard, historical flows use that reporting period and snapshots display their own as-of dates. A saved forward cash projection shows its run, date range and planning horizon independently; selecting a historical quarter does not relabel current balances or shift a saved projection. Missing historical inputs produce a scoped limitation, not fabricated past balances.

### Scenario A35 — One payment across receivable and provider states

Given a linked customer invoice is partly collected and that amount is awaiting provider availability, the invoice's unpaid balance, provider-pending amount and available cash represent distinct stages of the same underlying money. The dashboard and cash-event normalization count each amount once under section 9 linkage rules; availability moves the linked amount between states rather than creating an additional sale or collection. Unreconciled duplicates remain visibly unresolved and are not silently summed.

### Scenario A36 — Cash gap, floor and reserve arithmetic

Given opening cash of 100 in one currency and scope, three daily net movements of −150, −100 and +200, and an explicit category-coverage review, daily closing balances are −50, −150 and 50. The first gap is 50 at the first day's closing observation; the floor is −150 at the second day's close; the maximum modeled zero-cash deficit is 150. With an owner-selected reserve of 20, additional opening liquidity needed to preserve that reserve under unchanged flows is 170. These outputs describe included observation points and do not certify omitted categories or intraday payment clearance.

### Scenario A37 — No expected inflow and same-day netting

Given opening cash of 100, a dated payment of 120, and a coverage review confirming no expected receipts during the window, an outflow-only cash scenario remains eligible and shows a closing balance of −20. In a separate case with opening cash of zero, a receipt of 100 and payment of 100 on the same day yield zero closing cash, but unknown clearing order prevents a claim that the payment could be funded before the receipt arrived.

## 22. Product language and experience rules

- Use **forecast engine** for naïve, seasonal-naïve, and LightGBM/CatBoost. Use **shared simulation** for the consequence calculation. Declared-order/collection inputs are scenarios, not forecasting engines.
- Use **forecast/scenario definition** for saved editable configuration and **run** for an execution with fixed submitted inputs and its own lifecycle/result. Refer to historical results by run identity. A new user retry/rerun differs from an internal execution-attempt resumption.
- Use **scenario result**, **comparison**, **tradeoff**, and **modeled lever**. Do not use unqualified “best,” “optimal,” “recommended policy,” or “you should act.” Data-entry suggestions are distinct from choosing a commercial policy.
- Use **Finance / Finanzas** for the module and dashboard family, and **Liquidity / Liquidez** for cash planning and the dashboard subsection. Legacy LIQ identifiers remain valid.
- Use **Internal Debt**, **External Debt**, and **Financing Debt** according to section 9. Use the fully qualified label in metrics and filters; do not use bare “Debt” to mean different categories in different screens.
- Distinguish incoming late payment, outgoing late payment, and Financing Debt. A late invoice is not automatically a loan.
- Use **available with warning** for a supported but limited capability. Use **not provided** for missing usable prerequisites. Activation preferences and retirement are separate from data state.
- Use **unknown / desconocido**, **confirmed zero / cero confirmado**, and **confirmed absence during this period** for separate states.
- Use **partial projection** when categories or timing are omitted. A positive partial result does not mean all business payments are covered.
- Distinguish historical reporting period, balance as-of date, and forward planning window. Show exact dates and the observation phase of daily state values where relevant.
- Use **shared inventory** with known contributing locations. An aggregate of unknown physical distribution is labeled aggregate, not invented branch stock.
- Distinguish sales, orders, invoices, collections, provider-pending funds, available cash, and purchasing budget. Distinguish recorded, estimated, assumed, and demo values. A confirmed expected date remains an expectation.
- Define a field before introducing an abbreviation. Preserve useful terms such as SKU, MOQ, lead time, turnover, DIO, GMROI, fill rate, and forecast bias with plain-language help. Use section 23 definitions.
- Explain that high turnover can coexist with poor availability. Do not frame a metric as universally good without its scope and tradeoffs.
- The Spanish onboarding text in section 11 is proposed copy. “Planear la reposición” and “¿Cuándo debería ordenar y cuánto debería pedir?” refer to the same Q-REPLENISH capability. Production localization remains a section 24 decision.

## 23. Metric, time and consistency definitions

This section establishes explicit v0.4 conventions for the metrics used elsewhere in this document. These are authored consistency decisions for this revision, not a recovered section from the earlier source. They define what a displayed value means; they do not make unsupported data, accounting integrations or calculations functional.

### 23.1 Common measurement contract

Every metric identifies its unit/currency, business scope, time window or as-of time, source/run provenance, included population, coverage and calculation version. Ratios also identify numerator and denominator. Comparisons use compatible definitions, units, currency and scope. Do not add different currencies without an explicit supported conversion basis or mix incomparable product units into a misleading total.

Unknown is different from zero. A confirmed absence applies only to its stated category, scope and period. Missing, nonpositive or otherwise invalid denominators produce an unavailable/undefined result with an explanation, rather than an invented zero or infinite score. A partial total names the included subset and is not presented as the business total.

Point-in-time balances use an appropriate as-of observation; flows sum eligible events in the selected period; averages use a stated weighting basis. Do not sum daily balances as though they were flows. Do not annualize a period ratio without explicitly labeling the annualization and its assumptions. Source meanings for amounts, discounts, taxes, returns and costs must be understood and compatible before combining them.

Each daily simulation series stores the run ID, metric key/version, date, scope, value, unit/currency, observation phase, scenario/baseline identity and provenance. Bounds appear only when the engine supports and defines them. An artifact references its exact input/run versions; it does not read mutable current source values when a historical result is reopened.

### 23.2 Daily window and opening state

A simulation uses the business calendar/timezone recorded with the run. Its inclusive window contains `N = end_date − start_date + 1` calendar days, with `1 ≤ N ≤ 365`. Use calendar dates rather than elapsed 24-hour periods when daylight-saving changes affect the clock.

The opening state is the state immediately before modeled events on the start date. The daily closing state is the state after all included events for that date. Every daily series identifies whether it is an opening, closing, minimum-through-day or flow measure; a chart cannot mix these observation phases without labeling them.

A cash or stock snapshot taken at another time must be bridged to the start boundary with traceable movements or an explicit accepted estimate. Disclose bridge gaps and the estimate's scope. A snapshot's date alone does not prove that it represents the start of that day. If the needed boundary cannot be established, the affected absolute-state calculation is unavailable; independently supported flow or budget comparisons can remain usable.

Same-day cash receipts/payments are included in that day's net movement once. The cash curve describes opening and end-of-day positions, not whether receipts cleared before particular payments. Where the order of daily inventory events changes fulfillment or inventory results, the engine must use a disclosed, versioned convention and preserve its event trace. Missing event-time detail must not be presented as known intraday sequence.

### 23.3 Cash projection, floor, gap and reserve

Use one currency and cash scope for a projection. Let `C0` be available opening cash; `I(d)` and `O(d)` be included inflows and outflows for day `d`; and `C(d)` be closing available cash:

`C(d) = C(previous day) + I(d) − O(d)`

For the first day, the previous state is `C0`. Only events after the opening snapshot boundary and within the window enter the curve. Exclude receipts/payments already reflected in `C0`. Linked orders, invoices, advances, provider-pending balances and their settlement/collection events describe one underlying flow and must not be counted repeatedly.

| Metric | Definition and display rule |
| --- | --- |
| Daily net cash movement | `I(d) − O(d)`, in the projection currency; a flow. |
| Daily closing cash | `C(d)`, in the projection currency; a dated end-of-day balance. |
| Cash floor / minimum balance | Minimum of the opening balance and all included daily closing balances. Display its date and whether it is the opening or closing observation; if tied, display the earliest occurrence. |
| First cash gap | Earliest included opening/closing observation below zero. Gap amount is the positive amount required to bring that observation to zero. If the opening balance is negative, identify the gap as present at the start boundary. |
| Maximum modeled zero-cash deficit | `max(0, −cash_floor)`. This is distinct from the amount at the first gap and represents the constant additional opening liquidity needed to keep recorded observation points nonnegative, assuming other modeled flows do not change. |
| Headroom above zero | The cash floor, in currency. Label a negative value as a shortfall; do not imply intraday payment clearance from a nonnegative value. |
| Reserve headroom | `cash_floor − R`, where `R` is the nonnegative reserve explicitly selected by the owner for the same currency/scope/window. |
| Additional liquidity to preserve reserve | `max(0, R − cash_floor)`. This models a constant additional opening amount under unchanged flows, not a confirmed credit facility or recommendation. Without a selected reserve, show only zero-cash metrics. |

Daily snapshots cannot identify every intraday gap. A nonnegative curve means no gap at its recorded daily observation points for included events. It does not certify complete coverage of obligations, their payment priority, access to financing or timely clearing. A negative balance identifies a modeled shortfall; identifying which specific obligation would go unpaid additionally requires an explicit payment-priority assumption. Otherwise list obligations around the gap without claiming a unique allocation of the shortfall.

Every projection includes a category-coverage review for customer receipts, supplier payments, payroll, rent, taxes, financing and other relevant commitments. Unknown or unscheduled material categories produce a visible partial-projection label. An undated pending amount remains unscheduled unless the user accepts a date assumption. Amounts expected after the horizon remain outstanding outside it.

### 23.4 Purchasing budget and financial balances

| Metric/concept | Definition and guard |
| --- | --- |
| Purchasing-budget spend | Included proposed/committed purchases on the budget's declared basis, in its currency/scope/period. State whether the budget is assessed at order commitment or payment; use the same basis for every compared scenario. |
| Budget headroom / breach | Budget amount minus included budget spend; a negative result is a budget breach. Budget does not establish opening cash, cash floor or liquidity sufficiency. |
| Customer receivable outstanding | Original customer amount still owed after linked payments, credits or adjustments actually represented in the supported data. An advance reduces its linked pending amount; it is not new revenue. |
| Provider-pending availability | Customer funds reported collected but not yet available for the business to use, distinct from still-unpaid receivables. Count a linked amount in the appropriate stage once. Availability dates are expectations unless recorded as actual. |
| Internal Debt | Customer-originated outstanding/pending amounts under the product label, with unpaid and provider-pending stages visible. Totals deduplicate linked stages and identify their coverage. |
| External Debt | Confirmed supplier amounts still owed. Expected recurring commitments that have not created a payable are separate and never inflate confirmed outstanding totals. |
| Financing Debt | Recorded financing balances and known repayment events; separate from supplier payables. Do not infer missing interest, principal allocation or future installments. |
| Overdue amount | The outstanding amount with a usable due date strictly before the as-of date, unless a supplied contractual convention explicitly changes that boundary. Still-owed amounts due today are due, not overdue. Unknown due dates remain unclassified. |
| Aging | Calendar days since the named reference event, such as due date for overdue receivables/payables or order date for an open purchase. Label the reference event and the chosen bucket boundaries. Do not mix different aging bases. |
| Customer/supplier concentration | Counterparty amount divided by the compatible total for the same balance/flow measure, currency, scope and date/period. Expose unknown-counterparty coverage and do not treat a partial denominator as the complete business. |

Sales, orders, invoices, collections and available cash remain distinct. A purchase order and its resulting payable may describe the same obligation; recurring expectations must be reconciled to their confirmed realization before totals or cash events are combined. Actual fulfillment of a supplier commitment does not establish that it was paid.

### 23.5 Inventory, margin and capital-efficiency metrics

| Metric | Definition, unit and required basis |
| --- | --- |
| On-hand stock | Physical recorded units in the stated SKU/location or declared pool at an as-of time. Negative source values remain visible as exceptions, not silently repaired. |
| Available stock | On-hand units less the quantities unavailable for new demand under the declared reservation/hold policy. Included deductions must be known and disjoint; missing reservation information is not automatically zero. |
| Inventory position | On-hand plus eligible on-order supply minus outstanding unfulfilled demand under the disclosed policy. Reservations/backorders representing the same demand are counted once. State whether inbound or transfer quantities are eligible. |
| Inventory value | Included stock quantity multiplied by compatible per-unit cost, summed only over the valued subset. Specify the stock state and cost basis; missing cost prevents valuation of that subset. This is not immediately available cash. |
| Average inventory value | Time-weighted average of inventory at cost over the selected period using supported observations and a stated method. Sparse snapshots may support a labeled approximation; they do not establish exact daily values or silently justify interpolation. |
| Sales revenue | Compatible sales amounts for the selected scope/period on a disclosed amount basis. Quantity times price is an estimate only when explicitly supported; amounts alone do not establish units or collections. |
| Gross profit | Compatible sales revenue minus cost of goods sold for the same sold units/scope/period, in currency. Gross profit is not net profit or cash. |
| Gross margin rate | Gross profit divided by compatible sales revenue, multiplied by 100. Require a positive denominator and disclose uncovered products/costs. |
| Inventory turnover | Period cost of goods sold divided by average inventory at cost for the same scope/period. Unit: turns per selected period. Both numerator and denominator need compatible costs. |
| Days inventory outstanding (DIO) | Average inventory at cost divided by period cost of goods sold, multiplied by the number of calendar days in that period. Unit: days. Require positive cost of goods sold and nonnegative, compatible average inventory; a confirmed zero numerator can yield zero DIO. Do not substitute 365 for the selected period without explicit annualization. |
| GMROI | Period gross profit divided by average inventory at cost. Unit: currency of gross profit per currency invested, for the selected period. Require positive average inventory and compatible cost coverage. |
| Days of supply | Available quantity divided by a positive stated average daily demand rate for a defined reference window; unit: days. Label historical-rate versus modeled-forecast basis. Unknown or zero demand does not produce an invented finite value. For variable future demand, a modeled depletion date may be shown separately with its method instead of presenting it as this ratio. |
| Aged inventory | Stock quantity/value assigned to age bands from supported receipt/age information, with the as-of date and age basis visible. An age inference is labeled. |
| Excess inventory | Positive quantity above a defined user/scenario target for the same scope/time; value requires compatible cost. Unknown target means excess cannot be calculated. Aged, slow-moving and excess inventory are not interchangeable. |
| Slow-moving inventory | Stock identified using an explicitly stated movement/demand window and threshold; no universal threshold is invented by this spec. |
| Estimated lost margin | Modeled or estimated lost units multiplied by compatible unit gross margin, with estimation method and scope visible. It is not observed lost revenue or guaranteed recoverable profit. |

Turnover, DIO and GMROI are period measures. High turnover alone does not establish good service or profitability. Historical dashboards use a historical demand-rate basis for days of supply; demand-forecast values and model-specific diagnostics remain in Forecast & Simulate.

### 23.6 Service, stockout and supplier measures

| Metric | Definition and denominator |
| --- | --- |
| Unit fill rate | Units fulfilled on the defined initial/requested service basis divided by units requested on that same basis, × 100. Require requested-demand data; later fulfillment of backorders does not retroactively change an initial-fill measure. Name the fulfillment deadline/basis. |
| Line/order fill rate | Eligible lines/orders fully fulfilled according to the stated service deadline divided by all eligible requested lines/orders, × 100. State whether the counting unit is lines or orders. Do not substitute a unit-weighted rate. |
| In-stock rate | Supported observations with positive available stock divided by eligible stock observations, × 100. State the observation frequency and population. A daily closing-stock rate is not continuous or intraday availability. Unknown days are disclosed rather than classified as in or out of stock. |
| Zero-stock days/duration | Count of eligible daily observations with zero available units, with the observation phase stated; distinguish negative-stock exceptions. With daily-only data this is a count of observed daily states, not a precise intraday outage duration. |
| Unmet-demand days/units | Days with requested demand not fulfilled under the declared timing convention, and the corresponding unfulfilled units. Zero closing stock alone does not prove unmet demand, and positive closing stock does not rule out an earlier fulfillment failure. |
| Lost units versus backorders | Unfulfilled demand classified by an explicit model/source rule as abandoned/lost or carried as a pending order. The same unit is not simultaneously both. A daily new-backorder flow is distinct from the outstanding backorder balance. |
| Backorder age | Elapsed calendar days since the unfulfilled request's stated service/reference date for units still pending. Partial fulfillment updates the remaining pending quantity without changing the source request date. |
| Service-target attainment | Compare the calculated service measure with an owner-selected target for the identical definition and scope. No target or compatible service data means no attainment claim. |
| Supplier on-time rate | Eligible promised delivery units, lines or orders delivered by their promised deadline divided by the corresponding eligible due population, × 100. Name the counting unit, partial-delivery treatment, exclusions and cutoff; overdue undelivered items must not disappear silently. |
| Supplier in-full rate | Eligible deliveries/orders meeting the defined promised quantity divided by the eligible delivery/order population, × 100. Specify evaluation deadline and counting unit. Quantity completeness is distinct from timeliness. |
| On-time/in-full rate | Eligible items satisfying both defined conditions divided by the same eligible population, × 100. Do not average separate on-time and in-full percentages or imply identical denominators without checking. |
| Observed supplier lead time | Calendar days from the specified starting event, such as accepted order or required payment, to the specified receipt event. Quoted lead time remains a separate supplied value. Partial receipts retain their own event dates. |
| Lead-time variability | A named statistic over eligible observed lead times, with sample size, period and supplier/product scope. Missing observations and assumed delays do not become historical measurements. |
| Supplier/history coverage | Count or share of eligible suppliers/orders with the required observations, with that population explicitly named. Coverage is not a reliability score. |
| Recurring commitment fulfillment | Status of the expected supplier period based on a linked realization or explicit confirmation. Unknown fulfillment is not converted to not fulfilled; fulfilled does not mean paid. |

An engine calculating service consequences must declare its handling of same-day receipts/demand, partial fulfillment, lost sales and backorders. These choices are saved with the run. A supplier-delay assumption can change modeled outcomes without changing historical supplier reliability.

### 23.7 Comparisons and forecast diagnostics

An absolute scenario delta is `alternative − baseline` in the metric's unit. A percentage change is `(alternative − baseline) / baseline × 100` only when the baseline is positive and the comparison is meaningful; otherwise show the absolute delta and explain why percentage change is unavailable. Differences between percentage-valued rates are labeled percentage points. Zero is a valid baseline value, but not a valid denominator for a percentage-change formula.

Comparable results pin completed run IDs and use compatible scope, dates, units, cadence and metric definitions. If the changed forecast/event basis is the experiment, identify it explicitly. Results do not choose a winner automatically.

Forecast error/bias, uncertainty and validation metrics require a named formula, units, evaluated dates, eligible observations and documented treatment of zeros/missing values. The implementation must state its sign convention for bias. No universal metric, confidence level or calibrated probability is implied by this spec. Show such diagnostics only when genuinely available, only within Forecast & Simulate, and never label synthetic evaluation as user-data validation.

## 24. Remaining decisions and implementation handoff

Open choices are grouped by the point at which they must be resolved. They do not authorize a functional build to invent missing inputs or silently choose conflicting calculation semantics. Sections 9, 10, 16, 19, and 23 establish the minimum product contract already decided here.

### 24.1 Before an affected feature is presented as functional

| Decision | Required resolution |
|---|---|
| Functional question/model coverage | Name the supported paths and cases; retain honest demo/unsupported states for the remainder. New order, replenishment, and critical collection remain priority workflows. |
| Advanced forecast family | Choose LightGBM, CatBoost, or both; document training/execution behavior, exact required history/driver structure, and known limitations before enabling actual runs. |
| Input schemas | Define file/sheet types, manual fields, units, date/number formats, currencies, row limits, and sales amount meanings. Align them with the per-output minimums in section 10. |
| Record identity and re-imports | Define deterministic product/order/invoice/payment/import identifiers, partial allocations, duplicate handling, and reversals. Preserve canonical links and avoid invoice/provider or payable/order duplication. |
| Demand and time alignment | Implement the section 16 daily-input and forecast/order-overlap contracts. Version the supported allocation/reconciliation method and reject unsupported combinations rather than inventing demand. |
| Engine event conventions | Specify the order of modeled inventory events, reservation/backorder/lost-demand behavior, rounding, and supported supply constraints. Apply section 23 cash opening/EOD rules. More detailed intraday behavior is not assumed. |
| Cost and metric support | Identify the cost basis and required components for each economic result, with compatible units/periods and disclosed exclusions. Implement section 23 definitions; do not label gross margin as net profit. |
| Worker execution | Choose queue/worker technology, concurrency, timeout/stale-job handling, cancellation support, and internal attempt policy while preserving section 16.7 observable behavior. |
| Result retrieval | Choose polling/SSE/websockets or a hybrid, resource payloads, and result-size limits that retain exact dates, versioned inputs, and durable artifacts. |
| Assumptions and source snapshots | Implement durable input snapshots or immutable versioned references, explicit baseline_run_id, and declared question/metric/engine contract versions. |
| Data-quality severities | Define coverage/freshness/history thresholds per capability. Thresholds cannot convert missing indispensable inputs into usable data or suppress material result disclosures. |

Fixtures can demonstrate a proposed convention, but their behavior does not constitute validation of a functional engine.

### 24.2 Before extending beyond the prototype boundary

- Decide general business-record persistence, account ownership, cross-device behavior, privacy, deletion, audit, access control, and recovery before accepting production use.
- Select retention periods, archival/deletion permissions, result-size limits, and the treatment of referenced baselines/dependencies. Do not silently invalidate retained runs through source cleanup.
- Decide which inventory mutations become functional first: receipts, sales, returns, transfers, adjustments, or cycle counts. Define source reversals, negative values, refunds, cancellations, and stock corrections for each supported dataset.
- Define richer shared-pool allocation and aggregate-to-location migration if needed. Advanced routing/allocation is still outside the current MVP.
- Specify production Standardization audit and reversal behavior, including treatment of references held by immutable historical runs.
- Choose roles and permissions beyond the administrator-only stage and define live account enforcement.
- Define production recurring-obligation schedules and partial-payment allocation, including incomplete schedules and transition from expected commitment to confirmed payable.
- Choose the first live integration category, if any. Any payment-provider integration remains server-side behind normalized objects; transaction execution requires separately expanded scope.
- Define production accessibility, Spanish/localization conventions, currency precision, date formatting, timezone configuration, and unit conversion. A functional calculation still requires an explicit compatible working currency, unit basis, and business calendar before these broader conventions are finalized.

### 24.3 Future visualization, explanations, and modeling

The current question/asset vocabulary and scene behavior are defined in section 16.9. Actual geometry, camera/interaction behavior, animation, visual encodings, and renderer accessibility remain future work. Extending scenes to exploratory mode requires an explicit bounded asset policy; it cannot infer arbitrary assets from free text.

Live LLM integration is explicitly deferred. A future decision must define its inputs, evidence-linked explanation behavior, provenance, evaluation, and failure handling. It may explain simulator results without owning numerical truth. Automated business recommendations or actions require a separate scope decision; they are not implied by adding an LLM explanation layer.

Future calibrated intervals, probabilities, default-risk models, uncertainty propagation, model hierarchy reconciliation, optimization, or horizons beyond 365 days require specified methods and validation. Current deterministic scenarios and user-entered ranges do not establish those capabilities.

### 24.4 Product validation

Choose the initial user-test subset of the section 16.8 question registry and the detailed cases to exercise. Determine the ordering of question-specific metrics without removing required primary detail. Measure time to first supported result, journey completion/deferral, mapping corrections, useful scenario comparisons, and lead time of detected cash gaps. No numeric success target or claimed business impact has been validated by the supplied materials.

### 24.5 Handoff and traceability

The implementation specification must map each retained section 20 requirement ID to its canonical behavior and relevant section 21 acceptance cases. Shared definitions belong in their canonical section; workflows and acceptance cases reference them. A product change updates the canonical rule, affected IDs, and acceptance cases together.

Keep ONB-03 retired. Do not reuse an existing identifier for opposite behavior. When expanding scope or changing the consistency conventions introduced in v0.4, record the decision and resulting version rather than silently altering historical calculation meaning.

---

End of consolidated precursor document — Samby v0.4.
