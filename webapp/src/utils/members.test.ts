// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {fetchAllChannelMembers, filterMembers} from './members';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getProfilesInChannel: jest.fn(),
    },
}));

const mockedProfilesInChannel = Client4.getProfilesInChannel as jest.Mock;

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

describe('fetchAllChannelMembers', () => {
    const member = (username: string): UserProfile => ({id: username, username} as UserProfile);

    beforeEach(() => {
        mockedProfilesInChannel.mockReset();
    });

    it('loads pages until a short page arrives', async () => {
        const page0 = Array.from({length: 200}, (_, i) => member('u' + String(i).padStart(3, '0')));
        const page1 = Array.from({length: 200}, (_, i) => member('u' + String(i + 200).padStart(3, '0')));
        const page2 = [member('zz9')];
        mockedProfilesInChannel.
            mockResolvedValueOnce(page0).
            mockResolvedValueOnce(page1).
            mockResolvedValueOnce(page2);

        const members = await fetchAllChannelMembers('ch1');

        expect(mockedProfilesInChannel).toHaveBeenCalledTimes(3);
        expect(mockedProfilesInChannel).toHaveBeenLastCalledWith('ch1', 2, 200);
        expect(members).toHaveLength(401);
    });

    it('stops after one short page for small channels', async () => {
        mockedProfilesInChannel.mockResolvedValue([member('a'), member('b')]);

        const members = await fetchAllChannelMembers('ch1');

        expect(mockedProfilesInChannel).toHaveBeenCalledTimes(1);
        expect(members.map((m) => m.username)).toEqual(['a', 'b']);
    });

    it('is bounded to 25 pages', async () => {
        mockedProfilesInChannel.mockResolvedValue(Array.from({length: 200}, (_, i) => member('x' + i)));

        await fetchAllChannelMembers('ch1');

        expect(mockedProfilesInChannel).toHaveBeenCalledTimes(25);
    });

    it('sorts the result by username', async () => {
        mockedProfilesInChannel.mockResolvedValue([member('zeta'), member('alpha')]);

        const members = await fetchAllChannelMembers('ch1');

        expect(members.map((m) => m.username)).toEqual(['alpha', 'zeta']);
    });
});

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
