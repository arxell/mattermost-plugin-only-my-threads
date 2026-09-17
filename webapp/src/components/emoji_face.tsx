// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {EMOJI_IMAGE_FILES} from 'utils/emoji_index';

import {Client4} from 'mattermost-redux/client';

// Frequently used system emoji offered in the panel picker and rendered
// as native unicode (no server round-trip). Every other reaction name
// resolves to a server image — custom or system.
export const PICKER_EMOJIS: Array<[string, string]> = [
    ['+1', '👍'], ['-1', '👎'], ['smile', '😄'], ['laughing', '😆'], ['joy', '😂'], ['wink', '😉'],
    ['tada', '🎉'], ['heart', '❤️'], ['eyes', '👀'], ['white_check_mark', '✅'], ['x', '❌'], ['question', '❓'],
    ['fire', '🔥'], ['clap', '👏'], ['wave', '👋'], ['rocket', '🚀'], ['thinking_face', '🤔'], ['pray', '🙏'],
];
const NATIVE_EMOJI: Record<string, string> = Object.fromEntries(PICKER_EMOJIS);

const srcCache = new Map<string, string>();
const failedNames = new Set<string>();
const inflight = new Map<string, Promise<string>>();

// Resolves a reaction name to an image URL: a custom emoji by id, or a
// system emoji by its /static/emoji file (the host names those files by
// the unified codepoints, not by the emoji name — the map comes from the
// host webapp's emoji.json). Cached for the session; concurrent lookups
// of one name deduplicate.
export function resolveEmojiSrc(name: string): Promise<string> {
    const cached = srcCache.get(name);
    if (cached) {
        return Promise.resolve(cached);
    }
    let pending = inflight.get(name);
    if (!pending) {
        pending = Client4.getCustomEmojiByName(name).
            then((emoji) => {
                const src = Client4.getCustomEmojiImageUrl(emoji.id);
                srcCache.set(name, src);
                return src;
            }).
            catch(() => {
                const file = EMOJI_IMAGE_FILES[name];
                if (!file) {
                    throw new Error(`unknown emoji name: ${name}`);
                }
                const src = Client4.getSystemEmojiImageUrl(file);
                srcCache.set(name, src);
                return src;
            }).
            finally(() => {
                inflight.delete(name);
            });
        inflight.set(name, pending);
    }
    return pending;
}

// Renders one reaction emoji: native unicode for the picker set, the
// server image for everything else (custom emoji included), and the
// ":name:" text while loading or when the image cannot be loaded.
export default function EmojiFace({name, size = 14}: {name: string; size?: number}) {
    const [src, setSrc] = useState<string | null>(null);
    const [failed, setFailed] = useState(failedNames.has(name));
    const native = NATIVE_EMOJI[name];

    useEffect(() => {
        if (native || failedNames.has(name)) {
            return undefined;
        }
        let cancelled = false;
        resolveEmojiSrc(name).then((resolved) => {
            if (!cancelled) {
                setSrc(resolved);
            }
        }).catch(() => {
            if (!cancelled) {
                setFailed(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [name, native]);

    if (native) {
        return <span>{native}</span>;
    }
    if (src && !failed) {
        return (
            <img
                src={src}
                alt={`:${name}:`}
                width={size}
                height={size}
                style={{display: 'block'}}
                onError={() => {
                    failedNames.add(name);
                    setFailed(true);
                }}
            />
        );
    }
    return <span>{`:${name}:`}</span>;
}
