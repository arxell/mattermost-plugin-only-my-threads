// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PLUGIN_STATE_KEY, REFRESH_DELAY_MS} from 'constants';

import {useTranslation} from 'i18n';
import React, {useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';
import type {PostedState} from 'reducer';
import {monthLabel} from 'utils/dates';
import {fetchAllChannelMembers} from 'utils/members';
import type {MyThread, ReactionSummary, SearchContext} from 'utils/threads';
import {fetchCurrentMonth, fetchOlderMonth} from 'utils/threads';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import AuthorPicker from 'components/AuthorPicker';
import {FALLBACK_ERROR, FALLBACK_LINK, FALLBACK_TEXT, ITEM_TOOLBAR_CSS, styles, withAlpha} from 'components/styles';
import ThreadList from 'components/ThreadList';
import type {PanelColors} from 'components/types';
import {useThreadActions} from 'components/useThreadActions';

// The plugin reducer lives outside the typed GlobalState; narrow it.
type PluginStoreState = GlobalState & { [PLUGIN_STATE_KEY]?: Partial<PostedState> };

const getPostedSeq = (state: GlobalState): number => {
    const pluginState = (state as PluginStoreState)[PLUGIN_STATE_KEY];
    const currentChannelId = state.entities.channels.currentChannelId;
    if (!pluginState || pluginState.channelId !== currentChannelId) {
        return 0;
    }
    return pluginState.seq ?? 0;
};

const getReactionSeq = (state: GlobalState): number =>
    (state as PluginStoreState)[PLUGIN_STATE_KEY]?.reactionSeq ?? 0;

const getReactionPostId = (state: GlobalState): string | null =>
    (state as PluginStoreState)[PLUGIN_STATE_KEY]?.reactionPostId ?? null;

export default function OnlyMyThreadsRHS(): JSX.Element {
    const {locale, t} = useTranslation();
    const channel = useSelector((state: GlobalState) => getCurrentChannel(state));
    const userId = useSelector((state: GlobalState) => getCurrentUserId(state));
    const team = useSelector((state: GlobalState) => getCurrentTeam(state));
    const theme = useSelector((state: GlobalState) => getTheme(state));
    const postedSeq = useSelector(getPostedSeq);
    const reactionSeq = useSelector(getReactionSeq);
    const reactionPostId = useSelector(getReactionPostId);

    // Loaded months, index 0 = current month. Older months are appended
    // on demand by the "show more" button (server-side pagination).
    const [months, setMonths] = useState<MyThread[][] | null>(null);

    // The calendar month of the oldest loaded page — the pagination
    // cursor. Trailing loaded pages may come from months further back
    // than months.length when empty months were skipped; continuing from
    // months.length would rescan them and mislabel the "Show more" button.
    const oldestLoadedBack = useRef(0);
    const [loading, setLoading] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [noMoreMonths, setNoMoreMonths] = useState(false);
    const loadingOlderRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [manualRefresh, setManualRefresh] = useState(0);

    // Whose threads the list shows: the current user by default, or any
    // channel member picked in the header dropdown.
    const [authorId, setAuthorId] = useState<string | null>(null);
    const [members, setMembers] = useState<UserProfile[]>([]);

    // Live reaction chips, overriding the month-fetch data. Keyed by root
    // post id; refreshed after panel toggles and reaction websocket events.
    const [reactionsByPost, setReactionsByPost] = useState<Record<string, ReactionSummary[]>>({});
    const [pickerFor, setPickerFor] = useState<string | null>(null);

    const channelId = channel?.id;
    const channelName = channel?.name;
    const isPrivateChannel = channel?.type === 'P';
    const username = useSelector((state: GlobalState) => getCurrentUser(state)?.username);
    const teamId = team?.id;
    const teamName = team?.name;

    const centerColor = theme.centerChannelColor || FALLBACK_TEXT;
    const colors: PanelColors = {
        centerColor,
        linkColor: theme.linkColor || FALLBACK_LINK,
        errorColor: theme.errorTextColor || FALLBACK_ERROR,
        secondaryColor: withAlpha(centerColor, 0.6),
        toolbarBg: theme.centerChannelBg || '#ffffff',
    };

    const {openThread, jumpToPost, toggleReaction, refetchReactions} = useThreadActions({
        userId,
        teamName,
        reactionsByPost,
        setReactionsByPost,
    });

    // Resets pagination, author choice and reaction overrides.
    const resetList = () => {
        setMonths(null);
        oldestLoadedBack.current = 0;
        setNoMoreMonths(false);
        setReactionsByPost({});
        setPickerFor(null);
    };

    // Switching the channel resets pagination and the author choice.
    useEffect(() => {
        resetList();
        setAuthorId(null);

        // The host store does not guarantee profiles of the current
        // channel's members; fetch all pages of them for the author
        // dropdown (the endpoint pages reliably and orders by username).
        if (channelId) {
            let cancelled = false;
            fetchAllChannelMembers(channelId).then((profiles) => {
                if (!cancelled) {
                    setMembers(profiles);
                }
            }).catch(() => {
                // The dropdown just stays with the "My threads" option.
            });
            return () => {
                cancelled = true;
            };
        }
        return undefined;
    }, [channelId]);

    const authorProfile = authorId ? members.find((m) => m.id === authorId) : null;
    const authorUsername = authorProfile?.username || username || '';
    const searchContext: SearchContext = {
        channelName: channelName || '',
        isPrivateChannel,
        username: authorUsername,
    };

    useEffect(() => {
        if (!channelId || !userId || !teamId) {
            return undefined;
        }

        let cancelled = false;
        setLoading(true);

        // Small delay also debounces bursts of "posted" websocket events.
        const timer = setTimeout(() => {
            fetchCurrentMonth(userId, teamId, channelId, searchContext).then((result) => {
                if (cancelled) {
                    return;
                }

                // Replace only the current month; keep already loaded older
                // months (they are historical and never change).
                setMonths((prev) => {
                    oldestLoadedBack.current = Math.max(oldestLoadedBack.current, 0);
                    return [result, ...(prev ? prev.slice(1) : [])];
                });

                // The fresh month carries the server's current reactions,
                // so the per-post overrides for its threads are stale by
                // definition — drop them or the refresh button would keep
                // showing chips as they were when the panel last toggled
                // them. Overrides of other months' threads stay.
                setReactionsByPost((prev) => {
                    const freshIds = new Set(result.map((thread) => thread.id));
                    const next: Record<string, ReactionSummary[]> = {};
                    for (const [postId, summaries] of Object.entries(prev)) {
                        if (!freshIds.has(postId)) {
                            next[postId] = summaries;
                        }
                    }
                    return next;
                });
                setError(null);
            }).catch((e: unknown) => {
                if (cancelled) {
                    return;
                }
                const message = e instanceof Error ? e.message : String(e);
                setError(message);
            }).finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });
        }, REFRESH_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [channelId, channelName, isPrivateChannel, authorId, userId, teamId, postedSeq, manualRefresh]);

    // Reaction websocket events refresh the chips of the affected thread.
    useEffect(() => {
        if (reactionPostId && reactionSeq > 0 && (months || []).some((m) => m.some((thread) => thread.id === reactionPostId))) {
            refetchReactions(reactionPostId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reactionSeq]);

    if (!channel) {
        return (
            <div style={styles.stateMessage}>
                {t('panel.channelNotSelected')}
            </div>
        );
    }

    const loadOlder = () => {
        // A synchronous guard: a state-based one lets a fast double click
        // through before React re-renders, appending the same month twice.
        if (loadingOlderRef.current || loadingOlder || !months || !userId || !teamId) {
            return;
        }
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        fetchOlderMonth(userId, teamId, searchContext, oldestLoadedBack.current + 1).then((older) => {
            if (older) {
                oldestLoadedBack.current = older.monthsBack;
                setMonths((prev) => {
                    const seen = new Set((prev || []).flat().map((thread) => thread.id));
                    const fresh = older.threads.filter((thread) => !seen.has(thread.id));
                    return [...(prev || []), fresh];
                });
            } else {
                setNoMoreMonths(true);
            }
        }).catch(() => {
            setNoMoreMonths(true);
        }).finally(() => {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        });
    };

    const togglePicker = (threadId: string) => {
        setPickerFor(pickerFor === threadId ? null : threadId);
    };

    const selectAuthor = (id: string | null) => {
        setAuthorId(id);
        resetList();
    };

    const items = (months || []).flat();

    return (
        <div style={styles.panel}>
            <style>{ITEM_TOOLBAR_CSS}</style>
            <div
                style={{
                    ...styles.header,
                    borderBottom: `1px solid ${withAlpha(centerColor, 0.15)}`,
                }}
            >
                <div style={styles.headerTitleWrap}>
                    <div style={{...styles.headerTitle, color: centerColor}}>
                        {channel.display_name}
                        {items.length > 0 ? ` · ${items.length}` : ''}
                    </div>
                </div>
                <div style={styles.headerActions}>
                    <AuthorPicker
                        members={members}
                        authorId={authorId}
                        colors={colors}
                        onSelect={selectAuthor}
                    />
                    <button
                        className={'btn btn-tertiary'}
                        onClick={() => setManualRefresh((n) => n + 1)}
                        title={t('panel.refresh')}
                        disabled={loading}
                    >
                        <svg
                            width={'18'}
                            height={'18'}
                            viewBox={'0 0 24 24'}
                            fill={'currentColor'}
                            aria-hidden={true}
                        >
                            <path d={'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z'}/>
                        </svg>
                    </button>
                </div>
            </div>
            <ThreadList
                months={months}
                loading={loading}
                loadingOlder={loadingOlder}
                error={error}
                noMoreMonths={noMoreMonths}
                nextMonthLabel={monthLabel(oldestLoadedBack.current + 1, locale)}
                reactionsByPost={reactionsByPost}
                pickerFor={pickerFor}
                colors={colors}
                onRetry={() => setManualRefresh((n) => n + 1)}
                onLoadOlder={loadOlder}
                onOpenThread={openThread}
                onJumpToPost={jumpToPost}
                onToggleReaction={toggleReaction}
                onTogglePicker={togglePicker}
            />
        </div>
    );
}
