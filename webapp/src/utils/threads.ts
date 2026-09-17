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

// Search paging: the server caps one page, so fetch month results in pages.
const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 10;

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
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {after: fmt(start), before: fmt(end)};
}

// The user's own root posts for one month, with reply counts. Month pagination is server-side: the search request is bounded
// by after:/before: dates, so the cost never depends on channel volume.
// Per-root thread lookups add counts (a missing thread means no replies).
async function fetchMonthThreads(userId: string, teamId: string, ctx: SearchContext, monthsBack: number): Promise<MyThread[]> {
    const {after, before} = monthBounds(monthsBack);
    const channelTerm = (ctx.isPrivateChannel ? '~' : '') + ctx.channelName;
    const terms = `in:${channelTerm} from:${ctx.username} after:${after} before:${before}`;

    // The server caps a single search page (default ~60 posts); without
    // paging, active users' replies push their older root posts out of the
    // first page. Page through explicitly.
    const collected = new Map<string, Post>();
    for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
        // Search pages must be fetched sequentially to stop early.
        // eslint-disable-next-line no-await-in-loop
        const results = await Client4.searchPostsWithParams(teamId, {
            terms,
            is_or_search: false,
            page,
            per_page: SEARCH_PAGE_SIZE,
        } as never);
        let added = 0;
        for (const id of results.order) {
            const post = results.posts ? results.posts[id] : undefined;
            if (post && !collected.has(id)) {
                collected.set(id, post);
                added++;
            }
        }
        if (added < SEARCH_PAGE_SIZE) {
            break;
        }
    }

    const roots = [...collected.values()].filter((post) => post.root_id === '' && !post.delete_at);

    const details = await Promise.allSettled(roots.map((root) => Client4.getUserThread(userId, teamId, root.id)));
    const reactionLists = await Promise.allSettled(roots.map((root) => Client4.getReactionsForPost(root.id)));

    return sortThreads(roots.map((root, i) => {
        const detail = details[i];
        const reactionList = reactionLists[i] as PromiseSettledResult<Reaction[]>;
        const reactions = reactionList.status === 'fulfilled' ? aggregateReactions(reactionList.value ?? [], userId) : [];
        if (detail.status === 'fulfilled') {
            return {
                id: root.id,
                channelId: root.channel_id,
                message: root.message,
                createAt: root.create_at,
                replyCount: detail.value.reply_count,
                reactions,
                awaitingReply: detail.value.reply_count === 0,
                post: root,
            };
        }
        return {
            id: root.id,
            channelId: root.channel_id,
            message: root.message,
            createAt: root.create_at,
            replyCount: 0,
            reactions,
            awaitingReply: true,
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
