// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The plugin reducer is registered under this key in the host store.
export const PLUGIN_STATE_KEY = 'plugins-only-my-threads';

// Small delay before the month fetch, which also debounces bursts of
// "posted" websocket events.
export const REFRESH_DELAY_MS = 400;

// The host thread view's virtual list sometimes measures its container as
// zero-sized right after the panel swap and renders empty. Resize nudges at
// these delays force the re-measure.
export const THREAD_OPEN_RESIZE_DELAYS_MS = [50, 300];

// The search backend (DB and Bleve alike on v11) never returns more
// than ~100 matches and reports no further pages even when more exist,
// silently dropping everything older than the newest 100. Month data is
// therefore fetched in day-granularity windows: when a window saturates,
// its end moves to the day of the oldest fetched post and the rest of the
// month continues from there.
export const SEARCH_LIMIT = 100;

// Some v11 backends (observed on Bleve-backed installs) truncate the
// result one short of the requested per_page, so saturation is detected
// with a one-post margin: a month genuinely holding 99 posts only costs a
// couple of extra day-window requests, all deduplicated.
export const SEARCH_SATURATION_MIN = SEARCH_LIMIT - 1;
export const MAX_SEARCH_HOPS = 40;
export const DAY_MS = 24 * 60 * 60 * 1000;

// POST /posts/ids is capped server-side; larger root lists go in chunks.
export const POST_BATCH = 200;

// Fallback scan parameters for servers without search.
export const CHANNEL_SCAN_WINDOW = 1000;
export const CHANNEL_SCAN_PAGE_SIZE = 100;

// When paging to older months, silently skip up to this many empty months.
export const MAX_EMPTY_MONTHS = 24;
