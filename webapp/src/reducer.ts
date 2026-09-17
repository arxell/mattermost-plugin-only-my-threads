// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Reducer} from 'redux';

export const POSTED_ACTION = 'only-my-threads/posted';

export interface PostedState {
    seq: number;
    channelId: string | null;
}

// Bumped by the "posted" websocket handler so the RHS panel can refresh when
// the current channel gets new messages or replies.
export const postedReducer: Reducer<PostedState> = (
    state = {seq: 0, channelId: null},
    action,
) => {
    const typedAction = action as {type?: string; channelId?: string};
    if (typedAction.type === POSTED_ACTION && typedAction.channelId) {
        return {seq: state.seq + 1, channelId: typedAction.channelId};
    }
    return state;
};
