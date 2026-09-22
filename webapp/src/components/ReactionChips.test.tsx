// @vitest-environment jsdom

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';

import ReactionChips from './ReactionChips';
import type {PanelColors} from './types';

import {cleanup, render, translateEn} from '../../tests/test_utils';
import type {MyThread, ReactionSummary} from '../utils/threads';

vi.mock('i18n', async () => {
    const {translateEn: t} = await import('../../tests/test_utils');
    return {useTranslation: () => ({locale: 'en', t})};
});

vi.mock('mattermost-redux/client', () => ({Client4: {}}));

afterEach(cleanup);

const colors: PanelColors = {
    centerColor: '#1f4157',
    linkColor: '#166de0',
    secondaryColor: 'rgba(31, 65, 87, 0.6)',
    errorColor: '#d24b4e',
    toolbarBg: '#ffffff',
};

const thread: MyThread = {
    id: 't1',
    channelId: 'ch1',
    message: 'hi',
    createAt: 100,
    replyCount: 0,
    reactions: [],
    awaitingReply: true,
    post: {id: 't1', channel_id: 'ch1'} as Post,
};

const renderChips = (reactions: ReactionSummary[], pickerOpen = false) => {
    const props = {
        thread,
        reactions,
        pickerOpen,
        colors,
        onToggleReaction: vi.fn(),
        onTogglePicker: vi.fn(),
    };
    const container = render(<ReactionChips {...props}/>);
    return {container, props};
};

const click = (el: Element) => {
    el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
};

describe('ReactionChips', () => {
    it('renders nothing when there are no reactions and no picker', () => {
        const {container} = renderChips([]);
        expect(container.innerHTML).toBe('');
    });

    it('renders a chip per reaction, counts only above one', () => {
        const {container} = renderChips([
            {emojiName: '+1', count: 2, mine: true},
            {emojiName: 'tada', count: 1, mine: false},
        ]);

        const chips = [...container.querySelectorAll('.omt-chip')];
        expect(chips[0].textContent).toBe('👍2');
        expect(chips[1].textContent).toBe('🎉');
        expect(chips[0].getAttribute('title')).toBe(':+1:');
    });

    it('highlights the own reaction with the link color', () => {
        const {container} = renderChips([
            {emojiName: '+1', count: 1, mine: true},
            {emojiName: 'tada', count: 1, mine: false},
        ]);

        const [mine, theirs] = [...container.querySelectorAll<HTMLElement>('.omt-chip')];
        expect(mine.style.border).toContain('rgb(22, 109, 224)'); // linkColor, normalized by jsdom
        expect(theirs.style.border).not.toContain('rgb(22, 109, 224)');
    });

    it('toggles the clicked reaction without bubbling', () => {
        const parentClick = vi.fn();
        const props = {
            thread,
            reactions: [{emojiName: '+1', count: 1, mine: false}],
            pickerOpen: false,
            colors,
            onToggleReaction: vi.fn(),
            onTogglePicker: vi.fn(),
        };
        const container = render(
            <div onClick={parentClick}>
                <ReactionChips {...props}/>
            </div>,
        );

        click(container.querySelector('.omt-chip')!);
        expect(props.onToggleReaction).toHaveBeenCalledWith(thread, '+1');
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('the add chip only toggles the picker', () => {
        const {container, props} = renderChips([{emojiName: '+1', count: 1, mine: false}]);

        click(container.querySelector(`[title="${translateEn('panel.addReaction')}"]`)!);
        expect(props.onTogglePicker).toHaveBeenCalledWith('t1');
        expect(props.onToggleReaction).not.toHaveBeenCalled();
    });

    it('the picker picks an emoji and closes itself', () => {
        const {container, props} = renderChips([], true);

        const emojis = container.querySelectorAll('.omt-emoji');
        expect(emojis.length).toBeGreaterThanOrEqual(18);

        click(emojis[0]);
        expect(props.onTogglePicker).toHaveBeenCalledWith('t1');
        expect(props.onToggleReaction).toHaveBeenCalledWith(thread, '+1');
    });
});
