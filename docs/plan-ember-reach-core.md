# Ember Reach: the Core and its story (M6), and the later landing items

The plan for M6's Core: the galaxy's crowded heart, the Maw at its centre, and a story that leads there and plays
fully offline. It also outlines the three items `plan-ember-reach-landing.md` left for "Later" (worlds with
atmospheres, surface vehicles, night lights), with what each would cost on the software renderer. M6's other parts,
polish and phones (Rudolf OS 1.6.0), are planned with the touch and small-screen work and aren't repeated here. Part of
[plan-ember-reach.md](plan-ember-reach.md); it builds on the ground sites of
[plan-ember-reach-sites.md](plan-ember-reach-sites.md) (L4).

Nothing here is built yet. Numbers are starting values for playtests.

**The owner's answers (2026-11-25):** the story comes after the ground sites it needs (L4,
`plan-ember-reach-sites.md`), built first.
- **1, the ending:** the choice (Seal, Bind, Give, or leave it).
- **10, the Echo:** "1.5x your ship, with smaller, weaker ships supporting them, 1 for each member of your own
  wing": the Echo at one and a half times your ship, and with it one smaller, weaker escort for each other pilot in
  your wing (none flying alone).
- **9, the Core chart:** everywhere in the Core.
- **3, time near the Maw:** within 10 radii of the Maw only.
- **The rest** (2, 4 to 8, 11 to 14): to be gone through with the owner when the story's steps begin.

## What the plan already fixes

These are decided and, mostly, built. The story below works within them and changes none of them.

**The Core** (`plan-ember-reach.md`, "Regions"):
- It's the region inside 30 pc of the centre in the plan's original figures, 2.4 pc in 0.2.0's smaller galaxy.
- Stars there are a few thousand AU apart, with constant close passes, and the black hole at the centre.
- The plan calls it the endgame: the richest resources (metals are highest at the centre, [Fe/H] +0.15) and the
  most ruins, "from an earlier era when the centre may have been calmer"; and the most dangerous flying.
- It's sterile: inside about 60 pc (original figures), under 1% of Sun-like stars escape close passes for 4 Gyr.
- **Misjumps** lock onto a neighbour about 56% of the time there (`travel.js`).
- **Nobody holds it:** no great power reaches it, so no space ports, no lanes, no beacons (unclaimed space has no
  ports). Only a lone surface outpost or camp turns up, in about 1 system in 25 with landable ground.
- **No colonies** may be claimed in the Core (`plan-ember-reach-colonies.md`).

**Measured on 0.5.0's code** (every star within 2.4 pc of the centre):

| | |
|---|---|
| Stars | 138,500 (3.5% of the galaxy) |
| With planets | 108,000 |
| With a ruin | 316 (about 1 in 440, as elsewhere: the ruins' rate doesn't rise at the centre in the code) |
| Black holes besides the Maw | 283 |
| Nursery stars still burning | 135 O, 269 B and 7 Wolf-Rayet stars |

**The Maw** (`plan-ember-reach.md`, "The Rift"; `galaxy.js` `HEART`):
- It's the galaxy's central black hole: about 2,516 suns since 0.2.0.
- **Its horizon:** a Schwarzschild radius of about 7,400 km (2.95 km a sun).
- **On the map** and the route planner like any star (`heart`), with no port or worlds.
- **The safety** holds ships three horizon radii off (about 22,300 km). The phaser works within 1.25 times that.
- **The Riftborn** slip through to this side on half of visits (`encounters.js` `RIFTBORN.maw`).

**Black holes are wormholes:** with an alien dimensional phaser, J within range of any black hole phases to a
random star, drawn by the galaxy's density (so most often towards the centre). The Maw instead leads only to the
Rift, and the Rift's Maw leads home.

**The Rift, as built** (0.2.0 to 0.2.1):
- **Its stars:** 2 million, each a star of this side turned over, drawn in to 75%, its name written backwards.
- **Nothing lives** on any of its worlds.
- **Its havens:** about 1,600 Precursor anchorages: old automated docks with nobody aboard, independent of every
  power. One stands at the Maw, kept by the Interstellar Marshals.
- **The Riftborn** crew every ship there: copies of the living's warships and pirate hulls, three times as tough.
  They attack everyone and never flee.
- **The Precursors' work:** their ruins, relics, ores, blueprints and P-grade work, and their four hulls, named for
  the oldest extinct things (Opabinia, Anomalocaris, Dunkleosteus, Arthropleura).

**What the physics says about the Maw** (for drawing it and for the story; the sources are at the end):
- **The ISCO:** the innermost stable circular orbit is at three Schwarzschild radii, so the safety already holds
  ships exactly there. An orbit at that distance would take about 1.1 s and move at half the speed of light, so
  nothing there orbits as a ship would: whatever stands there holds still.
- **The photon sphere** is at 1.5 radii (about 11,100 km). The dark **shadow** a viewer sees has a radius of about 2.6 horizon
  radii, larger than the horizon itself: that's the size to draw the dark disc.
- **Time runs slow:** a clock held still at three radii runs at 0.82 of a far one's rate.
- **Tides:** at three radii the pull differs by about 60 g across 10 m (600 g across 100 m). A real ship there would
  be torn apart. The game leaves tides out today (open question 2).
- **Stars are torn up** passing closer than about 9.5 million km, far outside the horizon: tidal disruption flares.

## Principles

- **Played offline, in one save.** The story's state is in the save; the galaxy, the wars and the markets go on round
  it as they do now.
- **Nothing breaks.** The Maw stays a wormhole to the Rift; the Rift stays as built; no existing star, ruin, port or
  save changes. New things (the vaults, the Lock, the woken anchorages) come from new draws with their own seeds.
- **Any origin.** It works for a pilot of any of the 12 powers, written round placeholders ("your people", the
  patron, the generated names) filled in when the text is shown.
- **Built from what exists.** Story missions use the mission kinds the game has (survey, stay, kills, deliver, sites),
  so the story is mostly content, not new systems.
- **Nothing is timed against the player.** Story missions don't fail and don't expire; the pressure is in the world
  (the tide, the rival), not a clock.
- **Text only.** Voices in comms and on starport screens, with no portraits and no drawn characters. The Precursors
  are never shown, only their work.
- **Its own story.** Written for Ember Reach, not drawn from any other game's plot.

## The story: "The Lock"

A story that can be played offline from the save alone, in three acts. It's the endgame, as the plan places the
Core: it begins in the Rift and ends at the Maw. It uses the factions and the Precursors as they are, and adds one
voice and one structure.

### What happened (the player learns it in pieces)

- **The Precursors** were the galaxy's first people. They lived in its middle when the middle was calmer.
- **The galaxy's heart grew crowded,** and close passes stripped their worlds one by one. Rather than leave, they
  built a second galaxy: **the Rift**, a turned-over copy reached through the Maw, half as crowded and quiet.
- **The Lock:** to keep the crossing in hand, they built a structure that holds still at the Maw's last stable
  orbit. It decides what may pass.
- **The Riftborn** are the Rift's keepers, machines that copy whatever crosses (which is why they fly copies of the
  living's ships) and turn it against intruders.
- **The anchorages** are the Precursors' docks, still running, with nobody aboard.
- **Where the Precursors went** is never fully answered: their last records point into the Maw itself. That is left
  open, on purpose.
- **What's wrong now:** the Lock is failing. Its three **bearings** were taken out long ago and hidden in vaults in
  the Core's ruins, this side of the Maw. Without them, the Riftborn cross more and more often: that is the "half of
  visits" already in the game, and in the story it rises.

### The voice: the Steward

- **Who:** the anchorages' old automated mind, which speaks through any Precursor anchorage's docking computer once a
  pilot carries a **lodestone** (a Precursor navigation key, found in every Precursor vault: L4.5).
- **What it is:** a machine keeping its makers' house, precise and a little out of date. It's not a person, and it
  doesn't pretend to be one.
- **How it speaks:** in the docking computer's trade pidgin, which every pilot's ship understands, so the language
  lock doesn't apply.
- **Where it's heard:** on a **Steward** contact at anchorages, and in short comms in flight.

### Act I: Echoes

| Mission | How it starts | What you do |
|---|---|---|
| **1. A voice in the dock** | docking at any Precursor anchorage with a lodestone aboard. For pilots who haven't landed at a Precursor site: after the first crossing, the Marshals at the Rift's Maw mention vaults on the ground | hear the Steward |
| **2. Three bearings** | mission 1 done | bring three lodestones to any anchorage (any Precursor vaults; L4.5). Each one read points to a system in the Core |
| **3. On the near side** | the second lodestone read | a Riftborn wing crosses into a border system of the Hearth (the cluster nearest the Core): fight it, or warn its power's port. The Hearth's powers take notice |

### Act II: The crowded heart

| Mission | How it starts | What you do |
|---|---|---|
| **4. Through the crowd** | the third lodestone read | reach the first **Core vault** through the misjumps. The Steward's **Core chart** halves misjump chances inside the Core from then on (open question 9) |
| **5. The first vault** | arriving there | land at the vault's site and open it: the first bearing. It's a Precursor site this side of the Maw, the only kind there is, with guardians |
| **6. Patrons** | the first bearing | choose whom to tell (below), or nobody |
| **7. The anchorages wake** | each vault opened | two to four **Core anchorages** wake near it: havens in the Core, with fuel, repairs and trade in SU (open question 4) |
| **8. The second and third vaults** | after mission 6 | as mission 5. With two bearings, Act III begins |

- **The vaults:** three, chosen once for the whole galaxy (the same in every save) by `story.js` from the Core's
  ruin systems with a landable site (L4), spread round the Maw.
- **The patrons** (mission 6) are whoever the pilot trusts with the bearings. Each brings help in Act III and
  changes the ending's last option (below).

  | Patron | Who can choose it | Its help |
  |---|---|---|
  | **Your origin's power, or a power you're Friendly with** | anyone | a war wing (three ships of its navy) for the Lock; a rented fleet carrier parked at the Maw as a depot, as colonies rent them |
  | **The Interstellar Marshals** | anyone not wanted | guards at the woken anchorages; docking at the Maw's anchorage even when wanted elsewhere (not when wanted by them) |
  | **A free port** | anyone | Precursor goods bought at a further premium there; a price on each bearing's records |
  | **A syndicate** | grey or outlaw pilots | money, and its dreadnought at the Maw for repairs and munitions |
  | **Nobody** | anyone | nothing; and nobody else knows |

- **The rival:** whoever the patron's enemies are want the bearings too. At the second and third vaults a rival
  wing waits; losing the fight there loses that bearing to the rival's flagship (a seeded system in the Glow), where
  it must be taken back. The rival by patron: a power's enemies send their navy; the Marshals' patronage brings a
  syndicate; a free port's or nobody's brings a syndicate's relic hunters; a syndicate's brings the Marshals
  themselves. A bearing is a story good: it can't be sold or dropped, and the insurer gives it back with the ship.
- Choosing a patron changes standing by the usual spread: its allies are pleased, its enemies not, and a syndicate
  makes the powers cool.

### Act III: The tide

| Mission | How it starts | What you do |
|---|---|---|
| **9. The tide rises** | two bearings found | for as long as Act III lasts: the Riftborn cross on every visit to the Maw, appear on a fifth of arrivals in Core systems and on one in twenty at the Hearth's edge. The tide takes no systems and changes no front; it makes travel dangerous, and the Hearth's currencies take a shock that fades (the existing shocks) |
| **10. Holding the anchorages** | the tide | defend woken anchorages from waves of Riftborn. A lost wave isn't a loss: the anchorage falls quiet for a season and wakes again |
| **11. The Lock** | three bearings | at the Maw, the Lock shows itself: a ring standing still at three horizon radii, where the safety holds. Fit the bearings, one at each of its three docks, while the patron's help holds off the tide |
| **12. The Echo** | the third bearing fitted | the Lock's keepers make their last copy: of your own ship, its hull and fit, at one and a half times its strength (not the Riftborn's three: open question 10). Beat it |
| **13. The setting** | the Echo beaten | the Steward asks how the Lock should be set (below) |

### The ending: setting the Lock

Every ending keeps the Rift open to phasers, and no ending stops the game.

| Setting | What changes |
|---|---|
| **Seal** | the Riftborn no longer cross to this side (the Maw's half of visits goes to none); phasers still pass both ways. The Steward goes quiet, its work done |
| **Bind** | the Lock knows you: the Riftborn at both Maws and within 5 pc of any anchorage leave you alone unless you fire first. Elsewhere in the Rift they're as before. The powers and the Marshals don't like a pilot the Rift answers to (−100 with every great power, by the usual spread) |
| **Give** | as Seal, and the Lock's records go to your patron (not "nobody"): a power gains standing with you and its enemies lose it; the Marshals keep the Lock; a free port's trade grows; a syndicate's privateers grow bolder. The patron's currency takes a lasting boost and its enemies' a shock (within the existing rules) |
| **Leave it** | not choosing is allowed: the tide goes on at its Act III strength until the pilot comes back and sets the Lock |

### After the ending

- **The woken Core anchorages stay,** so the Core has havens for good.
- **The Deep Archive:** the Lock's own vault. Each season it offers one Precursor blueprint (from the existing
  tables) for spare lodestones, so Precursor vaults stay worth landing at.
- **Tides as seasons:** after Seal or Give, none. After Bind or with no setting, a smaller tide in one season in
  four.
- **News:** bulletins and comms mention what was done, and the patron's ports greet the pilot by it.
- **What goes on as before:** wars, markets, colonies, the Rift, and the Marshals.
- **Charted wormholes** (open question 11): with the Steward's Core chart, the Core's 283 black holes lead to fixed
  stars, seeded pairs, instead of random ones: a network to learn.

### How it's built

- **`story.js`** (a new model): the acts and missions as data, their triggers, the vaults and the Lock's place, and
  the endings' effects as small changes the other models read (`encounters.js` reads the tide and the Lock's
  setting; `travel.js` the Core chart; `reputation.js` and `economy.js` the endings' standing and shocks).
- **Mission kinds** it needs, each made of pieces the game already has:
  - go to a place (a system, a body, a site);
  - land and survey a site (L4);
  - bring items (lodestones, bearings);
  - dock and hear (the Steward contact);
  - defend a place (waves placed with `encounters.js`, as war missions place ships);
  - destroy one ship (the Echo);
  - choose (a contact's choice screen).
- **Story missions** don't count against the three missions a pilot can hold, and never expire.
- **The journal:** a **Journal** tab on the starport's Status screen and on the pause screen (the act, the current
  mission, what's been learned), and the current mission's place as a navigation target.
- **Text:** in the game's own words, through `i18n.js` keys from the start (open question 7). About 15 to 25 KB of
  text, within the game's 2 MB.
- **The Lock** is drawn in code like the stations: three docks on a ring about 3 km across, standing still, dark with
  violet seams. **The Echo** is the player's own ship mesh in the Riftborn's colours.
- **Places:** chosen by a seeded draw over the galaxy's own data, so every save has the same vaults, the same Lock,
  and the same Core anchorages waking.

### What the save keeps

- **`P.story`:** `{act, step, flags, lodestones read, bearings, patron, setting, day started, day of each act}`.
  That's under 200 bytes, never trimmed.
- **Woken anchorages:** their ids, a few bytes each.
- **Older saves** start with no story; its triggers can fire from any later point.

### Tests to write

- **Node** (`tests/emberreach_story_t.js`):
  - **Places:** the vaults and the Lock's place are the same in every run; every vault is a Core ruin system with a
    landable site.
  - **Missions:** each trigger fires once, in order, and survives a save round trip at every step.
  - **Mission kinds:** each one completes and doesn't count among the held missions.
  - **Patrons:** each one's eligibility (a syndicate only for grey or outlaw pilots; the Marshals not for the wanted).
  - **The tide's odds** in `encounters.js` during Act III, and after each setting.
  - **The endings:** each one's standing and shocks fade by the existing rules; Bind's Riftborn leave the pilot alone
    within 5 pc of an anchorage and not beyond.
  - **Nothing else moves:** the galaxy, the fronts and the markets are the same as without the story, outside its
    named effects.
- **Browser:** a scripted run from mission 1 to the ending with test hooks (`?debug` gives lodestones and bearings),
  checking the journal, the Steward screen, the Lock's model and the Echo.

## Polish for the Core and the Maw

- **The Maw drawn right:**
  - a dark shadow 2.6 horizon radii in radius;
  - a thin bright photon ring at its edge;
  - the accretion disc's inner edge at three radii, turning visibly (an orbit there takes about a second);
  - one side brighter, the side turning towards the viewer.
- **WebGL:** the light bends round it (a screen-space lens over the sky behind).
- **The Canvas fallback and software renderers:** the shadow, ring and disc only, which cost a few hundred
  triangles and no extra fill.
- **The Core's sky:** "a wall of light". The precomputed sky gets brighter towards the centre and the nearest
  thousands of stars crowd it; on low quality, fewer points and a brighter backdrop instead.
- **The Core as a place,** so the story's trips are worth it:
  - **Chart packs:** besides the Steward's Core chart, nomad carriers and prospector guilds in the Glow sell packs
    charting the Core's systems within 0.5 pc of a point (5,000 SU); a charted target's misjump chance falls by three
    quarters. Kept as charts in `P.explore`.
  - **Rich veins:** the Core's rings and belts take an extra hotspot draw (its own seed), so about half have one;
    no existing hotspot moves.
  - **Crowded light:** neighbours under 0.02 pc are drawn as small discs, not points; and now and then (once a
    season in a tenth of Core systems, seeded) a system is mid-pass, a neighbour's light on the far side of every
    world (one more light term in the shader, as the spotlight is).
  - **Heat:** in Core systems the heat gauge creeps up in open space (a twentieth of a laser's heat): lasers run
    hotter, nothing cooks. Starting values for playtests.
- **Tidal flares** (optional): now and then near the Maw, a passing star torn up, as a bright arc in the sky for a
  few days of game time.

## The later landing items, outlined

`plan-ember-reach-landing.md` left these for later. Here's what each would take, and what it would cost on the
software renderer. The cost of drawing there is filling pixels, not JavaScript (measured in 0.2.6).

**The software renderer today, for reference** (the release test machine's software-rendered Chromium, 1100 × 720):

| Situation | fps |
|---|---|
| Space, idle | 60 |
| Combat, 6 pirates firing | 30–38 |
| 1 km over a moon | 31 (at half resolution, terrain at 38%) |

### Night lights

- **What:** inhabited worlds' night sides glow with cities when seen from space: around their ports, and scattered by
  population (more clusters for more people, about log10 of the population, seeded).
- **WebGL:** a night-lights term in the planet shader, masked by the night side. Very cheap.
- **Software:** baked into the planet mesh's vertex colours once per world, with no extra pass. On low-detail
  meshes the lights are blotches rather than points.
- **Cost:** a few hundred vertex colours per world, once. No change in frame rate expected.
- **Size:** small. It could go in with M6's polish.

### Worlds with atmospheres

The largest of the three. It's what would open the living worlds, and so the great powers' homeworlds, to landing.

- **Flight:**
  - **Air density** falls off with height, from the world's pressure, temperature and gravity (a scale height).
  - **Drag** and **lift:** flight assist flies like a plane in air.
  - **Entry heating** grows with the cube of the speed and the square root of the density, so a fast, steep entry
    burns.
  - **Heat:** it feeds the heat gauge (`modules.js`).
  - **Wind:** gusts.
  - **Cost:** all of it is processor work and trivial.
- **Drawing:**

  | Feature | How | Cost on the software renderer |
  |---|---|---|
  | Sky colour and haze | scattering worked out per vertex on a sky dome (a few hundred triangles), and as fog in the terrain's vertex colours | small: no extra fill |
  | Sky per pixel | scattering in the pixel shader | likely a third to a half of the frame rate: WebGL with a graphics card only |
  | Clouds | a translucent layer over the world | one more full-screen blended layer, likely a quarter to a third of the frame rate: graphics cards only. On software, cloud shadows baked into the ground's colour |
  | Oceans | a flat sphere with a highlight; setting down on water is a crash | one more layer near the sea; moderate |
  | Entry glow | a few additive sprites round the ship | small |

- **Content:** surface ports on worlds with air, and the powers' cities on their living homeworlds, a large modelling
  job in `surface.js`'s vocabulary.
- **Steps:**
  1. **A1, thin air:** worlds under about 0.1 bar (Mars-like), with drag and haze, the sky per vertex, no clouds or
     oceans. Large.
  2. **A2, thick air:** entry heat, lift, the full sky, clouds on graphics cards. Large.
  3. **A3, oceans and living worlds:** water, and the powers' surface cities. Large.

### Surface vehicles

- **What:** a small rover, carried in a **vehicle bay** (an internal module, size 2 and up), let down when landed.
  - **It drives** on the terrain's height function: four wheels' contact worked out at 60 Hz in the world's turning
    frame, with gravity, so it can tip over.
  - **Its uses:** reaching a site's structures (L4) without flying, picking up canisters, and sampling deposits.
- **Drawing:**
  - **Up close:** with the camera 2 m above the ground, 50 m tiles look coarse, so two more levels of terrain
    detail near the rover (about 12 m tiles). That's about a quarter more triangles near the camera, within the
    existing budget, which already caps them.
  - **The frame rate** would be as when landed: filling the screen sets it.
  - **The rover's model:** about 400 triangles.
- **Controls and screens:** a driving scheme in the game kit (keys, gamepad, touch), a camera, and a HUD.
- **Size:** large.
- **Whether to build it** is open question 12: L4's flown surveys may already do what a rover would.

## Steps

| Step | What | Depends on | Size |
|---|---|---|---|
| **M6.1** | The Maw and the Core, polished: shadow, photon ring, disc; lensing on WebGL; the Core's sky; chart packs, rich veins, crowded light and heat | | medium |
| **M6.2** | Night lights | | small |
| **M6.3** | `story.js`: state, triggers, mission kinds, the journal, the Steward contact, places, the save; node tests | L4.1 | large |
| **M6.4** | Act I: the Steward, lodestones read, the Riftborn on the near side | M6.3, L4.5 | medium |
| **M6.5** | Act II: the Core chart, the vaults and their sites, patrons and the rival, woken anchorages | M6.4, L4.2 | large |
| **M6.6** | Act III: the tide, holding the anchorages, the Lock, the Echo | M6.5 | large |
| **M6.7** | The endings and after: the settings' effects, the Deep Archive, seasonal tides, news, charted wormholes if wanted | M6.6 | medium |
| **M6.8** | Release (its number is the owner's: open question 8) | M6.1–M6.7 | small |
| A1–A3 | Atmospheres, in three stages | the owner's decision (question 13) | large each |
| V1 | Surface vehicles | L4, the owner's decision (question 12) | large |

- **In parallel:** M6.1 and M6.2 can go any time, even before L4. M6.3 can start once L4.1 is in.

## Risks, and what to do about them

| Risk | What to do |
|---|---|
| The story needs the Rift, which needs a phaser, which needs luck with blueprints | Precursor vaults (L4.5) make Precursor blueprints sure, and question 14's rumour opens the story earlier. |
| An ending the pilot dislikes makes the galaxy worse | Each setting is explained in full before it's chosen, none removes anything (the Rift and the Maw stay open in all), and "Leave it" is allowed. |
| Generated names make the text read oddly | Text is written round placeholders with grammatical forms (the power, its people, its coin), checked over all 12 powers in the tests. |
| Story text in English only, while the menus have nine languages | Through i18n keys from the start (question 7), so it can be translated later. |
| Core flying is too punishing | The Steward's chart, chart packs and woken anchorages; the numbers are constants for playtests. |
| The tide spoils the Hearth for pilots who don't want the story | It begins only with Act III, which needs the pilot's own acts (two bearings found). |
| A lost fight with the rival feels like losing the story | A lost bearing waits at the rival's flagship until taken back; nothing is lost for good. |

## Open questions for the owner

1. **The ending.** (a) One fixed ending (Seal). (b) The choice above (Seal, Bind, Give, or leave it).
   **Recommended: (b).** Every option keeps the Rift open and the game going.
2. **Tides.** Near a black hole, real tides would tear a ship apart well outside the safety distance (about 60 g
   across 10 m at the Maw's three radii, more at small black holes).
   - (a) Leave tides out, as today.
   - (b) Make them felt (strain on a broken canopy, hull stress on big ships) near black holes.
   - **Recommended: (a)**, saying so in the Maw's target card. The safety already keeps ships out of the worst.
3. **Time near the Maw.** A clock held at three radii runs at 0.82.
   - (a) Leave it out.
   - (b) The calendar runs faster outside while you're within 10 radii of the Maw (3 minutes an hour at ten radii, 13 at three).
   - (c) As (b) at every black hole.
   - **Recommended: (b)**, as a touch of the real thing where the story ends.
4. **Havens in the Core.** Today the Core has no ports but a few lone outposts.
   - **Recommended:** two to four Precursor anchorages wake near each vault (6 to 12 in all), as above.
5. **Colonies in the Core** stay forbidden by the colonies plan. Should woken anchorages allow independent
   colonies near them after the ending?
   - **Recommended: no.** The plan's rule stands.
6. **The patrons' rewards.** Should a patron power or faction ever *sell* Precursor work?
   - (a) No: only the help in Act III and the standing.
   - (b) Its capital sells P-grade modules at three times their price after Give.
   - **Recommended: (a).** Precursor work stays earned.
7. **The story's languages.** The starport and flight messages are still in English.
   - (a) English first, with every line an `i18n.js` key, and translations in a following PR.
   - (b) All nine languages at once.
   - **Recommended: (a).**
8. **The release number** for the story.
   - **Recommended:** 0.7.0 for the story, and 1.0.0, out of alpha, when M6 is complete with polish and phones.
     The owner decides.
9. **The Core chart.** It halves misjump chances inside the Core once Act II begins: a change to a built rule
   (56% there).
   - (a) Yes.
   - (b) Only on the story's own routes.
   - (c) No.
   - **Recommended: (a).** The Core stays the hardest flying, but becomes a place to work in.
10. **The Echo's strength.** It copies the player's ship.
    - (a) At the Riftborn's full three times.
    - (b) One and a half times.
    - (c) Equal.
    - **Recommended: (b).** Three times a pilot's own ship would mean only Precursor ships could finish the story.
11. **Charted wormholes** after the story. Built: a black hole phases to a random star.
    - (a) Keep that.
    - (b) With the Steward's chart, the Core's black holes lead to fixed, seeded stars.
    - **Recommended: (b), in the Core only.**
12. **Surface vehicles:** build them, or not?
    - **Recommended:** decide after playing L4. If the flown surveys work, leave vehicles out.
13. **Atmospheres:** whether to start, and with what.
    - **Recommended:** if at all, A1 (thin air) first, with no clouds or oceans on the software renderer.
14. **When the story can begin.**
    - (a) Only after the first crossing into the Rift, as above.
    - (b) Also from a rumour earlier (a cartographer's tale at any halo once the pilot has a phaser).
    - **Recommended: (b)** for the rumour only. The missions still begin in the Rift.

**The owner's earlier open questions this plan touches** (not decided here):
- **The name** (`plan-ember-reach.md`): the story names no galaxy, so "Ember Reach" can change freely.
- **Game time** ("how long a season feels"): the tide, the Deep Archive and question 3 run on seasons and the
  calendar.
- **Multiplayer:** the story is each save's own. A shared tide would be a later, optional service, like shared fronts.
- **The great powers' names:** patrons speak through them, so hand-written names would show most in the story.
- **The great powers colonising** (`plan-ember-reach-colonies.md`): question 5 keeps the Core closed either way.

## Sources

- The Maw's physics:
  - [Schwarzschild radius](https://en.wikipedia.org/wiki/Schwarzschild_radius) (about 2.95 km a sun);
  - [innermost stable circular orbit](https://en.wikipedia.org/wiki/Innermost_stable_circular_orbit) (three
    radii);
  - [photon sphere](https://en.wikipedia.org/wiki/Photon_sphere) (1.5 radii, and the shadow seen at about 2.6);
  - [gravitational time dilation](https://en.wikipedia.org/wiki/Gravitational_time_dilation) (the rate
    √(1 − r_s / r));
  - [tidal disruption events](https://en.wikipedia.org/wiki/Tidal_disruption_event).
- Entry heating, with the speed cubed and the square root of density:
  [atmospheric entry](https://en.wikipedia.org/wiki/Atmospheric_entry).
- Per-vertex sky scattering: [GPU Gems 2, chapter 16, "Accurate Atmospheric
  Scattering"](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering).
- The figures in "Measured on 0.5.0's code" come from running `galaxy.js` in node over every star within 2.4 pc of
  the centre; the software renderer's frame rates are the landing work plan's (0.2.6).
- The earlier plans: [plan-ember-reach.md](plan-ember-reach.md),
  [plan-ember-reach-landing.md](plan-ember-reach-landing.md),
  [plan-ember-reach-landing-work.md](plan-ember-reach-landing-work.md),
  [plan-ember-reach-colonies.md](plan-ember-reach-colonies.md) and
  [plan-ember-reach-sites.md](plan-ember-reach-sites.md).
