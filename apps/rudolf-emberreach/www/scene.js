/* ===== Ember Reach: a star system to fly in (docs/plan-ember-reach.md, "Flight", "Three scales of travel", M1).
   Builds one real system from the galaxy model, in metres around its star: the star (and its companion), the
   planets on their orbits for the day, and a port. Ports come in the four station classes (Trefoil, Bloom,
   Lantern, Halo): each is a set of solid parts that spin about the station's axis for gravity, or stay still, and a
   dock mouth on the axis. The same parts are drawn (render.js) and collided with (here).
   - Docking: ask for clearance, then fly through the mouth slowly, nose in. At a spinning dock (Trefoil, Bloom) the
     ship must turn with the station; flight assist does that inside the port's frame (flight.js).
   - Cruise: within a system, a warp whose speed is set by the distance to the nearest surface (1/s × distance, up
     to a cap), so it slows on its own near planets and stations; a station's mass lock stops it engaging close by.
   - Collisions: against every part, with the ship as a sphere; how hard you hit sets the damage (modules.js).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const G = isNode ? require('./galaxy.js') : root.EmberGalaxy, Fl = isNode ? require('./flight.js') : root.EmberFlight;
const AU = 1.495978707e11, RE = 6.371e6, RSUN = 6.957e8, C = 2.998e8, G0 = 9.81;

/* ---- vectors ---- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.sqrt(dot(a, a)), norm = a => mul(a, 1 / (len(a) || 1));
/* a quaternion whose body z is f and body y is as near `up` as it can be (body x = y × z) */
function lookRotation(f, up) {
	const z = norm(f); let x = cross(up, z); if (len(x) < 1e-9) x = cross([1, 0, 0], z); if (len(x) < 1e-9) x = cross([0, 1, 0], z);
	x = norm(x); const y = cross(z, x);
	const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2], t = m00 + m11 + m22;
	let q;
	if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s] }
	else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s] }
	else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s] }
	else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4] }
	return q;
}
/* rotate about z by angle a */
const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]] };

/* ---------- the station classes (see the design canvas, "Station classes") ----------
   Local metres: z is the spin axis, the dock mouth on +z. spin: 1 or -1 turns with (or against) the station's spin,
   0 is still. Shapes: cyl {r, z0, z1}; torus {R, a (radial half), b (axial half), z}; box {c, h (half sizes), rot};
   ell {c, r: [rx, ry, rz], rot}. n repeats a part n times around the axis. */
const STATION = {
	trefoil: {name: 'Trefoil', size: 'small outpost', floor: 112, radius: 140, pads: 'S',
		dock: {z: 40, iris: 12, spins: true},
		parts: [{shape: 'cyl', r: 22, z0: -40, z1: 40, spin: 1, col: 'hull'},
			{shape: 'box', c: [0, 66, 0], h: [3, 44, 3], n: 3, spin: 1, col: 'truss'},
			{shape: 'ell', c: [0, 112, 0], r: [30, 15, 15], n: 3, spin: 1, col: 'hab'}]},
	bloom: {name: 'Bloom', size: 'colony port', floor: 150, radius: 180, pads: 'S',
		dock: {z: 104, iris: 12, spins: true},
		parts: [{shape: 'cyl', r: 14, z0: -90, z1: 104, spin: 1, col: 'hull'},
			{shape: 'cyl', r: 2, z0: -130, z1: -90, spin: 1, col: 'truss'},
			{shape: 'box', c: [0, 75, 31], h: [3, 43, 3], n: 4, spin: 1, col: 'truss'},
			{shape: 'ell', c: [0, 138, 31], r: [15, 26, 15], n: 4, spin: 1, col: 'hab'}]},
	lantern: {name: 'Lantern', size: 'system port', floor: 224, radius: 260, pads: 'S, M',
		dock: {z: 118, iris: 22, spins: false},
		parts: [{shape: 'cyl', r: 40, z0: -100, z1: 118, spin: 0, col: 'hull'},
			{shape: 'torus', R: 224, a: 18, b: 18, z: 55, seg: 6, spin: 1, col: 'hab'},
			{shape: 'torus', R: 224, a: 18, b: 18, z: -25, seg: 6, spin: -1, col: 'hab'},
			{shape: 'box', c: [0, 126, 55], h: [3, 83, 3], n: 6, spin: 1, col: 'truss'},
			{shape: 'box', c: [0, 126, -25], h: [3, 83, 3], n: 6, spin: -1, col: 'truss'},
			{shape: 'box', c: [95, 0, -76], h: [55, 2, 4], n: 2, spin: 0, col: 'radiator'},
			{shape: 'box', c: [85, 0, -92], h: [45, 2, 4], n: 2, spin: 0, col: 'radiator'}]},
	halo: {name: 'Halo', size: 'capital port', floor: 900, radius: 960, pads: 'S, M, L',
		dock: {z: 330, slot: [140, 52], spins: false},
		parts: [{shape: 'torus', R: 900, a: 30, b: 90, z: 0, seg: 12, spin: 1, col: 'hab'},
			{shape: 'box', c: [0, 510, 0], h: [8, 360, 8], n: 6, spin: 1, col: 'truss'},
			{shape: 'cyl', r: 150, z0: -260, z1: 260, spin: 1, col: 'hull'},
			{shape: 'cyl', r: 110, z0: 260, z1: 330, spin: 0, col: 'dock'}]}
};
/* spin rate for 1 g at the floor (rad/s) */
const spinOf = cls => Math.sqrt(G0 / STATION[cls].floor);
/* every part, its repeats placed (each with its own rotation about z) */
function partsOf(cls) {
	const out = [];
	for (const p of STATION[cls].parts) { const n = p.n || 1; for (let k = 0; k < n; k++) out.push(Object.assign({}, p, {rot: (p.rot || 0) + k * 2 * Math.PI / n, n: 1})) }
	return out;
}

/* ---------- signed distances (local, unspun) ---------- */
function sdPart(p, q) {
	const v = rotZ(q, -p.rot);
	switch (p.shape) {
		case 'cyl': { const d = Math.hypot(v[0], v[1]) - p.r, e = Math.max(p.z0 - v[2], v[2] - p.z1); return d > 0 && e > 0 ? Math.hypot(d, e) : Math.max(d, e) }
		case 'torus': { const a = (Math.hypot(v[0], v[1]) - p.R) / p.a, b = (v[2] - p.z) / p.b; return (Math.hypot(a, b) - 1) * Math.min(p.a, p.b) }
		case 'box': { const d = [0, 1, 2].map(i => Math.abs(v[i] - p.c[i]) - p.h[i]), o = len(d.map(x => Math.max(x, 0))); return o + Math.min(Math.max(d[0], d[1], d[2]), 0) }
		case 'ell': { const d = [0, 1, 2].map(i => (v[i] - p.c[i]) / p.r[i]); return (len(d) - 1) * Math.min(...p.r) }
	}
	return 1e9;
}

/* ---------- the system ---------- */
/* opts: day (orbits), port (station class), portWorld (the planet the port orbits: its name or index; the last
   planet if not given) */
function build(star, opts) {
	opts = opts || {};
	const day = opts.day || 0, sys = G.system(star), r = G.rng(G.hashStr('scene:' + star.id));
	/* a black hole: its horizon (2.95 km a sun), a wormhole's throat; the ship's safety holds it off (play.js) */
	const bh = star.kind == 'black hole';
	const bodies = [{kind: 'star', name: star.name, cls: star.cls, pos: [0, 0, 0], radius: bh ? 2953 * star.M : Math.max(0.01, star.R) * RSUN, T: star.T, L: star.L, bh}];
	if (star.companion && star.companion.kind == 'star') {
		const a = Math.exp(Math.log(20) + r() * Math.log(10)) * AU, th = r() * 2 * Math.PI;
		bodies.push({kind: 'star', name: star.name + ' B', cls: star.companion.cls, pos: [a * Math.cos(th), a * Math.sin(th), a * 0.05 * (r() - 0.5)], radius: Math.max(0.01, star.companion.R) * RSUN, T: star.companion.T, L: star.companion.L, companion: true});
	}
	for (const pl of sys.planets) {
		/* a companion's worlds orbit it (their own draws, so the primary's stay put) */
		const B = pl.host == 'B' ? bodies.find(b => b.companion) : null, rr = B ? G.rng(G.hashStr('orbitB:' + pl.name)) : r, hostM = B ? star.companion.M : star.M, o = B ? B.pos : [0, 0, 0];
		const P = pl.year || Math.sqrt(Math.pow(pl.a, 3) / Math.max(0.05, hostM)) * 365.25, th = rr() * 2 * Math.PI + 2 * Math.PI * day / P, inc = (rr() - 0.5) * 0.06;
		const a = pl.a * AU;
		/* tilt: drawn per planet from its own seed (the orbits above keep theirs); its day (one turn, in days, from
		   the galaxy model: negative turns backwards) */
		const q = G.rng(G.hashStr('spin:' + pl.name)), tilt = (pl.locked ? 0.02 : 0.45) * q(), az = q() * 2 * Math.PI;
		const axis = [Math.sin(tilt) * Math.cos(az), Math.sin(tilt) * Math.sin(az), Math.cos(tilt)];
		q(); const dayLen = pl.day || (pl.locked ? P : 1);
		bodies.push({kind: 'planet', name: pl.name, type: pl.type, pos: [o[0] + a * Math.cos(th), o[1] + a * Math.sin(th), o[2] + a * Math.sin(inc) * Math.sin(th)], radius: pl.R * RE, g: pl.g, M: pl.M, karman: karmanOf(pl.M), Ts: pl.Ts, ring: pl.ring, ringDensity: pl.ringDensity, host: pl.host || null, life: pl.life, seed: G.hashStr(pl.name),
			atmo: !!pl.atmo, locked: !!pl.locked, axis, period: dayLen * 86400, phase: q() * 2 * Math.PI, src: pl});
	}
	/* moons: around their planets, tidally locked, at their distances in planet radii (their own draws), each in its
	   real month (the galaxy model's year for a moon: Kepler's law round its planet's mass) */
	for (const pb of bodies.filter(b => b.kind == 'planet' && b.src.moons && b.src.moons.length)) for (const mo of pb.src.moons) {
		const month = mo.year || (2 + mo.dist * 0.4), q = G.rng(G.hashStr('moon:' + mo.name)), th = q() * 2 * Math.PI + 2 * Math.PI * day / month, r0 = pb.radius * mo.dist;
		bodies.push({kind: 'planet', name: mo.name, type: mo.type, pos: [pb.pos[0] + r0 * Math.cos(th), pb.pos[1] + r0 * Math.sin(th), pb.pos[2] + r0 * 0.05 * (q() - 0.5)], radius: mo.R * RE, g: mo.g, M: mo.M, karman: karmanOf(mo.M), Ts: mo.Ts, ring: null, host: pb.host, parent: pb.name, life: 0, seed: G.hashStr(mo.name),
			atmo: !!mo.atmo, locked: true, axis: [0, 0, 1], period: 86400 * month, phase: q() * 2 * Math.PI, src: mo});
	}
	const planets = bodies.filter(b => b.kind == 'planet');
	const prim = planets.filter(b => !b.host && !b.parent);
	const portWorld = (opts.portWorld != null ? (typeof opts.portWorld == 'string' ? planets.find(b => b.name == opts.portWorld) : prim[opts.portWorld]) : null) || prim[prim.length - 1] || planets[planets.length - 1] || null;
	/* no port: opts.port === null (most of the galaxy) */
	if (opts.port === null) return {star, bodies, station: null, day};
	const cls = opts.port || 'halo';
	/* the port: in orbit at one planetary radius up (two if the world has rings), on the day side; its axis points out from the planet, so the
	   mouth faces open space */
	let c, axis;
	if (portWorld) {
		const toStar = norm(mul(portWorld.pos, -1)), side = norm(cross(toStar, [0, 0, 1])), u = norm(add(mul(toStar, 0.8), mul(side, 0.6)));
		/* (and always above the world's Kármán line, where its gravity starts: a heavy giant's reaches past one radius) */
		c = add(portWorld.pos, mul(u, Math.max(portWorld.radius * (portWorld.ring ? 3 : 2), portWorld.radius + 1.5 * portWorld.karman))); axis = u;   /* clear of any rings (they reach 2.3 radii) */
	} else { c = [AU, 0, 0]; axis = [-1, 0, 0] }
	const xAx = norm(cross([0, 0, 1], axis).every(v => Math.abs(v) < 1e-9) ? [1, 0, 0] : cross([0, 0, 1], axis)), yAx = cross(axis, xAx);
	const station = {cls, def: STATION[cls], name: (portWorld ? portWorld.name : star.name) + ' ' + STATION[cls].name, c, axis, x: xAx, y: yAx, spin: spinOf(cls), parts: partsOf(cls), world: portWorld};
	return {star, bodies, station, day};
}

/* how far round a planet has turned (radians) at a game time: days since the epoch plus seconds */
const turnOf = (b, day, t) => b.period ? b.phase + 2 * Math.PI * ((day * 86400 + t) % b.period) / b.period : 0;
/* a planet's frame: its axis as z, and an x and y perpendicular, turned by its rotation */
function bodyFrame(b, ang) {
	const z = b.axis || [0, 0, 1], x0 = norm(Math.abs(z[2]) < 0.9 ? cross([0, 0, 1], z) : cross([1, 0, 0], z)), y0 = cross(z, x0), c = Math.cos(ang || 0), s = Math.sin(ang || 0);
	return {x: add(mul(x0, c), mul(y0, s)), y: add(mul(x0, -s), mul(y0, c)), z};
}
/* station-local coordinates of a world point (unspun), and back */
const toLocal = (st, p) => { const d = sub(p, st.c); return [dot(d, st.x), dot(d, st.y), dot(d, st.axis)] };
const toWorldPt = (st, l) => add(st.c, add(add(mul(st.x, l[0]), mul(st.y, l[1])), mul(st.axis, l[2])));
const toWorldDir = (st, l) => add(add(mul(st.x, l[0]), mul(st.y, l[1])), mul(st.axis, l[2]));
/* the angle a spinning part has turned to at time t */
const angleAt = (st, t, spin) => spin * st.spin * t;
/* the frame flight assist flies in near the port: its spin only where the dock turns */
function frame(st) { return {c: st.c, v: [0, 0, 0], w: st.def.dock.spins ? mul(st.axis, st.spin) : [0, 0, 0]} }

/* the closest part to a point at time t: distance (m, negative inside), the part, and the outward normal (world) */
function nearestPart(st, p, t) {
	const L = toLocal(st, p);
	let best = {d: 1e18, part: null};
	for (const part of st.parts) {
		const q = rotZ(L, -angleAt(st, t, part.spin)), d = sdPart(part, q);
		if (d < best.d) best = {d, part, q};
	}
	if (best.part) {
		const e = 0.5, sp = best.part, q = best.q, n = [0, 1, 2].map(i => { const a = q.slice(), b = q.slice(); a[i] += e; b[i] -= e; return sdPart(sp, a) - sdPart(sp, b) });
		best.normal = norm(toWorldDir(st, rotZ(n, angleAt(st, t, sp.spin))));
	}
	return best;
}
/* the velocity a spinning part has at a world point */
function partVelocity(st, p, part) { return part && part.spin ? cross(mul(st.axis, part.spin * st.spin), sub(p, st.c)) : [0, 0, 0] }

/* ---------- docking ---------- */
/* is the point in the dock mouth (just outside to just inside the mouth plane)? */
function inMouth(st, p, t, shipR) {
	const D = st.def.dock, L = toLocal(st, p);
	if (L[2] > D.z + Math.max(10, shipR) || L[2] < D.z - 40) return false;
	const q = D.spins ? rotZ(L, -st.spin * t) : L;
	return D.iris ? Math.hypot(q[0], q[1]) < D.iris - shipR * 0.3 : Math.abs(q[0]) < D.slot[0] / 2 - shipR * 0.3 && Math.abs(q[1]) < D.slot[1] / 2 - shipR * 0.3;
}
const DOCK = {speed: 60, align: 30, spin: 0.08};   /* m/s relative, degrees off the axis, rad/s of spin mismatch */
/* a ship (flight.js state) at the mouth: {ok} once it's through, or why not */
function dockCheck(st, s, t, clearance) {
	const shipR = s.radius || 5, D = st.def.dock;
	if (!inMouth(st, s.p, t, shipR)) return null;
	const L = toLocal(st, s.p);
	const rel = Fl.relative(s, frame(st)), speed = len(rel.v);
	const nose = Fl.forward(s), along = -dot(nose, st.axis), off = Math.acos(Math.max(-1, Math.min(1, along))) * 180 / Math.PI;
	const spinErr = D.spins ? len(rel.w) : 0;
	if (!clearance) return {ok: false, why: 'clearance', speed};
	if (speed > DOCK.speed) return {ok: false, why: 'speed', speed};
	if (off > DOCK.align) return {ok: false, why: 'align', off};
	if (spinErr > DOCK.spin) return {ok: false, why: 'spin', spinErr};
	return L[2] <= D.z ? {ok: true} : {ok: null, through: false};
}

/* ---------- collisions: the ship as a sphere; returns the impact (relative speed into the surface) ---------- */
function collide(scene, s, t) {
	const shipR = s.radius || 5, st = scene.station;
	/* planets and stars */
	for (const b of scene.bodies) {
		const d = sub(s.p, b.pos), r = len(d);
		if (r < b.radius + shipR) return {what: b, kind: b.kind, normal: norm(d), depth: b.radius + shipR - r, impact: Math.max(0, -dot(s.v, norm(d)))};
	}
	if (!st || len(sub(s.p, st.c)) > st.def.radius + 200) return null;
	if (inMouth(st, s.p, t, shipR)) return null;   /* the mouth is open: dockCheck decides */
	const n = nearestPart(st, s.p, t);
	if (n.d > shipR) return null;
	const vrel = sub(s.v, partVelocity(st, s.p, n.part));
	return {what: st, kind: 'station', part: n.part, normal: n.normal, depth: shipR - n.d, impact: Math.max(0, -dot(vrel, n.normal)), partV: partVelocity(st, s.p, n.part)};
}
/* push the ship out and bounce it (30% of the impact kept); returns the module damage the impact does */
function resolve(s, hit) {
	s.p = add(s.p, mul(hit.normal, hit.depth + 0.01));
	const pv = hit.partV || [0, 0, 0], vrel = sub(s.v, pv), vn = dot(vrel, hit.normal);
	if (vn < 0) s.v = add(pv, sub(vrel, mul(hit.normal, 1.3 * vn)));
	return Math.max(0, hit.impact - 5) * 0.6;   /* hits under 5 m/s are scrapes */
}

/* ---------- gravity ----------
   A world's gravity takes hold of ships and loose things only below its Kármán line: Earth's is 100 km up, and
   every world's is that in proportion to its mass (a moon of a hundredth of Earth's mass: 1 km; a giant of 300
   Earths: 30,000 km). Below it, the pull is the world's surface gravity falling off with the square of the
   distance from its centre. Above it, none (as if everything up there were in orbit). Stars and black holes
   pull nothing here; ring rocks are in orbit and stay put. In cruise, nothing pulls. */
const KARMAN = 1e5;
function karmanOf(M) { return KARMAN * Math.max(0, M || 0) }
function gravityAt(scene, p) {
	let a = [0, 0, 0];
	for (const b of scene.bodies) {
		if (b.kind != 'planet' || !b.karman) continue;
		const d = sub(p, b.pos), r = len(d); if (r - b.radius > b.karman || r < 1) continue;
		const g = b.g * G0 * Math.pow(b.radius / Math.max(r, b.radius), 2); a = add(a, mul(d, -g / r));
	}
	return a;
}
/* the world whose gravity holds you here, if any: {body, g (in g), alt} */
function gravityWell(scene, p) {
	let best = null;
	for (const b of scene.bodies) { if (b.kind != 'planet' || !b.karman) continue; const r = len(sub(p, b.pos)), alt = r - b.radius; if (alt <= b.karman && (!best || alt < best.alt)) best = {body: b, alt, g: b.g * Math.pow(b.radius / Math.max(r, b.radius), 2)} }
	return best;
}
/* ---------- cruise ---------- */
const CRUISE = {k: 1, cap: 200 * C, min: 2000, charge: 3, lock: 20000, drop: {station: 25000, planet: 1.0, star: 5}, emergency: 3e5};
/* the nearest surface, and how far (m) */
function nearest(scene, p) {
	let best = {d: Infinity, what: null};
	for (const b of scene.bodies) { const d = len(sub(p, b.pos)) - b.radius; if (d < best.d) best = {d, what: b} }
	if (scene.station) { const ds = len(sub(p, scene.station.c)) - scene.station.def.radius; if (ds < best.d) best = {d: ds, what: scene.station} }
	return best;
}
/* a station's mass lock: no cruise within 20 km */
const massLocked = (scene, p) => !!scene.station && len(sub(p, scene.station.c)) < CRUISE.lock;
/* the fastest cruise allowed here */
const cruiseLimit = (scene, p) => Math.min(CRUISE.cap, Math.max(CRUISE.min, CRUISE.k * Math.max(0, nearest(scene, p).d)));
/* how close to a target (its surface, m) the cruise drops out */
const dropRange = (target) => target.bh ? bhSafe(target) * 1.5 : target.kind == 'planet' ? target.radius * CRUISE.drop.planet : target.kind == 'star' ? target.radius * CRUISE.drop.star : CRUISE.drop.station;
/* the ship's proximity safety: how close it lets itself go. Black holes 2,000 km; stars 1.6 radii; worlds with air
   their atmosphere's top (1.12 radii); airless worlds their surface, 300 m up (no landing yet) */
const SAFE = {bh: 2e6, star: 1.6, atmo: 1.12, ground: 300};
/* (a black hole as big as the Maw, five million suns: three of its horizon's radii) */
function bhSafe(b) { return Math.max(SAFE.bh, 3 * b.radius) }
function safeDist(b) { return b.bh ? bhSafe(b) : b.kind == 'star' ? b.radius * SAFE.star : b.kind == 'planet' ? (b.atmo ? b.radius * SAFE.atmo : b.radius + SAFE.ground) : 0 }
const surfaceDist = (target, p) => len(sub(p, target.pos || target.c)) - (target.radius || target.def.radius);
/* one cruise step: the ship turns as in flight (at half rates), and moves along its nose at the cruise speed.
   cz = {v (m/s)}; throttle 0..1; returns 'drop' when it should drop out at the target */
function cruiseStep(scene, s, cz, input, dt, target) {
	const lim = cruiseLimit(scene, s.p), want = Math.max(0.02, input.throttle == null ? 1 : input.throttle) * lim;
	cz.v = Math.min(lim, cz.v + (want - cz.v) * Math.min(1, 1.5 * dt) + (want > cz.v ? 50 * dt : 0));
	const p0 = s.p;
	s.v = [0, 0, 0];
	Fl.step(s, {pitch: (input.pitch || 0) * 0.5, yaw: (input.yaw || 0) * 0.5, roll: (input.roll || 0) * 0.5, throttle: 0}, dt);
	const f = Fl.forward(s);
	s.p = add(p0, mul(f, cz.v * dt)); s.v = mul(f, cz.v);
	if (target && surfaceDist(target, s.p) < dropRange(target)) return 'drop';
	/* too close to anything: drop out (a star throws you out sooner, from three of its radii) */
	const nb = nearest(scene, s.p);
	if (nb.what && nb.d < (nb.what.bh ? bhSafe(nb.what) : nb.what.kind == 'planet' ? 0.15 * nb.what.radius : nb.what.kind == 'star' ? 2 * nb.what.radius : CRUISE.drop.station * 0.5)) return 'drop';
	return null;
}
/* leaving cruise: the ship keeps its heading at up to its top speed; above 300 km/s it's an emergency drop */
function dropOut(s, cz) {
	const f = Fl.forward(s), emergency = cz.v > CRUISE.emergency;
	s.v = mul(f, Math.min(s.spec.vmax, cz.v)); cz.v = 0;
	return {emergency};
}

/* where a jump arrives: out from the star (40 of its radii, at least 0.02 AU) on the side of the port (or of the
   first planet), facing that way, so cruising straight ahead heads there */
function arrival(scene) {
	const sun = scene.bodies[0], goal = scene.station ? scene.station.c : (scene.bodies.find(b => b.kind == 'planet') || {pos: [AU, 0, 0]}).pos;
	const u = norm(sub(goal, sun.pos)), D = Math.max(40 * sun.radius, 0.02 * AU);
	return {p: add(sun.pos, mul(u, D)), q: lookRotation(u, Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])};
}
/* where a ship starts: outside the mouth, facing it */
function spawn(scene, dist) {
	const st = scene.station, D = st.def.dock, p = toWorldPt(st, [0, 0, D.z + (dist || 2500)]);
	return {p, q: lookRotation(mul(st.axis, -1), st.y)};
}

const EmberScene = {AU, RE, RSUN, C, STATION, CRUISE, DOCK, build, turnOf, bodyFrame, spinOf, partsOf, sdPart, toLocal, toWorldPt, toWorldDir, angleAt, frame, nearestPart,
	KARMAN, karmanOf, gravityAt, gravityWell, SAFE, bhSafe, safeDist, inMouth, dockCheck, collide, resolve, nearest, massLocked, cruiseLimit, dropRange, surfaceDist, cruiseStep, dropOut, spawn, arrival, lookRotation, rotZ,
	v: {add, sub, mul, dot, cross, len, norm}};
if (isNode) module.exports = EmberScene; else root.EmberScene = EmberScene;
})(typeof window != 'undefined' ? window : this);
