import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { emptyWorkspace, type Product, type Location, type Purchase, type StockPosition } from '../domain/workspace'
import { ThemeProvider } from './theme'
import { InventoryGraphsPanel } from '../features/business/InventoryGraphsPanel'

afterEach(cleanup)

describe('Dark & Light Theme Guardrails (Audit & Regression Prevention)', () => {
  describe('Static codebase audit', () => {
    const srcDir = path.resolve(__dirname, '..')

    function getSourceFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist') {
            files.push(...getSourceFiles(fullPath))
          }
        } else if (
          (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
          !entry.name.includes('.test.')
        ) {
          files.push(fullPath)
        }
      }
      return files
    }

    it('prohibits hardcoded "bg-white" without dark:bg- variants across all components', () => {
      const files = getSourceFiles(srcDir)
      const violations: { file: string; line: number; text: string }[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, index) => {
          if (
            /\bbg-white\b/.test(line) &&
            !/dark:bg-/.test(line) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              text: line.trim(),
            })
          }
        })
      }

      expect(
        violations,
        `Found hardcoded bg-white without dark:bg- variants:\n${violations
          .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}`,
      ).toEqual([])
    })

    it('prohibits hardcoded slate background, text, and border classes without dark variants', () => {
      const files = getSourceFiles(srcDir)
      const violations: { file: string; line: number; text: string }[] = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, index) => {
          if (
            /\b(?:bg|text|border)-slate-\d+\b/.test(line) &&
            !/dark:/.test(line) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              text: line.trim(),
            })
          }
        })
      }

      expect(
        violations,
        `Found hardcoded slate classes without dark variants:\n${violations
          .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}`,
      ).toEqual([])
    })

    it('prohibits hardcoded light-mode hex backgrounds in inline styles', () => {
      const files = getSourceFiles(srcDir)
      const violations: { file: string; line: number; text: string }[] = []
      const forbiddenHexes = ['#f8faf6', '#fafbf9', '#ffffff']

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')
        lines.forEach((line, index) => {
          if (
            line.includes('backgroundColor') &&
            forbiddenHexes.some((hex) => line.includes(hex)) &&
            !line.trim().startsWith('//')
          ) {
            violations.push({
              file: path.relative(srcDir, file),
              line: index + 1,
              text: line.trim(),
            })
          }
        })
      }

      expect(
        violations,
        `Found hardcoded light hex backgrounds in inline styles:\n${violations
          .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
          .join('\n')}`,
      ).toEqual([])
    })
  })

  describe('InventoryGraphsPanel dark and light rendering', () => {
    function createTestWorkspace() {
      const w = emptyWorkspace('theme-test', 'demo')
      const loc1: Location = { id: 'loc-1', name: 'Monterrey warehouse' }
      const loc2: Location = { id: 'loc-2', name: 'Saltillo branch' }
      w.locations = [loc1, loc2]

      const p1: Product = {
        id: 'prod-1',
        sku: 'BOX-01',
        name: 'Corrugated Box',
        category: 'Packaging',
        unit: 'unit',
        cost: 50,
        price: 80,
        reorderPoint: 100,
        safetyStock: 20,
        serviceTarget: null,
        supplierId: 'sup-1',
        leadTimeDays: 7,
        moq: null,
        casePack: null,
      }
      const p2: Product = {
        id: 'prod-2',
        sku: 'TAPE-02',
        name: 'Industrial Tape',
        category: 'Industrial',
        unit: 'roll',
        cost: 30,
        price: 55,
        reorderPoint: 200,
        safetyStock: 50,
        serviceTarget: null,
        supplierId: 'sup-1',
        leadTimeDays: 5,
        moq: null,
        casePack: null,
      }
      w.products = [p1, p2]

      const sp1: StockPosition = {
        id: 'sp-1',
        productId: 'prod-1',
        locationId: 'loc-1',
        onHand: 120,
        reserved: 0,
        asOf: '2026-09-01',
        quantityBasis: 'available',
      }
      const sp2: StockPosition = {
        id: 'sp-2',
        productId: 'prod-2',
        locationId: 'loc-2',
        onHand: 80,
        reserved: 0,
        asOf: '2026-09-01',
        quantityBasis: 'available',
      }
      w.stock = [sp1, sp2]

      const po: Purchase = {
        id: 'po-1',
        productId: 'prod-1',
        supplierId: 'sup-1',
        quantity: 50,
        amount: 2500,
        orderDate: '2026-09-01',
        promisedDate: '2026-09-15',
        receivedDate: null,
        receivedQuantity: 0,
        plannedPaymentDate: null,
        paidAmount: 0,
        locationId: 'loc-1',
      }
      w.purchases = [po]
      return w
    }

    it('renders all 4 cards using semantic bg-card and text-card-foreground in light mode', () => {
      const workspace = createTestWorkspace()
      const { container } = render(
        <ThemeProvider defaultTheme="light">
          <InventoryGraphsPanel
            workspace={workspace}
            location=""
            onSelectLocation={() => {}}
          />
        </ThemeProvider>,
      )

      // No card should have bg-white or border-slate-200
      expect(container.querySelector('.bg-white')).toBeNull()
      expect(container.querySelector('.border-slate-200')).toBeNull()

      // All cards should use bg-card and border-border
      const cards = container.querySelectorAll('.bg-card')
      expect(cards.length).toBeGreaterThanOrEqual(4)

      // Titles are rendered
      expect(screen.getByText('Stock Distribution by Category')).toBeInTheDocument()
      expect(screen.getByText('Stock Health & Reorder Thresholds')).toBeInTheDocument()
      expect(screen.getByText('Multi-Location Allocation')).toBeInTheDocument()
      expect(screen.getByText('Replenishment Pipeline')).toBeInTheDocument()
    })

    it('renders correctly in dark mode without hardcoded white backgrounds', () => {
      const workspace = createTestWorkspace()
      const { container } = render(
        <ThemeProvider defaultTheme="dark">
          <InventoryGraphsPanel
            workspace={workspace}
            location=""
            onSelectLocation={() => {}}
          />
        </ThemeProvider>,
      )

      // Document root should have dark class
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      // Ensure absolutely no bg-white exists in dark mode
      expect(container.querySelector('.bg-white')).toBeNull()

      // Cards use semantic tokens
      const cards = container.querySelectorAll('.bg-card')
      expect(cards.length).toBeGreaterThanOrEqual(4)

      // Check threshold badges have dark variants
      const healthyBadge = screen.getByText('Above threshold').closest('div')
      expect(healthyBadge?.className).toContain('dark:bg-emerald-950/40')
      expect(healthyBadge?.className).toContain('dark:text-emerald-300')

      const belowBadge = screen.getByText('Below reorder point').closest('div')
      expect(belowBadge?.className).toContain('dark:bg-rose-950/40')
      expect(belowBadge?.className).toContain('dark:text-rose-300')

      // Check metric toggle switches correctly between Value and Units
      const valueButton = screen.getByRole('button', { name: 'Value' })
      const unitsButton = screen.getByRole('button', { name: 'Units' })
      expect(valueButton.className).toContain('bg-card')

      fireEvent.click(unitsButton)
      expect(unitsButton.className).toContain('bg-card')
    })
  })
})
