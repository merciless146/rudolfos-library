/* ===== Ember Reach: the galaxy, as a scale model (docs/plan-ember-reach.md).
   A compact elliptical galaxy (after M32): about 3 billion solar masses of mostly old stars, half of its light within
   300 pc, slightly flattened (axes 1 : 0.85 : 0.7), a black hole of 5 million suns at the centre. Every star exists:
   space is cut into 4-pc cells, a cell holding many stars is split into eight (and so on), and each cell's stars are
   made from a hash of where the cell is. Nothing is stored; the same place always gives the same stars.

   The physics, with sources in the plan:
   - Light and mass: a Hernquist (1990) profile, rho(m) = M a / (2 pi m (m + a)^3), whose projection follows de
     Vaucouleurs' r^1/4 law; a = Re / 1.8153. m is the ellipsoidal radius (the galaxy is triaxial).
   - Stars: a Kroupa initial mass function; main-sequence lifetimes, luminosities and radii from the usual power laws;
     stars older than their lifetime become giants briefly, then white dwarfs, neutron stars or black holes.
     Two populations: old (about 10 Gyr) and a younger one (about 3 Gyr), commoner towards the centre, as in M32.
     Metal-rich in the middle, poorer outside.
   - Planets: how many from the WOS map's statistics (rich systems suit the game); where from spacing laws; masses by
     zone (rocky inside the snow line, ice and gas giants outside, giants commoner around metal-rich stars); radii
     from Chen & Kipping (2017); temperatures from the star's light; atmospheres kept where escape velocity allows.
   - The habitable zone: Kopparapu et al. (2014): runaway greenhouse (inner) and maximum greenhouse (outer).
   - Earth Similarity Index (Schulze-Makuch et al. 2011): radius, density, escape velocity, surface temperature.
   - The galactic habitable zone: close passes of other stars, from the local star density and speeds; dense middles
     strip planets and sterilise worlds, the quiet outskirts keep them.
   - The Drake equation, written with the number of stars in place of a star-forming rate, sets how many
     civilisations are alive now (and how many came and went: ruins).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const WOS = typeof module != 'undefined' ? require('./wos-stats.js') : root.WOS_STATS;

/* ---------- the galaxy ---------- */
const GAL = {
	Mstar: 3e9,          /* solar masses in stars and remnants: about 8 billion stars */
	Re: 300,             /* pc: half the light inside this (projected) */
	axes: [1, 0.85, 0.7],/* triaxial: an E3 seen from the side */
	rMax: 3000,          /* pc: where the model stops (10 Re) */
	rCore: 0.5,          /* pc: inside this, the black hole and its own cluster (a game zone of its own) */
	MBH: 5e6,
	sigma: 54,           /* km/s: velocity dispersion (sigma² ∝ M / R, so √2 below the 6e9-sun version of the same size) */
	ageOld: 10e9, ageYoung: 3e9, youngCentre: 0.3, nursery: 0.004, reclass: 0.27,   /* share of young stars at the centre, falling outward */
	FeHCentre: 0.15, FeHSlope: -0.35, FeHScatter: 0.15,
	cell: 4, splitAt: 48, maxDepth: 10,
	/* galactic north is +z, the short axis; the great powers live in the northern Middle Reach */
	north: {mLo: 1000, mHi: 2000, latMin: 30},
	/* six clusters of great powers, each 6-8 powers; each power holds about 8,000-14,000 systems */
	clusters: {count: 6, perMin: 6, perMax: 8, heldMin: 8000, heldMax: 14000, nearCore: [45, 90], nearRim: [2150, 2350], others: [500, 2000]}};
/* the regions, by ellipsoidal radius (pc) */
const REGIONS = [['Core', 0, 30], ['Glow', 30, 450], ['Inner Reach', 450, 1000], ['Middle Reach', 1000, 2000], ['Outer Clouds', 2000, 3000]];
/* galactic latitude, degrees: +90 at the north pole */
function latitude(x, y, z) { const d = Math.hypot(x, y, z); return d ? Math.asin(z / d) * 180 / Math.PI : 0 }
function regionAt(x, y, z) { const m = mRad(x, y, z), r = REGIONS.find(([, lo, hi]) => m >= lo && m < hi) || REGIONS[4]; return {name: r[0], m, lat: latitude(x, y, z)} }
const A = GAL.Re / 1.8153, Q = GAL.axes[0] * GAL.axes[1] * GAL.axes[2];
const PC_PER_KMS_YR = 1.0227e-6;

/* ---------- random numbers, by place ---------- */
function mix(h) { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0 }
function hash(...v) { let h = 0x9e3779b9; for (const x of v) h = mix(h ^ (Math.imul(x | 0, 0x27d4eb2d) + 0x165667b1 + (h << 6) + (h >>> 2))); return h }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return mix(h >>> 0) }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const gauss = r => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()) };
function poisson(lam, r) {
	if (lam < 30) { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r() } while (p > L); return k - 1 }
	return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(r)));
}
const logU = (r, a, b) => Math.exp(Math.log(a) + r() * (Math.log(b) - Math.log(a)));

/* ---------- the initial mass function (Kroupa 2001), 0.08-120 suns ---------- */
const IMF = (() => {
	const segs = [[0.08, 0.5, 1.3, 1], [0.5, 120, 2.3, 0.5]];   /* [from, to, slope, continuity factor] */
	const w = segs.map(([a, b, al, k]) => k * (Math.pow(b, 1 - al) - Math.pow(a, 1 - al)) / (1 - al));
	const W = w.reduce((x, y) => x + y);
	return r => {
		let u = r() * W, i = 0; while (i < segs.length - 1 && u > w[i]) { u -= w[i]; i++ }
		const [a, b, al, k] = segs[i], e = 1 - al;
		return Math.pow(Math.pow(a, e) + u * e / k, 1 / e) || a;   /* inverse of the segment's CDF */
	};
})();

/* ---------- a star's life ---------- */
const TSUN = 5772;
function msLife(M) { return 1e10 * Math.pow(M, -2.5) }
function msLum(M) { return M < 0.43 ? 0.23 * Math.pow(M, 2.3) : M < 2 ? Math.pow(M, 4) : M < 55 ? 1.4 * Math.pow(M, 3.5) : 32000 * M }
function msRad(M) { return M < 1 ? Math.pow(M, 0.8) : Math.pow(M, 0.57) }
function spectral(T) { return T >= 30000 ? 'O' : T >= 10000 ? 'B' : T >= 7500 ? 'A' : T >= 6000 ? 'F' : T >= 5200 ? 'G' : T >= 3700 ? 'K' : T >= 2400 ? 'M' : 'L' }
/* the lowest-mass stars: temperature falls steeply towards the hydrogen-burning limit (about 2,900 K at 0.1 suns,
   1,800 K at 0.08), so the last of them are L dwarfs (below 2,400 K), dim and red-brown */
function lowT(M) { return 1800 + (2900 - 1800) * Math.max(0, Math.min(1, (M - 0.08) / 0.02)) }
/* M0: birth mass; age in years; r: random for the phase */
function evolve(M0, age, r) {
	const t = msLife(M0);
	if (age < t) {
		const R = msRad(M0);
		if (M0 < 0.1) { const T = lowT(M0), L = R * R * Math.pow(T / TSUN, 4); return {kind: 'star', cls: spectral(T), M: M0, L, R, T} }
		const L = msLum(M0), T = TSUN * Math.pow(L / (R * R), .25); return {kind: 'star', cls: spectral(T), M: M0, L, R, T};
	}
	/* Wolf-Rayet: the heaviest stars, stripped by their own winds to hot, blinding cores before they die */
	if (M0 >= 25 && age < t * 1.3) {
		const T = 50000 + r() * 100000, L = logU(r, 1e5, 6e5), R = Math.sqrt(L) * Math.pow(TSUN / T, 2);
		return {kind: 'wolf-rayet', cls: 'WR', M: M0 * 0.4, L, R, T};
	}
	if (age < t * 1.12) {   /* giant branch, briefly */
		const L = logU(r, 10, M0 > 2 ? 3000 : 1500), T = 3900 + r() * 1100, R = Math.sqrt(L) * Math.pow(TSUN / T, 2);
		return {kind: 'giant', cls: spectral(T), M: M0 * 0.9, L, R, T};
	}
	if (M0 < 8) {   /* white dwarf: initial-final mass relation, then cooling */
		const M = Math.min(1.35, 0.109 * M0 + 0.394), cool = Math.max(1e6, age - t * 1.12), T = Math.max(3000, Math.min(1.2e5, 12000 * Math.pow(cool / 1e9, -0.4))), R = 0.012;
		return {kind: 'white dwarf', cls: 'D', M, L: R * R * Math.pow(T / TSUN, 4), R, T};
	}
	if (M0 < 25) return {kind: 'neutron star', cls: 'NS', M: 1.4, L: 1e-5, R: 1.4e-5, T: 6e5};
	return {kind: 'black hole', cls: 'BH', M: 5 + (M0 - 25) * 0.2, L: 0, R: 0, T: 0};
}

/* ---------- where the stars are ---------- */
const mRad = (x, y, z) => Math.sqrt((x / GAL.axes[0]) ** 2 + (y / GAL.axes[1]) ** 2 + (z / GAL.axes[2]) ** 2);
/* mass density, suns per cubic parsec */
function rho(x, y, z) { const m = Math.max(GAL.rCore, mRad(x, y, z)); if (m > GAL.rMax) return 0; return GAL.Mstar * A / (2 * Math.PI * m * Math.pow(m + A, 3)) / Q }
function massInside(m) { return GAL.Mstar * m * m / ((m + A) * (m + A)) }
/* the average mass of a star or remnant today (the IMF evolved for the galaxy's ages) */
const MEAN = (() => { const r = rng(12345); let s = 0, n = 40000; for (let i = 0; i < n; i++) { const M0 = IMF(r), age = r() < 0.15 ? GAL.ageYoung : GAL.ageOld; s += evolve(M0, age, r).M } return s / n })();
const numberDensity = (x, y, z) => rho(x, y, z) / MEAN;
const STARS_TOTAL = massInside(GAL.rMax) / MEAN;
/* stars expected in a box: the density averaged over a 3×3×3 grid inside it */
function expectIn(x0, y0, z0, s) { let t = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) t += numberDensity(x0 + (i + .5) * s / 3, y0 + (j + .5) * s / 3, z0 + (k + .5) * s / 3); return t / 27 * s * s * s }
function popAt(m) {
	const youngShare = GAL.youngCentre * Math.exp(-m / GAL.Re);
	const FeH = GAL.FeHCentre + GAL.FeHSlope * Math.log10(1 + m / GAL.Re);
	return {youngShare, FeH};
}
/* local speed spread (km/s): the dispersion, a little higher towards the middle */
const sigmaAt = m => GAL.sigma * Math.pow(1 + A / (m + 1), 0.15) / Math.pow(1 + A / GAL.Re, 0.15);

/* every leaf cell (with its stars) inside a box; f(leaf) gets {x, y, z, s, lam, id} */
function forLeaves(bx0, by0, bz0, bx1, by1, bz1, f) {
	const S = GAL.cell;
	for (let i = Math.floor(bx0 / S); i * S < bx1; i++) for (let j = Math.floor(by0 / S); j * S < by1; j++) for (let k = Math.floor(bz0 / S); k * S < bz1; k++)
		(function walk(x, y, z, s, depth, id) {
			if (x > bx1 || y > by1 || z > bz1 || x + s < bx0 || y + s < by0 || z + s < bz0) return;
			const lam = expectIn(x, y, z, s);
			if (lam <= 0) return;
			if (lam > GAL.splitAt && depth < GAL.maxDepth) { for (let c = 0; c < 8; c++) walk(x + (c & 1) * s / 2, y + (c >> 1 & 1) * s / 2, z + (c >> 2 & 1) * s / 2, s / 2, depth + 1, id + c.toString()); return }
			f({x, y, z, s, lam, id});
		})(i * S, j * S, k * S, S, 0, i + ',' + j + ',' + k + '/');
}
/* the stars of one leaf cell */
function cellStars(leaf) {
	const r = rng(hashStr('cell:' + leaf.id)), n = poisson(leaf.lam, r), out = [];
	for (let q = 0; q < n; q++) out.push(star(leaf.id + '#' + q, leaf.x + r() * leaf.s, leaf.y + r() * leaf.s, leaf.z + r() * leaf.s));
	return out;
}
/* LEGACY: the galaxy as it was before the class mix and the habitability rules (the great powers, the Drake
   equation and the ruins are measured on it, so they stay where they were) */
let LEGACY = false;
function legacy(fn) { const was = LEGACY; LEGACY = true; try { return fn() } finally { LEGACY = was } }   /* (LEGACY looks only in the normal galaxy, without the Heart) */
let CAPS = null;
const capitalIds = () => CAPS || (CAPS = new Set(legacy(() => civilizations()).map(c => c.star.id)));
/* one star, from its id and place */
function star(id, x, y, z) {
	const r = rng(hashStr('star:' + id)), m = mRad(x, y, z), pop = popAt(m);
	const young = r() < pop.youngShare, age = (young ? GAL.ageYoung : GAL.ageOld) * (1 + 0.1 * gauss(r));
	let M0 = IMF(r), s = evolve(M0, age, r), born = age;
	/* nurseries: a sliver of stars (more towards the centre) formed in the last few million years, from their own
	   draw so the rest of the galaxy is untouched: the only hot O and B stars, and the Wolf-Rayets */
	{ const q = rng(hashStr('nursery:' + id)); if (q() < GAL.nursery * pop.youngShare / GAL.youngCentre) { M0 = 8 * Math.pow(1 - q() * (1 - Math.pow(8 / 120, 1.3)), -1 / 1.3); born = 5e5 + q() * 4.5e6; s = evolve(M0, born, q) } }
	/* the class mix: about half the stars red dwarfs. A share of the M dwarfs the mass function makes are instead
	   K, G, F (and a few A) stars of a later generation, young enough to still burn (their own draw; the great
	   powers' home stars are kept as they are) */
	if (!LEGACY && s.kind == 'star' && s.cls == 'M') {
		const q = rng(hashStr('reclass:' + id));
		if (q() < GAL.reclass && !(s.M >= 0.45 && capitalIds().has(id))) {
			const u = q(), c = u < 0.5 ? [0.6, 0.85] : u < 0.82 ? [0.85, 1.05] : u < 0.97 ? [1.05, 1.4] : [1.4, 2];
			M0 = c[0] + (c[1] - c[0]) * q(); born = Math.min(born, (0.15 + 0.65 * q()) * msLife(M0)); s = evolve(M0, born, q);
		}
	}
	const FeH = pop.FeH + GAL.FeHScatter * gauss(r) - (young ? 0 : 0.05);
	/* companions: commoner for heavier stars (about 44% of Sun-like stars, a quarter of red dwarfs) */
	const pBin = s.kind == 'star' ? Math.min(0.6, 0.2 + 0.25 * s.M) : 0.15;
	const companion = r() < pBin ? evolve(M0 * (0.1 + 0.9 * r()), age, r) : null;
	return Object.assign({id, x, y, z, m, age: born, M0, FeH, companion: born < 1e8 ? null : companion, name: starName(hashStr('name:' + id))}, s);
}
function starsNear(x, y, z, R) {
	const out = [], rift = REALM == 'rift' && !LEGACY, zq = rift ? -z : z;
	forLeaves(x - R, y - R, zq - R, x + R, y + R, zq + R, leaf => { for (const s0 of cellStars(leaf)) { const s = rift ? riftOf(s0) : s0, d = Math.hypot(s.x - x, s.y - y, s.z - z); if (d <= R) { s.d = d; out.push(s) } } });
	/* the black hole at the centre: a place of its own (not in the old measures the great powers were set by) */
	if (!LEGACY && !HEARTLESS) { const d = Math.hypot(x, y, z); if (d <= R) out.push(Object.assign({}, rift ? RIFT_HEART : HEART, {d})) }
	return out.sort((a, b) => a.d - b.d);
}

/* ---------- the Heart, and the Rift ----------
   The black hole at the centre (the Maw) is a wormhole like the others, but it leads to one place only: the Rift,
   the galaxy upside down. Every star there is a star here turned over (its height above the galactic plane the
   other way), the same in kind and age; but its worlds are its own (from a draw of their own), lifeless, and rich
   in things found nowhere else: nullite, voidglass, aetherium, and the Precursors' relics in the ruins they left.
   No great power reaches it. The Maw on the Rift side leads home. */
const HEART = {id: 'heart', x: 0, y: 0, z: 0, m: 0, kind: 'black hole', cls: 'BH', M: GAL.MBH, L: 0, R: 0, T: 0, age: GAL.ageOld, M0: GAL.MBH, FeH: GAL.FeHCentre, companion: null, name: 'The Maw', heart: true};
const RIFT_HEART = Object.assign({}, HEART, {id: 'R:heart', rift: true});
let REALM = 'normal', HEARTLESS = false;
/* which galaxy starsNear (and so the map, routes and everything near you) looks in */
function realm(r) { if (r) REALM = r == 'rift' ? 'rift' : 'normal'; return REALM }
function inRealm(r, fn) { const was = REALM; REALM = r; try { return fn() } finally { REALM = was } }
/* the galaxy as the great powers and the small factions were laid out in: the normal one, without the Heart */
function normal(fn) { const was = REALM, h = HEARTLESS; REALM = 'normal'; HEARTLESS = true; try { return fn() } finally { REALM = was; HEARTLESS = h } }
/* a reversed name for the star's other self: Kaveth becomes Htevak */
const rname = n => { const r = n.toLowerCase().split('').reverse().join(''); return r[0].toUpperCase() + r.slice(1) };
function riftOf(s) {
	if (s.rift) return s;
	if (s.heart) return Object.assign({}, RIFT_HEART);
	return Object.assign({}, s, {id: 'R:' + s.id, z: -s.z, rift: true, name: rname(s.name), companion: s.companion});
}
/* a star of the normal galaxy straight from its id: the id names its cell ("i,j,k/" and the octants it was split
   into) and its place in the cell, so nothing else needs searching (the centre has millions within a few pc) */
function byId(id) {
	const m = /^(-?\d+),(-?\d+),(-?\d+)\/([0-7]*)#(\d+)$/.exec(id); if (!m) return null;
	let x = +m[1] * GAL.cell, y = +m[2] * GAL.cell, z = +m[3] * GAL.cell, sz = GAL.cell;
	for (const c of m[4]) { sz /= 2; x += (c & 1) * sz; y += (c >> 1 & 1) * sz; z += (c >> 2 & 1) * sz }
	const leaf = {x, y, z, s: sz, lam: expectIn(x, y, z, sz), id: id.slice(0, id.indexOf('#'))};
	return cellStars(leaf).find(s => s.id == id) || null;
}
/* any star from its id (and place, for ids of other shapes), in either galaxy (place: [x, y, z] as the star has it) */
function lookup(id, p) {
	if (id == 'heart') return Object.assign({}, HEART);
	if (id == 'R:heart') return Object.assign({}, RIFT_HEART);
	const rift = id.startsWith('R:'), base = rift ? id.slice(2) : id, q = p && (rift ? [p[0], p[1], -p[2]] : p);
	const find = r => q ? inRealm('normal', () => starsNear(q[0], q[1], q[2], r).find(s => s.id == base)) : null;
	const s = byId(base) || find(1e-3) || find(0.05);
	return s ? (rift ? riftOf(s) : s) : null;
}
const RIFT = {ruins: 0.1, nullite: 0.4, voidglass: 0.15, aetherium: 0.5};

/* ---------- names (made here; nothing from any other game) ---------- */
const SY1 = ['ka', 've', 'tor', 'ish', 'ul', 'mar', 'sen', 'dra', 'oth', 'ny', 'cal', 'bre', 'ze', 'qua', 'lin', 'ro', 'fa', 'gem', 'hal', 'ix', 'jun', 'ast', 'pel', 'vor'];
const SY2 = ['a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'or', 'en', 'is', 'um', 'ar'];
const SY3 = ['n', 'th', 'ra', 'x', 'l', 's', 'rd', 'k', 'mos', 'vin', 'tis', 'lon', '', '', ''];
function starName(h) { const r = rng(h), n = 1 + Math.floor(r() * 2); let s = ''; for (let i = 0; i < n; i++) s += SY1[Math.floor(r() * SY1.length)] + SY2[Math.floor(r() * SY2.length)]; s += SY3[Math.floor(r() * SY3.length)]; return s[0].toUpperCase() + s.slice(1) }

/* ---------- the habitable zone (Kopparapu et al. 2014), in AU ---------- */
const HZC = {inner: [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15], outer: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16]};
function seff(c, T) { const t = Math.max(2600, Math.min(7200, T)) - 5780; return c[0] + c[1] * t + c[2] * t * t + c[3] * t ** 3 + c[4] * t ** 4 }
function hz(s) { if (!s.L) return null; return {inner: Math.sqrt(s.L / seff(HZC.inner, s.T)), outer: Math.sqrt(s.L / seff(HZC.outer, s.T))} }

/* ---------- Earth Similarity Index (Schulze-Makuch et al. 2011) ---------- */
const ESIW = {R: 0.57, rho: 1.07, ve: 0.70, T: 5.58};
function esi(p) {
	const term = (x, x0, w) => Math.pow(1 - Math.abs((x - x0) / (x + x0)), w / 4);
	return term(p.R, 1, ESIW.R) * term(p.rho, 1, ESIW.rho) * term(p.ve, 1, ESIW.ve) * term(p.Ts, 288, ESIW.T);
}
/* radius from mass, Earth units (Chen & Kipping 2017: Terran R~M^0.28 to 2 Earths, Neptunian M^0.59, Jovian ~flat) */
function radiusOf(M) { if (M < 2.04) return Math.pow(M, 0.279); const Rn = 1.22 * Math.pow(M / 2.04, 0.589); return M < 130 ? Rn : 11.2 * Math.pow(M / 318, -0.04) }

/* ---------- the galactic habitable zone: close passes ---------- */
/* chance a planet's orbit (and its life) goes undisturbed for t years: passes inside b AU at the local density and speed */
function quietChance(s, bAU, t) {
	const n = numberDensity(s.x, s.y, s.z), vk = Math.SQRT2 * sigmaAt(s.m), v = vk * PC_PER_KMS_YR, b = bAU / 206265;
	const focus = 1 + 2 * 4.3e-3 * (s.M + 0.5) / (b * vk * vk);   /* gravitational focusing; G = 4.3e-3 pc (km/s)^2 per sun */
	return Math.exp(-Math.PI * b * b * n * v * focus * t);
}

/* ---------- planets ---------- */
const PPS = (() => { const e = Object.entries(WOS.planetsPerSystem).map(([k, v]) => [+k, v]), T = e.reduce((a, b) => a + b[1], 0); return r => { let u = r() * T; for (const [k, v] of e) { if ((u -= v) <= 0) return k } return 6 } })();
/* planets by class: most stars have them (fewer for the smallest, whose discs were thin); giants keep theirs; few
   survive a white dwarf or a neutron star; a Wolf-Rayet's are the scorched cores of what was there */
function chanceOfPlanets(s) { return s.kind == 'star' ? (s.cls == 'L' ? 0.5 : s.M < 0.45 ? 0.8 : 0.95) : s.kind == 'giant' ? 0.6 : s.kind == 'white dwarf' ? 0.15 : s.kind == 'neutron star' ? 0.02 : s.kind == 'wolf-rayet' ? 0.1 : 0 }
const ROCKY = ['Barren', 'Desert', 'Ocean', 'Tundra', 'Terra', 'Forest', 'EarthLike', 'Exotic'];
let skipRuins = false;
function systemNoRuins(s) { skipRuins = true; try { return system(s) } finally { skipRuins = false } }
function system(s) {
	const r = rng(hashStr('sys:' + s.id)), out = {star: s, hz: hz(s), planets: []};
	if (r() > chanceOfPlanets(s)) return out;
	const k = PPS(r), snow = 2.7 * Math.sqrt(Math.max(s.L, 1e-4)), Z = Math.pow(10, s.FeH);
	let a = (0.025 + r() * 0.05) * Math.cbrt(Math.max(s.M, 0.1));
	const quiet4 = quietChance(s, 20 * Math.sqrt(Math.max(s.L, 0.01)), 4e9);
	for (let i = 0; i < k; i++) {
		if (i) a *= 1.4 + r() * 0.9;
		const p = planet(s, r, i, a, out.hz, quiet4, Z, snow);
		p.name = s.name + ' ' + 'bcdefghijklmn'[i];
		out.planets.push(p);
	}
	/* ruins: the civilisations that came and went (the Drake equation's past), each in about ten systems */
	const rocky = out.planets.filter(p => !p.gas);
	if (!skipRuins && rocky.length && r() < RUIN_CHANCE()) rocky[Math.floor(r() * rocky.length)].ruins = true;
	if (LEGACY) return out;
	finish(s, out.planets);
	if (s.rift) riftWorlds(s, out.planets);
	/* a companion star's own worlds (S-type orbits, well inside the pair's separation) */
	const c = s.companion;
	if (c && c.kind == 'star') {
		const B = Object.assign({}, c, {id: s.id + ':B', name: s.name + ' B', x: s.x, y: s.y, z: s.z, m: s.m, age: s.age, FeH: s.FeH}), rB = rng(hashStr('sys:' + s.id + ':B'));
		out.hzB = hz(B);
		if (rB() < 0.5 * chanceOfPlanets(B)) {
			const kB = 1 + Math.floor(rB() * 3), snowB = 2.7 * Math.sqrt(Math.max(B.L, 1e-4)), quietB = quietChance(B, 20 * Math.sqrt(Math.max(B.L, 0.01)), 4e9), list = [];
			let aB = (0.025 + rB() * 0.05) * Math.cbrt(Math.max(B.M, 0.1));
			for (let i = 0; i < kB && aB < 2; i++) { if (i) aB *= 1.4 + rB() * 0.9; const p = planet(B, rB, i, aB, out.hzB, quietB, Z, snowB); p.name = B.name + ' ' + 'bcd'[i]; p.host = 'B'; list.push(p) }
			finish(B, list);
			if (s.rift) riftWorlds(B, list);
			out.planets.push(...list);
		}
	}
	return out;
}
/* one planet at distance a from its star s (draws from r in a fixed order) */
function planet(s, r, i, a, hzS, quiet4, Z, snow) {
	const beyond = a > snow;
	/* giant planets: about 10% of Sun-like stars, rising with metals (Fischer & Valenti: ~10^(2[Fe/H])) and star mass */
	const giant = beyond && r() < Math.min(0.9, 0.35 * Z * Z * Math.min(2, s.M));
	const M = giant ? logU(r, 15, 2000) : beyond ? logU(r, 0.3, 20) : logU(r, 0.05, 6) * (r() < 0.6 ? 1 : 0.4);
	const R = radiusOf(M), rhoE = M / (R * R * R), ve = Math.sqrt(M / R), g = M / (R * R);
	const Teq = s.L ? 278.6 * Math.pow(s.L, .25) / Math.sqrt(a) * Math.pow(0.7, .25) : 30 + r() * 20;
	const gas = M > 10 && R > 2.5;
	/* keeps an atmosphere where its escape velocity is well above what its heat would boil off (Earth 11.2 km/s, Mars 5) */
	const vKm = ve * 11.19, need = 6 * Math.sqrt(Teq / 255);
	let atmo = gas || r() < 1 / (1 + Math.exp(-(vKm - need) / 1.2));
	/* stripped: an L dwarf's flares strip its close worlds; a Wolf-Rayet's or a pulsar's wind and radiation strip
	   them all (a draw of its own, so other stars' worlds are as they were) */
	if (atmo && !gas) { const strip = s.cls == 'L' && a < 0.05 ? 0.6 : s.kind == 'wolf-rayet' || s.kind == 'neutron star' ? 1 : 0; if (strip && rng(hashStr('strip:' + s.id + ':' + i))() < strip) atmo = false }
	const thick = atmo ? (gas ? 3 : logU(r, 0.05, 90)) : 0;   /* surface pressure, bars */
	const Ts = gas ? Teq : Teq * Math.pow(1 + 0.75 * Math.min(60, 0.84 * Math.pow(thick, 0.7)), .25);
	const inHZ = hzS && a >= hzS.inner && a <= hzS.outer;
	/* tidal locking: the despinning time goes as a^6 / M*^2, so a world locks inside about 0.45 AU x M*^(1/3) x
	   (age / 4.5 Gyr)^(1/6): Mercury's distance for the Sun, every habitable-zone world of a red or L dwarf */
	if (!(a < 0.4 * Math.cbrt(Math.max(s.M, .1)))) r();   /* (keeps the random stream as it was) */
	const locked = a < 0.45 * Math.cbrt(Math.max(s.M, 0.01)) * Math.pow(Math.max(s.age, 1e6) / 4.5e9, 1 / 6);
	const p = {i, a, M, R, rho: rhoE, ve, g, Teq, Ts, atmo, bars: thick, gas, inHZ, locked};
	p.esi = gas ? 0 : esi(p);
	p.water = !gas && atmo && Ts > 273 && Ts < 373 && thick > 0.1;
	/* life: needs liquid water for long and quiet enough; its chance grows with the star's age and the quiet */
	p.life = p.water ? Math.min(1, s.age / 3e9) * quiet4 * DRAKE.fl : 0;
	p.alive = p.water && r() < p.life;
	p.type = classify(p, r);
	const W = WOS.types[p.type] || WOS.types.Barren;
	p.ring = r() < W.ring ? (r() < W.iceRing ? 'Ice' : 'Stone') : null;
	p.res = Object.entries(W.res).filter(([n, f]) => r() < Math.min(1, f * (n == 'Iron' || n == 'Copper' ? 1 : Math.sqrt(Z)))).map(([n]) => n);
	return p;
}
/* the habitability rules and the rings, after the physics (draws of their own, so the rest stays put):
   - liquid water that lasts is a K, G or F star's gift: around anything else (flares and locked days for M and L
     dwarfs, short lives and fierce light for A, B and O stars, the dead and the dying), a water world keeps its
     water only rarely (3%); otherwise it dries out or freezes. The great powers' home stars are kept as they are.
   - rings: icy only where it's cold enough for ice to last (an equilibrium temperature under 150 K); closer in, rocky
     or metallic (more often metallic around metal-rich stars and close to them). Moderately or densely strewn. */
const KGF = s => s.kind == 'star' && 'KGF'.includes(s.cls);
function finish(s, planets) {
	const home = s.kind == 'star' && s.M >= 0.45 && !KGF(s) && planets.some(p => p.water) && capitalIds().has(s.id);
	for (const p of planets) {
		const q = rng(hashStr('hab:' + s.id + ':' + p.i + (p.host || '')));
		if (p.water && !KGF(s) && !home && q() > 0.03) { p.water = false; p.alive = false; p.life = 0; p.dried = true; p.type = p.Ts > 300 ? 'Desert' : 'Tundra' }
		p.moons = moons(s, p);
		spin(s, p);
		if (p.ring) {
			const metal = Math.max(0.05, Math.min(0.7, 0.2 + 0.8 * (s.FeH || 0) + (p.Teq > 400 ? 0.2 : 0)));
			p.ring = p.Teq < 150 ? 'Ice' : q() < metal ? 'Metal' : 'Stone';
			p.ringDensity = q() < (p.gas ? 0.45 : 0.3) ? 'dense' : 'moderate';
		}
	}
}
/* the Rift's worlds: nothing lives there, the old ruins are the Precursors' (in about one system in ten with a rocky
   world), and the rocks and gas hold what the normal galaxy has none of */
function riftWorlds(s, planets) {
	const q = rng(hashStr('rift:' + s.id)), rocky = planets.filter(p => !p.gas);
	for (const p of planets) {
		p.rift = true; p.ruins = false;
		if (p.alive || p.life) { p.alive = false; p.life = 0; if (['Forest', 'Terra', 'EarthLike'].includes(p.type)) p.type = 'Ocean' }
		if (p.gas) { if (q() < RIFT.aetherium) p.res.push('Aetherium') }
		else { if (q() < RIFT.nullite) p.res.push('Nullite'); if (q() < RIFT.voidglass) p.res.push('Voidglass') }
		for (const m of p.moons || []) { m.rift = true; if (q() < RIFT.nullite / 2) m.res.push('Nullite') }
	}
	if (rocky.length && q() < RIFT.ruins) { const p = rocky[Math.floor(q() * rocky.length)]; p.ruins = true; p.precursor = true }
}
/* ---------- a world's year and day ----------
   year: its orbit, in days, from Kepler's third law (a in AU around its host's mass in suns). day: one turn on its
   axis, in days (negative: it turns backwards, as Venus does). A tidally locked world turns once a year. Otherwise
   as real worlds do: gas giants in 9 to 18 hours; rocky worlds anywhere from 10 hours to 5 days (log-even), slowed
   by their star's tides close in (inside 0.4 AU half of them are caught in a 3:2 resonance, Mercury's: three turns
   every two years), and one in ten turns backwards. A moon's year is its orbit round its planet, from the planet's
   mass and its distance in the planet's radii; moons are locked, so their day is their month. All from draws of
   their own: nothing else about a system moves. */
const G_SI = 6.674e-11, M_EARTH = 5.972e24, R_EARTH = 6.371e6;
function spin(s, p) {
	const q = rng(hashStr('rot:' + s.id + ':' + p.i + (p.host || '')));
	p.year = Math.sqrt(Math.pow(p.a, 3) / Math.max(0.05, s.M || 1)) * 365.25;
	if (p.locked) p.day = p.year;
	else if (p.gas) p.day = (9 + 9 * q()) / 24;
	else if (p.a < 0.4 && q() < 0.5) p.day = p.year * 2 / 3;
	else p.day = Math.exp(Math.log(10 / 24) + q() * Math.log(5 * 24 / 10));
	if (!p.locked && !p.gas && q() < 0.1) p.day = -p.day;
	for (const m of p.moons || []) { const r = m.dist * p.R * R_EARTH; m.year = 2 * Math.PI * Math.sqrt(r * r * r / (G_SI * p.M * M_EARTH)) / 86400; m.day = m.year }
}
/* moons: gas giants have one to five, other big worlds (5 Earths and up) up to two; small and mostly airless
   (from Earth's Moon down), and now and then (4%, where it's cold enough to keep it) a thick, hazy air like Titan's */
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
function moons(s, p) {
	if (!p.gas && p.M < 5) return [];
	const q = rng(hashStr('moons:' + s.id + ':' + p.i + (p.host || ''))), n = p.gas ? 1 + Math.floor(Math.pow(q(), 0.7) * 5) : Math.floor(q() * 3), out = [];
	let d = 5 + q() * 6;
	for (let k = 0; k < n; k++) {
		if (k) d *= 1.5 + q();
		const M = logU(q, 0.001, 0.05), R = radiusOf(M), g = M / (R * R), titan = p.Teq < 200 && M > 0.008 && q() < 0.04;
		const bars = titan ? 1 + q() * 2 : 0, Ts = titan ? p.Teq * Math.pow(1 + 0.75 * 0.84 * Math.pow(bars, 0.7), .25) : p.Teq;
		out.push({i: k, moon: true, parent: p.name, name: p.name + ' ' + ROMAN[k], dist: d, a: p.a, M, R, rho: M / (R * R * R), ve: Math.sqrt(M / R), g, Teq: p.Teq, Ts, atmo: titan, bars, gas: false, inHZ: false, locked: true,
			esi: 0, water: false, life: 0, alive: false, type: titan ? 'Exotic' : 'Barren', ring: null, res: titan ? ['Water', 'Coal'] : ['Iron', 'Titanium'].filter(() => q() < 0.5), titan});
	}
	return out;
}
function classify(p, r) {
	if (p.gas) return 'Gas';
	if (!p.atmo || p.bars < 0.02) return 'Barren';
	if (p.Ts > 500 || p.bars > 30) return 'Exotic';            /* hot, crushing, or strange chemistry */
	if (p.Ts > 330) return 'Desert';
	if (p.Ts < 250) return p.Ts < 190 ? 'Barren' : 'Tundra';
	if (p.water) {
		if (p.alive) return p.esi >= 0.9 ? 'EarthLike' : r() < 0.5 ? 'Forest' : 'Terra';
		return r() < 0.6 ? 'Ocean' : 'Tundra';
	}
	return p.Ts < 273 ? 'Tundra' : 'Desert';
}

/* ---------- the Drake equation, with stars counted rather than formed ---------- */
let ruinChance = null;
const RUIN_CHANCE = () => ruinChance == null ? (ruinChance = legacy(() => drake(sampleGalaxy(3000, 99), true)).past * DRAKE.footprint / STARS_TOTAL) : ruinChance;
/* N = N* · fp · ne · fl · fi · fc · (L / T): ne is measured on the model itself (habitable, quiet worlds per star) */
/* fl, fi, fc and L are the game's choices (nobody knows them): about forty civilisations alive now (six clusters
   of six to eight great powers), each lasting 180,000 years; the millions before them left ruins, each civilisation
   in about ten systems (its home and colonies). The number of earlier ones does not depend on L. */
const DRAKE = {fl: 0.5, fi: 0.01, fc: 0.2, L: 180000, T: 1e10, footprint: 10};
/* the Drake equation is measured on the galaxy as the great powers rose in it (LEGACY) */
function drake(sampleStars, noRuins) { return legacy(() => drake0(sampleStars, noRuins)) }
function drake0(sampleStars, noRuins) {
	let withPl = 0, habit = 0, n = 0;
	/* ne: worlds with liquid water and ESI 0.8 or more that stay undisturbed for 4 billion years, per star with planets */
	for (const s of sampleStars) { n++; const sy = noRuins ? systemNoRuins(s) : system(s); if (sy.planets.length) withPl++; const q = quietChance(s, 20 * Math.sqrt(Math.max(s.L, 0.01)), 4e9); habit += sy.planets.filter(p => p.water && p.esi >= 0.8).length * q }
	const fp = withPl / n, ne = withPl ? habit / withPl : 0;
	const N = STARS_TOTAL * fp * ne * DRAKE.fl * DRAKE.fi * DRAKE.fc * (DRAKE.L / DRAKE.T);
	return {stars: STARS_TOTAL, fp, ne, fl: DRAKE.fl, fi: DRAKE.fi, fc: DRAKE.fc, L: DRAKE.L, T: DRAKE.T, N, past: N * DRAKE.T / DRAKE.L};
}
/* stars picked across the whole galaxy, as many as you like (for maps and for measuring the model) */
function sampleGalaxy(n, seed) {
	const r = rng(seed || 7), out = [];
	for (let i = 0; i < n; i++) {
		/* Hernquist: invert M(m)/M = m^2/(m+a)^2 (truncated at rMax), then a random direction, stretched by the axes */
		const fmax = massInside(GAL.rMax) / GAL.Mstar, u = r() * fmax, m = A * Math.sqrt(u) / (1 - Math.sqrt(u));
		const ct = 2 * r() - 1, st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * r();
		const x = m * st * Math.cos(ph) * GAL.axes[0], y = m * st * Math.sin(ph) * GAL.axes[1], z = m * ct * GAL.axes[2];
		out.push(star('sample:' + (seed || 7) + ':' + i, x, y, z));
	}
	return out;
}

/* ---------- the great powers: six clusters ---------- */
/* About forty civilisations are alive now (the Drake equation with L = 180,000 years), in six clusters of six to
   eight great powers, each cluster a shared cradle (see the plan). The clusters:
   - the North: around the North Point, straight up the pole 1,500 pc out (the northern Middle Reach);
   - the Hearth: just outside the Core, 45-90 pc from the centre, crowded and harsh;
   - the Rim: out in the Outer Clouds, 2,150-2,350 pc, where stars are still only about two parsecs apart;
   - three more, 500-2,000 pc out;
   placed (from a seeded search) so the distances between clusters are as even as they can be.
   Each power's claim is sized by the systems it holds (8,000-14,000), so territories are small in the crowded
   middle (a few parsecs) and wide in thin space (tens of parsecs); a cluster's homes sit about a claim apart, so
   neighbours' claims meet. Homes are real stars (from the cells), on living worlds where there are any. */
function northPoint() { const N = GAL.north; return [0, 0, (N.mLo + N.mHi) / 2 * GAL.axes[2]] }
/* stars drawn from one region only (for maps): Hernquist inverted between two radii, directions in a polar cap */
function sampleRegion(n, seed, mLo, mHi, latMin) {
	const r = rng(seed), out = [], f = m => (m / (m + A)) ** 2, uLo = f(mLo), uHi = f(mHi), cMin = Math.sin(latMin * Math.PI / 180);
	for (let i = 0; i < n; i++) {
		const u = uLo + r() * (uHi - uLo), m = A * Math.sqrt(u) / (1 - Math.sqrt(u));
		let x, y, z, k = 0;
		do { const ct = cMin + r() * (1 - cMin), st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * r(); x = m * st * Math.cos(ph) * GAL.axes[0]; y = m * st * Math.sin(ph) * GAL.axes[1]; z = m * ct * GAL.axes[2] } while (latitude(x, y, z) < latMin && ++k < 20);
		out.push(star('region:' + seed + ':' + i, x, y, z));
	}
	return out;
}
const CLUSTER_NAMES = ['North', 'Hearth', 'Rim'];
/* a point at ellipsoidal radius m in a random direction */
function pointAt(m, r) { const ct = 2 * r() - 1, st = Math.sqrt(1 - ct * ct), ph = 2 * Math.PI * r(); return [m * st * Math.cos(ph) * GAL.axes[0], m * st * Math.sin(ph) * GAL.axes[1], m * ct * GAL.axes[2]] }
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
let CLUSTERS = null;
function clusters() {
	if (CLUSTERS) return CLUSTERS;
	const C = GAL.clusters, r = rng(hashStr('clusters')), np = northPoint();
	let best = null, bestCV = 1e9;
	for (let t = 0; t < 20000; t++) {
		const m = (lo, hi) => lo + r() * (hi - lo);
		const pts = [np, pointAt(m(...C.nearCore), r), pointAt(m(...C.nearRim), r)];
		while (pts.length < C.count) pts.push(pointAt(m(...C.others), r));
		const ds = []; for (let i = 0; i < pts.length; i++) for (let k = i + 1; k < pts.length; k++) ds.push(d3(pts[i], pts[k]));
		const mean = ds.reduce((a, b) => a + b) / ds.length, cv = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / ds.length) / mean;
		if (cv < bestCV) { bestCV = cv; best = pts }
	}
	CLUSTERS = best.map((at, k) => ({id: 'cluster' + k, name: CLUSTER_NAMES[k] || (starName(hashStr('cluster:' + k)) + ' Reach'), at, m: mRad(...at), lat: latitude(...at)}));
	CLUSTERS.cv = bestCV;
	return CLUSTERS;
}
/* claim radius (pc) for a power holding `held` systems where the density is n: a sphere a quarter larger than
   the systems need, as neighbours take a share of it */
const claimFor = (held, n) => 1.25 * Math.cbrt(3 * held / (4 * Math.PI * n));
/* the stars nearest a point, from the real cells */
function nearestStars(p, want) { let R = Math.max(0.02, 1.2 * Math.cbrt(want / (numberDensity(...p) + 1e-9))); for (let k = 0; k < 6; k++) { const s = starsNear(p[0], p[1], p[2], R); if (s.length >= want) return s; R *= 1.6 } return starsNear(p[0], p[1], p[2], R) }
let CIVS = null;
const MIN_CIVS = 6;   /* per cluster */
function civilizations() { return CIVS || legacy(civilizations0) }
function civilizations0() {
	if (CIVS) return CIVS;
	const C = GAL.clusters;
	CIVS = [];
	for (const cl of clusters()) {
		const r = rng(hashStr('pick:' + cl.id)), want = C.perMin + Math.floor(r() * (C.perMax - C.perMin + 1));
		const n0 = numberDensity(...cl.at), R0 = claimFor((C.heldMin + C.heldMax) / 2, n0);
		/* candidates: real stars around the cluster's centre, within about 1.6 claims (so neighbours' claims meet) */
		const cand = [], seen = new Set();
		for (let k = 0; k < 700 && cand.filter(c => c.tier == 0).length < 60; k++) {
			const dir = pointAt(1, r), rad = 1.6 * R0 * Math.cbrt(r()), p = cl.at.map((v, i) => v + dir[i] / [GAL.axes[0], GAL.axes[1], GAL.axes[2]][i] * rad);
			for (const s of nearestStars(p, 3)) {
				if (seen.has(s.id) || s.kind != 'star' || s.M < 0.45) continue;
				seen.add(s.id);
				const pl = system(s).planets;
				/* a living world if there is one; where the sky is too crowded for life to last (the Hearth), a
				   water world that held on; failing that, any rocky world with air (a people who built their own shelter) */
				const tiers = [p => p.alive && p.esi >= 0.75 && /EarthLike|Terra|Forest/.test(p.type), p => p.water && p.esi >= 0.7, p => !p.gas && p.atmo && p.esi >= 0.6];
				for (let t = 0; t < tiers.length; t++) { const h = pl.filter(tiers[t]).sort((a, b) => b.esi - a.esi)[0]; if (h) { cand.push({s, home: h, tier: t, score: -t + h.esi + 0.6 * rng(hashStr('pick:' + s.id))() - d3([s.x, s.y, s.z], cl.at) / R0}); break } }
			}
		}
		cand.sort((a, b) => b.score - a.score);
		/* homes at least 0.85 claims apart; and each with two or more others within 1.35 claims (neighbours to share
		   borders with), an outlier being swapped for the next candidate */
		const mine = [], out = new Set(), P = c => [c.s.x, c.s.y, c.s.z];
		const fill = () => { for (const c of cand) {
			if (mine.length >= want) break;
			if (out.has(c) || mine.includes(c) || mine.some(o => d3(P(o), P(c)) < 0.85 * R0)) continue;
			mine.push(c);
		} };
		fill();
		for (let round = 0; round < 30; round++) {
			const lone = mine.find(c => mine.filter(o => o != c && d3(P(o), P(c)) < 1.35 * R0).length < 2);
			if (!lone) break;
			out.add(lone); mine.splice(mine.indexOf(lone), 1); fill();
		}
		const chosen = mine.splice(0);
		for (const c of chosen) {
			const q = rng(hashStr('civ:' + c.s.id)), age = Math.round(30000 + q() * 60000), held = Math.round(C.heldMin + (C.heldMax - C.heldMin) * (age - 30000) / 60000);
			mine.push({id: 'major' + (CIVS.length + mine.length), cluster: cl.id, star: c.s, home: c.home, homeTier: c.tier, age, held, claim: claimFor(held, numberDensity(c.s.x, c.s.y, c.s.z)), radius: Math.round(10 + q() * 20)});
		}
		CIVS.push(...mine);
	}
	return CIVS;
}

const EmberGalaxy = {spin, HEART, RIFT_HEART, RIFT, realm, inRealm, normal, riftOf, lookup, byId, legacy, capitalIds, KGF, MIN_CIVS, northPoint, clusters, claimFor, nearestStars, starName, sampleRegion, REGIONS, regionAt, latitude, quietAt: (x, y, z) => quietChance({x, y, z, m: mRad(x, y, z), M: 1, L: 1}, 20, 4e9), civilizations, GAL, A, MEAN, STARS_TOTAL, DRAKE, rho, numberDensity, massInside, mRad, expectIn, forLeaves, cellStars, starsNear, star, system, hz, esi, radiusOf, quietChance, drake, sampleGalaxy, IMF, evolve, msLife, rng, hash, hashStr, popAt, sigmaAt};
if (typeof module != 'undefined') module.exports = EmberGalaxy; else root.EmberGalaxy = EmberGalaxy;
})(typeof window != 'undefined' ? window : this);
