# Changelog

All notable changes to the Only My Threads plugin. The format follows [Keep a Changelog](https://keepachangelog.com/en/); versions match `plugin.json`. Built releases live on the [GitHub Releases](https://github.com/arxell/mattermost-plugin-only-my-threads/releases) page.

## [0.13.5] — 2026-09-17

- New: each thread row in the panel now shows both dates — "Created {date}" and, when the thread has replies, "Last reply {date}" (localized in EN/RU/FR/DE). Unreplied threads keep showing only the creation date, as before. The data comes from the thread-detail request the panel already makes (`last_reply_at`); no new requests are added. In the no-search fallback the date is computed from the scanned posts. Sorting stays by the creation date.

## [0.13.4] — 2026-09-17

- Fixed: month pagination continued from the number of loaded pages instead of the calendar month where the previous page's data was found. With empty months in between, every "Show more" click rescanned the already-skipped empty months (extra search requests) and the button labeled the wrong month. Pagination now keeps a cursor on the actual oldest loaded month: the next click scans from there, and the button names the month it will really read first.

## [0.13.3] — 2026-09-17

- Fixed: reaction chips did not update live — the host sends the reaction inside the `reaction_added`/`reaction_removed` websocket events as a JSON string, which the handler did not parse, so no chip refresh was ever dispatched (live updates effectively never worked; toggling from the panel masked it by refetching directly).
- Fixed: the panel refresh button left stale reaction chips for threads whose reactions were last toggled from the panel — the per-post overrides now reset whenever the current month is refetched, so the refresh converges to the server state exactly like reopening the panel.

## [0.13.2] — 2026-09-17

- Changed: the panel sorts threads by the root post creation date and shows that date. Previously both the order and the displayed date were the thread's last activity, so a new reply lifted an older thread to the top of its month.

## [0.13.1] — 2026-09-17

- Fixed: reaction chips for emoji outside the built-in picker set rendered as `:name:` text. Any other reaction name now resolves to its server image — a custom emoji by id, a system emoji through a vendored name→file dictionary (from the host webapp's emoji.json, v11.9.0) — and is cached for the session; the picker set still renders as native unicode instantly. A broken image falls back to the text form.

## [0.13.0] — 2026-09-17

- Reactions in the panel: each thread row shows the reactions of its root post as chips (emoji + count, highlighted when yours). Clicking a chip toggles your reaction; a "+" chip and a smiley button in the hover toolbar open a picker with frequently used emoji. Reaction chips update live via the `reaction_added`/`reaction_removed` websocket events. Empty reaction lists (the server returns `null`) are handled safely.
- New App Bar icon: three stacked message cards with a checkmark in brand blue (inline SVG, crisp at any scale).

## [0.12.0] — 2026-09-17

- Added French and German localization. The plugin now ships EN, RU, FR and DE dictionaries; the locale follows the account language, everything else still falls back to English. The dictionary symmetry unit test now checks every locale.
- More unit tests (40 total): the plugin registration contract (the RHS component must be a component type — the React #130 guard — plus the header button, reducer and `posted` websocket wiring), `translate()` fallbacks and interpolation, multi-page and window-capped fallback scanning, and mixed fulfilled/missing thread details with activity ordering.

## [0.11.5] — 2026-09-17

- Added unit tests (25 total): search query building (`in:`/`in:~` privacy prefix, `from/after/before`), search paging (stops on a short page, 10-page cap), root/delete filtering and deduplication, `getUserThread` mapping incl. the missing-thread awaiting case, empty-month skipping and the 24-month cap, the channel-stream fallback, snippet rendering, the `posted` reducer (extracted into `reducer.ts`), and RU/EN dictionary symmetry with placeholder parity.
- CI measures jest coverage on pushes to `main` and publishes a coverage badge (shields.io endpoint fed from the `coverage-badge` branch).
- Repository presentation: hero screenshot, "Download Latest Release" and coverage badges, Key Features and Quick Start sections, a Development guide with the local test server, CONTRIBUTING.md, a bug report issue template, and an English AGENTS.md for AI agents. README and CHANGELOG switched to English.

## [0.11.4] — 2026-09-16

- Tightened vertical spacing: the channel name block (padding 12→6px) and the distance between the list's separator lines (row height 61→52px).
- Release built and published on GitHub (tag `v0.11.4`).

## [0.11.3] — 2026-09-16

- Refresh button: the "⟳" character replaced with the circular-arrows icon from [mattermost/compass-icons](https://github.com/mattermost/compass-icons) (`refresh_F0450`), themed color.

## [0.11.2] — 2026-09-16

- Unreplied messages keep only the ⏳ icon in the row corner (the "Awaiting reply" text moved into the hover tooltip).

## [0.11.1] — 2026-09-16

- Dropped the save-to-Saved-Messages button from the hover toolbar (back to the Reply/Jump pair).

## [0.11.0] — 2026-09-16

- Single panel title: the "My threads in this channel" line remains only in the RHS header; inside the panel — the channel name and thread count in large type.
- Added a bookmark button to save a thread's root post to Saved Messages (removed later in 0.11.1).
- The reply count badge (💬 N) returned to the row's bottom-right corner; threads without replies get ⏳.
- Fixed a flaky bug: right after opening a thread from the panel, the host's virtual list sometimes measured its container as zero-sized and rendered an empty thread — a `window.resize` nudge is now dispatched to force a re-measure.

## [0.10.0] — 2026-09-16

- Saved Messages style hover toolbar: hovering a row reveals Reply (opens the thread in the RHS) and Jump (permalink navigation to the post in the channel) buttons.
- Removed the former inline row elements: the reply-count badge on the left and the ↗ button on the right.
- The toolbar buttons do not take focus on mousedown: focus on an element removed on unmount broke the host virtual list's measurements (empty thread).

## [0.9.3] — 2026-09-16

- Tightened list spacing: the meta row is no longer stretched to 40px by the ↗ button (the button got an explicit 20px height), the row's bottom padding 10→4px; row height 87→61px, the gap between the counter and the separator is 5px.

## [0.9.2] — 2026-09-16

- Larger message text font in rows: 13→15px.

## [0.9.1] — 2026-09-16

- The message text now sits above the reply-count row (the icon and date are at the bottom).

## [0.9.0] — 2026-09-16

- Fixed messages missing from the panel on busy channels: the server returns a single search page (~60 posts), so some posts never made it into the list. The search is now paginated (`searchPostsWithParams`, 100/page, up to 10 pages).
- First release built on GitHub (tag `v0.9.0`, CI `plugin-ci` + release job).

## [0.8.1] — 2026-09-16

- Fixed month duplication: double-click protection on "Show more" (a synchronous `useRef` guard) and deduplication by post id on append.
- The websocket auto-refresh (`posted`) no longer resets already loaded older months — only the current month is replaced.
- First publication of the sources on GitHub, CI (lint/test/build) and automatic releases on `v*` tags.

## Early history (0.1.0 – 0.7.2, reconstructed from the development log)

- **0.1.x** — first version: client-side scan of the channel stream, an RHS panel, a channel header/App Bar button; fixed a whole-app crash on panel open (React #130 — a JSX element was registered instead of the component type).
- **0.2.x** — the icon: instead of a "gray blob", a colored message card (#166de0) — the App Bar renders plugin icons on white plates.
- **0.3.x** — a Go server part with scan-depth settings in the System Console (abandoned later).
- **0.4.x – 0.5.x** — switched to the Threads API (`getUserThread`) instead of the stream scan: server-side reply counts, per-thread requests; the server part was removed, the plugin became webapp-only. Added awaiting-reply messages (⏳) — the panel's purpose: see where you are waiting for an answer. Clicking a row opens the thread in the RHS with a reply composer, like Saved Messages; ↗ jumps to the post in the channel.
- **0.6.x – 0.7.0** — month-based pagination via server-side search (`from/in/after/before`), the "Show more: {month}" button, RU/EN localization.
- **0.7.1** — the "Show more" button is available even when the current month is empty.
- **0.7.2** — skipping empty months (up to 24 in a row) and the "No more of your messages found" note.
