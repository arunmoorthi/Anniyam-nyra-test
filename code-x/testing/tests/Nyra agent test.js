const { test, expect } = require('@playwright/test');
// Run command: npx playwright test --headed "testing/tests/Nyra agent test.js"

test.describe.configure({ mode: 'serial' });

let context;
let sharedPage;

async function openLoginPage(page) {
  // Open login page and make sure identifier input is ready for negative-login checks.
  await page.goto('https://nyra.care/auth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const acceptAllButton = page.getByRole('button', { name: 'Accept All' });
  if (await acceptAllButton.isVisible().catch(() => false)) {
    await acceptAllButton.click();
    await page.waitForTimeout(2000);
  }

  await expect(page.locator('#identifier')).toBeVisible();
  await page.waitForTimeout(2000);
}

async function loginAndOpenWorkArea(page) {
  // Full positive setup: login, navigate to Settings > Work Area, and open "Request New Village" form.
  await page.goto('https://nyra.care/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const acceptAllButton = page.getByRole('button', { name: 'Accept All' });
  if (await acceptAllButton.isVisible().catch(() => false)) {
    await acceptAllButton.click();
    await page.waitForTimeout(2000);
  }

  await expect(page).toHaveURL('https://nyra.care/');
  await page.waitForTimeout(2000);
  await expect(page).toHaveTitle(/Nyra/i);
  await page.waitForTimeout(2000);

  await page.goto('https://nyra.care/auth', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.locator('#identifier').fill('arun@anniyam.com');
  await page.waitForTimeout(2000);
  await page.locator('#password').fill('Anniyam@123');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(2000);

  await expect(page).toHaveURL(/\/dashboard/);
  await page.waitForTimeout(2000);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForTimeout(2000);

  await expect(page).toHaveURL(/\/dashboard\/settings/);
  await page.waitForTimeout(2000);
  await expect(page.getByText('Account Settings')).toBeVisible();
  await page.waitForTimeout(2000);

  await page.getByRole('tab', { name: 'Work Area' }).click();
  await page.waitForTimeout(2000);

  await expect(page.getByText('Assigned Work Villages')).toBeVisible();
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'Request New Village' }).click();
  await page.waitForTimeout(2000);

  await expect(page.getByText('Request New Work Village')).toBeVisible();
  await page.waitForTimeout(2000);
}

async function selectComboboxOption(page, index, optionName) {
  // Reusable dropdown step for state/district/sub-district/village selection.
  await page.getByRole('combobox').nth(index).click();
  await page.waitForTimeout(2000);
  await page.getByRole('option', { name: optionName, exact: true }).click();
  await page.waitForTimeout(2000);
}

test.describe('Nyra site flow', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    sharedPage = await context.newPage();
  });

  test.afterAll(async () => {
    await sharedPage?.close();
    await context?.close();
  });

  test('negative: login rejects invalid email format', async () => {
    // Validates auth form blocks obviously invalid email input.
    test.setTimeout(120000);

    await openLoginPage(sharedPage);

    await sharedPage.locator('#identifier').fill('invalid-email');
    await sharedPage.waitForTimeout(2000);
    await sharedPage.getByRole('button', { name: 'Sign In' }).click();
    await sharedPage.waitForTimeout(2000);

    await expect(sharedPage).toHaveURL(/\/auth$/);
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator('#identifier')).toHaveValue('invalid-email');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator('#password')).toBeVisible();
    await sharedPage.waitForTimeout(2000);
  });

  test('negative: login rejects invalid mobile number', async () => {
    // Validates auth form rejects short/invalid mobile number input.
    test.setTimeout(120000);

    await openLoginPage(sharedPage);

    await sharedPage.locator('#identifier').fill('12345');
    await sharedPage.waitForTimeout(2000);
    await sharedPage.getByRole('button', { name: 'Sign In' }).click();
    await sharedPage.waitForTimeout(2000);

    await expect(sharedPage).toHaveURL(/\/auth$/);
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator('#identifier')).toHaveValue('12345');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.locator('#password')).toBeVisible();
    await sharedPage.waitForTimeout(2000);
  });

  test('negative: login fails with invalid password', async () => {
    // Validates backend auth error path for wrong password.
    test.setTimeout(120000);

    await openLoginPage(sharedPage);

    await sharedPage.locator('#identifier').fill('arun@anniyam.com');
    await sharedPage.waitForTimeout(2000);
    await sharedPage.locator('#password').fill('WrongPassword123');
    await sharedPage.waitForTimeout(2000);
    await sharedPage.getByRole('button', { name: 'Sign In' }).click();
    await sharedPage.waitForTimeout(2000);

    await expect(sharedPage).toHaveURL(/\/auth$/);
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByText('Invalid email or password').first()).toBeVisible();
    await sharedPage.waitForTimeout(2000);
  });

  test('negative: request stays blocked when required fields are empty', async () => {
    // Confirms submit stays disabled until all required village fields are selected.
    test.setTimeout(120000);
    await loginAndOpenWorkArea(sharedPage);

    const submitButton = sharedPage.getByRole('button', { name: 'Submit Request' });

    await expect(submitButton).toBeDisabled();
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(0)).toContainText('Select state');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(1)).toContainText('Select district');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(2)).toContainText('Select sub-district');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(3)).toContainText('Select village');
    await sharedPage.waitForTimeout(2000);
  });

  test('positive: submit a new village request', async () => {
    // Happy path: select all required location fields and submit the work-village request.
    await selectComboboxOption(sharedPage, 0, 'Tamil Nadu');
    await selectComboboxOption(sharedPage, 1, 'Dharmapuri');
    await selectComboboxOption(sharedPage, 2, 'Harur');
    await selectComboboxOption(sharedPage, 3, 'Harur');

    await expect(sharedPage.getByRole('combobox').nth(0)).toContainText('Tamil Nadu');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(1)).toContainText('Dharmapuri');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(2)).toContainText('Harur');
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByRole('combobox').nth(3)).toContainText('Harur');
    await sharedPage.waitForTimeout(2000);

    const submitButton = sharedPage.getByRole('button', { name: 'Submit Request' });
    await expect(submitButton).toBeEnabled();
    await sharedPage.waitForTimeout(2000);

    await submitButton.click();
    await sharedPage.waitForTimeout(2000);

    await expect(sharedPage.getByText('Work village request submitted successfully')).toBeVisible();
    await sharedPage.waitForTimeout(2000);
    await expect(sharedPage.getByText('Pending').first()).toBeVisible();
    await sharedPage.waitForTimeout(2000);
  });
});
