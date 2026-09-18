// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

import {aggregateReactions, fetchCurrentMonth, fetchOlderMonth, messageToSnippet} from './threads';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        searchPostsWithParams: jest.fn(),
        getPostsByIds: jest.fn(),
        getPosts: jest.fn(),
        getReactionsForPost: jest.fn(),
    },
}));

const mockedSearch = Client4.searchPostsWithParams as jest.Mock;
const mockedPostsByIds = Client4.getPostsByIds as jest.Mock;
const mockedGetPosts = Client4.getPosts as jest.Mock;
const mockedGetReactions = Client4.getReactionsForPost as jest.Mock;

const makePost = (id: string, overrides: Partial<Post> = {}): Post => ({
    id,
    create_at: 100,
    update_at: 100,
    edit_at: 0,
    delete_at: 0,
    is_pinned: false,
    user_id: 'u1',
    channel_id: 'ch1',
    root_id: '',
    original_id: '',
    message: `message ${id}`,
    type: '',
    props: {},
    hashtags: '',
    file_ids: [],
    pending_post_id: '',
    reply_count: 0,
    last_reply_at: 0,
    ...overrides,
} as Post);

const searchResponse = (posts: Post[]) => ({
    order: posts.map((p) => p.id),
    posts: Object.fromEntries(posts.map((p) => [p.id, p])),
});

const dateOnlyOf = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Mirrors monthBounds() for the current month, monthsBack months back.
const expectedBounds = (monthsBack: number) => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - monthsBack);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {after: fmt(start), before: fmt(end)};
};

const PUBLIC_CTX = {channelName: 'team-abc', isPrivateChannel: false, username: 'anton'};

describe('messageToSnippet', () => {
    it('replaces fenced code blocks with the label', () => {
        expect(messageToSnippet('look:\n```js\nconst a = 1;\n```\ndone')).
            toBe('look: [code] done');
        expect(messageToSnippet('```js\nx\n```', {codeLabel: '[код]'})).toBe('[код]');
    });

    it('unwraps inline code', () => {
        expect(messageToSnippet('run `make dist` now')).toBe('run make dist now');
    });

    it('replaces images with the label and keeps link URLs', () => {
        expect(messageToSnippet('![logo](http://x/y.png)')).toBe('[image]');
        expect(messageToSnippet('see [docs](http://a/b) here', {imageLabel: '[фото]'})).toBe('see http://a/b here');
    });

    it('strips emphasis and quote markers', () => {
        expect(messageToSnippet('**bold** _it_ ~~st~~')).toBe('bold it st');
        expect(messageToSnippet('> quoted line')).toBe('quoted line');
    });

    it('collapses all whitespace into single spaces', () => {
        expect(messageToSnippet('a\n\n   b\tc  d')).toBe('a b c d');
    });

    it('truncates long messages with an ellipsis', () => {
        const long = 'x'.repeat(300);
        const snippet = messageToSnippet(long);
        expect(snippet.length).toBeLessThanOrEqual(120);
        expect(snippet.endsWith('…')).toBe(true);

        expect(messageToSnippet(long, {maxLength: 10}).length).toBeLessThanOrEqual(10);
    });
});

describe('aggregateReactions', () => {
    const reaction = (emojiName: string, userId: string, deleted = false) => ({
        user_id: userId,
        post_id: 'p1',
        emoji_name: emojiName,
        create_at: 1,
        update_at: 1,
        delete_at: deleted ? 2 : 0,
    });

    it('groups by emoji, counts and flags the own reaction', () => {
        const summaries = aggregateReactions([
            reaction('+1', 'u1'),
            reaction('+1', 'u2'),
            reaction('tada', 'u2'),
        ], 'u1');
        expect(summaries).toEqual([
            {emojiName: '+1', count: 2, mine: true},
            {emojiName: 'tada', count: 1, mine: false},
        ]);
    });

    it('skips deleted reactions and sorts by count', () => {
        const summaries = aggregateReactions([
            reaction('a', 'u2', true),
            reaction('b', 'u2'),
            reaction('b', 'u1'),
        ], 'u1');
        expect(summaries).toEqual([{emojiName: 'b', count: 2, mine: true}]);
    });

    it('returns an empty list for no reactions', () => {
        expect(aggregateReactions([], 'u1')).toEqual([]);
    });
});

describe('fetchCurrentMonth (search mode)', () => {
    beforeEach(() => {
        mockedSearch.mockReset();
        mockedPostsByIds.mockReset().mockResolvedValue([]);
        mockedGetPosts.mockReset();
        mockedGetReactions.mockReset().mockResolvedValue([]);
    });

    it('searches the current month in the channel by the user', async () => {
        mockedSearch.mockResolvedValue(searchResponse([]));

        await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedSearch).toHaveBeenCalledTimes(1);
        const [teamId, params] = mockedSearch.mock.calls[0];
        expect(teamId).toBe('t1');
        expect(params.is_or_search).toBe(false);
        expect(params.page).toBe(0);
        expect(params.per_page).toBe(100);

        const {after, before} = expectedBounds(0);
        expect(params.terms).toBe(`in:team-abc from:anton after:${after} before:${before}`);
    });

    it('prefixes private channel names with a tilde', async () => {
        mockedSearch.mockResolvedValue(searchResponse([]));

        await fetchCurrentMonth('u1', 't1', 'ch1', {...PUBLIC_CTX, channelName: 'leads', isPrivateChannel: true});

        expect(mockedSearch.mock.calls[0][1].terms).toContain('in:~leads ');
    });

    it('treats a 99-result window as saturated too', async () => {
        // Some backends truncate one short of the requested page; a
        // 99-post window must still hop (observed in production).
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        const first = Array.from({length: 99}, (_, i) => makePost('p1-' + i, {create_at: now - (i * 60_000)}));
        const oldestFirst = now - (98 * 60_000);
        const tail = makePost('tail', {create_at: oldestFirst - (5 * 60_000)});
        const older = Array.from({length: 2}, (_, i) => makePost('p2-' + i, {create_at: oldestFirst - day - (i * 60_000)}));
        mockedSearch.mockResolvedValueOnce(searchResponse(first)).
            mockResolvedValueOnce(searchResponse([tail])).
            mockResolvedValueOnce(searchResponse(older)).
            mockResolvedValueOnce(searchResponse([]));
        mockedPostsByIds.mockResolvedValue([]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedSearch.mock.calls.length).toBeGreaterThanOrEqual(3);
        expect(threads).toHaveLength(102);
    });

    it('completes the saturated day and hops the window earlier', async () => {
        // The backend truncates a saturated window at the newest 100 and
        // reports no pages; the fetch must re-fetch the oldest fetched day
        // on its own and then continue the month before that day.
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        const first = Array.from({length: 100}, (_, i) => makePost('p1-' + i, {create_at: now - (i * 60_000)}));
        const oldestFirst = now - (99 * 60_000);
        const tail = makePost('tail', {create_at: oldestFirst - (5 * 60_000)}); // same day, cut by truncation
        const older = Array.from({length: 3}, (_, i) => makePost('p2-' + i, {create_at: oldestFirst - day - (i * 60_000)}));
        mockedSearch.mockResolvedValueOnce(searchResponse(first)). // month window, saturated
            mockResolvedValueOnce(searchResponse([tail])). // the saturated day on its own
            mockResolvedValueOnce(searchResponse(older)); // the rest of the month
        mockedPostsByIds.mockResolvedValue([]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedSearch).toHaveBeenCalledTimes(3);
        const dayTerms = mockedSearch.mock.calls[1][1].terms as string;
        expect(dayTerms).toContain('after:' + dateOnlyOf(oldestFirst - day));
        expect(dayTerms).toContain('before:' + dateOnlyOf(oldestFirst + day));
        const olderTerms = mockedSearch.mock.calls[2][1].terms as string;
        expect(olderTerms).toContain('before:' + dateOnlyOf(oldestFirst));
        expect(threads).toHaveLength(104);
    });

    it('stops window hopping when the day cannot move further', async () => {
        // All 100 posts share one day: the first hop moves the window end
        // onto that day, the second confirms there is nothing older (the
        // mock keeps returning the same day), and day granularity cannot
        // step any deeper — the fetch stops instead of looping.
        const sameDay = new Date();
        sameDay.setHours(12, 0, 0, 0);
        const posts = Array.from({length: 100}, (_, i) => makePost('same-' + i, {create_at: sameDay.getTime() - i}));
        mockedSearch.mockResolvedValue(searchResponse(posts));
        mockedPostsByIds.mockResolvedValue([]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedSearch).toHaveBeenCalledTimes(3);
        expect(threads).toHaveLength(100);
    });

    it('stops after 40 window hops even on extreme channels', async () => {
        mockedSearch.mockImplementation(() =>
            searchResponse(Array.from({length: 100}, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (i % 3) - 1);
                d.setHours(12 - (i % 10), 0, 0, 0);
                return makePost('hop-' + Math.random() + '-' + i, {create_at: d.getTime()});
            })));
        mockedPostsByIds.mockResolvedValue([]);

        await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedSearch.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(mockedSearch.mock.calls.length).toBeLessThanOrEqual(40);
    });

    it('keeps only live root posts and maps thread details', async () => {
        const root = makePost('root1', {create_at: 100});
        const reply = makePost('reply1', {root_id: 'root1', create_at: 200});
        const deleted = makePost('gone1', {delete_at: 12345});
        mockedSearch.mockResolvedValue(searchResponse([root, reply, deleted]));
        mockedPostsByIds.mockResolvedValue([{
            ...root,
            reply_count: 3,
            metadata: {reactions: [{user_id: 'u1', post_id: 'root1', emoji_name: '+1', create_at: 1, update_at: 1, delete_at: 0}]},
        }]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedPostsByIds).toHaveBeenCalledTimes(1);
        expect(mockedPostsByIds).toHaveBeenCalledWith(['root1']);
        expect(threads).toHaveLength(1);
        expect(threads[0]).toMatchObject({
            id: 'root1',
            replyCount: 3,
            createAt: 100,
            awaitingReply: false,
        });
    });

    it('treats a missing thread as zero replies (awaiting)', async () => {
        mockedSearch.mockResolvedValue(searchResponse([makePost('root2', {create_at: 150})]));
        mockedPostsByIds.mockResolvedValue([]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(threads[0]).toMatchObject({
            id: 'root2',
            replyCount: 0,
            createAt: 150,
            awaitingReply: true,
        });
    });

    it('aggregates reactions from the batch metadata', async () => {
        const root9 = makePost('root9');
        mockedSearch.mockResolvedValue(searchResponse([root9]));
        mockedPostsByIds.mockResolvedValue([{
            ...root9,
            reply_count: 0,
            metadata: {reactions: [
                {user_id: 'u1', post_id: 'root9', emoji_name: '+1', create_at: 1, update_at: 1, delete_at: 0},
                {user_id: 'u2', post_id: 'root9', emoji_name: '+1', create_at: 1, update_at: 1, delete_at: 0},
            ]},
        }]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedGetReactions).not.toHaveBeenCalled();
        expect(threads[0].reactions).toEqual([{emojiName: '+1', count: 2, mine: true}]);
    });

    it('falls back to a channel scan when search fails', async () => {
        mockedSearch.mockRejectedValue(new Error('search disabled'));
        const mine = makePost('my-root', {user_id: 'u1', create_at: 100});
        const other = makePost('other-root', {user_id: 'u2', create_at: 90});
        const reply = makePost('my-reply', {user_id: 'u2', root_id: 'my-root', create_at: 200});
        mockedGetPosts.mockResolvedValue(searchResponse([mine, other, reply]));

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedGetPosts).toHaveBeenCalledWith('ch1', 0, 100);
        expect(threads).toHaveLength(1);
        expect(threads[0]).toMatchObject({id: 'my-root', replyCount: 1, createAt: 100});
    });

    it('keeps scanning pages until a short page arrives', async () => {
        mockedSearch.mockRejectedValue(new Error('search disabled'));
        const page0 = Array.from({length: 100}, (_, i) => makePost(`s0-${i}`));
        const page1 = Array.from({length: 30}, (_, i) => makePost(`s1-${i}`));
        mockedGetPosts.mockResolvedValueOnce(searchResponse(page0)).mockResolvedValueOnce(searchResponse(page1));
        mockedPostsByIds.mockResolvedValue([]);

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedGetPosts).toHaveBeenCalledTimes(2);
        expect(mockedGetPosts).toHaveBeenLastCalledWith('ch1', 1, 100);
        expect(threads).toHaveLength(130);
    });

    it('caps the fallback scan window at 1000 posts', async () => {
        mockedSearch.mockRejectedValue(new Error('search disabled'));
        mockedGetPosts.mockImplementation((_ch: string, page: number) =>
            searchResponse(Array.from({length: 100}, (_, i) => makePost(`w${page}-${i}`))));

        await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        expect(mockedGetPosts).toHaveBeenCalledTimes(10);
    });

    it('mixes fulfilled and missing thread details and sorts by creation date', async () => {
        const answered = makePost('answered', {create_at: 100});
        const awaiting = makePost('awaiting', {create_at: 400});
        mockedSearch.mockResolvedValue(searchResponse([answered, awaiting]));
        mockedPostsByIds.mockImplementation(async (ids: string[]) =>
            ids.map((id) => (id === 'answered' ? {id, reply_count: 2} : {id, reply_count: 0})));

        const threads = await fetchCurrentMonth('u1', 't1', 'ch1', PUBLIC_CTX);

        // Sorted by the root creation date only: the answered thread got a
        // later reply (500) but was created earlier (100), so it stays
        // below the newer unreplied one.
        expect(threads.map((t) => t.id)).toEqual(['awaiting', 'answered']);
        expect(threads[0]).toMatchObject({replyCount: 0, awaitingReply: true, createAt: 400});
        expect(threads[1]).toMatchObject({replyCount: 2, awaitingReply: false, createAt: 100});
    });
});

describe('fetchOlderMonth', () => {
    beforeEach(() => {
        mockedSearch.mockReset();
        mockedPostsByIds.mockReset().mockResolvedValue([]);
        mockedGetReactions.mockReset().mockResolvedValue([]);
    });

    it('skips empty months and returns the first month with data and its position', async () => {
        mockedSearch.
            mockResolvedValueOnce(searchResponse([])).
            mockResolvedValueOnce(searchResponse([])).
            mockResolvedValueOnce(searchResponse([makePost('old1', {create_at: 10})]));
        mockedPostsByIds.mockImplementation(async (ids: string[]) => ids.map((id) => ({id, reply_count: 2})));

        const page = await fetchOlderMonth('u1', 't1', PUBLIC_CTX, 1);

        expect(mockedSearch).toHaveBeenCalledTimes(3);
        const {after, before} = expectedBounds(1);
        expect(mockedSearch.mock.calls[0][1].terms).toBe(`in:team-abc from:anton after:${after} before:${before}`);
        expect(mockedSearch.mock.calls[2][1].terms).toContain(expectedBounds(3).after);
        if (page === null) {
            throw new Error('expected a page');
        }
        expect(page.monthsBack).toBe(3);
        expect(page.threads).toHaveLength(1);
        expect(page.threads[0].id).toBe('old1');
    });

    it('gives up after 24 empty months and resolves null', async () => {
        mockedSearch.mockResolvedValue(searchResponse([]));

        const result = await fetchOlderMonth('u1', 't1', PUBLIC_CTX, 5);

        expect(mockedSearch).toHaveBeenCalledTimes(24);
        expect(result).toBeNull();
    });
});
