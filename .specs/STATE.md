# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Dados e credenciais reais ficam fora do Git; seed exclusivamente sintético | Projeto de demonstração isolado | active | 2026-10-06 |
| AD-002 | Privilégio administrativo exige papel persistido e AAL2 | Referência Pacote de Ferramentas | active | 2026-10-06 |
| AD-003 | Novas tabelas public/private recebem RLS automaticamente; grants opt-in | Pedido explícito de RLS Automatic | active | 2026-10-06 |

## Handoff

**Feature**: supabase-production-demo
**Where**: C1-C18 revisados com PASS independente em 6544f1e; remoto criado e verificado (56 checks HTTP).
**Next step**: rodada 3 independente sobre prioridade de Secret Key e relatório remoto; nenhum deploy pendente.
**Blockers**: none; remoto aplicado, oito tabelas com RLS e RLS automático ativo.
**Branch**: main
