# Contributing

Thanks for considering a contribution! This is a small webapp-only plugin; the workflow is simple.

## Development setup

- Node.js 18+, Go (for the template's build tooling).
- Docker (with [colima](https://github.com/abiosoft/colima) on Apple Silicon) — only needed for the local test server, see below.

## Workflow

1. Make your changes in `webapp/src/`.
2. If you bump the version in `plugin.json`, always run `make apply` afterwards — it regenerates `webapp/src/manifest.ts` from the manifest.
3. Check style and types before building (the ESLint config is the strict mattermost one):

```bash
cd webapp
npx eslint src --ext .tsx,.ts
./node_modules/.bin/tsc --noEmit
```

4. Build the bundle:

```bash
make dist    # → dist/only-my-threads-<version>.tar.gz
```

5. Add an entry to `CHANGELOG.md` (new versions on top).
6. Commit (English commit messages) and open a pull request against `main`.

## Local test server

`local-server/` has a docker compose setup (PostgreSQL + Mattermost) with test data seeds:

```bash
cd local-server && docker compose up -d      # http://localhost:8065
```

Test accounts: `anton` / `ilya` / `sasha`, password `Passw0rd123!`. Install a freshly built bundle with:

```bash
docker cp dist/only-my-threads-<v>.tar.gz local-server-app-1:/tmp/omt.tar.gz
docker exec local-server-app-1 mmctl --local plugin add /tmp/omt.tar.gz --force
```

## Releases

Pushing to `main` runs CI (lint/test/build) on every push — that's fine. Tags `v*` trigger a workflow that publishes a GitHub release with the bundle; **tags are cut by the maintainer only, please don't push them from PRs.**

## Agent notes

If you are an AI agent working on this repository, read `AGENTS.md` first — it lists the critical gotchas (RHS component registration, `SELECT_POST` vs `UPDATE_RHS_STATE`, the virtual-list resize nudge, hover toolbar focus rules, CSRF pitfalls and more).
