/**
 * @jest-environment jsdom
 */

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The real client pulls deep exports-only packages that jest cannot
// resolve; the registration test never calls the API anyway.
jest.mock('mattermost-redux/client', () => ({Client4: {}}));

import {POSTED_ACTION, REACTION_ACTION, postedReducer} from 'reducer';

import ChannelHeaderIcon from 'components/channel_header_icon';

import type {PluginRegistry} from 'types/mattermost-webapp';

// index.tsx calls window.registerPlugin at import time; stub it first.
const registerPluginMock = jest.fn<void, [string, unknown]>();
(window as unknown as {registerPlugin: unknown}).registerPlugin = registerPluginMock;

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('index');

// clearMocks wipes mock.calls before each test, so snapshot the
// import-time registration while it is still recorded.
const registrationCalls = registerPluginMock.mock.calls.slice() as Array<[string, unknown]>;

const makeRegistry = () => ({
    registerRightHandSidebarComponent: jest.fn(() => ({toggleRHSPlugin: {type: 'TOGGLE_RHS'}})),
    registerChannelHeaderButtonAction: jest.fn(),
    registerCustomRoute: jest.fn(),
    registerMainMenuAction: jest.fn(),
    registerReducer: jest.fn(),
    registerWebSocketEventHandler: jest.fn(),
});

const makeStore = () => ({
    getState: jest.fn(() => ({
        entities: {
            users: {currentUserId: 'u1', profiles: {u1: {id: 'u1', locale: 'en'}}},
            preferences: {myPreferences: {}},
        },
    })),
    dispatch: jest.fn(),
});

describe('plugin registration', () => {
    let registry: ReturnType<typeof makeRegistry>;
    let store: ReturnType<typeof makeStore>;

    beforeEach(async () => {
        registry = makeRegistry();
        store = makeStore();
        const [, plugin] = registrationCalls[0];
        await (plugin as {initialize: (r: PluginRegistry, s: unknown) => Promise<void>}).
            initialize(registry as unknown as PluginRegistry, store);
    });

    it('registers itself under the manifest id', () => {
        expect(registrationCalls[0][0]).toBe('only-my-threads');
    });

    it('passes a component TYPE (not a JSX element) as the RHS component', () => {
        // React error #130: registering an element instead of a component
        // type unmounts the whole app when the host renders <X/>.
        expect(registry.registerRightHandSidebarComponent).toHaveBeenCalledTimes(1);
        const rhsCalls = registry.registerRightHandSidebarComponent.mock.calls as unknown as Array<[unknown, string]>;
        const [component, title] = rhsCalls[0];
        expect(typeof component).toBe('function');
        expect(title).toBe('My threads in this channel');
    });

    it('registers the channel header button with icon, toggle action and tooltips', () => {
        expect(registry.registerChannelHeaderButtonAction).toHaveBeenCalledTimes(1);
        const buttonCalls = registry.registerChannelHeaderButtonAction.mock.calls as unknown as Array<[{type: typeof ChannelHeaderIcon}, () => void, string, string]>;
        const [icon, action, title, tooltip] = buttonCalls[0];
        expect(icon.type).toBe(ChannelHeaderIcon);
        expect(title).toBe('My threads in this channel');
        expect(tooltip).toBe('My threads in this channel');

        store.dispatch.mockClear();
        (action as () => void)();
        expect(store.dispatch).toHaveBeenCalledWith({type: 'TOGGLE_RHS'});
    });

    it('registers the posted reducer', () => {
        expect(registry.registerReducer).toHaveBeenCalledWith(postedReducer);
    });

    it('registers the global My threads page as a custom route component TYPE', () => {
        expect(registry.registerCustomRoute).toHaveBeenCalledTimes(1);
        const routeCalls = registry.registerCustomRoute.mock.calls as unknown as Array<[string, unknown]>;
        const [route, component] = routeCalls[0];
        expect(route).toBe('my-threads');
        expect(typeof component).toBe('function');
    });

    it('registers the account menu item navigating to the My threads page', () => {
        expect(registry.registerMainMenuAction).toHaveBeenCalledTimes(1);
        const menuCalls = registry.registerMainMenuAction.mock.calls as unknown as Array<[unknown, () => void, unknown]>;
        const [, action] = menuCalls[0];

        const pushState = jest.spyOn(window.history, 'pushState');
        const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
        (action as () => void)();
        expect(pushState).toHaveBeenCalledWith({}, '', '/plug/only-my-threads/my-threads');
        expect(dispatchEvent).toHaveBeenCalled();
        pushState.mockRestore();
        dispatchEvent.mockRestore();
    });

    it('subscribes to the posted websocket event', () => {
        expect(registry.registerWebSocketEventHandler).toHaveBeenCalledWith('posted', expect.any(Function));
    });

    describe('posted websocket handler', () => {
        let handler: (msg: {data?: {channel_id?: string}}) => void;

        beforeEach(() => {
            const wsCalls = registry.registerWebSocketEventHandler.mock.calls as unknown as Array<[string, (msg: {data?: {channel_id?: string}}) => void]>;
            handler = wsCalls[0][1];
        });

        it('dispatches a posted action with the event channel', () => {
            handler({data: {channel_id: 'ch9'}});
            expect(store.dispatch).toHaveBeenCalledWith({type: POSTED_ACTION, channelId: 'ch9'});
        });

        it('ignores events without channel data', () => {
            handler({data: undefined});
            handler({data: {}});
            expect(store.dispatch).not.toHaveBeenCalled();
        });
    });

    describe('reaction websocket handlers', () => {
        let handler: (msg: {data?: {reaction?: unknown}}) => void;

        beforeEach(() => {
            const wsCalls = registry.registerWebSocketEventHandler.mock.calls as unknown as Array<[string, (msg: {data?: {reaction?: unknown}}) => void]>;
            const reactionCalls = wsCalls.filter(([event]) => event === 'reaction_added' || event === 'reaction_removed');
            expect(reactionCalls).toHaveLength(2);
            handler = reactionCalls[0][1];
        });

        it('subscribes to both reaction events with one handler', () => {
            const wsCalls = registry.registerWebSocketEventHandler.mock.calls as unknown as Array<[string, unknown]>;
            const events = wsCalls.map(([event]) => event);
            expect(events).toContain('reaction_added');
            expect(events).toContain('reaction_removed');
        });

        it('parses the reaction JSON string the host sends', () => {
            handler({data: {reaction: JSON.stringify({user_id: 'u1', post_id: 'p1', emoji_name: 'art'})}});
            expect(store.dispatch).toHaveBeenCalledWith({type: REACTION_ACTION, postId: 'p1'});
        });

        it('still accepts an already-parsed reaction object', () => {
            handler({data: {reaction: {post_id: 'p2'}}});
            expect(store.dispatch).toHaveBeenCalledWith({type: REACTION_ACTION, postId: 'p2'});
        });

        it('ignores malformed payloads', () => {
            handler({data: {reaction: '{not json'}});
            handler({data: {}});
            handler({data: undefined});
            expect(store.dispatch).not.toHaveBeenCalled();
        });
    });
});
