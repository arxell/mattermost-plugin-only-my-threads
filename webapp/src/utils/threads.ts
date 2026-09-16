// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

export interface MyThread {
    id: string;
    channelId: string;
    message: string;
    createAt: number;
    replyCount: number;
    lastActivityAt: number;

    // True when the root post has no replies yet ("waiting for an answer").
    awaitingReply: boolean;

    // The raw root post, reused to put it into the host store before
    // opening the thread in the right-hand sidebar.
    post: Post;
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

function sortThreads(threads: MyThread[]): MyThread[] {
    threads.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
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

// The user's own root posts for one month, with reply counts and last
// activity. Month pagination is server-side: the search request is bounded
// by after:/before: dates, so the cost never depends on channel volume.
// Per-root thread lookups add counts (a missing thread means no replies).
async function fetchMonthThreads(userId: string, teamId: string, ctx: SearchContext, monthsBack: number): Promise<MyThread[]> {
    const {after, before} = monthBounds(monthsBack);
    const channelTerm = (ctx.isPrivateChannel ? '~' : '') + ctx.channelName;
    const terms = `in:${channelTerm} from:${ctx.username} after:${after} before:${before}`;

    const results = await Client4.searchPosts(teamId, terms, false);
    const roots = results.order.
        map((id) => (results.posts ? results.posts[id] : undefined)).
        flatMap((post) => {
            if (!post || post.root_id !== '' || post.delete_at) {
                return [];
            }
            return [post];
        });

    const details = await Promise.allSettled(roots.map((root) => Client4.getUserThread(userId, teamId, root.id)));

    return sortThreads(roots.map((root, i) => {
        const detail = details[i];
        if (detail.status === 'fulfilled') {
            return {
                id: root.id,
                channelId: root.channel_id,
                message: root.message,
                createAt: root.create_at,
                replyCount: detail.value.reply_count,
                lastActivityAt: Math.max(detail.value.last_reply_at, root.create_at),
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
            lastActivityAt: root.create_at,
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

// Pages one month further back, skipping up to MAX_EMPTY_MONTHS_TO_SKIP
// empty months. Resolves to null when there is nothing more to show.
export async function fetchOlderMonth(userId: string, teamId: string, ctx: SearchContext, startMonthsBack: number): Promise<MyThread[] | null> {
    for (let back = startMonthsBack; back < startMonthsBack + MAX_EMPTY_MONTHS_TO_SKIP; back++) {
        // Sequential by nature: each month is only fetched when needed.
        // eslint-disable-next-line no-await-in-loop
        const threads = await fetchMonthThreads(userId, teamId, ctx, back);
        if (threads.length > 0) {
            return threads;
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

    const lastReplyAt = new Map<string, number>();
    const replyCountByRoot = new Map<string, number>();
    for (const post of posts.values()) {
        if (post.root_id && !post.delete_at) {
            lastReplyAt.set(
                post.root_id,
                Math.max(lastReplyAt.get(post.root_id) ?? 0, post.create_at),
            );
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
            lastActivityAt: Math.max(post.create_at, lastReplyAt.get(post.id) ?? 0),
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
