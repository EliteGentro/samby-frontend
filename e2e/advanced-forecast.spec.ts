import { expect, test } from '@playwright/test'

test('both advanced engines train on reviewed business data and retain chronological evaluation after reload', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  await page.goto('/#/business/home')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('Forecast acceptance business')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Monterrey',
  }).format(new Date())
  const rows = Array.from({ length: 90 }, (_, index) => {
    const day = new Date(`${today}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() - 90 + index)
    const quantity = 10 + (index % 7) + Math.floor(index / 30)
    return `${day.toISOString().slice(0, 10)},FORECAST-1,Acceptance widget,${quantity},pieces,${quantity * 5},MXN`
  })
  await page
    .getByLabel('Choose your sales file')
    .setInputFiles({
      name: 'observed-sales.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        ['date,sku,product,quantity,unit,amount,currency', ...rows].join('\n'),
      ),
    })
  await page
    .getByRole('textbox', { name: /Amount definition/ })
    .fill('Net excluding tax')
  await page.getByRole('checkbox', { name: /I confirm these mappings/ }).check()
  await page.getByRole('button', { name: 'Confirm & apply 90 rows' }).click()
  await page.getByRole('button', { name: 'View my workspace' }).click()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  for (const engine of ['lightgbm', 'catboost']) {
    await page.goto('/#/business/analysis')
    await page.getByRole('button', { name: 'Forecasts', exact: true }).click()
    await page
      .getByRole('button', { name: 'New forecast', exact: true })
      .click()
    await page
      .getByLabel('Definition name', { exact: true })
      .fill(`Actual ${engine} forecast`)
    await page
      .getByLabel('Forecast engine', { exact: true })
      .selectOption(engine)
    await page
      .getByRole('button', { name: 'Save and run', exact: true })
      .click()
    await expect(
      page.getByRole('heading', {
        name: 'Temporal forecast evaluation',
        exact: true,
      }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByText('Demonstration data', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText('14 unseen daily observations', { exact: false }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', {
        name: `Actual ${engine} forecast`,
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', {
        name: 'Temporal forecast evaluation',
        exact: true,
      }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
    await page.screenshot({
      path: testInfo.outputPath(`${engine}-business-result.png`),
      fullPage: true,
    })
  }
})
