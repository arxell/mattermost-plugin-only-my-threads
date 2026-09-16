// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentUserLocale} from 'mattermost-redux/selectors/entities/i18n';

import {messages} from './messages';
import type {MessageId} from './messages';

export function getLocale(state: GlobalState): string {
    return getCurrentUserLocale(state, 'en');
}

// Translates a message id for the given locale with optional {placeholder}
// interpolation. Unknown locales and ids fall back to English and to the id.
export function translate(locale: string, id: MessageId, values?: Record<string, string | number>): string {
    const table = messages[locale as keyof typeof messages] ?? messages.en;
    let text: string = table[id] ?? messages.en[id] ?? id;
    if (values) {
        for (const [key, value] of Object.entries(values)) {
            text = text.split(`{${key}}`).join(String(value));
        }
    }
    return text;
}

// React hook: re-renders the component when the user changes their language.
export function useTranslation() {
    const locale = useSelector((state: GlobalState) => getLocale(state));
    return {
        locale,
        t: (id: MessageId, values?: Record<string, string | number>) => translate(locale, id, values),
    };
}
