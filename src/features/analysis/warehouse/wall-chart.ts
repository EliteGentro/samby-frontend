import { CanvasTexture, SRGBColorSpace } from 'three'
import { colors, metricLabels, numeric, valueLabel, type WallChart } from './scene-data'

export function canvasSurface(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { canvas, context, texture }
}

export function drawWallChart(surface: ReturnType<typeof canvasSurface>, chart: WallChart | undefined, date: string) {
  const { context: ctx, canvas, texture } = surface
  const w = canvas.width, h = canvas.height
  ctx.fillStyle = '#142b35'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#30b99a'
  ctx.fillRect(0, 0, w, 8)
  ctx.fillStyle = '#f2f7f6'
  ctx.font = '600 29px sans-serif'
  ctx.fillText(chart?.title ?? 'Saved daily result', 32, 52)
  ctx.font = '18px sans-serif'
  ctx.fillStyle = '#aabec5'
  ctx.fillText(`${date}   ·   ${chart?.unit ?? ''}`, 32, 82)
  if (chart) {
    const left = 98, right = w - 34, top = 110, bottom = h - 170
    let low = 0, high = 1
    for (const point of chart.points) for (const key of chart.keys) {
      const value = numeric(point, key)
      if (value !== null) { low = Math.min(low, value); high = Math.max(high, value) }
    }
    const x = (index: number) => left + index / Math.max(1, chart.points.length - 1) * (right - left)
    const y = (value: number) => bottom - (value - low) / (high - low) * (bottom - top)
    const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
    for (let i = 0; i <= 4; i++) {
      const value = low + (high - low) * i / 4
      ctx.strokeStyle = '#344b56'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke()
      ctx.fillStyle = '#b5c8ce'; ctx.font = '17px sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(compact.format(value), left - 10, y(value) + 5)
    }
    ctx.textAlign = 'left'
    const active = chart.points.findIndex(point => point.date === date)
    if (active >= 0) {
      ctx.strokeStyle = '#e9f4f1'; ctx.setLineDash([5, 5]); ctx.beginPath()
      ctx.moveTo(x(active), top); ctx.lineTo(x(active), bottom); ctx.stroke(); ctx.setLineDash([])
    }
    chart.keys.forEach((key, index) => {
      ctx.strokeStyle = colors[index]; ctx.lineWidth = 3; ctx.beginPath()
      let connected = false
      chart.points.forEach((point, i) => {
        const value = numeric(point, key)
        if (value === null) { connected = false; return }
        if (connected) ctx.lineTo(x(i), y(value)); else ctx.moveTo(x(i), y(value))
        connected = true
      })
      ctx.stroke()
      // Single-day results and isolated samples still have visible marks.
      chart.points.forEach((point, i) => {
        const value = numeric(point, key)
        if (value === null || (chart.points.length > 1 && i !== active)) return
        ctx.fillStyle = colors[index]; ctx.beginPath(); ctx.arc(x(i), y(value), 4, 0, Math.PI * 2); ctx.fill()
      })
      ctx.fillStyle = colors[index]; ctx.font = '18px sans-serif'
      const value = numeric(chart.points[active], key)
      ctx.fillText(`${metricLabels[key] ?? key}  ·  ${valueLabel(value, chart.unit)}`, 32, h - 110 + index * 26)
    })
    ctx.fillStyle = '#aabec5'; ctx.font = '16px sans-serif'
    ctx.fillText(chart.points[0]?.date ?? '', left, bottom + 27)
    ctx.textAlign = 'right'; ctx.fillText(chart.points.at(-1)?.date ?? '', right, bottom + 27); ctx.textAlign = 'left'
  }
  texture.needsUpdate = true
}
