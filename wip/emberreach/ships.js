/* ===== Ember Reach: the stock ships (docs/plan-ember-reach.md, "Ships").
   Forty designs the NPCs fly (and players can buy, where a yard sells them): from one-seat shuttles to fleet
   carriers and dreadnoughts. Each is built by one of the great powers' shipyards or by an independent yard.
   - Builders: one great power in each of the six clusters (two in the North), and three independent yards.
   - Stats: hull and shields (how much it takes), speed and agility, cargo, jump range (pc), hardpoints
     (small, medium, large, huge), crew, tech level (1-5), length.
   - A great power's yards build to its species' bodies: heavy-bodied builders add armour and lose agility, light
     ones the reverse (factions.js: species.build).
   - Price comes from the stats, so a bigger or better ship costs more for reasons you can see:
       toughness (hull + 1.4 × shields), firepower (small 1, medium 3, large 9, huge 27), cargo, jump range,
       speed and agility, and tech (each level about 35% dearer); hangars on carriers.
     The list price is in Standard Units; a yard sells in its own currency at the day's rate, within a range
     (cheaper at independent yards and in the builder's own space, dearer abroad and near a front).
   - who: who flies them, so the game can put the right ships in the right places.
   - Names: every ship is named for a cryptid, a hybrid beast or an animal that's died out, one word or two joined by
     a hyphen, chosen for what it does (NAMES below). Its id (in saves and code) stays its first, working name.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const F = isNode ? require('./factions.js') : root.EmberFactions, E = isNode ? require('./economy.js') : root.EmberEconomy, G = isNode ? require('./galaxy.js') : root.EmberGalaxy;
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Capital'];
const INDEPENDENT = {A: 'Brask & Orrel Free Yards', B: 'Tamsin Mining Cooperative', C: 'Greyhook Salvage Works'};
/* name, size, role, maker (a great power by its place in the list, or an independent yard), hull, shields,
   speed (m/s), agility (°/s), cargo (t), jump (pc), hardpoints [S, M, L, H], crew, tech, length (m), hangar, who */
const STOCK = [
	['Wren', 'XS', 'shuttle', 'A', 90, 40, 220, 70, 4, 2, [0, 0, 0, 0], 1, 1, 9, 0, 'courier trader'],
	['Kestrel', 'XS', 'fighter', 0, 140, 90, 320, 95, 0, 0, [2, 0, 0, 0], 1, 2, 12, 0, 'navy pirate'],
	['Dart', 'XS', 'interceptor', 4, 110, 80, 380, 110, 0, 0, [2, 0, 0, 0], 1, 3, 10, 0, 'navy'],
	['Hob', 'XS', 'mining pod', 'B', 160, 30, 150, 50, 12, 1.5, [1, 0, 0, 0], 1, 1, 11, 0, 'miner prospector'],
	['Gnat', 'XS', 'racer', 2, 80, 60, 420, 105, 2, 3, [0, 0, 0, 0], 1, 3, 9, 0, 'courier'],
	['Spur', 'XS', 'bomber', 3, 200, 100, 240, 60, 0, 0, [0, 1, 0, 0], 2, 2, 14, 0, 'navy'],
	['Mote', 'XS', 'scout', 'C', 70, 50, 300, 90, 1, 4, [0, 0, 0, 0], 1, 2, 8, 0, 'explorer'],
	['Tinker', 'XS', 'repair tender', 5, 150, 70, 200, 60, 6, 2, [0, 0, 0, 0], 2, 2, 12, 0, 'nomad salvager'],
	['Lark', 'S', 'courier', 4, 300, 220, 330, 75, 20, 6, [1, 0, 0, 0], 2, 3, 22, 0, 'courier smuggler'],
	['Packet', 'S', 'light hauler', 'A', 380, 150, 210, 45, 120, 4, [2, 0, 0, 0], 2, 1, 28, 0, 'trader'],
	['Pike', 'S', 'gunship', 6, 520, 300, 260, 55, 10, 4, [2, 2, 0, 0], 3, 2, 30, 0, 'navy pirate bounty'],
	['Finch', 'S', 'explorer', 2, 330, 260, 250, 55, 30, 9, [1, 0, 0, 0], 2, 3, 26, 0, 'explorer'],
	['Burrow', 'S', 'miner', 'B', 480, 180, 170, 40, 160, 4, [1, 1, 0, 0], 3, 1, 32, 0, 'miner prospector'],
	['Shrike', 'S', 'heavy fighter', 0, 420, 320, 300, 70, 5, 5, [3, 1, 0, 0], 2, 3, 24, 0, 'navy bounty'],
	['Jackal', 'S', 'raider', 'C', 400, 250, 310, 68, 40, 5, [2, 1, 0, 0], 3, 2, 27, 0, 'pirate smuggler'],
	['Wisp', 'S', 'stealth scout', 5, 280, 300, 290, 65, 10, 8, [1, 0, 0, 0], 2, 4, 21, 0, 'navy explorer'],
	['Tern', 'S', 'passenger shuttle', 1, 350, 200, 240, 45, 30, 5, [0, 0, 0, 0], 2, 2, 30, 0, 'passenger'],
	['Drover', 'M', 'hauler', 'A', 1100, 500, 180, 30, 600, 5, [2, 1, 0, 0], 5, 1, 60, 0, 'trader'],
	['Corsair', 'M', 'multirole', 3, 1400, 900, 240, 42, 150, 6, [2, 2, 1, 0], 6, 3, 55, 0, 'pirate bounty trader'],
	['Halberd', 'M', 'corvette', 6, 2100, 1300, 230, 38, 60, 6, [3, 3, 1, 0], 18, 3, 70, 0, 'navy'],
	['Seeker', 'M', 'long-range explorer', 2, 1000, 1100, 220, 40, 120, 14, [1, 1, 0, 0], 5, 4, 58, 0, 'explorer'],
	['Delver', 'M', 'miner', 'B', 1600, 600, 150, 28, 700, 5, [2, 1, 0, 0], 8, 2, 64, 0, 'miner prospector'],
	['Mule', 'M', 'armoured trader', 1, 1800, 800, 170, 30, 500, 6, [2, 2, 0, 0], 7, 2, 66, 0, 'trader nomad'],
	['Lancet', 'M', 'strike craft', 4, 1200, 1100, 290, 50, 40, 7, [2, 3, 0, 0], 6, 4, 52, 0, 'navy'],
	['Ferry', 'M', 'liner', 5, 1300, 1000, 200, 30, 200, 7, [1, 0, 0, 0], 30, 3, 80, 0, 'passenger'],
	['Scavenger', 'M', 'salvager', 'C', 1500, 500, 170, 32, 450, 5, [2, 1, 0, 0], 8, 1, 62, 0, 'salvager nomad pirate'],
	['Bulwark', 'L', 'frigate', 0, 5200, 3200, 190, 24, 300, 7, [4, 4, 2, 0], 60, 3, 140, 0, 'navy'],
	['Caravel', 'L', 'freighter', 'A', 4200, 1600, 150, 18, 3000, 6, [2, 2, 0, 0], 20, 1, 170, 0, 'trader'],
	['Warden', 'L', 'patrol cruiser', 3, 7800, 4200, 180, 20, 250, 7, [4, 4, 3, 0], 90, 3, 160, 0, 'navy'],
	['Atlas', 'L', 'mining refinery', 'B', 6500, 2000, 120, 14, 4000, 5, [2, 2, 1, 0], 40, 2, 190, 0, 'miner prospector'],
	['Pilgrim', 'L', 'deep explorer', 2, 3800, 3800, 170, 20, 600, 20, [2, 2, 0, 0], 30, 5, 150, 0, 'explorer'],
	['Reaver', 'L', 'raider', 'C', 5000, 2600, 210, 24, 800, 7, [4, 3, 2, 0], 45, 2, 135, 0, 'pirate'],
	['Wellspring', 'L', 'fuel tanker', 5, 4500, 1800, 140, 15, 2500, 8, [2, 1, 0, 0], 25, 2, 180, 0, 'trader nomad'],
	['Citadel', 'XL', 'destroyer', 6, 18000, 11000, 160, 12, 800, 8, [6, 6, 4, 1], 320, 4, 420, 4, 'navy'],
	['Leviathan', 'XL', 'bulk freighter', 'A', 15000, 5000, 110, 8, 30000, 6, [3, 3, 1, 0], 120, 1, 700, 0, 'trader'],
	['Sovereign', 'XL', 'battlecruiser', 1, 26000, 16000, 170, 11, 1000, 8, [6, 8, 5, 2], 600, 4, 520, 6, 'navy'],
	['Ark', 'XL', 'colony ship', 5, 20000, 9000, 100, 7, 12000, 10, [2, 2, 1, 0], 3000, 3, 800, 2, 'nomad colonist'],
	['Bastion', 'Capital', 'fleet carrier', 'A', 90000, 40000, 90, 4, 60000, 12, [8, 8, 4, 2], 8000, 4, 1600, 36, 'nomad prospector navy'],
	['Tyrant', 'Capital', 'dreadnought', 0, 160000, 70000, 80, 3, 8000, 10, [12, 12, 8, 4], 12000, 4, 2200, 24, 'navy pirate'],
	['Monolith', 'Capital', 'battleship', 3, 120000, 60000, 85, 3, 5000, 9, [10, 10, 8, 4], 9000, 5, 1900, 12, 'navy']];

const BUILD = {heavy: {hull: 1.15, agility: 0.9, shield: 1}, light: {hull: 0.9, agility: 1.12, shield: 1.1}, balanced: {hull: 1, agility: 1, shield: 1}};
/* the list price in SU, from the stats */
function value(s) {
	const tough = s.hull + 1.4 * s.shield, fire = s.hard[0] + 3 * s.hard[1] + 9 * s.hard[2] + 27 * s.hard[3];
	return 120 * Math.pow(tough, 0.95) * Math.sqrt(1 + fire / 20) * Math.pow(1 + s.cargo / 250, 0.45) * (1 + 0.12 * s.jump)
		* Math.pow(s.speed / 200, 0.25) * Math.pow(s.agility / 40, 0.15) * Math.pow(1.35, s.tech - 1) * (1 + s.hangar / 40);
}
let SHIPS = null;
/* the ships' names, by id: fighters and warships after predators, haulers after beasts of burden, explorers after
   far-ranging or far-off things, miners after diggers and tuskers, pirates after things that prey in the dark */
const NAMES = {
	wren: 'Dodo',                 /* shuttle: a humble island hopper (extinct) */
	kestrel: 'Thylacine',         /* fighter: a lean hunter (extinct) */
	dart: 'Microraptor',          /* interceptor: small, feathered, fast (extinct) */
	hob: 'Glyptodon',             /* mining pod: an armoured digger (extinct) */
	gnat: 'Jackalope',            /* racer: the horned hare that's never caught (hybrid) */
	spur: 'Terror-Bird',          /* bomber: strikes from above (extinct) */
	mote: 'Mothman',              /* scout: watches, and is gone (cryptid) */
	tinker: 'Hippocamp',          /* repair tender: the sea-horse that tows the broken home (hybrid) */
	lark: 'Chupacabra',           /* courier and smuggler: in and out by night (cryptid) */
	packet: 'Quagga',             /* light hauler: a striped pack animal (extinct) */
	pike: 'Dire-Wolf',            /* gunship: a pack hunter (extinct) */
	finch: 'Thunderbird',         /* explorer: the great bird of far skies (cryptid) */
	burrow: 'Megatherium',        /* miner: the ground sloth that dug in (extinct) */
	shrike: 'Smilodon',           /* heavy fighter: the sabre-toothed cat (extinct) */
	jackal: 'Wendigo',            /* raider: hunger in the dark (cryptid) */
	wisp: 'Bunyip',               /* stealth scout: lurks unseen (cryptid) */
	tern: 'Passenger-Pigeon',     /* passenger shuttle (extinct) */
	drover: 'Aurochs',            /* hauler: the wild ox (extinct) */
	corsair: 'Griffin',           /* multirole: lion and eagle, at home anywhere (hybrid) */
	halberd: 'Manticore',         /* corvette: armed at both ends (hybrid) */
	seeker: 'Roc',                /* long-range explorer: the bird that crosses oceans (cryptid) */
	delver: 'Mammoth',            /* miner: tusks for the ice and the rock (extinct) */
	mule: 'Ankylosaur',           /* armoured trader: a tank on legs (extinct) */
	lancet: 'Hyaenodon',          /* strike craft: a bone-crushing predator (extinct) */
	ferry: 'Sea-Cow',             /* liner: Steller's gentle giant (extinct) */
	scavenger: 'Teratorn',        /* salvager: the giant carrion bird (extinct) */
	bulwark: 'Basilisk',          /* frigate: a killing look (hybrid) */
	caravel: 'Woolly-Rhino',      /* freighter: big, shaggy, unstoppable (extinct) */
	warden: 'Cerberus',           /* patrol cruiser: the hound at the gate (hybrid) */
	atlas: 'Deinotherium',        /* mining refinery: the down-tusked giant (extinct) */
	pilgrim: 'Mokele-Mbembe',     /* deep explorer: the one beyond the river (cryptid) */
	reaver: 'Megalodon',          /* raider: the great shark (extinct) */
	wellspring: 'Paraceratherium',/* fuel tanker: the biggest land mammal there was (extinct) */
	citadel: 'Tyrannosaur',       /* destroyer (extinct) */
	leviathan: 'Brontosaur',      /* bulk freighter: the long-necked giant (extinct) */
	sovereign: 'Chimera',         /* battlecruiser: lion, goat and serpent (hybrid) */
	ark: 'Elephant-Bird',         /* colony ship: the egg that held a world (extinct) */
	bastion: 'Leviathan',         /* fleet carrier: the sea beast (cryptid) */
	tyrant: 'Kraken',             /* dreadnought (cryptid) */
	monolith: 'Hydra'};           /* battleship: a head for every gun (hybrid) */
function ships() {
	if (SHIPS) return SHIPS;
	const M = F.majors();
	SHIPS = STOCK.map(([name, size, role, maker, hull, shield, speed, agility, cargo, jump, hard, crew, tech, length, hangar, who]) => {
		/* yard k: a power of cluster k (mod 6), so every cluster builds ships (the seventh, the North's second power) */
		const K = G.clusters(), m = typeof maker == 'number' ? M.filter(x => x.cluster == K[maker % K.length].id)[Math.floor(maker / K.length)] : null, b = BUILD[m ? m.species.build : 'balanced'];
		const s = {id: name.toLowerCase(), name: NAMES[name.toLowerCase()] || name, size, role, maker: m ? m.id : 'yard' + maker, makerName: m ? m.name.replace(/^The /, '') + ' yards' : INDEPENDENT[maker],
			hull: Math.round(hull * b.hull), shield: Math.round(shield * b.shield), speed, agility: Math.round(agility * b.agility), cargo, jump, hard, crew, tech, length, hangar, who: who.split(' ')};
		s.value = value(s);
		/* independents sell cheaper; great powers' yards charge for their name */
		s.premium = m ? 1.05 + 0.1 * (m.economy - 0.6) / 0.8 : 0.9;
		s.priceSU = [Math.round(s.value * s.premium * 0.9), Math.round(s.value * s.premium * 1.15)];
		return s;
	});
	return SHIPS;
}
/* the Precursors' hulls: never sold, built only by an artifact broker from a blueprint found in the Rift's ruins
   (outfit.js), with goods from both galaxies. Named, like their makers, for the oldest things that ever swam:
   stronger, faster and longer-legged than anything of their size the living build */
const PRECURSOR = [
	['Opabinia', 'S', 'precursor scout', 700, 600, 420, 100, 40, 16, [2, 0, 0, 0], 1, 6, 24],
	['Anomalocaris', 'M', 'precursor hunter', 3200, 2600, 360, 68, 150, 11, [3, 3, 2, 0], 6, 6, 62],
	['Dunkleosteus', 'L', 'precursor warship', 12500, 8000, 260, 32, 700, 12, [4, 5, 4, 0], 60, 6, 150],
	['Arthropleura', 'XL', 'precursor freighter', 30000, 19000, 180, 15, 40000, 15, [4, 4, 2, 0], 120, 6, 650]];
let PRE = null;
function precursors() {
	if (PRE) return PRE;
	PRE = PRECURSOR.map(([name, size, role, hull, shield, speed, agility, cargo, jump, hard, crew, tech, length]) => {
		const s = {id: name.toLowerCase(), name, size, role, maker: 'precursor', makerName: 'Precursor design', hull, shield, speed, agility, cargo, jump, hard, crew, tech, length, hangar: 0, who: [], precursor: true};
		s.value = value(s); s.premium = 1; s.priceSU = [Math.round(s.value), Math.round(s.value * 1.2)];
		return s;
	});
	return PRE;
}
/* any hull by id: the stock ones and the Precursors' */
const hull = id => ships().find(x => x.id == id) || precursors().find(x => x.id == id) || null;
/* what a ship costs at a station on a day: the range in the local currency (cheapest in its maker's own space,
   +10% at an ally's yard, +25% elsewhere, +40% near a front; enemies' ships aren't sold) */
function price(shipId, star, day, ctx) {
	const s = ships().find(x => x.id == shipId); if (!s) return null;
	const mk = E.market(star, day, ctx), cur = mk.currency, rate = cur == 'SU' ? 1 : E.rate(cur, day, ctx);
	let f = 1;
	if (mk.contested) f = 1.4;
	else if (s.maker.startsWith('major') && mk.holder) { const r = s.maker == mk.holder ? 1 : F.relation(s.maker, mk.holder); if (r < 0) return null; f = r > 0 && s.maker != mk.holder ? 1.1 : s.maker == mk.holder ? 1 : 1.25 }
	return {currency: cur, low: Math.round(s.priceSU[0] * f * rate), high: Math.round(s.priceSU[1] * f * rate)};
}
const EmberShips = {NAMES, SIZES, STOCK, PRECURSOR, ships, precursors, hull, value, price};
if (isNode) module.exports = EmberShips; else root.EmberShips = EmberShips;
})(typeof window != 'undefined' ? window : this);
