import { Page, expect } from '@playwright/test';

export class KanbanPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/kanban');
    await expect(this.page.locator('h1')).toContainText(/kanban/i);
  }

  async expectColumnsVisible() {
    for (const col of ['Backlog', 'To Do', 'In Progress', 'Done']) {
      await expect(this.page.locator(`text=${col}`).first()).toBeVisible();
    }
  }

  async clickCreateTask() {
    await this.page.locator('button', { hasText: /new task|create task|\+ task/i }).first().click();
  }

  async fillCreateTaskForm(data: {
    title: string;
    description?: string;
    deliverableId?: string;
  }) {
    await this.page.locator('input[placeholder*="task"], input[placeholder*="Task"], input[placeholder*="title"]').first().fill(data.title);
    if (data.description) {
      await this.page.locator('textarea').first().fill(data.description);
    }
  }

  async submitCreateTaskForm() {
    await this.page.locator('button[type="submit"], button', { hasText: /create|save/i }).last().click();
  }

  async expectTaskInColumn(title: string, column: string) {
    const colEl = this.page.locator('div').filter({ hasText: column }).first();
    await expect(colEl.locator(`text=${title}`)).toBeVisible();
  }

  async openTaskDetail(title: string) {
    await this.page.locator(`text=${title}`).first().click();
  }

  async expectTaskVisible(title: string) {
    await expect(this.page.locator(`text=${title}`).first()).toBeVisible();
  }

  async filterByProject(projectName: string) {
    await this.page.locator('select').first().selectOption({ label: projectName });
  }
}
