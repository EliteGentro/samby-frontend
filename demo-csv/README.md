# Samby mock showcase CSVs

Import the files in this order so cross-file purchase and invoice references can be linked:

1. `01-inventory-costs.csv`
2. `02-sales.csv`
3. `03-purchasing-suppliers.csv`
4. `04-finance-collections.csv`

These files are generated directly from `demoWorkspace()` in
`src/domain/workspace.ts`; they do not introduce a second set of invented demo
facts. Together they export its 6 products, 12 location-level stock positions,
540 sales rows, 3 suppliers, 6 purchases and 9 financial records in MXN.
Regenerate and verify them after changing the fixture with `npm run demo:csv`.

The existing mock SKU ` ofc 002 ` is intentionally retained in the source CSV
so Inventory → Standardize SKUs can demonstrate its cleanup proposal. The CSV
review preserves the original cell, while the imported working reference is
trimmed to `ofc 002` before standardization.

The files focus on the four core import categories. Existing advanced mock
observations—shared inventory pools, movements, daily inventory history,
service observations, receipt-age layers, payment terms, the cash snapshot,
budget, coverage and recurring commitments—remain separate owner-confirmed
record types and are not flattened into these core templates.
