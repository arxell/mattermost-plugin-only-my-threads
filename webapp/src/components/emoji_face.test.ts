// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {Mock} from 'vitest';

import {Client4} from 'mattermost-redux/client';

import {PICKER_EMOJIS, resolveEmojiSrc} from './emoji_face';

vi.mock('mattermost-redux/client', () => ({
    Client4: {
        getCustomEmojiByName: vi.fn(),
        getCustomEmojiImageUrl: vi.fn((id: string) => `/api/v4/emoji/${id}/image`),
        getSystemEmojiImageUrl: vi.fn((name: string) => `/api/v4/emoji/${name}/image`),
    },
}));

const mockedCustomByName = Client4.getCustomEmojiByName as Mock;

describe('resolveEmojiSrc', () => {
    beforeEach(() => {
        mockedCustomByName.mockReset();
    });

    it('uses the custom emoji image when the name is a custom emoji', async () => {
        mockedCustomByName.mockResolvedValue({id: 'ce1', name: 'local_art'});
        await expect(resolveEmojiSrc('local_art')).resolves.toBe('/api/v4/emoji/ce1/image');
        expect(mockedCustomByName).toHaveBeenCalledWith('local_art');
    });

    it('falls back to the system emoji image when the custom lookup 404s', async () => {
        mockedCustomByName.mockRejectedValue(new Error('404'));
        await expect(resolveEmojiSrc('art')).resolves.toBe('/api/v4/emoji/1f3a8/image');
        expect(Client4.getSystemEmojiImageUrl).toHaveBeenCalledWith('1f3a8');
    });

    it('rejects names the system emoji map does not know', async () => {
        mockedCustomByName.mockRejectedValue(new Error('404'));
        await expect(resolveEmojiSrc('definitely_not_an_emoji')).rejects.toThrow('unknown emoji name');
    });

    it('caches the resolved URL and does not refetch it', async () => {
        mockedCustomByName.mockResolvedValue({id: 'ce2', name: 'party_parrot'});
        await resolveEmojiSrc('party_parrot');
        await resolveEmojiSrc('party_parrot');
        expect(mockedCustomByName).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent lookups of the same name', async () => {
        let release: (value: {id: string}) => void = () => {};
        mockedCustomByName.mockReturnValue(new Promise((resolve) => {
            release = resolve;
        }));
        const first = resolveEmojiSrc('slowmo');
        const second = resolveEmojiSrc('slowmo');
        release({id: 'ce3'});
        await expect(first).resolves.toBe('/api/v4/emoji/ce3/image');
        await expect(second).resolves.toBe('/api/v4/emoji/ce3/image');
        expect(mockedCustomByName).toHaveBeenCalledTimes(1);
    });

    it('ships a native unicode face for every picker emoji', () => {
        for (const [name, char] of PICKER_EMOJIS) {
            expect(char).not.toBe(`:${name}:`);
        }
    });
});
