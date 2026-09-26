# Venue mode: locked-down bar tablets (design draft, September 2026)

Status: **proposal, nothing built.** This covers a Blackbird tablet
mounted beside a dartboard in a bar: which hardware to buy, how the
tablet is locked down, how it pairs with a venue, how players check in
from their phones, and how its games are saved. Read it alongside the
league and anti-cheat notes in ROADMAP.md.

## 1. Goals and non-goals

Goals

- A cheap tablet (~$150–250) on a stand at each board. It runs Blackbird
  and nothing else, can't be escaped by a customer, and recovers without
  help after power cuts, Wi-Fi drops and app updates.
- The tablet belongs to the **venue**, never to one player. Players
  join a game from their own phones (QR check-in), so results are only
  posted under an account whose owner said yes to that game.
- Games scored on a venue tablet are **venue-witnessed**: signed by a
  registered device, at a known place and time. Leagues can require that.
- Scoring keeps working when the bar's Wi-Fi drops.

Non-goals (for now)

- A custom Linux OS or our own hardware. We use a stock Android tablet
  and an off-the-shelf kiosk browser.
- Proving darts were really thrown. A venue tablet is witnessed, not
  cheat-proof (§9).
- Native apps. The tablet runs the same Next.js web app at a new
  `/venue` route.

## 2. Hardware

| Part | Pick | Approx. |
|---|---|---|
| Tablet | Samsung Galaxy Tab A9+ (11", Wi-Fi) | $150–220 |
| Kiosk browser | Fully Kiosk Browser (PLUS licence, per device) | ~$9 one-time |
| Enclosure + stand | Locking tablet enclosure that **covers the power/volume buttons and the USB port**, on a floor stand or wall arm | $40–120 |
| Power | Right-angle USB-C cable routed inside the enclosure/stand; 15 W+ charger | $15 |
| Optional | Fully Cloud (remote management), paid per device | recurring |

Why the Tab A9+: a well-supported Android with Chrome WebView, big
enough to tap scores standing up, and One UI's **battery protection**
(charging stops at ~80–85 %). Tablets that stay plugged in at 100 % swell
and die. Fire HD 10 also works (Fully Kiosk sideloads) and is cheaper,
but Fire OS is slower and fights device-owner lockdown. Raspberry Pi +
touchscreen is the Linux fallback (§5.5).

## 3. Architecture overview

```
 Bar                                              Cloud
┌────────────────────────────┐        ┌──────────────────────────────────┐
│ Tablet (Fully Kiosk,       │ HTTPS  │ Vercel                           │
│ device owner)              │───────▶│  /api/venue/pair                 │
│  /venue  kiosk shell       │        │  /api/venue/checkin/*            │
│   - device session         │        │  /api/venue/games   (sign+replay)│
│   - device signing key     │        │  /api/venue/heartbeat            │
│   - outbox (IndexedDB)     │        │                                  │
│   - casts to /tv as today  │◀──────▶│ Supabase                         │
└──────────▲─────────────────┘realtime│  venues, venue_staff, devices,   │
           │ QR on screen             │  checkins, game_results(+venue)  │
┌──────────┴─────────────────┐        │  Realtime: device lobby channel  │
│ Player phone (signed in)   │───────▶│                                  │
│  /join/<nonce>             │        └──────────────────────────────────┘
└────────────────────────────┘
```

Three identities:

- **Venue**: a bar, owned by one or more Blackbird accounts (`venue_staff`).
- **Device**: one tablet, paired to one venue. It has its own Supabase
  auth user (role `device`) and a non-extractable signing key.
- **Player**: an ordinary Blackbird account on a phone. It checks in to a
  device for one session.

## 4. Data model (new migration: `supabase/migration-venues.sql`)

```sql
create table venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  plan        text not null default 'pilot',      -- entitlement tier
  settings    jsonb not null default '{}',        -- idle timeout, allowed games, guest policy
  created_at  timestamptz not null default now()
);

create table venue_staff (
  venue_id    uuid not null references venues (id) on delete cascade,
  auth_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner','staff')),
  pin_hash    text,                               -- staff menu PIN on the tablet (argon2/bcrypt)
  primary key (venue_id, auth_id)
);

create table devices (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references venues (id) on delete cascade,
  label        text not null,                     -- "Board 2"
  auth_id      uuid unique references auth.users (id), -- the device's own login
  public_key   jsonb not null,                    -- JWK, ECDSA P-256
  status       text not null default 'active' check (status in ('active','revoked')),
  app_version  text,
  last_seen    timestamptz,
  battery      int,
  created_at   timestamptz not null default now()
);

create table device_pairing_codes (
  code_hash   text primary key,                   -- sha256 of the 8-char code
  venue_id    uuid not null references venues (id) on delete cascade,
  label       text not null,
  created_by  uuid not null,
  expires_at  timestamptz not null                -- 10 minutes
);

create table checkins (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references devices (id) on delete cascade,
  nonce       text unique not null,               -- the QR payload
  player_id   uuid references players (id),       -- null until a phone claims it
  claimed_at  timestamptz,
  expires_at  timestamptz not null,               -- unclaimed: 2 min; claimed: session end or 6 h
  ended_at    timestamptz
);

alter table game_results
  add column venue_id  uuid references venues (id),
  add column device_id uuid references devices (id),
  add column source    text not null default 'phone'
    check (source in ('phone','venue','prodigy'));
```

RLS

- Every new table: RLS on. Almost all writes go through `/api/venue/*`
  with the service role; the browser only reads.
- `venues` and `devices`: readable by that venue's staff. A device may
  read its own `devices` row and its `venues` row.
- `checkins`: a device reads rows for its own `device_id`. A player
  reads rows where `player_id` is their own player.
- A **device** auth user gets **no** read access to `game_results`,
  `follows` or other players' data. The kiosk shows only the current
  session's players plus a venue leaderboard (a server-computed view, §7.4).
- Device users are marked by `app_metadata.role = 'device'`, which only
  the server can set. Existing policies that say `to authenticated` must
  exclude them: add `and coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'device'`,
  or move devices to their own Postgres role. **Audit every existing
  policy before the first device logs in.**

## 5. Kiosk lockdown

Lockdown happens in three layers: the Android device, the kiosk
browser, and the web app. Assume a curious, slightly drunk customer
with five minutes and no tools. Assume a determined one can still
unscrew the enclosure (§9).

### 5.1 Provision the tablet (once per device, ~20 min)

1. Update the OS to the latest release, then **factory reset**.
2. During setup: skip Wi-Fi if you can, **don't add a Google or Samsung
   account**, turn off every optional service, and set no screen lock.
   Device-owner provisioning fails if any account is on the device.
3. Turn on Developer options and USB debugging. From a laptop:
   ```
   adb install FullyKioskBrowser.apk
   adb shell dpm set-device-owner de.ozerov.fully/.DeviceOwnerReceiver
   ```
   (Check the component name against Fully's current provisioning docs
   before relying on it. For a fleet, QR-code enrolment or an Android
   Enterprise MDM does the same without adb.)
4. Now join the bar's Wi-Fi. Prefer a dedicated SSID or guest VLAN that
   only allows outbound HTTPS.
5. Samsung settings:
   - Battery → Battery protection → **Maximum** (stop at ~80–85 %).
   - Display: screen timeout at the maximum; Fully keeps it awake anyway.
   - Software update: turn off auto-download over Wi-Fi. Update by hand
     during a maintenance visit.
   - Turn off Bixby, Edge panels, Game Launcher, all notifications, and
     "Lock network and security".
6. Turn **off** USB debugging and Developer options once Fully has its
   settings (§5.2). A reachable adb port lets anyone with a cable in.

### 5.2 Fully Kiosk settings

Export these as a settings JSON and import it onto every tablet, so
they stay identical.

| Area | Setting |
|---|---|
| Web content | Start URL `https://<domain>/venue`; **URL whitelist** limited to our origin and the Supabase project URL; block all other navigation; no pop-ups; turn off file uploads and downloads |
| Kiosk mode | **Enable kiosk mode** with a long exit PIN (not the staff PIN, and not reused across venues); single-app mode; turn off status bar, notification shade, home, recents and back |
| Device owner | Disallow: factory reset, safe boot, adding users, USB file transfer, installing apps, config changes to Wi-Fi, mounting media; make Fully the persistent home app |
| Power | Launch on boot; keep screen on while plugged in; restart the app after a crash; reboot daily at 05:00 |
| Idle | Screensaver after 10 min of no touches, showing the venue attract page (not a photo slideshow); reload the start URL when the screensaver ends |
| Hardware keys | Turn off volume keys; the enclosure covers the physical buttons |
| Web | Turn off pinch zoom, text selection and context menu; allow the JavaScript interface **only for our origin**; clear cache on each app start but keep IndexedDB and localStorage, which hold the outbox and device key |
| Remote | Fully Cloud or Remote Admin on, password-protected, reachable only from the management side, never on the open bar network |

### 5.3 App-side lockdown (`/venue` route)

The web app must not assume the browser is locked. Anyone who reaches
the URL on their own phone is a threat too.

- `/venue` is a separate shell (`app/venue/page.js`). It never renders
  the account screens, Friends, Merlin, the admin panel, or any link
  out of `/venue`. Links to the marketing site, legal pages and
  profiles are left out, not just hidden.
- Without a valid **device session** it only renders the pairing screen.
  A normal player session on `/venue` gets redirected to `/app`.
- CSS/JS hardening: `user-select: none`; `touch-action: manipulation`;
  block `contextmenu`, `dragstart` and long-press callouts; stop
  horizontal swipe navigation; `maximum-scale=1` in the viewport meta.
- No free-text fields except guest names, and those are capped,
  filtered, and rendered only as text.
- **Staff menu**: long-press the logo for 3 s, then enter the venue
  staff PIN, checked on the server and rate-limited to 5 tries per 15 min
  per device. From there staff can void the current game, end a session,
  run a network test, or see the device ID and app version. The staff
  menu **cannot** exit the kiosk; only the Fully exit PIN does.
- **Session reset**: after a game summary, or 10 min idle on the lobby,
  or 15 min idle mid-game (with a 60 s "Still playing?" prompt first),
  the tablet ends all check-ins, wipes the in-memory game, and goes back
  to the attract screen. Nothing a player did stays on screen for the
  next group.
- **Updates**: the service worker precaches `/venue`. A `/api/venue/heartbeat`
  reply includes the current build ID. On a mismatch the tablet reloads
  **only when it is on the attract screen**, never mid-game. A build that
  fails to boot falls back to the cached shell (the `sw.js` behaviour today).

### 5.4 Physical

- Enclosure covers the buttons, the camera cut-out (the camera isn't
  needed: the tablet shows QR codes and phones scan them) and the USB
  port. Keys stay with the owner, not behind the bar.
- Mount at the scorer's position, clear of the throw line and out of
  the dart landing zone. A clear, replaceable screen protector against
  beer.
- Asset tag on the enclosure with the device label ("Board 2") and a
  support URL.

### 5.5 Linux fallback (Raspberry Pi 5 + 7"/10" touchscreen)

For a venue that wants wired Ethernet or has no tablet budget.
Raspberry Pi OS Lite, then `cage` (single-app Wayland compositor)
running `chromium --kiosk --noerrdialogs --disable-pinch
--overscroll-history-navigation=0 https://<domain>/venue`, as a systemd
service with `Restart=always`. Read-only overlay filesystem, SSH keys
only, unattended security updates. It works, but we then own an
operating system. Tablets first.

## 6. Pairing a tablet to a venue

1. A venue owner opens **Venue → Tablets → Add tablet** in the normal app
   and names it ("Board 2"). The server creates a `device_pairing_codes`
   row and shows an 8-character code (the cast alphabet with no
   ambiguous glyphs), valid 10 min.
2. The fresh tablet shows `/venue/pair`. Its first boot creates an
   **ECDSA P-256 key pair with WebCrypto, `extractable: false`**, and
   stores the `CryptoKey` in IndexedDB.
3. The tablet POSTs `/api/venue/pair { code, publicKeyJwk }`. The server:
   - hashes the code, finds the unexpired row, and deletes it (one use);
   - creates an auth user for the device (random email on a reserved
     domain, random password never shown, `app_metadata: { role: 'device',
     device_id, venue_id }`);
   - inserts the `devices` row with the public key;
   - returns a session (access + refresh token) for that user.
4. The tablet keeps the Supabase session like any client. Sessions refresh
   on their own; a revoked device is banned in Auth and its refresh fails.

Revoking: **Venue → Tablets → Revoke** sets `status = 'revoked'` and bans
the device's auth user. Every venue API route checks
`devices.status = 'active'` too, so revocation works immediately even
while an access token is still valid (up to 1 h). Re-pairing a wiped
tablet creates a new device; old game rows keep the old `device_id`.

About the key: a non-extractable WebCrypto key can't be copied out of
the browser, but it isn't hardware-attested. Someone who roots the
tablet can use it on that tablet. Pairing proves "a tablet a venue
owner set up", nothing stronger (§9).

## 7. Players at the tablet

### 7.1 QR check-in (primary)

1. On the lobby screen, **Add player** makes the tablet call
   `/api/venue/checkin/start`. The server inserts a `checkins` row with
   a random 128-bit `nonce`, valid 2 min, and returns it. The tablet
   draws a QR for `https://<domain>/join/<nonce>` with `lib/qr.js`, and
   renews it when it expires.
2. The player scans it. `/join/<nonce>` opens in their phone browser
   (or the installed app) and asks them to sign in if they aren't. It
   shows "Join **Board 2 at The Crown** for this session?" with the
   venue name, so a QR stuck on a different bar's wall is obvious.
3. On **Join**, the phone POSTs `/api/venue/checkin/claim { nonce }`. The
   server checks the nonce is unclaimed and unexpired, and the device is
   active. It sets `player_id` and `claimed_at`, and sets `expires_at`
   to 6 h out.
4. The server broadcasts `{ player: { id, displayName, color, tag } }` on
   the Realtime channel `venue-device:<device_id>`. The tablet adds the
   player to the lobby. (Fallback if Realtime is down: the tablet polls
   `/api/venue/checkin/status` every 2 s while a QR is on screen.)
5. The phone now shows "You're checked in on Board 2" with **Leave**.
   Leaving, or the tablet ending the session, sets `ended_at`.

A check-in means "this account agrees that games on this device, during
this session, are posted under my name." It replaces today's rule that
anyone can post rows for any username, for venue games.

### 7.2 Handle + PIN (fallback, off by default)

For a regular with a dead phone. Players can set a 6-digit **venue PIN**
in Account (stored hashed). The tablet takes `@handle` + PIN and the
server checks it, rate-limited per handle and per device (5 tries, then
15 min lockout). A PIN is much weaker than a phone scan. Games joined
this way are marked `checkin_method: 'pin'`, and leagues can refuse them.

### 7.3 Guests

A typed name, no account. Guests never get `game_results` rows, the same
as bots today. They show in `opponents` as `guest:<name>`. **Any game
with a guest is unranked** (`result = 'practice'` for the account holders),
or someone could farm Elo off made-up opponents.

### 7.4 What the tablet shows

- Lobby: checked-in players, game picker (the venue's allowed games),
  Start.
- Game: the existing `Play*.js` screens in a new `kiosk` layout: no
  header menu, no Ask Merlin, no profile links.
- Summary: result, Elo changes and badges. It auto-clears after 60 s or
  on **New game** (which keeps the same players checked in).
- Attract screen: "Tap to play", this week's venue leaderboard from a
  server view (`venue_leaderboard(venue_id)`, a security-definer function
  returning names, colours and a stat only for players who have played
  at the venue), and the cast code for the bar TV.
- Casting to the bar's TV uses the existing `/tv` pairing, unchanged.

## 8. Saving a venue game

`POST /api/venue/games` with the device session:

```jsonc
{
  "gameId": "uuid",
  "gameType": "x01", "config": { ... },
  "players": ["<player uuid>", "guest:Sam"],
  "checkins": ["<checkin uuid>", ...],          // one per account holder
  "events": [ { "type": "game.dart", "dart": {...}, "t": 1234 }, ... ],
  "startedAt": "...", "completedAt": "...",
  "appVersion": "...",
  "signature": "base64(ECDSA-P256-SHA256(canonical JSON of everything above))"
}
```

The server, in order:

1. Checks the device session and that the device is active. Verifies the
   signature against `devices.public_key`.
2. For every account holder: a `checkins` row for **this device**,
   claimed before `startedAt`, and not ended before `startedAt`.
   Otherwise reject.
3. Replays `events` with `packages/scoring-core` (X01, Cricket, Baseball
   today) and gets the winner and stats **itself**. The client's summary
   is ignored. Game types scoring-core can't replay yet are saved
   unranked until they're ported.
4. Plausibility checks on the per-dart timestamps (`lib/recorder.js`
   `stamp()`): sensible total duration, no impossible dart rate. Anything
   odd is saved with a `flags` entry for league admins; it isn't rejected.
5. Computes Elo on the server, then inserts `game_results` rows with
   `source = 'venue'`, `venue_id`, `device_id`. This runs in one
   transaction (a `submit_venue_game` security-definer function),
   idempotent on `game_id` the way `recordGame` is today.

### Offline

`lib/pendingGames.js` already queues unsent games in localStorage.
Venue mode moves that queue to IndexedDB and saves **the signed payload**,
so it can be sent hours later without re-signing. Check-ins can't happen
offline, because a phone scan needs the server. Players already checked
in keep playing through a drop, since their check-ins last 6 h. New
arrivals during an outage play as guests (unranked). The attract screen
shows "N games waiting to sync" to staff, never to customers.

## 9. Threat model

| Threat | Mitigation | Left over |
|---|---|---|
| Customer escapes the kiosk (swipes, long-press, settings, safe mode) | Device owner + Fully kiosk + app hardening (§5) | Low |
| Customer unplugs, unscrews or steals the tablet | Locking enclosure; revoke in Venue → Tablets; the device key is useless off that tablet | Hardware loss |
| Stranger opens `/venue` on their own phone | Needs a device session, which only pairing gives | None |
| Game posted under someone without consent | Needs that player's check-in on this device (§8 step 2) | PIN fallback is weaker; flagged |
| Faked or edited game from a rooted tablet or replayed request | Signature + server replay + `game_id` idempotency | A rooted, paired tablet can still sign invented darts; revoke on detection |
| Players type darts they didn't throw | Opponent is physically present; anomaly flags | Not solvable by software; auto-scoring hardware (Prodigy) is the only real fix |
| Elo farming with guests or alt accounts | Guest games unranked; alt accounts need a phone login and a check-in at the board | Colluding friends; league admins review flags |
| Device account reads private data | Device role excluded from player-data policies (§4) | Needs the policy audit |
| QR photographed and scanned from elsewhere | 2 min expiry, one use, confirm screen names the venue | Someone at the bar could claim a slot; the lobby shows who joined, so players see it |

## 10. Build order

| Phase | Work | Depends on |
|---|---|---|
| 0 | Server-side game saving and Elo (ROADMAP anti-cheat step 1); close the open `players` UPDATE and `game_results` INSERT policies | none |
| 1 | `migration-venues.sql`; venue + staff admin screens in `/app`; pairing (§6); device role policy audit | 0 |
| 2 | `/venue` shell, kiosk layout for X01/Cricket/Baseball, session reset, staff menu | 1 |
| 3 | QR check-in (§7.1), Realtime lobby, `/join/<nonce>` | 2 |
| 4 | `/api/venue/games` with signature + replay; IndexedDB outbox | 0, 3 |
| 5 | Heartbeat, tablet health in Venue → Tablets, build-ID reloads | 2 |
| 6 | Pilot: one Tab A9+ at one bar for 2–4 weeks; write the provisioning checklist from what went wrong | 1–5 |
| Later | PIN fallback, guest policy per venue, venue leaderboard on `/tv`, per-venue entitlements, porting the other games into scoring-core | pilot |

Rough effort: phases 1–5 are 4–6 working sessions after phase 0. The
pilot is calendar time, not coding.

## 11. Open questions

1. **Who creates venues?** The bar owner, a league organiser, or only us
   during the pilot? Suggestion: admin-only for the pilot.
2. **Pricing**: a per-venue monthly plan, or included in league Premium?
   Settle it before phase 1 hard-codes `plan`.
3. **Guests**: allow by default, or let each venue choose?
4. **Which games** on tablets at launch: only the three scoring-core
   games (replayable, rankable), or all nine with the others unranked?
5. **Remote management**: pay for Fully Cloud per device, or build
   enough into the heartbeat (last seen, version, battery, remote
   reload) to skip it?
