// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

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
