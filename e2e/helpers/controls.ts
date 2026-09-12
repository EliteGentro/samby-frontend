import { expect, type Locator } from '@playwright/test'

export async function chooseOption(control: Locator, name: string | RegExp) {
  await control.click()
  const option = control
    .page()
    .getByRole('listbox')
    .getByRole('option', {
      name,
      exact: typeof name === 'string',
    })
  const label = await option.innerText()
  await option.click()
  await expect(control).toHaveText(label)
  await expect(control).toHaveAttribute('aria-expanded', 'false')
}
