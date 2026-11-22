# The duel relay

A small WebSocket relay for Ember Reach's duels (0.5.2 and later). It pairs two players' games, either by a room
code ("join ABC234") or from a quick-match queue, and passes their messages between them. The protocol is in
[`docs/duel-protocol.md`](../../docs/duel-protocol.md). Licence: GPL-2.0-or-later, as the Library's other tools.

| File | What it is |
| --- | --- |
| `protocol.mjs` | Rooms, codes, the queue, the version check and the limits. Shared by the two relays below. |
| `relay.mjs` | The relay in Node, with no packages: Node's own `http` and `crypto`, plus the WebSocket framing. `--lan CODE` holds one room, as Rudolf OS's LAN duel service does. |
| `worker.mjs`, `wrangler.toml` | The same relay on Cloudflare Workers, with a Durable Object per match and one for the quick-match queue. |

What it promises:

- It never tells a player the other's address.
- It logs nothing about players and stores nothing. A match's room exists only while the match does.
- Limits: 8 KB a message; 90 messages a second, with a burst of 180; 2,000 rooms; 8 connections from one address
  (Node). Ten seconds to say hello, ten minutes waiting for a second player, sixty seconds of silence in a match.
- Both players must run the same version of the game. The relay checks it, and so do the games.

Tests (local only): `tests/emberreach_duel_relay_t.js` covers the Node relay over real WebSockets, the timers, and
the Worker on a stand-in for its runtime. `tests/emberreach_duel_net_browser_t.js` runs two Chromium pages dueling
through `relay.mjs`.

## Running it locally

    node tools/duel-relay/relay.mjs --port 8787 --host 127.0.0.1

Then open the game with `?duel&relay=ws://127.0.0.1:8787/` in two windows. A page's `?relay=` only takes `ws://` or
`wss://` addresses.

## Putting it online (the owner's steps: nothing is deployed yet)

The relay needs an account somewhere, so deploying it waits for the owner. Either of these works.

### A. Cloudflare Workers (the plan's choice)

1. Make a Cloudflare account, or sign in. `wrangler.toml` asks for SQLite-backed Durable Objects, which
   Workers' free plan has offered since 2025. If the account's plan doesn't include them, Workers Paid does.
2. On a computer with Node 20 or later: `npm install -g wrangler`, then `wrangler login`.
3. `cd tools/duel-relay && wrangler deploy`. This creates the Worker `ember-duel-relay` with its two Durable Object
   classes (the `v1` migration) and prints its address, `https://ember-duel-relay.<account>.workers.dev`.
4. Optional: in the Cloudflare dashboard, give it a custom domain (Workers › ember-duel-relay › Settings › Domains),
   and add a rate-limiting rule for its route (for example 30 new connections a minute from one address). The Node
   relay's per-address limit isn't in the Worker; Cloudflare's own rules do that job.
5. Check it: `curl https://<address>/` answers "Ember Reach duel relay". Open the game twice with
   `?duel&relay=wss://<address>/` and play a quick match.

### B. Any host with Node

1. On a small server (any Linux VPS), copy `tools/duel-relay/` and run `node relay.mjs --port 8787 --host 127.0.0.1`
   as an unprivileged user (a systemd service with `Restart=always`, `DynamicUser=yes`, `NoNewPrivileges=yes`).
2. Put TLS in front of it, for example Caddy with `duel.example.org { reverse_proxy 127.0.0.1:8787 }`. Browsers
   inside an `https` page need `wss://`.
3. Check it as in A.5.

### Then, in the game

Set `RELAY` in `apps/rudolf-emberreach/www/net.js` to the `wss://` address and release the next Ember Reach
version. Online then stops saying "not set up yet". Nothing else changes: the game sends nothing anywhere but the
relay the player picks for a match.
