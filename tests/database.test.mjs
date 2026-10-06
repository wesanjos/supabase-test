import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const target = new URL(url);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Tests require a disposable local database');
const id = (group, n) => `${group}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = n => id(1, n), moduleId = n => id(2, n), planId = n => id(3, n);
const tables = ['public.profiles', 'public.user_roles', 'public.modules', 'public.module_credentials', 'public.asaas_test_plans', 'public.asaas_payments', 'public.additional_member_entitlements', 'private.admin_audit_log'];
async function connect() { const c = new pg.Client({ connectionString: url }); await c.connect(); return c; }
async function tx(fn) {
  const c = await connect();
  try { await c.query('begin'); await fn(c); }
  finally { await c.query('rollback'); await c.end(); }
}
async function as(c, n, aal = 'aal1', extra = {}, role = 'authenticated') {
  await c.query('reset role');
  const claims = { role, ...(n ? { sub: user(n) } : {}), ...(aal === null ? {} : { aal }), ...extra };
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await c.query(`set local role ${role}`);
}
async function denied(c, sql, params = [], code = '42501') {
  await c.query('savepoint denied');
  try { await assert.rejects(c.query(sql, params), e => e.code === code); }
  finally { await c.query('rollback to savepoint denied'); await c.query('release savepoint denied'); }
}
async function count(c, table) { return Number((await c.query(`select count(*) from ${table}`)).rows[0].count); }

test('C1 eight tables have RLS enabled', () => tx(async c => {
  for (const table of tables) assert.equal((await c.query('select relrowsecurity from pg_class where oid=$1::regclass', [table])).rows[0].relrowsecurity, true, table);
}));

test('C2 seed counts and profile scenarios', () => tx(async c => {
  for (const [table, expected] of [['auth.users',8],['auth.identities',8],['public.profiles',8],['public.user_roles',5],['public.modules',4],['public.module_credentials',4],['public.asaas_test_plans',2],['public.asaas_payments',4],['public.additional_member_entitlements',2]]) assert.equal(await count(c, table), expected, table);
  assert.equal(Number((await c.query('select count(*) from modules where trial_enabled')).rows[0].count), 2);
  const p = (await c.query('select id,status,plan_type,access_blocked_at,access_expires_at from profiles order by id')).rows;
  assert.equal(p[5].status, 'expired'); assert.ok(p[6].access_blocked_at); assert.equal(p[7].plan_type, 'test');
  assert.ok(p[3].access_expires_at > new Date()); assert.ok(p[4].access_expires_at > new Date());
  assert.deepEqual((await c.query('select role from user_roles where user_id=$1 order by role',[user(1)])).rows.map(x=>x.role), ['admin','owner']);
}));

test('C3 seed data is visibly synthetic', () => tx(async c => {
  for (const p of (await c.query('select email,full_name from profiles')).rows) { assert.match(p.email, /@example\.com$/); assert.match(p.full_name, /Demo/); }
  for (const p of (await c.query('select document,provider_payment_id from asaas_payments')).rows) { assert.match(p.document, /^DEMO-/); assert.match(p.provider_payment_id, /^mock_/); }
  for (const p of (await c.query('select login,password from module_credentials')).rows) { assert.match(p.login, /^MOCK_/); assert.match(p.password, /^MOCK_/); }
}));

test('C4 anon cannot read or write any table', () => tx(async c => {
  await as(c, null, null, {}, 'anon');
  for (const table of tables) {
    await denied(c, `select * from ${table}`);
    await denied(c, `select ${table.endsWith('user_roles') ? 'user_id' : 'id'} from ${table}`);
    await denied(c, `delete from ${table}`);
    await denied(c, `insert into ${table} default values`);
    await denied(c, `update ${table} set ${table.endsWith('user_roles') ? 'user_id=user_id' : 'id=id'}`);
  }
}));

test('C5 profiles and roles isolate identities', () => tx(async c => {
  for (const n of [4,5,6,7,8]) {
    await as(c,n); assert.deepEqual((await c.query('select id from profiles')).rows.map(x=>x.id),[user(n)]);
    assert.ok((await c.query('select user_id from user_roles')).rows.every(x=>x.user_id===user(n)));
  }
  for (const n of [1,2]) { await as(c,n,'aal1'); assert.equal(await count(c,'profiles'),1); await as(c,n,'aal2'); assert.equal(await count(c,'profiles'),8); }
  await as(c,3,'aal2'); assert.equal(await count(c,'profiles'),1);
  await c.query('reset role'); await c.query("insert into user_roles(user_id,role) values($1,'super_admin')",[user(5)]);
  await as(c,5,'aal2'); assert.equal(await count(c,'profiles'),8);
}));

test('C6 only own avatar and nickname are editable', () => tx(async c => {
  for (const n of [1,2,4]) {
    await as(c,n,'aal2'); assert.equal((await c.query("update profiles set nickname='Demo edit',avatar_url='https://example.com/avatar.png' where id=$1 returning id",[user(n)])).rowCount,1);
    assert.equal((await c.query("update profiles set nickname='Other' where id=$1 returning id",[user(6)])).rowCount,0);
    for (const col of ['email','full_name','plan_type','status','access_expires_at','access_blocked_at','access_blocked_reason','id']) await denied(c,`update profiles set ${col}=${col} where id=$1`,[user(n)]);
  }
}));

test('C7 module access follows active expired blocked and trial states', () => tx(async c => {
  for (const [n,expected] of [[4,4],[5,4],[6,0],[7,0],[8,2],[99,0]]) { await as(c,n); assert.equal(await count(c,'modules'),expected,`user ${n}`); }
  await c.query('reset role'); await c.query("update profiles set plan_type='lifetime',access_expires_at=null where id=$1",[user(4)]);
  await as(c,4); assert.equal(await count(c,'modules'),4);
  await c.query('reset role'); await c.query('update profiles set access_blocked_at=now() where id=$1',[user(4)]);
  await as(c,4); assert.equal(await count(c,'modules'),0);
}));

test('C8 catalog CRUD requires administrative role and AAL2', () => tx(async c => {
  await c.query("insert into user_roles(user_id,role) values($1,'super_admin')",[user(5)]);
  for (const [n,privileged] of [[1,true],[2,true],[3,false],[4,false],[5,true]]) for (const aal of ['aal1','aal2']) {
    await as(c,n,aal); const allowed=privileged&&aal==='aal2';
    assert.equal(await count(c,'asaas_test_plans'),allowed?2:0);
    for (const [table,insert,params] of [
      ['modules',"insert into modules(id,name) values($1,'Demo test')",[moduleId(99)]],
      ['asaas_test_plans',"insert into asaas_test_plans(id,name,amount_cents) values($1,'Demo test',100)",[planId(99)]]]) {
      if (allowed) {
        await c.query(insert,params);
        assert.equal((await c.query(`update ${table} set name='Demo edited' where id=$1 returning id`,params)).rowCount,1);
        assert.equal((await c.query(`delete from ${table} where id=$1 returning id`,params)).rowCount,1);
      } else {
        await denied(c,insert,params);
        assert.equal((await c.query(`update ${table} set name=name returning id`)).rowCount,0);
        assert.equal((await c.query(`delete from ${table} returning id`)).rowCount,0);
      }
      for (const privilege of ['TRUNCATE','REFERENCES','TRIGGER']) assert.equal((await c.query('select has_table_privilege(current_user,$1,$2) allowed',[`public.${table}`,privilege])).rows[0].allowed,false);
    }
  }
}));

test('C9 role management denies self escalation', () => tx(async c => {
  await c.query("insert into user_roles(user_id,role) values($1,'super_admin')",[user(5)]);
  for (const [n,privileged] of [[1,true],[2,false],[3,false],[4,false],[5,true]]) for (const aal of ['aal1','aal2']) {
    await as(c,n,aal,{user_metadata:{role:'owner'}}); const allowed=privileged&&aal==='aal2';
    if (allowed) { await c.query("insert into user_roles(user_id,role) values($1,'billing_admin')",[user(6)]); assert.equal((await c.query("delete from user_roles where user_id=$1 returning role",[user(6)])).rowCount,1); }
    else { await denied(c,"insert into user_roles(user_id,role) values($1,'owner')",[user(n)]); assert.equal((await c.query('delete from user_roles returning user_id')).rowCount,0); }
  }
}));

test('C10 extra entitlements require owner AAL2', () => tx(async c => {
  await c.query("insert into user_roles(user_id,role) values($1,'super_admin')",[user(5)]);
  for (const [n,privileged] of [[1,true],[2,false],[3,false],[4,false],[5,true]]) for (const aal of ['aal1','aal2']) {
    await as(c,n,aal); const allowed=privileged&&aal==='aal2';
    assert.equal(await count(c,'additional_member_entitlements'),allowed?2:0);
    assert.equal((await c.query('update additional_member_entitlements set status=status returning id')).rowCount,allowed?2:0);
    await denied(c,'insert into additional_member_entitlements default values'); await denied(c,'delete from additional_member_entitlements');
  }
}));

test('C11 internal data denies client and permits backend', () => tx(async c => {
  for (const n of [1,2,3,4]) for (const aal of ['aal1','aal2']) {
    await as(c,n,aal);
    for (const table of ['module_credentials','asaas_payments','private.admin_audit_log']) {
      await denied(c,`select * from ${table}`); await denied(c,`select id from ${table}`);
      await denied(c,`insert into ${table} default values`); await denied(c,`update ${table} set id=id`); await denied(c,`delete from ${table}`);
    }
  }
  await as(c,null,null,{},'service_role');
  assert.equal(await count(c,'module_credentials'),4); assert.equal(await count(c,'asaas_payments'),4); assert.ok(await count(c,'private.admin_audit_log')>0);
  assert.equal((await c.query('update asaas_payments set amount_cents=amount_cents returning id')).rowCount,4);
}));

test('C12 invalid values and foreign keys are rejected', () => tx(async c => {
  await denied(c,'update asaas_payments set amount_cents=-1',[],'23514');
  await denied(c,"insert into user_roles(user_id,role) values($1,'root')",[user(4)],'23514');
  for (const table of ['profiles','asaas_payments','additional_member_entitlements']) await denied(c,`update ${table} set status='invalid'`,[],'23514');
  await denied(c,"update profiles set plan_type='invalid'",[],'23514');
  for (const nickname of ['x'.repeat(41),'bad\nname',' padded ','']) await denied(c,'update profiles set nickname=$1 where id=$2',[nickname,user(4)],'23514');
  for (const nickname of ['a','x'.repeat(40)]) await c.query('update profiles set nickname=$1 where id=$2',[nickname,user(4)]);
  for (const [table,col,value] of [['user_roles','user_id',user(99)],['module_credentials','module_id',moduleId(99)],['asaas_payments','profile_id',user(99)],['asaas_payments','plan_id',planId(99)],['additional_member_entitlements','owner_id',user(99)],['additional_member_entitlements','member_id',user(99)]]) await denied(c,`update ${table} set ${col}=$1 where ctid=(select ctid from ${table} limit 1)`,[value],'23503');
  await denied(c,'update additional_member_entitlements set member_id=owner_id',[],'23514');
}));

test('C13 duplicates fail including concurrent transactions', async () => {
  await tx(async c => {
    await denied(c,"insert into user_roles(user_id,role) values($1,'member')",[user(4)],'23505');
    await denied(c,"insert into module_credentials(module_id,slot,login,password) values($1,0,'MOCK_x','MOCK_x')",[moduleId(1)],'23505');
  });
  for (const [table,sql,params] of [
    ['user_roles',"insert into user_roles(user_id,role) values($1,'member')",[user(6)]],
    ['module_credentials',"insert into module_credentials(module_id,slot,login,password) values($1,99,'MOCK_x','MOCK_x')",[moduleId(1)]]]) {
    const a=await connect(),b=await connect();
    try {
      await a.query('begin'); await b.query('begin'); await a.query(sql,params);
      const result=b.query(sql,params).then(()=>null,e=>e.code);
      await a.query('commit'); assert.equal(await result,'23505',table);
    } finally {
      await a.query('rollback'); await b.query('rollback');
      if (table==='user_roles') await a.query("delete from user_roles where user_id=$1 and role='member'",params);
      else await a.query('delete from module_credentials where module_id=$1 and slot=99',params);
      await a.end();await b.end();
    }
  }
});

test('C14 deletion preserves financial records and cascades credentials', () => tx(async c => {
  await denied(c,'delete from profiles where id=$1',[user(4)],'23503');
  await c.query('delete from modules where id=$1',[moduleId(1)]);
  assert.equal(Number((await c.query('select count(*) from module_credentials where module_id=$1',[moduleId(1)])).rows[0].count),0);
}));

test('C15 audit events are transactional and contain no sensitive payload', () => tx(async c => {
  const base=await count(c,'private.admin_audit_log'); await c.query('savepoint audit');
  await as(c,1,'aal2');
  await c.query("insert into user_roles(user_id,role) values($1,'member')",[user(6)]);
  await c.query("delete from user_roles where user_id=$1 and role='member'",[user(6)]);
  await c.query('update additional_member_entitlements set status=status');
  await c.query('reset role');
  await c.query('insert into additional_member_entitlements(owner_id,member_id,status) values($1,$2,$3)',[user(4),user(5),'pending']);
  await c.query("delete from additional_member_entitlements where status='pending' and member_id=$1",[user(5)]);
  const events=(await c.query('select actor_id,entity,operation from private.admin_audit_log order by created_at,id')).rows;
  assert.equal(events.length,base+6);
  for(const operation of ['INSERT','UPDATE','DELETE']) assert.ok(events.some(x=>x.operation===operation));
  assert.ok(events.some(x=>x.actor_id===user(1)&&x.entity==='user_roles'));
  const cols=(await c.query("select column_name from information_schema.columns where table_schema='private' and table_name='admin_audit_log'")).rows.map(x=>x.column_name);
  assert.deepEqual(cols.sort(),['actor_id','created_at','entity','id','operation','target_id'].sort());
  await c.query('rollback to savepoint audit'); assert.equal(await count(c,'private.admin_audit_log'),base);
}));

test('C16 missing identity invalid AAL and forged metadata cannot elevate', () => tx(async c => {
  for (const [n,aal] of [[null,'aal2'],[1,null],[1,'bogus'],[4,'aal2']]) {
    await as(c,n,aal,{user_metadata:{role:'owner',aal:'aal2'},app_metadata:{role:'owner'}});
    assert.equal(await count(c,'asaas_test_plans'),0); assert.equal(await count(c,'additional_member_entitlements'),0);
    await denied(c,"insert into user_roles(user_id,role) values($1,'owner')",[user(6)]);
    assert.equal((await c.query('select private.is_owner() allowed')).rows[0].allowed,false);
  }
  await c.query('reset role');
  const helpers=(await c.query("select proname,pg_get_function_identity_arguments(p.oid) args,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and proname in ('has_role','is_owner','can_admin','access_active')")).rows;
  assert.equal(helpers.length,4);
  for(const h of helpers) { assert.ok(!h.args.includes('uuid')); assert.ok(h.proconfig.some(x=>x.startsWith('search_path='))); }
}));

test('C17 reset artifacts and failing runner remain executable', () => {
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  assert.equal(pkg.scripts['db:reset'],'supabase db reset --local');
  assert.ok(existsSync('supabase/config.toml')); assert.ok(existsSync('supabase/seed.sql'));
  const doc=readFileSync('README.md','utf8'); for(const token of ['npm run db:reset','npm test','AAL2','service_role','mock']) assert.ok(doc.includes(token),token);
  assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',"import assert from 'node:assert/strict'; assert.equal(1,2)"],{stdio:'ignore'}),e=>e.status!==0);
});

test('C18 new public and private tables get RLS automatically', () => tx(async c => {
  for (const schema of ['public','private']) {
    for(const [suffix,statement] of [['create',`create table ${schema}.rls_probe_create(id int)`],['as',`create table ${schema}.rls_probe_as as select 1 id`],['into',`select 1 id into ${schema}.rls_probe_into`]]) {
      await c.query(statement); const table=`${schema}.rls_probe_${suffix}`;
      assert.equal((await c.query('select relrowsecurity from pg_class where oid=$1::regclass',[table])).rows[0].relrowsecurity,true,table);
      for(const role of ['anon','authenticated']) assert.equal((await c.query("select has_table_privilege($1,$2,'SELECT') allowed",[role,table])).rows[0].allowed,false);
    }
  }
  const authUrl=new URL(url); authUrl.username='supabase_auth_admin';
  const authClient=new pg.Client({connectionString:authUrl.toString()}); await authClient.connect();
  try {
    await authClient.query('begin'); await authClient.query('create table auth.rls_probe(id int)');
    assert.equal((await authClient.query("select relrowsecurity from pg_class where oid='auth.rls_probe'::regclass")).rows[0].relrowsecurity,false);
  } finally { await authClient.query('rollback'); await authClient.end(); }
}));
