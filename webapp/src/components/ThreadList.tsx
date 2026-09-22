// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React from 'react';
import type {MyThread, ReactionSummary} from 'utils/threads';

import {styles} from 'components/styles';
import ThreadRow from 'components/ThreadRow';
import type {PanelColors} from 'components/types';

type Props = {
    months: MyThread[][] | null;
    loading: boolean;
    loadingOlder: boolean;
    error: string | null;
    noMoreMonths: boolean;
    nextMonthLabel: string;
    reactionsByPost: Record<string, ReactionSummary[]>;
    pickerFor: string | null;
    colors: PanelColors;
    onRetry: () => void;
    onLoadOlder: () => void;
    onOpenThread: (thread: MyThread) => void;
    onJumpToPost: (thread: MyThread) => void;
    onToggleReaction: (thread: MyThread, emojiName: string) => void;
    onTogglePicker: (threadId: string) => void;
};

// The thread list with its loading/error/empty states, the "Show more"
// month pagination and the end-of-history note.
export default function ThreadList({months, loading, loadingOlder, error, noMoreMonths, nextMonthLabel, reactionsByPost, pickerFor, colors, onRetry, onLoadOlder, onOpenThread, onJumpToPost, onToggleReaction, onTogglePicker}: Props) {
    const {t} = useTranslation();
    const {secondaryColor, errorColor} = colors;

    const items = (months || []).flat();

    let body: JSX.Element;
    if (loading && months === null) {
        body = (
            <div style={{...styles.stateMessage, color: secondaryColor}}>{t('panel.loading')}</div>
        );
    } else if (error) {
        body = (
            <div style={styles.stateMessage}>
                <div style={{color: errorColor, marginBottom: '8px'}}>
                    {t('panel.loadError', {message: error})}
                </div>
                <button
                    className={'btn btn-tertiary'}
                    onClick={onRetry}
                >
                    {t('panel.retry')}
                </button>
            </div>
        );
    } else if (items.length === 0) {
        body = (
            <div style={{...styles.stateMessage, color: secondaryColor}}>
                {t('panel.emptyMonth')}
            </div>
        );
    } else {
        body = (
            <div>
                {items.map((thread) => (
                    <ThreadRow
                        key={thread.id}
                        thread={thread}
                        reactions={reactionsByPost[thread.id] ?? thread.reactions}
                        pickerOpen={pickerFor === thread.id}
                        colors={colors}
                        onOpenThread={onOpenThread}
                        onJumpToPost={onJumpToPost}
                        onToggleReaction={onToggleReaction}
                        onTogglePicker={onTogglePicker}
                    />
                ))}
            </div>
        );
    }

    // Rendered for both the empty and non-empty cases: an empty current
    // month must still allow paging to the previous ones.
    const showMoreButton = !noMoreMonths && months !== null ? (
        <button
            className={'btn btn-tertiary'}
            style={styles.showMore}
            disabled={loadingOlder}
            onClick={onLoadOlder}
        >
            {loadingOlder ? t('panel.loading') : t('panel.showMore', {month: nextMonthLabel})}
        </button>
    ) : null;

    return (
        <>
            {loading && months !== null ? (
                <div style={{...styles.refreshing, color: secondaryColor}}>
                    {t('panel.refreshing')}
                </div>
            ) : null}
            {body}
            {showMoreButton}
            {noMoreMonths && months !== null && !loading ? (
                <div style={{...styles.noMore, color: secondaryColor}}>
                    {t('panel.noMore')}
                </div>
            ) : null}
        </>
    );
}
