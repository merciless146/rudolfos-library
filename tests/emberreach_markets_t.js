/* Ember Reach 0.3.7: markets (apps/rudolf-emberreach/www/economy.js): each port's economy from its kind and its world,
   supply and demand measured against its people, prices from a good's base value, the stock, the demand and the
   people, the calendar's drift, and the player's trades coming back slowly; in node.
     node tests/emberreach_markets_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const E = require(path.join(DIR, 'economy.js')), T = require(path.join(DIR, 'travel.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js'));
const Tr = require(path.join(DIR, 'trade.js')), S = require(path.join(DIR, 'ships.js')), Sv = require(path.join(DIR, 'save.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + JSON.stringify(d) : '')) } };
try {
	const day = 200, home = F.majors()[0];
	/* the ports round a few great powers' capitals, with their markets */
	const stars = F.majors().slice(0, 4).flatMap(m => [m.star, ...G.starsNear(m.star.x, m.star.y, m.star.z, 12).filter(x => x.kind == 'star' && !T.wildAt(x, day)).slice(0, 25)]);
	const ports = stars.flatMap(s => T.portsAt(s, day).map(q => ({s, q, kind: q.surface ? q.kind : q.cls, m: E.market(s, day, {port: q})})));
	const of = k => ports.filter(x => x.kind == k);
	const sells = m => Object.keys(m.prices).filter(g => !m.prices[g].none), buys = m => Object.keys(m.prices).filter(g => m.prices[g].buy && !E.RIFT_GOODS.includes(g));
	const MINED = ['Iron', 'Copper', 'Coal', 'Lead', 'Aluminum', 'Titanium', 'Uranium', 'Beryllium', 'Jade', 'Gold', 'Diamond'];
	ok('1. every kind of port turns up: capitals, stations, starports, fields, settlements, outposts, camps, forward bases', ['halo', 'lantern', 'trefoil', 'starport', 'field', 'settlement', 'outpost', 'camp', 'base'].every(k => of(k).length), [...new Set(ports.map(x => x.kind))]);

	/* economies: by the port's kind, blended with its world */
	ok('2. a mining camp extracts: it sells its world\'s ores (or the system\'s) and nothing made', of('camp').every(x => sells(x.m).length && sells(x.m).every(g => MINED.includes(g)) && x.m.economy.extraction == 1));
	ok('3. a forward base is military: it sells munitions, and buys food, fuel and medicine', of('base').every(x => sells(x.m).join() == 'Munitions' && ['Food', 'Fuel', 'Medicine'].every(g => x.m.prices[g].buy)));
	ok('4. a capital\'s great port runs high tech and industry: it sells electronics and machinery, and buys ores and food', of('halo').every(x => /High tech|Industrial/.test(x.m.economyName) && ['Electronics', 'Machinery'].every(g => !x.m.prices[g].none) && x.m.prices.Food.buy && buys(x.m).some(g => MINED.includes(g))));
	const gasStation = of('trefoil').find(x => (G.system(x.s).planets.find(p => p.name == x.q.world) || {}).gas);
	ok('5. the world counts: an outpost station over a gas giant refines (fuel for sale); one at a living world farms', (!gasStation || (!gasStation.m.prices.Fuel.none && gasStation.m.economy.refinery > 0.9)) && of('lantern').every(x => x.m.economy.agriculture > 0 || x.m.economy.tourism > 0), gasStation && gasStation.m.economy);
	const makesIt = (x, g) => Object.keys(x.m.economy).some(e => { const L = E.ECON[e]; return L && Array.isArray(L.makes) && L.makes.includes(g) });
	ok('6. a port\'s people eat, drink and need medicine: every port buys them, unless it makes them (and then sells any over what it uses)', ports.every(x => ['Food', 'Water', 'Medicine'].every(g => x.m.prices[g].buy || makesIt(x, g))) && ports.some(x => x.m.prices.Food.buy));
	ok('7. the system\'s economy is its ports\' mixes, weighed by their people, summing to 1', (() => { const e = E.systemEconomy(home.star, day); return Math.abs(Object.values(e).reduce((a, b) => a + b, 0) - 1) < 1e-9 && E.econLabel(e).length > 3 })());
	ok('8. a wild system has no market: no people, nothing traded', (() => { const w = G.starsNear(home.star.x, home.star.y, home.star.z, 30).find(x => x.kind == 'star' && T.wildAt(x, day)), m = E.market(w, day); return m.people == 0 && Object.values(m.prices).every(q => q.none && (!q.buy || E.RIFT_GOODS.length)) })());

	/* sizes: supply and demand against the people */
	const vol = x => Object.values(x.m.prices).reduce((t, q) => t + q.supplyCap + q.demandCap, 0);
	const size = n => E.MKT.per * Math.log10(n) ** 2;
	ok('9. a market\'s size: about 25 × log10(people)² tonnes each way (less what a port makes and uses itself), so a capital trades many times what a camp does', ports.every(x => !x.m.people || (vol(x) > 0.5 * size(x.m.people) && vol(x) < 2.5 * size(x.m.people)))
		&& Math.min(...of('halo').map(vol)) > 5 * Math.max(...of('camp').map(vol)), {halo: of('halo').map(vol).map(Math.round), camp: of('camp').map(vol).map(Math.round)});

	/* prices */
	const cap = of('halo')[0], q0 = cap.m.prices;
	ok('10. prices sit near the base: made goods up to 22% under it, used goods up to 25% over, times the people\'s premium', ports.every(x => Object.entries(x.m.prices).every(([g, q]) => { if (E.RIFT_GOODS.includes(g) || x.m.contested) return true; const k = q.su / E.GOODS[g] / (1 + E.MKT.popK * Math.log10(Math.max(1, x.m.people))) / (MINED.includes(g) ? Math.pow(10, -0.15 * (x.s.FeH || 0)) : 1); return k > 0.77 && k < 1.26 })));
	ok('11. more people, a slight premium: 1.5% a power of ten (a capital about 14%, a camp about 4%)', Math.abs(1 + E.MKT.popK * Math.log10(3e9) - 1.142) < 0.01 && Math.abs(1 + E.MKT.popK * Math.log10(250) - 1.036) < 0.01);
	/* the player's trades move it, and it comes back */
	const p = Tr.newPlayer(home.id), ship = Object.assign({}, S.ships().find(s => s.size == 'L'), {cargo: 5000}); p.wallet[home.currency.code] = 1e9;
	const mk = E.market(cap.s, day, {port: cap.q, P: p}), g = Object.keys(mk.prices).find(x => !mk.prices[x].none && mk.prices[x].stock > 40), s0 = mk.prices[g].su, st0 = mk.prices[g].stock;
	Tr.buy(p, ship, mk, g, st0, day);
	ok('12. buying out a port\'s stock raises its price (up to the base: a made good is never dearer than that, here)', mk.prices[g].stock == 0 && mk.prices[g].none && mk.prices[g].su > s0 && !Tr.buy(p, ship, mk, g, 1, day).ok, {g, s0, s1: mk.prices[g].su});
	const later = d => E.market(cap.s, day + d, {port: cap.q, P: p}).prices[g];
	const lv = d => { const c = E.market(cap.s, day + d, {port: cap.q}).prices[g]; return c.stock };
	ok('13. the stock comes back by itself, slowly: 5% of the gap a day, about half in two weeks, nearly all in three months', [1, 7, 14, 30].every(d => Math.abs(later(d).stock - Math.max(0, lv(d) - st0 * 0.95 ** d)) <= 2) && later(14).stock < lv(14) * 0.75 && later(90).stock >= lv(90) - st0 * 0.02 - 1, {d14: later(14).stock, lv14: lv(14), d90: later(90).stock, lv90: lv(90)});
	const w = Object.keys(mk.prices).find(x => mk.prices[x].buy && !E.RIFT_GOODS.includes(x) && mk.prices[x].demand > 20), dw = mk.prices[w].demand, sw = mk.prices[w].su;
	p.cargo[w] = dw; Tr.sell(p, mk, w, dw, day);
	ok('14. selling into its demand fills it, and the price falls back to the base (or about)', mk.prices[w].demand == 0 && !Tr.canSell(Object.assign({}, p, {cargo: {[w]: 5}}), mk, w) && mk.prices[w].su < sw, {w, sw, s1: mk.prices[w].su});
	ok('15. the record keeps only the player\'s changes, keyed by the port', p.markets && Object.keys(p.markets).length == 1 && p.markets[E.keyOf(cap.s, cap.q)].s[g] < 0 && p.markets[E.keyOf(cap.s, cap.q)].d[w] < 0);
	/* the calendar's drift */
	const drift = [0, 15, 30, 45, 60, 75, 90].map(d => E.market(cap.s, day + d, {port: cap.q}).prices[g]);
	ok('16. left alone, stock and prices wander slowly with the calendar, a little, never off the scale', new Set(drift.map(x => x.stock)).size > 3 && drift.every(x => x.stock >= 0 && x.stock <= x.supplyCap) && Math.max(...drift.map(x => x.su)) / Math.min(...drift.map(x => x.su)) < 1.3);
	ok('17. day by day it barely moves', Math.abs(E.market(cap.s, day + 1, {port: cap.q}).prices[g].su / E.market(cap.s, day, {port: cap.q}).prices[g].su - 1) < 0.03);
	/* the save */
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(p))));
	ok('18. the save keeps the markets as you left them', back && JSON.stringify(back.markets) == JSON.stringify(p.markets));
	/* every port, every good: in reach of its base */
	ok('19. a port\'s stock and demand are whole tonnes, inside their limits', ports.every(x => Object.values(x.m.prices).every(q => Number.isInteger(q.stock) && q.stock >= 0 && q.stock <= q.supplyCap && (q.demand <= q.demandCap || q.demand == E.MKT.riftDemand))));
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
