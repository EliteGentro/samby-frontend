import { useTheme } from '../lib/theme'

const assets = {
  navy: {
    file: 'samby-wordmark-navy.png',
    viewBox: '140 170 1920 370',
    width: 2172,
    height: 724,
  },
  white: {
    file: 'samby-wordmark-white.png',
    viewBox: '155 165 1870 350',
    width: 2172,
    height: 724,
  },
  symbol: {
    file: 'samby-symbol.png',
    viewBox: '318 140 632 992',
    width: 1254,
    height: 1254,
  },
} as const

export function BrandLogo({
  variant = 'navy',
  decorative = false,
  className = '',
}: {
  variant?: keyof typeof assets
  decorative?: boolean
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const effectiveVariant =
    variant === 'navy' && resolvedTheme === 'dark' ? 'white' : variant
  const asset = assets[effectiveVariant]
  return (
    <svg
      className={`brand-logo brand-logo--${effectiveVariant} ${className}`}
      viewBox={asset.viewBox}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'SAMBY'}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <image
        href={`${import.meta.env.BASE_URL}brand/${asset.file}`}
        width={asset.width}
        height={asset.height}
      />
    </svg>
  )
}
