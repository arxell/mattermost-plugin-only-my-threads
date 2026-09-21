// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {POSTED_ACTION, REACTION_ACTION, postedReducer} from 'reducer';
import {describe, expect, it} from 'vitest';

describe('postedReducer', () => {
    it('starts at zero with no channel or post', () => {
        expect(postedReducer(undefined, {type: 'init'})).toEqual({seq: 0, channelId: null, reactionSeq: 0, reactionPostId: null});
    });

    it('bumps the counter and remembers the channel on posted actions', () => {
        const first = postedReducer(undefined, {type: POSTED_ACTION, channelId: 'ch1'});
        expect(first).toEqual({seq: 1, channelId: 'ch1', reactionSeq: 0, reactionPostId: null});

        const second = postedReducer(first, {type: POSTED_ACTION, channelId: 'ch1'});
        expect(second).toEqual({seq: 2, channelId: 'ch1', reactionSeq: 0, reactionPostId: null});
    });

    it('switches to the newest posted channel', () => {
        let state = postedReducer(undefined, {type: POSTED_ACTION, channelId: 'ch1'});
        state = postedReducer(state, {type: POSTED_ACTION, channelId: 'ch2'});
        expect(state).toEqual({seq: 2, channelId: 'ch2', reactionSeq: 0, reactionPostId: null});
    });

    it('returns the same state object for unrelated actions', () => {
        const state = {seq: 5, channelId: 'ch1', reactionSeq: 0, reactionPostId: null};
        expect(postedReducer(state, {type: 'SOMETHING_ELSE'})).toBe(state);
    });

    it('ignores posted actions without a channel id', () => {
        const state = {seq: 5, channelId: 'ch1', reactionSeq: 0, reactionPostId: null};
        expect(postedReducer(state, {type: POSTED_ACTION})).toBe(state);
        expect(postedReducer(state, {type: POSTED_ACTION, channelId: ''})).toBe(state);
    });
});

describe('reaction actions', () => {
    it('bumps reactionSeq and remembers the post', () => {
        let state = postedReducer(undefined, {type: REACTION_ACTION, postId: 'p1'});
        state = postedReducer(state, {type: REACTION_ACTION, postId: 'p2'});
        expect(state).toEqual({seq: 0, channelId: null, reactionSeq: 2, reactionPostId: 'p2'});
    });

    it('keeps posted counters untouched', () => {
        const base = postedReducer(undefined, {type: POSTED_ACTION, channelId: 'ch1'});
        const next = postedReducer(base, {type: REACTION_ACTION, postId: 'p1'});
        expect(next.seq).toBe(1);
        expect(next.channelId).toBe('ch1');
        expect(next.reactionPostId).toBe('p1');
    });

    it('ignores reaction actions without a post id', () => {
        const state = {seq: 1, channelId: 'ch1', reactionSeq: 5, reactionPostId: 'p1'};
        expect(postedReducer(state, {type: REACTION_ACTION})).toBe(state);
    });
});
