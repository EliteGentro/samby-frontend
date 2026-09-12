import { availability, number, type Workspace } from '../../domain/workspace'
import { EmptyState } from '../../components/workspace-ui'

export function InventoryPools({
  workspace: w,
  onAdd,
}: {
  workspace: Workspace
  onAdd: () => void
}) {
  if (!w.inventoryPools?.length)
    return (
      <EmptyState
        title="No shared inventory pool declared"
        description="Declare which known physical locations and channels share stock. An aggregate of unknown distribution remains separate."
        action={
          <button className="button secondary" onClick={onAdd}>
            Define a shared pool
          </button>
        }
      />
    )
  return (
    <div className="panel-body stack">
      {w.inventoryPools.map((pool) => {
        const scoped = {
          ...w,
          stock: w.stock.filter(
            (s) =>
              s.locationId !== null && pool.locationIds.includes(s.locationId),
          ),
        }
        return (
          <section key={pool.id} className="stack">
            <div>
              <h3>{pool.name}</h3>
              <p className="small muted">
                Channels · {pool.channelNames.join(', ') || 'Not supplied'}.
                Locations contribute existing stock once; channel names never
                create additional positions.
              </p>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product / unit</th>
                    {pool.locationIds.map((id) => (
                      <th key={id}>
                        {w.locations.find((l) => l.id === id)?.name ?? id}
                      </th>
                    ))}
                    <th>Shared availability</th>
                  </tr>
                </thead>
                <tbody>
                  {w.products
                    .filter((p) =>
                      scoped.stock.some((s) => s.productId === p.id),
                    )
                    .map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.name} · {p.unit}
                        </td>
                        {pool.locationIds.map((id) => (
                          <td key={id}>
                            {availability(w, p.id, id) === null
                              ? 'Unknown'
                              : number(availability(w, p.id, id)!)}
                          </td>
                        ))}
                        <td>
                          {pool.locationIds.some(
                            (id) => availability(w, p.id, id) === null,
                          )
                            ? 'Unknown contribution'
                            : number(availability(scoped, p.id)!)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              Open purchase quantities have business scope unless an allocation
              is explicitly supplied. This pool does not implement advanced
              routing or promise local fulfillment.
            </p>
          </section>
        )
      })}
    </div>
  )
}

export function ReconciliationExceptions({
  workspace: w,
  onReview,
}: {
  workspace: Workspace
  onReview: () => void
}) {
  const problems = w.stock.flatMap((s) => [
    ...(s.onHand < 0
      ? [
          {
            stock: s,
            issue: 'Negative recorded quantity. The source value is preserved.',
          },
        ]
      : []),
    ...(s.reserved !== null && s.reserved > s.onHand
      ? [
          {
            stock: s,
            issue: 'Reserved quantity exceeds recorded on-hand stock.',
          },
        ]
      : []),
    ...(s.quantityBasis !== 'available' && s.reserved === null
      ? [
          {
            stock: s,
            issue:
              'Reservation basis is unknown; available stock cannot be calculated.',
          },
        ]
      : []),
    ...(s.locationId === null &&
    w.stock.some((p) => p.productId === s.productId && p.locationId !== null)
      ? [
          {
            stock: s,
            issue:
              'Aggregate and location positions overlap. Reconcile identity before totaling stock.',
          },
        ]
      : []),
  ])
  return problems.length ? (
    <div className="panel-body stack">
      <p className="notice">
        {problems.length} recorded exceptions need interpretation. No values are
        silently repaired or excluded from source review.
      </p>
      {problems.map(({ stock: s, issue }, i) => (
        <div key={`${s.id}-${i}`}>
          <strong>
            {w.products.find((p) => p.id === s.productId)?.name} · {s.asOf}
          </strong>
          <p className="small muted">{issue}</p>
        </div>
      ))}
      <button className="button secondary" onClick={onReview}>
        Review inventory inputs
      </button>
    </div>
  ) : (
    <EmptyState
      title="No arithmetic exceptions found"
      description="The supplied stock passes these quantity and scope checks. This does not certify a physical stocktake or complete coverage."
    />
  )
}
