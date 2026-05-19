import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API  = 'http://localhost:3005/api/dmms';

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function ensureUser(username, password, name, role) {
  try {
    const reg = await apiPost('/auth/register', { username, password, name, role, email: `${username}@dmms.test` });
    if (reg.data?.id) {
      // Auto-approve for screenshot purposes
      const login = await apiPost('/auth/login', { username: 'admin', password: 'admin123' });
      if (login.data?.token) {
        await fetch(`${API}/admin/users/${reg.data.id}/approve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' },
          body: '{}',
        });
      }
    }
  } catch {}
}

async function getToken(username, password) {
  const res = await apiPost('/auth/login', { username, password });
  return res.data?.token;
}

async function waitForServer(url, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server not available: ${url}`);
}

(async () => {
  console.log('Waiting for servers...');
  await waitForServer(`${API}/auth/me`);
  await waitForServer(BASE);

  // Ensure admin exists
  try {
    await apiPost('/auth/register', { username: 'admin', password: 'admin123', name: 'Admin User', role: 'admin', email: 'admin@dmms.test' });
  } catch {}

  // Ensure PM account
  const pmName = 'screenshot_pm';
  await ensureUser(pmName, 'password123', 'Sarah Chen', 'pm');
  const pmToken = await getToken(pmName, 'password123');

  if (!pmToken) {
    console.error('Could not get PM token — check accounts');
    process.exit(1);
  }

  // Ensure contributor account
  const conName = 'screenshot_con';
  await ensureUser(conName, 'password123', 'Alex Rivera', 'contributor');
  const conToken = await getToken(conName, 'password123');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  async function screenshot(page, route, file, waitFor) {
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState('networkidle');
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `public/screenshots/${file}`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    console.log(`✓ ${file}`);
  }

  // PM screenshots
  const pmPage = await ctx.newPage();
  await pmPage.addInitScript((token) => {
    localStorage.setItem('dmms_token', token);
  }, pmToken);

  await screenshot(pmPage, '/dashboard',    'dashboard.png',    'h1');
  await screenshot(pmPage, '/projects',     'projects.png',     '.dmms-page');
  await screenshot(pmPage, '/kanban',       'kanban.png',       '.dmms-page');
  await screenshot(pmPage, '/proposals/all','proposals.png',    '.dmms-page');

  // Contributor screenshots
  if (conToken) {
    const conPage = await ctx.newPage();
    await conPage.addInitScript((token) => {
      localStorage.setItem('dmms_token', token);
    }, conToken);
    await screenshot(conPage, '/marketplace', 'marketplace.png', '.dmms-page');
    await conPage.close();
  }

  await pmPage.close();
  await browser.close();
  console.log('Screenshots saved to public/screenshots/');
})();
