// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

// Hover toolbar styles for list items, kept close to the host's Saved
// Messages actions. Inline styles cannot express :hover, so a prefixed
// stylesheet is injected once with the panel.
export const ITEM_TOOLBAR_CSS = `
.omt-item { position: relative; }
.omt-toolbar {
    position: absolute;
    right: 12px;
    bottom: 6px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    opacity: 0;
    visibility: hidden;
    transition: opacity 120ms ease;
    z-index: 5;
}
.omt-item:hover .omt-toolbar { opacity: 1; visibility: visible; }
.omt-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    background: transparent;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 400;
    color: inherit;
    font-family: inherit;
}
.omt-btn:hover { background: var(--omt-hover); }
.omt-btn:focus { outline: 1px solid rgba(0, 0, 0, 0.2); }
.omt-picker {
    position: absolute;
    right: 12px;
    bottom: 34px;
    display: grid;
    grid-template-columns: repeat(6, auto);
    gap: 2px;
    padding: 6px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    z-index: 10;
}
.omt-emoji {
    border: 0;
    background: transparent;
    border-radius: 4px;
    padding: 4px;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    font-family: inherit;
}
.omt-emoji:hover { background: var(--omt-hover); }
.omt-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    max-height: 280px;
    overflow-y: auto;
    padding: 4px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.omt-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: inherit;
    font-family: inherit;
    text-align: left;
}
.omt-menu-item:hover { background: var(--omt-hover); }
`;

// Fallback colors used when the theme is not (yet) available in the store.
export const FALLBACK_TEXT = '#1f4157';
export const FALLBACK_LINK = '#166de0';
export const FALLBACK_ERROR = '#d24b4e';

export function withAlpha(color: string | undefined, alpha: number, fallback = FALLBACK_TEXT): string {
    const clean = (color || fallback).replace('#', '');
    if (clean.length !== 6) {
        return color || fallback;
    }
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Static style map for the panel. Theme-dependent styles are computed in
// the components from PanelColors; everything fixed lives here.
export const styles = {
    panel: {height: '100%', overflowY: 'auto'},
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
    },
    headerTitleWrap: {display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0},
    headerTitle: {fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap'},
    headerActions: {display: 'flex', alignItems: 'center', gap: '8px'},
    stateMessage: {padding: '16px'},
    refreshing: {padding: '8px 16px', fontSize: '12px'},
    item: {padding: '6px 16px 4px', cursor: 'pointer'},
    message: {fontSize: '15px', lineHeight: '1.45', marginBottom: '2px'},
    chipsRow: {display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px'},
    chipBase: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: '10px',
        padding: '1px 8px',
        fontSize: '12px',
        lineHeight: '1.5',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    dateRow: {display: 'flex', justifyContent: 'space-between', alignItems: 'center'},
    dateLabel: {fontSize: '12px'},
    replyCount: {fontSize: '13px'},
    authorButton: {fontSize: '12px', padding: '2px 6px', maxWidth: '140px', whiteSpace: 'nowrap'},
    authorSearch: {fontSize: '13px', padding: '4px 8px', marginBottom: '4px'},
    menuWrap: {position: 'relative'},
    noMatch: {padding: '6px 8px', fontSize: '12px'},
    avatar: {borderRadius: '50%', flexShrink: 0},
    showMore: {display: 'block', width: '100%', padding: '10px 16px', border: '0', cursor: 'pointer'},
    noMore: {padding: '8px 16px 12px', fontSize: '11px'},
    glyph: {flexShrink: 0},
} as const satisfies Record<string, React.CSSProperties>;
