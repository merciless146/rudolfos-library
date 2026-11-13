/* ===== Ember Reach: trade (docs/plan-ember-reach.md, "Money", M3).
   The player (reputation.js: newPlayer) carries money in each great power's currency (wallet: code → coins) and
   goods in the ship's hold (cargo: good → tonnes, with what they cost on average in SU, so the market can show a
   profit).
   - Markets (economy.js: market) price in the holder's currency; you pay in it, so change money first at the
     station's exchange (Contacts). A contested system being fought over trades only in SU, through free traders:
     they take whatever you hold most of, at an 8% cut, and pay out in your home currency.
   - Trading for a power counts for its reputation (2 a thousand SU).
   - Services: fuel at the market's fuel price (a tank is a few tonnes, more on bigger ships); repairs at 8% of the
     ship's value for a ship wrecked from full.
   - Shipyards: Trefoil outposts sell the smallest hulls (XS, S), Lanterns up to M, Halos everything; never an
     enemy's designs. Your ship is taken in part-exchange at 80% of its price there, and your cargo must fit.
   - Losing a ship: the replacement costs 5% of its value (insurance), from your home currency if you have it.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const E = isNode ? require('./economy.js') : root.EmberEconomy, F = isNode ? require('./factions.js') : root.EmberFactions,
	S = isNode ? require('./ships.js') : root.EmberShips, R = isNode ? require('./reputation.js') : root.EmberReputation;
const TRADE = {freeCut: 0.08, repairShare: 0.08, rebuy: 0.05, tradeIn: 0.8, tankPerMetre: 0.35};
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'Capital'];
const YARD = {trefoil: 'S', bloom: 'S', lantern: 'M', halo: 'Capital'};

/* a new player from their origin (reputation.js), with an empty hold */
function newPlayer(originId) { const P = R.newPlayer(originId); P.cargo = {}; P.cost = {}; return P }
const shipOf = id => S.ships().find(s => s.id == id);
const held = P => Object.values(P.cargo || {}).reduce((t, q) => t + q, 0);
const free = (P, ship) => Math.max(0, ship.cargo - held(P));
const rate = (code, day) => code == 'SU' ? 1 : E.rate(code, day);
/* a wallet's worth in SU, at the day's rates */
const walletSU = (P, day) => Object.entries(P.wallet).reduce((t, [c, a]) => t + a / rate(c, day), 0);
/* everything: money, plus cargo at its base value */
const worth = (P, day) => walletSU(P, day) + Object.entries(P.cargo || {}).reduce((t, [g, q]) => t + q * E.GOODS[g], 0);
const origin = P => F.byId(P.origin);

/* paying `amount` in `code`; SU (free traders) is paid from the currency you hold most of, at their cut */
function pay(P, amount, code, day, dry) {
	if (code != 'SU') {
		if ((P.wallet[code] || 0) + 1e-9 < amount) return {ok: false, why: 'money', need: amount, have: P.wallet[code] || 0, code};
		if (!dry) P.wallet[code] -= amount;
		return {ok: true, code, amount};
	}
	const best = Object.entries(P.wallet).filter(([, a]) => a > 0).sort((a, b) => b[1] / rate(b[0], day) - a[1] / rate(a[0], day))[0];
	if (!best) return {ok: false, why: 'money', need: amount, have: 0, code: 'SU'};
	const cost = amount * rate(best[0], day) / (1 - TRADE.freeCut);
	if (best[1] + 1e-9 < cost) return {ok: false, why: 'money', need: cost, have: best[1], code: best[0]};
	if (!dry) P.wallet[best[0]] -= cost;
	return {ok: true, code: best[0], amount: cost};
}
/* being paid; SU from free traders comes in your home currency, less their cut */
function receive(P, amount, code, day) {
	if (code == 'SU') { const c = origin(P).currency.code; code = c; amount = amount * rate(c, day) * (1 - TRADE.freeCut) }
	P.wallet[code] = (P.wallet[code] || 0) + amount;
	return {code, amount};
}

/* ---- the market ---- */
/* how many tonnes you could buy: the hold's free space and what you can pay */
function canBuy(P, ship, mkt, good, day) {
	const q = mkt.prices[good]; if (!q) return 0;
	const space = free(P, ship); if (space <= 0) return 0;
	let money;
	if (mkt.currency != 'SU') money = (P.wallet[mkt.currency] || 0) / q.price;
	else { const c = Object.entries(P.wallet).sort((a, b) => b[1] / rate(b[0], day) - a[1] / rate(a[0], day))[0]; money = c ? c[1] / rate(c[0], day) * (1 - TRADE.freeCut) / q.price : 0 }
	return Math.max(0, Math.min(space, Math.floor(money + 1e-9)));
}
function buy(P, ship, mkt, good, qty, day) {
	const q = mkt.prices[good]; if (!q) return {ok: false, why: 'good'};
	qty = Math.floor(qty);
	if (qty <= 0) return {ok: false, why: 'qty'};
	if (qty > free(P, ship)) return {ok: false, why: 'hold', free: free(P, ship)};
	const p = pay(P, qty * q.price, mkt.currency, day);
	if (!p.ok) return p;
	const was = P.cargo[good] || 0;
	P.cost[good] = ((P.cost[good] || 0) * was + q.su * qty) / (was + qty);
	P.cargo[good] = was + qty;
	if (mkt.holder) R.act(P, 'trade', mkt.holder, {amount: qty * q.su / 1000});
	return {ok: true, qty, paid: p};
}
function sell(P, mkt, good, qty, day) {
	const q = mkt.prices[good]; if (!q) return {ok: false, why: 'good'};
	if (!q.buy) return {ok: false, why: 'market'};
	qty = Math.floor(qty);
	const have = P.cargo[good] || 0;
	if (qty <= 0 || qty > have) return {ok: false, why: 'qty', have};
	const got = receive(P, qty * q.price, mkt.currency, day), profit = (q.su - (P.cost[good] || q.su)) * qty;
	P.cargo[good] = have - qty; if (!P.cargo[good]) { delete P.cargo[good]; delete P.cost[good] }
	if (mkt.holder) R.act(P, 'trade', mkt.holder, {amount: qty * q.su / 1000});
	return {ok: true, qty, got, profit};
}

/* ---- money changing at a station held by `holder` ---- */
function exchange(P, amount, from, to, day, holder) {
	if (amount <= 0 || (P.wallet[from] || 0) + 1e-9 < amount) return {ok: false, why: 'money'};
	const r = E.exchange(amount, from, to, day, holder);
	if (!r.ok) return r;
	P.wallet[from] -= amount; P.wallet[to] = (P.wallet[to] || 0) + r.amount;
	return {ok: true, got: r.amount, spread: r.spread};
}

/* ---- services ---- */
const tank = ship => Math.max(1, Math.round(ship.length * TRADE.tankPerMetre * (ship.tank || 1) * 10) / 10);   /* a better fuel tank (outfit.js) holds more */
/* filling the tank from `fuel` (0..1), at this market's fuel price (in its currency) */
function refuelCost(ship, fuel, mkt) { return (1 - fuel) * tank(ship) * mkt.prices.Fuel.price }
/* repairs: the share of the modules' health that's missing, of 8% of the ship's value, in the market's currency */
function repairCost(ship, fit, mkt, day, hull) {
	const tot = fit.modules.reduce((t, m) => t + m.max, 0), miss = fit.modules.reduce((t, m) => t + m.max - m.hp, 0);
	/* with the hull's health (a share), half the bill is the hull */
	const k = hull == null ? miss / tot : (miss / tot + Math.max(0, 1 - hull)) / 2;
	return k * TRADE.repairShare * S.value(ship) * rate(mkt.currency, day);
}
/* a replacement ship: 5% of its value, in the home currency */
function rebuyCost(P, ship, day) { const c = origin(P).currency.code; return {code: c, amount: TRADE.rebuy * S.value(ship) * rate(c, day)} }

/* ---- shipyards ---- */
/* what a yard of this port class sells here today: never an enemy's designs */
function yard(portCls, star, day) {
	const max = SIZE_ORDER.indexOf(YARD[portCls] || 'S');   /* sizes it doesn't know, it doesn't sell */
	return S.ships().filter(s => { const k = SIZE_ORDER.indexOf(s.size); return k >= 0 && k <= max }).map(s => ({ship: s, price: S.price(s.id, star, day)})).filter(x => x.price);
}
/* what your ship fetches in part-exchange here (in the market's currency) */
function tradeIn(ship, star, day) {
	const p = S.price(ship.id, star, day);
	if (p) return {currency: p.currency, amount: TRADE.tradeIn * p.low};
	const mk = E.market(star, day);   /* an enemy's design: still worth its list value to a yard, less a fifth more */
	return {currency: mk.currency, amount: 0.6 * ship.priceSU[0] * rate(mk.currency, day)};
}
function buyShip(P, currentId, newId, star, day) {
	const cur = shipOf(currentId), nu = shipOf(newId), p = S.price(newId, star, day);
	if (!nu || !p) return {ok: false, why: 'sold'};
	if (held(P) > nu.cargo) return {ok: false, why: 'hold', need: held(P), cap: nu.cargo};
	const ti = tradeIn(cur, star, day), cost = (p.low + p.high) / 2 - (ti.currency == p.currency ? ti.amount : 0);
	if (cost > 0) { const r = pay(P, cost, p.currency, day); if (!r.ok) return r }
	else receive(P, -cost, p.currency, day);
	P.ship.model = newId;
	return {ok: true, cost, currency: p.currency, tradeIn: ti.amount};
}

const EmberTrade = {TRADE, YARD, newPlayer, held, free, walletSU, worth, pay, receive, canBuy, buy, sell, exchange, tank, refuelCost, repairCost, rebuyCost, yard, tradeIn, buyShip, rate};
if (isNode) module.exports = EmberTrade; else root.EmberTrade = EmberTrade;
})(typeof window != 'undefined' ? window : this);
