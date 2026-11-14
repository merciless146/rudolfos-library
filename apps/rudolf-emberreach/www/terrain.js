/* ===== Ember Reach: terrain (landing L1.3, docs/plan-ember-reach-landing-work.md).
   One height function, h(world, dir): pure, seeded from the world's name, the same in node and the browser. Drawing,
   contact, the safety, the altitude readout and (in L2) port sites all use it, so what's drawn is what's hit.
   - Relief: value noise in octaves (the same noise meshes.js colours planets with), rougher than plain fbm (each
     octave keeps 55% of the last), over about 1 km on a small moon up to 4 km on a large rocky world (by the galaxy model's size; at the world
     scale, 1/12, the relief is kept, so worlds are more rugged for their size, as in Kerbal Space Program); icy
     worlds half that. Worlds of the Moon's size and up (by the galaxy model's size) have smooth, low plains, like maria.
   - Craters: seeded on a grid over each face of a cube round the world, in thirteen sizes, from a few hundred km
     across down to a few tens of metres (a bowl, a raised rim, and a central peak on the big ones). Each lies wholly inside its own grid cell, so a point only asks its own cell in
     each size, and nothing crosses a cube face: the height is continuous everywhere.
   - Flats: levelled discs with a short ramp (for surface ports, in L2). None yet.
   dir is a unit vector in the world's own (turning) axes (scene.js bodyFrame).
   - Tiles: a cube-sphere quadtree. Six faces, split toward the camera nearest first while the triangles stay in budget,
     down to tiles about 50 m across; a tile splits only once its four children are built, so there are never holes.
     Each tile is a grid of 17 × 17 points (9 × 9 on low quality) with skirts hanging from its edges to hide the cracks between sizes, its
     points relative to its own centre (doubles here, small floats on the graphics card). A tile only adds the noise's
     octaves its grid can show; the finest tiles show them all.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const Me = isNode ? require('./meshes.js') : root.EmberMeshes, G = isNode ? require('./galaxy.js') : root.EmberGalaxy;
const {noise} = Me;
const TER = {tile: 50, res: 16, lowRes: 8, budget: 60000, lowBudget: 30000, split: 2.2, near: 2e5, prebuild: 4e5, persist: 0.55, oct0: 2, minAmp: 0.4, craterLevels: 13};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] };
/* integer hashing (no strings: craters are asked for at every point of every tile) */
function ihash(a, b, c, d) { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca6b); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return (h ^ (h >>> 15)) >>> 0 }
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };

/* ---------- the cube round a world ---------- */
/* face k: its axis (where it looks out) and the two directions across it */
const FACES = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
const onFace = (f, u, v) => { const F = FACES[f]; return nrm([F[0][0] + u * F[1][0] + v * F[2][0], F[0][1] + u * F[1][1] + v * F[2][1], F[0][2] + u * F[1][2] + v * F[2][2]]) };
/* which face a direction falls on, and where on it (u, v in [-1, 1]) */
function faceOf(d) {
	let f = 0, best = -1; for (let k = 0; k < 6; k++) { const c = dot(d, FACES[k][0]); if (c > best) { best = c; f = k } }
	const F = FACES[f], c = dot(d, F[0]);
	return {f, u: dot(d, F[1]) / c, v: dot(d, F[2]) / c};
}

/* ---------- a world's terrain ---------- */
const P = new Map();
/* b: a scene body (name, radius, type, seed); everything else is drawn from its name */
function params(b) {
	let p = P.get(b.name); if (p) return p;
	const seed = G.hashStr('terrain:' + b.name) % 100000, R = b.radius, R0 = R / (G.WORLD_SCALE || 1), icy = /Tundra|Ice/.test(b.type || '');
	const A = Math.max(500, Math.min(4000, 1000 + 3000 * (R0 - 1.7e6) / 4.3e6)) * (icy ? 0.5 : 1);   /* by the model's (full) size */
	/* octaves: frequency oct0 · 2^k round the world, amplitude persist^k, until one would add under minAmp metres */
	const oct = []; let amp = 1, f = TER.oct0, sum = 0;
	while (A * amp > TER.minAmp && oct.length < 24) { oct.push({f, amp, wave: 2 * Math.PI * R / f}); sum += amp; amp *= TER.persist; f *= 2 }
	oct.forEach(o => o.amp /= sum);
	p = {seed, R, R0, A, icy, oct, maria: R0 > 1e6, flats: []};
	P.set(b.name, p);
	return p;
}
/* the noise relief in [-1, 1], with octaves no finer than minWave metres */
function relief(p, d, minWave) {
	let h = 0;
	for (let k = 0; k < p.oct.length; k++) { const o = p.oct[k]; if (o.wave < minWave) break; h += o.amp * (2 * noise(d, o.f, p.seed + k * 7) - 1) }
	return h;
}
/* craters: in each size j, the cell of the face's grid the point is in may hold one, wholly inside the cell */
function craters(p, d, minWave) {
	const fc = faceOf(d); let h = 0;
	for (let j = 0; j < TER.craterLevels; j++) {
		const n = 4 << j, cellAng = Math.PI / 2 / n, cellM = cellAng * p.R; if (cellM * 0.15 < minWave * 0.5) break;
		const i = Math.min(n - 1, Math.floor((fc.u + 1) / 2 * n)), k = Math.min(n - 1, Math.floor((fc.v + 1) / 2 * n));
		const r = rnd(ihash(p.seed, fc.f * 16 + j, i, k));
		if (r() > (j < 10 ? 0.55 - 0.03 * j : 0.7)) continue;   /* (most cells hold one; the smallest, tens of metres across, are everywhere) */
		const cu = -1 + (i + 0.3 + 0.4 * r()) * 2 / n, cv = -1 + (k + 0.3 + 0.4 * r()) * 2 / n, c = onFace(fc.f, cu, cv);
		const rad = cellAng * (0.06 + 0.09 * r()), a = Math.acos(Math.max(-1, Math.min(1, dot(d, c)))), x = a / rad;
		if (x > 1.3) continue;
		/* simple craters are about a fifth as deep as they are wide; big, complex ones far shallower (and never more than
		   one and a half times the relief) */
		const big = j < 3, depth = Math.min(1.5 * p.A, rad * (big ? 0.03 * p.R0 : 0.1 * p.R));   /* the big basins as deep as at full size, the small craters to their own size */
		/* the bowl, its raised rim (the ejecta falling away beyond it), a central peak on the big ones */
		let z = x < 1 ? -depth * (1 - x * x) + 0.15 * depth : 0.15 * depth * (1 - smooth(1, 1.3, x));
		if (big && x < 0.25) z += depth * 0.5 * (1 - x / 0.25) * (1 - x / 0.25);
		h += z;
	}
	return h;
}
/* the height above the world's radius (m) at a direction in its own axes; minWave (m): leave out what's finer (a
   tile's own grid); omitted, everything */
function height(b, d, minWave) {
	const p = params(b), mw = minWave || 0;
	let h = p.A * relief(p, d, mw);
	/* plains: the low, smooth lowlands of a large world */
	if (p.maria) { const m = smooth(0.56, 0.66, noise(d, 1.5, p.seed + 91)); if (m > 0) h = h * (1 - m) + m * (-0.35 * p.A + 0.08 * p.A * relief(p, d, Math.max(mw, p.R * 0.02))) }
	h += craters(p, d, mw);
	/* flats: levelled discs, with their ramps */
	for (const fl of p.flats) {
		const a = Math.acos(Math.max(-1, Math.min(1, dot(d, fl.dir)))) * p.R; if (a > fl.r + fl.ramp) continue;
		const t = a <= fl.r ? 1 : 1 - smooth(fl.r, fl.r + fl.ramp, a); h = h * (1 - t) + fl.h * t;
	}
	return h;
}
/* a levelled disc (L2's port sites): at dir, r metres across with a ramp, at the height the ground has there */
function addFlat(b, dir, r, ramp) { const p = params(b), d = nrm(dir); const h = height(b, d); p.flats.push({dir: d, r, ramp: ramp || r * 0.5, h}); return h }
/* how high up a world's tiles are drawn (in place of the sphere) and built ahead: 200 km and 400 km, nearer on a small
   world (0.3 and 0.6 of its radius), so a port in orbit of one isn't over its ground */
const nearOf = b => Math.min(TER.near, 0.3 * b.radius), prebuildOf = b => Math.min(TER.prebuild, 0.6 * b.radius);
/* the relief's bound for a world (no point is more than this above or below its radius) */
const bound = b => { const p = params(b); return p.A + 1.5 * p.A * 1.2 + 10 };

/* ---------- tiles ---------- */
/* a tile: face f, level L (0: the whole face), cells i, j of 2^L. Its centre and how big it is */
const key = t => t.f + ':' + t.L + ':' + t.i + ':' + t.j;
function tileInfo(b, t) {
	const n = 1 << t.L, u0 = -1 + 2 * t.i / n, v0 = -1 + 2 * t.j / n, du = 2 / n;
	const c = onFace(t.f, u0 + du / 2, v0 + du / 2), size = b.radius * Math.PI / 2 / n;
	const corner = [onFace(t.f, u0, v0), onFace(t.f, u0 + du, v0 + du)], spread = Math.max(...corner.map(x => Math.acos(Math.max(-1, Math.min(1, dot(x, c))))));
	return {u0, v0, du, c, size, spread};
}
const children = t => [0, 1].flatMap(a => [0, 1].map(e => ({f: t.f, L: t.L + 1, i: t.i * 2 + a, j: t.j * 2 + e})));
const maxLevel = b => Math.max(0, Math.ceil(Math.log2(b.radius * Math.PI / 2 / TER.tile)));
/* which tiles to draw from a camera at cam (m, the world's own axes, from its centre): nearest first, splitting a tile
   while it's closer than `split` times its size, its children are built (built(key)), and the budget allows. Tiles
   wholly beyond the horizon are left out. Returns {draw: [tiles], want: [tiles to build, nearest first]} */
function select(b, cam, opts) {
	opts = opts || {};
	const res = opts.res || TER.res, per = 2 * res * res + 8 * res, budget = opts.budget || TER.budget, built = opts.built || (() => true), top = maxLevel(b);
	const r = Math.hypot(...cam), up = cam.map(v => v / (r || 1)), Rl = b.radius - bound(b), hor = Math.acos(Math.max(-1, Math.min(1, Rl / Math.max(r, Rl + 1))));
	const dist = t => { const I = t.I || (t.I = tileInfo(b, t)), p = I.c.map(v => v * b.radius); return Math.max(0, Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]) - I.size * 0.7) };
	const seen = t => { const I = t.I || (t.I = tileInfo(b, t)); return Math.acos(Math.max(-1, Math.min(1, dot(I.c, up)))) - I.spread <= hor + 0.02 };
	let draw = [0, 1, 2, 3, 4, 5].map(f => ({f, L: 0, i: 0, j: 0})).filter(seen);
	const want = [];
	for (let guard = 0; guard < 4000; guard++) {
		let best = null, bd = Infinity;
		for (const t of draw) { if (t.done || t.L >= top) continue; const d = dist(t); if (d < TER.split * t.I.size && d < bd) { bd = d; best = t } }
		if (!best) break;
		const kids = children(best).filter(seen);
		/* (the budget first: children that could never be drawn aren't asked for) */
		if ((draw.length - 1 + kids.length) * per > budget) { best.done = true; continue }
		if (!kids.every(k => built(key(k)))) { kids.filter(k => !built(key(k))).forEach(k => { k.d = bd; want.push(k) }); best.done = true; continue }
		draw = draw.filter(t => t != best).concat(kids);
	}
	want.sort((a, c) => a.d - c.d);
	return {draw, want, tris: draw.length * per};
}
/* a tile's mesh: its points relative to its centre (in the world's axes, metres), coloured as the far sphere is */
function build(b, t, res) {
	res = res || TER.res;
	const I = tileInfo(b, t), n = res, step = I.du / n, minWave = 2 * I.size / n;
	const colour = Me.planetColour(b.type, b.seed || 1), p = params(b), motF = 2 * Math.PI * b.radius / (I.size / 3);
	const c = I.c.map(v => v * (b.radius + height(b, I.c, minWave)));
	/* the grid with a ring of extra points for the normals at its edges */
	const W = n + 3, pos = new Array(W * W), dirs = new Array(W * W);
	for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const d = onFace(t.f, I.u0 + (x - 1) * step, I.v0 + (y - 1) * step), h = height(b, d, minWave); dirs[y * W + x] = d; pos[y * W + x] = [d[0] * (b.radius + h) - c[0], d[1] * (b.radius + h) - c[1], d[2] * (b.radius + h) - c[2]] }
	const at = (x, y) => pos[(y + 1) * W + x + 1], dirAt = (x, y) => dirs[(y + 1) * W + x + 1];
	const normal = (x, y) => { const a = at(x + 1, y), bb = at(x - 1, y), e = at(x, y + 1), g = at(x, y - 1), du = [a[0] - bb[0], a[1] - bb[1], a[2] - bb[2]], dv = [e[0] - g[0], e[1] - g[1], e[2] - g[2]]; let N = nrm([du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]]); if (dot(N, dirAt(x, y)) < 0) N = N.map(v => -v); return N };
	const N = [], C = [];
	for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
		const nn = normal(x, y); N[y * (n + 1) + x] = nn;
		/* the far sphere's colour, darker on slopes, and mottled at this tile's own scale (dust, rock, ejecta) so the
		   ground has texture all the way down */
		const dd = dirAt(x, y), col = colour(dd), slope = 1 - dot(nn, dd), mot = 0.82 + 0.18 * noise(dd, motF, p.seed + 401) + 0.12 * noise(dd, motF * 4, p.seed + 402);
		const k = (0.92 - 0.5 * Math.min(1, slope * 3)) * mot;
		C[y * (n + 1) + x] = [col[0] * k, col[1] * k, col[2] * k, 0];
	}
	const m = new Me.Mesh(), V = (x, y) => at(x, y), idx = (x, y) => y * (n + 1) + x;
	const tri = (a, bb, e) => m.tri(V(...a), V(...bb), V(...e), [C[idx(...a)], C[idx(...bb)], C[idx(...e)]], N[idx(...a)], N[idx(...bb)], N[idx(...e)]);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { tri([x, y], [x + 1, y], [x + 1, y + 1]); tri([x, y], [x + 1, y + 1], [x, y + 1]) }
	/* skirts: each edge's points dropped straight down, to hide cracks against a neighbour of another size */
	const drop = I.size * 0.04 + 30, down = (x, y) => { const p = V(x, y), d = dirAt(x, y); return [p[0] - d[0] * drop, p[1] - d[1] * drop, p[2] - d[2] * drop] };
	const skirt = (a, e) => { const pa = V(...a), pe = V(...e), qa = down(...a), qe = down(...e), ca = C[idx(...a)], ce = C[idx(...e)], na = N[idx(...a)], ne = N[idx(...e)]; m.tri(pa, pe, qe, [ca, ce, ce], na, ne, ne); m.tri(pa, qe, qa, [ca, ce, ca], na, ne, na) };
	for (let k = 0; k < n; k++) { skirt([k, 0], [k + 1, 0]); skirt([k + 1, n], [k, n]); skirt([0, k + 1], [0, k]); skirt([n, k], [n, k + 1]) }
	return {mesh: m, centre: c, tris: m.p.length / 9, key: key(t)};
}

const EmberTerrain = {TER, nearOf, prebuildOf, FACES, onFace, faceOf, params, height, addFlat, bound, key, tileInfo, children, maxLevel, select, build};
if (isNode) module.exports = EmberTerrain; else root.EmberTerrain = EmberTerrain;
})(typeof window != 'undefined' ? window : globalThis);
