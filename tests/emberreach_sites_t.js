/* Ember Reach's sites on the ground, the model (0.7.1, L4.1: sites.js; docs/plan-ember-reach-sites.md), in node:
   which systems have which sites and where, the same every time; nothing else in the galaxy moved; the rates; every
   site on ground that can be landed on, within its world's share and clear of its ports; outlying ruins on a moon
   whenever there's one (the owner's choice); the peoples and their styles; the layouts' rules and triangle budgets
   over 200 seeds a kind; Precursor sites unweathered; a system's sites worked out in under a millisecond; and the
   three new mesh shapes. (0.7.2, L4.2) What surveying from the ground gives: each structure's find, the vault's cache
   and blueprint, the site data's worth; the model in pieces; the record (first discoveries, bits, data sold as far as
   it's surveyed), saved, cleaned and shared among a galaxy's pilots.
     node tests/emberreach_sites_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const G = req('galaxy.js'), St = req('sites.js'), L = req('landing.js'), Sf = req('surface.js'), Me = req('meshes.js'), Sh = req('ships.js'), X = req('explore.js'), Sv = req('save.js'), Tr = req('trade.js'), F = req('factions.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 600) : '')) } };
try {
	/* a sample of the galaxy: stars in four places, and the ruin systems among a wider sweep */
	const stars = [[20, 10, 0], [-60, 30, 2], [100, -40, -3], [-150, 80, 1]].flatMap(([x, y, z]) => G.starsNear(x, y, z, 6).filter(s => s.kind == 'star').slice(0, 1500));
	const ruinStars = [[20, 10, 0], [-60, 30, 2], [100, -40, -3], [60, 60, 0]].flatMap(([x, y, z]) => G.starsNear(x, y, z, 12).filter(s => s.kind == 'star' && G.system(s).planets.some(p => p.ruins)));
	const ctx = {space: 'claimed', port: true, holder: 'x'};

	/* 1. determinism */
	const a = JSON.stringify(stars.slice(0, 400).map(s => St.sitesAt(s, 7, ctx))), b = JSON.stringify(stars.slice(0, 400).map(s => St.sitesAt(s, 7, ctx)));
	const la = ruinStars.slice(0, 40).flatMap(s => St.sitesAt(s, 7, ctx)).map(x => JSON.stringify(St.layout(x))), lb = ruinStars.slice(0, 40).flatMap(s => St.sitesAt(s, 7, ctx)).map(x => JSON.stringify(St.layout(x)));
	ok('1. the same star and season give the same sites and the same layouts', a == b && la.join() == lb.join() && la.length > 10, la.length);

	/* 2. nothing else moves */
	const sys0 = ruinStars.slice(0, 60).map(s => JSON.stringify(G.system(s))), ports0 = ruinStars.slice(0, 60).map(s => JSON.stringify(Sf.ports(s, 'lantern')));
	ruinStars.slice(0, 60).forEach(s => St.sitesAt(s, 3, {space: 'contested', port: true, cls: 'lantern'}));
	ok('2. working out sites moves no world, ruin or port', ruinStars.slice(0, 60).every((s, i) => JSON.stringify(G.system(s)) == sys0[i] && JSON.stringify(Sf.ports(s, 'lantern')) == ports0[i]));

	/* 3. the ruins' kinds */
	let fields = 0, outliers = 0, wrong = [];
	for (const s of ruinStars) {
		const ruin = G.system(s).planets.find(p => p.ruins), xs = St.sitesAt(s, 0, {}), canLand = L.landable(ruin).ok;
		for (const x of xs) {
			if (x.kind == 'field') { fields++; if (!canLand || x.world != ruin.name) wrong.push(['field', s.id]) }
			if (x.kind == 'outlier') { outliers++; if (canLand || x.world == ruin.name || x.of != ruin.name) wrong.push(['outlier', s.id]) }
		}
	}
	const share = ruinStars.filter(s => L.landable(G.system(s).planets.find(p => p.ruins)).ok).length / ruinStars.length;
	ok('3. a ruin field stands on the ruin world when it can be landed on (about a fifth of them), an outlying ruin on another body when it can\'t', !wrong.length && fields > 20 && outliers > fields && share > 0.15 && share < 0.32, {fields, outliers, share, wrong: wrong.slice(0, 4)});

	/* 4. outliers on a moon whenever there's one */
	let onMoon = 0, onGiant = 0, onPlanetWithMoon = 0, onPlanet = 0, onFarthest = 0;
	for (const s of ruinStars) for (const x of St.sitesAt(s, 0, {})) if (x.kind == 'outlier') {
		const sy = G.system(s), ruin = sy.planets.find(p => p.ruins), moons = sy.planets.flatMap(p => p.moons || []).filter(m => L.landable(m).ok && m.name != ruin.name);
		if (x.moon) { onMoon++; if (x.giantMoon) onGiant++ } else { if (moons.length) onPlanetWithMoon++; onPlanet++; const far = sy.planets.filter(p => p != ruin && L.landable(p).ok).reduce((a, p) => !a || p.a > a.a ? p : a, null); if (far && far.name == x.world) onFarthest++ }
	}
	ok('4. an outlying ruin (a waystation or relay) is on a moon whenever there\'s one to land on, a gas giant\'s most often; otherwise usually on the planet farthest from the star', onPlanetWithMoon == 0 && onMoon > outliers * 0.45 && onGiant > onMoon * 0.5 && onPlanet > 10 && onFarthest > onPlanet * 0.75, {onMoon, onGiant, outliers, onPlanetWithMoon, onPlanet, onFarthest});

	/* 5. placement */
	const bad = [];
	for (const s of [...stars.slice(0, 2000), ...ruinStars]) {
		const sy = G.system(s), bodies = sy.planets.flatMap(p => [p, ...(p.moons || [])]), ports = Sf.ports(s, 'lantern');
		for (const x of St.sitesAt(s, 5, {space: 'contested', port: true, cls: 'lantern'})) {
			const p = bodies.find(q => q.name == x.world), R = St.worldR(p);
			if (!L.landable(p).ok) bad.push([x.id, 'not landable']);
			if (x.radius > St.SITES.share * R + 1e-6) bad.push([x.id, 'past its share']);
			if (Math.abs(x.lat) > St.SITES.polar) bad.push([x.id, 'polar']);
			for (const q of ports) if (q.world == x.world) {
				const d = [Math.cos(q.lat * Math.PI / 180) * Math.cos(q.lon * Math.PI / 180), Math.cos(q.lat * Math.PI / 180) * Math.sin(q.lon * Math.PI / 180), Math.sin(q.lat * Math.PI / 180)];
				const ang = Math.acos(Math.max(-1, Math.min(1, d[0] * x.dir[0] + d[1] * x.dir[1] + d[2] * x.dir[2])));
				if (ang * R < Sf.KIND[q.kind].radius + x.radius) bad.push([x.id, 'on ' + q.id]);
			}
		}
	}
	ok('5. every site is on ground that can be landed on, within its world\'s share, off the poles and clear of every port\'s site', !bad.length, bad.slice(0, 5));

	/* 6. rates: old hulks by the space, fresh wrecks by the season */
	const withLand = stars.filter(s => G.system(s).planets.flatMap(p => [p, ...(p.moons || [])]).some(p => L.landable(p).ok));
	const rate = (space, lane) => withLand.filter(s => St.sitesAt(s, 0, {space, lane}).some(x => x.kind == 'hulk')).length / withLand.length;
	const rc = rate('claimed'), rk = rate('contested'), ru = rate('unclaimed'), rl = rate('claimed', true);
	ok('6. old hulks: about 3% of systems with landable ground in claimed space, 6% on a front, 4% unclaimed, 8% near a long lane', Math.abs(rc - 0.03) < 0.012 && Math.abs(rk - 0.06) < 0.015 && Math.abs(ru - 0.04) < 0.012 && Math.abs(rl - 0.08) < 0.02 && rk > rc, {rc, rk, ru, rl, n: withLand.length});
	const w1 = withLand.map(s => St.sitesAt(s, 12, ctx).filter(x => x.kind == 'wreck').map(x => x.id).join()), w1b = withLand.map(s => St.sitesAt(s, 12, ctx).filter(x => x.kind == 'wreck').map(x => x.id).join()), w2 = withLand.map(s => St.sitesAt(s, 13, ctx).filter(x => x.kind == 'wreck').map(x => x.id).join());
	const n1 = w1.filter(Boolean).length, moved = w1.filter((x, i) => x != w2[i]).length, days = withLand.flatMap(s => St.sitesAt(s, 12, ctx).filter(x => x.kind == 'wreck').map(x => x.day));
	const noPort = withLand.filter(s => St.sitesAt(s, 12, {space: 'claimed'}).some(x => x.kind == 'wreck')).length;
	ok('7. fresh wrecks: about 8% of claimed systems with a port a season, the same all season, different the next, on a day within it; none without a port', w1.join('|') == w1b.join('|') && Math.abs(n1 / withLand.length - 0.08) < 0.02 && moved > n1 && days.every(d => d >= 360 && d < 390) && noPort == 0, {n1, moved, rate: n1 / withLand.length});

	/* 8. peoples */
	const ps = ruinStars.flatMap(s => St.sitesAt(s, 0, {}).filter(x => x.people).map(x => ({x, p: St.peopleOf(s)})));
	const byPeople = {}; for (const {x} of ps) (byPeople[x.people] = byPeople[x.people] || new Set()).add(x.kind == 'outlier' ? 'relay' : x.style);
	const fieldStyles = Object.values(byPeople).every(set => [...set].filter(t => t != 'relay').length <= 1);
	ok('8. ruins belong to the people of their 30 pc cell: one name and one style a people, the same for every site of theirs', ps.length > 50 && ps.every(({x, p}) => x.people == p.id && x.peopleName == p.name && (x.kind == 'outlier' || x.style == p.style)) && fieldStyles && Object.keys(byPeople).length >= 5 && Object.keys(St.STYLES).includes(St.peopleOf(ruinStars[0]).style), Object.keys(byPeople).length);

	/* 9-11. layouts: 200 seeds a kind */
	const ships = Sh.ships(), kinds = [...Object.keys(St.STYLES).map(style => ({kind: 'field', style})), {kind: 'outlier', style: 'relay'}, {kind: 'precursor', style: 'precursor'}, {kind: 'hulk'}, {kind: 'wreck'}];
	const breaks = [], over = [], cones = [], fallenPre = [], guard = {};
	for (const k of kinds) for (let i = 0; i < 200; i++) {
		const seed = (i * 2654435761 + 97) >>> 0, sh = ships[i % ships.length];
		const site = k.kind == 'hulk' || k.kind == 'wreck' ? {kind: k.kind, id: 't:' + k.kind + i, radius: sh.length * 7.2 + 60, seed, ship: sh.id, length: sh.length, recorder: true, pod: i % 3 == 0}
			: {kind: k.kind, id: 't:' + k.kind + i, radius: St.SITES[k.kind].r[0] + (St.SITES[k.kind].r[1] - St.SITES[k.kind].r[0]) * (i / 199), seed, age: k.kind == 'precursor' ? 0 : 1 + 8 * ((i * 37) % 100) / 100, style: k.style, stone: [0.6, 0.55, 0.45], Ts: [100, 200, 400][i % 3], giantMoon: i % 2 == 0};
		const Lo = St.layout(site), bk = St.check(Lo); if (bk.length) breaks.push([k.kind, k.style, i, bk]);
		const hi = St.meshes(Lo, 'hi').count(), lo = St.meshes(Lo, 'lo').count();
		if (Lo.hull) { const hull = Me.ship(sh.length, 'high').count(); if (hi - hull > St.BUDGET.debris) over.push([k.kind, i, hi - hull]) }
		else {
			if (hi > St.BUDGET.hi || lo > St.BUDGET.lo) over.push([k.kind, k.style, i, hi, lo]);
			for (const p of Lo.plazas) for (const s of [...Lo.structs, ...Lo.wardens]) if (Math.hypot(p.c[0] - s.c[0], p.c[1] - s.c[1]) < p.r + s.r + s.h * Sf.CONE - 0.01) cones.push([k.kind, i]);
			if (k.kind == 'precursor' && Lo.structs.some(s => s.fallen)) fallenPre.push(i);
			(guard[k.kind] = guard[k.kind] || new Set()).add(Lo.wardens.length);
		}
	}
	ok('9. every layout keeps its rules over 200 seeds a kind (nothing overlaps, off the site, on the vault, or in a plaza\'s cone; the vault beside its plaza; debris on the site)', !breaks.length && !cones.length, {breaks: breaks.slice(0, 3), cones: cones.slice(0, 3)});
	ok('10. the triangle budgets hold: a ruin at most 3,000 at full detail and 1,400 at low; a wreck its ship\'s mesh and at most 600 more', !over.length, over.slice(0, 4));
	ok('11. guardians: 2 or 3 wardens at a ruin field, 1 at an outlier, 2 to 4 pylons at a Precursor site; nothing Precursor has fallen', [...guard.field].every(n => n >= 2 && n <= 3) && [...guard.outlier].every(n => n == 1) && [...guard.precursor].every(n => n >= 2 && n <= 4) && !fallenPre.length, {g: Object.fromEntries(Object.entries(guard).map(([k, v]) => [k, [...v]])), fallenPre: fallenPre.length});

	/* 12. the Rift */
	G.realm('rift');
	const rift = G.starsNear(20, 10, 0, 6).filter(s => s.kind == 'star').slice(0, 4000), rs = rift.flatMap(s => St.sitesAt(s, 0, {space: 'unclaimed', port: true}));
	G.realm('normal');
	const kindsR = new Set(rs.map(x => x.kind)), hulksR = rs.filter(x => x.kind == 'hulk');
	ok('12. in the Rift: Precursor sites and hulks only (no outliers, no fresh wrecks), the hulks Riftborn or, one in five, old Precursor craft', kindsR.has('precursor') && [...kindsR].every(k => k == 'precursor' || k == 'hulk') && hulksR.every(x => x.riftborn != x.precursor) && hulksR.filter(x => x.precursor).length > hulksR.length * 0.08 && hulksR.filter(x => x.precursor).length < hulksR.length * 0.35, {kinds: [...kindsR], hulks: hulksR.length, pre: hulksR.filter(x => x.precursor).length});

	/* 13. speed */
	const t0 = process.hrtime.bigint(); for (const s of stars.slice(0, 2000)) St.sitesAt(s, 9, ctx); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 2000;
	ok('13. a system\'s sites are worked out in under a millisecond', ms < 1, ms.toFixed(3) + ' ms');

	/* 14. the new shapes */
	const f = Me.frustum(10, 2, 0, 30, 8, [1, 1, 1, 0]), sd = Me.shard(5, 30, [1, 1, 1, 0]), bx = Me.box([0, 0, 5], [1, 1, 5], [1, 1, 1, 0]).tilt(Math.PI / 2, 0);
	let topZ = -1e9; for (let i = 2; i < bx.p.length; i += 3) topZ = Math.max(topZ, bx.p[i]);
	let fz = [Infinity, -Infinity]; for (let i = 2; i < f.p.length; i += 3) { fz[0] = Math.min(fz[0], f.p[i]); fz[1] = Math.max(fz[1], f.p[i]) }
	ok('14. the new shapes: a frustum (spires, mounds, plinths), a shard of 8 faces, and any part tilted (a box 10 m tall, laid flat, stands 1 m)', f.count() == 32 && fz[0] == 0 && fz[1] == 30 && sd.count() == 8 && Math.abs(topZ - 1) < 1e-9, {f: f.count(), sd: sd.count(), topZ});
	/* (L4.2) surveyed from the ground */
	const mk = (kind, i) => ({kind, id: 't:' + kind + ':' + i, seed: (i * 2246822519 + 13) >>> 0, radius: St.SITES[kind].r[0], age: 4, style: 'terraces', stone: [0.6, 0.5, 0.4], Ts: 200});
	let tons = 0, structs = 0, vaults = [], vaultsO = [], ph = 0, al = 0;
	for (let i = 0; i < 2000; i++) {
		const f = mk('field', i), o = mk('outlier', i);
		for (let n = 1; n <= 4; n++) { structs++; if (St.structYield(f, n).ton) tons++ }
		const v = St.vaultCache(f); vaults.push(v.tons); vaultsO.push(St.vaultCache(o).tons);
		if (v.bp && v.bp.id == 'phaser') ph++; if (v.bp && v.bp.id == 'alien') al++;
	}
	const same = JSON.stringify(St.vaultCache(mk('field', 7))) == JSON.stringify(St.vaultCache(mk('field', 7))) && JSON.stringify(St.structYield(mk('field', 7), 2)) == JSON.stringify(St.structYield(mk('field', 7), 2));
	ok('15. (L4.2) what the ground gives, the same in every save: half the structures a tonne of Artefacts; the vault 4-8 t (an outlier\'s half), a phaser blueprint 20% of the time, a relay booster\'s 20%', same && Math.abs(tons / structs - 0.5) < 0.03 && Math.min(...vaults) >= 4 && Math.max(...vaults) <= 8 && Math.max(...vaultsO) <= 4 && Math.abs(ph / 2000 - 0.2) < 0.03 && Math.abs(al / 2000 - 0.2) < 0.03, {t: tons / structs, ph: ph / 2000, al: al / 2000, vmin: Math.min(...vaults), vmax: Math.max(...vaults), omax: Math.max(...vaultsO)});
	const B = St.BITS, f0 = mk('field', 1);
	ok('16. (L4.2) site data: 4,000 SU, 800 a structure, 2,000 for the vault; an outlier half; twice in the Rift; nothing before anything\'s surveyed', St.dataWorth(f0, 0) == 0 && St.dataWorth(f0, B.struct(1)) == 4800 && St.dataWorth(f0, B.struct(1) | B.struct(3) | B.VAULT) == 7600 && St.dataWorth(mk('outlier', 1), B.struct(1)) == 2400 && St.dataWorth(Object.assign({}, f0, {rift: true}), B.struct(1)) == 9600);
	let piecesOk = true;
	for (let i = 0; i < 60; i++) { const Lo = St.layout(mk(i % 2 ? 'field' : 'outlier', i)), pc = St.pieces(Lo); if (pc.reduce((t, p) => t + St.pieceMesh(p, 'hi').count(), 0) != St.meshes(Lo, 'hi').count() || pc.filter(p => p.flat).length != Lo.plazas.length + 1 || pc.filter(p => p.struct).length != Lo.structs.length + Lo.wardens.length) piecesOk = false }
	ok('17. (L4.2) the model in pieces (plazas and the vault on flats, each structure at its own ground) is the whole model', piecesOk);
	/* the record */
	const P1 = Tr.newPlayer(F.majors()[0].id), star = {id: '1,2,3/#4'}, site = {id: 'site:Vela b:field', kind: 'field'};
	const a1 = X.siteSeen(P1, star, site, false, 10), again = X.siteSeen(P1, star, site, false, 12), withPort = X.siteSeen(Tr.newPlayer(F.majors()[0].id), star, site, true, 10);
	const m1 = X.siteMark(P1, star, site, B.struct(2), false, 11), m1b = X.siteMark(P1, star, site, B.struct(2), false, 11);
	const u1 = X.unsold(P1).filter(x => x.kind == 'site'), sold = X.sell(P1, null, 'SU', 11); X.siteMark(P1, star, site, B.VAULT, false, 12); const u2 = X.unsold(P1).filter(x => x.kind == 'site');
	ok('18. (L4.2) a site\'s record: begun when found (a first discovery unless its system has a port), each structure or the vault once, its data sold as far as it\'s surveyed and the rest later', a1.new && a1.first && !again.new && !withPort.first && m1 && !m1b && u1.length == 1 && u1[0].su == 4800 * 2.5 && sold.ok && u2.length == 1 && u2[0].su == 2000 * 2.5, {u1, u2});
	/* saved, cleaned, shared */
	P1.explore.site['bad|x'] = {d: 'x'};
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(P1))));
	const gal = Sv.newGalaxy(10), packed = Sv.packGalaxy(gal, P1, 'p1', 12), gal2 = Sv.unpackGalaxy(Sv.merge(Sv.split(packed).head, Sv.split(packed).parts)), P2 = Sv.joinGalaxy(Tr.newPlayer(F.majors()[1].id), gal2, 'p2');
	const k = X.siteKey(star.id, site.id), second = X.siteSeen(P2, star, site, false, 13);
	ok('19. (L4.2) saved and back (an unsound entry dropped, the rest kept); a first discovery of a site is the galaxy\'s: another pilot finding it after isn\'t first', back.explore.site[k] && back.explore.site[k].b == (B.struct(2) | B.VAULT) && !back.explore.site['bad|x'] && gal2.world.firsts.site[k] == 'p1' && second.new && !second.first, {k, firsts: gal2.world.firsts.site, second});
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
