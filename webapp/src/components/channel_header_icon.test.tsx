// @vitest-environment jsdom

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import ChannelHeaderIcon from './channel_header_icon';

import {cleanup, render, translateEn} from '../../tests/test_utils';

vi.mock('i18n', async () => {
    const {translateEn: t} = await import('../../tests/test_utils');
    return {useTranslation: () => ({locale: 'en', t})};
});

afterEach(cleanup);

describe('ChannelHeaderIcon', () => {
    it('renders the icon with the localized panel title', () => {
        const container = render(<ChannelHeaderIcon/>);
        const icon = container.querySelector('[role="icon"]');
        expect(icon?.getAttribute('aria-label')).toBe(translateEn('panel.title'));
        expect(container.querySelector('svg')).not.toBeNull();
    });

    it('uses the fixed brand blue instead of currentColor', () => {
        // The App Bar renders plugin icons on a white plate; currentColor
        // would be invisible there.
        const container = render(<ChannelHeaderIcon/>);
        const strokes = [...container.querySelectorAll('[stroke]')].map((el) => el.getAttribute('stroke'));
        expect(strokes.length).toBeGreaterThan(0);
        expect(new Set(strokes)).toEqual(new Set(['#1C58D9']));
    });
});
