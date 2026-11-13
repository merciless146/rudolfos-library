/* Ember Reach's galaxy model (wip/emberreach/galaxy.js): checks against the physics it is built on, then the viewer
   in Chromium (Playwright).
     node tests/emberreach_galaxy_t.js [PORT]      (needs: playwright; python3 for the file server) */
const path = require('path'), fs = require('fs');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const G = require(path.join(DIR, 'galaxy.js')), WOS = require(path.join(DIR, 'wos-stats.js'));
const PORT = +(process.argv[2] || 8193);
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.abs(b);

/* the shape: the density adds up to the mass, and half of it is inside (1 + √2) a (Hernquist) */
{
	let M = 0, steps = 4000; const lo = Math.log(G.GAL.rCore), hi = Math.log(G.GAL.rMax);
	for (let i = 0; i < steps; i++) { const m = Math.exp(lo + (i + .5) * (hi - lo) / steps), dm = m * (hi - lo) / steps; M += G.rho(m, 0, 0) * 4 * Math.PI * m * m * dm * G.GAL.axes[0] * G.GAL.axes[1] * G.GAL.axes[2] }
	const want = G.massInside(G.GAL.rMax) - G.massInside(G.GAL.rCore);
	ok('1. the density adds up to the galaxy\'s mass (' + (want / 1e9).toFixed(2) + ' billion suns)', near(M, want, 0.01), (M / 1e9).toFixed(3));
	const half = (1 + Math.SQRT2) * G.A;
	ok('2. half the mass inside (1+√2)a = ' + half.toFixed(0) + ' pc', near(G.massInside(half), G.GAL.Mstar / 2, 1e-9));
	const S = G.sampleGalaxy(30000, 5).map(s => s.m).sort((a, b) => a - b), med = S[S.length >> 1];
	const fmax = G.massInside(G.GAL.rMax) / G.GAL.Mstar, u = fmax / 2, wantMed = G.A * Math.sqrt(u) / (1 - Math.sqrt(u));
	ok('3. stars drawn across the galaxy follow it (median ellipsoidal radius)', near(med, wantMed, 0.04), med.toFixed(0) + ' vs ' + wantMed.toFixed(0));
	ok('4. about ' + (G.STARS_TOTAL / 1e9).toFixed(0) + ' billion stars and remnants (a compact elliptical: 10^9-10^10.5)', G.STARS_TOTAL > 3e9 && G.STARS_TOTAL < 3e10);
}
/* the same place gives the same stars; the cells hold what the density says */
{
	const a = G.starsNear(820, 40, -30, 4), b = G.starsNear(820, 40, -30, 4);
	ok('5. the same place always gives the same stars', a.length > 10 && a.length == b.length && a.every((s, i) => s.id == b[i].id && s.M0 == b[i].M0 && s.x == b[i].x), a.length);
	let lam = 0, n = 0; G.forLeaves(800, 0, 0, 820, 20, 20, l => { lam += l.lam; n += G.cellStars(l).length });
	ok('6. a 20-pc box holds the expected number of stars (Poisson)', Math.abs(n - lam) < 4 * Math.sqrt(lam), n + ' vs ' + lam.toFixed(0));
	let depth = 0; G.forLeaves(5, 0, 0, 5.5, 0.5, 0.5, l => { depth = Math.max(depth, l.id.split('/')[1].length) });
	ok('7. dense middles are split into smaller cells', depth >= 4, 'depth ' + depth);
}
/* stars */
{
	const S = G.sampleGalaxy(40000, 8), C = {};
	S.forEach(s => { const k = s.kind == 'star' ? s.cls : s.kind; C[k] = (C[k] || 0) + 1 });
	const f = k => (C[k] || 0) / S.length;
	ok('8. the class mix: about half the stars red dwarfs, K, G and F common, L dwarfs a few percent, and hot O and B stars only from the rare nurseries (under 0.3%)', f('M') > 0.45 && f('M') < 0.55 && f('K') + f('G') + f('F') > 0.3 && f('L') > 0.03 && f('L') < 0.12 && ((C.O || 0) + (C.B || 0)) / S.length < 0.003, JSON.stringify(C));
	/* star classes in the planets (M5 star-class pass) */
	const byCls = k => S.filter(s => (s.kind == 'star' ? s.cls : s.kind) == k).slice(0, 400);
	const Ls = byCls('L'), Ms = byCls('M'), Gs = byCls('G');
	/* habitability, companions, rings and moons */
	{
		const hostOf = (s, p) => p.host ? s.companion : s, cls = h => h.kind == 'star' ? h.cls : h.kind, wet = {}, rings = {}, dens = {}; let wetHZ = 0, wetAll = 0, comp = 0, moons = 0, titan = 0, gas = 0, badIce = 0, moonAir = 0;
		for (const s0 of S.slice(0, 12000)) for (const p of G.system(s0).planets) {
			const k = cls(hostOf(s0, p)); if (p.water) { wet[k] = (wet[k] || 0) + 1; wetAll++ } if (p.host) comp++;
			if (p.ring) { rings[p.ring] = (rings[p.ring] || 0) + 1; dens[p.ringDensity] = (dens[p.ringDensity] || 0) + 1; if (p.ring == 'Ice' && p.Teq >= 150) badIce++ }
			if (p.gas) gas++; for (const m of p.moons || []) { moons++; if (m.atmo) { moonAir++; if (m.titan) titan++ } }
		}
		const kgf = (wet.K || 0) + (wet.G || 0) + (wet.F || 0);
		ok('26a. water worlds are a K, G or F star\'s: over 90% of them; other classes only rarely', kgf / wetAll > 0.9 && (wet.M || 0) > 0, JSON.stringify(wet));
		ok('26b. companion stars have worlds of their own', comp > 100, comp + ' companion worlds');
		ok('26c. rings are icy, rocky or metallic, moderate or dense; never icy where it\'s too warm for ice', rings.Ice && rings.Stone && rings.Metal && dens.moderate && dens.dense && badIce == 0, JSON.stringify(rings) + ' ' + JSON.stringify(dens));
		ok('26d. gas giants and big worlds have moons, mostly airless; a few (under 5%) have a thick, Titan-like air', moons > gas && moonAir > 0 && moonAir / moons < 0.05 && titan == moonAir, moons + ' moons, ' + moonAir + ' with air');
	}
	ok('26. L dwarfs: below 2,400 K, dim, and fewer of them have planets than red dwarfs', Ls.length > 50 && Ls.every(s => s.T < 2400 && s.L < 1e-3) && Ls.filter(s => G.system(s).planets.length).length / Ls.length < Ms.filter(s => G.system(s).planets.length).length / Ms.length);
	const hzW = (arr) => arr.map(s => G.hz(s)).filter(Boolean).reduce((t, h) => t + h.inner, 0) / arr.length;
	ok('27. the habitable zone follows the star: far closer in for M and L dwarfs than for G stars', hzW(Ls) < hzW(Ms) && hzW(Ms) < hzW(Gs) / 5);
	const hzLocked = arr => { let a = 0, b = 0; for (const s of arr) for (const p of G.system(s).planets) if (p.inHZ) { a++; if (p.locked) b++ } return a ? b / a : null };
	ok('28. tidal locking by physics: habitable-zone worlds of M dwarfs are almost all locked; a G star\'s are not', hzLocked(Ms) > 0.9 && (hzLocked(Gs) == null || hzLocked(Gs) < 0.1), hzLocked(Ms) + ' / ' + hzLocked(Gs));
	const wr = G.evolve(40, 1.1 * G.msLife(40), G.rng(3));
	ok('29. the heaviest stars end as Wolf-Rayets, hot and blinding; their worlds and pulsars\' are stripped bare', wr.kind == 'wolf-rayet' && wr.T >= 50000 && wr.L >= 1e5);
	ok('9. white dwarfs are 4-12% of stars (old stars that have died)', f('white dwarf') > 0.04 && f('white dwarf') < 0.12, f('white dwarf').toFixed(3));
	ok('10. the Sun\'s lifetime is about 10 Gyr', near(G.msLife(1), 1e10, 1e-9));
}
/* habitability */
{
	const hz = G.hz({L: 1, T: 5772});
	ok('11. the Sun\'s habitable zone: 0.95-1.67 AU (Kopparapu et al. 2014)', near(hz.inner, 0.95, 0.02) && near(hz.outer, 1.67, 0.02), hz.inner.toFixed(3) + '-' + hz.outer.toFixed(3));
	const e = G.esi({R: 1, rho: 1, ve: 1, Ts: 288}), m = G.esi({R: 0.532, rho: 0.713, ve: 0.45, Ts: 227});
	ok('12. ESI: Earth 1, Mars about 0.70 (Planetary Habitability Laboratory)', e == 1 && m > 0.66 && m < 0.73, m.toFixed(3));
	ok('13. radii: Earth 1, Jupiter (318 Earth masses) about 11.2 (Chen & Kipping 2017)', near(G.radiusOf(1), 1, 1e-9) && near(G.radiusOf(318), 11.2, 0.02));
	const q = r => G.quietChance({x: r, y: 0, z: 0, m: r, M: 1, L: 1}, 20, 4e9);
	ok('14. the galactic habitable zone: the middle is sterile, the outskirts quiet', q(30) < 0.01 && q(1000) > 0.95, q(30).toExponential(1) + ' / ' + q(1000).toFixed(3));
}
/* planets against the WOS statistics */
{
	const S = G.sampleGalaxy(6000, 9), T = {}; let n = 0, ringG = 0, gas = 0, ringR = 0, rocky = 0, sys = 0, pl = 0;
	for (const s of S) { const sy = G.system(s); if (sy.planets.length) { sys++; pl += sy.planets.length } for (const p of sy.planets) { n++; T[p.type] = (T[p.type] || 0) + 1; if (p.gas) { gas++; if (p.ring) ringG++ } else { rocky++; if (p.ring) ringR++ } } }
	const wosMean = Object.entries(WOS.planetsPerSystem).reduce((a, [k, v]) => a + k * v, 0) / Object.values(WOS.planetsPerSystem).reduce((a, b) => a + b, 0);
	ok('15. planets per system follow the WOS map (mean ' + wosMean.toFixed(1) + ')', near(pl / sys, wosMean, 0.05), (pl / sys).toFixed(2));
	ok('16. rings follow the WOS map: most gas giants, about a fifth of rocky worlds', near(ringG / gas, WOS.types.Gas.ring, 0.1) && Math.abs(ringR / rocky - 0.2) < 0.04, (ringG / gas).toFixed(2) + ' / ' + (ringR / rocky).toFixed(2));
	ok('17. every planet type turns up', Object.keys(WOS.types).filter(t => !/Robot/.test(t)).every(t => T[t] > 0), JSON.stringify(T));
	const src = fs.readFileSync(path.join(DIR, 'wos-stats.js'), 'utf8');
	ok('18. nothing of the WOS world itself is kept: no names or coordinates in the statistics', !/"name"|"x":|"coord/.test(src) && src.length < 8000);
}
/* the Drake equation and the civilisations */
{
	const D = G.drake(G.sampleGalaxy(3000, 99), true), C = G.civilizations(), K = G.clusters();
	ok('19. the Drake equation: about forty civilisations alive now, in six clusters of six to eight great powers', D.N >= 30 && D.N <= 60 && K.length == 6 && K.every(k => { const n = C.filter(c => c.cluster == k.id).length; return n >= G.MIN_CIVS && n <= 8 }), D.N.toFixed(1) + ', ' + K.map(k => C.filter(c => c.cluster == k.id).length).join('/'));
	const N = G.GAL.north, north = C.filter(c => c.cluster == K[0].id);
	ok('20. the North is around the North Point: 1,000-2,000 pc out, 30° north or more', K[0].name == 'North' && north.every(c => c.star.m >= N.mLo && c.star.m <= N.mHi && G.latitude(c.star.x, c.star.y, c.star.z) >= N.latMin));
	ok('20b. the Hearth is close to the Core but not in it (45-90 pc); the Rim near the edge (2,150-2,350 pc), where neighbouring stars are still under 2.5 pc apart', K[1].m >= 45 && K[1].m <= 90 && C.filter(c => c.cluster == K[1].id).every(c => c.star.m > 30) && K[2].m >= 2150 && K[2].m <= 2350 && 0.554 * Math.pow(G.numberDensity(...K[2].at), -1 / 3) < 2.5, K[1].m.toFixed(0) + ' / ' + K[2].m.toFixed(0));
	const ds = []; for (let i = 0; i < K.length; i++) for (let k = i + 1; k < K.length; k++) ds.push(Math.hypot(...K[i].at.map((v, j) => v - K[k].at[j])));
	ok('20c. the clusters are fairly evenly spaced (distances vary by under 30%)', K.cv < 0.3 && Math.min(...ds) > 400, Math.round(Math.min(...ds)) + '-' + Math.round(Math.max(...ds)) + ' pc');
	ok('20d. homes are real stars (found again where they are) on worlds with ESI 0.6 or more', C.every(c => c.home.esi >= 0.6 && G.starsNear(c.star.x, c.star.y, c.star.z, 0.001).some(s => s.id == c.star.id)));
	const q = c => G.quietChance(c.star, 20, 4e9);
	/* ruins go on a rocky world, so stars with one get them at the Drake rate */
	let ru = 0, withRocky = 0; const S = G.sampleGalaxy(12000, 21);
	S.forEach(s => { const pl = G.system(s).planets; if (pl.some(p => !p.gas)) withRocky++; if (pl.some(p => p.ruins)) ru++ });
	const want = D.past * G.DRAKE.footprint / G.STARS_TOTAL * withRocky;
	ok('21. ruins of earlier civilisations as often as the Drake equation\'s past says', Math.abs(ru - want) < 4 * Math.sqrt(want) + 2, ru + ' vs ' + want.toFixed(1));
}

/* the viewer, in Chromium */
(async () => {
	let chromium; try { ({chromium} = require('playwright')) } catch (e) { console.log('(playwright not found: the viewer is not checked)'); return done() }
	const {spawn} = require('child_process');
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: DIR, stdio: 'ignore'});
	await new Promise(r => setTimeout(r, 800));
	const br = await chromium.launch(), pg = await br.newPage({viewport: {width: 1130, height: 720}}), errs = [];
	pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) });
	try {
		await pg.goto(`http://127.0.0.1:${PORT}/viewer.html`); await pg.waitForFunction(() => /in 3D/.test(document.getElementById('northCap').textContent) && /civilisations alive now/.test(document.getElementById('galCap').textContent) && /planets/.test(document.getElementById('sysCap').textContent), null, {timeout: 60000});
		ok('22. the viewer draws each cluster in 3D, the galaxy, a close-up and a home system, without errors', !errs.length, errs.join(' | '));
	} catch (e) { ok('22. the viewer', false, String(e)) }
	await br.close(); srv.kill(); done();
})();
function done() { console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0) }
