// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useTranslation} from 'i18n';
import React, {useEffect, useRef, useState} from 'react';
import {useSelector, useStore} from 'react-redux';
import {getReactionPostId, getReactionSeq} from 'reducer';
import type {ReactionSummary} from 'utils/threads';
import {aggregateReactions, messageToSnippet} from 'utils/threads';

import type {GlobalState} from '@mattermost/types/store';
import type {UserThreadWithPost} from '@mattermost/types/threads';

import {receivedPosts, receivedPostsInThread} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {ITEM_TOOLBAR_CSS, PICKER_EMOJIS, emojiChar} from 'components/hover_toolbar';

const FALLBACK_TEXT = '#1f4157';
const FALLBACK_LINK = '#166de0';
const FALLBACK_ERROR = '#d24b4e';

// One page of the followed-threads list; the server includes everything
// the page needs (root post, reply counts, last activity) in one request.
const THREADS_PAGE_SIZE = 999;

// Reactions are not part of the threads response, so they are fetched per
// root post — bounded to the head of the list so a huge account does not
// trigger a request storm on load.
const MAX_REACTION_THREADS = 200;

type ThreadsPage = {
    threads: UserThreadWithPost[];
    next_cursor_id?: string | null;
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

// A full-page "My threads" view: followed threads filtered to the ones
// the current user started, across all channels. Registered at
// /plug/only-my-threads/my-threads and opened from the account menu.
export default function MyThreadsPage() {
    const {locale, t} = useTranslation();
    const store = useStore();
    const userId = useSelector((state: GlobalState) => getCurrentUserId(state));

    // Direct /plug loads have no current team in the store yet — fall back
    // to the first of the user's teams.
    const team = useSelector((state: GlobalState) => {
        const current = getCurrentTeam(state);
        if (current) {
            return current;
        }
        return getMyTeams(state)[0] ?? null;
    });
    const theme = useSelector((state: GlobalState) => getTheme(state));
    const reactionSeq = useSelector(getReactionSeq);
    const reactionPostId = useSelector(getReactionPostId);

    const [threads, setThreads] = useState<UserThreadWithPost[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [manualRefresh, setManualRefresh] = useState(0);

    // Live reaction chips, keyed by root post id, exactly like the channel
    // panel: fetched for the head of the list, then refreshed by reaction
    // websocket events.
    const [reactionsByPost, setReactionsByPost] = useState<Record<string, ReactionSummary[]>>({});
    const [pickerFor, setPickerFor] = useState<string | null>(null);
    const fetchedReactionsRef = useRef<Set<string>>(new Set());

    const centerColor = theme.centerChannelColor || FALLBACK_TEXT;
    const linkColor = theme.linkColor || FALLBACK_LINK;
    const errorColor = theme.errorTextColor || FALLBACK_ERROR;
    const secondaryColor = withAlpha(centerColor, 0.6);

    // The custom route's slot has the theme's sidebar color behind it; the
    // native views paint their own center background, and so do we.
    const pageBg = theme.centerChannelBg || '#ffffff';

    useEffect(() => {
        if (!userId || !team) {
            return undefined;
        }
        let cancelled = false;
        setLoading(true);

        Client4.getUserThreads(userId, team.id, {perPage: THREADS_PAGE_SIZE, extended: true}).
            then((list: ThreadsPage) => {
                if (cancelled) {
                    return;
                }

                // "My" threads only: the root post's author is the current user.
                const mine = (list.threads || []).filter((thread) => thread.post?.user_id === userId);
                mine.sort((a, b) => (b.last_reply_at || b.post?.create_at || 0) - (a.last_reply_at || a.post?.create_at || 0));
                setThreads(mine);
                setCursor(list.next_cursor_id || null);
                setError(null);
            }).
            catch((e: unknown) => {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : String(e));
                }
            }).
            finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [userId, team, manualRefresh]);

    const refetchReactions = async (postId: string) => {
        try {
            const list = await Client4.getReactionsForPost(postId);
            setReactionsByPost((prev) => ({...prev, [postId]: aggregateReactions(list, userId || '')}));
        } catch {
            // Keep the previously rendered chips.
        }
    };

    // The threads response has no reactions; fetch them for the head of
    // the list once per thread (the ref guards against refetch loops).
    useEffect(() => {
        if (!userId || threads.length === 0) {
            return undefined;
        }
        let cancelled = false;
        const missing = threads.slice(0, MAX_REACTION_THREADS).
            filter((thread) => !fetchedReactionsRef.current.has(thread.id));
        missing.forEach((thread) => fetchedReactionsRef.current.add(thread.id));
        if (missing.length === 0) {
            return undefined;
        }
        Promise.allSettled(missing.map((thread) => Client4.getReactionsForPost(thread.id))).then((results) => {
            if (cancelled) {
                return;
            }
            setReactionsByPost((prev) => {
                const next = {...prev};
                results.forEach((result, i) => {
                    next[missing[i].id] = result.status === 'fulfilled' ? aggregateReactions(result.value ?? [], userId) : [];
                });
                return next;
            });
        });
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threads, userId]);

    // Reaction websocket events refresh the chips of the affected thread.
    useEffect(() => {
        if (reactionPostId && reactionSeq > 0 && threads.some((thread) => thread.id === reactionPostId)) {
            refetchReactions(reactionPostId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reactionSeq]);

    const reactionsFor = (thread: UserThreadWithPost): ReactionSummary[] => reactionsByPost[thread.id] ?? [];

    // Adds or removes the user's reaction, then refreshes that post's chips.
    const toggleReaction = async (thread: UserThreadWithPost, emojiName: string) => {
        if (!userId) {
            return;
        }
        const alreadyMine = reactionsFor(thread).some((s) => s.emojiName === emojiName && s.mine);
        try {
            if (alreadyMine) {
                await Client4.removeReaction(userId, thread.id, emojiName);
            } else {
                await Client4.addReaction(userId, thread.id, emojiName);
            }
        } catch {
            return;
        }
        await refetchReactions(thread.id);
    };

    const loadMore = () => {
        if (!userId || !team || !cursor || loadingMore) {
            return;
        }
        setLoadingMore(true);
        Client4.getUserThreads(userId, team.id, {perPage: THREADS_PAGE_SIZE, extended: true, before: cursor}).
            then((list: ThreadsPage) => {
                const mine = (list.threads || []).filter((thread) => thread.post?.user_id === userId);
                setThreads((prev) => {
                    const seen = new Set(prev.map((thread) => thread.id));
                    return [...prev, ...mine.filter((thread) => !seen.has(thread.id))];
                });
                setCursor(list.next_cursor_id || null);
            }).
            catch(() => setCursor(null)).
            finally(() => setLoadingMore(false));
    };

    // The custom route has no right-hand sidebar container, so opening the
    // thread from here first navigates to the post permalink (which mounts
    // the channel view) and then selects the thread in the RHS.
    const openThread = (thread: UserThreadWithPost) => {
        const post = thread.post;
        if (!post || !team) {
            return;
        }
        const permalinkForTeam = `/${team.name}/pl/${post.id}`;
        try {
            window.history.pushState({}, '', permalinkForTeam);
            window.dispatchEvent(new PopStateEvent('popstate', {state: window.history.state}));
        } catch {
            window.location.assign(permalinkForTeam);
        }

        // Let the channel view mount before selecting the thread.
        setTimeout(() => {
            store.dispatch(receivedPosts({order: [post.id], posts: {[post.id]: post}, next_post_id: '', prev_post_id: ''} as never));
            store.dispatch({
                type: 'SELECT_POST',
                postId: post.id,
                channelId: post.channel_id,
                timestamp: Date.now(),
            });

            // The host thread view's virtual list sometimes measures its
            // container as zero-sized right after a view swap; a resize
            // nudge forces the re-measure.
            [50, 300].forEach((delay) => setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, delay));

            Client4.getPostThread(post.id).then((list) => {
                store.dispatch(receivedPostsInThread(list, post.id));
            }).catch(() => {
                // The host will fetch the thread itself.
            });
        }, 400);
    };

    const formatDateTime = (ms: number): string => new Date(ms).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    // Jumps to the post in its channel (permalink navigation only): the
    // host scrolls the channel to it and highlights it, without opening
    // the right-hand thread view.
    const jumpToPost = (thread: UserThreadWithPost) => {
        if (!team || !thread.post) {
            return;
        }
        const url = `/${team.name}/pl/${thread.post.id}`;
        try {
            window.history.pushState({}, '', url);
            window.dispatchEvent(new PopStateEvent('popstate', {state: window.history.state}));
        } catch {
            window.location.assign(url);
        }
    };

    const channelName = (channelId: string): string => {
        const channel = getChannel(store.getState() as GlobalState, channelId);
        return channel ? channel.display_name : '';
    };

    let body: JSX.Element;
    if (loading) {
        body = <div style={{padding: '16px', color: secondaryColor}}>{t('panel.loading')}</div>;
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
    } else if (threads.length === 0) {
        body = <div style={{padding: '16px', color: secondaryColor}}>{t('page.empty')}</div>;
    } else {
        body = (
            <div>
                {threads.map((thread) => (
                    <div
                        key={thread.id}
                        className={'omt-item omt-page-row'}
                        role={'button'}
                        tabIndex={0}
                        onClick={() => openThread(thread)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                openThread(thread);
                            }
                        }}
                        style={{
                            padding: '8px 20px',
                            borderBottom: `1px solid ${withAlpha(centerColor, 0.08)}`,
                            cursor: 'pointer',
                            color: centerColor,
                        }}
                    >
                        <div style={{fontSize: '15px', lineHeight: '1.45', marginBottom: '2px'}}>
                            {messageToSnippet(thread.post?.message || '', {
                                codeLabel: t('snippet.code'),
                                imageLabel: t('snippet.image'),
                            })}
                        </div>
                        {reactionsFor(thread).length > 0 ? (
                            <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px'}}>
                                {reactionsFor(thread).map((summary) => (
                                    <button
                                        key={summary.emojiName}
                                        className={'omt-chip'}
                                        title={`:${summary.emojiName}:`}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            borderRadius: '10px',
                                            padding: '1px 8px',
                                            fontSize: '12px',
                                            lineHeight: '1.5',
                                            cursor: 'pointer',
                                            color: centerColor,
                                            fontFamily: 'inherit',
                                            border: `1px solid ${summary.mine ? linkColor : withAlpha(centerColor, 0.25)}`,
                                            background: summary.mine ? withAlpha(linkColor, 0.1) : 'transparent',
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleReaction(thread, summary.emojiName);
                                        }}
                                    >
                                        {emojiChar(summary.emojiName)}
                                        {summary.count > 1 ? summary.count : ''}
                                    </button>
                                ))}
                                <button
                                    className={'omt-chip'}
                                    title={t('panel.addReaction')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        borderRadius: '10px',
                                        padding: '1px 8px',
                                        fontSize: '12px',
                                        lineHeight: '1.5',
                                        cursor: 'pointer',
                                        color: secondaryColor,
                                        fontFamily: 'inherit',
                                        border: `1px dashed ${withAlpha(centerColor, 0.3)}`,
                                        background: 'transparent',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPickerFor(pickerFor === thread.id ? null : thread.id);
                                    }}
                                >
                                    {'+'}
                                </button>
                            </div>
                        ) : null}
                        {pickerFor === thread.id ? (
                            <div
                                className={'omt-picker'}
                                style={{
                                    background: pageBg,
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
                                            setPickerFor(null);
                                            toggleReaction(thread, name);
                                        }}
                                    >
                                        {char}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span style={{fontSize: '12px', color: secondaryColor}}>
                                {channelName(thread.post?.channel_id || '')}
                                {channelName(thread.post?.channel_id || '') ? ' · ' : ''}
                                {formatDateTime(thread.last_reply_at || thread.post?.create_at || 0)}
                            </span>
                            {thread.reply_count === 0 ? (
                                <span
                                    style={{fontSize: '12px', color: secondaryColor}}
                                    title={t('panel.awaiting')}
                                >
                                    {'⏳'}
                                </span>
                            ) : (
                                <span style={{fontSize: '13px', color: linkColor}}>
                                    {'💬 '}
                                    {thread.reply_count}
                                </span>
                            )}
                        </div>
                        <div
                            className={'omt-toolbar'}
                            style={{
                                background: pageBg,
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
                                    setPickerFor(pickerFor === thread.id ? null : thread.id);
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
                                    jumpToPost(thread);
                                }}
                            >
                                {t('panel.jump')}
                            </button>
                        </div>
                    </div>
                ))}
                {cursor ? (
                    <button
                        className={'btn btn-tertiary'}
                        style={{display: 'block', width: '100%', padding: '10px 20px', border: '0', cursor: 'pointer'}}
                        disabled={loadingMore}
                        onClick={loadMore}
                    >
                        {loadingMore ? t('panel.loading') : t('page.more')}
                    </button>
                ) : null}
            </div>
        );
    }

    return (
        <div
            style={{
                gridArea: 'center',
                height: '100%',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                background: pageBg,
            }}
        >
            <style>{ITEM_TOOLBAR_CSS}</style>
            <div
                style={{
                    maxWidth: '1000px',
                    width: '100%',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    flex: 1,
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px 20px 10px',
                    }}
                >
                    <div>
                        <div style={{fontSize: '20px', fontWeight: 600, color: centerColor}}>
                            {t('menu.myThreads')}
                        </div>
                        <div style={{fontSize: '13px', color: secondaryColor}}>
                            {t('page.subtitle')}
                            {threads.length > 0 ? ` · ${threads.length}` : ''}
                        </div>
                    </div>
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
                            <path d={'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0 1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z'}/>
                        </svg>
                    </button>
                </div>
                {body}
            </div>
        </div>
    );
}
