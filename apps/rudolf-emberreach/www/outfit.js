/* ===== Ember Reach: outfitting (docs/plan-ember-reach.md, "Outfitting").
   A ship's modules in four categories:
   - Core modules, one each, sized to the hull: power plant, thrusters, manoeuvring thrusters, hyperdrive, life
     support, fuel tank and canopy. Graded C (stock), B and A.
   - Internal modules, chosen for the ship's role, in its internal slots (sizes 1-7): cargo racks, shield generators,
     armour plating, refineries (mining), relay boosters (more hyperdrive range), and alien relay boosters, found
     only in ruins.
   - External modules on the hardpoints (small, medium, large, huge): weapons, mining lasers, tractor beams.
   - Utility mounts: active scanners (warrants, cargo manifests, asteroid resources) and passive sensors (the nav
     beacon receiver, the cartographic sensor that charts wild systems, linguistic decoders for other species'
     languages).
   A ship's stats come from its hull and its modules (derive): hold, shields, hull, jump range, fuel, speed. Power:
   the plant must cover what the modules draw. Ships are sold with a stock loadout matching their hull's figures.
   The fit is plain data, kept in the save with the ship. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const S = req('ships.js', 'EmberShips'), F = req('factions.js', 'EmberFactions');

const SIZE = {XS: 1, S: 2, M: 3, L: 4, XL: 5, Capital: 6};
/* P: Precursor, built only from the blueprints in the Rift's ruins (better than anything sold) */
const GRADE = {C: {k: 1, price: 1}, B: {k: 1.15, price: 2.6}, A: {k: 1.3, price: 6.5}, P: {k: 1.6, price: 18}};
/* internal slots by hull size (largest first); freighters, miners and carriers get a bigger second slot */
const INTERNAL = {XS: [2, 1, 1], S: [3, 3, 2, 1], M: [4, 4, 3, 2, 2], L: [5, 5, 4, 3, 3, 2], XL: [7, 6, 5, 5, 4, 3], Capital: [7, 7, 7, 6, 6, 5, 5]};
const UTILITY = {XS: 2, S: 3, M: 4, L: 5, XL: 6, Capital: 8};
const HOLDY = /hauler|freighter|miner|mining|trader|salvager|tanker|colony|carrier|liner|explorer/;

/* the catalogue. cat; name; sizes [min, max]; grades; price (SU, at size 1 grade C); draw (MW per size); text */
const CAT = {
	/* core */
	power: {cat: 'core', name: 'Power plant', grades: 'CBA', price: 3000, draw: 0, text: 'Powers every module'},
	thrusters: {cat: 'core', name: 'Thrusters', grades: 'CBA', price: 2500, draw: 0.5, text: 'Top speed and thrust'},
	maneuver: {cat: 'core', name: 'Manoeuvring thrusters', grades: 'CBA', price: 1800, draw: 0.3, text: 'Turn rates and side thrust'},
	hyperdrive: {cat: 'core', name: 'Hyperdrive', grades: 'CBA', price: 4000, draw: 0.4, text: 'Jump range'},
	life: {cat: 'core', name: 'Life support', grades: 'CBA', price: 1200, draw: 0.2, text: 'Air for the crew; a better unit holds out longer'},
	fuel: {cat: 'core', name: 'Fuel tank', grades: 'CBA', price: 800, draw: 0, text: 'More fuel: more jumps on a tank'},
	canopy: {cat: 'core', name: 'Canopy', grades: 'CBA', price: 900, draw: 0, text: 'Reinforced canopies take more punishment'},
	/* internal */
	cargo: {cat: 'internal', name: 'Cargo rack', grades: 'C', sizes: [1, 8], price: 400, draw: 0, text: 'Hold space'},
	shield: {cat: 'internal', name: 'Shield generator', grades: 'CBA', sizes: [1, 7], price: 2200, draw: 0.5, text: 'Shields'},
	armour: {cat: 'internal', name: 'Armour plating', grades: 'CBA', sizes: [1, 7], price: 1500, draw: 0, text: 'More hull'},
	refinery: {cat: 'internal', name: 'Refinery', grades: 'C', sizes: [1, 6], price: 6000, draw: 0.4, text: 'Refines mined ore into tonnes of cargo'},
	relay: {cat: 'internal', name: 'Relay booster', grades: 'CBA', sizes: [1, 5], price: 9000, draw: 0.6, text: 'More hyperdrive range'},
	alien: {cat: 'internal', name: 'Alien relay booster', grades: 'A', sizes: [2, 4], price: 0, value: 400000, draw: 0.3, ruins: true, text: 'Far more range: built from a ruin\'s blueprint'},
	phaser: {cat: 'internal', name: 'Alien dimensional phaser', grades: 'A', sizes: [3, 3], price: 0, value: 300000, draw: 1.5, ruins: true, text: 'Lets the ship pass through a black hole\'s wormhole: built from a ruin\'s blueprint'},
	/* external: size is the smallest hardpoint it fits (1 small ... 4 huge) */
	pulse: {cat: 'external', name: 'Pulse laser', grades: 'C', sizes: [1, 1], price: 4000, draw: 0.3, weapon: true, text: '1.2 dmg × 6/s, heats'},
	driver: {cat: 'external', name: 'Mass driver', grades: 'C', sizes: [2, 2], price: 9000, draw: 0.4, weapon: true, text: '4.5 dmg × 2/s, 150 rounds'},
	missile: {cat: 'external', name: 'Missile rack', grades: 'C', sizes: [2, 2], price: 12000, draw: 0.2, weapon: true, text: '4 homing missiles, needs a lock'},
	heavy: {cat: 'external', name: 'Heavy laser', grades: 'C', sizes: [3, 3], price: 30000, draw: 0.7, weapon: true, text: '9 dmg × 1.5/s, heats'},
	torpedo: {cat: 'external', name: 'Torpedo rack', grades: 'C', sizes: [4, 4], price: 90000, draw: 0.6, weapon: true, text: '150 dmg homing, 8 torpedoes'},
	mining: {cat: 'external', name: 'Mining laser', grades: 'C', sizes: [1, 1], price: 5000, draw: 0.4, weapon: true, text: 'Breaks ore from asteroids'},
	needle: {cat: 'external', name: 'Precursor needle', grades: 'P', sizes: [1, 1], price: 4000, draw: 0.3, weapon: true, precursor: true, text: '3 dmg × 6/s, runs cool: Precursor work'},
	lance: {cat: 'external', name: 'Precursor lance', grades: 'P', sizes: [3, 3], price: 30000, draw: 0.8, weapon: true, precursor: true, text: '26 dmg × 1.5/s, cuts shields and hull alike: Precursor work'},
	tractor: {cat: 'external', name: 'Tractor beam', grades: 'C', sizes: [1, 1], price: 7000, draw: 0.3, text: 'Pulls canisters and ore to an open hatch'},
	/* utility: one per mount, no size */
	warrant: {cat: 'utility', name: 'Warrant scanner', kind: 'scanner', grades: 'C', price: 15000, draw: 0.2, text: 'Scan a ship for bounties in every jurisdiction'},
	manifest: {cat: 'utility', name: 'Manifest scanner', kind: 'scanner', grades: 'C', price: 9000, draw: 0.2, text: 'Scan a ship\'s cargo'},
	prospector: {cat: 'utility', name: 'Resource scanner', kind: 'scanner', grades: 'C', price: 8000, draw: 0.2, text: 'Scan an asteroid\'s minerals'},
	nav: {cat: 'utility', name: 'Nav beacon receiver', kind: 'sensor', grades: 'C', price: 3000, draw: 0.1, text: 'Arrive at a populated system\'s nav beacon, and take its system data'},
	carto: {cat: 'utility', name: 'Cartographic sensor', kind: 'sensor', grades: 'C', price: 6000, draw: 0.2, text: 'Chart wild systems and survey planets'},
	decoder: {cat: 'utility', name: 'Linguistic decoder', kind: 'sensor', grades: 'CBA', price: 7000, draw: 0.1, text: 'Translates the languages loaded into it'}};
const DECODER = {C: 2, B: 4, A: 8};   /* languages a decoder holds */
const LANG_PRICE = 2500;              /* SU for each language loaded */

const sizeOf = ship => SIZE[ship.size] || 1;
const coreSize = sizeOf;
/* slot layout of a hull */
function layout(ship) {
	const c = coreSize(ship), ints = INTERNAL[ship.size].slice();
	/* hold-built hulls: every bay a size bigger (up to 8), and the second as big as the first */
	if (HOLDY.test(ship.role)) { for (let i = 0; i < ints.length; i++) ints[i] = Math.min(8, ints[i] + 1); if (ints.length > 1) ints[1] = ints[0] }
	const ext = []; (ship.hard || [0, 0, 0, 0]).forEach((n, i) => { for (let k = 0; k < n; k++) ext.push(i + 1) });
	const core = ['power', 'thrusters', 'maneuver', 'life', 'fuel', 'canopy']; if (ship.jump > 0) core.splice(3, 0, 'hyperdrive');
	return {core, coreSize: c, internal: ints, external: ext, utility: UTILITY[ship.size]};
}
/* ---- what each module does ---- */
const rack = size => Math.round(2.5 * Math.pow(4, size - 1));
const shieldOf = (ship, m) => ship.shield * Math.pow(1.6, m.size - shieldSize(ship)) * GRADE[m.grade].k;
function shieldSize(ship) { const L = layout(ship).internal; return Math.max(1, Math.min(L[0], coreSize(ship) + 1)) }
const armourOf = (ship, m) => ship.hull * 0.08 * m.size * GRADE[m.grade].k;
const relayOf = m => m.id == 'alien' ? 1.5 * m.size : 0.35 * m.size * GRADE[m.grade].k;
const powerOf = (ship, m) => (3 + 3.5 * m.size) * GRADE[m.grade].k * (ship.size == 'Capital' ? 3 : ship.size == 'XL' ? 1.6 : 1);
function drawOf(m) { const d = CAT[m.id].draw; return CAT[m.id].cat == 'utility' ? d : d * (m.size || 1) * (m.grade == 'A' ? 1.2 : m.grade == 'P' ? 1.1 : 1) }
/* the price of a module, in SU */
function price(m) {
	const c = CAT[m.id]; if (!c) return 0;
	if (c.ruins) return c.value * m.size;
	const sz = c.cat == 'utility' ? 1 : Math.pow(2.4, (m.size || 1) - 1);
	return Math.round(c.price * sz * GRADE[m.grade || 'C'].price + (m.id == 'decoder' ? LANG_PRICE * ((m.langs || []).length) : 0));
}

/* ---- the stock loadout: today's hold, shields and guns ---- */
const STOCK = new Map();
function stock(ship) { if (!STOCK.has(ship.id)) STOCK.set(ship.id, JSON.stringify(stock0(ship))); return JSON.parse(STOCK.get(ship.id)) }
function stock0(ship) {
	const L = layout(ship), fit = {core: {}, internal: L.internal.map(() => null), external: L.external.map(() => null), utility: Array(L.utility).fill(null)};
	for (const k of L.core) fit.core[k] = {id: k, size: L.coreSize, grade: 'C'};
	/* the shield generator in the first slot that fits it, then racks for the hold, largest first */
	const free = L.internal.map((s, i) => i);
	if (ship.shield > 0) { const want = shieldSize(ship), i = free.slice().sort((a, b) => L.internal[a] - L.internal[b]).find(j => L.internal[j] >= want); if (i != null) { fit.internal[i] = {id: 'shield', size: want, grade: 'C'}; free.splice(free.indexOf(i), 1) } }
	if (/min/.test(ship.role) && free.length > 1) { const i = free.slice().sort((a, b) => L.internal[a] - L.internal[b])[0]; fit.internal[i] = {id: 'refinery', size: Math.min(6, L.internal[i]), grade: 'C'}; free.splice(free.indexOf(i), 1) }
	/* racks: the set of rack sizes in the free slots that comes nearest the hull's hold (a search: a handful of
	   slots), fewest racks on a tie */
	if (ship.cargo > 0) {
		let best = null;
		const go = (k, sum, pick) => {
			if (k == free.length) { const err = Math.abs(sum - ship.cargo) / ship.cargo + 0.02 * pick.filter(Boolean).length; if (!best || err < best.err) best = {err, pick: pick.slice()}; return }
			for (let z = 0; z <= L.internal[free[k]]; z++) { if (z && sum + rack(z) > ship.cargo * 2) break; pick.push(z); go(k + 1, sum + (z ? rack(z) : 0), pick); pick.pop() }
		};
		go(0, 0, []);
		best.pick.forEach((z, k) => { if (z) fit.internal[free[k]] = {id: 'cargo', size: z, grade: 'C'} });
	}
	/* guns: small pulse lasers, medium mass drivers (the last medium a missile rack, with two or more), large heavy
	   lasers, huge torpedo racks */
	const meds = L.external.filter(s => s == 2).length; let m = 0;
	fit.external = L.external.map(s => s == 1 ? {id: 'pulse', size: 1, grade: 'C'} : s == 2 ? {id: ++m == meds && meds >= 2 ? 'missile' : 'driver', size: 2, grade: 'C'} : s == 3 ? {id: 'heavy', size: 3, grade: 'C'} : {id: 'torpedo', size: 4, grade: 'C'});
	/* miners: a mining laser on the first small hardpoint, a tractor on the second, and a refinery */
	if (/min/.test(ship.role)) {
		const sm = L.external.map((z, i) => z == 1 ? i : -1).filter(i => i >= 0);
		if (sm[0] != null) fit.external[sm[0]] = {id: 'mining', size: 1, grade: 'C'};
		if (sm[1] != null) fit.external[sm[1]] = {id: 'tractor', size: 1, grade: 'C'};
	}
	/* utility: the nav receiver and the cartographic sensor; a warrant scanner on fighting ships */
	const u = ['nav', 'carto']; if (/min/.test(ship.role)) u.push('prospector'); if (/fighter|interceptor|gunship|corvette|frigate|cruiser|destroyer|battle|raider|strike|patrol|dreadnought/.test(ship.role)) u.push('warrant');
	u.slice(0, L.utility).forEach((id, i) => fit.utility[i] = {id, grade: 'C'});
	/* a plant that covers it */
	for (const g of ['C', 'B', 'A']) { fit.core.power.grade = g; if (power(ship, fit).ok) break }
	return fit;
}
/* ---- power ---- */
function modules(fit) { return [...Object.values(fit.core), ...fit.internal, ...fit.external, ...fit.utility].filter(Boolean) }
function power(ship, fit) {
	const out = fit.core.power ? powerOf(ship, fit.core.power) : 0, draw = modules(fit).reduce((t, m) => t + drawOf(m), 0);
	return {out, draw, ok: draw <= out + 1e-9};
}
/* ---- a ship as its modules make it: the hull's figures, with these in place ---- */
function derive(ship, fit) {
	fit = fit || stock(ship);
	const g = k => fit.core[k] ? GRADE[fit.core[k].grade].k : 0, ints = fit.internal.filter(Boolean), ut = fit.utility.filter(Boolean);
	const out = Object.assign({}, ship);
	out.cargo = ints.filter(m => m.id == 'cargo').reduce((t, m) => t + rack(m.size), 0);
	out.shield = ints.filter(m => m.id == 'shield').reduce((t, m) => Math.max(t, shieldOf(ship, m)), 0);
	out.hull = ship.hull + ints.filter(m => m.id == 'armour').reduce((t, m) => t + armourOf(ship, m), 0);
	out.jump = fit.core.hyperdrive ? ship.jump * (1 + (g('hyperdrive') - 1) * 1.5) + ints.filter(m => m.id == 'relay' || m.id == 'alien').reduce((t, m) => t + relayOf(m), 0) : 0;
	out.speed = ship.speed * (1 + (g('thrusters') - 1) * 0.4);
	out.agility = (ship.agility || 1) * (1 + (g('maneuver') - 1) * 0.4);
	out.tank = fit.core.fuel ? 1 + (g('fuel') - 1) * 3 : 1;                     /* C 1, B 1.45, A 1.9 tanks of stock fuel */
	out.canopyK = 1 + (g('canopy') - 1) * 4; out.lifeK = 1 + (g('life') - 1) * 4;
	out.guns = fit.external.filter(m => m && CAT[m.id].weapon).map(m => m.id);
	out.mining = fit.external.filter(m => m && m.id == 'mining').length; out.tractor = fit.external.filter(m => m && m.id == 'tractor').length;
	out.refinery = ints.filter(m => m.id == 'refinery').reduce((t, m) => t + m.size + 1, 0);
	out.phaser = ints.some(m => m.id == 'phaser');
	out.utility = Object.fromEntries(ut.map(m => [m.id, true]));
	out.langs = [...new Set(ut.filter(m => m.id == 'decoder').flatMap(m => m.langs || []))];
	out.power = power(ship, fit);
	out.fit = fit;
	return out;
}

/* ---- the outfitting market ---- */
/* what a port sells: sizes and grades by its class (and a colony's tier); alien boosters never */
function stocks(port) {
	const cls = port && port.cls, max = cls == 'halo' ? 7 : cls == 'lantern' || cls == 'bloom' ? 5 : 3, grades = cls == 'halo' || cls == 'lantern' ? 'CBA' : 'CB';
	return {maxSize: max, grades};
}
/* the modules on offer for a slot: [{id, size, grade, price}] */
function offers(ship, slot, port) {
	const L = layout(ship), st = stocks(port), out = [];
	const add = (id, size) => { for (const gr of CAT[id].grades) if (st.grades.includes(gr) && !CAT[id].ruins && !CAT[id].precursor && (size || 1) <= st.maxSize + (id == 'cargo' ? 1 : 0)) out.push({id, size, grade: gr, price: price({id, size, grade: gr})}) };
	if (slot.cat == 'core') add(slot.key, L.coreSize);
	else if (slot.cat == 'internal') { const cap = L.internal[slot.i]; for (const id of Object.keys(CAT).filter(k => CAT[k].cat == 'internal')) { const [a, b] = CAT[id].sizes; for (let s = a; s <= Math.min(b, cap); s++) add(id, s) } }
	else if (slot.cat == 'external') { const cap = L.external[slot.i]; for (const id of Object.keys(CAT).filter(k => CAT[k].cat == 'external')) if (CAT[id].sizes[0] <= cap) add(id, CAT[id].sizes[0]) }
	else for (const id of Object.keys(CAT).filter(k => CAT[k].cat == 'utility')) add(id, 0);
	return out;
}
/* the module in a slot ({cat, key | i}) */
const at = (fit, slot) => slot.cat == 'core' ? fit.core[slot.key] : fit[slot.cat][slot.i];
function put(fit, slot, m) { if (slot.cat == 'core') fit.core[slot.key] = m; else fit[slot.cat][slot.i] = m }
/* fit a module (from the market or from storage) into a slot: the old one goes to storage. Checks size and power */
function install(ship, fit, slot, m) {
	const L = layout(ship), c = CAT[m.id];
	if (!c || c.cat != slot.cat) return {ok: false, why: 'That module doesn\'t go in this slot.'};
	if (slot.cat == 'core' && (m.id != slot.key || m.size != L.coreSize)) return {ok: false, why: 'A ' + c.name.toLowerCase() + ' of size ' + L.coreSize + ' goes here.'};
	if (slot.cat == 'internal' && m.size > L.internal[slot.i]) return {ok: false, why: 'Too big for a size ' + L.internal[slot.i] + ' slot.'};
	if (slot.cat == 'external' && c.sizes[0] > L.external[slot.i]) return {ok: false, why: 'Needs a bigger hardpoint.'};
	const next = JSON.parse(JSON.stringify(fit)), old = at(next, slot); put(next, slot, m);
	if (slot.cat == 'core' && slot.key == 'power' ? !power(ship, next).ok : !power(ship, next).ok) return {ok: false, why: 'Not enough power: ' + power(ship, next).draw.toFixed(1) + ' of ' + power(ship, next).out.toFixed(1) + ' MW. Fit a bigger power plant grade first.'};
	return {ok: true, fit: next, old};
}
function remove(ship, fit, slot) {
	if (slot.cat == 'core') return {ok: false, why: 'Core modules can be swapped, not removed.'};
	const next = JSON.parse(JSON.stringify(fit)), old = at(next, slot); if (!old) return {ok: false, why: 'Nothing there.'};
	put(next, slot, null);
	return {ok: true, fit: next, old};
}
/* the hold left if a fit changed: cargo has to fit */
const holdOf = (ship, fit) => fit.internal.filter(m => m && m.id == 'cargo').reduce((t, m) => t + rack(m.size), 0);
/* worth of a fit beyond stock (added to a ship's trade-in) */
const extra = (ship, fit) => Math.max(0, modules(fit).reduce((t, m) => t + price(m), 0) - modules(stock(ship)).reduce((t, m) => t + price(m), 0));

/* ---- alien blueprints (found in ruins) and the artifact broker's recipes ---- */
/* what building one takes: goods from the hold, and the broker's fee in SU */
const RECIPES = {
	alien: size => ({goods: {Artefacts: 3 * size, Beryllium: 2 * size, Electronics: size}, fee: 60000 * size}),
	phaser: () => ({goods: {Artefacts: 12, Uranium: 6, Diamond: 2, Electronics: 4}, fee: 250000}),
	/* Precursor work: the Rift's goods with this side's (so it takes both galaxies to build) */
	precursor: (size, mod) => ({goods: {'Precursor Relics': 1 + Math.ceil(size / 2), Nullite: 3 * size, Voidglass: size, Titanium: 4 * size, Electronics: 2 * size, ...(mod == 'lance' || mod == 'hyperdrive' ? {Aetherium: 2 * size} : {})}, fee: 120000 * size}),
	hull: (size, hull) => { const h = PRECURSOR_HULLS().find(x => x.id == hull), z = h ? SIZE[h.size] : 3; return {goods: {'Precursor Relics': 4 * z, Nullite: 20 * z, Voidglass: 8 * z, Aetherium: 6 * z, Titanium: 30 * z, Electronics: 12 * z, Diamond: 3 * z}, fee: Math.round((h ? h.value : 1e6) * 0.5)} }};
const BLUEPRINT = {alien: 'Alien relay booster', phaser: 'Alien dimensional phaser', precursor: 'Precursor', hull: 'Precursor hull'};
const PRECURSOR_HULLS = () => S.precursors ? S.precursors() : [];
/* what a Precursor blueprint makes: a module (core ones are built at your hull's size, at the broker) */
const PRECURSOR_MODS = ['power', 'thrusters', 'maneuver', 'hyperdrive', 'shield', 'armour', 'relay', 'needle', 'lance'];
const bpName = bp => bp.id == 'hull' ? (PRECURSOR_HULLS().find(h => h.id == bp.hull) || {name: '?'}).name + ' (Precursor hull)' : bp.id == 'precursor' ? 'Precursor ' + CAT[bp.mod].name.toLowerCase().replace(/^precursor /, '') + (CAT[bp.mod].cat == 'internal' ? ' ' + bp.size + 'P' : '') : BLUEPRINT[bp.id] + (bp.id == 'alien' ? ' ' + bp.size + 'A' : '');
const recipe = bp => bp.id == 'hull' ? RECIPES.hull(0, bp.hull) : bp.id == 'precursor' ? RECIPES.precursor(bp.size || 4, bp.mod) : RECIPES[bp.id](bp.size);
/* a Precursor ruin's survey: a blueprint more often than not. A hull now and then (10%), a weapon (15%), or a
   module (45%) */
function precursorFrom(rnd) {
	const r = rnd();
	if (r < 0.1) { const H = PRECURSOR_HULLS(); return H.length ? {id: 'hull', hull: H[Math.floor(rnd() * H.length)].id, size: 0} : null }
	if (r < 0.25) return rnd() < 0.6 ? {id: 'precursor', mod: 'needle', size: 1} : {id: 'precursor', mod: 'lance', size: 3};
	if (r < 0.7) { const mod = PRECURSOR_MODS.slice(0, 7)[Math.floor(rnd() * 7)], c = CAT[mod]; return {id: 'precursor', mod, size: c.cat == 'core' ? 0 : c.sizes[0] + Math.floor(rnd() * (Math.min(c.sizes[1], 6) - c.sizes[0] + 1))} }
	return null;
}
/* a ruin's survey turns up a blueprint now and then: a relay booster (30%) or a phaser (15%) */
function blueprintFrom(rnd) { const r = rnd(); return r < 0.15 ? {id: 'phaser', size: 3} : r < 0.45 ? {id: 'alien', size: 2 + Math.floor(rnd() * 3)} : null }
/* a blueprint found: it's a material, used up when the module is built (recycling the module gives it back) */
function learn(P, bp) { const b = {id: bp.id, size: bp.size || 0}; if (bp.mod) b.mod = bp.mod; if (bp.hull) b.hull = bp.hull; (P.blueprints = P.blueprints || []).push(b); return true }
/* the artifact broker builds one: the blueprint and the goods come from the hold, the fee in the local coin; the
   module goes to storage. pay(feeSU) pays it (trade.js), and returns {ok, code, amount} */
function build(P, bp, pay, ctx) {
	ctx = ctx || {};
	/* a core module is made to fit the hull you're flying; a hull must take your cargo */
	if (bp.id == 'precursor' && CAT[bp.mod].cat == 'core' && !ctx.coreSize) return {ok: false, why: 'Bring the ship it\'s for: core modules are made to its size.'};
	if (bp.id == 'hull') { const h = PRECURSOR_HULLS().find(x => x.id == bp.hull); if (!h) return {ok: false, why: 'Unknown hull.'}; if (ctx.held != null && ctx.held - Object.values(recipe(bp).goods).reduce((t, x) => t + x, 0) > derive(h).cargo) return {ok: false, why: 'Your cargo won\'t fit the ' + h.name + '\'s hold.'} }
	const rc = recipe(bp), short = Object.entries(rc.goods).filter(([g, t]) => (P.cargo[g] || 0) < t);
	if (short.length) return {ok: false, why: 'Needs ' + short.map(([g, t]) => t + ' t ' + g).join(', ') + ' in the hold.'};
	const p = pay(rc.fee); if (!p.ok) return {ok: false, why: 'The broker\'s fee is ' + rc.fee.toLocaleString('en') + ' SU in ' + p.code + '.'};
	for (const [g, t] of Object.entries(rc.goods)) { P.cargo[g] -= t; if (!P.cargo[g]) { delete P.cargo[g]; delete P.cost[g] } }
	const i = (P.blueprints || []).indexOf(bp); if (i >= 0) P.blueprints.splice(i, 1);
	if (bp.id == 'hull') return {ok: true, hull: bp.hull, paid: p};
	const m = bp.id == 'precursor' ? {id: bp.mod, size: CAT[bp.mod].cat == 'core' ? ctx.coreSize : CAT[bp.mod].cat == 'external' ? CAT[bp.mod].sizes[0] : bp.size, grade: 'P'} : {id: bp.id, size: bp.size, grade: 'A'};
	(P.stored = P.stored || []).push(m);
	return {ok: true, module: m, paid: p};
}
/* ---- recycling: any module, for materials; an alien one gives its blueprint back. Each station takes only so
   many in a while ---- */
const RECYCLE = {perStation: 3, days: 7, share: 0.5};
/* what a module breaks down into: half an alien recipe's goods and its blueprint; otherwise metals and electronics
   by category, size and grade */
function materials(m) {
	const c = CAT[m.id]; if (!c) return {goods: {}};
	if (c.ruins) { const rc = RECIPES[m.id](m.size), goods = {}; for (const [g, t] of Object.entries(rc.goods)) goods[g] = Math.floor(t * RECYCLE.share); return {goods, blueprint: {id: m.id, size: m.size}} }
	/* Precursor work gives its blueprint back too */
	if (m.grade == 'P') { const bp = {id: 'precursor', mod: m.id, size: c.cat == 'core' ? 0 : m.size}, rc = recipe(bp), goods = {}; for (const [g, t] of Object.entries(rc.goods)) goods[g] = Math.floor(t * RECYCLE.share); return {goods, blueprint: bp} }
	const z = m.size || 1, k = {C: 1, B: 1.5, A: 2}[m.grade] || 1, goods = {};
	const add = (g, t) => { t = Math.floor(t); if (t > 0) goods[g] = (goods[g] || 0) + t };
	if (c.cat == 'utility') { add('Electronics', 1 * k); add('Aluminum', 1) }
	else if (c.cat == 'external') { add('Iron', z); add('Titanium', z * 0.5 * k); add('Electronics', z * 0.5 * k) }
	else { add('Iron', z * 1.5); add('Aluminum', z); add('Titanium', z * 0.3 * k); if (c.draw) add('Electronics', z * 0.5 * k) }
	return {goods};
}
/* how many more this station will take now: P.recycled[stationId] holds the days of the last ones */
function recycleRoom(P, stationId, day) { const L = ((P.recycled || {})[stationId] || []).filter(d => day - d < RECYCLE.days); return {left: RECYCLE.perStation - L.length, next: L.length ? Math.min(...L) + RECYCLE.days : null} }
/* recycle a stored module (index j in P.stored) at a station: materials to the hold (if they fit), a blueprint back */
function recycle(P, j, stationId, day, capacity) {
	const m = (P.stored || [])[j]; if (!m) return {ok: false, why: 'No such module.'};
	const room = recycleRoom(P, stationId, day);
	if (room.left <= 0) return {ok: false, why: 'This station\'s recyclers are busy: ' + RECYCLE.perStation + ' modules a ' + RECYCLE.days + '-day spell. Again from day ' + room.next + '.'};
	const mat = materials(m), t = Object.values(mat.goods).reduce((a, b) => a + b, 0), held = Object.values(P.cargo).reduce((a, b) => a + b, 0);
	if (held + t > capacity) return {ok: false, why: 'The materials (' + t + ' t) won\'t fit in the hold.'};
	P.stored.splice(j, 1);
	for (const [g, n] of Object.entries(mat.goods)) { const have = P.cargo[g] || 0; P.cost[g] = have ? (P.cost[g] || 0) * have / (have + n) : 0; P.cargo[g] = have + n }
	if (mat.blueprint) learn(P, mat.blueprint);
	P.recycled = P.recycled || {}; P.recycled[stationId] = [...((P.recycled[stationId] || []).filter(d => day - d < RECYCLE.days)), Math.floor(day)];
	return {ok: true, module: m, goods: mat.goods, blueprint: mat.blueprint || null};
}
/* brokers keep shop at the bigger ports */
const broker = port => !!port && ['lantern', 'halo', 'bloom'].includes(port.cls);

/* ---- languages ---- */
/* each great power's species has its own language; small factions speak their species' (the mixed speak trade
   pidgin, which everyone knows) */
function langOf(factionId) {
	const f = F.byId(factionId); if (!f) return null;
	if (f.kind == 'major') return f.id;
	const m = F.majors().find(x => x.species.name == (f.species && (f.species.name || f.species)));
	return m ? m.id : null;
}
const langName = id => { const f = F.byId(id); return f ? f.species.name : 'Trade pidgin' };
/* does this pilot, in this ship, understand them? */
function understands(P, dship, factionId) {
	const l = langOf(factionId);
	return !l || l == P.origin || (dship.langs || []).includes(l);
}
/* garbled text, the same every time for the same words */
function garble(text, factionId) {
	let h = 0; for (const c of String(factionId)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	const V = 'aeiouy', K = 'krvzthxqnmgdl';
	const mix = x => { x = Math.imul(x ^ (x >>> 16), 2246822507) >>> 0; x = Math.imul(x ^ (x >>> 13), 3266489909) >>> 0; return (x ^ (x >>> 16)) >>> 0 };
	return String(text).replace(/[A-Za-z]+/g, w => { let o = '', x = h; for (let i = 0; i < w.length; i++) { x = mix(x + w.charCodeAt(i) * 2654435761 + i); o += (i % 2 ? V : K)[(x >>> 8) % (i % 2 ? 6 : 13)] } return w[0] == w[0].toUpperCase() ? o[0].toUpperCase() + o.slice(1) : o });
}

/* ---- saved fits: check what comes back ---- */
function valid(ship, fit) {
	try {
		const L = layout(ship);
		if (!fit || typeof fit != 'object' || !fit.core || !Array.isArray(fit.internal) || !Array.isArray(fit.external) || !Array.isArray(fit.utility)) return false;
		if (fit.internal.length != L.internal.length || fit.external.length != L.external.length || fit.utility.length != L.utility) return false;
		for (const k of L.core) { const m = fit.core[k]; if (!m || m.id != k || m.size != L.coreSize || !GRADE[m.grade]) return false }
		const ok = (m, cat, cap) => !m || (CAT[m.id] && CAT[m.id].cat == cat && GRADE[m.grade] && (cat == 'utility' || (cat == 'internal' ? m.size <= cap : CAT[m.id].sizes[0] <= cap)));
		return fit.internal.every((m, i) => ok(m, 'internal', L.internal[i])) && fit.external.every((m, i) => ok(m, 'external', L.external[i])) && fit.utility.every(m => ok(m, 'utility'))
			&& fit.utility.every(m => !m || m.id != 'decoder' || (Array.isArray(m.langs) && m.langs.length <= DECODER[m.grade]));
	} catch (e) { return false }
}

const EmberOutfit = {PRECURSOR_MODS, precursorFrom, bpName, recipe, RECYCLE, materials, recycleRoom, recycle, RECIPES, BLUEPRINT, blueprintFrom, learn, build, broker, SIZE, GRADE, CAT, DECODER, LANG_PRICE, layout, rack, stock, power, derive, stocks, offers, at, install, remove, holdOf, extra, price, modules, langOf, langName, understands, garble, valid, drawOf, powerOf};
if (isNode) module.exports = EmberOutfit; else root.EmberOutfit = EmberOutfit;
})(typeof window != 'undefined' ? window : this);
