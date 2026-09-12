import { useWorkspaceAccess } from '../../components/workspace-access-context'
import { Standardization } from './Standardization'
import { AgingInventoryPanel } from './HistoricalMetrics'
import { SortableTable } from '../../components/SortableTable'
import { useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRightLeft,
  BarChart2,
  Boxes,
  Clock,
  Download,
  Layers,
  Package,
  PieChart,
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

function InventoryGraphsPanel({
  workspace: w,
  location,
  onSelectLocation,
}: {
  workspace: Workspace
  location: string
  onSelectLocation: (locId: string) => void
}) {
  const [metric, setMetric] = useState<'value' | 'units'>('value')

  const categoryStats = useMemo(() => {
    const map = new Map<string, { value: number; units: number; count: number }>()
    for (const p of w.products) {
      const cat = p.category || 'Uncategorized'
      const avail = availability(w, p.id, location) ?? 0
      const cost = p.cost ?? 0
      const existing = map.get(cat) ?? { value: 0, units: 0, count: 0 }
      map.set(cat, {
        value: existing.value + avail * cost,
        units: existing.units + avail,
        count: existing.count + 1,
      })
    }
    const entries = Array.from(map.entries()).map(([name, s]) => ({ name, ...s }))
    const totalVal = entries.reduce((s, e) => s + e.value, 0)
    const totalUnits = entries.reduce((s, e) => s + e.units, 0)
    const maxVal = Math.max(1, ...entries.map((e) => e.value))
    const maxUnits = Math.max(1, ...entries.map((e) => e.units))
    return {
      entries,
      totalVal,
      totalUnits,
      maxVal,
      maxUnits,
    }
  }, [w, location])

  const locationStats = useMemo(() => {
    const locs = w.locations.map((l) => {
      let locUnits = 0
      let locValue = 0
      for (const p of w.products) {
        const a = availability(w, p.id, l.id) ?? 0
        locUnits += a
        locValue += a * (p.cost ?? 0)
      }
      return { id: l.id, name: l.name, units: locUnits, value: locValue }
    })
    const totalLocUnits = locs.reduce((s, l) => s + l.units, 0)
    return locs.map((l) => ({
      ...l,
      pct: totalLocUnits > 0 ? Math.round((l.units / totalLocUnits) * 100) : 0,
    }))
  }, [w])

  const healthStats = useMemo(() => {
    let below = 0
    let healthy = 0
    let unconfigured = 0
    for (const p of w.products) {
      const a = availability(w, p.id, location)
      if (p.reorderPoint === null || a === null) {
        unconfigured++
      } else if (a < p.reorderPoint) {
        below++
      } else {
        healthy++
      }
    }
    const total = w.products.length
    return { below, healthy, unconfigured, total }
  }, [w, location])

  const pipelineStats = useMemo(() => {
    const onHand = w.products.reduce((sum, p) => sum + (availability(w, p.id, location) ?? 0), 0)
    const onOrder = w.purchases
      .filter((p) => !location || p.locationId === location)
      .reduce((sum, p) => sum + (p.receivedDate === null ? Math.max(0, p.quantity - (p.receivedQuantity ?? 0)) : 0), 0)
    return { onHand, onOrder }
  }, [w, location])

  return (
    <div className="space-y-6 pt-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <BarChart2 size={18} className="text-[#315f8a]" />
                <span>Stock Distribution by Category</span>
              </div>
              <p className="text-xs text-slate-500">Capital valuation vs available units</p>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMetric('value')}
                className={`rounded-md px-2.5 py-1 transition ${metric === 'value' ? 'bg-white font-bold shadow-xs text-slate-900' : 'text-slate-500'}`}
              >
                Value
              </button>
              <button
                type="button"
                onClick={() => setMetric('units')}
                className={`rounded-md px-2.5 py-1 transition ${metric === 'units' ? 'bg-white font-bold shadow-xs text-slate-900' : 'text-slate-500'}`}
              >
                Units
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-3.5">
            {categoryStats.entries.map((cat) => {
              const barWidth =
                metric === 'value'
                  ? Math.round((cat.value / categoryStats.maxVal) * 100)
                  : Math.round((cat.units / categoryStats.maxUnits) * 100)
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {cat.name} <span className="font-normal text-slate-400">({cat.count} SKUs)</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {metric === 'value' ? money(cat.value, w.profile.currency) : `${number(cat.units)} units`}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#315f8a] transition-all"
                      style={{ width: `${Math.max(6, barWidth)}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {categoryStats.entries.length === 0 && (
              <p className="text-xs text-slate-400">No categorized products in catalog.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Clock size={18} className="text-amber-600" />
                <span>Stock Health & Reorder Thresholds</span>
              </div>
              <p className="text-xs text-slate-500">Products relative to configured reorder points</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                style={{ width: `${(healthStats.healthy / (healthStats.total || 1)) * 100}%` }}
                className="bg-emerald-500 transition-all"
                title={`Healthy: ${healthStats.healthy} products`}
              />
              <div
                style={{ width: `${(healthStats.below / (healthStats.total || 1)) * 100}%` }}
                className="bg-rose-500 transition-all"
                title={`Below reorder point: ${healthStats.below} products`}
              />
              <div
                style={{ width: `${(healthStats.unconfigured / (healthStats.total || 1)) * 100}%` }}
                className="bg-slate-300 transition-all"
                title={`No threshold: ${healthStats.unconfigured} products`}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-900">
                <p className="text-lg font-bold">{healthStats.healthy}</p>
                <p className="text-[11px]">Above threshold</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2.5 text-rose-900">
                <p className="text-lg font-bold">{healthStats.below}</p>
                <p className="text-[11px]">Below reorder point</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2.5 text-slate-700">
                <p className="text-lg font-bold">{healthStats.unconfigured}</p>
                <p className="text-[11px]">Unconfigured</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <PieChart size={18} className="text-teal-600" />
                <span>Multi-Location Allocation</span>
              </div>
              <p className="text-xs text-slate-500">Distribution across storage locations</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {location ? 'Filtered' : 'All locations'}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {locationStats.map((loc, i) => {
                const colors = ['#315f8a', '#0d9488', '#d97706', '#7c3aed']
                return (
                  <div
                    key={loc.id}
                    style={{
                      width: `${loc.pct}%`,
                      backgroundColor: colors[i % colors.length],
                    }}
                    className={`transition-all ${!location || location === loc.id ? 'opacity-100' : 'opacity-30'}`}
                    title={`${loc.name}: ${loc.units} units (${loc.pct}%)`}
                  />
                )
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {locationStats.map((loc, i) => {
                const isSelected = location === loc.id
                const colors = ['#315f8a', '#0d9488', '#d97706', '#7c3aed']
                return (
                  <button
                    type="button"
                    key={loc.id}
                    onClick={() => onSelectLocation(isSelected ? '' : loc.id)}
                    className={`rounded-lg border p-2 text-left transition ${
                      isSelected ? 'border-[#315f8a] bg-blue-50/50 ring-1 ring-[#315f8a]' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span className="size-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className="truncate">{loc.name}</span>
                    </div>
                    <p className="mt-1 font-bold text-slate-900">{number(loc.units)} units</p>
                    <p className="text-[10px] text-slate-500">{money(loc.value, w.profile.currency)} ({loc.pct}%)</p>
                  </button>
                )
              })}
              {locationStats.length === 0 && (
                <p className="col-span-3 text-xs text-slate-400">No distinct locations defined.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Layers size={18} className="text-indigo-600" />
                <span>Replenishment Pipeline</span>
              </div>
              <p className="text-xs text-slate-500">Available on-hand vs incoming supplier orders</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">On hand (Available)</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{number(pipelineStats.onHand)}</p>
              <p className="text-[11px] text-slate-400">Current positions</p>
            </div>
            <div className="rounded-lg bg-blue-50/70 p-3">
              <p className="text-xs font-semibold text-[#315f8a]">Incoming orders (POs)</p>
              <p className="mt-1 text-2xl font-bold text-[#315f8a]">+{number(pipelineStats.onOrder)}</p>
              <p className="text-[11px] text-slate-500">Pending delivery</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
        eyebrow="Inventory"
        title="Know what you have."
        description="Products, available stock and the locations behind the numbers."
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
            {tab === 'Analytics & graphs' ? (
              <InventoryGraphsPanel
                workspace={w}
                location={location}
                onSelectLocation={setLocation}
              />
            ) : tab === 'Age & excess' ? (
              <AgingInventoryPanel
                workspace={w}
                asOf={cutoff(w)}
                location={location}
                onIntake={() => onIntake('inventory')}
              />
            ) : tab === 'Shared pools' ? (
              <InventoryPools
                workspace={w}
                onAdd={() => onIntake('inventory')}
              />
            ) : tab === 'Exceptions' ? (
              <ReconciliationExceptions
                workspace={w}
                onReview={() => onIntake('inventory')}
              />
            ) : tab === 'Movements' ? (
              w.movements.length ? (
                <div className="table-wrap">
                  <SortableTable
                    className="data-table"
                    tableLabel="Inventory movements"
                  >
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Movement</th>
                        <th>Quantity</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.movements.map((m) => (
                        <tr key={m.id}>
                          <td>{m.date}</td>
                          <td>
                            {w.products.find((p) => p.id === m.productId)?.name}
                          </td>
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
            ) : tab === 'Locations' ? (
              <div className="location-grid">
                {w.locations.map((l) => (
                  <article key={l.id} className="location-card">
                    <Boxes size={22} />
                    <h3>{l.name}</h3>
                    <p>
                      {w.stock.filter((s) => s.locationId === l.id).length}{' '}
                      recorded product positions
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
                    <p>
                      These quantities are not assigned to invented locations.
                    </p>
                  </article>
                )}
              </div>
            ) : shown.length ? (
              <div className="table-wrap">
                <SortableTable
                  className="data-table"
                  defaultOpen
                  tableLabel="Inventory positions"
                >
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Available</th>
                      <th>On order · business scope</th>
                      <th>Unit cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>
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
                            {has ? number(units!) : 'Unknown'}{' '}
                            <small>{p.unit}</small>
                          </td>
                          <td className="numeric">
                            {w.purchases.some((o) => o.productId === p.id)
                              ? number(
                                  w.purchases
                                    .filter((o) => o.productId === p.id)
                                    .reduce(
                                      (s, o) =>
                                        s +
                                        Math.max(
                                          0,
                                          o.quantity - o.receivedQuantity,
                                        ),
                                      0,
                                    ),
                                )
                              : 'Not provided'}
                          </td>
                          <td className="numeric">
                            {money(p.cost, w.profile.currency)}
                          </td>
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
            ) : (
              <EmptyState
                title="No matching products"
                description="Try a different product, SKU or location filter."
              />
            )}
            <p className="panel-footnote">
              Available quantities retain their source basis. Unknown
              reservations are not treated as zero. Dates are shown in product
              detail. Open purchases have unallocated business scope. Unknown or
              overlapping quantities cannot enter availability totals.
            </p>
          </Panel>
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
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Quantity basis</th>
                    <th>Quantity</th>
                    <th>Reserved</th>
                    <th>Backordered</th>
                    <th>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {w.stock
                    .filter((s) => s.productId === selected.id)
                    .map((s) => (
                      <tr key={s.id}>
                        <td>
                          {w.locations.find((l) => l.id === s.locationId)
                            ?.name ?? 'Aggregate · unknown location'}
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
                  {w.suppliers.find((s) => s.id === selected.supplierId)
                    ?.name ?? 'Not provided'}
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
        <button className="button primary" disabled={!editable}>
          Confirm inventory movement
        </button>
      </div>
    </form>
  )
}

export { Standardization } from './Standardization'
import { SelectField } from '../../components/ui/select-field'
