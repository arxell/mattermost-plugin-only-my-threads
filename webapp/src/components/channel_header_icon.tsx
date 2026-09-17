// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React from 'react';

// Three stacked message cards with a checkmark — "my threads, answered".
// The App Bar renders plugin icons on a white circular plate, so the glyph
// uses a fixed brand blue instead of currentColor — white-on-white would
// be invisible.
export default function ChannelHeaderIcon() {
    const {t} = useTranslation();
    return (
        <span
            aria-label={t('panel.title')}
            role={'icon'}
        >
            <svg
                width={'20'}
                height={'20'}
                viewBox={'0 0 24 24'}
                fill={'none'}
                aria-hidden={'true'}
            >
                <rect
                    x={'8'}
                    y={'3'}
                    width={'12'}
                    height={'8'}
                    rx={'1.5'}
                    stroke={'#1C58D9'}
                    strokeWidth={'1.5'}
                    strokeLinecap={'round'}
                    opacity={'0.35'}
                />
                <rect
                    x={'5'}
                    y={'6'}
                    width={'12'}
                    height={'8'}
                    rx={'1.5'}
                    stroke={'#1C58D9'}
                    strokeWidth={'1.5'}
                    strokeLinecap={'round'}
                    opacity={'0.55'}
                />
                <rect
                    x={'2'}
                    y={'9'}
                    width={'12'}
                    height={'8'}
                    rx={'1.5'}
                    stroke={'#1C58D9'}
                    strokeWidth={'1.5'}
                    strokeLinecap={'round'}
                />
                <path
                    d={'M5 13h6'}
                    stroke={'#1C58D9'}
                    strokeWidth={'1.5'}
                    strokeLinecap={'round'}
                />
                <path
                    d={'M16 19l2 2 4-4'}
                    stroke={'#1C58D9'}
                    strokeWidth={'1.75'}
                    strokeLinecap={'round'}
                    strokeLinejoin={'round'}
                />
            </svg>
        </span>
    );
}
