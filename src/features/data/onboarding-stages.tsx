import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { sectionNames } from './onboarding-draft'
import {
  FinanceEntryForm,
  InventoryPoolForm,
  InventoryStockForm,
  SupplierEntryForm,
} from './onboarding-forms'
import { firstQuestions } from './onboarding-model'
import { SalesEntry } from './onboarding-sales'
import { type OnboardingViewModel } from './use-onboarding'

export function InformationStage(props: OnboardingViewModel) {
  const {
    draft,
    pending,
    guidance,
    patch,
    onFirstDecision,
    finish,
    inventoryTab,
    setInventoryTab,
    defer,
    closeDraft,
    initialSection,
    move,
  } = props
  return (
    <>
      {draft.step === 1 && !pending && (
        <>
          <div>
            <h2>Add the information you have.</h2>
            <p className="muted">{guidance.guidance}</p>
          </div>
          <FirstQuestionSelect {...props} />
          <div
            className="form-actions onboarding-blocks"
            role="group"
            aria-label="Information type"
          >
            {guidance.blocks.map((section) => (
              <button
                key={section}
                className={`button ${draft.section === section ? 'primary' : 'secondary'}`}
                aria-pressed={draft.section === section}
                onClick={() => patch({ section })}
              >
                {sectionNames[section]}
              </button>
            ))}
          </div>
          {draft.profile.firstQuestion === 'Q-NEW-ORDER' && onFirstDecision && (
            <div className="notice onboarding-scenario">
              <p>
                Evaluate the future order with explicit products, quantities and
                dates. Scenario assumptions do not become recorded sales.
              </p>
              <button
                className="button secondary"
                onClick={() => finish('Q-NEW-ORDER')}
              >
                Evaluate a new order scenario <ArrowRight size={16} />
              </button>
            </div>
          )}
          <SalesEntry {...props} />
          {draft.section === 'inventory' && (
            <div
              className="form-actions"
              role="group"
              aria-label="Inventory information type"
            >
              <button
                className={`button ${inventoryTab === 'stock' ? 'primary' : 'secondary'}`}
                onClick={() => {
                  setInventoryTab('stock')
                  patch({
                    fields: { ...draft.fields, $inventoryTab: 'stock' },
                  })
                }}
              >
                Stock &amp; costs
              </button>
              <button
                className={`button ${inventoryTab === 'pool' ? 'primary' : 'secondary'}`}
                onClick={() => {
                  setInventoryTab('pool')
                  patch({
                    fields: { ...draft.fields, $inventoryTab: 'pool' },
                  })
                }}
              >
                Shared inventory pool
              </button>
            </div>
          )}
          <InventoryPoolForm {...props} />
          <InventoryStockForm {...props} />
          <SupplierEntryForm {...props} />
          <FinanceEntryForm {...props} />
          <div className="form-actions">
            <button className="button secondary" onClick={defer}>
              Continue for now
            </button>
            <button className="button secondary" onClick={closeDraft}>
              Save draft &amp; close
            </button>
            {!initialSection && (
              <button className="button secondary" onClick={() => move(0)}>
                Business details
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

export function ProfileStage(props: OnboardingViewModel) {
  const { draft, profileSubmit, patch, closeDraft } = props
  return (
    <>
      {draft.step === 0 && (
        <form className="stack" onSubmit={profileSubmit}>
          <div>
            <h2>Tell us about your business.</h2>
            <p className="muted">
              Understand your sales, then connect them with inventory,
              purchasing and available cash.
            </p>
          </div>
          <div className="form-grid">
            <label className="field">
              Business name
              <input
                required
                value={draft.profile.name}
                onChange={(event) =>
                  patch({
                    profile: { ...draft.profile, name: event.target.value },
                  })
                }
                autoComplete="organization"
              />
            </label>
            <label className="field">
              Working currency
              <select
                value={draft.profile.currency}
                onChange={(event) =>
                  patch({
                    profile: {
                      ...draft.profile,
                      currency: event.target.value,
                    },
                  })
                }
              >
                <option value="MXN">MXN · Mexican peso</option>
                <option value="USD">USD · US dollar</option>
              </select>
              <small>
                Records use one compatible currency. No conversion is assumed.
              </small>
            </label>
            <label className="field">
              Business type <span className="muted">Optional</span>
              <input
                value={draft.profile.businessType}
                onChange={(event) =>
                  patch({
                    profile: {
                      ...draft.profile,
                      businessType: event.target.value,
                    },
                  })
                }
                placeholder="Distributor, retailer, e-commerce…"
              />
            </label>
            <FirstQuestionSelect {...props} />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={closeDraft}
            >
              Save for later
            </button>
            <button className="button primary" type="submit">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}
    </>
  )
}

export function PendingReview(props: OnboardingViewModel) {
  const {
    pending,
    confirmed,

    setConfirmed,
    setPending,
    closeDraft,
    canEdit,
    draft,
    savePending,
  } = props
  return (
    <>
      {pending && (
        <div className="stack">
          <h2>Review before applying</h2>
          <div className="panel stack">
            {pending.summary.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <p className="muted">
            Confirmed manual records are saved to the workspace service.
            Submitted analytical runs preserve their own durable input
            snapshots.
          </p>
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm these values and their stated meaning.
          </label>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Back to edit
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setPending(null)
                closeDraft()
              }}
            >
              Cancel review
            </button>
            <button
              className="button primary"
              disabled={
                !confirmed ||
                !canEdit(
                  draft.section === 'profile' ? 'settings' : draft.section,
                )
              }
              onClick={savePending}
            >
              Confirm &amp; apply
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function ConfirmedInformation(props: OnboardingViewModel) {
  const { workspace } = props
  return (
    <section className="panel stack" aria-label="Confirmed information summary">
      <h3>What you have added</h3>
      <p>
        {workspace.sales.length} sales · {workspace.products.length} products ·{' '}
        {workspace.stock.length} stock records · {workspace.finance.length}{' '}
        financial records
      </p>
      {workspace.sources.length ? (
        <div className="stack onboarding-sources">
          {workspace.sources.map((source) => (
            <div key={source.id}>
              <strong>{source.name}</strong>
              <p className="muted">
                {source.type === 'manual'
                  ? 'Manual entry'
                  : source.type.toUpperCase()}{' '}
                · {source.rowCount} confirmed records ·{' '}
                {source.importedAt.slice(0, 10)}
              </p>
              {source.review && (
                <p className="small muted">
                  {source.review.rows.length -
                    source.review.acceptedRowIndexes.length -
                    source.review.excludedRowIndexes.length}{' '}
                  pending · {source.review.excludedRowIndexes.length} excluded.
                  Only confirmed rows contribute to results. Amount definition ·{' '}
                  {source.review.interpretation.amountBasis ||
                    'Amounts not supplied'}
                  .
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          No records confirmed yet. Your unfinished entries remain saved for
          this session.
        </p>
      )}
      {workspace.sales.length > 0 && (
        <div className="stack">
          <p>
            Recorded sales scope ·{' '}
            {workspace.sales.map((sale) => sale.date).sort()[0]} through{' '}
            {workspace.sales
              .map((sale) => sale.date)
              .sort()
              .at(-1)}{' '}
            · {workspace.sales.filter((sale) => sale.productId === null).length}{' '}
            aggregate rows ·{' '}
            {
              new Set(
                workspace.sales.map((sale) => sale.productId).filter(Boolean),
              ).size
            }{' '}
            identifiable products.
          </p>
          <p className="muted">
            {workspace.sales.filter((sale) => sale.locationId === null).length}{' '}
            rows retain aggregate location scope. Missing days are unknown;
            recorded sales do not establish cash collected.
          </p>
        </div>
      )}
      {workspace.stock.length > 0 && (
        <p>
          Stock scope · {workspace.stock.map((stock) => stock.asOf).sort()[0]}{' '}
          through{' '}
          {workspace.stock
            .map((stock) => stock.asOf)
            .sort()
            .at(-1)}{' '}
          ·{' '}
          {workspace.stock.filter((stock) => stock.locationId === null).length}{' '}
          aggregate physical positions. Unknown reservations and costs remain
          unknown.
        </p>
      )}
      {workspace.finance.length > 0 && (
        <p>
          Financial scope ·{' '}
          {workspace.finance.filter((record) => !record.expectedDate).length}{' '}
          records remain unscheduled. Outstanding balances do not imply a
          collection or payment date.
        </p>
      )}
    </section>
  )
}

export function ResultStage(props: OnboardingViewModel) {
  const {
    draft,
    firstResult,
    lastSource,
    resultsHidden,
    usableCapabilities,
    missingPrerequisite,
    guidance,
    firstQuestion,
    patch,
    nextSection,
    move,
    onFirstDecision,
    finish,
  } = props
  return (
    <>
      {draft.step === 3 && (
        <div className="stack onboarding-result">
          <div>
            <CheckCircle2 size={32} />
            <h2>
              {firstResult
                ? 'Your information is ready to explore.'
                : 'Your workspace is ready when you are.'}
            </h2>
            <p className="muted">
              {lastSource ||
                (firstResult
                  ? 'Continue with the records you have confirmed.'
                  : resultsHidden
                    ? 'Your confirmed information supports results that are hidden by your Add-ons preferences.'
                    : 'You have deferred data entry. No analysis has been calculated.')}
            </p>
          </div>
          <ConfirmedInformation {...props} />
          {firstResult ? (
            <section className="panel stack" aria-label="Supported results">
              <h3>Available from your information</h3>
              {usableCapabilities.map((capability) => (
                <div key={capability.id}>
                  <strong>{capability.firstResult!.label}</strong>
                  <p className="muted">{capability.warning}</p>
                </div>
              ))}
              <p className="small muted">
                Forecasts and scenario comparisons each need their own inputs
                and assumptions.
              </p>
            </section>
          ) : resultsHidden ? (
            <div className="notice">
              Supported results are hidden by your Add-ons preferences. Review
              their visibility to view an analysis. Your preferences have been
              retained.
            </div>
          ) : (
            <div className="notice">
              No supported analysis is available yet. Start with one dated sale
              amount, product quantity, stock position or receivable. Supplier
              details, payment terms and other configuration are saved context.
            </div>
          )}
          <div className="notice">
            <p>
              {missingPrerequisite
                ? `Next suggested input · ${missingPrerequisite.fields}`
                : guidance.guidance}
            </p>
            {firstQuestion && (
              <p>
                Your next question · {firstQuestion.label}. Confirmed records
                are reused; the scenario asks for missing inputs and assumptions
                before running.
              </p>
            )}
          </div>
          <div className="form-actions">
            <button
              className="button secondary"
              onClick={() => {
                patch({ section: nextSection })
                move(1)
              }}
            >
              Add more information
            </button>
            {firstQuestion && onFirstDecision && (
              <button
                className="button secondary"
                onClick={() => finish(firstQuestion.key)}
              >
                {firstQuestion.label} scenario <ArrowRight size={16} />
              </button>
            )}
            <button className="button primary" onClick={() => finish()}>
              {firstResult
                ? 'View my analysis'
                : resultsHidden
                  ? 'Review Add-ons'
                  : 'Continue for now'}{' '}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function FirstQuestionSelect(props: OnboardingViewModel) {
  const { canEdit, draft, changeQuestion } = props
  return (
    <label className="field onboarding-question">
      What would you like to understand first?
      <select
        aria-label="What would you like to understand first?"
        aria-describedby="onboarding-question-help"
        disabled={!canEdit('settings')}
        value={draft.profile.firstQuestion}
        onChange={(event) => changeQuestion(event.target.value)}
      >
        {firstQuestions.map((question) => (
          <option key={question.value} value={question.value}>
            {question.label}
          </option>
        ))}
      </select>
      <small id="onboarding-question-help">
        Optional. Change this at any time; your entered information stays saved.
      </small>
    </label>
  )
}
