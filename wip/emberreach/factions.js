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
			/* a claim on space: 120-240 pc around home, by age; strength for wars and trade */
			claim: 120 + 120 * Math.min(1, age / 15000), military: 0.6 + 0.8 * r(), economy: 0.6 + 0.8 * r(), age, colonies: c.radius};
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
function relations() {
	if (REL) return REL;
	const M = majors(), n = M.length, pairs = [];
	for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
	/* search the ways to set each pair ally, enemy or neutral; keep the first (in seeded order) that meets the rules,
	   preferring enemies that are close (a long border) and allies that are not */
	let best = null, bestScore = -1e9, fight;
	/* a power with fewer than two neighbours to fight reaches further (its claim grows) until the rules can be met */
	for (let grow = 0; grow < 8; grow++) {
		fight = M.map(a => M.map(b => a != b && canFight(a, b)));
		const lonely = M.filter((a, i) => fight[i].filter(x => x).length < 2);
		if (!lonely.length) break;
		lonely.forEach(a => a.claim *= 1.12); BORDER.clear();
	}
	const r = rng(hashStr('relations:' + M.map(m => m.id).join()));
	for (let t = 0; t < 40000; t++) {
		const rel = pairs.map(([i, j]) => { const u = r(); return fight[i][j] ? (u < 0.5 ? -1 : u < 0.8 ? 1 : 0) : (u < 0.6 ? 1 : 0) });
		const A = new Array(n).fill(0), E = new Array(n).fill(0);
		let okEnemies = true;
		rel.forEach((v, k) => { const [i, j] = pairs[k]; if (v > 0) { A[i]++; A[j]++ } if (v < 0) { E[i]++; E[j]++; if (!fight[i][j]) okEnemies = false } });
		if (!okEnemies || A.some(x => x < 2) || E.some(x => x < 2)) continue;
		let score = 0; rel.forEach((v, k) => { const [i, j] = pairs[k], d = dist(M[i].at, M[j].at); score += v < 0 ? border(M[i], M[j]) * 3 - d / 300 : v > 0 ? d / 300 : 0 });
		if (score > bestScore) { bestScore = score; best = rel }
	}
	if (!best) throw new Error('no arrangement of alliances fits these great powers');
	const mat = {};
	M.forEach(a => mat[a.id] = {});
	best.forEach((v, k) => { const [i, j] = pairs[k]; mat[M[i].id][M[j].id] = mat[M[j].id][M[i].id] = v });
	M.forEach(m => { m.allies = M.filter(o => mat[m.id][o.id] > 0).map(o => o.id); m.enemies = M.filter(o => mat[m.id][o.id] < 0).map(o => o.id) });
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
/* a claim's strength falls from 1 at home to 0 at its edge */
function strength(m, p) { return Math.max(0, 1 - dist(m.at, p) / m.claim) }
function claimAt(p) {
	const s = majors().map(m => [m, strength(m, p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
	if (!s.length) return {owner: null, contested: null};
	const [a, b] = s;
	/* contested: two enemies' claims nearly equal here */
	if (b && relation(a[0].id, b[0].id) < 0 && a[1] - b[1] < 0.12) return {owner: null, contested: [a[0].id, b[0].id], strength: a[1]};
	return {owner: a[0].id, contested: null, strength: a[1], shared: b && relation(a[0].id, b[0].id) > 0 ? b[0].id : null};
}

/* ---------- wars ---------- */
let WARS = null;
const warKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
/* the contested systems of a pair of enemies: stars along the surface where their claims are equal */
function frontSystems(a, b, want) {
	const r = rng(hashStr('front:' + warKey(a.id, b.id))), axis = a.at.map((v, i) => b.at[i] - v), d = Math.hypot(...axis), u = axis.map(v => v / d);
	/* two directions across the axis */
	const t = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm(cross(u, t)), e2 = cross(u, e1);
	const out = [], seen = new Set();
	for (let k = 0; k < want * 30 && out.length < want; k++) {
		const ang = r() * 2 * Math.PI, rad = Math.sqrt(r()) * Math.min(a.claim, b.claim) * 0.6;
		const off = e1.map((v, i) => v * Math.cos(ang) * rad + e2[i] * Math.sin(ang) * rad);
		/* slide along the axis to where the two claims are equal */
		let lo = 0, hi = d, p;
		for (let q = 0; q < 30; q++) { const mid = (lo + hi) / 2; p = a.at.map((v, i) => v + u[i] * mid + off[i]); if (strength(a, p) > strength(b, p)) lo = mid; else hi = mid }
		if (!(strength(a, p) > 0 && strength(b, p) > 0)) continue;
		/* the nearest worthwhile system (a star with planets) */
		const s = G.starsNear(p[0], p[1], p[2], Math.max(2.5, nearR(p))).find(s => s.kind == 'star' && s.M > 0.25 && !seen.has(s.id) && G.system(s).planets.length);
		if (!s) continue;
		/* only where these two are the claimants (not inside a third power's space) */
		const cl = claimAt(pos(s));
		if (!cl.contested || !cl.contested.includes(a.id) || !cl.contested.includes(b.id)) continue;
		seen.add(s.id);
		out.push({id: s.id, name: s.name, at: pos(s), star: s});
	}
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
		const [a, b] = [M[i], M[j]];
		WARS.push({id: warKey(a.id, b.id), a: a.id, b: b.id, systems: frontSystems(a, b, 10)});
	}
	return WARS;
}
/* the state of a war on a game day. effort: the players' war effort per system ({systemId: signed, + for side a});
   control per system runs from -1 (b holds it) to +1 (a holds it) */
function warState(war, day, effort) {
	const a = byId(war.a), b = byId(war.b), S = seasonOf(day), r0 = rng(hashStr('war:' + war.id));
	const edge = Math.log(a.military / b.military);
	const out = {war, day, season: S, truce: false, systems: []};
	/* each season: a truce (about one in ten), or an offensive by one side on a few systems */
	const pushes = new Map(war.systems.map(s => [s.id, (r0() - 0.5) * 0.6]));
	for (let k = Math.max(0, S - 12); k <= S; k++) {   /* the last twelve seasons shape today's front */
		const r = rng(hashStr('season:' + war.id + ':' + k)), truce = r() < 0.1;
		if (k == S) out.truce = truce;
		if (truce) continue;
		const side = r() < 1 / (1 + Math.exp(-edge * 2)) ? 1 : -1, n = 1 + Math.floor(r() * 4), w = Math.pow(0.8, S - k);
		for (let q = 0; q < n; q++) { const s = war.systems[Math.floor(r() * war.systems.length)]; pushes.set(s.id, pushes.get(s.id) + side * (0.25 + 0.35 * r()) * w) }
	}
	for (const s of war.systems) {
		const e = effort && effort[s.id] || 0;
		const c = Math.tanh(pushes.get(s.id) + e / 100);   /* 100 points of effort swing a system about as much as an offensive */
		out.systems.push({id: s.id, name: s.name, control: c, holder: c > 0.33 ? war.a : c < -0.33 ? war.b : null});
	}
	out.score = out.systems.reduce((t, s) => t + s.control, 0) / out.systems.length;   /* + : side a is winning */
	return out;
}

/* ---------- missions about the wars ---------- */
const MISSION = {
	supply: {effort: 6, pay: 1.0, text: 'Carry supplies to the front at'},
	escort: {effort: 9, pay: 1.4, text: 'Escort a convoy to'},
	recon: {effort: 5, pay: 0.9, text: 'Scan enemy positions at'},
	strike: {effort: 14, pay: 2.2, text: 'Strike enemy ships at'},
	defend: {effort: 12, pay: 1.8, text: 'Hold the line at'},
	sabotage: {effort: 16, pay: 2.6, text: 'Sabotage the enemy depot at'},
	blockade: {effort: 10, pay: 1.6, text: 'Run the blockade into'}};
/* the war missions a great power offers on a day: one or more for each of its wars */
function warMissions(powerId, day) {
	const p = byId(powerId), out = [];
	for (const w of wars().filter(w => w.a == powerId || w.b == powerId)) {
		const st = warState(w, day), enemy = w.a == powerId ? w.b : w.a, sign = w.a == powerId ? 1 : -1;
		if (st.truce) continue;
		const r = rng(hashStr('missions:' + powerId + ':' + w.id + ':' + day));
		/* fronts that matter most: systems the enemy holds or that are being fought over */
		const targets = st.systems.filter(s => s.control * sign < 0.5).sort((x, y) => x.control * sign - y.control * sign);
		const n = 1 + Math.floor(r() * 3);
		for (let k = 0; k < n && targets.length; k++) {
			const t = targets[Math.floor(r() * Math.min(4, targets.length))], types = Object.keys(MISSION), type = types[Math.floor(r() * types.length)], M = MISSION[type];
			out.push({id: powerId + ':' + day + ':' + w.id + ':' + k, issuer: powerId, against: enemy, war: w.id, system: t.id, systemName: t.name, type,
				text: M.text + ' ' + t.name, effort: M.effort * sign, reward: Math.round(M.pay * (800 + 400 * r())), currency: p.currency.code});
		}
	}
	return out;
}

/* ---------- smaller factions ---------- */
const MINOR_KINDS = {
	nomad: {n: 6, carrier: 'fleet carrier', pattern: 'nomadic', words: ['Wanderers', 'Drift', 'Caravan', 'Flotilla', 'Exodus', 'Migration']},
	criminal: {n: 8, carrier: 'dreadnought', pattern: 'rotating', words: ['Syndicate', 'Cartel', 'Reavers', 'Knives', 'Black Fleet', 'Brotherhood', 'Corsairs', 'Ring']},
	prospector: {n: 5, carrier: 'fleet carrier', pattern: 'semi-permanent', words: ['Guild', 'Combine', 'Claimholders', 'Diggers', 'Consortium']},
	freeport: {n: 5, carrier: null, pattern: 'fixed', words: ['Free Port', 'Haven', 'Exchange', 'Freehold', 'Crossing']}};
const SERVICES = {'fleet carrier': ['market', 'refinery', 'repairs', 'fuel', 'hangar', 'shipyard'], dreadnought: ['repairs', 'fuel', 'hangar', 'black market', 'armoury']};
let MINORS = null;
function minors() {
	if (MINORS) return MINORS;
	MINORS = [];
	const M = majors(), np = G.northPoint();
	const fronts = wars().flatMap(w => w.systems.map(s => s.at));
	for (const [kind, K] of Object.entries(MINOR_KINDS)) for (let i = 0; i < K.n; i++) {
		const id = kind + i, r = rng(hashStr('minor:' + id)), root = starName(hashStr('minorname:' + id));
		/* where it works: criminals near the fronts and in the Glow; prospectors in metal-rich inner space; nomads
		   anywhere in the Middle Reach and the Outer Clouds; free ports between the great powers */
		const site = () => {
			if (kind == 'criminal') return r() < 0.6 ? jitter(fronts[Math.floor(r() * fronts.length)], 25, r) : onShell(40 + r() * 400, r);
			if (kind == 'prospector') return onShell(150 + r() * 700, r);
			if (kind == 'nomad') return onShell(1000 + r() * 1900, r);
			const a = M[Math.floor(r() * M.length)], b = M[Math.floor(r() * M.length)]; return jitter(a.at.map((v, k) => (v + b.at[k]) / 2), 30, r);
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

const EmberFactions = {border: (a, b) => border(byId(a), byId(b)), SEASON_DAYS, seasonOf, majors, minors, byId, relations, relation, strength, claimAt, wars, warState, warMissions, whereIs, MISSION};
if (typeof module != 'undefined') module.exports = EmberFactions; else root.EmberFactions = EmberFactions;
})(typeof window != 'undefined' ? window : this);
