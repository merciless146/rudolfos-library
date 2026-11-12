# Ember Reach: plan

A 3D open-world spaceflight game about **combat, trade and exploration**, set inside a scale model of a compact
elliptical galaxy. Every one of its ~8 billion stars exists and can be visited. Each star, its planets and their
habitability come from the astrophysics below, not from hand-placed content. "Ember Reach" is a working title.

- **Package:** `rudolf-emberreach` (a Library game). The work sits in `wip/emberreach/` until it can be played, so
  the publish workflow doesn't put it in the App Store early (`tools/publish.sh` builds everything in `apps/`).
- **Status:** the models are done and checked; the game itself is the milestones below.
  - The galaxy: `wip/emberreach/galaxy.js` (`tests/emberreach_galaxy_t.js`, 25 checks).
  - Factions, front-line wars, money and reputation: `factions.js`, `economy.js`, `reputation.js`
    (`tests/emberreach_factions_t.js`, 51 checks).
  - The 40 stock ships: `ships.js` (`tests/emberreach_ships_t.js`, 15 checks).
  - Flight, with flight assist: `flight.js` (`tests/emberreach_flight_t.js`, 19 checks).
  - Modules, damage and HUD alerts: `modules.js` (`tests/emberreach_modules_t.js`, 15 checks).
  - The pilot under g, with the canopy broken: `pilot.js` (`tests/emberreach_pilot_t.js`, 10 checks).
  - A system to fly in, its ports, docking, cruise and collisions: `scene.js` (`tests/emberreach_scene_t.js`, 23
    checks).
  - The save: `save.js` (`tests/emberreach_save_t.js`, 12 checks).
  - Trade: wallet, cargo, markets, exchange, services, shipyards: `trade.js` (`tests/emberreach_trade_t.js`, 18
    checks). The starport: `port.js`.
  - Travel between stars: fuel, misjumps, ports, lanes and routes: `travel.js` (`tests/emberreach_travel_t.js`, 16
    checks). The star map: `map.js`.
  - **The flight screen (M1):** `play.html`, with `play.js`, `render.js`, `meshes.js` and `hud.js`. Open it from a
    checkout (it loads gamekit from `lib/`); `?port=trefoil|bloom|lantern|halo`, `?ship=kestrel`, `?power=N`,
    `?canvas` for the fallback, `?debug` to break modules.
  - `wip/emberreach/viewer.html` draws them, the north in 3D.

## Exceptions to the games plan's rules

- **Drawing (rule 3):** this game uses **WebGL**, with a **Canvas 2D fallback**. With a graphics card it gets lit,
  textured ships and planets. Without one, including the Vivobook on the Lite desktop, it draws flat-shaded,
  low-poly 3D on the processor in the style of early space sims, and still targets 60 frames a second. Both paths
  run the same game; only the renderer differs. On start-up the game times a few frames and picks the path, and
  Settings can override that choice.
- Every other rule stands: one input layer (`rudolf-gamekit`), any window shape, under about 2 MB, saves through
  rudolfd, pausing, and fully offline. The galaxy is generated, not stored, so its size costs nothing. The 2 MB
  goes on ship models, sound and code.

## The galaxy

### What it is

A **compact elliptical**, after M32, the prototype of the class. M32 holds mostly old, faint red and yellow stars,
with practically no dust or gas and so no current star formation. Half its stars sit inside an effective radius
of about 100 pc. Compact ellipticals sit at the low-mass end of early-type galaxies, with stellar masses of 10^8
to 10^10 suns and sizes under about 0.7 kpc. Ember Reach's galaxy sits in the upper part of that range, so it has
room for an open world:

| | Model | Notes |
|---|---|---|
| Stellar mass | 3×10^9 suns (2.7×10^9 inside the model's edge at 3 kpc) | upper part of the range for a compact elliptical |
| Effective radius Re | 300 pc | half the light inside this (projected) |
| Shape | triaxial, axes 1 : 0.85 : 0.7 | an E3 seen from the side |
| Profile | Hernquist (1990), a = Re / 1.8153 = 165 pc | projects close to de Vaucouleurs' r^1/4 law |
| Stars and remnants | **7.9 billion** (mean mass 0.34 suns today) | from the initial mass function, aged |
| Central black hole | 5 million suns | M32's is a few million |
| Velocity dispersion | 54 km/s | M32's central value is 76; σ² scales with mass over size, so this lighter galaxy of the same size is slower |
| Populations | old (10 Gyr) and younger (3 Gyr; 30% at the centre, falling outwards) | M32 shows an intermediate-age population, younger and more metal-rich at the centre |
| Metals | [Fe/H] +0.15 at the centre, falling outwards, ±0.15 between stars | |

**Density.** The Hernquist profile is ρ(r) = M a / (2π r (r + a)^3). The mass inside r is M r^2 / (r + a)^2, and
the effective radius is Re = 1.8153 a. In the model, r is the *ellipsoidal* radius, so the galaxy is triaxial.
What that means for flying around:

| Distance from the centre | Stars per pc³ | Typical nearest neighbour |
|---|---|---|
| 5 pc | 16,000 | 0.02 pc (4,500 AU) |
| 30 pc | 1,750 | 0.05 pc |
| 300 pc (Re) | 13 | 0.24 pc |
| 1 kpc | 0.25 | 0.9 pc |
| 2 kpc | 0.02 | 2.1 pc |
| 3 kpc (the edge) | 0.004 | 3.5 pc |

The Sun's neighbourhood has about 0.1 stars per pc³; here that density comes at about 1.3 kpc. Inside it, space is
crowded by our standards; beyond it, the Outer Clouds are sparser than home. The core is a wall of light.

**Reaching the edge.** In a random scatter of stars, a ship can hop anywhere once the average star has about 2.7
others within its jump range (3D continuum percolation). That takes about 3.6 pc around the Rim cluster and 5.4 pc
at the edge. Most jump-capable stock ships have 5 pc or more (up to 20 pc), so all of the galaxy can be reached;
the outskirts are for long-range ships, and the powers' relay lanes carry the rest.

### How every star exists without being stored

Space is cut into 4-pc cells. A cell's expected star count is the density averaged over 27 points inside it, times
its volume. A cell expecting more than 48 stars splits into eight (up to ten times), so the dense middle gets small
cells. Each leaf cell draws its stars from a Poisson count seeded by a hash of the cell's address. Each star's mass,
age, metals, companion, name and planets are seeded by its own id. The same place always gives the same stars;
nothing is saved except what the player changes. Finding the ~7,500 stars within 15 pc of a point in the
outskirts takes under 0.1 s.

### Stars

- **Masses:** the Kroupa initial mass function, 0.08–120 suns.
- **Lives:** main-sequence lifetime 10 Gyr × M^−2.5. Luminosity and radius come from the usual power laws.
  Temperature follows from both, and the spectral class from the temperature.
- **Deaths:** older than its lifetime, a star is a giant for a short while. After that it becomes a white dwarf
  (initial-final mass relation, then cooling), a neutron star (8–25 suns at birth) or a black hole.
- **Companions:** about 20% + 25% × mass, so roughly 44% for Sun-like stars and a quarter of red dwarfs.
- **What comes out**, over 40,000 stars: no O or B stars still burning; red dwarfs about 74%, K 13%, G 2.6%, F and A
  under 0.5% (the younger population); white dwarfs 8%, giants 0.5%, neutron stars 0.6%, black holes 0.1%. This is an
  old galaxy: hardly a blue star in it.

### Planets

- **How many:** most stars have planets (95% of Sun-like, 80% of red dwarfs, 15% of white dwarfs, 2% of neutron
  stars). The *number* per system follows the WOS map (below): 1 to 13, mean 6.7. That's richer than Kepler counts
  but better for a game.
- **Where:** the innermost at 0.025–0.075 AU × M^(1/3), each next 1.4–2.3 times further out.
- **What:** rocky inside the snow line (2.7 AU × √L), ice worlds and giants outside it. Giant planets get commoner
  with metals (about 10^(2[Fe/H])) and with star mass.
- **Radius from mass:** Chen & Kipping (2017) found R ∝ M^0.28 for Terran worlds, M^0.59 for Neptunian worlds and
  M^−0.04 for Jovian worlds. Density, escape velocity and gravity follow from mass and radius.
- **Temperature:** equilibrium temperature from the star's light (albedo 0.3), then a greenhouse effect from the
  atmosphere's thickness. An atmosphere stays where escape velocity beats what the heat would boil off (Earth 11.2
  km/s keeps one; Mars at 5 km/s is a toss-up).
- **Habitable zone:** Kopparapu et al. (2014). The inner edge is the runaway greenhouse; the outer edge is the
  maximum greenhouse. Both are fits in the star's temperature. For the Sun they give 0.95–1.67 AU.
- **Earth Similarity Index:** Schulze-Makuch et al. (2011), from radius, density, escape velocity and surface
  temperature. The weight exponents are 0.57, 1.07, 0.7 and 5.58, so temperature counts most. The model gives Mars
  0.70.
- **Planet types:** from the physics, using WOS's names for the kinds of world: Gas, Barren, Exotic (crushing or
  very hot), Desert, Tundra, Ocean, and the living ones (Terra, Forest, and EarthLike for ESI 0.9 and up).
- **Rings, atmospheres by type, and resources** follow the WOS statistics. Resources other than iron and copper
  are scaled by the star's metals, so the metal-rich middle is richer.

### The galactic habitable zone: close passes

A planet's climate, and any life on it, needs its orbit left alone for billions of years. A star passing within
about 20 AU (scaled by √L) can wreck it. The model counts such passes from the local density and speeds, including
gravitational focusing, and takes the chance of none in 4 Gyr. For a Sun-like star, that chance is:
- **under 1%** inside 60 pc of the centre;
- **50%** at 160 pc;
- **90%** at 315 pc;
- **99%** at 650 pc.

27% of all stars sit inside the 50% line. So the bright middle is sterile and full of metals, and the quiet
outskirts are where life is. That fits the debate on whether ellipticals are good for life. Dayal et al. (2015)
argued that metal-rich giant ellipticals could host ten thousand times as many habitable planets as the Milky Way.
Whitmire (2020) answered that large ellipticals were much more compact in the past, and that their high metals
favour gas giants. The model has both effects: metals raise giant-planet rates, and density sets the quiet zone.

### The Drake equation

The equation is N = R* · fp · ne · fl · fi · fc · L. An old elliptical makes almost no stars now, so the model
counts stars rather than a formation rate: N = N* · fp · ne · fl · fi · fc · (L / T). It measures fp and ne on the
galaxy itself and chooses the rest. For comparison, Kepler-era work puts fp near 1 and ne around 0.4 for Sun-like
stars.

| Term | Value | From |
|---|---|---|
| N* | 7.95×10^9 | the model |
| fp | 0.76 | the model (stars with planets) |
| ne | 0.40 | the model: liquid-water worlds with ESI ≥ 0.8 that stay undisturbed for 4 Gyr, per star with planets |
| fl, fi, fc | 0.5, 0.01, 0.2 | chosen (nobody knows them) |
| L / T | 180,000 years / 10 Gyr | chosen |
| **N, alive now** | **≈ 43** | |
| Earlier civilisations | ≈ 2.4 million | N × T / L |

- **Factions:** the civilisations alive now are the game's great powers: 46 of them, in six clusters of six to
  eight (see "The great powers"). L, the lifetime, was set at 180,000 years to give about that many (90,000 when the galaxy had twice
  the stars). The number of
  earlier civilisations (N × T / L) doesn't depend on L, so the ruins are unchanged.
- **Ruins:** the earlier civilisations left ruins. Each one is counted in about ten systems, giving a ruin in about
  1 star system in 330.

The Drake factors are the main tuning knob. Changing fi, fc or L changes how crowded the galaxy is.

## What the WOS Galaxy Map gives (statistics only)

`tools/wos-stats.py` reads the WOS Galaxy Map's data (Waste of Space's universe, in RudolfOS's desktop). It writes
only distributions to `wip/emberreach/wos-stats.js`: no names, coordinates or individual objects. Every name in
Ember Reach is made by its own name generator.

| From WOS | Used for |
|---|---|
| Planets per system (987 systems: 1–13, mean 6.7) | how many planets a system has |
| Rings by type: gas giants 71%, rocky 18–22%; ice or stone | rings |
| Resources by type: iron and copper on every world, uranium on about 63%, most others 38–46%, beryllium only and always on barren worlds | what can be mined where |
| Gravity per type: 0.15–1.53 g (Roblox's 196.2 is one Earth g) | a sanity range for the physics |
| Temperature per type (WOS's own scale: EarthLike 60, tundra −30…30, desert 80…150, gas −400…−100) | matching type to temperature; roughly WOS° ≈ 1.65 × (K − 288) + 60 |
| Machine worlds (RobotDepot and RobotFactory: 1.5% of planets) | compared only; ruins use the Drake rate instead |
| Star mix (red 33%, orange 21%, yellow 15%, blue 13%, asteroid fields 10%, black holes 6%, neutron 2%) | compared only: an old elliptical has almost no blue stars, so physics decides |

**Where the physics departs from WOS.** WOS gives every planet type about 10%. The physics makes airless barren
worlds about half of all planets and living worlds about 2%. The game keeps the physics: a living world is a find.
WOS's flat mix stays available as a "rich galaxy" setting if playtests find the galaxy too bare.

## The game

### Three scales of travel

1. **Flight:** Newtonian under the hood, flown like Oolite with flight assist; for combat, docking and landing
   approaches. Speeds in m/s to km/s. See "Flight" below.
2. **Cruise:** within a system, a warp whose speed is the distance to the nearest surface per second (up to 200 c),
   so it spools up in open space, slows on its own near planets, stars and ports, and never hits one; crossing an
   AU takes about a minute. It needs 3 s to charge, can't engage within a port's 20 km mass lock, and drops out
   at the target (or near anything it gets too close to, a star from three of its radii). Dropping out above
   300 km/s is an emergency drop that knocks the ship's modules. (`scene.js`.)
3. **Jump:** star to star. Range 1–10 pc (up to 20 on the longest-legged ships), depending on the drive and its
   fuel. Fuel is a tank: a jump at full range burns a quarter of it, a shorter one less, by the square of the
   distance; a lane leg burns 8%. (`travel.js`.)
   - In the outskirts a jump crosses one or two neighbours. In the Glow there are dozens within reach. In the core
     there are thousands.
   - Jump accuracy suffers where stars crowd: the core is hard to navigate. A misjump locks onto a neighbour of the
     target, with a chance set by how many stars sit within 0.05 pc of it: about 56% in the core, 9% in the Glow,
     practically never in the outskirts.
   - **Ports** (`travel.js`): a capital has a Halo; a power's other systems with a living world a Lantern; most
     others with planets a Trefoil outpost, and most contested ones a Trefoil forward base under today's holder.
     Unclaimed space has none. An enemy's port won't let you dock.
   - **Routes:** hops of best progress, each within range (fast even in the Glow, where tens of thousands of stars
     are within reach), or through the lanes when that takes fewer jumps.

   - **Lanes:** the great powers keep relay beacons that allow long jumps (up to about 50 pc) between their own
     systems and their allies'. As built: a power's capital and hubs about 25 pc apart through its own space, never
     in contested space (so the fronts cut them): 499 beacons in all. Within a cluster, capitals are from 4.5 pc (the Hearth) to 171 pc (the Rim) apart,
     so lane travel is quick. Enemies' lanes are closed to you, and fronts cut lanes.
   - **The long lanes:** between clusters (677–1,714 pc apart), old relay chains make jumps of about 100 pc, so
     a crossing takes 7–17 jumps. Free ports, nomads and syndicates live along them; whoever keeps a long lane
     open is worth knowing.

### Flight

Ships fly like Oolite: pitch and roll on the stick, a little yaw, and a throttle that sets a speed. Underneath,
the physics is Newtonian. Every ship, the player's and every NPC's, has **flight assist (FA)** as standard. FA
drives the ship's RCS (linear thrusters) and ACS (attitude thrusters) so that it handles as if it were swimming in
a fluid, not floating in empty space. Pilots who want raw Newtonian flight can switch it off.
(`wip/emberreach/flight.js`, 19 checks in `tests/emberreach_flight_t.js`.)

**FA on: swimming.**
- **Stick:** sets a turn rate, reached in a fraction of a second. Let go and the turn stops.
- **Throttle:** sets a speed, from 30% in reverse to 100% ahead. Throttle to zero and the ship comes to rest.
- **The path follows the nose:** FA kills side-slip as it happens, like a keel or a fish's body. In a hard turn the
  slip stays under 2°.
- **Turns widen with speed:** FA can't use more thrust than the thrusters have. Above the best turning speed it
  holds pitch and yaw to what the side thrusters can bend the path through (radius = speed² / side thrust), so
  the ship carves wider arcs rather than sliding. Roll isn't held back, because it doesn't bend the path.
- **Strafing:** up to 30% of top speed sideways or vertically, for docking and dodging.
- **Spinning frames:** near a station, FA flies relative to it, matching its drift and its spin (with
  feed-forward for the centripetal and Coriolis terms). So at a spinning port, "hold still" means "turn with the
  port". The thrusters still set the limits, which is what makes a fast-spinning Trefoil harder to dock at than a
  Halo with its still dock (see the station classes on the design canvas).

**FA off: Newton.**
- The stick fires the ACS directly: a turn keeps spinning until you counter it.
- The throttle fires the main drive (or the retros); the strafe controls fire the RCS. With no thrust the ship
  coasts, and turning the nose doesn't change where it's going.
- **The trade:** the full turn rate is there at any speed, so you can point the guns anywhere while sliding past.
  Coasting costs nothing, where FA keeps working the thrusters (FA reports its `effort`, which may feed heat and
  fuel later).
- Switching FA back on catches a drifting, tumbling ship and brings it to the commanded state.

**The thrusters, from the ship's stats.** The stock ships' speed, agility and length set everything, so all 40
fly correctly without hand tuning:
- **Main drive:** reaches top speed in 4 s × (length / 10 m)^0.3. **Retros:** half the main drive, so braking
  takes about twice as long as speeding up.
- **Turn rates:** pitch = agility, roll = 2 × agility, yaw = ½ × agility (Oolite's balance: roll and pitch to
  manoeuvre, yaw to fine-tune). The ACS reaches full rate in 0.3 s × (length / 10 m)^0.3.
- **Side thrust:** sized so that every ship turns best at **40% of its top speed** (its "blue zone"): full pitch
  rate up to there, wider turns above. The turning thrusters are strong; the main drive (speeding up) and the
  retros (braking) are what's short.
- The physics steps at a fixed 60 Hz and is deterministic, so NPCs, replays and any later multiplayer agree.

How some stock ships handle:

| Ship | Length | Top speed | Main drive | Side thrust | 0 → 95% | Stop | Best turn | 180° there | Turn radius at top | 180° at top |
|---|---|---|---|---|---|---|---|---|---|---|
| Wren (shuttle) | 9 m | 220 m/s | 5.8 g | 12.9 g | 4.5 s | 10 s | 88 m/s | 2.6 s | 450 m | 6.4 s |
| Kestrel (fighter) | 12 m | 320 m/s | 7.7 g | 28.4 g | 4.9 s | 12 s | 128 m/s | 1.7 s | 432 m | 4.2 s |
| Dart (interceptor) | 10 m | 380 m/s | 9.7 g | 39.1 g | 4.6 s | 11 s | 152 m/s | 1.5 s | 443 m | 3.7 s |
| Packet (light hauler) | 28 m | 210 m/s | 3.9 g | 7.9 g | 6.3 s | 14 s | 84 m/s | 4.0 s | 668 m | 10 s |
| Sovereign (battlecruiser) | 520 m | 170 m/s | 1.3 g | 1.7 g | 15 s | 34 s | 68 m/s | 15 s | 2.0 km | 37 s |
| Monolith (battleship) | 1.9 km | 85 m/s | 0.4 g | 0.2 g | 22 s | 47 s | 34 m/s | 60 s | 4.1 km | 2.5 min |

**Controls.** On keyboard and mouse, controller and touch alike: pitch and roll on the stick (or mouse), yaw on
a pair of keys or a second axis, the throttle on an axis or keys, strafe on a hat or keys, and one button to switch
FA, shown on the HUD. NPCs fly with FA on, through the same model and the same controls. As built (`play.js`):

| Keyboard | Gamepad | Touch | |
|---|---|---|---|
| ↑ ↓ or W S, ← → | left stick | the stick, bottom left | pitch (↑ noses down), roll |
| A D | right stick, LB / RB | | yaw |
| R F, X | triggers | the slider, bottom right | throttle up / down; X to zero |
| J L I K | right stick (vertical), d-pad | | strafe |
| Z | B | FA | flight assist |
| C | Y | CRUISE | cruise |
| T or Tab | X | TARGET | next target |
| N | A | DOCK | docking clearance |
| V, O, M, H, P or Esc | Back, Start | VIEW, II | chase view, internal systems, mouse flight, help, pause |

**Docking** (`scene.js`): ask for clearance within 10 km (a pad is assigned), then fly through the dock mouth on
the port's axis, nose in, under 60 m/s. At a spinning port (Trefoil, Bloom) the ship must also turn with it, within
0.08 rad/s; flight assist does that inside 8 km of the port. Without clearance, too fast, off the axis or not
turning with the port, the mouth turns you away (and hitting it hard hurts). The port's parts are solid, its ring
and spokes turning, and collisions damage modules by how hard they are.

### Regions

Distances are ellipsoidal radius from the centre. **Galactic north** is the short axis, the pole.
- **The Core** (inside 30 pc): stars a few thousand AU apart, constant close passes, the black hole. The endgame:
  the richest resources and the most ruins, from an earlier era when the centre may have been calmer. The most
  dangerous flying.
- **The Glow** (30–450 pc): dense and metal-rich, sterile at its heart (inside about 160 pc). Many white dwarfs and old giants, rich mining,
  little law. Criminal syndicates and prospectors, and one cluster against the odds: the Hearth, at 60 pc.
- **The Inner Reach** (450–1,000 pc): quiet enough for life, still busy. Prospectors' claims, frontier, and one
  cluster (a Reach, at 812 pc).
- **The Middle Reach** (1,000–2,000 pc): quiet, living worlds. Three clusters (the North and two Reaches).
  Elsewhere, wide open: nomads, ruins, unclaimed living worlds.
- **The Outer Clouds** (beyond 2,000 pc): a thin halo of old stars, 2 to 3.5 pc apart. Nomad fleets, deep
  ruins, the loneliest flying, and the Rim cluster at 2,157 pc.

### Exploration

`wip/emberreach/explore.js` (13 checks in `tests/emberreach_explore_t.js`).

- **The sweep:** arriving in a system, the sensors sweep it for 8 s and chart it: the star and every planet's type.
- **Surveys:** fly within 6 radii of a targeted planet for 12 s to survey it: gravity, temperature, atmosphere,
  Earth similarity (ESI), resources, life and ruins. The target panel shows the progress, then the findings.
  Both need working sensors and power.
- **First discoveries:** the great powers have charted their own claimed and contested space, and every system with
  a port. Elsewhere the first survey is yours, and so is any ruin away from a port, even in claimed space. A living
  world or a ruin you found first can be named (2 to 24 letters, digits, spaces, apostrophes and hyphens) at any
  port's Universal Cartographics; the name shows wherever the planet does.
- **Selling data:** Universal Cartographics buys each chart and survey once, in the port's coin (in SU through free
  traders at contested ports, at their 8% cut). A system chart is 40 SU. A survey pays by type, from 90 SU (barren)
  to 900 SU (forest and terra worlds), times (1 + ESI). Life adds 1,500 SU, ruins 6,000 SU, and a first discovery
  pays 2.5 times. Selling pleases the port's holder a little.
- **Ruins** (about one system in 330): coming within 25 radii of a ruin's world wakes its old defences, two to four
  sentinels that attack anyone. Surveying a ruin turns up a cache: two to four canisters of Artefacts drift up, to
  scoop through the hatch.
- **Contracts:** a port's cartographers offer surveys of worlds in nearby systems you haven't charted (within
  8 pc), and now and then a ruin rumoured within 20 pc. Each is due in 20 days, paid in their coin, and they count
  towards the three missions you can hold.
- The star map says which systems you've charted, and which unclaimed ones are uncharted.
- The record is in the save (charts, surveys, what's sold, names).

### Trade

- **Goods:** the WOS resource set (iron, copper, coal, lead, titanium, uranium, jade, gold, diamond, beryllium,
  aluminium), plus refined and manufactured goods, food from living worlds, and artefacts from ruins.
- **Prices:** set by supply and demand per faction and station. Metals are cheap in the Glow and dear in the
  Middle Reach; food is the reverse. Each great power prices in its own currency (see "Money"). Distance and danger make the margins.

### Combat

`wip/emberreach/combat.js` (15 checks in `tests/emberreach_combat_t.js`) and `encounters.js` (14 checks in
`tests/emberreach_encounters_t.js`).

- **Weapons,** one per hardpoint, by size, fixed forward with a 5° gimbal (capital ships' are turrets):

  | Size | Weapon | Damage × rate | Speed, range | Notes |
  |---|---|---|---|---|
  | Small | Pulse laser | 1.2 × 6/s | 4 km/s, 2.5 km | heat; 1.2× against shields, 0.7× against hulls |
  | Medium | Mass driver | 4.5 × 2/s | 1.5 km/s, 3 km | 150 rounds; 0.6× shields, 1.3× hulls; and a pylon of 4 missiles |
  | Large | Heavy laser | 9 × 1.5/s | 3.5 km/s, 4 km | heat |
  | Huge | Torpedo rack | 150 × 0.2/s | 0.4 km/s, homing | 8 torpedoes, launched with the missiles |
  | (pylon) | Missile | 30 | 0.6 km/s, homing | needs a lock: the target 2 s inside a 15° cone |

  Tuned so a duel between fighters lasts about a minute. Lasers heat the ship: past full the guns lock until it
  falls to 60%, and staying past 115% cooks the modules. Six **flares**: each decoys a missile chasing you with a
  70% chance.
- **Shields and hull:** hits meet the shields first; they come back over 15 s after 2.5 s without a hit, if the
  shield generator and power plant work. What gets through hits the hull, and 60% of it lands on the modules. At no
  hull the ship is lost. The hull's health and the magazines carry over between flights; ports repair and restock.
- **AI pilots** fly the same flight model with flight assist, through the same controls: attack (lead the target,
  roll into the turn, match its speed near 600 m, fire when the nose is on), jink when hit, break off when too close,
  flee when badly hurt (pirates at 30% hull, navies at 15%; traders always), patrol, trade, or hold station
  (flagships, with turrets).
- **Who you meet** on arriving in a system, drawn from the star, the day and the visit:
  - a port's patrol of its own navy (more at a capital) and some traders;
  - pirates: 50% of arrivals in unclaimed space, 45% on the fronts, 18% in claimed space, 4% at capitals, and 90%
    where a criminal gang's dreadnought lies that season;
  - war wings of both sides in contested systems where the fighting is (and sometimes elsewhere on the front),
    which fight each other;
  - small factions' fleet carriers and dreadnoughts, where they are that season;
  - what your war missions bring: three enemy ships to destroy, or a depot and its guard.
- **Who shoots:** pirates attack anyone not Allied with their gang; a power's ships attack its enemies (Unfriendly
  pilots, and pilots commissioned against it); patrols attack the wanted; anyone attacks who's been shot at, and
  their wing with them. Firing on a ship that wasn't hostile is a crime.
- **What it costs:** a pirate's death pays a bounty of 1% of its value in the local currency and pleases the space's
  owner (the gang minds). Killing anyone else angers their faction and, if they never shot first, puts a bounty on
  you, and a wanted pilot can't dock where the patrol is. In a contested system, killing a side's ships counts as war
  effort for the other.
- **Controls:** L or the left mouse button fires; K launches a missile at a locked target; B drops a flare; U
  targets the nearest hostile. A gamepad's RT fires and LT launches (the right stick's other axis is now the
  throttle); touch has FIRE, MSL, FLARE and HOSTILE buttons.
- **The HUD:** the scanner (ships within 8 km, hostile red, friendly green, civilian grey, missiles white, on
  stalks above and below your plane; gone with the sensors), shields, hull and heat with rounds, missiles and
  flares, red brackets and a lead pip on a hostile target, its shields and hull, the missile lock closing in, a red
  edge when you're hit, and a MISSILE warning.
- Hostile ships within 5 km hold you out of cruise.
- **Old defences around ruins:** sentinels (see "Exploration").

### Cargo hatch and canisters

`wip/emberreach/canisters.js`, with the trim in `flight.js` (11 checks in `tests/emberreach_canisters_t.js`).

- **Canisters:** goods loose in space are cargo canisters, one tonne of one good each, drifting and tumbling. They
  break up after 15 minutes. Wrecks leave them: a trader 3 to 8 (mostly one good, up to half its hold), a pirate up
  to 3, a navy ship sometimes a tonne of Munitions, a depot 4 to 8 tonnes of Munitions. They show on the scanner and
  can be targeted.
- **The hatch:** every ship with a hold has a cargo hatch on its belly, opened and shut by the pilot (I, or HATCH on
  touch). Open, the ship drops into its **scooping trim**:
  - the hatch's drag slows the ship (it loses 63% of its speed in 1.5 s, flight assist or not);
  - flight assist holds it to 12% of top speed (pushing against the drag, so the set speed is the speed);
  - the stick turns at 40% of its rates, for fine work.
  A canister that drifts into the hatch at under 20 m/s relative to the ship comes aboard if the hold has room.
  Scooped goods cost nothing, so they lower the hold's average price. The hatch shuts itself for cruise and jumps.
- **In combat** it's the hatch that takes hits, not the hold. A broken hatch is stuck open: the ship stays in its
  scooping trim, it can't scoop (the mechanism is wrecked), and the hold spills a tonne every 8 s, the commonest good
  first, as canisters drifting off behind. Ports repair it.

### Modules and damage

Every ship carries the same core modules, each with its own health pool, shown on the **internal-systems HUD**
(`wip/emberreach/modules.js`, 15 checks in `tests/emberreach_modules_t.js`). A pool is a share of the hull's
points (at least 10), and a hit lands on a module in proportion to its size. A module at zero health is
**inoperable** until it's repaired at a station (or by a repair tender).

| Module | Share of hull | When it's inoperable |
|---|---|---|
| **Power plant** (critical) | 16% | Everything powered goes dark: no thrust, no turning, no jump, no shields. The ship drifts. |
| **Engines** (critical) | 14% | No main drive. The RCS can still push, at strafe speed. |
| **Hyperspace drive** (critical) | 12% | No jumps. |
| Canopy | 6% | The pilot feels g-forces (below). |
| RCS thrusters | 8% | No strafing or braking, and flight assist can't hold the path: turns at speed slide. |
| ACS thrusters | 8% | No turning; a spin already going can't be stopped, even with flight assist. |
| Shield generator | 10% | No shields: they take no hits and don't come back. |
| Life support | 8% | (Later: a clock before the pilot passes out.) |
| Sensors | 6% | No scanner. |
| Weapons (armed ships) | 6% | The guns and missiles don't fire. |
| Cargo hatch (ships with a hold) | 6% | Jammed open: the ship is held to its scooping trim, can't scoop, and the hold spills a tonne every 8 s (see "Cargo hatch and canisters"). |

So a Wren's canopy has 10 points and its engines 13; a Kestrel's 10 and 18; a Monolith's 6,480 and 15,120.

**G-forces.** The canopy is more than glass: while it holds, its field takes the g-forces and the pilot feels
none, which is why fighters can turn at up to 39 g (see "Flight"). Once the canopy breaks, the pilot feels everything
the thrusters do (`gForce`), and above 4 g strain builds (`wip/emberreach/pilot.js`, 10 checks in
`tests/emberreach_pilot_t.js`):
1. **The view blurs.**
2. **It goes dark from the edges inward.**
3. **The pilot blacks out.** The steering, throttle and every other control stop answering: the stick goes
   neutral and the throttle stays where it was. With flight assist on, the ship stops turning and flies straight
   on at that speed; with it off, it keeps tumbling and thrusting.
4. **The pilot comes round** once the g has eased off and they've been out at least 4 s, waking groggy: blurred,
   dark at the edges, clearing over a couple of seconds.

How fast strain builds depends on how hard the pull is: (felt g − 4) / 16 per second, so 8 g blacks a pilot out
in 4 s, 12 g in 2 s and 20 g in 1 s. Below 4 g the strain falls by 0.15 a second. For example, a Kestrel with a
broken canopy pulling full pitch at 128 m/s (25 g) blurs at 0.3 s, darkens at 0.5 s and blacks out at 1.0 s;
the pilot wakes at 5.0 s and sees clearly again at 7 s. At 48 m/s (9 g) a pilot who lets go after 2.5 s gets
the blur and dark edges but stays awake. Repair the canopy and the protection comes back. These are starting
values for playtests.

**The alert.** When a module breaks, the HUD shows it at once:
- **Top left:** a screen with the ship's 2D side profile, the broken module flashing on it.
- **Below it:** a textbox in the style of a command console: `> CANOPY INOPERABLE`.
- **The icon:** an `!` in a triangle. **Orange** for most modules; **red** for the critical ones (power plant,
  engines, hyperspace drive).
- With several modules down, critical alerts come first. The mockup is on the design canvas ("Ship HUD").

### Factions

See "Factions, wars and money" below.

### Saves

Only the player's own changes are saved: ship, cargo, credits, reputation, discoveries and names, visited systems,
and market drift. The galaxy is rebuilt from the model every time. Saves go through rudolfd with export and import,
like every Library game.

## Factions, wars and money

The model is in `wip/emberreach/factions.js`, `economy.js`, `reputation.js` and `ships.js` (51 checks in
`tests/emberreach_factions_t.js`, 15 in `tests/emberreach_ships_t.js`). The viewer's first panel shows each
cluster in 3D.

### The great powers: six clusters

- **How many:** 46 great powers in **six clusters** of six to eight (at least six per cluster, `MIN_CIVS`). That
  agrees with the Drake equation's ≈ 43. All are interstellar.
- **Why clusters:** in the lore, each cluster is a shared cradle. Its peoples arose within a few dozen parsecs of
  each other, which is why they met, traded and went to war. Between the clusters lie hundreds of parsecs of space
  where nobody lives: nomads, ruins, prospectors, criminals and the unexplored.
- **Where the clusters are:**
  - **the North:** around the North Point, straight up the pole, 1,500 pc out. This is the northern Middle Reach,
    midway between the Core and the Outer Clouds.
  - **the Hearth:** 60 pc from the centre, just outside the Core (which ends at 30 pc). It sits in the crowded,
    harsh Glow, where stars are about 14,000 AU apart.
  - **the Rim:** 2,157 pc out in the Outer Clouds. Stars there are about 2.3 pc apart: within reach of most jump
    drives, and the powers' relay lanes cover their own space.
  - **three Reaches:** 812, 1,556 and 1,645 pc out.
  - A seeded search placed them so the distances between clusters are as even as the Hearth and the Rim allow:
    677–1,714 pc, varying by about 22%.
- **How much they hold:** each power's space is sized by its **systems**: 8,000–14,000 by its age, not a
  distance. So territories are a couple of parsecs across in the Hearth, and tens of parsecs at the Rim.
  - A power on the outside of its cluster would otherwise sprawl into the empty side, so claims are re-sized until
    each power's space comes to its count.
  - A power with fewer than two neighbours to fight aims for a fifth more each round until it has them (today none
    needs it).
  - Counted by sampling, the 46 powers hold about **392,000 systems** and contest **129,000** more: **521,000 in
    all**, 0.007% of the galaxy's 7.9 billion. Each power has 8,543–13,995.
- **Homes:** each power is a **species** of its own. Its home is a real star, one a player can fly to, on a living
  world with ESI ≥ 0.75. There's a fallback where life is too hard: a water world that held on, or a rocky world
  with air (a people who built their own shelter). Today every home found a living world, even in the Hearth.
  - Homes sit at least 0.85 claims apart, within about 1.6 claims of their cluster's centre, so neighbours' claims
    meet.
  - Some chance in the pick makes the homes differ: 0.5 g to 1.4 g, 6 °C to 46 °C in the North alone.
- **What a home shapes:**
  - its world's gravity sets ship build (heavy, balanced or light);
  - its sun sets senses (infrared under red and orange suns, ultraviolet under hot ones);
  - a seeded military and economy set strength.
- **Space:** each power's claim is strongest at home and fades to nothing at the edge. Every point belongs to **one
  power at most**: the strongest claim there. Borders never overlap, allies' included. Borders are surfaces in three
  dimensions.
- **Contested space: a quarter of each power, along its enemy borders.** Exactly 25% of each power's systems are
  contested: the systems on its side of its borders with its enemies, from the border inward.
  - **Measuring depth from the border:** for each point in a power's space, the model takes its strongest rival in
    the cluster, counting that rival's pull even beyond its reach. If the rival is an enemy, the point's depth is
    how far it lies from the surface where the two would be equal.
  - **Each side has its own depth,** solved by bisection (on a fixed, star-weighted sample of the cluster) so that
    side's power comes to 25%.
  - **The contested systems are the contested region:** a war's zone is its two sides' contested systems together.
  - **No zone outgrows its fighters:** no zone holds more systems than either power fighting over it holds outright.
    A zone that would is trimmed on its larger side, and that power's depth is solved again with its other borders.
  - The result: all 46 powers at 25% (21–29% in an independent recount), and no zone over its cap.

| Cluster | Where | Stars per pc³ | Powers | Homes span | Wars | Systems held | Contested | Contested share |
|---|---|---|---|---|---|---|---|---|
| **North** | 1500 pc out, 90° N | 0.056 | 8 | 97 pc | 13 | 67,258 | 21,865 | 25% |
| **Hearth** | 60 pc out, 9° N | 5.7e+2 | 8 | 4.5 pc | 11 | 67,251 | 21,862 | 25% |
| **Rim** | 2157 pc out, 42° N | 0.014 | 8 | 171 pc | 11 | 65,698 | 21,505 | 25% |
| **Ulensenilon Reach** | 812 pc out, 33° S | 0.516 | 8 | 55 pc | 11 | 74,687 | 24,768 | 25% |
| **Gemenveo Reach** | 1645 pc out, 18° N | 0.040 | 8 | 134 pc | 13 | 65,454 | 22,590 | 26% |
| **Draulon Reach** | 1556 pc out, 17° N | 0.049 | 6 | 92 pc | 9 | 51,752 | 16,782 | 24% |
| **All six** | | | 46 | | 68 | **392,099** | **129,372** | **25%** |

The North's powers, as the model makes them today (names and numbers come from the seed):

| Power | Species | Home | Currency, coins per SU (day 0) | Allies | Enemies |
|---|---|---|---|---|---|
| Roarvorum Compact | Roarvorumese (light, ultraviolet) | Terra, 0.49 g, 13 °C | roarvorum mark (ROA), 5.50 | Gemiagemaeth Theocracy, Torakaiax Concord | Othumfaax Throne, Astutis Concord, Junenk Throne, Mariaishath Throne, Nyefaorlon Theocracy |
| Othumfaax Throne | Othumfaaxen (heavy, infrared) | Forest, 1.36 g, 43 °C | othumfaax crown (OTH), 3.58 | Junenk Throne, Mariaishath Throne, Nyefaorlon Theocracy | Roarvorum Compact, Gemiagemaeth Theocracy, Astutis Concord, Torakaiax Concord |
| Gemiagemaeth Theocracy | Gemiagemaethese (heavy, visible) | Terra, 1.21 g, 6 °C | gemiagemaeth bead (GEM), 1.41 | Roarvorum Compact, Junenk Throne, Torakaiax Concord, Mariaishath Throne, Nyefaorlon Theocracy | Othumfaax Throne, Astutis Concord |
| Astutis Concord | Astutisians (balanced, infrared) | EarthLike, 1.13 g, 22 °C | astutis sol (AST), 9.32 | Junenk Throne, Torakaiax Concord, Mariaishath Throne | Roarvorum Compact, Othumfaax Throne, Gemiagemaeth Theocracy, Nyefaorlon Theocracy |
| Junenk Throne | Junenkari (light, infrared) | EarthLike, 0.67 g, 24 °C | junenk shard (JUN), 0.57 | Othumfaax Throne, Gemiagemaeth Theocracy, Astutis Concord | Roarvorum Compact, Torakaiax Concord, Mariaishath Throne |
| Torakaiax Concord | Torakaiaxese (balanced, infrared) | EarthLike, 0.90 g, 46 °C | torakaiax talent (TOR), 5.98 | Roarvorum Compact, Gemiagemaeth Theocracy, Astutis Concord, Nyefaorlon Theocracy | Othumfaax Throne, Junenk Throne, Mariaishath Throne |
| Mariaishath Throne | Mariaishathen (balanced, infrared) | EarthLike, 1.03 g, 6 °C | mariaishath sol (MAR), 8.48 | Othumfaax Throne, Gemiagemaeth Theocracy, Astutis Concord, Nyefaorlon Theocracy | Roarvorum Compact, Junenk Throne, Torakaiax Concord |
| Nyefaorlon Theocracy | Nyefaorlonese (balanced, infrared) | EarthLike, 0.83 g, 9 °C | nyefaorlon ingot (NYE), 12.39 | Othumfaax Throne, Gemiagemaeth Theocracy, Torakaiax Concord, Mariaishath Throne | Roarvorum Compact, Astutis Concord |

### Alliances and enmities

- **The rule:** every great power has **at least two allies and at least two enemies** among the others.
- **Enemies must share a border:** at least 15% of the surface where their claims are equal must be theirs alone,
  not buried inside a third power's space.
- **How the arrangement is chosen:** the model searches the possible arrangements in seeded order. It keeps the one
  that meets the rules with the longest borders between enemies and the widest spread between allies.
- **When geography won't fit:** a power with too few neighbours to fight reaches further (its claim grows) until
  the rules can be met. This keeps working if the galaxy changes.
- **Within each cluster:** alliances and wars are among a cluster's own powers. Powers in different clusters are
  too far apart to be allies or enemies; they are neutral.
- **Today:** 68 wars among 46 powers (9 to 13 per cluster); each power has two or more allies and two or more
  enemies.

### Wars: front lines

- **The front:** each pair of enemies is at war over the contested zone between them: hundreds to thousands of
  systems. **24 key systems** with planets, drawn from across the zone in three dimensions, carry the war.
  **Every other contested system goes with its nearest key system:** it's held by whoever holds that key system,
  and fought over while that is. So the map and the markets agree across the whole zone. Each system is linked to its nearest neighbours in the zone. Each has a
  **depth** across the zone, from 0 at one side's rear to 1 at the other's. The fifth of systems nearest each side
  touch that side's own space: its **rear**.
- **Control:** each system's control runs from −1 to +1 (one side to the other). Its sign says who holds it; under
  0.3 either way, it's being fought over.
- **Claims chain from the rear:** a side can take a system only from its rear, or from a system next to it that the
  side holds and supplies. Effort against a system out of reach can wear it down but never take it.
- **Supply and cut-off claims:** a held system is **supplied** while a chain of systems held by the same side runs
  back to its rear. A **cut-off** system is logistically isolated: it defends at a third of its strength, and
  attacks on it count three times. It wears away by 0.18 a season, while supplied systems dig in (up to 0.7).
- **The depth multiplier:** pushing past the middle of the zone towards the enemy's rear gets harder and harder.
  An attacker's push is multiplied by (1 − q)³, where q runs from 0 at the middle to 1 at the enemy's rear. That's
  full strength to the middle, about 1/8 three quarters of the way across, and almost nothing at the far edge. **No
  side loses all of its contested space.**
  - In the checks, one player threw 500 points of effort at every enemy system, every season, for 100 seasons. The
    losing side still kept its rearmost systems.
- **The seasons (natural development):** a season is 30 game days. Each season:
  - supplied systems dig in and cut-off ones wear away;
  - then either a truce (about one season in ten), or one side's offensive (the stronger military more often) on
    1–3 enemy systems it can reach, cut-off ones first.
  - So the front moves for as long as the game runs, both ways. Over 30,000 game days no front collapsed: every
    side kept at least two systems.
- **Players move the front.** Every war mission and every kill in a contested system is kept in the save as dated
  war effort. The front plays it through in the season it happened, under the same rules: chains, supply, depth.
  - **War missions** come from each power's stations:
    - attacks on enemy systems it can reach: recon (+5), blockade (+10), strike (+14), sabotage (+16). Attacks on
      cut-off systems count half again and pay 30% more.
    - defence of its own systems that are being fought over or cut off: supply runs (+6), escorts (+9), holding the
      line (+12).
    - Missions pay in the issuer's currency.
  - **Fighting directly:** each enemy ship destroyed in a contested system adds +3 for the player's side.
  - **A commission** (Friendly or better, and not with that power's enemy) doubles the player's effort for that
    side. The other side then treats the player as a combatant.
- **What a war changes:** who holds a contested system (through its nearest key system) decides its currency, its
  laws and who docks there. A front
  pays up to 60% more for munitions, medicine, fuel and food, and ships cost 40% more there.
- **Speed:** the war without players is cached season by season. Players' effort replays from the season of their
  first deed, in well under a millisecond per season.
- **Multiplayer (later, optional):** the galaxy and the wars are deterministic, so a shared front is only everyone's
  dated war effort played through the same rules. An optional online service could collect it, for a war the
  community moves. Offline, each save's war is its own.

### The map

The star map is **three-dimensional**. You turn it, zoom it, and move from the whole galaxy down to one system.
- Each great power's space is drawn in its colour. No two powers ever share a place.
- **Peaceful borders** between neighbours are drawn as solid surfaces.
- **Contested space** between enemies is drawn with **dashed lines**: the two edges of the zone, as dashed surfaces.
- Inside contested space, the front's systems are drawn in the colour of today's holder, linked along their supply
  chains: solid where supplied, dashed where cut off.
- The viewer's first panel (`viewer.html`) is a working version, one cluster at a time: drag to turn, wheel to
  zoom.

### Smaller factions

44 of them, made from the seed. Most belong to one of the great powers' species; some are mixed.

| Kind | How many | Where | How they move | Flagship |
|---|---|---|---|---|
| **Nomads** | 8 | anywhere in the Middle Reach and Outer Clouds | **nomadic:** 5–8 stops, travelling for 6 days each season, then staying | a fleet carrier (most) |
| **Criminal syndicates** | 16 | on the war fronts (60%) and in the Glow | **rotating:** a new hideout each season, from 2–5 | a dreadnought |
| **Prospector guilds** | 8 | the Glow and the Inner Reach (metal-rich) | **semi-permanent:** a claim held 3–6 seasons, then the next | a fleet carrier |
| **Free ports** | 12 | two in each cluster, between its powers | **fixed** | a station |

- **Flagships** keep their factions self-sustaining:
  - **fleet carriers** (about 1.1–2.1 km long, 12–48 ships in the hangar) carry a market, refinery, repairs, fuel
    and a shipyard;
  - **dreadnoughts** (about 1.5–2.9 km) carry repairs, fuel, a hangar, a black market and an armoury.
  - A nomad fleet's carrier *is* its home, and a syndicate's dreadnought is its moving fortress.
- **Stances:** syndicates are hostile to the great powers; nomads are friendly to their parent species; prospectors
  are sometimes friendly with a power; free ports are neutral.
- **Privateers:** some syndicates are privately backed by a great power and hostile to its enemies.
- **Money:** nomads deal in **fuel scrip**, backed by fuel. Syndicates take any currency, at a cut. Free ports
  change any currency, enemies' included.

### Ships

Forty stock designs that NPCs fly, and players can buy where a yard sells them (`wip/emberreach/ships.js`, 15
checks in `tests/emberreach_ships_t.js`). They range from one-seat shuttles to fleet carriers and dreadnoughts.
- **Who builds them:** a great power's yards in each of the six clusters (two in the North), and three independent
  yards (Brask & Orrel Free Yards,
  the Tamsin Mining Cooperative, Greyhook Salvage Works).
- **Species:** a great power's yards build to its species' bodies. Heavy-bodied builders add 15% armour and lose
  10% agility; light ones lose 10% armour, gain 10% shields and turn 12% faster.
- **Who flies what:** every design lists its pilots (navies, pirates, traders, miners, explorers, nomads, couriers,
  passengers, prospectors, salvagers, bounty hunters, smugglers), so the game puts the right ships in the right
  places. The small factions' fleet carriers and dreadnoughts are the Bastion, Tyrant and Monolith classes.

**Price from the stats.** A ship's list value in SU is:

  120 × toughness^0.95 × √(1 + firepower/20) × (1 + cargo/250)^0.45 × (1 + 0.12 × jump)
  × (speed/200)^0.25 × (turn/40)^0.15 × 1.35^(tech − 1) × (1 + hangar/40)

- **Toughness** is hull + 1.4 × shields. **Firepower** counts hardpoints by size: small 1, medium 3, large 9, huge
  27.
- So twice the armour and shields costs nearly twice as much, each tech level costs 35% more, and range, cargo,
  speed and hangars all add.
- **Yards:** great powers' yards charge 5–15% for their name; independents sell 10% under value. The range runs
  from 90% to 115% of that.
- **In the shops:** prices are in the station's currency at the day's rate. A ship costs list price in its maker's
  own space, +10% at an ally's yard, +25% elsewhere and +40% near a front. Enemies' designs aren't sold.

The catalogue, with prices in SU and in the Roarvorum Compact's mark at home on day 0 (5.50 marks per SU):

| Ship | Size | Role | Yard | Hull / shields | Speed m/s, turn °/s | Cargo t | Jump pc | Guns S/M/L/H | Crew | Tech | Price, SU | In ROA at home |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Wren | XS | shuttle | Brask & Orrel Free Yards | 90 / 40 | 220, 70 | 4 | 2 | 0/0/0/0 | 1 | 1 | 15 k – 20 k | 85 k – 108 k |
| Kestrel | XS | fighter | Roarvorum Compact yards | 126 / 99 | 320, 106 | 0 | – | 2/0/0/0 | 1 | 2 | 46 k – 58 k | 251 k – 321 k |
| Dart | XS | interceptor | Ixemos Directorate yards | 99 / 88 | 380, 123 | 0 | – | 2/0/0/0 | 1 | 3 | 53 k – 67 k | 289 k – 369 k |
| Hob | XS | mining pod | Tamsin Mining Cooperative | 160 / 30 | 150, 50 | 12 | 1.5 | 1/0/0/0 | 1 | 1 | 18 k – 23 k | 98 k – 126 k |
| Gnat | XS | racer | Ulis Concord yards | 92 / 60 | 420, 95 | 2 | 3 | 0/0/0/0 | 1 | 3 | 54 k – 68 k | 295 k – 376 k |
| Spur | XS | bomber | Mariajunumos Republic yards | 180 / 110 | 240, 67 | 0 | – | 0/1/0/0 | 2 | 2 | 48 k – 61 k | 263 k – 336 k |
| Mote | XS | scout | Greyhook Salvage Works | 70 / 50 | 300, 90 | 1 | 4 | 0/0/0/0 | 1 | 2 | 27 k – 34 k | 146 k – 187 k |
| Tinker | XS | repair tender | Astevin Dominion yards | 150 / 70 | 200, 60 | 6 | 2 | 0/0/0/0 | 2 | 2 | 41 k – 52 k | 225 k – 288 k |
| Lark | S | courier | Ixemos Directorate yards | 270 / 242 | 330, 84 | 20 | 6 | 1/0/0/0 | 2 | 3 | 217 k – 278 k | 1.2 m – 1.5 m |
| Packet | S | light hauler | Brask & Orrel Free Yards | 380 / 150 | 210, 45 | 120 | 4 | 2/0/0/0 | 2 | 1 | 80 k – 102 k | 437 k – 559 k |
| Pike | S | gunship | Othumfaax Throne yards | 598 / 300 | 260, 50 | 10 | 4 | 2/2/0/0 | 3 | 2 | 233 k – 298 k | 1.3 m – 1.6 m |
| Finch | S | explorer | Ulis Concord yards | 379 / 260 | 250, 50 | 30 | 9 | 1/0/0/0 | 2 | 3 | 276 k – 352 k | 1.5 m – 1.9 m |
| Burrow | S | miner | Tamsin Mining Cooperative | 480 / 180 | 170, 40 | 160 | 4 | 1/1/0/0 | 3 | 1 | 100 k – 127 k | 547 k – 699 k |
| Shrike | S | heavy fighter | Roarvorum Compact yards | 378 / 352 | 300, 78 | 5 | 5 | 3/1/0/0 | 2 | 3 | 316 k – 403 k | 1.7 m – 2.2 m |
| Jackal | S | raider | Greyhook Salvage Works | 400 / 250 | 310, 68 | 40 | 5 | 2/1/0/0 | 3 | 2 | 163 k – 209 k | 898 k – 1.1 m |
| Wisp | S | stealth scout | Astevin Dominion yards | 280 / 300 | 290, 65 | 10 | 8 | 1/0/0/0 | 2 | 4 | 362 k – 463 k | 2.0 m – 2.5 m |
| Tern | S | passenger shuttle | Voru Collective yards | 315 / 220 | 240, 50 | 30 | 5 | 0/0/0/0 | 2 | 2 | 135 k – 172 k | 741 k – 947 k |
| Drover | M | hauler | Brask & Orrel Free Yards | 1,100 / 500 | 180, 30 | 600 | 5 | 2/1/0/0 | 5 | 1 | 348 k – 445 k | 1.9 m – 2.4 m |
| Corsair | M | multirole | Mariajunumos Republic yards | 1,260 / 990 | 240, 47 | 150 | 6 | 2/2/1/0 | 6 | 3 | 1.2 m – 1.5 m | 6.5 m – 8.3 m |
| Halberd | M | corvette | Othumfaax Throne yards | 2,415 / 1,300 | 230, 34 | 60 | 6 | 3/3/1/0 | 18 | 3 | 1.7 m – 2.2 m | 9.3 m – 11.9 m |
| Seeker | M | long-range explorer | Ulis Concord yards | 1,150 / 1,100 | 220, 36 | 120 | 14 | 1/1/0/0 | 5 | 4 | 1.8 m – 2.3 m | 10.0 m – 12.8 m |
| Delver | M | miner | Tamsin Mining Cooperative | 1,600 / 600 | 150, 28 | 700 | 5 | 2/1/0/0 | 8 | 2 | 624 k – 797 k | 3.4 m – 4.4 m |
| Mule | M | armoured trader | Voru Collective yards | 1,620 / 880 | 170, 34 | 500 | 6 | 2/2/0/0 | 7 | 2 | 981 k – 1.3 m | 5.4 m – 6.9 m |
| Lancet | M | strike craft | Ixemos Directorate yards | 1,080 / 1,210 | 290, 56 | 40 | 7 | 2/3/0/0 | 6 | 4 | 1.5 m – 1.9 m | 8.3 m – 10.6 m |
| Ferry | M | liner | Astevin Dominion yards | 1,300 / 1,000 | 200, 30 | 200 | 7 | 1/0/0/0 | 30 | 3 | 943 k – 1.2 m | 5.2 m – 6.6 m |
| Scavenger | M | salvager | Greyhook Salvage Works | 1,500 / 500 | 170, 32 | 450 | 5 | 2/1/0/0 | 8 | 1 | 384 k – 491 k | 2.1 m – 2.7 m |
| Bulwark | L | frigate | Roarvorum Compact yards | 4,680 / 3,520 | 190, 27 | 300 | 7 | 4/4/2/0 | 60 | 3 | 5.5 m – 7.0 m | 30.3 m – 38.7 m |
| Caravel | L | freighter | Brask & Orrel Free Yards | 4,200 / 1,600 | 150, 18 | 3,000 | 6 | 2/2/0/0 | 20 | 1 | 2.2 m – 2.7 m | 11.8 m – 15.1 m |
| Warden | L | patrol cruiser | Mariajunumos Republic yards | 7,020 / 4,620 | 180, 22 | 250 | 7 | 4/4/3/0 | 90 | 3 | 7.1 m – 9.1 m | 39.1 m – 49.9 m |
| Atlas | L | mining refinery | Tamsin Mining Cooperative | 6,500 / 2,000 | 120, 14 | 4,000 | 5 | 2/2/1/0 | 40 | 2 | 4.5 m – 5.8 m | 24.9 m – 31.8 m |
| Pilgrim | L | deep explorer | Ulis Concord yards | 4,370 / 3,800 | 170, 18 | 600 | 20 | 2/2/0/0 | 30 | 5 | 14.0 m – 17.9 m | 76.9 m – 98.2 m |
| Reaver | L | raider | Greyhook Salvage Works | 5,000 / 2,600 | 210, 24 | 800 | 7 | 4/3/2/0 | 45 | 2 | 3.8 m – 4.8 m | 20.8 m – 26.6 m |
| Wellspring | L | fuel tanker | Astevin Dominion yards | 4,500 / 1,800 | 140, 15 | 2,500 | 8 | 2/1/0/0 | 25 | 2 | 3.7 m – 4.8 m | 20.6 m – 26.3 m |
| Citadel | XL | destroyer (4 in hangar) | Othumfaax Throne yards | 20,700 / 11,000 | 160, 11 | 800 | 8 | 6/6/4/1 | 320 | 4 | 47.5 m – 60.7 m | 261.2 m – 333.8 m |
| Leviathan | XL | bulk freighter | Brask & Orrel Free Yards | 15,000 / 5,000 | 110, 8 | 30,000 | 6 | 3/3/1/0 | 120 | 1 | 18.7 m – 23.9 m | 102.8 m – 131.4 m |
| Sovereign | XL | battlecruiser (6 in hangar) | Voru Collective yards | 23,400 / 17,600 | 170, 12 | 1,000 | 8 | 6/8/5/2 | 600 | 4 | 85.1 m – 108.7 m | 467.9 m – 597.8 m |
| Ark | XL | colony ship (2 in hangar) | Astevin Dominion yards | 20,000 / 9,000 | 100, 7 | 12,000 | 10 | 2/2/1/0 | 3,000 | 3 | 50.1 m – 64.0 m | 275.5 m – 352.0 m |
| Bastion | Capital | fleet carrier (36 in hangar) | Brask & Orrel Free Yards | 90,000 / 40,000 | 90, 4 | 60,000 | 12 | 8/8/4/2 | 8,000 | 4 | 1.63 bn – 2.08 bn | 8.96 bn – 11.44 bn |
| Tyrant | Capital | dreadnought (24 in hangar) | Roarvorum Compact yards | 144,000 / 77,000 | 80, 3 | 8,000 | 10 | 12/12/8/4 | 12,000 | 4 | 1.33 bn – 1.70 bn | 7.31 bn – 9.34 bn |
| Monolith | Capital | battleship (12 in hangar) | Mariajunumos Republic yards | 108,000 / 66,000 | 85, 3 | 5,000 | 9 | 10/10/8/4 | 9,000 | 5 | 854.3 m – 1.09 bn | 4.70 bn – 6.00 bn |

**Starting out:** a new player gets the cheapest jump-capable design their home yards sell under 100,000 SU (the
Ulis Concord Gnat, the Astevin Dominion Tinker), or the independent Wren (44 of the 46 powers). They also get money worth 20,000 SU in their
home currency.

### Money

- **The Standard Unit (SU)** is the game's measure of value: the cost of a fixed basket of goods (iron, copper,
  food, water, fuel, machinery, electronics) at base values. Nobody carries SU.
- **Each great power has its own currency.** Its rate is **coins per SU**, so every currency is tied to what goods
  cost. Today's rates run from 0.45 to 17 coins per SU. A rate moves with:
  - its economy: a base level and a slow drift of up to 2% a year;
  - **trade cycles:** two waves of 180–700 days, each up to ±7%;
  - **its wars:** winning contested systems strengthens it, losing them weakens it, up to 10% per war;
  - **shocks** that fade with a half-life: events, and what players do, such as raiding a power's convoys, flooding
    its markets or completing big contracts.
- **Cross rates** come from the rates (coins of B per coin of A = rate B / rate A). Going round three currencies
  returns exactly what you started with, so there's no arbitrage. The only cost is the exchange's spread:
  - 1.5% for a station's own coin; 3% for an ally's; 5% for a neutral's;
  - an enemy's coin is refused. Free ports and black markets take anything, at a cut of about 8–15%.
- **Prices:** a good's price at a station is its base value in SU × the system's supply and demand × the holder's
  rate.
  - **Supply and demand:** what the planets mine and grow, cheaper ore around metal-rich stars, a seasonal swing,
    and what a front needs.
  - **Contested systems** trade in the currency of whoever holds them that day; while they're fought over, only in
    SU, through free traders.

### Reputation and alignment

- **Origin:** a new player chooses which great power to come from, and so which species to play. They start:
  - at its home world, flying with its species' build and senses;
  - with a starter ship (see "Ships") and money worth 20,000 SU in its currency;
  - with standing that follows their people's feuds: Friendly at home (+350), +150 with its allies, −150
    (Unfriendly) with its enemies, neutral elsewhere.
  - Its offshoot nomads like them (+100); syndicates don't (−200), unless their sponsor is the origin.
- **Reputation:** one number per faction, from −1000 to +1000, in five steps: Hostile, Unfriendly, Neutral, Friendly
  and Allied. Actions change it (trade, missions, war missions, kills, smuggling, raids, rescues, surveys). The news
  spreads:
  - the target's allies feel it the same way (40%), and its enemies the other way (40%);
  - small factions feel it by their own stance (25%);
  - syndicates warm to crimes.
- **Alignment:** which great power a player leans to and how far (their share of positive standing), and a second
  axis from **lawful** through **grey** to **outlaw** (bounties earned against crimes committed). Commissions are
  part of alignment too.
- **Bounties:** crimes in a power's space earn a bounty, in its currency.
- **Hostility:** Hostile factions shoot on sight, and so do enemies of the player's commission.
- **Fading:** standing drifts back towards the start, 5% of the gap a season, so old deeds fade.

## Technical

- **Coordinates:** galaxy positions in parsecs, a system's in AU, and flight in metres around a floating origin.
  Each scale is its own frame, so 32-bit floats on the graphics card never see a large number.
- **Renderer:** WebGL 2 with lit, textured meshes, a skybox built from the actual stars around the player (brightness
  from luminosity and distance), and planets with procedural textures from type and colour. The Canvas 2D fallback
  draws flat-shaded polygons, sorted back to front, and a point starfield.
- **The star map:** in 3D (see "The map"). With WebGL, drawn on the graphics card; on the Canvas fallback, as
  lines and points sorted back to front, like the viewer.
- **The sky:** the nearest few thousand stars as points from `starsNear`. Farther away, the galaxy's integrated light
  as a precomputed sky texture: in the Glow, the core fills half the sky.
- **Level of detail, to keep the frame rate up** (`play.js`, `render.js`):
  - **planets and stars** are drawn as one lit sprite (a quad shaded as a sphere; a star flat and bright) until they
    are 48 pixels across, then as a mesh;
  - **stations** are a detailed mesh within 20 km, a simplified one (coarser curves, no trusses, radiators or lit
    windows) out to 500 km, and a sprite beyond;
  - **ships** are always drawn in full, at the player's graphics setting (High or Low, in the pause menu), however
    far away they are. The setting also sets how fine the planet meshes are and how many stars the sky shows.
- **Depth:** logarithmic, with positions kept in doubles and made relative to the camera, so a 9 m ship, a 1.8 km
  port and a planet an AU away draw in one pass.
- **Performance:**
  - generating a system takes under 1 ms;
  - finding the stars within 15 pc takes under 0.1 s, run off the frame loop (a worker where available);
  - with WebGL, 60 fps on any graphics card;
  - on the Canvas fallback on the Vivobook, under about 3,000 polygons per frame.
- **Size:** code and ship models a few hundred KB, sound about 1.5 MB, within 2 MB. In practice the sound is made in
  Web Audio, so it costs a few KB; the flight screen and every model together are about 200 KB.

## Milestones

1. **M0 (this plan):** the galaxy model; the great powers, alliances, front-line wars, small factions, money,
   reputation and the 40 stock ships as models; their checks and the 3D viewer. Done.
2. **M1:** fly a ship in one system, with WebGL and the Canvas fallback; planets, a star and a station to dock at.
   Gamekit controls. **Playable** (`wip/emberreach/play.html`): the home system of any great power from the model,
   its port in any of the four classes, flight with FA, cruise, docking, collisions and module damage, the HUD (with
   the alerts, internal systems and g-strain vision), and level of detail. **Done** with:
   - **sound** (`sound.js`), all made in Web Audio, so nothing to download:
     - the main drive's roar, the thrusters' hiss with every correction FA makes, a cruise drone and the cockpit hum;
     - cues for alerts (orange two tones, red three fast), clearance, docking, collisions, cruise and FA;
     - under g the sound muffles and a heartbeat comes in, and it's nearly silent while blacked out;
     - on and off in the pause menu;
   - **saves** (`save.js`, through gamekit):
     - where you are and how you're moving, the ship's module damage, docked or not, and the settings;
     - saved every 15 s, on docking, launching and pausing;
     - saving to and loading from a file, and New game, in the pause menu;
     - a damaged save starts a new game rather than breaking;
   - **planets** that turn (tidally locked worlds once per orbit, others in 0.4 to 3 days, gas giants faster), tilted,
     with **rings** (Ice or Stone, as the galaxy model gives them) and a rim of **haze** on worlds with air. Ports orbit
     their power's own homeworld, clear of any rings.
3. **M2:** the 3D star map and jumping: the whole galaxy, zoom to a region, plot a route; borders and contested
   space; lanes. The sky from real neighbours. **Playable** in `play.html`:
   - **The map** (G, `map.js`):
     - zooms from the whole galaxy (its shape, a scatter of its stars, the six clusters, the long lanes) to a
       cluster (each power's space in its colour, peaceful borders as solid grids, contested space as dashed
       grids, the fronts' systems and supply chains, the powers' lanes) to the real stars around you, with your
       jump range;
     - pick a star to see who holds it, its port, its planets, its distance and the risk of a misjump;
     - Enter plots a route; turn, zoom and pick by mouse, touch (pinch) or keys.
   - **Jumping** (J): 5 s to charge, out of a port's mass lock, with fuel for the leg; then the tunnel, and you
     arrive near the new star, facing its port. A jump takes a day, a lane leg half a day. A misjump re-plots the
     route.
   - **Systems everywhere:** every star you reach is built from the model, with its port (or none) and its own sky
     of real neighbours. Docking refuels and repairs. A lost ship is replaced at the last port you docked at.
   - **Saves** keep the system you're in, your fuel, your last port and your route's destination (save version 2;
     M1 saves still load).
4. **M3:** trade: markets, cargo, prices, currencies and exchanges, the factions' stations; choosing an origin.
   **Playable** in `play.html`:
   - **Choosing an origin:** a new game opens on the 46 great powers, by cluster, with each one's species, currency,
     capital, allies, enemies and starter ship. You start docked at its capital with 20,000 SU in its currency.
   - **The starport** (`port.js`), the design canvas's layout working for real:
     - the status strip, the services row (refuelling and repairs, paid at the market's prices; restocking waits
       for weapons in M4) and the F1–F9 bar;
     - **Market:** the economy model's prices in the holder's currency, buying and selling (up to what fits and
       what you can pay), with what you paid and the profit if sold here;
     - **Shipyard:** the yard's stock by port class (outposts XS and S, Lanterns up to M, Halos everything; never
       an enemy's designs), bought with your ship in part-exchange, your cargo transferred if it fits;
     - **Contacts:** the authority (bounties), the war office (fronts, enlisting) and the exchange (spreads by
       relation, enemies' coin refused);
     - **Bulletin board:** today's war contracts (taken from M4);
     - **Status:** wallet in every currency, worth, hold, reputation;
     - **Station**, **Outfitting** and **Carto & lounges** screens, the last two pointing to M4 and M5.
   - **Trade** (`trade.js`, 18 checks): wallets in many currencies; free traders at contested systems taking SU
     at an 8% cut; trade reputation; fuel tanks of a few tonnes; repairs at 8% of a ship's value from wrecked;
     ships lost replaced for 5% of their value, the cargo lost with them.
   - **Saves** (version 3) carry the player: money, cargo, reputation, bounties, commission.
5. **M4:** combat and war: weapons, shields, heat, pirates, patrols; war missions, commissions, moving fronts;
   carriers and dreadnoughts. **Playable** in `play.html` (see "Combat"):
   - **Combat** (`combat.js`): weapons by hardpoint, shields, hull damage reaching the modules, heat, homing
     missiles and flares, and AI pilots on the flight model.
   - **Encounters** (`encounters.js`): every system's cast (patrols, traders, pirates, war wings, flagships), who's
     hostile, and what kills cost or pay: bounties, crimes and war effort.
   - **War missions:** taken at a port's bulletin board (up to three, due in 10 days): strike, blockade, defend and
     escort (destroy three enemy ships in the mission's system), recon (30 s there), sabotage (destroy a depot) and
     supply (bring 5 t of Munitions and dock there). Done, they pay in the issuer's coin and their effort moves the
     front (double with a commission); late, they fail and the issuer minds.
   - **The starport:** restocking (munitions at the market's price), repairs that mend the hull too, contracts on
     the bulletin board, the loadout on Outfitting, missions on Status.
   - **Saves** carry the hull's health, the magazines and the missions in hand.
   - **Cargo hatch and canisters** (`canisters.js`): wrecks leave canisters; the hatch (I) opens into the scooping
     trim to collect them; a broken hatch jams open and spills the hold.
   - **Sound:** gunfire, hits on shields and hull, explosions, the missile lock and the incoming-missile warning.
6. **M5:** exploration in full: scanning, surveys, ruins, naming, missions. The package moves to `apps/` and
   reaches the App Store. **Exploration is playable** in `play.html` (see "Exploration"): the sweep, surveys, first
   discoveries and naming, Universal Cartographics, ruins with their sentinels and caches, and survey contracts.
   The move to `apps/` is its own step.
7. **M5b:** colonies: claiming systems and building ports and facilities, after Elite Dangerous's Trailblazers
   (see [plan-ember-reach-colonies.md](plan-ember-reach-colonies.md)). **M5b-1 and M5b-2 are playable:** claims, the beacon,
   the primary port's goods, haulage, and the finished port; then slots, facilities, points, links and the market,
   population and the architect's pay.
8. **M6:** the Core, the black hole, polish; phones (1.6.0).

## Open questions

- The name.
- Whether the WOS "rich galaxy" mix should be an option at all.
- How long jumps take in game time, and whether time matters (factions moving, markets drifting).
- Multiplayer: shared fronts (everyone's war effort added up online, optional) and shared discoveries are
  possible because the galaxy and the wars are deterministic; not before M5.
- The great powers' names: generated today; hand-written names and cultures may suit them better.
- Game time: how long a season feels in play (30 game days; jumps and lanes take days).
- Flight: whether FA-off should have a speed cap (today it has none: the main drive is the only limit). The 40%
  blue zone and the time constants are starting values for playtests.

## Sources

- Hernquist profile, mass inside r, Re = 1.8153 a: [On two mass estimators for clusters of galaxies](https://arxiv.org/pdf/astro-ph/9902166); as a fit to ellipticals: [Mass-to-light ratio gradients in early-type galaxy haloes](https://arxiv.org/pdf/astro-ph/0411639)
- de Vaucouleurs and Sérsic profiles: [Sérsic profile](https://Www.Wikipedia.org/wiki/Sersic_profile)
- M32 and compact ellipticals: [Messier 32](https://en.wikipedia.org/wiki/Messier_32); [M32's velocity dispersion](https://arxiv.org/pdf/astro-ph/0202307); [radial age and metal gradients in M32](https://arxiv.org/abs/astro-ph/0411118); [cE masses and sizes](https://web3.arxiv.org/pdf/2502.20594)
- Habitable zone: [Kopparapu coefficients (Table 1)](https://arxiv.org/pdf/2301.13836); [Habitable Zones Around Main-Sequence Stars](https://alphaxiv.org/abs/1301.6674)
- Earth Similarity Index: [PHL](https://phl.upr.edu/projects/earth-similarity-index-esi); [weights](https://scipython.com/books/book2/chapter-2-the-core-python-language-i/problems/earth-similarity-index/)
- Mass-radius relation: [The mass-radius relation of exoplanets, revisited](https://arxiv.org/pdf/2311.12593)
- Drake equation: [Wikipedia](https://www.wikipedia.org/wiki/Drake_equation); [Kepler-era fp and ne](https://fermi-sim.pages.dev/research-drake.html)
- Ellipticals and life: [Dayal et al. 2015](https://astrobiology.com/?p=12744); [Whitmire 2020](https://www.arxiv.org/pdf/2003.13643)
- WOS data: the WOS Galaxy Map in RudolfOS (`desktop/base_v24.html`), statistics only.
- Oolite's flight: [a Newtonian ship under computer-controlled thrusters, built to fly like Elite](https://bb.oolite.space/viewtopic.php?p=4701); [roll, pitch and yaw controls](https://oolite.readthedocs.io/en/latest/index.pdf); [roll versus yaw](https://wiki.alioth.net/index.php/Roll_vs_Yaw_crusades)
