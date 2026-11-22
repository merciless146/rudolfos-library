# Ember Reach's duel relay

A browser game can't accept connections, so two pilots dueling in Ember Reach meet through a small relay. The relay
pairs them, then passes each one's messages to the other. It never passes on their addresses and stores nothing.

| File | What it is |
| --- | --- |
| `relay-core.js` | The rules: room codes, quick match, version checks, limits. Transport-agnostic. |
| `relay.js` | The relay on Node: its own small WebSocket server, no packages. `node relay.js [--port 8765] [--host 127.0.0.1]` |
| `worker.js` | The same relay on Cloudflare Workers, with one Durable Object holding the rooms and the queue in memory. |
| `wrangler.toml.example` | Its Workers configuration. |

The game's side is `apps/rudolf-emberreach/www/net.js`. On a home network, Rudolf OS (1.6.2) runs its own C version
of the same protocol (`rudolf-duel`), found by mDNS. The relay here is the **Online** one.

## The protocol

1. A game connects and sends one of:
   - `{t: 'host', v, proto}`: open a room. The relay answers `{t: 'room', code}` (six letters and digits).
   - `{t: 'join', code, v, proto}`: join that room.
   - `{t: 'quick', v, proto}`: wait for the next player with the same version (`{t: 'queued'}` until then).
2. While waiting, a game may send `{t: 'ping'}` every 15 s to keep its place.
3. Once paired, both get `{t: 'paired', role: 'host' | 'guest'}`. From then on, every message one sends reaches the
   other unchanged (the game's own protocol: net.js's header). When one leaves, the other gets `{t: 'gone'}`.
4. A refusal is `{t: 'error', why, text}`, and the relay closes the connection. `why` is one of:
   - `version`: the other game isn't the same version.
   - `proto`: a different relay protocol.
   - `room`: no room waiting with that code (none, or it already has its two players).
   - `bad`: a message the relay doesn't understand.
   - `size`: a message over 8 KB.
   - `rate`: more than 120 messages a second (240 at once).
   - `busy`: 400 players already, or 8 from one address.
   - `idle`: nothing heard for 60 s, or a room nobody joined in 10 minutes.

An address is used only to count connections from it. It's never sent to anyone, kept or logged; `relay.js` logs
only counts.

## Tests (local only)

`tests/emberreach_relay_t.js`:
- The rules on a stand-in clock.
- `relay.js` over real WebSockets, including bad handshakes and bad frames.
- `worker.js` in Cloudflare's own runtime (workerd, through Miniflare), when Miniflare is installed. Without
  Miniflare, that part says SKIP.

```
NODE_PATH=<a folder with miniflare's node_modules> node tests/emberreach_relay_t.js 8770
```

## Putting it online (the owner's steps; nothing is deployed yet)

The game shows Online as "not set up yet" until `net.js` names the relay. Deploying needs a Cloudflare account (the
Workers free plan is enough to start: SQLite-backed Durable Objects are on it).

1. Create a Cloudflare account, or use yours, and install Node.
2. In `tools/duel-relay`:
   - `cp wrangler.toml.example wrangler.toml`
   - `npx wrangler login` (in a browser: it asks which account)
   - `npx wrangler deploy`

   Wrangler prints the address, `https://ember-reach-duel-relay.<your-subdomain>.workers.dev`. Optionally, give it a
   name of the project's own under Workers › the relay › Settings › Domains & Routes.
3. Check it: open that address in a browser ("Ember Reach duel relay"). Then try two games with
   `?duel&relay=wss://ember-reach-duel-relay.<your-subdomain>.workers.dev/duel`, from two browsers or computers:
   Online › Host on one, Join with the code on the other.
4. Set `RELAY` in `apps/rudolf-emberreach/www/net.js` to `'wss://…/duel'`, raise Ember Reach's version, and publish
   the Library as usual. Online then offers Quick match, Host and Join.

Things to keep in mind:
- **Costs.** On the free plan, Workers requests and Durable Object time have daily limits; a duel holds two
  WebSockets for its length. The dashboard's Durable Objects page shows the use. Cloudflare's WebSocket Hibernation
  API would cut the object's billed time, if it's ever needed.
- **Logs.** Workers keep no request logs unless you turn on Logs or `wrangler tail`. The relay itself writes none.
- **Another host.** Any server with Node can run `node relay.js --port 8765` behind a TLS proxy (wss://) instead.
  The game only needs the address.

GPL-2.0-or-later.
