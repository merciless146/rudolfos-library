/* ===== Ember Reach: the galaxy, as a scale model (docs/plan-ember-reach.md).
   A compact elliptical galaxy (after M32): about 6 billion solar masses of mostly old stars, half of its light within
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
	Mstar: 6e9,          /* solar masses in stars and remnants */
	Re: 300,             /* pc: half the light inside this (projected) */
	axes: [1, 0.85, 0.7],/* triaxial: an E3 seen from the side */
	rMax: 3000,          /* pc: where the model stops (10 Re) */
	rCore: 0.5,          /* pc: inside this, the black hole and its own cluster (a game zone of its own) */
	MBH: 5e6,
	sigma: 76,           /* km/s: velocity dispersion */
	ageOld: 10e9, ageYoung: 3e9, youngCentre: 0.3,   /* share of young stars at the centre, falling outward */
	FeHCentre: 0.15, FeHSlope: -0.35, FeHScatter: 0.15,
	cell: 4, splitAt: 48, maxDepth: 10};
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
function spectral(T) { return T >= 30000 ? 'O' : T >= 10000 ? 'B' : T >= 7500 ? 'A' : T >= 6000 ? 'F' : T >= 5200 ? 'G' : T >= 3700 ? 'K' : 'M' }
/* M0: birth mass; age in years; r: random for the phase */
function evolve(M0, age, r) {
	const t = msLife(M0);
	if (age < t) { const L = msLum(M0), R = msRad(M0), T = TSUN * Math.pow(L / (R * R), .25); return {kind: 'star', cls: spectral(T), M: M0, L, R, T} }
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
/* one star, from its id and place */
function star(id, x, y, z) {
	const r = rng(hashStr('star:' + id)), m = mRad(x, y, z), pop = popAt(m);
	const young = r() < pop.youngShare, age = (young ? GAL.ageYoung : GAL.ageOld) * (1 + 0.1 * gauss(r));
	const M0 = IMF(r), s = evolve(M0, age, r);
	const FeH = pop.FeH + GAL.FeHScatter * gauss(r) - (young ? 0 : 0.05);
	/* companions: commoner for heavier stars (about 44% of Sun-like stars, a quarter of red dwarfs) */
	const pBin = s.kind == 'star' ? Math.min(0.6, 0.2 + 0.25 * s.M) : 0.15;
	const companion = r() < pBin ? evolve(M0 * (0.1 + 0.9 * r()), age, r) : null;
	return Object.assign({id, x, y, z, m, age, M0, FeH, companion, name: starName(hashStr('name:' + id))}, s);
}
function starsNear(x, y, z, R) {
	const out = [];
	forLeaves(x - R, y - R, z - R, x + R, y + R, z + R, leaf => { for (const s of cellStars(leaf)) { const d = Math.hypot(s.x - x, s.y - y, s.z - z); if (d <= R) { s.d = d; out.push(s) } } });
	return out.sort((a, b) => a.d - b.d);
}

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
function chanceOfPlanets(s) { return s.kind == 'star' ? (s.M < 0.45 ? 0.8 : 0.95) : s.kind == 'giant' ? 0.6 : s.kind == 'white dwarf' ? 0.15 : s.kind == 'neutron star' ? 0.02 : 0 }
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
		const beyond = a > snow;
		/* giant planets: about 10% of Sun-like stars, rising with metals (Fischer & Valenti: ~10^(2[Fe/H])) and star mass */
		const giant = beyond && r() < Math.min(0.9, 0.35 * Z * Z * Math.min(2, s.M));
		const M = giant ? logU(r, 15, 2000) : beyond ? logU(r, 0.3, 20) : logU(r, 0.05, 6) * (r() < 0.6 ? 1 : 0.4);
		const R = radiusOf(M), rhoE = M / (R * R * R), ve = Math.sqrt(M / R), g = M / (R * R);
		const Teq = s.L ? 278.6 * Math.pow(s.L, .25) / Math.sqrt(a) * Math.pow(0.7, .25) : 30 + r() * 20;
		const gas = M > 10 && R > 2.5;
		/* keeps an atmosphere where its escape velocity is well above what its heat would boil off (Earth 11.2 km/s, Mars 5) */
		const vKm = ve * 11.19, need = 6 * Math.sqrt(Teq / 255);
		const atmo = gas || r() < 1 / (1 + Math.exp(-(vKm - need) / 1.2));
		const thick = atmo ? (gas ? 3 : logU(r, 0.05, 90)) : 0;   /* surface pressure, bars */
		const Ts = gas ? Teq : Teq * Math.pow(1 + 0.75 * Math.min(60, 0.84 * Math.pow(thick, 0.7)), .25);
		const inHZ = out.hz && a >= out.hz.inner && a <= out.hz.outer;
		const p = {i, a, M, R, rho: rhoE, ve, g, Teq, Ts, atmo, bars: thick, gas, inHZ, locked: a < 0.4 * Math.cbrt(Math.max(s.M, .1)) || r() < 0.2};
		p.esi = gas ? 0 : esi(p);
		p.water = !gas && atmo && Ts > 273 && Ts < 373 && thick > 0.1;
		/* life: needs liquid water for long and quiet enough; its chance grows with the star's age and the quiet */
		p.life = p.water ? Math.min(1, s.age / 3e9) * quiet4 * DRAKE.fl : 0;
		p.alive = p.water && r() < p.life;
		p.type = classify(p, r);
		const W = WOS.types[p.type] || WOS.types.Barren;
		p.ring = r() < W.ring ? (r() < W.iceRing ? 'Ice' : 'Stone') : null;
		p.res = Object.entries(W.res).filter(([n, f]) => r() < Math.min(1, f * (n == 'Iron' || n == 'Copper' ? 1 : Math.sqrt(Z)))).map(([n]) => n);
		p.name = s.name + ' ' + 'bcdefghijklmn'[i];
		out.planets.push(p);
	}
	/* ruins: the civilisations that came and went (the Drake equation's past), each in about ten systems */
	const rocky = out.planets.filter(p => !p.gas);
	if (!skipRuins && rocky.length && r() < RUIN_CHANCE()) rocky[Math.floor(r() * rocky.length)].ruins = true;
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
const RUIN_CHANCE = () => ruinChance == null ? (ruinChance = drake(sampleGalaxy(3000, 99), true).past * DRAKE.footprint / STARS_TOTAL) : ruinChance;
/* N = N* · fp · ne · fl · fi · fc · (L / T): ne is measured on the model itself (habitable, quiet worlds per star) */
/* fl, fi, fc and L are the game's choices (nobody knows them): about six civilisations alive now, each lasting
   15,000 years; the millions before them left ruins, each civilisation in about ten systems (its home and colonies) */
const DRAKE = {fl: 0.5, fi: 0.01, fc: 0.2, L: 15000, T: 1e10, footprint: 10};
function drake(sampleStars, noRuins) {
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

/* ---------- the civilisations alive now ---------- */
/* as many as the Drake equation gives, each at home on a living world in quiet space, at least 400 pc apart;
   each has spread about 45 pc in its 15,000 years (a hundredth of light speed, colony to colony) */
let CIVS = null;
function civilizations() {
	if (CIVS) return CIVS;
	const want = Math.max(3, Math.round(drake(sampleGalaxy(3000, 99), true).N)), cand = [];
	for (const s of sampleGalaxy(40000, 4242)) {
		if (s.kind != 'star' || s.M < 0.5) continue;
		const sy = system(s), home = sy.planets.filter(p => p.alive && p.esi >= 0.75 && /EarthLike|Terra|Forest/.test(p.type)).sort((a, b) => b.esi - a.esi)[0];
		if (home) cand.push({s, home, score: home.esi * quietChance(s, 20, 4e9)});
	}
	cand.sort((a, b) => b.score - a.score);
	CIVS = [];
	for (const c of cand) {
		if (CIVS.length >= want) break;
		if (CIVS.some(o => Math.hypot(o.star.x - c.s.x, o.star.y - c.s.y, o.star.z - c.s.z) < 400)) continue;
		CIVS.push({name: starName(hashStr('civ:' + c.s.id)) + ' ' + ['Compact', 'Concord', 'Assembly', 'Reach', 'Union', 'Hegemony', 'Commonwealth', 'Choir'][CIVS.length % 8], star: c.s, home: c.home, radius: 45});
	}
	return CIVS;
}

const EmberGalaxy = {civilizations, GAL, A, MEAN, STARS_TOTAL, DRAKE, rho, numberDensity, massInside, mRad, expectIn, forLeaves, cellStars, starsNear, star, system, hz, esi, radiusOf, quietChance, drake, sampleGalaxy, IMF, evolve, msLife, rng, hash, hashStr, popAt, sigmaAt};
if (typeof module != 'undefined') module.exports = EmberGalaxy; else root.EmberGalaxy = EmberGalaxy;
})(typeof window != 'undefined' ? window : this);
