import { Page, expect } from '@playwright/test';

export class ProjectsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/projects');
    await expect(this.page.locator('h1')).toContainText('Projects');
  }

  async clickNewProject() {
    await this.page.locator('button', { hasText: 'New Project' }).click();
  }

  async fillCreateForm(data: { name: string; description?: string; budget?: string }) {
    await this.page.locator('input[placeholder*="Platform"]').fill(data.name);
    if (data.description) {
      await this.page.locator('textarea').fill(data.description);
    }
    if (data.budget) {
      await this.page.locator('input[type="number"]').fill(data.budget);
    }
  }

  async submitCreate() {
    await this.page.locator('button', { hasText: 'Create Project' }).last().click();
  }

  async createProject(data: { name: string; description?: string; budget?: string }) {
    await this.clickNewProject();
    await this.fillCreateForm(data);
    await this.submitCreate();
    // Wait for modal to close
    await expect(this.page.locator('h2', { hasText: 'New Project' })).not.toBeVisible({ timeout: 5000 });
  }

  async expectProjectInList(name: string) {
    await expect(this.page.locator('a', { hasText: name })).toBeVisible();
  }

  async clickProject(name: string) {
    await this.page.locator('a', { hasText: name }).first().click();
  }

  async expectEmptyState() {
    await expect(this.page.locator('text=No projects yet')).toBeVisible();
  }
}
