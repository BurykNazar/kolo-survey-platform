export async function login(page, base, account) {
  await page.goto(`${base}/login`);
  await page.fill('#email', account[0]);
  await page.fill('#password', account[1].password);
  await page.click('form[action="/login"] button[type="submit"]');
  await page.waitForURL('**/studio');
}
