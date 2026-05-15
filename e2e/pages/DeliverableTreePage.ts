import { Page, expect } from '@playwright/test';

export class DeliverableTreePage {
  constructor(private page: Page) {}

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/tree`);
    await expect(this.page.locator('h1')).toContainText('Deliverable Tree');
  }

  async clickAddDeliverable() {
    await this.page.locator('button', { hasText: 'Add Deliverable' }).first().click();
  }

  async fillDeliverableForm(data: {
    title: string;
    brief?: string;
    maxBudget?: string;
    dueDate?: string;
    visibility?: string;
  }) {
    await this.page.locator('input[placeholder*="title"], input[placeholder*="Title"]').first().fill(data.title);
    if (data.brief) {
      await this.page.locator('textarea').first().fill(data.brief);
    }
    if (data.maxBudget) {
      await this.page.locator('input[type="number"]').first().fill(data.maxBudget);
    }
  }

  async submitDeliverableForm() {
    // Click the last "Add" or "Create" button inside modal
    await this.page.locator('button[type="submit"]').last().click();
  }

  async createDeliverable(data: { title: string; brief?: string; maxBudget?: string }) {
    await this.clickAddDeliverable();
    await this.fillDeliverableForm(data);
    await this.submitDeliverableForm();
    await expect(this.page.locator('text=' + data.title)).toBeVisible({ timeout: 8000 });
  }

  async expectDeliverableVisible(title: string) {
    await expect(this.page.locator(`text=${title}`).first()).toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.page.locator('text=No deliverables yet')).toBeVisible();
  }

  async openBids(title: string) {
    // Find the deliverable row and click Open Bids
    const row = this.page.locator('[class*="card"], [class*="node"], li').filter({ hasText: title }).first();
    await row.locator('button', { hasText: /open.*bid/i }).click();
  }

  async clickAddChild(parentTitle: string) {
    const row = this.page.locator('div, li').filter({ hasText: parentTitle }).first();
    await row.locator('button', { hasText: /add child|child/i }).click();
  }

  async clickEditDeliverable(title: string) {
    const row = this.page.locator('div').filter({ hasText: title }).first();
    await row.locator('button', { hasText: /edit/i }).click();
  }

  async clickDeleteDeliverable(title: string) {
    const row = this.page.locator('div').filter({ hasText: title }).first();
    await row.locator('button', { hasText: /delete/i }).click();
  }

  async clickViewProposals(title: string) {
    const row = this.page.locator('div').filter({ hasText: title }).first();
    await row.locator('a, button', { hasText: /proposal/i }).click();
  }
}
