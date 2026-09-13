import { useEffect, useMemo, useState } from 'react'
import type { DailyPoint } from '../../../lib/analysis'

export function useGamePlayback(series: DailyPoint[], initialDate?: string) {
  const dates = useMemo(() => [...new Set(series.map(point => point.date))].sort(), [series])
  const [index, setIndex] = useState(() => Math.max(0, dates.indexOf(initialDate ?? '')))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const last = Math.max(0, dates.length - 1)
  const date = dates[Math.min(index, last)]
  const select = (next: number) => { setPlaying(false); setIndex(Math.max(0, Math.min(next, last))) }
  const toggle = () => {
    if (dates.length < 2) return
    if (index >= last) setIndex(0)
    setPlaying(value => !value)
  }
  useEffect(() => {
    if (!playing || index >= last) return
    const delay = Math.max(100, Math.min(800, 15_000 / Math.max(1, last)) / speed)
    const timer = window.setTimeout(() => {
      setIndex(index + 1)
      if (index + 1 >= last) setPlaying(false)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [index, last, playing, speed])
  useEffect(() => {
    const pause = () => setPlaying(false)
    const visibility = () => { if (document.hidden) pause() }
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  return { dates, date, index, last, playing, speed, setSpeed, select, toggle, pause: () => setPlaying(false) }
}
