# Supabase production demo verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: f681ab1..8f55307462ef78ab37d67d529d5a3531f57d79db
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Verified at `8f55307462ef78ab37d67d529d5a3531f57d79db`. Implementation reviewed read-only; no remote database, remote environment file, or secrets accessed. All named proofs were batched into one `npm test` invocation, exit 0: 18 passed, 0 failed, 0 skipped. Each C1–C18 appeared individually in its output and exists in the feature-added `tests/database.test.mjs`.

## Checks

Every Proof run below is the same invocation, `npm test`, exit 0. A green test is not sufficient where its assertions leave the claim unproven.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Eight tables exist with RLS | `npm test`: C1 passed | `tests/database.test.mjs:33` — `assert.equal((await c.query('select relrowsecurity from pg_class where oid=$1::regclass', [table])).rows[0].relrowsecurity, true, table)` over eight literal tables at line 12 | PASS |
| C2 | Seed counts and defined scenarios | `npm test`: C2 passed | `tests/database.test.mjs:37` — `assert.equal(await count(c, table), expected, table)` over literal expected counts 8/8/8/5/4/4/2/4/2; `tests/database.test.mjs:40` — `assert.equal(p[5].status, 'expired'); assert.ok(p[6].access_blocked_at); assert.equal(p[7].plan_type, 'test')`; line 42 asserts owner roles `['admin','owner']` | PASS |
| C3 | Synthetic data markers | `npm test`: C3 passed | `tests/database.test.mjs:46` — `assert.match(p.email, /@example\.com$/); assert.match(p.full_name, /Demo/)`; lines 47–48 assert `/^DEMO-/`, `/^mock_/`, `/^MOCK_/` | PASS |
| C4 | Anonymous table and column access denied | `npm test`: C4 passed | `tests/database.test.mjs:54` — `await denied(c, \`select * from ${table}\`)`; lines 55–58 cover isolated-column SELECT and DELETE/INSERT/UPDATE for all eight tables; `tests/database.test.mjs:27` — `assert.rejects(c.query(sql, params), e => e.code === code)` defaults to `42501` | PASS |
| C5 | Identity isolation and MFA global profile reads | `npm test`: C5 passed | `tests/database.test.mjs:64` — `assert.deepEqual((await c.query('select id from profiles')).rows.map(x=>x.id),[user(n)])`; line 65 asserts own role identities; lines 67–70 assert 1/8 profiles for admin/owner AAL1/AAL2, 1 for billing and 8 for super_admin AAL2 | PASS |
| C6 | Own avatar/nickname only | `npm test`: C6 passed | `tests/database.test.mjs:75` — `assert.equal((await c.query("update profiles set nickname='Demo edit',avatar_url='https://example.com/avatar.png' where id=$1 returning id",[user(n)])).rowCount,1)`; line 76 asserts other-row update returns 0; line 77 denies eight commercial/identity columns through the `42501` assertion at line 27 | PASS |
| C7 | Catalog access follows access state | `npm test`: C7 passed | `tests/database.test.mjs:82` — `assert.equal(await count(c,'modules'),expected,\`user ${n}\`)` over `[[4,4],[5,4],[6,0],[7,0],[8,2],[99,0]]`; lines 84/86 assert lifetime 4 and blocked lifetime 0 | PASS |
| C8 | Administrative catalog CRUD requires AAL2 | `npm test`: C8 passed | `tests/database.test.mjs:93` — `assert.equal(await count(c,'asaas_test_plans'),allowed?2:0)`; lines 99–104 assert allowed update/delete 1 versus denied insert and update/delete 0 across five persisted roles and two AAL levels; line 106 asserts TRUNCATE/REFERENCES/TRIGGER false | PASS |
| C9 | Owner/super_admin AAL2 role management | `npm test`: C9 passed | `tests/database.test.mjs:115` — `assert.equal((await c.query("delete from user_roles where user_id=$1 returning role",[user(6)])).rowCount,1)` after successful insert; line 116 denies escalation insert and asserts delete 0 across five roles, two AAL levels, and forged metadata | PASS |
| C10 | Owner/super_admin AAL2 entitlement read/update | `npm test`: C10 passed | `tests/database.test.mjs:124` — `assert.equal(await count(c,'additional_member_entitlements'),allowed?2:0)`; line 125 asserts update `allowed?2:0`; line 126 denies client INSERT/DELETE | PASS |
| C11 | Internal tables deny clients, allow service | `npm test`: C11 passed | `tests/database.test.mjs:134` — `await denied(c,\`select * from ${table}\`); await denied(c,\`select id from ${table}\`)`; line 135 denies all writes; lines 139–140 assert service reads 4 credentials/4 payments/nonempty audit and updates 4 payments | PASS |
| C12 | Invalid values/references rejected | `npm test`: C12 passed | `tests/database.test.mjs:144` — `await denied(c,'update asaas_payments set amount_cents=-1',[],'23514')`; lines 145–151 assert role/status/plan/nickname/same-person CHECK failures and six FK failures `23503`, using `assert.rejects(..., e => e.code === code)` at line 27 | PASS |
| C13 | Uniqueness including concurrent transactions | `npm test`: C13 passed | `tests/database.test.mjs:156` and line 157 assert role/slot duplicates `23505`; `tests/database.test.mjs:166` — `assert.equal(await result,'23505',table)` after committing competing role/slot inserts | PASS |
| C14 | Financial FK restrict and credential cascade | `npm test`: C14 passed | `tests/database.test.mjs:177` — `await denied(c,'delete from profiles where id=$1',[user(4)],'23503')`; `tests/database.test.mjs:179` — `assert.equal(Number((await c.query('select count(*) from module_credentials where module_id=$1',[moduleId(1)])).rows[0].count),0)` after module delete | PASS |
| C15 | Complete transactional role/entitlement audit without sensitive payload | `npm test`: C15 passed | `tests/database.test.mjs:192` — `assert.equal(events.length,base+6)`; line 193 — `assert.ok(events.some(x=>x.operation===operation))`; line 196 asserts only `['actor_id','created_at','entity','id','operation','target_id']`; line 197 asserts rollback restores base. No role UPDATE proof, no assertion on target identity or timestamp values. | FAIL |
| C16 | Missing identity/invalid AAL/metadata cannot elevate | `npm test`: C16 passed | `tests/database.test.mjs:203` — `assert.equal(await count(c,'asaas_test_plans'),0); assert.equal(await count(c,'additional_member_entitlements'),0)` over absent identity, missing/invalid AAL, forged member; line 205 asserts `private.is_owner()` false; line 210 asserts no UUID arguments and configured search_path | PASS |
| C17 | Reset reproduces scenario and failing test runner exits nonzero | `npm test`: C17 passed | `tests/database.test.mjs:215` — `assert.equal(pkg.scripts['db:reset'],'supabase db reset --local')`; line 217 asserts documentation tokens; line 218 — `assert.throws(()=>execFileSync(process.execPath,['--input-type=module','-e',"import assert from 'node:assert/strict'; assert.equal(1,2)"],{stdio:'ignore'}),e=>e.status!==0)`. These prove configuration/text and plain Node exception exit, not actual reset/retest or failing node:test runner. | FAIL |
| C18 | New public/private tables automatically receive RLS; auth excluded | `npm test`: C18 passed | `tests/database.test.mjs:225` — `assert.equal((await c.query('select relrowsecurity from pg_class where oid=$1::regclass',[table])).rows[0].relrowsecurity,true,table)` over both schemas and CREATE TABLE/AS/SELECT INTO; line 226 asserts anon/authenticated SELECT privilege false; line 233 asserts auth probe RLS false | PASS |

## Ranked gaps

1. **C17 — execution-level proof gap.** Search `rg -n 'reset\|C15\|C17\|audit\|role' tests/database.test.mjs package.json supabase/config.toml` locates only the reset-command assertion at test line 215, not a reset execution. Run and record a local reset followed by the full named suite, and make the negative runner proof actually invoke `node --test` with a failing test. Keep reset outside an active suite to avoid invalidating concurrent tests.
2. **C15 — incomplete audit assertion surface.** `tests/database.test.mjs:185–190` exercise role INSERT/DELETE and entitlement INSERT/UPDATE/DELETE; no role UPDATE. The operation assertion at line 193 searches all historical events and does not couple operation to entity. The query at line 191 omits `target_id` and `created_at`, so those promised values cannot be asserted. Add a backend role UPDATE and assert newly produced audit events by entity/operation, actor, target and valid timestamp, retaining rollback and sensitive-column checks.

## Security inspection and level judgment

SQL tests execute actual PostgreSQL privileges, RLS, constraints and triggers under `anon`, `authenticated` and `service_role`; that is the correct boundary for this database-only plan. Simulated JWT claims do not prove HTTP authentication or real MFA enrollment, as the plan and README explicitly acknowledge. Light profile sampling is acceptable for the remaining checks; no independent Coverage join or fault injection was performed because those belong to standard/ui.

Migration inspection found no implementation defect in the reviewed security controls: `supabase/migrations/20261007000100_demo_foundation.sql:114–138` uses current `auth.uid()`, persisted roles, literal AAL2 and SECURITY DEFINER helpers with empty search_path and explicit function grants; lines 140–151 opt client grants in and preserve service grants; lines 153–179 apply identity and administrative predicates. Internal tables have neither client grants nor policies. Event trigger lines 14–31 use a safe pg_catalog search_path, schema filtering, object OIDs and all three approved DDL tags; default table/function client grants are revoked at lines 9–12. The audit implementation at lines 182–196 includes role UPDATE and target/timestamp fields; C15 is an unproven behavior, not a demonstrated SQL bug.

## Swept existing

No Swept row resolves to an existing-code exemption. Named validation/authorization/concurrency/lifecycle/observability obligations were reviewed through C1–C18 above; C15 and C17 remain incomplete. The dependency-failure and state-machine n/a exclusions are approved policy. No Test policy rows exist in checks.md. Binding-source comparison is not a light-profile requirement.

## Gate

`npm test` — 18 passed, 0 failed, 0 skipped; 16/18 claims proven, C15/C17 incomplete.

`python3 /home/wess/.codex/skills/tlc-spec-lean/scripts/validate_verification.py supabase-production-demo --root /home/wess/dev/supabase-test` — exit 1, 1 error, 0 warnings: verdict FAIL. Remote application remains gated pending corrected proofs and scoped independent re-verification.
