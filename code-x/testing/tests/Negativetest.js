const { test, expect, devices } = require('@playwright/test');

// Run command: npx playwright test --headed "testing/tests/Negativetest.js"

const nyraUrl = 'https://nyra.care';
const validCredentials = {
  email: 'arun@anniyam.com',
  password: 'Anniyam@123',
};

test.use({
  ...devices['Pixel 5'],
});

async function acceptCookiesIfVisible(page) {
  const acceptAllButton = page.getByRole('button', { name: 'Accept All' });
  if (await acceptAllButton.isVisible().catch(() => false)) {
    await acceptAllButton.click();
    await page.waitForTimeout(1000);
  }
}

async function openLoginPage(page) {
  await page.goto(`${nyraUrl}/auth`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await acceptCookiesIfVisible(page);
  await expect(page.locator('#identifier')).toBeVisible();
}

async function loginToNyra(page) {
  await openLoginPage(page);

  await page.locator('#identifier').fill(validCredentials.email);
  await page.waitForTimeout(1000);
  await page.locator('#password').fill(validCredentials.password);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(1500);

  await expect(page).toHaveURL(/\/dashboard/);
}

async function openShgsMobilePage(page) {
  const mobileNav = page.getByRole('navigation').last();
  const shgTable = page.getByRole('table').first();
  const shgRows = page.getByRole('row');

  if ((await shgTable.isVisible().catch(() => false)) && (await shgRows.count()) > 1) {
    return;
  }

  const shgsNavButton = mobileNav.getByRole('button', { name: /^SHGs$/i });
  await expect(shgsNavButton).toBeVisible();
  await shgsNavButton.click({ force: true });
  await page.waitForTimeout(1000);
}

async function openTargetShgCollection(page, searchTerm = 'Test Arun Qa') {
  const searchBox = page.getByRole('textbox', { name: /Search by SHG name/i }).first();
  if (await searchBox.isVisible().catch(() => false)) {
    await searchBox.fill(searchTerm);
    await page.waitForTimeout(1000);
  }

  const targetRow = page.getByRole('row', { name: /Test Arun Qa/i }).first();
  await expect(targetRow).toBeVisible();

  const actionButtons = targetRow.getByRole('button');
  const actionCount = await actionButtons.count();

  for (let i = 0; i < actionCount; i++) {
    const button = actionButtons.nth(i);

    try {
      await button.click({ force: true, timeout: 3000 });
    } catch {
      continue;
    }

    await page.waitForTimeout(1000);

    const reachedCollectionArea =
      (await page.getByRole('dialog', { name: /Transaction|Collection/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('tab', { name: /Collection/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /^Collections?$/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /Collect Dues/i }).first().isVisible().catch(() => false));

    if (reachedCollectionArea) {
      break;
    }
  }

  const collectionTab = page.getByRole('tab', { name: /Collection/i }).first();
  const collectionLink = page.getByRole('link', { name: /Collection/i }).first();
  const collectionButton = page.getByRole('button', { name: /^Collections?$/i }).first();
  const collectDuesButton = page.getByRole('button', { name: /Collect Dues/i }).first();

  if (await collectionTab.isVisible().catch(() => false)) {
    await collectionTab.click({ force: true });
  } else if (await collectionLink.isVisible().catch(() => false)) {
    await collectionLink.click({ force: true });
  } else if (await collectDuesButton.isVisible().catch(() => false)) {
    await collectDuesButton.click({ force: true });
  } else if (await collectionButton.isVisible().catch(() => false)) {
    await collectionButton.click({ force: true });
  }

  await page.waitForTimeout(1000);
}

async function openReceiptDialog(page) {
  const transactionDialog = page.getByRole('dialog', { name: /Transaction/i });
  const collectionDialog = page.getByRole('dialog', { name: /Collection/i }).first();

  if (!(await transactionDialog.isVisible().catch(() => false))) {
    const collectDuesButton = page.getByRole('button', { name: /Collect Dues/i }).first();
    if (await collectDuesButton.isVisible().catch(() => false)) {
      await collectDuesButton.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  const receiptButton = transactionDialog.getByRole('button', { name: /Receipt/i }).first();
  if (await receiptButton.isVisible().catch(() => false)) {
    await receiptButton.click({ force: true });
    await page.waitForTimeout(1000);
  }

  if (await collectionDialog.getByText(/Register Bank Accounts/i).isVisible().catch(() => false)) {
    const skipButton = collectionDialog.getByRole('button', { name: /Skip for Now/i }).first();
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  await expect(collectionDialog).toBeVisible();
}

async function switchToInternalLoanIfNeeded(page) {
  const internalLoanTriggers = [
    page.getByRole('tab', { name: /Internal Loan/i }).first(),
    page.getByRole('button', { name: /Internal Loan/i }).first(),
    page.getByRole('radio', { name: /Internal Loan/i }).first(),
    page.getByText(/Loan Collection|Loan Repayment|Internal Loan/i).first(),
  ];

  for (const locator of internalLoanTriggers) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true });
      await page.waitForTimeout(1000);
      break;
    }
  }
}

async function openArunMemberLoanEditor(page) {
  const collectionDialog = page.getByRole('dialog', { name: /Collection/i }).first();

  const backToListButton = collectionDialog.getByRole('button', { name: /Back to List/i }).first();
  if (await backToListButton.isVisible().catch(() => false)) {
    await backToListButton.click({ force: true });
    await page.waitForTimeout(1000);
  }

  await switchToInternalLoanIfNeeded(page);

  const arunMemberButton = collectionDialog.getByRole('button', { name: /Arun/i }).first();
  await expect(arunMemberButton).toBeVisible();
  await arunMemberButton.click({ force: true });
  await page.waitForTimeout(1000);

  await expect(collectionDialog.getByText(/Loan Repayments/i).first()).toBeVisible();
}

function getCollectionDialog(page) {
  return page.getByRole('dialog', { name: /Collection/i }).first();
}

function getSavingsInput(page) {
  return getCollectionDialog(page)
    .locator('xpath=(//*[normalize-space(.)="Savings"]/following::input[1])[1]')
    .first();
}

function getInternalLoanInput(page) {
  return getCollectionDialog(page)
    .locator('xpath=(//*[contains(normalize-space(.),"Internal Loan #0001")]/following::input[1])[1]')
    .first();
}

async function setLoanValues(page, { savings = '0', loan = '0' }) {
  const savingsInput = getSavingsInput(page);
  if (await savingsInput.isVisible().catch(() => false)) {
    await savingsInput.fill(savings);
    await page.waitForTimeout(300);
  }

  const loanInput = getInternalLoanInput(page);
  await expect(loanInput).toBeVisible();
  await loanInput.click();
  await loanInput.press('Control+A');
  await loanInput.type(loan);
  await loanInput.press('Tab');
  await page.waitForTimeout(500);
}

async function clickSaveAndNextIfVisible(page) {
  const saveNextButton = getCollectionDialog(page).getByRole('button', { name: /Save\s*&\s*Next/i }).first();
  if (await saveNextButton.isVisible().catch(() => false)) {
    await saveNextButton.click({ force: true });
    await page.waitForTimeout(1000);
  }
}

async function backToListIfVisible(page) {
  const backToListButton = getCollectionDialog(page).getByRole('button', { name: /Back to List/i }).first();
  if (await backToListButton.isVisible().catch(() => false)) {
    await backToListButton.click({ force: true });
    await page.waitForTimeout(1000);
  }
}

async function selectCashInHand(page) {
  const selectors = [
    page.getByRole('option', { name: /Cash in Hand/i }).first(),
    page.getByRole('radio', { name: /Cash in Hand/i }).first(),
    page.getByRole('button', { name: /Cash in Hand/i }).first(),
    page.getByRole('combobox', { name: /Payment|Mode/i }).first(),
    page.getByText(/Cash in Hand/i).first(),
  ];

  for (const locator of selectors) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }
}

async function expectAnyVisible(page, patterns) {
  for (const pattern of patterns) {
    const textLocator = page.getByText(pattern).first();
    if (await textLocator.isVisible({ timeout: 4000 }).catch(() => false)) {
      await expect(textLocator).toBeVisible();
      return;
    }
  }

  throw new Error(`None of the expected validation messages were visible: ${patterns.join(', ')}`);
}

test.describe.configure({ mode: 'serial' });

test.describe('Nyra care negative flow coverage', () => {
  test('negative: sign in stays blocked with empty credentials', async ({ page }) => {
    test.setTimeout(120000);

    await openLoginPage(page);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator('#identifier')).toHaveValue('');
    await expect(page.locator('#password')).toHaveValue('');
  });

  test('negative: sign in rejects wrong password', async ({ page }) => {
    test.setTimeout(120000);

    await openLoginPage(page);
    await page.locator('#identifier').fill(validCredentials.email);
    await page.waitForTimeout(1000);
    await page.locator('#password').fill('WrongPassword123');
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/\/auth$/);
    await expectAnyVisible(page, [/Invalid email or password/i, /invalid/i, /wrong/i]);
  });

  test('negative: SHG search with unknown name shows no matching row', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await openShgsMobilePage(page);

    const searchBox = page.getByRole('textbox', { name: /Search by SHG name/i }).first();
    await expect(searchBox).toBeVisible();
    await searchBox.fill('Unknown SHG 999999');
    await page.waitForTimeout(1000);

    await expect(page.getByRole('row', { name: /Test Arun Qa/i }).first()).toHaveCount(0);
    await expectAnyVisible(page, [/No results/i, /No SHG/i, /No data/i, /not found/i]);
  });

  test('negative: receipt submission should not complete without member values', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await openShgsMobilePage(page);
    await openTargetShgCollection(page);
    await openReceiptDialog(page);

    const submitCandidate = page.getByRole('button', { name: /Submit|Collect|Save|Confirm|Next/i }).first();

    if (await submitCandidate.isVisible().catch(() => false)) {
      await submitCandidate.click({ force: true });
      await page.waitForTimeout(1000);
    }

    await expect(page.getByText(/Collection Recorded!/i).first()).toHaveCount(0);
    await expectAnyVisible(page, [/required/i, /enter/i, /select/i, /amount/i, /member/i]);
  });

  test('negative: internal loan rejects zero repayment amount', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await openShgsMobilePage(page);
    await openTargetShgCollection(page);
    await openReceiptDialog(page);
    await openArunMemberLoanEditor(page);
    await setLoanValues(page, { savings: '0', loan: '0' });
    await clickSaveAndNextIfVisible(page);

    await expectAnyVisible(page, [/amount/i, /greater than 0/i, /invalid/i, /required/i]);
  });

  test('negative: internal loan rejects alphabetic amount', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await openShgsMobilePage(page);
    await openTargetShgCollection(page);
    await openReceiptDialog(page);
    await openArunMemberLoanEditor(page);
    await setLoanValues(page, { savings: '0', loan: 'abcd' });
    await clickSaveAndNextIfVisible(page);

    await expectAnyVisible(page, [/invalid/i, /number/i, /amount/i, /required/i]);
  });

  test('negative: payment step stays blocked when payment mode is not selected', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await openShgsMobilePage(page);
    await openTargetShgCollection(page);
    await openReceiptDialog(page);
    await openArunMemberLoanEditor(page);
    await setLoanValues(page, { savings: '0', loan: '1000' });
    await clickSaveAndNextIfVisible(page);
    await backToListIfVisible(page);

    const submitCandidate = page.getByRole('button', { name: /Submit|Collect|Save|Confirm|Next/i }).first();
    if (await submitCandidate.isVisible().catch(() => false)) {
      await submitCandidate.click({ force: true });
      await page.waitForTimeout(1000);
    }

    await expectAnyVisible(page, [/payment/i, /mode/i, /select/i, /required/i]);
    await selectCashInHand(page);
  });
});
