import { Page, expect } from '@playwright/test';

export class AdminPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin');
    await expect(this.page.locator('h1')).toContainText('Admin');
  }

  async expectUserVisible(name: string) {
    await expect(this.page.locator(`text=${name}`).first()).toBeVisible();
  }

  async clickChangeRole(userName: string) {
    const row = this.page.locator('li').filter({ hasText: userName }).first();
    await row.locator('button', { hasText: 'Change Role' }).click();
  }

  async selectRole(role: string) {
    await this.page.locator('select').last().selectOption(role);
  }

  async saveRole() {
    await this.page.locator('button', { hasText: 'Save' }).last().click();
  }

  async changeUserRole(userName: string, role: string) {
    await this.clickChangeRole(userName);
    await this.selectRole(role);
    await this.saveRole();
    // Wait for modal to close
    await expect(this.page.locator('button', { hasText: 'Save' })).not.toBeVisible({ timeout: 5000 });
  }

  async deleteUser(userName: string) {
    const row = this.page.locator('li').filter({ hasText: userName }).first();
    await row.locator('button[title*="delete"], button svg').last().click();
  }

  async expectUserCount(count: number) {
    await expect(this.page.locator('[class*="sub"]').first()).toContainText(`${count}`);
  }
}
