/* ===== Ember Reach: who's who (docs/plan-ember-reach.md, "Factions").
   - The great powers: the civilisations of galaxy.js (at least six, interstellar, around the North Point). Each is
     a species of its own, shaped by its home world, with a government, a currency and a claim on space.
   - Relations: every great power has at least two allies and at least two enemies among the others. Enemies border
     each other: their claims meet in three-dimensional space, and the systems along that border are contested.
   - Wars: each pair of enemies fights over its contested systems. The front moves season by season (offensives,
     truces), and players move it too: missions for one side, and fighting in the contested systems.
   - Smaller factions: nomad fleets, criminal syndicates, prospector guilds and free ports. Most keep a fleet carrier
     or a dreadnought that sustains them (market, refinery, repairs, fuel, a hangar); their claims are fixed,
     semi-permanent or seasonal, so they move about the galaxy as the seasons turn.
   Everything is made from the galaxy's seed; only what players change (war effort) is kept in saves.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const G = typeof module != 'undefined' ? require('./galaxy.js') : root.EmberGalaxy;
const {rng, hashStr, starName} = G;
const SEASON_DAYS = 30;   /* game days in a season */
const seasonOf = day => Math.floor(day / SEASON_DAYS);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pos = s => [s.x, s.y, s.z];

/* ---------- the great powers ---------- */
const GOV = ['Republic', 'Hegemony', 'Concord', 'Directorate', 'Theocracy', 'Collective', 'Dominion', 'Compact', 'Assembly', 'Throne'];
const COIN = ['mark', 'crown', 'sol', 'shard', 'talent', 'dram', 'lumen', 'quill', 'ingot', 'florin', 'bead', 'tithe'];
/* a people's name from their world's: Veora, Veorans; Kaitis, Kaitisi; Ixumth, Ixumthari */
function speciesName(root, u) { if (/[aeiou]$/.test(root)) return root + 'ns'; if (/s$/.test(root)) return root + (u < 0.5 ? 'i' : 'ians'); return root + ['ari', 'en', 'ese', 'i'][Math.floor(u * 4)] }
let MAJORS = null;
function majors() {
	if (MAJORS) return MAJORS;
	const codes = new Set();
	MAJORS = G.civilizations().map((c, i) => {
		const r = rng(hashStr('major:' + c.star.id)), root = starName(hashStr('species:' + c.star.id));
		const h = c.home;
		/* the species, from its world: heavy worlds breed sturdy, armoured builders; light ones, agile flyers.
		   Red and orange suns' children see further into the infrared */
		const species = {name: speciesName(root, r()), gravity: h.g, homeTemp: h.Ts, bars: h.bars,
			build: h.g > 1.15 ? 'heavy' : h.g < 0.8 ? 'light' : 'balanced', sight: c.star.T < 4500 ? 'infrared' : c.star.T > 5600 ? 'ultraviolet' : 'visible'};
		let code = (root.replace(/[^a-z]/gi, '').toUpperCase() + 'XYZ').slice(0, 3); for (let k = 0; codes.has(code); k++) code = code.slice(0, 2) + 'QWXZ'[k % 4];
		codes.add(code);
		const age = c.age;
		return {id: c.id, kind: 'major', name: 'The ' + root + ' ' + GOV[Math.floor(r() * GOV.length)], species, home: c.home, star: c.star, at: pos(c.star),
			currency: {code, name: root.toLowerCase() + ' ' + COIN[Math.floor(r() * COIN.length)], symbol: code[0] + '¤'},
			/* a claim on space, sized for the systems it holds (8,000-14,000; galaxy.js); strength for wars and trade */
			cluster: c.cluster, held: c.held, claim: c.claim, military: 0.6 + 0.8 * r(), economy: 0.6 + 0.8 * r(), age, colonies: c.radius};
	});
	return MAJORS;
}
const byId = id => majors().find(m => m.id == id) || minors().find(m => m.id == id);

/* ---------- relations: at least two allies and two enemies each; enemies share a border ---------- */
let REL = null;
function claimsMeet(a, b) { return dist(a.at, b.at) < a.claim + b.claim }
/* do two powers share a border of their own (not one buried in a third power's space)? the share of points on the
   surface where their claims are equal that no third claim outweighs */
const BORDER = new Map();
function border(a, b) {
	const k = a.id < b.id ? a.id + b.id : b.id + a.id;
	if (BORDER.has(k)) return BORDER.get(k);
	let share = 0;
	if (claimsMeet(a, b)) {
		const axis = a.at.map((v, i) => b.at[i] - v), d = Math.hypot(...axis), u = axis.map(v => v / d), t = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm(cross(u, t)), e2 = cross(u, e1);
		const r = rng(hashStr('border:' + k)), n = 60;
		for (let q = 0; q < n; q++) {
			const ang = r() * 2 * Math.PI, rad = Math.sqrt(r()) * Math.min(a.claim, b.claim) * 0.6, off = e1.map((v, i) => v * Math.cos(ang) * rad + e2[i] * Math.sin(ang) * rad);
			let lo = 0, hi = d, p; for (let z = 0; z < 30; z++) { const mid = (lo + hi) / 2; p = a.at.map((v, i) => v + u[i] * mid + off[i]); if (strength(a, p) > strength(b, p)) lo = mid; else hi = mid }
			const sa = strength(a, p); if (!(sa > 0 && strength(b, p) > 0)) continue;
			if (!majors().some(m => m != a && m != b && strength(m, p) > sa - 0.12)) share++;
		}
		share /= n;
	}
	BORDER.set(k, share);
	return share;
}
const canFight = (a, b) => border(a, b) >= 0.15;
/* claims sized so each power's space (held and contested) comes to its systems (8,000-14,000, galaxy.js): a power
   on the outside of its cluster, with nobody to share with on one side, would otherwise sprawl */
function sizeClaims(M) {
	for (let it = 0; it < 6; it++) {
		const lo = [0, 1, 2].map(i => Math.min(...M.map(m => m.at[i] - m.claim))), hi = [0, 1, 2].map(i => Math.max(...M.map(m => m.at[i] + m.claim)));
		const V = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), r = rng(hashStr('size:' + M[0].id + ':' + it)), n = 40000, got = {};
		for (let k = 0; k < n; k++) { const p = lo.map((v, i) => v + r() * (hi[i] - v)); let top = null, ts = 0; for (const m of M) { const st = strength(m, p); if (st > ts) { ts = st; top = m.id } } if (top) got[top] = (got[top] || 0) + G.numberDensity(...p) * V / n }
		let worst = 0;
		for (const m of M) { const f = m.held * (m.reach || 1) / (got[m.id] || 1); worst = Math.max(worst, Math.abs(f - 1)); m.claim *= Math.max(0.7, Math.min(1.4, Math.cbrt(f))) }
		if (worst < 0.04) break;
	}
}
function relations() {
	if (REL) return REL;
	const mat = {};
	majors().forEach(a => { mat[a.id] = {}; majors().forEach(b => { if (a != b) mat[a.id][b.id] = 0 }) });
	/* within each cluster; powers in different clusters are too far apart to be allies or enemies (neutral) */
	for (const cl of G.clusters()) {
		const M = majors().filter(m => m.cluster == cl.id), n = M.length, pairs = [];
		for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
		/* search the ways to set each pair ally, enemy or neutral; keep the arrangement (in seeded order) that meets
		   the rules with the longest borders between enemies and the widest spread between allies */
		let best = null, bestScore = -1e9, fight;
		/* claims sized to their systems; a power with fewer than two neighbours to fight aims for more (a fifth more
		   each round) until the rules can be met; enemies are chosen from the borders as they finally are */
		M.forEach(m => m.reach = 1);
		for (let grow = 0; grow < 8; grow++) {
			sizeClaims(M); BORDER.clear();
			fight = M.map(a => M.map(b => a != b && canFight(a, b)));
			/* a power short of neighbours may fight across a shorter border (any it truly shares) before reaching out */
			let short = M.filter((a, i) => fight[i].filter(x => x).length < 2);
			short.forEach(a => { const i = M.indexOf(a); M.forEach((b, j) => { if (a != b && border(a, b) >= 0.02) fight[i][j] = fight[j][i] = true }) });
			const lonely = M.filter((a, i) => fight[i].filter(x => x).length < 2);
			if (!lonely.length) break;
			lonely.forEach(a => a.reach *= 1.2);
		}
		const r = rng(hashStr('relations:' + M.map(m => m.id).join()));
		for (let t = 0; t < 40000; t++) {
			const rel = pairs.map(([i, j]) => { const u = r(); return fight[i][j] ? (u < 0.5 ? -1 : u < 0.8 ? 1 : 0) : (u < 0.6 ? 1 : 0) });
			const A = new Array(n).fill(0), E = new Array(n).fill(0);
			let okEnemies = true;
			rel.forEach((v, k) => { const [i, j] = pairs[k]; if (v > 0) { A[i]++; A[j]++ } if (v < 0) { E[i]++; E[j]++; if (!fight[i][j]) okEnemies = false } });
			if (!okEnemies || A.some(x => x < 2) || E.some(x => x < 2)) continue;
			let score = 0; rel.forEach((v, k) => { const [i, j] = pairs[k], d = dist(M[i].at, M[j].at) / M[i].claim; score += v < 0 ? border(M[i], M[j]) * 3 - d / 3 : v > 0 ? d / 3 : 0 });
			if (score > bestScore) { bestScore = score; best = rel }
		}
		if (!best) throw new Error('no arrangement of alliances fits the great powers of ' + cl.name);
		best.forEach((v, k) => { const [i, j] = pairs[k]; mat[M[i].id][M[j].id] = mat[M[j].id][M[i].id] = v });
	}
	majors().forEach(m => { m.allies = majors().filter(o => mat[m.id][o.id] > 0).map(o => o.id); m.enemies = majors().filter(o => mat[m.id][o.id] < 0).map(o => o.id) });
	REL = mat;
	return REL;
}
/* -1 enemy, 0 neutral, +1 ally (great powers); for small factions, their stance to a great power */
function relation(a, b) {
	if (a == b) return 1;
	const mat = relations();
	if (mat[a] && b in mat[a]) return mat[a][b];
	const m = minors().find(x => x.id == a) || minors().find(x => x.id == b), other = m && (m.id == a ? b : a);
	return m ? (m.stance[other] || 0) : 0;
}

/* ---------- space: who holds where ---------- */
/* Every point belongs to at most one great power: the strongest claim there (claims fall from 1 at home to 0 at the
   edge). Borders never overlap, allies' included. Between two enemies, a zone either side of the surface where their
   claims are equal is contested space: a band about 40 pc deep, where the war is fought. */
const BAND = 0.2;   /* the starting width, before calibration */
function strength(m, p) { return Math.max(0, 1 - dist(m.at, p) / m.claim) }
/* a rival's pull even beyond its reach (below zero there): how far a point is from the border two powers would share */
const pull = (m, p) => 1 - dist(m.at, p) / m.claim;
const MAJ_BY_CLUSTER = new Map();
const clusterOf = id => { const m = byId(id); return m ? m.cluster : null };
function rivalsIn(cl) { if (!MAJ_BY_CLUSTER.has(cl)) MAJ_BY_CLUSTER.set(cl, majors().filter(m => m.cluster == cl)); return MAJ_BY_CLUSTER.get(cl) }
/* ---------- how deep each contested zone reaches ----------
   A zone lies along the border two enemies share. Each side of it has its own depth (in claim strength, from the
   border into that side's space), so each power's share can be set on its own:
   - a quarter of every power's systems are contested: its sides of the zones along its borders with its enemies;
   - no zone holds more systems than either power fighting over it holds outright (a zone that would is trimmed on
     its larger side, and that power's depth is solved again with its other borders).
   Solved on a fixed sample of each cluster's space, weighted by how many stars are there. */
const CONTESTED_SHARE = 0.25;
let DEPTHS = null;
const sideKey = (p, e) => p + '>' + e;
const depthOf = (p, e) => (DEPTHS && DEPTHS.get(sideKey(p, e))) || BAND / 2;
const bandOf = (a, b) => depthOf(a, b) + depthOf(b, a);
function calibrate() {
	if (DEPTHS) return DEPTHS;
	relations();
	DEPTHS = new Map();
	const report = [];
	for (const cl of G.clusters()) {
		const M = majors().filter(m => m.cluster == cl.id), ids = M.map(m => m.id);
		const lo = [0, 1, 2].map(i => Math.min(...M.map(m => m.at[i] - m.claim))), hi = [0, 1, 2].map(i => Math.max(...M.map(m => m.at[i] + m.claim)));
		const V = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), r = rng(hashStr('calibrate:' + cl.id)), n = 80000, pts = [];
		for (let k = 0; k < n; k++) {
			const p = lo.map((v, i) => v + r() * (hi[i] - v)), s = M.map(m => [m.id, pull(m, p)]).sort((x, y) => y[1] - x[1]);
			if (!(s[0][1] > 0)) continue;
			const enemy = relation(s[0][0], s[1][0]) < 0;
			pts.push({w: G.numberDensity(...p) * V / n, top: s[0][0], enemy: enemy ? s[1][0] : null, gap: enemy ? s[0][1] - s[1][1] : 9});
		}
		const trim = new Map();   /* per side: a factor below 1 where a zone had to be trimmed */
		const contested = q => q.enemy && q.gap < (DEPTHS.get(sideKey(q.top, q.enemy)) || 0);
		const measure = () => { const held = {}, cont = {}, zone = {}; ids.forEach(i => { held[i] = 0; cont[i] = 0 }); for (const q of pts) { if (contested(q)) { cont[q.top] += q.w; const k = warKey(q.top, q.enemy); zone[k] = (zone[k] || 0) + q.w } else held[q.top] += q.w } return {held, cont, zone} };
		/* one power's depth: bisection for a quarter of its systems */
		const solve = P => {
			const mine = pts.filter(q => q.top == P), total = mine.reduce((t, q) => t + q.w, 0), es = majors().find(m => m.id == P).enemies;
			const share = d => { let c = 0; for (const q of mine) if (q.enemy && q.gap < d * (trim.get(sideKey(P, q.enemy)) || 1)) c += q.w; return c / total };
			let a = 0, b = 2; for (let it = 0; it < 40; it++) { const m = (a + b) / 2; if (share(m) < CONTESTED_SHARE) a = m; else b = m }
			es.forEach(e => DEPTHS.set(sideKey(P, e), b * (trim.get(sideKey(P, e)) || 1)));
		};
		ids.forEach(solve);
		for (let round = 0; round < 12; round++) {
			const {held, zone} = measure(); let changed = false;
			for (const [k, z] of Object.entries(zone)) {
				const [a, b] = k.split(':'), cap = Math.min(held[a], held[b]); if (z <= cap) continue;
				/* trim the side that holds more of this zone */
				let za = 0, zb = 0; for (const q of pts) if (contested(q) && warKey(q.top, q.enemy) == k) { if (q.top == a) za += q.w; else zb += q.w }
				const big = za >= zb ? a : b, other = big == a ? b : a, f = Math.max(0.05, (cap - (big == a ? zb : za)) / Math.max(1, big == a ? za : zb)) * 0.97;
				trim.set(sideKey(big, other), (trim.get(sideKey(big, other)) || 1) * f); solve(big); changed = true;
			}
			if (!changed) break;
		}
		const {held, cont, zone} = measure();
		report.push({cluster: cl.id, held, cont, zone});
	}
	DEPTHS.report = report;
	return DEPTHS;
}
function claimAt(p) {
	let a = null; for (const m of majors()) { const v = strength(m, p); if (v > 0 && (!a || v > a[1])) a = [m, v] }
	if (!a) return {owner: null, contested: null};
	/* the strongest rival in the same cluster, its pull counted even beyond its reach */
	let b = null; for (const m of rivalsIn(a[0].cluster)) if (m != a[0]) { const v = pull(m, p); if (!b || v > b[1]) b = [m, v] }
	if (b && relation(a[0].id, b[0].id) < 0) {
		calibrate();
		const D = depthOf(a[0].id, b[0].id), g = a[1] - b[1];
		if (g < D) {
			/* depth across the zone: 0 at the edge on the first power's side (by id), 1 at the other's */
			const x = a[0].id < b[0].id ? a[0].id : b[0].id, y = x == a[0].id ? b[0].id : a[0].id, half = 0.5 * g / D;
			return {owner: null, contested: [x, y], side: a[0].id, depth: a[0].id == x ? 0.5 - half : 0.5 + half, strength: a[1]};
		}
	}
	return {owner: a[0].id, contested: null, strength: a[1], neighbour: b && b[1] > 0 ? b[0].id : null};
}

/* ---------- wars: front lines ---------- */
/* A war is fought over the star systems in the contested zone between two enemies. The systems are linked to their
   near neighbours; those at the edges touch each side's own space (its rear).
   - Claims chain from the rear: a side can take a system only from one it holds next to it, or from its rear.
   - Supply: a held system is supplied if a chain of systems held by the same side runs back to its rear.
     Isolated (cut-off) systems defend at a third of their strength and wear away each season.
   - Depth: pushing past the middle of the zone towards the enemy's rear gets harder and harder (a multiplier that
     falls to almost nothing at the far edge), so no side loses all of its contested space.
   - The front moves every season (30 game days): one side's offensive or a truce, supplied systems dig in, cut-off
     ones wear away; and players' war effort, on the day they made it. */
let WARS = null;
const warKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
const WAR = {systems: 24, links: 3, rear: 0.2, start: 0.6, dig: 0.08, digMax: 0.7, attrition: 0.18, cutOff: 0.33, depthPow: 3, effortScale: 100};
function frontSystems(a, b, want) {
	/* points drawn across the space the two claim, kept where it is their contested zone; at each, the nearest
	   worthwhile system (a star with planets) that is itself in that zone */
	const r = rng(hashStr('front:' + warKey(a.id, b.id))), out = [], seen = new Set();
	const lo = [0, 1, 2].map(i => Math.min(a.at[i] - a.claim, b.at[i] - b.claim)), hi = [0, 1, 2].map(i => Math.max(a.at[i] + a.claim, b.at[i] + b.claim));
	for (let k = 0; k < want * 600 && out.length < want; k++) {
		const p = lo.map((v, i) => v + r() * (hi[i] - v)), c0 = claimAt(p);
		if (!c0.contested || !c0.contested.includes(a.id) || !c0.contested.includes(b.id)) continue;
		const s = G.starsNear(p[0], p[1], p[2], nearR(p)).find(s => s.kind == 'star' && s.M > 0.25 && !seen.has(s.id) && G.system(s).planets.length);
		if (!s) continue;
		const cl = claimAt(pos(s));
		if (!cl.contested || !cl.contested.includes(a.id) || !cl.contested.includes(b.id)) continue;
		seen.add(s.id);
		out.push({id: s.id, name: s.name, at: pos(s), star: s, depth: cl.depth});
	}
	/* depth by rank across the zone (0: side a's rear, 1: side b's), so each side has systems against its rear */
	out.slice().sort((x, y) => x.depth - y.depth).forEach((s, k, arr) => s.depth = k / (arr.length - 1));
	/* links: each system to its nearest few in the zone */
	out.forEach((s, i) => { s.links = out.map((o, j) => [j, dist(s.at, o.at)]).filter(([j]) => j != i).sort((x, y) => x[1] - y[1]).slice(0, WAR.links).map(x => x[0]) });
	out.forEach((s, i) => s.links.forEach(j => { if (!out[j].links.includes(i)) out[j].links.push(i) }));
	return out;
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l) }
function wars() {
	if (WARS) return WARS;
	relations();
	WARS = [];
	const M = majors();
	for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) if (relation(M[i].id, M[j].id) < 0) {
		const [a, b] = M[i].id < M[j].id ? [M[i], M[j]] : [M[j], M[i]];
		WARS.push({id: warKey(a.id, b.id), a: a.id, b: b.id, systems: frontSystems(a, b, WAR.systems)});
	}
	return WARS;
}
/* side a's rear is depth 0, side b's depth 1 */
const atRear = (s, side) => side > 0 ? s.depth < WAR.rear : s.depth > 1 - WAR.rear;
/* how hard it is for a side to push into a system: 1 up to the middle, falling to almost nothing at the far rear */
function depthMult(s, side) { const into = side > 0 ? s.depth : 1 - s.depth, q = Math.max(0, (into - 0.5) / 0.5); return Math.pow(1 - Math.min(0.98, q), WAR.depthPow) }
/* which systems each side's supply reaches: chains of its own systems back to its rear */
function supplied(sys, c, side) {
	const ok = new Array(sys.length).fill(false), q = [];
	sys.forEach((s, i) => { if (c[i] * side > 0 && atRear(s, side)) { ok[i] = true; q.push(i) } });
	while (q.length) { const i = q.pop(); for (const j of sys[i].links) if (!ok[j] && c[j] * side > 0) { ok[j] = true; q.push(j) } }
	return ok;
}
/* can a side reach a system to claim it: from its rear, or from a supplied system it holds next door */
function reach(sys, c, sup, side, i) { return atRear(sys[i], side) || sys[i].links.some(j => c[j] * side > 0 && sup[j]) }
/* push a system's control towards a side, if that side can reach it; a side can't take what it can't reach */
function push(sys, c, sup, side, i, amount) {
	if (c[i] * side >= 0) { c[i] = Math.max(-1, Math.min(1, c[i] + side * amount)); return }   /* its own: reinforce */
	const can = reach(sys, c, sup, side, i), next = c[i] + side * amount * depthMult(sys[i], side);
	c[i] = Math.max(-1, Math.min(1, can ? next : side > 0 ? Math.min(next, -0.01) : Math.max(next, 0.01)));
}
/* one season */
function stepSeason(war, a, b, c, k, events) {
	const sys = war.systems, r = rng(hashStr('season:' + war.id + ':' + k)), truce = r() < 0.1;
	const supA = supplied(sys, c, 1), supB = supplied(sys, c, -1);
	/* supplied systems dig in; cut-off ones wear away */
	for (let i = 0; i < sys.length; i++) {
		const side = Math.sign(c[i]); if (!side) continue;
		const sup = side > 0 ? supA[i] : supB[i];
		c[i] = sup ? (Math.abs(c[i]) < WAR.digMax ? side * Math.min(WAR.digMax, Math.abs(c[i]) + WAR.dig) : c[i]) : c[i] - side * WAR.attrition;
	}
	if (!truce) {
		const edge = Math.log(a.military / b.military), side = r() < 1 / (1 + Math.exp(-edge * 2)) ? 1 : -1;
		const sA = supplied(sys, c, 1), sB = supplied(sys, c, -1), mine = side > 0 ? sA : sB;
		/* the offensive goes for enemy systems it can reach, cut-off ones first */
		const targets = sys.map((s, i) => i).filter(i => c[i] * side <= 0 && reach(sys, c, mine, side, i));
		const enemySup = side > 0 ? sB : sA;
		targets.sort((x, y) => (enemySup[x] ? 1 : 0) - (enemySup[y] ? 1 : 0) || r() - 0.5);
		const n = 1 + Math.floor(r() * 3);
		for (let q = 0; q < n && q < targets.length; q++) { const i = targets[q]; push(sys, c, mine, side, i, (0.35 + 0.3 * r()) * (enemySup[i] ? 1 : 1 / WAR.cutOff)) }
	}
	/* the players' effort this season, in the order it was made */
	for (const e of events) {
		const i = sys.findIndex(s => s.id == e.system); if (i < 0) continue;
		const side = e.side == war.a ? 1 : -1, sup = supplied(sys, c, side), def = supplied(sys, c, -side);
		push(sys, c, sup, side, i, e.effort / WAR.effortScale * (c[i] * side < 0 && !def[i] ? 1 / WAR.cutOff : 1));
	}
	return truce;
}
/* the war on a game day. events: players' war effort, [{war, system, side, effort, day}] */
const WAR_CACHE = new Map();
function warState(war, day, events) {
	const a = byId(war.a), b = byId(war.b), S = seasonOf(day), sys = war.systems;
	const evs = (events || []).filter(e => e.war == war.id && e.day <= day);
	const first = evs.length ? Math.min(...evs.map(e => seasonOf(e.day))) : Infinity;
	/* the war without players is cached season by season; players' effort replays from their first season */
	let cache = WAR_CACHE.get(war.id);
	if (!cache) { cache = [{c: sys.map(s => s.depth < 0.5 ? WAR.start : -WAR.start), truce: false}]; WAR_CACHE.set(war.id, cache) }
	const upto = Math.min(S, first);
	while (cache.length <= upto) { const c = cache[cache.length - 1].c.slice(), k = cache.length; const truce = stepSeason(war, a, b, c, k, []); cache.push({c, truce}) }
	let c = cache[Math.min(S, Math.max(0, first - 1))].c.slice(), truce = cache[Math.min(S, cache.length - 1)].truce;
	for (let k = first; k <= S; k++) truce = stepSeason(war, a, b, c, k, evs.filter(e => seasonOf(e.day) == k));
	const supA = supplied(sys, c, 1), supB = supplied(sys, c, -1);
	const out = {war, day, season: S, truce, systems: sys.map((s, i) => ({id: s.id, name: s.name, depth: s.depth, control: c[i], holder: c[i] > 0 ? war.a : c[i] < 0 ? war.b : null,
		fighting: Math.abs(c[i]) < 0.3, supplied: c[i] > 0 ? supA[i] : c[i] < 0 ? supB[i] : false, links: s.links}))};
	out.score = c.reduce((t, v) => t + v, 0) / c.length;   /* + : side a is winning */
	out.held = {[war.a]: c.filter(v => v > 0).length, [war.b]: c.filter(v => v < 0).length};
	return out;
}

/* who holds a contested system (any point in a zone) today: the side holding the nearest of the front's key systems */
function contestedHolder(p, day, events) {
	const c = claimAt(p); if (!c.contested) return {holder: c.owner, contested: false};
	const w = wars().find(x => x.a == c.contested[0] && x.b == c.contested[1]) || wars().find(x => x.a == c.contested[1] && x.b == c.contested[0]);
	if (!w || !w.systems.length) return {holder: null, contested: true};
	let best = 0, bd = Infinity; w.systems.forEach((s, i) => { const d = dist(s.at, p); if (d < bd) { bd = d; best = i } });
	const st = warState(w, day, events).systems[best];
	return {holder: st.holder, contested: true, war: w.id, key: w.systems[best].id, fighting: st.fighting, supplied: st.supplied};
}

/* ---------- missions about the wars ---------- */
const MISSION = {
	supply: {effort: 6, pay: 1.0, attack: false, text: 'Carry supplies to the front at'},
	escort: {effort: 9, pay: 1.4, attack: false, text: 'Escort a convoy to'},
	defend: {effort: 12, pay: 1.8, attack: false, text: 'Hold the line at'},
	recon: {effort: 5, pay: 0.9, attack: true, text: 'Scan enemy positions at'},
	blockade: {effort: 10, pay: 1.6, attack: true, text: 'Blockade the enemy at'},
	strike: {effort: 14, pay: 2.2, attack: true, text: 'Strike enemy ships at'},
	sabotage: {effort: 16, pay: 2.6, attack: true, text: 'Sabotage the enemy depot at'}};
/* the war missions a great power offers on a day: attacks on enemy systems it can reach (cut-off ones pay best),
   and the defence of its own systems that are threatened or cut off */
function warMissions(powerId, day, events) {
	const p = byId(powerId), out = [];
	for (const w of wars().filter(w => w.a == powerId || w.b == powerId)) {
		const st = warState(w, day, events), enemy = w.a == powerId ? w.b : w.a, side = w.a == powerId ? 1 : -1;
		if (st.truce) continue;
		const sys = w.systems, c = st.systems.map(s => s.control), sup = supplied(sys, c, side);
		const attack = st.systems.filter((s, i) => s.holder == enemy && reach(sys, c, sup, side, i));
		const defend = st.systems.filter(s => s.holder == powerId && (s.fighting || !s.supplied));
		const r = rng(hashStr('missions:' + powerId + ':' + w.id + ':' + day));
		const kinds = Object.entries(MISSION);
		for (let k = 0, n = 2 + Math.floor(r() * 3); k < n; k++) {
			const atk = attack.length && (!defend.length || r() < 0.6), pool = atk ? attack : defend; if (!pool.length) continue;
			const t = pool[Math.floor(r() * pool.length)], opts = kinds.filter(([, m]) => m.attack == !!atk), [type, M] = opts[Math.floor(r() * opts.length)];
			out.push({id: powerId + ':' + day + ':' + w.id + ':' + k, issuer: powerId, against: enemy, war: w.id, system: t.id, systemName: t.name, type,
				text: M.text + ' ' + t.name, effort: M.effort * (t.supplied || !atk ? 1 : 1.5), reward: Math.round(M.pay * (800 + 400 * r()) * (atk && !t.supplied ? 1.3 : 1)), currency: p.currency.code});
		}
	}
	return out;
}

/* ---------- smaller factions ---------- */
const MINOR_KINDS = {
	nomad: {n: 8, carrier: 'fleet carrier', pattern: 'nomadic', words: ['Wanderers', 'Drift', 'Caravan', 'Flotilla', 'Exodus', 'Migration']},
	criminal: {n: 16, carrier: 'dreadnought', pattern: 'rotating', words: ['Syndicate', 'Cartel', 'Reavers', 'Knives', 'Black Fleet', 'Brotherhood', 'Corsairs', 'Ring']},
	prospector: {n: 8, carrier: 'fleet carrier', pattern: 'semi-permanent', words: ['Guild', 'Combine', 'Claimholders', 'Diggers', 'Consortium']},
	freeport: {n: 12, carrier: null, pattern: 'fixed', words: ['Free Port', 'Haven', 'Exchange', 'Freehold', 'Crossing']}};
const SERVICES = {'fleet carrier': ['market', 'refinery', 'repairs', 'fuel', 'hangar', 'shipyard'], dreadnought: ['repairs', 'fuel', 'hangar', 'black market', 'armoury']};
let MINORS = null;
function minors() {
	if (MINORS) return MINORS;
	MINORS = [];
	const M = majors();
	const fronts = wars().flatMap(w => w.systems.map(s => s.at));
	for (const [kind, K] of Object.entries(MINOR_KINDS)) for (let i = 0; i < K.n; i++) {
		const id = kind + i, r = rng(hashStr('minor:' + id)), root = starName(hashStr('minorname:' + id));
		/* where it works: criminals near the fronts and in the Glow; prospectors in metal-rich inner space; nomads
		   anywhere in the Middle Reach and the Outer Clouds; free ports between the great powers */
		const site = () => {
			if (kind == 'criminal') return r() < 0.6 ? jitter(fronts[Math.floor(r() * fronts.length)], 25, r) : onShell(40 + r() * 400, r);
			if (kind == 'prospector') return onShell(150 + r() * 700, r);
			if (kind == 'nomad') return onShell(1000 + r() * 1900, r);
			/* two per cluster, between two of its powers */
			const cl = G.clusters()[i % G.clusters().length].id, CM = M.filter(m => m.cluster == cl), a = CM[Math.floor(r() * CM.length)], b = CM[Math.floor(r() * CM.length)];
			return jitter(a.at.map((v, k) => (v + b.at[k]) / 2), Math.min(a.claim, b.claim) * 0.3, r);
		};
		const nSites = K.pattern == 'fixed' ? 1 : K.pattern == 'nomadic' ? 5 + Math.floor(r() * 4) : 2 + Math.floor(r() * 4);
		const sites = [...Array(nSites)].map(() => { const p = site(); const s = G.starsNear(p[0], p[1], p[2], nearR(p))[0]; return s ? {id: s.id, name: s.name, at: pos(s)} : {id: 'deep:' + p.join(), name: 'deep space', at: p} });
		/* species: most small factions are offshoots of a great power's species; some mixed */
		const parent = r() < 0.75 ? M[Math.floor(r() * M.length)] : null;
		const stance = {};
		M.forEach(m => {
			stance[m.id] = kind == 'criminal' ? -1 : kind == 'freeport' ? 0 : kind == 'prospector' ? (r() < 0.4 ? 1 : 0) : (m == parent ? 1 : 0);
		});
		/* some criminals are privateers: a great power quietly backs them against its enemies */
		let sponsor = null;
		if (kind == 'criminal' && r() < 0.5) { sponsor = M[Math.floor(r() * M.length)]; stance[sponsor.id] = 1; sponsor.enemies && sponsor.enemies.forEach(e => stance[e] = -1) }
		const carrier = K.carrier && (kind != 'nomad' || r() < 0.9) ? {class: K.carrier, name: (kind == 'criminal' ? 'Dread ' : '') + starName(hashStr('ship:' + id)), length: Math.round((K.carrier == 'dreadnought' ? 2200 : 1600) * (0.7 + 0.6 * r())), hangar: 12 + Math.floor(r() * 36), services: SERVICES[K.carrier], selfSufficient: true, crew: Math.round(2000 + r() * 18000)} : null;
		MINORS.push({id, kind: 'minor', type: kind, name: (kind == 'freeport' ? '' : 'The ') + root + ' ' + K.words[i % K.words.length], species: parent ? parent.species.name : 'mixed', parent: parent && parent.id, sponsor: sponsor && sponsor.id,
			pattern: K.pattern, sites, stay: K.pattern == 'semi-permanent' ? 3 + Math.floor(r() * 4) : 1, phase: Math.floor(r() * 12), stance, carrier,
			currency: kind == 'freeport' || kind == 'prospector' ? null : kind == 'nomad' ? {code: 'FUEL', name: 'fuel scrip (backed by fuel)'} : {code: 'ANY', name: 'any currency, at a cut'}});
	}
	return MINORS;
}
/* a search radius that finds a few stars wherever we are (twice the typical distance between neighbours) */
function nearR(p) { return Math.min(4, Math.max(0.05, 2 * Math.pow(G.numberDensity(p[0], p[1], p[2]) + 1e-6, -1 / 3))) }
function onShell(m, r) { const ct = 2 * r() - 1, st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * r(); return [m * st * Math.cos(ph) * G.GAL.axes[0], m * st * Math.sin(ph) * G.GAL.axes[1], m * ct * G.GAL.axes[2]] }
function jitter(p, d, r) { return p.map(v => v + (r() * 2 - 1) * d) }
/* where a small faction is on a game day: fixed; semi-permanent (several seasons per site); rotating (a new site
   each season); nomadic (a few days' journey between sites, then a stay) */
function whereIs(m, day) {
	const S = seasonOf(day) + m.phase, K = m.sites.length;
	if (m.pattern == 'fixed') return {site: m.sites[0], moving: false};
	if (m.pattern == 'semi-permanent') return {site: m.sites[Math.floor(S / m.stay) % K], moving: false, until: (Math.floor(S / m.stay) + 1) * m.stay * SEASON_DAYS - m.phase * SEASON_DAYS};
	if (m.pattern == 'rotating') return {site: m.sites[S % K], moving: false};
	/* nomads: the first 6 days of each season on the move from the last site to the next */
	const into = day - seasonOf(day) * SEASON_DAYS, from = m.sites[(S - 1 + K) % K], to = m.sites[S % K];
	if (into < 6) { const f = into / 6; return {site: null, moving: true, from, to, at: from.at.map((v, i) => v + (to.at[i] - v) * f)} }
	return {site: to, moving: false};
}

const EmberFactions = {pull, WAR, BAND, CONTESTED_SHARE, bandOf, depthOf, calibrate, contestedHolder, supplied, depthMult, border: (a, b) => border(byId(a), byId(b)), SEASON_DAYS, seasonOf, majors, minors, byId, relations, relation, strength, claimAt, wars, warState, warMissions, whereIs, MISSION};
if (typeof module != 'undefined') module.exports = EmberFactions; else root.EmberFactions = EmberFactions;
})(typeof window != 'undefined' ? window : this);
