import { remoteClient } from './connection.mjs';
const c = await remoteClient();
try {
  await c.query('begin read only');
  const tables = (await c.query("select n.nspname schema,c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','p') order by 1,2")).rows;
  const triggers = (await c.query('select evtname,evtenabled from pg_event_trigger order by evtname')).rows;
  console.log(JSON.stringify({ project: process.env.SUPABASE_PROJECT_REF, tables, triggers },null,2));
} finally { await c.query('rollback'); await c.end(); }
