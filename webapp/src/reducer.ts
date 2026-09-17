// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Reducer} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

export const POSTED_ACTION = 'only-my-threads/posted';
export const REACTION_ACTION = 'only-my-threads/reaction';

export interface PostedState {
    seq: number;
    channelId: string | null;
    reactionSeq: number;
    reactionPostId: string | null;
}

const initialState: PostedState = {seq: 0, channelId: null, reactionSeq: 0, reactionPostId: null};

// Bumped by the "posted" and reaction websocket handlers so the thread
// lists (the channel RHS panel and the global page) can refresh when the
// current channel or a listed thread changes.
export const postedReducer: Reducer<PostedState> = (
    state = initialState,
    action,
) => {
    const typedAction = action as {type?: string; channelId?: string; postId?: string};
    if (typedAction.type === POSTED_ACTION && typedAction.channelId) {
        return {...state, seq: state.seq + 1, channelId: typedAction.channelId};
    }
    if (typedAction.type === REACTION_ACTION && typedAction.postId) {
        return {...state, reactionSeq: state.reactionSeq + 1, reactionPostId: typedAction.postId};
    }
    return state;
};

// The key the host mounts the posted reducer under.
const PLUGIN_STATE_KEY = 'plugins-only-my-threads';

type PluginStateSlice = Partial<PostedState>;

const pluginStateSlice = (state: GlobalState): PluginStateSlice => {
    const slice = (state as unknown as Record<string, PluginStateSlice>)[PLUGIN_STATE_KEY];
    return slice ?? {};
};

// Counts new posts only in the channel the store currently shows, so the
// channel panel does not refetch while the user is elsewhere.
export const getPostedSeq = (state: GlobalState): number => {
    const pluginState = pluginStateSlice(state);
    const currentChannelId = state.entities.channels.currentChannelId;
    if (!pluginState || pluginState.channelId !== currentChannelId) {
        return 0;
    }
    return pluginState.seq ?? 0;
};

export const getReactionSeq = (state: GlobalState): number => pluginStateSlice(state).reactionSeq ?? 0;

export const getReactionPostId = (state: GlobalState): string | null => pluginStateSlice(state).reactionPostId ?? null;
