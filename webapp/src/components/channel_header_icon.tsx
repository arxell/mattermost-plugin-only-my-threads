// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React from 'react';

// A filled "message card with text lines" glyph. The App Bar renders plugin
// icons on a white circular plate and expects a colored logo (like the host's
// own plugin icons), so the card uses a fixed brand blue instead of
// currentColor — white-on-white would be invisible.
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
                aria-hidden={'true'}
            >
                <path
                    fill={'#166de0'}
                    fillRule={'evenodd'}
                    style={{fill: '#166de0', stroke: 'none'}}
                    d={'M6 4.75h12A2.25 2.25 0 0 1 20.25 7v10A2.25 2.25 0 0 1 18 19.25H6A2.25 2.25 0 0 1 3.75 17V7A2.25 2.25 0 0 1 6 4.75Zm1.25 3.4v1.7h9.5v-1.7h-9.5Zm0 3.15v1.7h9.5v-1.7h-9.5Zm0 3.15v1.7h6v-1.7h-6Z'}
                />
            </svg>
        </span>
    );
}
