import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { remoteClient } from './connection.mjs';
const version='20261007000100';
const migration=readFileSync(`supabase/migrations/${version}_demo_foundation.sql`,'utf8');
const seed=readFileSync('supabase/seed.sql','utf8');
const body=sql=>sql.replace(/^begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
const c=await remoteClient();
try {
  await c.query('begin');
  await c.query("select pg_advisory_xact_lock(hashtext('supabase-production-demo'))");
  if((await c.query("select to_regclass('supabase_migrations.schema_migrations') found")).rows[0].found) {
    const prior=(await c.query('select statements from supabase_migrations.schema_migrations where version=$1',[version])).rows[0];
    if(prior) {
      assert.deepEqual(prior.statements,[migration,seed],'Applied migration differs from this codebase');
      console.log('Demo already applied; no changes.');
      await c.query('rollback');
      process.exitCode=0;
    } else await apply();
  } else await apply();
} catch(e) {
  await c.query('rollback');
  console.error(`Apply failed; transaction rolled back (${e.code ?? e.name}).`);
  process.exitCode=1;
} finally { await c.end(); }

async function apply() {
  const existing=(await c.query("select tablename from pg_tables where schemaname in ('public','private')")).rows;
  assert.equal(existing.length,0,'Target must be an empty demo project; no existing tables are overwritten');
  assert.equal(Number((await c.query('select count(*) from auth.users')).rows[0].count),0,'Target already has users');
  await c.query(body(migration));
  await c.query(body(seed));
  await c.query('create schema if not exists supabase_migrations');
  await c.query('create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text)');
  await c.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'demo_foundation',[migration,seed]]);
  await c.query('commit');
  console.log('Applied schema, mock seed and automatic RLS in one transaction.');
}
