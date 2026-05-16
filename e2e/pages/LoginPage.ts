import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.locator('h2')).toContainText('Sign in');
  }

  async fillUsername(username: string) {
    await this.page.locator('input[placeholder="your_username"]').fill(username);
  }

  async fillPassword(password: string) {
    await this.page.locator('input[type="password"]').fill(password);
  }

  async submit() {
    await this.page.locator('button[type="submit"]').click();
  }

  async login(username: string, password: string) {
    await this.goto();
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.submit();
    // Wait for navigation away from /login so callers can immediately use the app
    await this.page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 10000 });
  }

  async expectError(text: string) {
    await expect(this.page.locator('[class*="alert"], [class*="error"]').first()).toContainText(text, { ignoreCase: true });
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL('/dashboard');
  }

  async clickRegisterLink() {
    await this.page.locator('a[href="/register"]').click();
  }
}
