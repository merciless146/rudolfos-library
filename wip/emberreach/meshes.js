/* ===== Ember Reach: meshes for the renderer (render.js).
   Every mesh is plain triangles: position, normal and colour (rgba, where a is how much it glows). Built here from
   the model: planets coloured by their type, the four station classes from scene.js's parts (so what you see is
   what you hit), and the player's ship.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const COL = {hull: [0.56, 0.59, 0.64, 0], truss: [0.34, 0.36, 0.40, 0], hab: [0.74, 0.74, 0.71, 0], dock: [0.46, 0.48, 0.52, 0], radiator: [0.24, 0.26, 0.31, 0],
	light: [1.0, 0.66, 0.26, 1], window: [0.95, 0.86, 0.62, 0.85], engine: [0.45, 0.8, 1.0, 1]};
function Mesh() { this.p = []; this.n = []; this.c = []; }
Mesh.prototype.tri = function (a, b, c, col, na, nb, nc) {
	if (!na) { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1; na = nb = nc = n.map(x => x / l) }
	this.p.push(...a, ...b, ...c); this.n.push(...na, ...nb, ...nc);
	const cs = Array.isArray(col[0]) ? col : [col, col, col];
	for (const k of cs) this.c.push(k[0], k[1], k[2], k[3] || 0);
	return this;
};
Mesh.prototype.quad = function (a, b, c, d, col) { return this.tri(a, b, c, col).tri(a, c, d, col) };
Mesh.prototype.add = function (m) { this.p.push(...m.p); this.n.push(...m.n); this.c.push(...m.c); return this };
/* transform in place: rotate about z by rz, then translate */
Mesh.prototype.place = function (rz, t) {
	const c = Math.cos(rz || 0), s = Math.sin(rz || 0), T = t || [0, 0, 0];
	for (let i = 0; i < this.p.length; i += 3) {
		const x = this.p[i], y = this.p[i + 1]; this.p[i] = x * c - y * s + T[0]; this.p[i + 1] = x * s + y * c + T[1]; this.p[i + 2] += T[2];
		const nx = this.n[i], ny = this.n[i + 1]; this.n[i] = nx * c - ny * s; this.n[i + 1] = nx * s + ny * c;
	}
	return this;
};
Mesh.prototype.count = function () { return this.p.length / 9 };

/* ---- primitives ---- */
function cylinder(r, z0, z1, seg, col, capCol) {
	const m = new Mesh();
	for (let k = 0; k < seg; k++) {
		const a0 = k / seg * 2 * Math.PI, a1 = (k + 1) / seg * 2 * Math.PI, p0 = [Math.cos(a0) * r, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
		const n0 = [Math.cos(a0), Math.sin(a0), 0], n1 = [Math.cos(a1), Math.sin(a1), 0];
		m.tri([...p0, z0], [...p1, z0], [...p1, z1], col, n0, n1, n1).tri([...p0, z0], [...p1, z1], [...p0, z1], col, n0, n1, n0);
		m.tri([0, 0, z1], [...p0, z1], [...p1, z1], capCol || col, [0, 0, 1], [0, 0, 1], [0, 0, 1]);
		m.tri([0, 0, z0], [...p1, z0], [...p0, z0], capCol || col, [0, 0, -1], [0, 0, -1], [0, 0, -1]);
	}
	return m;
}
/* a ring of `seg` flat-sided segments (a torus, or a hexagon for seg 6) with an elliptical tube a × b */
function torus(R, a, b, z, seg, minor, col, lit) {
	const m = new Mesh(), P = (i, j) => { const u = i / seg * 2 * Math.PI, v = j / minor * 2 * Math.PI, rr = R + a * Math.cos(v); return [rr * Math.cos(u), rr * Math.sin(u), z + b * Math.sin(v)] };
	const Nn = (i, j) => { const u = i / seg * 2 * Math.PI, v = j / minor * 2 * Math.PI, nx = Math.cos(v) / a, nz = Math.sin(v) / b, l = Math.hypot(nx, nz); return [nx / l * Math.cos(u), nx / l * Math.sin(u), nz / l] };
	for (let i = 0; i < seg; i++) for (let j = 0; j < minor; j++) {
		/* windows: the outer band of every segment glows a little */
		const c = lit && (j == 0 || j == minor - 1) && i % 1 == 0 ? COL.window : col;
		const A = P(i, j), B = P(i + 1, j), C2 = P(i + 1, j + 1), D = P(i, j + 1);
		m.tri(A, B, C2, c, Nn(i, j), Nn(i, j), Nn(i, j + 1)).tri(A, C2, D, c, Nn(i, j), Nn(i, j + 1), Nn(i, j + 1));
	}
	return m;
}
function box(c, h, col) {
	const m = new Mesh(), v = (x, y, z) => [c[0] + x * h[0], c[1] + y * h[1], c[2] + z * h[2]];
	m.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), col).quad(v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1), v(-1, -1, -1), col)
		.quad(v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1), col).quad(v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), v(-1, -1, -1), col)
		.quad(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), col).quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), col);
	return m;
}
/* an icosphere; colour(direction) gives each vertex's colour */
function sphere(sub, colour, scale) {
	const t = (1 + Math.sqrt(5)) / 2, nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l) };
	let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
	let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
	for (let s = 0; s < sub; s++) {
		const mid = {}, M = (a, b) => { const k = a < b ? a + ':' + b : b + ':' + a; if (mid[k] == null) { mid[k] = V.length; V.push(nrm(V[a].map((x, i) => (x + V[b][i]) / 2))) } return mid[k] };
		F = F.flatMap(([a, b, c]) => { const ab = M(a, b), bc = M(b, c), ca = M(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]] });
	}
	const m = new Mesh(), C = V.map(colour), sc = scale || [1, 1, 1];
	for (const [a, b, c] of F) m.tri(V[a].map((x, i) => x * sc[i]), V[b].map((x, i) => x * sc[i]), V[c].map((x, i) => x * sc[i]), [C[a], C[b], C[c]], V[a], V[b], V[c]);
	return m;
}

/* ---- an asteroid: a lumpy, flat-shaded rock of radius r (mining.js), coloured by its field ---- */
function rock(r, seed, kind) {
	const t = (1 + Math.sqrt(5)) / 2, nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l) };
	let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
	let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
	const mid = {}, M = (a, b) => { const k = a < b ? a + ':' + b : b + ':' + a; if (mid[k] == null) { mid[k] = V.length; V.push(nrm(V[a].map((x, i) => (x + V[b][i]) / 2))) } return mid[k] };
	F = F.flatMap(([a, b, c]) => { const ab = M(a, b), bc = M(b, c), ca = M(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]] });
	const sc = [1, 0.78 + 0.1 * (seed % 3), 0.9], P = V.map(v => { const k = 1 + 0.55 * (noise(v, 1.7, seed) - 0.5) + 0.2 * (noise(v, 4.1, seed + 7) - 0.5); return v.map((x, i) => x * k * sc[i] * r) });
	const base = kind == 'Ice' ? [0.72, 0.8, 0.86] : kind == 'metallic' ? [0.46, 0.45, 0.47] : [0.42, 0.37, 0.32], m = new Mesh();
	for (const [a, b, c] of F) { const sh = 0.85 + 0.3 * noise(V[a], 3, seed + 3); m.tri(P[a], P[b], P[c], base.map(x => Math.min(1, x * sh)).concat(0)) }
	return m;
}

/* ---- planets: colour by type, with seeded value noise for continents, bands and craters ---- */
function hash3(x, y, z, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function noise(v, f, s) {
	const x = v[0] * f, y = v[1] * f, z = v[2] * f, X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = x - X, w = y - Y, q = z - Z;
	const sm = t => t * t * (3 - 2 * t), a = sm(u), b = sm(w), c = sm(q), L = (p, r, t) => p + (r - p) * t;
	const n = (i, j, k) => hash3(X + i, Y + j, Z + k, s);
	return L(L(L(n(0, 0, 0), n(1, 0, 0), a), L(n(0, 1, 0), n(1, 1, 0), a), b), L(L(n(0, 0, 1), n(1, 0, 1), a), L(n(0, 1, 1), n(1, 1, 1), a), b), c);
}
const fbm = (v, s) => noise(v, 2, s) * 0.5 + noise(v, 4, s + 1) * 0.3 + noise(v, 8, s + 2) * 0.2;
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const PAL = {
	Barren: [[0.42, 0.39, 0.36], [0.62, 0.58, 0.52]], Exotic: [[0.62, 0.42, 0.18], [0.88, 0.74, 0.42]], Desert: [[0.66, 0.5, 0.3], [0.86, 0.72, 0.5]],
	Tundra: [[0.62, 0.68, 0.74], [0.92, 0.94, 0.97]], Ocean: [[0.08, 0.2, 0.42], [0.2, 0.42, 0.62]], Gas: [[0.6, 0.48, 0.34], [0.88, 0.8, 0.66]],
	Terra: [[0.12, 0.26, 0.48], [0.3, 0.46, 0.24]], Forest: [[0.1, 0.24, 0.44], [0.16, 0.38, 0.16]], EarthLike: [[0.1, 0.26, 0.5], [0.34, 0.5, 0.26]]};
function planetColour(type, seed) {
	const p = PAL[type] || PAL.Barren, living = /Terra|Forest|EarthLike|Ocean/.test(type);
	return v => {
		if (type == 'Gas') { const b = noise([v[2] * 6, v[2] * 6, 0.3], 1.5, seed) * 0.7 + fbm(v, seed) * 0.3; return [...mix(p[0], p[1], b), 0] }
		const n = fbm(v, seed);
		if (living) {
			const land = n > 0.5, ice = Math.abs(v[2]) > 0.86;
			if (ice) return [0.9, 0.93, 0.96, 0];
			if (!land) return [...mix(p[0], [p[0][0] * 1.3, p[0][1] * 1.3, p[0][2] * 1.2], (n - 0.2) * 2), 0];
			return [...mix(p[1], [0.55, 0.5, 0.36], Math.max(0, n - 0.62) * 3), 0];
		}
		return [...mix(p[0], p[1], Math.min(1, Math.max(0, (n - 0.25) * 2))), 0];
	};
}
/* planets and stars only get a mesh up close (render.js draws them as lit sprites from afar); quality sets how
   fine the mesh is */
function planet(b, quality) { return sphere(quality == 'low' ? 3 : 4, planetColour(b.type, b.seed || 1)) }
/* a star: glowing, coloured by its temperature */
function starColour(T) {
	const t = Math.max(2000, Math.min(12000, T || 5800));
	const r = t < 6600 ? 1 : Math.max(0.6, 1.3 - (t - 6600) / 9000), g = t < 6600 ? Math.min(1, 0.35 + (t - 2000) / 5800 * 0.62) : Math.max(0.75, 1 - (t - 6600) / 20000), b = t < 6600 ? Math.min(1, Math.max(0.1, (t - 2500) / 4600)) : 1;
	return [r, g, b];
}
/* a planet's rings: flat bands between 1.35 and 2.3 radii (unit radius), with gaps; both faces lit. Ice is pale,
   stone is brown and grey */
function rings(kind, seed, quality) {
	const m = new Mesh(), seg = quality == 'low' ? 48 : 96, bands = 14, base = kind == 'Ice' ? [0.82, 0.86, 0.9] : [0.55, 0.48, 0.4];
	for (let b = 0; b < bands; b++) {
		const n = hash3(b, 3, 7, seed); if (n < 0.22) continue;   /* gaps */
		const r0 = 1.35 + 0.95 * b / bands, r1 = 1.35 + 0.95 * (b + 1) / bands, k = 0.7 + 0.45 * n, col = [base[0] * k, base[1] * k, base[2] * k, 0];
		for (let i = 0; i < seg; i++) {
			const a0 = i / seg * 2 * Math.PI, a1 = (i + 1) / seg * 2 * Math.PI, P = (r, a) => [r * Math.cos(a), r * Math.sin(a), 0];
			m.tri(P(r0, a0), P(r1, a0), P(r1, a1), col, [0, 0, 1], [0, 0, 1], [0, 0, 1]).tri(P(r0, a0), P(r1, a1), P(r0, a1), col, [0, 0, 1], [0, 0, 1], [0, 0, 1]);
			m.tri(P(r0, a0), P(r1, a1), P(r1, a0), col, [0, 0, -1], [0, 0, -1], [0, 0, -1]).tri(P(r0, a0), P(r0, a1), P(r1, a1), col, [0, 0, -1], [0, 0, -1], [0, 0, -1]);
		}
	}
	return m;
}
/* the haze of a world with air, by type: rgb and strength */
function atmosphere(type) {
	return /Terra|Forest|EarthLike|Ocean/.test(type) ? [0.45, 0.66, 1.0, 0.75] : type == 'Exotic' ? [0.95, 0.72, 0.4, 0.55] : type == 'Desert' ? [0.95, 0.78, 0.58, 0.4]
		: type == 'Tundra' ? [0.72, 0.86, 1.0, 0.45] : type == 'Gas' ? [0.88, 0.82, 0.7, 0.35] : [0.7, 0.7, 0.75, 0.25];
}
function star(T, quality) { const c = starColour(T); return sphere(quality == 'low' ? 2 : 3, () => [...c, 1]) }

/* ---- stations: from scene.js's parts, grouped by how they spin. detail 'hi' (up close) or 'lo' (from afar:
   coarser curves, no trusses or radiators, no lit windows) ---- */
function station(def, partsOf, detail) {
	const groups = {}, lo = detail == 'lo';
	const G = s => groups[s] || (groups[s] = new Mesh());
	for (const p of partsOf) {
		const col = COL[p.col] || COL.hull;
		if (lo && (p.col == 'truss' || p.col == 'radiator')) continue;
		let m;
		if (p.shape == 'cyl') m = cylinder(p.r, p.z0, p.z1, lo ? 8 : p.r > 60 ? 24 : 12, col);
		else if (p.shape == 'torus') m = torus(p.R, p.a, p.b, p.z, p.seg || 24, lo ? 4 : 8, col, !lo);
		else if (p.shape == 'box') m = box(p.c, p.h, col);
		else if (p.shape == 'ell') m = sphere(lo ? 0 : 1, () => col, p.r).place(0, p.c);
		m.place(p.rot || 0);
		G(p.spin).add(m);
	}
	/* the dock mouth: a glowing frame, and a dark opening */
	const D = def.dock, z = D.z + 0.6, m = new Mesh(), dark = [0.02, 0.03, 0.05, 0];
	if (D.slot) {
		const w = D.slot[0] / 2, h = D.slot[1] / 2, e = 4;
		m.quad([-w, -h, z], [w, -h, z], [w, h, z], [-w, h, z], dark);
		m.quad([-w - e, h, z], [w + e, h, z], [w + e, h + e, z], [-w - e, h + e, z], COL.light).quad([-w - e, -h - e, z], [w + e, -h - e, z], [w + e, -h, z], [-w - e, -h, z], COL.light);
		m.quad([-w - e, -h, z], [-w, -h, z], [-w, h, z], [-w - e, h, z], COL.light).quad([w, -h, z], [w + e, -h, z], [w + e, h, z], [w, h, z], COL.light);
	} else {
		const r = D.iris, e = Math.max(2, r * 0.25), seg = 20;
		for (let k = 0; k < seg; k++) {
			const a0 = k / seg * 2 * Math.PI, a1 = (k + 1) / seg * 2 * Math.PI, c0 = [Math.cos(a0), Math.sin(a0)], c1 = [Math.cos(a1), Math.sin(a1)];
			m.tri([0, 0, z], [c0[0] * r, c0[1] * r, z], [c1[0] * r, c1[1] * r, z], dark);
			m.quad([c0[0] * r, c0[1] * r, z], [c0[0] * (r + e), c0[1] * (r + e), z], [c1[0] * (r + e), c1[1] * (r + e), z], [c1[0] * r, c1[1] * r, z], k % 2 ? COL.light : COL.hull);
		}
	}
	G(D.spins ? 1 : 0).add(m);
	return Object.keys(groups).map(s => ({spin: +s, mesh: groups[s]}));
}

/* ---- ships: always drawn in full at the player's graphics setting, whatever the distance. A wedge, nose on +z,
   scaled to its length; high quality adds fins and intakes ---- */
function ship(length, quality) {
	const L = length / 2, W = length * 0.36, H = length * 0.14, m = new Mesh(), hull = [0.78, 0.8, 0.84, 0], dark = [0.3, 0.32, 0.36, 0];
	const nose = [0, 0, L], tl = [-W, H * 0.2, -L], tr = [W, H * 0.2, -L], top = [0, H, -L * 0.55], bl = [-W * 0.7, -H, -L], br = [W * 0.7, -H, -L];
	m.tri(nose, tr, top, hull).tri(nose, top, tl, hull).tri(nose, br, tr, dark).tri(nose, tl, bl, dark).tri(nose, bl, br, dark);
	m.tri(tl, top, tr, dark).tri(tl, tr, br, dark).tri(tl, br, bl, dark);
	/* canopy and engines */
	const cz = L * 0.25;
	m.tri([0, H * 0.75, cz - L * 0.3], [-W * 0.18, H * 0.45, cz - L * 0.55], [W * 0.18, H * 0.45, cz - L * 0.55], [0.3, 0.55, 0.75, 0.3]);
	m.quad([-W * 0.55, -H * 0.5, -L - 0.05], [-W * 0.2, -H * 0.5, -L - 0.05], [-W * 0.2, H * 0.1, -L - 0.05], [-W * 0.55, H * 0.1, -L - 0.05], COL.engine);
	m.quad([W * 0.2, -H * 0.5, -L - 0.05], [W * 0.55, -H * 0.5, -L - 0.05], [W * 0.55, H * 0.1, -L - 0.05], [W * 0.2, H * 0.1, -L - 0.05], COL.engine);
	if (quality != 'low') {
		for (const sx of [-1, 1]) {
			m.tri([sx * W * 0.62, H * 0.15, -L * 0.95], [sx * W * 0.62, H * 0.95, -L * 0.98], [sx * W * 0.62, H * 0.15, -L * 0.45], hull);
			m.tri([sx * W * 0.62, H * 0.15, -L * 0.45], [sx * W * 0.62, H * 0.95, -L * 0.98], [sx * W * 0.62, H * 0.15, -L * 0.95], dark);
			m.add(box([sx * W * 0.42, -H * 0.55, -L * 0.25], [W * 0.08, H * 0.18, L * 0.35], dark));
		}
	}
	return m;
}

const EmberMeshes = {rock, Mesh, COL, cylinder, torus, box, sphere, planet, planetColour, rings, atmosphere, star, starColour, station, ship, noise};
if (typeof module != 'undefined') module.exports = EmberMeshes; else root.EmberMeshes = EmberMeshes;
})(typeof window != 'undefined' ? window : this);
