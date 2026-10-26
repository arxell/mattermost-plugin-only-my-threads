// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';

import {withAlpha} from 'components/styles';
import type {PanelColors} from 'components/types';

const CHECKED_BOX = 'M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
const EMPTY_BOX = 'M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z';

// Closes an open header menu on any mousedown outside of the returned ref.
export function useMenuDismiss(open: boolean, close: () => void) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onDocMouseDown = (e: MouseEvent) => {
            if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
                close();
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
        };
    }, [open, close]);
    return ref;
}

// The dropdown panel colors shared by the header menus.
export function menuStyle({centerColor, toolbarBg}: PanelColors): React.CSSProperties {
    return {
        background: toolbarBg,
        border: `1px solid ${withAlpha(centerColor, 0.15)}`,
        '--omt-hover': withAlpha(centerColor, 0.08),
        color: centerColor,
    } as React.CSSProperties;
}

type CheckItemProps = {
    checked: boolean;
    colors: PanelColors;
    onToggle: () => void;
    children: React.ReactNode;
};

// One multiselect row: a checkbox glyph and a label. Toggling keeps the
// menu open, so several values can be picked in one go.
export function MenuCheckItem({checked, colors, onToggle, children}: CheckItemProps) {
    return (
        <button
            className={'omt-menu-item'}
            role={'menuitemcheckbox'}
            aria-checked={checked}
            onClick={onToggle}
        >
            <svg
                width={'16'}
                height={'16'}
                viewBox={'0 0 24 24'}
                fill={'currentColor'}
                aria-hidden={true}
                style={{color: checked ? colors.linkColor : colors.secondaryColor, flexShrink: 0}}
            >
                <path d={checked ? CHECKED_BOX : EMPTY_BOX}/>
            </svg>
            {children}
        </button>
    );
}
