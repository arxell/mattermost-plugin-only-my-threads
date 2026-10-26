// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Theme colors resolved once by the panel and passed down to the parts.
export interface PanelColors {
    centerColor: string;
    linkColor: string;
    secondaryColor: string;
    errorColor: string;
    toolbarBg: string;
}

// The list sources picked in the Mode dropdown; both on is "All".
export interface ThreadModes {
    own: boolean;
    mentioned: boolean;
}

export type ThreadMode = keyof ThreadModes;

export const ALL_MODES: ThreadModes = {own: true, mentioned: true};
