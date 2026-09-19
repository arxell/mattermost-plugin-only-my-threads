// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';
import type {Reaction} from '@mattermost/types/reactions';

import {Client4} from 'mattermost-redux/client';

export interface MyThread {
    id: string;
    channelId: string;
    message: string;
    createAt: number;
    replyCount: number;
    reactions: ReactionSummary[];

    // True when the root post has no replies yet ("waiting for an answer").
    awaitingReply: boolean;

    // The raw root post, reused to put it into the host store before
    // opening the thread in the right-hand sidebar.
    post: Post;
}

// Reactions of a root post grouped for the panel chips.
export interface ReactionSummary {
    emojiName: string;
    count: number;
    mine: boolean;
}

export function aggregateReactions(reactions: Reaction[] | null | undefined, userId: string): ReactionSummary[] {
    const byName = new Map<string, ReactionSummary>();
    for (const reaction of reactions ?? []) {
        // Defensive: some servers include removed reactions with a set
        // delete_at, which the typed model does not declare.
        if ((reaction as {delete_at?: number}).delete_at) {
            continue;
        }
        const summary = byName.get(reaction.emoji_name) ?? {emojiName: reaction.emoji_name, count: 0, mine: false};
        summary.count++;
        if (reaction.user_id === userId) {
            summary.mine = true;
        }
        byName.set(reaction.emoji_name, summary);
    }
    return [...byName.values()].sort((a, b) => b.count - a.count || a.emojiName.localeCompare(b.emojiName));
}

// Context needed to find the user's posts via server-side search.
export interface SearchContext {
    channelName: string;
    isPrivateChannel: boolean;
    username: string;
}

// Fallback scan parameters for servers without search.
const FALLBACK_SCAN_WINDOW = 1000;
const FALLBACK_PAGE_SIZE = 100;

// When paging to older months, silently skip up to this many empty months.
const MAX_EMPTY_MONTHS_TO_SKIP = 24;

// The search backend (DB and Bleve alike on v11) never returns more
// than ~100 matches and reports no further pages even when more exist,
// silently dropping everything older than the newest 100. Month data is
// therefore fetched in day-granularity windows: when a window saturates,
// its end moves to the day of the oldest fetched post and the rest of
// the month continues from there.
const SEARCH_WINDOW_CAP = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

// Some v11 backends (observed on Bleve-backed installs) truncate the
// result one short of the requested per_page, so saturation is detected
// with a one-post margin: a month genuinely holding 99 posts only costs
// a couple of extra day-window requests, all deduplicated.
const SEARCH_SATURATION_MIN = SEARCH_WINDOW_CAP - 1;
const MAX_SEARCH_HOPS = 40;

function dateOnly(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// POST /posts/ids is capped server-side; larger root lists go in chunks.
const BATCH_POSTS_SIZE = 200;

function sortThreads(threads: MyThread[]): MyThread[] {
    threads.sort((a, b) => b.createAt - a.createAt);
    return threads;
}

function monthBounds(monthsBack: number): {after: string; before: string} {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - monthsBack);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    // The search's after: qualifier excludes its own day (it is resolved
    // to the start of the NEXT day server-side), so a month window must
    // start one day earlier to include the 1st of the month.
    const afterStart = new Date(start);
    afterStart.setDate(afterStart.getDate() - 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {after: fmt(afterStart), before: fmt(end)};
}

// The user's own root posts for one month, with reply counts, last-reply
// dates and reactions. Month pagination is server-side: the search request
// is bounded by after:/before: dates, so the cost never depends on channel
// volume. Reply counts and reactions for every root come from a single
// batch request (POST /posts/ids) instead of two requests per thread.
async function fetchMonthThreads(userId: string, teamId: string, ctx: SearchContext, monthsBack: number): Promise<MyThread[]> {
    const {after} = monthBounds(monthsBack);
    const channelTerm = (ctx.isPrivateChannel ? '~' : '') + ctx.channelName;

    // Windowed fetching instead of server paging: a saturated window
    // (exactly SEARCH_WINDOW_CAP results) means the backend truncated the
    // older matches. The oldest fetched day D is re-fetched as its own day
    // window first (before: would exclude D entirely, eating D's tail),
    // then the month continues with before:D. Day granularity: a single
    // day holding more than CAP of the user's posts stays truncated
    // (documented limitation).
    const collected = new Map<string, Post>();
    const searchWindow = async (windowAfter: string, windowBefore: string): Promise<Post[]> => {
        const terms = `in:${channelTerm} from:${ctx.username} after:${windowAfter} before:${windowBefore}`;
        const results = await Client4.searchPostsWithParams(teamId, {
            terms,
            is_or_search: false,
            page: 0,
            per_page: SEARCH_WINDOW_CAP,
        } as never);
        return (results.order).
            map((id: string) => (results.posts ? results.posts[id] : undefined)).
            filter((post?: Post) => Boolean(post)) as Post[];
    };
    const merge = (posts: Post[]) => {
        for (const post of posts) {
            if (!collected.has(post.id)) {
                collected.set(post.id, post);
            }
        }
    };

    let windowEnd = monthBounds(monthsBack).before;
    for (let hop = 0; hop < MAX_SEARCH_HOPS; hop++) {
        // Windows are sequential by nature: each depends on the previous
        // one's oldest post.
        // eslint-disable-next-line no-await-in-loop
        const posts = await searchWindow(after, windowEnd);
        merge(posts);
        if (posts.length < SEARCH_SATURATION_MIN) {
            break;
        }
        const oldest = Math.min(...posts.map((post: Post) => post.create_at));
        const oldestDay = dateOnly(oldest);
        const dayAfter = dateOnly(oldest + DAY_MS);
        const dayBefore = dateOnly(oldest - DAY_MS);
        if (dayAfter < windowEnd) {
            // Complete the saturated day on its own before leaving it. The
            // date qualifiers both exclude their own days (UTC), so a day
            // is addressed by the window around it: after:D-1 before:D+1.
            // eslint-disable-next-line no-await-in-loop
            merge(await searchWindow(dayBefore, dayAfter));
        }
        if (oldestDay >= windowEnd) {
            break; // no progress possible at day granularity
        }
        windowEnd = oldestDay;
    }

    const roots = [...collected.values()].filter((post) => post.root_id === '' && !post.delete_at);

    // One batch request carries the authoritative reply counts and the
    // reactions of every root; chunked because the server caps the id list.
    const batched = new Map<string, Post>();
    for (let i = 0; i < roots.length; i += BATCH_POSTS_SIZE) {
        const chunk = roots.slice(i, i + BATCH_POSTS_SIZE).map((root) => root.id);

        // Chunks are small and independent; a failed one only costs its own
        // threads' counts (they fall back to the search-derived data).
        // eslint-disable-next-line no-await-in-loop
        const posts = await Client4.getPostsByIds(chunk).catch(() => [] as Post[]);
        for (const post of posts) {
            batched.set(post.id, post);
        }
    }

    return sortThreads(roots.map((root) => {
        const batch = batched.get(root.id);
        const reactions = aggregateReactions(batch?.metadata?.reactions ?? [], userId);
        const replyCount = batch?.reply_count ?? 0;
        return {
            id: root.id,
            channelId: root.channel_id,
            message: root.message,
            createAt: root.create_at,
            replyCount,
            reactions,
            awaitingReply: replyCount === 0,
            post: root,
        };
    }));
}

// Current month with fallback: if search is unavailable, scan the channel
// post stream once (includes unreplied roots).
export async function fetchCurrentMonth(userId: string, teamId: string, channelId: string, ctx: SearchContext): Promise<MyThread[]> {
    try {
        return await fetchMonthThreads(userId, teamId, ctx, 0);
    } catch (e) {
        return fetchAllByScan(channelId, userId);
    }
}

// A month page returned to the panel: the threads plus the actual
// calendar month they were found in (which may be further back than the
// start when empty months were skipped). The panel continues pagination
// from that month, so it never rescans the skipped months again and the
// "Show more" label matches the real data.
export interface OlderMonthPage {
    threads: MyThread[];
    monthsBack: number;
}

// Pages one month further back, skipping up to MAX_EMPTY_MONTHS_TO_SKIP
// empty months. Resolves to null when there is nothing more to show.
export async function fetchOlderMonth(userId: string, teamId: string, ctx: SearchContext, startMonthsBack: number): Promise<OlderMonthPage | null> {
    for (let back = startMonthsBack; back < startMonthsBack + MAX_EMPTY_MONTHS_TO_SKIP; back++) {
        // Sequential by nature: each month is only fetched when needed.
        // eslint-disable-next-line no-await-in-loop
        const threads = await fetchMonthThreads(userId, teamId, ctx, back);
        if (threads.length > 0) {
            return {threads, monthsBack: back};
        }
    }
    return null;
}

// Fallback for servers without search: page through the channel post
// stream and count replies client-side. Includes unreplied roots.
async function fetchAllByScan(channelId: string, userId: string): Promise<MyThread[]> {
    const posts = new Map<string, Post>();
    let scanned = 0;

    for (let page = 0; scanned < FALLBACK_SCAN_WINDOW; page++) {
        // Pages must be fetched sequentially to stop as soon as the channel end is reached.
        // eslint-disable-next-line no-await-in-loop
        const list = await Client4.getPosts(channelId, page, FALLBACK_PAGE_SIZE);
        for (const id of list.order) {
            const post = list.posts ? list.posts[id] : undefined;
            if (post) {
                posts.set(id, post);
            }
        }
        scanned += list.order.length;
        if (list.order.length < FALLBACK_PAGE_SIZE) {
            break;
        }
    }

    const replyCountByRoot = new Map<string, number>();
    for (const post of posts.values()) {
        if (post.root_id && !post.delete_at) {
            replyCountByRoot.set(
                post.root_id,
                (replyCountByRoot.get(post.root_id) ?? 0) + 1,
            );
        }
    }

    const threads: MyThread[] = [];
    for (const post of posts.values()) {
        if (post.root_id || post.delete_at || post.user_id !== userId) {
            continue;
        }

        // The server may not maintain post.reply_count in the channel feed,
        // so count replies from the fetched posts ourselves.
        const replyCount = Math.max(replyCountByRoot.get(post.id) ?? 0, post.reply_count ?? 0);
        threads.push({
            id: post.id,
            channelId: post.channel_id,
            message: post.message,
            createAt: post.create_at,
            replyCount,
            reactions: [],
            awaitingReply: replyCount === 0,
            post,
        });
    }

    return sortThreads(threads);
}

// Turns raw markdown message text into a short one-line snippet.
export interface SnippetOptions {
    codeLabel?: string;
    imageLabel?: string;
    maxLength?: number;
}

export function messageToSnippet(message: string, options: SnippetOptions = {}): string {
    const {codeLabel = '[code]', imageLabel = '[image]', maxLength = 120} = options;
    const cleaned = message.
        replace(/```[\s\S]*?```/g, ` ${codeLabel} `).
        replace(/`([^`]*)`/g, '$1').
        replace(/!\[[^\]]*\]\([^)]*\)/g, ` ${imageLabel} `).
        replace(/\[[^\]]*\]\(([^)]*)\)/g, '$1').
        replace(/[*_~]+/g, '').
        replace(/^>\s*/gm, '').
        replace(/\s+/g, ' ').
        trim();

    if (cleaned.length <= maxLength) {
        return cleaned;
    }
    return cleaned.slice(0, maxLength - 1).trimEnd() + '…';
}
