/* ===== Ember Reach: what a port's shipyard and outfitters offer, storing ships and modules, and transfers (0.3.8) =====
   Services by port:
   - Outpost stations (trefoil) are the smallest ports with a shipyard and outfitters: no ships for sale, a few
     modules (grade C, up to size 2, about half the range: which half is the port's own), and storage.
   - Bloom stations and surface settlements: ships up to M, modules up to size 4 in grades C and B.
   - Surface starports: ships up to L; heavy landing fields up to XL; modules up to size 5, grades C and B.
   - Living-world stations (lantern) and capitals' great ports (halo): every ship and every module, size 7,
     grade A: the most advanced and the dearest, by default.
   - Mining camps, surface outposts and forward bases have neither, and keep nothing in storage. Precursor
     anchorages keep an outpost station's outfitters and storage (the Rift builds no ships).
   Storage: ships and modules are kept at a port with storage, each where it was left. A stored ship keeps its fit,
   its modules' health, its fuel and anything in its hold. Taking one out stores the ship you came in, here.
   Transfers: a stored ship or module can be sent for from another port, to this one:
   - only with an empty hold (no commodities aboard; no passengers either, when ships carry them);
   - between ports in the same system: a flat 100 SU (in the port's coin), at once;
   - from another system: half the item's insurance premium (5% of its value: insurance.js) plus 25 SU a parsec for
     each step of its size class (a module 1 a size, a ship XS 1 to a capital ship 32), and a day plus a day for
     every 5 parsecs, rounded up. It arrives on that day.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const S = req('ships.js', 'EmberShips'), O = req('outfit.js', 'EmberOutfit'), G = req('galaxy.js', 'EmberGalaxy');
const HANGAR = {local: 100, insureShare: 0.05, perPc: 25, pcPerDay: 5, minDays: 1, mass: {XS: 1, S: 2, M: 4, L: 8, XL: 16, Capital: 32}, maxShips: 20, maxModules: 120};
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'Capital'];
/* what each kind of port offers: the largest ship its yard sells (null: none), its outfitters (null: none), storage */
const SERVICE = {
	trefoil: {yard: null, outfit: {maxSize: 2, grades: 'C', some: 0.5}, storage: true},
	bloom: {yard: 'M', outfit: {maxSize: 4, grades: 'CB'}, storage: true}, settlement: {yard: 'M', outfit: {maxSize: 4, grades: 'CB'}, storage: true},
	starport: {yard: 'L', outfit: {maxSize: 5, grades: 'CB'}, storage: true}, field: {yard: 'XL', outfit: {maxSize: 5, grades: 'CB'}, storage: true},
	lantern: {yard: 'Capital', outfit: {maxSize: 7, grades: 'CBA'}, storage: true}, halo: {yard: 'Capital', outfit: {maxSize: 7, grades: 'CBA'}, storage: true},
	camp: {yard: null, outfit: null, storage: false}, outpost: {yard: null, outfit: null, storage: false}, base: {yard: null, outfit: null, storage: false}};
const kindOf = port => !port ? null : port.surface ? port.kind : port.cls;
function services(port) {
	const k = kindOf(port), s = SERVICE[k] || SERVICE.trefoil;
	/* (the Rift's anchorages build nothing; the Maw's keeps an outpost station's services too) */
	return port && port.anchorage ? Object.assign({}, SERVICE.trefoil, {yard: null}) : s;
}
/* the sizes of ship a port's yard sells */
const yardSizes = port => { const y = services(port).yard; return y ? SIZES.slice(0, SIZES.indexOf(y) + 1) : [] };
/* does an outpost station's outfitter carry this module? (its own half of the range: seeded by the port) */
function carries(port, starId, m) {
	const o = services(port).outfit; if (!o) return false;
	if (!o.some) return true;
	const r = G.rng(G.hashStr('outfit:' + starId + ':' + ((port && port.id) || 'orbital') + ':' + m.id + ':' + (m.size || 0)))();
	return r < o.some;
}

/* ---- places ---- */
/* a place things are kept: the star (id, where it is), the port's id and name */
const placeOf = (star, port, name) => ({star: star.id, p: [star.x, star.y, star.z], port: (port && port.id) || 'orbital', name: name || (port && port.name) || star.name});
const samePlace = (a, b) => !!a && !!b && a.star == b.star && a.port == b.port;
const sameSystem = (a, b) => !!a && !!b && a.star == b.star;
const distPc = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
const ready = (x, day) => !x.ready || day >= x.ready;

/* ---- what things are worth, and what moving them costs ---- */
/* a ship's whole value (SU): its hull and what's fitted beyond stock (insurance.js shipValue) */
function shipValue(item) { const h = S.hull(item.ship.model); return h ? S.value(h) + (item.ship.fit ? O.extra(h, item.ship.fit) : 0) : 0 }
const moduleValue = m => O.price(m);
/* a transfer's quote, in SU, and the days it takes: {su, days, d (pc)}; or why it can't go */
function quote(kind, item, to, day) {
	if (!to) return {ok: false, why: 'Nowhere to send it.'};
	if (!ready(item, day)) return {ok: false, why: 'It is already on its way (due day ' + item.ready + ').'};
	if (samePlace(item.at, to)) return {ok: false, why: 'It is already here.'};
	if (kind == 'ship' && Object.values(item.cargo || {}).some(t => t > 0)) return {ok: false, why: 'Its hold isn\'t empty: ships are transferred only with nothing aboard.'};
	if (kind == 'ship' && (item.passengers || 0) > 0) return {ok: false, why: 'It has passengers aboard.'};
	if (sameSystem(item.at, to)) return {ok: true, su: HANGAR.local, days: 0, d: 0, local: true};
	const d = distPc(item.at, to), value = kind == 'ship' ? shipValue(item) : moduleValue(item.m);
	const mass = kind == 'ship' ? HANGAR.mass[(S.hull(item.ship.model) || {}).size] || 1 : Math.max(1, item.m.size || 1);
	return {ok: true, su: HANGAR.insureShare * value + HANGAR.perPc * d * mass, days: HANGAR.minDays + Math.ceil(d / HANGAR.pcPerDay), d, value};
}
/* send for it: it's here at once (same system) or on the quoted day; the caller has been paid */
function transfer(kind, item, to, day) {
	const q = quote(kind, item, to, day); if (!q.ok) return q;
	item.at = Object.assign({}, to); item.ready = q.days ? Math.floor(day) + q.days : 0;
	return Object.assign({ok: true}, q);
}

/* ---- ships in storage: P.hangar [{id, ship (P.ship's record: model, build, sensors, fit), modules (health),
   fuel, cargo, cost, combat, at, ready}] ---- */
const ships = (P, at, day) => (P.hangar || []).filter(x => !at || (samePlace(x.at, at) && ready(x, day)));
/* store the ship you came in at this port: everything about it goes with it */
function storeShip(P, state, at, day) {
	if ((P.hangar || []).length >= HANGAR.maxShips) return {ok: false, why: 'Storage is full: ' + HANGAR.maxShips + ' ships at most, in all.'};
	const n = (P.hangarSeq = (P.hangarSeq || 0) + 1);
	const item = {id: 'h' + n, ship: JSON.parse(JSON.stringify(P.ship)), modules: Object.assign({}, state.modules || {}), fuel: state.fuel == null ? 1 : state.fuel, o2: state.o2,
		cargo: Object.assign({}, P.cargo || {}), cost: Object.assign({}, P.cost || {}), combat: P.combat ? JSON.parse(JSON.stringify(P.combat)) : null, at: Object.assign({}, at), ready: 0, since: Math.floor(day)};
	(P.hangar = P.hangar || []).push(item);
	return {ok: true, item};
}
/* take a stored ship out here: the one you came in is stored in its place, and the hold goes with each ship. Returns
   the ship's state for the caller to fly (modules' health, fuel, the combat state) */
function swap(P, id, state, at, day) {
	const i = (P.hangar || []).findIndex(x => x.id == id), x = P.hangar[i];
	if (!x) return {ok: false, why: 'No such ship in storage.'};
	if (!samePlace(x.at, at) || !ready(x, day)) return {ok: false, why: x.ready && day < x.ready ? 'It arrives on day ' + x.ready + '.' : 'It is stored at ' + x.at.name + ': transfer it here first.'};
	P.hangar.splice(i, 1);
	const st = storeShip(P, state, at, day); if (!st.ok) { P.hangar.splice(i, 0, x); return st }
	P.ship = x.ship; P.cargo = x.cargo || {}; P.cost = x.cost || {}; P.combat = x.combat || null;
	return {ok: true, ship: x, stored: st.item, modules: x.modules, fuel: x.fuel, o2: x.o2};
}
/* sell a stored ship where it is kept: at a yard's part-exchange rate for the hull, 80% for what's fitted beyond
   stock (the caller pays) */
function sellShip(P, id, at, day) {
	const i = (P.hangar || []).findIndex(x => x.id == id), x = P.hangar[i];
	if (!x || !samePlace(x.at, at) || !ready(x, day)) return {ok: false, why: 'It isn\'t here.'};
	if (Object.values(x.cargo || {}).some(t => t > 0)) return {ok: false, why: 'Unload its hold first (take it out, and sell the cargo).'};
	P.hangar.splice(i, 1);
	return {ok: true, item: x};
}

/* ---- modules in storage: P.stored [{id, size, grade, ..., at, ready}] (kept before 0.3.8 without a place: the
   first port you dock at takes them in) ---- */
function adopt(P, at) { let n = 0; for (const m of P.stored || []) if (!m.at) { m.at = Object.assign({}, at); m.ready = 0; n++ } return n }
const modulesAt = (P, at, day) => (P.stored || []).map((m, j) => ({m, j})).filter(x => samePlace(x.m.at, at) && ready(x.m, day));
const modulesElsewhere = (P, at, day) => (P.stored || []).map((m, j) => ({m, j})).filter(x => !samePlace(x.m.at, at) || !ready(x.m, day));
const moduleQuote = (P, j, to, day) => { const m = (P.stored || [])[j]; return m ? quote('module', {m, at: m.at, ready: m.ready}, to, day) : {ok: false, why: 'No such module.'} };
function sendModule(P, j, to, day) { const m = (P.stored || [])[j]; if (!m) return {ok: false, why: 'No such module.'}; const q = moduleQuote(P, j, to, day); if (!q.ok) return q; m.at = Object.assign({}, to); m.ready = q.days ? Math.floor(day) + q.days : 0; return Object.assign({ok: true}, q) }

const EmberHangar = {HANGAR, SERVICE, services, yardSizes, carries, placeOf, samePlace, sameSystem, distPc, ready, shipValue, moduleValue, quote, transfer, ships, storeShip, swap, sellShip, adopt, modulesAt, modulesElsewhere, moduleQuote, sendModule};
if (isNode) module.exports = EmberHangar; else root.EmberHangar = EmberHangar;
})(typeof window != 'undefined' ? window : this);
