import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { remoteClient } from './connection.mjs';

const description = 'supabase-test: fictitious inventory fixture; not an operational credential';
const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const entries = {
  ...parseEnv(template.split('# Edge Functions\n')[1].split('# GitHub Actions\n')[0]),
  ...parseEnv(template.split('# Documentadas / legadas\n')[1].split('# Fontes adicionais')[0]),
  SUPABASE_URL: 'https://supabase-test.example.invalid',
  SUPABASE_ANON_KEY: 'mock_inventory_anon_key',
  SUPABASE_PUBLISHABLE_KEY: 'mock_inventory_publishable_key',
  SUPABASE_SERVICE_ROLE_KEY: 'mock_inventory_service_role_key',
  SUPABASE_SECRET_KEY: 'mock_inventory_secret_key',
  SUPABASE_DB_URL: 'postgresql://mock:mock@supabase.example.invalid:5432/postgres',
  edge_service_role_jwt: 'mock_inventory_service_role_jwt',
};

let c;
try {
  assert.equal(process.env.SUPABASE_PROJECT_REF, 'xitazriytooyqetfjiki', 'Only the documented test project is allowed');
  c = await remoteClient();
  await c.query('begin');
  await c.query("select pg_advisory_xact_lock(hashtext('supabase-test-vault-fixtures'))");
  assert.equal((await c.query("select count(*) from supabase_migrations.schema_migrations where version='20261007000100'")).rows[0].count, '1', 'Demo migration must exist');
  const existing = new Map((await c.query('select name, description, decrypted_secret from vault.decrypted_secrets where name=any($1::text[])', [Object.keys(entries)])).rows.map(row => [row.name, row]));
  let created = 0;
  for (const [name, value] of Object.entries(entries)) {
    const prior = existing.get(name);
    if (prior) {
      assert.equal(prior.description, description, 'Existing secret must not be overwritten');
      assert.equal(prior.decrypted_secret, value, 'Changed fixture must not be overwritten');
    } else {
      await c.query('select vault.create_secret($1, $2, $3)', [value, name, description]);
      created++;
    }
  }
  const stored = (await c.query('select name, decrypted_secret from vault.decrypted_secrets where name=any($1::text[])', [Object.keys(entries)])).rows;
  assert.deepEqual(Object.fromEntries(stored.map(row => [row.name, row.decrypted_secret])), entries);
  await c.query('commit');
  console.log(`PASS: ${created} fictitious Vault entries created; ${stored.length} verified; values omitted.`);
} catch (error) {
  if (c) await c.query('rollback');
  console.error(`Vault fixture setup failed; no changes committed (${error.code ?? error.name}).`);
  process.exitCode = 1;
} finally {
  if (c) await c.end();
}
