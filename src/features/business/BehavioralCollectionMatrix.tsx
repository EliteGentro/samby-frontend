import { useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Info,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { MetricCard, Panel } from '../../components/workspace-ui'
import {
  behavioralCollectionMatrix,
  type BehavioralMatrixResult,
  type Perspective,
} from '../../domain/behavioral-collection'
import { money, type Page, type Workspace } from '../../domain/workspace'

export function BehavioralCollectionMatrix({
  workspace,
  onNavigate,
}: {
  workspace: Workspace
  onNavigate?: (page: Page, query?: string) => void
}) {
  const [perspective, setPerspective] = useState<Perspective>('p50')
  const [asemStress, setAsemStress] = useState<boolean>(false)

  const result = behavioralCollectionMatrix(workspace, {
    perspective,
    asemStress,
  })
  const currency = workspace.profile.currency

  return (
    <Panel
      capability="internal-debt"
      title="Behavioral Cash Collection Matrix"
      subtitle={`Distribución empírica de cobro por cliente · Base ${result.asOf} · ${result.openInvoiceCount} facturas abiertas · ${result.customerCount} clientes activos`}
      action={
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`button ${asemStress ? 'primary' : 'secondary'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderColor: asemStress ? 'var(--amber-800, #b45309)' : undefined,
              backgroundColor: asemStress ? '#d97706' : undefined,
              color: asemStress ? '#fff' : undefined,
              fontWeight: 600,
            }}
            onClick={() => setAsemStress(!asemStress)}
            aria-pressed={asemStress}
          >
            <ShieldAlert size={16} />
            {asemStress
              ? 'Estrés ASEM Activo (+76d)'
              : 'Activar Estrés ASEM (+76d)'}
          </button>
          {onNavigate && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                onNavigate(
                  'analysis',
                  `question=Q-CUSTOMER-DEBT&delay=${asemStress ? result.portfolioProfile.p50DelayDays + 76 : result.portfolioProfile.p50DelayDays}`,
                )
              }
            >
              Simular en Escenarios
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      }
    >
      {asemStress && (
        <div
          className="notice warning"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '1rem',
            borderLeft: '4px solid #d97706',
          }}
        >
          <AlertTriangle
            size={22}
            style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }}
          />
          <div>
            <strong>
              Efecto ASEM de 76 días aplicado (Simulación de Estrés PyME)
            </strong>
            <p style={{ margin: '0.25rem 0 0 0' }}>
              De acuerdo con la{' '}
              <em>Radiografía del Emprendimiento de la ASEM</em> (Asociación de
              Emprendedores de México), las PyMEs mexicanas sufren demoras de
              pago que promedian <strong>+76 días de retraso adicional</strong>{' '}
              sobre los plazos pactados. Esta simulación desplaza los cobros
              esperados hacia horizontes tardíos para revelar la brecha oculta
              de liquidez.
            </p>
          </div>
        </div>
      )}

      {/* Selector de Perspectiva */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--panel-subtle-bg, rgba(255, 255, 255, 0.04))',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} className="muted" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Modelo de Proyección de Cobro:
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`button small ${perspective === 'p50' && !asemStress ? 'primary' : 'secondary'}`}
            onClick={() => {
              setPerspective('p50')
              setAsemStress(false)
            }}
          >
            <Zap size={14} />
            P50 Empírico (Más Probable)
          </button>
          <button
            type="button"
            className={`button small ${perspective === 'p80' && !asemStress ? 'primary' : 'secondary'}`}
            onClick={() => {
              setPerspective('p80')
              setAsemStress(false)
            }}
          >
            P80 Empírico (Conservador / Riesgo 80%)
          </button>
          <button
            type="button"
            className={`button small ${perspective === 'naive' && !asemStress ? 'primary' : 'secondary'}`}
            onClick={() => {
              setPerspective('naive')
              setAsemStress(false)
            }}
          >
            Supuesto Ingenuo ("Net 30" / Contractual)
          </button>
        </div>
      </div>

      <CollectionMetrics
        result={result}
        currency={currency}
        asemStress={asemStress}
      />

      {result.warnings.map((w) => (
        <p key={w} className="notice small">
          {w}
        </p>
      ))}

      <CustomerCollectionMatrix
        result={result}
        currency={currency}
        perspective={perspective}
        asemStress={asemStress}
      />

      <InvoicePredictions
        result={result}
        currency={currency}
        perspective={perspective}
        asemStress={asemStress}
      />

      {/* Nota metodológica transparente */}
      <details style={{ marginTop: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          <Info
            size={16}
            style={{
              display: 'inline',
              verticalAlign: 'text-bottom',
              marginRight: '0.4rem',
            }}
          />
          Metodología: ¿Por qué sustituir "Net 30" por la Matriz Conductual y el
          Efecto ASEM?
        </summary>
        <div
          style={{ marginTop: '0.75rem', lineHeight: 1.6, fontSize: '0.9rem' }}
        >
          <p>
            <strong>La ilusión de "Net 30":</strong> Los sistemas contables
            convencionales asumen ingenuamente que si una factura se emite a 30
            días, el dinero ingresará en el día 30. En la realidad de los
            negocios en México y Latinoamérica, cada cliente posee un patrón de
            pago propio (P50: la mediana empírica en la que habitualmente
            liquidan sus compromisos; P80: el plazo en el que se alcanza el 80%
            de cobros).
          </p>
          <p>
            <strong>El Efecto ASEM de 76 días:</strong> Datos oficiales de la
            Asociación de Emprendedores de México (ASEM) revelan que el retraso
            crónico en pagos a micro, pequeñas y medianas empresas promedia{' '}
            <strong>76 días por encima del término pactado</strong>, lo cual
            destruye la liquidez operativa si no se modela preventivamente. El
            toggle de Estrés ASEM te permite anticipar este choque de flujo
            antes de contraer compromisos de pago a proveedores o inventario.
          </p>
          <p className="muted">
            Los percentiles se recalculan automáticamente con base en tus
            observaciones reales registradas en Finance History. Los clientes
            sin facturas previas heredan la distribución ponderada de la cartera
            global.
          </p>
        </div>
      </details>
    </Panel>
  )
}

type MatrixViewProps = {
  result: BehavioralMatrixResult
  currency: Workspace['profile']['currency']
  perspective: Perspective
  asemStress: boolean
}

function CollectionMetrics({
  result,
  currency,
  asemStress,
}: Pick<MatrixViewProps, 'result' | 'currency' | 'asemStress'>) {
  return (
    <div className="metrics-grid">
      <MetricCard
        capability="internal-debt"
        label="Total por cobrar activo"
        value={money(result.totalOutstanding, currency)}
        note={`${result.openInvoiceCount} facturas activas de ${result.customerCount} clientes`}
      />
      <MetricCard
        capability="internal-debt"
        label={
          asemStress
            ? 'Plazo con Estrés ASEM (+76d)'
            : 'Plazo real empírico (P50)'
        }
        value={`${asemStress ? result.weightedAsemDays : result.weightedP50Days} días`}
        note={
          asemStress
            ? 'Plazo empírico P50 + 76 días de retraso PyME'
            : 'Mediana ponderada de cobro según comportamiento previo'
        }
        accent={asemStress}
      />
      <MetricCard
        capability="internal-debt"
        label="Desfase de liquidez vs 'Net 30'"
        value={money(result.cashLagAmount, currency)}
        note={
          result.cashLagAmount > 0
            ? `${money(result.cashLag90Amount, currency)} desplazados a más de 90 días`
            : 'Sin desfase respecto al supuesto Net 30'
        }
      />
      <MetricCard
        capability="internal-debt"
        label="Tasa de pago puntual histórica"
        value={
          result.portfolioProfile.onTimeRate !== null
            ? `${result.portfolioProfile.onTimeRate}%`
            : 'Sin historial'
        }
        note={`${result.portfolioProfile.sampleCount} pagos previos observados`}
      />
    </div>
  )
}

function CustomerCollectionMatrix({
  result,
  currency,
  perspective,
  asemStress,
}: MatrixViewProps) {
  return (
    <section aria-label="Matriz Conductual de Cobro">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>
            Matriz Conductual de Distribución de Cobro
          </h3>
          <p className="muted small" style={{ margin: '0.25rem 0 0 0' }}>
            Muestra en qué ventanas temporales ingresará realmente el efectivo
            según el{' '}
            <strong>
              {asemStress
                ? 'Escenario de Estrés ASEM (+76 días de retraso PyME)'
                : perspective === 'p50'
                  ? 'Comportamiento Empírico P50 (Más probable)'
                  : perspective === 'p80'
                    ? 'Comportamiento Empírico P80 (Conservador)'
                    : 'Supuesto Ingenuo Net 30 (Sin ajuste de comportamiento)'}
            </strong>
            .
          </p>
        </div>
      </div>

      {result.matrixRows.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Cliente / Deudor</th>
                <th scope="col">Saldo por cobrar</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  0–30 días
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  31–60 días
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  61–90 días
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  91–120 días
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  120+ días
                </th>
                <th scope="col">Comportamiento</th>
              </tr>
            </thead>
            <tbody>
              {result.matrixRows.map((row) => (
                <tr key={row.customer}>
                  <td>
                    <strong>{row.customer}</strong>
                    <small className="block muted">
                      {row.openInvoiceCount} factura
                      {row.openInvoiceCount > 1 ? 's' : ''} pendiente
                      {row.openInvoiceCount > 1 ? 's' : ''}
                    </small>
                  </td>
                  <td>
                    <strong>{money(row.totalOutstanding, currency)}</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['0-30'] > 0 ? 'badge green' : 'muted'
                      }
                    >
                      {row.buckets['0-30'] > 0
                        ? money(row.buckets['0-30'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={row.buckets['31-60'] > 0 ? 'badge' : 'muted'}
                    >
                      {row.buckets['31-60'] > 0
                        ? money(row.buckets['31-60'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['61-90'] > 0 ? 'badge amber' : 'muted'
                      }
                    >
                      {row.buckets['61-90'] > 0
                        ? money(row.buckets['61-90'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['91-120'] > 0 ? 'badge amber' : 'muted'
                      }
                    >
                      {row.buckets['91-120'] > 0
                        ? money(row.buckets['91-120'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className={
                        row.buckets['120+'] > 0 ? 'badge red' : 'muted'
                      }
                    >
                      {row.buckets['120+'] > 0
                        ? money(row.buckets['120+'], currency)
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${row.profile.p50DelayDays <= 0 ? 'green' : row.profile.p50DelayDays <= 15 ? '' : 'amber'}`}
                    >
                      {row.profile.p50DelayDays <= 0
                        ? 'Puntual'
                        : `+${row.profile.p50DelayDays}d P50 / +${row.profile.p80DelayDays}d P80`}
                    </span>
                    <small className="block muted" style={{ marginTop: '3px' }}>
                      {row.profile.isBenchmark
                        ? 'Ref. cartera'
                        : `${row.profile.sampleCount} pagos previos`}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                style={{
                  fontWeight: 'bold',
                  borderTop: '2px solid var(--border)',
                }}
              >
                <td>Total Proyectado</td>
                <td>{money(result.totalOutstanding, currency)}</td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['0-30'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['31-60'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['61-90'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['91-120'], currency)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {money(result.matrixTotals['120+'], currency)}
                </td>
                <td>100% Cartera</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="notice">
          No hay facturas por cobrar abiertas en este momento.
        </p>
      )}
    </section>
  )
}

function InvoicePredictions({
  result,
  currency,
  perspective,
  asemStress,
}: MatrixViewProps) {
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(true)
  return (
    <section style={{ marginTop: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3>Predicciones por Factura Individual</h3>
        <button
          type="button"
          className="button small secondary"
          onClick={() => setShowInvoiceDetails(!showInvoiceDetails)}
        >
          {showInvoiceDetails
            ? 'Ocultar facturas'
            : 'Mostrar desglose por factura'}
        </button>
      </div>

      {showInvoiceDetails && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Factura / Registro</th>
                <th scope="col">Cliente</th>
                <th scope="col">Saldo</th>
                <th scope="col">Vencimiento Net 30</th>
                <th scope="col">Predicción P50</th>
                <th scope="col">Predicción P80</th>
                <th scope="col">Estrés ASEM (+76d)</th>
                <th scope="col">Desfase neto</th>
                <th scope="col">Confianza</th>
              </tr>
            </thead>
            <tbody>
              {result.predictions.map((p) => {
                const delayVsNaive = asemStress
                  ? p.asemDelayDays
                  : perspective === 'p80'
                    ? p.p80DelayDays
                    : p.p50DelayDays

                return (
                  <tr key={p.record.id}>
                    <td>
                      <strong>{p.record.name}</strong>
                      <small className="block muted">{p.record.id}</small>
                    </td>
                    <td>{p.customer}</td>
                    <td>
                      <strong>{money(p.outstanding, currency)}</strong>
                    </td>
                    <td>{p.naiveExpectedDate}</td>
                    <td>
                      <span
                        style={{
                          fontWeight:
                            perspective === 'p50' && !asemStress ? 700 : 400,
                        }}
                      >
                        {p.p50ExpectedDate}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight:
                            perspective === 'p80' && !asemStress ? 700 : 400,
                        }}
                      >
                        {p.p80ExpectedDate}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          color: '#d97706',
                          fontWeight: asemStress ? 700 : 400,
                        }}
                      >
                        {p.asemExpectedDate}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${delayVsNaive <= 0 ? 'green' : delayVsNaive <= 20 ? 'amber' : 'red'}`}
                      >
                        {delayVsNaive > 0
                          ? `+${delayVsNaive} días`
                          : `${delayVsNaive} días`}
                      </span>
                    </td>
                    <td>
                      <span className="badge">
                        {p.confidence === 'high'
                          ? 'Alta (≥5 facturas)'
                          : p.confidence === 'medium'
                            ? 'Media'
                            : 'Ref. Cartera'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
