/* Ember Reach 0.4.1 (L3.1): a planet's rings made of asteroids (apps/rudolf-emberreach/www/rings.js), in node.
     node tests/emberreach_rings_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Rg = require(path.join(DIR, 'rings.js')), Sc = require(path.join(DIR, 'scene.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js'));
const Mi = require(path.join(DIR, 'mining.js')), Me = require(path.join(DIR, 'meshes.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + JSON.stringify(d) : '')) } };
const len = a => Math.hypot(...a), sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
try {
	const R = Rg.RING;
	/* ringed worlds round a few capitals */
	const ringed = [];
	for (const m of F.majors().slice(0, 4)) for (const s of G.starsNear(m.star.x, m.star.y, m.star.z, 8)) { if (s.kind != 'star' || ringed.length >= 8) continue; const sc = Sc.build(s, {day: 200}); for (const b of sc.bodies) if (b.ring && ringed.length < 8) ringed.push({b, s, ring: Rg.ringOf(b, s)}) }
	ok('0. ringed worlds to test on: stone, ice or metal rings', ringed.length >= 6 && ringed.every(x => ['Stone', 'Ice', 'Metal'].includes(x.ring.kind)), ringed.length);
	/* the shape */
	const x0 = ringed[0], B = x0.ring.bands;
	ok('1. 14 bands from 1.35 to 2.3 radii, end to end, some of them gaps', B.length == 14 && B[0].r0 == 1.35 && Math.abs(B[13].r1 - 2.3) < 1e-9 && B.every((b, i) => !i || Math.abs(b.r0 - B[i - 1].r1) < 1e-9) && ringed.some(x => x.ring.bands.some(b => b.gap)));
	/* the drawn ring and the asteroids share it: the mesh's triangles lie only in the bands that aren't gaps */
	const mesh = Me.rings(x0.ring.kind, x0.b.seed, 'low'), pts = [];
	const vs = mesh.p; for (let i = 0; i + 2 < vs.length; i += 3) pts.push(Math.hypot(vs[i], vs[i + 1]));
	ok('2. the drawn ring shows the same bands and gaps', pts.length > 100 && pts.every(r => B.some(b => !b.gap && r >= b.r0 - 1e-6 && r <= b.r1 + 1e-6)), {fields: Object.keys(mesh)});
	ok('3. a densely strewn ring\'s bands are a step denser', (() => { const a = Rg.bands(123, 'moderate'), d = Rg.bands(123, 'dense'), rank = {sparse: 0, moderate: 1, dense: 2}; return a.every((b, i) => rank[d[i].density] == Math.min(2, rank[b.density] + 1)) })());
	/* cells */
	const ring = x0.ring, full = ring.bands.find(b => !b.gap), gap = ringed.map(x => x.ring).find(r => r.bands.some(b => b.gap)), gb = gap.bands.find(b => b.gap);
	const c1 = Rg.cellRocks(ring, full, 0, 5, {}), c2 = Rg.cellRocks(ring, full, 0, 5, {});
	ok('4. a cell\'s asteroids are the same every visit', JSON.stringify(c1) == JSON.stringify(c2) && c1.length >= 1);
	ok('5. a gap holds none', !Rg.cellRocks(gap, gb, 0, 0, {}).length && !Rg.rocksAround(gap, Rg.worldAt(gap, (gb.r0 + gb.r1) / 2 * gap.R, 1, 0), 1200, {}).length);
	const counts = {dense: [], moderate: [], sparse: []};
	for (const x of ringed) for (const b of x.ring.bands) if (!b.gap) for (let a = 0; a < 6; a++) counts[b.density].push(Rg.cellRocks(x.ring, b, 0, a, {}).length);
	ok('6. 6 to 10 a cell in a dense band, 3 to 5 in a moderate one, 1 or 2 in a sparse one', Object.entries(counts).every(([k, v]) => !v.length || v.every(n => n >= R.perCell[k][0] && n <= R.perCell[k][1])), Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, [Math.min(...v), Math.max(...v)]])));
	const many = Rg.rocksAround(ring, ring.hotspots[0].pos, 7500, {}), ids = new Set(many.map(r => r.id));
	ok('7. each asteroid has its own id, lies in its band, within the ring\'s 400 m sheet, 30 to 240 m across', ids.size == many.length && many.every(r => { const L = Rg.locate(ring, r.pos); return L.band && !L.band.gap && Math.abs(L.z) <= R.thick / 2 + 1e-6 && r.radius >= 30 && r.radius <= 240 }));
	/* the mix */
	const share = (rg, b, goods) => { let n = 0, t = 0; for (let a = 0; a < 200; a++) for (const r of Rg.cellRocks(rg, b, 0, a, {})) for (const [g, k] of Object.entries(r.comp)) { t += k; if (goods.includes(g)) n += k } return n / (t || 1) };
	const stone = ringed.map(x => x.ring).find(r => r.kind == 'Stone' || r.kind == 'Metal') || ring, inner = stone.bands.find(b => !b.gap), outer = stone.bands.slice().reverse().find(b => !b.gap);
	ok('8. the inner bands lean metallic, the outer ones icy', share(stone, inner, ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Gold', 'Diamond']) > share(stone, outer, ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Gold', 'Diamond']) && Rg.mixOf('Stone', 1, false).Iron < Rg.mixOf('Stone', 0, false).Iron && Rg.mixOf('Ice', 1, false).Water > Rg.mixOf('Ice', 0, false).Water);
	ok('9. a Rift ring carries the Rift\'s ores too', Rg.mixOf('Metal', 0.5, true).Nullite > 0 && !Rg.mixOf('Metal', 0.5, false).Nullite);
	/* mined, remembered */
	const rk = many[0], mined = {[rk.id]: rk.yield - 1};
	ok('10. what\'s been mined from one is remembered (P.mined, by its id)', Rg.rocksAround(ring, ring.hotspots[0].pos, 7500, mined).find(r => r.id == rk.id).left == 1);
	/* hotspots */
	const hs = ringed.flatMap(x => x.ring.hotspots.map(h => Object.assign({ring: x.ring}, h)));
	ok('11. 2 or 3 hotspots a ring, in its bands (never a gap), in its plane, the first one known', ringed.every(x => x.ring.hotspots.length >= 2 && x.ring.hotspots.length <= 3 && x.ring.hotspots[0].known && !x.ring.hotspots[1].known) && hs.every(h => { const L = Rg.locate(h.ring, h.pos); return L.band && !L.band.gap && Math.abs(L.z) < 1e-6 }));
	const h0 = hs.find(h => Rg.mixOf(h.ring.kind, 0.5, false)[h.good] < 4) || hs[0], near = Rg.rocksAround(h0.ring, h0.pos, 4000, {}), hb = h0.ring.bands[h0.band];
	const shareIn = rs => { let n = 0, t = 0; for (const r of rs) for (const [g, k] of Object.entries(r.comp)) { t += k; if (g == h0.good) n += k } return n / (t || 1) };
	const away = []; for (let a = 0; a < 120; a++) away.push(...Rg.cellRocks(h0.ring, hb, 0, (a * 37) % Rg.cellsOf(h0.ring, hb).nA, {}).filter(r => !r.hot));
	ok('12. in a hotspot, its good is commoner than elsewhere in the band', near.length && near.every(r => r.hot == h0.id || len(sub(r.pos, h0.pos)) >= 5000 - 1) && shareIn(near.filter(r => r.hot)) > shareIn(away), {good: h0.good, in: shareIn(near.filter(r => r.hot)), out: shareIn(away)});
	/* mining's site */
	const f = Mi.fields(Sc.build(x0.s, {day: 200}), x0.s).find(y => y.ring && y.body == x0.b.name);
	ok('13. a ring\'s mining site is its known hotspot, and its asteroids are the ring\'s own', f && len(sub(f.pos, x0.ring.hotspots[0].pos)) < 1e-6 && Mi.rocks(f, {}).every(r => r.id.startsWith(x0.ring.id + '#')));
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
