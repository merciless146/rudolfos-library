# Ember Reach: sites on the ground (L4)

The work plan for L4, the stage after colonies on the ground (L3). `plan-ember-reach-landing.md` put three things in
L4's outline: ruins on airless worlds, landed at and surveyed from the ground at a better yield than from orbit;
Precursor ruins on the Rift's airless worlds; and crash sites with salvage. This plan says what each of them is, where
it is, how it's found, what it gives and costs, how it ties into the rest of the game, and how to build it in
reviewable steps. It's written in the style of `plan-ember-reach-landing-work.md`, and is part of
[plan-ember-reach.md](plan-ember-reach.md).

The numbers are starting values for playtests, like the rest of the plan's.

**Status:** built so far, all described below:
- L4.1 (0.7.1);
- L4.2a, ruin fields in the game (0.7.2);
- L4.2b, their wardens (0.7.3);
- L4.3, artifacts (0.7.4).

Next: L4.5 (Precursor sites and lodestones), for the Core's story. The owner chose to build L4 before the Core's story
(`plan-ember-reach-core.md`), which needs its Precursor vaults and lodestones.

**The owner's answers (2026-11-25):**
- **1, outlying ruins:** yes, "but it should usually be on a moon (usually one orbiting a gas giant) as if it is some
  sort of waystation or relay". Built so: on a moon whenever the system has one that can be landed on (a gas
  giant's weighted 8, the ruin world's own 5, any other 3), else a planet; laid out as a relay (masts, dishes, a
  hall). With no moon, "the ruins will usually be on the farthest landable planet from the star" (the owner, the same
  day): that planet weighted 6 against 1 for each other. Measured: about 58% of outliers on moons (about 40% on gas
  giants' moons); the rest, in systems with no landable moon, 90% on the farthest landable planet.
- **2, your own crash:** the cargo lies at the crash site as canisters for 7 days.
- **4, survivors:** escape pods as a one-tonne cargo good.
- **6, peoples:** ruins grouped into peoples by a 30 pc cell, each with a generated name and its own style.
- **3, 5, 8, 9:** the recommendations (scooping wrecks stays no crime; fresh wrecks and old hulks both; no outliers
  in the Rift; the orbital cache seeded from the ruin, done in L4.1).
- **7, the release number:** still the owner's.

## Where things stand (main, 0.5.0)

**Already in the game, and what L4 builds on**
- **Ruins** (`galaxy.js` `system`, `RUIN_CHANCE`): one rocky world in a ruin system carries `ruins`, from the Drake
  equation's earlier civilisations (each counted in about ten systems).
- **Ruins in flight** (`play.js`):
  - **Sentinels:** coming within 25 radii of a ruin's world wakes two to four of them, once a visit.
  - **The survey's cache:** surveying the world from orbit lets two to four canisters of Artefacts drift up.
  - **Blueprints:** the survey rolls once for one (`outfit.js` `blueprintFrom`: an alien relay booster 30%, a
    dimensional phaser 15%).
  - **Ruin data:** it sells for 6,000 SU on top of the world's own value (`explore.js` `worth`).
- **The Rift's Precursor ruins** (`galaxy.js` `riftWorlds`): about one Rift system in ten with a rocky world has one.
  - **Guardians:** Riftborn-strong, on a heavier hull.
  - **The survey:** Precursor relics, and a roll for a Precursor blueprint (`precursorFrom`: a hull 10%, a weapon
    15%, a module 45%).
  - **Rift data** sells for twice as much, and a Precursor ruin's for three times a ruin's.
- **Landing on airless worlds** (L1): gravity below the Kármán line, the gear, touchdown and crashes, and terrain.
  - **The terrain:** one pure height function (`terrain.js` `height`) with levelled flats (`addFlat`).
  - **The ground scan:** landed or within 2 km, it marks deposits within 5 km (`explore.js` `deposits`).
  - **Discovery:** a first landing counts as one.
- **Surface ports** (L2):
  - **The models:** layouts and parts in the stations' vocabulary (`surface.js` `layout`, `parts`, `meshes`; boxes,
    cylinders, ellipsoids, domes and pads), drawn within 50 km.
  - **Their sites** are at most 3% of their world's radius (`SITE_SHARE`).
  - **Lone outposts** are found by a ground scan or from the cartographer's charts (`P.explore.found`).
- **Turrets:** a forward base's turrets fight for their holder (0.3.11).
- **NPCs on the ground:** they fly down to pads and away again under the Autopilot Computer (`autopilot.js`
  `dockGround`, `departGround`).
- **Canisters** come to rest on the ground below a Kármán line, and the hatch and tractor beams scoop them.
- **The pulse scanner** (Analysis mode, B): the scanner reaches 25 km for 10 s. **U** targets the nearest point of
  interest.
- **Colonies:** a research station gets ×1.5 in a ruin's system, and a port's market by a ruin sells artefacts and
  draws tourists (0.3.7). A lapsed claim leaves "salvage" (a fee discount, not a place).
- **Salvagers:** the stock ships include them (the Teratorn, Greyhook Salvage Works' salvager; the Tinker, a nomad
  repair tender and salvager).

**Measured on 0.5.0's code** (a sample of about 16,000 systems at eight places in the galaxy, and 30,000 in the Rift):

| | Normal galaxy | The Rift |
|---|---|---|
| Systems with a ruin | about 1 in 450 (the plan's 1 in 330 is the Drake figure) | about 1 in 12 |
| Ruin worlds that can be landed on | 22% (the rest: air 76%, molten 7%) | 25% |
| Ruin systems with some landable body | 91% | about 90% |
| In the whole galaxy | about 9,000 ruin systems, 2,000 with a landable ruin world | about 170,000 Precursor ruins, 42,000 on landable worlds |

So, as the outline stands ("ruins on airless worlds"), only about one ruin in five could be landed at. The first open
question below is whether to add outlying sites on the other bodies of a ruin system.

**Not there yet**
- Anything to find *on* the ground except deposits and lone ports.
- Structures that aren't ports, and models of ruins or wrecks.
- Terrain that changes after a visit.
- NPCs that land anywhere but on a pad.

## Principles

- **Small PRs, each playable.** Every step leaves the game working and tested.
- **Nothing else moves.** Every new draw has its own seed (`site:`, `outlier:`, `hulk:`, `crash:`, `poi:`). No star,
  world, ruin, port, deposit or saved game changes. The ruins stay where `galaxy.js` puts them; L4 only adds what
  stands on the ground there. The galaxy test's counts must come out unchanged.
- **Derived, not stored.** A site's place, its layout and what it holds come from the seed. The save keeps only what
  the player changed: what's been surveyed, opened, taken or collapsed, in a few bytes a site.
- **One height function.** Sites stand on the terrain as it is. A site's flats and pits go into `terrain.js` like a
  port's, so what's drawn is what's hit.
- **Budgets.**
  - A ruin site: at most 3,000 triangles at high detail and 1,400 at low.
  - A crash site: its ship's own mesh, plus at most 600 for debris.
  - Drawn within 30 km, in full detail within 6 km, like ports.
  - Working out a system's sites in under 1 ms (a system's own draw is under 1 ms today).
- **Offline.** Every rule works from the seed and the save alone.

## The kinds of site

| Kind | Where | Across | What stands there |
|---|---|---|---|
| **Ruin field** | the ruin world, when it can be landed on | 0.6–2 km | 3 to 6 structures, a vault, one or two natural plazas to land on |
| **Outlying ruin** (open question 1) | another landable body in a ruin system whose ruin world can't be landed on | 0.3–0.8 km | 2 to 3 structures and a small vault |
| **Precursor site** | the Rift's Precursor ruin worlds, and their outliers by the same rule | 1–3 km | 4 to 7 structures in the Precursors' own forms, a sealed vault, guardian pylons |
| **Old hulk** | any landable body, by chance (below) | the wreck, 2–6 times its length of debris | a long-dead ship half sunk in the ground, debris, a scar |
| **Fresh wreck** | landable bodies, drawn anew each season (below) | as an old hulk | a recent wreck: its hold spilled, a flight recorder, sometimes an escape pod |
| **Fallen** | wherever a ship is destroyed below a world's Kármán line, the player's kills included | as an old hulk | as a fresh wreck, for the rest of the season |

Every site is on a body that can be landed on (`landing.js` `landable`), and keeps to its world's 3% share, as ports
do. A site never overlaps a port's site; where they would, the site moves along its own seeded draw.

### Ruin fields

- **Where on the world:** a seeded latitude and longitude on the ruin world (`site:` + the world's name), avoiding
  the poles (within 70°) and any port's site. Tidally locked worlds put it anywhere: the old builders didn't need the
  terminator.
- **How it's laid out** (`sites.js` `layout`):
  - **Plazas first:** one or two levelled discs (60–150 m across, a short ramp), where a pilot sets down. Plazas are
    flats in `terrain.js`, like a port's.
  - **The vault:** a sunken entrance beside the largest plaza.
  - **The structures:** 3 to 6 of them round the plazas, from the kinds below, standing on the terrain as it is (each
    foot sampled from the height function, the part sunk by the slope so nothing floats).
  - **Approach corridors:** every plaza keeps the ports' 35° cone clear, so a pilot can always come straight down.
- **The structures** (each is a point of interest, a target for U):

  | Structure | Drawn as |
  |---|---|
  | monolith | a tall slab, leaning (a box tilted 5–20°) |
  | arch | two pillars and a lintel, sometimes fallen |
  | ring wall | a broken ring of blocks round a hollow |
  | stepped mound | three or four stacked blocks, each smaller |
  | shell dome | a dome with a third of its segments missing |
  | pillar field | 8 to 20 short pillars in rows, some fallen |
  | spire | a tall frustum narrowing to a point |

- **Colours:** weathered stone and metal, darker with age (the ruin's age is seeded: 1 to 9 billion years, which
  sets how much is fallen and buried).

### Outlying ruins

- **Where:** in a ruin system whose ruin world can't be landed on, the most Earth-like landable body (a moon of the
  ruin world first) gets a small site: a watch post of the same builders.
- **Found by** the ruin world's orbital survey, which now says "the same builders left traces on (body)". That body's
  survey, or a ground scan within 5 km, marks the site.
- **Smaller:** 2 to 3 structures, a small vault, a single plaza, and about half a ruin field's yield (below).

### Precursor sites (the Rift)

- **Where:** as ruin fields, on the Rift's Precursor ruin worlds when they can be landed on, and outliers by the same
  rule as above if the owner wants them.
- **Their forms** set them apart from every other ruin: angular and whole, not weathered.

  | Structure | Drawn as |
  |---|---|
  | shard | a long eight-faced crystal, upright or leaning |
  | lattice arch | thin crossed beams in an arch |
  | anchor ring | a ring standing on its edge, 40–120 m across |
  | stepped well | a square pit with stepped sides, lit at the bottom |
  | guardian pylon | a tall shard on a plinth: a turret (below) |

- **Colour:** off-black with violet seams in the emissive channel (the colour the HUD already uses for Precursor
  finds), lit at night.
- **The vault is sealed:** it opens only after the site's structures are surveyed (all but one).

### Crash sites

Two kinds come from the seed, and one from what happens in flight.

- **Old hulks** are permanent: wrecks from wars and journeys long before the game's day 0.
  - **How many:** a seeded chance per system with landable ground. 3% in claimed space, 6% in contested space (the
    fronts are old), 4% in unclaimed space, 8% within 10 pc of a long lane. In the Rift, 2%: Riftborn hulls, and one
    in five of those an old Precursor craft.
  - **How many there:** one, or two in one case in five.
  - **Which hull:** from the stock ships, by who flies where (`ships.js` pilots: navies on the fronts, traders and
    haulers near lanes, explorers far out), up to size L. A Precursor craft is one of the Precursor hulls.
- **Fresh wrecks** come and go with the seasons: the galaxy's own losses.
  - **How many:** each season, each system with a port has a seeded chance of one on a landable body: 8% in claimed
    space, 15% in contested space, 10% in unclaimed space with a lone port. The draw is `crash:` + the star's id + the
    season's number, so a wreck is there for that season and gone the next.
  - **Its age:** a day within the season, also seeded. A wreck "happened" on that day; before it, it isn't there.
  - **Which hull:** a trader, courier, miner, prospector or patrol ship of the system's holder (or a pirate's),
    from the system's own cast (`encounters.js`).
- **Fallen:** a ship destroyed below a world's Kármán line falls (it already does, as a body under gravity) and
  leaves a crash site where it hits: its canisters, its flight recorder, and its hulk for salvage. It's kept in the
  save until the season turns (at most 16 at a time, the oldest dropped first).
- **The layout:**
  - **The hull:** the ship's own mesh, tilted to the slope, sunk to a third of its height and turned at a seeded
    heading.
  - **A scar:** a dark trench behind it, along the heading, from 3 to 6 lengths long.
  - **Debris:** 6 to 30 boxes and broken plates scattered along the scar.
  - **Canisters:** a fresh wreck's and a fallen ship's lie round it (from `canisters.js` `wreck`, at rest on the
    ground). An old hulk's are long gone; it has its scrap.

## How sites are found

| Site | How it's found |
|---|---|
| Ruin field | the ruin world's orbital survey marks it (a navigation target on the world: "Ruin field"); a ground scan within 5 km; a cartographer's ruin contract |
| Outlying ruin | the ruin world's survey names the body; that body's survey or a ground scan within 5 km marks it |
| Precursor site | as a ruin field; and a Precursor star chart (an artifact, below) marks those within 40 pc |
| Old hulk | the pulse scanner below a Kármán line (within 25 km: "metal on the ground, 14 km, bearing 220"); a ground scan within 5 km; cartographers' charts on docking (each hulk within 5 pc, 30% of the time, as lone ports are found) |
| Fresh wreck | its **distress beacon**, a navigation target from arrival for 6 days after the wreck; then the pulse scanner or a ground scan; **salvage notices** on bulletins within 8 pc while it lasts |
| Fallen | where you saw it fall: it's a target at once |

- **Cruise to a site:** a site is a navigation target on its world. Cruise drops out above the world as for any
  landable world (`scene.js` `dropRange`), and the Autopilot Computer's cruise assist brings you over the site.
- **Known sites** go into the record (`P.explore.found`, like lone ports), so they stay marked.
- **The map:** a system's card lists the sites you know ("On the ground: a ruin field, an old hulk").

## What landing and surveying from the ground gives

### The survey, flown

A site is surveyed one structure at a time, not as a whole:

- **A structure:** hover within 80 m of it, or land within 150 m, for 8 s, with the cartographic sensor working. The
  target card shows the progress, then the finding ("an inscription", "a fallen spire: nothing more").
- **The vault:** land on its plaza (gear down, clean or hard) and hold 20 s. It opens: a cache is set out on the
  plaza as canisters, to scoop with the hatch while hovering low, or with a tractor beam.
- **Analysis mode helps:** U steps through a site's structures, and K scans the targeted one at once if you're in
  range.
- **An orbital survey** still works as today. Both can be done, and both pay.

### Yields: from orbit and from the ground

| | From orbit (today, unchanged) | From the ground (L4) |
|---|---|---|
| **Data** | the ruin's 6,000 SU on top of the world's value | site data: 4,000 SU, plus 800 a structure and 2,000 for the vault (8,400–10,800 SU for a full ruin field) |
| **Artefacts** | 2–4 t, once | the vault 4–8 t, plus 1 t from half the structures (about 6–11 t a field) |
| **Blueprints** | one roll: relay booster 30%, phaser 15% | the vault rolls again, on its own: relay booster 40%, phaser 20% |
| **Artifacts** (finds, below) | none | one from the vault, sometimes one from a structure (1 in 6) |

- **Multipliers,** as for every survey: ×2.5 for a first discovery (a ruin away from a port is always yours to find
  first); ×2 in the Rift; a Precursor site ×3. Outlying ruins give half, in all of it.
- **A Precursor site:** the vault holds 3–6 t of Precursor relics, and rolls its own Precursor blueprint (a hull
  15%, a weapon 20%, a module 50%). It also always holds one **lodestone** (below, and the Core plan).
- **Where data sells:** site data sells at Universal Cartographics once, like every chart, pleasing the port's
  holder a little (`explore.js` `sell`, the existing `scanRuins` act).

### Artifacts: finds for the broker

The vault's finds are items, not tonnes: a small list in the record (`P.artifacts`, at most 64), each named by the
game's own name generator from its site ("the Htevak tablet").

| Find | Share | What it's for |
|---|---|---|
| **Star chart** | 35% | marks the one to three nearest unsurveyed ruins within 30 pc on the map (a Precursor chart: Precursor sites and anchorages within 40 pc) |
| **Inscription** | 30% | sells to a cartographer (3,000–9,000 SU); or, handed to a power whose space holds the ruin, +20 standing with it ("returned") |
| **Device** | 20% | an artifact broker studies it: one build's fee costs 25% less; or it recycles into 2 t of Artefacts and 1 t of Electronics |
| **Relic of note** | 10% | the broker buys it (15,000–40,000 SU); or a colony's research station shows it (below) |
| **Lodestone** (Precursor vaults only, always, besides the find) | | the Core's story (`plan-ember-reach-core.md`); spare ones the broker buys for 4,000 SU |

- **The artifact broker** (Contacts, at lanterns, blooms and halos) gains a **Finds** tab: appraise, sell, study.
- Artifacts aren't cargo: they're kept with the ship's records, as blueprints are.

### Salvage

- **Canisters:** a fresh wreck's or a fallen ship's hold lies round it (`canisters.js` `wreck`, at rest). Scoop
  them as anywhere.
- **Scrap:** any hulk can be **stripped**: land within 100 m of it and hold 30 s with a working hatch or a tractor
  beam fitted. That gives 3–12 t of metals and electronics (by the hull's size) as canisters, once.
- **Modules:** stripping also recovers one or two of the wreck's non-core modules from its stock fit, at 30–70%
  health. They go to the next port with storage you dock at (as old saves' modules do, `hangar.js`), marked
  "salvaged", and are repaired at the outfitter. An old Precursor craft gives a Precursor blueprint instead (a
  module 30% of the time), never a working Precursor module.
- **The flight recorder:** every fresh wreck and fallen ship of a power's or faction's fleet has one. Land within
  60 m of the hulk and hold 10 s. Then:
  - **Return it** to any port of the ship's faction within 20 days: 1,500 SU × its size step (XS 1 … L 8) and +15
    standing; in a contested system of its war, it also counts +4 war effort for that side (as a supply run's +6
    does), played through the front like any deed.
  - **Sell it** at a syndicate's dreadnought or a free port: twice the money, −25 standing with the faction, and a
    step towards outlaw.
  - An old hulk's recorder is history, not intelligence: a cartographer buys it for 800 SU.
- **Data cores:** an explorer's wreck holds its unsold charts (1,000–8,000 SU). Land within 60 m and hold 10 s; they
  sell at a cartographer as your own data (not as a first discovery).
- **Munitions:** a warship's wreck gives 2–6 t of munitions among its canisters.
- **Escape pods:** a fresh wreck has one 30% of the time (a target by the hulk), for 6 days after the wreck; after
  that it's gone (others picked it up). Taking it aboard needs a free tonne; it's a cargo good, **Escape pod**, that
  can't be sold. Handed over at any port that isn't hostile, within 10 days: 2,000 SU and +25 standing with the pod's
  faction. Past 10 days the faction minds (−10).
- **The player's own crash** leaves a fallen site too. Whether its cargo can be recovered is open question 2: today
  insurance says the cargo is lost.

### Risks

- **Guardians, on the ground:**
  - **Sentinels** wake as today at 25 radii, once a visit.
  - **Wardens:** each ruin field adds 2 or 3 old towers among its structures, as turrets (forward bases' code,
    `combat.js`): an old laser each, turning 60° a second, waking when you're within 3 km and below 1.5 km. They
    can be shot down; their remains are inert structures, surveyed like the rest. Outlying ruins have one.
  - **Opening a vault** brings a second wave of sentinels half the time, from orbit, 30–50 s later.
  - **A Precursor site's guardian pylons** (2 to 4) are Riftborn-strong turrets with the lance's beam. Opening its
    vault always calls a guardian pair (Riftborn-strong, up to M size) from orbit, 40–60 s later.
- **Destroyed pylons** drop 1 t of Nullite or Voidglass. **A cleared site stays cleared** for the season: its wardens'
  and pylons' state is kept in `P.sites`.
- **Unstable ground:** one structure in four (seeded) stands over a hollow; twice as often on icy worlds and on moons
  of giants (tidal heating), half as often on airless deserts.
  - **The ground gives way:** landing within its radius, 3–8 s after touchdown a pit opens, 40–90 m across and
    20–60 m deep, and the ship drops into it; the touchdown rules decide the damage.
  - **The warning:** 1.5 s before, a rumble and a plume of dust; lifting off at once escapes it.
  - **Seeing it:** the ground scan marks **loose ground** within 1 km as a red ring.
  - **What it gives:** the opened pit is a new point of interest, an **undercroft**, with its own cache (2–4 t of
    Artefacts, and a find 1 time in 3).
  - **It stays open:** `terrain.js` gains **pits** (a disc lowered by a depth, with a steep ramp), applied from the
    record on entering the system, so the same pit is there on every visit.
- **Rival salvagers:**
  - **At fresh wrecks:** under 2 days old, rivals are there 20% of the time; 2 to 10 days, 60%; after that,
    stripped (no salvage, only its recorder if nobody took it). One or two salvagers (a Teratorn or Tinker) or
    pirate salvagers (a Wendigo).
  - **Lawful salvagers** (Greyhook-licensed, nomads) are neutral. They hail with a claim: if you landed within
    300 m of the hulk first, they leave; otherwise they work it, tractoring a canister every 30 s and stripping it
    in 3 minutes. You can race them, wait, or fight them; firing first is a crime, as anywhere.
  - **Pirate salvagers** attack.
  - **Relic hunters:** syndicate crews at unsurveyed ruin fields in the Glow and unclaimed space, 15% of visits,
    hostile, landed on a plaza (they use `dockGround` to a plaza as to a pad).
  - **Not in the Rift:** only the Riftborn are there, and the guardians.
- **Heat and cold:** as for any landing (the heat gauge on hot day sides, more fuel below 80 K).

## How it fits the rest of the game

- **Exploration:**
  - **First discoveries:** a site's first ground survey counts as one. Naming is unchanged: the ruin's world keeps
    its naming right, and sites take the world's name.
  - **Data:** site data sells beside chart, survey and landing data.
  - **Contracts:** the cartographers' ruin contracts gain an **excavation** kind (survey a ruin field from the
    ground: 3,500 SU plus 250 SU a parsec, due in 20 days).
- **The Rift:** Precursor sites, guardians, lodestones, Precursor star charts and old Precursor craft. Their finds
  sell at the Rift's rates (twice), and this side of the Maw at its premium (relics +25%), as now.
- **Factions:**
  - **Wrecks:** recorders and escape pods give standing with the wreck's faction, and their sale costs it.
  - **War effort:** a recorder recovered in a contested system counts as war effort for its side.
  - **Recovery contracts:** a navy posts them for its own fresh wrecks within 8 pc (the recorder, and 500 SU a
    parsec more). Syndicates post the opposite: bring them a power's recorder.
  - **Inscriptions** returned to the power whose space holds the ruin raise standing with it.
  - **Relic hunters** are syndicates: fighting them pleases the space's holder, as pirates' deaths do.
- **Colonies** (`colonies.js`, after L3.5):
  - **An excavation** (a new facility): tier 1, on the surface, about 800 t (the base mix and more machinery). It's
    built only on a body with a ruin site in the colony's system, and only after the site's ground survey. It counts
    as research and tourism in the port's economy, and feeds Artefacts to its market (0.4 t a day, ten days of it as
    stock, as a surface mine feeds its good).
  - **A relic of note** shown at a colony's research station gives that colony's tourism ×1.1 (one a colony).
  - **Raids** (L3.6): pirates shot down over a colony's world leave fallen sites there.
- **Combat:** wardens and pylons are turrets; rivals and relic hunters are NPCs of known roles. Nothing changes in
  the combat model.
- **Insurance:** unchanged unless open question 2 says otherwise.

## What the save keeps

All of it in the player's record, cleaned by `unpackPlayer` like every other part of it. These are additive fields
(as `P.deposits` was in 0.4.9), so the save stays at version 4.

- **`P.sites`:** `{site id: [day first seen, bits]}`. The bits record each structure surveyed (up to 7), the vault
  opened, each collapse (up to 7), and whether it's been stripped, its recorder taken and its pod taken. That's
  about 30 bytes a site.
- **Fallen sites:** `P.fallen`, at most 16: `{id, world, dir, ship, season}`, dropped when the season turns.
- **`P.artifacts`:** at most 64 `{k: kind, s: site id}`. The name comes back from the site's seed.
- **Recorders and pods:** `P.salvage`: `{rec: [{site, faction, war?, day}], pods: [{site, faction, day}]}`. The pod
  is also a tonne of Escape pod in the hold.
- **Known sites:** in `P.explore.found`, as lone ports are.
- **Trimming** (`save.js` `trim`, under the 230 KB budget): fresh wrecks' entries of past seasons go first, then
  fully done sites longest ago (a site whose entry is trimmed comes back as unvisited, which costs at most a second
  cache). Artifacts and salvage are never trimmed; they're small.

## Models and layouts, drawn in code

- **`sites.js`** (a new model, beside `surface.js`):
  - `sitesAt(star, season)`: the system's sites, each with its kind, world, place, seed and size.
  - `layout(site)`: plazas, the vault, structures, wardens and loose ground for ruins; the hull, scar, debris and
    points of interest for wrecks.
  - `check(layout)`: the rules it breaks (overlaps, a corridor blocked, past the site's edge, past its share).
  - `parts(layout)` in the stations' vocabulary, with `meshes(layout, detail)` built on `surface.js`'s.
- **Three new shapes** in the parts vocabulary, small additions to `meshes.js`'s primitives:
  - **`frustum`:** a cylinder with different radii at its ends (spires, stepped mounds, plinths);
  - **`shard`:** an elongated octahedron of 8 faces (Precursor shards and pylons);
  - **`tilt`:** any part may carry a pitch and roll besides its turn (leaning monoliths, fallen pillars, a hull on a
    slope).
- **Wrecks** reuse the ship meshes the game already draws: placed, tilted and sunk. The terrain hides the buried
  part, so nothing is cut.
- **The ruins' styles:** each ruin takes one of five styles from its seed (or from its people's, if open question 6
  goes that way), with its own proportions and colours leaning on the world's ground:

  | Style | Pieces |
  |---|---|
  | **Terraces** | stepped platforms, ramps, low walls in rows |
  | **Spires** | tall tapered towers (`frustum`), many fallen across the ground |
  | **Shells** | broken domes cut open, ribs standing where the glass was |
  | **Rings** | standing arches and ring segments, in lines across the site |
  | **Grid** | a city plan of low roofless walls on a grid, round a central hall |

  Outlying ruins use the same style at a smaller scale with fewer pieces (a watch post, a mine's pit).
- **The Precursors' style** is deliberately unlike any of these: monolithic slabs and faceted pillars (`shard`),
  black like voidglass, with thin seams glowing violet in the emissive channel, a vault's doors as tall slots in a
  slab. Nothing Precursor in the Rift has fallen. (The Core's Calm-Era ruins in the Core plan are the exception:
  the same style, weathered.)
- **Weathering:** the ruin's age takes structures down (fallen pillars, a lower ring wall, more segments missing
  from a shell dome) and darkens the colours. No textures.
- **`sites.html`** beside `layouts.html`: each kind from above (plazas and their corridor rings, footprints, loose
  ground) and in an oblique 3D view, with a button for new seeds and a triangle count.
- **Budgets:** checked in the test for every kind across 200 seeds.

## Tests to write

- **Node** (`tests/emberreach_sites_t.js`):
  - **Determinism:** the same star and season give the same sites and layouts.
  - **Nothing else moves:** `galaxy.js`'s ruin count, `surface.js`'s ports and `explore.js`'s deposits are the same
    with sites as without them.
  - **Rates:** over a few thousand systems, each kind comes out near its chance; fresh wrecks change with the season
    and stay put within it.
  - **Placement:**
    - every site is on a landable body, within its world's share, and clear of every port's site;
    - outliers appear only where the ruin world can't be landed on.
  - **Layouts:** `check` finds nothing in 200 layouts per kind; every plaza's cone is clear; the budgets hold.
  - **The survey:** a structure's progress needs the range and the sensor; the vault needs the plaza.
  - **Yields:** the ground's yields beat the orbit's for the same site; the blueprint and find odds hold in a Monte
    Carlo run.
  - **Pits:** the height after a collapse is lower, the same whenever it's rebuilt from the record, and level with
    its neighbours' flats.
  - **Salvage:** recorders' rewards, standing and war effort; the sale's cost; pods' deadlines.
  - **Rivals:** the claim goes to whoever landed first.
  - **Saves:** a round trip of `P.sites`, `P.fallen`, `P.artifacts` and `P.salvage`; trimming in its order; a save
    without them loads.
  - **Speed:** a system's sites in under 1 ms.
- **Browser** (added to `tests/emberreach_t.js`):
  - land on a ruin field's plaza, survey a structure, open the vault and scoop a canister;
  - strip an old hulk and take its recorder;
  - the frame rate over a ruin field on the release test machine (the software-rendered Chromium) is no lower than
    over a surface port.

## Steps

| Step | What | Depends on | Size |
|---|---|---|---|
| **L4.1** ✓ | `sites.js`: kinds, placement, layouts, parts, the three shapes, `sites.html`; node tests. Nothing in flight yet (0.7.1) | L3 done | medium |
| **L4.2a** ✓ | Ruin fields in the game: drawn, found (survey, ground scan, coming near), the flown survey, the vault and its cache, site data (0.7.2) | L4.1 | medium |
| **L4.2b** ✓ | The wardens and the vault's sentinels; the map's card (0.7.3) | L4.2a | small |
| **L4.3** ✓ | Artifacts: `P.artifacts`, the broker's Finds tab, star charts on the map, inscriptions returned, devices; the excavation contract (0.7.4) | L4.2 | medium |
| **L4.4** | Unstable ground: loose ground on the scan, collapses, pits in `terrain.js`, undercrofts | L4.2 | small |
| **L4.5** | Precursor sites in the Rift: their forms, pylons, the sealed vault, Precursor finds, lodestones | L4.2, L4.3 | medium |
| **L4.6** | Crash sites: old hulks, fresh wrecks, fallen ships; beacons, the pulse scanner's find, salvage notices; stripping, recorders, pods | L4.1 (and L4.2's plumbing) | large |
| **L4.7** | Rival salvagers and relic hunters: landing NPCs at sites, the salvage claim | L4.6 | medium |
| **L4.8** | Ties: recovery contracts, the excavation facility, relics at colonies, raids' fallen sites | L4.3, L4.6, L3.5, L3.6 | medium |
| **L4.9** | Release (its number is the owner's: open question 7) | L4.1–L4.8 | small |

- **In parallel:** L4.6 can go alongside L4.2 once L4.1 is in, and L4.4 alongside L4.3.
- **The Core's story** (`plan-ember-reach-core.md`) needs L4.5's lodestones and Precursor vaults first.

**L4.1, as built (0.7.1):**
- **`sites.js`:** `sitesAt(star, season, ctx)` (ctx: the space, a long lane near, a port, the holder, the surface
  ports), `peopleOf(star)`, `layout(site)`, `check(layout)`, `parts(layout)`, `meshes(layout, detail)`.
- **Ruin layouts:** plazas first; the vault beside the largest; the structures round the plazas, just outside their
  35° cones; wardens or pylons farther out. The rest of the site is the levelled ground it keeps clear.
- **`meshes.js`:** `frustum`, `shard`, and `Mesh.tilt(pitch, roll)`.
- **`sites.html`:** each kind from above and from an oblique camera, with its triangle count and any rule breaks.
- **Measured** (about 100,000 stars): ruin systems 1 in 405; ruin fields on 25% of them, outliers on most of the
  rest; Precursor sites on about 2.5% of the Rift's stars, a quarter of the Rift's hulks old Precursor craft. At most
  about 1,450 triangles for a ruin field at full detail, 1,000 at low. A system's sites in well under 1 ms.
- **The orbital ruin cache** (open question 9) is seeded from the ruin in `play.js`.
- **Tests:** `tests/emberreach_sites_t.js` (14).

**L4.2a, as built (0.7.2):**
- **In the game:** a system's ruin fields and outlying ruins (`play.js` `groundSites`, from `sites.js`). Precursor
  sites wait for L4.5, crash sites for L4.6.
- **Drawn** within 30 km, in full within 6 km. Each piece stands where its ground is: the plazas and the vault are
  levelled into `terrain.js` as flats, and a structure stands at the lowest point under its foot, so none floats.
- **Every site stays where it is,** whatever the system's holder: it keeps clear of the surface ports of every class
  the system could have (`sites.js` `allPorts`).
- **Found** by any of:
  - the ruin world's survey from orbit, which marks a field (for an outlier it names the body);
  - a ground scan within 5 km;
  - coming within 1.5 km.
  Found sites are navigation targets, and their structures and vault are targets within 6 km (U steps through them).
- **Surveyed:**
  - **A structure:** hover within 80 m or land within 150 m, for 8 s, with a working cartographic sensor; or K, in
    range, at once. It gives what you find there, and a tonne of Artefacts from half of them.
  - **The vault:** opens after 20 s landed on its plaza, setting out 4–8 t of Artefacts as canisters (an outlier's
    half) and rolling its own blueprint: a phaser 20%, a relay booster 20%.
  - **The target card** shows progress for both.
- **Site data:**
  - Worth 4,000 SU, plus 800 a structure and 2,000 for the vault; ×2.5 for a first discovery (a ruin in a system
    with no port). An outlier's is half.
  - It sells at cartographers as far as it's surveyed; data from more structures, surveyed later, sells again.
- **The record:**
  - Kept in `P.explore.site` (bits for each structure and the vault, the data sold, first or not); unsound entries
    are dropped on loading.
  - A first discovery is the galaxy's (`firsts.site`), so another pilot finding the same site later isn't first.
- **Not yet:** the excavation contract (with L4.3).

**L4.2b, as built (0.7.3):**
- **Wardens:** a ruin field's 2 or 3 towers (an outlier's one) stand ready within 6 km of the site. Each is a
  sentinel that doesn't move.
  - **Waking:** when you're within 3 km of it and below 1.5 km above the ground (or when it's fired on).
  - **Fighting:** it turns 60° a second and fires its old laser within 3 km.
  - **It isn't drawn as a ship:** its tower is, and the warden fires from the top of it.
- **Shot down, a warden stays down for the season:** the site's record keeps which (`w`) and when (`ws`).
- **Its remains** are a structure to survey, worth 800 SU of site data like any other.
- **The vault's second wave:** opening a vault calls sentinels from orbit half the time (seeded from the site), 30–50 s
  later.
- **The star map:** a system's card lists the sites you know: "On the ground: …, a ruin field (Quaisl d)".
- **Tests:** `tests/emberreach_sites_t.js` 20–21; `tests/emberreach_ruins_browser_t.js` 2b–2d, 5b, 6b, 7b.

**L4.3, as built (0.7.4):**
- **`artifacts.js`:** a ruin's vault always holds a find, and one structure in six does.
  - **Shares:** star charts 35, inscriptions 30, devices 20, relics of note 10, out of 95 (the plan's shares, as
    weights: a find is always one of the four).
  - **Names:** each find is named from its site ("the Vorux tablet"), the same in every save.
  - **The record:** kept in `P.artifacts`, at most 64; a place's find once.
- **A star chart** is read where it's found. It marks the one to three nearest ruins within 30 pc that you haven't
  surveyed: their sites are found, so the map's card lists them, and the chart remembers which.
- **Inscriptions:**
  - **Sold** with your data at cartographers (3,000–9,000 SU).
  - **Returned**, at an artifact broker in a port of the power whose space held the ruin when it was found: +20
    standing (`reputation.js` `returnFind`).
- **The broker's Finds** (in Contacts, at lanterns, blooms and halos) lists every find, with what can be done with it:
  - a relic sold (15,000–40,000 SU);
  - a device studied (`P.study`: each takes 25% off a build's fee, used by the next build) or recycled (2 t of
    Artefacts and 1 t of Electronics into the hold);
  - an inscription returned.
  Twice the worth in the Rift.
- **The excavation contract:** cartographers sometimes offer one, at 3,500 SU plus 250 SU a parsec, due in 20 days.
  - The job: a ruin field to survey from the ground, three of its structures (all of them, if it has fewer) and its
    vault.
  - An orbital survey doesn't complete it.
  - It can be shared in a co-op wing.
- **Not yet:**
  - Precursor charts and lodestones (L4.5);
  - a relic shown at a colony (L4.8).
- **Tests:**
  - `tests/emberreach_artifacts_t.js` (11).
  - `tests/emberreach_finds_browser_t.js` (8).
  - `tests/emberreach_ruins_browser_t.js` 6a.
- **Tests:**
  - `tests/emberreach_sites_t.js` 15–19.
  - `tests/emberreach_ruins_browser_t.js` (10).

## Risks, and what to do about them

| Risk | What to do |
|---|---|
| Sites too rare to matter | Outlying ruins (open question 1), crash sites wherever there's traffic, and star charts, tips and contracts pointing to them. The rates are counted in the node tests. |
| Sites too common, so ruins stop feeling like finds | Ruin fields stay rare; outliers give half; every chance is a single constant in `sites.js` for playtests. |
| Scooping canisters from the ground is fiddly | Canisters at a site don't expire while you're within 20 km; a tractor beam pulls them up; the landing assist holds the descent. |
| Unstable ground feels unfair | The ground scan shows it, it warns 1.5 s ahead, and lifting off at once escapes it. |
| Wardens and rivals cost frames on the software renderer | Wardens reuse the forward bases' turrets (already within budget); at most two salvagers in flight at once; sites at low detail beyond 8 km. |
| The save grows with sites | A few bytes each; salvage expires with the season; trimmed under the save's budget (a test). |
| Colonies (L3.5) change while L4 waits | L4.8 is last and small; the rest touches colonies only through the planner's listing. |

## Open questions for the owner

1. **Outlying ruins.** Only about 22% of ruin worlds can be landed on (most have air). Should a ruin system's other
   landable bodies get a smaller site?
   - (a) No: ground sites only on landable ruin worlds (about 2,000 in the galaxy, 1 system in 2,000).
   - (b) Yes, always where there's a landable body (sites in about 90% of ruin systems).
   - (c) Yes, half the time.
   - **Recommended: (b).** Ruins are rare already (1 system in 450), and the ruin itself doesn't move.
2. **The player's own crash.** Insurance says the cargo is lost (`insurance.js`; its rule "may change").
   - (a) Keep it lost.
   - (b) The cargo lies at the crash site as canisters for 7 days, for the pilot to recover in the new ship.
   - (c) As (b), with rival salvagers arriving after a day.
   - **Recommended: (b).** Insurance is otherwise unchanged.
3. **Salvage law.** Scooping a wreck's canisters is no crime today.
   - (a) Keep it so, and let only the recorder's choice matter.
   - (b) Make scooping a power's wreck in its own space a crime when its patrol sees it.
   - **Recommended: (a).** It's consistent with canisters in space.
4. **Survivors.** Ships don't carry passengers yet.
   - (a) Escape pods as a one-tonne cargo good, as above.
   - (b) Wait for passenger cabins.
   - (c) Leave survivors out.
   - **Recommended: (a).**
5. **Fresh wrecks by season.** Should the galaxy's own losses come and go each season, or should crash sites be old
   hulks only (with fallen ships)?
   - **Recommended: both.** They make return visits differ, at no cost to the save.
6. **Earlier civilisations as peoples.** The Drake model counts each earlier civilisation in about ten systems, but
   each ruin is drawn on its own.
   - (a) Leave them separate: star charts point to the nearest ruins.
   - (b) Group ruins into peoples by a seeded cell (about 30 pc), with a generated name and a style of their own
     (which structures, which colours). Their star charts then point to their own people's other sites.
   - (c) A fuller model.
   - **Recommended: (b).** It moves no ruin and gives finds a story.
7. **The release number** after L4. 0.5.0 went to duels, and the 0.5.x numbers are in use by the sessions working
   now.
   - **Recommended: 0.6.0**, following the pattern of 0.3.0 after L1 and 0.4.0 after L2.
8. **Rift outliers.** Should open question 1's answer apply to Precursor sites too? The Rift already has about 42,000
   landable Precursor ruins.
   - **Recommended: no outliers in the Rift.** There are plenty already.

9. **The orbital ruin cache is not reproducible.** Surveying a ruin from orbit rolls its Artefacts or Relics with
   `Math.random` (`play.js`, the survey's cache), so the same ruin gives different amounts on different saves.
   - (a) Leave it. (b) Seed it from the ruin, as everything else about a ruin is.
   - **Recommended: (b),** as a one-line change with L4.1, so orbit and ground yields are both fixed per ruin.

**The owner's earlier open questions this plan touches** (not decided here):
- **The WOS "rich galaxy" mix** (`plan-ember-reach.md`): it doesn't change the ruins' Drake rate, so not the number
  of ruin sites; it would change how many bodies can be landed on, and so outliers and crash sites.
- **Multiplayer:** shared discoveries would have to say whose a site's first ground survey is.
- **Game time:** fresh wrecks and their deadlines run on the season and the calendar.
- **The great powers' names:** generated today. Question 6's peoples would be named the same way.
- **Naming colonies' systems** (`plan-ember-reach-colonies.md`): sites take their world's name either way.

## Sources

- Earlier plans this builds on: [plan-ember-reach.md](plan-ember-reach.md) ("Exploration", "The Rift", "Mining",
  "Factions, wars and money"), [plan-ember-reach-landing.md](plan-ember-reach-landing.md),
  [plan-ember-reach-landing-work.md](plan-ember-reach-landing-work.md) and
  [plan-ember-reach-colonies.md](plan-ember-reach-colonies.md).
- The measurements above come from running 0.5.0's `galaxy.js` and `landing.js` in node over about 16,000 systems
  (and 30,000 in the Rift).
