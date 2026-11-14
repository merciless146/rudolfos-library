/* ===== Ember Reach: exploration (docs/plan-ember-reach.md, "Exploration", M5).
   - Scanning: arriving in a system, the sensors sweep it (8 s): its star and every planet's type and orbit are
     charted. Flying within 6 radii of a planet with it targeted surveys it (12 s): gravity, temperature, atmosphere,
     resources, Earth similarity, life and ruins.
   - Discovery: the great powers have charted their own space. Elsewhere (unclaimed space, and ruins anywhere but in a
     port's system), the first survey is yours: credited to you, and a living world or a ruin you first surveyed is
     yours to name.
   - Data sells to Universal Cartographics at any port, once: a system chart, and each planet's survey by what it is
     (ruins and living worlds pay the most), 2.5 times for a first discovery. Selling to a power's cartographers
     pleases it a little.
   - Ruins: old defences guard them (sentinels: encounters.js, play.js); surveying a ruin turns up a cache of
     Artefacts that drift up as canisters.
   - Exploration contracts from cartographers: survey a world in a nearby uncharted system, or a ruin rumoured within
     20 pc; due in 20 days.
   - Landings (L1.4): the first landing on each world is recorded, and its data sells for half a survey (2.5 times
     that if nobody had landed there: outside the powers' charted space). A ground scan, landed or within 2 km of the
     ground, marks the deposits of the world's resources within 5 km (deposits()).
   The record (P.explore) is plain data, kept in the save: {sys: {starId: day}, pl: {key: {d: day, f: first, s: sold,
   lvl}}, sold: {starId: 1}, names: {key: name}, land: {key: {d, f, s}}}. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy'), F = req('factions.js', 'EmberFactions'), E = req('economy.js', 'EmberEconomy'), R = req('reputation.js', 'EmberReputation');

const EXPLORE = {sweep: 8, survey: 12, surveyRadii: 6, first: 2.5, chart: 40, days: 20, ruinSearch: 20, worldSearch: 8,
	value: {Gas: 120, Barren: 90, Exotic: 160, Desert: 140, Tundra: 160, Ocean: 450, EarthLike: 700, Forest: 900, Terra: 900}, life: 1500, ruin: 6000};
const keyOf = (starId, planetName) => starId + '|' + planetName;
const at = s => s.at || [s.x, s.y, s.z];
const record = P => { P.explore = P.explore || {sys: {}, pl: {}, sold: {}, names: {}}; P.explore.land = P.explore.land || {}; return P.explore };

/* has a great power already charted this? its own claimed space, and every system with a port; ruins only where a
   port is (out in the quiet systems nobody has looked closely) */
function charted(star, planet, port) {
	if (port) return true;
	if (planet && planet.ruins) return false;
	const c = F.claimAt(at(star));
	return !!(c.owner || c.contested);
}
/* what a planet's survey is worth, in SU (before the first-discovery bonus) */
/* (the Rift's worlds: twice as much; a Precursor ruin three times a ruin's) */
function worth(p) { return ((EXPLORE.value[p.type] || 100) * (1 + p.esi) + (p.alive ? EXPLORE.life : 0) + (p.ruins ? EXPLORE.ruin * (p.precursor ? 3 : 1) : 0)) * (p.rift ? 2 : 1) }

/* lone surface ports (landing L2.2: surface.js), which no beacon shows: found by a ground scan on their world, or
   from a cartographer's charts. Kept by star and port id, with the day found */
function found(P, starId, portId) { const X = record(P); return !!(X.found && X.found[starId + '|' + portId] != null) }
function find(P, starId, portId, day) { const X = record(P); X.found = X.found || {}; const k = starId + '|' + portId; if (X.found[k] != null) return false; X.found[k] = Math.floor(day); return true }
/* the sweep: a system charted. Returns true if it's new to you */
function chartSystem(P, star, day) { const X = record(P); if (X.sys[star.id] != null) return false; X.sys[star.id] = Math.floor(day); return true }
/* a planet surveyed: returns {new, first, ruins, alive, value} (value in SU, as it will sell) */
function survey(P, star, planet, port, day) {
	const X = record(P), k = keyOf(star.id, planet.name);
	if (X.pl[k]) return {new: false, first: !!X.pl[k].f};
	const first = !charted(star, planet, port);
	X.pl[k] = {d: Math.floor(day), f: first ? 1 : 0};
	if (X.sys[star.id] == null) X.sys[star.id] = Math.floor(day);
	return {new: true, first, ruins: !!planet.ruins, alive: !!planet.alive, value: worth(planet) * (first ? EXPLORE.first : 1)};
}
/* a landing on a world: recorded the first time; returns {new, first, value} */
function landed(P, star, planet, port, day) {
	const X = record(P), k = keyOf(star.id, planet.name);
	if (X.land[k]) return {new: false, first: !!X.land[k].f};
	const first = !charted(star, planet, port);
	X.land[k] = {d: Math.floor(day), f: first ? 1 : 0};
	return {new: true, first, value: landWorth(planet) * (first ? EXPLORE.first : 1)};
}
/* landing data: half a survey */
const landWorth = p => worth(p) / 2;
const landedOn = (P, starId, name) => !!(P.explore && P.explore.land && P.explore.land[keyOf(starId, name)]);
/* the deposits of a world's resources near a place on it (dir: in the world's own axes): seeded on a grid over the
   world (cells about 1.5 km), most with none and a few with one or two, each one of the world's resources. Within r metres of dir */
function deposits(world, planet, dir, r) {
	const res = (planet && planet.res) || []; if (!res.length) return [];
	const R = world.radius, cell = 1500 / R, out = [], nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l) };
	const span = Math.ceil(r / R / cell) + 1, base = dir.map(v => Math.round(v / cell));
	for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) for (let k = -span; k <= span; k++) {
		const c = [base[0] + i, base[1] + j, base[2] + k], cc = nrm(c.map(v => v * cell));
		/* only the cells along the surface: the one each cube cell's centre is nearest the sphere through */
		if (Math.abs(Math.hypot(...c.map(v => v * cell)) - 1) > cell * 0.5) continue;
		const g = G.rng(hash('dep:' + world.name + ':' + c.join(','))), n = g() < 0.91 ? 0 : g() < 0.85 ? 2 : 1;   /* (a handful within 5 km: most cells hold none) */
		for (let q = 0; q < n; q++) {
			const d = nrm(cc.map(v => v + (g() - 0.5) * cell)), dist = Math.acos(Math.max(-1, Math.min(1, d[0] * dir[0] + d[1] * dir[1] + d[2] * dir[2]))) * R;
			const kind = res[Math.floor(g() * res.length)], tons = Math.round(200 + g() * 4800);
			if (dist <= r) out.push({id: 'dep:' + world.name + ':' + c.join(',') + ':' + q, res: kind, dir: d, dist, tons});
		}
	}
	return out.sort((a, b) => a.dist - b.dist);
}
const surveyed = (P, starId, name) => !!(P.explore && P.explore.pl[keyOf(starId, name)]);
const charted_ = (P, starId) => !!(P.explore && P.explore.sys[starId] != null);

/* the data not yet sold: [{key, kind: 'system'|'planet', label, su}] */
function unsold(P) {
	const X = record(P), out = [];
	for (const id in X.sys) if (!X.sold[id]) out.push({key: id, kind: 'system', label: 'System chart', su: EXPLORE.chart});
	for (const k in X.land) {
		const e = X.land[k]; if (e.s) continue;
		const [id, name] = k.split('|'), p = planetByKey(id, name);
		out.push({key: k, kind: 'landing', label: (X.names[k] || name) + ' · landing data' + (e.f ? ' · first' : ''), su: (p ? landWorth(p) : 50) * (e.f ? EXPLORE.first : 1), first: !!e.f});
	}
	for (const k in X.pl) {
		const e = X.pl[k]; if (e.s) continue;
		const [id, name] = k.split('|'), p = planetByKey(id, name);
		out.push({key: k, kind: 'planet', label: (X.names[k] || name) + (p ? ' · ' + p.type + (p.alive ? ', life' : '') + (p.ruins ? ', ruins' : '') : '') + (e.f ? ' · first' : ''), su: (p ? worth(p) : 100) * (e.f ? EXPLORE.first : 1), first: !!e.f});
	}
	return out;
}
/* a planet from its key (the star's id holds its sector and index) */
function planetByKey(id, name) { const s = starById(id); if (!s) return null; const pl = G.system(s).planets; return pl.find(p => p.name == name) || pl.flatMap(p => p.moons || []).find(m => m.name == name) || null }
const STARS = new Map();
function starById(id) {
	if (STARS.has(id)) return STARS.get(id);
	/* ids are "sx,sy,sz/#n": the sector of 4 pc cubes (galaxy.js) */
	/* (the id names the star's cell; a Rift star's is its normal self's, after "R:") */
	const s = G.lookup(id, null);
	STARS.set(id, s); return s;
}
/* sell everything to a port's cartographers: pays in its currency (SU at free traders); pleases its holder */
function sell(P, holder, currency, day) {
	const X = record(P), items = unsold(P), su = items.reduce((t, x) => t + x.su, 0);
	if (!items.length) return {ok: false, why: 'Nothing to sell: scan systems and survey planets first.'};
	for (const x of items) if (x.kind == 'system') X.sold[x.key] = 1; else if (x.kind == 'landing') X.land[x.key].s = 1; else X.pl[x.key].s = 1;
	const code = currency || 'SU', amount = code == 'SU' ? su : su * E.rate(code, day);
	if (code == 'SU') { const o = F.byId(P.origin).currency.code; P.wallet[o] = (P.wallet[o] || 0) + su * E.rate(o, day) * 0.92 } else P.wallet[code] = (P.wallet[code] || 0) + amount;
	if (holder) R.act(P, 'scanRuins', holder, {amount: Math.min(5, su / 2000)});
	return {ok: true, items: items.length, su, amount: code == 'SU' ? su * 0.92 : amount, code: code == 'SU' ? F.byId(P.origin).currency.code + ' (via free traders)' : code};
}
/* naming: a living world or a ruin you discovered first. 2 to 24 letters, digits, spaces, apostrophes, hyphens */
function nameable(P) {
	const X = record(P);
	return Object.keys(X.pl).filter(k => X.pl[k].f).map(k => { const [id, name] = k.split('|'), p = planetByKey(id, name); return {key: k, name, p, named: X.names[k] || null} }).filter(x => x.p && (x.p.alive || x.p.ruins));
}
function rename(P, key, text) {
	const X = record(P), t = String(text || '').replace(/\s+/g, ' ').trim();
	if (!X.pl[key] || !X.pl[key].f) return {ok: false, why: 'Only your own first discoveries can be named.'};
	const [id, name] = key.split('|'), p = planetByKey(id, name);
	if (!p || !(p.alive || p.ruins)) return {ok: false, why: 'Only living worlds and ruins can be named.'};
	if (!/^[\p{L}\p{N}][\p{L}\p{N} '\-]{1,23}$/u.test(t)) return {ok: false, why: 'A name is 2 to 24 letters or digits (spaces, apostrophes and hyphens allowed).'};
	X.names[key] = t;
	return {ok: true, name: t};
}
/* what to call a planet: your name for it, or the catalogue's */
const nameOf = (P, starId, name) => (P.explore && P.explore.names[keyOf(starId, name)]) || name;

/* ---------- exploration contracts ---------- */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }
/* a port's cartographers' contracts for a day: survey a world in a nearby system you haven't charted; and, now and
   then, a ruin rumoured within 20 pc (the nearest few you haven't surveyed) */
function offers(P, star, port, day) {
	if (!port || !port.owner) return [];
	const o = F.byId(port.owner); if (!o || o.kind != 'major') return [];
	const r = G.rng(hash('carto:' + star.id + ':' + Math.floor(day))), p0 = at(star), out = [], code = o.currency.code;
	const near = G.starsNear(p0[0], p0[1], p0[2], EXPLORE.worldSearch).filter(s => s.id != star.id && s.kind == 'star' && !charted_(P, s.id));
	for (let k = 0; k < 2 && near.length; k++) {
		const s = near.splice(Math.floor(r() * near.length), 1)[0], pl = G.system(s).planets; if (!pl.length) { k--; continue }
		const p = pl[Math.floor(r() * pl.length)], d = Math.hypot(...at(s).map((v, i) => v - p0[i]));
		out.push({id: 'x:' + star.id + ':' + Math.floor(day) + ':' + k, kind: 'explore', type: 'survey', issuer: o.id, star: {id: s.id, name: s.name, at: at(s)}, planet: p.name, systemName: s.name,
			text: 'Survey ' + p.name + ' (' + p.type + ')', reward: Math.round((300 + 120 * d) * E.rate(code, day)), currency: code, dist: d});
	}
	if (r() < 0.5) {
		const ruins = ruinsNear(p0, EXPLORE.ruinSearch).filter(x => !surveyed(P, x.star.id, x.planet.name));
		if (ruins.length) {
			const x = ruins[Math.floor(r() * Math.min(3, ruins.length))];
			out.push({id: 'x:' + star.id + ':' + Math.floor(day) + ':r', kind: 'explore', type: 'ruin', issuer: o.id, star: {id: x.star.id, name: x.star.name, at: at(x.star)}, planet: x.planet.name, systemName: x.star.name,
				text: 'Survey the ruin rumoured at ' + x.star.name, reward: Math.round((2500 + 200 * x.d) * E.rate(code, day)), currency: code, dist: x.d});
		}
	}
	return out.filter(m => !(P.missions || []).some(x => x.id == m.id));
}
/* ruins within r pc, nearest first (cached per place) */
const RUINS = new Map();
function ruinsNear(p, r) {
	const k = p.map(v => Math.round(v * 2)).join() + ':' + r;
	if (RUINS.has(k)) return RUINS.get(k);
	const out = [];
	for (const s of G.starsNear(p[0], p[1], p[2], r)) { if (s.kind != 'star') continue; const pl = G.system(s).planets.find(x => x.ruins); if (pl) out.push({star: s, planet: pl, d: s.d}) }
	out.sort((a, b) => a.d - b.d);
	RUINS.set(k, out); return out;
}
/* take one (up to three war or exploration missions at once) */
function accept(P, m, day) {
	P.missions = P.missions || [];
	if (P.missions.filter(x => !x.done).length >= 3) return {ok: false, why: 'You can hold three missions at once.'};
	const x = Object.assign({}, m, {accepted: Math.floor(day), due: Math.floor(day) + EXPLORE.days, done: false});
	P.missions.push(x);
	return {ok: true, mission: x};
}
/* a survey done: mark the contracts it completes */
function surveyDone(P, starId, planetName) { for (const m of P.missions || []) if (m.kind == 'explore' && !m.done && m.star.id == starId && m.planet == planetName) m.surveyed = true }

const EmberExplore = {found, find, landed, landWorth, landedOn, deposits, EXPLORE, keyOf, charted, worth, chartSystem, survey, surveyed, isCharted: charted_, unsold, sell, nameable, rename, nameOf, offers, ruinsNear, accept, surveyDone, starById, planetByKey};
if (isNode) module.exports = EmberExplore; else root.EmberExplore = EmberExplore;
})(typeof window != 'undefined' ? window : this);
