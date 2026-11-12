/* ===== Ember Reach: the save (gamekit keeps one JSON value per game: RG.save / RG.load).
   Version 2 holds where the player is (the star, by id and place; the day), the ship (its design, where it is and
   how it's moving, flight assist, the throttle, its fuel, each module's health), whether it's docked, the last port
   (where a lost ship is replaced), the route's destination, and the settings. Version 1 saves (from M1, always in
   the home system) still load.
   Version 3 adds the player (M3): origin, money in each currency, cargo and what it cost, reputation with every
   faction, lawfulness, bounties and any commission. Older saves load with a fresh player from the same origin.
   The player also carries (M4) the hull's health and ammunition, and the war missions in hand; saves without them
   load with a whole hull, full magazines and no missions.
   unpack() checks everything, and gives null for anything it can't trust (another version, a damaged file), so a
   bad save starts a new game instead of breaking one.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const VERSION = 3;
const star = x => x && typeof x == 'object' && typeof x.id == 'string' && vec(x.p, 3) ? {id: x.id, p: x.p} : null;
const num = x => typeof x == 'number' && isFinite(x);
const vec = (x, n) => Array.isArray(x) && x.length == n && x.every(num);

/* g: {power, port, ship (id), day, t, docked, pad, s (flight state), fa, throttle, fit (modules.js), settings} */
function pack(g) {
	const r = v => v.map(x => +x.toPrecision(15));
	const ref = x => x ? {id: x.id, p: [x.x, x.y, x.z]} : null;
	return {v: VERSION, power: g.power, port: g.port || null, ship: g.ship, day: g.day, t: +g.t.toFixed(3), docked: !!g.docked, pad: g.pad || null,
		star: ref(g.star), fuel: +(g.fuel == null ? 1 : g.fuel).toFixed(4), lastPort: ref(g.lastPort), routeTo: ref(g.routeTo),
		player: g.player ? packPlayer(g.player) : null,
		p: r(g.s.p), vel: r(g.s.v), q: r(g.s.q), w: r(g.s.w), fa: !!g.s.fa, throttle: +(+g.throttle || 0).toFixed(3),
		modules: Object.fromEntries(g.fit.modules.map(m => [m.id, +m.hp.toFixed(2)])),
		settings: {quality: g.settings.quality == 'low' ? 'low' : 'high', sound: g.settings.sound !== false}};
}
/* the save checked against what this game knows: ships (ids), ports (class names), powers (how many) */
function unpack(raw, known) {
	if (!raw || typeof raw != 'object' || [1, 2, 3].indexOf(raw.v) < 0) return null;
	const k = known || {};
	if (!Number.isInteger(raw.power) || raw.power < 0 || (k.powers && raw.power >= k.powers)) return null;
	if (raw.v == 1 ? typeof raw.port != 'string' : raw.port !== null && typeof raw.port != 'string') return null;
	if (raw.port !== null && k.ports && k.ports.indexOf(raw.port) < 0) return null;
	if (raw.v >= 2 && (!star(raw.star) || !(typeof raw.fuel == 'number' && raw.fuel >= 0 && raw.fuel <= 1))) return null;
	const player = raw.v >= 3 ? unpackPlayer(raw.player) : null;
	if (raw.v >= 3 && raw.player != null && !player) return null;   /* a player that is there must be sound */
	if (typeof raw.ship != 'string' || (k.ships && k.ships.indexOf(raw.ship) < 0)) return null;
	if (!num(raw.day) || !num(raw.t) || raw.t < 0) return null;
	if (!vec(raw.p, 3) || !vec(raw.vel, 3) || !vec(raw.q, 4) || !vec(raw.w, 3)) return null;
	const qn = Math.hypot(...raw.q); if (qn < 0.5 || qn > 1.5) return null;
	if (!raw.modules || typeof raw.modules != 'object' || Object.values(raw.modules).some(h => !num(h) || h < 0)) return null;
	const set = raw.settings || {};
	return {power: raw.power, port: raw.port, ship: raw.ship, day: raw.day, t: raw.t, docked: !!raw.docked, pad: Number.isInteger(raw.pad) ? raw.pad : null,
		star: raw.v >= 2 ? star(raw.star) : null, fuel: raw.v >= 2 ? raw.fuel : 1, lastPort: raw.v >= 2 ? star(raw.lastPort) : null, routeTo: raw.v >= 2 ? star(raw.routeTo) : null, version: raw.v, player,
		p: raw.p, v: raw.vel, q: raw.q.map(c => c / qn), w: raw.w, fa: raw.fa !== false, throttle: num(raw.throttle) ? Math.max(-1, Math.min(1, raw.throttle)) : 0,
		modules: raw.modules, settings: {quality: set.quality == 'low' ? 'low' : 'high', sound: set.sound !== false}};
}
/* the player, compact: numbers rounded, empty entries dropped */
function packPlayer(P) {
	const r = (o, d) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v).map(([k, v]) => [k, +v.toFixed(d)]));
	return {origin: P.origin, species: P.species, wallet: r(P.wallet, 2), cargo: r(P.cargo, 0), cost: r(P.cost, 3), rep: r(P.rep, 2), start: r(P.start, 0), lawful: P.lawful || 0,
		bounties: r(P.bounties, 0), commission: P.commission || null, warEvents: (P.warEvents || []).slice(-200), ship: P.ship, day: P.day || 0,
		combat: P.combat || null, missions: (P.missions || []).filter(m => !m.done)};
}
const numMap = o => o && typeof o == 'object' && !Array.isArray(o) && Object.values(o).every(num);
function unpackPlayer(x) {
	if (!x || typeof x != 'object' || typeof x.origin != 'string' || !numMap(x.wallet) || !numMap(x.cargo) || !numMap(x.rep) || !x.ship || typeof x.ship.model != 'string') return null;
	if (Object.values(x.wallet).some(v => v < 0) || Object.values(x.cargo).some(v => v < 0 || !Number.isInteger(v))) return null;
	return {v: 1, origin: x.origin, species: x.species || '', wallet: Object.assign({}, x.wallet), cargo: Object.assign({}, x.cargo), cost: numMap(x.cost) ? Object.assign({}, x.cost) : {}, rep: Object.assign({}, x.rep),
		start: numMap(x.start) ? Object.assign({}, x.start) : {}, lawful: num(x.lawful) ? x.lawful : 0, bounties: numMap(x.bounties) ? Object.assign({}, x.bounties) : {}, commission: typeof x.commission == 'string' ? x.commission : null,
		warEvents: Array.isArray(x.warEvents) ? x.warEvents : [], ship: {model: x.ship.model, build: x.ship.build, sensors: x.ship.sensors}, day: num(x.day) ? x.day : 0, at: {},
		/* M4: the hull's health and ammunition carried over; war missions in hand */
		combat: x.combat && typeof x.combat == 'object' && num(x.combat.hull) ? x.combat : null,
		missions: Array.isArray(x.missions) ? x.missions.filter(m => m && typeof m.id == 'string' && m.star && typeof m.star.id == 'string' && Array.isArray(m.star.at) && num(m.due)) : []};
}
/* put saved module health back on a fresh fit (unknown modules are ignored; health never above the pool) */
function restoreModules(fit, saved) {
	for (const m of fit.modules) if (saved && typeof saved[m.id] == 'number') m.hp = Math.max(0, Math.min(m.max, saved[m.id]));
	return fit;
}

const EmberSave = {VERSION, pack, unpack, restoreModules, packPlayer, unpackPlayer};
if (typeof module != 'undefined') module.exports = EmberSave; else root.EmberSave = EmberSave;
})(typeof window != 'undefined' ? window : this);
