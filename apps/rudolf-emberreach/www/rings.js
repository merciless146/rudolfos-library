/* ===== Ember Reach: a planet's rings, made of asteroids (L3.1, 0.4.1; docs/plan-ember-reach-landing-work.md) =====
   One shape for the drawn ring (meshes.js rings) and for mining (mining.js):
   - Bands: 14 between 1.35 and 2.3 of the planet's radii, some of them gaps. Each band has a brightness, a density
     (dense, moderate or sparse: a densely strewn ring's bands are one step denser) and a mix of goods: the ring's
     kind (stone, ice or metal), leaning metallic in the inner bands and icy in the outer ones.
   - Cells: each band is cut into cells about 3 km across (radially, and round the ring). A cell's asteroids are
     seeded by its place (the planet, the band, the cell), so they're the same every visit: 6 to 10 in a dense band,
     3 to 5 in a moderate one, 1 or 2 in a sparse one, none in a gap, 30 to 240 m across, in a sheet 400 m thick.
     Each has its own id, so what's mined from it is remembered (P.mined).
   - Hotspots: 2 or 3 in each ring, 5 km across, in its bands (never a gap), where one good's share doubles. The
     first is known (it's the ring's mining site, as before); the others are found with a resource scanner (L3.2).
   The ring lies in the planet's equator (its axis), and doesn't turn with it. Pure functions. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const G = isNode ? require('./galaxy.js') : root.EmberGalaxy;
const RING = {inner: 1.35, outer: 2.3, bands: 14, gap: 0.22, cell: 3000, thick: 400, perCell: {dense: [6, 10], moderate: [3, 5], sparse: [1, 2]}, hot: [2, 3], hotR: 5000, hotK: 2, sizes: [30, 60, 120, 240]};
/* the goods by kind (as mining.js KINDS), and which lean metallic or icy */
const GOODS = {
	Stone: {Iron: 5, Copper: 3, Coal: 3, Lead: 2, Aluminum: 2, Titanium: 1, Jade: 0.4, Diamond: 0.15},
	Ice: {Water: 8, Beryllium: 1.5, Coal: 1, Uranium: 0.4},
	Metal: {Iron: 6, Titanium: 3, Aluminum: 2, Copper: 2, Gold: 0.5, Diamond: 0.2, Uranium: 0.5}};
const RIFT = {Stone: {Nullite: 1.5, Voidglass: 0.5}, Ice: {Aetherium: 2, Voidglass: 0.4}, Metal: {Nullite: 2.5, Voidglass: 0.5}};
const METALLIC = ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Gold', 'Diamond', 'Nullite'], ICY = ['Water', 'Beryllium', 'Aetherium'];
const DENSER = {sparse: 'moderate', moderate: 'dense', dense: 'dense'};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a)), norm = a => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/* (the same hash meshes.js uses for its planets and rings) */
function hash3(x, y, z, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const pickW = (w, r) => { const t = Object.values(w).reduce((a, b) => a + b, 0); let x = r() * t; for (const k in w) { x -= w[k]; if (x <= 0) return k } return Object.keys(w)[0] };

/* the bands, in planet radii: [{i, r0, r1, k (brightness), gap, density, frac (0 inner .. 1 outer)}] */
function bands(seed, ringDensity) {
	const out = [];
	for (let b = 0; b < RING.bands; b++) {
		const n = hash3(b, 3, 7, seed), r0 = RING.inner + (RING.outer - RING.inner) * b / RING.bands, r1 = RING.inner + (RING.outer - RING.inner) * (b + 1) / RING.bands;
		let density = n > 0.7 ? 'dense' : n > 0.45 ? 'moderate' : 'sparse'; if (ringDensity == 'dense') density = DENSER[density];
		out.push({i: b, r0, r1, k: 0.7 + 0.45 * n, gap: n < RING.gap, density, frac: b / (RING.bands - 1)});
	}
	return out;
}
/* a band's mix of goods */
function mixOf(kind, frac, rift) {
	const w = Object.assign({}, GOODS[kind] || GOODS.Stone, rift ? RIFT[kind] || RIFT.Stone : {});
	for (const g in w) w[g] *= METALLIC.includes(g) ? 1.4 - 0.8 * frac : ICY.includes(g) ? 0.6 + 0.8 * frac : 1;
	return w;
}
/* a ringed body's ring (scene.js body): its place, frame, bands and hotspots */
function ringOf(b, star) {
	const ax = norm(b.axis || [0, 0, 1]), e1 = norm(cross(ax, Math.abs(ax[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(ax, e1);
	const kind = b.ring, R = b.radius, rift = !!(star && star.rift), B = bands(b.seed == null ? G.hashStr(b.name) : b.seed, b.ringDensity);
	const ring = {id: 'ring:' + b.name, name: b.name + ' rings', body: b.name, kind, rift, density: b.ringDensity || 'moderate', R, c: b.pos, ax, e1, e2, bands: B};
	ring.hotspots = hotspots(ring);
	return ring;
}
/* a point in the ring's own terms: radius (m), angle, height above the plane, and the band it's in (or null) */
function locate(ring, p) {
	const d = sub(p, ring.c), z = dot(d, ring.ax), x = dot(d, ring.e1), y = dot(d, ring.e2), r = Math.hypot(x, y), a = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
	const band = ring.bands.find(B => r >= B.r0 * ring.R && r < B.r1 * ring.R) || null;
	return {r, a, z, band};
}
const worldAt = (ring, r, a, z) => add(ring.c, add(add(mul(ring.e1, r * Math.cos(a)), mul(ring.e2, r * Math.sin(a))), mul(ring.ax, z)));
/* a band's cells: how many round the ring, and how many across */
function cellsOf(ring, B) { const r0 = B.r0 * ring.R, r1 = B.r1 * ring.R; return {nA: Math.max(1, Math.round(2 * Math.PI * (r0 + r1) / 2 / RING.cell)), nR: Math.max(1, Math.round((r1 - r0) / RING.cell)), r0, r1} }
/* the asteroids of one cell */
function cellRocks(ring, B, ri, ai, mined) {
	if (B.gap) return [];
	const C = cellsOf(ring, B), seed = G.hashStr(ring.id + ':' + B.i + ':' + ri + ':' + ai), r = G.rng(seed), [lo, hi] = RING.perCell[B.density], n = lo + Math.floor(r() * (hi - lo + 1));
	const w0 = mixOf(ring.kind, B.frac, ring.rift), out = [], dr = (C.r1 - C.r0) / C.nR;
	for (let k = 0; k < n; k++) {
		const rr = C.r0 + (ri + r()) * dr, a = (ai + r()) / C.nA * 2 * Math.PI, z = (r() - 0.5) * RING.thick, pos = worldAt(ring, rr, a, z);
		const size = RING.sizes[Math.min(3, Math.floor(Math.pow(r(), 1.6) * 4))], shape = Math.floor(r() * 3);
		/* in a hotspot, its good's share doubles */
		const hot = ring.hotspots.find(h => len(sub(pos, h.pos)) < RING.hotR), w = hot ? Object.assign({}, w0, {[hot.good]: (w0[hot.good] || 1) * RING.hotK}) : w0;
		const comp = {}; for (let j = 0; j < 2 + (r() < 0.4 ? 1 : 0); j++) { const g = pickW(w, r); comp[g] = (comp[g] || 0) + 0.3 + r() }
		const t = Object.values(comp).reduce((x, y) => x + y, 0); for (const g in comp) comp[g] = Math.round(comp[g] / t * 100) / 100;
		const id = ring.id + '#' + B.i + '.' + ri + '.' + ai + '.' + k, yieldT = Math.round(size / 6 + r() * size / 6);
		out.push({id, kind: 'asteroid', name: 'Asteroid ' + ring.body.slice(0, 2).toUpperCase() + '-' + B.i + '.' + (ai % 1000) + '.' + k, pos, radius: size, shape, comp, yield: yieldT,
			left: Math.max(0, yieldT - ((mined && mined[id]) || 0)), hits: 0, prospected: false, hot: hot ? hot.id : null});
	}
	return out;
}
/* every asteroid within `radius` of a point (the cells that reach it) */
function rocksAround(ring, p, radius, mined) {
	const L = locate(ring, p), out = [];
	if (Math.abs(L.z) > radius + RING.thick) return out;
	for (const B of ring.bands) {
		if (B.gap) continue;
		const C = cellsOf(ring, B);
		if (L.r + radius < C.r0 || L.r - radius > C.r1) continue;
		const dr = (C.r1 - C.r0) / C.nR, ri0 = Math.max(0, Math.floor((L.r - radius - C.r0) / dr)), ri1 = Math.min(C.nR - 1, Math.floor((L.r + radius - C.r0) / dr));
		const da = (radius + RING.cell) / Math.max(1, L.r), ai0 = Math.floor((L.a - da) / (2 * Math.PI) * C.nA), ai1 = Math.floor((L.a + da) / (2 * Math.PI) * C.nA);
		for (let ri = ri0; ri <= ri1; ri++) for (let a = ai0; a <= ai1; a++) {
			const ai = ((a % C.nA) + C.nA) % C.nA;
			for (const rk of cellRocks(ring, B, ri, ai, mined)) if (len(sub(rk.pos, p)) <= radius) out.push(rk);
		}
	}
	return out;
}
/* the ring's hotspots: 2 or 3, each in a band (not a gap), with its good */
function hotspots(ring) {
	const r = G.rng(G.hashStr('hot:' + ring.id)), n = RING.hot[0] + Math.floor(r() * (RING.hot[1] - RING.hot[0] + 1)), full = ring.bands.filter(B => !B.gap), out = [];
	for (let k = 0; k < n && full.length; k++) {
		const B = full[Math.floor(r() * full.length)], rr = (B.r0 + (B.r1 - B.r0) * (0.25 + 0.5 * r())) * ring.R, a = r() * 2 * Math.PI, mix = mixOf(ring.kind, B.frac, ring.rift);
		/* (its good: one of the band's three likeliest) */
		const top = Object.entries(mix).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]), good = top[Math.floor(r() * top.length)];
		out.push({id: ring.id + ':hot' + k, n: k, band: B.i, good, pos: worldAt(ring, rr, a, 0), radius: RING.hotR, known: k == 0});
	}
	return out;
}

const EmberRings = {RING, GOODS, hash3, bands, mixOf, ringOf, locate, worldAt, cellsOf, cellRocks, rocksAround, hotspots};
if (isNode) module.exports = EmberRings; else root.EmberRings = EmberRings;
})(typeof window != 'undefined' ? window : this);
