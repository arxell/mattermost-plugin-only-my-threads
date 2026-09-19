# AGENTS.md — guide for agents making changes to this repository

> **This file must stay in English.** All repository documentation (README, CHANGELOG, AGENTS.md) and commit messages are English; the plugin's user-facing strings are localized RU/EN in `webapp/src/i18n/messages.ts`.

**Only My Threads** is a Mattermost plugin: an RHS panel listing the threads of the current channel that were started by the current user. Webapp-only (no server part since 0.4.x). Owner — Anton (GitHub `arxell`).

## Layout

- `webapp/src/components/rhs.tsx` — the panel: states, month pagination, list, hover toolbar, thread opening, jump to post.
- `docs/api.md` — every Mattermost API the plugin calls, with the v11.9 semantics and limits verified from the server source (search cap, date-qualifier exclusions, reaction payload shape, per_page clamp). Read before touching the data layer.
- `webapp/src/utils/threads.ts` — data: month search (`searchPostsWithParams`, pages of 100, up to 10 pages), `getUserThread` for reply counts, channel stream fallback scan.
- `webapp/src/i18n/messages.ts` — the localization dictionaries (en, ru, fr, de). Keys are `panel.*`; **dictionaries must stay symmetric across all locales** (a unit test enforces this and placeholder parity); any other locale falls back to EN.
- `webapp/src/index.tsx` — registration: App Bar button, RHS component, reducer, `posted` websocket handler.
- `plugin.json` — version and metadata (homepage/support/release_notes URLs are required by CI).
- `.github/workflows/ci.yml` — mattermost plugin-ci + a release job on `v*` tags.
- `local-server/` — docker compose (postgres + mattermost, amd64 via colima) and test data seeds.

## Development loop

```bash
# 1) edit code in webapp/src/*
# 2) version: bump "version" in plugin.json, then ALWAYS:
make apply          # regenerates webapp/src/manifest.ts from plugin.json
# 3) checks (eslint is strict, mattermost config):
cd webapp && npx eslint src --ext .tsx,.ts && ./node_modules/.bin/tsc --noEmit
# 4) build:
make dist           # → dist/only-my-threads-<version>.tar.gz
```

Install on the local server (docker):

```bash
docker cp dist/only-my-threads-<v>.tar.gz local-server-app-1:/tmp/omt.tar.gz
docker exec local-server-app-1 mmctl --local plugin add /tmp/omt.tar.gz --force
```

Local server test accounts: `anton` / `ilya` / `sasha`, password `Passw0rd123!`.

## Publishing

- **Every change lands via a separate PR from `main`** (branch off `origin/main`), and every PR records its changes in `CHANGELOG.md`. Direct pushes of feature work to `main` are no longer done (user decision, 2026-09-17).
- CI runs on every push and pull request (lint/test/build — that is fine).
- **Tags `v*` and releases — only on the user's explicit request.** Pushing a tag triggers the release job which publishes a GitHub release; the user once asked to revert an unsolicited release.
- Keep the version history in `CHANGELOG.md` (new versions on top).

## Critical gotchas (learned the hard way)

1. **RHS component**: `registerRightHandSidebarComponent` takes the component TYPE, not a JSX element — otherwise React #130 and the whole app unmounts.
2. **Opening a thread**: dispatch the raw action `{type: 'SELECT_POST', postId, channelId, timestamp}`. Do NOT use `UPDATE_RHS_STATE` — it clears `selectedPostId`. Dispatch `receivedPosts` before it, and preload `getPostThread` → `receivedPostsInThread` after.
3. **Host virtual list race**: right after `SELECT_POST` the thread's virtual list sometimes measures its container as zero-sized and renders an empty thread. `openThread` already dispatches `window.dispatchEvent(new Event('resize'))` with 50/300 ms delays — do not remove that.
4. **Hover toolbar** (`.omt-toolbar`, styles injected via a `<style>` tag with the `omt-` prefix): inline styles cannot express `:hover`. The toolbar buttons MUST have `onMouseDown={(e) => e.preventDefault()}` — focus on an element removed when the panel unmounts breaks the virtual list sizing (empty thread). The Reply button does NOT call `stopPropagation`: its click bubbles to the row, which opens the thread. Only the Jump button has `stopPropagation`.
5. **The toolbar is invisible without hover**: `visibility: hidden` is skipped by hit-testing — a synthetic `.click()` on the button without a real hover passes through. In browser tests, `hover` the row first, then click.
6. **CSRF**: any in-page POST (e.g. a login) without the `X-CSRF-Token` header from the `MMCSRFTOKEN` cookie returns 401 AND revokes the current session (you will have to log in again). GET with the `X-Requested-With: XMLHttpRequest` header is safe.
7. **Search**: the backend caps results at ~100 matches and lies about further pages (page 1 comes back empty even when more exist). Never rely on `page`. The date qualifiers both EXCLUDE their own days (UTC): `after:D before:D+1` matches nothing; a single day is addressed by `after:D-1 before:D+1`. When a window saturates, re-fetch the oldest fetched day bracketed like that, then continue the month with `before:{that day}` (`fetchMonthThreads` does this).
8. **Search term for a private channel**: `in:~name` (tilde prefix); public — `in:name`.
9. **The App Bar** renders plugin icons on white plates — the icon must be colored (not `currentColor`).
10. **The mattermost eslint config** requires: a comment before an attribute on its own line (easier to put the comment above the element), one prop per line when >2, single-line ternaries. Run lint before building.

## User decisions that must not be violated

- No global limits (like 12000 threads) and no caches — only month pagination with the "Show more" button (empty months are skipped, up to 24 in a row).
- Behavior must be as native as possible, like the host's Saved Messages.
- Design: compact spacing; an item shows the message text, with the date bottom-left and the reply count (💬 N / ⏳ for awaiting-reply) bottom-right.
- The Jump button must keep using the stock permalink mechanics; the "view scrolls away after jump" glitch on v11.9 is a Mattermost bug (fixed upstream in 11.10/11.11), not the plugin's.
- README, CHANGELOG, AGENTS.md and commit messages are English; the plugin's user-facing strings are localized in EN/RU/FR/DE (`webapp/src/i18n/messages.ts`).
