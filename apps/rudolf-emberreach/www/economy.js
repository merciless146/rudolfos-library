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
   - A good's price at a port: its base value in SU, moved a little by the port's stock and demand and its people
     (markets, below), times the local currency's rate.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const G = isNode ? require('./galaxy.js') : root.EmberGalaxy, F = isNode ? require('./factions.js') : root.EmberFactions;
const {rng, hashStr} = G;

/* goods: base value in SU per unit. The WOS resource set, then food, fuel and made goods */
const GOODS = {
	Iron: 4, Copper: 6, Coal: 3, Lead: 5, Aluminum: 7, Titanium: 14, Uranium: 30, Beryllium: 22, Jade: 40, Gold: 60, Diamond: 90,
	Food: 8, Water: 2, Fuel: 10, Medicine: 45, Munitions: 35, Machinery: 55, Electronics: 70, Artefacts: 400,
	/* found only in the Rift (galaxy.js): mined there, or taken from the Precursors' ruins */
	Nullite: 180, Voidglass: 320, Aetherium: 260, 'Precursor Relics': 1500};
const RIFT_GOODS = ['Nullite', 'Voidglass', 'Aetherium', 'Precursor Relics'];
/* the basket that defines one SU: its cost at base values is exactly 1 */
const BASKET = (() => { const q = {Iron: 10, Copper: 5, Food: 10, Water: 20, Fuel: 5, Machinery: 1, Electronics: 1}; let c = 0; for (const g in q) c += q[g] * GOODS[g]; for (const g in q) q[g] /= c; return q })();
const MINED = ['Iron', 'Copper', 'Coal', 'Lead', 'Aluminum', 'Titanium', 'Uranium', 'Beryllium', 'Jade', 'Gold', 'Diamond'];
const basketCost = price => Object.entries(BASKET).reduce((t, [g, q]) => t + q * price(g), 0);

/* ---------- exchange rates ---------- */
/* shocks: [{currency, day, size, halfLife}] (size: + makes the currency weaker, - stronger) */
/* colonies' scrips (colonies.js registers each player's) */
const SCRIP = new Map();
function registerScrip(code, fn) { SCRIP.set(code, fn) }
function rate(code, day, ctx) {
	if (SCRIP.has(code)) return SCRIP.get(code)(day);
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

/* ---------- markets (0.3.7: the foundation the galaxy's trade is built on) ----------
   Every port keeps its own market, set by what it is and where it stands:
   - Its economy: a mix from its kind (a capital's great port runs high tech and industry; a mining camp extracts; a
     forward base is military...) blended with what its world gives (a gas giant refines fuel, a living world farms,
     a barren rock is mined, ice gives water, ruins draw tourists and sell artefacts). A colony's facilities set its
     port's mix instead (colonies.js economy). The system's economy is its ports' mixes, weighed by their people.
   - What it supplies and demands: each economy makes some goods and uses others (ECON); its people also eat, drink
     and need medicine. A good both made and used is netted. An extraction economy mines its own world's ores (or
     the system's, if its world has none).
   - How much: supply and demand are measured against the port's people (travel.js portPop): a market of about
     25 × log10(people)² tonnes each way (less what the port makes and uses itself), from a few hundred tonnes in
     all at a mining camp to a few thousand at a capital, shared out by the mix. A metal-rich star's mines turn out
     more.
   - Prices: a good's base value, moved a little by the stock (a full stock up to 22% under the base, an empty one
     at it) and by the demand (a full demand up to 25% over), and a slight premium where more people live (1.5% per
     power of ten). A good the port neither makes nor uses is quoted, but not traded. Wars and the Rift keep their
     own rules (a front pays 60% over for war goods; the Rift's goods, below).
   - Over the calendar: each good's stock and demand wander slowly round a level (a cycle of 45 to 135 days each,
     seeded per port), and what a player buys or sells moves them; that comes back by itself, 5% a day (half in
     about two weeks). Only the player's changes are kept (the save: P.markets). */
const ECON = {extraction: {makes: 'res', uses: ['Food', 'Machinery', 'Water']}, refinery: {makes: ['Fuel', 'Aluminum', 'Titanium'], uses: ['Iron', 'Copper']},
	agriculture: {makes: ['Food', 'Water'], uses: ['Machinery', 'Medicine']}, industrial: {makes: ['Machinery', 'Munitions'], uses: ['Iron', 'Aluminum', 'Titanium']},
	hightech: {makes: ['Electronics', 'Medicine'], uses: ['Beryllium', 'Gold']}, military: {makes: ['Munitions'], uses: ['Food', 'Fuel', 'Medicine']},
	tourism: {makes: [], uses: ['Food', 'Medicine', 'Artefacts']}, contraband: {makes: [], uses: []},
	ice: {makes: ['Water'], uses: ['Machinery', 'Fuel']}, ruins: {makes: ['Artefacts'], uses: ['Machinery', 'Food']}};
/* what each kind of world gives a port on or over it */
const WORLD_ECON = {Gas: {refinery: 1}, Barren: {extraction: 1}, Exotic: {extraction: 0.6, hightech: 0.4}, Desert: {extraction: 0.8, industrial: 0.2}, Tundra: {extraction: 0.6, ice: 0.4},
	Ocean: {agriculture: 0.8, ice: 0.2}, Terra: {agriculture: 0.7, tourism: 0.3}, Forest: {agriculture: 0.7, tourism: 0.3}, EarthLike: {agriculture: 0.5, hightech: 0.2, tourism: 0.3}};
/* what each kind of port runs, and how much of its mix comes from its world instead */
const PORT_ECON = {
	halo: {mix: {hightech: 0.35, industrial: 0.35, tourism: 0.15, military: 0.15}, world: 0.2}, lantern: {mix: {hightech: 0.35, industrial: 0.35, tourism: 0.3}, world: 0.4},
	bloom: {mix: {industrial: 0.6, hightech: 0.4}, world: 0.4}, trefoil: {mix: {refinery: 1}, world: 0.7}, maw: {mix: {military: 1}, world: 0.3}, anchorage: {mix: {refinery: 1}, world: 0.6},
	starport: {mix: {industrial: 0.6, hightech: 0.4}, world: 0.4}, field: {mix: {industrial: 0.5, refinery: 0.5}, world: 0.3}, settlement: {mix: {agriculture: 0.5, industrial: 0.5}, world: 0.6},
	outpost: {mix: {refinery: 0.5, industrial: 0.5}, world: 0.6}, camp: {mix: {extraction: 1}, world: 0}, base: {mix: {military: 1}, world: 0}};
const PEOPLE = {Food: 0.15, Water: 0.1, Medicine: 0.05};   /* what every port's people use, as shares of its market */
const MKT = {feedDays: 10, per: 25, makeLow: 0.78, needHigh: 0.25, popK: 0.015, untraded: 1.1, level: 0.6, swing: 0.25, cycle: [45, 135], recover: 0.95, front: 1.6, riftDemand: 500};
const Tv = () => isNode ? require('./travel.js') : root.EmberTravel;
const portKind = q => !q ? null : q.maw ? 'maw' : q.anchorage ? 'anchorage' : q.surface ? q.kind : q.cls;
const addMix = (to, mix, k) => { for (const [e, w] of Object.entries(mix)) to[e] = (to[e] || 0) + w * k; return to };
/* a port's economy: {economy: share}, summing to 1 */
function portEconomy(star, q, colonyEcon) {
	if (colonyEcon && Object.keys(colonyEcon).length) { const t = Object.values(colonyEcon).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(colonyEcon).map(([e, w]) => [e, w / t])) }
	const pl = G.system(star).planets, w = (q && pl.find(p => p.name == q.world)) || pl.slice().sort((a, b) => (b.alive - a.alive) || (b.esi - a.esi))[0];
	const K = PORT_ECON[portKind(q)] || {mix: {industrial: 1}, world: 0.5}, wm = Object.assign({}, w ? WORLD_ECON[w.type] || {extraction: 1} : {industrial: 1});
	if (w && w.ruins) addMix(wm, {ruins: 0.3}, 1);
	const wt = Object.values(wm).reduce((a, b) => a + b, 0);
	const out = addMix(addMix({}, K.mix, 1 - K.world), wm, K.world / wt);
	return out;
}
/* the system's economy: its ports' mixes weighed by their people (none: wild) */
function systemEconomy(star, day) {
	const T = Tv(), out = {}; let tot = 0;
	for (const q of T.portsAt(star, day)) { const n = Math.max(1, T.portPop(star, q)), k = Math.log10(n + 10); addMix(out, portEconomy(star, q), k); tot += k }
	for (const e in out) out[e] /= tot || 1;
	return out;
}
const ECON_NAME = {extraction: 'Extraction', refinery: 'Refinery', agriculture: 'Agriculture', industrial: 'Industrial', hightech: 'High tech', military: 'Military', tourism: 'Tourism', contraband: 'Contraband', ice: 'Ice mining', ruins: 'Ruins'};
const econLabel = mix => Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, w], i) => !i || w >= 0.2).map(([e]) => ECON_NAME[e] || e).join(' / ') || 'None';
/* the tonnes a port supplies and demands of each good at its usual level: {supply: {g: t}, demand: {g: t}} */
function capacities(star, q, mix, people) {
	const C = MKT.per * Math.pow(Math.log10(Math.max(10, people)), 2), pl = G.system(star).planets, w = q && pl.find(p => p.name == q.world);
	const ores = ((w && w.res) || []).filter(g => MINED.includes(g)), sysOres = [...new Set(pl.flatMap(p => p.res || []))].filter(g => MINED.includes(g)), res = ores.length ? ores : sysOres;
	const net = {};
	for (const [e, share] of Object.entries(mix)) {
		const L = ECON[e]; if (!L) continue;
		const makes = L.makes === 'res' ? res : L.makes;
		for (const g of makes) net[g] = (net[g] || 0) + share / makes.length;
		for (const g of L.uses) net[g] = (net[g] || 0) - share / L.uses.length * 0.6;
	}
	for (const [g, k] of Object.entries(PEOPLE)) net[g] = (net[g] || 0) - k;
	const metals = Math.pow(10, star.FeH || 0), supply = {}, demand = {};
	for (const [g, v] of Object.entries(net)) { if (v > 0.005) supply[g] = Math.round(C * v * (MINED.includes(g) ? Math.sqrt(metals) : 1)); else if (v < -0.005) demand[g] = Math.round(-C * v) }
	return {supply, demand, size: C};
}
/* a port market's key in the save, and its record of the player's trades there */
const keyOf = (star, q) => star.id + ':' + ((q && q.id) || 'orbital');
const cycle = (key, g, w, day) => { const r = rng(hashStr('mkt:' + key + ':' + g + ':' + w)), P = MKT.cycle[0] + r() * (MKT.cycle[1] - MKT.cycle[0]), ph = r(); return MKT.level + MKT.swing * Math.sin(2 * Math.PI * (day / P + ph)) };
/* the player's changes, decayed to today: {s: {g: t}, d: {g: t}} */
function offsets(P, key, day) {
	const e = P && P.markets && P.markets[key]; if (!e) return {s: {}, d: {}};
	const k = Math.pow(MKT.recover, Math.max(0, day - e.day)), f = o => Object.fromEntries(Object.entries(o || {}).map(([g, v]) => [g, v * k]));
	return {s: f(e.s), d: f(e.d)};
}
/* a trade at a port: tonnes bought take from its stock, tonnes sold fill its demand (the market comes back by itself) */
function record(P, mkt, good, qty, sold, day) {
	if (!P || !mkt.key) return;
	const o = offsets(P, mkt.key, day), m = P.markets = P.markets || {}, w = sold ? 'd' : 's';
	o[w][good] = (o[w][good] || 0) - qty;
	for (const x of ['s', 'd']) for (const g in o[x]) if (Math.abs(o[x][g]) < 0.5) delete o[x][g];
	if (!Object.keys(o.s).length && !Object.keys(o.d).length) delete m[mkt.key]; else m[mkt.key] = {day, s: o.s, d: o.d};
	/* (0.6.2) the co-op wing: the host's game passes each change on, a guest's sends its trade to the host */
	if (EmberEconomy.onRecord) try { EmberEconomy.onRecord(P, mkt.key, good, qty, sold, day) } catch (e) {}
}
/* (0.6.2) a market's record as it may come from the network: {day, s: {good: t}, d: {good: t}}, or null */
function recordOk(e) {
	if (e === null) return true;
	const part = o => o && typeof o == 'object' && !Array.isArray(o) && Object.keys(o).length <= 80 && Object.entries(o).every(([g, v]) => g.length <= 40 && typeof v == 'number' && isFinite(v) && Math.abs(v) < 1e7);
	return !!e && typeof e == 'object' && typeof e.day == 'number' && isFinite(e.day) && e.day >= 0 && part(e.s) && part(e.d);
}
/* the market at a star's port. ctx: {port (travel.js portsAt's record; else the system's first port), P (the player:
   their trades there), holder (a colony's sponsor), econ (a colony's facilities), people (a colony's), feed (its
   surface mines' goods, t a day: 0.4.9), events,
   shocks} */
function market(star, day, ctx) {
	ctx = ctx || {};
	const claim = star.rift || star.heart ? {owner: null, contested: null} : F.claimAt([star.x, star.y, star.z]);
	/* a contested system trades in the currency of whichever side holds its part of the front today (the nearest key
	   system); while that is being fought over, nobody's */
	let holder = claim.owner;
	if (claim.contested) { const h = F.contestedHolder([star.x, star.y, star.z], day, ctx.events); holder = h.fighting ? null : h.holder }
	/* a colony's port trades in its sponsor's coin, wherever it stands */
	if (ctx.holder) holder = ctx.holder;
	const m = holder && F.byId(holder), code = m ? m.currency.code : null, front = !!claim.contested;
	const T = Tv(), q = ctx.port || T.portsAt(star, day)[0] || null, colony = !!(ctx.econ && Object.keys(ctx.econ).length);
	/* (an anchorage runs itself, nobody aboard, but its automated market trades as a small port's) */
	const people = ctx.people != null ? Math.max(50, ctx.people) : q ? Math.max(colony ? 50 : 0, q.anchorage ? 2000 : 0, T.portPop(star, q)) : colony ? 50 : 0, mix = q || colony ? portEconomy(star, q, ctx.econ) : {};
	const cap = people ? capacities(star, q, mix, people) : {supply: {}, demand: {}, size: 0}, key = keyOf(star, q), off = offsets(ctx.P, key, day);
	/* (0.4.9) a colony's surface mines feed their goods to its port: ten days of their output in stock */
	for (const [g, t] of Object.entries(ctx.feed || {})) if (GOODS[g]) cap.supply[g] = (cap.supply[g] || 0) + Math.round(t * MKT.feedDays);
	const metals = Math.pow(10, star.FeH || 0), popK = 1 + MKT.popK * Math.log10(Math.max(1, people)), prices = {};
	for (const [g, base] of Object.entries(GOODS)) {
		const sc = cap.supply[g] || 0, dc = cap.demand[g] || 0;
		const stock = sc ? Math.max(0, Math.min(sc, sc * cycle(key, g, 's', day) + (off.s[g] || 0))) : 0;
		const want = dc ? Math.max(0, Math.min(dc, dc * cycle(key, g, 'd', day) + (off.d[g] || 0))) : 0;
		let f = 1;
		if (sc) f *= MKT.makeLow + (1 - MKT.makeLow) * (1 - stock / sc);
		if (dc) f *= 1 + MKT.needHigh * want / dc;
		if (!sc && !dc) f *= MKT.untraded;
		if (MINED.includes(g)) f *= Math.pow(metals, -0.15);   /* (metal-rich stars: ore a little cheaper) */
		f *= popK;
		if (front && ['Munitions', 'Medicine', 'Fuel', 'Food'].includes(g)) f *= MKT.front;   /* the war needs these */
		let buy = want >= 1, none = stock < 1;
		/* the Rift's goods: nobody this side has any to sell, and everyone buys them at a premium; the Rift's own
		   anchorages pay half and sell what's mined around them */
		if (RIFT_GOODS.includes(g)) {
			const mined = G.system(star).planets.some(p => (p.res || []).includes(g));
			if (star.rift) { f *= 0.5; buy = true; none = !mined } else { f *= 1.25; buy = true; none = true }
		}
		const su = base * f;
		prices[g] = {su, price: code ? su * rate(code, day, ctx) : su, buy, none, stock: Math.floor(stock), demand: RIFT_GOODS.includes(g) && buy ? MKT.riftDemand : Math.floor(want), supplyCap: sc, demandCap: dc};
	}
	return {star: star.id, key, port: q && q.id, again: P => market(star, day, Object.assign({}, ctx, {P: P || ctx.P})), people, economy: mix, economyName: econLabel(mix), holder, contested: claim.contested, currency: code || 'SU', prices};
}

const EmberEconomy = {onRecord: null, recordOk, MKT, WORLD_ECON, PORT_ECON, PEOPLE, portEconomy, systemEconomy, econLabel, capacities, keyOf, offsets, record, RIFT_GOODS, ECON, registerScrip, GOODS, BASKET, basketCost, rate, crossRate, exchange, exchangeAnywhere, market};
if (isNode) module.exports = EmberEconomy; else root.EmberEconomy = EmberEconomy;
})(typeof window != 'undefined' ? window : this);
