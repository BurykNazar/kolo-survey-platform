import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000';
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'shots');

const credentials = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'credentials.local.md'), 'utf8').split(/\r?\n/)) {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length >= 5 && cells[3].includes('@')) {
    credentials.set(cells[3], { role: cells[1], password: cells[4].replace(/`/g, '') });
  }
}

const accounts = {
  visitor: [...credentials.entries()].find(([, value]) => value.role === 'visitor'),
  creator: [...credentials.entries()].find(([, value]) => value.role === 'creator'),
  admin: [...credentials.entries()].find(([, value]) => value.role === 'admin')
};

const pages = [
  { path: '/', name: 'landing', auth: null, fullPage: true },
  { path: '/', name: 'landing-hero', auth: null, fullPage: false },
  { path: '/surveys', name: 'catalog', auth: null },
  { path: '/surveys/1', name: 'survey', auth: null, fullPage: true },
  { path: '/login', name: 'login', auth: null },
  { path: '/register', name: 'register', auth: null },
  { path: '/studio', name: 'overview', auth: 'creator' },
  { path: '/studio/surveys', name: 'surveys', auth: 'creator' },
  { path: '/studio/surveys/1', name: 'builder', auth: 'creator' },
  { path: '/studio/responses', name: 'responses', auth: 'creator' },
  { path: '/studio/profile', name: 'profile', auth: 'creator' },
  { path: '/studio/categories', name: 'categories', auth: 'admin' },
  { path: '/studio/people', name: 'people', auth: 'admin' }
];

const widths = process.argv.includes('--mobile') ? [390] : [1440, 390];
const only = process.argv.find((arg) => arg.startsWith('--only='))?.split('=')[1];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errors = [];

for (const width of widths) {
  const contexts = new Map();

  async function contextFor(role) {
    if (contexts.has(role)) return contexts.get(role);
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      deviceScaleFactor: 1,
      locale: 'uk-UA'
    });
    const page = await context.newPage();
    if (role) {
      const [email, value] = accounts[role];
      await page.goto(`${BASE}/login`);
      await page.fill('#email', email);
      await page.fill('#password', value.password);
      await page.click('form[action="/login"] button[type="submit"]');
      await page.waitForURL('**/studio', { timeout: 15000 });
      await page.waitForTimeout(500);
    }
    contexts.set(role, { context, page });
    return contexts.get(role);
  }

  for (const item of pages) {
    if (only && !item.name.includes(only)) continue;
    const { page } = await contextFor(item.auth);
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push({ page: item.name, width, text: message.text() });
    });
    page.on('pageerror', (error) => errors.push({ page: item.name, width, text: error.message }));

    await page.goto(`${BASE}${item.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const file = path.join(OUT, `${item.name}-${width}${item.fullPage ? '-full' : ''}.png`);
    await page.screenshot({ path: file, fullPage: Boolean(item.fullPage) });
    console.log(`${width}px ${item.name} -> ${path.relative(ROOT, file)}`);
  }

  for (const { context } of contexts.values()) await context.close();
}

await browser.close();
console.log(JSON.stringify({ errors }, null, 2));
