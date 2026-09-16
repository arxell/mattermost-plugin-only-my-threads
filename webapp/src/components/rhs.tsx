// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React, {useEffect, useRef, useState} from 'react';
import {useSelector, useStore} from 'react-redux';
import type {MyThread, SearchContext} from 'utils/threads';
import {fetchCurrentMonth, fetchOlderMonth, messageToSnippet} from 'utils/threads';

import type {GlobalState} from '@mattermost/types/store';

import {receivedPosts, receivedPostsInThread} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

const PLUGIN_STATE_KEY = 'plugins-only-my-threads';
const REFRESH_DELAY_MS = 400;

// Fallback colors used when the theme is not (yet) available in the store.
const FALLBACK_TEXT = '#1f4157';
const FALLBACK_LINK = '#166de0';
const FALLBACK_ERROR = '#d24b4e';

const getPostedSeq = (state: GlobalState): number => {
    const pluginState = (state as unknown as Record<string, {seq?: number; channelId?: string | null}>)[PLUGIN_STATE_KEY];
    const currentChannelId = state.entities.channels.currentChannelId;
    if (!pluginState || pluginState.channelId !== currentChannelId) {
        return 0;
    }
    return pluginState.seq ?? 0;
};

function withAlpha(color: string | undefined, alpha: number, fallback = FALLBACK_TEXT): string {
    const clean = (color || fallback).replace('#', '');
    if (clean.length !== 6) {
        return color || fallback;
    }
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function monthLabel(monthsBack: number, locale: string): string {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsBack);
    return d.toLocaleString(locale, {month: 'long', year: 'numeric'});
}

export default function OnlyMyThreadsRHS(): JSX.Element {
    const {locale, t} = useTranslation();
    const store = useStore();
    const channel = useSelector((state: GlobalState) => getCurrentChannel(state));
    const userId = useSelector((state: GlobalState) => getCurrentUserId(state));
    const team = useSelector((state: GlobalState) => getCurrentTeam(state));
    const theme = useSelector((state: GlobalState) => getTheme(state));
    const postedSeq = useSelector(getPostedSeq);

    // Loaded months, index 0 = current month. Older months are appended
    // on demand by the "show more" button (server-side pagination).
    const [months, setMonths] = useState<MyThread[][] | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [noMoreMonths, setNoMoreMonths] = useState(false);
    const loadingOlderRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [manualRefresh, setManualRefresh] = useState(0);

    const channelId = channel?.id;
    const channelName = channel?.name;
    const isPrivateChannel = channel?.type === 'P';
    const username = useSelector((state: GlobalState) => getCurrentUser(state)?.username);
    const teamId = team?.id;
    const teamName = team?.name;

    const centerColor = theme.centerChannelColor || FALLBACK_TEXT;
    const linkColor = theme.linkColor || FALLBACK_LINK;
    const errorColor = theme.errorTextColor || FALLBACK_ERROR;
    const secondaryColor = withAlpha(centerColor, 0.6);

    // Switching the channel resets pagination.
    useEffect(() => {
        setMonths(null);
        setNoMoreMonths(false);
    }, [channelId]);

    const searchContext: SearchContext = {
        channelName: channelName || '',
        isPrivateChannel,
        username: username || '',
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
                setMonths((prev) => [result, ...(prev ? prev.slice(1) : [])]);
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
    }, [channelId, channelName, isPrivateChannel, username, userId, teamId, postedSeq, manualRefresh]);

    if (!channel) {
        return (
            <div style={{padding: '16px'}}>
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
        fetchOlderMonth(userId, teamId, searchContext, months.length).then((older) => {
            if (older) {
                setMonths((prev) => {
                    const seen = new Set((prev || []).flat().map((thread) => thread.id));
                    const fresh = older.filter((thread) => !seen.has(thread.id));
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

    // Jumps to the post in the channel (permalink navigation): the host
    // scrolls the channel to it and highlights it.
    const jumpToPost = (thread: MyThread) => {
        if (!teamName) {
            return;
        }
        const url = `/${teamName}/pl/${thread.id}`;
        try {
            window.history.pushState({}, '', url);
            window.dispatchEvent(new PopStateEvent('popstate', {state: window.history.state}));
        } catch (e) {
            window.location.assign(url);
        }
    };

    // Opens the thread in the right-hand sidebar with its reply composer,
    // like the host's own Saved Messages panel does. The raw post is put
    // into the store first so old threads render without extra fetching.
    const openThread = (thread: MyThread) => {
        try {
            store.dispatch(receivedPosts({order: [thread.post.id], posts: {[thread.post.id]: thread.post}, next_post_id: '', prev_post_id: ''} as never));
            store.dispatch({
                type: 'SELECT_POST',
                postId: thread.id,
                channelId: thread.channelId,
                timestamp: Date.now(),
            });

            // Preload the full thread so the reply composer shows up at once;
            // the host would fetch it on its own, just slower. Thread views
            // read posts from the dedicated "in thread" store section.
            Client4.getPostThread(thread.id).then((list) => {
                store.dispatch(receivedPostsInThread(list, thread.id));
            }).catch(() => {
                // The host will fetch the thread itself.
            });
        } catch (e) {
            if (teamName) {
                window.location.assign(`/${teamName}/pl/${thread.id}`);
            }
        }
    };

    const formatDateTime = (ms: number): string => new Date(ms).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    const items = (months || []).flat();

    let body: JSX.Element;
    if (loading && months === null) {
        body = (
            <div style={{padding: '16px', color: secondaryColor}}>{t('panel.loading')}</div>
        );
    } else if (error) {
        body = (
            <div style={{padding: '16px'}}>
                <div style={{color: errorColor, marginBottom: '8px'}}>
                    {t('panel.loadError', {message: error})}
                </div>
                <button
                    className={'btn btn-tertiary'}
                    onClick={() => setManualRefresh((n) => n + 1)}
                >
                    {t('panel.retry')}
                </button>
            </div>
        );
    } else if (items.length === 0) {
        body = (
            <div style={{padding: '16px', color: secondaryColor}}>
                {t('panel.emptyMonth')}
            </div>
        );
    } else {
        body = (
            <div>
                {items.map((thread) => (
                    <div
                        key={thread.id}
                        role={'button'}
                        tabIndex={0}
                        onClick={() => openThread(thread)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                openThread(thread);
                            }
                        }}
                        style={{
                            padding: '10px 16px',
                            borderBottom: `1px solid ${withAlpha(centerColor, 0.1)}`,
                            cursor: 'pointer',
                            color: centerColor,
                        }}
                    >
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                            {thread.awaitingReply ? (
                                <span style={{color: secondaryColor, fontSize: '12px'}}>
                                    {'⏳ '}
                                    {t('panel.awaiting')}
                                </span>
                            ) : (
                                <span style={{color: linkColor}}>
                                    {'💬 '}
                                    {thread.replyCount}
                                </span>
                            )}
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <span style={{color: secondaryColor, fontSize: '12px'}}>
                                    {formatDateTime(thread.lastActivityAt)}
                                </span>
                                <button
                                    className={'btn btn-tertiary'}
                                    title={t('panel.showInChannel')}
                                    style={{padding: '0 4px', border: '0', background: 'transparent', color: linkColor, cursor: 'pointer', fontSize: '13px', lineHeight: 1}}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        jumpToPost(thread);
                                    }}
                                >
                                    {'↗'}
                                </button>
                            </div>
                        </div>
                        <div style={{fontSize: '13px', lineHeight: '1.4'}}>
                            {messageToSnippet(thread.message, {
                                codeLabel: t('snippet.code'),
                                imageLabel: t('snippet.image'),
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Rendered for both the empty and non-empty cases: an empty current
    // month must still allow paging to the previous ones.
    const showMoreButton = !noMoreMonths && months !== null ? (
        <button
            className={'btn btn-tertiary'}
            style={{display: 'block', width: '100%', padding: '10px 16px', border: '0', cursor: 'pointer'}}
            disabled={loadingOlder}
            onClick={loadOlder}
        >
            {loadingOlder ? t('panel.loading') : t('panel.showMore', {month: monthLabel(months.length, locale)})}
        </button>
    ) : null;

    return (
        <div style={{height: '100%', overflowY: 'auto'}}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${withAlpha(centerColor, 0.15)}`,
                }}
            >
                <div>
                    <div style={{fontWeight: 600, color: centerColor}}>
                        {t('panel.title')}
                    </div>
                    <div style={{fontSize: '12px', color: secondaryColor}}>
                        {channel.display_name}
                        {items.length > 0 ? ` · ${items.length}` : ''}
                    </div>
                </div>
                <button
                    className={'btn btn-tertiary'}
                    onClick={() => setManualRefresh((n) => n + 1)}
                    title={t('panel.refresh')}
                    disabled={loading}
                >
                    {'⟳'}
                </button>
            </div>
            {loading && months !== null ? (
                <div style={{padding: '8px 16px', color: secondaryColor, fontSize: '12px'}}>
                    {t('panel.refreshing')}
                </div>
            ) : null}
            {body}
            {showMoreButton}
            {noMoreMonths && months !== null && !loading ? (
                <div style={{padding: '8px 16px 12px', fontSize: '11px', color: secondaryColor}}>
                    {t('panel.noMore')}
                </div>
            ) : null}
        </div>
    );
}
