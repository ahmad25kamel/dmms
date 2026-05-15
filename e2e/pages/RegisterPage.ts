import { Page, expect } from '@playwright/test';

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
    await expect(this.page.locator('h2')).toContainText('Create account');
  }

  async fillForm(data: { username: string; name: string; password: string; role?: string }) {
    await this.page.locator('input[placeholder="jane_smith"]').fill(data.username);
    await this.page.locator('input[placeholder="Jane Smith"]').fill(data.name);
    await this.page.locator('input[type="password"]').fill(data.password);
    if (data.role) {
      await this.page.locator('select').selectOption(data.role);
    }
  }

  async submit() {
    await this.page.locator('button[type="submit"]').click();
  }

  async register(data: { username: string; name: string; password: string; role?: string }) {
    await this.goto();
    await this.fillForm(data);
    await this.submit();
  }

  async expectError(text: string) {
    await expect(this.page.locator('[class*="alert"], [class*="error"]').first()).toContainText(text, { ignoreCase: true });
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL('/dashboard');
  }
}
