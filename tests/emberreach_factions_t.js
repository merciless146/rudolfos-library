/* Ember Reach's factions, economy and reputation (wip/emberreach/factions.js, economy.js, reputation.js), in node.
     node tests/emberreach_factions_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js')), E = require(path.join(DIR, 'economy.js')), R = require(path.join(DIR, 'reputation.js'));
let P = 0, Fl = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { Fl++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
try {
	/* ---------- the great powers ---------- */
	const M = F.majors(); F.relations();
	ok('1. at least six great powers, each a species of its own with a currency', M.length >= 6 && new Set(M.map(m => m.species.name)).size == M.length && new Set(M.map(m => m.currency.code)).size == M.length);
	const N = G.GAL.north;
	ok('2. all in the northern sector, midway between the Core and the Outer Clouds', M.every(m => m.star.m >= N.mLo && m.star.m <= N.mHi && G.latitude(...m.at) >= N.latMin));
	ok('3. each has at least two allies and at least two enemies among the others', M.every(m => m.allies.length >= 2 && m.enemies.length >= 2), M.map(m => m.allies.length + '/' + m.enemies.length).join(' '));
	ok('4. relations are mutual', M.every(a => M.every(b => a == b || F.relation(a.id, b.id) == F.relation(b.id, a.id))));
	/* ---------- borders and wars ---------- */
	const W = F.wars();
	ok('5. a war for every pair of enemies', W.length == M.reduce((t, m) => t + m.enemies.length, 0) / 2);
	ok('6. every war has contested systems, on the border the two enemies share (not inside a third power\'s space)', W.every(w => w.systems.length >= 6 && w.systems.every(s => { const c = F.claimAt(s.at); return c.contested && c.contested.includes(w.a) && c.contested.includes(w.b) })), W.map(w => w.systems.length).join(','));
	ok('7. the fronts are in three dimensions (not on a plane)', (() => { const z = W.flatMap(w => w.systems.map(s => s.at[2])); return Math.max(...z) - Math.min(...z) > 50 })());
	ok('8. a power holds its home', M.every(m => F.claimAt(m.at).owner == m.id));
	const w = W[0], s0 = F.warState(w, 300), s1 = F.warState(w, 300);
	ok('9. the war on a given day is the same every time (nothing stored)', JSON.stringify(s0.systems) == JSON.stringify(s1.systems));
	const fronts = [0, 90, 180, 270, 360].map(d => F.warState(w, d).systems.map(s => s.holder).join());
	ok('10. the front moves from season to season', new Set(fronts).size > 1);
	const pushA = Object.fromEntries(w.systems.map(s => [s.id, 300])), pushB = Object.fromEntries(w.systems.map(s => [s.id, -300]));
	const sa = F.warState(w, 300, pushA), sb = F.warState(w, 300, pushB);
	ok('11. players move the front: effort for side A wins it systems, for side B the reverse', sa.score > s0.score + 0.3 && sb.score < s0.score - 0.3 && sa.systems.filter(s => s.holder == w.a).length > s0.systems.filter(s => s.holder == w.a).length, [sb.score, s0.score, sa.score].map(v => v.toFixed(2)).join(' < '));
	const ms = F.warMissions(M[0].id, 300);
	ok('12. great powers offer missions about their wars, against their enemies, paid in their own currency', ms.length > 0 && ms.every(m => M[0].enemies.includes(m.against) && m.currency == M[0].currency.code && m.reward > 0 && F.wars().find(x => x.id == m.war).systems.some(s => s.id == m.system)));
	/* ---------- small factions ---------- */
	const S = F.minors(), kinds = new Set(S.map(m => m.type));
	ok('13. small factions: nomads, criminals, prospectors and free ports', ['nomad', 'criminal', 'prospector', 'freeport'].every(k => kinds.has(k)));
	ok('14. many keep a fleet carrier or a dreadnought that sustains them (market or black market, repairs, fuel, a hangar)', S.filter(m => m.carrier).length >= 15 && S.filter(m => m.carrier).every(m => m.carrier.selfSufficient && m.carrier.services.includes('fuel') && m.carrier.services.includes('repairs') && m.carrier.services.includes('hangar')));
	const crim = S.find(m => m.type == 'criminal' && m.sites.length > 1), seasons = [0, 30, 60, 90, 120].map(d => F.whereIs(crim, d).site.id);
	ok('15. criminals rotate their hideouts with the seasons, and stay put within one', new Set(seasons).size > 1 && F.whereIs(crim, 31).site.id == F.whereIs(crim, 59).site.id);
	const pro = S.find(m => m.type == 'prospector' && m.sites.length > 1), sp = [...Array(24)].map((_, k) => F.whereIs(pro, k * 30).site.id);
	const runs = sp.reduce((a, v, k) => { if (k && v == sp[k - 1]) a[a.length - 1]++; else a.push(1); return a }, []);
	ok('16. prospectors hold a claim for several seasons, then move on', new Set(sp).size > 1 && Math.max(...runs.slice(1, -1)) >= 3, runs.join(','));
	const nom = S.find(m => m.type == 'nomad'), mv = F.whereIs(nom, 32), st = F.whereIs(nom, 40);
	ok('17. nomads travel between stops (a few days each season) and stay in between', mv.moving && mv.at && !st.moving && st.site, JSON.stringify([mv.moving, st.moving]));
	ok('18. free ports stay where they are', S.filter(m => m.type == 'freeport').every(m => F.whereIs(m, 0).site.id == F.whereIs(m, 999).site.id));
	ok('19. some criminals are privateers backed by a great power, hostile to its enemies', S.some(m => m.sponsor && F.relation(m.id, m.sponsor) > 0 && F.byId(m.sponsor).enemies.every(e => F.relation(m.id, e) < 0)));
	/* ---------- money ---------- */
	ok('20. the Standard Unit is the basket\'s cost at base values', Math.abs(E.basketCost(g => E.GOODS[g]) - 1) < 1e-9);
	const codes = M.map(m => m.currency.code), day = 250;
	ok('21. every currency has a rate, coins per Standard Unit', codes.every(c => E.rate(c, day) > 0.1 && E.rate(c, day) < 50));
	const loop = E.crossRate(codes[0], codes[1], day) * E.crossRate(codes[1], codes[2], day) * E.crossRate(codes[2], codes[0], day);
	ok('22. cross rates come from the basket: round the houses gives back what you started with', Math.abs(loop - 1) < 1e-9);
	ok('23. rates move over time (trade cycles)', codes.every(c => Math.abs(E.rate(c, 0) / E.rate(c, 400) - 1) > 0.001));
	const c0 = M[0].currency.code, war = W.find(x => x.a == M[0].id || x.b == M[0].id), side = war.a == M[0].id ? 1 : -1;
	const win = Object.fromEntries(war.systems.map(s => [s.id, 300 * side])), lose = Object.fromEntries(war.systems.map(s => [s.id, -300 * side]));
	ok('24. winning a war strengthens a currency, losing weakens it', E.rate(c0, day, {effort: win}) < E.rate(c0, day) && E.rate(c0, day, {effort: lose}) > E.rate(c0, day));
	ok('25. shocks (a raided convoy, a flooded market) move a rate and fade', E.rate(c0, day, {shocks: [{currency: c0, day: 240, size: 0.2, halfLife: 20}]}) > E.rate(c0, day) * 1.1 && Math.abs(E.rate(c0, 600, {shocks: [{currency: c0, day: 240, size: 0.2, halfLife: 20}]}) / E.rate(c0, 600) - 1) < 0.001);
	const home = E.exchange(1000, c0, F.byId(M[0].allies[0]).currency.code, day, M[0].id), enemy = E.exchange(1000, c0, F.byId(M[0].enemies[0]).currency.code, day, M[0].id);
	ok('26. changing money: a small spread at home (into an ally\'s coin); enemy currency refused (free ports and black markets take it, at a cut)', home.ok && home.spread < 0.06 && !enemy.ok && E.exchangeAnywhere(1000, c0, F.byId(M[0].enemies[0]).currency.code, day) > 0);
	const mk = E.market(M[0].star, day);
	ok('27. a station prices in its holder\'s currency', mk.currency == c0 && Math.abs(mk.prices.Iron.price / mk.prices.Iron.su - E.rate(c0, day)) < 1e-9);
	const fr = E.market(war.systems[0].star, day);
	ok('28. a front pays more for munitions, medicine, fuel and food', fr.prices.Munitions.su > mk.prices.Munitions.su * 1.3);
	/* ---------- the player ---------- */
	const pl = M.map(m => R.newPlayer(m.id));
	ok('29. a player can come from any great power: its home, its currency, its species\' ship', pl.every((p, i) => p.origin == M[i].id && p.wallet[M[i].currency.code] > 0 && p.ship.build == M[i].species.build));
	const p0 = pl[0];
	ok('30. starting standing follows the origin: Friendly at home and with its allies, Unfriendly with its enemies', R.tier(p0.rep[M[0].id]) == 'Friendly' && M[0].allies.every(a => p0.rep[a] > 0) && M[0].enemies.every(e => p0.rep[e] < 0));
	const before = Object.assign({}, p0.rep), d = R.act(p0, 'mission', M[0].id);
	ok('31. helping a power raises it, its allies a little, and lowers its enemies', d[M[0].id] > 0 && M[0].allies.every(a => p0.rep[a] > before[a]) && M[0].enemies.every(e => p0.rep[e] < before[e]));
	ok('32. a commission with a Friendly power; not with its enemy as well', R.enlist(p0, M[0].id).ok && !R.enlist(p0, M[0].enemies[0]).ok);
	const m1 = F.warMissions(M[0].id, day)[0], e0 = p0.effort[m1.system] || 0, r0 = p0.rep[m1.against];
	R.warEffort(p0, m1);
	ok('33. a war mission: war effort for the issuer (doubled with a commission), the enemy\'s anger, pay in the issuer\'s currency', p0.effort[m1.system] == e0 + 2 * m1.effort && p0.rep[m1.against] < r0 && p0.wallet[m1.currency] > 5000);
	R.act(p0, 'raidConvoy', M[1].id, {where: M[1].at});
	ok('34. crimes: a bounty in the currency of whoever\'s space it was, outlaw points, criminals warm to you', p0.bounties[F.byId(F.claimAt(M[1].at).owner).currency.code] > 0 && p0.lawful < 5 && S.filter(m => m.type == 'criminal').every(m => p0.rep[m.id] > pl[1].rep[m.id] - 1));
	const al = R.alignment(p0);
	ok('35. alignment: the power a player leans to, and lawful-to-outlaw', al.lean && al.lean.id == M[0].id && ['lawful', 'grey', 'outlaw'].includes(al.axis));
	ok('36. enemies of your commission treat you as a combatant', R.hostile(p0, M[0].enemies[0]) && !R.hostile(p0, M[0].allies[0]));
	const gap = Math.abs(p0.rep[M[0].id] - p0.start[M[0].id]); R.age(p0, 300);
	ok('37. standing drifts back towards where you started', Math.abs(p0.rep[M[0].id] - p0.start[M[0].id]) < gap);
} catch (e) { Fl++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + Fl) + ' passed'); process.exit(Fl ? 1 : 0);
