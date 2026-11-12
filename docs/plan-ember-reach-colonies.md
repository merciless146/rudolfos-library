# Ember Reach: colonies (plan)

How players claim star systems and build colonies in them. The plan starts from Elite Dangerous's *Trailblazers*
system colonisation (Frontier, live as a beta since 26 February 2025). It keeps what works there, avoids what
players found painful, and fits it to Ember Reach: a deterministic galaxy, great powers with currencies and front
lines, single-player and offline first. Part of [plan-ember-reach.md](plan-ember-reach.md).

## How Trailblazers works

These are the public descriptions (Frontier's guide and update notes, and players' reports from the beta) as of its
2025 updates. Numbers have changed between updates.

1. **The claim.**
   - A *Colonisation Contact* at a station in a populated system sells a claim on an unpopulated system nearby. It
     cost 25 million credits, and the reach was about 15–16 light years from the claiming system.
   - You choose the **primary port** when you claim: an outpost, a Coriolis, or an Orbis or Ocellus starport.
   - You then have **24 hours** to fly there and deploy a **Colonisation Beacon**, or the system becomes free
     again. One active claim at a time.
2. **The primary port.**
   - Deploying the beacon makes you the **System Architect**, and a colonisation ship arrives.
   - You have **4 weeks** to deliver the port's commodities to it: steel, aluminium, polymers, food, CMM composites
     and so on, by the thousand tonnes.
   - An outpost is a solo job. A Coriolis is roughly **55–70 thousand tonnes**, 20 hours or more of hauling.
     Players used fleet carriers to stage it.
   - When it's done, the port comes online at the next weekly tick and factions move in. The architect is then free
     to claim the next system from it.
3. **Building out.**
   - After the primary port there's **no time limit**.
   - Each body has slots, in orbit and on the surface. Facilities are tiered:
     - tier 1 facilities give *tier 2 points*;
     - tier 2 facilities cost tier 2 points and give tier 3 points;
     - tier 3 facilities (the big ports) cost tier 3 points.
   - Each extra large port raises the point cost. The first port costs no points but more commodities.
4. **Economy.**
   - A port's market economy comes from the facilities linked to it. **Strong links** come from facilities around
     the same body, and are boosted or cut by the body's character (rings, life, volcanism, and so on). **Weak
     links** come from facilities elsewhere in the system and add only a little.
   - Facility types set a system's economy (extraction, refinery, industrial, agriculture, high tech, military,
     tourism, contraband) and its security, wealth, tech level and population.
5. **Rewards.** The architect gets a weekly payment from each system they built, a name in the system, and the
   chance to carry their squadron's faction into new space.
6. **What went wrong, per players and Frontier's own notes:**
   - **The grind:** big ports meant tens of hours of solo hauling against a deadline. NPCs couldn't help, and you
     couldn't pay other players.
   - **Claim sniping:** anyone could claim the next system from your new port the moment it opened. Some architects
     also lost their status mid-build.
   - **Too many colonies, too fast:** Frontier paused claims once, worried that unlimited colonies would change the
     empty deep space that makes the game.
   - **Opaque economy:** the link rules changed in Update 3, and players' plans broke with them.
   - **Scrap systems:** half-built or one-outpost systems were left behind as stepping stones.

## What Ember Reach takes, and changes

| Trailblazers | Ember Reach |
|---|---|
| Claims bought from a contact in a populated system, within ~15 ly | Claims bought from a **colonial office** at a great power's station or a free port, for a system within **one jump** (your drive's range) of a settled system. The galaxy's crowding sets how many systems that is: thousands in the Hearth, a few at the Rim |
| 24 hours to deploy the beacon; one claim at a time | **2 game days** to deploy; one open claim at a time, more with standing (below) |
| 4 weeks to build the primary port | **One season (30 game days)** for the primary port |
| 55–70 kt for a mid port, hauled solo | **Scaled to Ember Reach's ships:** about 1,500 t for an outpost and 8,000 t for a mid port. That's a few runs of a Drover (600 t) or Caravel (3,000 t), or one Leviathan (30,000 t). **And you can pay for help:** NPC haulers on contract, in the sponsor's currency |
| Fleet carriers stage the cargo | **Hire a carrier:** prospector guilds and nomads rent out their fleet carriers' holds for a season. It's also a way to meet the small factions |
| Tier 2/3 construction points | **Development points**, the same idea, shown openly: tier 1 builds earn tier 2 points, tier 2 builds cost them and earn tier 3, and the planner says exactly what each choice unlocks |
| Strong and weak links set the economy | The same, from the model's own data. Each body's real character (type, resources, rings, life, ruins, the star's metals) boosts or cuts its links, through the existing market model |
| Weekly architect payments | **A season's share** of the colony's trade, in the sponsor's currency (or the colony's own scrip, if independent) |
| Sniping and lost status | **Offline, it can't happen:** colonies are kept in the player's save. For optional shared play later, a claim is the claimant's until it lapses, and the next claim from a new port is the architect's for a day |
| Claim pause (too many colonies) | **A budget by standing:** one colony to start, more as a sponsor's reputation rises (up to about one per 100 reputation above Friendly), and unclaimed space stays vast. The galaxy has 7.9 billion systems; even a hundred colonies a player won't dent it |

## How it works in Ember Reach

### Where you can claim

- **Unclaimed space**, outside the great powers' 500,000 systems, is open, from any settled system within one jump:
  - a great power's or free port's station (the claim's sponsor);
  - or one of your own colonies, once its primary port is done. That's Trailblazers' daisy chain, which carries
    settlement outwards.
- **Inside a great power's held space**, you need that power's **charter**: Friendly or better, through its own
  colonial office. The colony is then part of that power, and it pays its taxes.
- **Contested space** can't take a civilian colony. A **forward base** (military port) can be built there for a
  side you're commissioned with. It counts as a supplied system of yours for the war, but under the same rules:
  - it can only be built where your side's chain reaches from its rear;
  - pushing deep towards the enemy's rear is still almost impossible (the depth multiplier);
  - and the enemy will try to take it.
- **Not at all:** the Core (inside 30 pc), and systems with no planets (nowhere to put a port).
- **The great powers' totals don't change.** A colony is a pocket of its sponsor in empty space, not a change to
  the claims. So "500,000 systems held and contested, a quarter of each power contested" stays true. A colony
  inside a power's space adds to what it holds there.

### The claim

1. At a colonial office, pick a system within one jump. The office's **planner** shows its bodies with the model's
   data: type, gravity, temperature, atmosphere, resources, rings, ESI, life and ruins. It also shows the **slots**
   each body offers, and what each primary port would cost and give.
2. Choose the **primary port** and pay the claim fee:
   - **outpost:** 120,000 SU;
   - **station:** 300,000 SU;
   - **great port:** 750,000 SU.
   - Each is paid in the sponsor's currency at the day's rate (a free port takes any currency at its cut).
3. Fly there within **2 game days** and drop the **beacon**. You're the system's **architect**; a constructor
   ship arrives.
4. Deliver the primary port's goods within **one season**. Progress is kept, and the season clock pauses while the
   game is paused, as all game time does.
5. When it's done, the port opens at the next day's turn. The colony's first population moves in: from the sponsor,
   from you (your origin's species), and from any small faction that helped.

If the season runs out, the claim lapses. What you delivered stays at the site as salvage, and you can claim it
again later at a third off the fee: a softer end than losing everything.

### Slots

Taken from the system's own bodies (galaxy.js):
- **Orbital slots** around each planet: 1, plus 1 per 2 Earth radii, plus 1 if ringed. Gas giants have up to 4;
  their rings and moons are where refineries and fuel go.
- **Surface slots** on rocky worlds under 2.5 g: 1 to 3, by size. More on worlds with air and water.
- **A belt slot** for systems with an asteroid belt (later: belts aren't in the model yet; see "Model changes").
- About 90% of planets in the quiet Reaches are rocky (median 0.9 g), a quarter are ringed, 8% have liquid water
  and 4% have life. A typical system with planets (6.8 of them) offers about 15–20 slots.

### Facilities

Three tiers. A tier 1 build earns tier 2 points; a tier 2 build costs tier 2 points and earns tier 3; a tier 3 build
costs tier 3 points. The first port costs no points but 20% more goods. Each further tier 3 port costs 2 more tier
3 points than the last.

| Facility | Where | Tier | Goods (t) | Effect |
|---|---|---|---|---|
| Outpost | orbit | 1 (primary) | ~1,500 | small and medium ships dock; a market; colony economy |
| Station | orbit | 2 (primary) | ~8,000 | all but capital ships; a shipyard for S–M ships |
| Great port | orbit | 3 (primary) | ~25,000 | everything; shipyard to L; outfitting; +population cap |
| Surface port | surface | 2 or 3 | ~6,000 / ~20,000 | as above, on the ground; strong links to its body's installations |
| Mining installation | orbit or surface | 1 | ~600 | extraction economy; the body's resources sell cheap |
| Refinery | orbit (gas giant, ring) | 1–2 | ~900 | refinery economy; fuel, metals refined |
| Farm dome / agriculture | surface (air) or orbit | 1 | ~700 | agriculture; strong on living and water worlds |
| Industrial yard | orbit | 2 | ~2,500 | machinery, munitions; needs refinery links |
| Research station | orbit or surface | 2 | ~2,000 | tech level +; strong near ruins (artefacts studied) |
| Habitat ring / settlement | orbit or surface | 1–2 | ~1,000 / ~3,000 | population; the colony's species and wealth |
| Military outpost | orbit | 2 | ~2,500 | security +; patrols; the only build in contested space (forward base) |
| Relay beacon | orbit | 1 | ~400 | joins the sponsor's lanes (50-pc lane jumps from here) |
| Tourist installation | orbit or surface | 1 | ~800 | wealth +; strong on living worlds and ringed giants |
| Smugglers' den | surface | 1 | ~600 | a black market; security −; syndicates warm to you, the sponsor cools |

The goods come from the existing set (`economy.js`): iron, aluminium, titanium, machinery, electronics, food, water,
fuel and medicine for the colonists, and munitions for military builds. Buying them is real trade. The market reacts
(prices rise where you buy a lot), and the sponsor's currency rate decides the bill.

### Economy: links, from the model

- Each port's market gets **strong links** from facilities around or on its own body (×1.0, boosted or cut by the
  body), and **weak links** from facilities elsewhere in the system (×0.05).
- **Body boosts and cuts**, from galaxy.js:
  - rings: refinery and mining ×1.3;
  - a living world: agriculture and tourism ×1.4, industrial ×0.8;
  - water: agriculture ×1.2;
  - ruins: research ×1.5;
  - metal-rich star ([Fe/H] > +0.1): mining ×1.2;
  - a white dwarf or neutron star: research ×1.2, agriculture ×0.6;
  - high gravity (> 1.5 g): surface builds cost 25% more.
- **Into prices:** the port's economy mix feeds `economy.market()`, so its supply and demand come from what's built.
  An extraction-heavy port sells ore cheap and pays well for food and machinery.
- **The rules are shown, not hidden.** The planner previews a port's economy before you build, and the numbers are
  the ones the game uses. Trailblazers' opaque links frustrated players.

### Population and the colony's place

- **Population** grows each season towards a cap. The cap is set by the system's best world (ESI and air; a living
  world holds the most, a barren one only domes) and by its habitats and great ports.
- **Security, wealth and tech** come from facilities. They decide what's for sale (better shipyards and outfitting
  at high tech), how often pirates come (low security), and how the colony pays.
- **Who it belongs to:**
  - **Sponsored colonies** are pockets of their power. They use its currency, keep its law, and are hostile to its
    enemies. They pay the architect a season's share of trade (5–10% by wealth), and their standing follows the
    sponsor's.
  - **Independent colonies** (claimed through a free port) mint their own **scrip**. It's pegged to the Standard
    Unit at first, and its rate then floats on the colony's trade like any currency. They have no taxes and no
    protection: syndicates take an interest. If the colony thrives, small factions settle there.
- **Reputation:** finishing a sponsored colony is worth a large standing gain with its sponsor (+150), and a little
  with its allies, by the usual spread. Enemies of the sponsor take it as a gain for their enemy.

### Help, so it isn't a grind

- **Haulage contracts:** post a contract at any station. NPC traders bring the goods for a fee (10–25% over market,
  more far from trade lanes), at the speed their ships allow. This is the solo player's fleet. Elite's architects
  asked for exactly this.
- **Rented carriers:** a prospector guild or nomad flotilla will park its fleet carrier at your site for a season,
  for a fee, as a depot and market. Their stance towards you matters.
- **Other players** (when shared play comes): anyone may deliver to your site and be paid from your escrow.

### Danger and the wars

- **Construction sites draw trouble.** Syndicates raid supply runs (the security of the space around decides how
  often), and a sponsor's enemies harass colonies near its borders.
- **Forward bases** in contested space are war effort that stays: a supplied forward base digs in faster, and attacks
  from it count a little more (+10%). They are still subject to supply chains (cut off, a base wears away) and the
  depth multiplier.
- A colony can be **lost**: an independent one to a syndicate's takeover if its security stays low for a season. A
  sponsored one inside a power's space is never lost, but its ports can be damaged and need repair goods.

### What's kept in the save

Only the player's own changes, as for everything else in Ember Reach:
- each colony: system id, sponsor, architect, claim and season dates, facilities with their build progress, goods
  delivered, population, scrip rate state, events;
- open contracts.

The system itself is rebuilt from the galaxy model every time. A colony is a few hundred bytes, so a hundred fit
easily in a save.

### Model changes needed

- `galaxy.js`: **asteroid belts** (a body type: beyond the snow line and inner belts by chance; the WOS statistics
  have asteroid fields at about 10% of stars), and **moons** (later), for slots.
- `colonies.js` (new):
  - slots per body;
  - the facility catalogue (tiers, goods, effects);
  - development points and their rules;
  - links and body boosts;
  - colony state and season steps (population, payments, raids);
  - claim checks (range, space, budget, charter).
- `economy.js`: a market built from a port's links, where a colony stands.
- `factions.js`: forward bases join war effort (supplied anchors under the same chain and depth rules); colonies
  count in a sponsor's held systems.
- `reputation.js`: colony actions (claim, finish, abandon, lose); a colony budget by standing.
- `ships.js`: hauling contracts use the catalogue's traders (Drover, Caravel, Leviathan) at their real cargo and
  speed.
- **The 3D map:** colonies as markers in their sponsor's colour; independent ones in white, with a ring.

### Tests (when built)

- **Claims:**
  - only within one jump of a settled system;
  - never in the Core, a contested zone (civilian) or a planet-less system;
  - inside a power's space only with its charter.
- **Slots** match the model's bodies (rings, gravity, air).
- **Points:** tier rules hold, and the escalating tier 3 costs.
- **Goods:**
  - totals by facility;
  - the first port's +20%;
  - prices follow the sponsor's currency.
- **Season:** a primary port not finished in a season lapses, and the salvage discount applies on a reclaim.
- **Links:**
  - strong and weak links as described;
  - body boosts from the model's data;
  - the port's market follows its economy.
- **Wars:**
  - a forward base counts as supplied only through its side's chain;
  - the depth multiplier still holds with bases (no side loses all its contested space);
  - the great powers' 25% contested share is unchanged by civilian colonies.
- **Saves:** colonies come back from the save exactly.
- **Speed:** a colony's season step in under a millisecond; the planner's slot listing in under 50 ms.

## Milestone

Colonies come after trade, combat and exploration work (M3–M5), as **M5b**, before the Core and polish (M6):
1. **M5b-1:** claims, beacons, the primary port and goods delivery, with haulage contracts. A finished outpost with a
   market. **Playable** (`wip/emberreach/colonies.js`, 19 checks in `tests/emberreach_colonies_t.js`):
   - **The colonial office** (Contacts, at any great power's port, your own colonies' included): your colonies and
     their builds, haulage from that port, and the **planner**: the ten nearest claimable systems within one jump,
     each with its planets, the port world (the most Earth-like) and the three primary ports' fees and goods.
   - **Claims** follow the rules above: one jump, planets, not the Core, not contested, no port already, a charter
     (Friendly) inside a power's own space, Neutral or better in unclaimed space; one open claim at a time and the
     budget by standing. Fees: 120,000 / 300,000 / 750,000 SU in the sponsor's coin.
   - **The beacon:** in the system within 2 days, N within 30 radii of the port world. A constructor ship arrives.
   - **Goods:** N within 3 km of the constructor (under 60 m/s) hands over what the build needs from your hold. The
     outpost takes 1,500 t (iron, aluminium, titanium, machinery, electronics, food, water, fuel); a station
     9,000 t; a great port 25,000 t.
   - **Haulage contracts:** from any port that trades in a power's coin, for each good still wanted, at 10–25% over
     its market plus 0.4% a parsec, paid up front. A Drover, Caravel or Leviathan brings it (by size) after the days
     of its journey, at the next day's turn (each jump).
   - **Done:** the port opens the next day as the sponsor's port (Trefoil, Lantern or Halo), with a market in its
     coin, and the sponsor's standing rises by 150. **Lapses** keep the salvage and take a third off a new claim.
   - Saves keep colonies and contracts; the map shows your colonies' progress.
   - Not yet (M5b-2 and -3): slots and facilities, links, population and payments, forward bases, raids,
     independent colonies, rented carriers, belts.
2. **M5b-2:** slots, facilities, development points, links and the economy; population; payments. **Playable** (33 checks in
   `tests/emberreach_colonies_t.js` with part 1):
   - **Slots** per body as above (gas giants 2 to 4 in orbit, no surface; the primary port takes an orbital slot at
     its world). Belts wait for the model.
   - **Facilities:** the catalogue above, with these tonnages: mining 600, refinery 900 (gas giant or rings), farm 700
     (air for the surface), habitat ring 1,000, tourist 800, relay 400, smugglers' den 600; industrial yard 2,500,
     research 2,000, military 2,500, settlement 3,000, surface port 6,000, station 8,000; surface city 20,000, great
     port 25,000. Goods by mix (base, farm, military, research, habitat). Surface builds over 1.5 g cost 25% more.
   - **Points:** tier 1 builds earn a tier 2 point, tier 2 builds cost one and earn a tier 3 point, tier 3 builds
     cost 4 tier 3 points, then 6, 8… The primary port earns its tier's point (outpost: tier 2; station: tier 3).
   - **Building:** planned and started at the colonial office (any great power's port); goods handed over docked at
     the colony's own port, or brought by haulers (per build). No time limit.
   - **Links and the market:** strong links on the port's world, weak (5%) elsewhere, with the body boosts above. The
     port's market (`economy.market`, `ctx.econ`) makes cheaper what its economies produce (up to −35%) and dearer,
     and bought, what they use (up to +30%). The planner previews the mix before you build.
   - **Population** grows towards its cap (about 30% of the gap a season): 20,000 in domes, 200,000 with air,
     1,000,000 on an Earth-like world with air, 5,000,000 on a living one, plus habitats, settlements and ports.
   - **Security, wealth, tech** from the facilities and the port's tier.
   - **Pay:** each season from opening, the colony's trade (2 SU a head plus 5,000 SU per facility and the port)
     times 5–10% by wealth, in the sponsor's coin.
3. **M5b-3:** forward bases and the wars; raids; independent colonies and their scrip; rented carriers.

## Open questions

- Should claim fees and goods scale with distance from the sponsor (dearer far out), as a brake on spreading too
  thin?
- Should the great powers colonise too, at a slow pace over the seasons, so the frontier moves without the
  player? Their totals would then grow, past the 500,000 they hold now.
- Naming: may players name their colonies' systems (kept in the save), as they name discoveries?

## Sources

- Frontier: [Trailblazers update notes](https://www.elitedangerous.com/update-notes/4-1-0-0); [Trailblazers: the journey so far](https://www.elitedangerous.com/en-US/news/trailblazers-journey-so-far); the System Colonisation guide ([cms.zaonce.net](https://cms.zaonce.net/en-GB/node/6528))
- Frontier forums: [System Colonisation Beta details and feedback](https://forums.frontier.co.uk/threads/elite-dangerous-system-colonisation-beta-details-feedback.634055/); [Trailblazers Update 3 (links)](https://forums.frontier.co.uk/threads/elite-dangerous-trailblazers-update-3-wednesday-april-30.636973/post-10617727); [System Colonisation claim pause](https://forums.frontier.co.uk/threads/elite-dangerous-system-colonisation-claim-pause.634598/page-9)
- Summaries: [DPSS colonisation](https://dpss.space/colonisation); [primary port costs (Steam)](https://steamcommunity.com/app/359320/discussions/0/595142002438361698); [ED: Colonisation summary and tips](https://forums.frontier.co.uk/threads/ed-colonisation-summary-and-tips.637311)
