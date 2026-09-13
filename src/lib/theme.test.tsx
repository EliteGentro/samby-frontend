import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from './theme'
import { BrandLogo } from '../components/BrandLogo'

function ThemeTestConsumer() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
      <BrandLogo />
      <BrandLogo variant="symbol" />
      <BrandLogo variant="white" />
    </div>
  )
}

describe('Theme management and BrandLogo integration', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  })

  afterEach(cleanup)

  it('defaults to light theme when system does not prefer dark', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeTestConsumer />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')

    // BrandLogo defaults to navy on light surface
    const logos = document.querySelectorAll('.brand-logo')
    expect(logos[0]).toHaveClass('brand-logo--navy')
    expect(logos[1]).toHaveClass('brand-logo--symbol')
    expect(logos[2]).toHaveClass('brand-logo--white')
  })

  it('toggles between light and dark and updates DOM classes', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeTestConsumer />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Theme' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(localStorage.getItem('samby-theme')).toBe('dark')

    // Default BrandLogo should automatically switch to white on dark surface
    const logos = document.querySelectorAll('.brand-logo')
    expect(logos[0]).toHaveClass('brand-logo--white')
    expect(logos[1]).toHaveClass('brand-logo--symbol')
    expect(logos[2]).toHaveClass('brand-logo--white')

    // Toggle back to light
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Theme' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('samby-theme')).toBe('light')
    expect(logos[0]).toHaveClass('brand-logo--navy')
  })

  it('restores theme from localStorage', () => {
    localStorage.setItem('samby-theme', 'dark')

    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('allows explicit setTheme call and persists preference', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeTestConsumer />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Set Dark' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(localStorage.getItem('samby-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Set Light' }))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(localStorage.getItem('samby-theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
