/* ===== Ember Reach: the save (gamekit keeps one JSON value per game: RG.save / RG.load).
   Version 2 holds where the player is (the star, by id and place; the day), the ship (its design, where it is and
   how it's moving, flight assist, the throttle, its fuel, each module's health), whether it's docked, the last port
   (where a lost ship is replaced), the route's destination, and the settings. Version 1 saves (from M1, always in
   the home system) still load.
   Version 3 adds the player (M3): origin, money in each currency, cargo and what it cost, reputation with every
   faction, lawfulness, bounties and any commission. Older saves load with a fresh player from the same origin.
   The player also carries (M4) the hull's health and ammunition, and the war missions in hand; saves without them
   load with a whole hull, full magazines and no missions. And (M5) the exploration record: systems charted,
   planets surveyed (first discoveries marked), what's been sold, and the names given. And (M5b) colonies and the
   haulage contracts on their way. And the Rift: a star there is saved like any other (its id starts "R:"), the
   blueprints may be Precursor ones, and P.rift remembers the first crossing.
   unpack() checks everything, and gives null for anything it can't trust (another version, a damaged file), so a
   bad save starts a new game instead of breaking one.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const VERSION = 3;
/* the galaxy a save was made in: 2 is 0.2.0's (4 million stars, twelve powers). A save from an older galaxy names
   stars and powers that are no longer there, so it keeps only its settings and a new game starts */
const GALAXY = 2;
const star = x => x && typeof x == 'object' && typeof x.id == 'string' && vec(x.p, 3) ? {id: x.id, p: x.p} : null;
const num = x => typeof x == 'number' && isFinite(x);
const vec = (x, n) => Array.isArray(x) && x.length == n && x.every(num);

/* g: {power, port, ship (id), day, t, docked, pad, s (flight state), fa, throttle, fit (modules.js), settings} */
function pack(g) {
	const r = v => v.map(x => +x.toPrecision(15));
	const ref = x => x ? {id: x.id, p: [x.x, x.y, x.z]} : null;
	return trim({v: VERSION, galaxy: GALAXY, power: g.power, port: g.port || null, ship: g.ship, day: g.day, t: +g.t.toFixed(3), docked: !!g.docked, pad: g.pad || null,
		star: ref(g.star), fuel: +(g.fuel == null ? 1 : g.fuel).toFixed(4), lastPort: ref(g.lastPort), routeTo: ref(g.routeTo),
		player: g.player ? packPlayer(g.player) : null,
		p: r(g.s.p), scale: 12, vel: r(g.s.v), q: r(g.s.q), w: r(g.s.w), fa: !!g.s.fa, throttle: +(+g.throttle || 0).toFixed(3),
		modules: Object.fromEntries(g.fit.modules.map(m => [m.id, +m.hp.toFixed(2)])),
		/* landed (L1.2): the world, and the ship's place and heading in its turning axes */
		landed: g.landed ? {world: g.landed.world, dir: r(g.landed.dir), h: +g.landed.h.toFixed(3), f: r(g.landed.f), u: r(g.landed.u)} : undefined, gear: g.gear ? true : undefined,
		/* the settings (settings.js), kept clean */
		settings: St ? St.sanitise(g.settings, null, I18 && I18.LANGS.map(l => l[0])) : g.settings});
}
/* gamekit keeps a save up to 256 KB. A long game's records grow past that (every system charted, every asteroid
   chipped), so a save over the budget is trimmed, the least needed first: the asteroids mined longest ago (they
   only matter where you are), old war events, then systems and planets charted long ago whose data is already
   sold (they may be charted again). First discoveries and names are always kept. */
const BUDGET = 230 * 1024;
function trim(out) {
	const size = () => JSON.stringify(out).length, P = out.player;
	if (!P || size() <= BUDGET) return out;
	P.mined = Object.fromEntries(Object.entries(P.mined || {}).slice(-1000)); P.warEvents = (P.warEvents || []).slice(-50);
	const X = P.explore = P.explore && Object.assign({}, P.explore);   /* (a copy: the game's own record stays whole) */
	if (X && size() > BUDGET) {
		X.sys = Object.assign({}, X.sys); X.sold = Object.assign({}, X.sold); X.pl = Object.assign({}, X.pl);
		/* sold planets that weren't firsts, then sold systems, oldest first, in batches */
		const pls = Object.keys(X.pl).filter(k => X.pl[k].s && !X.pl[k].f), syss = Object.keys(X.sys).filter(k => X.sold[k]).sort((a, b) => X.sys[a] - X.sys[b]);
		while (size() > BUDGET && (pls.length || syss.length)) {
			if (pls.length) for (const k of pls.splice(0, 200)) delete X.pl[k];
			else for (const k of syss.splice(0, 200)) { delete X.sys[k]; delete X.sold[k] }
		}
	}
	if (size() > BUDGET) P.mined = {};
	return out;
}
/* the save checked against what this game knows: ships (ids), ports (class names), powers (how many) */
function unpack(raw, known) {
	/* a new game keeps the settings: the save is just them until the first real one */
	if (raw && typeof raw == 'object' && raw.settingsOnly) return {settings: St ? St.sanitise(raw.settings, null, I18 && I18.LANGS.map(l => l[0])) : raw.settings};
	if (!raw || typeof raw != 'object' || [1, 2, 3].indexOf(raw.v) < 0) return null;
	if (raw.galaxy !== GALAXY) return {settings: St ? St.sanitise(raw.settings, null, I18 && I18.LANGS.map(l => l[0])) : raw.settings, oldGalaxy: true};
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
		p: raw.scale == 12 ? raw.p : raw.p.map(x => x / 12), v: raw.vel, q: raw.q.map(c => c / qn), w: raw.w, fa: raw.fa !== false, throttle: num(raw.throttle) ? Math.max(-1, Math.min(1, raw.throttle)) : 0,
		modules: raw.modules, settings: St ? St.sanitise(set, null, I18 && I18.LANGS.map(l => l[0])) : set,
		landed: landed(raw.landed), gear: raw.gear === true};
}
/* a landed ship's place, if it's sound (older saves have none) */
function landed(x) { return x && typeof x == 'object' && typeof x.world == 'string' && vec(x.dir, 3) && num(x.h) && x.h >= 0 && vec(x.f, 3) && vec(x.u, 3) ? {world: x.world, dir: x.dir, h: x.h, f: x.f, u: x.u} : null }
/* the player, compact: numbers rounded, empty entries dropped */
function packPlayer(P) {
	const r = (o, d) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v).map(([k, v]) => [k, +v.toFixed(d)]));
	return {origin: P.origin, species: P.species, wallet: r(P.wallet, 2), cargo: r(P.cargo, 0), cost: r(P.cost, 3), rep: r(P.rep, 2), start: r(P.start, 0), lawful: P.lawful || 0,
		bounties: r(P.bounties, 0), commission: P.commission || null, warEvents: (P.warEvents || []).slice(-200), ship: P.ship, stored: P.stored || [], blueprints: P.blueprints || [], recycled: P.recycled || {}, day: P.day || 0,
		mined: P.mined || {}, refinery: P.refinery || {}, combat: P.combat || null, missions: (P.missions || []).filter(m => !m.done), explore: P.explore || null,
		colonies: P.colonies || [], hauls: P.hauls || [], rift: P.rift || null, insurance: P.insurance === undefined ? undefined : P.insurance, policeKills: (P.policeKills || []).slice(-60)};
}
const numMap = o => o && typeof o == 'object' && !Array.isArray(o) && Object.values(o).every(num);
function unpackPlayer(x) {
	if (!x || typeof x != 'object' || typeof x.origin != 'string' || !numMap(x.wallet) || !numMap(x.cargo) || !numMap(x.rep) || !x.ship || typeof x.ship.model != 'string') return null;
	if (Object.values(x.wallet).some(v => v < 0) || Object.values(x.cargo).some(v => v < 0 || !Number.isInteger(v))) return null;
	return {v: 1, origin: x.origin, species: x.species || '', wallet: Object.assign({}, x.wallet), cargo: Object.assign({}, x.cargo), cost: numMap(x.cost) ? Object.assign({}, x.cost) : {}, rep: Object.assign({}, x.rep),
		start: numMap(x.start) ? Object.assign({}, x.start) : {}, lawful: num(x.lawful) ? x.lawful : 0, bounties: numMap(x.bounties) ? Object.assign({}, x.bounties) : {}, commission: typeof x.commission == 'string' ? x.commission : null,
		warEvents: Array.isArray(x.warEvents) ? x.warEvents : [], ship: {model: x.ship.model, build: x.ship.build, sensors: x.ship.sensors, fit: shipFit(x.ship)}, day: num(x.day) ? x.day : 0, at: {},
		/* mining: tonnes taken from each asteroid, and the refinery's bins */
		mined: obj(x.mined) ? Object.fromEntries(Object.entries(x.mined).filter(([k, v]) => num(v) && v >= 0).slice(-3000)) : {},
		refinery: obj(x.refinery) ? Object.fromEntries(Object.entries(x.refinery).filter(([k, v]) => num(v) && v > 0 && v < 1)) : {},
		/* recycling: the days of the latest modules each station took */
		recycled: obj(x.recycled) ? Object.fromEntries(Object.entries(x.recycled).filter(([k, v]) => Array.isArray(v) && v.every(num)).slice(-200)) : {},
		/* alien blueprints found in ruins */
		blueprints: Array.isArray(x.blueprints) ? x.blueprints.filter(b => obj(b) && num(b.size) && (b.id == 'alien' || b.id == 'phaser' || (b.id == 'precursor' && O && O.PRECURSOR_MODS.includes(b.mod)) || (b.id == 'hull' && typeof b.hull == 'string' && S0 && S0.hull(b.hull) && S0.hull(b.hull).precursor))).slice(0, 30) : [],
		/* the Rift: whether you've been (and the Maw's side you're on comes back with the star) */
		/* the days police ships were destroyed (the Interstellar Marshals count them) */
		policeKills: Array.isArray(x.policeKills) ? x.policeKills.filter(num).slice(-60) : [],
		rift: obj(x.rift) ? {first: num(x.rift.first) ? x.rift.first : null, crossings: num(x.rift.crossings) ? x.rift.crossings : 0} : null,
		/* modules in storage (bought, taken out, or found) */
		stored: Array.isArray(x.stored) ? x.stored.filter(m => obj(m) && O && O.CAT[m.id] && O.GRADE[m.grade]).slice(0, 60) : [],
		/* M4: the hull's health and ammunition carried over; war missions in hand */
		combat: x.combat && typeof x.combat == 'object' && num(x.combat.hull) ? x.combat : null,
		/* M5: what you've charted, surveyed, sold and named */
		explore: exploreOk(x.explore) ? x.explore : null,
		/* M5b: colonies and haulage contracts */
		colonies: Array.isArray(x.colonies) ? x.colonies.filter(c => obj(c) && typeof c.id == 'string' && obj(c.star) && Array.isArray(c.star.at) && obj(c.need) && obj(c.got) && typeof c.stage == 'string') : [],
		/* the ship's insurance (insurance.js): a policy, or none (null: cancelled); absent in older saves, which get
		   the starter's cover when the game next looks */
		insurance: x.insurance === null ? null : obj(x.insurance) && typeof x.insurance.provider == 'string' && typeof x.insurance.code == 'string' && num(x.insurance.paidTo) && num(x.insurance.owed) && x.insurance.owed >= 0 ? {provider: x.insurance.provider, code: x.insurance.code, since: num(x.insurance.since) ? x.insurance.since : 0, paidTo: x.insurance.paidTo, owed: x.insurance.owed} : undefined,
		hauls: Array.isArray(x.hauls) ? x.hauls.filter(h => obj(h) && typeof h.colony == 'string' && num(h.tons) && num(h.eta)) : [],
		missions: Array.isArray(x.missions) ? x.missions.filter(m => m && typeof m.id == 'string' && m.star && typeof m.star.id == 'string' && Array.isArray(m.star.at) && num(m.due)) : []};
}
const obj = o => o && typeof o == 'object' && !Array.isArray(o);
const O = typeof module != 'undefined' ? require('./outfit.js') : (typeof window != 'undefined' ? window.EmberOutfit : null);
const S0 = typeof module != 'undefined' ? require('./ships.js') : (typeof window != 'undefined' ? window.EmberShips : null);
const St = typeof module != 'undefined' ? require('./settings.js') : (typeof window != 'undefined' ? window.EmberSettings : null);
const I18 = typeof module != 'undefined' ? require('./i18n.js') : (typeof window != 'undefined' ? window.EmberI18n : null);
/* the ship's fit, if it's a valid fit for that hull (else the stock fit is used on load) */
function shipFit(sh) { const hull = S0 && (S0.hull ? S0.hull(sh.model) : S0.ships().find(s => s.id == sh.model)); return hull && O && O.valid(hull, sh.fit) ? sh.fit : null }
function exploreOk(e) {
	return obj(e) && obj(e.sys) && obj(e.pl) && obj(e.sold) && obj(e.names) && Object.values(e.sys).every(num) && Object.values(e.pl).every(obj)
		&& Object.values(e.names).every(n => typeof n == 'string' && n.length <= 24) && (e.land === undefined || (obj(e.land) && Object.values(e.land).every(obj)));   /* (landings: L1.4; older saves have none) */
}
/* put saved module health back on a fresh fit (unknown modules are ignored; health never above the pool) */
function restoreModules(fit, saved) {
	for (const m of fit.modules) if (saved && typeof saved[m.id] == 'number') m.hp = Math.max(0, Math.min(m.max, saved[m.id]));
	return fit;
}

const EmberSave = {BUDGET, trim, VERSION, GALAXY, pack, unpack, restoreModules, packPlayer, unpackPlayer};
if (typeof module != 'undefined') module.exports = EmberSave; else root.EmberSave = EmberSave;
})(typeof window != 'undefined' ? window : this);
