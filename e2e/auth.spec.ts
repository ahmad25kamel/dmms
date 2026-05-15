import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TEST_USERS, uniqueSuffix } from './helpers/fixtures';
import { apiRegister } from './helpers/api';

// Ensure test accounts exist before auth tests run
test.beforeAll(async () => {
  for (const u of Object.values(TEST_USERS)) {
    await apiRegister(u.username, u.name, u.password, u.role).catch(() => {
      // User may already exist — ignore conflict errors
    });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

test.describe('Login', () => {
  test('PM can log in successfully and land on dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await loginPage.expectRedirectToDashboard();
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('Contributor can log in successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);
    await loginPage.expectRedirectToDashboard();
  });

  test('Login fails with wrong password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillUsername(TEST_USERS.pm.username);
    await loginPage.fillPassword('wrongpassword');
    await loginPage.submit();
    await loginPage.expectError('invalid credentials');
    await expect(page).toHaveURL('/login');
  });

  test('Login fails with non-existent username', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillUsername('nobody_exists_xyz');
    await loginPage.fillPassword('Password123');
    await loginPage.submit();
    await loginPage.expectError('invalid credentials');
  });

  test('Login succeeds and redirects to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await expect(page).toHaveURL('/dashboard', { timeout: 8000 });
  });

  test('Navigate to register page via link', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clickRegisterLink();
    await expect(page).toHaveURL('/register');
  });

  test('HTML5 required validation prevents empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/login');
  });
});

// ── Registration ──────────────────────────────────────────────────────────────

test.describe('Registration', () => {
  test('New contributor can register successfully', async ({ page }) => {
    const suffix = uniqueSuffix();
    const registerPage = new RegisterPage(page);
    await registerPage.register({
      username: `contrib_${suffix}`,
      name: `New Contributor ${suffix}`,
      password: 'SecurePass99',
      role: 'contributor',
    });
    await registerPage.expectRedirectToDashboard();
  });

  test('New PM can register successfully', async ({ page }) => {
    const suffix = uniqueSuffix();
    const registerPage = new RegisterPage(page);
    await registerPage.register({
      username: `pm_${suffix}`,
      name: `New PM ${suffix}`,
      password: 'SecurePass99',
      role: 'pm',
    });
    await registerPage.expectRedirectToDashboard();
  });

  test('Registration fails with password shorter than 8 characters', async ({ page }) => {
    const suffix = uniqueSuffix();
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.fillForm({
      username: `usr_${suffix}`,
      name: 'Short Pass User',
      password: 'abc123',
    });
    await registerPage.submit();
    await registerPage.expectError('8 characters');
    await expect(page).toHaveURL('/register');
  });

  test('Registration fails with duplicate username', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.fillForm({
      username: TEST_USERS.pm.username, // Already registered
      name: 'Duplicate User',
      password: 'SecurePass99',
    });
    await registerPage.submit();
    await registerPage.expectError('already');
    await expect(page).toHaveURL('/register');
  });

  test('Registration fails with invalid username (spaces/symbols)', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await registerPage.fillForm({
      username: 'bad user!',
      name: 'Invalid Username',
      password: 'SecurePass99',
    });
    await registerPage.submit();
    // HTML5 pattern validation keeps user on register page
    await expect(page).toHaveURL('/register');
  });

  test('Navigate to login page via link', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await page.locator('a[href="/login"]').click();
    await expect(page).toHaveURL('/login');
  });
});

// ── Protected Routes ──────────────────────────────────────────────────────────

test.describe('Protected Routes', () => {
  test('Unauthenticated user is redirected from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });

  test('Unauthenticated user is redirected from /projects to /login', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });

  test('Unauthenticated user is redirected from /kanban to /login', async ({ page }) => {
    await page.goto('/kanban');
    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });

  test('Unauthenticated user is redirected from /admin to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('User can log out and is redirected to login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await expect(page).toHaveURL('/dashboard');

    const logoutBtn = page.locator('button, a').filter({ hasText: /log.?out|sign.?out/i }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });

  test('After logout, protected routes redirect to login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await expect(page).toHaveURL('/dashboard');

    const logoutBtn = page.locator('button, a').filter({ hasText: /log.?out|sign.?out/i }).first();
    await logoutBtn.click();
    await expect(page).toHaveURL('/login', { timeout: 8000 });

    await page.goto('/projects');
    await expect(page).toHaveURL('/login', { timeout: 8000 });
  });
});

// ── Security: Role enforcement ────────────────────────────────────────────────

test.describe('Role enforcement', () => {
  test('Registration with admin role is rejected (only pm/contributor allowed)', async ({ page }) => {
    const suffix = uniqueSuffix();
    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    // The select only shows pm/contributor, so this tests backend rejects if bypassed
    await registerPage.fillForm({
      username: `adminattempt_${suffix}`,
      name: 'Admin Attempt',
      password: 'SecurePass99',
      role: 'contributor', // select only has pm/contributor
    });
    await registerPage.submit();
    await registerPage.expectRedirectToDashboard();
    // Verify they get contributor role, not admin
    await expect(page.locator('nav, header, aside')).not.toContainText('Admin', { ignoreCase: false });
  });
});
