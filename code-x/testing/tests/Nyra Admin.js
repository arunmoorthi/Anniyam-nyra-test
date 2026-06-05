const { test, expect } = require('@playwright/test');

test('admin login redirects to dashboard', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('https://nyra.care/auth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const acceptAllButton = page.getByRole('button', { name: 'Accept All' });
  if (await acceptAllButton.isVisible().catch(() => false)) {
    await acceptAllButton.click();
    await page.waitForTimeout(2000);
  }

  await expect(page.locator('#identifier')).toBeVisible();
  await page.locator('#identifier').fill('mani@anniyam.com');
  await page.waitForTimeout(2000);

  await expect(page.locator('#password')).toBeVisible();
  await page.locator('#password').fill('Moneypurse@123');
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(2000);

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/dashboard/i).first()).toBeVisible();
});
