import { SelectField } from '../../components/ui/select-field'
import { SortableTable } from '../../components/SortableTable'
import { InventoryGraphsPanel } from './InventoryGraphsPanel'
import type { Page } from '../../domain/workspace'
import type { Dispatch, SetStateAction } from 'react'
import { TableHead } from '../../components/workspace-ui'
import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { Standardization } from './Standardization'
import { AgingInventoryPanel } from './HistoricalMetrics'
import { useState, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  Boxes,
  Download,
  Package,
  Plus,
  Search,
  WandSparkles,
} from 'lucide-react'
import {
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  Tabs,
} from '../../components/workspace-ui'
import {
  availability,
  cutoff,
  money,
  number,
  type Movement,
  type Product,
  type Workspace,
} from '../../domain/workspace'
import { stockValue } from '../../domain/selectors'
import { InventoryPools, ReconciliationExceptions } from './InventoryPools'
import { CapabilityDisplay } from '../../components/workspace-ui'
import type { BusinessPageProps } from './Home'

export function Inventory({
  workspace: w,
  onChange,
  onNavigate,
  onIntake,
  initialFilter,
}: BusinessPageProps & { initialFilter?: string }) {
  const { canEdit } = useWorkspaceAccess(),
    editable = canEdit('inventory')
  const [search, setSearch] = useState(''),
    [location, setLocation] = useState(''),
    [tab, setTab] = useState(
      initialFilter === 'low' ? 'Below reorder point' : 'Products',
    )
  const [selected, setSelected] = useState<Product | null>(null),
    [standardize, setStandardize] = useState(false),
    [movement, setMovement] = useState(false)
  const products = w.products.filter((p) =>
    `${p.name} ${p.sku} ${p.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const value = stockValue(w, location)
  const low = w.products.filter(
    (p) =>
      p.reorderPoint !== null &&
      availability(w, p.id, location) !== null &&
      availability(w, p.id, location)! < p.reorderPoint,
  )
  const shown =
    tab === 'Below reorder point'
      ? products.filter((p) => low.some((l) => l.id === p.id))
      : products
  function exportCsv() {
    const rows = [
      ['SKU', 'Product', 'Unit', 'Available', 'Location scope'],
      ...shown.map((p) => [
        p.sku,
        p.name,
        p.unit,
        availability(w, p.id, location) === null
          ? 'Unknown'
          : String(availability(w, p.id, location)),
        location || 'All supplied positions',
      ]),
    ]
    const blob = new Blob(
      [
        rows
          .map((row) =>
            row.map((v) => `"${v.replaceAll('"', '""')}"`).join(','),
          )
          .join('\n'),
      ],
      { type: 'text/csv' },
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = 'samby-inventory.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageHeader
        title="Inventory"
        action={
          <>
            <CapabilityDisplay id="standardization">
              <button
                className="button secondary"
                disabled={!canEdit('settings')}
                onClick={() => setStandardize(true)}
              >
                <WandSparkles size={17} />
                Standardize SKUs
              </button>
            </CapabilityDisplay>
            <button
              className="button primary"
              disabled={!editable}
              onClick={() => onIntake('inventory')}
            >
              <Plus size={17} />
              Add inventory
            </button>
          </>
        }
      />
      {w.products.length ? (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Products in your catalog"
              value={number(w.products.length)}
              note={`${new Set(w.products.map((p) => p.category)).size} recorded categories`}
              icon={<Package size={17} />}
            />
            <MetricCard
              label="Known locations"
              value={number(w.locations.length)}
              note={`${w.stock.filter((s) => !s.locationId).length} positions with aggregate scope`}
              icon={<Boxes size={17} />}
            />
            <MetricCard
              capability="inventory-value"
              label="Inventory at cost"
              value={money(value.value, w.profile.currency)}
              note={`${value.count} of ${value.total} on-hand positions valued · ${value.dateLabel}`}
            />
            <MetricCard
              capability="stock"
              label="Below reorder point"
              value={number(low.length)}
              note="Compared with recorded product thresholds"
            />
          </div>
          <InventoryPanel
            w={w}
            editable={editable}
            setMovement={setMovement}
            exportCsv={exportCsv}
            tab={tab}
            setTab={setTab}
            search={search}
            setSearch={setSearch}
            location={location}
            setLocation={setLocation}
            onIntake={onIntake}
            shown={shown}
            setSelected={setSelected}
          />
        </>
      ) : (
        <EmptyState
          title="Your inventory starts with one product"
          description="Add an identifiable product, quantity and stock date. You can add costs and locations later."
          action={
            <button
              className="button primary"
              disabled={!editable}
              onClick={() => onIntake('inventory')}
            >
              Add your first product
            </button>
          }
          icon={<Package size={28} />}
        />
      )}
      <ProductDetailsDialog
        selected={selected}
        setSelected={setSelected}
        w={w}
        onIntake={onIntake}
        onNavigate={onNavigate}
      />
      <Modal
        open={movement}
        onClose={() => setMovement(false)}
        title="Record an inventory movement"
        description="This updates saved inventory records after confirmation. It does not execute a physical warehouse action."
        wide
      >
        <MovementForm
          workspace={w}
          onChange={onChange}
          onClose={() => setMovement(false)}
        />
      </Modal>
      <Modal
        open={standardize}
        onClose={() => setStandardize(false)}
        title="Review SKU Standardization"
        description="Opt-in suggestions keep product identities intact. No products are automatically merged."
        wide
      >
        <Standardization
          workspace={w}
          onChange={onChange}
          onClose={() => setStandardize(false)}
        />
      </Modal>
    </>
  )
}

function MovementForm({
  workspace: w,
  onChange,
  onClose,
}: {
  workspace: Workspace
  onChange: (w: Workspace) => void
  onClose: () => void
}) {
  const { canEdit } = useWorkspaceAccess(),
    editable = canEdit('inventory')
  const [type, setType] = useState<Movement['type']>('receipt'),
    [error, setError] = useState('')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editable) return
    const f = new FormData(e.currentTarget),
      productId = String(f.get('product')),
      from = String(f.get('from')),
      to = String(f.get('to')),
      quantity = Number(f.get('quantity'))
    const source = w.stock.find(
      (s) => s.productId === productId && s.locationId === from,
    )
    if (
      !Number.isFinite(quantity) ||
      quantity === 0 ||
      (type !== 'adjustment' && quantity < 0)
    ) {
      setError('Enter a valid nonzero quantity.')
      return
    }
    if (
      type === 'transfer' &&
      (from === to ||
        !source ||
        availability(w, productId, from) === null ||
        availability(w, productId, from)! < quantity)
    ) {
      setError(
        'Choose distinct locations with enough recorded available stock.',
      )
      return
    }
    if (
      w.stock.some(
        (s) =>
          s.productId === productId &&
          ((s.locationId === null && to !== '') ||
            (s.locationId !== null && to === '')),
      )
    ) {
      setError(
        'Reconcile aggregate and location stock before recording this movement. The same stock cannot be counted in both scopes.',
      )
      return
    }
    const stock = w.stock.map((s) => ({ ...s }))
    const target = stock.find(
      (s) => s.productId === productId && s.locationId === (to || null),
    )
    if (type === 'adjustment' && (!target || target.onHand + quantity < 0)) {
      setError(
        'The adjustment needs a recorded position and cannot create a negative quantity.',
      )
      return
    }
    if (type === 'transfer') {
      const origin = stock.find((s) => s.id === source?.id)!
      origin.onHand -= quantity
      origin.asOf = cutoff(w)
    }
    if (target) {
      target.onHand += quantity
      target.asOf = cutoff(w)
    } else
      stock.push({
        id: crypto.randomUUID(),
        productId,
        locationId: to || null,
        onHand: quantity,
        reserved: 0,
        asOf: cutoff(w),
        quantityBasis: 'on-hand',
      })
    const record: Movement = {
      id: crypto.randomUUID(),
      productId,
      date: cutoff(w),
      type,
      quantity,
      fromLocationId: type === 'transfer' ? from : null,
      toLocationId: to || null,
      reason: String(f.get('reason')),
    }
    onChange({
      ...w,
      revision: w.revision + 1,
      stock,
      movements: [record, ...w.movements],
    })
    onClose()
  }
  if (!w.products.length)
    return (
      <EmptyState
        title="Add a product first"
        description="A movement needs an identifiable product and a compatible unit."
      />
    )
  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <label className="field">
          Movement
          <SelectField
            value={type}
            onChange={(e) => setType(e.target.value as Movement['type'])}
          >
            <option value="receipt">Receipt</option>
            <option value="transfer">Transfer</option>
            <option value="adjustment">Adjustment</option>
          </SelectField>
        </label>
        <label className="field">
          Product
          <SelectField name="product">
            {w.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.unit}
              </option>
            ))}
          </SelectField>
        </label>
        {type === 'transfer' && (
          <label className="field">
            From location
            <SelectField name="from" required>
              {w.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          </label>
        )}
        <label className="field">
          {type === 'transfer' ? 'To location' : 'Location'}
          <SelectField name="to">
            <option value="">Aggregate · unknown location</option>
            {w.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        </label>
        <label className="field">
          Quantity
          <input
            name="quantity"
            type="number"
            required
            step="1"
            min={type === 'adjustment' ? undefined : 1}
          />
          <small>
            {type === 'adjustment'
              ? 'Signed quantity to add or remove.'
              : 'Quantity in the selected product unit.'}
          </small>
        </label>
      </div>
      <label className="field">
        Reason
        <input
          name="reason"
          required
          placeholder="Describe the recorded movement"
        />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={!editable}>
          Confirm inventory movement
        </button>
      </div>
    </form>
  )
}

export { Standardization } from './Standardization'

function ProductDetailsDialog({
  selected,
  setSelected,
  w,
  onIntake,
  onNavigate,
}: {
  selected: Product | null
  setSelected: Dispatch<SetStateAction<Product | null>>
  w: Workspace
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  onNavigate: (page: Page, query?: string) => void
}) {
  return (
    <Modal
      open={selected !== null}
      onClose={() => setSelected(null)}
      title={selected?.name ?? 'Product detail'}
      description="Recorded stock and purchasing context. Unknown values remain unknown."
      wide
    >
      {selected && (
        <>
          <div className="detail-meta">
            <span className="badge">{selected.sku}</span>
            <span>
              {selected.category} · {selected.unit}
            </span>
          </div>
          <div className="metrics-grid compact">
            <MetricCard
              label="Unit cost"
              value={money(selected.cost, w.profile.currency)}
              note="Recorded cost basis"
            />
            <MetricCard
              label="Selling price"
              value={money(selected.price, w.profile.currency)}
              note="Recorded unit price"
            />
          </div>
          <div className="table-wrap">
            <SortableTable
              className="data-table"
              tableLabel="Inventory position locations"
            >
              <TableHead
                headers={[
                  'Location',
                  'Quantity basis',
                  'Quantity',
                  'Reserved',
                  'Backordered',
                  'As of',
                ]}
              />
              <tbody>
                {w.stock
                  .filter((s) => s.productId === selected.id)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        {w.locations.find((l) => l.id === s.locationId)?.name ??
                          'Aggregate · unknown location'}
                      </td>
                      <td>{s.quantityBasis ?? 'on-hand'}</td>
                      <td>{number(s.onHand)}</td>
                      <td>
                        {s.reserved === null ? 'Unknown' : number(s.reserved)}
                      </td>
                      <td>
                        {s.backordered == null
                          ? 'Unknown'
                          : number(s.backordered)}
                      </td>
                      <td>{s.asOf}</td>
                    </tr>
                  ))}
              </tbody>
            </SortableTable>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Supplier</dt>
              <dd>
                {w.suppliers.find((s) => s.id === selected.supplierId)?.name ??
                  'Not provided'}
              </dd>
            </div>
            <div>
              <dt>Lead time</dt>
              <dd>
                {selected.leadTimeDays === null
                  ? 'Not provided'
                  : `${selected.leadTimeDays} days from order`}
              </dd>
            </div>
            <div>
              <dt>Minimum order / case pack</dt>
              <dd>
                {selected.moq ?? 'Unknown'} / {selected.casePack ?? 'Unknown'}
              </dd>
            </div>
            <div>
              <dt>Safety stock / reorder point</dt>
              <dd>
                {selected.safetyStock ?? 'Unknown'} /{' '}
                {selected.reorderPoint ?? 'Unknown'}
              </dd>
            </div>
            <div>
              <dt>Recorded service target</dt>
              <dd>
                {selected.serviceTarget === null
                  ? 'Unknown'
                  : `${selected.serviceTarget}% of requested units fulfilled`}
              </dd>
            </div>
          </dl>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => {
                setSelected(null)
                onIntake('inventory')
              }}
            >
              Add or update data
            </button>
            <button
              className="button primary"
              onClick={() => {
                setSelected(null)
                onNavigate('analysis', 'question=Q-REPLENISH')
              }}
            >
              Explore replenishment
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function ProductStockTable({
  shown,
  w,
  location,
  setSelected,
}: {
  shown: Product[]
  w: Workspace
  location: string
  setSelected: Dispatch<SetStateAction<Product | null>>
}) {
  return (
    <div className="table-wrap">
      <SortableTable
        className="data-table"
        defaultOpen
        tableLabel="Inventory positions"
      >
        <TableHead
          headers={[
            'Product',
            'Category',
            'Available',
            'On order · business scope',
            'Unit cost',
            'Status',
          ]}
        />
        <tbody>
          {shown.map((p) => {
            const units = availability(w, p.id, location)
            const has = units !== null
            return (
              <tr key={p.id}>
                <td>
                  <button
                    className="product-cell row-button"
                    onClick={() => setSelected(p)}
                  >
                    <span className="product-icon">
                      <Package size={19} />
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.sku}</small>
                    </span>
                  </button>
                </td>
                <td>{p.category || 'Not provided'}</td>
                <td className="numeric">
                  {has ? number(units!) : 'Unknown'} <small>{p.unit}</small>
                </td>
                <td className="numeric">
                  {w.purchases.some((o) => o.productId === p.id)
                    ? number(
                        w.purchases
                          .filter((o) => o.productId === p.id)
                          .reduce(
                            (s, o) =>
                              s + Math.max(0, o.quantity - o.receivedQuantity),
                            0,
                          ),
                      )
                    : 'Not provided'}
                </td>
                <td className="numeric">{money(p.cost, w.profile.currency)}</td>
                <td>
                  <span
                    className={`badge ${has && p.reorderPoint !== null && units! < p.reorderPoint ? 'amber' : has ? 'green' : ''}`}
                  >
                    {!has
                      ? 'Stock not provided'
                      : p.reorderPoint === null
                        ? 'No threshold'
                        : units! < p.reorderPoint
                          ? 'Below reorder point'
                          : 'Above reorder point'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </SortableTable>
    </div>
  )
}

function InventoryPanel({
  w,
  editable,
  setMovement,
  exportCsv,
  tab,
  setTab,
  search,
  setSearch,
  location,
  setLocation,
  onIntake,
  shown,
  setSelected,
}: {
  w: Workspace
  editable: boolean
  setMovement: Dispatch<SetStateAction<boolean>>
  exportCsv: () => void
  tab: string
  setTab: Dispatch<SetStateAction<string>>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  location: string
  setLocation: Dispatch<SetStateAction<string>>
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  shown: Product[]
  setSelected: Dispatch<SetStateAction<Product | null>>
}) {
  return (
    <Panel
      title="Your inventory"
      subtitle={`Current stock snapshots · working currency ${w.profile.currency}`}
      action={
        <div className="inline-actions">
          <button
            className="button secondary"
            disabled={!editable}
            onClick={() => setMovement(true)}
          >
            <ArrowRightLeft size={16} />
            Record movement
          </button>
          <button
            className="icon-button"
            aria-label="Export displayed inventory CSV"
            onClick={exportCsv}
          >
            <Download size={18} />
          </button>
        </div>
      }
    >
      <div className="table-toolbar">
        <Tabs
          tabs={[
            'Products',
            'Below reorder point',
            'Analytics & graphs',
            'Locations',
            'Shared pools',
            'Movements',
            'Age & excess',
            'Exceptions',
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="table-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search inventory"
              placeholder="Search product or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <SelectField
            aria-label="Inventory location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">All locations</option>
            {w.locations.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <InventoryContents
        tab={tab}
        w={w}
        location={location}
        onIntake={onIntake}
        setLocation={setLocation}
        setTab={setTab}
        shown={shown}
        setSelected={setSelected}
      />
      <p className="panel-footnote">
        Available quantities retain their source basis. Unknown reservations are
        not treated as zero. Dates are shown in product detail. Open purchases
        have unallocated business scope. Unknown or overlapping quantities
        cannot enter availability totals.
      </p>
    </Panel>
  )
}

function InventoryContents({
  tab,
  w,
  location,
  onIntake,
  setLocation,
  setTab,
  shown,
  setSelected,
}: {
  tab: string
  w: Workspace
  location: string
  onIntake: (
    section?: 'sales' | 'inventory' | 'finance' | 'suppliers' | 'profile',
  ) => void
  setLocation: Dispatch<SetStateAction<string>>
  setTab: Dispatch<SetStateAction<string>>
  shown: Product[]
  setSelected: Dispatch<SetStateAction<Product | null>>
}) {
  if (tab === 'Analytics & graphs')
    return (
      <InventoryGraphsPanel
        workspace={w}
        location={location}
        onSelectLocation={setLocation}
      />
    )
  if (tab === 'Age & excess')
    return (
      <AgingInventoryPanel
        workspace={w}
        asOf={cutoff(w)}
        location={location}
        onIntake={() => onIntake('inventory')}
      />
    )
  if (tab === 'Shared pools')
    return <InventoryPools workspace={w} onAdd={() => onIntake('inventory')} />
  if (tab === 'Exceptions')
    return (
      <ReconciliationExceptions
        workspace={w}
        onReview={() => onIntake('inventory')}
      />
    )
  if (tab === 'Movements')
    return w.movements.length ? (
      <div className="table-wrap">
        <SortableTable
          className="data-table"
          tableLabel="Inventory movements"
        >
          <TableHead
            headers={['Date', 'Product', 'Movement', 'Quantity', 'Reason']}
          />
          <tbody>
            {w.movements.map((m) => (
              <tr key={m.id}>
                <td>{m.date}</td>
                <td>{w.products.find((p) => p.id === m.productId)?.name}</td>
                <td>{m.type}</td>
                <td>{number(m.quantity)}</td>
                <td>{m.reason}</td>
              </tr>
            ))}
          </tbody>
        </SortableTable>
      </div>
    ) : (
      <EmptyState
        title="No recorded movements yet"
        description="Record a receipt, transfer or adjustment to demonstrate stock changes. These actions do not execute a real warehouse operation."
      />
    )
  if (tab === 'Locations')
    return (
      <div className="location-grid">
        {w.locations.map((l) => (
          <article key={l.id} className="location-card">
            <Boxes size={22} />
            <h3>{l.name}</h3>
            <p>
              {w.stock.filter((s) => s.locationId === l.id).length} recorded
              product positions
            </p>
            <button
              className="text-button"
              onClick={() => {
                setLocation(l.id)
                setTab('Products')
              }}
            >
              View stock
            </button>
          </article>
        ))}
        {w.stock.some((s) => s.locationId === null) && (
          <article className="location-card">
            <h3>Aggregate · location unknown</h3>
            <p>These quantities are not assigned to invented locations.</p>
          </article>
        )}
      </div>
    )
  if (shown.length)
    return (
      <ProductStockTable
        shown={shown}
        w={w}
        location={location}
        setSelected={setSelected}
      />
    )
  return (
    <EmptyState
      title="No matching products"
      description="Try a different product, SKU or location filter."
    />
  )
}
