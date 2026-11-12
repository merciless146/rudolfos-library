# Ember Reach: plan

A 3D open-world spaceflight game about **combat, trade and exploration**, set inside a scale model of a compact
elliptical galaxy. Every one of its ~16 billion stars exists and can be visited. Each star, its planets and their
habitability come from the astrophysics below, not from hand-placed content. "Ember Reach" is a working title.

- **Package:** `rudolf-emberreach` (a Library game). The work sits in `wip/emberreach/` until it can be played, so
  the publish workflow doesn't put it in the App Store early (`tools/publish.sh` builds everything in `apps/`).
- **Status:** the models are done and checked; the game itself is the milestones below.
  - The galaxy: `wip/emberreach/galaxy.js` (`tests/emberreach_galaxy_t.js`, 22 checks).
  - Factions, front-line wars, money and reputation: `factions.js`, `economy.js`, `reputation.js`
    (`tests/emberreach_factions_t.js`, 45 checks).
  - The 40 stock ships: `ships.js` (`tests/emberreach_ships_t.js`, 15 checks).
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

The model is in `wip/emberreach/factions.js`, `economy.js`, `reputation.js` and `ships.js` (45 checks in
`tests/emberreach_factions_t.js`, 15 in `tests/emberreach_ships_t.js`). The viewer's first panel is the north in
3D.

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
  edge. Every point belongs to **one power at most**: the strongest claim there. Borders never overlap, allies'
  included. Where two *enemies'* claims are within 0.2 of each other, the space between them is **contested**: a
  zone about 40 pc deep, either side of the surface where their claims are equal. Borders are surfaces in three
  dimensions.

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

### Wars: front lines

- **The front:** each pair of enemies is at war over the contested zone between them. In it are **24 star systems**
  with planets, in three dimensions. Each system is linked to its nearest neighbours in the zone. Each has a
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
- **What a war changes:** who holds a contested system decides its currency, its laws and who docks there. A front
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
- The viewer's first panel (`viewer.html`) is a working version: drag to turn, wheel to zoom.

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

### Ships

Forty stock designs that NPCs fly, and players can buy where a yard sells them (`wip/emberreach/ships.js`, 15
checks in `tests/emberreach_ships_t.js`). They range from one-seat shuttles to fleet carriers and dreadnoughts.
- **Who builds them:** each of the seven great powers' yards, and three independent yards (Brask & Orrel Free Yards,
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

The catalogue, with prices in SU and in the Kaigemarrd Compact's bead at home on day 0 (2.86 beads per SU):

| Ship | Size | Role | Yard | Hull / shields | Speed m/s, turn °/s | Cargo t | Jump pc | Guns S/M/L/H | Crew | Tech | Price, SU | In KAI at home |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Wren | XS | shuttle | Brask & Orrel Free Yards | 90 / 40 | 220, 70 | 4 | 2 | 0/0/0/0 | 1 | 1 | 15 k – 20 k | 44 k – 56 k |
| Kestrel | XS | fighter | Kaigemarrd Compact yards | 161 / 90 | 320, 86 | 0 | – | 2/0/0/0 | 1 | 2 | 48 k – 61 k | 137 k – 175 k |
| Dart | XS | interceptor | Faofaar Assembly yards | 99 / 88 | 380, 123 | 0 | – | 2/0/0/0 | 1 | 3 | 53 k – 68 k | 151 k – 193 k |
| Hob | XS | mining pod | Tamsin Mining Cooperative | 160 / 30 | 150, 50 | 12 | 1.5 | 1/0/0/0 | 1 | 1 | 18 k – 23 k | 51 k – 65 k |
| Gnat | XS | racer | Linaeulutis Theocracy yards | 72 / 66 | 420, 118 | 2 | 3 | 0/0/0/0 | 1 | 3 | 52 k – 67 k | 149 k – 191 k |
| Spur | XS | bomber | Veora Throne yards | 230 / 100 | 240, 54 | 0 | – | 0/1/0/0 | 2 | 2 | 50 k – 63 k | 141 k – 181 k |
| Mote | XS | scout | Greyhook Salvage Works | 70 / 50 | 300, 90 | 1 | 4 | 0/0/0/0 | 1 | 2 | 27 k – 34 k | 76 k – 97 k |
| Tinker | XS | repair tender | Ulasenarvin Theocracy yards | 150 / 70 | 200, 60 | 6 | 2 | 0/0/0/0 | 2 | 2 | 41 k – 53 k | 119 k – 151 k |
| Lark | S | courier | Faofaar Assembly yards | 270 / 242 | 330, 84 | 20 | 6 | 1/0/0/0 | 2 | 3 | 219 k – 279 k | 625 k – 798 k |
| Packet | S | light hauler | Brask & Orrel Free Yards | 380 / 150 | 210, 45 | 120 | 4 | 2/0/0/0 | 2 | 1 | 80 k – 102 k | 227 k – 290 k |
| Pike | S | gunship | Ixumth Collective yards | 598 / 300 | 260, 50 | 10 | 4 | 2/2/0/0 | 3 | 2 | 233 k – 298 k | 667 k – 852 k |
| Finch | S | explorer | Linaeulutis Theocracy yards | 297 / 286 | 250, 62 | 30 | 9 | 1/0/0/0 | 2 | 3 | 271 k – 346 k | 773 k – 988 k |
| Burrow | S | miner | Tamsin Mining Cooperative | 480 / 180 | 170, 40 | 160 | 4 | 1/1/0/0 | 3 | 1 | 100 k – 127 k | 284 k – 363 k |
| Shrike | S | heavy fighter | Kaigemarrd Compact yards | 483 / 320 | 300, 63 | 5 | 5 | 3/1/0/0 | 2 | 3 | 326 k – 417 k | 931 k – 1.2 m |
| Jackal | S | raider | Greyhook Salvage Works | 400 / 250 | 310, 68 | 40 | 5 | 2/1/0/0 | 3 | 2 | 163 k – 209 k | 466 k – 596 k |
| Wisp | S | stealth scout | Ulasenarvin Theocracy yards | 280 / 300 | 290, 65 | 10 | 8 | 1/0/0/0 | 2 | 4 | 367 k – 469 k | 1.0 m – 1.3 m |
| Tern | S | passenger shuttle | Kaitis Collective yards | 402 / 200 | 240, 41 | 30 | 5 | 0/0/0/0 | 2 | 2 | 134 k – 172 k | 383 k – 490 k |
| Drover | M | hauler | Brask & Orrel Free Yards | 1,100 / 500 | 180, 30 | 600 | 5 | 2/1/0/0 | 5 | 1 | 348 k – 445 k | 994 k – 1.3 m |
| Corsair | M | multirole | Veora Throne yards | 1,610 / 900 | 240, 38 | 150 | 6 | 2/2/1/0 | 6 | 3 | 1.2 m – 1.5 m | 3.4 m – 4.4 m |
| Halberd | M | corvette | Ixumth Collective yards | 2,415 / 1,300 | 230, 34 | 60 | 6 | 3/3/1/0 | 18 | 3 | 1.7 m – 2.2 m | 4.9 m – 6.2 m |
| Seeker | M | long-range explorer | Linaeulutis Theocracy yards | 900 / 1,210 | 220, 45 | 120 | 14 | 1/1/0/0 | 5 | 4 | 1.8 m – 2.3 m | 5.2 m – 6.7 m |
| Delver | M | miner | Tamsin Mining Cooperative | 1,600 / 600 | 150, 28 | 700 | 5 | 2/1/0/0 | 8 | 2 | 624 k – 797 k | 1.8 m – 2.3 m |
| Mule | M | armoured trader | Kaitis Collective yards | 2,070 / 800 | 170, 27 | 500 | 6 | 2/2/0/0 | 7 | 2 | 992 k – 1.3 m | 2.8 m – 3.6 m |
| Lancet | M | strike craft | Faofaar Assembly yards | 1,080 / 1,210 | 290, 56 | 40 | 7 | 2/3/0/0 | 6 | 4 | 1.5 m – 1.9 m | 4.4 m – 5.6 m |
| Ferry | M | liner | Ulasenarvin Theocracy yards | 1,300 / 1,000 | 200, 30 | 200 | 7 | 1/0/0/0 | 30 | 3 | 956 k – 1.2 m | 2.7 m – 3.5 m |
| Scavenger | M | salvager | Greyhook Salvage Works | 1,500 / 500 | 170, 32 | 450 | 5 | 2/1/0/0 | 8 | 1 | 384 k – 491 k | 1.1 m – 1.4 m |
| Bulwark | L | frigate | Kaigemarrd Compact yards | 5,980 / 3,200 | 190, 22 | 300 | 7 | 4/4/2/0 | 60 | 3 | 5.8 m – 7.4 m | 16.5 m – 21.1 m |
| Caravel | L | freighter | Brask & Orrel Free Yards | 4,200 / 1,600 | 150, 18 | 3,000 | 6 | 2/2/0/0 | 20 | 1 | 2.2 m – 2.7 m | 6.1 m – 7.9 m |
| Warden | L | patrol cruiser | Veora Throne yards | 8,970 / 4,200 | 180, 18 | 250 | 7 | 4/4/3/0 | 90 | 3 | 7.3 m – 9.4 m | 20.9 m – 26.7 m |
| Atlas | L | mining refinery | Tamsin Mining Cooperative | 6,500 / 2,000 | 120, 14 | 4,000 | 5 | 2/2/1/0 | 40 | 2 | 4.5 m – 5.8 m | 12.9 m – 16.5 m |
| Pilgrim | L | deep explorer | Linaeulutis Theocracy yards | 3,420 / 4,180 | 170, 22 | 600 | 20 | 2/2/0/0 | 30 | 5 | 13.9 m – 17.8 m | 39.8 m – 50.8 m |
| Reaver | L | raider | Greyhook Salvage Works | 5,000 / 2,600 | 210, 24 | 800 | 7 | 4/3/2/0 | 45 | 2 | 3.8 m – 4.8 m | 10.8 m – 13.8 m |
| Wellspring | L | fuel tanker | Ulasenarvin Theocracy yards | 4,500 / 1,800 | 140, 15 | 2,500 | 8 | 2/1/0/0 | 25 | 2 | 3.8 m – 4.9 m | 10.8 m – 13.9 m |
| Citadel | XL | destroyer (4 in hangar) | Ixumth Collective yards | 20,700 / 11,000 | 160, 11 | 800 | 8 | 6/6/4/1 | 320 | 4 | 47.5 m – 60.7 m | 135.8 m – 173.5 m |
| Leviathan | XL | bulk freighter | Brask & Orrel Free Yards | 15,000 / 5,000 | 110, 8 | 30,000 | 6 | 3/3/1/0 | 120 | 1 | 18.7 m – 23.9 m | 53.4 m – 68.2 m |
| Sovereign | XL | battlecruiser (6 in hangar) | Kaitis Collective yards | 29,900 / 16,000 | 170, 10 | 1,000 | 8 | 6/8/5/2 | 600 | 4 | 84.5 m – 108.0 m | 241.4 m – 308.4 m |
| Ark | XL | colony ship (2 in hangar) | Ulasenarvin Theocracy yards | 20,000 / 9,000 | 100, 7 | 12,000 | 10 | 2/2/1/0 | 3,000 | 3 | 50.8 m – 64.9 m | 145.0 m – 185.3 m |
| Bastion | Capital | fleet carrier (36 in hangar) | Brask & Orrel Free Yards | 90,000 / 40,000 | 90, 4 | 60,000 | 12 | 8/8/4/2 | 8,000 | 4 | 1.63 bn – 2.08 bn | 4.65 bn – 5.94 bn |
| Tyrant | Capital | dreadnought (24 in hangar) | Kaigemarrd Compact yards | 184,000 / 70,000 | 80, 3 | 8,000 | 10 | 12/12/8/4 | 12,000 | 4 | 1.48 bn – 1.89 bn | 4.23 bn – 5.40 bn |
| Monolith | Capital | battleship (12 in hangar) | Veora Throne yards | 138,000 / 60,000 | 85, 3 | 5,000 | 9 | 10/10/8/4 | 9,000 | 5 | 912.6 m – 1.17 bn | 2.61 bn – 3.33 bn |

**Starting out:** a new player gets the cheapest jump-capable design their home yards sell under 100,000 SU (the
Linaeulutis Gnat, the Ulasenarvin Tinker), or the independent Wren. They also get money worth 20,000 SU in their
home currency.

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
- **Performance:**
  - generating a system takes under 1 ms;
  - finding the stars within 15 pc takes under 0.1 s, run off the frame loop (a worker where available);
  - with WebGL, 60 fps on any graphics card;
  - on the Canvas fallback on the Vivobook, under about 3,000 polygons per frame.
- **Size:** code and ship models a few hundred KB, sound about 1.5 MB, within 2 MB.

## Milestones

1. **M0 (this plan):** the galaxy model; the great powers, alliances, front-line wars, small factions, money,
   reputation and the 40 stock ships as models; their checks and the 3D viewer. Done.
2. **M1:** fly a ship in one system, with WebGL and the Canvas fallback; planets, a star and a station to dock at.
   Gamekit controls.
3. **M2:** the 3D star map and jumping: the whole galaxy, zoom to a region, plot a route; borders and contested
   space; lanes. The sky from real neighbours.
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
