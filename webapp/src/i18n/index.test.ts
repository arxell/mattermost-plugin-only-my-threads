// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, expect, it} from 'vitest';

import type {MessageId} from './messages';

import {translate} from './index';

describe('translate', () => {
    it('translates known ids for each shipped locale', () => {
        expect(translate('en', 'panel.title')).toBe('My threads in this channel');
        expect(translate('ru', 'panel.reply')).toBe('Ответить');
        expect(translate('fr', 'panel.loading')).toBe('Chargement…');
        expect(translate('de', 'panel.jump')).toBe('Springen');
    });

    it('falls back to English for unknown locales', () => {
        expect(translate('es', 'panel.title')).toBe('My threads in this channel');
        expect(translate('', 'panel.loading')).toBe('Loading…');
    });

    it('returns the id itself for unknown keys', () => {
        expect(translate('en', 'panel.nope' as MessageId)).toBe('panel.nope');
        expect(translate('ru', 'panel.nope' as MessageId)).toBe('panel.nope');
    });

    it('interpolates {placeholders}', () => {
        expect(translate('en', 'panel.loadError', {message: 'boom'})).toBe('Failed to load: boom');
        expect(translate('de', 'panel.showMore', {month: 'August'})).toBe('Mehr anzeigen: August');
        expect(translate('fr', 'panel.showMore', {month: 'août'})).toBe('Afficher plus : août');
    });

    it('stringifies numeric placeholder values', () => {
        expect(translate('en', 'panel.showMore', {month: 8})).toBe('Show more: 8');
    });
});
