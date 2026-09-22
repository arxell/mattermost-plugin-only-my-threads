// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React, {useEffect, useRef, useState} from 'react';
import {filterMembers} from 'utils/members';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {styles, withAlpha} from 'components/styles';
import type {PanelColors} from 'components/types';

type Props = {
    members: UserProfile[];
    authorId: string | null;
    colors: PanelColors;
    onSelect: (authorId: string | null) => void;
};

// Whose threads the list shows: the current user by default, or any
// channel member picked in the header dropdown (a custom menu —
// native <option>s cannot render member avatars).
export default function AuthorPicker({members, authorId, colors, onSelect}: Props) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const menuRef = useRef<HTMLDivElement | null>(null);

    const {centerColor, linkColor, secondaryColor, toolbarBg} = colors;

    // Closes the menu on any click outside of it.
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onDocMouseDown = (e: MouseEvent) => {
            if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
        };
    }, [open]);

    const authorProfile = authorId ? members.find((m) => m.id === authorId) : null;
    const matches = filterMembers(members, query);

    const pick = (id: string | null) => {
        setOpen(false);
        onSelect(id);
    };

    return (
        <>
            {/* The person glyph marks that a member filter is on. */}
            {authorId ? (
                <svg
                    width={'14'}
                    height={'14'}
                    viewBox={'0 0 24 24'}
                    fill={'currentColor'}
                    aria-hidden={true}
                    style={{color: secondaryColor, flexShrink: 0}}
                >
                    <path d={'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'}/>
                </svg>
            ) : null}
            <div
                ref={menuRef}
                style={styles.menuWrap}
            >
                <button
                    className={'btn btn-tertiary'}
                    onClick={() => {
                        setOpen((wasOpen) => {
                            if (!wasOpen) {
                                setQuery('');
                            }
                            return !wasOpen;
                        });
                    }}
                    title={t('panel.authorFilter')}
                    aria-label={t('panel.authorFilter')}
                    aria-expanded={open}
                    style={styles.authorButton}
                >
                    {authorProfile ? authorProfile.username : t('panel.authorFilter')}
                    {' ▾'}
                </button>
                {open ? (
                    <div
                        className={'omt-menu'}
                        style={{
                            background: toolbarBg,
                            border: `1px solid ${withAlpha(centerColor, 0.15)}`,
                            '--omt-hover': withAlpha(centerColor, 0.08),
                            color: centerColor,
                        } as React.CSSProperties}
                    >
                        <button
                            className={'omt-menu-item'}
                            onClick={() => pick(null)}
                        >
                            <svg
                                width={'16'}
                                height={'16'}
                                viewBox={'0 0 24 24'}
                                fill={'currentColor'}
                                aria-hidden={true}
                                style={{color: secondaryColor, flexShrink: 0}}
                            >
                                <path d={'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'}/>
                            </svg>
                            {t('panel.authorFilter')}
                        </button>
                        <input
                            type={'text'}
                            className={'form-control'}
                            value={query}
                            autoFocus={true}
                            placeholder={t('panel.authorSearch')}
                            aria-label={t('panel.authorSearch')}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setOpen(false);
                                } else if (e.key === 'Enter' && matches.length > 0) {
                                    pick(matches[0].id);
                                }
                            }}
                            style={styles.authorSearch}
                        />
                        {matches.length === 0 ? (
                            <div style={{...styles.noMatch, color: secondaryColor}}>
                                {t('panel.noMatch')}
                            </div>
                        ) : null}
                        {matches.map((m) => (
                            <button
                                key={m.id}
                                className={'omt-menu-item'}
                                onClick={() => pick(m.id)}
                                style={m.id === authorId ? {background: withAlpha(linkColor, 0.1)} : undefined}
                            >
                                <img
                                    src={Client4.getProfilePictureUrl(m.id, m.last_picture_update)}
                                    alt={''}
                                    width={18}
                                    height={18}
                                    style={styles.avatar}
                                />
                                {m.username}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
        </>
    );
}
