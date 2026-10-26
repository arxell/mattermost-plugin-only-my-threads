// @vitest-environment jsdom

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';

import ModePicker, {toggleMode} from './ModePicker';
import {ALL_MODES} from './types';
import type {PanelColors, ThreadModes} from './types';

import {cleanup, render, translateEn} from '../../tests/test_utils';

vi.mock('i18n', async () => {
    const {translateEn: t} = await import('../../tests/test_utils');
    return {useTranslation: () => ({locale: 'en', t})};
});

afterEach(cleanup);

const colors: PanelColors = {
    centerColor: '#1f4157',
    linkColor: '#166de0',
    secondaryColor: 'rgba(31, 65, 87, 0.6)',
    errorColor: '#d24b4e',
    toolbarBg: '#ffffff',
};

const OWN: ThreadModes = {own: true, mentioned: false};
const MENTIONED: ThreadModes = {own: false, mentioned: true};

const renderPicker = (modes: ThreadModes = ALL_MODES) => {
    const props = {modes, colors, onChange: vi.fn()};
    const container = render(<ModePicker {...props}/>);
    return {container, props};
};

const click = (el: Element) => {
    act(() => {
        el.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    });
};

const openPicker = (container: HTMLElement) => {
    click(container.querySelector<HTMLButtonElement>('button[aria-expanded]')!);
    return [...container.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')];
};

describe('toggleMode', () => {
    it('All checks every value', () => {
        expect(toggleMode(OWN, 'all')).toEqual(ALL_MODES);
    });

    it('a value picked while All is on becomes the only one', () => {
        expect(toggleMode(ALL_MODES, 'own')).toEqual(OWN);
        expect(toggleMode(ALL_MODES, 'mentioned')).toEqual(MENTIONED);
    });

    it('adding the other value turns into All, removing the last falls back to All', () => {
        expect(toggleMode(OWN, 'mentioned')).toEqual(ALL_MODES);
        expect(toggleMode(OWN, 'own')).toEqual(ALL_MODES);
    });
});

describe('ModePicker', () => {
    it('labels the button by the picked mode', () => {
        const label = (modes: ThreadModes) => {
            cleanup();
            const {container} = renderPicker(modes);
            return container.querySelector('button[aria-expanded]')!.textContent;
        };
        expect(label(ALL_MODES)).toContain(translateEn('panel.modeAll'));
        expect(label(OWN)).toContain(translateEn('panel.modeOwn'));
        expect(label(MENTIONED)).toContain(translateEn('panel.modeMentioned'));
    });

    it('checks only All by default, like Grafana', () => {
        const {container} = renderPicker();
        const items = openPicker(container);

        expect(items.map((item) => item.textContent)).toEqual([
            translateEn('panel.modeAll'),
            translateEn('panel.modeOwn'),
            translateEn('panel.modeMentioned'),
        ]);
        expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    });

    it('a click reports the toggled modes and keeps the menu open', () => {
        const {container, props} = renderPicker(OWN);
        const items = openPicker(container);
        expect(items.map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);

        click(items[2]);
        expect(props.onChange).toHaveBeenCalledWith(ALL_MODES);
        expect(container.querySelector('.omt-menu')).not.toBeNull();
    });

    it('closes on Escape and on an outside mousedown', () => {
        const {container} = renderPicker();
        const items = openPicker(container);
        act(() => {
            items[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        });
        expect(container.querySelector('.omt-menu')).toBeNull();

        openPicker(container);
        act(() => {
            document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        });
        expect(container.querySelector('.omt-menu')).toBeNull();
    });
});
