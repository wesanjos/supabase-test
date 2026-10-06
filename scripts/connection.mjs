import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';

export async function remoteClient() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  assert.match(ref ?? '', /^[a-z]{20}$/);
  assert.equal(new URL(process.env.SUPABASE_URL).hostname, `${ref}.supabase.co`);
  assert.ok(process.env.SUPABASE_DB_PASSWORD, 'Missing database password');
  const host = process.env.SUPABASE_DB_HOST ?? `db.${ref}.supabase.co`;
  assert.ok(host === `db.${ref}.supabase.co` || /^aws-[01]-[a-z]+-[a-z]+-\d\.pooler\.supabase\.com$/.test(host), 'Unsupported database host');
  const c = new pg.Client({
    host, port: 5432, database: 'postgres',
    user: host.endsWith('.pooler.supabase.com') ? `postgres.${ref}` : 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: true, ca: readFileSync(process.env.SUPABASE_CA_FILE ?? 'certs/supabase-ca.crt', 'utf8') },
    connectionTimeoutMillis: 15000,
  });
  await c.connect();
  return c;
}
