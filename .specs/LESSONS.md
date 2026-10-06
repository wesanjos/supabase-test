# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Provas de auditoria devem ligar cada operação à entidade, ator, alvo e instante nos eventos novos, não buscar operação em histórico inteiro.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `database` · harmful: 0
- features: supabase-production-demo
- evidence: .specs/features/supabase-production-demo/verification.md:C15 (database)
- last seen: 2026-10-06T23:43:17Z

### L-002 - Reprodutibilidade exige executar reset e reexecutar provas; verificar string do comando não prova execução.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `database` · harmful: 0
- features: supabase-production-demo
- evidence: .specs/features/supabase-production-demo/verification.md:C17 (database)
- last seen: 2026-10-06T23:43:17Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
