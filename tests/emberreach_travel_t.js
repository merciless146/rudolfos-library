/* Ember Reach's travel between stars (apps/rudolf-emberreach/www/travel.js): fuel, misjumps, ports, lanes, routes, in node.
     node tests/emberreach_travel_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const T = require(path.join(DIR, 'travel.js')), F = require(path.join(DIR, 'factions.js')), G = require(path.join(DIR, 'galaxy.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const M = F.majors(), home = M[0];
	ok('1. fuel: a full-range jump burns a quarter of the tank, a half-range one a sixteenth', Math.abs(T.jumpCost(6, 6) - 0.25) < 1e-12 && Math.abs(T.jumpCost(3, 6) - 0.0625) < 1e-12 && T.jumpCost(9, 6) == 0.25);
	const mc = [5, 30, 300, 2500].map(m => T.misjumpChance({at: [m, 0, 0]}));
	ok('2. misjumps: likely in the core, rare in the Glow, practically never in the outskirts', mc[0] > 0.4 && mc[1] > 0.03 && mc[1] < 0.2 && mc[2] < 0.002 && mc[3] < 1e-5, mc.map(x => x.toFixed(4)).join(' '));
	const tgt = G.starsNear(1, 1, 1, 0.5)[0], arr = [0.01, 0.3, 0.6, 0.99].map(r => T.arrival(tgt, r));
	ok('3. a misjump lands on a neighbour of the target, a good jump on the target', arr.some(a => a.misjump && a.star.id != tgt.id) && arr.some(a => !a.misjump && a.star.id == tgt.id));
	ok('4. a capital\'s port is a Halo at its homeworld', M.slice(0, 10).every(m => { const p = T.portFor(m.star, 200); return p && p.cls == 'halo' && p.world == m.home.name && p.owner == m.id }));
	const far = G.sampleGalaxy(300, 5).filter(s => !F.claimAt([s.x, s.y, s.z]).owner && !F.claimAt([s.x, s.y, s.z]).contested);
	ok('5. unclaimed space has no ports', far.length > 50 && far.every(s => T.portFor(s, 200) === null));

	const L = T.lanes();
	ok('6. every power keeps beacons, its capital first, none in contested space', M.every(m => L.byPower[m.id][0].star.id == m.star.id && L.byPower[m.id].every(n => F.claimAt(n.at).owner == m.id)));
	ok('7. power lanes are at most 50 pc, between one power or allies', L.edges.filter(e => e.kind == 'lane').every(e => e.d <= 50 && (e.powers[0] == e.powers[1] || F.relation(e.powers[0], e.powers[1]) > 0)));
	let disc = 0;
	for (const m of M) { const ids = L.byPower[m.id].map(n => n.i), seen = new Set([ids[0]]), q = [ids[0]]; while (q.length) { const u = q.pop(); for (const k of L.adj[u]) { const e = L.edges[k]; if (e.kind != 'lane') continue; const v = e.a == u ? e.b : e.a; if (!seen.has(v) && L.nodes[v].power == m.id) { seen.add(v); q.push(v) } } } if (ids.some(i => !seen.has(i))) disc++ }
	ok('8. each power\'s own lanes reach all of its beacons', disc == 0, disc + ' powers cut up');
	const lens = L.chains.map(c => c.nodes.length - 1), hops = L.edges.filter(e => e.kind == 'long').map(e => e.d);
	ok('9. a long lane between every pair of the six clusters, 7 to 17 relay jumps of about 100 pc', L.chains.length == 15 && Math.min(...lens) >= 7 && Math.max(...lens) <= 17 && Math.max(...hops) < 115, lens.join(',') + '; longest ' + Math.max(...hops).toFixed(1) + ' pc');
	const enemy = M.find(m => F.relation(home.id, m.id) < 0), eLane = L.edges.find(e => e.kind == 'lane' && e.powers.includes(enemy.id));
	ok('10. enemies\' lanes are closed to you; long lanes are open to all', eLane && !T.laneOpen(eLane, home.id) && T.laneOpen(eLane, enemy.id) && L.edges.filter(e => e.kind == 'long').every(e => T.laneOpen(e, home.id)));

	/* routes */
	const near = G.starsNear(home.star.x, home.star.y, home.star.z, 30).filter(s => s.id != home.star.id && G.system(s).planets.length).pop();
	const r1 = T.route(home.star, near, 6, home.id);
	ok('11. a route to a star 30 pc off: every jump within range, ending at the target', r1.ok && r1.legs[r1.legs.length - 1].star.id == near.id && r1.legs.every(l => l.kind != 'jump' || l.d <= 6 + 1e-9), r1.jumps + ' jumps');
	const other = M.find(m => m.cluster != home.cluster), r2 = T.route(home.star, other.star, 6, home.id);
	ok('12. to another cluster, the route takes the long lanes', r2.ok && r2.legs.some(l => l.kind == 'long') && r2.legs[r2.legs.length - 1].star.id == other.star.id, r2.jumps + ' jumps, fuel ' + (r2.fuel || 0).toFixed(2));
	ok('13. lanes save jumps: far fewer than hopping 6 pc at a time', r2.jumps < T.dist(T.at(home.star), T.at(other.star)) / 6 / 4);
	const glow = G.starsNear(0, 0, 60, 0.5)[0], glowT = G.starsNear(0, 0, 90, 0.5)[0], t0 = Date.now(), r3 = T.route(glow, glowT, 5);
	ok('14. even where stars crowd (the Glow, thousands within reach), a route plots fast', r3.ok && Date.now() - t0 < 3000, (Date.now() - t0) + ' ms, ' + r3.jumps + ' jumps');
	ok('15. a leg checks range and fuel', T.canMake({kind: 'jump', d: 7}, 6, 1).why == 'range' && T.canMake({kind: 'jump', d: 6}, 6, 0.2).why == 'fuel' && T.canMake({kind: 'lane', d: 40}, 6, 0.5).ok);
	ok('16. a star can be found again from its id and place (for saves)', T.starAt(near.id, T.at(near)).id == near.id);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
