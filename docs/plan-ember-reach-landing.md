# Ember Reach: landing on airless worlds, and surface ports

(How it's built, step by step: `plan-ember-reach-landing-work.md`.)

A plan for the next big piece of Ember Reach after the Single-Player Alpha Build (0.1.0): flying down to the
surfaces of airless planets and moons, landing anywhere flat enough, and docking at **surface ports and
outposts** built there. Worlds with an atmosphere stay closed for now: the safety still holds ships off them,
because nothing yet models entry heat or flying through air.

The model is in the game (`apps/rudolf-emberreach/www/surface.js`, from L2.2; drafted in `wip/emberreach-surface/`):

- `surface.js` covers which worlds can be landed on, which ship can manage which gravity, the touchdown rules,
  the kinds of surface port, where they go, their layouts and their meshes.
- `layouts.html` draws each kind of port from above and in 3D. Open it from a checkout.
- `tests/emberreach_surface_t.js` has 12 checks.

## What can be landed on

A world can be landed on when it is:

- **Airless:** no atmosphere at all (`atmo` false, 0 bar). There is no heat shield, and nothing to glide on.
  Titan-like moons are out with the rest.
- **Solid:** no gas giants.
- **Neither molten nor frozen solid:** between 30 K and 700 K at the surface. Ports keep to worlds below 500 K.
  Anyone can set down on a hotter world, but nobody lives there.
- **At most 2.5 g.** Above that, no hull's frame is built for the pad.

Across a sample of 2,500 star systems that is about **two worlds in five**, and most of them are **moons**.
Barren and icy moons are where most of the galaxy's ground is.

### Which ship can land where

**Every ship a pilot can fly can land**, from a Dodo to a Kraken. A ship's **lift** is the stronger of two things:

- its vertical thrusters (`aRcs` in `flight.js`);
- its landing jets, which every hull has. They hold it up at 1.5 g.

The lift must hold the ship up with half again to spare: `lift ≥ 1.5 × g × 9.81`. So every ship can land on
any landable world up to 1 g, and nimbler ships, whose thrusters are stronger, can land on heavier worlds up
to the 2.5 g cap. Most landable worlds are moons well under 1 g, so the big ships aren't shut out of much.

| Ship | Size | Lift | Heaviest world it can land on | Where it sets down at a port |
|---|---|---|---|---|
| Dodo | XS | 12.9 g | 2.5 g (the cap) | an S pad |
| Griffin | M | 9.4 g | 2.5 g | an M pad |
| Mammoth | M | 3.5 g | 2.3 g | an M pad |
| Woolly-Rhino | L | 2.3 g | 1.5 g | an L pad |
| Deinotherium | L | 1.5 g (jets) | 1.0 g | an L pad |
| Arthropleura | XL | 2.3 g | 1.5 g | an XL pad |
| Brontosaur | XL | 1.5 g (jets) | 1.0 g | an XL pad |
| Kraken, Hydra, Leviathan | Capital | 1.5 g (jets) | 1.0 g | a capital berth, at a heavy landing field |

**XL pads** (1.2 km across) are at surface starports. **Capital berths** (3.4 km across) are at **heavy
landing fields**: a levelled field 8 km from every surface starport, with two XL pads, cranes, a tower and
crawlers to the port. Anywhere flat enough, any ship can set down on open ground.

The HUD shows the margin when a world is targeted: "**Landable: 0.3 g, thrusters 9.4 g**", or "**Too heavy for
this world**" before the pilot commits to a descent.

## Flight: from orbit to the pad

1. **Supercruise** drops the ship near the world as it does now. With a landable world targeted, the drop
   comes in **above it** (about 1.5 radii from its centre, or 50 km up, whichever is higher) instead of at a
   station.
2. **Descent.** Below the world's **Kármán line**, gravity acts on the ship: `g × (R / r)²` toward the world's
   centre (in the game now: see "Gravity" below). Below
   about 30 km the frame changes:
   - The HUD switches to a **surface frame**: altitude above the ground, vertical speed, ground speed, and a
     horizon line with pitch ladder.
   - **FA holds altitude:** releasing the stick hovers, and the vertical thrusters cancel gravity first.
   - Under 2 km, the pad's **approach corridor** shows as a lit cone.
3. **Clearance.** Permission to land, like permission to dock in space, is asked by the pilot and given by
   the port's **traffic controller**:
   - **Asking.** N within 10 km of a port, surface or space. This is how docking at space ports already
     works in 0.1.0, and surface ports work the same way.
   - **Refused.** The controller may refuse when the pilot is wanted there, their side is at war with the
     port's holder, or no free pad fits the ship.
   - **Accepted.** The controller gives a pad number sized to the ship (S to XL, or a capital berth at a
     heavy field) and lights its ring. The ship has **5 minutes** to dock, or the clearance is revoked, as in
     space. The full rules (the Autopilot Computer, larger pads for smaller ships, the queue) are in "The
     traffic controller's rules" below.
   - **Without clearance, no landing on a pad:** its clamps stay locked and its ring shows red, and setting
     down on it is refused like docking without clearance. Open ground needs no one's permission.
4. **Gear.** The landing gear goes down by itself under 300 m, or with a key (**L**, or A held on a gamepad). With the gear down, top
   speed is capped at 100 m/s.
5. **Touchdown** (in `surface.js`). Every limit is checked together:

   | Pad size | Max vertical speed | Max ground speed | Max tilt |
   |---|---|---|---|
   | S (and XS ships) | 4 m/s | 2.5 m/s | 12° |
   | M | 3 m/s | 2 m/s | 9° |
   | L | 2 m/s | 1.5 m/s | 6° |
   | XL | 1.5 m/s | 1 m/s | 5° |
   | Capital berth | 1 m/s | 0.8 m/s | 4° |

   Up to the limits, it is a clean landing. Up to three times past them, it is a **hard landing**: hull damage
   is 15% × (excess)². Three times past them or more is a **crash**: the ship is lost, as when destroyed in
   combat, and **insurance** decides what happens next (`insurance.js`, already in the game: see "Ship
   insurance" in `plan-ember-reach.md`). Touching the ground anywhere but the gear (belly, nose) counts as three times past.
6. **Landed on a pad:** the port's screens open, as when docked. **Landed on open ground:** the ship sits
   there with these options:
   - lift off (the reverse of the descent);
   - a **ground scan** (the resource sweep from orbit, but finer);
   - and later, the activities in "Later" below.
7. **Lift-off.** Throttle up, or Launch from a port. Above 30 km the frame returns to space. Above 1.5 radii,
   supercruise unlocks again.

**Mass lock.** A world's surface mass-locks supercruise below 1.5 radii, the same rule stations use within
their reach, so there is no supercruising into the ground.

**The safety** (`scene.js`) already holds ships 300 m off airless ground and keeps them out of atmospheres.
With landing, the 300 m hold applies only while the gear is up. With the gear down, the touchdown rules
take over.

## Gravity: the Kármán line

This is in the game now (`scene.js`: `karmanOf`, `gravityAt`, `gravityWell`; scene test checks 25–30).

- **Where gravity starts.** A world's gravity takes hold of ships and loose things only below its **Kármán
  line**. Earth's is 100 km up, and every other world's is that in proportion to its mass:

  | World | Mass | Kármán line |
  |---|---|---|
  | Earth | 1 Earth | 100 km |
  | A Moon-sized moon | 0.012 Earth | 1.2 km |
  | A 0.3-Earth rock | 0.3 Earth | 30 km |
  | A 318-Earth giant | 318 Earth | 31,800 km |

- **Below the line**, the pull is the world's surface gravity, falling off with the square of the distance
  from its centre. **Above it**, nothing pulls, as if everything up there were in orbit.
- **What isn't pulled:**
  - stars and black holes;
  - ring rocks, which are in orbit;
  - anything in cruise.
- **What is pulled:** the player's ship, NPC ships and loose canisters.
  - **Flight assist** holds a ship against the pull, as far as its thrusters can. A ship that can't hold
    sinks. With assist off, it falls.
  - NPC ships are held off the ground by the same proximity safety as the player.
  - Canisters come to rest on the surface.
- **What's felt aboard** (the g-meter and blackouts) is thrust, not gravity. Free fall feels like nothing, and
  hovering on a 1 g world feels like 1 g.
- **The HUD** shows **GRAVITY** (the pull in g, and the height above the surface) while below a line.
- **Ports stay above it.** A space port always orbits above its world's Kármán line. A heavy giant's line can
  reach past one radius, so its port sits higher.
- **No trap.** Near a heavy giant, a big ship whose thrusters can't climb against the pull can still engage
  cruise. Cruise always works outside a station's mass lock.

## The ground

- **Terrain** is a heightfield over a cube-sphere. It uses the same noise as `meshes.js` (`fbm`) plus craters.
  Each world is seeded from its name, so it is the same every visit:
  - Relief scales with the world's size: up to about 4 km on a large rocky world, about 1 km on a small moon.
  - Tidally locked worlds get a smoother night side, frozen over.
- **Level of detail.** Tiles split as the ship comes down: 6 faces, then quads down to about 50 m at the
  surface. Only the tiles in view and within a horizon distance are built. Positions are relative to the
  camera, so float precision holds; the renderer already does this for bodies, and the sprite fix in 0.1.0
  covers distant ones.
- **The height function** `h(direction)` is shared by the renderer and the simulation, so collisions match
  what is drawn. A port's site is flattened to its radius with a short ramp, so pads are level.
- **Days, years and rotation.** Worlds turn in real time against the in-game calendar, as real worlds do.
  This is in the galaxy model now (`galaxy.js`'s `spin`; scene test checks 19–21):
  - **Orbits:**
    - A world's **year** comes from Kepler's third law, using its distance in AU and its star's mass. An
      Earth at 1 AU from a Sun takes 365 days.
    - A moon's **month** comes from its planet's mass and its distance in the planet's radii. A Moon at 60
      Earth radii takes 27 days.
    - Positions advance with the calendar between arrivals. During a stay in a system, worlds hold their
      places.
  - **Spin:**
    - A **tidally locked** world, and every moon, turns once per orbit, so its day and night sides are fixed.
    - **Gas giants** turn in 9–18 hours.
    - **Rocky worlds** turn in anything from 10 hours to 5 days. Inside 0.4 AU, half are slowed into a 3:2
      resonance like Mercury's. One in ten turns backwards, like Venus.
  - **On the ground,** the landed ship's frame turns with the world, so the turning is felt as the sun and sky
    moving. Over the length of a landing, that is mostly negligible.
- **Light.** The sun's direction comes from the star. On a tidally locked world the day and night sides never
  move, so ports there sit near the terminator: within 25° of latitude, at 75°–105° of longitude.
- **Heat.** On a hot world's day side (above 450 K), the heat gauge (`modules.js`) climbs while landed and
  while flying low. Below 80 K, the thrusters' fuel use rises by 10%.

### The traffic controller's rules

Settled with the user, for every port, space or surface, and for every ship, the player's and NPCs' alike:

- **Request.** A docking or landing request goes to the port's **traffic controller** (ATC). The controller
  accepts or refuses it.
- **The Autopilot Computer.** Once a request is accepted, a ship with an **Autopilot Computer** talks to the
  controller and flies itself in to its pad.
  - It is a small internal module that fits any ship (size 1, a light power draw).
  - NPC ships always carry one. Players can buy one at any outfitter, or fly in by hand.
  - The autopilot hands back control if the pilot touches the stick, and can be engaged again (N).
- **Pads by size.**
  - A ship is given a pad of its own class first.
  - If none of its class is free, a **smaller ship may be given a larger pad**.
  - A **larger ship is never given a smaller pad**.
  - XS ships use S pads. Capital ships use capital berths, so they can only be queued, never sent to anything
    smaller.
- **The queue.** If every pad the ship could use is occupied, it joins a **first-come, first-served queue**,
  shared by players and NPCs. The controller says where it is in the queue, and gives it a pad as one frees
  up.
- **Five minutes.** Once a pad is assigned, the ship has **5 minutes** to dock. Miss that, and the clearance
  is **revoked**: the pad goes to the next in the queue, and the ship must request again (and join the back
  of the queue if there is one).
- **In the game now.** Space ports already give a pad on request and revoke it unused after **5 minutes**
  (this change; it was ten). The queue, pad classes and the Autopilot Computer come in L2.4, with the
  surface ports.

## Surface ports and outposts

### The kinds

| Kind | Like (in space) | Across | Pads | What's there |
|---|---|---|---|---|
| **Mining camp** | Trefoil | 0.5 km | 2 S | prefab habs, an open pit, ore silos, a refinery shed, a mast, tanks |
| **Outpost** | Trefoil | 0.6 km | 3 S | a hab cluster, a comms mast, fuel tanks, solar fields, sometimes a hangar |
| **Settlement** | Bloom | 1.0 km | 4 S, 1 M | pressurised domes, greenhouse domes, habs, a pad tower, tanks and panels, hangars |
| **Surface starport** | Lantern | 3.8 km | 6 S (in hangars), 4 M, 1 L, 1 XL | a dome city, greenhouses, towers, hangars, tanks, solar, plants, masts |
| **Heavy landing field** (beside each starport) | Halo | 9.2 km | 1 capital berth, 2 XL | cranes, a tower, tanks, masts, hangars |
| **Forward base** | Trefoil | 0.8 km | 2 S, 2 M | bunkers, turrets, a tower, tanks, hangars |

**What they trade**
- **Mining camps** sell the ores of their world (its `res`) cheaply, and buy food, water and machinery.
- **Outposts** keep a small general market and fuel, and offer repairs for S ships only.
- **Settlements** have a colony market, a cartographer and an outfitter (S and M).
- **Starports** have everything a system port has, including a shipyard for S–L.
- **Forward bases** have munitions, repairs and war contracts.

### Where they go

Systems with a port in space get surface ports (`ports(star, cls)` in `surface.js`), more for a more
important port (table below).

Surface ports can also stand with **no port in space above them**:
- About **one system in twenty-five** with landable ground and no space port has a **lone outpost or mining
  camp**. A metal-rich world gets a camp more often.
- In a power's space, it belongs to that power. In unclaimed space, it is independent and run by free
  traders.
- It is a place to find. Space has no beacon for it, but a ground scan or the cartographer's charts mark it.

The Rift and the Maw get no surface ports.

| System's port | Surface ports | Kinds |
|---|---|---|
| Trefoil | 1 | outpost, or a mining camp |
| Bloom | 1 | settlement, outpost, or camp |
| Lantern | 2 | settlement, then outpost, camp, or base |
| Halo (capital) | 3 | starport, then settlement, outpost, camp, or base |

**How the world is chosen**
- Only landable worlds under 500 K are considered.
- The best ground is picked first: gravity near 0.3 g and temperatures near 220 K score highest, with a bonus
  for metals.
- A metal-rich world (three or more metals) gets a mining camp 60% of the time.

**Where on the world**
- A tidally locked world puts its port near the terminator.
- Any other world puts it within 60° of the equator.

Everything is drawn from the system's own random stream, so the result is the same every time. Of the first
twelve capitals, every one with landable ground gets a surface starport, and most get two or three ports.

**Not the Maw, not the Rift.** The Rift's Precursor anchorages stay in orbit. Precursor ruins on airless Rift
worlds become landing sites later (L4).

### Layouts

`layout(kind, seed)` builds the site from the port's own seed:

- **Pads** go first, largest nearest the centre, on rings outward. They never overlap and never leave the
  site.
  - Pad radius: S 30 m, M 66 m, L 150 m. That is at least 1.5 times the longest ship of each size.
  - Each pad's ring light shows its size: blue S, amber M, red L.
- **Approach corridors.** Every pad has a cone 35° from the vertical above it. A building of height *h* must
  stand at least *r*<sub>pad</sub> + *h* × tan 35° from the pad's centre. That keeps every approach clear of
  masts and towers, so a pilot can always come straight down.
- **Buildings** are placed at random within the site, clear of each other (6 m apart), of the corridors, and
  of the edge. Each kind has its own counts as ranges. In tests, placement fills the counts asked for across
  forty seeds per kind.
- **Starports** put their small pads inside **hangars** (roofed pads entered from the open front). Their M and
  L pads stand open.

`check(layout)` lists any rule a layout breaks; the test runs it over 200 layouts. `layouts.html` draws each
kind from above (pads, corridor rings, footprints) and in an oblique view of the model, with a button for new
seeds.

### Models

`parts(layout)` gives the layout as **parts in the stations' vocabulary** (`scene.js`: `cyl`, `box`, `ell`),
with z up and the ground at 0. Two new shapes belong to the ground:

- **`dome`:** the top half of an ellipsoid, glazed for city domes, green for greenhouses, grey for bunkers.
- **`pad`:** a flat disc with a lit ring and a touchdown cross, in the pad's colour.

`meshes(layout, detail)` builds them from `meshes.js`'s primitives. A starport is about 4,900 triangles at
high detail and about 2,100 at low. That is within what a Halo station costs, so the renderer's budget
holds.

The buildings:

| Building | Shape | Building | Shape |
|---|---|---|---|
| hab | short cylinder and airlock | dome | glazed half-ellipsoid with a footing ring |
| silo | tall cylinder, domed top | greenhouse | long green half-ellipsoid |
| plant | block and stack | tower | shaft with a glazed cab and beacon |
| mast | lattice, dish and beacon | bunker | low grey half-ellipsoid |
| tank | squat sphere | turret | drum and barrel |
| pit | dark disc, sunk | hangar | block with a lit door |
| solar | low flat panel field | | |

The game will draw a port the way it draws a station: one mesh group per detail level. It is placed on the
world at the port's latitude and longitude, on its flattened site, with the ground beneath. Lights (pad rings,
beacons, windows) use the emissive channel the stations already use.

## How it fits the rest of the game

- **More than one port per system.** Today a system has at most one port (`travel.js`'s `portFor`).
  - Surface ports need a list: `portsAt(star)` returns the space port and the surface ones.
  - Each port gets an id (`orbital`, or `surface:<world>:<kind>`).
  - Markets get a per-port twist on the system's market, such as a mining camp's cheap ores.
  - `P.lastPort`, missions' destinations and the save hold port ids. A save without one means the orbital
    port, so 0.1.0 saves still load.
- **Bulletin and missions.** These gain "deliver to the surface" contracts (surface ports pay a premium for
  food and machinery) and "survey from the ground" contracts.
- **Colonies** (`colonies.js`).
  - Claims on airless worlds become **surface outposts and settlements**, built and upgraded the same way:
    deliveries, then construction time.
  - The colonial office's planner shows the site layout.
  - A colony's surface port can grow into a surface starport, the way a station grows into a great port.
- **Combat.** Forward bases have turrets that fight for their holder. Above surface ports, patrols fly low.
  Pirates don't raid surface ports in L2; raids come later.
- **Mining.** The ground scan shows surface deposits. Mining them by ship (a low pass with the mining laser
  at a deposit) is L3. Surface vehicles are later.
- **Exploration.**
  - A first landing on a world counts as a discovery.
  - Landing data sells at the cartographer, worth half a survey.
  - Naming rights are unchanged.
- **Save:** version 4.
  - New state: `landed: {world, port?, pad?, lat, lon, heading}`.
  - New player records: `P.landings` (first landings) and port ids.
  - The game's own records are still trimmed under the 256 KB budget the 0.1.0 save brought in.
- **Controls.**
  - Vertical thrust uses the existing strafe up and down keys (Space and Left Shift), with the gear on **L**.
    Fire moves from L to **;** (beside it), and every key can be rebound in Settings.
  - On a controller, vertical is the d-pad's up and down (already strafe up and down).
  - On touch, a vertical slider beside the throttle, ready for phones (1.6.0).
- **Sound:** gear motors, touchdown thuds scaled by impact, the hiss of the vertical thrusters, and a pad
  beacon's ping when cleared.

## Milestones

1. **L0 (this draft):**
   - The landability and ship rules, touchdown rules, port kinds, placement, layouts and models.
   - `layouts.html` to look at them, and 12 checks.
2. **L1, landing anywhere:**
   - Gravity near worlds.
   - The surface frame and HUD: altitude, vertical speed, horizon.
   - FA hover, gear, touchdown and crashes.
   - Terrain with LOD and the shared height function.
   - Lift-off, and the ground scan.
   - A browser test that lands a Dodo on a moon and takes off again.
3. **L2, surface ports:**
   - Ports placed in systems, flattened sites, port meshes, and clearance and pads.
   - Multiple ports per system: port ids, markets with a twist, and the save at v4.
   - Docking at a pad opens the port's screens.
   - Hangars: the small pads at starports.
4. **L3, the economy and colonies on the ground:**
   - Surface contracts.
   - Colony surface outposts and settlements, and their upgrades.
   - Forward bases with turrets.
   - Mining surface deposits from a low pass.
5. **L4, sites:**
   - Ruins on airless worlds, landed at and surveyed from the ground, with a better yield.
   - Precursor ruins on the Rift's airless worlds.
   - Crash sites with salvage.
6. **Later:**
   - Worlds with atmospheres (entry heat, drag, lift, weather).
   - Surface vehicles.
   - Night lights on dark sides.

## Settled

All five of the draft's questions are answered:
- Every flyable ship can land.
- Pads need the traffic controller's clearance.
- A crash is a loss like any other, under the ship's insurance.
- Worlds turn in real time against the calendar, with real years and months.
- Surface ports can stand with no port in space above them.
