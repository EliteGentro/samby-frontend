import { expect, test } from '@playwright/test'

test('completed forecast playback stays usable while scrolling on desktop and mobile', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(45_000)
  await page.goto('/#/demo/analysis')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Forecasts', exact: true }).click()
  await page.getByRole('button', { name: 'New forecast', exact: true }).click()
  await page
    .getByLabel(/^Definition name/)
    .fill('Responsive playback forecast')
  await page.getByRole('button', { name: 'Save and run', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Dated demand forecast', exact: true }),
  ).toBeVisible({ timeout: 20_000 })

  const dock = page.getByRole('region', { name: 'Result playback controls' })
  const slider = page.getByRole('slider', { name: 'Playback date' })
  await expect(dock).toBeVisible()
  await expect(slider).toHaveValue('0')
  await page.getByRole('button', { name: 'Next date' }).click()
  await expect(slider).toHaveValue('1')
  await page.getByRole('button', { name: '2×' }).click()
  await expect(page.getByRole('button', { name: '2×' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await slider.focus()
  await page.keyboard.press('End')
  await expect(slider).toHaveValue('29')
  await expect(
    page.getByRole('button', { name: 'Replay from start' }),
  ).toBeVisible()
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue('0')

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  const layout = await page.evaluate(() => {
    const playbackDock = document.querySelector<HTMLElement>(
      '.analysis-playback-dock',
    )!
    const main = document.querySelector<HTMLElement>('.main-shell')!
    const finalPanel = document.querySelector<HTMLElement>(
      '.analysis-results > .panel:last-of-type',
    )!
    const topPlayback = document.querySelector<HTMLElement>(
      '.analysis-playback-panel',
    )!
    const dockRect = playbackDock.getBoundingClientRect()
    return {
      position: getComputedStyle(playbackDock).position,
      dockBottom: dockRect.bottom,
      dockLeft: dockRect.left,
      dockTop: dockRect.top,
      mainLeft: main.getBoundingClientRect().left,
      finalPanelBottom: finalPanel.getBoundingClientRect().bottom,
      topPlaybackBottom: topPlayback.getBoundingClientRect().bottom,
      viewportHeight: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  expect(layout.position).toBe('fixed')
  expect(Math.abs(layout.dockBottom - layout.viewportHeight)).toBeLessThanOrEqual(
    1,
  )
  expect(Math.abs(layout.dockLeft - layout.mainLeft)).toBeLessThanOrEqual(1)
  expect(layout.dockLeft).toBe(isMobile ? 0 : layout.mainLeft)
  expect(layout.finalPanelBottom).toBeLessThanOrEqual(layout.dockTop)
  expect(layout.topPlaybackBottom).toBeLessThan(0)
  expect(layout.overflow).toBeLessThanOrEqual(0)
})
