// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React, {useCallback, useState} from 'react';

import {MenuCheckItem, menuStyle, useMenuDismiss} from 'components/menu';
import {styles} from 'components/styles';
import {ALL_MODES} from 'components/types';
import type {PanelColors, ThreadMode, ThreadModes} from 'components/types';

type Props = {
    modes: ThreadModes;
    colors: PanelColors;
    onChange: (modes: ThreadModes) => void;
};

export const isAllModes = (modes: ThreadModes): boolean => modes.own && modes.mentioned;

// Grafana-style "All" multiselect: picking All checks every value;
// picking a value while All is on keeps just that value; unchecking the
// last value falls back to All, so the list never has no source.
export function toggleMode(modes: ThreadModes, choice: ThreadMode | 'all'): ThreadModes {
    if (choice === 'all') {
        return ALL_MODES;
    }
    if (isAllModes(modes)) {
        return {own: choice === 'own', mentioned: choice === 'mentioned'};
    }
    const next = {...modes, [choice]: !modes[choice]};
    return next.own || next.mentioned ? next : ALL_MODES;
}

// Which sources the list combines: the threads the picked people started
// and/or the ones they are mentioned in.
export default function ModePicker({modes, colors, onChange}: Props) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const close = useCallback(() => setOpen(false), []);
    const menuRef = useMenuDismiss(open, close);

    const all = isAllModes(modes);
    let buttonLabel: string = t('panel.modeAll');
    if (!all) {
        buttonLabel = modes.own ? t('panel.modeOwn') : t('panel.modeMentioned');
    }
    const pick = (choice: ThreadMode | 'all') => onChange(toggleMode(modes, choice));

    return (
        <div
            ref={menuRef}
            style={styles.menuWrap}
        >
            <button
                className={'btn btn-tertiary'}
                onClick={() => setOpen((wasOpen) => !wasOpen)}
                title={t('panel.modeFilter')}
                aria-label={`${t('panel.modeFilter')}: ${buttonLabel}`}
                aria-expanded={open}
                style={styles.authorButton}
            >
                {buttonLabel}
                {' ▾'}
            </button>
            {open ? (
                <div
                    className={'omt-menu'}
                    style={menuStyle(colors)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            close();
                        }
                    }}
                >
                    <MenuCheckItem
                        checked={all}
                        colors={colors}
                        onToggle={() => pick('all')}
                    >
                        {t('panel.modeAll')}
                    </MenuCheckItem>
                    <MenuCheckItem
                        checked={!all && modes.own}
                        colors={colors}
                        onToggle={() => pick('own')}
                    >
                        {t('panel.modeOwn')}
                    </MenuCheckItem>
                    <MenuCheckItem
                        checked={!all && modes.mentioned}
                        colors={colors}
                        onToggle={() => pick('mentioned')}
                    >
                        {t('panel.modeMentioned')}
                    </MenuCheckItem>
                </div>
            ) : null}
        </div>
    );
}
