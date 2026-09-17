# Changelog

All notable changes to the Only My Threads plugin. The format follows [Keep a Changelog](https://keepachangelog.com/en/); versions match `plugin.json`. Built releases live on the [GitHub Releases](https://github.com/arxell/mattermost-plugin-only-my-threads/releases) page.

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
