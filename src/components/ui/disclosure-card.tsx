import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible } from 'radix-ui'
import { cn } from '../../lib/utils'

export function DisclosureCard({
  title,
  description,
  icon,
  meta,
  children,
  defaultOpen = false,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  meta?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow data-[state=open]:shadow-md',
        className,
      )}
    >
      <Collapsible.Trigger className="disclosure-trigger group flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none transition-colors hover:bg-accent/45 focus-visible:ring-3 focus-visible:ring-secondary/20 focus-visible:ring-inset sm:px-5">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-secondary">
            {icon}
          </span>
        )}
        <span className="disclosure-titles min-w-0 flex-1">
          <span className="disclosure-title block text-sm font-semibold tracking-[-0.015em] text-foreground">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {description}
            </span>
          )}
        </span>
        {meta && (
          <span className="disclosure-meta flex shrink-0 items-center gap-2">
            {meta}
          </span>
        )}
        <span className="disclosure-chevron grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-[transform,background-color,color] group-hover:bg-card group-hover:text-foreground group-data-[state=open]:rotate-180">
          <ChevronDown className="size-4" />
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
        <div className="border-t border-border bg-muted/20 px-4 py-4 sm:px-5">
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
