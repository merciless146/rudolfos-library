/* ===== Ember Reach: sites on the ground (L4.1; docs/plan-ember-reach-sites.md) =====
   What stands on a world's ground that isn't a port: the ruins of earlier peoples, the Precursors' sites in the Rift,
   and wrecks. This is the model alone (L4.1): which systems have which sites, where on which world, how each is laid
   out, the rules a layout keeps, and its parts and meshes in the stations' vocabulary. Nothing in flight yet: L4.2 on
   draws them and lets a pilot land and survey.
   - Ruin fields: on the ruin world (galaxy.js `ruins`), when it can be landed on. 0.6-2 km across: one or two
     plazas to land on, a vault, 3 to 6 structures, 2 or 3 old warden towers.
   - Outlying ruins (the owner, 2026-11-25): where the ruin world can't be landed on, a smaller site of the same
     builders on another body of the system: on a moon whenever there's one that can be landed on (a gas giant's
     most often), else a planet, usually the one farthest from the star. A waystation or relay (masts, dishes, a hall), 0.3-0.8 km across, one plaza, a
     small vault, one warden. Never in the Rift.
   - Precursor sites: on the Rift's Precursor ruin worlds that can be landed on. 1-3 km across, in the Precursors'
     own forms (shards, lattice arches, anchor rings, stepped wells), whole and unweathered, off-black with violet
     seams; a sealed vault and 2 to 4 guardian pylons.
   - Old hulks: long-dead ships half sunk in the ground, by chance in a system with landable ground (3% in claimed
     space, 6% on a front, 4% unclaimed, 8% near a long lane; 2% in the Rift, Riftborn hulls and one in five an old
     Precursor craft). One, or two one time in five.
   - Fresh wrecks: the galaxy's own losses, drawn anew each season in systems with a port (8% claimed, 15% on a
     front, 10% unclaimed with a lone port), on a day within the season.
   - Peoples (the owner, 2026-11-25): ruins are grouped into the peoples who built them, by a 30 pc cell, each with
     a generated name and a style of its own (terraces, spires, shells, rings or a grid), so a people's sites look
     alike.
   Every site is on a body that can be landed on, keeps to its world's 3% share as ports do, and stands clear of
   every port's site. Every draw has its own seed (site:, outlier:, hulk:, crash:, people:): no star, world, ruin or
   port moves. Local metres: z up, the ground at z = 0, the site's centre at the origin.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy'), Me = req('meshes.js', 'EmberMeshes'), L = req('landing.js', 'EmberLanding'), Sf = req('surface.js', 'EmberSurface'), Sh = req('ships.js', 'EmberShips');

const SITES = {
	field: {r: [300, 1000], structs: [3, 6], plazas: [1, 2], plazaR: [30, 75], wardens: [2, 3], vault: 10},
	outlier: {r: [150, 400], structs: [2, 3], plazas: [1, 1], plazaR: [25, 50], wardens: [1, 1], vault: 7},
	precursor: {r: [500, 1500], structs: [4, 7], plazas: [1, 2], plazaR: [40, 90], wardens: [2, 4], vault: 16},
	hulk: {claimed: 0.03, contested: 0.06, unclaimed: 0.04, lane: 0.08, rift: 0.02, riftPre: 0.2, two: 0.2},
	wreck: {claimed: 0.08, contested: 0.15, unclaimed: 0.1, pod: 0.3},
	/* an outlier's body: a gas giant's moon most often, then the ruin world's own moons and other moons; with no moon, a
	   planet, the farthest from the star six times as likely as any other */
	outlierWeight: {giantMoon: 8, ruinMoon: 5, moon: 3, farthest: 6, planet: 1},
	loose: 0.25, polar: 70, share: 0.03, people: 30, margin: 8, seasonDays: 30};
const CONE = Sf.CONE;
/* the structures: footprint radius and height (m), as ranges */
const STRUCT = {
	monolith: {r: [6, 14], h: [25, 70]}, arch: {r: [18, 35], h: [18, 40]}, ringwall: {r: [25, 60], h: [4, 12]}, mound: {r: [25, 55], h: [12, 35]},
	shell: {r: [20, 45], h: [14, 32]}, pillars: {r: [25, 50], h: [5, 14]}, spire: {r: [8, 18], h: [50, 140]}, walls: {r: [35, 70], h: [3, 8]},
	/* an outlier's: a waystation or relay */
	mast: {r: [5, 10], h: [40, 110]}, dish: {r: [14, 30], h: [10, 22]}, hall: {r: [14, 28], h: [6, 12]},
	/* the Precursors' */
	shard: {r: [6, 14], h: [30, 90]}, lattice: {r: [16, 34], h: [20, 45]}, anchor: {r: [20, 60], h: [40, 120]}, well: {r: [18, 40], h: [0, 0]},
	/* guardians */
	warden: {r: [5, 7], h: [16, 24]}, pylon: {r: [5, 8], h: [30, 50]}};
const STYLES = {terraces: {mound: 3, ringwall: 1, monolith: 1, pillars: 1, walls: 1}, spires: {spire: 4, monolith: 1, pillars: 1}, shells: {shell: 4, arch: 1, pillars: 1},
	rings: {arch: 3, ringwall: 2, monolith: 1}, grid: {walls: 3, mound: 1, pillars: 1}};
const RELAY = {mast: 3, dish: 2, hall: 2};
const PRECURSOR = {shard: 3, lattice: 2, anchor: 1, well: 1};
/* the peoples' stone, before age darkens it */
const STONE = [[0.62, 0.55, 0.44], [0.55, 0.56, 0.58], [0.58, 0.44, 0.36], [0.7, 0.67, 0.6], [0.42, 0.46, 0.5]];
const PRE = {body: [0.07, 0.06, 0.09, 0], seam: [0.62, 0.36, 1.0, 1], well: [0.5, 0.3, 0.95, 1]};

const worldR = p => p.R * 6.371e6 * (G.WORLD_SCALE || 1);
const pick = (r, w) => { const e = Object.entries(w), t = e.reduce((a, [, v]) => a + v, 0); let x = r() * t; for (const [k, v] of e) if ((x -= v) < 0) return k; return e[e.length - 1][0] };
const span = (r, [a, b]) => a + (b - a) * r();
const ispan = (r, [a, b]) => a + Math.floor(r() * (b - a + 1));
const dirOf = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)] };
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/* ---------- the peoples ----------
   Every ruin within a 30 pc cell is one people's: its name and style from the cell's seed. */
function peopleOf(star) {
	const c = SITES.people, k = [Math.floor(star.x / c), Math.floor(star.y / c), Math.floor(star.z / c)], id = 'people:' + (star.rift ? 'R:' : '') + k.join(':'), h = G.hashStr(id), r = G.rng(h);
	const style = Object.keys(STYLES)[Math.floor(r() * 5)], stone = STONE[Math.floor(r() * STONE.length)];
	return {id, name: G.starName(h ^ 0x5bd1e995), style, stone};
}

/* ---------- which sites a system has ----------
   ctx: {space: 'claimed' | 'contested' | 'unclaimed', lane (within 10 pc of a long lane), port (the system has a
   port in space, or a lone surface port), holder (its holder's faction id), ports (surface ports to keep clear of:
   by default every one the system could have, whatever its station's class)}. season: the
   calendar's (factions.js seasonOf: 30 days). */
function sitesAt(star, season, ctx) {
	ctx = ctx || {};
	if (star.heart) return [];
	const sy = G.system(star), bodies = sy.planets.flatMap(p => [p, ...(p.moons || [])]), land = bodies.filter(p => L.landable(p).ok), out = [];
	if (!land.length) return out;
	const ports = ctx.ports || allPorts(star), taken = ports.map(q => ({world: q.world, dir: dirOf(q.lat, q.lon), r: (Sf.KIND[q.kind] || {radius: 300}).radius}));
	/* a place on a world, clear of its ports' and other sites' (within the poles; anywhere on a locked world: the
	   old builders didn't need the terminator) */
	const place = (p, radius, r) => {
		const R = worldR(p);
		for (let t = 0; t < 40; t++) {
			const lat = (r() * 2 - 1) * SITES.polar, lon = r() * 360 - 180, d = dirOf(lat, lon);
			if (taken.every(o => o.world != p.name || angle(o.dir, d) * R > (o.r + radius) * 1.5)) { taken.push({world: p.name, dir: d, r: radius}); return {lat, lon, dir: d} }
		}
		return null;
	};
	/* a site's radius, kept to its world's share (none if the world is too small for half the least) */
	const sized = (p, range, r) => { const want = span(r, range), cap = SITES.share * worldR(p); return want <= cap ? want : cap >= range[0] * 0.5 ? cap : 0 };
	const base = p => ({world: p.name, moon: !!p.moon, parent: p.parent || null, giantMoon: !!(p.moon && (sy.planets.find(q => q.name == p.parent) || {}).gas), g: p.g, Ts: p.Ts});
	/* ruins */
	const ruin = sy.planets.find(p => p.ruins);
	if (ruin) {
		const pe = star.rift ? null : peopleOf(star);
		if (L.landable(ruin).ok) {
			const kind = ruin.precursor ? 'precursor' : 'field', r = G.rng(G.hashStr('site:' + star.id + ':' + ruin.name)), radius = sized(ruin, SITES[kind].r, r), at = radius && place(ruin, radius, r);
			if (at) out.push(Object.assign({id: 'site:' + ruin.name + ':' + kind, kind}, base(ruin), at, {radius, seed: G.hashStr('site:' + star.id + ':' + ruin.name + ':' + kind), age: ruin.precursor ? 0 : 1 + 8 * r(), people: pe && pe.id, peopleName: pe && pe.name, style: ruin.precursor ? 'precursor' : pe.style, stone: pe ? pe.stone : null}));
		} else if (!ruin.precursor) {
			/* an outlier: a waystation or relay of the same builders, on another body */
			const r = G.rng(G.hashStr('outlier:' + star.id)), others = land.filter(p => p != ruin), moons = others.filter(p => p.moon), cand = moons.length ? moons : others;   /* (on a moon whenever there is one) */
			if (cand.length) {
				/* (no moon: usually the planet farthest from the star, the owner, 2026-11-25) */
				const far = cand.reduce((a, p) => !p.moon && (!a || p.a > a.a) ? p : a, null), W = SITES.outlierWeight, w = p => !p.moon ? (p == far ? W.farthest : W.planet) : p.parent == ruin.name ? W.ruinMoon : (sy.planets.find(q => q.name == p.parent) || {}).gas ? W.giantMoon : W.moon;
				const tot = cand.reduce((a, p) => a + w(p), 0); let x = r() * tot, p = cand[cand.length - 1];
				for (const c of cand) if ((x -= w(c)) < 0) { p = c; break }
				const radius = sized(p, SITES.outlier.r, r), at = radius && place(p, radius, r);
				if (at) out.push(Object.assign({id: 'site:' + p.name + ':outlier', kind: 'outlier'}, base(p), at, {radius, seed: G.hashStr('outlier:' + star.id + ':' + p.name), age: 1 + 8 * r(), people: pe.id, peopleName: pe.name, style: 'relay', stone: pe.stone, of: ruin.name}));
			}
		}
	}
	/* old hulks: from before day 0 */
	{
		const H = SITES.hulk, r = G.rng(G.hashStr('hulk:' + star.id)), chance = star.rift ? H.rift : ctx.lane ? H.lane : H[ctx.space] || H.unclaimed;
		if (r() < chance) {
			const n = r() < H.two ? 2 : 1;
			for (let i = 0; i < n; i++) {
				const p = land[Math.floor(r() * land.length)], ship = hullFor(r, star.rift ? (r() < H.riftPre ? 'precursor' : 'riftborn') : ctx.lane ? 'lane' : ctx.space || 'unclaimed', 'L');
				const radius = Math.min(SITES.share * worldR(p), ship.length * 7.2 + 60), at = radius >= ship.length * 2.6 && place(p, radius, r);   /* (no wreck on a world too small for its hull and scar) */
				if (at) out.push(Object.assign({id: 'hulk:' + p.name + ':' + i, kind: 'hulk'}, base(p), at, {radius, seed: G.hashStr('hulk:' + star.id + ':' + i), ship: ship.id, length: ship.length, size: ship.size, riftborn: !!(star.rift && !ship.precursor), precursor: !!ship.precursor, age: 1 + 9 * r()}));
			}
		}
	}
	/* a fresh wreck: this season's, in a system with a port */
	if (ctx.port && !star.rift && season != null) {
		const C = SITES.wreck, r = G.rng(G.hashStr('crash:' + star.id + ':' + season));
		if (r() < (C[ctx.space] || C.unclaimed)) {
			const p = land[Math.floor(r() * land.length)], ship = hullFor(r, 'wreck', 'L'), radius = Math.min(SITES.share * worldR(p), ship.length * 7.2 + 60), at = radius >= ship.length * 2.6 && place(p, radius, r);   /* (no wreck on a world too small for its hull and scar) */
			const day = season * SITES.seasonDays + Math.floor(r() * SITES.seasonDays);
			if (at) out.push(Object.assign({id: 'wreck:' + p.name + ':' + season, kind: 'wreck'}, base(p), at, {radius, seed: G.hashStr('crash:' + star.id + ':' + season + ':site'), ship: ship.id, length: ship.length, size: ship.size, day, season,
				faction: ship.who.includes('pirate') ? 'pirate' : ctx.holder || null, pod: r() < C.pod, recorder: true}));
		}
	}
	return out;
}
/* every surface port the system could have, whatever its station's class (it changes with its holder), and its lone
   ones: sites keep clear of all of them, so a site never moves when a holder changes */
function allPorts(star) {
	const seen = new Map();
	for (const c of [null, ...Object.keys(Sf.PLACE)]) for (const q of Sf.ports(star, c)) seen.set(q.id + '|' + q.world + '|' + q.lat + '|' + q.lon, q);
	return [...seen.values()];
}
/* a wreck's hull, from the stock ships by who flies where, up to a size */
const POOL = {contested: ['navy'], lane: ['trader', 'courier', 'passenger', 'nomad'], claimed: ['trader', 'courier', 'navy', 'miner'], unclaimed: ['explorer', 'prospector', 'pirate', 'nomad', 'miner'],
	riftborn: ['navy', 'pirate'], wreck: ['trader', 'courier', 'miner', 'prospector', 'navy', 'pirate']};
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'C'];
function hullFor(r, where, max) {
	const ok = s => SIZES.indexOf(s.size) <= SIZES.indexOf(max);
	if (where == 'precursor') { const ps = Sh.precursors().filter(ok); return ps[Math.floor(r() * ps.length)] }
	const pool = POOL[where] || POOL.unclaimed, list = Sh.ships().filter(s => ok(s) && s.who.some(w => pool.includes(w)));
	return list[Math.floor(r() * list.length)];
}

/* ---------- the layout ----------
   Ruins: plazas first (levelled discs a pilot sets down on, each keeping the ports' 35° cone clear), the vault
   beside the largest, then the structures round the plazas and the guardians farther out, where they don't overlap
   or stand in a plaza's cone. The rest of the site is the ground it levels and keeps clear. Age takes structures down (fallen pillars and spires, broken arches). One structure in four stands
   over a hollow (loose ground: twice as often on icy worlds and on giants' moons, half as often on hot deserts).
   Wrecks: the hull, a scar behind it, debris along the scar, and its points of interest. */
function layout(site) {
	if (site.kind == 'hulk' || site.kind == 'wreck') return wreckLayout(site);
	const K = SITES[site.kind], r = G.rng(site.seed >>> 0), R = site.radius, plazas = [], structs = [], wardens = [];
	const fallenShare = site.kind == 'precursor' ? 0 : Math.max(0, (site.age - 1) / 8) * 0.6;
	/* plazas */
	const np = ispan(r, K.plazas);
	for (let i = 0; i < np; i++) for (let t = 0; t < 60; t++) {
		const pr = span(r, K.plazaR), d = i == 0 ? r() * 0.25 * R : span(r, [0.35, 0.7]) * R, a = r() * 2 * Math.PI, c = [d * Math.cos(a), d * Math.sin(a)];
		if (Math.hypot(...c) + pr > R * 0.85) continue;
		if (plazas.some(q => Math.hypot(q.c[0] - c[0], q.c[1] - c[1]) < q.r + pr + 60)) continue;
		plazas.push({n: i + 1, c, r: pr}); break;
	}
	if (!plazas.length) plazas.push({n: 1, c: [0, 0], r: K.plazaR[0]});
	/* the vault, beside the largest plaza */
	const big = plazas.reduce((a, b) => b.r > a.r ? b : a), va = r() * 2 * Math.PI, vr = K.vault;
	const vault = {c: [big.c[0] + Math.cos(va) * (big.r + vr + 6), big.c[1] + Math.sin(va) * (big.r + vr + 6)], r: vr, h: site.kind == 'precursor' ? 18 : 4, rot: va, plaza: big.n};
	/* the cone over every plaza, at a structure's height */
	const clear = (c, sr, sh) => Math.hypot(...c) + sr <= R && plazas.every(p => Math.hypot(p.c[0] - c[0], p.c[1] - c[1]) >= p.r + sr + sh * CONE) &&
		Math.hypot(vault.c[0] - c[0], vault.c[1] - c[1]) >= vault.r + sr + SITES.margin && [...structs, ...wardens].every(o => Math.hypot(o.c[0] - c[0], o.c[1] - c[1]) >= o.r + sr + SITES.margin);
	const mix = site.kind == 'precursor' ? PRECURSOR : site.kind == 'outlier' ? RELAY : STYLES[site.style] || STYLES.terraces;
	const icy = site.Ts < 150 || site.giantMoon, hot = site.Ts > 330, loose = SITES.loose * (icy ? 2 : hot ? 0.5 : 1);
	const ns = ispan(r, K.structs);
	for (let i = 0; i < ns; i++) {
		const type = pick(r, mix), S = STRUCT[type];
		let sr = span(r, S.r), sh = span(r, S.h), pitch = 0, roll = 0, fallen = false;
		if (type == 'monolith') pitch = (5 + 15 * r()) * Math.PI / 180;
		if (['spire', 'arch', 'monolith', 'mast'].includes(type) && r() < fallenShare) { fallen = true; if (type == 'spire' || type == 'monolith' || type == 'mast') { pitch = Math.PI / 2 - 0.05; sr = Math.max(sr, sh / 2 + sr); sh = Math.min(sh, 2 * S.r[1]) } }
		for (let t = 0; t < 80; t++) {
			/* round a plaza: just outside its cone, out to about a third of the site (farther after many tries) */
			const pz = plazas[Math.floor(r() * plazas.length)], d = pz.r + sr + sh * CONE + 4 + r() * R * (0.3 + t / 120), a = r() * 2 * Math.PI, c = [pz.c[0] + d * Math.cos(a), pz.c[1] + d * Math.sin(a)];
			if (!clear(c, sr, sh)) continue;
			const st = {n: structs.length + 1, type, c, r: sr, h: sh, rot: r() * Math.PI * 2, pitch, roll, fallen};
			if (r() < loose) st.loose = 20 + 25 * r();
			structs.push(st); break;
		}
	}
	/* guardians: warden towers at ruins, pylons at Precursor sites */
	const nw = ispan(r, K.wardens), wt = site.kind == 'precursor' ? 'pylon' : 'warden';
	for (let i = 0; i < nw; i++) for (let t = 0; t < 80; t++) {
		/* guarding the approach: out beyond the structures, toward the site's edge */
		const S = STRUCT[wt], sr = span(r, S.r), sh = span(r, S.h), d = span(r, [0.35, 0.8]) * (R - sr), a = r() * 2 * Math.PI, c = [d * Math.cos(a), d * Math.sin(a)];
		if (!clear(c, sr, sh)) continue;
		wardens.push({n: i + 1, type: wt, c, r: sr, h: sh, rot: r() * Math.PI * 2}); break;
	}
	const ageK = site.kind == 'precursor' ? 1 : 1 - 0.35 * Math.max(0, site.age - 1) / 8, stone = (site.stone || STONE[0]).map(v => v * ageK);
	return {kind: site.kind, id: site.id, radius: R, style: site.style, age: site.age, plazas, vault, structs, wardens, stone, fallenShare};
}
function wreckLayout(site) {
	const r = G.rng(site.seed >>> 0), Lh = site.length, heading = r() * Math.PI * 2, w = Lh * 0.36, scarLen = Math.min(Lh * span(r, [3, 6]), Math.max(Lh, site.radius - Lh * 0.6 - w * 1.7 - 4));   /* (a scar kept to its site on a small world) */
	const hull = {ship: site.ship, length: Lh, c: [0, 0], heading, pitch: (r() * 2 - 1) * 8 * Math.PI / 180, roll: (r() * 2 - 1) * 12 * Math.PI / 180, sink: Lh * 0.14 * 0.66};
	const back = [-Math.cos(heading), -Math.sin(heading)], side = [-back[1], back[0]], debris = [], pois = [];
	const nd = Math.round(6 + 24 * Math.min(1, Lh / 120) * r() + 4 * r());
	for (let i = 0; i < Math.min(30, nd); i++) {
		const along = Lh * 0.6 + r() * scarLen, off = (r() * 2 - 1) * w * 1.6, sz = Math.max(1, Lh * (0.03 + 0.07 * r()));
		debris.push({c: [back[0] * along + side[0] * off, back[1] * along + side[1] * off], h: [sz, sz * (0.3 + r()), sz * 0.25], rot: r() * Math.PI, pitch: (r() * 2 - 1) * 0.6, roll: (r() * 2 - 1) * 0.6});
	}
	pois.push({type: 'hulk', c: [0, 0]});
	if (site.recorder || site.kind == 'hulk') pois.push({type: 'recorder', c: [back[0] * Lh * 0.3, back[1] * Lh * 0.3]});
	if (site.pod) pois.push({type: 'pod', c: [side[0] * Lh * 1.5, side[1] * Lh * 1.5]});
	if (site.kind == 'wreck') pois.push({type: 'hold', c: [side[0] * -Lh, side[1] * -Lh]});
	return {kind: site.kind, id: site.id, radius: site.radius, hull, scar: {len: scarLen, w, back}, debris, pois};
}

/* ---------- the rules a layout keeps ---------- */
function check(Lo) {
	const bad = [];
	if (Lo.hull) {
		for (const d of Lo.debris) if (Math.hypot(...d.c) > Lo.radius + 1) bad.push('debris off the site');
		if (Lo.debris.length < 6 || Lo.debris.length > 30) bad.push('debris count ' + Lo.debris.length);
		return bad;
	}
	const all = [...Lo.structs, ...Lo.wardens];
	for (const p of Lo.plazas) { if (Math.hypot(...p.c) + p.r > Lo.radius + 1) bad.push('plaza ' + p.n + ' off the site'); for (const q of Lo.plazas) if (q != p && Math.hypot(q.c[0] - p.c[0], q.c[1] - p.c[1]) < q.r + p.r) bad.push('plazas overlap') }
	const big = Lo.plazas.find(p => p.n == Lo.vault.plaza);
	if (!big || Math.hypot(Lo.vault.c[0] - big.c[0], Lo.vault.c[1] - big.c[1]) > big.r + Lo.vault.r + 40) bad.push('the vault is not beside its plaza');
	for (const s of all) {
		if (Math.hypot(...s.c) + s.r > Lo.radius + 1) bad.push(s.type + ' off the site');
		for (const p of Lo.plazas) if (Math.hypot(p.c[0] - s.c[0], p.c[1] - s.c[1]) < p.r + s.r + s.h * CONE - 0.01) bad.push(s.type + ' in plaza ' + p.n + '\'s cone');
		if (Math.hypot(Lo.vault.c[0] - s.c[0], Lo.vault.c[1] - s.c[1]) < Lo.vault.r + s.r) bad.push(s.type + ' on the vault');
		for (const o of all) if (o != s && Math.hypot(o.c[0] - s.c[0], o.c[1] - s.c[1]) < o.r + s.r) bad.push(s.type + ' and ' + o.type + ' overlap');
	}
	return [...new Set(bad)];
}

/* ---------- the model ----------
   Parts in the stations' vocabulary (box, cyl, ell; z up, the ground at 0) and the sites' own: frustum, shard, dome,
   torus, any of them tilted (pitch, roll); then meshes from meshes.js's primitives. */
const C4 = (c, a) => [c[0], c[1], c[2], a || 0];
function structParts(s, stone, pre, r) {
	const P = [], col = C4(stone), dark = C4(stone.map(v => v * 0.7)), h = s.h, R = s.r;
	switch (s.type) {
	case 'monolith': P.push({shape: 'box', c: [0, 0, s.fallen ? R * 0.18 : h / 2], h: s.fallen ? [R * 0.36, R * 0.18, (h || R) / 2] : [R * 0.36, R, h / 2], col, pitch: s.fallen ? 0 : s.pitch, roll: s.fallen ? Math.PI / 2 : 0}); break;
	case 'arch': {
		const ph = h, pw = Math.max(2, R * 0.12);
		P.push({shape: 'box', c: [-R * 0.7, 0, ph / 2], h: [pw, pw, ph / 2], col});
		if (s.fallen) P.push({shape: 'box', c: [R * 0.5, R * 0.4, pw], h: [R * 0.8, pw, pw], col: dark});
		else P.push({shape: 'box', c: [R * 0.7, 0, ph / 2], h: [pw, pw, ph / 2], col}, {shape: 'box', c: [0, 0, ph + pw], h: [R * 0.85, pw * 1.1, pw], col});
		break;
	}
	case 'ringwall': { const k = 10; for (let i = 0; i < k; i++) { if (r() < 0.25) continue; const a = i / k * 2 * Math.PI, hh = h * (0.5 + 0.5 * r()); P.push({shape: 'box', c: [Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, hh / 2], h: [R * 0.12, R * 0.26, hh / 2], col, rot: a}) } break }
	case 'mound': { const k = 3 + Math.floor(r() * 2); for (let i = 0; i < k; i++) { const f = 1 - i / (k + 0.5), z0 = h * i / k; P.push({shape: 'box', c: [0, 0, z0 + h / k / 2], h: [R * f * 0.7, R * f * 0.7, h / k / 2], col: i % 2 ? dark : col}) } break }
	case 'shell': P.push({shape: 'shell', r: [R, R, h], col, missing: 0.34}, {shape: 'cyl', r: R + 1, z0: 0, z1: 1.5, col: dark}); break;
	case 'pillars': { const n = 8 + Math.floor(r() * 13), cols = Math.ceil(Math.sqrt(n)), step = R * 1.6 / cols; for (let i = 0; i < n; i++) { const x = (i % cols) * step - R * 0.8, y = Math.floor(i / cols) * step - R * 0.8, fl = r() < 0.3; P.push({shape: 'cyl', r: Math.max(0.8, step * 0.12), z0: 0, z1: fl ? 1.4 : h * (0.6 + 0.4 * r()), c: [x, y, 0], col: fl ? dark : col, thin: true}) } break }
	case 'spire': P.push(s.fallen ? {shape: 'frustum', r0: Math.max(3, STRUCT.spire.r[0]), r1: 0.6, z0: -R * 0.95, z1: R * 0.95, c: [0, 0, 3], col, pitch: Math.PI / 2} : {shape: 'frustum', r0: R, r1: R * 0.08, z0: 0, z1: h, col}); break;
	case 'walls': { const g = 3; for (let i = 0; i <= g; i++) for (const ax of [0, 1]) { if (r() < 0.3) continue; const t = (i / g - 0.5) * 2 * R * 0.8; P.push({shape: 'box', c: ax ? [t, 0, h / 2] : [0, t, h / 2], h: ax ? [0.8, R * 0.8, h / 2] : [R * 0.8, 0.8, h / 2], col}) } break }
	case 'mast': P.push(s.fallen ? {shape: 'box', c: [0, 0, 1.2], h: [1.2, R * 0.95, 1.2], col: dark} : {shape: 'frustum', r0: R * 0.5, r1: R * 0.15, z0: 0, z1: h, col}, {shape: 'ell', c: [0, 0, s.fallen ? 2 : h], r: [R * 0.6, R * 0.6, R * 0.2], col: dark}); break;
	case 'dish': P.push({shape: 'cyl', r: R * 0.15, z0: 0, z1: h * 0.6, col: dark}, {shape: 'shell', r: [R, R, R * 0.35], c: [0, 0, h * 0.55], col, missing: 0.1, pitch: -0.7}); break;
	case 'hall': P.push({shape: 'box', c: [0, 0, h / 2], h: [R * 0.9, R * 0.55, h / 2], col}, {shape: 'frustum', r0: R * 0.5, r1: R * 0.1, z0: h, z1: h * 1.5, col: dark}); break;
	case 'shard': P.push({shape: 'shard', r: R, h, col: pre.body, pitch: (r() * 2 - 1) * 0.15}, {shape: 'shard', r: R * 0.08, h: h * 0.9, col: pre.seam, pitch: 0}); break;
	case 'lattice': for (let i = 0; i < 4; i++) { const t = (i / 3 - 0.5) * R * 1.4; P.push({shape: 'box', c: [t, 0, h / 2], h: [0.9, 0.9, h / 2 + 2], col: pre.body, roll: (i % 2 ? 1 : -1) * 0.5}) } P.push({shape: 'box', c: [0, 0, h], h: [R * 0.8, 0.6, 0.6], col: pre.seam}); break;
	case 'anchor': P.push({shape: 'torus', R: R * 0.9, a: R * 0.08, b: R * 0.08, c: [0, 0, R * 0.95], col: pre.body, pitch: Math.PI / 2}, {shape: 'box', c: [0, 0, 1], h: [R * 0.3, R * 0.1, 1], col: pre.seam}); break;
	case 'well': for (let i = 0; i < 3; i++) { const f = 1 - i * 0.25; P.push({shape: 'box', c: [0, 0, -i * 3 - 1.5], h: [R * f, R * f, 1.5], col: i == 2 ? pre.well : pre.body}) } break;
	case 'warden': P.push({shape: 'frustum', r0: R, r1: R * 0.6, z0: 0, z1: h * 0.8, col: dark}, {shape: 'box', c: [R * 0.5, 0, h * 0.85], h: [R * 0.9, 0.7, 0.7], col}); break;
	case 'pylon': P.push({shape: 'frustum', r0: R * 1.2, r1: R, z0: 0, z1: h * 0.2, col: pre.body}, {shape: 'shard', r: R * 0.6, h: h * 0.8, z0: h * 0.2, col: pre.body}, {shape: 'box', c: [0, 0, h * 0.5], h: [0.4, 0.4, h * 0.3], col: pre.seam}); break;
	}
	return P;
}
function parts(Lo) {
	const out = [], r = G.rng(G.hashStr('parts:' + Lo.id)), place = (q, at, rot) => { const c = q.c || [0, 0, 0], k = Math.cos(rot), s = Math.sin(rot); return Object.assign({}, q, {c: [c[0] * k - c[1] * s + at[0], c[0] * s + c[1] * k + at[1], c[2]], rot: (q.rot || 0) + rot}) };
	if (Lo.hull) {
		const H = Lo.hull, sc = Lo.scar;
		out.push({shape: 'ship', length: H.length, c: [0, 0, -H.sink], rot: H.heading, pitch: H.pitch, roll: H.roll, ship: H.ship});
		out.push({shape: 'box', c: [sc.back[0] * sc.len / 2, sc.back[1] * sc.len / 2, 0.05], h: [sc.len / 2, sc.w / 2, 0.1], rot: Math.atan2(sc.back[1], sc.back[0]), col: [0.1, 0.09, 0.08, 0], scar: true});
		for (const d of Lo.debris) out.push({shape: 'box', c: [d.c[0], d.c[1], d.h[2]], h: d.h, rot: d.rot, pitch: d.pitch, roll: d.roll, col: Me.COL.hull.map((v, i) => i < 3 ? v * 0.55 : 0), debris: true});
		return out;
	}
	const pre = Lo.kind == 'precursor', V = Lo.vault;
	for (const p of Lo.plazas) out.push({shape: 'cyl', r: p.r, z0: -0.3, z1: 0.06, c: [p.c[0], p.c[1], 0], col: pre ? [0.12, 0.11, 0.14, 0] : C4(Lo.stone.map(v => v * 0.8)), plaza: p.n});
	if (pre) out.push(place({shape: 'box', c: [0, 0, V.h / 2], h: [V.r, V.r * 0.4, V.h / 2], col: PRE.body}, V.c, V.rot), place({shape: 'box', c: [0, -V.r * 0.41, V.h * 0.45], h: [V.r * 0.12, 0.2, V.h * 0.4], col: PRE.seam}, V.c, V.rot));
	else out.push(place({shape: 'box', c: [0, 0, 0.2], h: [V.r, V.r * 0.6, 0.4], col: [0.05, 0.05, 0.05, 0]}, V.c, V.rot), place({shape: 'box', c: [V.r * 1.1, 0, V.h / 2], h: [V.r * 0.15, V.r * 0.6, V.h / 2], col: C4(Lo.stone)}, V.c, V.rot), place({shape: 'box', c: [-V.r * 1.1, 0, V.h / 2], h: [V.r * 0.15, V.r * 0.6, V.h / 2], col: C4(Lo.stone)}, V.c, V.rot));
	for (const s of [...Lo.structs, ...Lo.wardens]) for (const q of structParts(s, Lo.stone, PRE, r)) out.push(Object.assign(place(q, s.c, s.rot), {struct: s.type, n: s.n}));
	return out;
}
/* the top half of an ellipsoid with a share of its segments gone (a broken shell dome; a dish) */
function shellMesh(rx, ry, rz, col, seg, missing) {
	const m = new Me.Mesh(), rows = Math.max(2, seg / 4), gone = Math.floor(seg * (missing || 0));
	const P = (i, j) => { const u = i / seg * 2 * Math.PI, v = j / rows * Math.PI / 2; return [rx * Math.cos(v) * Math.cos(u), ry * Math.cos(v) * Math.sin(u), rz * Math.sin(v)] };
	for (let i = gone; i < seg; i++) for (let j = 0; j < rows; j++) { const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1); m.tri(A, B, C, col).tri(A, C, D, col) }
	return m;
}
function meshes(Lo, detail) {
	const lo = detail == 'lo', m = new Me.Mesh();
	for (const q of parts(Lo)) { const x = partMesh(q, lo); if (x) m.add(x) }
	return m;
}
/* ---------- (L4.2) surveyed from the ground ----------
   A site is surveyed a structure at a time: hover within 80 m of one, or land within 150 m, for 8 s with a working
   cartographic sensor. The vault opens to a ship landed on its plaza for 20 s. What each gives is seeded from the
   site, so it's the same in every save: half the structures leave a tonne of Artefacts; the vault 4-8 t, and its
   own roll for a blueprint (a relay booster 40%, a phaser 20%). Site data: 4,000 SU, 800 a structure, 2,000 for the
   vault; an outlier half of all of it. The record keeps a bit for each structure surveyed (1 to 7) and one (8) for
   the vault. */
/* (L4.2b) the guardians: wardens at a ruin field (an outlier's one), old towers each with an old laser, turning 60°
   a second, waking when you're within 3 km and below 1.5 km. Shot down, they stay down for the season, and their
   remains are surveyed as a structure. Opening a vault calls a second wave of sentinels from orbit half the time,
   30-50 s later */
const WARDEN = {wake: 3000, below: 1500, keep: 6000, turn: Math.PI / 3, aim: 4 * Math.PI / 180, range: 3000, wave: 0.5, waveAfter: [30, 50],
	hull: {id: 'warden', name: 'Warden tower', size: 'S', role: 'sentinel', hull: 700, shield: 250, speed: 0, agility: 0, cargo: 0, jump: 0, hard: [1, 0, 0, 0], length: 8, value: 0, who: [], maker: 'warden', makerName: 'An old people'}};
/* does opening this vault call a second wave, and when (seconds after)? */
function vaultWave(site) { const r = G.rng(G.hashStr('wave:' + site.id + ':' + (site.seed >>> 0))); return r() < WARDEN.wave ? WARDEN.waveAfter[0] + r() * (WARDEN.waveAfter[1] - WARDEN.waveAfter[0]) : 0 }
const SURVEY = {hover: 80, land: 150, time: 8, vault: 20, data: {base: 4000, struct: 800, vault: 2000}, outlier: 0.5, rift: 2,
	cache: [4, 8], structTon: 0.5, bp: {phaser: 0.2, alien: 0.4}};
const VAULT_BIT = 1 << 7;
const FIND = ['worn carvings', 'an inscription', 'tool marks in the stone', 'a sealed niche, empty', 'a mosaic of an unknown sky', 'a broken mechanism', 'the bones of a frame, long stripped'];
/* what one structure gives when surveyed: {find (what you see), ton (a tonne of Artefacts)} */
function structYield(site, n) {
	const r = G.rng(G.hashStr('yield:' + site.id + ':' + n + ':' + (site.seed >>> 0)));
	return {find: FIND[Math.floor(r() * FIND.length)], ton: r() < SURVEY.structTon};
}
/* what the vault holds: {tons of Artefacts, a blueprint or null} */
function vaultCache(site) {
	const r = G.rng(G.hashStr('vault:' + site.id + ':' + (site.seed >>> 0))), k = site.kind == 'outlier' ? 0.5 : 1;
	const tons = Math.max(1, Math.round((SURVEY.cache[0] + r() * (SURVEY.cache[1] - SURVEY.cache[0])) * k)), b = r();
	const bp = b < SURVEY.bp.phaser ? {id: 'phaser', size: 3} : b < SURVEY.bp.alien ? {id: 'alien', size: 2 + Math.floor(r() * 3)} : null;
	return {tons, bp};
}
/* what a site's data is worth (SU, before a first discovery's ×2.5) for the bits surveyed */
function dataWorth(site, bits) {
	let n = 0; for (let i = 0; i < 7; i++) if (bits & (1 << i)) n++;
	for (let i = 16; i < 20; i++) if (bits & (1 << i)) n++;   /* (a warden's remains count as a structure) */
	const D = SURVEY.data, su = bits ? D.base + D.struct * n + (bits & VAULT_BIT ? D.vault : 0) : 0;
	return su * (site.kind == 'outlier' ? SURVEY.outlier : 1) * (site.rift ? SURVEY.rift : 1);
}
/* (L4.2b) a warden's remains, surveyed: bits 16 to 19 */
const BITS = {VAULT: VAULT_BIT, struct: n => 1 << (n - 1), warden: n => 1 << (15 + n)};
/* (L4.2) the site's model in pieces, each in its own frame (its centre on the ground at the origin): a plaza or the
   vault on the level ground of a flat, a structure or guardian on the ground as it lies at its foot. play.js stands
   each where its ground is. [{key, c (site metres), r, flat (stands on a flat), parts}] */
function pieces(Lo) {
	const out = [], r = G.rng(G.hashStr('parts:' + Lo.id)), turned = (q, rot) => { const c = q.c || [0, 0, 0], k = Math.cos(rot), s = Math.sin(rot); return Object.assign({}, q, {c: [c[0] * k - c[1] * s, c[0] * s + c[1] * k, c[2]], rot: (q.rot || 0) + rot}) };
	const pre = Lo.kind == 'precursor', V = Lo.vault, stone = C4(Lo.stone);
	for (const p of Lo.plazas) out.push({key: 'plaza' + p.n, c: p.c, r: p.r, flat: true, plaza: p.n, parts: [{shape: 'cyl', r: p.r, z0: -0.3, z1: 0.06, c: [0, 0, 0], col: pre ? [0.12, 0.11, 0.14, 0] : C4(Lo.stone.map(v => v * 0.8)), plaza: p.n}]});
	const vp = pre ? [{shape: 'box', c: [0, 0, V.h / 2], h: [V.r, V.r * 0.4, V.h / 2], col: PRE.body}, {shape: 'box', c: [0, -V.r * 0.41, V.h * 0.45], h: [V.r * 0.12, 0.2, V.h * 0.4], col: PRE.seam}]
		: [{shape: 'box', c: [0, 0, 0.2], h: [V.r, V.r * 0.6, 0.4], col: [0.05, 0.05, 0.05, 0]}, {shape: 'box', c: [V.r * 1.1, 0, V.h / 2], h: [V.r * 0.15, V.r * 0.6, V.h / 2], col: stone}, {shape: 'box', c: [-V.r * 1.1, 0, V.h / 2], h: [V.r * 0.15, V.r * 0.6, V.h / 2], col: stone}];
	out.push({key: 'vault', c: V.c, r: V.r * 1.3, flat: true, vault: true, parts: vp.map(q => turned(q, V.rot))});
	for (const st of [...Lo.structs, ...Lo.wardens]) out.push({key: (st.type == 'warden' || st.type == 'pylon' ? 'w' : 's') + st.n, c: st.c, r: st.r, flat: false, struct: st, parts: structParts(st, Lo.stone, PRE, r).map(q => turned(q, st.rot))});
	return out;
}
function partMesh(q, lo) {
	const col = q.col || Me.COL.hull;
	let x = null;
	if (q.shape == 'box') x = Me.box([0, 0, 0], q.h, col);
	else if (q.shape == 'cyl') x = Me.cylinder(q.r, q.z0, q.z1, q.plaza ? (lo ? 12 : 24) : q.thin ? (lo ? 4 : 6) : (lo ? 6 : 10), col);
	else if (q.shape == 'frustum') x = Me.frustum(q.r0, q.r1, q.z0, q.z1, lo ? 5 : 8, col);
	else if (q.shape == 'shard') x = Me.shard(q.r, q.h, col, q.z0 || 0);
	else if (q.shape == 'ell') x = Me.sphere(0, () => col, q.r);
	else if (q.shape == 'shell') x = shellMesh(q.r[0], q.r[1], q.r[2], col, lo ? 8 : 12, q.missing);
	else if (q.shape == 'torus') x = Me.torus(q.R, q.a, q.b, 0, lo ? 12 : 20, 4, col);
	else if (q.shape == 'ship') { x = Me.ship(q.length, lo ? 'low' : 'high').tilt(Math.PI / 2, 0); x.tilt(q.pitch, q.roll) }
	if (!x) return null;
	if (q.shape != 'ship' && (q.pitch || q.roll)) x.tilt(q.pitch, q.roll);
	return x.place(q.rot || 0, q.c || [0, 0, 0]);
}
/* one piece's mesh */
function pieceMesh(pc, detail) { const m = new Me.Mesh(); for (const q of pc.parts) { const x = partMesh(q, detail == 'lo'); if (x) m.add(x) } return m }
/* the triangles a site may take (the plan's budgets): a ruin at most 3,000 at full detail and 1,400 at low; a wreck its
   ship's own mesh, plus at most 600 for the rest */
const BUDGET = {hi: 3000, lo: 1400, debris: 600};

const EmberSites = {SITES, STRUCT, STYLES, RELAY, PRECURSOR, BUDGET, peopleOf, sitesAt, layout, check, parts, meshes, hullFor, worldR, allPorts, SURVEY, BITS, structYield, vaultCache, dataWorth, pieces, pieceMesh, WARDEN, vaultWave};
if (isNode) module.exports = EmberSites; else root.EmberSites = EmberSites;
})(typeof window != 'undefined' ? window : globalThis);
