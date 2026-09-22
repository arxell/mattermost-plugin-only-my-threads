// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The panel shows one fixed date format everywhere (dd.mm.yy, hh:mm AM/PM)
// instead of the account locale's order, per the owner's preference; the
// time part keeps the locale's 12/24-hour convention.
export function formatPanelDate(ms: number, locale: string): string {
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const time = d.toLocaleString(locale, {hour: '2-digit', minute: '2-digit'});
    return `${dd}.${mm}.${yy}, ${time}`;
}

// The "Show more" label: the localized name of the month N months back.
export function monthLabel(monthsBack: number, locale: string): string {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - monthsBack);
    return d.toLocaleString(locale, {month: 'long', year: 'numeric'});
}
