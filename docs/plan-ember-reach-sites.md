# Ember Reach: sites on the ground (L4)

The detailed plan for L4, the stage after colonies on the ground (L3), written in the style of
`plan-ember-reach-landing-work.md`: what each kind of site is, where it is, how it's found, what it gives and costs,
how it ties into the rest of the game, what the save keeps, how it's drawn, how it's tested, and the order of the
pull requests. Part of [plan-ember-reach.md](plan-ember-reach.md); it builds on
[plan-ember-reach-landing.md](plan-ember-reach-landing.md) and its work plan, and on
[plan-ember-reach-colonies.md](plan-ember-reach-colonies.md).

L4 in outline, as the landing plans left it:
- ruins on airless worlds, landed at and surveyed from the ground, at a better yield than from orbit;
- Precursor ruins on the Rift's airless worlds;
- crash sites with salvage.

## Where things stand (main, 0.5.0)

**Already in the game**
- **Ruins** (`galaxy.js` `system`): the earlier civilisations' ruins lie on one rocky planet (never a moon) in about
  one system in 330 to 400. They have no place on the world: the ruin is a property of the planet.
- **Sentinels** (`play.js` `sentinels`): within 25 radii of a ruin's world, two to four sentinels (Bunyip hulls) wake,
  once a visit, and attack anyone.
- **The orbital survey of a ruin** (`play.js` `surveyed`): 6,000 SU of data (2.5 times for a first discovery), a
  cache of two to four canisters of Artefacts, and a blueprint 45% of the time (an alien relay booster 30%, a phaser
  15%). The cache and the blueprint are drawn with `Math.random`, once, when the survey is first made.
- **The Rift's Precursor ruins** (`galaxy.js` `riftWorlds`): in about one Rift system in ten with a rocky world.
  Guardians are Riftborn-strong Smilodons; the survey gives one to three canisters of Precursor Relics and,
  usually, a Precursor blueprint; the data is worth three times a ruin's, twice again for the Rift.
- **Landing** (L1, L2): terrain from one height function (`terrain.js`), levelled flats for sites, the ground scan
  (deposits within 5 km), first landings recorded and sold, spotlights and night vision, the forward bases' turrets
  (`play.js` turrets), NPCs flying low with the Autopilot Computer (`autopilot.js` `departGround`).
- **Canisters** (`canisters.js`): one tonne each, gone after 15 minutes; a wreck in space leaves some.
- **Ruin contracts** (`explore.js` `offers`): now and then a cartographer rumours a ruin within 20 pc.
- **Colonies:** a research station on a ruin's world counts 1.5 times (`colonies.js`); a port at a ruin's world adds
  the ruins economy (Artefacts made, tourists drawn: `economy.js`).
- **Salvage as a trade:** the Teratorn (salvager) and the Greyhook Salvage Works yard exist; nobody salvages yet.

**Measured on main** (a scratch count over 12,248 normal systems and 907 Rift systems, not committed):

| | Normal galaxy | The Rift |
|---|---|---|
| Systems with a ruin | 31 (1 in 395) | 87 (1 in 10) |
| ...whose ruin world can be landed on | 8 (1 in 1,530 systems) | 28 (1 in 32) |
| Why the others can't | an atmosphere (20), molten (3) | mostly an atmosphere |
| Systems with any landable world | about two in three | about two in three |

So if only the ruin worlds themselves took sites, a pilot would find a landable ruin about once in 1,500 systems in
the normal galaxy: too rare to be a part of play. That's why this plan adds **outlying sites** (below).

## Principles

- **Nothing else moves.** Every site comes from new draws with their own seeds (`site:` + star id, and so on). No
  star, world, ruin, port, deposit, asteroid or saved game changes. A ruin's existing orbital survey stays as it is.
- **Deterministic.** A site's place, layout, defences and yield come from its seed, so reloading can't re-roll a
  find. (The orbital cache's `Math.random` is left alone: it changes no saved state, and the owner can decide
  separately whether to seed it; see the open questions.)
- **One height function.** A site's platforms are flats in `terrain.js`; its pieces stand on `h(world, dir)`. What's
  drawn is what's hit, as for ports.
- **Airless worlds only** until atmospheres come ("Later" in the landing plan). A ruin world with air keeps its
  orbital survey and nothing more for now.
- **Budgets.** A site is at most 4,000 triangles at high detail and 1,500 at low (a port is 6,000). At most two sites
  are drawn at once; sites beyond 50 km are not drawn, as ports. The release test machine holds 30 fps landed at a
  site, as it does at a port (with automatic resolution).
- **Small saves.** A site's record is a few bytes; crash-site records expire. Trimmed under the save's 230 KB
  budget like the rest (`save.js` `trim`).
- **Small PRs, each playable**, each with its tests, as in L1 to L3.

## The kinds of site

| Kind | Where | How many | Found by | Danger |
|---|---|---|---|---|
| **Ruin heart** | the ruin's own world, if landable | one per landable ruin world | the orbital survey | sentinels, old turrets, unstable ground |
| **Outlying ruin** | airless worlds and moons in a ruin's system | 0 to 3 per ruin system | the ground sweep, the record of a heart | unstable ground, sometimes a turret |
| **Precursor vault** | a Precursor ruin's world, if landable (the Rift) | one per landable Precursor world | the orbital survey | guardians, pylons, unstable ground |
| **Precursor outlier** | airless worlds in a Precursor system (the Rift) | 0 to 2 per Precursor system | the ground sweep, a vault's record | pylons, Riftborn |
| **Crash site** | any landable world | by traffic and danger, per season | a distress beacon, the ground sweep, tips, contracts | rival salvagers, pirates, unstable ground |
| **Battlefield** | landable worlds in contested systems where the fighting is | 3 to 8 wrecks together | the system's sweep (beacons) | both sides' patrols, salvagers |

### Ruin hearts and outlying ruins

- **The heart:** on a ruin world that can be landed on, the ruin has a place: `lat, lon` from `site:` + star id
  (within 60° of the equator; a tidally locked world's within 25° of the terminator, as ports). It's the old city:
  the largest site, 1.2 to 2 km across.
- **Outlying ruins** answer the rarity above. The same people who built the ruin worked the rest of their system:
  - each airless, landable world or moon in a ruin's system (other than the ruin world) takes an outlying site with
    a chance of 45% (its own seed), up to three in the system;
  - each is a smaller site, 300 to 700 m across: a mine, a watch post, a tomb, a landing ground;
  - so about nine ruin systems in ten offer something to land at (two thirds of systems have landable ground, and
    those that do have about three such worlds), against one in four today.
- **A people.** The Drake equation counts each earlier civilisation in about ten systems (`plan-ember-reach.md`,
  "The Drake equation"). L4 gives that a shape without moving any ruin: ruins are grouped by a coarse grid (cubes of
  24 pc in the normal galaxy; each cube's ruins are one people), and the people takes a name from the game's own name
  generator and a style (below) from the cube's seed. Every site of a people looks like that people's work, and a
  heart's record points to the others (see "Rumours").

### Precursor vaults and outliers (the Rift)

- **The vault:** on a Precursor ruin's world that can be landed on (about one Rift system in 32), the ruin is a vault
  complex, 1.5 to 2.5 km across, in the Precursors' one style (below).
- **Outliers:** each other airless world in a Precursor system takes one with a chance of 35%, up to two: a pylon
  field, a sealed door in a cliff, an empty cradle where something once stood.
- **No Precursor sites in the normal galaxy** in L4. (Whether the Core holds Precursor-era sites is the Core plan's
  question: `plan-ember-reach-core.md`.)

### Crash sites

Wrecks on the ground are not part of the galaxy's fixed furniture: ships crash all the time. So crash sites are
**drawn per system per season** (30 game days): the same within a season, new the next.

- **How likely**, for a system with landable ground, per season (starting values for playtests):

  | Where | Chance of a crash site | Mostly |
  |---|---|---|
  | a power's capital or lane hub | 25% | traders, passenger ships, couriers |
  | other claimed systems with a port | 12% | traders, miners |
  | contested systems | 35% (and battlefields where the fighting is) | warships of both sides |
  | unclaimed systems on a long lane | 20% | traders, nomads |
  | other unclaimed systems | 5% | explorers, prospectors, pirates |
  | the Glow (crowded passes) | ×1.5 | miners, prospectors |
  | the Core | ×2 | explorers, the misjumped |
  | the Rift | 8% | the living who came after relics (and Riftborn hulks) |

- **What crashed:** a hull from the 40 stock ships, chosen by the system's cast as encounters already chooses it
  (`encounters.js` `cast`: a trader where traders fly, a navy ship where patrols do), with its owner (a power, a small
  faction, an independent) and a crash day inside the season.
- **Fresh or old:** for its first 5 days a wreck's **distress beacon** still calls: it's on the system's navigation
  list from the sweep. After that it's silent and must be found.
- **Battlefields:** a contested system that a front's season fought over (`factions.js`: the seasons' offensives)
  has a battlefield on a landable world: three to eight wrecks of both sides within 4 km, beacons calling.
- **Old wrecks:** about one crash site in fifty is ancient: a hull of a ruin's people, in that people's style, with
  no beacon, ever. These belong to the place, not the season (seeded by star id only), and only in systems within
  a ruin's grid cube.
- **Your own wreck:** a pilot who crashes on the ground (the insurer replaces the ship) could find the wreck where it
  fell, cargo and all. Whether that's so is an open question.
- **Ships destroyed below a Kármán line** in a fight could also fall and leave a site for the rest of the season.
  This is the same question: dynamic wrecks must be saved, the seeded ones need not be.

## How sites are found

- **The orbital survey** (as today, 12 s within 6 radii) of a ruin world with a heart marks the heart: "A city lies
  on the surface at 24° N, 112° E." It becomes a navigation target, and cruise drops out above it as for a port.
- **The ground sweep** (new): below a world's Kármán line, with working sensors and a cartographic sensor, the
  sensors sweep the ground below the ship as it flies, marking sites within 40 km of the point beneath it (20 km on
  the night side without night vision). It costs nothing to run and needs no key: flying low over a world is how you
  look. The ground scan (6 s, within 2 km, deposits) is unchanged.
- **Distress beacons:** fresh crash sites and battlefields are on the navigation list from the system's sweep.
- **A heart's record:** surveying a heart in full (below) reveals its system's outlying sites and points to the
  nearest unsurveyed ruin of the same people (a rumour: the system, not the world).
- **Rumours and tips:**
  - cartographers' ruin rumours (existing) now name a site when the ruin has a heart;
  - **salvage tips** at the bulletin of free ports, syndicates' dreadnoughts and outposts in unclaimed space: a
    silent crash site within 10 pc, for a fee (300 to 1,500 SU, by what's aboard);
  - nomads' carriers sell their people's old songs: a rumour of a ruin within 30 pc (the long-lane nomads know the
    deep ruins).
- **Contracts** (below): a contract's site is marked when it's taken.
- **The map:** a system's card lists the sites you know of (`On the ground: ruins (heart, 2 outlying), a wreck`).

## What a site gives

### Surveying from the ground

A pilot can't leave the ship (no surface vehicles yet), so a site is surveyed by setting down at its **survey
points**: 3 to 5 at a heart or a vault, 1 or 2 at an outlying site. Each is a level patch (a terrain flat, 40 to 80 m
across) marked by a ring on the HUD when the site is targeted.

- **Landing at a point:** a clean or hard landing within its ring, then 10 s landed with the cartographic sensor
  working. The ground scan runs as usual alongside.
- **Each point gives** a part of the site's yield, and the last one completes the site.
- **Points can be done in any order, on any visit.** Leaving and coming back keeps what's done.
- With **surface vehicles** later, the points could be driven to instead (see the Core plan's "Later" section).

### Yields

Better than from orbit, as the outline asked, and kept to the game's existing goods: Artefacts (400 SU base) and
Precursor Relics (1,500 SU). Each yield is drawn once from the site's seed:

| Site | Data (SU, before ×2.5 first, ×2 Rift, ×3 Precursor) | Goods | Blueprint |
|---|---|---|---|
| Orbital survey of a ruin (today) | 6,000 | 2–4 t Artefacts | 45% (relay 30%, phaser 15%) |
| Ruin heart, all points | 4,000 | 6–10 t Artefacts | 60% (relay 40%, phaser 20%) |
| Outlying ruin | 1,200 | 1–3 t Artefacts | 15% (relay) |
| Precursor vault, all points | 4,000 | 3–6 t Precursor Relics | always one Precursor blueprint (hull 15%, weapon 20%, module 65%) |
| Precursor outlier | 1,200 | 1–2 t Relics | 35% Precursor (module only) |
| Old wreck | 800 | 1–2 t Artefacts | 25% (relay) |

- **Goods** rise as canisters from the point surveyed, one at each, the rest at the last; on the ground they rest on
  the surface (gravity takes canisters below a line, as built). Scooping them from the ground means hovering low
  with the hatch open, or a tractor beam. Canisters at a site don't break up while the ship is within 20 km.
- **Data** sells at Universal Cartographics as a new kind of entry, "site data", once per site, with the usual first
  discovery rule (`explore.js` `charted`: ruins away from a port are always yours first). Selling it pleases the
  buyer's holder a little, as other data.
- **Records:** a completed heart or vault also gives its **record** (see "Rumours", and for the Precursors' records
  the Core plan's story). A record is data, not cargo: it's kept in the save and never sold.
- **Blueprints** go into `P.blueprints` as today and are built by an artifact broker.

### Crash sites: salvage

A crash site's pieces are its hull broken in two to four, with a debris field, and one to four **salvage points**:

| Salvage | What | Where it goes |
|---|---|---|
| **Cargo** | the hold's goods, up to half the hull's cargo, at most 40 t | canisters, scooped |
| **A module** | one of the hull's fitted modules (its size, grade C or B), at 20–60% health | to storage at the next port with storage (as an alien relay from a ruin does) |
| **The flight recorder** | the ship's record of its last flight | the save; handed in at its owner's ports |
| **Data cores** | an explorer's unsold charts (worth 1,000 to 8,000 SU) | the save; sold at cartographers like your own data |
| **Munitions** | from warships: 2 to 6 t | canisters |

- **Salvaging a point:** land within its ring and hold 15 s (the hull's being cut open); then its salvage is out.
- **Flight recorders** pay at the owner's ports (any port of the power, or the small faction's flagship): 500 SU
  plus 2% of the hull's value, and standing (+5, +10 for a navy's). A navy's recorder from a battlefield counts as
  recon-sized war effort (+3) for its side, played through the front like any other deed. Selling a recorder on a
  black market instead (syndicates pay half again) angers its owner if they hear (the usual spread).
- **Whose wreck it is:** salvage law is an open question for the owner. Until it's settled, the plan assumes the
  simplest rule: **salvage is lawful anywhere**, except taking cargo or modules from a power's navy wreck inside
  that power's space, which is theft (a bounty, if its patrols see it).

## Risks at a site

### Old defences

- **Sentinels** keep their orbital behaviour (25 radii, once a visit), and now come down below the line: they follow
  a pilot to the ground at the NPC ground keep (450 m, `combat.js` `groundKeep`) and hold over the heart.
- **Old turrets** at a heart: one to three, of the people's style, built on the forward base's turret
  (`play.js` turrets: a fixed mount turning at 90°/s, 4 km range, can be shot down), waking when a ship comes within
  5 km below the Kármán line. A ruin's turret fires a pulse laser; it has the forward base turret's hull and
  shields.
- **Precursor pylons** at a vault (two to four) and at outliers (one or two): Riftborn-strong turrets (×3 hull and
  shields, ×2.2 damage, as the Riftborn), with a needle each. Destroying a pylon drops 1 t of Nullite or Voidglass.
- **Guardians** come down at a vault as sentinels do at a heart.
- **A cleared site stays cleared** for the season: its turrets' and pylons' state is kept (`P.sites`, below).

### Unstable ground

- About one survey or salvage point in four is **unstable** (seeded). A ground scan run within 2 km of it (before
  landing, or landed) shows it on the HUD: "Unstable ground".
- **Landing on unstable ground:** after 6 to 14 s landed, a warning ("The ground is shifting") and a rumble; 4 s later
  the ground gives: the ship drops 2 to 6 m and tilts 10° to 25°, which counts as a touchdown at that speed and tilt
  (`landing.js` `touchdown`): damage from a hard landing, or a crash if it's far past the limits. Lifting off
  inside the 4 s is safe.
- **A point on unstable ground can still be surveyed:** land, survey (10 s), lift before it gives. With a ground scan
  first, the pilot knows to be quick.
- **Icy worlds and moons of giants** (tidal heating) have unstable points twice as often; airless deserts half as
  often. The heat of a day side above 450 K applies as before.

### Rival salvagers

- **At crash sites**, salvagers come: a Teratorn or a Quagga (independent salvagers, Greyhook's people) in
  claimed space; a Wendigo or a Megalodon (a syndicate's raiders) in unclaimed and contested space.
  - **When:** each visit, with a chance by how fresh the wreck is (60% while its beacon calls, 25% after), 30 to 120 s
    after you arrive in the system.
  - **What they do:** they fly the ground autopilot to the wreck (`autopilot.js`), land at a salvage point and take
    it in 40 s (twice your time: they're cutting by hand), then the next. What they take is gone for the season.
  - **Independents** hail and leave if you got there first ("It's yours; we'll find another"), unless you're
    Unfriendly with the space's holder. **Raiders** attack anyone at the wreck.
  - Destroying a salvager leaves a wreck of its own (cargo and all), in space or, below a line, on the ground.
- **At ruins in unclaimed space**, raiders come too, a third as often: relic hunters after the same artefacts.
- **Pirates** chase a landed pilot as they do now (down to their ground keep).

## How it ties into the game

- **Exploration:** site data is a new entry kind in `explore.js` `unsold` and `sell`; first discoveries as today; a
  heart or vault found first lets you name its ruin world (as today: naming is per world, unchanged). Ground survey
  contracts (0.3.10) can now name a site.
- **A people's record:** surveying every site of one people (their hearts and outliers, across up to about ten
  systems) completes its record: a bonus of 2,000 SU a site at any cartographer, and the people's name and style in
  the pilot's log. The record of each heart points to the next ruin of its people (a rumour that needs no contract).
- **Contracts** (`contracts.js`, `explore.js`; each counts among the three held, due in 20 days, in the issuer's
  coin):
  - **site survey:** survey every point of a named site (cartographers; 1,500 SU plus 150 a parsec);
  - **recovery:** bring back a named wreck's flight recorder (a power's authority; 1,000 SU plus 2% of the hull);
  - **excavation:** deliver 5 t of Artefacts from a named people's sites to a port with a research station or a
    ruins economy (a power's or a colony's; 1.8 times the goods' value);
  - in the Rift, anchorages post none (they're automated); Precursor work is its own reward.
- **The Rift:** vaults and outliers are where Precursor blueprints are surest; vaults' records begin the Core story
  (`plan-ember-reach-core.md`). Rift crash sites are the living's wrecks (relic hunters who didn't make it home) and,
  rarely, a Riftborn hulk (its goods the Rift's).
- **Factions:**
  - **Great powers** want their recorders back and pay for them; a front's battlefields carry the war (recorders as
    war effort).
  - **Syndicates** buy recorders and relics on their black markets, send raiders to sites, and sell salvage tips.
  - **Nomads** sell rumours of deep ruins (and like pilots who hand in their wrecks' recorders: +10).
  - **Prospector guilds** buy site data in the Glow at a premium (+15%) and rent carriers to excavations.
  - **Free ports** sell tips and change any coin.
- **Colonies:**
  - The planner (`colonies.js`) shows a claimable system's known sites and their people.
  - **An excavation** (a new tier 1 surface facility, 700 t: machinery, electronics, food, water) can be built at a
    ruin site you've surveyed in full on one of the colony's worlds. Like a surface mine (0.4.9), it feeds the colony
    port's market: Artefacts at 1 t a day (Precursor Relics at 0.25 t in the Rift), running out after 60 to 200 t. It
    counts as the ruins economy and strong-links a research station on the same world.
  - **Tourism** at a world with a ruin heart counts 1.3 times.
  - **Raids** (L3.6) leave wrecks: a raid beaten off at a colony leaves the raiders' wrecks as crash sites for the
    season.
- **The insurer:** unchanged. A crash at a site is a loss like any other.
- **Proximity safety, landing, the autopilot:** unchanged; sites are open ground (no clearance needed), and the
  Autopilot Computer can fly to a survey point as it flies to a pad (a glide slope to a hover, then down), when
  the point is the navigation target.

## What the save keeps

Only the player's changes, as everywhere in Ember Reach:

- `P.sites`: `{siteKey: {d: day first seen, p: bitmask of points done, s: sold, f: first, t: turrets or pylons
  destroyed (bitmask), c: day cleared}}`. Seeded sites are rebuilt from the galaxy; only these few fields are kept.
- `P.salvaged`: `{siteKey: {season, p: bitmask of salvage points taken (by you or a rival)}}`, dropped when its
  season is over.
- `P.recorders`: `[{site, owner, hull, value, navy}]`, until handed in or sold; `P.cores`: data cores, kept as
  unsold data in `P.explore` (no new store).
- `P.records`: `{peopleKey: bitmask of its sites done}`; Precursor records for the Core story (`plan-ember-reach-
  core.md`).
- Dynamic wrecks (if the owner wants them: your own wreck, ships shot down below a line): `{star, world, lat, lon,
  hull, cargo, season}`, at most 20, oldest dropped.
- **Size:** about 40 bytes a site; a pilot who's been to 500 sites keeps about 20 KB. `trim` drops expired salvage
  first, then the oldest completed sites' records (they'd show again as surveyed: the data's already sold).
- **Version:** the save's version rises once (`save.js` `VERSION`); older saves load with no sites known.

## Models and layouts, drawn in code

All sites are built from the stations' and ports' vocabulary (`meshes.js` primitives, `scene.js` `cyl`, `box`, `ell`,
`surface.js` `dome`), seeded, in a new `sites.js` beside `surface.js`, with `layouts.html` gaining a "Sites" view (from
above and in 3D, new seeds on a button).

### Layout

`siteLayout(kind, seed, style)`, like `surface.js` `layout`:
- **Platforms** first: one to four level terraces (terrain flats, so the ground matches), the survey points on them.
- **Pieces** placed round them, clear of each other (4 m) and of the survey points' approach cones (35°, as pads'
  corridors), so a pilot can always come straight down to a point.
- **Some pieces are fallen:** tilted 20° to 80°, sunk into the ground by a share of their height, or broken (a
  segment missing).
- `checkSite(layout)` lists any rule broken: overlaps, a point not level within the touchdown tilt of an S pad (12°),
  a cone blocked, a piece outside the site.

### The ruins' styles

Each people takes one of five styles from its seed, with its own proportions and a colour leaning from the world's
ground (weathered, darker with age):

| Style | Pieces |
|---|---|
| **Terraces** | stepped platforms (stacked boxes), ramps, low walls in rows |
| **Spires** | tall tapered towers (cones of few sides), many fallen across the ground |
| **Shells** | broken domes (half-ellipsoids cut open), ribs standing where the glass was |
| **Rings** | standing arches and ring segments (tori cut), in lines across the site |
| **Grid** | a city plan of low walls (thin boxes) on a grid, blocks roofless, a central hall |

Outlying sites use the same style at a smaller scale and fewer pieces (a watch post: one spire and a wall; a mine:
a pit and a terrace).

### The Precursors' style

One style, deliberately unlike any people's: monolithic slabs and faceted pillars (boxes and few-sided prisms),
black like voidglass, with thin seams that glow violet in the emissive channel at night, and a vault's doors as tall
slots in a slab. Pylons are tapering three-sided pillars with a bright tip (their muzzle). Nothing Precursor is
fallen: it's all still standing.

### Wrecks

A crash site uses the crashed hull's own mesh (`meshes.js` `ship`), cut across its length into two to four pieces,
each tilted and sunk, darkened (scorched) toward the cut; a debris field of small boxes and plates; and a dark skid
scar along the approach (a thin strip mesh following `h`, drawn just above the ground). An old wreck is the people's
style applied to a ship's shape: a long hull of their pieces, half buried.

### Budgets and the Canvas fallback

- **High detail:** at most 4,000 triangles a site (a heart's terraces and spires are the most); **low:** 1,500.
- **Lights:** survey points' rings (cyan, like the cleared pad's), Precursor seams, a wreck's beacon blinking while it
  calls. All in the emissive channel the ports use.
- **Canvas 2D fallback:** sites draw at low detail, sorted with the rest, as ports do.

## Tests

**Node** (a new `tests/emberreach_sites_t.js`, and the existing suites):
1. Nothing moves: a sample of systems has the same stars, worlds, ruins, ports, deposits and asteroid ids with
   `sites.js` loaded as without it.
2. Sites are deterministic: the same seeds give the same sites, places, layouts, points and yields, in node and the
   browser (one shared function).
3. Placement: hearts only on landable ruin worlds; outlying sites only on airless landable worlds in ruin systems, at
   most three; vaults and outliers only in the Rift; none at the Maw; latitude rules; no site within 5 km of a
   port's site.
4. Counts on a sample: the share of ruin systems with something to land at (expected about 90%), the share of Rift
   systems with a vault (about 1 in 32).
5. A people: ruins in one grid cube share a people, its name and style; a heart's record points to the nearest
   unsurveyed ruin of the same people.
6. Layouts: `checkSite` passes over 200 layouts of each kind and style; every survey point is level within 12°.
7. Meshes: every kind within 4,000 / 1,500 triangles.
8. Survey points: landing in a ring and holding 10 s does the point; the last completes the site; order doesn't
   matter; saved and restored mid-site.
9. Yields: as the table, from the seed; data sells once; the first-discovery rule.
10. Unstable ground: the timing, the drop and tilt through `touchdown`, lifting off in time is safe, a ground scan
    shows it.
11. Defences: turrets and pylons wake at 5 km below the line, fire, can be destroyed, and stay destroyed for the
    season.
12. Crash sites: the same within a season, different the next; chances by kind of system (on a sample); a fresh
    beacon for 5 days; battlefields in fought-over contested systems.
13. Salvage: each point once; a rival's take is gone; recorders pay and count as war effort on a battlefield; theft
    from a navy wreck in its space.
14. Rival salvagers: independents leave, raiders attack; they reach and take a point in their time.
15. Contracts: site surveys, recoveries and excavations offered, taken, done and paid.
16. Colonies: an excavation feeds the market and runs out; the planner lists sites.
17. Saves: round trip; expired salvage dropped; trimming under the budget; an older save loads with no sites.
18. Speed: a system's sites in under 1 ms; a site's layout in under 5 ms.

**Browser** (`tests/emberreach_t.js`, new checks after 9z5):
- land at an outlying ruin on a moon, survey its point, scoop an Artefacts canister from the ground;
- a heart's turret wakes and is shot down;
- unstable ground gives under a landed ship;
- salvage a fresh crash site and hand in its recorder at a port;
- the frame rate landed at a heart on the release test machine.

## Steps

| Step | What | Depends on | Size |
|---|---|---|---|
| **L4.1** sites as a model | `sites.js`: kinds, placement, peoples, crash-site seasons, layouts, `checkSite`, meshes; `layouts.html`'s Sites view; tests 1–7, 12, 18 | none (a new file: it can start alongside L3.5) | medium |
| **L4.2** ruin sites in the game | hearts and outliers on the ground (models, flats), the ground sweep, survey points, yields, site data at cartographers, `P.sites`, the save's version; tests 8, 9, 17 | L4.1 | large |
| **L4.3** defences and hazards | sentinels below the line, old turrets, unstable ground; tests 10, 11 | L4.2 | medium |
| **L4.4** Precursor sites | vaults and outliers in the Rift, pylons, guardians on the ground, Precursor records (the hook the Core plan uses) | L4.2, L4.3 | medium |
| **L4.5** crash sites and salvage | seasonal wrecks, beacons, battlefields, salvage points, recorders, data cores, old wrecks; tests 12, 13 | L4.1 (L4.2 for the shared survey-point code) | large |
| **L4.6** rival salvagers | independents and raiders at wrecks and ruins; test 14 | L4.5 | medium |
| **L4.7** rumours, contracts, a people's record | heart records, salvage tips, nomads' songs, the three contracts, the people's bonus; test 15 | L4.2, L4.5 | medium |
| **L4.8** colonies and sites | the planner's sites, excavations, tourism, raid wrecks; test 16 | L4.2, and L3.5 and L3.6 merged | small |
| **L4.9** release | the store description, the plan's release notes, the full suite and the playthrough | L4.1–L4.8 | small |

Some steps can run in parallel:
- L4.1 can start any time: it's a new file and changes nothing a player sees.
- L4.5 (crash sites) can go alongside L4.3 and L4.4 once L4.2's survey-point code is in.
- L4.8 waits for colonies on the ground (L3.5, in progress as 0.5.1) and raids (L3.6).

**Versions:** following the landing plan's pattern, each L4 step merged would be a patch version after the 0.5.x
batch now under way (0.5.1 colonies on the ground, 0.5.2 duels on a LAN, 0.5.3 touch and small screens), and L4
done would be released as **0.6.0, sites**. That's a proposal: see the open questions.

## Risks, and what to do about them

| Risk | What to do |
|---|---|
| Sites too rare to matter | Outlying sites (about nine ruin systems in ten get one); crash sites everywhere with traffic; contracts and tips point to them. Counted in test 4. |
| Sites too common, so ruins stop feeling like finds | The heart stays rare; outliers yield a quarter of a heart; the chances are single constants in `sites.js` for playtests. |
| Hovering to scoop canisters from the ground is fiddly | Canisters at a site don't expire while you're near; a tractor beam pulls them up; the landing assist holds the descent. |
| Unstable ground feels unfair | It's shown by a ground scan, it gives a warning and 4 s, and it only matters if you stay. |
| Rivals and turrets on the software renderer cost frames | Turrets reuse the forward base's (already within budget); at most two salvagers in flight at once; sites at low detail beyond 8 km. |
| The save grows with sites | A few bytes each, salvage expires, trimmed under the budget (test 17). |
| Colonies (L3.5) change while L4 is planned | L4.8 is last and small; everything else touches colonies only through the planner's listing. |

## Open questions for the owner

1. **Outlying sites.** Should ruin systems get outlying sites on their other airless worlds, so most ruin systems
   have ground to land at? Options: (a) yes, as above (about nine in ten ruin systems); (b) no, hearts only (one
   landable ruin in about 1,500 systems until atmospheres come); (c) hearts only, but raise the share of ruins on
   airless worlds (that would move existing ruins, against the "nothing moves" rule). **Recommended: (a).**
2. **Surveying from the ground.** Options: (a) several survey points per site, landed at in turn, as above; (b) one
   landing anywhere in the site, held for 30 s. **Recommended: (a):** it's what makes a site a place to fly
   around, and it carries over to surface vehicles.
3. **Salvage law.** Options: (a) lawful anywhere (simplest); (b) lawful anywhere except a power's navy wrecks in its
   own space, as above; (c) every wreck belongs to its owner, and salvage needs the owner's licence (a contract) or
   it's theft. **Recommended: (b).**
4. **Wrecks that aren't seeded.** Should your own crashed ship, and ships shot down below a Kármán line, leave crash
   sites for the season (kept in the save)? Options: (a) both; (b) only your own wreck (to recover your cargo);
   (c) neither (only seeded sites). **Recommended: (b),** with the cargo only (the insurer has the hull).
5. **The orbital ruin cache.** It's drawn with `Math.random` today. Options: (a) leave it; (b) seed it from the
   ruin, so it's the same for everyone (it changes no saved game; a pilot who hasn't surveyed a ruin yet would get
   a different find than before). **Recommended: (b),** with L4.2, for determinism.
6. **Peoples' names.** Should each earlier people get a generated name and style shown to the player (in the log and
   on site cards)? Options: (a) yes, generated; (b) no names, only the style; (c) hand-written peoples for some (it
   touches the earlier question about hand-written names for the great powers). **Recommended: (a).**
7. **Versions.** L4's steps as 0.5.x patches after the current batch, released as 0.6.0? Or its own numbering?
   **Recommended:** 0.5.x patches and 0.6.0, as L1 (0.3.0) and L2 (0.4.0) were.

**The owner's earlier open questions this plan touches** (not decided here):
- From the colonies plan: *may players name their colonies' systems?* Naming sites or peoples (question 6) would sit
  beside it.
- From the main plan: *the great powers' names: generated, or hand-written names and cultures?* (Question 6's
  option c.)
- From the main plan: *multiplayer: shared discoveries.* Seeded sites and peoples are the same in every save, so a
  shared record of who found what is possible later; seasonal crash sites are too (seeded by season).
- From the main plan: *game time: how long a season feels.* Crash sites change by season.

## Sources

Written from the existing plans and the code on main; the counts above are from a scratch script run against
`galaxy.js` and `landing.js` (not committed). No outside sources are used.
