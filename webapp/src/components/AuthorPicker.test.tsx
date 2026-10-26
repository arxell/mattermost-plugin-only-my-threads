// @vitest-environment jsdom

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';

import type {UserProfile} from '@mattermost/types/users';

import AuthorPicker, {togglePerson} from './AuthorPicker';
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

// "anton" is the current user; he is listed once, as the "Me" row.
const MEMBERS = [
    member('anton', {first_name: 'Anton', last_name: 'Gorodnikov'}),
    member('ilya', {nickname: 'Ilyusha'}),
    member('sasha'),
];

const renderPicker = (selectedIds: string[] = ['anton']) => {
    const props = {
        members: MEMBERS,
        currentUserId: 'anton',
        selectedIds,
        colors,
        onChange: vi.fn(),
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

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')];

describe('togglePerson', () => {
    it('toggles exactly the clicked person and never the others', () => {
        expect(togglePerson(['anton'], 'ilya')).toEqual(['anton', 'ilya']);
        expect(togglePerson(['anton', 'ilya'], 'anton')).toEqual(['ilya']);

        // Regressions: "Me" alone must uncheck, and unchecking the last
        // other person must not bring "Me" back.
        expect(togglePerson(['anton'], 'anton')).toEqual([]);
        expect(togglePerson(['ilya'], 'ilya')).toEqual([]);
    });
});

describe('AuthorPicker', () => {
    it('labels the button by the picked people', () => {
        const label = (selectedIds: string[]) => {
            cleanup();
            const {container} = renderPicker(selectedIds);
            return container.querySelector('button[aria-expanded]')!.textContent;
        };
        expect(label([])).toContain(translateEn('panel.nobody'));
        expect(label(['anton'])).toContain(translateEn('panel.me'));
        expect(label(['ilya'])).toContain('ilya');
        expect(label(['anton', 'ilya'])).toContain(`${translateEn('panel.me')}, ilya`);
        expect(label(['anton', 'ilya', 'sasha'])).toContain(translateEn('panel.peopleCount', {count: 3}));
    });

    it('lists "Me" first, checked by default, then the other members with avatars', () => {
        const {container} = renderPicker();
        const menu = openPicker(container);

        expect(menu).not.toBeNull();
        const items = rows(container);
        expect(items.map((item) => item.textContent)).toEqual([translateEn('panel.me'), 'ilya', 'sasha']);
        expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
        expect(items[0].querySelector('img')?.getAttribute('src')).toContain('/api/v4/users/anton/image');
        expect(items[1].querySelector('img')?.getAttribute('src')).toContain('/api/v4/users/ilya/image');
    });

    it('filters members by the search input, nicknames included', () => {
        const {container} = renderPicker();
        openPicker(container);
        const input = container.querySelector<HTMLInputElement>('input.form-control')!;

        type(input, 'ilyusha');
        const items = rows(container);
        expect(items).toHaveLength(2); // the "Me" row plus the match
        expect(items[1].textContent).toBe('ilya');

        type(input, 'zzz');
        expect(container.textContent).toContain(translateEn('panel.noMatch'));
    });

    it('toggling a member adds them and keeps the menu open', () => {
        const {container, props} = renderPicker();
        openPicker(container);

        click(rows(container)[1]);
        expect(props.onChange).toHaveBeenCalledWith(['anton', 'ilya']);
        expect(container.querySelector('.omt-menu')).not.toBeNull();
    });

    it('unchecking "Me" leaves only the other picked people', () => {
        const {container, props} = renderPicker(['anton', 'sasha']);
        openPicker(container);

        click(rows(container)[0]);
        expect(props.onChange).toHaveBeenCalledWith(['sasha']);
    });

    it('"Me" alone unchecks, and the last other person unchecks without checking "Me"', () => {
        const {container, props} = renderPicker(['anton']);
        openPicker(container);
        click(rows(container)[0]);
        expect(props.onChange).toHaveBeenLastCalledWith([]);

        cleanup();
        const {container: other, props: otherProps} = renderPicker(['ilya']);
        openPicker(other);
        expect(rows(other).map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
        click(rows(other)[1]);
        expect(otherProps.onChange).toHaveBeenLastCalledWith([]);
    });

    it('Enter toggles the first match, Escape closes the menu', () => {
        const {container, props} = renderPicker();
        openPicker(container);
        const input = container.querySelector<HTMLInputElement>('input.form-control')!;

        type(input, 'sash');
        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        });
        expect(props.onChange).toHaveBeenCalledWith(['anton', 'sasha']);

        act(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        });
        expect(container.querySelector('.omt-menu')).toBeNull();

        // Escape also works with the focus on a row (after a click on it).
        openPicker(container);
        act(() => {
            rows(container)[1].dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        });
        expect(container.querySelector('.omt-menu')).toBeNull();
    });

    it('shows the person glyph only when someone besides "Me" is picked', () => {
        const {container} = renderPicker();
        expect(container.querySelector(':scope > svg')).toBeNull();

        cleanup();
        const {container: others} = renderPicker(['ilya']);
        expect(others.querySelector(':scope > svg')).not.toBeNull();
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
