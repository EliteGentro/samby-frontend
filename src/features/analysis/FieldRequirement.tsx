import type { ReactNode } from 'react'

export function FieldRequirement({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <span className="field-requirement">
      {children}
      {required && (
        <>
          <span className="required-marker" aria-hidden="true">
            {' '}
            *
          </span>
          <span className="sr-only"> (required to run)</span>
        </>
      )}
    </span>
  )
}

export function OptionalHelp({ children }: { children: ReactNode }) {
  return (
    <small className="muted optional-help">
      <strong>Optional.</strong> {children}
    </small>
  )
}
