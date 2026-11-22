# Ember Reach: the Core and its story (M6), and landing's "Later"

The detailed plan for M6's **Core and its story**, in the style of `plan-ember-reach-landing-work.md`, and an outline of
the landing plan's "Later" items (atmospheres, surface vehicles, night lights) with what each would cost on the
software renderer. Part of [plan-ember-reach.md](plan-ember-reach.md). It builds on the sites plan
([plan-ember-reach-sites.md](plan-ember-reach-sites.md), L4), whose Precursor vaults hold the story's first clues.

M6 in the main plan is "the Core, the black hole, polish; phones (1.6.0)". Phones are being done as their own work
(Ember Reach 0.5.3, touch and small screens) and aren't planned here.

## What the plans already fix

- **The Core** (`galaxy.js` `REGIONS`): inside 2.4 pc of the centre (30 pc before the 0.2.0 scale), about 105,000
  of the galaxy's 4 million stars, a few thousand AU apart. The main plan calls it "the endgame: the richest
  resources and the most ruins, from an earlier era when the centre may have been calmer. The most dangerous
  flying."
  - **As built:** misjumps about 56% of the time (`travel.js`, by stars within 0.05 pc of the target); sterile
    (close passes leave nothing alive); metal-rich ([Fe/H] +0.15 at the centre); no colonies (`colonies.js`:
    "Nothing can be built in the Core"); ruins at the same rate as everywhere (the "most ruins" isn't built).
  - The Hearth's six powers are just outside it, 5.6 pc from the centre: the nearest anyone lives to the Maw.
- **Black holes are wormholes** (`plan-ember-reach.md`, "Black holes are wormholes"): with an alien dimensional
  phaser, J within 2,500 km phases to a random star, drawn by the galaxy's density (most often towards the centre).
- **The Maw** (`id: heart`): the central black hole, about 2,500 suns, its horizon about 7,400 km across. The safety
  holds three horizon radii off; the phaser works within 1.25 times that. Riftborn slip through on half of visits.
- **The Rift, as built** (`plan-ember-reach.md`, "The Rift"): two million stars, the galaxy turned over and drawn in
  to 75%, its worlds drawn afresh, nothing alive; nullite, voidglass, aetherium and Precursor Relics; Precursor ruins
  in one system in ten with a rocky world; about 1,600 Precursor anchorages that "run themselves: nobody aboard"
  (`travel.js`), one at its Maw, where the **Interstellar Marshals** keep the way home; the **Riftborn**, crewing
  copies of the living's hulls, three times as tough; **Precursor work** (grade P, four hulls, the needle and the
  lance), built from blueprints by artifact brokers on this side.
- **The Marshals** (0.2.1): a neutral galactic police force, the Maw's Rift-side guards.
- **The great powers** (12, generated, in two clusters), small factions (nomads, syndicates, prospector guilds, free
  ports), wars on fronts, reputation and commissions.

Nothing in the game yet says **who the Precursors were, why the Rift exists, or what the Riftborn are**. That's
what the story is for.

## Principles

- **Played offline, in one save.** Every step of the story is the player's own: its state is in the save, and the
  galaxy, the wars and the markets carry on round it as they do now.
- **Nothing breaks.** The Maw stays a wormhole to the Rift with a phaser; the Rift stays as built; no existing
  star, ruin, port or save changes. New things (the Core's own ruins, the gate) come from new draws with their own
  seeds.
- **Any origin.** The story works for a pilot of any of the 12 powers: it refers to "your people", "the Hearth's
  powers", the pilot's patron, and the generated names the model gives, filled in when the text is shown.
- **Built from what exists.** Story missions use the mission kinds the game has (survey, stay, kills, deliver, sites,
  constructor deliveries from colonies) so the story is mostly content, not new systems.
- **Nothing is timed against the player.** Story missions don't fail and don't expire; the pressure is in the
  world (incursions, rivals), not a clock.
- **Text only.** Voices in comms and on starport screens, with no portraits and no drawn characters (the
  repository's content rules). The Precursors are never shown, only their work.
- **Your own words.** The story below is written for Ember Reach, not drawn from any other game's plot.

## The story

### The idea

Long before any of today's peoples, the centre of the galaxy was calmer: fewer stars had fallen inward, and worlds
there could keep their climates. The **Precursors** lived in the Core in that Calm Era. When they saw the crowding
coming (stars falling in, close passes stripping worlds), they built a **gate** round the central black hole and
folded through it a refuge: a copy of the galaxy, turned over, where their worlds would be safe. That copy is the
Rift.

It didn't work as they meant. The fold copied the stars but not life: the refuge came out empty. The Precursors
crossed anyway, and kept themselves in the only form the Rift would hold: the minds of their **anchorages**, the
automated docks that "run themselves, with nobody aboard". The gate's **keel stones**, which held the fold steady,
stayed behind in their Calm-Era cities in the Core, and those cities fell.

Since then the Rift has done the one thing it was built to do: copy what crosses. Every ship that goes through the
Maw leaves an echo behind it in the Rift, crewed by nothing, and the echoes try to come back the way the ship came.
Those are the **Riftborn**. As the gate weakens, more of them get through.

The player, the first of the living to read the Precursors' record, can steady the gate, seal it against the
echoes, or open it wide.

### What the player sees

- **Act I, Echoes** (in the Rift): the record, the archives, your own echo.
- **Act II, The Watch** (at home): the Riftborn come through the Maw more often; the powers notice; you choose whom
  to tell.
- **Act III, The Calm Era** (in the Core): the Precursors' homeland ruins, the keel stones, a rival who wants them.
- **Act IV, The Gate** (at the Maw): the gate rebuilt, and the choice.
- **After:** the galaxy goes on, changed by the choice.

### Act I: Echoes

**How it starts:** surveying a Precursor vault in full (L4.4, `plan-ember-reach-sites.md`) gives its record: the
first **fragment** of the Precursor record. The message: "The vault's record is in no language your decoder knows.
The anchorages might read it." (Pilots without L4 sites done can also start it at their first crossing: an
anchorage hails them once with a line of the record.)

| Mission | What | Done by |
|---|---|---|
| **1. The archive wakes** | bring a fragment to any Precursor anchorage | docking there: the anchorage's screens gain an **Archive** contact, which reads it ("...the fold holds while the keel holds...") |
| **2. Three voices** | find two more fragments (vaults, or outliers' records: 1 in 3 of them hold one) | surveys (L4 sites); the archive reads each |
| **3. Your echo** | the archive warns that the Rift has copied your ship: a Riftborn of your hull, with your fit, now hunts in the Rift | destroying it (it's placed in a seeded Rift system within 20 pc of where you are, on the map from the archive) |
| **4. The way home** | report at the Maw's anchorage; the Marshals have been counting the echoes that slip through | docking at the Rift's Maw anchorage |

After Act I, the archive is open at every anchorage, and each reads what you've found so far (the story so far, as
a log).

### Act II: The Watch

**How it starts:** Act I done (or, for a pilot who never crosses, Friendly with a Hearth power and 10 Riftborn
destroyed at the Maw on this side: the Hearth's war offices ask what you know).

- **Incursions rise.** From Act II's start, the Riftborn who slip through at the Maw (half of visits today) come
  three times out of four, a wing larger; once a season, a **breach**: a Riftborn wing appears in a random Hearth
  system (or a Glow system within 4 pc of the Maw), and its powers' patrols fight it. This is the world's pressure,
  and it's capped: it never grows past this until the story moves on.

| Mission | What | Done by |
|---|---|---|
| **5. Maw watch** | the Hearth's powers (or the Marshals) ask you to hold the Maw: destroy 12 Riftborn there | kills at the Maw, this side (repeatable for pay after the story) |
| **6. Breach** | a breach in a Hearth system: drive it off | kills in that system |
| **7. Whom to tell** | three ask for the record: a great power you're Friendly with (its war office), the Marshals (at any of their guards), and a syndicate (its dreadnought, through a hail) | choosing one: your **patron** (`P.story.patron`) |

**The patron** decides who helps in Act III and who becomes the rival:
- **A great power:** its navy escorts you in the Core (a wing at your first Core arrival each visit), its yards build
  the gate's parts at cost; its enemies send the rival. Reputation with it +200, its enemies −100.
- **The Marshals:** neutral; no escorts, but they stop the Marshals' hunt for you (a wanted pilot is forgiven once)
  and lend their tractor beams at the gate; the rival is a syndicate.
- **A syndicate:** pays well (a fee in SU through free traders), opens its black markets everywhere, and the rival
  is the Marshals themselves (they come for the record: a Marshals' wing in the Core). A dark choice, kept possible.

### Act III: The Calm Era

**How it starts:** a patron chosen. The archive now reads the keel stones' places: "the cities where the keel was
cut".

- **The Core's own ruins** (new, C2 below): a separate draw, so no existing ruin moves. About one Core system in
  25 holds a **Calm-Era ruin**: the Precursors' homeland, in the Precursors' style but fallen and weathered (the
  Rift's are still standing). They're sites as in L4: hearts and outliers, survey points, defences (old Precursor
  pylons, a third as strong as the Rift's), unstable ground (twice as often: close passes have shaken the Core's
  worlds). Three of them, seeded from the galaxy (the same in every save), hold the **keel stones**.
- **Flying the Core** (C2): misjumps as built (56%); **Core charts** make it bearable (below).

| Mission | What | Done by |
|---|---|---|
| **8. The first city** | the archive names a Calm-Era ruin within 1 pc of the Maw | surveying its heart in full |
| **9. Keel stones** | three keel stones, in three cities the first city's record names (a stone is 1 t, a story good: it can't be sold, dropped or lost with the ship; the insurer gives it back) | surveying each city's heart; the stone rises as a canister to scoop |
| **10. The rival** | the rival (by patron) is after the stones too: at the second and third cities a rival wing waits, and once a rival steals a stone (if you lose the fight there), it's taken back from their flagship | combat; the flagship is placed in a seeded Glow system |

### Act IV: The Gate

**How it starts:** three keel stones aboard.

- **The gate shows itself.** Arriving at the Maw with the stones, the gate appears: a broken ring of segments in
  orbit at four horizon radii, drawn in code (C6), dark until mended. It was always there; it shows only to a ship
  carrying the stones (a story flag, so the Maw is unchanged for everyone else).
- **Mending it is a construction**, as a colony's primary port is (`colonies.js`: a constructor at the site, goods
  handed over within 3 km under 60 m/s, haulers on contract):

  | Goods | Tonnes |
  |---|---|
  | Nullite | 400 |
  | Voidglass | 200 |
  | Aetherium | 300 |
  | Precursor Relics | 40 |
  | Titanium | 600 |
  | Electronics | 300 |

  The Rift's goods must be brought from the Rift (haulers won't go there; a rented carrier can stage at the Maw on
  this side). The patron's help: a power's yards cut the titanium and electronics needs by half; the Marshals' tugs
  halve the hauling days; a syndicate sells Rift goods at its black markets at +40%. No time limit.

| Mission | What | Done by |
|---|---|---|
| **11. The keel** | set the three stones in the ring | N within 3 km of each of three marked segments (they glow when set) |
| **12. The gate** | the construction above | goods delivered |
| **13. The choice** | at the mended gate, the archive's last reading, then a choice of three | a screen with the three, each explained in full before choosing |

### The choice, and what continues after it

The choice is made once per save. The galaxy goes on after it: the wars, markets, colonies, the Rift and the Core
are all still there to play. What each does:

| | **Steady the gate** | **Seal it against the echoes** | **Open it wide** |
|---|---|---|---|
| What it means | the fold held as the Precursors meant | the gate lets the living cross and nothing back | the fold opened as far as it goes |
| The Maw | a wormhole to the Rift with a phaser, as now | as now | as now; and other black holes in the Core lead to the Rift too (with a phaser) |
| Riftborn at the Maw, this side | back to today's half of visits, and no breaches | none (and no breaches) | three visits in four, breaches every season in the Hearth and the Glow |
| In the Rift | as now | Riftborn a fifth more common (they can't leave) | as now |
| The anchorages | wake: each builds Precursor work from your blueprints (no broker needed), and sells fuel at half price | stay asleep; the archive closes | wake and open shipyards: each sells one Precursor hull (by seed), at its value, in SU |
| Factions | the patron +300; every Hearth power +100 | the Marshals +300 and they keep the Maw on this side too; powers +100 | syndicates +300 and their markets carry Precursor work; the Hearth's powers −200 |
| What's left to do | the deep record (below) | the Long Watch's echoes trapped in the Rift (hunts for pay) | the Long Watch (breaches to fight, forever), Rift shipyards |

**After any ending:**
- **The Long Watch:** repeatable Maw-watch and breach contracts (with Opening, breaches; with Sealing, trapped echoes
  in the Rift; with Steadying, rare stragglers), paid by the Hearth's powers or the Marshals.
- **The deep record:** with Steadying, the archive reads the rest of the record: rumours of the last Calm-Era cities
  (about 1 in 25 Core systems, most unsurveyed) and of the farthest anchorages (the Rift's 1,600), each with a
  Precursor blueprint the first time. Collecting all four Precursor hulls' blueprints completes the record.
- **The log** keeps the story as it was played; the patron, the choice and the day it was made are on the pilot's
  Status screen.

## The Core as a place (polish)

The story sends pilots into the Core; it should be a place worth the trouble.

- **Core charts.** The sweep (8 s on arrival) already charts a system. In the Core, a charted system can't be
  misjumped *away from*: a jump whose target you've charted has its misjump chance cut by three quarters (56% to 14%).
  Nomad carriers and prospector guilds in the Glow sell **chart packs** (the Core's systems within 0.5 pc of a point,
  charted for you, 5,000 SU), so a pilot can buy their way in or chart it themselves. Kept in `P.explore` as charts.
- **Core ruins** (above): a separate draw (`coreRuins:` + star id), about one Core system in 25, so the Core does
  have "the most ruins" without moving any existing one.
- **Rich veins:** in the Core, rings and belts take an extra hotspot draw (its own seed), so about half of the Core's
  rings have one (a third elsewhere); existing hotspots don't move.
- **The sky:** the Core's sky is the brightest in the game (the integrated light fills half the sky in the Glow
  already). In the Core, neighbouring stars a few thousand AU away are drawn as small discs, not points, when they're
  under 0.02 pc away, so the crowding can be seen.
- **The heat of the Core:** in Core systems, the heat gauge rises slowly in open space (a twentieth of a laser's heat,
  so it never cooks a ship but lasers run hotter): the crowded light. Starting values for playtests.
- **Close passes:** a Core system is sometimes mid-pass: a neighbour star a few hundred AU off, its light on the far
  side of every world (a second light in `render.js`'s shader: one more uniform and term, as the spotlight is). Once
  a season in a tenth of Core systems, seeded.

## The Maw and the black holes (polish)

- **The Maw's look.** Today it's a dark disc in a ring of glowing accretion. Better, and still cheap:
  - a **photon ring**: a thin bright ring at the black hole's photon sphere (1.5 Schwarzschild radii), drawn as one
    ring mesh facing the camera;
  - a **shadow** about 2.6 Schwarzschild radii in radius, the dark disc sized to it;
  - the accretion disc tilted, brighter on the side coming towards the viewer (a colour ramp across the disc's
    mesh by its velocity toward the camera, done per vertex);
  - true **lensing** of the sky behind (bending the starfield) is a full-screen effect: on a graphics card only, as
    a setting, never on the software renderer.
- **Approaching the Maw:** the safety holds three horizon radii off (about 11,000 km). Inside 20 horizon radii,
  time on the HUD's clock runs slow against the calendar (a readout only: the calendar doesn't change) and the
  ship's sensors show the gate's segments once the story reveals them.
- **Other black holes:** each is drawn the same way, scaled. Their wormholes stay random (the owner may want them
  otherwise: see the open questions).

## What the save keeps

- `P.story`: `{act, step, flags (bitmask: fragments, echo destroyed, stones set...), patron, choice, day of each act,
  log: [step, day]}`: under 200 bytes.
- Story goods (keel stones) in the hold, flagged as unsellable; the insurer restores them.
- Core charts in `P.explore.sys` as today; chart packs add to it (trimmed last, since they're bought).
- The gate's construction as a colony-like build record (`P.gate`: goods delivered).
- **Version:** the save's version rises once; older saves start with no story, at Act I's trigger.

## Tests

**Node** (`tests/emberreach_story_t.js`, `tests/emberreach_core_t.js`):
1. Nothing moves: stars, ruins, ports, anchorages and hotspots outside the Core are unchanged with the story and
   Core draws loaded; inside the Core, only new draws are added.
2. The story's state machine: every step's trigger, in order and only in order; no step can fail or expire; a save
   round trip at every step.
3. Any origin: every one of the 12 powers can reach every act (the patron rules, the Hearth's war offices, the
   fallback start of Act II).
4. Incursions: today's odds before Act II; the raised odds and the seasonal breach after; each ending's odds.
5. The echo: placed in a seeded Rift system within 20 pc; carries the pilot's hull and fit at Riftborn strength.
6. Core ruins: about 1 in 25 Core systems; three hold keel stones, the same in every save; they're L4 sites.
7. Core charts: a charted target's misjump chance at a quarter; chart packs add charts.
8. The gate: invisible without the stones; the construction's goods and the patron's help; the three choices'
   effects, each applied once.
9. Keel stones: unsellable, restored by the insurer, taken back from a rival's flagship.
10. Speed: the story's step check under 0.1 ms a frame; a Core system's extra draws under 1 ms.

**Browser:** an act's missions played from a prepared save (each act from its own save, so the test stays short):
the archive reading a fragment, the echo fought, a Core ruin's stone scooped, a gate segment set, and the choice
screen.

## Steps

| Step | What | Depends on | Size |
|---|---|---|---|
| **C1** the story engine | `story.js`: acts, steps, triggers, flags, the log, mission adapters onto existing kinds, `P.story`; no content | none | medium |
| **C2** the Core as a place | Core charts, chart packs, Core ruins (as L4 sites), rich veins, the sky's discs, Core heat, close passes | L4.2, L4.3 (sites) | medium |
| **C3** Act I | fragments from vaults, the Archive contact at anchorages, your echo, the Maw anchorage's report | C1, L4.4 | medium |
| **C4** Act II | incursions and breaches, Maw watch, the patron choice | C1 (C3 for the usual start) | medium |
| **C5** Act III | the first city, keel stones, the rival by patron | C2, C4 | large |
| **C6** Act IV | the gate's model, its reveal, the construction (from `colonies.js`), the choice and its effects | C5 | large |
| **C7** after the end | the Long Watch, the deep record, each ending's lasting effects on encounters and anchorages | C6 | medium |
| **C8** the Maw and black holes | photon ring, shadow, the tilted disc, the slow clock, lensing on graphics cards | none (any time) | medium |
| **C9** release | store description, plan notes, the full suite and the playthrough | C1–C8 | small |

- **In parallel:** C1 and C8 can start at any time; C2 once L4's sites are in; C3 needs L4.4.
- **Versions** (a proposal): each step a patch after L4's release, and the story done as **0.7.0, the Core**.

## Risks, and what to do about them

| Risk | What to do |
|---|---|
| The story needs the Rift, which needs a phaser, which needs luck with blueprints | Act II has a start that needs no crossing; vaults (L4) make Precursor blueprints sure; the phaser's blueprint is in ruin hearts 20% of the time. |
| A pilot's world gets worse after an ending they didn't like | Each choice is explained in full before it's made, and none removes anything (the Rift and the Maw stay open in all three). |
| Generated names make the story's text read oddly | Text is written round placeholders with grammatical forms (the power, its people, its currency), checked over all 12 powers in test 3. |
| Story text in English only, while the menus have nine languages | The starport and flight messages are English-only today; the story follows them and uses i18n keys so it can be translated later (an open question). |
| Core flying is too punishing | Core charts and chart packs; the numbers are constants for playtests. |
| Incursions spoil the Hearth for pilots who don't want the story | They rise only after Act II starts, which needs the player's own act (a vault's record, a crossing, or Maw kills). |

## Later: landing's last items, outlined

The landing plan's "Later" list, with what each would cost. **The software renderer** is the release test machine's
software-rendered Chromium, the Vivobook's Lite desktop class. What's known from L1 to L3 (`plan-ember-reach-landing-
work.md`): it's **fill-bound** (the JavaScript takes almost none of the time; antialiasing was most of the cost);
docked 60 fps, idle in space 60, combat 30–38, 1 km over a moon 31 at half resolution with the terrain at 38% of its
budget; and a plain sphere filling the screen ran at 10.5 fps before the fixes. So **every extra full-screen pass
costs about as much as the terrain itself**, while extra vertices and shader terms are cheap.

### Night lights on dark sides (small)

- **What:** inhabited worlds' night sides glow with their cities, seen from orbit: brighter where more people live
  (the population formula, 0.3.6), clustered round ports and colonies, none on wild worlds.
- **How:** a per-vertex emissive term in the planet's mesh (`meshes.js` `planet`), from a noise mask seeded by the
  world and scaled by its population, shown only on the night side (the shader's existing light direction). On
  terrain tiles, only at port sites (their windows glow already).
- **Cost on the software renderer: nothing measurable.** No new pass and no texture: one more vertex colour and a
  multiply in a shader that already runs. The detail is the planet mesh's (High or Low).
- **Ties:** colonies light up as they grow; Opening the gate in the Core story could darken the Hearth's frontier
  worlds (a touch for later).

### Surface vehicles (medium to large)

- **What:** a small rover carried in a **vehicle bay** (a new internal module, size 2 and up, one rover a size), let
  down on the ground from a landed ship and driven: to sites' survey points (L4) instead of hopping the ship, under
  turrets' guns, onto unstable ground the ship can't sit on, to scoop canisters from the ground with its own small
  hatch (2 t), and to deposits.
- **How:**
  - **Physics:** four raycast wheels on `h(world, dir)`, springs and grip, gravity from `gravityAt`, in the world's
    turning frame as ships are; a tip-over at too steep a slope; damage from falls through a rover-sized
    `touchdown`. Cheap on the CPU.
  - **Terrain:** the eye is 2 m up instead of hundreds of metres, so the quadtree must split two more levels near the
    rover (tiles down to about 12 m). That's about 8,000 to 15,000 more triangles near the ground, inside the
    60,000 (30,000 low) budget if the far tiles coarsen to pay for it.
  - **The rover's model:** one small mesh (under 600 triangles), headlights from the spotlights' code.
  - **Controls:** the flight controls mapped to driving (throttle, steering on roll, a handbrake), a key and radial
    item to deploy and recall; the touch layout from 0.5.3.
- **Cost on the software renderer:** the ground fills the whole screen from 2 m up, as landed today (31 fps at half
  resolution); the extra near tiles add vertices, not fill. **Expected to hold about 30 fps with automatic
  resolution**, as landed does. Sky above the horizon is cheap (it's the clear colour on an airless world).
- **Ties:** L4 sites (survey points by rover), the Core's unstable ground, colonies (a rover at a colony's surface
  mines), and later atmospheres (rovers on worlds with air are where it's cheapest to go first).

### Worlds with atmospheres (large; the biggest)

- **What:** landing on worlds with air: about as much solid ground again as airless worlds give (in a scratch count,
  2,311 solid worlds with air between 30 and 700 K under 2.5 g, against 2,368 landable airless ones), and the
  powers' living homeworlds among them.
  - **Entry:** heat from the speed and the air's density (the heat gauge exists, `modules.js`); too fast too low
    cooks the modules, as overheating does now. A **heat shield** isn't needed if the approach is slow; the cruise
    drop above the world comes higher (above the air).
  - **Drag and lift:** flight assist in air: drag by speed squared and the air's density, the main drive against
    it, and lift from the hull's shape kept simple (a lift factor by role: shuttles and fighters glide a little,
    freighters drop). The Newtonian model with FA stays; air adds forces.
  - **Weather:** wind as a slowly turning force field over the world (seeded), stronger aloft; gusts on approach;
    storms on some worlds that close their ports to small ships.
  - **Ports on living worlds:** the homeworlds' cities, the biggest surface ports there are.
- **How it's drawn, and what it costs on the software renderer:**

  | Piece | How | Software renderer cost |
  |---|---|---|
  | Sky colour from the ground | the clear colour by sun height and the air's colour (`meshes.js` `atmosphere`) | nothing (no pass) |
  | Haze on the ground and in the distance | per-vertex fog in the mesh shader (the haze rim exists in space) | small: a few shader terms per pixel already drawn |
  | Clouds as a deck | one cloud mesh at a height, with alpha | **about 30–60% more fill** (a second layer over the screen): off on software, on with a graphics card |
  | Entry glow | a few sprites round the ship | small |
  | Rain or snow | a few hundred lines near the camera | small |
  | Homeworld cities | port meshes (6,000 triangles each) and night lights | as ports: within budget, a few at once |

  So on the software renderer an atmospheric world can hold the landed frame rate **without clouds**; clouds are a
  graphics-card feature.
- **The CPU:** drag and wind are a few terms in `flight.js`'s step; NPCs fly through the same model. Cheap.
- **What it touches:** the proximity safety (it holds ships at 1.12 radii off worlds with air today), `landing.js`
  `landable` (air no longer rules a world out), the ruins' hearts on worlds with air (three ruins in four: they'd
  become sites at last), colonies on living worlds, insurance (a crash in air is a crash), and every test that
  assumes air means "no landing".
- **Order:** last of the three, and in its own stages: sky and fog first, then entry and drag, then ports on worlds
  with air, then weather.

## Open questions for the owner

1. **The story's premise.** Is the idea above (the Precursors' gate, the Rift as an empty refuge, the anchorages as
   their minds, the Riftborn as echoes) the story Ember Reach should tell? Options: (a) as written; (b) the same
   structure with a different premise the owner prefers; (c) no single story: Core and Rift content without a plot.
   **Recommended: (a);** it explains what's already built (the empty Rift, the turned-over stars, the copied hulls,
   the anchorages with nobody aboard) without changing any of it.
2. **One ending or three.** Options: (a) three endings, chosen once per save, as above; (b) one ending (Steadying);
   (c) three, and a way to choose again later. **Recommended: (a).**
3. **The patron choice, including the syndicate.** Options: (a) three patrons (a power, the Marshals, a syndicate);
   (b) powers and the Marshals only. **Recommended: (a);** it fits the game's outlaw axis.
4. **Must the story wait for L4?** Act I starts from a Precursor vault's record (L4.4). Options: (a) yes, build L4
   first; (b) start Act I at a pilot's first crossing instead, so the story can come before L4. **Recommended:
   (a),** with (b) as the fallback start already in the plan.
5. **Core ruins.** The main plan says the Core has "the most ruins". Options: (a) a separate draw of Calm-Era ruins,
   about 1 in 25 Core systems, as above; (b) leave ruins uniform. **Recommended: (a).**
6. **Core charts.** Should charting a Core system cut misjumps to it by three quarters, with chart packs for sale?
   **Recommended: yes;** without it the Core's 56% misjumps make the story's Act III a chore.
7. **Black holes' wormholes.** Keep their random destinations (today), or give each a seeded destination per season
   so they can be mapped? **Recommended: keep them random;** a mapped network would compete with the lanes. (Only
   the "Open" ending adds Rift destinations, in the Core.)
8. **Languages.** Story text in English first (as the starport and flight messages are), with i18n keys, or in all
   nine languages from its release? **Recommended: English first.**
9. **The order of the "Later" items.** Options: (a) night lights, then surface vehicles, then atmospheres; (b)
   atmospheres first (the most ground). **Recommended: (a):** the cheapest first, and vehicles help L4's sites.
10. **Versions.** The story as 0.7.0 after L4's 0.6.0? **Recommended: yes.**

**The owner's earlier open questions this plan touches** (not decided here):
- From the main plan: *the name* ("Ember Reach" is a working title). The story doesn't depend on the name; nothing in
  it is called "the Ember".
- From the main plan: *the great powers' names: generated, or hand-written names and cultures?* The story's text is
  written to work with generated names (risk 3); hand-written powers would make it read better.
- From the main plan: *game time: how long a season feels in play.* Breaches come once a season.
- From the main plan: *multiplayer: shared fronts and discoveries.* The story's state is per save; a shared galaxy
  would need the gate's state shared too, or the story kept single-player.
- From the main plan: *whether the WOS "rich galaxy" mix should be an option.* Not touched by the story, but Core
  ruins and rich veins are added on top of whichever mix is chosen.

## Sources

Written from the existing plans and the code on main; the Core's star count is `galaxy.js`'s `massInside` at the
Core's edge, and the atmosphere count a scratch script against `galaxy.js` (not committed). Physics:
[Photon sphere](https://en.wikipedia.org/wiki/Photon_sphere) (the photon ring at 1.5 Schwarzschild radii),
[Gravitational lens](https://en.wikipedia.org/wiki/Gravitational_lens). The story is the plan's own.
