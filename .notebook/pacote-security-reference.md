# Referência de segurança do Pacote

Entry: `/home/wess/dev/pacoteferramentas-7e9d021c/engineering/CONSTITUTION.md` (L42).
Fonte: HEAD `9efb4250`, 2026-09-10; local-admin tem mesmo HEAD. Produção atual não consultada.

Paths abaixo relativos ao checkout de referência.

- Perfil: `supabase/migrations/20260822010000_account_nickname_and_module_access_hardening.sql` (L23) — UPDATE somente avatar/nickname; catálogo exige acesso canônico.
- MFA: `supabase/migrations/20260726010000_p0_security_foundation.sql:has_role()` / `is_super_admin()` — privilégio exige AAL2 e papel persistido.
- Roles: `supabase/migrations/20260711220000_harden_owner_only_privileges.sql` (L16) — owner/super_admin administra; trigger audita.
- Catálogo interno: `supabase/migrations/20260905220000_sec005_private_test_catalog.sql` — revoga anon/PUBLIC e grants excessivos; mantém políticas MFA.
- Vagas: `supabase/migrations/20260905223000_sec003_member_entitlements_authorization.sql` — owner/super_admin AAL2; SELECT/UPDATE mínimos.
- Credenciais: `supabase/migrations/20260827070000_explicit_module_access_modes_and_trial_locking.sql:get_module_credentials_list()` — RPC valida acesso/rate limit; trial recebe valores mascarados. Recorte local proposto não expõe RPC de credenciais.
- Financeiro/diagnósticos: `supabase/migrations/20260907050000_sec011_restrict_financial_status.sql` / `20260907060000_sec014_restrict_admin_views.sql` — cliente sem acesso direto.
- Provas: `scripts/sec001-profile.test.mjs`, `scripts/sec003-database.test.mjs`, `scripts/sec005-database.test.mjs`, `scripts/sec014.test.mjs` — papéis SQL, claims, positivos/negativos; leitura não equivale a execução.
- Histórico: Constituição alerta que snapshots vulneráveis são fixtures, não modelos aprovados. Não copiar seeds, segredos ou exports.

Updated: 2026-10-06
