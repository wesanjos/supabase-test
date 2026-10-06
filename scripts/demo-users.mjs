import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const base=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(base && key,'Configure server-side Supabase URL and key');
const emails=['owner','admin','billing','active','active2','expired','blocked','trial'];
const path='.env.demo';
const password=existsSync(path) ? readFileSync(path,'utf8').trim().split('=')[1] : randomBytes(24).toString('base64url');
assert.ok(password?.length>=24,'Invalid demo password file');
writeFileSync(path,`DEMO_USER_PASSWORD=${password}\n`,{mode:0o600});
for(const [index,name] of emails.entries()) {
  const id=`10000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  const prior=await fetch(`${base}/auth/v1/admin/users/${id}`,{headers,signal:AbortSignal.timeout(15000)});
  assert.equal(prior.status,200,'Demo user lookup failed');
  assert.equal((await prior.json()).email,`${name}@example.com`,'Refuse to change non-demo user');
  const r=await fetch(`${base}/auth/v1/admin/users/${id}`,{method:'PUT',headers,body:JSON.stringify({password,email_confirm:true}),signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200,'Demo user password update failed');
}
console.log('Eight demo logins enabled; password saved only in ignored .env.demo. Admin sessions remain AAL1 until MFA is enrolled and verified.');
