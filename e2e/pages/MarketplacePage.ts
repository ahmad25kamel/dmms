import { Page, expect } from '@playwright/test';

export class MarketplacePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/marketplace');
    await expect(this.page.locator('h1')).toContainText('Marketplace');
  }

  async expectBidCount(count: number) {
    await expect(this.page.locator('p.dmms-page-sub, [class*="sub"]').first()).toContainText(`${count}`);
  }

  async openDeliverableDetail(title: string) {
    await this.page.locator('text=' + title).first().click();
  }

  async submitProposal(data: { bidAmount: string; message?: string }) {
    // Click "Submit Bid" button in the modal
    const modal = this.page.locator('[class*="modal"], [role="dialog"]').first();
    await modal.locator('button', { hasText: /submit.*bid|bid/i }).click();

    // Fill the bid form
    await this.page.locator('input[type="number"]').last().fill(data.bidAmount);
    if (data.message) {
      await this.page.locator('textarea').last().fill(data.message);
    }
    await this.page.locator('button[type="submit"], button', { hasText: /submit/i }).last().click();
  }

  async expectEmptyState() {
    await expect(this.page.locator('text=No open bids')).toBeVisible();
  }

  async expectDeliverableVisible(title: string) {
    await expect(this.page.locator(`text=${title}`).first()).toBeVisible();
  }
}
