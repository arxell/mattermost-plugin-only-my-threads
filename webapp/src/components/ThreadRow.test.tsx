// @vitest-environment jsdom

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';

import {ITEM_TOOLBAR_CSS} from './styles';
import ThreadRow from './ThreadRow';
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

const makeThread = (overrides: Partial<MyThread> = {}): MyThread => ({
    id: 't1',
    channelId: 'ch1',
    message: 'hello **world**',
    createAt: new Date(2026, 8, 17, 17, 6).getTime(),
    replyCount: 3,
    reactions: [],
    awaitingReply: false,
    post: {id: 't1', channel_id: 'ch1', message: 'hello **world**'} as Post,
    ...overrides,
});

const renderRow = (threadOverrides: Partial<MyThread> = {}, handlers: Record<string, unknown> = {}, pickerOpen = false) => {
    const props = {
        thread: makeThread(threadOverrides),
        reactions: (threadOverrides.reactions ?? []) as ReactionSummary[],
        pickerOpen,
        colors,
        onOpenThread: vi.fn(),
        onJumpToPost: vi.fn(),
        onToggleReaction: vi.fn(),
        onTogglePicker: vi.fn(),
        ...handlers,
    };
    const container = render(<ThreadRow {...props}/>);
    return {container, props};
};

const click = (el: Element) => {
    el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
};

const mouseDown = (el: Element): MouseEvent => {
    const event = new MouseEvent('mousedown', {bubbles: true, cancelable: true});
    el.dispatchEvent(event);
    return event;
};

const buttonByTitle = (container: HTMLElement, title: string): HTMLButtonElement => {
    const button = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
    if (!button) {
        throw new Error(`no button titled ${title}`);
    }
    return button;
};

describe('ThreadRow', () => {
    it('renders the snippet, the creation date and the reply count', () => {
        const {container} = renderRow();

        expect(container.textContent).toContain('hello world');
        expect(container.textContent).toContain(translateEn('panel.createdLabel'));
        expect(container.textContent).toContain('17.09.26');
        expect(container.textContent).toContain('💬 3');
    });

    it('shows the awaiting glyph instead of the counter for unreplied threads', () => {
        const {container} = renderRow({replyCount: 0, awaitingReply: true});

        const glyph = container.querySelector(`[title="${translateEn('panel.awaiting')}"]`);
        expect(glyph?.textContent).toBe('⏳');
        expect(container.textContent).not.toContain('💬');
    });

    it('opens the thread on row click and on Enter', () => {
        const {container, props} = renderRow();
        const row = container.querySelector('.omt-item')!;

        click(row);
        expect(props.onOpenThread).toHaveBeenCalledTimes(1);
        expect(props.onOpenThread).toHaveBeenCalledWith(props.thread);

        row.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        expect(props.onOpenThread).toHaveBeenCalledTimes(2);
    });

    it('ships the hover toolbar markup and the :hover rule in the stylesheet', () => {
        // jsdom does not evaluate CSS, so the hover visibility itself is
        // asserted on the stylesheet text; the toolbar starts hidden via
        // .omt-toolbar { visibility: hidden } and appears on item hover.
        const {container} = renderRow();

        const toolbar = container.querySelector('.omt-item .omt-toolbar');
        expect(toolbar).not.toBeNull();
        expect(toolbar!.querySelectorAll('.omt-btn')).toHaveLength(3);
        expect(ITEM_TOOLBAR_CSS).toContain('.omt-item:hover .omt-toolbar { opacity: 1; visibility: visible; }');
    });

    it('Reply bubbles to the row and opens the thread (no stopPropagation)', () => {
        const {container, props} = renderRow();

        click(buttonByTitle(container, translateEn('panel.reply')));
        expect(props.onOpenThread).toHaveBeenCalledWith(props.thread);
    });

    it('Jump stops propagation and calls onJumpToPost instead', () => {
        const {container, props} = renderRow();

        click(buttonByTitle(container, translateEn('panel.jump')));
        expect(props.onJumpToPost).toHaveBeenCalledWith(props.thread);
        expect(props.onOpenThread).not.toHaveBeenCalled();
    });

    it('toolbar buttons swallow mousedown so they never take focus', () => {
        // A focused element removed on unmount breaks the host virtual list.
        const {container} = renderRow();

        for (const button of container.querySelectorAll('.omt-btn')) {
            expect(mouseDown(button).defaultPrevented).toBe(true);
        }
    });

    it('renders reaction chips with counts and toggles them on click', () => {
        const reactions: ReactionSummary[] = [
            {emojiName: '+1', count: 2, mine: true},
            {emojiName: 'tada', count: 1, mine: false},
        ];
        const {container, props} = renderRow({reactions});

        const chips = container.querySelectorAll('.omt-chip');
        expect(chips).toHaveLength(3); // two reactions + the add chip
        expect(chips[0].textContent).toContain('👍');
        expect(chips[0].textContent).toContain('2');
        expect(chips[1].textContent).toContain('🎉');
        expect(chips[1].textContent).not.toContain('1');

        click(chips[0]);
        expect(props.onToggleReaction).toHaveBeenCalledWith(props.thread, '+1');
        expect(props.onOpenThread).not.toHaveBeenCalled();
    });

    it('opens the emoji picker from the toolbar and toggles the picked emoji', () => {
        const {container, props} = renderRow({}, {}, true);

        const picker = container.querySelector('.omt-picker');
        expect(picker).not.toBeNull();

        const first = picker!.querySelector<HTMLButtonElement>('.omt-emoji')!;
        click(first);
        expect(props.onTogglePicker).toHaveBeenCalledWith('t1');
        expect(props.onToggleReaction).toHaveBeenCalledWith(props.thread, '+1');
        expect(props.onOpenThread).not.toHaveBeenCalled();
    });
});
