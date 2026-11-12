# Ember Reach: plan

A 3D open-world spaceflight game about **combat, trade and exploration**, set inside a scale model of a compact
elliptical galaxy. Every one of its ~16 billion stars exists and can be visited. Each star, its planets and their
habitability come from the astrophysics below, not from hand-placed content. "Ember Reach" is a working title.

- **Package:** `rudolf-emberreach` (a Library game). The work sits in `wip/emberreach/` until it can be played, so
  the publish workflow doesn't put it in the App Store early (`tools/publish.sh` builds everything in `apps/`).
- **Status:** the galaxy model is done and checked (`wip/emberreach/galaxy.js`, `tests/emberreach_galaxy_t.js`, 22
  checks). So are the factions, wars, money and reputation (`factions.js`, `economy.js`, `reputation.js`;
  `tests/emberreach_factions_t.js`, 37 checks). `wip/emberreach/viewer.html` draws them. The game itself is the milestones below.

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

- **Factions:** the 7 civilisations alive now are the game's great powers (at least six, whatever the Drake
  numbers say). Where they live is set by the lore (see "The great powers"), and the physics agrees: their region
  is quiet space.
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

   - **Lanes:** the great powers keep relay beacons that allow long jumps (about 50 pc) between their own systems
     and their allies'. Their capitals are 140–460 pc apart, so it's a handful of lane jumps, or dozens of
     ordinary ones. Enemies' lanes are closed to you, and fronts cut lanes.

### Regions

Distances are ellipsoidal radius from the centre. **Galactic north** is the short axis, the pole.
- **The Core** (inside 30 pc): stars a few thousand AU apart, constant close passes, the black hole. The endgame:
  the richest resources and the most ruins, from an earlier era when the centre may have been calmer. The most
  dangerous flying.
- **The Glow** (30–450 pc): dense, metal-rich and mostly sterile. Many white dwarfs and old giants, rich mining,
  little law. Criminal syndicates and prospectors.
- **The Inner Reach** (450–1,000 pc): quiet enough for life, still busy. Prospectors' claims; frontier.
- **The Middle Reach** (1,000–2,000 pc): quiet, living worlds. In the north, the great powers and their wars.
  Elsewhere, wide open: nomads, ruins, unclaimed living worlds.
- **The Outer Clouds** (beyond 2,000 pc): a thin halo of old stars, a parsec or more apart. Nomad fleets, deep
  ruins, the loneliest flying.

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
  Middle Reach; food is the reverse. Each great power prices in its own currency (see "Money"). Distance and danger make the margins.

### Combat

- **Weapons:** lasers (heat), mass drivers (ammo, travel time) and missiles (lock-on, counter-measures). Shields and
  hull, with heat management.
- **Enemies:** pirates in the Glow, faction patrols to anyone wanted, and old defences around ruins.
- **Controls:** the same on keyboard and mouse, controller, and touch (a virtual stick, plus throttle and fire
  buttons).

### Factions

See "Factions, wars and money" below.

### Saves

Only the player's own changes are saved: ship, cargo, credits, reputation, discoveries and names, visited systems,
and market drift. The galaxy is rebuilt from the model every time. Saves go through rudolfd with export and import,
like every Library game.

## Factions, wars and money

The model is in `wip/emberreach/factions.js`, `economy.js` and `reputation.js` (37 checks in
`tests/emberreach_factions_t.js`). The viewer's first panel is the political map of the north.

### The great powers

- **How many:** at least six (`MIN_CIVS`). The Drake equation gives seven, so there are seven.
- **Interstellar:** every one has been spacefaring for 6,000–15,000 years.
- **Where:** all at home in the **northern Middle Reach**: 1,000–2,000 pc from the centre (midway between the Core
  and the Outer Clouds), at 30° north or more. They cluster around the **North Point**, straight up the pole and
  1,500 pc out.
- **Why the north:** in the lore, a shared cradle. The seven arose within a few hundred parsecs of each other, which
  is why they met, traded and went to war, while the rest of the galaxy is mostly empty of anyone alive. In the
  physics it's quiet space: over 99% of planets there go 4 Gyr without a close pass.
- **Homes:** each power is a **species** of its own, at home on a living world with ESI ≥ 0.75, 110 pc or more from
  the others. The pick has some chance in it, so homes differ: 0.68 g to 1.33 g, 7 °C to 42 °C.
- **What a home shapes:**
  - its world's gravity sets ship build (heavy, balanced or light);
  - its sun sets senses (infrared under red and orange suns, ultraviolet under hot ones);
  - its age and a seeded military and economy set strength.
- **Space:** each power claims space within 120–240 pc of home, strongest at home and fading to nothing at the
  edge. A point belongs to the strongest claim. Allies' overlapping claims are shared space. Where two *enemies'*
  claims are nearly equal, the space is **contested**. Borders are surfaces in three dimensions.

As the model makes them today (names and numbers come from the seed):

| Power | Species | Home | Currency, coins per SU (day 0) | Allies | Enemies |
|---|---|---|---|---|---|
| Kaigemarrd Compact | Kaigemarrdi (heavy, infrared) | Terra, 1.27 g, 26 °C | kaigemarrd bead (KAI), 2.87 | Linaeulutis, Veora | Kaitis, Ulasenarvin, Ixumth |
| Kaitis Collective | Kaitisi (heavy, infrared) | Forest, 1.33 g, 42 °C | kaitis mark (KAQ), 9.62 | Linaeulutis, Ulasenarvin | Kaigemarrd, Veora, Faofaar, Ixumth |
| Linaeulutis Theocracy | Linaeulutisians (light, infrared) | EarthLike, 0.70 g, 11 °C | linaeulutis crown (LIN), 12.02 | Kaigemarrd, Kaitis, Faofaar, Ixumth | Veora, Ulasenarvin |
| Veora Throne | Veorans (heavy, infrared) | Forest, 1.18 g, 7 °C | veora talent (VEO), 4.92 | Kaigemarrd, Ulasenarvin, Ixumth | Kaitis, Linaeulutis, Faofaar |
| Faofaar Assembly | Faofaarari (light, visible) | EarthLike, 0.68 g, 8 °C | faofaar talent (FAO), 5.72 | Linaeulutis, Ulasenarvin, Ixumth | Kaitis, Veora |
| Ulasenarvin Theocracy | Ulasenarvinese (balanced, visible) | EarthLike, 1.08 g, 15 °C | ulasenarvin florin (ULA), 6.11 | Kaitis, Veora, Faofaar, Ixumth | Kaigemarrd, Linaeulutis |
| Ixumth Collective | Ixumthese (heavy, infrared) | EarthLike, 1.30 g, 17 °C | ixumth tithe (IXU), 0.89 | Linaeulutis, Veora, Faofaar, Ulasenarvin | Kaigemarrd, Kaitis |

### Alliances and enmities

- **The rule:** every great power has **at least two allies and at least two enemies** among the others.
- **Enemies must share a border:** at least 15% of the surface where their claims are equal must be theirs alone,
  not buried inside a third power's space.
- **How the arrangement is chosen:** the model searches the possible arrangements in seeded order. It keeps the one
  that meets the rules with the longest borders between enemies and the widest spread between allies.
- **When geography won't fit:** a power with too few neighbours to fight reaches further (its claim grows) until
  the rules can be met. This keeps working if the galaxy changes.
- **Today:** 9 wars between 7 powers; each power has 2–4 allies and 2–4 enemies.

### Wars

- **Fronts:** each pair of enemies is at war over its contested systems. The front is 10 star systems with planets,
  along their shared border in 3D: the borders run in every direction, not along a plane.
- **Control:** each contested system's control runs from −1 to +1 (one side to the other). Beyond ±⅓ it is held;
  between, it is being fought over.
- **The seasons:** a season is 30 game days. Each season brings one side's offensive on 1–4 systems, or a truce
  (about one season in ten). Offensives favour the stronger military. Today's front is shaped by the last twelve
  seasons, the recent ones most.
- **Players move the front.** War effort is kept per system in the save, and 100 points swing a system about as
  far as an offensive.
  - **War missions** come from each power's stations, against its enemies, for the systems that matter most. There
    are seven kinds: supply runs (+6 effort), recon scans (+5), escorts (+9), blockade runs (+10), holding the
    line (+12), strikes (+14) and sabotage (+16). They pay in the issuer's currency.
  - **Fighting directly:** destroying the enemy's ships in a contested system counts as effort too.
  - **A commission** (Friendly or better, and not with that power's enemy) doubles the player's effort for that
    side. The other side then treats the player as a combatant.
  - In the checks, sixteen missions for one side turned a system from the enemy's (−0.43) to theirs (+0.90). Effort
    across a whole front swings a war's score by more than 0.3 either way.
- **What a war changes:** who holds a contested system decides its currency, its laws and who docks there. A front
  pays up to 60% more for munitions, medicine, fuel and food.
- **Multiplayer (later, optional):** the galaxy and the wars are deterministic, so a shared front is only the
  players' summed effort per system. An optional online service could add everyone's effort, for a shared war that
  the community moves. Offline, each save's war is its own.

### Smaller factions

24 of them, made from the seed. Most belong to one of the great powers' species; some are mixed.

| Kind | How many | Where | How they move | Flagship |
|---|---|---|---|---|
| **Nomads** | 6 | anywhere in the Middle Reach and Outer Clouds | **nomadic:** 5–8 stops, travelling for 6 days each season, then staying | a fleet carrier (most) |
| **Criminal syndicates** | 8 | on the war fronts (60%) and in the Glow | **rotating:** a new hideout each season, from 2–5 | a dreadnought |
| **Prospector guilds** | 5 | the Glow and the Inner Reach (metal-rich) | **semi-permanent:** a claim held 3–6 seasons, then the next | a fleet carrier |
| **Free ports** | 5 | between the great powers | **fixed** | a station |

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

### Money

- **The Standard Unit (SU)** is the game's measure of value: the cost of a fixed basket of goods (iron, copper,
  food, water, fuel, machinery, electronics) at base values. Nobody carries SU.
- **Each great power has its own currency.** Its rate is **coins per SU**, so every currency is tied to what goods
  cost. Today's rates run from 0.9 to 12 coins per SU. A rate moves with:
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
  - at its home world, with 5,000 of its currency and a ship of its species' build and senses;
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
- **The sky:** the nearest few thousand stars as points from `starsNear`. Farther away, the galaxy's integrated light
  as a precomputed sky texture: in the Glow, the core fills half the sky.
- **Performance:**
  - generating a system takes under 1 ms;
  - finding the stars within 15 pc takes under 0.1 s, run off the frame loop (a worker where available);
  - with WebGL, 60 fps on any graphics card;
  - on the Canvas fallback on the Vivobook, under about 3,000 polygons per frame.
- **Size:** code and ship models a few hundred KB, sound about 1.5 MB, within 2 MB.

## Milestones

1. **M0 (this plan):** the galaxy model; the great powers, alliances, wars, small factions, money and reputation
   as models; their checks and the viewer. Done.
2. **M1:** fly a ship in one system, with WebGL and the Canvas fallback; planets, a star and a station to dock at.
   Gamekit controls.
3. **M2:** the star map and jumping: the whole galaxy, zoom to a region, plot a route. The sky from real
   neighbours.
4. **M3:** trade: markets, cargo, prices, currencies and exchanges, the factions' stations; choosing an origin.
5. **M4:** combat and war: weapons, shields, heat, pirates, patrols; war missions, commissions, moving fronts;
   carriers and dreadnoughts.
6. **M5:** exploration in full: scanning, surveys, ruins, naming, missions. The package moves to `apps/` and
   reaches the App Store.
7. **M6:** the Core, the black hole, polish; phones (1.6.0).

## Open questions

- The name.
- Whether the WOS "rich galaxy" mix should be an option at all.
- How long jumps take in game time, and whether time matters (factions moving, markets drifting).
- Multiplayer: shared fronts (everyone's war effort added up online, optional) and shared discoveries are
  possible because the galaxy and the wars are deterministic; not before M5.
- The great powers' names: generated today; hand-written names and cultures may suit them better.
- Game time: how long a season feels in play (30 game days; jumps and lanes take days).

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
