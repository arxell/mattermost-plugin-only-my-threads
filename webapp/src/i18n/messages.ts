// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Plugin translations. Any locale other than the listed ones falls back to English.
export const messages = {
    en: {
        'panel.title': 'My threads in this channel',
        'panel.buttonTooltip': 'My threads in this channel',
        'panel.channelNotSelected': 'No channel selected',
        'panel.loading': 'Loading…',
        'panel.refreshing': 'Refreshing…',
        'panel.loadError': 'Failed to load: {message}',
        'panel.retry': 'Retry',
        'panel.refresh': 'Refresh',
        'panel.emptyMonth': 'No messages of yours in this channel this month.',
        'panel.awaiting': 'Awaiting reply',
        'panel.showMore': 'Show more: {month}',
        'panel.reply': 'reply',
        'panel.jump': 'Jump',
        'panel.save': 'Save',
        'panel.unsave': 'Remove from saved',
        'panel.noMore': 'No more of your messages found in this channel.',
        'panel.crash': 'The My Threads panel crashed: {message}',
        'snippet.code': '[code]',
        'snippet.image': '[image]',
    },
    ru: {
        'panel.title': 'Мои треды в канале',
        'panel.buttonTooltip': 'Мои треды в канале',
        'panel.channelNotSelected': 'Канал не выбран',
        'panel.loading': 'Загрузка…',
        'panel.refreshing': 'Обновление…',
        'panel.loadError': 'Ошибка загрузки: {message}',
        'panel.retry': 'Повторить',
        'panel.refresh': 'Обновить',
        'panel.emptyMonth': 'В этом месяце ваших сообщений в канале нет.',
        'panel.awaiting': 'Ожидает ответа',
        'panel.showMore': 'Показать ещё: {month}',
        'panel.reply': 'Ответить',
        'panel.jump': 'Перейти',
        'panel.save': 'Сохранить',
        'panel.unsave': 'Убрать из сохранённых',
        'panel.noMore': 'Больше ваших сообщений в канале не найдено.',
        'panel.crash': 'Панель «Мои треды» упала с ошибкой: {message}',
        'snippet.code': '[код]',
        'snippet.image': '[изображение]',
    },
} as const;

export type MessageId = keyof typeof messages.en;
