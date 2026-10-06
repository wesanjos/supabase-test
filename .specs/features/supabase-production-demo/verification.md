# Supabase production demo verification

**Verdict**: PASS
**Profile**: light
**Diff range**: f681ab1..6544f1e8e7617d4fa3a6a14f2021681e9b3d8fb5
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Verified at `6544f1e8e7617d4fa3a6a14f2021681e9b3d8fb5`; fix range `8f55307..6544f1e`. Implementation review scoped to the fix diff and prior FAIL rows. Unaffected security and level judgments carry from `8f55307462ef78ab37d67d529d5a3531f57d79db`. All test citations refreshed against current HEAD. No remote database, remote environment file or secrets accessed.

One independent `npm test` invocation exited 0: all C1–C18 and the added Auth API regression appeared individually and passed (19 passed, 0 failed, 0 skipped). C17 executed a real local reset and child rerun of C1–C16/C18 in that invocation.

## Checks

Every Proof run below is the same invocation, `npm test`, exit 0. A green test is not sufficient where its assertions leave the claim unproven.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Eight tables exist with RLS | `npm test`: C1 passed | `tests/database.test.mjs:35` — `assert.equal((await c.query('select relrowsecurity from pg_class where oid=$1::regclass', [table])).rows[0].relrowsecurity, true, table)` over eight literal tables at line 14 | PASS |
| C2 | Seed counts and defined scenarios | `npm test`: C2 passed | `tests/database.test.mjs:39` — `assert.equal(await count(c, table), expected, table)` over literal expected counts 8/8/8/5/4/4/2/4/2; `tests/database.test.mjs:42` — `assert.equal(p[5].status, 'expired'); assert.ok(p[6].access_blocked_at); assert.equal(p[7].plan_type, 'test')`; line 44 asserts owner roles `['admin','owner']` | PASS |
| C3 | Synthetic data markers | `npm test`: C3 passed | `tests/database.test.mjs:48` — `assert.match(p.email, /@example\.com$/); assert.match(p.full_name, /Demo/)`; adjacent assertions assert `/^DEMO-/`, `/^mock_/`, `/^MOCK_/` | PASS |
| C4 | Anonymous table and column access denied | `npm test`: C4 passed | `tests/database.test.mjs:56` — `await denied(c, `select * from ${table}`)`; adjacent assertions cover isolated-column SELECT and DELETE/INSERT/UPDATE for all eight tables; `tests/database.test.mjs:29` — `assert.rejects(c.query(sql, params), e => e.code === code)` defaults to `42501` | PASS |
| C5 | Identity isolation and MFA global profile reads | `npm test`: C5 passed | `tests/database.test.mjs:66` — `assert.deepEqual((await c.query('select id from profiles')).rows.map(x=>x.id),[user(n)])`; line 67 asserts own role identities; adjacent assertions assert 1/8 profiles for admin/owner AAL1/AAL2, 1 for billing and 8 for super_admin AAL2 | PASS |
| C6 | Own avatar/nickname only | `npm test`: C6 passed | `tests/database.test.mjs:77` — `assert.equal((await c.query("update profiles set nickname='Demo edit',avatar_url='https://example.com/avatar.png' where id=$1 returning id",[user(n)])).rowCount,1)`; line 78 asserts other-row update returns 0; line 79 denies eight commercial/identity columns through the `42501` assertion at line 29 | PASS |
| C7 | Catalog access follows access state | `npm test`: C7 passed | `tests/database.test.mjs:84` — `assert.equal(await count(c,'modules'),expected,`user ${n}`)` over `[[4,4],[5,4],[6,0],[7,0],[8,2],[99,0]]`; lifetime/blocked assertions assert lifetime 4 and blocked lifetime 0 | PASS |
| C8 | Administrative catalog CRUD requires AAL2 | `npm test`: C8 passed | `tests/database.test.mjs:95` — `assert.equal(await count(c,'asaas_test_plans'),allowed?2:0)`; CRUD assertions assert allowed update/delete 1 versus denied insert and update/delete 0 across five persisted roles and two AAL levels; line 108 asserts TRUNCATE/REFERENCES/TRIGGER false | PASS |
| C9 | Owner/super_admin AAL2 role management | `npm test`: C9 passed | `tests/database.test.mjs:117` — `assert.equal((await c.query("delete from user_roles where user_id=$1 returning role",[user(6)])).rowCount,1)` after successful insert; line 118 denies escalation insert and asserts delete 0 across five roles, two AAL levels, and forged metadata | PASS |
| C10 | Owner/super_admin AAL2 entitlement read/update | `npm test`: C10 passed | `tests/database.test.mjs:126` — `assert.equal(await count(c,'additional_member_entitlements'),allowed?2:0)`; line 127 asserts update `allowed?2:0`; line 128 denies client INSERT/DELETE | PASS |
| C11 | Internal tables deny clients, allow service | `npm test`: C11 passed | `tests/database.test.mjs:136` — `await denied(c,`select * from ${table}`); await denied(c,`select id from ${table}`)`; line 137 denies all writes; service assertions assert service reads 4 credentials/4 payments/nonempty audit and updates 4 payments | PASS |
| C12 | Invalid values/references rejected | `npm test`: C12 passed | `tests/database.test.mjs:146` — `await denied(c,'update asaas_payments set amount_cents=-1',[],'23514')`; constraint assertions assert role/status/plan/nickname/same-person CHECK failures and six FK failures `23503`, using `assert.rejects(..., e => e.code === code)` at line 29 | PASS |
| C13 | Uniqueness including concurrent transactions | `npm test`: C13 passed | `tests/database.test.mjs:158` and line 159 assert role/slot duplicates `23505`; `tests/database.test.mjs:168` — `assert.equal(await result,'23505',table)` after committing competing role/slot inserts | PASS |
| C14 | Financial FK restrict and credential cascade | `npm test`: C14 passed | `tests/database.test.mjs:179` — `await denied(c,'delete from profiles where id=$1',[user(4)],'23503')`; `tests/database.test.mjs:181` — `assert.equal(Number((await c.query('select count(*) from module_credentials where module_id=$1',[moduleId(1)])).rows[0].count),0)` after module delete | PASS |
| C15 | Complete transactional role/entitlement audit without sensitive payload | `npm test`: C15 passed | `tests/database.test.mjs:195` — `assert.equal(events.length,base+7)`; line 197 asserts every fresh event has a Date timestamp and target; lines 198–200 assert role INSERT/DELETE/UPDATE with exact actor/target; line 201 asserts two entitlement UPDATE events and line 202 asserts INSERT/DELETE, all current actor; `tests/database.test.mjs:207` — `assert.deepEqual(cols.sort(),['actor_id','created_at','entity','id','operation','target_id'].sort())`; line 208 asserts rollback restores base | PASS |
| C16 | Missing identity/invalid AAL/metadata cannot elevate | `npm test`: C16 passed | `tests/database.test.mjs:214` — `assert.equal(await count(c,'asaas_test_plans'),0); assert.equal(await count(c,'additional_member_entitlements'),0)` over absent identity, missing/invalid AAL, forged member; line 216 asserts `private.is_owner()` false; line 221 asserts no UUID arguments and configured search_path | PASS |
| C17 | Reset reproduces scenario and failing test runner exits nonzero | `npm test`: C17 passed | `tests/database.test.mjs:232` — `assert.equal(await count(c,table),expected,table)` after successful actual local reset at line 229; line 232 asserts eight literal seed counts; line 239 successfully reruns C1–C16/C18 and line 240 asserts each named hit; `tests/database.test.mjs:241` — `assert.throws(()=>execFileSync(process.execPath,['--test',fixture],{stdio:'ignore',env:childEnv}),e=>e.status===1)` using a real failing test fixture | PASS |
| C18 | New public/private tables automatically receive RLS; auth excluded | `npm test`: C18 passed | `tests/database.test.mjs:249` — `assert.equal((await c.query('select relrowsecurity from pg_class where oid=$1::regclass',[table])).rows[0].relrowsecurity,true,table)` over both schemas and CREATE TABLE/AS/SELECT INTO; line 250 asserts anon/authenticated SELECT privilege false; line 257 asserts auth probe RLS false | PASS |

## Scoped findings and fixes

Verified at `6544f1e`: prior C15 and C17 gaps are closed. C15 now exercises backend role UPDATE and asserts fresh events for both entities and every operation, actor/role target and timestamp presence; rollback and payload exclusions remain covered. C17 performs actual local reset, confirms seed counts, successfully reruns all other named database proofs and confirms an actual failing node:test fixture exits 1. No new gap found.

The seed fix in `supabase/seed.sql:17–20` initializes legacy Auth token/change fields to empty strings only for the eight synthetic users. It neither grants authority nor changes persisted roles or MFA. The added local HTTP regression at `tests/database.test.mjs:267` asserts `assert.equal(r.status,200,`Auth user ${n}`); assert.equal((await r.json()).id,user(n))` for all eight accounts. This passed after C17 reset, proving fresh seeded users are readable by GoTrue. It establishes administrative user-read compatibility, not password login or real MFA. Keys are obtained in-process and not printed. `supabase/config.toml:38` uses `local_smtp`; actual reset and Auth requests passed with that configuration.

## Security inspection and level judgment

Carried from `8f55307462ef78ab37d67d529d5a3531f57d79db`: SQL tests execute actual PostgreSQL privileges, RLS, constraints and triggers under anon/authenticated/service_role, the appropriate boundary for this database-only plan. Simulated JWT claims do not prove HTTP authentication or real MFA enrollment, as the plan and README acknowledge. Light profile sampling remains appropriate; no independent Coverage join or fault injection was performed because those belong to standard/ui.

Unchanged migration controls carried from that SHA: `supabase/migrations/20261007000100_demo_foundation.sql:114–138` uses current auth.uid(), persisted roles, literal AAL2 and SECURITY DEFINER helpers with empty search_path and explicit function grants. Lines 140–151 opt client grants in and preserve service grants; lines 153–179 apply identity and administrative predicates. Internal tables have neither client grants nor policies. Event trigger lines 14–31 use pg_catalog search_path, schema filtering, object OIDs and three approved DDL tags; default table/function client grants are revoked at lines 9–12. Audit implementation lines 182–196 is unchanged. The fix diff does not change grants or authorization functions.

## Swept existing

Carried from `8f55307462ef78ab37d67d529d5a3531f57d79db`, with C15/C17 re-verified at `6544f1e`: no Swept row resolves to an existing-code exemption. Validation/authorization/concurrency/lifecycle/observability obligations are covered by the C1–C18 proofs. Dependency-failure and state-machine n/a exclusions remain approved policy. No Test policy rows exist in checks.md. Binding-source comparison is not a light-profile requirement.

## Gate

`npm test` — exit 0: 19 passed, 0 failed, 0 skipped; 18/18 checks proven with located evidence, plus the Auth API regression. C17 additionally reset/reapplied and reran the 17 other named database tests successfully.

`python3 /home/wess/.codex/skills/tlc-spec-lean/scripts/validate_verification.py supabase-production-demo --root /home/wess/dev/supabase-test` — exit 0: 0 errors, 0 warnings across this feature.
