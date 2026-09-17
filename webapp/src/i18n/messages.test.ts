// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {messages} from './messages';

const placeholders = (text: string): string[] =>
    (text.match(/\{(\w+)\}/g) ?? []).sort();

describe('i18n dictionaries', () => {
    it('en and ru define exactly the same keys', () => {
        expect(Object.keys(messages.ru).sort()).toEqual(Object.keys(messages.en).sort());
    });

    it('every value is a non-empty string', () => {
        for (const table of [messages.en, messages.ru]) {
            for (const value of Object.values(table)) {
                expect(typeof value).toBe('string');
                expect((value as string).length).toBeGreaterThan(0);
            }
        }
    });

    it('every key uses the same {placeholders} in both languages', () => {
        for (const key of Object.keys(messages.en)) {
            expect(placeholders(String(messages.ru[key as keyof typeof messages.ru]))).
                toEqual(placeholders(String(messages.en[key as keyof typeof messages.en])));
        }
    });
});
