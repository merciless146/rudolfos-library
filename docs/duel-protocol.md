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
