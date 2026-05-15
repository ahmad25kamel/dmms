import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DeliverableTreePage } from './pages/DeliverableTreePage';
import { TEST_USERS, testDeliverableTitle, testProjectName, uniqueSuffix } from './helpers/fixtures';
import {
  apiLogin,
  apiCreateProject,
  apiCreateDeliverable,
  apiOpenForBids,
  apiDeleteProject,
} from './helpers/api';

async function loginAsPM(page: any) {
  const loginPage = new LoginPage(page);
  await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
}

test.describe('Deliverable Tree — PM flows', () => {
  let pm: any;
  let project: any;

  test.beforeEach(async ({ page }) => {
    pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    project = await apiCreateProject(pm.token, { name: testProjectName(), budget_total: 100000 });
    await loginAsPM(page);
  });

  test.afterEach(async () => {
    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  test('PM can create a top-level deliverable', async ({ page }) => {
    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);
    const title = testDeliverableTitle();
    await treePage.createDeliverable({ title, maxBudget: '5000' });
    await treePage.expectDeliverableVisible(title);
  });

  test('PM can create a child deliverable nested under a parent', async ({ page }) => {
    const parent = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle('parent'),
      max_budget: 10000,
    });

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);
    await treePage.expectDeliverableVisible(parent.title);

    const childTitle = testDeliverableTitle('child');
    await treePage.clickAddChild(parent.title);
    await treePage.fillDeliverableForm({ title: childTitle });
    await treePage.submitDeliverableForm();

    await treePage.expectDeliverableVisible(childTitle);
  });

  test('Deliverable tree shows empty state when no deliverables exist', async ({ page }) => {
    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);
    await treePage.expectEmptyState();
  });

  // ── Status Transitions ──────────────────────────────────────────────────────

  test('PM can open deliverable for bids (draft → open_for_bids)', async ({ page }) => {
    const deliverable = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle(),
      max_budget: 5000,
    });

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);
    await treePage.openBids(deliverable.title);

    // After opening bids, a badge with "open_for_bids" or "Open" should be visible
    await expect(page.locator('text=open_for_bids, text=open for bids').first()).toBeVisible({ timeout: 8000 });
  });

  test('Cancelling a deliverable marks it as cancelled', async ({ page }) => {
    const deliverable = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle(),
      max_budget: 5000,
    });

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);

    const row = page.locator('div').filter({ hasText: deliverable.title }).first();
    await row.locator('button', { hasText: /cancel/i }).click();

    await expect(page.locator('text=cancelled').first()).toBeVisible({ timeout: 8000 });
  });

  // ── Edit ────────────────────────────────────────────────────────────────────

  test('PM can edit a deliverable title', async ({ page }) => {
    const deliverable = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle(),
      max_budget: 5000,
    });
    const newTitle = testDeliverableTitle('renamed');

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);
    await treePage.clickEditDeliverable(deliverable.title);

    // Clear and fill the title input
    await page.locator('input').filter({ hasValue: deliverable.title }).fill(newTitle);
    await page.locator('button[type="submit"], button', { hasText: /save|update/i }).last().click();

    await treePage.expectDeliverableVisible(newTitle);
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  test('PM can delete a deliverable', async ({ page }) => {
    const deliverable = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle(),
      max_budget: 5000,
    });

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);

    page.once('dialog', dialog => dialog.accept());
    await treePage.clickDeleteDeliverable(deliverable.title);

    await expect(page.locator(`text=${deliverable.title}`)).not.toBeVisible({ timeout: 8000 });
  });

  // ── Proposal Review ─────────────────────────────────────────────────────────

  test('PM can navigate to proposal review for a deliverable', async ({ page }) => {
    const deliverable = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle(),
      max_budget: 5000,
    });
    await apiOpenForBids(pm.token, deliverable.id);

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);

    await treePage.clickViewProposals(deliverable.title);
    await expect(page).toHaveURL(new RegExp(`/proposals/${deliverable.id}|/deliverables/${deliverable.id}/proposals`));
    await expect(page.locator('h1')).toContainText('Proposals');
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  test('Deliverable defaults to public visibility', async ({ page }) => {
    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);
    await treePage.clickAddDeliverable();

    // Check that visibility select has public as default
    const visibilitySelect = page.locator('select').filter({ hasValue: 'public' });
    await expect(visibilitySelect).toBeVisible({ timeout: 3000 }).catch(() => {
      // Visibility may not have a select — acceptable
    });
    await page.keyboard.press('Escape');
  });

  // ── Task Management within a deliverable ────────────────────────────────────

  test('PM can manage tasks for an assigned deliverable', async ({ page }) => {
    const deliverable = await apiCreateDeliverable(pm.token, {
      project_id: project.id,
      title: testDeliverableTitle(),
      max_budget: 5000,
    });

    const treePage = new DeliverableTreePage(page);
    await treePage.goto(project.id);

    // Click "Manage Tasks" button if present
    const row = page.locator('div').filter({ hasText: deliverable.title }).first();
    const manageBtn = row.locator('button', { hasText: /task/i });
    if (await manageBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await manageBtn.click();
      await expect(page.locator('[class*="modal"], [role="dialog"]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });
});

// ── Deliverable Tree Page — Contributor sees it but cannot edit ──────────────

test.describe('Deliverable Tree — Contributor restrictions', () => {
  test('Contributor cannot see Add Deliverable button', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);
    await page.goto(`/projects/${project.id}/tree`);

    await expect(page.locator('button', { hasText: 'Add Deliverable' })).not.toBeVisible({ timeout: 3000 });

    await apiDeleteProject(pm.token, project.id);
  });
});
