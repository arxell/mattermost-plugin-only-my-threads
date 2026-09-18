// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

// The members endpoint pages properly (unlike search) and its default
// ordering is Username ASC, so sequential offset paging is reliable.
const MEMBERS_PAGE_SIZE = 200;

// Bounds the fetch on pathologically huge channels (~5k members).
const MAX_MEMBER_PAGES = 25;

// Loads every channel member's profile, page by page, until a short
// page arrives. The server already orders by username; the final sort
// is a cheap safety net.
export async function fetchAllChannelMembers(channelId: string): Promise<UserProfile[]> {
    const all: UserProfile[] = [];
    for (let page = 0; page < MAX_MEMBER_PAGES; page++) {
        // Pages are sequential by nature: the stop condition needs the
        // previous page's length.
        // eslint-disable-next-line no-await-in-loop
        const profiles = await Client4.getProfilesInChannel(channelId, page, MEMBERS_PAGE_SIZE);
        all.push(...profiles);
        if (profiles.length < MEMBERS_PAGE_SIZE) {
            break;
        }
    }
    return all.sort((a, b) => a.username.localeCompare(b.username));
}

// Filters channel members for the author dropdown search: a case-
// insensitive substring match over the nickname and the real names.
// An empty query returns the full list unchanged.
export function filterMembers(members: UserProfile[], query: string): UserProfile[] {
    const q = query.trim().toLowerCase();
    if (!q) {
        return members;
    }
    return members.filter((m) => {
        const haystack = [m.username, m.first_name, m.last_name, m.nickname].
            filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
    });
}
