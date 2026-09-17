// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getLocale, translate} from 'i18n';
import manifest from 'manifest';
import React from 'react';
import {Provider} from 'react-redux';
import {POSTED_ACTION, REACTION_ACTION, postedReducer} from 'reducer';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import ChannelHeaderIcon from 'components/channel_header_icon';
import OnlyMyThreadsRHS from 'components/rhs';

import type {PluginRegistry} from 'types/mattermost-webapp';

// Keeps a plugin render error from unmounting the whole Mattermost app.
class RHSErrorBoundary extends React.Component<{children: React.ReactNode; store: Store<GlobalState>}, {error: string | null}> {
    public state = {error: null as string | null};

    public static getDerivedStateFromError(e: unknown) {
        return {error: e instanceof Error ? e.message : String(e)};
    }

    public render() {
        if (this.state.error) {
            const locale = getLocale(this.props.store.getState());
            return (
                <div style={{padding: '16px', color: '#d24b4e'}}>
                    {translate(locale, 'panel.crash', {message: this.state.error})}
                </div>
            );
        }
        return this.props.children;
    }
}

export default class Plugin {
    public async initialize(registry: PluginRegistry, store: Store<GlobalState>) {
        // The host renders the registered value as a component (<X/>),
        // so it must be a component type, not a JSX element (React error #130).
        const OnlyMyThreadsPanel = () => (
            <Provider store={store}>
                <RHSErrorBoundary store={store}>
                    <OnlyMyThreadsRHS/>
                </RHSErrorBoundary>
            </Provider>
        );
        OnlyMyThreadsPanel.displayName = 'OnlyMyThreadsPanel';

        // Registration strings are resolved once, at plugin startup, for the
        // user's current language; panel contents react to language changes.
        const locale = getLocale(store.getState());

        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(
            OnlyMyThreadsPanel,
            translate(locale, 'panel.title'),
        );

        registry.registerChannelHeaderButtonAction(
            <ChannelHeaderIcon/>,
            () => store.dispatch(toggleRHSPlugin),
            translate(locale, 'panel.title'),
            translate(locale, 'panel.buttonTooltip'),
        );

        registry.registerReducer(postedReducer);

        // Bump a counter whenever anything is posted, so the RHS panel can
        // refresh when the current channel gets new messages or replies.
        registry.registerWebSocketEventHandler('posted', (msg) => {
            const channelId = msg.data ? msg.data.channel_id : undefined;
            if (channelId) {
                store.dispatch({type: POSTED_ACTION, channelId});
            }
        });

        // Keep the panel reaction chips in sync when reactions change
        // anywhere (added from the panel itself, in the channel, or by
        // other users).
        const dispatchReaction = (msg: {data?: {reaction?: unknown}}) => {
            // The host sends the reaction inside the event as a JSON
            // string; older builds may hand over a parsed object.
            const raw = msg.data ? msg.data.reaction : undefined;
            let reaction: {post_id?: string} | undefined;
            if (typeof raw === 'string') {
                try {
                    reaction = JSON.parse(raw) as {post_id?: string};
                } catch {
                    reaction = undefined;
                }
            } else {
                reaction = raw as {post_id?: string} | undefined;
            }
            const postId = reaction ? reaction.post_id : undefined;
            if (postId) {
                store.dispatch({type: REACTION_ACTION, postId});
            }
        };
        registry.registerWebSocketEventHandler('reaction_added', dispatchReaction);
        registry.registerWebSocketEventHandler('reaction_removed', dispatchReaction);
    }
}

declare global {
    interface Window {
        registerPlugin(pluginId: string, plugin: Plugin): void;
    }
}

window.registerPlugin(manifest.id, new Plugin());
