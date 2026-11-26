import fs from 'fs';
const BASE='http://localhost:3000';
const creds=new Map();
for (const line of fs.readFileSync('credentials.local.md','utf8').split(/\r?\n/)) { const c=line.split('|').map(s=>s.trim()); if(c.length>=5&&c[3].includes('@')) creds.set(c[3],{role:c[1],password:c[4].replace(/`/g,'')}); }
const creator=[...creds.entries()].find(([,v])=>v.role==='creator');
const visitor=[...creds.entries()].find(([,v])=>v.role==='visitor');
const out=[]; const ok=(c,l)=>out.push(`${c?'ok  ':'FAIL'} ${l}`);
const json=async (r)=>{const t=await r.text(); try{return JSON.parse(t)}catch{return {raw:t.slice(0,120)}}};
const login=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:creator[0],password:creator[1].password})});
const lj=await json(login); ok(login.status===200 && lj.token, 'API JWT логін: '+(login.status));
const token=lj.token;
const noauth=await fetch(BASE+'/api/surveys'); ok(noauth.status===401,'API без токена → 401');
const me=await fetch(BASE+'/api/auth/me',{headers:{authorization:'Bearer '+token}}); const mj=await json(me); ok(me.status===200 && mj.data.role==='creator','API /me повертає роль');
const surveys=await fetch(BASE+'/api/surveys',{headers:{authorization:'Bearer '+token}}); const sj=await json(surveys); ok(surveys.status===200 && Array.isArray(sj.data),'API список опитувань');
const users=await fetch(BASE+'/api/users',{headers:{authorization:'Bearer '+token}}); ok(users.status===403,'API користувачів закрито для дослідника');
const bad=await fetch(BASE+'/api/surveys',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({title:'abc',category_id:1,status:'draft',estimated_minutes:5})}); ok(bad.status===422,'API валідація назви → 422');
const created=await fetch(BASE+'/api/surveys',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({title:'API тестове опитування',category_id:1,status:'draft',estimated_minutes:5})}); const cj=await json(created); ok(created.status===201 && cj.data.id,'API створення опитування');
if(cj.data?.id){ const del=await fetch(BASE+'/api/surveys/'+cj.data.id,{method:'DELETE',headers:{authorization:'Bearer '+token}}); ok(del.status===200,'API видалення опитування'); }
const csrfFail=await fetch(BASE+'/surveys/1/responses',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-requested-with':'fetch'},body:'q_1=1'}); ok(csrfFail.status===403,'CSRF: відповіді без токена → 403');
// Порівняння ролей у веб-кабінеті
const vlogin=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:visitor[0],password:visitor[1].password})});
const vj=await json(vlogin); const vtoken=vj.token;
const vusers=await fetch(BASE+'/api/users',{headers:{authorization:'Bearer '+vtoken}}); ok(vusers.status===403,'API учаснику заборонено людей');
const vme=await fetch(BASE+'/api/auth/me',{headers:{authorization:'Bearer '+vtoken}}); const vmj=await json(vme); ok(vmj.data?.role==='visitor','API учасник має роль visitor');
console.log(out.join('\n'));
console.log(out.some(l=>l.startsWith('FAIL'))?'FAILURES':'API CHECKS PASSED');
