# Contributing

## Branching

- `main` — protected. Production.
- `dev`  — integration. Default base for PRs.
- `feat/<short-name>` — feature branches off `dev`.
- `fix/<short-name>`  — bugfix branches.

## Commit style

Conventional Commits, e.g. `feat(mobile): listing detail map polygon`.

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] `supabase db diff` shows expected migrations only
- [ ] No `pickup_point` or other private columns exposed in any new RPC/view
- [ ] Edge Functions: no service-role keys in client paths
- [ ] Updated relevant doc(s) under `docs/`
