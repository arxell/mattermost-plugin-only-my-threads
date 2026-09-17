// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {messages} from './messages';

const locales = Object.keys(messages) as Array<keyof typeof messages>;

const table = (locale: keyof typeof messages): Record<string, string> =>
    messages[locale] as unknown as Record<string, string>;

const placeholders = (text: string): string[] =>
    (text.match(/\{(\w+)\}/g) ?? []).sort();

describe('i18n dictionaries', () => {
    it('every locale defines exactly the same keys as English', () => {
        for (const locale of locales) {
            expect(Object.keys(table(locale)).sort()).toEqual(Object.keys(messages.en).sort());
        }
    });

    it('every value is a non-empty string', () => {
        for (const locale of locales) {
            for (const value of Object.values(table(locale))) {
                expect(typeof value).toBe('string');
                expect(value.length).toBeGreaterThan(0);
            }
        }
    });

    it('every key uses the same {placeholders} in all languages', () => {
        for (const locale of locales) {
            for (const key of Object.keys(messages.en)) {
                expect(placeholders(table(locale)[key])).toEqual(placeholders(table('en')[key]));
            }
        }
    });
});
