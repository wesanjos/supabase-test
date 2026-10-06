# Aplicação remota: PASS

Projeto: `xitazriytooyqetfjiki`.
Observado em 2026-10-06T23:46:48Z. Ação autorizada pelo usuário neste chat.
Migração: `20261007000100_demo_foundation`; aplicação SQL + seed + recibo atômicos.
Nenhum reset remoto. Reexecução de `npm run db:apply`: já aplicada, sem alterações.

## Estrutura publicada

| Tabela | Linhas | RLS |
| --- | --- | --- |
| profiles | 8 | true |
| user_roles | 5 | true |
| modules | 4 | true |
| module_credentials | 4 | true |
| asaas_test_plans | 2 | true |
| asaas_payments | 4 | true |
| additional_member_entitlements | 2 | true |
| private.admin_audit_log | 7 eventos iniciais | true |

`ensure_rls` existente preservado; `demo_ensure_rls` ativo. Probe CREATE TABLE
em public recebeu RLS e foi revertido por rollback; nenhuma tabela de probe permaneceu.
TLS verificou CA e hostname; nenhum valor de credencial foi registrado neste arquivo.

## Autorização publicada

Transações READ ONLY com sujeitos SQL distintos confirmaram:
- Member AAL1: 1 perfil, 0 planos internos.
- Admin/owner AAL1: 1 perfil, 0 planos internos.
- Admin/owner AAL2: 8 perfis, 2 planos internos.

Claims SQL são contexto simulado de autorização, não login HTTP com MFA.

API hospedada confirmou 56 verificações agrupadas:
- Anon: HTTP401 em sete tabelas públicas.
- Oito contas mockadas: login Auth por senha HTTP200, leitura somente do próprio perfil.
- Active/active2/admin/owner/billing: 4 módulos; expired/blocked: 0; trial: 2.
- Todas as sessões reais AAL1: zero planos internos; credenciais/pagamentos HTTP403.
- Backend com Secret Key atual: leitura de 4 pagamentos HTTP200.

Chaves JWT legadas fornecidas foram rejeitadas pela API como Invalid API key;
Secret Key e Publishable Key atuais funcionaram. Script prioriza Secret Key, com
fallback de service_role para ambientes locais/legados. Sem alteração de chaves.
Contas recebem senha aleatória guardada somente em `.env.demo`, ignorado pelo Git.
MFA real AAL2 não foi inscrito/testado por HTTP nesta execução.

Estas são evidências observadas pelo autor após aplicação; relatório independente
em verification.md cobre implementação e provas locais, perfil light.
