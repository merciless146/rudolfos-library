/* ===== Ember Reach: surface ports and landing, a draft model (not in the game yet) =====
   What the plan in docs/plan-ember-reach-landing.md describes, as data and functions the game can take in later:
   - which worlds can be landed on (airless, solid, not molten) and which ship can manage a world's gravity;
   - the kinds of surface port (mining camp, outpost, settlement, starport, forward base), and which worlds in a
     system get which;
   - each port's layout: pads by size with their approach corridors, and buildings placed around them, from a seed;
   - its model: the layout as parts in the station vocabulary (scene.js) plus two shapes for the ground (dome, pad),
     and meshes from meshes.js's primitives;
   - the touchdown rules (how fast is too fast, how tilted is too tilted).
   Local metres: z up, the ground at z = 0, the port's centre at the origin.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const req = n => typeof module != 'undefined' ? require('../../apps/rudolf-emberreach/www/' + n) : root[{'galaxy.js': 'EmberGalaxy', 'flight.js': 'EmberFlight', 'meshes.js': 'EmberMeshes'}[n]];
const G = req('galaxy.js'), Fl = req('flight.js'), Me = req('meshes.js');
const G0 = 9.81;

/* ---------- which worlds can be landed on ----------
   Airless (no atmosphere at all: the ship has no heat shield and nothing to glide on), solid (no gas giants),
   neither molten nor so cold the gear won't work, and not a world whose surface gravity would crush a hull's
   frame on the pad. Moons count: they're most of the landable ground there is. */
const LAND = {gMax: 2.5, tsMax: 700, tsMin: 30, twr: 1.5, gear: 2.5};
function landable(p) {
	if (!p || p.gas || p.atmo || p.bars > 0) return {ok: false, why: p && p.gas ? 'A gas giant: no surface' : 'An atmosphere: no heat shield, no landing (yet)'};
	if (p.Ts > LAND.tsMax) return {ok: false, why: 'Molten: the surface is ' + Math.round(p.Ts) + ' K'};
	if (p.Ts < LAND.tsMin) return {ok: false, why: 'Too cold for the gear'};
	if (p.g > LAND.gMax) return {ok: false, why: 'Gravity ' + p.g.toFixed(1) + ' g: no hull lands there'};
	return {ok: true};
}
/* whether a ship can land there: its vertical thrusters must hold it up with half again to spare, and only hulls
   that fit a pad (up to L) land at all; XL and capital ships stay in orbit (their shuttles come later) */
function canLand(ship, p) {
	const l = landable(p); if (!l.ok) return l;
	if (ship.size == 'XL' || ship.size == 'Capital') return {ok: false, why: 'Too big for any pad'};
	const sp = Fl.spec(ship), need = LAND.twr * p.g * G0;
	if (sp.aRcs < need) return {ok: false, why: 'Too heavy for this world: thrusters ' + (sp.aRcs / G0).toFixed(1) + ' g against ' + (need / G0).toFixed(1) + ' g needed'};
	return {ok: true, margin: sp.aRcs / (p.g * G0)};
}
/* the heaviest world a ship can land on (surface gravity in g) */
const maxG = ship => ship.size == 'XL' || ship.size == 'Capital' ? 0 : Math.min(LAND.gMax, Fl.spec(ship).aRcs / G0 / LAND.twr);

/* ---------- touchdown ----------
   On the pad (or the ground) the gear takes it if it comes down slowly enough, upright enough. A little past the
   limits is a hard landing (hull damage growing with the excess); three times past them is a crash. */
const TOUCH = {S: {vz: 4, vh: 2.5, tilt: 12}, M: {vz: 3, vh: 2, tilt: 9}, L: {vz: 2, vh: 1.5, tilt: 6}};
function touchdown(size, vz, vh, tilt) {
	const T = TOUCH[size == 'XS' ? 'S' : size] || TOUCH.L, x = Math.max(Math.abs(vz) / T.vz, vh / T.vh, tilt / T.tilt);
	if (x <= 1) return {ok: true, damage: 0, x};
	if (x >= 3) return {ok: false, crash: true, x};
	return {ok: true, hard: true, damage: (x - 1) * (x - 1) * 0.15, x};   /* a share of the hull */
}

/* ---------- pads ----------
   A pad is a disc wide enough for the longest ship of its size with room around it; its approach corridor is a
   cone above it (35° from the vertical) that nothing may stand in. XS ships use S pads. */
const PAD = {S: {r: 30, light: [0.45, 0.8, 1]}, M: {r: 66, light: [1, 0.75, 0.3]}, L: {r: 150, light: [1, 0.45, 0.3]}};
const CONE = Math.tan(35 * Math.PI / 180);

/* ---------- the kinds of surface port ----------
   pads: how many of each size; build: what stands around them (counts, as ranges); radius: the site; tier: what it
   matches in space (scene.js's classes: trefoil small, bloom colony, lantern system, halo capital). */
const KIND = {
	camp: {name: 'Mining camp', tier: 'trefoil', radius: 260, pads: {S: 2}, sells: 'ores', text: 'A few prefab habs by a pit, with silos for the ore and a refinery shed. Buys food, water and machinery; sells what it digs.',
		build: {hab: [2, 3], silo: [2, 4], plant: [1, 1], mast: [1, 1], tank: [1, 2], pit: [1, 1]}},
	outpost: {name: 'Outpost', tier: 'trefoil', radius: 300, pads: {S: 3}, sells: 'basic', text: 'A landing field with a hab cluster, a comms mast and fuel tanks: the first thing built on a world.',
		build: {hab: [3, 5], mast: [1, 1], tank: [2, 3], solar: [2, 4], hangar: [0, 1]}},
	settlement: {name: 'Settlement', tier: 'bloom', radius: 520, pads: {S: 4, M: 1}, sells: 'colony', text: 'Pressurised domes over farms and streets, a tower for the pads, and a ring of tanks and panels.',
		build: {dome: [3, 5], greenhouse: [2, 4], hab: [4, 7], tower: [1, 1], tank: [3, 5], solar: [4, 7], hangar: [1, 2]}},
	starport: {name: 'Surface starport', tier: 'lantern', radius: 1100, pads: {S: 6, M: 4, L: 1}, sells: 'port', text: 'A port city in a crater: hangars cut into its wall for the small ships, open pads for the large, a dome city on the rim.',
		build: {dome: [6, 9], greenhouse: [4, 6], hab: [8, 12], tower: [2, 2], hangar: [4, 6], tank: [5, 8], solar: [6, 10], plant: [1, 2], mast: [2, 3]}},
	base: {name: 'Forward base', tier: 'trefoil', radius: 420, pads: {S: 2, M: 2}, sells: 'military', text: 'Revetted pads, bunkers and turrets: a power\'s military foothold, or yours.',
		build: {bunker: [3, 5], turret: [3, 4], tower: [1, 1], tank: [2, 3], hangar: [1, 2], mast: [1, 1]}}};
/* what each building is: footprint radius (m), height (m), and how it's drawn */
const BLD = {
	hab: {r: 14, h: 9, col: 'hab'}, silo: {r: 8, h: 26, col: 'hull'}, plant: {r: 26, h: 18, col: 'hull'}, mast: {r: 4, h: 60, col: 'truss'},
	tank: {r: 10, h: 12, col: 'hull'}, pit: {r: 70, h: 0, col: 'pit'}, solar: {r: 22, h: 3, col: 'radiator'}, hangar: {r: 40, h: 22, col: 'dock'},
	dome: {r: 55, h: 38, col: 'window'}, greenhouse: {r: 34, h: 20, col: 'green'}, tower: {r: 9, h: 70, col: 'hull'},
	bunker: {r: 16, h: 6, col: 'hull'}, turret: {r: 6, h: 10, col: 'truss'}};

/* ---------- which worlds get which ----------
   In a system with a port in space, the landable worlds get surface ports too: the port world's moons and the
   rocky worlds, the busier the port the more (a capital's system: a starport and settlements). Wild systems get
   none; a world rich in metals gets a mining camp more often. Each from the world's own draw, so the same every
   time. Colonies (colonies.js) will claim outposts and settlements on airless worlds the same way. */
const PLACE = {trefoil: {n: 1, kinds: ['outpost', 'camp']}, bloom: {n: 1, kinds: ['settlement', 'outpost', 'camp']},
	lantern: {n: 2, kinds: ['settlement', 'outpost', 'camp', 'base']}, halo: {n: 3, kinds: ['starport', 'settlement', 'outpost', 'camp', 'base']}};
const PORT_TS = 500;
const METALS = ['Iron', 'Titanium', 'Copper', 'Aluminum', 'Gold', 'Uranium', 'Beryllium'];
function ports(star, cls) {
	if (!cls || !PLACE[cls]) return [];
	/* (ports keep to worlds below 500 K: anyone can land on a hotter one, nobody lives there) */
	const sy = G.system(star), worlds = sy.planets.flatMap(p => [p, ...(p.moons || [])]).filter(p => landable(p).ok && p.Ts <= PORT_TS);
	const r = G.rng(G.hashStr('surface:' + star.id)), P = PLACE[cls], out = [];
	/* the best ground first: low gravity, moderate temperatures, metals */
	const score = p => -Math.abs(p.g - 0.3) - Math.abs(p.Ts - 220) / 400 + (p.res || []).filter(x => METALS.includes(x)).length * 0.08 + r() * 0.2;
	const ranked = worlds.map(p => ({p, s: score(p)})).sort((a, b) => b.s - a.s);
	for (let i = 0; i < Math.min(P.n, ranked.length); i++) {
		const p = ranked[i].p, rich = (p.res || []).filter(x => METALS.includes(x)).length >= 3;
		const kind = i == 0 ? P.kinds[0] : rich && r() < 0.6 ? 'camp' : P.kinds[1 + Math.floor(r() * (P.kinds.length - 1))];
		/* where on the world: tidally locked worlds near the terminator (light, and not baking); others anywhere
		   between 60° north and south */
		const lat = (r() * 2 - 1) * (p.locked ? 25 : 60), lon = p.locked ? 90 + (r() * 2 - 1) * 15 : r() * 360 - 180;
		out.push({id: 'surface:' + p.name + ':' + kind, kind, world: p.name, moon: !!p.moon, lat, lon, g: p.g, Ts: p.Ts, seed: G.hashStr(star.id + ':' + p.name + ':' + kind)});
	}
	return out;
}

/* ---------- the layout ----------
   Pads first, around the centre (the large ones nearest, so their wide corridors face open ground), then buildings
   placed at random where they don't overlap each other or stand in any pad's corridor (a building of height h must
   stand at least r_pad + h × tan 35° from the pad's centre). A starport's small pads sit in hangars along the wall. */
function layout(kind, seed) {
	const K = KIND[kind], r = G.rng(seed >>> 0), pads = [], blds = [];
	const sizes = Object.entries(K.pads).sort((a, b) => PAD[b[0]].r - PAD[a[0]].r).flatMap(([z, n]) => Array(n).fill(z));
	/* pads: on rings outward from the centre */
	let ring = 0, placed = 0;
	for (const z of sizes) {
		const pr = PAD[z].r;
		for (let tries = 0; tries < 200; tries++) {
			const R = ring == 0 && !pads.length ? 0 : 80 + ring * 120 + r() * 60, a = r() * 2 * Math.PI, c = [R * Math.cos(a), R * Math.sin(a)];
			if (Math.hypot(c[0], c[1]) + pr > K.radius) { ring = 0; continue }
			if (pads.some(q => Math.hypot(q.c[0] - c[0], q.c[1] - c[1]) < q.r + pr + 20)) { if (tries % 12 == 11) ring++; continue }
			pads.push({n: ++placed, size: z, c, r: pr}); break;
		}
	}
	/* buildings */
	const clear = (c, b) => pads.every(q => Math.hypot(q.c[0] - c[0], q.c[1] - c[1]) >= q.r + b.r + b.h * CONE) &&
		blds.every(o => Math.hypot(o.c[0] - c[0], o.c[1] - c[1]) >= o.r + b.r + 6) && Math.hypot(c[0], c[1]) + b.r <= K.radius;
	for (const [t, [lo, hi]] of Object.entries(K.build)) {
		const n = lo + Math.floor(r() * (hi - lo + 1)), b = BLD[t];
		for (let i = 0; i < n; i++) for (let tries = 0; tries < 300; tries++) {
			const R = Math.sqrt(r()) * (K.radius - b.r), a = r() * 2 * Math.PI, c = [R * Math.cos(a), R * Math.sin(a)];
			if (clear(c, b)) { blds.push({type: t, c, r: b.r, h: b.h, rot: r() * Math.PI}); break }
		}
	}
	/* a starport's hangars take its S pads in (a roofed pad: the corridor is the hangar's open front) */
	if (kind == 'starport') { const hs = blds.filter(b => b.type == 'hangar'); pads.filter(p => p.size == 'S').forEach((p, i) => { if (hs[i]) { p.hangar = true; p.c = hs[i].c.slice(); p.r = Math.min(p.r, hs[i].r - 6) } }) }
	return {kind, name: K.name, radius: K.radius, pads, blds};
}
/* every rule a layout must keep (the test's checks, and a guard for hand-made ones) */
function check(L) {
	const bad = [];
	for (const p of L.pads) { if (Math.hypot(p.c[0], p.c[1]) + p.r > L.radius + 1) bad.push('pad ' + p.n + ' off the site'); for (const q of L.pads) if (q != p && !p.hangar && !q.hangar && Math.hypot(q.c[0] - p.c[0], q.c[1] - p.c[1]) < q.r + p.r) bad.push('pads ' + p.n + ' and ' + q.n + ' overlap') }
	for (const b of L.blds) {
		if (b.type == 'hangar' && L.pads.some(p => p.hangar && p.c[0] == b.c[0] && p.c[1] == b.c[1])) continue;
		for (const p of L.pads) if (!p.hangar && Math.hypot(p.c[0] - b.c[0], p.c[1] - b.c[1]) < p.r + b.r + b.h * CONE - 0.01) bad.push(b.type + ' in pad ' + p.n + '\'s corridor');
	}
	return bad;
}

/* ---------- the model ----------
   The layout as parts (scene.js's vocabulary: cyl, box, ell; z up, the ground at 0) plus two of the ground's own:
   dome (the top half of an ellipsoid, glazed) and pad (a flat disc with a lit ring and its number). Then meshes from
   meshes.js's primitives, in groups like a station's (here none spin). */
const SHAPES = {
	hab: b => [{shape: 'cyl', r: b.r, z0: 0, z1: b.h, col: 'hab'}, {shape: 'box', c: [b.r + 3, 0, 3], h: [4, 3, 3], col: 'hull'}],
	silo: b => [{shape: 'cyl', r: b.r, z0: 0, z1: b.h, col: 'hull'}, {shape: 'ell', c: [0, 0, b.h], r: [b.r, b.r, b.r * 0.5], col: 'hull'}],
	plant: b => [{shape: 'box', c: [0, 0, b.h / 2], h: [b.r, b.r * 0.6, b.h / 2], col: 'hull'}, {shape: 'cyl', r: 3, z0: b.h, z1: b.h + 14, col: 'truss'}],
	mast: b => [{shape: 'box', c: [0, 0, b.h / 2], h: [1.2, 1.2, b.h / 2], col: 'truss'}, {shape: 'ell', c: [0, 0, b.h], r: [5, 5, 1.5], col: 'hab'}, {shape: 'box', c: [0, 0, b.h + 2], h: [0.6, 0.6, 2], col: 'light'}],
	tank: b => [{shape: 'ell', c: [0, 0, b.r * 0.9], r: [b.r, b.r, b.r * 0.9], col: 'hull'}],
	pit: b => [{shape: 'cyl', r: b.r, z0: -0.4, z1: 0.05, col: 'pit'}],
	solar: b => [{shape: 'box', c: [0, 0, 2], h: [b.r, b.r * 0.45, 0.3], col: 'radiator'}],
	hangar: b => [{shape: 'box', c: [0, 0, b.h / 2], h: [b.r, b.r * 0.8, b.h / 2], col: 'dock'}, {shape: 'box', c: [b.r + 0.4, 0, b.h * 0.42], h: [0.4, b.r * 0.6, b.h * 0.4], col: 'light'}],
	dome: b => [{shape: 'dome', c: [0, 0, 0], r: [b.r, b.r, b.h], col: 'window'}, {shape: 'cyl', r: b.r + 2, z0: 0, z1: 2, col: 'hull'}],
	greenhouse: b => [{shape: 'dome', c: [0, 0, 0], r: [b.r, b.r * 0.55, b.h], col: 'green'}],
	tower: b => [{shape: 'cyl', r: b.r * 0.5, z0: 0, z1: b.h, col: 'hull'}, {shape: 'cyl', r: b.r, z0: b.h - 8, z1: b.h, col: 'window'}, {shape: 'box', c: [0, 0, b.h + 3], h: [0.5, 0.5, 3], col: 'light'}],
	bunker: b => [{shape: 'dome', c: [0, 0, 0], r: [b.r, b.r * 0.7, b.h], col: 'hull'}],
	turret: b => [{shape: 'cyl', r: b.r, z0: 0, z1: b.h * 0.6, col: 'hull'}, {shape: 'box', c: [b.r, 0, b.h * 0.75], h: [b.r * 1.4, 1, 1], col: 'truss'}]};
const XCOL = {pit: [0.16, 0.15, 0.14, 0], green: [0.42, 0.78, 0.42, 0.6], pad: [0.3, 0.32, 0.36, 0]};
function parts(L) {
	const out = [];
	for (const p of L.pads) out.push({shape: 'pad', c: [p.c[0], p.c[1], 0], r: p.r, n: p.n, size: p.size, hangar: !!p.hangar});
	for (const b of L.blds) for (const q of SHAPES[b.type](b)) {
		/* each part placed: rotated about the building's own centre, then moved to it */
		const c = q.c || [0, 0, 0], k = Math.cos(b.rot), s = Math.sin(b.rot), cc = [c[0] * k - c[1] * s + b.c[0], c[0] * s + c[1] * k + b.c[1], c[2]];
		out.push(Object.assign({}, q, {c: cc, at: b.c, rot: (q.rot || 0) + b.rot, bld: b.type}));
	}
	return out;
}
function dome(rx, ry, rz, col, seg) {
	const m = new Me.Mesh(), P = (i, j) => { const u = i / seg * 2 * Math.PI, v = j / (seg / 4) * Math.PI / 2; return [rx * Math.cos(v) * Math.cos(u), ry * Math.cos(v) * Math.sin(u), rz * Math.sin(v)] };
	const N = (i, j) => { const p = P(i, j); const n = [p[0] / rx / rx, p[1] / ry / ry, p[2] / rz / rz], l = Math.hypot(...n) || 1; return n.map(x => x / l) };
	for (let i = 0; i < seg; i++) for (let j = 0; j < seg / 4; j++) { const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1); m.tri(A, B, C, col, N(i, j), N(i + 1, j), N(i + 1, j + 1)).tri(A, C, D, col, N(i, j), N(i + 1, j + 1), N(i, j + 1)) }
	return m;
}
function padMesh(p, seg) {
	const m = new Me.Mesh(), up = [0, 0, 1], z = 0.15, light = [...PAD[p.size].light, 1], e = Math.max(2, p.r * 0.06);
	for (let k = 0; k < seg; k++) {
		const a0 = k / seg * 2 * Math.PI, a1 = (k + 1) / seg * 2 * Math.PI, c0 = [Math.cos(a0), Math.sin(a0)], c1 = [Math.cos(a1), Math.sin(a1)];
		m.tri([0, 0, z], [c0[0] * (p.r - e), c0[1] * (p.r - e), z], [c1[0] * (p.r - e), c1[1] * (p.r - e), z], XCOL.pad, up, up, up);
		m.quad([c0[0] * (p.r - e), c0[1] * (p.r - e), z], [c0[0] * p.r, c0[1] * p.r, z], [c1[0] * p.r, c1[1] * p.r, z], [c1[0] * (p.r - e), c1[1] * (p.r - e), z], k % 2 ? light : XCOL.pad);
	}
	/* the touchdown cross */
	const w = p.r * 0.05, L = p.r * 0.45;
	m.quad([-L, -w, z + 0.05], [L, -w, z + 0.05], [L, w, z + 0.05], [-L, w, z + 0.05], light).quad([-w, -L, z + 0.05], [w, -L, z + 0.05], [w, L, z + 0.05], [-w, L, z + 0.05], light);
	return m.place(0, p.c);
}
function meshes(L, detail) {
	const lo = detail == 'lo', m = new Me.Mesh(), col = c => XCOL[c] || Me.COL[c] || Me.COL.hull;
	for (const q of parts(L)) {
		let x;
		if (q.shape == 'pad') x = padMesh(q, lo ? 16 : 32);
		else if (q.shape == 'dome') x = dome(q.r[0], q.r[1], q.r[2], col(q.col), lo ? 8 : 16).place(q.rot, q.c);
		else if (q.shape == 'cyl') x = Me.cylinder(q.r, q.z0, q.z1, lo ? 6 : 12, col(q.col)).place(0, q.c);
		else if (q.shape == 'box') x = Me.box([0, 0, 0], q.h, col(q.col)).place(q.rot, q.c);
		else if (q.shape == 'ell') x = Me.sphere(lo ? 0 : 1, () => col(q.col), q.r).place(q.rot, q.c);
		if (x) m.add(x);
	}
	return m;
}

const EmberSurface = {LAND, TOUCH, PAD, CONE, KIND, BLD, PLACE, landable, canLand, maxG, touchdown, ports, layout, check, parts, meshes, dome};
if (typeof module != 'undefined') module.exports = EmberSurface; else root.EmberSurface = EmberSurface;
})(typeof window != 'undefined' ? window : globalThis);
