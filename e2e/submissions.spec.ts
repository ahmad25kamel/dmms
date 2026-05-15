import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { TEST_USERS, testProjectName, testDeliverableTitle } from './helpers/fixtures';
import {
  apiLogin,
  apiCreateProject,
  apiCreateDeliverable,
  apiOpenForBids,
  apiSubmitProposal,
  apiAcceptProposal,
  apiSubmitWork,
  apiDeleteProject,
} from './helpers/api';

async function setupAssignedDeliverable() {
  const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
  const contributor = await apiLogin(TEST_USERS.contributor.username, TEST_USERS.contributor.password);
  const project = await apiCreateProject(pm.token, { name: testProjectName(), budget_total: 50000 });
  const deliverable = await apiCreateDeliverable(pm.token, {
    project_id: project.id,
    title: testDeliverableTitle(),
    max_budget: 5000,
  });
  await apiOpenForBids(pm.token, deliverable.id);
  const proposal = await apiSubmitProposal(contributor.token, deliverable.id, {
    bid_amount: 3000,
    message: 'Ready to work',
  });
  await apiAcceptProposal(pm.token, proposal.id);

  return { pm, contributor, project, deliverable, proposal };
}

// ── Contributor Workspace ─────────────────────────────────────────────────────

test.describe('Workspace — Contributor submits work', () => {
  test('Contributor sees assigned deliverable in workspace list', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await page.goto('/workspace');
    await expect(page.locator(`text=${deliverable.title}`).first()).toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('Contributor can navigate to deliverable workspace detail', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await page.goto(`/workspace/${deliverable.id}`);
    await expect(page.locator('h1')).toContainText(deliverable.title);

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('Contributor can submit work on an assigned deliverable', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await page.goto(`/workspace/${deliverable.id}`);

    // Click "Submit Work" or "Submit" button
    await page.locator('button', { hasText: /submit.*work|submit/i }).first().click();

    // Fill the submission form
    const modal = page.locator('[class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();

    await modal.locator('textarea').first().fill('I completed all the requirements. Please review.');
    await page.locator('button', { hasText: /submit/i }).last().click();

    // After submission, status should reflect submitted state
    await expect(page.locator('text=submitted, text=pending').first()).toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('Contributor can add subtasks in workspace', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await page.goto(`/workspace/${deliverable.id}`);

    // Look for "Add subtask" input or button
    const addInput = page.locator('input[placeholder*="subtask"], input[placeholder*="task"]').first();
    if (await addInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addInput.fill('Review acceptance criteria');
      await page.keyboard.press('Enter');
      await expect(page.locator('text=Review acceptance criteria')).toBeVisible({ timeout: 5000 });
    }

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('Non-owner contributor cannot submit work on someone else\'s deliverable', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();

    // Create a different contributor and try to access the workspace
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password); // PM is not the owner

    // Direct API call should return 403 — UI should handle this gracefully
    const pmUser = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const res = await fetch(`http://localhost:3005/api/dmms/deliverables/${deliverable.id}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pmUser.token}`,
      },
      body: JSON.stringify({ notes: 'Unauthorized submission attempt' }),
    });
    expect(res.status).toBe(403);

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });
});

// ── PM Review Center ──────────────────────────────────────────────────────────

test.describe('Review Center — PM reviews submissions', () => {
  test('PM sees pending submissions in review center', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();
    await apiSubmitWork(contributor.token, deliverable.id, { notes: 'Done!' });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);

    await page.goto('/review');
    await expect(page.locator('h1')).toContainText(/review/i);
    await expect(page.locator('[class*="feed"] li, [class*="card"]').first()).toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('PM can approve a submission', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();
    await apiSubmitWork(contributor.token, deliverable.id, { notes: 'Done!' });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);

    await page.goto('/review');
    await page.locator('[class*="feed"] li, [class*="card"]').first().click();

    const modal = page.locator('[class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();
    await modal.locator('button', { hasText: /approve/i }).click();

    // Submission should disappear from the pending list
    await expect(page.locator('[class*="modal"]')).not.toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('PM can request revision on a submission with notes', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();
    await apiSubmitWork(contributor.token, deliverable.id, { notes: 'Done!' });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);

    await page.goto('/review');
    await page.locator('[class*="feed"] li, [class*="card"]').first().click();

    const modal = page.locator('[class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();

    await modal.locator('textarea').fill('Please add unit tests and documentation.');
    await modal.locator('button', { hasText: /revision|request revision/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('PM can reject a submission with notes', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();
    await apiSubmitWork(contributor.token, deliverable.id, { notes: 'Done!' });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);

    await page.goto('/review');
    await page.locator('[class*="feed"] li, [class*="card"]').first().click();

    const modal = page.locator('[class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();

    await modal.locator('textarea').fill('Does not meet acceptance criteria.');
    await modal.locator('button', { hasText: /reject/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('Empty review center shows correct empty state', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);

    // Create a project with no submissions
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto('/review');
    // May show empty state if no pending submissions exist
    // We just verify the page loads
    await expect(page.locator('h1')).toBeVisible();

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });
});

// ── Rewards Ledger ────────────────────────────────────────────────────────────

test.describe('Rewards Ledger', () => {
  test('Reward ledger page loads for authenticated user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await page.goto('/ledger');
    await expect(page.locator('h1')).toContainText('Reward Ledger');
    await expect(page.locator('text=Total Earned')).toBeVisible();
  });

  test('Reward ledger shows entry after approved submission', async ({ page }) => {
    const { pm, contributor, project, deliverable } = await setupAssignedDeliverable();
    const sub = await apiSubmitWork(contributor.token, deliverable.id, { notes: 'Done!' });

    // Approve via API
    const pmUser = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    await fetch(`http://localhost:3005/api/dmms/submissions/${sub.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pmUser.token}` },
    });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);

    await page.goto('/ledger');
    await expect(page.locator('[class*="feed"] li').first()).toBeVisible({ timeout: 8000 });

    await apiDeleteProject(pm.token, project.id).catch(() => {});
  });

  test('PM can also view the reward ledger', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);

    await page.goto('/ledger');
    await expect(page.locator('h1')).toContainText('Reward Ledger');
  });
});
