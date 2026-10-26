// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React, {useCallback, useState} from 'react';
import {filterMembers} from 'utils/members';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {MenuCheckItem, menuStyle, useMenuDismiss} from 'components/menu';
import {styles} from 'components/styles';
import type {PanelColors} from 'components/types';

type Props = {
    members: UserProfile[];
    currentUserId: string;
    selectedIds: string[];
    colors: PanelColors;
    onChange: (selectedIds: string[]) => void;
};

// Checks or unchecks exactly one person — never touching the others, so
// the selection may become empty (the panel then asks to pick someone).
export function togglePerson(selectedIds: string[], id: string): string[] {
    return selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id];
}

// Whose threads the list shows: the current user ("Me", first and checked
// by default) and/or any channel members, several at once (a custom menu —
// native <option>s cannot render member avatars).
export default function AuthorPicker({members, currentUserId, selectedIds, colors, onChange}: Props) {
    const {t} = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const close = useCallback(() => setOpen(false), []);
    const menuRef = useMenuDismiss(open, close);

    const {secondaryColor} = colors;

    const others = members.filter((m) => m.id !== currentUserId);
    const matches = filterMembers(others, query);
    const me = members.find((m) => m.id === currentUserId);
    const toggle = (id: string) => onChange(togglePerson(selectedIds, id));

    const nameOf = (id: string) => (id === currentUserId ? t('panel.me') : members.find((m) => m.id === id)?.username ?? '…');
    let buttonLabel: string = t('panel.peopleCount', {count: selectedIds.length});
    if (selectedIds.length === 0) {
        buttonLabel = t('panel.nobody');
    } else if (selectedIds.length <= 2) {
        buttonLabel = selectedIds.map(nameOf).join(', ');
    }
    const onlyMe = selectedIds.length === 1 && selectedIds[0] === currentUserId;

    const avatar = (profile: UserProfile | undefined, id: string) => (
        <img
            src={Client4.getProfilePictureUrl(id, profile?.last_picture_update ?? 0)}
            alt={''}
            width={18}
            height={18}
            style={styles.avatar}
        />
    );

    return (
        <>
            {/* The person glyph marks that the list shows someone besides "Me". */}
            {onlyMe ? null : (
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
            )}
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
                    aria-label={`${t('panel.authorFilter')}: ${buttonLabel}`}
                    aria-expanded={open}
                    style={styles.authorButton}
                >
                    {buttonLabel}
                    {' ▾'}
                </button>
                {open ? (
                    <div
                        className={'omt-menu'}
                        style={menuStyle(colors)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                close();
                            }
                        }}
                    >
                        <MenuCheckItem
                            checked={selectedIds.includes(currentUserId)}
                            colors={colors}
                            onToggle={() => toggle(currentUserId)}
                        >
                            {avatar(me, currentUserId)}
                            {t('panel.me')}
                        </MenuCheckItem>
                        <input
                            type={'text'}
                            className={'form-control'}
                            value={query}
                            autoFocus={true}
                            placeholder={t('panel.authorSearch')}
                            aria-label={t('panel.authorSearch')}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && matches.length > 0) {
                                    toggle(matches[0].id);
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
                            <MenuCheckItem
                                key={m.id}
                                checked={selectedIds.includes(m.id)}
                                colors={colors}
                                onToggle={() => toggle(m.id)}
                            >
                                {avatar(m, m.id)}
                                {m.username}
                            </MenuCheckItem>
                        ))}
                    </div>
                ) : null}
            </div>
        </>
    );
}
