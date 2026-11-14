# Ember Reach: plan

A 3D open-world spaceflight game about **combat, trade and exploration**, set inside a scale model of a compact
elliptical galaxy. Every one of its 4 million stars (0.2.0; there were ~8 billion before) exists and can be visited. Each star, its planets and their
habitability come from the astrophysics below, not from hand-placed content. "Ember Reach" is a working title.

- **Package:** `rudolf-emberreach` (a Library game), in `apps/rudolf-emberreach/` since the **Single-Player Alpha
  Build (SPAB), 0.1.0**: the publish workflow builds and signs it with the rest, and it's in the App Store's
  Library tab. Its browser test, as the desktop opens it, is `tests/emberreach_t.js`; the models' tests are
  `tests/emberreach_*_t.js`.
- **Status:** the models are done and checked; the game itself is the milestones below.
  - The galaxy: `apps/rudolf-emberreach/www/galaxy.js` (`tests/emberreach_galaxy_t.js`, 25 checks).
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
  - **The flight screen (M1):** `index.html` (it was `index.html`), with `play.js`, `render.js`, `meshes.js` and
    `hud.js`. To open it from a checkout, copy `lib/gamekit/gamekit.js` beside it (the Library's build does); `?port=trefoil|bloom|lantern|halo`, `?ship=kestrel`, `?power=N`,
    `?canvas` for the fallback, `?debug` to break modules.
  - `apps/rudolf-emberreach/www/viewer.html` draws them, the north in 3D.

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
  Temperature follows from both, and the spectral class from the temperature: O, B, A, F, G, K, M, and **L** below
  2,400 K. The lowest-mass stars cool steeply towards the hydrogen-burning limit (about 2,900 K at 0.1 suns, 1,800 K
  at 0.08), so the last of them are L dwarfs, dim and red-brown.
- **Deaths:** older than its lifetime, a star is a giant for a short while; the heaviest (25 suns and up) are
  instead **Wolf-Rayet** stars, stripped by their own winds to hot (50,000–150,000 K), blinding (100,000–600,000
  suns) cores. After that a star becomes a white dwarf (initial-final mass relation, then cooling), a neutron star
  (8–25 suns at birth) or a black hole.
- **Nurseries:** a sliver of stars (0.4% at the centre, fewer outward), drawn on their own so the rest of the
  galaxy is untouched, formed in the last 0.5–5 million years, from the top of the mass function (8–120 suns): the
  only O and B stars still burning, and the Wolf-Rayets. They're too young for companions or life.
- **Companions:** about 20% + 25% × mass, so roughly 44% for Sun-like stars and a quarter of red dwarfs.
- **The class mix:** about half the stars are red dwarfs. A share (27%) of the M dwarfs the mass function makes are
  instead K, G, F and a few A stars of a later generation, young enough to still burn (their own draw; the great
  powers' home stars are kept as they are).
- **What comes out**, over 60,000 stars: M dwarfs 49.5%, K 22%, G 8.7%, white dwarfs 8%, L dwarfs 6.7%, F 3.2%, A
  0.6%, giants 0.55%, neutron stars 0.5%, black holes 0.15%; O and B stars about 0.1% and Wolf-Rayets a few in
  100,000, all from the nurseries.
- **Legacy galaxy:** the great powers, the Drake equation and the ruins' frequency are measured on the galaxy as it
  was before the class mix and the habitability rules, so every power, home and border stays where it was. Five
  powers' homes orbit red dwarfs: they're the rare exceptions below.
- **What the class does to its planets:** the luminosity and temperature set each world's heat, the habitable zone
  (Kopparapu, by temperature), the snow line, and so which types form. Tidal locking goes by the despinning time
  (a^6 / M*^2): a world locks inside about 0.45 AU × M*^(1/3) × (age / 4.5 Gyr)^(1/6), so Mercury's distance for the
  Sun and every habitable-zone world of an M or L dwarf. L dwarfs have planets half the time, and their flares strip
  the air from close worlds (60% inside 0.05 AU); Wolf-Rayets keep planets a tenth of the time, and they and pulsars
  strip every world bare. Changing these left the great powers' homes where they were.
- **Water worlds are a K, G or F star's:** around anything else (flares and locked days for M and L dwarfs, short
  lives and fierce light for A, B and O stars, the dead and the dying) a water world keeps its water only 3% of the
  time; otherwise it dries to a desert or freezes to tundra. Over 90% of ocean, terra, forest and Earth-like worlds
  orbit K, G and F stars. (The five red-dwarf homeworlds are kept.)
- **Companion stars have worlds:** half as often as a lone star of their class, one to three, inside 2 AU of the
  companion, with its own habitable zone; the same rules apply (so a K, G or F companion can hold a water world).
- **Rings** (on gas giants and some rocky worlds): icy where the world's equilibrium temperature is under 150 K,
  never warmer; closer in rocky or metallic, metallic more often around metal-rich stars and close to them. Each
  is moderately or densely strewn (dense: 45% of gas giants' rings, 30% of others'): a dense ring's mining site holds
  96 asteroids instead of 64, still a kilometre and more apart.
- **Moons:** gas giants have one to five, other worlds of 5 Earths and up none to two: small (Earth's Moon's mass and
  down), tidally locked, 5 to 60 planetary radii out, and airless, except a few (under 2% of moons, where it's cold
  enough) with a thick, hazy air like Titan's. They're bodies in their systems: targetable and surveyable, with the
  proximity safety at their surfaces.

### Planets

- **How many:** most stars have planets (95% of Sun-like, 80% of red dwarfs, 50% of L dwarfs, 15% of white dwarfs,
  10% of Wolf-Rayets, 2% of neutron stars). The *number* per system follows the WOS map (below): 1 to 13, mean 6.7. That's richer than Kepler counts
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

- **Factions:** the civilisations alive now are the game's great powers: 12 of them, in two clusters of six (see
  "The great powers"). L, the lifetime, is set at 110 million years to give about that many among 4 million stars
  (0.2.0; 180,000 years gave 46 among 8 billion). The number of
  earlier civilisations (N × T / L) doesn't depend on L, so the ruins are unchanged.
- **Ruins:** the earlier civilisations left ruins. Each one is counted in about ten systems, giving a ruin in about
  1 star system in 330.

The Drake factors are the main tuning knob. Changing fi, fc or L changes how crowded the galaxy is.

## What the WOS Galaxy Map gives (statistics only)

`tools/wos-stats.py` reads the WOS Galaxy Map's data (Waste of Space's universe, in RudolfOS's desktop). It writes
only distributions to `apps/rudolf-emberreach/www/wos-stats.js`: no names, coordinates or individual objects. Every name in
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
(`apps/rudolf-emberreach/www/flight.js`, 19 checks in `tests/emberreach_flight_t.js`.)

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
| Dodo (shuttle) | 9 m | 220 m/s | 5.8 g | 12.9 g | 4.5 s | 10 s | 88 m/s | 2.6 s | 450 m | 6.4 s |
| Thylacine (fighter) | 12 m | 320 m/s | 7.7 g | 28.4 g | 4.9 s | 12 s | 128 m/s | 1.7 s | 432 m | 4.2 s |
| Microraptor (interceptor) | 10 m | 380 m/s | 9.7 g | 39.1 g | 4.6 s | 11 s | 152 m/s | 1.5 s | 443 m | 3.7 s |
| Quagga (light hauler) | 28 m | 210 m/s | 3.9 g | 7.9 g | 6.3 s | 14 s | 84 m/s | 4.0 s | 668 m | 10 s |
| Chimera (battlecruiser) | 520 m | 170 m/s | 1.3 g | 1.7 g | 15 s | 34 s | 68 m/s | 15 s | 2.0 km | 37 s |
| Hydra (battleship) | 1.9 km | 85 m/s | 0.4 g | 0.2 g | 22 s | 47 s | 34 m/s | 60 s | 4.1 km | 2.5 min |

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

`apps/rudolf-emberreach/www/explore.js` (13 checks in `tests/emberreach_explore_t.js`).

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

`apps/rudolf-emberreach/www/combat.js` (15 checks in `tests/emberreach_combat_t.js`) and `encounters.js` (14 checks in
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

`apps/rudolf-emberreach/www/canisters.js`, with the trim in `flight.js` (11 checks in `tests/emberreach_canisters_t.js`).

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

### Outfitting

`apps/rudolf-emberreach/www/outfit.js` (21 checks in `tests/emberreach_outfit_t.js`). A ship is its hull plus its modules, in
four categories; its hold, shields, hull, jump range, fuel, speed and guns come from them.

- **Core modules**, one each, sized to the hull (XS 1 … Capital 6) and graded C (stock), B or A: power plant,
  thrusters, manoeuvring thrusters, hyperdrive (on hulls with a drive), life support, fuel tank (B holds 45% more,
  A 90%) and canopy (reinforced canopies take more punishment).
- **Internal modules** in the hull's internal slots (three on an XS to seven on a capital ship, sizes 1–8; hulls
  built for holds get every bay a size bigger): cargo racks (2.5 t at size 1, four times more each size up),
  shield generators, armour plating, refineries (for mining), relay boosters (+0.35 pc a size, more by grade), and
  two alien modules no outfitter sells: alien relay boosters (+1.5 pc a size) and the alien dimensional phaser
  (size 3, for wormholes). They're built from blueprints (see "Alien blueprints").
- **External modules** on the hardpoints (small, medium, large, huge; a module fits its size or bigger): pulse
  lasers, mass drivers, missile racks (four missiles each), heavy lasers, torpedo racks, mining lasers and tractor
  beams.
- **Utility mounts** (two on an XS to eight on a capital ship): active scanners (warrant, manifest, resource) and
  passive sensors (nav beacon receiver, cartographic sensor, linguistic decoder).
- **Power:** each module draws power; the plant must cover the total, or the fit is refused.
- **Stock loadouts** match the hull's figures: its shields exactly, its hold as near as the racks allow, its guns
  (small pulse lasers, medium mass drivers with the last of two or more a missile rack, large heavy lasers, huge
  torpedo racks), and utility of a nav receiver, a cartographic sensor and, on warships, a warrant scanner.
- **The market:** outposts sell sizes up to 3 (racks 4) in grades C and B; lanterns and blooms to size 5 in all
  grades; halos everything. Prices rise 2.4 times a size and 2.6 / 6.5 times for grades B / A. A module taken out
  goes to storage (any port) or sells for 80%; modules beyond stock add 80% of their price when trading in a ship.
- **Nav beacons:** every system with a port has one, near its main planet on the sunward side. With a working nav
  beacon receiver, a hyperspace jump comes out at the beacon and takes the system's data (charted at once). Without
  one, or with the sensors down, or in a system with no port, you come out near the main star, a safe way off.
- **The cartographic sensor** charts wild systems (the 8 s sweep) and surveys planets; without it you can do
  neither (populated systems still chart from their beacon).
- **Scanners:** a warrant or manifest scanner reads a targeted ship within 3 km in 3 s. A warrant scan shows its
  bounties; killing a wanted ship is no crime, and its warrant pays only if you scanned it (on pirates, a scan adds
  half again from other jurisdictions). A manifest scan shows its cargo, which its wreck leaves. The resource
  scanner reads asteroids (see "Mining").
- **Languages:** each great power's species speaks its own language; small factions speak their species' (mixed
  crews speak trade pidgin, which everyone knows). A linguistic decoder holds 2, 4 or 8 languages by grade (2,500
  SU each to load). Untranslated, a faction's comms are garbled (the docking computer still gets the pad), and its
  ports' market, contracts, yards, outfitting, cartographics, colonial office, repairs and restocking are closed;
  fuel is still sold.
- Saves keep the fit (checked against the hull; a bad one falls back to stock) and the storage.

### Black holes are wormholes

Tested in `tests/emberreach_wormholes_t.js` (16 checks, with the safety and blueprints).

- A black hole (about 0.1% of stars) is a body with its horizon (2.95 km a
  sun), drawn as a dark disc in a ring of glowing accretion.
- It's a **wormhole**: a ship with an **alien dimensional phaser** fitted (and powered) can target it and press J
  within 2,500 km; after an 8 s charge it phases through to a random star anywhere the galaxy has stars, drawn by
  the galaxy's own density, so most often towards the centre, sometimes far out. You come out near that star
  (wormholes have no nav beacons), a day later, with no route. Without a phaser the wormhole is closed.
- The galaxy's central black hole, **the Maw**, is a wormhole of its own: it leads only to the Rift (below).

### Proximity safety

The ship won't go dangerously close: it holds 2,000 km off a black hole (three horizon radii off the Maw), 1.6 radii off a star, and at the top of a
world's atmosphere (1.12 radii); at an airless world it stops 300 m above the surface. No landing yet: surface
ports and outposts come later. (Before this, flying into a planet or star lost the ship.)

### Alien blueprints, the artifact broker and recycling

- Surveying a ruin sometimes turns up a **blueprint**: an alien relay booster (30%, size 2 to 4) or an alien
  dimensional phaser (15%). Blueprints are materials, kept with the ship's records.
- An **artifact broker** (a station contact, on Contacts, at lanterns, blooms and halos) builds the module from a
  blueprint plus goods from the hold and a fee: a relay booster takes 3 t of Artefacts, 2 t of Beryllium and 1 t of
  Electronics a size, and 60,000 SU a size; a phaser 12 t of Artefacts, 6 t of Uranium, 2 t of Diamond, 4 t of
  Electronics and 250,000 SU. The **blueprint is used up** in the build; the module goes to storage.
- **Recycling** (at the outfitter, from storage) breaks any module into materials for the hold: an alien module
  gives its blueprint back with half its recipe's goods; others give metals and electronics by category, size and
  grade. Each station recycles **3 modules in any 7 days**.

### The Rift

Tested in `tests/emberreach_rift_t.js` (35 checks). End-game play, beyond the Maw.

- **The Maw** is the black hole at the galaxy's centre: about 2,500 suns (0.2.0, scaled with the galaxy; five million
  before), its horizon about 7,400 km across. It's on the
  map and the route planner like any star (id `heart`), though no power holds it and it has no port or worlds.
  The ship's safety holds three horizon radii off it (any black hole: 2,000 km, or three radii if that's more), and
  a phaser works within 1.25 times that. Riftborn slip through to this side now and then (half of visits).
- With a **dimensional phaser**, J at the Maw crosses into **the Rift**, and J at the Rift's own Maw crosses home.
  Other black holes in the Rift are wormholes to random Rift stars.
- **The galaxy upside down.** Every Rift star is a normal star turned over (its height above the galactic plane
  the other way), the same in class, mass and age, its name written backwards (Kaveth becomes Htevak); its id is
  the normal one after `R:`. Its worlds are drawn afresh, so they're its own. Nothing lives on any of them.
- **Its riches.** Rocky worlds hold **nullite** (40%) and **voidglass** (15%); gas giants **aetherium** (50%). Its
  rings and belts carry the same ores as well as the usual. In about one system in ten with a rocky world lie
  **Precursor ruins**, guarded by Precursor guardians (Riftborn-strong). Surveying one yields **Precursor relics**
  and, more often than not, a **Precursor blueprint**. Rift charts and surveys sell for twice as much, and a
  Precursor ruin's survey for three times a ruin's.
  | Good | Base value (SU) |
  |---|---|
  | Nullite | 180 |
  | Voidglass | 320 |
  | Aetherium | 260 |
  | Precursor relics | 1,500 |
  This side of the Maw, every market buys them at a premium (+25%) and none sells them.
- **No powers, no lanes.** Nobody holds anything there and there are no lanes. The only ports are **Precursor
  anchorages**, independent of every power (0.2.0): one at the Maw, the way home, and about 1,600 more spread
  loosely and far apart through the Rift. They offer fuel, repairs and trade in SU, pay half for the Rift's goods,
  and build nothing (no shipyard). Any other haven is a player's own: an **independent colony**, filed at a Rift
  anchorage (no power sponsors anything there; nothing can be built at the Maw).
- **The Riftborn** crew every ship there. They fly copies of the living's warships and pirate hulls (up to L; up
  to XL at the Maw) with three times the hull and shields, 2.2 times the damage and 15% more speed and agility.
  They attack everyone, never flee, and their wrecks drop the Rift's goods (8% chance of a relic).
- **Precursor work** is stronger than anything sold. Grade **P** (×1.6, against A's ×1.3) comes in:
  - core: power plants, thrusters, manoeuvring thrusters, hyperdrives;
  - internal: shields, armour, relay boosters;
  - external: two weapons, the **needle** (small, 3 dmg × 6/s, runs cool) and the **lance** (large, 26 dmg ×
    1.5/s).

  A Precursor ruin's survey gives a hull blueprint 10% of the time, a weapon 15% and a module 45%. An artifact
  broker builds them on this side.

  | Blueprint | Recipe |
  |---|---|
  | Module | Precursor relics, nullite, voidglass (and aetherium for lances and hyperdrives) from the Rift; titanium and electronics from this side; 120,000 SU a size |
  | Hull | Relics, all three Rift ores, titanium, electronics and diamonds; half the hull's value |

  Further rules:
  - A core module is made at the size of the hull you're flying.
  - A hull takes your ship in part-exchange.
  - Recycling Precursor work gives its blueprint back.
- **Precursor hulls**, never sold, named (like their makers) for the oldest extinct things. Each beats every stock
  hull of its size:

  | Hull | Size | Role |
  |---|---|---|
  | Opabinia | S | scout |
  | Anomalocaris | M | hunter |
  | Dunkleosteus | L | warship |
  | Arthropleura | XL | freighter |

- Saves keep the Rift star you're at, Precursor blueprints and hulls, and the day of your first crossing.

### Mining

`apps/rudolf-emberreach/www/mining.js` (16 checks in `tests/emberreach_mining_t.js`).

- **Fields:** every ringed planet's rings (stone or ice), and asteroid belts: none in about a third of systems, one
  or two in the rest, in the gaps between the planets' orbits (rocky, or metallic around metal-rich stars). Each
  field has a **mining site**, a target to cruise to and drop out at.
- **Asteroids:** at a site, 64 asteroids (30 to 240 m across) in a flattened swarm 15 km wide, the same every visit.
  Each holds two or three goods by its field (stone rings: iron, copper, coal, lead, aluminium, a little titanium,
  jade and diamond; ice rings: water, beryllium, some coal and uranium; rocky belts: base metals and some uranium
  and jade; metallic belts: iron, titanium, aluminium, copper, with gold, uranium and diamond) and a yield of 5 to
  80 t. What's mined is kept in the save. Asteroids are solid: hitting one at speed hurts.
- **Mining lasers** (small external modules, fired with the guns, 600 m): every sixth hit breaks off a chunk of ore
  (0.25–0.6 t of one of its goods), drifting back towards the miner. Other weapons just stop at the rock.
- **The resource scanner** (utility) reads a targeted asteroid within 3 km in 3 s: its goods in proportion and the
  tonnes left. Without one, it's "composition unknown".
- **The refinery** (internal; 2 bins plus 1 a size): ore scooped through the hatch goes into a bin per good; each
  full tonne goes to the hold. No refinery, no ore aboard. When every bin is in use a new good is refused; bins can
  be emptied on the starport's Status screen.
- **Tractor beams** (small external modules) pull canisters and ore within 600 m to an open hatch, fast far out and
  slowing to scooping speed at the hatch.
- **Stock miners** (the Glyptodon, Megatherium, Mammoth and Deinotherium) come with a mining laser, a tractor beam where there's a
  second small hardpoint, a refinery, and a resource scanner where there's a mount for it.

### Modules and damage

Every ship carries the same core modules, each with its own health pool, shown on the **internal-systems HUD**
(`apps/rudolf-emberreach/www/modules.js`, 15 checks in `tests/emberreach_modules_t.js`). A pool is a share of the hull's
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

So a Dodo's canopy has 10 points and its engines 13; a Thylacine's 10 and 18; a Hydra's 6,480 and 15,120.

**G-forces.** The canopy is more than glass: while it holds, its field takes the g-forces and the pilot feels
none, which is why fighters can turn at up to 39 g (see "Flight"). Once the canopy breaks, the pilot feels everything
the thrusters do (`gForce`), and above 4 g strain builds (`apps/rudolf-emberreach/www/pilot.js`, 10 checks in
`tests/emberreach_pilot_t.js`):
1. **The view blurs.**
2. **It goes dark from the edges inward.**
3. **The pilot blacks out.** The steering, throttle and every other control stop answering: the stick goes
   neutral and the throttle stays where it was. With flight assist on, the ship stops turning and flies straight
   on at that speed; with it off, it keeps tumbling and thrusting.
4. **The pilot comes round** once the g has eased off and they've been out at least 4 s, waking groggy: blurred,
   dark at the edges, clearing over a couple of seconds.

How fast strain builds depends on how hard the pull is: (felt g − 4) / 16 per second, so 8 g blacks a pilot out
in 4 s, 12 g in 2 s and 20 g in 1 s. Below 4 g the strain falls by 0.15 a second. For example, a Thylacine with a
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

The model is in `apps/rudolf-emberreach/www/factions.js`, `economy.js`, `reputation.js` and `ships.js` (51 checks in
`tests/emberreach_factions_t.js`, 15 in `tests/emberreach_ships_t.js`). The viewer's first panel shows each
cluster in 3D.

### The great powers: two clusters

**0.2.0:** 12 great powers in **two clusters** of six, the North and the Hearth, each holding **250–400 systems**.
Counted by sampling they hold about 3,000 systems and contest about 1,000 more, about 0.1% of the galaxy. The North
is 119 pc out (stars there about 1.4 pc apart), the Hearth 5.6 pc from the centre; they are 82 pc apart, with one
long lane between them. Claims are about 9–14 pc across in the North and 0.6 pc in the Hearth. Six per cluster is
the fewest the alliance rules allow: every power needs at least two allies and two enemies in its own cluster. The
rest of this section describes the 0.1 galaxy (46 powers, six clusters, 8,000–14,000 systems each); the rules are
the same, the numbers are smaller.

- **How many (0.1):** 46 great powers in **six clusters** of six to eight (at least six per cluster, `MIN_CIVS`). That
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

Forty stock designs that NPCs fly, and players can buy where a yard sells them (`apps/rudolf-emberreach/www/ships.js`, 15
checks in `tests/emberreach_ships_t.js`). They range from one-seat shuttles to fleet carriers and dreadnoughts.
- **Who builds them:** a great power's yards in each of the six clusters (two in the North), and three independent
  yards (Brask & Orrel Free Yards,
  the Tamsin Mining Cooperative, Greyhook Salvage Works).
- **Species:** a great power's yards build to its species' bodies. Heavy-bodied builders add 15% armour and lose
  10% agility; light ones lose 10% armour, gain 10% shields and turn 12% faster.
- **Who flies what:** every design lists its pilots (navies, pirates, traders, miners, explorers, nomads, couriers,
  passengers, prospectors, salvagers, bounty hunters, smugglers), so the game puts the right ships in the right
  places. The small factions' fleet carriers and dreadnoughts are the Leviathan, Kraken and Hydra classes.

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

**Names:** every ship is named for a cryptid, a hybrid beast or an animal that's died out, one word or two joined by a
hyphen, chosen for what it does: fighters and warships after predators (Thylacine, Smilodon, Tyrannosaur), haulers
after beasts of burden (Quagga, Aurochs, Woolly-Rhino), explorers after far-ranging or far-off things (Thunderbird,
Roc, Mokele-Mbembe), miners after diggers and tuskers (Glyptodon, Mammoth), pirates after things that prey in the dark
(Wendigo, Megalodon). Each keeps its first, working name as its id in saves and code.

| Ship | Size | Role | Yard | Hull / shields | Speed m/s, turn °/s | Cargo t | Jump pc | Guns S/M/L/H | Crew | Tech | Price, SU | In ROA at home |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dodo | XS | shuttle | Brask & Orrel Free Yards | 90 / 40 | 220, 70 | 4 | 2 | 0/0/0/0 | 1 | 1 | 15 k – 20 k | 85 k – 108 k |
| Thylacine | XS | fighter | Roarvorum Compact yards | 126 / 99 | 320, 106 | 0 | – | 2/0/0/0 | 1 | 2 | 46 k – 58 k | 251 k – 321 k |
| Microraptor | XS | interceptor | Ixemos Directorate yards | 99 / 88 | 380, 123 | 0 | – | 2/0/0/0 | 1 | 3 | 53 k – 67 k | 289 k – 369 k |
| Glyptodon | XS | mining pod | Tamsin Mining Cooperative | 160 / 30 | 150, 50 | 12 | 1.5 | 1/0/0/0 | 1 | 1 | 18 k – 23 k | 98 k – 126 k |
| Jackalope | XS | racer | Ulis Concord yards | 92 / 60 | 420, 95 | 2 | 3 | 0/0/0/0 | 1 | 3 | 54 k – 68 k | 295 k – 376 k |
| Terror-Bird | XS | bomber | Mariajunumos Republic yards | 180 / 110 | 240, 67 | 0 | – | 0/1/0/0 | 2 | 2 | 48 k – 61 k | 263 k – 336 k |
| Mothman | XS | scout | Greyhook Salvage Works | 70 / 50 | 300, 90 | 1 | 4 | 0/0/0/0 | 1 | 2 | 27 k – 34 k | 146 k – 187 k |
| Hippocamp | XS | repair tender | Astevin Dominion yards | 150 / 70 | 200, 60 | 6 | 2 | 0/0/0/0 | 2 | 2 | 41 k – 52 k | 225 k – 288 k |
| Chupacabra | S | courier | Ixemos Directorate yards | 270 / 242 | 330, 84 | 20 | 6 | 1/0/0/0 | 2 | 3 | 217 k – 278 k | 1.2 m – 1.5 m |
| Quagga | S | light hauler | Brask & Orrel Free Yards | 380 / 150 | 210, 45 | 120 | 4 | 2/0/0/0 | 2 | 1 | 80 k – 102 k | 437 k – 559 k |
| Dire-Wolf | S | gunship | Othumfaax Throne yards | 598 / 300 | 260, 50 | 10 | 4 | 2/2/0/0 | 3 | 2 | 233 k – 298 k | 1.3 m – 1.6 m |
| Thunderbird | S | explorer | Ulis Concord yards | 379 / 260 | 250, 50 | 30 | 9 | 1/0/0/0 | 2 | 3 | 276 k – 352 k | 1.5 m – 1.9 m |
| Megatherium | S | miner | Tamsin Mining Cooperative | 480 / 180 | 170, 40 | 160 | 4 | 1/1/0/0 | 3 | 1 | 100 k – 127 k | 547 k – 699 k |
| Smilodon | S | heavy fighter | Roarvorum Compact yards | 378 / 352 | 300, 78 | 5 | 5 | 3/1/0/0 | 2 | 3 | 316 k – 403 k | 1.7 m – 2.2 m |
| Wendigo | S | raider | Greyhook Salvage Works | 400 / 250 | 310, 68 | 40 | 5 | 2/1/0/0 | 3 | 2 | 163 k – 209 k | 898 k – 1.1 m |
| Bunyip | S | stealth scout | Astevin Dominion yards | 280 / 300 | 290, 65 | 10 | 8 | 1/0/0/0 | 2 | 4 | 362 k – 463 k | 2.0 m – 2.5 m |
| Passenger-Pigeon | S | passenger shuttle | Voru Collective yards | 315 / 220 | 240, 50 | 30 | 5 | 0/0/0/0 | 2 | 2 | 135 k – 172 k | 741 k – 947 k |
| Aurochs | M | hauler | Brask & Orrel Free Yards | 1,100 / 500 | 180, 30 | 600 | 5 | 2/1/0/0 | 5 | 1 | 348 k – 445 k | 1.9 m – 2.4 m |
| Griffin | M | multirole | Mariajunumos Republic yards | 1,260 / 990 | 240, 47 | 150 | 6 | 2/2/1/0 | 6 | 3 | 1.2 m – 1.5 m | 6.5 m – 8.3 m |
| Manticore | M | corvette | Othumfaax Throne yards | 2,415 / 1,300 | 230, 34 | 60 | 6 | 3/3/1/0 | 18 | 3 | 1.7 m – 2.2 m | 9.3 m – 11.9 m |
| Roc | M | long-range explorer | Ulis Concord yards | 1,150 / 1,100 | 220, 36 | 120 | 14 | 1/1/0/0 | 5 | 4 | 1.8 m – 2.3 m | 10.0 m – 12.8 m |
| Mammoth | M | miner | Tamsin Mining Cooperative | 1,600 / 600 | 150, 28 | 700 | 5 | 2/1/0/0 | 8 | 2 | 624 k – 797 k | 3.4 m – 4.4 m |
| Ankylosaur | M | armoured trader | Voru Collective yards | 1,620 / 880 | 170, 34 | 500 | 6 | 2/2/0/0 | 7 | 2 | 981 k – 1.3 m | 5.4 m – 6.9 m |
| Hyaenodon | M | strike craft | Ixemos Directorate yards | 1,080 / 1,210 | 290, 56 | 40 | 7 | 2/3/0/0 | 6 | 4 | 1.5 m – 1.9 m | 8.3 m – 10.6 m |
| Sea-Cow | M | liner | Astevin Dominion yards | 1,300 / 1,000 | 200, 30 | 200 | 7 | 1/0/0/0 | 30 | 3 | 943 k – 1.2 m | 5.2 m – 6.6 m |
| Teratorn | M | salvager | Greyhook Salvage Works | 1,500 / 500 | 170, 32 | 450 | 5 | 2/1/0/0 | 8 | 1 | 384 k – 491 k | 2.1 m – 2.7 m |
| Basilisk | L | frigate | Roarvorum Compact yards | 4,680 / 3,520 | 190, 27 | 300 | 7 | 4/4/2/0 | 60 | 3 | 5.5 m – 7.0 m | 30.3 m – 38.7 m |
| Woolly-Rhino | L | freighter | Brask & Orrel Free Yards | 4,200 / 1,600 | 150, 18 | 3,000 | 6 | 2/2/0/0 | 20 | 1 | 2.2 m – 2.7 m | 11.8 m – 15.1 m |
| Cerberus | L | patrol cruiser | Mariajunumos Republic yards | 7,020 / 4,620 | 180, 22 | 250 | 7 | 4/4/3/0 | 90 | 3 | 7.1 m – 9.1 m | 39.1 m – 49.9 m |
| Deinotherium | L | mining refinery | Tamsin Mining Cooperative | 6,500 / 2,000 | 120, 14 | 4,000 | 5 | 2/2/1/0 | 40 | 2 | 4.5 m – 5.8 m | 24.9 m – 31.8 m |
| Mokele-Mbembe | L | deep explorer | Ulis Concord yards | 4,370 / 3,800 | 170, 18 | 600 | 20 | 2/2/0/0 | 30 | 5 | 14.0 m – 17.9 m | 76.9 m – 98.2 m |
| Megalodon | L | raider | Greyhook Salvage Works | 5,000 / 2,600 | 210, 24 | 800 | 7 | 4/3/2/0 | 45 | 2 | 3.8 m – 4.8 m | 20.8 m – 26.6 m |
| Paraceratherium | L | fuel tanker | Astevin Dominion yards | 4,500 / 1,800 | 140, 15 | 2,500 | 8 | 2/1/0/0 | 25 | 2 | 3.7 m – 4.8 m | 20.6 m – 26.3 m |
| Tyrannosaur | XL | destroyer (4 in hangar) | Othumfaax Throne yards | 20,700 / 11,000 | 160, 11 | 800 | 8 | 6/6/4/1 | 320 | 4 | 47.5 m – 60.7 m | 261.2 m – 333.8 m |
| Brontosaur | XL | bulk freighter | Brask & Orrel Free Yards | 15,000 / 5,000 | 110, 8 | 30,000 | 6 | 3/3/1/0 | 120 | 1 | 18.7 m – 23.9 m | 102.8 m – 131.4 m |
| Chimera | XL | battlecruiser (6 in hangar) | Voru Collective yards | 23,400 / 17,600 | 170, 12 | 1,000 | 8 | 6/8/5/2 | 600 | 4 | 85.1 m – 108.7 m | 467.9 m – 597.8 m |
| Elephant-Bird | XL | colony ship (2 in hangar) | Astevin Dominion yards | 20,000 / 9,000 | 100, 7 | 12,000 | 10 | 2/2/1/0 | 3,000 | 3 | 50.1 m – 64.0 m | 275.5 m – 352.0 m |
| Leviathan | Capital | fleet carrier (36 in hangar) | Brask & Orrel Free Yards | 90,000 / 40,000 | 90, 4 | 60,000 | 12 | 8/8/4/2 | 8,000 | 4 | 1.63 bn – 2.08 bn | 8.96 bn – 11.44 bn |
| Kraken | Capital | dreadnought (24 in hangar) | Roarvorum Compact yards | 144,000 / 77,000 | 80, 3 | 8,000 | 10 | 12/12/8/4 | 12,000 | 4 | 1.33 bn – 1.70 bn | 7.31 bn – 9.34 bn |
| Hydra | Capital | battleship (12 in hangar) | Mariajunumos Republic yards | 108,000 / 66,000 | 85, 3 | 5,000 | 9 | 10/10/8/4 | 9,000 | 5 | 854.3 m – 1.09 bn | 4.70 bn – 6.00 bn |

**Starting out:** a new player gets the cheapest jump-capable design their home yards sell under 100,000 SU (the
Ulis Concord Jackalope, the Astevin Dominion Hippocamp), or the independent Dodo (44 of the 46 powers). They also get money worth 20,000 SU in their
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

### Settings

**Controls, 0.2.5.**
- **Two control schemes** (Settings › Controls):
  - **Simple** (a new pilot's default) lists only the core keys, keeps flight assist on, and turns the assists on.
  - **Full** (kept by anyone from before) lists every key and leaves flight assist to the pilot.
  - Any key can be rebound in either.
- **The radial menu (hold ~):** landing gear, cargo hatch, spotlights, night vision, internal systems, flare, mouse
  flight and flight assist. Point at one, or step round with ← → (or A D); let go to switch it. Steering waits while
  it's open.
- **M switches Combat and Analysis mode.** Steering, thrust and navigation stay the same; five keys change:

  | Key | Combat | Analysis |
  |---|---|---|
  | ; | weapons | mining lasers only (weapons safe) |
  | K | missile | scan the target now |
  | B | flare | pulse scanner (the scanner reaches 25 km for 10 s, every 15 s) |
  | T | next target | next target that isn't a ship |
  | U | nearest hostile | nearest point of interest |

- **The assists,** each on or off whatever the scheme:
  - **automatic landing gear;**
  - **automatic spotlights** over a world's night side under 5 km;
  - **landing assist:** under 300 m with the gear down and flight assist on, the descent is held to three quarters of
    the touchdown limit, or a tenth of the height;
  - **automatic jumps along a route,** 4 s after each arrival (J stops it).
- Mouse flight moved from M into the radial menu (it can still be bound to a key).


In the game since 0.1.1 (`settings.js`, `i18n.js`; tested in `tests/emberreach_settings_t.js`, 20
checks, and the browser test's checks 9 and 9b). Opened from the pause screen's **Settings** button. Three pages:

- **Graphics, audio and HUD**
  - **Graphics:** quality (high/low), resolution (50–100% of the screen's), field of view (50–100°), glow
    effects, and a frame-rate counter.
  - **Audio:** sound on/off, and four volumes: master, engines and ambience, effects, and alerts and warnings.
    Alerts are the warning, critical, clearance, refused, lock, incoming and blackout cues.
  - **HUD:** size (75–150%; the panels scale, the markers stay where they point), opacity, how many messages
    and for how long, and the scanner, velocity marker and lead marker on or off.
- **Controls**
  - Every action has two keys and a gamepad button, rebound by pressing what you want. Esc cancels;
    Backspace or Delete unbinds.
  - A key already taken is moved, and the menu says from which action.
  - Also: mouse sensitivity and inverted pitch, gamepad inverted pitch and dead zone, and a reset.
  - The controls help (H) lists the bindings as they are.
  - **Defaults:** the landing gear is on **L** and fire on **;**. The rest are unchanged.
- **Language and accessibility**
  - **Languages:** the nine Rudolf OS offers in its own settings, with its codes and names: English, Español,
    Português, Français, Deutsch, Русский, 中文, 日本語, 한국어.
    - The menus, the HUD, the controls and the sound captions are translated. The starport and the flight
      messages are still in English.
    - **Follow Rudolf OS** (the default, first in the list): the language Rudolf OS shares with apps (Rudolf OS 1.5.9,
      Settings › Date, time and language › Share my language with apps, passed as the game kit's `RG.lang`). It
      changes with Rudolf OS while the game runs. Not shared, or outside Rudolf OS, it is the browser's language if
      it's one of these, else English. Choosing a language yourself keeps it whatever Rudolf OS says.
  - **Accessibility:**
    - reduce flashing: as Rudolf OS says (the default), on, or off;
    - reduce motion: no hyperspace streaks, no blinking alerts;
    - a colour-blind palette: red–green (blue for good, yellow and orange for warnings) or blue–yellow;
    - a high-contrast HUD;
    - captions for the sounds.

The save keeps the settings, clamped and cleaned (`St.sanitise`), and a new game keeps them. Older saves'
quality and sound carry over.

### Ship insurance

In the game since this change (`insurance.js`; tested in `tests/emberreach_insurance_t.js`, 15 checks).

- **The policy.** A ship is insured with a great power, at one of its ports (the Contacts screen's Insurance
  desk), and paid for in its currency.
  - The premium is **10% of the ship's whole value a week**, a week in advance. The value counts the hull and
    every module fitted beyond the stock ones.
  - Every pilot starts with **the starter's cover**: their home power's policy, the first week paid.
  - A policy can be switched to another power at its ports, or cancelled.
- **Premiums fall due weekly.** One that can't be paid is **owed**, and it is taken as soon as there's money in
  that currency.
- **Losing the ship.** The pilot wakes at the first of these, searched by priority:
  1. the nearest port within **1,000 ly** that trades in the policy's currency;
  2. else, the nearest port within 1,000 ly whose exchange takes that currency (any great power's port that
     isn't at war with the currency's issuer);
  3. else, the station they started the game at.

  (This rule may change.) Lost in the Rift, the search starts from the Maw on this side. The search looks at
  every power's capitals and lane hubs, your colonies, your last port, your start, and every port within 6 pc.
- **Settling up.** Anything owed on the policy is settled at that port: first from the policy's currency, then
  the port's exchange changes the pilot's other money into it, largest holdings first.
  - **Paid up:** the insurer replaces the ship as it was, the same hull with the same fit. The cargo is lost.
  - **Short of money in every currency, or not insured:** the pilot starts again at their starting station in a
    basic starter ship, with the starter's cover.
- Crashing on the ground (see `plan-ember-reach-landing.md`) is a loss like any other.
- Saves keep the policy. A cancelled policy stays cancelled. Saves from before this get the starter's cover.

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
   Gamekit controls. **Playable** (`apps/rudolf-emberreach/www/play.html`): the home system of any great power from the model,
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
   space; lanes. The sky from real neighbours. **Playable** in `index.html`:
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
     of real neighbours. Docking refuels and repairs. A lost ship is replaced under its insurance (see "Ship insurance").
   - **Saves** keep the system you're in, your fuel, your last port and your route's destination (save version 2;
     M1 saves still load).
4. **M3:** trade: markets, cargo, prices, currencies and exchanges, the factions' stations; choosing an origin.
   **Playable** in `index.html`:
   - **Choosing an origin:** a new game opens on the 12 great powers (46 before 0.2.0), by cluster, with each one's species, currency,
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
     ships lost replaced under their insurance (see "Ship insurance"), the cargo lost with them.
   - **Saves** (version 3) carry the player: money, cargo, reputation, bounties, commission.
5. **M4:** combat and war: weapons, shields, heat, pirates, patrols; war missions, commissions, moving fronts;
   carriers and dreadnoughts. **Playable** in `index.html` (see "Combat"):
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
   reaches the App Store. **Exploration is playable** in `index.html` (see "Exploration"): the sweep, surveys, first
   discoveries and naming, Universal Cartographics, ruins with their sentinels and caches, and survey contracts.
   The move to `apps/` is its own step.
7. **M5b:** colonies: claiming systems and building ports and facilities, after Elite Dangerous's Trailblazers
   (see [plan-ember-reach-colonies.md](plan-ember-reach-colonies.md)). **Playable in full (M5b-1 to -3):** claims, the
   beacon, the primary port's goods, haulage, and the finished port; slots, facilities, points, links and the market,
   population and the architect's pay; forward bases on the fronts, raids, independent colonies with their scrip,
   and rented carriers.
8. **M6:** the Core, the black hole, polish; phones (1.6.0). **The Maw and the Rift are playable** (see "The Rift").

**Released: the Single-Player Alpha Build (SPAB), 0.1.0**, in the Rudolf OS Library (`rudolf-emberreach`). It has
everything through M5b, and the Maw and the Rift from M6. The release brought these fixes:
- **Saves no longer fail in long games.** gamekit keeps a save up to 256 KB, and a long game's records
  (systems charted, asteroids mined) grew past that. The save now trims the least needed records first; the
  game's own records in memory are untouched. Saves no longer drop one asked for while another is under way.
- **The alpha is labelled** on the origin and pause screens.
- **A browser test** (`tests/emberreach_t.js`) plays it in the desktop's sandboxed frame: a new game, the
  starport, flight, the map, a jump, pausing, the Rift, and resuming from the save.

**0.1.1** adds:
- ship insurance and respawn ("Ship insurance");
- real years, months and days, with worlds turning in real time;
- gravity below each world's Kármán line;
- docking clearance revoked after 5 minutes unused, as the traffic controller's rules have it.
- the landing gear on L (down only below 100 m/s; landing itself comes later);
- a settings menu on the pause screen: graphics, audio and HUD; controls, with every key and gamepad button
  rebindable; languages (the nine Rudolf OS offers) and accessibility (reduced flashing and motion, colour-blind
  palettes, a high-contrast HUD, sound captions) ("Settings");
- **Follow Rudolf OS**, the new default language: the language Rudolf OS shares with apps (from Rudolf OS 1.5.9),
  else the browser's.

**0.1.2** fixes:
- **Memory grew with every jump.** Each system's planet, star and station meshes were kept after leaving it:
  about 10 MB of memory and 8 MB of graphics memory a jump (over 300 MB after 30 jumps). They are now freed on
  arrival, so memory stays level however far you travel.

**0.2.0** makes the galaxy smaller, so every system and its data could fit within a free cloud server:
- **4 million stars** (from 7.95 billion), with M32's crowding kept: every length times 0.0796, the masses times
  0.0005. Stars are as far apart as before, so jump ranges, travel and the sky are unchanged; the galaxy is 239 pc
  out (regions: the Core to 2.4 pc, the Glow to 36, the Inner Reach to 80, the Middle Reach to 159, the Outer
  Clouds to 239). The speed spread used for close passes stays at 54 km/s, so the crowded middle is still sterile
  (a galaxy this small would have about 4 km/s).
- **12 great powers** in two clusters of six (the North and the Hearth), each holding 250–400 systems; small
  factions cut to match (12, from 44); lanes drawn in (hubs 8 pc apart, lanes up to 16 pc, relays every 30 pc).
- **The Rift: 2 million stars**, 75% as wide as the galaxy: each Rift star is a star here turned over and drawn in
  to 75% of its distance, for one star in two. It is the endgame: only the Riftborn live there. Its only havens
  are the Precursors' anchorages, independent of every power: one at the Maw (the way home) and about 1,600 more
  (1,603) spread loosely through its whole volume, at least 8 pc apart, one per 20-pc cube by a seeded draw, found
  as you go. Any other haven there is a player's own: independent colonies can be filed at a Rift anchorage.
- **Saves** from the old galaxy keep only their settings: a new game starts, and the origin screen says why.

**0.2.1** adds **the Interstellar Marshals** (`encounters.js`, tested in `tests/emberreach_marshals_t.js`, 19 checks,
and the browser test's 9c and 10b):
- **Who they are:** a galactic police force, neutral (no power's, no faction's). They keep the anchorage at the
  Rift's side of the Maw, the way home: two guards always hold it, and nobody's guns fire within 10 km of it but
  theirs. A wanted pilot is refused docking there.
- **Whom they hunt:** in the main galaxy only, a pilot whose bounties come to over **50,000 SU** across every
  power's currency, or who has destroyed **10 police ships** (a port's patrols, or the Marshals' own) within
  **10 game days**. Arriving in a system while wanted, they find you six times in ten, 15-40 s after you arrive;
  crossing the line mid-system brings them 30-60 s later. A wing of two or three appears 6-9 km off.
- **Their ships:** navy hulls rebuilt to 90% of the Precursor hull of their size (hull and shields), so just below
  Precursor strength and above any navy's. **Disruptors** cut a twenty-fifth of the shield generator with every
  hit, shields up or not: a wing puts shields out in seconds. A **tractor beam** within 3 km drags a ship to a
  quarter of its top speed and holds it out of hyperspace (a jump charging is cut off).
- **Surviving them:** they can be beaten, but hardly without Precursor work. The best chance is to jump soon after
  they appear, before they close to 3 km. Destroying one counts as a police ship.

**0.2.2 to 0.2.9** built landing (L1, in `docs/plan-ember-reach-landing-work.md`) and the controls:
- **0.2.2 to 0.2.4:** the surface readout below a world's line, the gear, touchdown, crashes and lift-off, terrain
  (relief and craters on a cube-sphere of tiles), and spotlights (1) and night vision (2).
- **0.2.5:** Simple and Full control schemes, a radial menu on ~, Combat and Analysis modes on M, and the assists
  (automatic gear, spotlights, landing assist, jumps along a route).
- **0.2.6:** performance: antialiasing off by default on software renderers, no drawing while docked, and automatic
  resolution and terrain detail.
- **0.2.7:** the approach: cruise drops out above a targeted world, the world's lock, the ground scan and first
  landings.
- **0.2.8:** systems at 1/12 scale, as Kerbal Space Program does it (the same surface gravity, times by the square
  root).
- **0.2.9:** AI ships below a line, touch's VERT slider and GEAR button, the gamepad's A held for the gear, and the
  landing help.

**Released: 0.3.0, landing on airless worlds** (L1), with all of the above.

**0.3.1** reworks the weapons (`combat.js`, tested in `tests/emberreach_combat_t.js` checks 16-26 and the browser
test's 9q):
- **Lasers are hitscan** (pulse, heavy, the Precursor needle and lance, mining): the beam lands the instant it fires,
  on the first thing in its way out to its range. Still better against shields, still heat.
- **Gatlings**, small, medium and large (light, standard and heavy): streams of rounds on ammunition, better against
  hulls (×1.4, ×0.6 against shields).
- **The mass driver** is now equal against shields and hulls, and charges: hold the trigger to charge it (0.6 s), let
  go to fire. A shot let go early hits for its share of the charge (nothing under 15%); held past full, it heats the
  ship (0.3 of its heat capacity a second), which can lock the guns and, past that, cook the modules.
- **Mounts:** lasers, gatlings and needles come fixed or gimballed. Fixed guns fire along the nose, and the HUD shows
  where to aim (one point for each shot speed fitted; a laser's is the target itself). Gimballed guns track a target
  by themselves within a dashed circle 40% of the screen's height across (15.6° at a 70° field of view), marked when
  they have it, for 15% less damage and half again the price. The mass driver, lance, missiles and torpedoes have one
  mount each. Ships' existing guns are fixed; AI ships' guns are gimballed.
- **Aim prediction:** projectile guns aim from the target's distance, relative velocity and its acceleration
  (tracked from its velocity, so a turning target is led along its curve).
- **Heat gives you away:** missile and torpedo locks on a hot ship reach further and come sooner, up to twice as far
  in half the time at full heat.

Still to come: surface ports (L2), mining on worlds (L3), the Core's story, phones (1.6.0), and multiplayer.
Surface ports are planned in `docs/plan-ember-reach-landing.md`; their model is `www/surface.js`.

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
