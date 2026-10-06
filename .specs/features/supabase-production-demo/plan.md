# Supabase: área de membros com dados mockados

## Problem

Usuário quer banco pequeno semelhante a produção, com dados sensíveis fictícios e segurança baseada no Pacote de Ferramentas. Este repositório não contém banco nem configuração Supabase; nenhum projeto remoto foi identificado.

Referência: `/home/wess/dev/pacoteferramentas-7e9d021c`, HEAD `9efb4250`, de 2026-09-10. `pacoteferramentas-local-admin` tem o mesmo HEAD. Investigação somente leitura, sem verificar produção ACTIVE. Migrações recentes e invariantes SEC guiam proposta; fixtures históricas vulneráveis não são modelo.

Entrega: mini área de membros com controles do banco equivalentes dentro do recorte descrito, dados sintéticos e testes positivos/negativos. Não equivale à segurança completa do original, que inclui frontend, autenticação HTTP, CAPTCHA, cron, webhooks e operação.

## Flow

Reutiliza padrões de Supabase Auth, RLS, grants por coluna e MFA encontrados na referência; PostgreSQL aplica autorização independentemente da interface.

1. Migração e seed -> PostgreSQL do Supabase (exists): cria estrutura da door 1 e popula cenário sintético.
2. Sessão -> Supabase Auth (exists): fornece identidade e AAL via token verificado, não payload do cliente.
3. SQL/Data API existente -> PostgreSQL (exists): grants e políticas das doors 2 e 3 protegem perfis, catálogo e administração.
4. Escrita de papéis ou vagas -> PostgreSQL (exists): trigger persiste evento em `private.admin_audit_log` (door 4) na mesma transação.
5. Testes -> PostgreSQL (exists): exercitam sujeitos distintos, AAL1/AAL2 e serviço; documentação explica execução e limites.

## Impact

| Front | What changes |
| --- | --- |
| domain | Substitui CRM genérico por área de membros: perfil, papel, módulo, credencial mockada, plano interno, pagamento e vaga extra. |
| stored data | Cria oito tabelas no projeto novo; sem dados existentes; seed separado da migração. |
| reference | Somente leitura do projeto original; nenhum arquivo, cliente, segredo ou export importado. |
| remote | Usuário autorizou aplicação no projeto de teste xitazriytooyqetfjiki em 2026-10-06; inspecionar antes de aplicar, sem reset remoto. |

## Relations

- Usuário Auth possui um perfil e vários papéis; associação usuário/papel é única.
- Módulo possui várias credenciais; slot é único dentro do módulo.
- Perfil e plano interno possuem vários pagamentos; referências devem existir.
- Vaga extra pertence a titular e pode ter beneficiário distinto do titular, ambos perfis existentes.
- Evento de auditoria identifica ator/alvo sem payload sensível; sobrevive à remoção do alvo.
- Exclusão de perfil com pagamento é impedida; exclusão de módulo remove suas credenciais.

## Surface

None - nenhuma rota própria ou RPC pública de entrega de credenciais; SQL/Data API existentes. Comportamentos do banco definidos em Criteria e Observable.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1: modelo persistido | `public.profiles`, `public.user_roles`, `public.modules`, `public.module_credentials`, `public.asaas_test_plans`, `public.asaas_payments`, `public.additional_member_entitlements`, `private.admin_audit_log`; `UNIQUE (user_id, role)` e `UNIQUE (module_id, slot)`. | CRM genérico: não reproduz fronteiras de segurança do projeto escolhido. |
| 2: perfil e acesso | RLS nas oito tabelas; perfil próprio: `GRANT UPDATE (avatar_url, nickname)`; acesso exige status active, sem bloqueio e validade futura ou plano lifetime; trial só lê módulos trial_enabled. | UPDATE de tabela inteira e filtro na UI: permitem alterar plano, prazo ou bloqueio diretamente. |
| 3: privilégios e MFA | Papéis `owner`, `super_admin`, `admin`, `billing_admin`, `member` persistidos; privilégio administrativo exige `auth.jwt()->>'aal' = 'aal2'`; helpers no schema private com `SECURITY DEFINER SET search_path = ''`, identidade atual e grants mínimos; PUBLIC/anon revogados; authenticated sem TRUNCATE/REFERENCES/TRIGGER. | Role/AAL do payload ou metadata editável: não comprovam autoridade. |
| 4: recursos internos | module_credentials, asaas_payments e private.admin_audit_log somente backend; trigger audita mudanças de roles e vagas com ator, alvo, operação e instante, sem valores pessoais ou credenciais. | SELECT direto para admin autenticado: cria bypass de recursos reservados a funções/backend. |

| 5: RLS automático | Event trigger `demo_ensure_rls` em `ddl_command_end`, tags CREATE TABLE/CREATE TABLE AS/SELECT INTO, schemas public/private, ativa RLS por OID; defaults revogam grants de cliente em novas tabelas/funções. | Somente RLS nas tabelas iniciais: não atende pedido de RLS automático para novas tabelas. |

## Criteria

### S1: cenário pequeno com controles da referência (P1)

**Acceptance Criteria**

1. WHEN migração é aplicada num Supabase local vazio THEN o banco SHALL conter as oito tabelas de Landing com RLS ativado em todas.
2. WHEN seed local é aplicado THEN o banco SHALL conter 8 usuários Auth e 8 perfis (owner, admin, billing_admin, 2 membros ativos, expirado, bloqueado, trial), 5 associações de papel, 4 módulos (2 trial_enabled), 4 credenciais, 2 planos internos, 4 pagamentos e 2 vagas; owner possui também papel admin.
3. The sistema SHALL usar somente dados sintéticos: emails example.com, nomes Demo, documentos DEMO-*, credenciais MOCK_* e identificadores financeiros mock_*; nenhum segredo, cliente ou export de produção copiado.
4. WHEN anon consulta ou escreve qualquer tabela criada THEN o banco SHALL negar acesso por falta de privilégio, inclusive seleção de coluna isolada.
5. WHEN membro consulta profiles ou user_roles THEN o banco SHALL retornar somente perfil/papéis próprios; admin/owner/super_admin AAL2 podem consultar perfis; billing_admin não recebe leitura global de perfis.
6. WHEN usuário altera avatar_url ou nickname THEN o banco SHALL permitir somente no próprio perfil; UPDATE direto de email, nome, plano, status, prazo, bloqueio e identidade é negado inclusive para admin.
7. WHEN membro ativo consulta modules THEN o banco SHALL retornar 4 módulos; expirado, bloqueado ou sujeito sem perfil recebem zero; trial ativo recebe somente 2 módulos trial_enabled.
8. WHEN admin, owner ou super_admin com AAL2 administra modules ou asaas_test_plans THEN o banco SHALL permitir CRUD; member e billing_admin são negados; AAL1 ou AAL ausente nunca concede privilégio administrativo.
9. WHEN owner ou super_admin AAL2 altera user_roles THEN o banco SHALL permitir INSERT e DELETE; admin comum, billing_admin e member não concedem nem removem papéis, mesmo com AAL2 ou metadata forjada.
10. WHEN owner ou super_admin AAL2 acessa additional_member_entitlements THEN o banco SHALL permitir SELECT e UPDATE; admin comum, billing_admin, member e owner AAL1 recebem zero linhas e não alteram vagas; INSERT/DELETE diretos somente backend.
11. WHEN authenticated consulta ou escreve module_credentials, asaas_payments ou private.admin_audit_log THEN o banco SHALL negar acesso direto inclusive para owner/admin AAL2 e seleção de coluna isolada; service_role mantém operações legítimas.
12. WHEN pagamento negativo, papel/status/plano inválido, apelido acima de 40 caracteres ou com controles, ou referência inexistente é gravado THEN o banco SHALL rejeitar por constraint; vaga com titular igual ao beneficiário também é rejeitada.
13. WHEN associação usuário/papel ou slot de credencial é duplicado THEN o banco SHALL rejeitar por constraint única, inclusive entre transações concorrentes.
14. WHEN perfil com pagamento é excluído THEN o banco SHALL impedir exclusão; WHEN módulo é excluído THEN o banco SHALL excluir credenciais por cascata.
15. WHEN papel ou vaga é criado, alterado ou removido THEN o banco SHALL registrar evento na mesma transação sem nome, email, telefone, documento, login ou senha; rollback também reverte evento.
16. WHEN contexto não possui identidade, possui AAL inválido ou metadata alegando privilégio THEN o banco SHALL negar privilégio não comprovado; helpers não aceitam identidade arbitrária e não usam email como autoridade de papel.
17. WHEN cenário local é recriado THEN o projeto SHALL reaplicar migração, seed e testes com resultados iguais; testes falhos retornam exit code não zero; documentação contém matriz de acesso e limites das provas.

18. WHEN nova tabela é criada em public ou private por CREATE TABLE, CREATE TABLE AS ou SELECT INTO THEN o banco SHALL ativar RLS automaticamente; schema auth permanece fora do trigger.

**Independent test:** SQL com anon/authenticated/service_role, sujeitos distintos, AAL1/AAL2 e claims ausentes; grants por coluna, constraints, concorrência e rollback. Claims simuladas em SQL não equivalem a login HTTP com MFA real.

## Out of scope

| Excluded | Why |
| --- | --- |
| Frontend, Edge Functions, CAPTCHA, cron e webhooks | Entrega é banco; SEC-002/004/006/007/008/009/010/012/013 completos dependem dessas superfícies. |
| RPC de entrega de credenciais, trial onboarding e rate limiting de RPC | Neste recorte credenciais ficam somente no backend; não existe caminho público de entrega. |
| Cobrança real e concessão automática por pagamento | Registros mockados, sem efeitos financeiros externos. |
| Schema completo e migrations históricas | Muitas tabelas e fixtures antigas vulneráveis; reproduzir recorte com controles atuais relevantes. |
| Criptografia de campos e operação de produção | Dados sintéticos; backups, alertas e gestão de chaves exigem requisitos operacionais próprios. |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Fonte | Checkout pacoteferramentas-7e9d021c em 9efb4250 | Cópias locais compartilham HEAD; produção atual não verificada. | n |
| Ambiente | Supabase local; arquivos portáveis para projeto remoto de teste | Destino remoto não indicado; Docker disponível, CLI ausente. | n |
| Verificação | light, budget 150k; recomendar standard | Padrão da skill; standard acrescenta recomputação de cobertura e mutações adversariais, úteis para segurança. | n |
| Compatibilidade | Nomes inspirados no original, colunas mínimas | Não foi solicitado executar frontend original contra este banco. | n |
| Auditoria | Sem expiração automática na demonstração | Cenário pequeno; retenção não especificada. | n |

**Open questions:** none - defaults acima revisáveis; destino remoto necessário apenas para aplicação hospedada posterior.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| SQL: leitura | perfil/papéis próprios, sujeito distinto ou sem perfil | AC 5, 16 |
| SQL: perfil | edição por coluna e linha própria | AC 6 |
| SQL: autorização | AAL1/AAL2/ausente, metadata sem autoridade | AC 8, 9, 10, 16 |
| SQL: catálogo | ativo, expirado, bloqueado e trial | AC 7 |
| SQL: recursos internos | anon, authenticated, owner AAL2 e backend | AC 4, 11 |
| SQL: erros | privilégio/RLS 42501; FK 23503; unicidade 23505; CHECK 23514 | AC 4, 6, 9, 11, 12, 13, 14 |
| SQL: concorrência e retry | unicidade; reset local reproduzível | AC 13, 17 |
| SQL: dados | volumes e marcadores sintéticos | AC 2, 3 |
| SQL: lifecycle | FK restritiva/cascata | AC 14 |
| SQL: observabilidade e falha parcial | trigger transacional sem payload pessoal | AC 15 |
| SQL: estados | valores permitidos | AC 12 |
| Data API existente | resposta, versionamento, erros HTTP e rate limits | n/a - nenhuma rota/RPC customizada; prova é SQL, não login HTTP ponta a ponta. |
| Execução local | reset somente local; exit codes de teste | AC 17 |
| Documento | português; execução, matriz de acesso e limites | AC 17 |
| Dependência externa | Docker/Supabase indisponível | n/a - falha explícita; sem fallback privilegiado ou aplicação remota automática. |

## Sources

- Pedido do usuário: Pacote de Ferramentas como referência para dados mockados e segurança.
- Checkout de referência: `engineering/CONSTITUTION.md`, SEC-001/003/005/011/014; escopo dos demais controles externos.
- Migrações do mesmo checkout: `20260726010000_p0_security_foundation.sql`, `20260711220000_harden_owner_only_privileges.sql`, `20260822010000_account_nickname_and_module_access_hardening.sql`, `20260826120000_private_free_trial.sql`, `20260827070000_explicit_module_access_modes_and_trial_locking.sql`, `20260905220000_sec005_private_test_catalog.sql`, `20260905223000_sec003_member_entitlements_authorization.sql`, `20260907050000_sec011_restrict_financial_status.sql`, `20260907060000_sec014_restrict_admin_views.sql`.
- Testes de referência inspecionados, não executados: `scripts/sec001-profile.test.mjs`, `scripts/sec003-database.test.mjs`, `scripts/sec005-database.test.mjs`, `scripts/sec014.test.mjs`.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [MFA](https://supabase.com/docs/guides/auth/auth-mfa), consultados via Context7: grants combinam com RLS, AAL2 pode ser exigido no banco e service_role bypassa políticas.

Autorização de execução: usuário forneceu credenciais temporárias e autorizou construir/aplicar neste projeto em 2026-10-06. Credenciais ficam fora do Git.
