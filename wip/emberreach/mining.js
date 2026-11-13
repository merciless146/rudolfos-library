/* ===== Ember Reach: mining (docs/plan-ember-reach.md, "Mining").
   - Fields: every ringed planet's rings (stone or ice), and asteroid belts (none, one or two a system, between the
     planets' orbits; rocky, or metallic around metal-rich stars). Each field has a mining site, a point a pilot can
     target and drop out of cruise at.
   - At a site, sixty-odd asteroids (30 to 240 m across) lie in a flattened swarm 15 km wide, the same every visit.
     Each holds two or three goods in proportions, and a yield of tonnes that mining runs down (kept in the save).
   - A mining laser (an external module) chips an asteroid: every few hits an ore chunk breaks off, a fraction of a
     tonne of one of its goods, drifting away. A resource scanner (a utility mount) reads an asteroid's contents.
   - Ore goes to the refinery (an internal module: one bin per good, two bins plus one a size), not the hold: when a
     bin reaches a tonne, the tonne goes to the hold. No refinery, no mining (chunks bounce off the hatch).
   - Tractor beams (external) pull canisters and ore within 600 m to an open hatch, slowly enough to scoop.
   Pure functions on plain data. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const G = isNode ? require('./galaxy.js') : root.EmberGalaxy;
const MINE = {site: 15000, rocks: 64, sizes: [30, 60, 120, 240], hitsPerChunk: 6, chunk: [0.25, 0.6], laserRange: 600, scanRange: 3000, scanTime: 3, tractor: 600, tractorSpeed: 40, AU: 1.495978707e11};
/* what each kind of field holds: goods and weights */
const KINDS = {
	Stone: {name: 'stone ring', goods: {Iron: 5, Copper: 3, Coal: 3, Lead: 2, Aluminum: 2, Titanium: 1, Jade: 0.4, Diamond: 0.15}},
	Ice: {name: 'ice ring', goods: {Water: 8, Beryllium: 1.5, Coal: 1, Uranium: 0.4}},
	rocky: {name: 'rocky belt', goods: {Iron: 4, Copper: 3, Coal: 2, Lead: 2, Aluminum: 3, Titanium: 1.2, Uranium: 0.5, Jade: 0.3}},
	metallic: {name: 'metallic belt', goods: {Iron: 6, Titanium: 3, Aluminum: 2, Copper: 2, Gold: 0.6, Uranium: 0.6, Diamond: 0.25}}};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a)), norm = a => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pickW = (w, r) => { const t = Object.values(w).reduce((a, b) => a + b, 0); let x = r() * t; for (const k in w) { x -= w[k]; if (x <= 0) return k } return Object.keys(w)[0] };

/* the mining fields of a scene (scene.js bodies): [{id, name, kind, pos (the site), normal}] */
function fields(scene, star) {
	const out = [], sun = scene.bodies[0], planets = scene.bodies.filter(b => b.kind == 'planet');
	for (const b of planets) {
		if (!b.ring) continue;
		const r = G.rng(G.hashStr('ring:' + b.name)), ax = norm(b.axis || [0, 0, 1]), e1 = norm(cross(ax, Math.abs(ax[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(ax, e1), th = r() * 6.283;
		out.push({id: 'ring:' + b.name, name: b.name + ' rings', kind: b.ring, pos: add(b.pos, mul(add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th))), b.radius * 1.8)), normal: ax, body: b.name});
	}
	/* belts: in the gaps between planets' orbits, or out past the last */
	const r = G.rng(G.hashStr('belts:' + star.id)), n = r() < 0.35 ? 0 : r() < 0.75 ? 1 : 2, orbits = planets.map(b => len(sub(b.pos, sun.pos))).sort((a, b) => a - b);
	for (let k = 0; k < n; k++) {
		const i = Math.floor(r() * (orbits.length + 1)), a = orbits.length ? (i == 0 ? orbits[0] * 0.6 : i == orbits.length ? orbits[i - 1] * 1.6 : (orbits[i - 1] + orbits[i]) / 2) : 2.5 * MINE.AU;
		const th = r() * 6.283, kind = (star.FeH || 0) > 0.05 && r() < 0.6 ? 'metallic' : 'rocky';
		out.push({id: 'belt:' + star.id + ':' + k, name: star.name + ' belt ' + 'AB'[k], kind, pos: add(sun.pos, [a * Math.cos(th), a * Math.sin(th), 0]), normal: [0, 0, 1]});
	}
	return out;
}
/* the asteroids at a field's site: the same every visit; `mined` (P.mined) holds the tonnes already taken */
function rocks(field, mined) {
	const r = G.rng(G.hashStr('rocks:' + field.id)), K = KINDS[field.fieldKind || field.kind] || KINDS.rocky, out = [];
	const e1 = norm(cross(field.normal, Math.abs(field.normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(field.normal, e1);
	for (let i = 0; i < MINE.rocks; i++) {
		const a = r() * 6.283, d = Math.sqrt(r()) * MINE.site / 2, h = (r() - 0.5) * MINE.site * 0.12;
		const size = MINE.sizes[Math.min(3, Math.floor(Math.pow(r(), 1.6) * 4))], shape = Math.floor(r() * 3);
		const comp = {}; for (let k = 0; k < 2 + (r() < 0.4 ? 1 : 0); k++) { const g = pickW(K.goods, r); comp[g] = (comp[g] || 0) + 0.3 + r() }
		const t = Object.values(comp).reduce((x, y) => x + y, 0); for (const g in comp) comp[g] = Math.round(comp[g] / t * 100) / 100;
		const id = field.id + '#' + i, yieldT = Math.round(size / 6 + r() * size / 6);
		out.push({id, kind: 'asteroid', name: 'Asteroid ' + field.name.slice(0, 2).toUpperCase() + '-' + (100 + i), pos: add(field.pos, add(add(mul(e1, Math.cos(a) * d), mul(e2, Math.sin(a) * d)), mul(field.normal, h))),
			radius: size, shape, comp, yield: yieldT, left: Math.max(0, yieldT - ((mined && mined[id]) || 0)), hits: 0, prospected: false});
	}
	return out;
}
/* a mining laser's bolt hits an asteroid: every few hits, a chunk of ore breaks off. Returns the chunk {good, t,
   p, v} or null. `from`: the shooter's position, so the chunk drifts back towards it */
function chip(rock, from, rnd, mined) {
	if (rock.left <= 0) return null;
	rnd = rnd || Math.random;
	if (++rock.hits % MINE.hitsPerChunk) return null;
	const t = Math.min(rock.left, MINE.chunk[0] + (MINE.chunk[1] - MINE.chunk[0]) * rnd()), good = pickW(rock.comp, rnd);
	rock.left = Math.round((rock.left - t) * 100) / 100;
	if (mined) mined[rock.id] = Math.round(((mined[rock.id] || 0) + t) * 100) / 100;
	const out = norm(sub(from, rock.pos));
	return {good, t: Math.round(t * 100) / 100, p: add(rock.pos, mul(out, rock.radius + 4)), v: mul(norm(add(out, [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5])), 3 + rnd() * 3)};
}
/* ore into the refinery: one bin per good, up to `bins`; a full tonne goes to the hold if there's room. Returns
   {ok, why, made: [goods]} */
function refine(P, good, t, bins, capacity) {
	if (!bins) return {ok: false, why: 'no refinery'};
	const R = P.refinery = P.refinery || {};
	if (R[good] == null && Object.keys(R).length >= bins) return {ok: false, why: 'bins full'};
	R[good] = Math.round(((R[good] || 0) + t) * 100) / 100;
	const made = [];
	while (R[good] >= 1) {
		const held = Object.values(P.cargo).reduce((a, b) => a + b, 0);
		if (held + 1 > capacity) break;
		R[good] = Math.round((R[good] - 1) * 100) / 100; P.cargo[good] = (P.cargo[good] || 0) + 1;
		const have = P.cargo[good] - 1; P.cost[good] = have ? (P.cost[good] || 0) * have / (have + 1) : 0;
		made.push(good);
	}
	if (R[good] <= 0) delete R[good];
	return {ok: true, made};
}
/* empty a bin (to make room for another good) */
function purge(P, good) { if (P.refinery) delete P.refinery[good] }
/* tractor beams: canisters and ore within range drift to the hatch at a scoopable speed. at: the hatch's point */
function tractor(list, s, at, beams, dt) {
	if (!beams) return 0;
	let n = 0;
	for (const c of list) {
		const d = sub(at, c.p), L = len(d); if (L > MINE.tractor) continue;
		const want = add(s.v, mul(norm(d), Math.min(MINE.tractorSpeed, L / 4 + 3)));   /* fast far out, slowing to scooping speed at the hatch */
		c.v = add(c.v, mul(sub(want, c.v), Math.min(1, 2 * dt * beams))); n++;
	}
	return n;
}
/* segment (a bolt's step) against the asteroids: the first one hit */
function hitRock(rocks, p0, p1) {
	const seg = sub(p1, p0), sl = len(seg) || 1e-9, u = mul(seg, 1 / sl);
	for (const r of rocks) { const d = sub(r.pos, p0), along = Math.max(0, Math.min(sl, dot(d, u))), q = sub(d, mul(u, along)); if (dot(q, q) < r.radius * r.radius) return r }
	return null;
}

const EmberMining = {MINE, KINDS, fields, rocks, chip, refine, purge, tractor, hitRock};
if (isNode) module.exports = EmberMining; else root.EmberMining = EmberMining;
})(typeof window != 'undefined' ? window : this);
