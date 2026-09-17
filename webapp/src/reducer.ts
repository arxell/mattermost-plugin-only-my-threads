// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Reducer} from 'redux';

export const POSTED_ACTION = 'only-my-threads/posted';
export const REACTION_ACTION = 'only-my-threads/reaction';

export interface PostedState {
    seq: number;
    channelId: string | null;
    reactionSeq: number;
    reactionPostId: string | null;
}

const initialState: PostedState = {seq: 0, channelId: null, reactionSeq: 0, reactionPostId: null};

// Bumped by the "posted" and reaction websocket handlers so the RHS panel
// can refresh when the current channel or a listed thread changes.
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
