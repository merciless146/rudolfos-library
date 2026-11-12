/* ===== Ember Reach: money and markets (docs/plan-ember-reach.md, "The economy").
   - The Standard Unit (SU) is the game's measure of value: what a fixed basket of goods costs at average prices
     across the galaxy. It is not a currency anyone carries.
   - Each great power has its own currency. Its exchange rate is how many of its coins buy one basket (coins per SU),
     so rates are tied to the goods themselves. The rate moves with:
       its economy (a base level and slow drift), trade cycles (two waves of a few hundred days each),
       its wars (losing contested systems weakens a currency, winning them strengthens it),
       and shocks: events, and what players do (raiding a power's convoys, flooding its markets, big contracts).
   - Cross rates come from the two rates (coins of B per coin of A = rate B / rate A), so there is no free money
     going round in circles; the only cost is the exchange's spread, which is wider abroad and at war.
   - A good's price at a station: its base value in SU, times the station's supply and demand, times the local
     currency's rate.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const G = isNode ? require('./galaxy.js') : root.EmberGalaxy, F = isNode ? require('./factions.js') : root.EmberFactions;
const {rng, hashStr} = G;

/* goods: base value in SU per unit. The WOS resource set, then food, fuel and made goods */
const GOODS = {
	Iron: 4, Copper: 6, Coal: 3, Lead: 5, Aluminum: 7, Titanium: 14, Uranium: 30, Beryllium: 22, Jade: 40, Gold: 60, Diamond: 90,
	Food: 8, Water: 2, Fuel: 10, Medicine: 45, Munitions: 35, Machinery: 55, Electronics: 70, Artefacts: 400};
/* the basket that defines one SU: its cost at base values is exactly 1 */
const BASKET = (() => { const q = {Iron: 10, Copper: 5, Food: 10, Water: 20, Fuel: 5, Machinery: 1, Electronics: 1}; let c = 0; for (const g in q) c += q[g] * GOODS[g]; for (const g in q) q[g] /= c; return q })();
const MINED = ['Iron', 'Copper', 'Coal', 'Lead', 'Aluminum', 'Titanium', 'Uranium', 'Beryllium', 'Jade', 'Gold', 'Diamond'];
const basketCost = price => Object.entries(BASKET).reduce((t, [g, q]) => t + q * price(g), 0);

/* ---------- exchange rates ---------- */
/* shocks: [{currency, day, size, halfLife}] (size: + makes the currency weaker, - stronger) */
function rate(code, day, ctx) {
	const m = F.majors().find(x => x.currency.code == code);
	if (!m) return 1;
	const r = rng(hashStr('fx:' + code));
	/* a base level: roughly 0.5-20 coins per SU, poorer economies having more coins to the basket */
	let L = Math.log(0.5 + 19 * r() * r()) - 0.4 * (m.economy - 1);
	/* slow drift: up to 2% a year either way */
	L += (r() - 0.5) * 0.04 * day / 365;
	/* trade cycles */
	for (let k = 0; k < 2; k++) { const P = 180 + r() * 520, A = 0.02 + r() * 0.05, ph = r() * 2 * Math.PI; L += A * Math.sin(2 * Math.PI * day / P + ph) }
	/* wars: each war's score (from this side) moves the currency up to 10% */
	for (const w of F.wars()) {
		if (w.a != m.id && w.b != m.id) continue;
		const st = F.warState(w, day, ctx && ctx.events), sc = w.a == m.id ? st.score : -st.score;
		L -= 0.1 * sc;
	}
	/* shocks fade by half every halfLife days */
	for (const s of (ctx && ctx.shocks) || []) if (s.currency == code && day >= s.day) L += s.size * Math.pow(0.5, (day - s.day) / (s.halfLife || 60));
	return Math.exp(L);
}
/* coins of `to` per coin of `from`; spread: what the exchange keeps */
function crossRate(from, to, day, ctx) { return rate(to, day, ctx) / rate(from, day, ctx) }
/* changing money at a station held by `holder`: spread by how the holder stands with the currency's issuer */
function exchange(amount, from, to, day, holder, ctx) {
	const issuer = c => (F.majors().find(m => m.currency.code == c) || {}).id;
	const spreadFor = c => { const i = issuer(c); if (!i || !holder) return 0.15; if (i == holder) return 0.015; const r = F.relation(holder, i); return r > 0 ? 0.03 : r < 0 ? null : 0.05 };
	const s1 = spreadFor(from), s2 = spreadFor(to);
	if (s1 == null || s2 == null) return {ok: false, why: 'This station will not touch an enemy\'s currency (try a free port or the black market).'};
	const got = amount * crossRate(from, to, day, ctx) * (1 - s1) * (1 - s2);
	return {ok: true, amount: got, spread: 1 - (1 - s1) * (1 - s2)};
}
/* free ports and black markets take anything, at a cut */
function exchangeAnywhere(amount, from, to, day, cut, ctx) { return amount * crossRate(from, to, day, ctx) * (1 - (cut == null ? 0.08 : cut)) }

/* ---------- prices at a station ---------- */
/* supply and demand for each good from the system itself: what its planets mine and grow, and what a front needs */
function market(star, day, ctx) {
	const sy = G.system(star), claim = F.claimAt([star.x, star.y, star.z]), r = rng(hashStr('market:' + star.id));
	/* a contested system trades in the currency of whichever side holds it today; while it is fought over, nobody's */
	let holder = claim.owner;
	if (claim.contested) { const w = F.wars().find(w => w.systems.some(x => x.id == star.id)); const st = w && F.warState(w, day, ctx && ctx.events).systems.find(x => x.id == star.id); holder = st ? st.holder : null }
	const m = holder && F.byId(holder), code = m ? m.currency.code : null;
	const have = {};
	for (const p of sy.planets) { for (const res of p.res) have[res] = (have[res] || 0) + 1; if (p.alive) have.Food = (have.Food || 0) + 3; if (p.water) have.Water = (have.Water || 0) + 2; if (p.gas) have.Fuel = (have.Fuel || 0) + 2; if (p.ruins) have.Artefacts = (have.Artefacts || 0) + 1 }
	const metals = Math.pow(10, star.FeH || 0), front = !!claim.contested;
	const prices = {};
	for (const [g, base] of Object.entries(GOODS)) {
		let f = 1 + (r() - 0.5) * 0.2;
		if (have[g]) f *= Math.pow(0.85, Math.min(5, have[g])) / (MINED.includes(g) ? Math.sqrt(metals) : 1);   /* metal-rich stars: cheaper ore */
		else if (['Food', 'Water', 'Fuel'].includes(g)) f *= 1.3;
		if (front && ['Munitions', 'Medicine', 'Fuel', 'Food'].includes(g)) f *= 1.6;   /* the war needs these */
		if (g == 'Artefacts' && !have[g]) f *= 1.5;
		/* a gentle seasonal swing, so routes worth running change */
		f *= 1 + 0.08 * Math.sin(2 * Math.PI * (day / F.SEASON_DAYS + r()) / 4);
		const su = base * f;
		prices[g] = {su, price: code ? su * rate(code, day, ctx) : su, buy: !!have[g] || r() < 0.5};
	}
	return {star: star.id, holder, contested: claim.contested, currency: code || 'SU', prices};
}

const EmberEconomy = {GOODS, BASKET, basketCost, rate, crossRate, exchange, exchangeAnywhere, market};
if (isNode) module.exports = EmberEconomy; else root.EmberEconomy = EmberEconomy;
})(typeof window != 'undefined' ? window : this);
