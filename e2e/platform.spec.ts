import { expect, test } from '@playwright/test'

const api = 'http://127.0.0.1:8001/api/prototype'

test('an account reopens durable business records in a fresh browser context', async ({
  page,
  browser,
}) => {
  const suffix = crypto.randomUUID()
  const email = `owner-${suffix}@example.test`
  const password = 'Samby-test-account-42!'
  const name = `Saved business ${suffix.slice(0, 8)}`
  await page.goto('/#/business/home')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill(name)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page
    .getByRole('button', { name: 'Continue for now', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Continue for now', exact: true })
    .click()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.goto('/#/business/settings')
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Grant access', exact: true }),
  ).toBeVisible()

  const otherContext = await browser.newContext()
  const restored = await otherContext.newPage()
  try {
    await restored.goto('http://127.0.0.1:4173/#/business/settings')
    await restored.getByRole('button', { name: 'Log in', exact: true }).click()
    await restored
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill(email)
    await restored.getByLabel('Password', { exact: true }).fill(password)
    await restored
      .getByRole('dialog')
      .getByRole('button', { name: 'Log in', exact: true })
      .click()
    await expect(restored.locator('.workspace-title strong')).toHaveText(name)
    await expect(
      restored.getByText('Saved to SAMBY', { exact: true }),
    ).toBeVisible()
    await restored.reload()
    await expect(restored.locator('.workspace-title strong')).toHaveText(name)
  } finally {
    await otherContext.close()
  }
})

test('workspace identifiers alone do not grant access and stale edits do not overwrite records', async ({
  page,
  request,
}) => {
  await page.goto('/#/business/home')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  const credentials = await page.evaluate(() => {
    const id = localStorage.getItem('samby.workspace-id.business')!
    return { id, key: localStorage.getItem(`samby.workspace-key.${id}`)! }
  })
  const unauthorized = await request.get(
    `${api}/workspaces/${credentials.id}`,
    { headers: { 'X-Workspace-ID': credentials.id } },
  )
  expect([401, 403, 404]).toContain(unauthorized.status())
  const headers = {
    'X-Workspace-ID': credentials.id,
    'X-Workspace-Key': credentials.key,
  }
  const read = await request.get(`${api}/workspaces/${credentials.id}`, {
    headers,
  })
  expect(read.ok()).toBe(true)
  const current = await read.json()
  const update = {
    ...current.workspace,
    profile: {
      ...current.workspace.profile,
      name: 'Another device saved this',
    },
  }
  const first = await request.put(`${api}/workspaces/${credentials.id}`, {
    headers,
    data: { workspace: update, expected_revision: current.revision },
  })
  expect(first.ok()).toBe(true)
  const stale = await request.put(`${api}/workspaces/${credentials.id}`, {
    headers,
    data: { workspace: current.workspace, expected_revision: current.revision },
  })
  expect(stale.status()).toBe(409)
  await page.reload()
  await expect(page.locator('.workspace-title strong')).toHaveText(
    'Another device saved this',
  )
})

test('team access is granted through the UI and a viewer cannot mutate business data', async ({
  page,
  request,
  browser,
}) => {
  const suffix = crypto.randomUUID()
  const email = `viewer-${suffix}@example.test`
  const password = 'Samby-viewer-account-42!'
  const viewerRegistration = await request.post(`${api}/auth/register`, {
    data: { email, password, name: 'Read only colleague' },
  })
  expect(viewerRegistration.ok()).toBe(true)
  const viewer = await viewerRegistration.json()
  await page.goto('/#/business/settings')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(`admin-${suffix}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Grant access', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Account email', exact: true })
    .fill(email)
  await page.getByRole('button', { name: 'Grant access', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
  const id = await page.evaluate(() =>
    localStorage.getItem('samby.workspace-id.business'),
  )
  const headers = {
    Authorization: `Bearer ${viewer.access_token}`,
    'X-Workspace-ID': id!,
  }
  const read = await request.get(`${api}/workspaces/${id}`, { headers })
  expect(read.ok()).toBe(true)
  const current = await read.json()
  const write = await request.put(`${api}/workspaces/${id}`, {
    headers,
    data: {
      workspace: {
        ...current.workspace,
        profile: { ...current.workspace.profile, name: 'Forbidden' },
      },
      expected_revision: current.revision,
    },
  })
  expect(write.status()).toBe(403)
  const viewerContext = await browser.newContext()
  try {
    await viewerContext.addInitScript(
      (token) => localStorage.setItem('samby.access-token', token),
      viewer.access_token,
    )
    const viewerPage = await viewerContext.newPage()
    await viewerPage.goto('http://127.0.0.1:4173/#/business/settings')
    await expect(
      viewerPage.getByText('Your workspace role is', { exact: false }),
    ).toContainText('viewer')
    await expect(
      viewerPage.getByRole('button', { name: 'Grant access', exact: true }),
    ).toHaveCount(0)
  } finally {
    await viewerContext.close()
  }
})

test('a finance member can save reviewed financial intake without changing administrator preferences', async ({
  page,
  request,
  browser,
}) => {
  const suffix = crypto.randomUUID()
  const password = 'Samby-finance-test-42!'
  const register = async (email: string) => {
    const response = await request.post(`${api}/auth/register`, {
      data: { email, password },
    })
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const owner = await register(`finance-owner-${suffix}@example.test`)
  const memberEmail = `finance-member-${suffix}@example.test`
  const member = await register(memberEmail)
  await page.goto('/#/business/home')
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Set up my workspace' }).click()
  await page
    .getByRole('textbox', { name: 'Business name', exact: true })
    .fill('Finance team workspace')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page
    .getByRole('button', { name: 'Save draft & close', exact: true })
    .click()
  await expect(page.getByText('Saved to SAMBY', { exact: true })).toBeVisible()
  const credentials = await page.evaluate(() => {
    const id = localStorage.getItem('samby.workspace-id.business')!
    return { id, key: localStorage.getItem(`samby.workspace-key.${id}`)! }
  })
  const ownerHeaders = {
    Authorization: `Bearer ${owner.access_token}`,
    'X-Workspace-ID': credentials.id,
    'X-Workspace-Key': credentials.key,
  }
  const claim = await request.post(
    `${api}/workspaces/${credentials.id}/claim`,
    { headers: ownerHeaders },
  )
  expect(claim.ok()).toBe(true)
  const previous = await claim.json()
  const grant = await request.post(
    `${api}/workspaces/${credentials.id}/members`,
    { headers: ownerHeaders, data: { email: memberEmail, role: 'finance' } },
  )
  expect(grant.ok()).toBe(true)
  const context = await browser.newContext({ viewport: page.viewportSize()! })
  try {
    await context.addInitScript((token) => {
      if (location.origin === 'http://127.0.0.1:4173')
        localStorage.setItem('samby.access-token', token)
    }, member.access_token)
    const finance = await context.newPage()
    await finance.goto('http://127.0.0.1:4173/#/business/finance')
    await expect
      .poll(() =>
        finance.evaluate(() =>
          localStorage.getItem('samby.workspace-id.business'),
        ),
      )
      .toBe(credentials.id)
    await expect(
      finance.getByText('Saved to SAMBY', { exact: true }),
    ).toBeVisible()
    await finance
      .getByRole('button', { name: 'Add financial data', exact: true })
      .click()
    await finance
      .getByRole('button', { name: 'Available cash', exact: true })
      .click()
    await finance
      .getByLabel('Available cash · MXN', { exact: true })
      .fill('300')
    await finance
      .getByLabel('Balance date', { exact: true })
      .fill(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: previous.workspace.profile.timezone,
        }).format(new Date()),
      )
    await finance
      .getByRole('button', { name: 'Review cash', exact: true })
      .click()
    await finance
      .getByRole('checkbox', {
        name: 'I confirm these values and their stated meaning.',
      })
      .check()
    await finance
      .getByRole('button', { name: 'Confirm & apply', exact: true })
      .click()
    await expect(
      finance.getByText('Saved to SAMBY', { exact: true }),
    ).toBeVisible()
    const current = await request.get(`${api}/workspaces/${credentials.id}`, {
      headers: {
        Authorization: `Bearer ${member.access_token}`,
        'X-Workspace-ID': credentials.id,
      },
    })
    expect(current.ok()).toBe(true)
    const result = await current.json()
    expect(result.workspace.cash.amount).toBe(300)
    expect(result.workspace.notifications).toEqual(
      previous.workspace.notifications,
    )
    expect(result.workspace.profile).toEqual(previous.workspace.profile)
    await finance.reload()
    await expect(
      finance.getByText('Saved to SAMBY', { exact: true }),
    ).toBeVisible()
  } finally {
    await context.close()
  }
})
