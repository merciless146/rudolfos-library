/* Ember Reach 0.3.10: surface contracts on the bulletin (apps/rudolf-emberreach/www/contracts.js): deliveries to
   surface ports and ground surveys, taken, done and paid; in node.
     node tests/emberreach_contracts_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Ct = require(path.join(DIR, 'contracts.js')), F = require(path.join(DIR, 'factions.js')), T = require(path.join(DIR, 'travel.js')), Tr = require(path.join(DIR, 'trade.js'));
const En = require(path.join(DIR, 'encounters.js')), E = require(path.join(DIR, 'economy.js')), G = require(path.join(DIR, 'galaxy.js')), Ld = require(path.join(DIR, 'landing.js')), Sv = require(path.join(DIR, 'save.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + JSON.stringify(d) : '')) } };
try {
	const day = 200, C = Ct.CONTRACT;
	/* a few great powers' ports, and a week of their boards */
	const boards = F.majors().slice(0, 6).flatMap(m => T.portsAt(m.star, day).filter(q => q.owner).map(q => ({m, star: m.star, q})));
	const pl = Tr.newPlayer(F.majors()[0].id);
	const all = boards.flatMap(b => [0, 1, 2, 3, 4, 5, 6].flatMap(k => Ct.offers(pl, b.star, b.q, day + k).map(x => Object.assign(x, {from: b}))));
	const dels = all.filter(x => x.type == 'delivery'), svs = all.filter(x => x.type == 'groundsurvey');
	ok('1. great powers\' ports post surface work: deliveries and ground surveys', dels.length > 10 && svs.length > 5, {d: dels.length, s: svs.length});
	ok('2. deliveries go to surface ports (not the one posting it) within 8 pc', dels.every(x => { return x.dist <= C.range + 1e-9 && /^surface:/.test(x.port) && !(x.star.id == x.from.star.id && x.port == x.from.q.id) }) && dels.every(x => T.portsAt(T.starAt(x.star.id, x.star.at), day).some(q => q.id == x.port && q.surface)));
	ok('3. they pay a premium on the goods (1.5 to 2 times their base value, food and machinery highest), plus 250 SU and 120 SU a parsec', dels.every(x => { const [lo, hi] = C.goods[x.good], k = (x.reward / E.rate(x.currency, x.posted) - C.deliverBase - C.deliverPc * x.dist) / (x.tons * E.GOODS[x.good]); const tol = 0.01 + 1 / (E.rate(x.currency, x.posted) * x.tons * E.GOODS[x.good]); return C.tons.includes(x.tons) && k > lo - tol && k < hi + tol }) && C.goods.Food[0] > C.goods.Water[1] && C.goods.Machinery[0] > C.goods.Medicine[1]);
	ok('4. ground surveys name a world you can land on, within 8 pc', svs.every(x => { const s = T.starAt(x.star.id, x.star.at), p = G.system(s).planets.find(y => y.name == x.planet); return p && Ld.landable(p).ok && x.dist <= C.range + 1e-9 }));
	const b0 = boards[0];
	ok('5. a board is the same all day, and changes from day to day', JSON.stringify(Ct.offers(pl, b0.star, b0.q, day)) == JSON.stringify(Ct.offers(pl, b0.star, b0.q, day + 0.7)) && JSON.stringify(Ct.offers(pl, b0.star, b0.q, day)) != JSON.stringify(Ct.offers(pl, b0.star, b0.q, day + 1)));
	ok('6. no great power, no board: free ports, the Rift', !Ct.offers(pl, b0.star, Object.assign({}, b0.q, {owner: null}), day).length && !Ct.offers(pl, Object.assign({}, b0.star, {rift: true}), b0.q, day).length);

	/* taking one, and doing it */
	const p1 = Tr.newPlayer(b0.m.id), offer = Ct.offers(p1, b0.star, b0.q, day).find(x => x.type == 'delivery') || dels[0], acc = Ct.accept(p1, offer, day), m = acc.mission;
	ok('7. taken: due in 12 days, and gone from the board', acc.ok && m.due == day + 12 && !Ct.offers(p1, b0.star, b0.q, day).some(x => x.id == offer.id));
	p1.cargo = {[m.good]: m.tons - 1};
	ok('8. docking without the whole load hands nothing over', !Ct.deliverAt(p1, m.star.id, m.port).length && p1.cargo[m.good] == m.tons - 1);
	p1.cargo = {[m.good]: m.tons + 3}; p1.cost = {[m.good]: 1};
	ok('9. elsewhere, nothing; at its port, the load leaves the hold', !Ct.deliverAt(p1, m.star.id, 'orbital').length && Ct.deliverAt(p1, m.star.id, m.port).length == 1 && p1.cargo[m.good] == 3 && m.delivered);
	const w0 = p1.wallet[m.currency] || 0, rep0 = p1.rep[m.issuer] || 0, paid = En.settle(p1, day + 2);
	ok('10. then the mission settles: paid in the issuer\'s coin, and it counts for your standing', paid.length == 1 && paid[0].ok && Math.abs((p1.wallet[m.currency] || 0) - w0 - m.reward) < 1e-6 && (p1.rep[m.issuer] || 0) > rep0 && !(p1.missions || []).length);
	/* a ground survey */
	const sv = svs[0], p2 = Tr.newPlayer(sv.issuer), m2 = Ct.accept(p2, sv, day).mission;
	ok('11. a ground scan on another world does nothing; on the named one the survey is done', !Ct.scanned(p2, m2.star.id, m2.planet + 'x').length && Ct.scanned(p2, m2.star.id, m2.planet).length == 1 && En.complete(m2));
	ok('12. ...and it pays at the next port', En.settle(p2, day + 1)[0].ok);
	/* late, and limits */
	const p3 = Tr.newPlayer(sv.issuer), m3 = Ct.accept(p3, svs[1] || sv, day).mission, late = En.settle(p3, day + 13);
	ok('13. a contract not done in 12 days fails', late.length == 1 && !late[0].ok);
	const p4 = Tr.newPlayer(sv.issuer); for (const x of dels.slice(0, 3)) Ct.accept(p4, x, day);
	ok('14. three missions at once, at most', !Ct.accept(p4, dels[3], day).ok);
	ok('15. what\'s left to do reads plainly', /^Deliver \d+ t of \w+ to .+: dock on a pad/.test(En.need(dels[0])) && /^Land on .+ and let the ground scan run$/.test(En.need(svs[0])));
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(p4))));
	ok('15a. surveys pay 800 SU and 150 SU a parsec', svs.every(x => Math.abs(x.reward / E.rate(x.currency, x.posted) - (C.surveyBase + C.surveyPc * x.dist)) < 2 / E.rate(x.currency, x.posted) + 0.01));
	ok('16. the save keeps them', back && back.missions.length == 3 && back.missions.every(x => x.kind == 'surface' && x.port && x.good && x.tons));
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
