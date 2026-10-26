// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    CHANNEL_SCAN_PAGE_SIZE,
    CHANNEL_SCAN_WINDOW,
    DAY_MS,
    MAX_EMPTY_MONTHS,
    MAX_SEARCH_HOPS,
    POST_BATCH,
    SEARCH_LIMIT,
    SEARCH_SATURATION_MIN,
} from 'constants';

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

// A person whose threads the list shows.
export interface ThreadPerson {
    id: string;
    username: string;
}

// Context needed to find the people's posts via server-side search.
export interface SearchContext {
    channelName: string;
    isPrivateChannel: boolean;

    // At least one person; the list is the union over all of them.
    people: ThreadPerson[];

    // The two combinable sources of the list: the roots the people started
    // (on unless set to false) and the threads where another member's post
    // (root or reply) mentions one of them.
    includeOwn?: boolean;
    includeMentions?: boolean;
}

// The post mentions one of the people other than its own author.
function mentionsSomeone(post: Post, people: ThreadPerson[]): boolean {
    return people.some((person) => person.id !== post.user_id && mentionsUser(post.message, person.username));
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches an explicit @username mention the way the host highlights it:
// not glued to a preceding word (emails) and not a prefix of a longer
// username — a trailing sentence dot still counts ("thanks @anton.").
export function mentionsUser(message: string, username: string): boolean {
    if (!username) {
        return false;
    }
    const pattern = new RegExp(`(^|[^\\w.@-])@${escapeRegExp(username)}(?![\\w-]|\\.[\\w-])`, 'i');
    return pattern.test(message);
}

// The numeric limits (SEARCH_LIMIT, SEARCH_SATURATION_MIN, MAX_SEARCH_HOPS,
// POST_BATCH, CHANNEL_SCAN_*, MAX_EMPTY_MONTHS, DAY_MS) live in constants.ts;
// their rationale comments moved there with them.

function dateOnly(ms: number): string {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

// Every post of one month in the channel matching the filter terms
// (`from:a from:b` or `@a @b`). Several from: flags are OR-ed by the server
// itself; text terms are OR-ed only with isOrSearch, which leaves the
// in:/from:/date filters AND-ed. Month pagination is server-side: the
// search request is bounded by after:/before: dates, so the cost never
// depends on channel volume.
async function searchMonthPosts(teamId: string, ctx: SearchContext, monthsBack: number, filterTerm: string, isOrSearch = false): Promise<Post[]> {
    const {after} = monthBounds(monthsBack);
    const channelTerm = (ctx.isPrivateChannel ? '~' : '') + ctx.channelName;

    // Windowed fetching instead of server paging: a saturated window
    // (exactly SEARCH_LIMIT results) means the backend truncated the
    // older matches. The oldest fetched day D is re-fetched as its own day
    // window first (before: would exclude D entirely, eating D's tail),
    // then the month continues with before:D. Day granularity: a single
    // day holding more than CAP of the user's posts stays truncated
    // (documented limitation).
    const collected = new Map<string, Post>();
    const searchWindow = async (windowAfter: string, windowBefore: string): Promise<Post[]> => {
        const terms = `in:${channelTerm} ${filterTerm} after:${windowAfter} before:${windowBefore}`;
        const results = await Client4.searchPostsWithParams(teamId, {
            terms,
            is_or_search: isOrSearch,
            page: 0,
            per_page: SEARCH_LIMIT,
        });
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

    return [...collected.values()].filter((post) => !post.delete_at);
}

// The people's threads for one month, with reply counts and reactions:
// the roots they started and/or the threads where a post of this month
// mentions one of them. Reply counts and reactions for every root come
// from a single batch request (POST /posts/ids) instead of two requests
// per thread. userId is the viewer, whose reactions the chips mark.
async function fetchMonthThreads(userId: string, teamId: string, ctx: SearchContext, monthsBack: number): Promise<MyThread[]> {
    const noPosts = Promise.resolve([] as Post[]);
    const fromTerms = ctx.people.map((person) => `from:${person.username}`).join(' ');
    const mentionTerms = ctx.people.map((person) => `@${person.username}`).join(' ');
    const [own, mentioning] = await Promise.all([
        ctx.includeOwn === false ? noPosts : searchMonthPosts(teamId, ctx, monthsBack, fromTerms),
        ctx.includeMentions ? searchMonthPosts(teamId, ctx, monthsBack, mentionTerms, ctx.people.length > 1) : noPosts,
    ]);

    // Root posts already at hand, and when each thread got into this
    // month's list (its creation, or the newest mention).
    const rootsById = new Map<string, Post>();
    const activityAt = new Map<string, number>();
    for (const post of own) {
        if (post.root_id === '') {
            rootsById.set(post.id, post);
            activityAt.set(post.id, post.create_at);
        }
    }

    // The search drops the "@" and matches the bare word, so the explicit
    // mention is re-checked here; mentioning oneself does not count. A
    // mention in a reply brings in its root, which is fetched by the batch
    // request below.
    for (const post of mentioning) {
        if (!mentionsSomeone(post, ctx.people)) {
            continue;
        }
        const rootId = post.root_id || post.id;
        if (!post.root_id && !rootsById.has(post.id)) {
            rootsById.set(post.id, post);
        }
        activityAt.set(rootId, Math.max(activityAt.get(rootId) ?? 0, post.create_at));
    }

    const threadIds = [...activityAt.keys()];

    // One batch request carries the authoritative reply counts and the
    // reactions of every root; chunked because the server caps the id list.
    const batched = new Map<string, Post>();
    for (let i = 0; i < threadIds.length; i += POST_BATCH) {
        const chunk = threadIds.slice(i, i + POST_BATCH);

        // Chunks are small and independent; a failed one only costs its own
        // threads' counts (they fall back to the search-derived data).
        // eslint-disable-next-line no-await-in-loop
        const posts = await Client4.getPostsByIds(chunk).catch(() => [] as Post[]);
        for (const post of posts) {
            batched.set(post.id, post);
        }
    }

    const threads: MyThread[] = [];
    for (const id of threadIds) {
        const batch = batched.get(id);

        // A root known only from a reply's mention exists here solely via
        // the batch; without it (failed chunk, deleted root) it is skipped.
        const root = rootsById.get(id) ?? batch;
        if (!root || root.root_id || root.delete_at) {
            continue;
        }
        const reactions = aggregateReactions(batch?.metadata?.reactions ?? [], userId);
        const replyCount = batch?.reply_count ?? 0;
        threads.push({
            id: root.id,
            channelId: root.channel_id,
            message: root.message,
            createAt: root.create_at,
            replyCount,
            reactions,
            awaitingReply: replyCount === 0,
            post: root,
        });
    }

    // Newest activity first: the creation date for own roots (an own-only
    // list keeps its creation order), the newest mention if later.
    return threads.sort((a, b) => (activityAt.get(b.id) ?? 0) - (activityAt.get(a.id) ?? 0));
}

// Current month with fallback: if search is unavailable, scan the channel
// post stream once (includes unreplied roots).
export async function fetchCurrentMonth(userId: string, teamId: string, channelId: string, ctx: SearchContext): Promise<MyThread[]> {
    try {
        return await fetchMonthThreads(userId, teamId, ctx, 0);
    } catch (e) {
        return fetchAllByScan(channelId, ctx);
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

// Pages one month further back, skipping up to MAX_EMPTY_MONTHS
// empty months. Resolves to null when there is nothing more to show.
export async function fetchOlderMonth(userId: string, teamId: string, ctx: SearchContext, startMonthsBack: number): Promise<OlderMonthPage | null> {
    for (let back = startMonthsBack; back < startMonthsBack + MAX_EMPTY_MONTHS; back++) {
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
// stream and count replies client-side. Includes unreplied roots; the
// includeOwn/includeMentions sources apply to the scanned threads.
async function fetchAllByScan(channelId: string, ctx: SearchContext): Promise<MyThread[]> {
    const posts = new Map<string, Post>();
    let scanned = 0;

    for (let page = 0; scanned < CHANNEL_SCAN_WINDOW; page++) {
        // Pages must be fetched sequentially to stop as soon as the channel end is reached.
        // eslint-disable-next-line no-await-in-loop
        const list = await Client4.getPosts(channelId, page, CHANNEL_SCAN_PAGE_SIZE);
        for (const id of list.order) {
            const post = list.posts ? list.posts[id] : undefined;
            if (post) {
                posts.set(id, post);
            }
        }
        scanned += list.order.length;
        if (list.order.length < CHANNEL_SCAN_PAGE_SIZE) {
            break;
        }
    }

    const replyCountByRoot = new Map<string, number>();
    const mentionedRoots = new Set<string>();
    for (const post of posts.values()) {
        if (post.delete_at) {
            continue;
        }
        if (post.root_id) {
            replyCountByRoot.set(
                post.root_id,
                (replyCountByRoot.get(post.root_id) ?? 0) + 1,
            );
        }
        if (ctx.includeMentions && mentionsSomeone(post, ctx.people)) {
            mentionedRoots.add(post.root_id || post.id);
        }
    }

    const peopleIds = new Set(ctx.people.map((person) => person.id));
    const threads: MyThread[] = [];
    for (const post of posts.values()) {
        if (post.root_id || post.delete_at) {
            continue;
        }
        const isOwn = ctx.includeOwn !== false && peopleIds.has(post.user_id);
        if (!isOwn && !mentionedRoots.has(post.id)) {
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
