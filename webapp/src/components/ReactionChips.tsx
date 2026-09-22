// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React from 'react';
import type {MyThread, ReactionSummary} from 'utils/threads';

import EmojiFace, {PICKER_EMOJIS} from 'components/emoji_face';
import {styles, withAlpha} from 'components/styles';
import type {PanelColors} from 'components/types';

type Props = {
    thread: MyThread;
    reactions: ReactionSummary[];
    pickerOpen: boolean;
    colors: PanelColors;
    onToggleReaction: (thread: MyThread, emojiName: string) => void;
    onTogglePicker: (threadId: string) => void;
};

// The reaction chips row of a thread row plus the inline emoji picker.
export default function ReactionChips({thread, reactions, pickerOpen, colors, onToggleReaction, onTogglePicker}: Props) {
    const {t} = useTranslation();
    const {centerColor, linkColor, secondaryColor, toolbarBg} = colors;

    return (
        <>
            {reactions.length > 0 ? (
                <div style={styles.chipsRow}>
                    {reactions.map((summary) => (
                        <button
                            key={summary.emojiName}
                            className={'omt-chip'}
                            title={`:${summary.emojiName}:`}
                            style={{
                                ...styles.chipBase,
                                color: centerColor,
                                border: `1px solid ${summary.mine ? linkColor : withAlpha(centerColor, 0.25)}`,
                                background: summary.mine ? withAlpha(linkColor, 0.1) : 'transparent',
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleReaction(thread, summary.emojiName);
                            }}
                        >
                            <EmojiFace name={summary.emojiName}/>
                            {summary.count > 1 ? summary.count : ''}
                        </button>
                    ))}
                    <button
                        className={'omt-chip'}
                        title={t('panel.addReaction')}
                        style={{
                            ...styles.chipBase,
                            color: secondaryColor,
                            border: `1px dashed ${withAlpha(centerColor, 0.3)}`,
                            background: 'transparent',
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePicker(thread.id);
                        }}
                    >
                        {'+'}
                    </button>
                </div>
            ) : null}
            {pickerOpen ? (
                <div
                    className={'omt-picker'}
                    style={{
                        background: toolbarBg,
                        border: `1px solid ${withAlpha(centerColor, 0.15)}`,
                        '--omt-hover': withAlpha(centerColor, 0.08),
                    } as React.CSSProperties}
                >
                    {PICKER_EMOJIS.map(([name, char]) => (
                        <button
                            key={name}
                            className={'omt-emoji'}
                            title={`:${name}:`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePicker(thread.id);
                                onToggleReaction(thread, name);
                            }}
                        >
                            {char}
                        </button>
                    ))}
                </div>
            ) : null}
        </>
    );
}
