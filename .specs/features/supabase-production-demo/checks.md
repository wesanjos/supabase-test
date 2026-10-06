# Supabase production demo checks

Profile: light
Plan: `.specs/features/supabase-production-demo/plan.md`

18 checks em 1 slice; 5 doors; 0 questões bloqueantes.

## Checks

### S1 - banco mockado protegido

**C1** - Oito tabelas existem com RLS ativa (AC 1; doors 1/2).
Proof: `node --test --test-name-pattern "^C1 " tests/database.test.mjs`

**C2** - Seed tem volumes 8/8/5/4/4/2/4/2 e cenários definidos (AC 2).
Proof: `node --test --test-name-pattern "^C2 " tests/database.test.mjs`

**C3** - Dados usam marcadores Demo/example.com/DEMO/MOCK/mock (AC 3).
Proof: `node --test --test-name-pattern "^C3 " tests/database.test.mjs`

**C4** - Anon não acessa oito tabelas nem colunas individuais (AC 4).
Proof: `node --test --test-name-pattern "^C4 " tests/database.test.mjs`

**C5** - Perfil/papéis próprios isolados; leitura global somente administração AAL2 (AC 5).
Proof: `node --test --test-name-pattern "^C5 " tests/database.test.mjs`

**C6** - Somente avatar/nickname próprios editáveis; campos comerciais negados (AC 6).
Proof: `node --test --test-name-pattern "^C6 " tests/database.test.mjs`

**C7** - Catálogo entrega 4 ativos, 0 expirados/bloqueados/sem perfil, 2 trial (AC 7).
Proof: `node --test --test-name-pattern "^C7 " tests/database.test.mjs`

**C8** - CRUD de módulos/planos exige admin/owner/super_admin AAL2 (AC 8).
Proof: `node --test --test-name-pattern "^C8 " tests/database.test.mjs`

**C9** - Roles INSERT/DELETE exigem owner/super_admin AAL2 (AC 9).
Proof: `node --test --test-name-pattern "^C9 " tests/database.test.mjs`

**C10** - Vagas SELECT/UPDATE exigem owner/super_admin AAL2; INSERT/DELETE backend (AC 10).
Proof: `node --test --test-name-pattern "^C10 " tests/database.test.mjs`

**C11** - Credenciais/pagamentos/auditoria negam cliente e preservam serviço (AC 11; door 4).
Proof: `node --test --test-name-pattern "^C11 " tests/database.test.mjs`

**C12** - Constraints rejeitam valores/referências/apelidos/vagas inválidos (AC 12).
Proof: `node --test --test-name-pattern "^C12 " tests/database.test.mjs`

**C13** - Unicidade rejeita associação e slot duplicados inclusive corrida (AC 13).
Proof: `node --test --test-name-pattern "^C13 " tests/database.test.mjs`

**C14** - Perfil com pagamento não exclui; módulo exclui credenciais (AC 14).
Proof: `node --test --test-name-pattern "^C14 " tests/database.test.mjs`

**C15** - Roles/vagas geram auditoria sem payload pessoal e rollback reverte evento (AC 15).
Proof: `node --test --test-name-pattern "^C15 " tests/database.test.mjs`

**C16** - Sem identidade/AAL inválido/metadata forjada não concede privilégio (AC 16; door 3).
Proof: `node --test --test-name-pattern "^C16 " tests/database.test.mjs`

**C17** - Reset local reaplica cenário; runner propaga falha; documentação explica execução (AC 17).
Proof: `node --test --test-name-pattern "^C17 " tests/database.test.mjs`

**C18** - RLS automático protege CREATE TABLE/AS/SELECT INTO em public/private, sem tocar auth (AC 18; door 5).
Proof: `node --test --test-name-pattern "^C18 " tests/database.test.mjs`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| entidades (8) | profiles C1 · user_roles C1 · modules C1 · module_credentials C1 · asaas_test_plans C1 · asaas_payments C1 · additional_member_entitlements C1 · admin_audit_log C1 | - |
| doors (5) | modelo C1 · perfil C6 · MFA C16 · internos C11 · auto-RLS C18 | - |
| perfis (8) | owner C2 · admin C2 · billing_admin C2 · ativo1 C2 · ativo2 C2 · expirado C2 · bloqueado C2 · trial C2 | - |
| privilegio (6) | member C8 · admin C8 · billing_admin C8 · owner C8 · super_admin C8 · ausente C16 | - |
| AAL (4) | aal1 C8 · aal2 C8 · ausente C16 · invalido C16 | - |
| acesso (5) | ativo C7 · expirado C7 · bloqueado C7 · trial C7 · sem-perfil C7 | - |
| operacoes (4) | SELECT C5 · INSERT C8 · UPDATE C8 · DELETE C8 | - |
| DDL auto-RLS (6) | public-create C18 · public-as C18 · public-into C18 · private-create C18 · private-as C18 · private-into C18 | - |
| restricoes (7) | valor C12 · role C12 · status C12 · plano C12 · nickname C12 · FK C12 · titular C12 | - |

## Swept

- validation: C12
- failure modes: C15, C17
- idempotency: C13, C17
- authorization: C4, C5, C6, C8, C9, C10, C11, C16
- concurrency: C13
- data lifecycle: C14
- dependency failure: n/a - falha de ferramenta reportada; sem fallback ou backend externo customizado
- state transitions: C12; n/a - sem máquina de estados de negócio
- observability: C15

## Handoff

Estimativa: arquivos novos de SQL/testes/scripts/docs ~60 KB / 4 = 15k tokens; contexto da referência ~25k; total ~40k < budget 150k. Um builder; nenhuma divisão necessária. Perfil light conforme default aprovado; standard não foi explicitamente selecionado.

Autorização remota: projeto xitazriytooyqetfjiki, credenciais temporárias e aplicação autorizadas pelo usuário em 2026-10-06. Nenhum reset remoto.

- **Boundary:** C1-C18 closed by local proofs (18/18), pending independent verification.
- **Settled mid-build:** remote keys/application and automatic RLS authorized; trusted CA pinned, local fixtures corrected without weakening values; profile remains light.
- **Abandoned:** none.
