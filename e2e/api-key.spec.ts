import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { TEST_USERS } from './helpers/fixtures';
import { apiLogin, apiRegister } from './helpers/api';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3005';

test.beforeAll(async () => {
  for (const u of Object.values(TEST_USERS)) {
    await apiRegister(u.username, u.name, u.password, u.role).catch(() => {});
  }
});

test.describe('API Key Page', () => {
  test('user can navigate to API key settings page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await page.goto('/settings/api-key');
    await expect(page.locator('h1, h2').first()).toContainText('API Key');
  });

  test('user can generate a permanent API key', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await page.goto('/settings/api-key');

    await page.click('button:has-text("Generate")');

    const keyDisplay = page.locator('[data-testid="api-key-value"]');
    await expect(keyDisplay).toBeVisible({ timeout: 5000 });
    const keyText = await keyDisplay.textContent();
    expect(keyText).toMatch(/^dmms_/);
  });

  test('generated key is shown only once and prefix is displayed after', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);
    await page.goto('/settings/api-key');

    await page.click('button:has-text("Generate")');

    const keyDisplay = page.locator('[data-testid="api-key-value"]');
    await expect(keyDisplay).toBeVisible({ timeout: 5000 });
    const fullKey = await keyDisplay.textContent();
    expect(fullKey).toMatch(/^dmms_/);

    await page.reload();

    await expect(keyDisplay).not.toBeVisible();
    const prefixDisplay = page.locator('[data-testid="api-key-prefix"]');
    await expect(prefixDisplay).toBeVisible();
    const prefixText = await prefixDisplay.textContent();
    expect(fullKey).toContain(prefixText!.replace(/\*+/, '').trim());
  });

  test('user can revoke an existing API key', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await page.goto('/settings/api-key');

    const generateBtn = page.locator('button:has-text("Generate")');
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await expect(page.locator('[data-testid="api-key-value"]')).toBeVisible({ timeout: 5000 });
    }

    await page.reload();

    const revokeBtn = page.locator('button:has-text("Revoke")');
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    await page.locator('button:has-text("Confirm")').click();

    await expect(page.locator('button:has-text("Generate")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="api-key-prefix"]')).not.toBeVisible();
  });
});

test.describe('API Key Authentication', () => {
  test('API key authenticates correctly on /auth/me endpoint', async () => {
    const pmUser = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);

    const genRes = await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmUser.token}` },
    });
    expect(genRes.ok).toBe(true);
    const genBody = await genRes.json();
    const apiKey = genBody.data.key;
    expect(apiKey).toMatch(/^dmms_/);

    const meRes = await fetch(`${BASE_URL}/api/dmms/auth/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(meRes.ok).toBe(true);
    const meBody = await meRes.json();
    expect(meBody.data.id).toBe(pmUser.id);
  });

  test('revoked API key is rejected', async () => {
    const user = await apiLogin(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    const genRes = await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const { data: { key } } = await genRes.json();

    await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.token}` },
    });

    const meRes = await fetch(`${BASE_URL}/api/dmms/auth/me`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(meRes.status).toBe(401);
  });

  test('GET /auth/api-key returns key info without exposing the key', async () => {
    const user = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);

    await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
    });

    const infoRes = await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(infoRes.ok).toBe(true);
    const { data } = await infoRes.json();
    expect(data.has_key).toBe(true);
    expect(data.prefix).toMatch(/^dmms_/);
    expect(data.key).toBeUndefined();
  });

  test('GET /auth/api-key returns has_key false when no key exists', async () => {
    const user = await apiLogin(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.token}` },
    });

    const infoRes = await fetch(`${BASE_URL}/api/dmms/auth/api-key`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    const { data } = await infoRes.json();
    expect(data.has_key).toBe(false);
  });
});
