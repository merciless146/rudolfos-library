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

**Drafted, outside the game** (`wip/emberreach-surface/surface.js`)
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

### L2.3 Port meshes on the ground

- `meshes(layout, detail)` from the draft is uploaded per port, high and low detail like stations, and
  placed at the port's latitude and longitude on its flat, oriented to the local up.
- **Lights** use the emissive channel: pad rings in their size colours (blue S, amber M, red L, violet XL,
  rose capital), window bands, beacon blinks. Night-side ports glow.
- **Budget:** at most 6,000 triangles per port at high detail.
- Ports more than 50 km away aren't drawn: the world's sphere stands in for them.
- **Tests:** meshes within budget for every kind; a port sits on level ground in a browser screenshot check.

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

### L2.5 What surface ports trade

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

### L2.7 Release 0.4.0

- Bump the version, update the store description, run the full suite and the playthrough.

## L3 and L4, in outline

They're planned in detail once L2 is in and played.

- **L3: colonies and the economy on the ground.**
  - Colony claims on airless worlds become surface outposts and settlements, built and upgraded through
    the colonial office (its planner shows the site layout).
  - A colony's port can grow into a surface starport.
  - Pirate raids on surface ports.
  - Mining surface deposits with the mining laser from a low pass.
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
