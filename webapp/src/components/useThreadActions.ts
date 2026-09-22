// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {THREAD_OPEN_RESIZE_DELAYS_MS} from 'constants';

import type {Dispatch, SetStateAction} from 'react';
import {useStore} from 'react-redux';
import type {MyThread, ReactionSummary} from 'utils/threads';
import {aggregateReactions} from 'utils/threads';

import type {PostList} from '@mattermost/types/posts';

import {receivedPosts, receivedPostsInThread} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';

type Args = {
    userId: string | undefined;
    teamName: string | undefined;
    reactionsByPost: Record<string, ReactionSummary[]>;
    setReactionsByPost: Dispatch<SetStateAction<Record<string, ReactionSummary[]>>>;
};

// Thread-level actions of the panel: opening a thread in the RHS, jumping
// to the post in the channel and toggling reaction chips.
export function useThreadActions({userId, teamName, reactionsByPost, setReactionsByPost}: Args) {
    const store = useStore();

    const refetchReactions = async (postId: string) => {
        try {
            const list = await Client4.getReactionsForPost(postId);
            setReactionsByPost((prev) => ({...prev, [postId]: aggregateReactions(list, userId || '')}));
        } catch {
            // Keep the previously rendered chips.
        }
    };

    // Jumps to the post in the channel (permalink navigation): the host
    // scrolls the channel to it and highlights it.
    const jumpToPost = (thread: MyThread) => {
        if (!teamName) {
            return;
        }
        const url = `/${teamName}/pl/${thread.id}`;
        try {
            window.history.pushState({}, '', url);
            window.dispatchEvent(new PopStateEvent('popstate', {state: window.history.state}));
        } catch (e) {
            window.location.assign(url);
        }
    };

    const reactionsFor = (thread: MyThread): ReactionSummary[] =>
        reactionsByPost[thread.id] ?? thread.reactions;

    // Adds or removes the user's reaction, then refreshes that post's chips.
    const toggleReaction = async (thread: MyThread, emojiName: string) => {
        if (!userId) {
            return;
        }
        const alreadyMine = reactionsFor(thread).some((s) => s.emojiName === emojiName && s.mine);
        try {
            if (alreadyMine) {
                await Client4.removeReaction(userId, thread.id, emojiName);
            } else {
                await Client4.addReaction(userId, thread.id, emojiName);
            }
        } catch {
            return;
        }
        await refetchReactions(thread.id);
    };

    // Opens the thread in the right-hand sidebar with its reply composer,
    // like the host's own Saved Messages panel does. The raw post is put
    // into the store first so old threads render without extra fetching.
    const openThread = (thread: MyThread) => {
        try {
            // first_inaccessible_post_time is only read when the action
            // carries channelId/rootId (mattermost-redux posts reducer), so
            // the zero here is inert — it completes the PostList type.
            const postList: PostList = {
                order: [thread.post.id],
                posts: {[thread.post.id]: thread.post},
                next_post_id: '',
                prev_post_id: '',
                first_inaccessible_post_time: 0,
            };
            store.dispatch(receivedPosts(postList));
            store.dispatch({
                type: 'SELECT_POST',
                postId: thread.id,
                channelId: thread.channelId,
                timestamp: Date.now(),
            });

            // The host thread view's virtual list sometimes measures its
            // container as zero-sized right after the panel swap and renders
            // empty. A resize nudge forces the re-measure.
            THREAD_OPEN_RESIZE_DELAYS_MS.forEach((delay) => setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, delay));

            // Preload the full thread so the reply composer shows up at once;
            // the host would fetch it on its own, just slower. Thread views
            // read posts from the dedicated "in thread" store section.
            Client4.getPostThread(thread.id).then((list) => {
                store.dispatch(receivedPostsInThread(list, thread.id));
            }).catch(() => {
                // The host will fetch the thread itself.
            });
        } catch (e) {
            if (teamName) {
                window.location.assign(`/${teamName}/pl/${thread.id}`);
            }
        }
    };

    return {openThread, jumpToPost, toggleReaction, refetchReactions};
}
