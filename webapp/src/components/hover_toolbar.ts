// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Shared hover-toolbar styles used by both thread lists (the channel RHS
// panel and the global My threads page), so the two stay pixel-identical.
// The picker emoji table and the emoji rendering live in
// components/emoji_face.tsx.

// Hover toolbar styles for list items, kept close to the host's Saved
// Messages actions. Inline styles cannot express :hover, so a prefixed
// stylesheet is injected once with each list.
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
`;
