import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ChangeEventHandler,
  type ReactNode,
} from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Select } from 'radix-ui'
import { cn } from '../../lib/utils'

const EMPTY_VALUE = '__samby_empty_select_value__'

export type SelectFieldOption = {
  value: string
  label: ReactNode
  disabled?: boolean
}

type SelectFieldProps = {
  label?: string
  value?: string | number
  defaultValue?: string | number
  options?: SelectFieldOption[]
  children?: ReactNode
  onValueChange?: (value: string) => void
  onChange?: ChangeEventHandler<HTMLSelectElement>
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
  title?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number')
        return String(child)
      if (isValidElement<{ children?: ReactNode }>(child))
        return nodeText(child.props.children)
      return ''
    })
    .join('')
}

function optionsFromChildren(children: ReactNode): SelectFieldOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return []
    if (child.type !== 'option')
      return optionsFromChildren(child.props.children)
    const option = child as typeof child & {
      props: {
        value?: string | number
        disabled?: boolean
        children?: ReactNode
      }
    }
    const label = option.props.children
    return [
      {
        value:
          option.props.value === undefined
            ? nodeText(label)
            : String(option.props.value),
        label,
        disabled: option.props.disabled,
      },
    ]
  })
}

export function SelectField({
  label,
  value,
  defaultValue,
  options,
  children,
  onValueChange,
  onChange,
  name,
  required,
  disabled,
  className,
  id,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: SelectFieldProps) {
  const encode = (optionValue: string) =>
    optionValue === '' ? EMPTY_VALUE : optionValue
  const resolvedOptions = useMemo(
    () => options ?? optionsFromChildren(children),
    [children, options],
  )
  const initialValue = String(
    defaultValue ??
      resolvedOptions.find((option) => !option.disabled)?.value ??
      '',
  )
  const [internalValue, setInternalValue] = useState(initialValue)
  const uncontrolledValue = resolvedOptions.some(
    (option) => option.value === internalValue,
  )
    ? internalValue
    : initialValue
  const selectedValue = value === undefined ? uncontrolledValue : String(value)
  const formValueRef = useRef<HTMLInputElement>(null)

  const handleValueChange = useCallback(
    (encodedValue: string) => {
      const nextValue = encodedValue === EMPTY_VALUE ? '' : encodedValue
      if (value === undefined) setInternalValue(nextValue)
      if (formValueRef.current) {
        formValueRef.current.value = nextValue
        formValueRef.current.dispatchEvent(
          new Event('input', { bubbles: true }),
        )
      }
      onValueChange?.(nextValue)
      if (onChange) {
        const target = {
          value: nextValue,
          name: name ?? '',
        } as HTMLSelectElement
        onChange({
          target,
          currentTarget: target,
        } as ChangeEvent<HTMLSelectElement>)
      }
    },
    [name, onChange, onValueChange, value],
  )
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const handleNativeChange = (event: Event) =>
      handleValueChange((event.currentTarget as HTMLButtonElement).value)
    trigger.addEventListener('change', handleNativeChange)
    return () => trigger.removeEventListener('change', handleNativeChange)
  }, [handleValueChange])

  return (
    <Select.Root
      value={encode(selectedValue)}
      onValueChange={handleValueChange}
      disabled={disabled}
      required={required}
    >
      <Select.Trigger
        ref={triggerRef}
        data-slot="select-trigger"
        id={id}
        title={title}
        aria-label={ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-required={required || undefined}
        value={selectedValue}
        className={cn(
          'group inline-flex h-11 min-w-44 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 text-left text-xs font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow,background-color] hover:border-secondary/40 hover:bg-accent/40 focus-visible:border-secondary focus-visible:ring-3 focus-visible:ring-secondary/15 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-secondary data-[state=open]:ring-3 data-[state=open]:ring-secondary/10',
          className,
        )}
      >
        <Select.Value />
        <Select.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="start"
          className="z-100 max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <Select.ScrollUpButton className="flex h-7 items-center justify-center text-muted-foreground">
            <ChevronUp className="size-4" />
          </Select.ScrollUpButton>
          <Select.Viewport className="p-1.5">
            {resolvedOptions.map((option) => (
              <Select.Item
                key={encode(option.value)}
                value={encode(option.value)}
                disabled={option.disabled}
                className="relative flex min-h-10 cursor-default select-none items-center rounded-lg py-2 pr-9 pl-3 text-xs outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex items-center justify-center text-secondary">
                  <Check className="size-4" strokeWidth={2.5} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-7 items-center justify-center text-muted-foreground">
            <ChevronDown className="size-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
      {name && (
        <input
          ref={formValueRef}
          type="hidden"
          name={name}
          value={selectedValue}
          disabled={disabled}
        />
      )}
    </Select.Root>
  )
}
