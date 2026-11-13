/* Ember Reach's Rift: the Maw at the galaxy's centre, the galaxy upside down beyond it, the Riftborn, its goods, and
   the Precursors' blueprints, modules and hulls, in node.
     node tests/emberreach_rift_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const req = n => require(path.join(DIR, n));
const G = req('galaxy.js'), F = req('factions.js'), T = req('travel.js'), E = req('economy.js'), En = req('encounters.js'), O = req('outfit.js'), S = req('ships.js'),
	Tr = req('trade.js'), Mi = req('mining.js'), Sc = req('scene.js'), C = req('combat.js'), X = req('explore.js'), Sv = req('save.js'), Ca = req('canisters.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
try {
	/* the Maw */
	const maw = G.starsNear(0.01, 0, 0, 0.05).find(s => s.heart);
	ok('1. the Maw, a black hole of five million suns, sits at the centre and turns up near it', maw && maw.kind == 'black hole' && maw.M == 5e6 && maw.id == 'heart' && maw.name == 'The Maw');
	/* (the capitals and home worlds as they were before the Rift: a fixed list) */
	const CAPS = ['1,-3,264/#0|Seniabrears f', '0,-1,254/#2|Gemuzeiavin g', '-11,1,261/#0|Nyejunaera g', '-8,-9,259/#5|Ishimos e', '8,3,269/#0|Isho f'];
	ok('2. the great powers were laid out without it: their capitals are where they were', CAPS.every((c, i) => F.majors()[i].star.id + '|' + F.majors()[i].home.name == c));
	const sc = Sc.build(maw, {day: 200, port: null}), b = sc.bodies[0];
	ok('3. its system: no worlds; the horizon 0.1 AU across, and the safety keeps three radii off (cruise drops short of that)', !G.system(maw).planets.length && b.bh && Math.abs(b.radius - 2953 * 5e6) < 10 && Sc.safeDist(b) == 3 * b.radius && Sc.dropRange(b) > Sc.safeDist(b));
	ok('4. nobody holds the Maw, and it has no port', !T.ownerOf(maw, 200).owner && !T.portFor(maw, 200));
	/* the Rift */
	const home = F.majors()[0].star, near = G.starsNear(home.x, home.y, home.z, 3).filter(s => s.kind == 'star').slice(0, 30);
	const rift = G.inRealm('rift', () => G.starsNear(home.x, home.y, -home.z, 3)).filter(s => s.kind == 'star');
	ok('5. the Rift is the galaxy upside down: the same stars, turned over (z the other way), with ids "R:" and their names reversed', near.every(s => { const r = rift.find(x => x.id == 'R:' + s.id); return r && r.z == -s.z && r.x == s.x && r.cls == s.cls && r.M == s.M && r.name.toLowerCase() == s.name.toLowerCase().split('').reverse().join('') }));
	ok('6. outside inRealm, the galaxy is the normal one', G.realm() == 'normal' && G.starsNear(home.x, home.y, -home.z, 1).every(s => !s.rift));
	const mawR = G.inRealm('rift', () => G.starsNear(0, 0, 0, 0.01)).find(s => s.heart);
	ok('7. the Maw is there on the Rift side too, its way home', mawR && mawR.id == 'R:heart' && mawR.rift);
	/* the Rift's worlds */
	const sample = G.sampleGalaxy(2500, 31).filter(s => s.kind == 'star').map(G.riftOf), sys = sample.map(s => G.system(s)), pl = sys.flatMap(x => x.planets);
	const norm = G.sampleGalaxy(2500, 31).filter(s => s.kind == 'star').map(s => G.system(s));
	ok('8. its worlds are its own (drawn afresh), and nothing lives on any of them', pl.length > 1000 && pl.every(p => !p.alive && !p.life && p.rift) && JSON.stringify(sys.slice(0, 20).map(x => x.planets.length)) != JSON.stringify(norm.slice(0, 20).map(x => x.planets.length)));
	const withRock = sys.filter(x => x.planets.some(p => !p.gas)), ruins = withRock.filter(x => x.planets.some(p => p.precursor)).length / withRock.length;
	ok('9. Precursor ruins in about one system in ten with a rocky world; no other ruins there', ruins > 0.06 && ruins < 0.14 && pl.every(p => !p.ruins || p.precursor), (ruins * 100).toFixed(1) + '%');
	const has = g => pl.filter(p => p.res.includes(g)).length;
	ok('10. its rocks hold nullite and voidglass, its gas giants aetherium; none of them anywhere this side', has('Nullite') > 100 && has('Voidglass') > 30 && has('Aetherium') > 30 && norm.flatMap(x => x.planets).every(p => !p.res.some(r => E.RIFT_GOODS.includes(r))));
	ok('11. a Rift star is found again by its id and place (saves, routes)', (() => { const r = rift[3]; const a = T.starAt(r.id, [r.x, r.y, r.z]), b = X.starById(r.id); return a && b && a.id == r.id && b.id == r.id && a.rift && b.rift })());
	/* ports: the Precursors' anchorages */
	const st = G.inRealm('rift', () => G.starsNear(0, 0, 30, 3)).filter(s => s.kind == 'star'), anch = st.filter(s => T.portFor(s, 200));
	ok('12. no power holds anything in the Rift; its ports are anchorages, in about one system in twenty-five', st.every(s => !T.ownerOf(s, 200).owner) && anch.length / st.length > 0.015 && anch.length / st.length < 0.05 && anch.every(s => T.portFor(s, 200).anchorage && !T.portFor(s, 200).owner), anch.length + ' of ' + st.length);
	ok('13. no routes through the powers\' lanes in the Rift', (() => { const a = st[0], z = st[st.length - 1], r = G.inRealm('rift', () => T.route(a, z, 30)); return r.ok && r.legs.every(l => l.kind == 'jump' && l.star.rift) })());
	/* goods */
	const mN = E.market(home, 200), mR = E.market(anch[0], 200);
	ok('14. this side, everyone buys the Rift\'s goods at a premium and nobody sells them', E.RIFT_GOODS.every(g => mN.prices[g].buy && mN.prices[g].none && mN.prices[g].su > E.GOODS[g]));
	ok('15. a Rift anchorage trades in SU and pays half for them', mR.currency == 'SU' && !mR.holder && E.RIFT_GOODS.every(g => mR.prices[g].su < E.GOODS[g] * 0.7));
	const me = Tr.newPlayer(F.majors()[0].id), sh = S.hull(me.ship.model);
	ok('16. you can\'t buy them this side', !Tr.buy(me, sh, mN, 'Nullite', 1, 200).ok && Tr.canBuy(me, sh, mN, 'Nullite', 200) == 0);
	/* mining */
	const rs = sample.find(s => G.system(s).planets.some(p => p.ring));
	const fake = {bodies: [{kind: 'star', pos: [0, 0, 0], radius: 7e8}, ...G.system(rs).planets.map((p, i) => ({kind: 'planet', name: p.name, pos: [(i + 1) * 1.5e11, 0, 0], radius: 7e6, ring: p.ring, ringDensity: p.ringDensity, axis: [0, 0, 1]}))]};
	const fields = Mi.fields(fake, rs), rocks = fields.flatMap(f => Mi.rocks(Object.assign(f, {fieldKind: f.kind})));
	ok('17. the Rift\'s rings and belts carry its ores', fields.every(f => f.rift) && rocks.some(r => Object.keys(r.comp).some(g => E.RIFT_GOODS.includes(g))));
	/* the Riftborn */
	const cast = [...Array(40)].flatMap((_, v) => En.cast(rift[0], 200, me, {visit: v}));
	const rb = cast.filter(n => n.role == 'riftborn');
	ok('18. the Rift\'s ships are the Riftborn, and nothing else', cast.length && rb.length == cast.length);
	const base = S.hull(rb[0].ship.id);
	ok('19. far tougher and harder-hitting than the hulls they copy (3x hull and shields, 2.2x damage)', rb[0].ship.hull == Math.round(base.hull * 3) && rb[0].ship.shield == Math.round(base.shield * 3) && C.state(O.derive(rb[0].ship)).dmgK == 2.2);
	ok('20. they attack you, and everyone else', En.hostile(me, rb[0]) && En.enemies(rb[0], {role: 'trader', faction: F.majors()[0].id}, me));
	const mawCast = [...Array(40)].flatMap((_, v) => En.cast(maw, 200, me, {visit: v}));
	ok('21. some slip through to the Maw this side; packs of 3-5 at the Rift\'s Maw', mawCast.some(n => n.role == 'riftborn') && [1, 2, 3].some(v => En.cast(mawR, 200, me, {visit: v}).length >= 3));
	ok('22. their wrecks drop the Rift\'s goods', [...Array(30)].flatMap(() => Ca.wreck('riftborn', rb[0].ship)).every(g => E.RIFT_GOODS.includes(g)));
	/* Precursor blueprints */
	const r = seeded(9), bps = [...Array(400)].map(() => O.precursorFrom(r)).filter(Boolean);
	ok('23. a Precursor ruin gives a blueprint more often than not: hulls, weapons and modules', bps.length > 200 && bps.some(b => b.id == 'hull') && bps.some(b => b.mod == 'lance') && bps.some(b => b.mod == 'shield'), bps.length + ' of 400');
	ok('24. every Precursor recipe takes goods from both sides of the Maw', bps.every(b => { const g = Object.keys(O.recipe(b).goods); return g.some(x => E.RIFT_GOODS.includes(x)) && g.some(x => !E.RIFT_GOODS.includes(x)) }));
	ok('25. no outfitter sells Precursor work', ['core', 'internal', 'external'].every(cat => O.offers(S.hull('corsair'), cat == 'core' ? {cat, key: 'power'} : {cat, i: 0}, {cls: 'halo'}).every(o => o.grade != 'P' && !O.CAT[o.id].precursor)));
	/* building them */
	const pl2 = Tr.newPlayer(F.majors()[0].id), corsair = S.hull('corsair'), cs = O.layout(corsair).coreSize;
	pl2.wallet = {SU: 1e9}; const pay = fee => ({ok: true, code: 'SU', amount: fee});
	const shBp = {id: 'precursor', mod: 'shield', size: 4}, rc = O.recipe(shBp); pl2.cargo = Object.assign({}, rc.goods); pl2.cost = {};
	O.learn(pl2, shBp); let res = O.build(pl2, pl2.blueprints[0], pay, {coreSize: cs});
	ok('26. the broker builds a Precursor shield (grade P), using up the blueprint and the goods', res.ok && res.module.grade == 'P' && res.module.id == 'shield' && !pl2.blueprints.length && !Object.keys(pl2.cargo).length, res.why);
	const sA = O.derive(corsair, (() => { const f = O.stock(corsair); f.internal[0] = {id: 'shield', size: 4, grade: 'A'}; f.core.power.grade = 'A'; return f })()).shield;
	const sP = O.derive(corsair, (() => { const f = O.stock(corsair); f.internal[0] = {id: 'shield', size: 4, grade: 'P'}; f.core.power.grade = 'A'; return f })()).shield;
	ok('27. stronger than the best you can buy (an A-grade of the same size)', sP > sA * 1.2, Math.round(sA) + ' vs ' + Math.round(sP));
	const pw = {id: 'precursor', mod: 'power', size: 0}; pl2.cargo = Object.assign({}, O.recipe(pw).goods); O.learn(pl2, pw);
	ok('28. a Precursor core module is made at your hull\'s size (and needs the hull there to measure)', !O.build(pl2, pl2.blueprints[0], pay, {}).ok && (res = O.build(pl2, pl2.blueprints[0], pay, {coreSize: cs})).ok && res.module.size == cs);
	const lance = {id: 'lance', size: 3, grade: 'P'};
	ok('29. the Precursor lance outhits the heavy laser, and the needle the pulse laser', C.WEAPONS.lance.dmg > C.WEAPONS.heavy.dmg * 2 && C.WEAPONS.needle.dmg > C.WEAPONS.pulse.dmg * 2 && O.install(corsair, (() => { const f = O.stock(corsair); f.core.power.grade = 'A'; return f })(), {cat: 'external', i: O.layout(corsair).external.indexOf(3)}, lance).ok);
	const mat = O.materials({id: 'shield', size: 4, grade: 'P'});
	ok('30. recycling Precursor work gives its blueprint back, with half the goods', mat.blueprint && mat.blueprint.id == 'precursor' && mat.blueprint.mod == 'shield' && mat.goods.Nullite == Math.floor(rc.goods.Nullite / 2));
	/* hulls */
	const H = S.precursors(), bySize = z => S.ships().filter(s => s.size == z);
	ok('31. four Precursor hulls, named for the oldest extinct things, never sold', H.length == 4 && H.every(h => /^[A-Z][a-z]+$/.test(h.name) && h.precursor && S.price(h.id, home, 200) == null) && Tr.yard('halo', home, 200).every(x => !x.ship.precursor));
	ok('32. each beats every stock hull of its size on hull, shields and speed', H.every(h => bySize(h.size).every(s => h.hull > s.hull * 0.95 && h.shield > s.shield && h.speed > s.speed * 0.95)));
	const hb = {id: 'hull', hull: 'anomalocaris', size: 0}, hr = O.recipe(hb); pl2.cargo = Object.assign({}, hr.goods); O.learn(pl2, hb); res = O.build(pl2, pl2.blueprints[0], pay, {coreSize: cs, held: 0});
	ok('33. the broker builds a Precursor hull from its blueprint', res.ok && res.hull == 'anomalocaris' && S.hull('anomalocaris').precursor);
	/* the save */
	const sv = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(Object.assign(pl2, {blueprints: [shBp, hb, {id: 'precursor', mod: 'bogus', size: 1}], rift: {first: 300, crossings: 2}, ship: {model: 'anomalocaris', fit: O.stock(S.hull('anomalocaris'))}})))));
	ok('34. the save keeps Precursor blueprints (and drops nonsense), the first crossing, and a Precursor hull with its fit', sv && sv.blueprints.length == 2 && sv.rift.first == 300 && sv.ship.model == 'anomalocaris' && sv.ship.fit);
	ok('35. exploration data from the Rift is worth twice as much, a Precursor ruin\'s far more', (() => { const p = pl.find(q => q.precursor), n = Object.assign({}, p, {rift: false, precursor: false}); return X.worth(p) > X.worth(n) * 2 })());
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
