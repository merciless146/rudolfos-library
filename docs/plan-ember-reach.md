# Ember Reach: plan

A 3D open-world spaceflight game about **combat, trade and exploration**, set inside a scale model of a compact
elliptical galaxy. Every one of its ~16 billion stars exists and can be visited. Each star, its planets and their
habitability come from the astrophysics below, not from hand-placed content. "Ember Reach" is a working title.

- **Package:** `rudolf-emberreach` (a Library game). The work sits in `wip/emberreach/` until it can be played, so
  the publish workflow doesn't put it in the App Store early (`tools/publish.sh` builds everything in `apps/`).
- **Status:** the galaxy model is done and checked (`wip/emberreach/galaxy.js`, `tests/emberreach_galaxy_t.js`, 22
  checks). `wip/emberreach/viewer.html` draws it. The game itself is the milestones below.

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
to 10^10 suns and sizes under about 0.7 kpc. Ember Reach's galaxy sits at the upper end, so it has room for an
open world:

| | Model | Notes |
|---|---|---|
| Stellar mass | 6×10^9 suns (5.4×10^9 inside the model's edge at 3 kpc) | upper end for a compact elliptical |
| Effective radius Re | 300 pc | half the light inside this (projected) |
| Shape | triaxial, axes 1 : 0.85 : 0.7 | an E3 seen from the side |
| Profile | Hernquist (1990), a = Re / 1.8153 = 165 pc | projects close to de Vaucouleurs' r^1/4 law |
| Stars and remnants | **15.9 billion** (mean mass 0.34 suns today) | from the initial mass function, aged |
| Central black hole | 5 million suns | M32's is a few million |
| Velocity dispersion | 76 km/s | M32's central value |
| Populations | old (10 Gyr) and younger (3 Gyr; 30% at the centre, falling outwards) | M32 shows an intermediate-age population, younger and more metal-rich at the centre |
| Metals | [Fe/H] +0.15 at the centre, falling outwards, ±0.15 between stars | |

**Density.** The Hernquist profile is ρ(r) = M a / (2π r (r + a)^3). The mass inside r is M r^2 / (r + a)^2, and
the effective radius is Re = 1.8153 a. In the model, r is the *ellipsoidal* radius, so the galaxy is triaxial.
What that means for flying around:

| Distance from the centre | Stars per pc³ | Typical nearest neighbour |
|---|---|---|
| 5 pc | 32,000 | 0.02 pc (3,600 AU) |
| 30 pc | 3,500 | 0.04 pc |
| 300 pc (Re) | 26 | 0.19 pc |
| 1 kpc | 0.5 | 0.7 pc |
| 2 kpc | 0.04 | 1.6 pc |

The Sun's neighbourhood has about 0.1 stars per pc³, so even the outskirts here are crowded by our standards. The
core is a wall of light.

### How every star exists without being stored

Space is cut into 4-pc cells. A cell's expected star count is the density averaged over 27 points inside it, times
its volume. A cell expecting more than 48 stars splits into eight (up to ten times), so the dense middle gets small
cells. Each leaf cell draws its stars from a Poisson count seeded by a hash of the cell's address. Each star's mass,
age, metals, companion, name and planets are seeded by its own id. The same place always gives the same stars;
nothing is saved except what the player changes. Finding the ~15,000 stars within 15 pc of a point in the
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
- **1%** at 30 pc from the centre;
- **50%** at 235 pc;
- **90%** at 440 pc;
- **99%** at 875 pc.

38% of all stars sit inside the 50% line. So the bright middle is sterile and full of metals, and the quiet
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
| N* | 1.59×10^10 | the model |
| fp | 0.76 | the model (stars with planets) |
| ne | 0.38 | the model: liquid-water worlds with ESI ≥ 0.8 that stay undisturbed for 4 Gyr, per star with planets |
| fl, fi, fc | 0.5, 0.01, 0.2 | chosen (nobody knows them) |
| L / T | 15,000 years / 10 Gyr | chosen |
| **N, alive now** | **≈ 7** | |
| Earlier civilisations | ≈ 4.6 million | N × T / L |

- **Factions:** the 7 civilisations alive now are the game's major factions. Each is at home on a living world with
  ESI ≥ 0.75, in quiet space, at least 400 pc from the others. Each has spread about 45 pc, colony to colony at a
  hundredth of light speed over its 15,000 years. That's 10,000 to 800,000 stars per faction, depending on how
  crowded its region is. All seven came out between 660 and 2,230 pc from the centre, in the quiet zone, without
  being told to.
- **Ruins:** the earlier civilisations left ruins. Each one is counted in about ten systems, giving a ruin in about
  1 star system in 400.

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

1. **Flight:** Newtonian with flight assist, for combat, docking and landing approaches. Speeds in m/s to km/s.
2. **Cruise:** within a system, up to a sizeable fraction of light speed, so crossing a few AU takes a minute or
   two. Gravity wells slow it, and it drops out near planets and stations.
3. **Jump:** star to star. Range 1–10 pc, depending on the drive and its fuel.
   - In the outskirts a jump crosses one or two neighbours. In the Glow there are dozens within reach. In the core
     there are thousands.
   - Jump accuracy suffers where stars crowd: the core is hard to navigate.

### Regions

- **The Outskirts** (beyond ~450 pc): quiet, living worlds, the seven factions, safe-ish trade lanes.
- **The Glow** (~30–450 pc): dense, metal-rich and mostly sterile. Many white dwarfs and old giants, rich mining,
  little law. Pirates and prospectors.
- **The Core** (inside ~30 pc): stars a few thousand AU apart, constant close passes, the black hole. The endgame:
  the richest resources and the most ruins, from an earlier era when the centre may have been calmer. The most
  dangerous flying.

### Exploration

- Scanning reveals a system's planets, then their details: type, gravity, temperature, atmosphere, resources, ESI,
  life and ruins.
- Survey data sells to cartographers. First discovery of a living world or a ruin is credited to the player, who
  may name it; names are kept in the save.
- The star map is the model itself, from the whole galaxy down to one system.

### Trade

- **Goods:** the WOS resource set (iron, copper, coal, lead, titanium, uranium, jade, gold, diamond, beryllium,
  aluminium), plus refined and manufactured goods, food from living worlds, and artefacts from ruins.
- **Prices:** set by supply and demand per faction and station. Metals are cheap in the Glow and dear in the
  Outskirts; food is the reverse. Distance and danger make the margins.

### Combat

- **Weapons:** lasers (heat), mass drivers (ammo, travel time) and missiles (lock-on, counter-measures). Shields and
  hull, with heat management.
- **Enemies:** pirates in the Glow, faction patrols to anyone wanted, and old defences around ruins.
- **Controls:** the same on keyboard and mouse, controller, and touch (a virtual stick, plus throttle and fire
  buttons).

### Factions

The seven civilisations from the Drake step, each shaped by its home:
- **Home gravity** sets ship build (heavy, armoured ships from high-g worlds; light, agile ones from low-g).
- **Home star** sets senses: red-dwarf civilisations see better in infrared, and their sensors favour heat
  signatures.
- **Age** sets technology.

Reputation is kept per faction, and borders are the 45-pc spheres. Independent stations sit in between.

### Saves

Only the player's own changes are saved: ship, cargo, credits, reputation, discoveries and names, visited systems,
and market drift. The galaxy is rebuilt from the model every time. Saves go through rudolfd with export and import,
like every Library game.

## Technical

- **Coordinates:** galaxy positions in parsecs, a system's in AU, and flight in metres around a floating origin.
  Each scale is its own frame, so 32-bit floats on the graphics card never see a large number.
- **Renderer:** WebGL 2 with lit, textured meshes, a skybox built from the actual stars around the player (brightness
  from luminosity and distance), and planets with procedural textures from type and colour. The Canvas 2D fallback
  draws flat-shaded polygons, sorted back to front, and a point starfield.
- **The sky:** the nearest few thousand stars as points from `starsNear`. Farther away, the galaxy's integrated light
  as a precomputed sky texture: in the Glow, the core fills half the sky.
- **Performance:**
  - generating a system takes under 1 ms;
  - finding the stars within 15 pc takes under 0.1 s, run off the frame loop (a worker where available);
  - with WebGL, 60 fps on any graphics card;
  - on the Canvas fallback on the Vivobook, under about 3,000 polygons per frame.
- **Size:** code and ship models a few hundred KB, sound about 1.5 MB, within 2 MB.

## Milestones

1. **M0 (this plan):** the galaxy model, its checks and the viewer. Done.
2. **M1:** fly a ship in one system, with WebGL and the Canvas fallback; planets, a star and a station to dock at.
   Gamekit controls.
3. **M2:** the star map and jumping: the whole galaxy, zoom to a region, plot a route. The sky from real
   neighbours.
4. **M3:** trade: markets, cargo, prices, the factions' stations.
5. **M4:** combat: weapons, shields, heat, pirates, patrols.
6. **M5:** exploration in full: scanning, surveys, ruins, naming, missions. The package moves to `apps/` and
   reaches the App Store.
7. **M6:** the Core, the black hole, polish; phones (1.6.0).

## Open questions

- The name.
- Whether the WOS "rich galaxy" mix should be an option at all.
- How long jumps take in game time, and whether time matters (factions moving, markets drifting).
- Multiplayer: not planned; the deterministic galaxy would make shared discoveries possible later.

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
