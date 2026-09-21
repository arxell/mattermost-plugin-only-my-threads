// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, expect, it} from 'vitest';

import {formatPanelDate} from './dates';

describe('formatPanelDate', () => {
    // September 17, 2026, 17:06 local time.
    const ms = new Date(2026, 8, 17, 17, 6).getTime();

    it('formats the date as dd.mm.yy with dots in every locale', () => {
        expect(formatPanelDate(ms, 'en').startsWith('17.09.26, ')).toBe(true);
        expect(formatPanelDate(ms, 'ru').startsWith('17.09.26, ')).toBe(true);
        expect(formatPanelDate(ms, 'fr').startsWith('17.09.26, ')).toBe(true);
        expect(formatPanelDate(ms, 'de').startsWith('17.09.26, ')).toBe(true);
    });

    it('pads single-digit days and months with a leading zero', () => {
        const early = new Date(2026, 0, 5, 9, 7).getTime();
        expect(formatPanelDate(early, 'en').startsWith('05.01.26, ')).toBe(true);
    });

    it('keeps the locale hour convention for the time part', () => {
        expect(formatPanelDate(ms, 'en-US')).toBe('17.09.26, 05:06 PM');
        expect(formatPanelDate(ms, 'ru-RU')).toBe('17.09.26, 17:06');
    });

    it('uses a two-digit year', () => {
        const old = new Date(1999, 11, 31, 23, 59).getTime();
        expect(formatPanelDate(old, 'en-US').startsWith('31.12.99, ')).toBe(true);
    });
});
