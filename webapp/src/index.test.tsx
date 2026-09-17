/**
 * @jest-environment jsdom
 */

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The real client pulls deep exports-only packages that jest cannot
// resolve; the registration test never calls the API anyway.
jest.mock('mattermost-redux/client', () => ({Client4: {}}));

import ChannelHeaderIcon from 'components/channel_header_icon';
import {POSTED_ACTION, postedReducer} from 'reducer';
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
});
