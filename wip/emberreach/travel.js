/* ===== Ember Reach: travel between stars (docs/plan-ember-reach.md, "Three scales of travel", M2).
   - Jumps: star to star within the ship's range (ships.js: jump, pc). Fuel is a tank: a full-range jump burns a
     quarter of it, a shorter one less (by the square of the distance), so short hops are cheap.
   - Misjumps: where stars crowd, the drive can lock onto the wrong one: the chance rises with the number of stars
     near the target (the core is hard to navigate; the outskirts never misjump).
   - Ports: a power's capital has a Halo; its other systems with a living world a Lantern; most others with planets
     a Trefoil; contested systems a Trefoil (a forward base) under today's holder; unclaimed space has none.
   - Lanes: each power keeps relay beacons through its own space (its capital and hubs about 25 pc apart, never in
     contested space, so fronts cut them); a lane jump links two beacons up to 50 pc apart, the power's own or an
     ally's. Enemies' lanes are closed to you. Between the six clusters, old relay chains (the long lanes) make
     jumps of about 100 pc, open to all.
   - Routes: plotted by hops of best progress (fast even where stars crowd), and through the lanes when that takes
     fewer jumps.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const G = isNode ? require('./galaxy.js') : root.EmberGalaxy, F = isNode ? require('./factions.js') : root.EmberFactions;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const at = s => s.at || [s.x, s.y, s.z];
const TRAVEL = {fullJump: 0.25, laneCost: 0.08, laneMax: 50, hubSpacing: 25, longStep: 100, misjumpK: 0.1, misjumpR: 0.05, jumpDays: 1, laneDays: 0.5};

/* ---------- fuel ---------- */
const jumpCost = (d, range) => TRAVEL.fullJump * Math.pow(Math.min(1, d / Math.max(1e-6, range)), 2);
/* ---------- finding stars ---------- */
/* the star with this id at (about) this place */
function starAt(id, p) { return G.starsNear(p[0], p[1], p[2], 1e-3).find(s => s.id == id) || G.starsNear(p[0], p[1], p[2], 0.05).find(s => s.id == id) || null }
/* a star near p (the nearest, or the nearest that passes ok) */
function starNear(p, ok) { const list = G.nearestStars(p, 24); return list.find(s => !ok || ok(s)) || list[0] || null }
const hasPlanets = s => G.system(s).planets.length > 0;

/* ---------- misjumps ---------- */
/* the chance of locking onto the wrong star: from the stars expected within 0.05 pc of the target */
function misjumpChance(target) {
	const n = G.numberDensity(...at(target)), lam = n * 4 / 3 * Math.PI * Math.pow(TRAVEL.misjumpR, 3);
	return 1 - Math.exp(-TRAVEL.misjumpK * lam);
}
/* where a jump to target lands, from a random number: the target, or (by the chance above) a neighbour of it */
function arrival(target, rnd) {
	if (rnd >= misjumpChance(target)) return {star: target, misjump: false};
	const p = at(target), near = G.starsNear(p[0], p[1], p[2], 0.3).filter(s => s.id != target.id);
	return near.length ? {star: near[Math.floor((rnd * 7919) % 1 * near.length)], misjump: true} : {star: target, misjump: false};
}

/* ---------- who holds a system, and its port ---------- */
function ownerOf(star, day) {
	const c = F.claimAt(at(star));
	if (c.owner) return {owner: c.owner, contested: false};
	if (c.contested) { const h = F.contestedHolder(at(star), day || 0); return {owner: h.holder, contested: true, war: h.war} }
	return {owner: null, contested: false};
}
/* the port at a star, if any: {cls, world (planet name), owner, capital} */
function portFor(star, day) {
	/* a capital needs no look at the claims (which are slow to set up the first time) */
	const cap = F.majors().find(m => m.star.id == star.id);
	if (cap) return {cls: 'halo', world: cap.home.name, owner: cap.id, capital: true, contested: false};
	const o = ownerOf(star, day);
	if (!o.owner) return null;
	const m = F.byId(o.owner);
	const pl = G.system(star).planets;
	if (!pl.length) return null;
	const living = pl.find(p => p.life || p.alive);
	if (living && !o.contested) return {cls: 'lantern', world: living.name, owner: m.id, capital: false, contested: false};
	/* most other systems with planets keep a small outpost; a few have none */
	if (G.rng(G.hashStr('port:' + star.id))() < (o.contested ? 0.9 : 0.6)) return {cls: 'trefoil', world: pl[pl.length - 1].name, owner: m.id, capital: false, contested: o.contested};
	return null;
}

/* ---------- lanes ---------- */
let LANES = null;
/* every power's beacons (capital, then hubs on shells 25 pc apart through its own space), and the long lanes */
function lanes() {
	if (LANES) return LANES;
	const nodes = [], edges = [], M = F.majors();
	const add = n => { n.i = nodes.length; nodes.push(n); return n };
	const byPower = {};
	for (const m of M) {
		const hubs = byPower[m.id] = [add({kind: 'capital', power: m.id, star: m.star, at: at(m.star)})], r = G.rng(G.hashStr('lanes:' + m.id));
		for (let k = 1; k * TRAVEL.hubSpacing < 0.92 * m.claim; k++) {
			const R = k * TRAVEL.hubSpacing, n = Math.max(4, Math.round(4 * Math.PI * R * R / (TRAVEL.hubSpacing * TRAVEL.hubSpacing) * 0.55));
			for (let j = 0; j < n; j++) {
				/* a Fibonacci sphere, turned at random */
				const z = 1 - 2 * (j + 0.5) / n, rr = Math.sqrt(1 - z * z), ph = j * 2.39996 + r() * 6.283, p = [m.at[0] + R * rr * Math.cos(ph), m.at[1] + R * rr * Math.sin(ph), m.at[2] + R * z];
				if (F.claimAt(p).owner != m.id) continue;
				const s = starNear(p, x => F.claimAt(at(x)).owner == m.id && hasPlanets(x));
				if (s && F.claimAt(at(s)).owner == m.id && !hubs.some(h => h.star.id == s.id)) hubs.push(add({kind: 'hub', power: m.id, star: s, at: at(s)}));
			}
		}
	}
	/* power lanes: beacons up to 50 pc apart, of one power or of two allies */
	for (const a of nodes) for (const b of nodes) {
		if (b.i <= a.i) continue;
		const d = dist(a.at, b.at); if (d > TRAVEL.laneMax) continue;
		if (a.power == b.power || F.relation(a.power, b.power) > 0) edges.push({a: a.i, b: b.i, d, kind: 'lane', powers: [a.power, b.power]});
	}
	/* the long lanes: a relay chain between each pair of clusters, from the facing capitals, a relay about every
	   100 pc on the nearest star */
	const K = G.clusters(), chains = [];
	for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
		const A = M.filter(m => m.cluster == K[i].id), B = M.filter(m => m.cluster == K[j].id);
		let best = null; for (const a of A) for (const b of B) { const d = dist(a.at, b.at); if (!best || d < best.d) best = {a, b, d} }
		const n = Math.ceil(best.d / TRAVEL.longStep), start = byPower[best.a.id][0], end = byPower[best.b.id][0], chain = [start.i];
		for (let k = 1; k < n; k++) {
			const p = best.a.at.map((v, q) => v + (best.b.at[q] - v) * k / n), s = starNear(p);
			chain.push(add({kind: 'relay', star: s, at: at(s), chain: chains.length}).i);
		}
		chain.push(end.i);
		for (let k = 1; k < chain.length; k++) edges.push({a: chain[k - 1], b: chain[k], d: dist(nodes[chain[k - 1]].at, nodes[chain[k]].at), kind: 'long'});
		chains.push({from: K[i].id, to: K[j].id, nodes: chain, length: best.d});
	}
	const adj = nodes.map(() => []);
	edges.forEach((e, k) => { adj[e.a].push(k); adj[e.b].push(k) });
	return (LANES = {nodes, edges, adj, chains, byPower});
}
/* is a lane open to a pilot of this origin power: long lanes always; power lanes unless one end is an enemy's */
const laneOpen = (e, origin) => e.kind == 'long' || !origin || e.powers.every(p => p == origin || F.relation(origin, p) >= 0);

/* ---------- routes ---------- */
/* hops of best progress from a star towards a point, each within range: rather than every star in range (tens of
   thousands in the Glow), look in a small ball at the far edge of the range towards the target */
function hopsToward(from, toP, range, maxHops, finalStar) {
	const out = []; let cur = from;
	for (let h = 0; h < (maxHops || 400); h++) {
		const p = at(cur), d = dist(p, toP);
		if (finalStar && d <= range) { out.push({kind: 'jump', star: finalStar, d}); return {hops: out, ok: true} }
		if (!finalStar && d <= range * 0.5) return {hops: out, ok: true};
		const u = toP.map((v, i) => (v - p[i]) / d), n = G.numberDensity(...p) + 1e-9;
		let best = null;
		for (const reach of [0.92, 0.75, 0.55]) {
			const r = Math.min(range * 0.3, Math.max(0.05, Math.cbrt(40 / (n * 4.19)))), c = p.map((v, i) => v + u[i] * range * reach);
			for (const s of G.starsNear(c[0], c[1], c[2], r)) { const ds = dist(at(s), p); if (s.id == cur.id || ds > range) continue; const left = dist(at(s), toP); if (!best || left < best.left) best = {s, left, d: ds} }
			if (best) break;
		}
		/* sparse space: the balls can come up empty, but then everything in range is few enough to check */
		if (!best && n * 4.19 * range * range * range < 20000) for (const s of G.starsNear(p[0], p[1], p[2], range)) { if (s.id == cur.id) continue; const left = dist(at(s), toP); if (!best || left < best.left) best = {s, left, d: s.d} }
		if (!best || best.left >= d - 1e-9) return {hops: out, ok: false, stuck: cur};
		out.push({kind: 'jump', star: best.s, d: best.d}); cur = best.s;
	}
	return {hops: out, ok: false};
}
/* the fewest lane jumps between two beacons, through lanes open to this origin (Dijkstra on jump count, then length) */
function lanePath(a, b, origin) {
	const L = lanes(), N = L.nodes.length, cost = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Uint8Array(N);
	cost[a] = 0;
	for (;;) {
		let u = -1, c = Infinity; for (let i = 0; i < N; i++) if (!done[i] && cost[i] < c) { c = cost[i]; u = i }
		if (u < 0 || u == b) break; done[u] = 1;
		for (const k of L.adj[u]) { const e = L.edges[k]; if (!laneOpen(e, origin)) continue; const v = e.a == u ? e.b : e.a, nc = c + 1 + e.d * 1e-4; if (nc < cost[v]) { cost[v] = nc; prev[v] = u } }
	}
	if (!isFinite(cost[b])) return null;
	const path = []; for (let v = b; v != a; v = prev[v]) path.unshift(v);
	return path;
}
/* the open beacon nearest a point */
function nearestBeacon(p, origin) {
	let best = null;
	for (const n of lanes().nodes) { if (n.power && origin && F.relation(origin, n.power) < 0) continue; const d = dist(n.at, p); if (!best || d < best.d) best = {n, d} }
	return best;
}
/* a route from one star to another for a ship with this range; origin closes enemy lanes. Returns
   {legs: [{kind: 'jump'|'lane'|'long', star, d}], jumps, fuel, ok} */
function route(from, to, range, origin) {
	const tp = at(to), direct = hopsToward(from, tp, range, 400, to);
	let best = direct.ok ? direct.hops : null;
	/* through the lanes: to the beacon nearest us, along the lanes, from the beacon nearest the target */
	const bA = nearestBeacon(at(from), origin), bB = nearestBeacon(tp, origin);
	if (bA && bB && bA.n.i != bB.n.i) {
		const path = lanePath(bA.n.i, bB.n.i, origin);
		if (path) {
			const L = lanes(), toA = bA.n.star.id == from.id ? {ok: true, hops: []} : hopsToward(from, bA.n.at, range, 200, bA.n.star);
			const fromB = bB.n.star.id == to.id ? {ok: true, hops: []} : hopsToward(bB.n.star, tp, range, 200, to);
			if (toA.ok && fromB.ok) {
				let prev = bA.n.i; const lane = path.map(v => { const e = L.edges.find(e => (e.a == prev && e.b == v) || (e.b == prev && e.a == v)); prev = v; return {kind: e.kind, star: L.nodes[v].star, d: e.d} });
				const via = toA.hops.concat(lane, fromB.hops);
				if (!best || via.length < best.length) best = via;
			}
		}
	}
	if (!best) return {ok: false, legs: direct.hops, stuck: direct.stuck};
	return {ok: true, legs: best, jumps: best.length, fuel: best.reduce((t, l) => t + (l.kind == 'jump' ? jumpCost(l.d, range) : TRAVEL.laneCost), 0)};
}
/* can this ship make this leg now (range, lane open, fuel)? */
function canMake(leg, range, fuel) {
	const cost = leg.kind == 'jump' ? jumpCost(leg.d, range) : TRAVEL.laneCost;
	if (leg.kind == 'jump' && leg.d > range + 1e-9) return {ok: false, why: 'range', cost};
	if (fuel + 1e-9 < cost) return {ok: false, why: 'fuel', cost};
	return {ok: true, cost};
}

const EmberTravel = {TRAVEL, jumpCost, starAt, starNear, misjumpChance, arrival, ownerOf, portFor, lanes, laneOpen, hopsToward, lanePath, nearestBeacon, route, canMake, at, dist};
if (isNode) module.exports = EmberTravel; else root.EmberTravel = EmberTravel;
})(typeof window != 'undefined' ? window : this);
