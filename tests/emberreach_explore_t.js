/* Ember Reach's exploration (wip/emberreach/explore.js): charting, surveys, first discoveries, selling, naming and
   contracts, in node.
     node tests/emberreach_explore_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const X = require(path.join(DIR, 'explore.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js')), Tr = require(path.join(DIR, 'trade.js')), T = require(path.join(DIR, 'travel.js')),
	En = require(path.join(DIR, 'encounters.js')), Sv = require(path.join(DIR, 'save.js')), E = require(path.join(DIR, 'economy.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const home = F.majors()[5], pl = Tr.newPlayer(home.id), day = 200, cap = home.star, port = T.portFor(cap, day);
	ok('1. the sweep charts a system once', X.chartSystem(pl, cap, day) && !X.chartSystem(pl, cap, day + 1) && X.isCharted(pl, cap.id));
	const hp = G.system(cap).planets[0], r1 = X.survey(pl, cap, hp, port, day);
	ok('2. a survey in a power\'s charted space is data, but not a first discovery', r1.new && !r1.first && r1.value > 0 && !X.survey(pl, cap, hp, port, day).new);
	/* a ruin out in the quiet */
	const ruin = X.ruinsNear([cap.x, cap.y, cap.z], 30).find(x => !T.portFor(x.star, day));
	ok('3. ruins lie within reach of a capital (about one system in 330)', !!ruin, ruin ? ruin.star.name + ' at ' + ruin.d.toFixed(1) + ' pc' : 'none within 30 pc');
	const r3 = X.survey(pl, ruin.star, ruin.planet, null, day);
	ok('4. a ruin away from any port is a first discovery, worth the most', r3.first && r3.ruins && r3.value >= X.EXPLORE.ruin * X.EXPLORE.first);
	/* selling */
	const cur = home.currency.code, before = pl.wallet[cur], items = X.unsold(pl), su = items.reduce((t, x) => t + x.su, 0), repB = pl.rep[home.id];
	const sold = X.sell(pl, home.id, cur, day);
	ok('5. data sells once, in the port\'s coin, and pleases its holder', sold.ok && sold.items == items.length && Math.abs(pl.wallet[cur] - before - su * E.rate(cur, day)) < 1e-6 && pl.rep[home.id] > repB && !X.sell(pl, home.id, cur, day).ok);
	/* naming */
	const k = X.keyOf(ruin.star.id, ruin.planet.name);
	ok('6. your first discoveries of ruins and living worlds can be named', X.nameable(pl).some(x => x.key == k) && X.rename(pl, k, '  Hollow   Crown ').ok && X.nameOf(pl, ruin.star.id, ruin.planet.name) == 'Hollow Crown');
	ok('7. ...but not someone else\'s, nor with a bad name', !X.rename(pl, X.keyOf(cap.id, hp.name), 'Mine').ok && !X.rename(pl, k, 'x').ok && !X.rename(pl, k, '<script>').ok && !X.rename(pl, k, 'A'.repeat(25)).ok);
	ok('8. a planet is found again from its key alone', X.planetByKey(ruin.star.id, ruin.planet.name) && X.planetByKey(ruin.star.id, ruin.planet.name).ruins);
	/* contracts */
	const p2 = Tr.newPlayer(home.id), offers = [...Array(12)].flatMap((_, i) => X.offers(p2, cap, port, day + i));
	const sv = offers.find(m => m.type == 'survey'), ru = offers.find(m => m.type == 'ruin');
	ok('9. cartographers offer surveys of nearby uncharted worlds, and now and then a rumoured ruin', sv && ru && sv.dist <= X.EXPLORE.worldSearch && ru.dist <= X.EXPLORE.ruinSearch && sv.reward > 0 && sv.currency == home.currency.code);
	const acc = X.accept(p2, ru, day), m = acc.mission;
	ok('10. a contract taken is due in 20 days', acc.ok && m.due == day + 20 && En.need(m).includes(m.planet));
	const target = X.planetByKey(m.star.id, m.planet), wB = p2.wallet[m.currency] || 0;
	X.survey(p2, X.starById(m.star.id), target, null, day + 3); X.surveyDone(p2, m.star.id, m.planet);
	const done = En.settle(p2, day + 3);
	ok('11. surveying the world completes it: paid, and no war effort', done.length == 1 && done[0].ok && p2.wallet[m.currency] == wB + m.reward && !p2.warEvents.length);
	/* the save */
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pl))));
	ok('12. the record is kept in the save: charts, surveys, sales, names', back.explore && back.explore.names[k] == 'Hollow Crown' && back.explore.pl[k].f == 1 && back.explore.sold[cap.id] == 1);
	ok('13. a damaged record is dropped, not trusted', Sv.unpackPlayer(Object.assign(JSON.parse(JSON.stringify(Sv.packPlayer(pl))), {explore: {sys: [], pl: {}}})).explore === null);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
