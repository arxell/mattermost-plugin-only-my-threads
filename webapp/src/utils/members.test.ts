// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {filterMembers} from './members';

const member = (username: string, overrides: Partial<UserProfile> = {}): UserProfile => ({
    id: username,
    username,
    first_name: '',
    last_name: '',
    nickname: '',
    ...overrides,
} as UserProfile);

const TEAM = [
    member('anton', {first_name: 'Anton', last_name: 'Gorodnikov'}),
    member('ilya', {nickname: 'Ilyusha'}),
    member('sasha'),
];

describe('filterMembers', () => {
    it('returns the full list for an empty query', () => {
        expect(filterMembers(TEAM, '')).toEqual(TEAM);
        expect(filterMembers(TEAM, '   ')).toEqual(TEAM);
    });

    it('matches usernames as a case-insensitive substring', () => {
        expect(filterMembers(TEAM, 'IL')).toEqual([TEAM[1]]);
        expect(filterMembers(TEAM, 'sash')).toEqual([TEAM[2]]);
    });

    it('matches first and last names, not just usernames', () => {
        expect(filterMembers(TEAM, 'gorodn')).toEqual([TEAM[0]]);
        expect(filterMembers(TEAM, 'anton')).toEqual([TEAM[0]]);
    });

    it('matches nicknames', () => {
        expect(filterMembers(TEAM, 'ilyusha')).toEqual([TEAM[1]]);
    });

    it('ignores empty profile fields when matching', () => {
        // sasha has no names or nickname set; a spaces-only haystack must
        // not crash or match everything.
        expect(filterMembers(TEAM, 'zzz')).toEqual([]);
        expect(filterMembers([TEAM[2]], 'a')).toEqual([TEAM[2]]);
    });

    it('keeps several members when several match', () => {
        expect(filterMembers([...TEAM, member('antonio')], 'ant')).toEqual([TEAM[0], member('antonio')]);
    });
});
