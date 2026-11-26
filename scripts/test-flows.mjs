import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';
import { login } from './lib/flow-helpers.mjs';

const BASE = 'http://localhost:3000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'shots');

const credentials = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'credentials.local.md'), 'utf8').split(/\r?\n/)) {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length >= 5 && cells[3].includes('@')) {
    credentials.set(cells[3], { role: cells[1], password: cells[4].replace(/`/g, '') });
  }
}

const creator = [...credentials.entries()].find(([, value]) => value.role === 'creator');
const admin = [...credentials.entries()].find(([, value]) => value.role === 'admin');
const failures = [];
const steps = [];

function check(condition, label) {
  if (condition) {
    steps.push(`ok   ${label}`);
  } else {
    failures.push(label);
    steps.push(`FAIL ${label}`);
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'uk-UA' });
const page = await context.newPage();
page.setDefaultTimeout(12000);

try {
  // 1. Вхід
  await login(page, BASE, creator);
  check(page.url().endsWith('/studio'), 'вхід дослідника');

  // 2. Створення опитування через модальне вікно
  await page.goto(`${BASE}/studio/surveys`);
  await page.click('button[data-open-dialog="createSurveyDialog"]');
  await page.waitForSelector('#createSurveyDialog[open]');
  await page.fill('#newSurveyTitle', 'Тестове опитування для перевірки');
  await page.selectOption('#newSurveyCategory', { label: 'Продукт' });
  await page.screenshot({ path: path.join(OUT, 'flow-create-survey.png') });
  await page.click('#createSurveyDialog form button[type="submit"]');
  await page.waitForURL(/\/studio\/surveys\/\d+$/);
  const surveyUrl = page.url();
  const surveyId = Number(surveyUrl.split('/').pop());
  check(Number.isInteger(surveyId), 'опитування створено і відкрито редактор');

  // 3. Додавання питання з варіантами
  await page.click('[data-add-question]');
  await page.waitForSelector('#questionDialog[open]');
  await page.fill('#questionText', 'Що вам найбільше допомагає зосередитися?');
  const optionInputs = page.locator('#questionDialog .option-row input[name="options"]');
  await optionInputs.nth(0).fill('Тиша');
  await optionInputs.nth(1).fill('Музика');
  await page.click('#questionDialog [data-add-option]');
  await page.locator('#questionDialog .option-row input[name="options"]').nth(2).fill('Коротка прогулянка');
  await page.screenshot({ path: path.join(OUT, 'flow-question-modal.png') });
  await page.click('#questionDialog form button[type="submit"]');
  await page.waitForSelector('#questionDialog:not([open])');
  await page.waitForSelector('.qitem');
  check((await page.locator('.qitem').count()) === 1, 'питання з варіантами додано');

  // 4. Питання зі шкалою
  await page.click('[data-add-question]');
  await page.locator('#questionDialog .type-option', { hasText: 'Шкала 1–10' }).click();
  await page.fill('#questionText', 'Наскільки вам комфортно працювати в такому режимі?');
  await page.click('#questionDialog form button[type="submit"]');
  await page.waitForSelector('#questionDialog:not([open])');
  check((await page.locator('.qitem').count()) === 2, 'питання зі шкалою додано');

  // 5. Редагування питання
  await page.locator('[data-edit-question]').first().click();
  await page.waitForSelector('#questionDialog[open]');
  await page.fill('#questionText', 'Що вам найбільше допомагає зосередитися під час роботи?');
  await page.click('#questionDialog form button[type="submit"]');
  await page.waitForSelector('#questionDialog:not([open])');
  check((await page.locator('.qitem__text').first().textContent()).includes('під час роботи'), 'питання відредаговано');

  // 6. Дата через календар
  await page.click('[data-date-toggle]');
  await page.waitForSelector('.calendar');
  await page.screenshot({ path: path.join(OUT, 'flow-datepicker.png') });
  await page.locator('.calendar__day:not([disabled])').last().click();
  const dateValue = await page.locator('input[data-date-value]').inputValue();
  check(/^\d{4}-\d{2}-\d{2}$/.test(dateValue), 'дата обрана через календар');

  // 7. Публікація
  await page.fill('#surveyTitle', 'Тестове опитування про фокус');
  await page.selectOption('#surveyStatus', 'active');
  await page.click('form[data-survey-meta-form] button[type="submit"]');
  await page.waitForSelector('.toast:has-text("Зміни збережено.")');
  check((await page.locator('[data-survey-title]').textContent()).includes('фокус'), 'налаштування збережено через AJAX');
  check((await page.locator('[data-status-chip]').textContent()).includes('Активне'), 'статус оновлено без перезавантаження');

  // 8. Валідація проходження
  await page.goto(`${BASE}/surveys/${surveyId}`);
  await page.click('[data-submit]');
  await page.waitForSelector('.q.is-invalid');
  check((await page.locator('.q.is-invalid').count()) >= 2, 'порожні обов’язкові питання підсвічені');
  await page.screenshot({ path: path.join(OUT, 'flow-validation.png') });

  // 9. Проходження та подяка
  await page.locator('.q').nth(0).locator('input[type="radio"]').first().check();
  await page.locator('.q').nth(1).locator('.rating-opt').nth(7).click();
  await page.click('[data-submit]');
  await page.waitForSelector('.thanks');
  check((await page.locator('.thanks h1').textContent()).includes('Дякуємо'), 'відповіді надіслано через AJAX');
  await page.screenshot({ path: path.join(OUT, 'flow-thanks.png') });

  // 10. Журнал і читання анкети
  await page.goto(`${BASE}/studio/responses`);
  const first = page.locator('[data-attempt]').first();
  check((await first.textContent()).includes('Тестове опитування про фокус'), 'нова анкета у журналі');
  await first.locator('[data-open-response]').click();
  await page.waitForSelector('#responseDrawer[open] .answer');
  check((await page.locator('#responseDrawer .answer').count()) === 2, 'анкета відкривається у панелі');
  await page.screenshot({ path: path.join(OUT, 'flow-drawer.png') });
  await page.click('#responseDrawer [data-close-dialog]');

  // 11. Видалення опитування
  await page.goto(`${BASE}/studio/surveys/${surveyId}`);
  await page.click('[data-confirm][data-confirm-endpoint$="/delete"]');
  await page.waitForSelector('#confirmDialog[open]');
  await page.screenshot({ path: path.join(OUT, 'flow-confirm.png') });
  await page.click('#confirmDialog [data-confirm-ok]');
  await page.waitForURL('**/studio/surveys');
  check(!(await page.content()).includes('Тестове опитування про фокус'), 'опитування видалено');

  // 12. Адміністратор: категорії
  await page.click('details.user-menu summary');
  await page.click('form[action="/logout"] button');
  await page.waitForURL(`${BASE}/`);
  await login(page, BASE, admin);

  await page.goto(`${BASE}/studio/categories`);
  await page.click('button[data-open-dialog="categoryDialog"]');
  await page.waitForSelector('#categoryDialog[open]');
  await page.fill('#categoryName', 'Тестова тема');
  await page.fill('#categoryCode', 'test-theme');
  await page.click('#categoryDialog form button[type="submit"]');
  await page.waitForSelector('#categoryDialog:not([open])');
  check(await page.locator('#category-rows').textContent().then((text) => text.includes('Тестова тема')), 'категорію створено');

  const row = page.locator('[data-category-row]', { hasText: 'Тестова тема' });
  await row.locator('[data-edit-category]').click();
  await page.waitForSelector('#categoryDialog[open]');
  await page.fill('#categoryName', 'Тестова тема 2');
  await page.click('#categoryDialog form button[type="submit"]');
  await page.waitForSelector('#categoryDialog:not([open])');
  check(await page.locator('#category-rows').textContent().then((text) => text.includes('Тестова тема 2')), 'категорію оновлено');

  const row2 = page.locator('[data-category-row]', { hasText: 'Тестова тема 2' });
  await row2.locator('[data-confirm]').click();
  await page.waitForSelector('#confirmDialog[open]');
  await page.click('#confirmDialog [data-confirm-ok]');
  await page.waitForTimeout(600);
  check(!(await page.locator('#category-rows').textContent()).includes('Тестова тема 2'), 'категорію видалено');

  // 13. Адміністратор: люди
  await page.goto(`${BASE}/studio/people`);
  await page.click('button[data-open-dialog="personDialog"]');
  await page.waitForSelector('#personDialog[open]');
  await page.fill('#personName', 'Тестовий Дослідник');
  await page.fill('#personEmail', `test.${Date.now()}@kolo.ua`);
  await page.selectOption('#personRole', 'creator');
  await page.click('[data-generate-password]');
  const generated = await page.inputValue('#personPassword');
  check(generated.length >= 12, 'пароль згенеровано у браузері');
  await page.screenshot({ path: path.join(OUT, 'flow-person-modal.png') });
  await page.click('#personDialog form button[type="submit"]');
  await page.waitForSelector('.toast:has-text("Людину додано.")');
  check((await page.locator('#people-rows').textContent()).includes('Тестовий Дослідник'), 'людину створено');

  const personRow = page.locator('[data-person-row]', { hasText: 'Тестовий Дослідник' });
  await personRow.locator('[data-confirm]').click();
  await page.waitForSelector('#confirmDialog[open]');
  await page.click('#confirmDialog [data-confirm-ok]');
  await page.waitForSelector('.toast:has-text("Користувача видалено.")');
  check(!(await page.locator('#people-rows').textContent()).includes('Тестовий Дослідник'), 'людину видалено');
} catch (error) {
  failures.push(`exception: ${error.message}`);
  steps.push(`FAIL exception: ${error.message}`);
  await page.screenshot({ path: path.join(OUT, 'flow-failure.png'), fullPage: true });
} finally {
  console.log(steps.join('\n'));
  console.log(`\n${failures.length ? `FAILURES: ${failures.length}` : 'ALL FLOWS PASSED'}`);
  await browser.close();
  if (failures.length) process.exitCode = 1;
}
