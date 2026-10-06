# Supabase: banco mockado com segurança de área de membros

Demonstração pequena inspirada no Pacote de Ferramentas, checkout `9efb4250`.
Dados mockados; sem cobrança externa. Oito tabelas, RLS e grants mínimos.

## Execução local

Requer Node.js 24 e Docker disponível. CLI instalada como dependência do projeto.

```sh
npm ci
npm run db:start
npm run db:reset
npm test
```

`db:reset` usa **--local**: apaga somente o cenário local e reaplica migração/seed.
Testes usam `127.0.0.1:54322`, recusam URLs externas e simulam papéis SQL/claims.
Cada teste C1–C18 aparece no resultado; falha retorna exit code diferente de zero.
`npm run db:stop` encerra containers; dados locais permanecem nos volumes do CLI.

## Aplicação no projeto remoto de teste

Copie `.env.example` para `.env.remote` e configure credenciais **somente no servidor**.
Arquivo ignorado pelo Git; não use prefixos VITE_/NEXT_PUBLIC_ para senha, service_role ou secret key.

```sh
npm run db:inspect
npm run db:apply
npm run db:inspect
node --env-file=.env.remote scripts/demo-users.mjs
```

Aplicação exige projeto vazio, não sobrescreve tabelas/usuários existentes e grava
migração/seed/recibo na mesma transação. Reexecução com mesmo conteúdo não duplica
registros. Não executa reset remoto. Inspeção imprime somente estrutura/proteções.
Conexão PostgreSQL verifica CA e hostname; certificado público em `certs/`.
Fonte da CA: cadeia pública do endpoint, SHA-256 verificado contra fingerprint
publicado: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
[SSL Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement).

Seed cria contas sem senha utilizável. `demo-users.mjs` define senha aleatória
para oito contas sintéticas; valor fica somente em `.env.demo`, ignorado pelo Git.
Emails: owner/admin/billing/active/active2/expired/blocked/trial, todos `@example.com`.
Não enviar emails reais: confirmação é feita pela API administrativa.

## Matriz de acesso

| Recurso | Membro | Admin AAL2 | Owner/super_admin AAL2 | service_role |
| --- | --- | --- | --- | --- |
| profiles | Lê próprio; edita avatar/apelido próprios | Lê todos; edita avatar/apelido próprios | Igual admin | CRUD |
| user_roles | Lê próprios; sem escrita | Lê próprios; sem escrita | Lê todos; concede/remove | CRUD |
| modules | Ativo lê; trial lê 2; expirado/bloqueado não lê | CRUD | CRUD | CRUD |
| asaas_test_plans | Sem acesso | CRUD | CRUD | CRUD |
| additional_member_entitlements | Sem acesso | Sem acesso | Lê/atualiza | CRUD |
| module_credentials | Sem acesso direto | Sem acesso direto | Sem acesso direto | CRUD |
| asaas_payments | Sem acesso direto | Sem acesso direto | Sem acesso direto | CRUD |
| private.admin_audit_log | Sem acesso | Sem acesso | Sem acesso | CRUD |

`anon` não acessa nenhuma tabela. `billing_admin` não recebe poderes de owner/admin.
Privilégio administrativo exige papel persistido **e AAL2**; AAL1 não autoriza.
Owner também tem papel admin no seed. Para testar AAL2 por HTTP, inscreva e valide
MFA no Supabase Auth: alterar metadata não eleva AAL. Testes SQL cobrem ambos níveis,
mas não substituem sessão HTTP com MFA real.

Credenciais `MOCK_*`, documentos `DEMO-*`, emails `example.com` e pagamentos `mock_*`
são fictícios. Validade: ativos +30 dias, trial +1 dia, expirado -1 dia; reset renova
essas datas. Módulos trial são 2 de 4. Valores financeiros usam centavos inteiros.

## Proteções e limites

RLS explícita nas oito tabelas. Event trigger `demo_ensure_rls` ativa RLS em novas
tabelas de `public`/`private` criadas via CREATE TABLE, CREATE TABLE AS ou SELECT INTO.
Defaults revogam grants automáticos de cliente. RLS não cria políticas automaticamente:
novas tabelas permanecem fechadas até grants/políticas deliberados. Trigger não impede
owner do banco de desativar RLS manualmente. [Event triggers](https://supabase.com/docs/guides/database/postgres/event-triggers).

Audit registra ator, alvo e operação de roles/vagas, sem payload sensível. Backend
confiável pode administrar auditoria; log não é armazenamento imutável contra service_role.
Profile com pagamento não pode ser excluído; módulo exclui credenciais por cascata.
Helpers privilegiados usam search_path vazio e identidade atual, sem argumento de usuário.

Escopo: controles SQL deste recorte. Não replica frontend, CAPTCHA, cron, webhooks,
RPC de entrega de credenciais, rate limiting, trial onboarding, backups ou criptografia
em repouso por campo. `service_role` bypassa RLS por definição e precisa permanecer
no backend. Projeto de teste, sem alegação de equivalência operacional à produção.
Verificação tlc-spec-lean: perfil light, sem mutações adversariais obrigatórias.
