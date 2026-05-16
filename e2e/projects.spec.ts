import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TEST_USERS, testProjectName, uniqueSuffix } from './helpers/fixtures';
import { apiLogin, apiCreateProject, apiDeleteProject } from './helpers/api';

async function loginAsPM(page: any) {
  const loginPage = new LoginPage(page);
  await loginPage.login(TEST_USERS.pm.username, TEST_USERS.pm.password);
  await expect(page).toHaveURL('/dashboard');
}

test.describe('Projects — PM flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPM(page);
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  test('PM can create a project with name only', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    const name = testProjectName();
    await projectsPage.createProject({ name });
    await projectsPage.expectProjectInList(name);
  });

  test('PM can create a project with all fields', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    const name = testProjectName();
    await projectsPage.createProject({
      name,
      description: 'Full details project description',
      budget: '75000',
    });
    await projectsPage.expectProjectInList(name);
  });

  test('Create Project button is disabled when name is empty', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.clickNewProject();
    // Submit button should be disabled (no name filled)
    const submitBtn = page.locator('button', { hasText: 'Create Project' }).last();
    await expect(submitBtn).toBeDisabled();
  });

  test('Cancel closes the modal without creating a project', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.clickNewProject();
    await page.locator('button', { hasText: 'Cancel' }).click();
    await expect(page.locator('h2', { hasText: 'New Project' })).not.toBeVisible();
  });

  // ── Read / Navigate ─────────────────────────────────────────────────────────

  test('Project list shows project count in subtitle', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    // Count should contain a number
    await expect(page.locator('[class*="sub"]').first()).toContainText(/\d+ project/);
  });

  test('Clicking project name navigates to project detail', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto('/projects');
    await page.locator(`a`, { hasText: project.name }).first().click();
    await expect(page).toHaveURL(`/projects/${project.id}`);
    await expect(page.locator('h1')).toContainText(project.name);

    await apiDeleteProject(pm.token, project.id);
  });

  test('Tree button navigates to deliverable tree', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto('/projects');
    const card = page.locator('div').filter({ hasText: project.name }).first();
    await card.locator('a[href*="tree"]').click();
    await expect(page).toHaveURL(`/projects/${project.id}/tree`);

    await apiDeleteProject(pm.token, project.id);
  });

  // ── Edit ────────────────────────────────────────────────────────────────────

  test('PM can edit a project name', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });
    const newName = testProjectName('edited');

    await page.goto(`/projects/${project.id}`);
    await page.locator('button', { hasText: 'Edit Project' }).click();

    const nameInput = page.locator('input').filter({ hasValue: project.name });
    await nameInput.fill(newName);
    await page.locator('button', { hasText: 'Save' }).click();

    await expect(page.locator('h1')).toContainText(newName, { timeout: 8000 });

    await apiDeleteProject(pm.token, project.id);
  });

  test('Edit modal Cancel closes without changes', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto(`/projects/${project.id}`);
    await page.locator('button', { hasText: 'Edit Project' }).click();
    await expect(page.locator('text=Edit Project').nth(1)).toBeVisible();
    await page.locator('button', { hasText: 'Cancel' }).last().click();
    await expect(page.locator('text=Edit Project').nth(1)).not.toBeVisible();

    await apiDeleteProject(pm.token, project.id);
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  test('PM can delete a project via confirm dialog', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto(`/projects/${project.id}`);

    await page.locator('button', { hasText: 'Delete Project' }).first().click();
    // Custom modal — confirm deletion
    await page.locator('button', { hasText: 'Delete Project' }).last().click();

    // Should redirect to projects list
    await expect(page).toHaveURL('/projects', { timeout: 8000 });
  });

  test('Cancelling delete confirm dialog keeps the project', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto(`/projects/${project.id}`);

    await page.locator('button', { hasText: 'Delete Project' }).first().click();
    // Custom modal — cancel to dismiss
    await page.locator('button', { hasText: 'Cancel' }).last().click();

    await expect(page).toHaveURL(`/projects/${project.id}`);

    await apiDeleteProject(pm.token, project.id);
  });

  // ── Budget KPIs ─────────────────────────────────────────────────────────────

  test('Project detail shows budget KPI cards', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, {
      name: testProjectName(),
      budget_total: 50000,
    });

    await page.goto(`/projects/${project.id}`);
    await expect(page.locator('text=Total Budget')).toBeVisible();
    await expect(page.locator('text=Allocated')).toBeVisible();
    await expect(page.locator('text=Remaining')).toBeVisible();
    await expect(page.locator('text=Saved')).toBeVisible();

    await apiDeleteProject(pm.token, project.id);
  });

  // ── JSON Import ─────────────────────────────────────────────────────────────

  test('Download Template button triggers a JSON file download', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    await page.goto(`/projects/${project.id}`);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button', { hasText: 'Template' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    await apiDeleteProject(pm.token, project.id);
  });
});

// ── Contributor cannot create projects ────────────────────────────────────────

test.describe('Projects — Contributor restrictions', () => {
  test('Contributor does not see New Project button', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);
    await page.goto('/projects');
    await expect(page.locator('button', { hasText: 'New Project' })).not.toBeVisible({ timeout: 3000 });
  });

  test('Contributor does not see Edit/Delete buttons on project detail', async ({ page }) => {
    const pm = await apiLogin(TEST_USERS.pm.username, TEST_USERS.pm.password);
    const project = await apiCreateProject(pm.token, { name: testProjectName() });

    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.contributor.username, TEST_USERS.contributor.password);
    await page.goto(`/projects/${project.id}`);

    await expect(page.locator('button', { hasText: 'Edit Project' })).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('button', { hasText: 'Delete Project' })).not.toBeVisible({ timeout: 3000 });

    await apiDeleteProject(pm.token, project.id);
  });
});
