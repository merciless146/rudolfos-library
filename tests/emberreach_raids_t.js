/* Ember Reach's raids on surface ports (0.6.6: raids.js; docs/plan-ember-reach-landing-work.md L3.6), in node: the
   odds by who holds a port (and a colony's by its security), the same answer all day for a port, the raiders'
   number, what they loot, the defence reward and the standing it brings.
     node tests/emberreach_raids_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Rd = req('raids.js'), R = req('reputation.js'), F = req('factions.js'), Tr = req('trade.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
try {
	const q = (kind, owner, extra) => Object.assign({id: 'surface:W:' + kind, kind, owner: owner || null}, extra || {});
	const o = {ind: Rd.odds(q('outpost')), held: Rd.odds(q('outpost', 'x')), cap: Rd.odds(q('outpost', 'x'), {capital: true}), sp: Rd.odds(q('starport', 'x')), base: Rd.odds(q('base', 'x')),
		colLow: Rd.odds(q('outpost', 'x', {colony: true}), {security: 0.1}), colHigh: Rd.odds(q('outpost', 'x', {colony: true}), {security: 1})};
	ok('1. independent ports are raided most, held ones less, a capital\'s and a great port\'s least; a forward base more than a held port', o.ind > o.base && o.base > o.held && o.held > o.cap && o.sp == o.cap, o);
	ok('2. a colony\'s port by its security (never below 5%)', o.colLow > o.colHigh && o.colHigh == 0.05 && Math.abs(o.colLow - 0.27) < 1e-9, o);
	/* the same answer all day; over many days, about as often as the odds */
	const p0 = q('outpost'), same = [0.1, 0.5, 0.99].every(f => Rd.under('st1', p0, 40 + f) == Rd.under('st1', p0, 40));
	let hits = 0; for (let d = 0; d < 4000; d++) if (Rd.under('st1', p0, d)) hits++;
	ok('3. whether a port is raided is the same all day, and over many days about as often as its odds', same && Math.abs(hits / 4000 - o.ind) < 0.025, {same, rate: hits / 4000});
	ok('4. the raiders: two at a camp or outpost, three at a settlement, base or landing field, four at a starport', Rd.size(q('camp')) == 2 && Rd.size(q('outpost')) == 2 && Rd.size(q('settlement')) == 3 && Rd.size(q('base')) == 3 && Rd.size(q('field')) == 3 && Rd.size(q('starport')) == 4);
	const mkt = {prices: {Food: {stock: 400}, Water: {stock: 900}, Ore: {stock: 50}, Gems: {stock: 3}}};
	const got = Rd.loot(mkt, 'st1', p0, 12);
	ok('5. they loot the two goods the port has most of, 15-35% of each', got.length == 2 && got[0].good == 'Water' && got[1].good == 'Food' && got.every(g => { const st = mkt.prices[g.good].stock; return g.tons >= Math.floor(st * 0.15) && g.tons <= Math.ceil(st * 0.35) }), got);
	ok('6. nothing to loot when the port has next to nothing', Rd.loot({prices: {Gems: {stock: 3}}}, 'st1', p0, 12).length == 0);
	ok('7. the defence reward grows with the raiders\' number', Rd.reward(4) == 2 * Rd.reward(2) && Rd.reward(0) == Rd.reward(1));
	const pl = Tr.newPlayer(F.majors()[0].id), who = F.majors()[2].id, before = pl.rep[who] || 0;
	R.act(pl, 'defendPort', who);
	ok('8. driving a raid off brings standing with the port\'s holder', (pl.rep[who] || 0) > before, {before, after: pl.rep[who]});
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
