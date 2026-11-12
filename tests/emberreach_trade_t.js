/* Ember Reach's trade (wip/emberreach/trade.js): wallet, cargo, markets, exchange, services, shipyards, in node.
     node tests/emberreach_trade_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const Tr = require(path.join(DIR, 'trade.js')), E = require(path.join(DIR, 'economy.js')), F = require(path.join(DIR, 'factions.js')), S = require(path.join(DIR, 'ships.js')), M = require(path.join(DIR, 'modules.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const day = 200, home = F.majors()[0], code = home.currency.code, mkt = E.market(home.star, day);
	const p = Tr.newPlayer(home.id), wren = S.ships().find(s => s.id == p.ship.model);
	ok('1. a new player: 20,000 SU in their home currency, an empty hold, a starter ship', Math.abs(Tr.walletSU(p, 0) - 20000) < 1 && Tr.held(p) == 0 && wren);
	const good = Object.keys(mkt.prices).find(g => mkt.prices[g].buy && mkt.prices[g].price < 100);
	const before = p.wallet[code], b = Tr.buy(p, wren, mkt, good, 3, day);
	ok('2. buying: paid in the market\'s currency, into the hold', b.ok && Math.abs(before - p.wallet[code] - 3 * mkt.prices[good].price) < 1e-6 && p.cargo[good] == 3);
	ok('3. the hold is the limit', !Tr.buy(p, wren, mkt, good, wren.cargo, day).ok && Tr.canBuy(p, wren, mkt, good, day) == wren.cargo - 3);
	const poor = Tr.newPlayer(home.id); poor.wallet[code] = 1;
	ok('4. so is the money', !Tr.buy(poor, wren, mkt, good, 1, day).ok && Tr.canBuy(poor, wren, mkt, good, day) == 0);
	const w0 = p.wallet[code], s1 = Tr.sell(p, mkt, good, 2, day);
	ok('5. selling where the station buys: paid back the same price, no profit at the same market', s1.ok && Math.abs(p.wallet[code] - w0 - 2 * mkt.prices[good].price) < 1e-6 && Math.abs(s1.profit) < 1e-9 && p.cargo[good] == 1);
	const notBought = Object.keys(mkt.prices).find(g => !mkt.prices[g].buy);
	if (notBought) { p.cargo[notBought] = 1; ok('6. a station that doesn\'t buy a good won\'t take it', Tr.sell(p, mkt, notBought, 1, day).why == 'market'); delete p.cargo[notBought] } else ok('6. (every good is bought here)', true);
	const rep0 = p.rep[home.id]; Tr.buy(p, wren, mkt, good, 1, day);
	ok('7. trading for a power counts for its reputation', p.rep[home.id] > rep0);

	/* exchange */
	const ally = F.majors().find(m => m.id != home.id && F.relation(home.id, m.id) > 0), enemy = F.majors().find(m => F.relation(home.id, m.id) < 0);
	const ex = Tr.exchange(p, 10000, code, ally.currency.code, day, home.id);
	ok('8. changing money at home: an ally\'s coin at the cross rate, less the spread (4.5%)', ex.ok && Math.abs(ex.spread - (1 - 0.985 * 0.97)) < 1e-9 && Math.abs(ex.got - 10000 * E.crossRate(code, ally.currency.code, day) * (1 - ex.spread)) < 1e-6);
	ok('9. an enemy\'s coin is refused', !Tr.exchange(p, 100, code, enemy.currency.code, day, home.id).ok);
	const back = Tr.exchange(p, ex.got, ally.currency.code, code, day, home.id);
	ok('10. there and back loses only the spreads', back.ok && back.got < 10000 && back.got > 10000 * 0.9);

	/* free traders: SU markets */
	const q = Tr.newPlayer(home.id), suMkt = {currency: 'SU', holder: null, prices: {Iron: {su: 4, price: 4, buy: true}}}, w1 = q.wallet[code];
	const b2 = Tr.buy(q, wren, suMkt, 'Iron', 2, day);
	ok('11. where a front is fought over, free traders take your coin at an 8% cut', b2.ok && Math.abs(w1 - q.wallet[code] - 8 * E.rate(code, day) / 0.92) < 1e-6);

	/* services */
	ok('12. fuel: a tank of a few tonnes, at the market\'s fuel price; nothing to pay when full', Tr.tank(wren) > 2 && Tr.tank(wren) < 5 && Tr.refuelCost(wren, 1, mkt) == 0 && Math.abs(Tr.refuelCost(wren, 0.5, mkt) - 0.5 * Tr.tank(wren) * mkt.prices.Fuel.price) < 1e-9);
	const fit = M.fit(wren);
	ok('13. repairs: nothing when whole; 8% of the ship\'s value for a wreck', Tr.repairCost(wren, fit, mkt, day) == 0 && (fit.modules.forEach(m => m.hp = 0), Math.abs(Tr.repairCost(wren, fit, mkt, day) - 0.08 * S.value(wren) * E.rate(code, day)) < 1e-6));
	ok('14. a lost ship costs 5% of its value to replace', Math.abs(Tr.rebuyCost(p, wren, day).amount - 0.05 * S.value(wren) * E.rate(code, day)) < 1e-6);

	/* shipyards */
	const big = Tr.yard('halo', home.star, day), small = Tr.yard('trefoil', home.star, day);
	ok('15. a Halo\'s yard sells far more than an outpost\'s, which sells only XS and S hulls', big.length > small.length && small.every(x => ['XS', 'S'].includes(x.ship.size)) && small.length > 3);
	ok('16. never an enemy\'s designs', big.every(x => !x.ship.maker.startsWith('major') || x.ship.maker == home.id || F.relation(x.ship.maker, home.id) >= 0));
	const rich = Tr.newPlayer(home.id); rich.wallet[code] *= 40;
	const hauler = big.filter(x => x.ship.cargo > 50).sort((a, b) => a.price.low - b.price.low)[0], w2 = rich.wallet[code];
	const bs = Tr.buyShip(rich, rich.ship.model, hauler.ship.id, home.star, day);
	ok('17. buying a ship: its price, less your old one taken in part-exchange', bs.ok && rich.ship.model == hauler.ship.id && Math.abs(w2 - rich.wallet[code] - ((hauler.price.low + hauler.price.high) / 2 - bs.tradeIn)) < 1e-6 && bs.tradeIn > 0);
	rich.cargo.Iron = hauler.ship.cargo;
	ok('18. ...but your cargo must fit the new hold', Tr.buyShip(rich, rich.ship.model, 'wren', home.star, day).why == 'hold');
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
