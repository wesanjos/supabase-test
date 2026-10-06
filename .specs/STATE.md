# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Dados e credenciais reais ficam fora do Git; seed exclusivamente sintético | Projeto de demonstração isolado | active | 2026-10-06 |
| AD-002 | Privilégio administrativo exige papel persistido e AAL2 | Referência Pacote de Ferramentas | active | 2026-10-06 |
| AD-003 | Novas tabelas public/private recebem RLS automaticamente; grants opt-in | Pedido explícito de RLS Automatic | active | 2026-10-06 |

## Handoff

**Feature**: supabase-production-demo
**Where**: C1-C18 passam localmente; perfil light.
**Next step**: verificação independente; aplicar no projeto remoto autorizado após PASS.
**Blockers**: none; conexão remota TLS verificada e projeto vazio confirmado.
**Branch**: main
