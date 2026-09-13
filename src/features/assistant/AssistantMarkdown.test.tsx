import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'

import { AssistantMarkdown } from './AssistantMarkdown'

afterEach(cleanup)

test('renders common and GitHub-flavored Markdown in guide responses', () => {
  render(
    <AssistantMarkdown
      content={`## Inventory summary

You have **10 units** and \`8 available\`.

- Review reservations
- Reorder low stock

| Metric | Value |
| --- | ---: |
| Available | 8 |

[Open documentation](https://example.com/docs)`}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Inventory summary' })).toBeInTheDocument()
  expect(screen.getByText('10 units').tagName).toBe('STRONG')
  expect(screen.getByRole('list')).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open documentation' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
})

test('does not render raw HTML from a guide response', () => {
  const { container } = render(
    <AssistantMarkdown content={'Before <script>alert("unsafe")</script> after'} />,
  )

  expect(container.querySelector('script')).not.toBeInTheDocument()
  expect(screen.getByText(/Before/)).toBeInTheDocument()
})
