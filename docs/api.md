# Mattermost APIs used by Only My Threads

This document lists every Mattermost API the plugin calls, how it is used,
and the semantics and limits verified against the **v11.9** server source
(`server/channels/api4`, `server/public/model`). Several of these behaviors
caused production bugs before they were understood — treat this file as the
source of truth when touching the data layer.

## Global limits

| Constant | Value | Effect |
|---|---|---|
| `PerPageDefault` | 60 | `per_page` defaults to 60 when omitted or invalid |
| `PerPageMaximum` | 200 | `per_page` is clamped to 200 on every endpoint |
| `POST /posts/ids` body cap | 1000 | more ids → 400 |

## Search

### `POST /api/v4/teams/{team_id}/posts/search`

The primary data source: the user's own root posts of a month.

**Request body we send:** `{terms, is_or_search: false, page: 0, per_page: 100}`,
where `terms` is `in:{channel} from:{username} after:{A} before:{B}`
(private channels use `in:~{name}`).

**Verified semantics (each cost us a bug):**

- **DB search has no paging.** The store query hardcodes `LIMIT 100`
  (`ORDER BY CreateAt DESC`), and `SearchPostsForUser` *returns an empty
  list for any `page > 0`* (a comment in the source says paging is not
  supported). `per_page` is ignored. Some backends also truncate one short
  of 100 (observed 99 in production) due to post-filtering.
- **Both date qualifiers exclude their own day (UTC).** Server-side
  `after:D` resolves to the start of day `D+1`, and `before:D` resolves to
  the end of day `D-1`. Consequences:
  - a month window must start with `after:{last day of previous month}` or
    posts on the 1st are cut entirely;
  - `after:D before:D+1` matches **nothing** — a single day is addressed by
    the bracket `after:D-1 before:D+1`.
- **`sort` is not a free-form parameter.** Whitelist:
  `last_activity_at`, `create_at`, `status`, `admin`, `display_name`; with
  `in_channel` only `status`/`admin` are allowed (`sort=username` → 400).
- **`time_zone_offset`** (minutes) is accepted and used to resolve the date
  qualifiers; the plugin does not send it, so windows align to UTC. No data
  is lost (boundary posts land in the adjacent month's window), but the
  month attribution of posts near midnight can shift for non-UTC users.

**How the plugin uses it** (`utils/threads.ts fetchMonthThreads`):
windowed fetching — a saturated window (99+ results) re-fetches its oldest
day with the bracket window above and continues with `before:{oldest day}`,
deduplicating by post id. Known limitation: a single day holding >100 of
the user's own posts in one channel stays truncated at that day's newest 100.

## Posts

### `POST /api/v4/posts/ids`

One batch call after the month search carries the authoritative reply
counts **and the reactions** of every root: the response posts include
`reply_count` and `metadata.reactions` by design (metadata is added by
`PreparePostForClient`). We chunk requests by **200** ids (server cap 1000).

### `GET /api/v4/channels/{channel_id}/posts?page=&per_page=`

Fallback scan for servers without search. This endpoint **pages properly**
(unlike search). We page by 100 until a short page; deleted posts are
excluded by default, the client-side `delete_at` filter is a safety net.

### `GET /api/v4/posts/{post_id}/thread`

Preloads the full thread into the host store before opening it in the
right-hand sidebar (`receivedPostsInThread`).

### `POST /api/v4/posts/ids/reactions` *(known, not used)*

Bulk reactions for a list of post ids (map `post_id → reactions`).
Currently unnecessary — `/posts/ids` already carries reactions for the
month — noted here for future use.

## Reactions

### `GET /api/v4/posts/{post_id}/reactions`

Live refresh of one post's chips after websocket events or panel toggles.
**Returns JSON `null` (not `[]`) when the post has no reactions** — a Go
nil slice marshals to null; always coalesce (`?? []`).

### `POST /api/v4/reactions`

Adds a reaction. Body `{user_id, post_id, emoji_name}`; the server rejects
a `user_id` other than the session's own.

### `DELETE /api/v4/users/{user_id}/posts/{post_id}/reactions/{emoji_name}`

Removes the user's own reaction (`user_id` must be the session user unless
the caller has `remove_others_reactions`).

## Users and channels

### `GET /api/v4/users?in_channel={channel_id}&page=&per_page=`

The author-picker member list. **Pages reliably** (OFFSET/LIMIT in the
store) with the default ordering **`Username ASC`**, so a sequential walk
to the first short page is safe. `per_page=200` equals the global clamp.
We sort client-side as a safety net. The `sort` whitelist applies (see
Search).

### `GET /api/v4/users/{user_id}/image?_={last_picture_update}`

Avatars in the author menu (`<img>`; cookie-authenticated, the cache-bust
parameter comes from the profile's `last_picture_update`).

## Emoji images

| URL | Purpose |
|---|---|
| `GET /api/v4/emoji/name/{name}` | custom emoji lookup by reaction name; **404 for system emoji** — the plugin relies on this to route system names to static images |
| `GET /api/v4/emoji/{emoji_id}/image` | custom emoji image |
| `/static/emoji/{unified}.png` | system emoji image — **named by unified codepoints, not by emoji name** (`1f3a8.png`, not `art.png`); the plugin carries a vendored name→file dictionary derived from the host webapp's emoji.json |

## WebSocket events

Handled through `registry.registerWebSocketEventHandler`:

| Event | Payload shape | Plugin behavior |
|---|---|---|
| `posted` | `data.channel_id` is a plain string | bump the posted counter to refresh the panel (current channel only) |
| `reaction_added` / `reaction_removed` | **`data.reaction` is a JSON string** (not an object) | parse it, then refetch that post's reactions |

The JSON-string payload of reaction events silently broke live updates for
several versions — parsing must stay.

## Webapp extension points

Registered in `webapp/src/index.tsx`:

- `registerRightHandSidebarComponent` — the panel (component **type**, not
  a JSX element — React error #130 otherwise);
- `registerChannelHeaderButtonAction` — the App Bar button;
- `registerReducer` — the posted/reaction counter reducer;
- `registerWebSocketEventHandler` — the events above.

## Version note

The semantics above were verified against **v11.9.0**
(`mattermost/mattermost` tag). `min_server_version` is 6.2.1; the load-bearing
quirks (search cap, date-qualifier exclusions, reaction payload shape) were
confirmed on v11.9 and v11.11 — re-verify this file when bumping the target
server version.
