// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React from 'react';
import {formatPanelDate} from 'utils/dates';
import type {MyThread, ReactionSummary} from 'utils/threads';
import {messageToSnippet} from 'utils/threads';

import ReactionChips from 'components/ReactionChips';
import {styles, withAlpha} from 'components/styles';
import type {PanelColors} from 'components/types';

type Props = {
    thread: MyThread;
    reactions: ReactionSummary[];
    pickerOpen: boolean;
    colors: PanelColors;
    onOpenThread: (thread: MyThread) => void;
    onJumpToPost: (thread: MyThread) => void;
    onToggleReaction: (thread: MyThread, emojiName: string) => void;
    onTogglePicker: (threadId: string) => void;
};

// One thread row: message snippet, reaction chips, creation date, reply
// counter and the hover toolbar (Add reaction / Reply / Jump).
export default function ThreadRow({thread, reactions, pickerOpen, colors, onOpenThread, onJumpToPost, onToggleReaction, onTogglePicker}: Props) {
    const {locale, t} = useTranslation();
    const {centerColor, linkColor, secondaryColor, toolbarBg} = colors;

    return (
        <div
            className={'omt-item'}
            role={'button'}
            tabIndex={0}
            onClick={() => onOpenThread(thread)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    onOpenThread(thread);
                }
            }}
            style={{
                ...styles.item,
                borderBottom: `1px solid ${withAlpha(centerColor, 0.1)}`,
                color: centerColor,
            }}
        >
            <div style={styles.message}>
                {messageToSnippet(thread.message, {
                    codeLabel: t('snippet.code'),
                    imageLabel: t('snippet.image'),
                })}
            </div>
            <ReactionChips
                thread={thread}
                reactions={reactions}
                pickerOpen={pickerOpen}
                colors={colors}
                onToggleReaction={onToggleReaction}
                onTogglePicker={onTogglePicker}
            />
            <div style={styles.dateRow}>
                <span style={{...styles.dateLabel, color: secondaryColor}}>
                    {t('panel.createdLabel')}
                    {' '}
                    {formatPanelDate(thread.createAt, locale)}
                </span>
                {thread.awaitingReply ? (
                    <span
                        style={{...styles.dateLabel, color: secondaryColor}}
                        title={t('panel.awaiting')}
                    >
                        {'⏳'}
                    </span>
                ) : (
                    <span style={{...styles.replyCount, color: linkColor}}>
                        {'💬 '}
                        {thread.replyCount}
                    </span>
                )}
            </div>
            <div
                className={'omt-toolbar'}
                style={{
                    background: toolbarBg,
                    border: `1px solid ${withAlpha(centerColor, 0.15)}`,
                    '--omt-hover': withAlpha(centerColor, 0.08),
                } as React.CSSProperties}
            >
                {/* A focused element removed on unmount breaks the
                    host thread view's virtual list sizing, so the
                    toolbar buttons never take focus on click. */}
                <button
                    className={'omt-btn'}
                    title={t('panel.addReaction')}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePicker(thread.id);
                    }}
                >
                    <svg
                        width={'13'}
                        height={'13'}
                        viewBox={'0 0 24 24'}
                        fill={'currentColor'}
                        aria-hidden={true}
                    >
                        <path d={'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 18c-2.28 0-4.22-1.4-5-3.38.42-.72 1.4-1.02 2.2-.6l1.2.63c.98.52 2.14.52 3.12 0l1.2-.63c.8-.42 1.78-.12 2.2.6C16.22 16.6 14.28 18 12 18z'}/>
                    </svg>
                </button>
                <button
                    className={'omt-btn'}
                    title={t('panel.reply')}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <svg
                        width={'13'}
                        height={'13'}
                        viewBox={'0 0 24 24'}
                        fill={'currentColor'}
                        aria-hidden={true}
                    >
                        <path d={'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'}/>
                    </svg>
                    {t('panel.reply')}
                </button>
                <button
                    className={'omt-btn'}
                    title={t('panel.jump')}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onJumpToPost(thread);
                    }}
                >
                    {t('panel.jump')}
                </button>
            </div>
        </div>
    );
}
