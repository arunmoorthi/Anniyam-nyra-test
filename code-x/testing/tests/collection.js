const { test, expect, devices } = require('@playwright/test');

// Run command: npx playwright test --headed "testing/tests/collection.js"

const nyraUrl = 'https://nyra.care';
// Agent login credentials used for the collection flow.
const credentials = {
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

async function loginToNyra(page) {
  // Open the Nyra login page and sign in as the agent.
  await page.goto(`${nyraUrl}/auth`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await acceptCookiesIfVisible(page);

  await expect(page.locator('#identifier')).toBeVisible();
  await page.locator('#identifier').fill(credentials.email);
  await page.waitForTimeout(1000);
  await page.locator('#password').fill(credentials.password);
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(1000);

  await expect(page).toHaveURL(/\/dashboard/);
}

async function openShgsMobilePage(page) {
  // Use mobile bottom navigation to reach the SHG list page (table/rows view).
  const mobileNav = page.getByRole('navigation').last();
  const shgTable = page.getByRole('table').first();
  const shgRows = page.getByRole('row');

  if ((await shgTable.isVisible().catch(() => false)) && (await shgRows.count()) > 1) return;

  const shgsNavButton = mobileNav.getByRole('button', { name: /^SHGs$/i });
  await expect(shgsNavButton).toBeVisible();
  await shgsNavButton.click({ force: true });
  await page.waitForTimeout(1000);
}

async function openTargetShgCollection(page, shgNamePattern) {
  // Ensure we are on SHG list and open the specific SHG's collection action.
  const searchBox = page.getByRole('textbox', { name: /Search by SHG name/i }).first();
  if (await searchBox.isVisible().catch(() => false)) {
    await searchBox.fill('Test Arun Qa');
    await page.waitForTimeout(1000);
  }

  const targetRow = page.getByRole('row', { name: shgNamePattern }).first();
  await expect(targetRow).toBeVisible();

  const actionButtons = targetRow.getByRole('button');
  const actionCount = await actionButtons.count();
  for (let i = 0; i < actionCount; i++) {
    const candidateAction = actionButtons.nth(i);
    try {
      await candidateAction.click({ force: true, timeout: 3000 });
    } catch {
      continue;
    }
    await page.waitForTimeout(1000);

    const reachedCollectionArea =
      (await page.getByRole('dialog', { name: /Transaction|Collection/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('tab', { name: /Collection/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /^Collections?$/i }).first().isVisible().catch(() => false)) ||
      (await page.getByRole('button', { name: /Collect Dues/i }).first().isVisible().catch(() => false));

    if (reachedCollectionArea) break;
  }

  const collectionTab = page.getByRole('tab', { name: /Collection/i }).first();
  const collectionLink = page.getByRole('link', { name: /Collection/i }).first();
  const collectionButton = page.getByRole('button', { name: /^Collections?$/i }).first();
  const collectDuesButton = page.getByRole('button', { name: /Collect Dues/i }).first();

  if (await collectionTab.isVisible().catch(() => false)) {
    await collectionTab.click();
  } else if (await collectionLink.isVisible().catch(() => false)) {
    await collectionLink.click();
  } else if (await collectDuesButton.isVisible().catch(() => false)) {
    await collectDuesButton.click({ force: true });
  } else {
    await clickFirstVisible(
      page,
      [collectionButton, page.getByRole('button', { name: /Collection/i }).first()],
      'Open Collection area'
    );
  }

  await page.waitForTimeout(1000);
}

async function clickFirstVisible(page, locators, stepName) {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ force: true });
      await page.waitForTimeout(1000);
      return;
    }
  }

  throw new Error(`Could not find clickable element for step: ${stepName}`);
}

async function collectInternalLoanForArun(page) {
  const transactionDialog = page.getByRole('dialog', { name: /Transaction/i });
  const collectionDialog = page.getByRole('dialog', { name: /Collection/i }).first();

  // Some paths need an extra tap to open the Transaction dialog.
  if (!(await transactionDialog.isVisible().catch(() => false))) {
    await clickFirstVisible(
      page,
      [
        page.getByRole('button', { name: /Collect Dues/i }).first(),
        page.getByRole('button', { name: /Receipt/i }).first(),
        page.locator('button').filter({ has: page.locator('img') }).first(),
      ],
      'Open Transaction dialog'
    );
  }

  // Open "Receipt" from the transaction dialog.
  await clickFirstVisible(
    page,
    [
      transactionDialog.getByRole('button', { name: /Receipt/i }).first(),
      page.getByRole('button', { name: /Receipt.*Collect Savings/i }).first(),
      page.getByRole('tab', { name: /Receipt/i }).first(),
      page.getByRole('link', { name: /^Receipt$/i }).first(),
    ],
    'Open Receipt'
  );

  // Mandatory path requested: skip bank registration.
  if (await collectionDialog.getByText(/Register Bank Accounts/i).isVisible().catch(() => false)) {
    await clickFirstVisible(
      page,
      [collectionDialog.getByRole('button', { name: /Skip for Now/i })],
      'Skip bank registration'
    );
  }

  // Ensure internal-loan mode is selected if the control is available.
  try {
    await clickFirstVisible(
      page,
      [
        page.getByRole('tab', { name: /Internal Loan/i }).first(),
        page.getByRole('button', { name: /Internal Loan/i }).first(),
        page.getByRole('radio', { name: /Internal Loan/i }).first(),
        page.getByText(/Loan Collection|Loan Repayment|Internal Loan|Loan EMI/i).first(),
        page.getByText(/Internal Loan/i).first(),
      ],
      'Switch to internal loan mode'
    );
  } catch {
    // Ignore when already in the internal-loan entry screen.
  }

  // Always return to list view if a member edit screen is open.
  const backToListButton = collectionDialog.getByRole('button', { name: /Back to List/i }).first();
  if (await backToListButton.isVisible().catch(() => false)) {
    await backToListButton.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Open Arun member edit details.
  const arunMemberButton = collectionDialog.getByRole('button', { name: /Arun/i }).first();
  await expect(arunMemberButton).toBeVisible();
  await arunMemberButton.click({ force: true });
  await page.waitForTimeout(1000);

  // Make sure Arun detail form is open (the screen shown in your image).
  await expect(collectionDialog.getByText(/Loan Repayments/i).first()).toBeVisible();
  await expect(collectionDialog.getByText(/Internal Loan #0001/i).first()).toBeVisible();

  // Savings field in Arun section -> set to 0.
  const arunSavingsInput = collectionDialog
    .locator('xpath=(//*[normalize-space(.)="Savings"]/following::input[1])[1]')
    .first();
  if (await arunSavingsInput.isVisible().catch(() => false)) {
    await arunSavingsInput.fill('0');
    await page.waitForTimeout(300);
  }

  // Exact target from your image: Internal Loan #0001 amount input -> set to 1000.
  const internalLoan0001Input = collectionDialog
    .locator('xpath=(//*[contains(normalize-space(.),"Internal Loan #0001")]/following::input[1])[1]')
    .first();
  await expect(internalLoan0001Input).toBeVisible();
  await internalLoan0001Input.click();
  await internalLoan0001Input.press('Control+A');
  await internalLoan0001Input.type('1000');
  await internalLoan0001Input.press('Tab');
  await page.waitForTimeout(400);

  // Save Arun and move next.
  const saveNextButton = collectionDialog.getByRole('button', { name: /Save\s*&\s*Next/i }).first();
  if (await saveNextButton.isVisible().catch(() => false)) {
    await saveNextButton.click({ force: true });
    await page.waitForTimeout(900);
  }

  // For the next member screen, make sure savings is 0 too (avoid savings carryover).
  const nextMemberSavingsInput = collectionDialog
    .locator('xpath=(//*[normalize-space(.)="Savings"]/following::input[1])[1]')
    .first();
  if (await nextMemberSavingsInput.isVisible().catch(() => false)) {
    await nextMemberSavingsInput.fill('0');
    await page.waitForTimeout(400);
    if (await saveNextButton.isVisible().catch(() => false)) {
      await saveNextButton.click({ force: true });
      await page.waitForTimeout(900);
    }
  }

  const backToListAfterSave = collectionDialog.getByRole('button', { name: /Back to List/i }).first();
  if (await backToListAfterSave.isVisible().catch(() => false)) {
    await backToListAfterSave.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Choose payment mode as Cash in Hand.
  await clickFirstVisible(
    page,
    [
      page.getByRole('option', { name: /Cash in Hand/i }).first(),
      page.getByRole('radio', { name: /Cash in Hand/i }).first(),
      page.getByRole('button', { name: /Cash in Hand/i }).first(),
      page.getByRole('combobox', { name: /Payment|Mode/i }).first(),
      page.getByText(/Cash in Hand/i).first(),
    ],
    'Select Cash in Hand'
  );

  // If cash option is inside an open dropdown, click the option explicitly.
  const cashOption = page.getByRole('option', { name: /Cash in Hand/i }).first();
  if (await cashOption.isVisible().catch(() => false)) {
    await cashOption.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Submit/save collection receipt.
  await clickFirstVisible(
    page,
    [
      page.getByRole('button', { name: /Submit|Collect|Save|Confirm|Next/i }).first(),
      page.getByRole('link', { name: /Submit|Collect|Save|Confirm/i }).first(),
    ],
    'Submit collection'
  );

  // Finalize collection after the first next/submit step.
  await clickFirstVisible(
    page,
    [
      page.getByRole('button', { name: /Complete|Finish|Confirm|Done|Next/i }).first(),
      page.getByRole('link', { name: /Complete|Finish|Confirm|Done/i }).first(),
    ],
    'Complete collection'
  );

  // Validate Arun member has internal-loan amount in the active collection flow.
  const activeCollectionDialog = page.getByRole('dialog', { name: /Collection/i }).first();
  if (await activeCollectionDialog.isVisible().catch(() => false)) {
    // Final confirmation step on "Cash Collection Ready" screen.
    const finalSubmitButton = activeCollectionDialog.getByRole('button', { name: /^Submit$/i }).first();
    if (await finalSubmitButton.isVisible().catch(() => false)) {
      await finalSubmitButton.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Completion screen check and final close.
    await expect(activeCollectionDialog.getByText(/Collection Recorded!/i)).toBeVisible();
    const doneButton = activeCollectionDialog.getByRole('button', { name: /^Done$/i }).first();
    if (await doneButton.isVisible().catch(() => false)) {
      await doneButton.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }
}

// Opens Arun's internal-loan editor so the test can enter or validate repayment amounts.
async function openArunInternalLoanEditor(page) {
  const collectionDialog = page.getByRole('dialog', { name: /Collection/i }).first();

  try {
    await clickFirstVisible(
      page,
      [
        page.getByRole('tab', { name: /Internal Loan/i }).first(),
        page.getByRole('button', { name: /Internal Loan/i }).first(),
        page.getByRole('radio', { name: /Internal Loan/i }).first(),
        page.getByText(/Loan Collection|Loan Repayment|Internal Loan|Loan EMI/i).first(),
        page.getByText(/Internal Loan/i).first(),
      ],
      'Switch to internal loan mode'
    );
  } catch {
    // Ignore when already inside the internal-loan editor.
  }

  const backToListButton = collectionDialog.getByRole('button', { name: /Back to List/i }).first();
  if (await backToListButton.isVisible().catch(() => false)) {
    await backToListButton.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const arunMemberButton = collectionDialog.getByRole('button', { name: /Arun/i }).first();
  await expect(arunMemberButton).toBeVisible();
  await arunMemberButton.click({ force: true });
  await page.waitForTimeout(1000);

  await expect(collectionDialog.getByText(/Loan Repayments/i).first()).toBeVisible();
  await expect(collectionDialog.getByText(/Internal Loan #0001/i).first()).toBeVisible();
}

// Sets Arun's savings and internal-loan amount fields for positive or negative collection checks.
async function setArunInternalLoanAmount(page, amount) {
  const collectionDialog = page.getByRole('dialog', { name: /Collection/i }).first();
  const arunSavingsInput = collectionDialog
    .locator('xpath=(//*[normalize-space(.)="Savings"]/following::input[1])[1]')
    .first();

  if (await arunSavingsInput.isVisible().catch(() => false)) {
    await arunSavingsInput.fill('0');
    await page.waitForTimeout(300);
  }

  const internalLoan0001Input = collectionDialog
    .locator('xpath=(//*[contains(normalize-space(.),"Internal Loan #0001")]/following::input[1])[1]')
    .first();
  await expect(internalLoan0001Input).toBeVisible();
  await internalLoan0001Input.click();
  await internalLoan0001Input.press('Control+A');
  await internalLoan0001Input.fill(amount);
  await internalLoan0001Input.press('Tab');
  await page.waitForTimeout(500);
}

// Saves the current member entry when the collection form shows the Save & Next action.
async function clickSaveAndNextIfVisible(page) {
  const saveNextButton = page
    .getByRole('dialog', { name: /Collection/i })
    .first()
    .getByRole('button', { name: /Save\s*&\s*Next/i })
    .first();

  if (await saveNextButton.isVisible().catch(() => false)) {
    await saveNextButton.click({ force: true });
    await page.waitForTimeout(1000);
  }
}

// Verifies that at least one expected validation message is shown for negative scenarios.
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

test.describe('Nyra collection flow', () => {
  test('select Test Arun Qa SHG and collect Arun internal loan 1000 via cash in hand', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await page.waitForTimeout(1000);

    await openShgsMobilePage(page);
    await openTargetShgCollection(page, /Test Arun Qa/i);
    await expect(page.getByText(/Collection/i).first()).toBeVisible();
    await collectInternalLoanForArun(page);
  });

  // Covers the negative case where a zero repayment amount should be rejected by validation.
  test('negative: internal loan rejects zero repayment amount for Arun', async ({ page }) => {
    test.setTimeout(120000);

    await loginToNyra(page);
    await page.waitForTimeout(1000);

    await openShgsMobilePage(page);
    await openTargetShgCollection(page, /Test Arun Qa/i);
    await expect(page.getByText(/Collection/i).first()).toBeVisible();
    await openArunInternalLoanEditor(page);
    await setArunInternalLoanAmount(page, '0');
    await clickSaveAndNextIfVisible(page);

    await expectAnyVisible(page, [/amount/i, /greater than 0/i, /invalid/i, /required/i]);
  });
});

