/* Ember Reach's colonies, part 1 (apps/rudolf-emberreach/www/colonies.js): claims, the beacon, goods, haulage, lapses, in node.
     node tests/emberreach_colonies_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Co = require(path.join(DIR, 'colonies.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js')), Tr = require(path.join(DIR, 'trade.js')), T = require(path.join(DIR, 'travel.js')),
	E = require(path.join(DIR, 'economy.js')), Sv = require(path.join(DIR, 'save.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const sum = o => Object.values(o).reduce((t, v) => t + v, 0);
try {
	const day = 200, JUMP = 6;
	/* (0.3.6: claims go only to unclaimed space, so the office is one of the power's ports on its border: the first
	   found walking out from its capital with unclaimed systems within a jump) */
	const home = F.majors()[5], pl = Tr.newPlayer(home.id), cur = home.currency.code;
	const office = (() => { for (let k = 0; k < 12; k++) { const a = k * 2.4, b = Math.sin(k * 1.7) * 0.3, dir = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
		for (let r = home.claim * 0.5; r < home.claim * 1.5; r += home.claim * 0.04) { const p = home.at.map((v, i) => v + dir[i] * r);
			for (const x of G.starsNear(p[0], p[1], p[2], 3).filter(y => y.kind == 'star').slice(0, 6)) { const pf = T.portFor(x, 200); if (pf && pf.owner == home.id && Co.candidates(Tr.newPlayer(home.id), {star: x, owner: home.id}, 200, 6, 3).length >= 3) return {star: x, owner: home.id} } } } })();
	pl.wallet[cur] = 1e9;
	ok('1. the primary ports\' goods: about 1,500 t for an outpost, 8,000 for a station, 25,000 for a great port', Math.abs(sum(Co.PORTS.outpost.goods) - 1500) <= 1 && Math.abs(sum(Co.PORTS.station.goods) - 9000) <= 1000 && Math.abs(sum(Co.PORTS.great.goods) - 25000) <= 1000);
	const near = G.starsNear(office.star.x, office.star.y, office.star.z, JUMP).filter(s => s.kind == 'star' && s.id != home.star.id);
	const bare = near.find(s => !G.system(s).planets.length), far = G.starsNear(office.star.x, office.star.y, office.star.z, 12).find(s => s.d > JUMP + 1 && G.system(s).planets.length);
	ok('2. no claims beyond one jump, or on a system with no planets, or on the capital itself', (!bare || !Co.canClaim(pl, office, bare, 'outpost', day, JUMP).ok) && !Co.canClaim(pl, office, far, 'outpost', day, JUMP).ok && !Co.canClaim(pl, office, home.star, 'outpost', day, JUMP).ok);
	const cands = Co.candidates(pl, office, day, JUMP, 6), s1 = cands[0];
	ok('3. the planner finds claimable systems within a jump', cands.length > 0 && cands.every(s => s.d <= JUMP && G.system(s).planets.length), cands.length + ' found');
	const inside = !!F.claimAt([s1.x, s1.y, s1.z]).owner, low = Tr.newPlayer(home.id); low.wallet[cur] = 1e9; low.rep[home.id] = 50;
	const own = near.find(x => G.system(x).planets.length && F.claimAt([x.x, x.y, x.z]).owner == home.id && !F.claimAt([x.x, x.y, x.z]).contested && T.wildAt(x, day));
	ok('4. (0.3.6) no claims inside a power\'s space, even its own, even Friendly: its uninhabited systems stay so; the planner offers only unclaimed space', !inside && own && !Co.canClaim(pl, office, own, 'outpost', day, JUMP).ok && /stay uninhabited/.test(Co.canClaim(pl, office, own, 'outpost', day, JUMP).why) && cands.every(x => !F.claimAt([x.x, x.y, x.z]).owner), own && own.name);
	const enemy = F.majors().find(m => F.relation(home.id, m.id) < 0), core = {x: 0, y: 0, z: 10, id: 'core', name: 'core'};
	ok('5. never in the Core, nor through an office that isn\'t a great power\'s', !Co.canClaim(pl, {star: core, owner: home.id}, core, 'outpost', day, 50).ok && !Co.canClaim(pl, {star: home.star, owner: 'freeport0'}, s1, 'outpost', day, JUMP).ok);
	/* claim, beacon, build */
	const w0 = pl.wallet[cur], c = Co.claim(pl, office, s1, 'outpost', day, JUMP).colony;
	ok('6. a claim costs the fee in the sponsor\'s coin; the beacon is due in 2 days', c && Math.abs(w0 - pl.wallet[cur] - Co.PORTS.outpost.fee * E.rate(cur, day)) < 1 && c.beaconBy == day + 2 && c.stage == 'claimed');
	ok('7. one open claim at a time', !Co.claim(pl, office, cands[1], 'outpost', day, JUMP).ok);
	Co.beacon(pl, c, day + 1);
	ok('8. the beacon starts a season\'s build', c.stage == 'building' && c.due == day + 31);
	pl.cargo = {Iron: 250, Food: 30, Gold: 5}; pl.cost = {Iron: 4, Food: 8, Gold: 60};
	const g = Co.deliver(pl, c, day + 2);
	ok('9. delivering hands over only what the build needs', g.gave.Iron == 250 && g.gave.Food == 30 && !g.gave.Gold && pl.cargo.Gold == 5 && !pl.cargo.Iron);
	/* haulage */
	const mkt = E.market(office.star, day), q = Co.haulQuote(office, mkt, c, 'Aluminum', 300, day + 2), wB = pl.wallet[cur];
	const h = Co.postHaul(pl, office, mkt, c, 'Aluminum', 300, day + 2);
	ok('10. haulers charge 10-25% over the market (more far out), paid up front', h.ok && q.cost > mkt.prices.Aluminum.price * 300 * 1.1 - 1 && q.cost < mkt.prices.Aluminum.price * 300 * (1.25 + 0.004 * 7) + 1 && Math.abs(wB - pl.wallet[cur] - q.cost) < 1e-6);
	ok('11. ...and can\'t be over-ordered', !Co.postHaul(pl, office, mkt, c, 'Aluminum', 1, day + 2).ok);
	Co.turn(pl, day + 2); const before = c.got.Aluminum || 0; const news = Co.turn(pl, day + 2 + q.days);
	ok('12. the haulers arrive after their travel time', !before && c.got.Aluminum == 300 && news.some(n => /Aluminum/.test(n.text)));
	/* finish */
	const repB = pl.rep[home.id];
	for (const [gd, t] of Object.entries(Co.left(c))) pl.cargo[gd] = t;
	Co.deliver(pl, c, day + 10);
	ok('13. all the goods in: the outpost is built, opens the next day, and the sponsor is pleased', c.stage == 'done' && c.opens == day + 11 && pl.rep[home.id] >= Math.min(1000, repB + 140) && !Co.portOf(pl, s1, day + 10) && Co.portOf(pl, s1, day + 11).cls == 'trefoil' && Co.portOf(pl, s1, day + 11).owner == home.id);
	const cm = E.market(s1, day + 11, {holder: home.id});
	ok('14. its market trades in the sponsor\'s coin', cm.currency == cur && cm.holder == home.id);
	/* lapses */
	const p2 = Tr.newPlayer(home.id); p2.wallet[cur] = 1e9; const c2 = Co.claim(p2, office, s1, 'outpost', day, JUMP).colony;
	Co.turn(p2, day + 3);
	ok('15. no beacon in time: the claim lapses', c2.stage == 'lapsed');
	const p3 = Tr.newPlayer(home.id); p3.wallet[cur] = 1e9; const c3 = Co.claim(p3, office, s1, 'outpost', day, JUMP).colony; Co.beacon(p3, c3, day); p3.cargo = {Iron: 400}; Co.deliver(p3, c3, day); Co.turn(p3, day + 31);
	const again = Co.canClaim(p3, office, s1, 'outpost', day + 32, JUMP), c3b = Co.claim(p3, office, s1, 'outpost', day + 32, JUMP).colony;
	ok('16. the season out: the claim lapses, and a new claim costs a third less and keeps the salvage', c3.stage == 'lapsed' && again.salvage && Math.abs(again.fee - Co.PORTS.outpost.fee * (2 / 3) * E.rate(cur, day + 32)) < 1 && c3b.got.Iron == 400);
	/* budget */
	const p4 = Tr.newPlayer(home.id); p4.wallet[cur] = 1e9; p4.rep[home.id] = 350;
	ok('17. a colony budget by standing: one to start, one more per 100 above Friendly', Co.budget(p4, home.id) == 3 && Co.budget(Tr.newPlayer(home.id), home.id) == 3 && (p4.rep[home.id] = 150, Co.budget(p4, home.id) == 1));
	/* the save */
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pl))));
	ok('18. colonies and haulage come back from the save exactly', JSON.stringify(back.colonies) == JSON.stringify(pl.colonies) && JSON.stringify(back.hauls) == JSON.stringify(pl.hauls || []));
	/* ---- part 2: building out (the finished outpost from above) ---- */
	const sl = Co.slots(s1), sys = G.system(s1);
	ok('20. slots follow the bodies: rings add an orbital slot, no surface on gas giants or over 2.5 g, more surface with air and water',
		sl.length == sys.planets.length && sl.every(x => x.surface == 0 || (!x.p.gas && x.p.g < 2.5)) && sl.every(x => x.orbit >= 1) && sl.filter(x => x.p.ring && !x.p.gas).every(x => x.orbit >= 2));
	const portBody = sl.find(x => x.body == c.world), freeOrbit = sl.find(x => x.orbit > Co.used(c, x.body, 'orbit')).body;
	ok('21. the primary port takes an orbital slot at its world', Co.used(c, c.world, 'orbit') == 1);
	ok('22. points: an outpost earns one tier 2 point; tier 2 needs it, tier 3 needs tier 3 points', c.points.t2 == 1 && c.points.t3 == 0 && !Co.canBuild(c, s1, 'great', freeOrbit, 'orbit').ok && /tier 3/.test(Co.canBuild(c, s1, 'great', freeOrbit, 'orbit').why));
	const b1 = Co.startBuild(c, s1, 'mining', c.world, portBody.surface ? 'surface' : 'orbit', day + 12);
	ok('23. a tier 1 build starts with its goods to bring (no points)', b1.ok && Object.values(b1.build.need).reduce((t, v) => t + v, 0) >= 590 && c.points.t2 == 1);
	const ind = Co.startBuild(c, s1, 'industrial', freeOrbit, 'orbit', day + 12);
	ok('24. a tier 2 build spends the tier 2 point, and slots run out', ind.ok && c.points.t2 == 0 && !Co.canBuild(c, s1, 'habitat', c.world, 'orbit').ok, ind.why);
	for (const [g, t] of Object.entries(Co.left(b1.build))) pl.cargo[g] = t;
	const dv = Co.deliverBuilds(pl, c, day + 13);
	ok('25. goods handed over finish the build, and it earns a tier 2 point', b1.build.done && dv.done.includes(b1.build) && c.points.t2 >= 1);
	const ec = Co.economy(c, s1);
	ok('26. the port\'s economy comes from its links: here all extraction', Math.abs((ec.extraction || 0) - 1) < 1e-9);
	ok('27. the market follows it: the system\'s ores are for sale and cheaper, food dearer than its base and bought', (() => { const a = E.market(s1, day + 13, {holder: home.id}), b = E.market(s1, day + 13, {holder: home.id, econ: ec}), ore = Object.keys(a.prices).find(g => ['Iron', 'Copper', 'Coal', 'Lead', 'Aluminum', 'Titanium', 'Uranium', 'Beryllium', 'Jade', 'Gold', 'Diamond'].includes(g) && sys.planets.some(p => p.res.includes(g)));
		return b.prices[ore].su < a.prices[ore].su && !b.prices[ore].none && b.prices.Food.su > E.GOODS.Food && b.prices.Food.buy })());
	const fake = {world: 'A', builds: [{fac: 'farm', body: 'A', done: true}, {fac: 'mining', body: 'B', done: true}]};
	const starX = {FeH: 0, kind: 'star', x: s1.x, y: s1.y, z: s1.z};
	ok('28. strong links from the port\'s world, weak (5%) from elsewhere, and body boosts (life ×1.4 for farms)', Co.boost('agriculture', {alive: true}, starX) == 1.4 && Co.boost('extraction', {ring: 'Ice'}, starX) == 1.3 && Co.boost('hightech', {ruins: true}, {kind: 'white dwarf'}) == 1.5 * 1.2);
	ok('29. tier 3 builds cost 4 points, then 2 more each', Co.t3cost({builds: []}) == 4 && Co.t3cost({builds: [{fac: 'great'}]}) == 6);
	/* population and payment */
	const w1 = pl.wallet[cur], news2 = Co.turn(pl, c.opens + 31);
	ok('30. population grows towards its cap, and each season the colony pays its architect in the sponsor\'s coin', c.pop > 0 && c.pop < Co.popCap(c, s1) && pl.wallet[cur] > w1 && news2.some(n => /pays its architect/.test(n.text)));
	ok('31. a season\'s pay is 5-10% of its trade', (() => { const st = Co.stats(c, s1), tr = c.pop * 2 + 5000 * (1 + st.facilities), pay = Co.payment(c, s1); return pay >= tr * 0.05 - 1 && pay <= tr * 0.1 + 1 })());
	/* haulage to a build */
	const b2 = Co.startBuild(c, s1, 'habitat', sl.find(x => x.orbit > Co.used(c, x.body, 'orbit')).body, 'orbit', c.opens + 31);
	const hb = b2.ok && Co.postHaul(pl, office, mkt, c, Object.keys(b2.build.need)[0], 50, c.opens + 31, b2.build.id);
	ok('32. haulers can bring a facility\'s goods too', !b2.ok || (hb.ok && pl.hauls.some(h => h.job == b2.build.id)), b2.why || (hb && hb.why));
	const t1 = Date.now(); for (let i = 0; i < 100; i++) Co.grow(pl, c, c.opens + 40 + i);
	ok('33. a colony\'s daily step is quick', (Date.now() - t1) / 100 < 1, ((Date.now() - t1) / 100).toFixed(2) + ' ms');
	/* ---- part 3: forward bases, raids, independent colonies, carriers ---- */
	let war = null, side = null, front = null;
	for (const w of F.wars()) { for (const sd of [w.a, w.b]) { const f = w.systems.map(x => ({x, h: F.contestedHolder(x.at, day, [])})).find(o => o.h.holder == sd && o.h.supplied && o.h.war == w.id && !T.portFor(o.x.star, day)); if (f) { war = w; side = sd; front = f; break } } if (front) break }
	const pw = Tr.newPlayer(side), fo = {star: front.x.star, owner: side}; pw.wallet[F.byId(side).currency.code] = 1e9; pw.rep[side] = 400;
	ok('34. a forward base needs a commission, on a front its side holds and supplies', !Co.canClaim(pw, fo, front.x.star, 'base', day, JUMP).ok && (pw.commission = side, Co.canClaim(pw, fo, front.x.star, 'base', day, JUMP).ok) && !Co.canClaim(pw, fo, front.x.star, 'outpost', day, JUMP).ok,
		Co.canClaim(pw, fo, front.x.star, 'base', day, JUMP).why);
	const enemySys = war.systems.map(x => ({x, h: F.contestedHolder(x.at, day, [])})).find(o => o.h.holder && o.h.holder != side && o.h.war == war.id);
	ok('35. ...and not where the enemy holds', !enemySys || !Co.canClaim(pw, {star: enemySys.x.star, owner: side}, enemySys.x.star, 'base', day, JUMP).ok);
	const fb = Co.claim(pw, fo, front.x.star, 'base', day, JUMP).colony; Co.beacon(pw, fb, day); for (const [gd, t] of Object.entries(Co.left(fb))) pw.cargo[gd] = t; Co.deliver(pw, fb, day);
	const ev0 = pw.warEvents.length, newsB = Co.turn(pw, fb.opens + 30);
	ok('36. a built base puts war effort into its front each season while held (or is lost if taken)', fb.stage == 'lost' ? newsB.some(n => /lost/.test(n.text)) : pw.warEvents.length > ev0 && pw.warEvents.slice(-1)[0].side == side && pw.warEvents.slice(-1)[0].war == war.id);
	/* raids */
	let r1 = 0, r2 = 0; const cu = {id: 'u', star: {at: [3000, 0, 0]}, port: 'outpost', builds: []}, cmil = {id: 'm', star: {at: [3000, 0, 0]}, port: 'outpost', builds: [{fac: 'military', done: true}]};
	for (let i = 0; i < 2000; i++) { if (Co.raided(cu, {good: 'Iron', eta: i, tons: 10})) r1++; if (Co.raided(cmil, {good: 'Iron', eta: i, tons: 10})) r2++ }
	ok('37. haulers are raided about 10% of runs in unclaimed space, never past a military outpost', Math.abs(r1 / 2000 - 0.10) < 0.025 && r2 == 0, r1 + '/2000');
	/* independent */
	const pi = Tr.newPlayer(home.id); pi.wallet[cur] = 1e9;
	const wild = G.starsNear(3000 * 0 + home.star.x, home.star.y, home.star.z, 40).find(x => x.kind == 'star' && G.system(x).planets.length && !F.claimAt([x.x, x.y, x.z]).owner && !F.claimAt([x.x, x.y, x.z]).contested && !T.portFor(x, day) && G.mRad(x.x, x.y, x.z) > 30);
	const io = {star: wild, owner: home.id};
	const ic = wild && Co.claim(pi, io, wild, 'outpost', day, 50, true).colony;
	ok('38. an independent claim: unclaimed space only, no sponsor, its own scrip pegged near 1 SU', ic && ic.independent && !ic.sponsor && /^X[A-Z]{2}$/.test(ic.scrip) && Math.abs(E.rate(ic.scrip, day) - 1) < 0.2 && !Co.canClaim(pi, office, own, 'outpost', day, JUMP, true, true).ok);
	Co.beacon(pi, ic, day); for (const [gd, t] of Object.entries(Co.left(ic))) pi.cargo[gd] = t; Co.deliver(pi, ic, day);
	const nI = Co.turn(pi, ic.opens + 30);
	ok('39. it pays in its scrip, warns of low security, and a second low season loses it to a syndicate', (pi.wallet[ic.scrip] || 0) > 0 && nI.some(n => /security is low/.test(n.text)) && (Co.turn(pi, ic.opens + 60), ic.stage == 'lost') && !Co.colonyAt(pi, wild.id));
	/* carriers */
	const pc2 = Tr.newPlayer(home.id); pc2.wallet[cur] = 1e9; const cc = Co.claim(pc2, office, cands[2] || cands[1], 'outpost', day, JUMP).colony; Co.beacon(pc2, cc, day);
	const q0 = Co.haulQuote(office, mkt, cc, 'Iron', 400, day), cars = Co.carriers(pc2, day), rr = cars.length && Co.rent(pc2, cc, cars[0].id, day, cur), q1 = Co.haulQuote(office, mkt, cc, 'Iron', 400, day);
	ok('40. a rented carrier makes haulage 30% cheaper and twice as fast for a season', rr && rr.ok && Math.abs(q1.cost - q0.cost * 0.7) <= 1 && q1.days == Math.max(1, Math.ceil(q0.days / 2)) && !Co.rented(cc, day + 31), rr && rr.why);
	const back3 = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pi))));
	ok('41. independent and lost colonies come back from the save', back3.colonies.length == pi.colonies.length && back3.colonies[0].scrip == ic.scrip);
	/* 0.4.9 (L3.5): surface mines, at deposits the ground scan found, feeding the colony port's market */
	{
		const land = G.system(s1).planets.find(p => !p.gas && (p.res || []).length) || G.system(s1).planets.find(p => !p.gas) || G.system(s1).planets[0];
		const dep = {id: 'dep:' + land.name + ':1,2,3:0', res: (land.res || ['Iron'])[0], tons: 1000, dir: [0.6, 0, 0.8]};
		const no = Co.canBuild(c, s1, 'mine', land.name, 'surface', null, pl);
		Co.noteDeposit(pl, s1.id, land.name, dep); const od = Co.openDeposits(pl, c), dp = () => Object.assign({id: dep.id}, pl.deposits[dep.id]);
		const before = Co.used(c, land.name, 'surface'), bm = Co.startBuild(c, s1, 'mine', land.name, 'surface', day + 40, dp(), pl);
		ok('42. a surface mine goes at a deposit the ground scan found on one of the colony\'s worlds: one a deposit, taking no slot', !no.ok && /deposit/.test(no.why) && od.length == 1 && od[0].res == dep.res && bm.ok && Co.used(c, land.name, 'surface') == before && !Co.canBuild(c, s1, 'mine', land.name, 'surface', dp(), pl).ok && !Co.openDeposits(pl, c).length, no.why + ' / ' + bm.why);
		bm.build.got = Object.assign({}, bm.build.need); Co.finishBuild(c, bm.build, day + 41);
		const rate = Co.mineRate(s1), f1 = Co.feeds(c, s1, day + 42), f2 = Co.feeds(c, s1, day + 41 + Math.ceil(1000 / rate) + 1);
		ok('43. built, it works its deposit at 25 t a day (30 round a metal-rich star), until it runs out', [25, 30].includes(rate) && f1[dep.res] == rate && !f2[dep.res] && Math.abs(Co.mineLeft(bm.build, s1, day + 51) - (1000 - rate * 10)) < 1e-6, {rate, f1, f2});
		const ctx = {holder: home.id, econ: Co.economy(c, s1), people: Math.max(1000, c.pop || 0), P: pl}, m0 = E.market(s1, day + 42, ctx), m1 = E.market(s1, day + 42, Object.assign({}, ctx, {feed: f1})), g0 = m0.prices[dep.res], g1 = m1.prices[dep.res];
		ok('44. it feeds the colony port\'s market: ten days of its output more of the good to stock, and no dearer', g1.supplyCap == (g0.supplyCap || 0) + rate * 10 && g1.stock > g0.stock && g1.su <= g0.su + 1e-9, {g0, g1});
		const back4 = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pl))));
		ok('45. the save keeps the deposits found and the mine on its deposit', back4.deposits[dep.id].res == dep.res && back4.deposits[dep.id].dir.length == 3 && back4.colonies.find(x => x.id == c.id).builds.some(b => b.dep && b.dep.id == dep.id));
	}
	/* 0.5.1 (L3.5): colonies on the ground: a surface outpost or settlement on an airless world, built, in flight as a
	   surface port, grown into a settlement */
	{
		const Su = require(path.join(DIR, 'surface.js')), L = require(path.join(DIR, 'landing.js'));
		const pg = Tr.newPlayer(home.id); pg.wallet[cur] = 1e9; pg.rep[home.id] = 400;
		const all = Co.candidates(pg, office, day, JUMP, 12), gs = all.find(x => Co.groundWorlds(x, 'soutpost').length), gw = gs && Co.groundWorlds(gs, 'soutpost');
		const everyW = all.flatMap(x => Co.groundWorlds(x, 'soutpost')), gas = gs && Co.worldsOf(gs).find(p => !L.landable(p).ok);
		ok('46. the ground a surface port can take: airless, landable, under 500 K, with room for its site; moons too; a world with air or no ground refused, saying why',
			gs && everyW.length && everyW.every(p => L.landable(p).ok && p.Ts <= 500 && Su.fits('outpost', p)) && (!gas || /^.+: /.test(Co.canClaim(pg, office, gs, 'soutpost', day, JUMP, false, false, gas.name).why)) && !Co.canClaim(pg, office, gs, 'soutpost', day, JUMP, false, false, 'Nowhere').ok,
			gs ? gw.map(p => p.name).join(', ') : 'no system with landable ground');
		const w0 = pg.wallet[cur], gc = Co.claim(pg, office, gs, 'soutpost', day, JUMP, false, gw[0].name).colony, gp = Co.worldOf(gs, gw[0].name);
		const heavy = gp.g > 1.5 ? 1.25 : 1, site2 = Co.groundSite(gs, gw[0].name);
		ok('47. a surface outpost is claimed like an outpost: its fee in the sponsor\'s coin, its 1,500 t (25% more over 1.5 g), on the chosen world, at a site that is the same every time',
			gc && gc.port == 'soutpost' && gc.world == gw[0].name && Math.abs(w0 - pg.wallet[cur] - Co.PORTS.soutpost.fee * E.rate(cur, day)) < 1 && Math.abs(sum(gc.need) - 1500 * heavy) <= 8 && JSON.stringify(gc.site) == JSON.stringify(site2) && Math.abs(gc.site.lat) <= 60, gc && gc.site);
		const before = Co.groundPorts(pg, gs, day + 5);
		Co.beacon(pg, gc, day + 1); for (const [g, t] of Object.entries(Co.left(gc))) pg.cargo[g] = t; Co.deliver(pg, gc, day + 2);
		const qs = Co.groundPorts(pg, gs, gc.opens), q = qs[0], lay = q && Su.layout(q.kind, q.seed);
		ok('48. built, it opens the next day as a surface port on its world (not in orbit): an outpost\'s three S pads in a layout that keeps the rules, held by the sponsor, the colony\'s',
			!before.length && gc.stage == 'done' && !Co.groundPorts(pg, gs, gc.opens - 1).length && !Co.portOf(pg, gs, gc.opens) && qs.length == 1 && q.id == 'surface:' + gc.world + ':colony' && T.PORT_ID.test(q.id) && q.kind == 'outpost' && q.surface && q.colony && q.owner == home.id && q.world == gc.world
			&& lay.pads.length == 3 && lay.pads.every(p => p.size == 'S') && !Su.check(lay).length && gc.points.t2 == 1 && Co.used(gc, gc.world, 'surface') == 1 && Co.used(gc, gc.world, 'orbit') == 0, q);
		const mk = E.market(gs, gc.opens, {port: q, holder: q.owner, econ: Co.economy(gc, gs), people: 100, P: pg});
		ok('49. its market trades in the sponsor\'s coin, kept under the port\'s own id', mk.currency == cur && mk.key == gs.id + ':' + q.id && mk.port == q.id, {cur: mk.currency, key: mk.key});
		const noPt = Object.assign({}, gc, {points: {t2: 0, t3: 0}, builds: []}), up = Co.startBuild(gc, gs, 'usettle', gc.world, 'surface', gc.opens + 1), cap0 = Co.popCap(Object.assign({}, gc, {port: 'soutpost'}), gs);
		ok('50. it grows into a settlement where it stands (tier 2: a tier 2 point, 3,000 t, no slot of its own); one growth at a time, only from an outpost',
			!Co.canBuild(noPt, gs, 'usettle', gc.world, 'surface').ok && up.ok && gc.points.t2 == 0 && Math.abs(sum(up.build.need) - 3000 * heavy) <= 8 && Co.used(gc, gc.world, 'surface') == 1 && /already/.test(Co.canBuild(Object.assign({}, gc, {points: {t2: 5, t3: 5}}), gs, 'usettle', gc.world, 'surface').why)
			&& !Co.canBuild(Object.assign({}, gc, {port: 'ssettle', builds: [], points: {t2: 5, t3: 5}}), gs, 'usettle', gc.world, 'surface').ok && !Co.canBuild(Object.assign({}, gc, {builds: [], points: {t2: 5, t3: 5}}), gs, 'usettle', 'Elsewhere', 'surface').ok, up.why);
		const fits = Su.fits('settlement', gp);
		if (fits) { for (const [g, t] of Object.entries(Co.left(up.build))) pg.cargo[g] = t; Co.deliverBuilds(pg, gc, gc.opens + 2) }
		const q2 = Co.groundPorts(pg, gs, gc.opens + 3)[0], lay2 = q2 && Su.layout(q2.kind, q2.seed);
		ok('51. grown, the port is a settlement (4 S and an M pad) at the same site, under the same id; it earns a tier 3 point and room for 100,000 more people',
			!fits ? /too small/.test(Co.canBuild(gc, gs, 'usettle', gc.world, 'surface').why || 'too small') : gc.port == 'ssettle' && up.build.done && q2.kind == 'settlement' && q2.id == q.id && q2.lat == q.lat && q2.lon == q.lon && lay2.pads.filter(p => p.size == 'M').length == 1 && gc.points.t3 == 1 && Co.popCap(gc, gs) == cap0 + 100000 && Co.stats(gc, gs).tech > 0.3,
			{fits, port: gc.port, q2});
		const bk = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pg)))), gb = bk.colonies.find(x => x.id == gc.id);
		ok('52. the save keeps a colony on the ground exactly (its port, its site, its growth), and the port comes back where it stood', JSON.stringify(gb) == JSON.stringify(gc) && JSON.stringify(Co.groundPorts(bk, gs, gc.opens + 3)) == JSON.stringify(Co.groundPorts(pg, gs, gc.opens + 3)));
		/* a settlement claimed at once; independent on the ground; never in the Rift; orbital claims as before */
		const ps = Tr.newPlayer(home.id); ps.wallet[cur] = 1e9; ps.rep[home.id] = 400;
		const sw = Co.groundWorlds(gs, 'ssettle'), cs2 = sw.length ? Co.canClaim(ps, office, gs, 'ssettle', day, JUMP, false, false, sw[0].name) : null;
		const pind = Tr.newPlayer(home.id); pind.wallet[cur] = 1e9; const ci = Co.claim(pind, office, gs, 'soutpost', day, JUMP, true).colony;
		const rift = {id: 'R:test', name: 'Rift star', rift: true, x: 0, y: 0, z: 0};
		ok('53. a surface settlement can be claimed at once (the station\'s fee; 7,200 t); an independent claim on the ground pays SU and mints its scrip; there are no surface claims in the Rift, nor a starport claimed outright',
			(!sw.length || (cs2.ok && Math.abs(cs2.fee - 300000 * E.rate(cur, day)) < 2 && Math.abs(sum(Co.portGoods('ssettle', gs, sw[0].name)) - 7200 * (sw[0].g > 1.5 ? 1.25 : 1)) <= 10)) && ci && ci.independent && ci.site && /^X[A-Z]{2}$/.test(ci.scrip)
			&& /Rift has no surface ports/.test(Co.canClaim(pind, {star: rift, owner: null}, rift, 'soutpost', day, JUMP, false, true).why || '') && !Co.canClaim(ps, office, gs, 'sstarport', day, JUMP).ok, cs2);
		const po = Tr.newPlayer(home.id); po.wallet[cur] = 1e9; const co = Co.claim(po, office, gs, 'outpost', day, JUMP).colony;
		ok('54. orbital claims are as before: the most Earth-like world, an orbital slot, no site on the ground', co && co.world == Co.portWorld(gs) && !co.site && Co.used(Object.assign({}, co, {builds: []}), co.world, 'orbit') == 1);
	}
	const t0 = Date.now(); Co.candidates(pl, office, day, JUMP, 12);
	ok('19. the planner\'s listing is quick', Date.now() - t0 < 500, (Date.now() - t0) + ' ms');
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
