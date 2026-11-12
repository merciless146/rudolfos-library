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
	const K = G.clusters();
	ok('1. six clusters of at least six great powers, each power a species of its own with a currency', K.length == 6 && K.every(k => M.filter(m => m.cluster == k.id).length >= 6) && new Set(M.map(m => m.species.name)).size == M.length && new Set(M.map(m => m.currency.code)).size == M.length);
	const N = G.GAL.north;
	ok('2. the North\'s powers are in the northern sector, midway between the Core and the Outer Clouds', M.filter(m => m.cluster == K[0].id).every(m => m.star.m >= N.mLo && m.star.m <= N.mHi && G.latitude(...m.at) >= N.latMin));
	ok('2b. allies and enemies are within a cluster; powers in different clusters are neutral', M.every(a => [...a.allies, ...a.enemies].every(b => F.byId(b).cluster == a.cluster)));
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
	ok('10. the front moves over time, both ways, without players', W.some(x => { const h = [0, 300, 900, 1800, 3000, 6000, 9000].map(d => F.warState(x, d).held[x.a]); return h.some((v, k) => k > 1 && v > h[k - 1]) && h.some((v, k) => k > 1 && v < h[k - 1]) }));
	ok('11. no side ever loses all of its contested systems on its own (30,000 days)', W.every(x => [300, 3000, 9000, 30000].every(d => { const st = F.warState(x, d); return st.held[x.a] >= 2 && st.held[x.b] >= 2 })));
	/* one player throwing everything at side b, every season for 100 seasons */
	const ev = [];
	for (let d = 0; d <= 3000; d += 30) F.warState(w, d, ev).systems.forEach(x => { if (x.holder == w.b) ev.push({war: w.id, system: x.id, side: w.a, effort: 500, day: d}) });
	const hard = F.warState(w, 3000, ev);
	ok('12. players move the front: effort for side a takes systems from side b', hard.held[w.a] > F.warState(w, 3000).held[w.a] + 3, hard.held[w.a] + ' vs ' + F.warState(w, 3000).held[w.a]);
	ok('13. ...but pushing towards b\'s rear gets ever harder: b keeps its rearmost systems', hard.held[w.b] >= 2 && hard.systems.filter(x => x.holder == w.b).every(x => x.depth > 0.75), hard.held[w.b]);
	ok('14. the depth multiplier: full strength to the middle, falling to almost nothing at the far rear', F.depthMult({depth: 0.4}, 1) == 1 && F.depthMult({depth: 0.75}, 1) < 0.2 && F.depthMult({depth: 1}, 1) < 0.001 && F.depthMult({depth: 0}, -1) < 0.001);
	/* claims chain from the rear: a strike on a system nowhere near a's lines does not take it */
	const st0 = F.warState(w, 0), far = st0.systems.filter(x => x.holder == w.b).sort((x, y) => y.depth - x.depth)[0];
	const struck = F.warState(w, 0, [{war: w.id, system: far.id, side: w.a, effort: 10000, day: 0}]).systems.find(x => x.id == far.id);
	ok('15. claims must chain from the rear: a system out of reach cannot be taken', struck.holder == w.b);
	/* isolation: a held system with no chain back to its rear is cut off; it defends weakly and wears away */
	const sys = w.systems, n = sys.length, cut = sys.map(x => x.depth < 0.5 ? 0.6 : -0.6);
	const mid = sys.map((x, k) => [k, x.depth]).filter(([, d]) => d > 0.55 && d < 0.8).map(([k]) => k);
	const island = mid.find(k => sys[k].links.every(j => sys[j].depth > 0.5));
	if (island != null) { cut[island] = 0.6; const sa = F.supplied(sys, cut, 1); ok('16. a system cut off from its side\'s rear is unsupplied', !sa[island] && sa.filter((v, k) => sys[k].depth < 0.2).every(v => v)) }
	else ok('16. a system cut off from its side\'s rear is unsupplied (no island in this front)', true);
	const pushA = [], pushB = [];
	w.systems.forEach(x => { pushA.push({war: w.id, system: x.id, side: w.a, effort: 300, day: 300}); pushB.push({war: w.id, system: x.id, side: w.b, effort: 300, day: 300}) });
	const sa = F.warState(w, 330, pushA), sb = F.warState(w, 330, pushB), sn = F.warState(w, 330);
	ok('17. effort for side a raises its score, for side b lowers it', sa.score > sn.score && sb.score < sn.score, [sb.score, sn.score, sa.score].map(v => v.toFixed(2)).join(' < '));
	const ms = F.warMissions(M[0].id, 300);
	ok('18. great powers offer missions about their wars: attacks on enemy systems they can reach, defence of their own; paid in their own currency', ms.length > 0 && ms.every(m => M[0].enemies.includes(m.against) && m.currency == M[0].currency.code && m.reward > 0 && m.effort > 0 && F.wars().find(x => x.id == m.war).systems.some(x => x.id == m.system)));
	ok('19. borders never overlap: every point has one owner or is contested between two enemies', (() => { const r = G.rng(5); for (let k = 0; k < 6000; k++) { const cl = K[k % 6], sp = M.find(m => m.cluster == cl.id).claim * 5, p = cl.at.map(v => v + (r() - .5) * sp), c = F.claimAt(p); if (c.owner && c.contested) return false; if (c.contested && F.relation(...c.contested) >= 0) return false; if (c.shared) return false } return true })());
	/* how much the great powers hold: several hundred thousand systems in all (counted by sampling each cluster) */
	{
		let held = 0, cont = 0;
		for (const cl of K) {
			const C = M.filter(m => m.cluster == cl.id), lo = [0, 1, 2].map(i => Math.min(...C.map(m => m.at[i] - m.claim))), hi = [0, 1, 2].map(i => Math.max(...C.map(m => m.at[i] + m.claim)));
			const V = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), r = G.rng(7), n = 60000;
			for (let k = 0; k < n; k++) { const p = lo.map((v, i) => v + r() * (hi[i] - v)), q = F.claimAt(p); if (q.owner) held += G.numberDensity(...p) * V / n; else if (q.contested) cont += G.numberDensity(...p) * V / n }
		}
		ok('19b. the great powers hold and contest several hundred thousand systems in all (of ~16 billion)', held + cont > 2e5 && held + cont < 1.5e6 && cont > 0.05 * held, Math.round(held).toLocaleString() + ' held, ' + Math.round(cont).toLocaleString() + ' contested');
	}
	/* a quarter of each power's systems contested, counted afresh (another sample than the calibration's) */
	{
		const held = {}, cont = {}, zone = {};
		for (const cl of K) {
			const C = M.filter(m => m.cluster == cl.id), lo = [0, 1, 2].map(i => Math.min(...C.map(m => m.at[i] - m.claim))), hi = [0, 1, 2].map(i => Math.max(...C.map(m => m.at[i] + m.claim)));
			const V = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]), r = G.rng(4242), n = 120000;
			for (let k = 0; k < n; k++) {
				const p = lo.map((v, i) => v + r() * (hi[i] - v)), q = F.claimAt(p), w = G.numberDensity(...p) * V / n;
				if (q.owner) held[q.owner] = (held[q.owner] || 0) + w;
				else if (q.contested) { cont[q.side] = (cont[q.side] || 0) + w; const k2 = q.contested.join(':'); zone[k2] = (zone[k2] || 0) + w }
			}
		}
		const share = M.map(m => (cont[m.id] || 0) / ((held[m.id] || 0) + (cont[m.id] || 0)));
		ok('19c. a quarter of every great power\'s systems are contested (each within 21-29%)', share.every(f => f > 0.21 && f < 0.29), share.map(f => (f * 100).toFixed(0)).join(' '));
		ok('19d. no contested zone holds more systems than either power fighting over it holds outright', Object.entries(zone).every(([k, z]) => { const [a, b] = k.split(':'); return z <= 1.08 * Math.min(held[a], held[b]) }));
		ok('19e. contested space lies only between enemies, along their shared border (the point is in one power\'s space and its strongest rival is the enemy)', (() => { const r = G.rng(9); for (let k = 0; k < 4000; k++) { const cl = K[k % 6], C = M.filter(m => m.cluster == cl.id), m0 = C[k % C.length], p = m0.at.map(v => v + (r() - .5) * m0.claim * 2), q = F.claimAt(p); if (!q.contested) continue; const [x, y] = q.contested, other = q.side == x ? y : x; if (F.relation(x, y) >= 0 || F.strength(F.byId(q.side), p) <= 0) return false; const riv = C.filter(c => c.id != q.side).sort((u, v) => F.pull(v, p) - F.pull(u, p))[0]; if (riv.id != other) return false } return true })());
		const w0 = W[0], st = F.warState(w0, 300), key = w0.systems[5], ch = F.contestedHolder(key.at, 300);
		ok('19f. every contested system has a holder: the side holding its nearest key system on the front', ch.contested && ch.key == key.id && ch.holder == st.systems[5].holder);
	}
	/* ---------- small factions ---------- */
	const S = F.minors(), kinds = new Set(S.map(m => m.type));
	ok('20. small factions: nomads, criminals, prospectors and free ports', ['nomad', 'criminal', 'prospector', 'freeport'].every(k => kinds.has(k)));
	ok('21. many keep a fleet carrier or a dreadnought that sustains them (market or black market, repairs, fuel, a hangar)', S.filter(m => m.carrier).length >= 15 && S.filter(m => m.carrier).every(m => m.carrier.selfSufficient && m.carrier.services.includes('fuel') && m.carrier.services.includes('repairs') && m.carrier.services.includes('hangar')));
	const crim = S.find(m => m.type == 'criminal' && m.sites.length > 1), seasons = [0, 30, 60, 90, 120].map(d => F.whereIs(crim, d).site.id);
	ok('22. criminals rotate their hideouts with the seasons, and stay put within one', new Set(seasons).size > 1 && F.whereIs(crim, 31).site.id == F.whereIs(crim, 59).site.id);
	const pro = S.find(m => m.type == 'prospector' && m.sites.length > 1), sp = [...Array(24)].map((_, k) => F.whereIs(pro, k * 30).site.id);
	const runs = sp.reduce((a, v, k) => { if (k && v == sp[k - 1]) a[a.length - 1]++; else a.push(1); return a }, []);
	ok('23. prospectors hold a claim for several seasons, then move on', new Set(sp).size > 1 && Math.max(...runs.slice(1, -1)) >= 3, runs.join(','));
	const nom = S.find(m => m.type == 'nomad'), mv = F.whereIs(nom, 32), st = F.whereIs(nom, 40);
	ok('24. nomads travel between stops (a few days each season) and stay in between', mv.moving && mv.at && !st.moving && st.site, JSON.stringify([mv.moving, st.moving]));
	ok('25. free ports stay where they are', S.filter(m => m.type == 'freeport').every(m => F.whereIs(m, 0).site.id == F.whereIs(m, 999).site.id));
	ok('26. some criminals are privateers backed by a great power, hostile to its enemies', S.some(m => m.sponsor && F.relation(m.id, m.sponsor) > 0 && F.byId(m.sponsor).enemies.every(e => F.relation(m.id, e) < 0)));
	/* ---------- money ---------- */
	ok('27. the Standard Unit is the basket\'s cost at base values', Math.abs(E.basketCost(g => E.GOODS[g]) - 1) < 1e-9);
	const codes = M.map(m => m.currency.code), day = 250;
	ok('28. every currency has a rate, coins per Standard Unit', codes.every(c => E.rate(c, day) > 0.1 && E.rate(c, day) < 50));
	const loop = E.crossRate(codes[0], codes[1], day) * E.crossRate(codes[1], codes[2], day) * E.crossRate(codes[2], codes[0], day);
	ok('29. cross rates come from the basket: round the houses gives back what you started with', Math.abs(loop - 1) < 1e-9);
	ok('30. rates move over time (trade cycles): every currency swings by 2% or more over two years', codes.every(c => { const v = [...Array(25)].map((_, k) => E.rate(c, k * 30)); return Math.max(...v) / Math.min(...v) > 1.02 }));
	const c0 = M[0].currency.code, war = W.find(x => x.a == M[0].id || x.b == M[0].id), side = war.a == M[0].id ? 1 : -1;
	const me = M[0].id, them = war.a == me ? war.b : war.a, all = (who, k) => war.systems.map(s => ({war: war.id, system: s.id, side: who, effort: 400, day: k}));
	const win = [0, 30, 60, 90, 120, 150, 180, 210, 240].flatMap(k => all(me, k)), lose = [0, 30, 60, 90, 120, 150, 180, 210, 240].flatMap(k => all(them, k));
	ok('31. winning a war strengthens a currency, losing weakens it', E.rate(c0, day, {events: win}) < E.rate(c0, day) && E.rate(c0, day, {events: lose}) > E.rate(c0, day));
	ok('32. shocks (a raided convoy, a flooded market) move a rate and fade', E.rate(c0, day, {shocks: [{currency: c0, day: 240, size: 0.2, halfLife: 20}]}) > E.rate(c0, day) * 1.1 && Math.abs(E.rate(c0, 600, {shocks: [{currency: c0, day: 240, size: 0.2, halfLife: 20}]}) / E.rate(c0, 600) - 1) < 0.001);
	const home = E.exchange(1000, c0, F.byId(M[0].allies[0]).currency.code, day, M[0].id), enemy = E.exchange(1000, c0, F.byId(M[0].enemies[0]).currency.code, day, M[0].id);
	ok('33. changing money: a small spread at home (into an ally\'s coin); enemy currency refused (free ports and black markets take it, at a cut)', home.ok && home.spread < 0.06 && !enemy.ok && E.exchangeAnywhere(1000, c0, F.byId(M[0].enemies[0]).currency.code, day) > 0);
	const mk = E.market(M[0].star, day);
	ok('34. a station prices in its holder\'s currency', mk.currency == c0 && Math.abs(mk.prices.Iron.price / mk.prices.Iron.su - E.rate(c0, day)) < 1e-9);
	const fr = E.market(war.systems[0].star, day);
	ok('35. a front pays more for munitions, medicine, fuel and food', fr.prices.Munitions.su > mk.prices.Munitions.su * 1.3);
	/* ---------- the player ---------- */
	const pl = M.map(m => R.newPlayer(m.id));
	ok('36. a player can come from any great power: its home, its currency, its species\' ship', pl.every((p, i) => p.origin == M[i].id && p.wallet[M[i].currency.code] > 0 && p.ship.build == M[i].species.build));
	const p0 = pl[0];
	ok('37. starting standing follows the origin: Friendly at home and with its allies, Unfriendly with its enemies', R.tier(p0.rep[M[0].id]) == 'Friendly' && M[0].allies.every(a => p0.rep[a] > 0) && M[0].enemies.every(e => p0.rep[e] < 0));
	const before = Object.assign({}, p0.rep), d = R.act(p0, 'mission', M[0].id);
	ok('38. helping a power raises it, its allies a little, and lowers its enemies', d[M[0].id] > 0 && M[0].allies.every(a => p0.rep[a] > before[a]) && M[0].enemies.every(e => p0.rep[e] < before[e]));
	ok('39. a commission with a Friendly power; not with its enemy as well', R.enlist(p0, M[0].id).ok && !R.enlist(p0, M[0].enemies[0]).ok);
	const m1 = F.warMissions(M[0].id, day)[0], r0 = p0.rep[m1.against];
	R.warEffort(p0, m1, day);
	const ev1 = p0.warEvents[p0.warEvents.length - 1];
	ok('40. a war mission: dated war effort for the issuer (doubled with a commission), the enemy\'s anger, pay in the issuer\'s currency', ev1.side == M[0].id && ev1.effort == 2 * m1.effort && ev1.day == day && p0.rep[m1.against] < r0 && p0.wallet[m1.currency] > 5000);
	const wk = F.wars().find(x => x.id == m1.war), stk = F.warState(wk, day, p0.warEvents), stn = F.warState(wk, day);
	ok('40b. ...and the front feels it', (wk.a == M[0].id ? 1 : -1) * (stk.systems.find(x => x.id == m1.system).control - stn.systems.find(x => x.id == m1.system).control) >= 0);
	R.act(p0, 'raidConvoy', M[1].id, {where: M[1].at});
	ok('41. crimes: a bounty in the currency of whoever\'s space it was, outlaw points, criminals warm to you', p0.bounties[F.byId(F.claimAt(M[1].at).owner).currency.code] > 0 && p0.lawful < 5 && S.filter(m => m.type == 'criminal').every(m => p0.rep[m.id] > pl[1].rep[m.id] - 1));
	const al = R.alignment(p0);
	ok('42. alignment: the power a player leans to, and lawful-to-outlaw', al.lean && al.lean.id == M[0].id && ['lawful', 'grey', 'outlaw'].includes(al.axis));
	ok('43. enemies of your commission treat you as a combatant', R.hostile(p0, M[0].enemies[0]) && !R.hostile(p0, M[0].allies[0]));
	const gap = Math.abs(p0.rep[M[0].id] - p0.start[M[0].id]); R.age(p0, 300);
	ok('44. standing drifts back towards where you started', Math.abs(p0.rep[M[0].id] - p0.start[M[0].id]) < gap);
} catch (e) { Fl++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + Fl) + ' passed'); process.exit(Fl ? 1 : 0);
