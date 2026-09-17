// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {POSTED_ACTION, postedReducer} from 'reducer';

describe('postedReducer', () => {
    it('starts at seq 0 with no channel', () => {
        expect(postedReducer(undefined, {type: 'init'})).toEqual({seq: 0, channelId: null});
    });

    it('bumps the counter and remembers the channel on posted actions', () => {
        const first = postedReducer(undefined, {type: POSTED_ACTION, channelId: 'ch1'});
        expect(first).toEqual({seq: 1, channelId: 'ch1'});

        const second = postedReducer(first, {type: POSTED_ACTION, channelId: 'ch1'});
        expect(second).toEqual({seq: 2, channelId: 'ch1'});
    });

    it('switches to the newest posted channel', () => {
        let state = postedReducer(undefined, {type: POSTED_ACTION, channelId: 'ch1'});
        state = postedReducer(state, {type: POSTED_ACTION, channelId: 'ch2'});
        expect(state).toEqual({seq: 2, channelId: 'ch2'});
    });

    it('returns the same state object for unrelated actions', () => {
        const state = {seq: 5, channelId: 'ch1'};
        expect(postedReducer(state, {type: 'SOMETHING_ELSE'})).toBe(state);
    });

    it('ignores posted actions without a channel id', () => {
        const state = {seq: 5, channelId: 'ch1'};
        expect(postedReducer(state, {type: POSTED_ACTION})).toBe(state);
        expect(postedReducer(state, {type: POSTED_ACTION, channelId: ''})).toBe(state);
    });
});
