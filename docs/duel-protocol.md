# Ember Reach duels over a network: the protocol

Ember Reach 0.5.2. Two people's games in one duel, on a LAN or online. Both games connect to a **relay**, a
WebSocket server that pairs them and passes their messages between them. A browser page can't accept connections,
so even on a LAN one computer runs a relay:

- **Online:** the duel relay (`tools/duel-relay`): `relay.mjs` (Node, on any host) or `worker.mjs` (Cloudflare
  Workers, a Durable Object per match). It has room codes and a quick-match queue. The game's address for it is
  `RELAY` in `apps/rudolf-emberreach/www/net.js`; while that's empty, Online shows as "not set up yet".
- **LAN:** Rudolf OS's duel service (`rudolf-duel`, Rudolf OS 1.6.1). The host's game asks for it through the game
  kit (`RG.lan.host`). It runs only while that player hosts, holds one room, and is announced on the network by
  mDNS (`_emberduel._tcp`). The other player's game finds it there (`RG.lan.find`) and joins.

The protocol is the same everywhere, and so is the game's code (`net.js`). Only where the relay is differs.

## The relay's part

Every message is one WebSocket text frame holding a JSON object, at most 8 KB.

The first message from a player:

    {"t":"hello", "proto":1, "game":"ember-reach", "ver":"0.5.2", "want":"host" | "join" | "quick", "code":"ABC234"}

- `host`: the relay makes a room and answers `{"t":"room","code":"ABC234"}`. On a LAN service the room's code is
  fixed when it starts.
- `join` with `code`: joins that room. Answers `{"t":"error","why":"room"}` if no such room is waiting,
  `"full"` if it already has two, `"version"` (with the room's `ver`) if the game or version differs.
- `quick`: the first waiting quick-match room of the same game and version, or a new one. Answers `{"t":"wait"}`
  while it waits.

Once two are in a room, each gets `{"t":"paired","role":"host"}` or `{"t":"paired","role":"guest"}`. From then on,
every message beginning `{"t":"g"` passes to the other as it is. When one goes (closes, or is dropped), the other
gets `{"t":"left"}` and the relay closes it too. The room goes with them; nothing is kept.

Errors are `{"t":"error","why":...,"text":...}`, then the relay closes the connection. `why` is one of `bad`
(not a hello the relay knows), `version`, `room`, `full`, `busy` (too many rooms; or a LAN service already
hosting), `limit` (too big or too fast) and `time` (no hello within 10 s, nobody joined in 10 minutes, or a paired
player silent for 60 s).

**Limits:** 8 KB a message; 90 messages a second with a burst of 180 (a game sends 30, and a ping a second); 2,000
rooms; 8 connections from one address at once (the Node relay; Cloudflare's own limits cover the Worker).

**Privacy:** the relay never tells a player the other's address, and logs nothing about players. The game sends
nothing anywhere but the relay the player picked for a match.

### Protocol 2: co-op wings of up to four (Ember Reach 0.6.0)

For Ember Reach's co-op wing (docs/plan-ember-reach-pilots.md, P5). The same relays (Node, the Worker and Rudolf OS's
`rudolf-duel`) take both protocols; protocol 1 (duels) is exactly as above.

    {"t":"hello", "proto":2, "game":"ember-reach", "ver":"0.6.0", "want":"host", "size":2-4}
    {"t":"hello", "proto":2, "game":"ember-reach", "ver":"0.6.0", "want":"join", "code":"ABC234"}

- `host` with `size` (2 to 4: the host and up to three guests): answered `{"t":"room","code":...}` as before.
- `join`: each guest is given the lowest free seat, `{"t":"paired","role":"guest","id":1-3,"size":N}`, and the host
  is told `{"t":"joined","id":N}`. `"full"` once every seat is taken; `"room"` for a duel's room (or a wing's code
  given in protocol 1).
- No `quick` in protocol 2 (`"bad"`): quick match stays duels-only.
- **Messages:** the host's `{"t":"g"...}` go to every guest, or to one when they begin `{"t":"g","to":N,`. A guest's go
  to the host only, the relay adding the seat: `{"t":"g","f":N, ...}`. Guests never hear each other directly: the
  host's game passes on what they need.
- **Leaving:** a guest gone (closed, or dropped) frees their seat, the host gets `{"t":"left","id":N}`, and the room
  stays open for another; a room left empty waits 10 minutes again. The host gone: every guest gets `{"t":"left"}`
  and is closed, and the room goes.
- The limits are protocol 1's, per connection. The host's game sends once for the whole wing.

The games' own part (net.js `room()`): each guest says `{"k":"hi","proto":2,"ver","pilot"}`; the host answers
`{"k":"welcome","id"}` or `{"k":"bye","why"}` (`version`, or its own rule: `hardcore`, a Hardcore host taking only
Hardcore pilots) and the relay frees the seat when the guest closes. Pings go both ways as in duels; a guest silent
for 10 s is let go by the host, and a host silent for 10 s ends the guest's session.

### Ember Reach's wing messages (0.6.1, `wing.js`)

Over protocol 2, after the welcome. Coordinates are relative to each message's centre `o` (the sender's ship), so
they stay within the relay's reach however far the system's worlds are.

- `{k:'wing', star, at, name, day, o, names}`: the host to a guest just welcomed, and to all when its system changes.
- `{k:'st', n, star, at, name, day, o, ps, np, sh}` (the host, 15 a second): every member's ship (`ps`: seat, flight
  state, model, name, condition, cloak 0/1/2, docked), the NPCs near any member (`np`: details when first sent and
  every 3 s), and the shots in flight (`sh`: `tg` the target's seat, `fr` the guest whose shot it was). Kept under
  the relay's 8 KB by dropping shots, then NPCs.
- `{k:'in', n, star, o, me, m, nm, c, ck, d, sh, ev}` (a guest, 15 a second): its ship, shots, and claims
  (`ev`: `{e:'hitN', i, dmg, kind}`).
- `{k:'hit', dmg, kind}` (the host to one guest): an NPC's shot hit them. `{k:'kill', i}`: their claim destroyed it.
- `{k:'jump', to, at, name}` (the host to all): its jump, for the guests to follow.
- (0.6.2) `wing` also carries `mk` (the host's market records for the system's ports) and `cl` (its colonies there);
  `ps` and `in` carry `pd`, the pad a member holds (`[port, pad]`).
- (0.6.2) `{k:'mkt', key, e}` (the host to all): a market record changed. `{k:'trade', key, good, qty, sold, day}` (a
  guest to the host): their trade, for the host to record in its market.
- (0.6.3) `{k:'shares', ms}` (the host to all when anything in it changes, and to a guest just welcomed): the
  missions it shares (`ms`, `wing.js` packMission: what each is, its deadline, the work done `p` as `{k, s, d, v, u}`:
  kills, seconds in the system, the depot, delivered, surveyed; `done` once it's over, sent once more). `{k:'mp', id,
  p}` (a guest to the host, when it changes): the work done on a copy the guest took, merged into the host's (never
  undone; kills only as the host's game counted them).
- (0.6.4) Roaming: `{k:'world?', star}` (a guest to the host, on entering any system) asks for the host's galaxy's
  records there; `{k:'world', star, mk, cl}` (the host to that guest) answers, as `wing`'s `mk` and `cl`. `in`
  carries `sn`, the guest's system's name; `st` carries `wh` every 3 s, `[[seat, system name]]` for the wing. A
  guest's `trade` is taken for the system it's in, wherever that is; `mp`'s kills are taken where the host isn't (a
  roaming guest's game keeps that system).
- (0.6.5) Together away from the host: `st`'s `wh` is sent every second as `[seat, system's name, system, keeps]`;
  in a system the host isn't in, the guest with `keeps` 1 (the first there) keeps it. Its game sends `{k:'fw', to,
  m}` to the host: `m` its `st` (`to` null), or a `hit` or `kill` for one seat; the host passes it on, from that
  keeper only, to the others in its system (`st` as `{k:'kst', kp, ...}`, the keeper's seat in `kp`). The others'
  `in` goes on from the host to the keeper as `{k:'kin', fs, ...}` (`fs`: whose).

## The game's part

All of these are `{"t":"g","k":...}` messages.

- `hi` `{proto, ver, ship}`: each says it on being paired. If the `proto` or the `ver` differs from its own, a
  game answers `{"k":"bye","why":"version","ver":...}` and both show "The other pilot runs Ember Reach 0.5.1 and you
  run 0.5.2: both need the same version to duel."
- `start` `{seed, ships: [host's, guest's]}` (host): a match begins. The arena (`duel.js` `arena(seed)`) is built from
  the seed on both sides, so no rock travels.
- `st` (host, 30 a second): `n`, `me` (its ship: `p` relative to the arena's centre, `v`, `q`, `w`), `c`
  (`thr`, the throttle), `m` (the match: round, wins, phase, clock, damage done, ships, the last round's result),
  `cond` ([the host's, the guest's] shields, hull and `dead`), `sh` (the shots it fired since the last), `ev`
  (what happened: `said` a round won, `sudden`, `next` the next round, `hit` on the guest with the shield and hull it
  cost, `kick` a ram's change to the guest's velocity, `flare`).
- `in` (guest, 30 a second): `n`, `me`, `c`, `sh`, `ev` (`rock` with the damage a rock did it, `flare`).
- `again` `{ship}`: ready for another match (Rematch, or Ready after choosing a ship). The host starts it once both
  are.
- `ping` / `pong` `{at}`: once a second each way; the round trip shows beside the duel's clock.
- `bye` `{why}`: leaving.

**The host decides:** `duel.js`'s match runs only in the host's game. It decides hits (its own shots on the guest's
ship and the guest's shots on its own), kills, collisions between the ships and the clock. The guest flies its own
ship at once, takes its shields, hull and the match from the host, and shows the host's shots without deciding
anything. A rock the guest hits is felt in its own game, which tells the host the damage.

**Smoothing:** each game shows the other's ship as a ghost of the last state heard (`net.js` `ghostStep`). It is
carried on by its own velocity every step, eased towards where that state says it is now (extrapolated half a second
at most), and snapped there if it is more than 400 m off.

**Ending:** a connection closed, 10 s without a word from the other, a version mismatch or leaving ends the match
cleanly on both sides with a message. The other ship goes, the clock stops, and the duel screen is a press away. A
LAN host's game asks Rudolf OS to stop the duel service as the duel ends (and the service stops by itself when the
host's connection closes).

## Rudolf OS's duel service (LAN)

The game kit's messages to the desktop (gamekit 1.3.0):

- `lanHost {ver}` returns `{url, code}`. Rudolf OS starts the service for this match and gives the address the
  host's game joins (on this computer) and the room's code.
- `lanFind` returns `{games: [{name, url, code, ver}]}`, the duels hosted on the local network (an mDNS search).
- `lanStop` stops this computer's service.

The service runs as the signed-in account's own Linux user, never root, and only while hosting. It listens on one
port that the firewall opens to the local network (private addresses, never a cellular link) only while it runs,
and closes again after. The desktop asks for it as it makes its other system calls (rudolfd's token and peer check).
