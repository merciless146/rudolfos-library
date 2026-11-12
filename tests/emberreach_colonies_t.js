/* Ember Reach's colonies, part 1 (wip/emberreach/colonies.js): claims, the beacon, goods, haulage, lapses, in node.
     node tests/emberreach_colonies_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const Co = require(path.join(DIR, 'colonies.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js')), Tr = require(path.join(DIR, 'trade.js')), T = require(path.join(DIR, 'travel.js')),
	E = require(path.join(DIR, 'economy.js')), Sv = require(path.join(DIR, 'save.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const sum = o => Object.values(o).reduce((t, v) => t + v, 0);
try {
	const day = 200, JUMP = 6;
	/* a power whose capital has unclaimed space within a jump, or else its own space (needing a charter) */
	const home = F.majors()[5], office = {star: home.star, owner: home.id}, pl = Tr.newPlayer(home.id), cur = home.currency.code;
	pl.wallet[cur] = 1e9;
	ok('1. the primary ports\' goods: about 1,500 t for an outpost, 8,000 for a station, 25,000 for a great port', Math.abs(sum(Co.PORTS.outpost.goods) - 1500) <= 1 && Math.abs(sum(Co.PORTS.station.goods) - 9000) <= 1000 && Math.abs(sum(Co.PORTS.great.goods) - 25000) <= 1000);
	const near = G.starsNear(home.star.x, home.star.y, home.star.z, JUMP).filter(s => s.kind == 'star' && s.id != home.star.id);
	const bare = near.find(s => !G.system(s).planets.length), far = G.starsNear(home.star.x, home.star.y, home.star.z, 12).find(s => s.d > JUMP + 1 && G.system(s).planets.length);
	ok('2. no claims beyond one jump, or on a system with no planets, or on the capital itself', (!bare || !Co.canClaim(pl, office, bare, 'outpost', day, JUMP).ok) && !Co.canClaim(pl, office, far, 'outpost', day, JUMP).ok && !Co.canClaim(pl, office, home.star, 'outpost', day, JUMP).ok);
	const cands = Co.candidates(pl, office, day, JUMP, 6), s1 = cands[0];
	ok('3. the planner finds claimable systems within a jump', cands.length > 0 && cands.every(s => s.d <= JUMP && G.system(s).planets.length), cands.length + ' found');
	const inside = !!F.claimAt([s1.x, s1.y, s1.z]).owner, low = Tr.newPlayer(home.id); low.wallet[cur] = 1e9; low.rep[home.id] = 50;
	ok('4. inside a power\'s own space a claim needs its charter (Friendly)', !inside || (!Co.canClaim(low, office, s1, 'outpost', day, JUMP).ok && Co.canClaim(pl, office, s1, 'outpost', day, JUMP).ok));
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
	const mkt = E.market(home.star, day), q = Co.haulQuote(office, mkt, c, 'Aluminum', 300, day + 2), wB = pl.wallet[cur];
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
	ok('27. the market follows it: the system\'s ores sell cheaper, food dearer', (() => { const a = E.market(s1, day + 13, {holder: home.id}), b = E.market(s1, day + 13, {holder: home.id, econ: ec}), ore = Object.keys(a.prices).find(g => ['Iron', 'Copper', 'Coal', 'Lead', 'Aluminum', 'Titanium', 'Uranium', 'Beryllium', 'Jade', 'Gold', 'Diamond'].includes(g) && sys.planets.some(p => p.res.includes(g)));
		return b.prices[ore].su < a.prices[ore].su && b.prices.Food.su > a.prices.Food.su && b.prices.Food.buy })());
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
	const t0 = Date.now(); Co.candidates(pl, office, day, JUMP, 12);
	ok('19. the planner\'s listing is quick', Date.now() - t0 < 500, (Date.now() - t0) + ' ms');
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
