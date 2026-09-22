// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import {createRoot} from 'react-dom/client';
import {act} from 'react-dom/test-utils';

import {messages} from '../src/i18n/messages';
import type {MessageId} from '../src/i18n/messages';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

// Renders a component into a fresh jsdom container and returns it.
export function render(ui: React.ReactElement): HTMLElement {
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        createRoot(container).render(ui);
    });
    return container;
}

export function cleanup() {
    document.body.innerHTML = '';
}

// The English t() for components that use the real useTranslation hook;
// test files wire it through vi.mock('i18n', ...).
export function translateEn(id: MessageId, values?: Record<string, string | number>): string {
    let text: string = messages.en[id] ?? id;
    for (const [key, value] of Object.entries(values ?? {})) {
        text = text.split(`{${key}}`).join(String(value));
    }
    return text;
}
