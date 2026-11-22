/* Ember Reach's galaxy over several records (0.5.8: save.js split / merge; docs/plan-ember-reach-pilots.md P2b), in
   node: the head and nine parts by region, colonies kept short and whole, what's trimmed and what never is, how
   full it is, and a record's limit following the desktop's.
     node tests/emberreach_galaxystore_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Sv = req('save.js'), Tr = req('trade.js'), F = req('factions.js'), S = req('ships.js'), O = req('outfit.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
const KB = 1024, MB = 1024 * 1024;
try {
	const sid = (x, y, z, n) => x + ',' + y + ',' + z + '/#' + n;
	const colony = (i, o) => Object.assign({id: sid(i % 97 - 48, (i * 7) % 89 - 44, (i * 13) % 83 - 41, i % 5), star: {id: sid(i % 97 - 48, (i * 7) % 89 - 44, (i * 13) % 83 - 41, i % 5), name: 'Star ' + i, at: [i * 1.234567, -i * 2.345678, i * 0.987654]},
		sponsor: 'major1', independent: false, war: null, key: null, port: 'station', world: 'Star ' + i + ' b', stage: 'done', claimed: 10, beaconBy: 40, due: null, need: {Iron: 2000, Food: 700}, got: {Iron: 2000, Food: 700},
		fee: 300000, currency: 'NYA', owner: 'p' + (1 + i % 6), opens: 60, paid: 60, last: 60, pop: 1000 + i, builds: []}, o || {});
	const galaxy = n => { const g = Sv.newGalaxy(100); g.seq = 6; for (let i = 0; i < n; i++) g.world.colonies.push(colony(i)); for (let i = 0; i < n * 3; i++) { g.world.firsts.pl[sid(i % 50, i % 40, i % 30, i % 7) + '|World ' + i] = 'p' + (1 + i % 6) } g.world.names[sid(1, 2, 3, 0) + '|World 1'] = 'New Hope'; g.world.markets.x = {day: 99, d: {Iron: 1}}; return g };
	/* the parts */
	const reg = Sv.regionOf(sid(4, 8, 12, 1)), same = [sid(5, 9, 13, 2), sid(7, 11, 15, 0), sid(4, 8, 12, 3) + '|Planet c'].map(Sv.regionOf), spread = new Set(Array.from({length: 400}, (_, i) => Sv.regionOf(sid(i * 4, -i * 4, i * 8, 0))));
	ok('1. a star\'s part is its block of 4×4×4 sectors (stars and their worlds\' keys together); the blocks spread over all nine parts', same.every(r => r == reg) && spread.size == Sv.PARTS, {reg, same, n: spread.size});
	/* round trip */
	const g = galaxy(300), packed = Sv.packGalaxy(g, null, null, 100), sp = Sv.split(packed), back = Sv.unpackGalaxy(Sv.merge(JSON.parse(JSON.stringify(sp.head)), JSON.parse(JSON.stringify(sp.parts))));
	const strip = c => { const o = Object.assign({}, c, {star: Object.assign({}, c.star, {at: c.star.at.map(v => Math.round(v * 1e4) / 1e4)})}); for (const k of ['claimed', 'beaconBy', 'due', 'fee', 'currency']) delete o[k]; o.need = {}; o.got = {}; return JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]])) };
	const byId = l => new Map(l.map(c => [c.id + c.owner + c.pop, strip(c)]));
	const a = byId(g.world.colonies), b = byId(back.world.colonies), sorted = f => JSON.stringify(['pl', 'land'].map(t => Object.entries(f[t]).sort()));
	ok('2. split into the head and nine parts and merged back: every colony, first discovery and name, the head\'s records, slots and day as they were', sp.parts.length == 9 && sp.head.parts == 9 && !('colonies' in sp.head.world) && back.world.colonies.length == 300 && [...a].every(([k, v]) => b.get(k) == v)
		&& sorted(back.world.firsts) == sorted(Sv.unpackGalaxy(packed).world.firsts) && back.world.names[sid(1, 2, 3, 0) + '|World 1'] == 'New Hope' && back.world.markets.x && back.day == packed.day && back.seq == 6, {n: back.world.colonies.length});
	/* colonies kept short */
	const c0 = colony(5), e0 = Sv.encColony(c0), d0 = Sv.decColony(JSON.parse(JSON.stringify(e0)));
	ok('3. a finished colony keeps its port, people, builds and the rest, but not its finished build\'s records (it reads back with empty goods)', JSON.stringify(e0).length < 0.5 * JSON.stringify(c0).length && d0.pop == c0.pop && d0.port == 'station' && d0.owner == c0.owner && Array.isArray(d0.builds) && JSON.stringify(d0.need) == '{}' && !('fee' in d0), {enc: JSON.stringify(e0).length, raw: JSON.stringify(c0).length});
	const c1 = colony(6, {stage: 'building', due: 77, coming: {Iron: 40}, odd: {x: 1}, war: 'w1'}), d1 = Sv.decColony(JSON.parse(JSON.stringify(Sv.encColony(c1))));
	ok('4. a colony still being built keeps everything (and fields the format doesn\'t know, as they are); only star positions round to 0.0001 pc', d1.due == 77 && d1.coming.Iron == 40 && d1.fee == 300000 && d1.need.Iron == 2000 && d1.odd.x == 1 && d1.war == 'w1' && d1.star.at[0] == Math.round(c1.star.at[0] * 1e4) / 1e4, d1);
	/* trimmed, and never */
	Sv.setMax(256 * KB);
	const big = galaxy(3000); for (let i = 0; i < 40000; i++) big.world.mined['rock:' + i] = i % 9;
	const bp = Sv.packGalaxy(big, null, null, 100), bs = Sv.split(bp);
	ok('5. the head is trimmed to nine tenths of a record (mined asteroids first); colonies, first discoveries and names never are', JSON.stringify(bs.head).length <= 0.9 * 256 * KB && Object.keys(bs.head.world.mined).length < 40000 && bs.parts.reduce((t, p) => t + p.colonies.length, 0) == 3000 && bs.parts.reduce((t, p) => t + Object.keys(p.firsts.pl).length, 0) == Object.keys(big.world.firsts.pl).length);
	/* how full */
	const f0 = Sv.fullness(bs), f1 = Sv.fullness(Sv.split(Sv.packGalaxy(galaxy(8000), null, null, 100)));
	ok('6. at 256 KB a record (Rudolf OS 1.6.1: 2.5 MB in all), 3,000 colonies are a third of it; 8,000 bring the warning (the whole at 80%, or a part at 90%)', f0.cap == 10 * 256 * KB && !f0.warn && f0.share < 0.4 && f1.warn, {f0, f1});
	Sv.setMax(6 * MB); const f2 = Sv.fullness(Sv.split(Sv.packGalaxy(big, null, null, 100)));
	ok('7. at 6 MB a record (1.6.2), the same galaxy is a small share of its 60 MB, no warning', f2.cap == 60 * MB && !f2.warn && f2.share < 0.05, f2);
	const per = JSON.stringify(Sv.encColony(colony(1))).length + 1, fits = Math.floor(0.8 * 60 * MB / per);
	ok('8. what 60 MB holds: a finished colony is about 200 bytes, so roughly 250,000 of them before the warning', per < 230 && fits > 200000, {per, fits});
	/* a record's limit follows the desktop's */
	const pl = Tr.newPlayer(F.majors()[1].id); pl.ship.fit = O.stock(S.hull(pl.ship.model)); pl.explore = {sys: {}, pl: {}, sold: {}, names: {}, land: {}};
	for (let i = 0; i < 9000; i++) { const k = sid(i % 60, i % 50, i % 40, i % 9); pl.explore.sys[k + i] = i; pl.explore.sold[k + i] = 1 }
	const packAt = m => { Sv.setMax(m); return JSON.stringify(Sv.trim({v: 1, player: JSON.parse(JSON.stringify(pl))})).length };   /* (trim: what pack() does last) */
	const small = packAt(256 * KB), large = packAt(6 * MB);
	ok('9. a pilot\'s record is trimmed to the same limit: at 256 KB their old charts go, at 6 MB they stay', small <= 0.9 * 256 * KB && large > 256 * KB && large <= 0.9 * 6 * MB, {small, large});
	ok('10. a limit under 64 KB is refused (the old one stays)', Sv.setMax(1000) == 6 * MB && Sv.MAXREC == 6 * MB);
	/* an older single record */
	const old = Sv.packGalaxy(galaxy(20), null, null, 100);
	ok('11. a galaxy saved as one record (0.5.5–0.5.7) is read as it is (merge leaves it), to be split at the next save', Sv.merge(old, []) === old && Sv.unpackGalaxy(old).world.colonies.length == 20);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
