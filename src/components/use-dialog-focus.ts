import { useEffect, useRef } from 'react'

export function useDialogFocus() {
  const opener = useRef<HTMLElement | null>(null)
  const openedRoute = useRef('')
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target !== document.body &&
        !target.closest('[role="dialog"]')
      ) {
        opener.current = target
        openedRoute.current = location.hash
      }
    }
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [])
  return {
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      const target =
        openedRoute.current === location.hash && opener.current?.isConnected
          ? opener.current
          : document.querySelector<HTMLElement>('main h1')
      queueMicrotask(() => target?.focus())
    },
  }
}
