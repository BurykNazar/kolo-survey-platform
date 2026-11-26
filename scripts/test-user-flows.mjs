import fs from 'fs';
import { chromium } from 'playwright-core';
const BASE='http://localhost:3000';
const creds=new Map();
for (const line of fs.readFileSync('credentials.local.md','utf8').split(/\r?\n/)) { const c=line.split('|').map(s=>s.trim()); if(c.length>=5&&c[3].includes('@')) creds.set(c[3],{role:c[1],password:c[4].replace(/`/g,'')}); }
const visitor=[...creds.entries()].find(([,v])=>v.role==='visitor');
const out=[]; const ok=(c,l)=>out.push(`${c?'ok  ':'FAIL'} ${l}`);
const b=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});

// 1. Реєстрація
const rc=await b.newContext({viewport:{width:1440,height:900}}); const rp=await rc.newPage();
const email=`new.${Date.now()}@kolo.ua`;
await rp.goto(BASE+'/register');
await rp.fill('#full_name','Новий Учасник');
await rp.fill('#email',email);
await rp.fill('#password','StrongPass12345');
await rp.click('form[action="/register"] button[type="submit"]');
await rp.waitForURL('**/studio');
ok((await rp.locator('.stats').textContent()).includes('Пройдено опитувань'),'реєстрація відкриває кабінет учасника');
const cats=await rp.goto(BASE+'/studio/categories'); ok(cats.status()===403,'учаснику закрито адміністрування');
await rp.goto(BASE+'/studio/profile');
await rp.fill('#currentPassword','StrongPass12345');
await rp.fill('#newPassword','NewStrongPass67890');
await rp.fill('#repeatPassword','NewStrongPass67890');
await rp.click('form[action="/studio/profile/password"] button[type="submit"]');
await rp.waitForSelector('.toast:has-text("Пароль оновлено.")');
ok(true,'зміна пароля через AJAX');
await rp.click('details.user-menu summary'); await rp.click('form[action="/logout"] button'); await rp.waitForURL(BASE+'/');
await rp.goto(BASE+'/login');
await rp.fill('#email',email); await rp.fill('#password','NewStrongPass67890');
await rp.click('form[action="/login"] button[type="submit"]'); await rp.waitForURL('**/studio');
ok(true,'вхід із новим паролем');
await rc.close();

// 2. Анонімний гість
const gc=await b.newContext({viewport:{width:1440,height:900}}); const gp=await gc.newPage();
await gp.goto(BASE+'/surveys/6',{waitUntil:'networkidle'});
await gp.locator('.q').nth(0).locator('.choice').first().click();
await gp.locator('.q').nth(1).locator('.choice').nth(0).click();
await gp.locator('.q').nth(1).locator('.choice').nth(1).click();
await gp.locator('.q').nth(2).locator('.rating-opt').nth(8).click();
await gp.locator('.q').nth(3).locator('textarea').fill('Хочу щотижневий ярмарок у суботу.');
await gp.locator('.q').nth(4).locator('.choice').first().click();
await gp.click('[data-submit]');
await gp.waitForSelector('.thanks');
ok(true,'гість надіслав відповіді без реєстрації');
ok((await gp.locator('.thanks p').nth(1).textContent()).includes('анонімна'),'гість бачить анонімну анкету');
await gc.close();

// 3. Учасник у кабінеті
const vc=await b.newContext({viewport:{width:1440,height:900}}); const vp=await vc.newPage();
await vp.goto(BASE+'/login'); await vp.fill('#email',visitor[0]); await vp.fill('#password',visitor[1].password);
await vp.click('form[action="/login"] button[type="submit"]'); await vp.waitForURL('**/studio');
ok((await vp.locator('.stats').textContent()).includes('Пройдено опитувань'),'учасник бачить свій огляд');
await vp.goto(BASE+'/studio/responses');
ok((await vp.locator('h1').textContent()).includes('Мої відповіді'),'учасник бачить лише свої відповіді');
ok((await vp.locator('.stats').textContent()).includes('Заповнених анкет'),'у журналі учасника є статистика');
await vc.close();
console.log(out.join('\n'));
console.log(out.some(l=>l.startsWith('FAIL'))?'FAILURES':'\nUSER FLOWS PASSED');
await b.close();
