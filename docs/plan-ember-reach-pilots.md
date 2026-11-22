# Ember Reach: pilots, one galaxy, difficulty, Hardcore and co-op

The owner's design (2026-11-22), planned against the game as it is at 0.5.3/0.5.4. The owner's answers to the first
questions are folded in; what is still open is at the end.

## What the owner asked for

- **Up to six save slots (pilots)** in **one galaxy shared by every save**: what one pilot does changes the galaxy
  for all the others.
- **Wiping the galaxy** resets it as starting a new game does today.
- **The galaxy's save belongs to the person's hardware:** one galaxy per Rudolf OS account, kept only on that
  computer, shared by that account's six pilots (owner's answer).
- **Difficulty per pilot:** Rookie, Pilot, Admiral. Each changes the enemies, the damage taken and the rewards
  (owner's answer). It can be changed while docked, except that **a Hardcore pilot is held at Admiral** until Hardcore
  ends, by hand or by finishing the main questline (owner's answer).
- **Hardcore,** a pilot's option with these rules:
  - It can be turned on **only when the pilot is made**.
  - It can be turned off at any time, and once off it can **never be turned back on** for that pilot.
  - While on, a pilot gets higher rewards and the **Contraband Merchant** at major starports.
  - Finishing the main questline on Hardcore gives the **Precursor cloaking device**, the only way to get it. Hardcore
    then turns itself off, and its benefits stay.
  - Turning it off by hand before that makes the pilot an ordinary one: normal rewards and no Contraband Merchant.
  - **Dying with Hardcore on wipes the pilot.** The galaxy keeps whatever they did (owner's answer).
- **Co-op for up to four people:** everyone plays in the host's galaxy. Each guest's gains go to their own pilot's
  save, and the guest's own galaxy at home is unchanged (owner's answer). **A Hardcore host admits only Hardcore
  pilots** (owner's rule).
- Done separately in 0.5.4 (#104): ballistic weapons make no heat; hybrid and energy weapons still do.

## Where things stand

- `save.js` packs **one** value: the player (`packPlayer`: credits, ships, cargo, reputation, colonies, explore
  data, insurance, hangar, missions...) together with the world's changes (market drift, mined rocks, war events,
  charted systems). The galaxy itself is rebuilt from its seed, and `trim()` keeps the value under the game kit's
  **256 KB**.
- **The game kit** (`lib/gamekit/gamekit.js`) saves one value per game: `RG.save(v)` / `RG.load()` send
  `game: RG.id`. The Rudolf OS desktop (`desktop/games58.js`) keeps it under `game:<package>:<game id>:<account>`.
  It accepts **any** game id matching `[a-z0-9-]{2,40}`, each up to 256 KB, so **no Rudolf OS change is needed** for
  more slots. In a plain browser the kit uses `localStorage` (`rudolf-game:<id>`).
- **No difficulty setting yet.** Losing the ship goes through insurance (`insurance.js`): the pilot wakes at a port
  with the insured ship, or starts again in a starter ship.
- **The main questline** is the Core's story, "The Lock" (`plan-ember-reach-core.md`, M6). It is **planned, not
  built.** The cloak's award hangs on its ending, so the device is built and tested first, and awarded when M6 lands.
- **Network play** (0.5.2, `net.js`, the relay in `tools/duel-relay`, the LAN service in Rudolf OS) pairs **two**
  games for a duel. Co-op needs four, and the galaxy's state shared.

## 1. Saves: one galaxy, six pilots

**Storage.** Seven game kit values per account, each with its own 256 KB:

| Game id | What it holds |
|---|---|
| `ember-reach-galaxy` | The galaxy's version and seed, the galaxy's day, and the six slots' summaries (name, origin, difficulty, Hardcore state, credits, ship, where, last played) |
| `ember-reach-pilot-1` … `-6` | One pilot each |

`gamekit.js` gains an optional slot: `RG.load(slot)`, `RG.save(v, slot)`, sending `game: RG.id + '-' + slot`.
Without a slot it works as now, so other games are unchanged. Settings stay per account, as now.

**What goes where.** A sweep of `packPlayer` / `unpackPlayer` and the world's records puts every field in one of the
two. As a start:

| The galaxy (shared) | The pilot (their own) |
|---|---|
| Market drift; stock bought and sold | Credits in each currency; ships, fits, cargo, hangar, stored modules |
| Mined asteroids and deposits | Where they are, docked or landed; the flight state |
| War events and fronts; factions' standing with each other | Reputation and ranks with every power; bounties on them |
| Colonies and their buildings, with the pilot who founded them | Their missions, contracts and hauls; insurance |
| Discoveries: who found and named each first (one first per galaxy) | Their exploration data, sold or not; scans; their own charts |
| Sites cleared, ruins surveyed (the world's side) | Their story progress (the Core's acts), their Precursor blueprints |
| The galaxy's day | Difficulty and Hardcore state; contraband access; the cloak |

**Rules:**
- **One galaxy clock.** A pilot loads into the galaxy's current day; nobody goes back in time.
- **Missions count down in the pilot's own playing time**, so a pilot's deadlines don't run out while another pilot
  plays. Galaxy events (wars, markets) move on galaxy time.
- **First discoveries are galaxy-wide.** A system another pilot discovered first pays a later pilot the ordinary
  rate, and keeps the first pilot's name for it.
- **A colony belongs to its founder.** Other pilots see it as a colony of a power or an independent one: they can
  trade and dock there, but not manage it.
- **The slot screen** (before the origin picker) shows the six slots, each with its summary.
  - An empty slot starts a new pilot: origin, name, difficulty, and the Hardcore box (only here).
  - A pilot can be deleted. That doesn't touch the galaxy.
  - **Wipe the galaxy** (with a confirmation that lists the six pilots) resets everything, as New game does today:
    **the six pilots are deleted with it** (owner's answer).
- **Migration:** an existing save becomes the galaxy plus pilot 1 (difficulty Pilot, Hardcore off), checked by a
  test on real 0.5.x saves.
- **Export and import** of a file carry the whole set: the galaxy and the six pilots.
- **The budget:** each value is trimmed on its own (`trim()` per value). The galaxy is the one that grows, so its
  records trim oldest first as now.

## 2. Difficulty

Chosen when the pilot is made, and changed later **while docked** (owner's answer). **A pilot made with Hardcore is
Admiral, and stays Admiral while Hardcore is on**; once Hardcore ends (by hand, or at the questline's end), the
difficulty can be changed again. Starting values for playtests:

| | Rookie | Pilot | Admiral |
|---|---|---|---|
| Enemy accuracy, reactions | 0.75× | 1× (as now) | 1.25×, sooner |
| Damage the pilot takes | 0.7× | 1× | 1.3× |
| Insurance premium | 0.6× | 1× | 1.5× |
| Rewards (missions, bounties, bonds, exploration, salvage) | 0.75× | 1× | 1.25× |

Hardcore's multiplier comes on top. The difficulty shows on the slot and in the pilot's status.

## 3. Hardcore

**The pilot's state:** `hc` is one of `none`, `on`, `off`, `done`.
- **Making the pilot:** `on` or `none`. There's no other way to reach `on`. Ticking Hardcore sets the difficulty to
  Admiral and locks it there while `on`.
- **On → off:** turned off by hand (Settings › Pilot, after a confirmation that says it can't be undone). Rewards go
  back to normal, the Contraband Merchant is gone, the difficulty can be changed again, and the pilot is ordinary
  from then on.
- **On → done:** the main questline finished while on. The cloak is given, Hardcore's risk ends (no more wipe on
  death), its rewards and Contraband Merchant stay, and the difficulty can be changed again.
- **Death while on:** the ship is destroyed and Hardcore is on, so insurance doesn't apply.
  - A screen says the pilot is lost, and the pilot's slot is emptied.
  - The galaxy keeps everything the pilot did. Their colonies turn independent; their discoveries keep their names.
- **Rewards:** ×1.5 (a starting value) on missions, bounties, combat bonds, exploration data and salvage, on top of
  the difficulty's. Trade is open question 3.
- **Saving.** A Hardcore pilot is saved after every docking, jump, death and reward, and every 30 s in flight, so
  closing the game can't undo a death. Open question 4 covers quitting during a fight.
- **The slot shows it:** a mark for `on`, a different one for `done`.

## 4. The Contraband Merchant

- **Where:** a contact at **major starports** (Contacts screen). These are the orbital starports of a power's
  inhabited systems and the large surface starports, not outposts or settlements.
- **Who sees them:** pilots whose `hc` is `on` or `done`.
- **What they sell:** **Contraband** variants of weapons, modules and utilities.
  - Stock is drawn from the port's seed, refreshed weekly in galaxy time.
  - A variant is its base item with about **+20% to its main numbers** (damage or rate, shield strength, range,
    efficiency), priced about **1.6×** and kept below Precursor work.
  - **Precursor gear stays the strongest.**
  - The heat rule carries over: a contraband gatling is still ballistic and makes no heat.
- **Contraband gear is bound to its pilot, for good** (owner's answer):
  - it can **never be traded**: not sold, not given to another pilot or player, not left in a co-op partner's hands;
    it can be fitted, taken off and kept in the pilot's own storage;
  - it's marked as such in outfitting;
  - it's kept if Hardcore later ends by hand; the pilot just can't buy more.
- **It's illegal in the great powers' space** (owner's answer): a police or Marshal scan finds it. That means a fine
  and some lost standing with that power, or a fight if you run. Free ports and independent colonies don't care.
- **Insurance** (owner's answer):
  - while Hardcore is on, contraband gear **can't be insured** (its value is left out of the policy, and it's lost
    with the ship);
  - once Hardcore is off (by hand or at the questline's end), it can be insured at **twice the premium** of its
    non-contraband counterpart.

## 5. The Precursor cloaking device

- **Fitting:** any utility slot, any size. Unique: one per pilot. It can't be sold or stored away, and insurance
  gives it back with the ship.
- **Toggled on, the ship:**
  - **vanishes from other ships' radar and scanners**: AI ships lose their target, missiles lose their lock, and
    contacts drop off scans;
  - is drawn **almost fully transparent** (a faint refraction) to every other player in co-op;
  - **builds heat slowly**: about +0.15 a second against the usual 0.12 a second of cooling, so full heat comes in
    about 30 s of cloak alone. At overheat the cloak fails and the usual heat rules apply.
- **Firing, launching or being hit** shows the ship for 3 s (a starting value).
- **How it's got:** finishing the main questline with Hardcore on. Nothing else gives it, not even a debug flag in a
  normal build; the tests use a test-only hook.

## 6. Co-op for up to four

- **The host's galaxy.** The host's game decides the galaxy: markets, NPCs, wars and missions' worlds.
  - Each guest's game sends its own ship's state, as a duel's guest does today, and gets the host's updates.
  - Guests buy and sell in the host's markets; their credits, ships, cargo and reputation are written to **their own
    pilot's save**.
  - Nothing is written to the guest's galaxy at home.
- **Joining:** a guest picks one of their pilots, and the pilot's version must match the host's.
  - **A Hardcore host admits only pilots whose Hardcore is on.**
  - A guest who is a Rookie keeps their own damage-taken multiplier; the AI's skill is the host's difficulty.
- **Where people fly** (owner's answer):
  - **First, the wing stays together.** Everyone is in the host's system, and when the host jumps the guests are
    offered the jump and follow.
  - **Later, free roaming,** with the host's game simulating each system a player is in.
- **Death:** a guest who dies has their own pilot's rules applied. A Hardcore guest is wiped on their own machine;
  the host's galaxy keeps what they did there.
- **The network:**
  - `net.js`'s session grows from a pair to a room of up to four.
  - The relay's rooms take up to four (Node and Workers versions), and so does Rudolf OS's LAN service.
  - Join by room code or LAN, as duels do. Quick match stays duels-only.
  - **One Rudolf OS change:** the LAN duel service's room size, done in Rudolf OS 1.6.2.
- **What's shared:** ships, shots and NPCs in sight; docking (pads per player); markets; colonies' state on view.
  Missions stay each pilot's own, plus **wing missions** the host can share (rewards to each).

## Steps

| Step | What | Needs | Size |
|---|---|---|---|
| **P1** | The game kit's slots; the galaxy/pilot split of the save (the sweep, the two packs, migration, trimming each); the slot screen; delete a pilot; wipe the galaxy; export and import of the set | — | L |
| **P2** | Difficulty (the table above, the slot and status; changed while docked; Admiral while Hardcore is on); Hardcore's states and the pilot-made-only switch; the wipe on death; rewards' multipliers; saving often | P1 | M |
| **P3** | The Contraband Merchant: the contact, contraband variants (outfit.js), stock, prices; bound to the pilot (never traded); illegal (scans, fines, standing, fights); its insurance (none while Hardcore is on, twice the premium after) | P2 | M |
| **P4** | The cloaking device: the module, radar and scanners ignoring it, transparency, heat, firing showing it; the award hook (test-only until M6) | P2 | M |
| **P5** | Co-op, wing first: rooms of four in `net.js`, the relay and Rudolf OS's LAN service; the host's galaxy shared; guests' pilots saved at home; the Hardcore rule; docking, markets, NPCs, jumps together | P1 (P2 for the Hardcore rule) | L |
| **P6** | Co-op free roaming (if chosen) | P5 | L |
| **M6 link** | The questline's end awards the cloak and moves Hardcore to `done` | P4, M6.7 | S |

P3, P4 and P5 can be built at the same time once P1 and P2 are in.

**Tests:**
- node tests for the save split, migration, the Hardcore state machine, multipliers, contraband variants and the
  cloak's rules;
- browser tests for the slot screen, a Hardcore death wiping only that pilot (the galaxy unchanged), a cloaked ship
  lost by an AI's lock, and four Chromium pages in co-op through the local relay (a Hardcore host refusing a
  non-Hardcore guest);
- the existing 39 `tests/emberreach*_t.js` kept green.

## Decided by the owner (2026-11-22)

- **Wiping the galaxy deletes the six pilots too**, as New game does today.
- **Contraband is illegal** in the great powers' space (a scan, a fine and lost standing, or a fight), **bound to its
  pilot for good** (never traded), **uninsurable while Hardcore is on**, and insured at **twice** its ordinary
  counterpart's premium once Hardcore is off.
- **Co-op: the wing stays together first** (the host leads jumps); free roaming is a later step (P6).
- **Difficulty can be changed while docked**, but **a Hardcore pilot is Admiral** until Hardcore ends (by hand or at
  the questline's end).

## Open questions for the owner

These have recommended defaults, which the steps follow unless the owner says otherwise.

1. **Hardcore and trade.** Should the 1.5× apply to trade profit too? (a) No: missions and other payouts only.
   (b) Yes, as a bonus at sale. **Recommended: (a)**, so the markets stay the same for every pilot in a shared
   galaxy.
2. **Quitting during a fight on Hardcore.**
   - (a) Allowed: the last save stands.
   - (b) Closing the game with a hostile in weapons range counts as a loss of the ship. For Hardcore, that's death.
   - **Recommended: (a) with frequent saves.** (b) punishes crashes and power cuts.
3. **The cloak and the other players:** should co-op partners see a faint outline of a cloaked friend (on their
   radar as a friend), or nothing, as enemies do? **Recommended:** friends see an outline on radar, so wings can
   fly together.
