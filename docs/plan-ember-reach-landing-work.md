# Ember Reach: building the landing additions

The work plan for `plan-ember-reach-landing.md`. That document says what landing *is*; this one says how to
build it: in which order, in which files, in pull requests of a reviewable size, each with its tests and what
counts as done.

## Where things stand (main, after #38)

**Already in the game**
- Real years, months and days; worlds turning in real time (`galaxy.js` `spin`, `scene.js` `turnOf`).
- Gravity below each world's Kármán line, with flight assist holding against it (`scene.js` `gravityAt` and
  `gravityWell`, `flight.js` `s.grav`).
- A GRAVITY readout on the HUD.
- Ship insurance, so a crash has somewhere to go (`insurance.js`).
- Docking clearance at space ports: N to request, a pad number, revoked after 5 minutes unused (`play.js`
  `requestDock`).
- The proximity safety holding ships 300 m off airless ground (`scene.js` `SAFE.ground`).

**Drafted, outside the game** (then `wip/emberreach-surface/surface.js`; in the game from L2.2)
- Landability and per-ship lift.
- Touchdown rules.
- Port kinds and placement, seeded layouts and meshes.

**Not there yet**
- Contact with the ground.
- Terrain.
- A frame that turns with a world.
- Landing gear.
- Surface ports in the game.
- More than one port per system.

## Principles

- **Small PRs, each playable.** Every step leaves the game working and is tested. Nothing goes in half-wired
  behind a flag except where noted.
- **One height function.** The terrain's height `h(world, direction)` is one pure function. Rendering,
  collisions, the safety, the altitude readout and port sites all use it, so what's drawn is what's hit.
- **Nothing else moves.** New draws use their own seeds. No star, world, capital, port or saved game changes
  because of this work. Saves move to version 4 once, in L2, with older saves migrated.
- **Budgets.**
  - Terrain: at most 60,000 triangles on screen (30,000 on low quality), and at most 2 ms of building per
    frame.
  - The release's test machine, a software-rendered Chromium, has to hold 30 fps while landed.
- **Controls.** Every letter key is taken, and every key can be rebound in Settings (since the settings menu).
  - **Space / Left Shift** are already strafe up / down. They become the vertical thrusters.
  - **R / F** stay the throttle.
  - The **gear** is on **L**, and on the gamepad's **A held for half a second**. A short press of A still asks
    for docking (A is no longer a rebindable docking key: `play.js` `padA`). Fire is on **;** by default.
  - The gamepad's **d-pad** strafes; its up and down are the vertical thrusters.

## L1: landing anywhere

Six PRs. When they're done, a pilot can fly down to any landable world, set down on open ground, scan it and
take off again, in any ship.

### L1.1 The world's frame and the surface readout

**Done** (0.2.2): `landing.js` (the rules, which the draft now takes from the game), `scene.js` `worldFrame`,
`heightAt` (0 until L1.3) and `surfaceState`, flight in the world's frame below its line, the HUD's surface panel and
the target card's landability. Tested in `tests/emberreach_landing_t.js` (14 checks) and the browser test's 9d.

The groundwork: knowing where the ground is and moving with it.

- **Bring the rules into the game.** Move `landable`, `canLand`, `lift`, `maxG`, `padFor` and `touchdown`
  from `wip/emberreach-surface/surface.js` into a new **`landing.js`** in the game. The layouts and models
  stay in `wip/` until L2.
- **A world's frame** (`scene.js` `worldFrame(b)`). Below a world's Kármán line, flight runs relative to
  the world as it turns: the frame's centre is the world's, and its spin is `axis × 2π / day`. It works
  just like a station's spinning frame (`flight.js` `frameAt` already takes `{c, v, w}`).
  - `frameNear()` in `play.js` returns the station's frame near a station, the world's frame below a
    Kármán line, and nothing otherwise.
  - Flight assist's held velocity becomes relative to the ground, so a hovering ship stays over the same
    spot as the world turns.
- **The surface state** (`scene.js` `surfaceState(scene, s)`) gives, for the nearest world whose line
  you're below:
  - altitude above the terrain;
  - vertical speed;
  - ground speed;
  - pitch and bank against the local horizon;
  - latitude and longitude;
  - whether the world can be landed on, and by this ship.

  Until L1.3 the terrain is the smooth sphere (`h = 0`).
- **HUD** (`hud.js`). Below 30 km, a **surface panel** replaces the speed panel:
  - an altitude tape;
  - vertical speed (an arrow, red when it's past the touchdown limit for this ship's pad size);
  - ground speed;
  - a horizon line with a pitch ladder.

  The GRAVITY line stays.
- **Targeting a world** shows its landability on the target card: "Landable · 0.30 g · lift 9.4 g", or
  why not (an atmosphere, molten, too heavy for this ship).
- **Tests** (node), in a new `tests/emberreach_landing_t.js`:
  - the rules carried over from the surface tests;
  - a world's frame turning once a day;
  - a hovering ship staying over its spot for a minute of a fast-turning world;
  - the surface state's numbers on a known setup.

**Done when:** below a world's line, the HUD reads altitude and vertical speed, and a hovering ship with
flight assist holds its spot over the turning ground.

### L1.2 Landing gear, touchdown and crashes

**Done** (0.2.3): the gear (a module that can break), the safety letting go over landable ground with the gear down,
contact (`landing.js` `lowest`, `contact`), hard landings and crashes, the landed state (`scene.js` `landAt`,
`pinLanded`), lift-off, and the landed place in saves. The sounds reuse the game's existing cues (the hatch's motor
for the gear, a collision's thud scaled by the impact) rather than new ones. Tested in
`tests/emberreach_landing_t.js` (23 checks in all) and the browser test's 9e and 9f.

The ground becomes solid.

- **Gear** (`play.js`, state `game.gear`):
  - It goes down by itself under 300 m above the terrain and comes up above 500 m. L (or A held)
    toggles it.
  - With the gear down, top speed is capped at 100 m/s.
  - The gear has a damage state like other modules (`modules.js`). If it's broken, every touchdown counts
    as a belly landing.
- **The safety changes:**
  - With the gear **up**, airless ground is still held off at 300 m.
  - With the gear **down**, the safety lets go, and contact decides.
  - Atmospheres, stars and black holes are unchanged.
- **Contact.** Each step, the ship's lowest point is compared with the terrain's height under it. That
  point is the gear when down, the belly when up, and the nose when pitched past 45°.
  - On first contact, `touchdown(size, vz, vh, tilt)` decides the outcome:
    - a clean landing;
    - a hard landing: hull damage of 15% × excess², through the existing `damage()`, with a thud and
      camera shake;
    - a crash: `lost('a crash on ' + world)`, so insurance takes over.
  - Touching with anything but the gear counts as three times past the limits.
- **Landed** (`game.landed = {world, lat, lon, heading}`):
  - The ship is fixed to the ground and turns with the world.
  - Throttle, strafe and pitch do nothing until lift-off.
  - The status line reads LANDED.
- **Lift-off:**
  - Space (vertical thrust), or throttling up past 10%, lifts the ship off.
  - The gear retracts above 500 m.
  - Above the Kármán line, flight returns to space's frame.
- **The save** gains `landed` (version 3 still loads, with no landing). A saved landed ship reloads sitting
  where it was, at its latitude and longitude.
- **Sound** (`sound.js`): gear motor, touchdown (scaled by impact), the hiss of the vertical thrusters, and
  a crash.
- **Tests:**
  - **Node:** outcomes at, past, and three times past each limit; a belly landing; a crash calling the
    insurer; the gear speed cap; a landed ship turning with the world and saved and restored.
  - **Browser:** the browser test lands a Dodo on a smooth moon and takes off again.

**Done when:** a pilot can set down gently, damage the ship by setting down hard, crash and wake up under
insurance, and take off again, all on smooth worlds.

### L1.3 Terrain

**Done** (0.2.4): `terrain.js` (the height function, craters in thirteen sizes from a few hundred km across down to
tens of metres, plains on large worlds, flats for L2, and the cube-sphere tiles), collisions, the safety, NPCs and the
readout on terrain, tiles drawn in place of the sphere under 200 km (built from 400 km, about 2 ms a frame). Tested in
`tests/emberreach_terrain_t.js` (16 checks) and the browser test's 9g. Differences from the plan:
- **Tiles are 17 × 17 points**, not 33 × 33: at 33 × 33 the budget ran out tens of km up, before the finest tiles.
- **No fade band:** the tiles replace the sphere at 200 km once those in view are built; they're coloured from the
  sphere's own function, so the switch is slight.
- **Not yet:** smooth night sides on tidally locked worlds (the night side isn't known from the world alone), and the
  pixel check along tile seams.
- **Frame rate on the software renderer:** about 10 fps with a world filling the screen, against 37 in space. The
  plain sphere filling the screen is no faster (10.5 fps), so terrain isn't the cost: it's full-screen fill on the
  software renderer (a logarithmic depth written per pixel). A follow-up should look at the depth write and the
  resolution setting before the plan's 30 fps can be met.

**Performance, 0.2.6.** Profiling showed the JavaScript takes almost none of the time on the software renderer:
it's rasterising.
- **Antialiasing** was most of it: off, everything ran about 60% faster. A setting now has it on Auto (the default),
  On or Off. Auto turns it off on a software renderer and leaves it on with a graphics card.
- **Docked:** the view is no longer drawn behind the port's screens.
- **Automatic resolution** (on by default): under 28 fps the resolution steps down to half the screen's at most, and
  then the terrain's triangle budget to a quarter at most. Above 52 fps the terrain detail comes back first, then the
  resolution.
- **The log depth written per pixel** turned out not to matter (no change without it), so it stays.

On the release test machine at 1100 × 720:

| Situation | Before (fps) | After (fps) |
|---|---|---|
| Docked | 12 | 60 (the cap) |
| Space, idle | 42 | 60 |
| Combat, 6 pirates firing | 18 | 30–38 |
| 1 km over a moon | 9 | 31 (half resolution, terrain at 38%) |

Added alongside, at the pilot's request: **forward spotlights** (1) and **night vision** (2), separate functions.
Spotlights need power and light a 20° cone ahead (`render.js`'s mesh shader); night vision needs the sensors, and
amplifies the image to an intensifier's green (every shader). The night side's ambient light now comes from the sky
opposite the sun, so slopes still read there.

The worlds get ground worth landing on.

- **`terrain.js`** holds the height function `h(world, dir)`. It is pure, seeded from the world's name, and
  identical in node and the browser.
  - **Relief** comes from the same `fbm` noise `meshes.js` uses for planet colour, plus seeded **craters**
    (a bowl, a raised rim, a central peak on the big ones), plus mare-like flats on large worlds.
  - **Relief scales with size:** up to about 4 km on a large rocky world and about 1 km on a small moon.
    Icy worlds are smoother; tidally locked worlds are frozen smooth on the night side.
  - **Flats.** A list of levelled discs (for ports, in L2), each with a short ramp. Empty in L1.
  - The world's **colour** at a point comes from the same function as the far sphere's, so tiles and globe
    match.
- **Level of detail** (`terrain.js` and `render.js`):
  - A cube-sphere quadtree: six faces split toward the ship until a tile spans about 50 m at the surface.
  - Only tiles within the horizon distance and in view are built, about 33 × 33 vertices each, with skirts
    to hide cracks.
  - Tiles are uploaded camera-relative, as bodies already are, and built a few per frame within the 2 ms
    budget, nearest first.
  - Far from the ground, the existing sphere mesh draws the world as now. In between, the tiles fade in
    under 200 km.
- **Collisions, the safety and the altitude** all switch from `h = 0` to `h(world, dir)`.
- **Light:**
  - The sun's direction is per tile.
  - The night side is dark, with ambient starlight only.
  - On a tidally locked world, the terminator is where the ports go.
- **Quality setting:** low halves the tile resolution and the horizon distance.
- **Tests:**
  - **Node:** `h` is deterministic and continuous across face edges; the relief bounds hold per world size;
    the flats come out level; a tile's vertices match `h`.
  - **Browser:** landing on terrain; the triangle count stays under budget at 1 km, 10 km and 100 km up; no
    cracks (a pixel check along a tile seam).

**Done when:** a moon looks like a moon from 100 km down to the pad, the ship lands on what's drawn, and the
frame rate holds.

### The world scale (0.2.8)

Systems in flight are built at 1/12 scale, the way Kerbal Space Program shrinks its worlds (`galaxy.js` `WORLD_SCALE`,
`scene.js` `WS`, `TS`):
- **Lengths:** worlds, stars and orbits are 1/12 as wide (an Earth 531 km in radius, its orbit 12.5 million km).
  Surface gravity is the same, so masses are 1/144 and worlds 12 times as dense. Distances between stars are
  unchanged.
- **Times:** they go with the square root, so orbits, days and months run in 1/sqrt(12) of the time (an Earth's year
  105 days).
- **Unchanged:** the galaxy model's own figures (sizes, years, temperatures) stay the real ones, and black holes keep
  their size.
- **Terrain:** relief keeps its full height, so worlds are more rugged for their size, as in KSP. The big basins keep
  their full depth; small craters are sized to their width.
- **Kármán lines:** at the scale (an Earth's 8.3 km), but at least 2 km over a solid world's highest ground (3.4 km on
  the smallest moons, about 13 km on the largest rocky worlds). The cruise drop above a targeted world is 4.2 km at
  least (50 km before).
- **Terrain distance:** tiles are drawn from 0.3 radii up on small worlds (200 km at most), so a port in orbit
  isn't over its ground.
- **Older saves:** they keep their place, scaled down.

Kármán line to the ground at 200 m/s now takes about 20 to 70 s, against 4 to 7 minutes before. Frame rates are
unchanged near the ground on the software renderer (the terrain budget sets the cost there).
Fixed along the way: worlds behind the camera were drawn as full meshes.

### L1.4 The approach

**Done** (0.2.7):
- **The drop:** cruise drops out above a targeted landable world at its Kármán line or 50 km up, whichever is higher
  (`scene.js` `dropRange`).
- **The lock:** a world's surface locks cruise (and jumps) below half a radius up or its Kármán line, whichever is
  lower (`worldLock`); cruising into it is an emergency drop.
- **The ground scan** runs by itself, landed or within 2 km, in 6 s, and again after moving on 2.5 km. It marks the
  world's resources within 5 km as deposits you can target (about six on average; `explore.js` `deposits`). Mining
  them is L3.
- **First landings** are recorded (`explore.js` `landed`); landing data sells for half a survey, 2.5 times that
  outside the powers' charted space.

Tested in `tests/emberreach_landing_t.js` (30 checks in all) and the browser test's 9n and 9o.

Getting there from the rest of the system.

- **Cruise drops above a targeted landable world**, at its Kármán line or 50 km up, whichever is higher,
  instead of at the world's distance for a station.
- **Mass lock:** a world's surface locks cruise below 1.5 radii from its centre, or below its Kármán line,
  whichever is lower. You can't cruise into the ground, and leaving cruise below that is an emergency drop.
- The target card's landability (L1.1) appears from the moment a world is targeted.
- **The ground scan:** landed or within 2 km of the ground, a 6 s scan marks the deposits of the world's
  resources within 5 km, and a first landing on a world counts as a discovery (`explore.js`). Landing data
  sells at the cartographer for half a survey.
- **Tests:** drop points; the mass lock; a first landing recorded and paid.

### L1.5 NPCs, controls and polish

**Done** (0.2.9):
- **NPCs:** below a world's Kármán line, AI ships fly in the world's turning frame with its gravity, as the player
  does. They keep 450 m off the ground (`combat.js` `groundKeep`), lifting on their vertical thrusters, and pull up
  and ease off the throttle when diving, by where they could stop. Pirates chase a landed pilot down to there but
  don't land. The 300 m safety still holds every ship; capital ships can't hover in 1 g and lean on it.
- **Touch:** a VERT slider beside the throttle (vertical thrust, back to the middle when let go), and a GEAR button.
- **Gamepad:** A held half a second moves the gear; a short press asks for docking. The d-pad strafes as before.
- **Help** (H) has paragraphs on landing, touch and the gamepad, in every language.

Tested in `tests/emberreach_landing_t.js` (checks 31 and 32: an AI pilot holding 450 m in 1 g, and pulling out of
a dive) and the browser test's 9p.

- **NPCs** (`combat.js` `think`, `encounters.js`):
  - Ships below a Kármán line fly with their vertical thrusters against gravity, as the player's flight
    assist does.
  - They keep 300 m off the ground unless landing.
  - Pirates may chase a landed player down but don't land themselves in L1.
- **Touch:** a vertical-thrust slider beside the throttle, and a gear button. These are ready for the phone
  layout (Rudolf OS 1.6.0).
- **Gamepad:** vertical thrust on the d-pad's up and down (already strafe up and down), and gear on A held.
- **Help** (H) gets the landing controls, and the plan's control note is corrected.
- **Tests:** the browser test's controls check covers the new keys; an NPC hovering below a line holds
  altitude.

### L1.6 Release 0.3.0

**Done** (0.3.0): the store description and the plan's release notes are updated; the full suite and the browser
test pass on the release test machine (the sandbox's software-rendered Chromium).

- Bump `PKGINFO` to **0.3.0** (0.2.0 went to the smaller galaxy).
- Update the store description: landing on airless worlds, gravity, rotation and insurance.
- Update the plan's "Released" note.
- Run the full suite and the browser test, and do a playthrough on the release test machine.

## L2: surface ports

Seven PRs. When they're done, the ports drawn in `wip/` are in the game: placed on worlds, landed at with
clearance, and docked at like any other port.

### L2.1 Many ports to a system

The refactor everything else waits on. It doesn't change the game's behaviour.

**Done** (0.3.2):
- **`travel.js`:** `portsAt(star, day, colony)` gives the list, with `ORBITAL`, `PORT_ID` (the id pattern) and
  `portById`.
- **`play.js`:** it keeps `game.ports`; `game.port` is still the space port that the scene builds. Docking sets
  `game.portId` and `game.lastPortId`.
- **Insurer:** its respawn candidates and claims carry a `portId`. A colony's port has the id `orbital`.
- **Missions:** war missions carry `port: null`, meaning any port at the star (as munitions deliveries are).
- **Map:** the star card reads from `portsAt`.
- **Saves:** version 4 saves the port docked at (`at`) and the last port's id (`lastPort.port`). A version 3 save
  reads both as `orbital`, and so does a malformed id.
- **Not changed:** haulage jobs go to a colony, not to a port, so they don't carry a port id.

Tested by every existing suite unchanged, plus `tests/emberreach_save_t.js` 8b and the travel test's L2.1 check.

- **`travel.js` `portsAt(star, day)`** returns a list: the space port (if any), then the surface ports.
  - Each has an **id**: `orbital`, or `surface:<world>:<kind>`.
  - `portFor` stays as "the space port", for the callers that mean that.
- **Callers move to port ids:**
  - `game.port`;
  - `P.lastPort`;
  - missions' and contracts' destinations;
  - colonies' ports;
  - haulage jobs;
  - the insurer's respawn candidates;
  - the map's star card.
- **Save version 4.** Port ids are added. A version 3 save reads every port reference as `orbital`.
- **Tests:** every existing suite passes unchanged; a v3 save loads into v4 with the same ports.

### L2.2 Ports placed on worlds

- `surface.js` (layouts and placement) moves from `wip/` into the game, with `ports(star, cls)` feeding
  `portsAt`.
  - Systems with a space port get their surface ports as drafted.
  - Lone outposts and camps appear in 1 system in 25.
- **Sites are levelled.** Each port's flat (radius plus ramp) goes into `terrain.js`'s flats for its world.
- **The map's star card** lists the surface ports. The cartographer and a ground scan reveal lone ones.

**Done** (0.3.3):
- **`surface.js`** is in the game (`www/surface.js`, with `layouts.html` beside it). `portsAt` lists its ports after
  the space port, held by the space port's holder (or the system's; with neither, independent). A colony's system
  gets none yet.
- **The world scale:** a site's radius must be at most 3% of its world's (at 1/12). A world too small for a
  starport and its 4.6 km field gets a settlement instead, and smaller kinds fall back the same way. 11 of the 12
  capitals get a surface starport.
- **Levelling:** on entering a system, each site is levelled into its world's terrain (`surface.js` `level`: the
  site's radius flat, half again of ramp), once per world.
- **The map's star card** has an "On the ground" line.
- **Lone ports** turn up in 3.9% of systems with landable ground and no space port. They're found by a ground scan
  on their world (which says how far away), or from the cartographer's charts on docking (those within 5 pc). The
  record keeps them (`P.explore.found`).

Tested in `tests/emberreach_surface_t.js` 14-17, `tests/emberreach_explore_t.js` 13a, and the browser test's 5b
and 9r.

### L2.3 Port meshes on the ground

- `meshes(layout, detail)` from the draft is uploaded per port, high and low detail like stations, and
  placed at the port's latitude and longitude on its flat, oriented to the local up.
- **Lights** use the emissive channel: pad rings in their size colours (blue S, amber M, red L, violet XL,
  rose capital), window bands, beacon blinks. Night-side ports glow.
- **Budget:** at most 6,000 triangles per port at high detail.
- Ports more than 50 km away aren't drawn: the world's sphere stands in for them.
- **Tests:** meshes within budget for every kind; a port sits on level ground in a browser screenshot check.

**Done** (0.3.4):
- **Models:** each surface port's model stands on its levelled site, upright to the local up, turning with its world
  (`play.js` `surfacePortAt`). It's drawn within 50 km, in full detail within 8 km, and uploaded when first near and
  dropped on leaving the system. Every kind keeps within 6,000 triangles in full detail; windows, lights and the
  pads' coloured rings glow at night.
- **Level ground:** a site's disc now stays level where a neighbour's ramp reaches into it (a starport and its
  field 8 km apart): `terrain.js` applies the ramps first, then the discs.
- **Not yet:** the beacons' blink and the landing itself (L2.5).

Tested in `tests/emberreach_surface_t.js` 18-19 and the browser test's 9s.

### L2.4 The traffic controller, pads and docking

- **One traffic controller** for space and surface ports (`traffic.js`), taking over `requestDock`:
  - **Request:** N within 10 km of a port, space or surface.
  - **Refusals:**
    - wanted here;
    - at war with the holder;
    - no free pad for this size;
    - a language the port's controller doesn't speak (the existing language lock).
  - **Acceptance:** a pad of the ship's own class (XS uses S; capital ships go to the heavy field's berth),
    or failing that a larger one; never a smaller one. The pad's ring turns from red to its size colour.
  - **Five minutes** to dock once the pad is given, or the clearance is revoked and must be asked for again.
  - **The queue:** with every pad the ship could use occupied, it joins a first-come, first-served queue that
    players and NPCs share. The controller gives its place, then the pad when one frees.
  - **The Autopilot Computer** (a new small internal module, size 1, for any ship; NPCs always carry one):
    once accepted, it talks to the controller and flies the ship in along the pad's corridor (or the
    station's axis) and down. It hands back control when the pilot touches the stick, and N engages it
    again. `outfit.js` gets the module; `autopilot.js` the flying.
  - (The rules in full: "The traffic controller's rules" in `plan-ember-reach-landing.md`.)
- **Docking on the ground** means a clean touchdown inside the assigned pad's circle, with its clamps
  locked on. That opens the port's screens, as docking does in space.
  - A hard landing on the pad docks too, but damage is damage.
  - Landing on a pad without clearance is refused: the clamps stay open, a warning shows, and the port
    asks you to leave.
- **Hangars** (a starport's S pads): touching down inside one is docking. The hangar's open front is its
  corridor.
- **Heavy fields** take XL ships on their XL pads and capital ships on the berth, with the same rules at
  the gentler limits.
- **Tests:**
  - **Node:** every refusal reason; pad assignment by size, larger for smaller but never smaller for larger;
    the first-come, first-served queue across players and NPCs; the 5-minute revocation; the autopilot
    reaching a pad within its time on a station and on the ground.
  - **Browser:** request, land and dock at an outpost; the port's screens open; launch and lift-off.

**Done, first part** (0.3.5):
- **`traffic.js`:** one controller per port, space or surface, made when first asked, with its NPC traffic already
  under way.
  - **Pads:** a space port has 24 (S to XL, no capital berth); a surface port has its layout's.
  - **Assignment:** a ship's own class first, then larger, never smaller; capital ships only to a heavy field's
    berth.
  - **The queue:** first come, first served, shared with simulated NPC traffic (arriving, sitting on a pad a while,
    leaving). You're told your place, and your pad when it frees.
  - **The five minutes:** a revoked pad goes to the next in the queue.
- **`requestDock`:** N asks the nearest port within 10 km, space or surface (lone ones once found). Refusals:
  wanted, at war, or no pad here for the ship's size. A ship that doesn't speak the controller's language is still
  given its pad, with the untranslated note, as before: a refusal would shut players without a decoder out of
  every foreign port.
- **Targets:** surface ports can be targeted.
- **On the ground:**
  - **The cleared pad:** a ring of light in the pad's size colour, over the pad (the mesh's own rings don't
    change).
  - **Docking:** a touchdown inside your own pad's circle locks the clamps (a hard landing too) and opens the
    port's screens for that port. Someone else's pad, or no clearance, keeps them open, and the port asks you to
    leave.
  - **Launch:** frees the pad, and you lift off as from open ground.
  - **Saves:** a game saved while docked on the ground comes back docked there.
- **Not changed:** hangars are the starport's S pads, with no corridor of their own yet. Space docking now needs
  the space port's own pad.

Tested in `tests/emberreach_traffic_t.js` (15 checks) and the browser test's 9u.

**Done, second part** (0.3.6):
- **The Autopilot Computer** (`autopilot.js`; an internal module, size 1, 3,500 SU). It flies through flight assist
  with a pilot's limits. Touching the stick hands control back; **N**, or **Autopilot** on the radial menu, hands it
  over again.
  - **Docking in space:** it takes over once you're cleared. It flies out round the port if it has to, onto the
    axis in front of the mouth, and in along it. It flies in space's frame until the run in, then the port's, so it
    turns with a spinning port.
  - **Docking on the ground:** it flies to your pad down a glide slope to a 350 m hover, then lets down under the
    touchdown limits for its pad size. It lowers the gear on the way.
  - **Cruise assist:** in cruise it turns onto the navigation target and sets the speed so you arrive at the edge
    of the target's mass lock (a port's 10 km, a world's Kármán line) and drop out normally. It also slows for the
    Kármán line of any world it is closing on near its path.
  - **Jumps:** it turns onto the system's star, and holds it there while the drive charges.
- **Two kinds of target:**
  - **Navigation** (. Period): the port, surface ports, worlds and stars, plus the system picked on the map or the
    route's next leg. Cruise, surveys, jumps and black-hole phasing use it.
  - **Instance** (T): ships, canisters, asteroids, mining sites, deposits, the beacon, a colony site. Guns, scans and
    prospecting use it.
  - **The HUD:** the card shows the instance target (or the navigation target if there's none). A cyan diamond
    marks the navigation target.
- **Mass locks:** a space port's drops from 20 km to 10 km. Surface ports get a 10 km lock of their own. A world
  locks cruise and jumps below its Kármán line (before, half a radius up when that was lower). The landing
  altimeter shows below the Kármán line, and not above it (before, below 30 km).
- **Jumping** needs the nose within 5° of the target system's star in the sky, held within 12° while the drive
  charges. The HUD draws an open reticle round that star (green when lined up, an arrow at the edge when it's off
  screen). The panel on the right gives:
  - the distance, as the star map shows it;
  - the government (the holder's own word, or Anarchy where nobody or pirates hold it);
  - the superpower (the great power whose space it is, even for a wild system);
  - the population, or Uninhabited;
  - "Open to claim" for a system a player could colonise.
- **Wild systems:** a system with no port of any kind (space port, surface port, outpost or camp, and so no nav
  beacon) is wild: Anarchy and Uninhabited, inside a power's space or not. Wild systems outside every power's
  space and every contested zone are open to claim at a colonial office, and they are the only ones: a power's
  uninhabited systems stay uninhabited (the charter that let a Friendly pilot claim inside a power's own space is
  gone). A colonial office no longer files a claim on a system with only a surface port or outpost. Every great
  power still has border ports with unclaimed systems within a jump.
- **Population formula:**
  - **Port bases**, by kind (each varies up to 30% either way, seeded):

    | Port | Base population |
    |---|---|
    | Great port (capital) | 3 billion |
    | Station at a living world | 250 million |
    | Surface starport | 6 million |
    | Bloom station | 600,000 |
    | Settlement | 120,000 |
    | Heavy landing field | 30,000 |
    | Outpost station | 4,000 |
    | Forward base | 2,000 |
    | Marshals' anchorage | 1,500 |
    | Outpost | 1,200 |
    | Mining camp | 250 |

  - **World multiplier:** 1, plus 0.6 for each living world, 0.25 for each world with traces of life, 0.1 for each
    other habitable world, and 0.02 for each barren world or gas giant.
  - **Population** = the sum of the port bases × the world multiplier, plus a colony's own people.
- **Reboot** (radial menu):
  - **While it runs (20 s):** weapons, thrusters and life support are off.
  - **At the end:** every inoperable module comes back to working order (a tenth of its pool), critical modules
    first. The cost comes from many working modules at random, at most 4% of each one's pool (a point on the
    smallest), never leaving one below a point.
- **Oxygen:** the life support keeps a reserve.
  - **Size:** 15 minutes stock; 24 at grade B, 33 at grade A.
  - **Drawn on** when the unit is broken, unpowered or rebooting, or the canopy is broken.
  - **Refills** in 2 minutes, and to full on docking.
  - **Warnings** at 5 minutes and at 1 minute. At empty the ship is lost.
- **Not changed:** NPCs don't yet fly their own approaches with it (L2.6).

Tested in `tests/emberreach_autopilot_t.js` (28 checks) and the browser test's 9v to 9y.

### L2.5 What surface ports trade

**Done, first part** (0.3.7): **markets**, the foundation of the galaxy's trade (`economy.js`). Every port, space
or surface, keeps its own market:
- **Its economy:** a mix from its kind, blended with its world's.
  - **By kind:** a capital's great port runs high tech and industry. A station at a living world adds tourism. An
    outpost station refines, a camp extracts, and a forward base is military.
  - **By world:** a gas giant refines fuel and a living world farms. Barren or desert rock is mined, and ice gives
    water. Ruins sell artefacts and draw tourists.
  - **A colony's** facilities set its port's mix.
  - **The system's economy** is its ports' mixes, weighed by their people. The jump panel shows it.
- **Supply and demand:** each economy makes some goods and uses others. People everywhere use food, water and
  medicine. A good both made and used is netted. Amounts are measured against the port's people: about
  25 × log10(people)² tonnes each way.
- **Prices:**
  - **The base:** a good's base value, moved a little by the stock (a full stock up to 22% under) and the demand (a
    full demand up to 25% over).
  - **People:** a slight premium where more people live (1.5% per power of ten).
  - **Trade:** a port sells only from its stock, and buys only up to its demand.
  - **Kept as before:** the war front and the Rift rules.
- **The calendar:** stock and demand wander slowly round their level (45 to 135-day cycles, seeded per port and
  good). A player's trades move them, and that comes back by itself at 5% of the gap a day, about half in two
  weeks. Only the player's changes are saved (`P.markets`).
- **The market screen** lists what the port sells first, with its stock, then what it wants. Its header names the
  port's economy and the people it serves.

Tested in `tests/emberreach_markets_t.js` (19 checks), the trade and colony tests, and the browser test's 3a.
(The surface bulletin contracts below followed in 0.3.10.)

**Done, second part** (0.3.8): **shipyards, outfitters, storage and transfers** (`hangar.js`). This replaces the
services table below for shipyards and outfitters.
- **By port:**

  | Port | Ships for sale | Outfitters | Storage |
  |---|---|---|---|
  | Outpost station (trefoil) | none | about half the range (its own half), grade C, up to size 2 | yes |
  | Bloom station, settlement | up to M | up to size 4, grades C and B | yes |
  | Surface starport | up to L | up to size 5, C and B | yes |
  | Heavy landing field | up to XL | up to size 5, C and B | yes |
  | Living-world station (lantern), capital (halo) | everything | up to size 7, C to A (the most advanced) | yes |
  | Mining camp, surface outpost, forward base | none | none | no |
  | Precursor anchorage | none | an outpost station's | yes |

- **Storage:** ships and modules are kept where they were left.
  - **A stored ship** keeps its fit, its modules' health, its fuel, its air and its hold.
  - **Buying:** a ship can be bought by trading yours in, or by storing yours here.
  - **Flying one:** taking out a stored ship stores the one you came in.
  - **Old saves:** modules stored before 0.3.8 are taken in by the first port with storage you dock at.
- **Transfers** are sent for from the port where you want the item.
  - **The hold:** only with an empty hold. Passengers will count too, once ships carry them.
  - **Same system:** a flat 100 SU (in the port's coin), at once.
  - **From another system:** half the item's weekly insurance premium (5% of its value), plus 25 SU a parsec for
    each step of its size class. A module counts 1 a size; a ship counts XS 1, S 2, M 4, L 8, XL 16, Capital 32.
    It takes a day, plus a day for every 5 pc, rounded up.
  - **The cap** (0.3.9): never more than 5 weeks' insurance on it (50% of the ship's whole value with its fit, or
    of the module's), within a system too. The days aren't capped.

Tested in `tests/emberreach_hangar_t.js` (19 checks), the trade test, and the browser test's 3b.

**Done, third part** (0.3.10): **surface contracts** on the bulletin (`contracts.js`). A great power's port posts
them for its own system and others within 8 pc. Each board changes daily.
- **Deliveries:** bring 5, 10, 20 or 40 t of food, machinery, water or medicine to a surface port. Dock on one of
  its pads with the load aboard.
  - **Pay:** the goods' base value 1.8 to 2 times over for food and machinery, 1.5 to 1.7 times for water and
    medicine, plus 250 SU and 120 SU a parsec.
  - **Handing over:** the load leaves the hold as you dock, and the contract pays there.
- **Ground surveys:** land on a world you can land on and let the ground scan run. 800 SU plus 150 SU a parsec,
  paid at the next port you dock at.
- **Terms:** in the issuer's coin, due in 12 days, counted among the three missions you can hold, and settled
  (with standing) like the cartographers' contracts.

Tested in `tests/emberreach_contracts_t.js` (17 checks) and the browser test's 9u2. L2.5 is done.

- **Markets** take the system's market and give each kind its twist:
  - **Mining camps** sell their world's ores at 70% and buy food, water and machinery at 120%.
  - **Outposts** keep a small general market.
  - **Settlements** run a colony market.
  - **Starports** match the system's port.
  - **Forward bases** trade munitions and war goods.
- **Services by kind:**

  | Kind | Services |
  |---|---|
  | Outpost | fuel; repairs for S ships only |
  | Settlement | an outfitter (S and M) and a cartographer |
  | Starport | everything, including a shipyard for S to L |
  | Forward base | munitions, repairs and war contracts |

- **The bulletin** gains surface delivery contracts, which pay a premium for food and machinery, and ground
  survey contracts.
- **Tests:** each kind's twist and services; contracts to and from surface ports.

### L2.6 Traffic

- **NPC ships** come and go from pads under the traffic controller, flown by their Autopilot Computers
  along pad corridors, in the same queue as the player. That makes ports look alive and fills pads, which
  makes the queue matter.
- **Forward bases** have turrets that fight for their holder (`combat.js`, as fixed guns).

**Done** (0.3.11):
- **Traffic:** the traffic controller (`traffic.js`) now tells each NPC arrival and departure. At ports within
  15 km of you they are flown, up to four in sight at once (the rest come and go unseen).
  - **Hulls:** traders, couriers, passenger ships, miners, colonists and prospectors, by pad size.
  - **Arrivals** come from 5 to 7 km out on the Autopilot Computer, into a space port's mouth or down onto their
    pad, and are gone once down.
  - **Departures** leave out of the mouth along the axis, or straight up off the pad and away climbing
    (`autopilot.js` departStation, departGround). They are gone at 11 km.
  - **Fired on,** one flies as any trader would.
- **Forward bases** have two turrets each, at bases within 20 km of you. Each has a pulse laser and a light gatling.
  - **Aim:** a turret turns at 90° a second and fires its fixed guns when lined up.
  - **Targets:** the holder's enemies within 4 km: pirates, the other side of its war, and you if you're its enemy
    or wanted in its coin.
  - **They can be shot down.**

Tested in `tests/emberreach_autopilot_t.js` (16a to 16c) and the browser test's 9z and 9z2. L2.6 is done.

### L2.7 Release 0.4.0

**Done** (0.4.0): the store description and the plan's release notes are updated. The full suite, every game's
tests and the browser playthrough pass on the release test machine (the sandbox's software-rendered Chromium).

- Bump the version, update the store description, run the full suite and the playthrough.

## L3: mining, and colonies on the ground

Planned after 0.4.0. Mining comes first: a planet's rings become asteroids you fly among and mine anywhere, and
the deposits the ground scan marks can be mined. Then colonies come down to the surface.

**Today (0.4.0), for reference:**
- **Rings:** each ringed planet's rings are a flat drawn band (1.35 to 2.3 radii, 14 bands with gaps:
  `meshes.js` rings).
- **Mining** happens at one fixed site on the ring, a 15 km swarm of 64 asteroids (96 in a dense ring), cruised to
  and dropped out at (`mining.js` fields and rocks). Asteroid belts round stars work the same way.
- **What's mined is remembered** per asteroid in the save (`P.mined`).

### L3.1 Rings made of asteroids

- **One shape for both:** the ring's bands come from one function, used by the drawn ring and by mining alike, so
  the gaps you see are the gaps you fly through. Each band has an inner and outer radius, a density (dense,
  moderate, sparse) and a mix.
- **The rocks:** a ring is filled with asteroids, made where they're needed.
  - **Cells:** the ring is cut into cells about 3 km across (by angle, by band). Each cell's asteroids are seeded by
    its place (planet, band, cell), so they're the same every visit.
  - **How many:** a dense band holds 6 to 10 asteroids a cell, a moderate one 3 to 5, a sparse one 1 or 2. Gaps hold
    none.
  - **The ring's thickness:** a few hundred metres. A ship can fly above it, below it, and through it.
- **Each asteroid** is mined as today. It has its own id (planet, band, cell, number), so `P.mined` remembers what
  you took. Its goods come from the ring's kind (stone, ice or metal), leaning metallic in the inner bands and icy
  in the outer ones.
- **Hotspots** (as built in 0.4.1): by chance, rich in rare minerals, seen only with a prospecting array.
- **Tests:** the bands match the drawn ring; cells are the same every visit; gaps are empty; ids are unique; the
  mix by band; hotspots.

**Done** (0.4.1, `rings.js`):
- **One shape:** the bands come from one function, used by `meshes.js` (the drawn ring, unchanged to look at) and
  by mining.
- **The rocks:** cells about 3 km across, seeded by place. Dense bands hold 6 to 10 a cell, moderate 3 to 5,
  sparse 1 or 2, and gaps none. They lie in a sheet 400 m thick.
  - **A densely strewn ring's** bands are a step denser.
  - **Each asteroid** has its own id, so what's mined is remembered.
  - **The mix** leans metallic in the inner bands and icy in the outer ones; Rift rings carry the Rift's ores.
- **Mineral hotspots** (as asked after the plan):
  - **By chance:** about a third of rings have them, the same every time.
  - **Size and mineral:** 1 to 3 a ring, 5 km across, in its bands. Each is rich in one of the ring's rarer,
    dearer minerals (titanium, jade, diamond in stone rings; beryllium, uranium in ice; titanium, gold, diamond,
    uranium in metal; the Rift's own in its rings).
  - **Yield:** inside, about half of what's mined is that mineral, and the asteroids hold half again as much.
  - **Seeing them:** only a ship with a **prospecting array** (a utility module, 24,000 SU) sees and can target
    them. The minerals are there for anyone who mines there.
  - **Reading asteroids** (0.4.2): only the resource scanner reads what an asteroid holds, scanning the asteroid
    itself. The array finds hotspots and nothing more.
- **The mining site:** a point in the ring's densest band, and the asteroids there are the ring's own (`mining.js`
  fields and rocks).
- **Belts:** unchanged (L3.3).

Tested in `tests/emberreach_rings_t.js` (17 checks), the mining test's 3, and the browser test's 9z3 and 9z4.

### L3.2 Flying in a ring

- **Drawing:** within 8 km of the ship the ring's cells are made and drawn as asteroids (the rock meshes in use
  today). The flat band fades out as you come close, so up close the ring *is* its asteroids. Further off it's the
  band, as now.
- **Collisions:** asteroids are solid, as at sites today.
- **Cruise:**
  - **The hazard:** cruise drops out on entering a ring's band within 2 km of its plane. Above 300 km/s that's an
    emergency drop.
  - **As a target:** each ring is a navigation target. Cruise assist brings you to its edge, just clear of the
    plane, and slows for any ring it crosses on the way.
- **Mining anywhere:** chip, prospect, refine and tractor work as today, on any asteroid in the ring.
- **Performance:** the cells are made as you move, and a few hundred asteroids are drawn at most. The release
  machine's frame rate is checked, with fewer asteroids drawn on low quality.
- **Tests:**
  - **Browser:** drop out in a ring, mine an asteroid there, and fly into a gap and find it empty.
  - **Node:** cruise's drop at a ring's edge.

### L3.3 Belts

- **Belts round stars** stay as sites. A belt spans an orbit hundreds of millions of kilometres round, too large
  to fill. They take the hotspot rule (L3.1): 2 or 3 sites a belt, found with a resource scanner.

**Done** (0.4.8, `mining.js` fields):
- **Sites:** each belt has 2 or 3, round its orbit (within 3% of its radius). The first is charted and anyone sees
  it, as before (its id, place and asteroids unchanged). The others are dense (96 asteroids), and their asteroids
  hold a third more.
- **Finding them:** they show (as T targets) only to a ship with a working resource scanner. Visiting one with
  the scanner charts it (`P.charted`, in the save), and then it shows without one.
- Tested in the mining test's 17 to 19 and the browser test's 9z5c.

### L3.4 Mining the ground: part of colonization (decided 0.4.7)

- **Planetary surfaces are mined through colonization,** not by a ship's mining laser. The deposits the ground
  scan marks (`explore.js` deposits) are worked as part of the colony mechanics, planned with L3.5.
- Ships go on mining in space: rings (L3.1, L3.2) and belts (L3.3).

### L3.5 Colonies on the ground

- **Claims on airless worlds** become surface outposts and settlements (`surface.js` kinds), built and upgraded
  through the colonial office. Its planner shows the site's layout.
- **Mining the surface** is part of this: a colony works its world's deposits (L3.4). How (what is built, what it
  yields, and how the goods reach the market) is planned with the rest of L3.5.
- **A colony's port can grow** into a surface starport.

### L3.6 Raids

- **Pirates raid surface ports,** colonies' and others'. A forward base's turrets (0.3.11) and the port's traffic
  are caught up in it.

### L3.7 Release 0.5.0

- Bump the version, update the store description, run the full suite and the playthrough.

| Step | Depends on | Size |
|---|---|---|
| L3.1 rings made of asteroids | | medium |
| L3.2 flying in a ring | L3.1 | large |
| L3.3 belts | L3.1 | small |
| L3.4 mining the ground (folded into L3.5) | | |
| L3.5 colonies on the ground, with surface mining | | large |
| L3.6 raids | L3.5 | medium |
| L3.7 release 0.5.0 | L3.1–L3.6 | small |

**Open questions:**
- **Belts:** should they also become asteroids all the way round? That would mean filling only the stretch near
  the ship, with the belt as a target.
- **The ring's thickness:** a few hundred metres at the game's 1/12 scale (real rings are tens of metres to a
  kilometre).
- **Drawn bands:** should the rings' drawn bands thin out where a player has mined a lot?

## L4, in outline

Planned in detail once L3 is in and played.

- **L4: sites.**
  - Ruins on airless worlds, landed at and surveyed from the ground, at a better yield than from orbit.
  - Precursor ruins on the Rift's airless worlds.
  - Crash sites with salvage.

## Risks, and what to do about them

| Risk | What to do |
|---|---|
| Terrain costs too much on the software renderer | The budgets are tested at each PR. Fall back to fewer, larger tiles and a shorter horizon on low quality. Cap tiles built per frame. |
| Float precision near the ground of a big world | Everything is camera-relative already. Tiles are built around their own centres, in doubles on the CPU, and uploaded as offsets. |
| Turning frames make flight assist feel odd | The station's spinning frame already works the same way. Test hover-and-hold on the fastest-turning worlds (9 h gas giants don't count; fast rocky worlds at 10 h). |
| The multi-port refactor (L2.1) breaks saves or contracts | It ships alone, changes no behaviour, and is tested with v3 saves before anything builds on it. |
| A world's day/night and lighting look wrong on tiles | Tile colour and lighting come from the same functions as the far sphere, and the fade band hides the switch. |
| The phone layout (1.6.0) needs controls landing hasn't made room for | The touch slider and gear button come in L1.5, sized for phones. |

## Order and size

| Step | Depends on | Size |
|---|---|---|
| L1.1 frame and readout | | medium |
| L1.2 gear, touchdown, crashes | L1.1 | medium |
| L1.3 terrain | L1.2 | large |
| L1.4 the approach | L1.1 | small |
| L1.5 NPCs, controls, polish | L1.2 | small |
| L1.6 release 0.3.0 | L1.1–L1.5 | small |
| L2.1 many ports | | medium (touches much, changes nothing) |
| L2.2 ports placed | L2.1, L1.3 | small |
| L2.3 port meshes | L2.2 | medium |
| L2.4 traffic controller and pad docking | L2.3 | large |
| L2.5 what they trade | L2.4 | medium |
| L2.6 traffic | L2.4 | medium |
| L2.7 release 0.4.0 | L2.1–L2.6 | small |

Some steps can run in parallel:
- L1.4 can go alongside L1.2 or L1.3.
- L2.1 can start any time, even during L1, since it changes nothing a player sees.

## Decisions

Settled:
1. **The gear key** is **L** (fire moves to **;**), and every key is rebindable in Settings.
2. **Version numbers:** 0.1.1 shipped insurance, rotation and gravity; 0.2.0 the smaller galaxy and 0.2.1 the
   Interstellar Marshals. Each L1 step merged is a 0.2.x (the Library publishes every merge), **0.3.0 after L1**,
   **0.4.0 after L2**.
3. **NPC traffic on pads** (L2.6) flies by the same **Autopilot Computer** a player can buy, under the same
   traffic controller, queue and 5-minute rule as the player.
