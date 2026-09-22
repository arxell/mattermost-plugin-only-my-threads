// @vitest-environment jsdom

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';

import type {UserProfile} from '@mattermost/types/users';

import AuthorPicker from './AuthorPicker';
import type {PanelColors} from './types';

import {cleanup, render, translateEn} from '../../tests/test_utils';

vi.mock('i18n', async () => {
    const {translateEn: t} = await import('../../tests/test_utils');
    return {useTranslation: () => ({locale: 'en', t})};
});

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        getProfilePictureUrl: (id: string, ts: number) => `/api/v4/users/${id}/image?last_picture_update=${ts}`,
    },
}));

afterEach(cleanup);

const colors: PanelColors = {
    centerColor: '#1f4157',
    linkColor: '#166de0',
    secondaryColor: 'rgba(31, 65, 87, 0.6)',
    errorColor: '#d24b4e',
    toolbarBg: '#ffffff',
};

const member = (username: string, overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: username,
    username,
    first_name: '',
    last_name: '',
    nickname: '',
    ...overrides,
} as UserProfile);

const MEMBERS = [
    member('anton', {first_name: 'Anton', last_name: 'Gorodnikov'}),
    member('ilya', {nickname: 'Ilyusha'}),
    member('sasha'),
];

const renderPicker = (authorId: string | null = null) => {
    const props = {
        members: MEMBERS,
        authorId,
        colors,
        onSelect: vi.fn(),
    };
    const container = render(<AuthorPicker {...props}/>);
    return {container, props};
};

const click = (el: Element) => {
    act(() => {
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    });
};

const type = (input: HTMLInputElement, value: string) => {
    act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', {bubbles: true}));
    });
};

const openPicker = (container: HTMLElement) => {
    click(container.querySelector<HTMLButtonElement>('button[aria-expanded]')!);
    return container.querySelector('.omt-menu');
};

describe('AuthorPicker', () => {
    it('shows the filter label when no author is picked', () => {
        const {container} = renderPicker();
        const button = container.querySelector('button[aria-expanded]')!;
        expect(button.textContent).toContain(translateEn('panel.authorFilter'));
        expect(container.querySelector('.omt-menu')).toBeNull();
    });

    it('opens the menu with every member, avatars included', () => {
        const {container} = renderPicker();
        const menu = openPicker(container);

        expect(menu).not.toBeNull();
        const items = [...menu!.querySelectorAll<HTMLButtonElement>('.omt-menu-item')];
        expect(items[0].textContent).toBe(translateEn('panel.authorFilter'));
        expect(items.slice(1).map((item) => item.textContent)).toEqual(['anton', 'ilya', 'sasha']);

        const avatar = items[1].querySelector('img');
        expect(avatar?.getAttribute('src')).toContain('/api/v4/users/anton/image');
    });

    it('filters members by the search input, nicknames included', () => {
        const {container} = renderPicker();
        openPicker(container);
        const input = container.querySelector<HTMLInputElement>('input.form-control')!;

        type(input, 'ilyusha');
        const items = [...container.querySelectorAll('.omt-menu-item')];
        expect(items).toHaveLength(2); // the reset row plus the match
        expect(items[1].textContent).toBe('ilya');

        type(input, 'zzz');
        expect(container.textContent).toContain(translateEn('panel.noMatch'));
    });

    it('selects a member on click and closes the menu', () => {
        const {container, props} = renderPicker();
        openPicker(container);

        click([...container.querySelectorAll<HTMLButtonElement>('.omt-menu-item')][2]);
        expect(props.onSelect).toHaveBeenCalledWith('ilya');
        expect(container.querySelector('.omt-menu')).toBeNull();
    });

    it('Enter picks the first match, Escape closes the menu', () => {
        const {container, props} = renderPicker();
        openPicker(container);
        const input = container.querySelector<HTMLInputElement>('input.form-control')!;

        type(input, 'sash');
        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        });
        expect(props.onSelect).toHaveBeenCalledWith('sasha');

        // The menu is re-created on reopen, so the input must be re-queried.
        openPicker(container);
        const freshInput = container.querySelector<HTMLInputElement>('input.form-control')!;
        act(() => {
            freshInput.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        });
        expect(container.querySelector('.omt-menu')).toBeNull();
    });

    it('the reset row clears the picked author', () => {
        const {container, props} = renderPicker('ilya');

        // The button shows the picked member and the person glyph is on.
        const button = container.querySelector('button[aria-expanded]')!;
        expect(button.textContent).toContain('ilya');
        expect(container.querySelector('svg')).not.toBeNull();

        openPicker(container);
        click(container.querySelector<HTMLButtonElement>('.omt-menu-item')!);
        expect(props.onSelect).toHaveBeenCalledWith(null);
    });

    it('closes the menu on an outside mousedown', () => {
        const {container} = renderPicker();
        openPicker(container);
        expect(container.querySelector('.omt-menu')).not.toBeNull();

        act(() => {
            document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        });
        expect(container.querySelector('.omt-menu')).toBeNull();
    });
});
