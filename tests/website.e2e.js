const { test, expect } = require('@playwright/test');

const validCatalog = JSON.stringify(
  {
    stac_version: '1.0.0',
    id: 'test-catalog',
    type: 'Catalog',
    description: 'A test catalog',
    links: [],
  },
  null,
  2,
);

const invalidCatalog = JSON.stringify(
  {
    stac_version: '1.0.0',
    id: 'test-catalog',
    type: 'Catalog',
    description: 'Missing links',
  },
  null,
  2,
);

test.describe('Website UI', () => {
  test('Should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await expect(page.locator('h1')).toContainText('STAC Online Checker');
    await expect(page.locator('#validationForm')).toBeVisible();
    await expect(page.locator('#validateBtn')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Should toggle between URL and JSON input', async ({ page }) => {
    await page.goto('/');

    // URL input should be visible by default
    await expect(page.locator('#urlInput')).toBeVisible();
    await expect(page.locator('#jsonInput')).toBeHidden();

    // Switch to JSON
    await page.locator('label[for="jsonMethod"]').click();
    await expect(page.locator('#urlInput')).toBeHidden();
    await expect(page.locator('#jsonInput')).toBeVisible();

    // Switch back to URL
    await page.locator('label[for="urlMethod"]').click();
    await expect(page.locator('#urlInput')).toBeVisible();
    await expect(page.locator('#jsonInput')).toBeHidden();
  });

  test('Should show PASSED for valid STAC JSON', async ({ page }) => {
    await page.goto('/');

    // Switch to JSON mode
    await page.locator('label[for="jsonMethod"]').click();
    await page.locator('#stacJson').fill(validCatalog);
    await page.locator('#validateBtn').click();

    // Wait for results
    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#results .card-header h5')).toContainText('Checks PASSED');
  });

  test('Should show FAILED for invalid STAC JSON', async ({ page }) => {
    await page.goto('/');

    // Switch to JSON mode
    await page.locator('label[for="jsonMethod"]').click();
    await page.locator('#stacJson').fill(invalidCatalog);
    await page.locator('#validateBtn').click();

    // Wait for results
    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#results .card-header h5')).toContainText('Checks FAILED');
    await expect(page.locator('#resultContent')).not.toBeEmpty();
  });

  test('Should show error for malformed JSON', async ({ page }) => {
    await page.goto('/');

    await page.locator('label[for="jsonMethod"]').click();
    await page.locator('#stacJson').fill('{ not valid json }');
    await page.locator('#validateBtn').click();

    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#resultContent')).toContainText('Error parsing JSON');
  });

  test('Should show error for empty URL', async ({ page }) => {
    await page.goto('/');

    // URL mode is default, just click validate with empty input
    await page.locator('#validateBtn').click();

    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#resultContent')).toContainText('Please enter a valid URL');
  });

  test('Should validate a STAC file fetched by URL', async ({ page }) => {
    await page.goto('/');

    // The test server serves fixtures at /fixtures/
    await page.locator('#stacUrl').fill('http://localhost:3000/fixtures/catalog.json');
    await page.locator('#validateBtn').click();

    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#results .card-header h5')).toContainText('Checks PASSED');
  });

  test('Should populate URL from query parameter', async ({ page }) => {
    await page.goto('/?url=http://localhost:3000/fixtures/catalog.json');

    await expect(page.locator('#stacUrl')).toHaveValue('http://localhost:3000/fixtures/catalog.json');
  });

  test('Should show error for unsupported STAC version', async ({ page }) => {
    await page.goto('/');

    const oldCatalog = JSON.stringify(
      {
        stac_version: '0.9.0',
        id: 'old',
        type: 'Catalog',
        description: 'Old catalog',
        links: [],
      },
      null,
      2,
    );

    await page.locator('label[for="jsonMethod"]').click();
    await page.locator('#stacJson').fill(oldCatalog);
    await page.locator('#validateBtn').click();

    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    // Skipped versions show as not valid with a message
    await expect(page.locator('#results .card-header h5')).toContainText('Checks FAILED');
  });

  test('Should disable validate button during loading', async ({ page }) => {
    await page.goto('/');

    await page.locator('label[for="jsonMethod"]').click();
    await page.locator('#stacJson').fill(validCatalog);

    // Click and immediately check the button is disabled
    const validateBtn = page.locator('#validateBtn');
    await validateBtn.click();

    // Results should eventually appear and button re-enabled
    await expect(page.locator('#results')).toBeVisible({ timeout: 15000 });
    await expect(validateBtn).toBeEnabled();
  });
});
