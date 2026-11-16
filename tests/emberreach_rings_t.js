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
	const many = Rg.rocksAround(ring, ring.site, 7500, {}), ids = new Set(many.map(r => r.id));
	ok('7. each asteroid has its own id, lies in its band, within the ring\'s 400 m sheet, 30 to 240 m across', ids.size == many.length && many.every(r => { const L = Rg.locate(ring, r.pos); return L.band && !L.band.gap && Math.abs(L.z) <= R.thick / 2 + 1e-6 && r.radius >= 30 && r.radius <= 240 }));
	/* the mix */
	const share = (rg, b, goods) => { let n = 0, t = 0; for (let a = 0; a < 200; a++) for (const r of Rg.cellRocks(rg, b, 0, a, {})) for (const [g, k] of Object.entries(r.comp)) { t += k; if (goods.includes(g)) n += k } return n / (t || 1) };
	const stone = ringed.map(x => x.ring).find(r => r.kind == 'Stone' || r.kind == 'Metal') || ring, inner = stone.bands.find(b => !b.gap), outer = stone.bands.slice().reverse().find(b => !b.gap);
	ok('8. the inner bands lean metallic, the outer ones icy', share(stone, inner, ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Gold', 'Diamond']) > share(stone, outer, ['Iron', 'Titanium', 'Aluminum', 'Copper', 'Gold', 'Diamond']) && Rg.mixOf('Stone', 1, false).Iron < Rg.mixOf('Stone', 0, false).Iron && Rg.mixOf('Ice', 1, false).Water > Rg.mixOf('Ice', 0, false).Water);
	ok('9. a Rift ring carries the Rift\'s ores too', Rg.mixOf('Metal', 0.5, true).Nullite > 0 && !Rg.mixOf('Metal', 0.5, false).Nullite);
	/* mined, remembered */
	const rk = many[0], mined = {[rk.id]: rk.yield - 1};
	ok('10. what\'s been mined from one is remembered (P.mined, by its id)', Rg.rocksAround(ring, ring.site, 7500, mined).find(r => r.id == rk.id).left == 1);
	/* hotspots: by chance, rare minerals, only with a prospecting array */
	const sample = []; for (const m of F.majors().slice(0, 6)) for (const st of G.starsNear(m.star.x, m.star.y, m.star.z, 8)) { if (st.kind != 'star') continue; for (const p of G.system(st).planets) if (p.ring) sample.push(Rg.ringOf({name: p.name, ring: p.ring, ringDensity: p.ringDensity, radius: 3e6, pos: [0, 0, 0]}, st)) }
	const withHot = sample.filter(r => r.hotspots.length), share0 = withHot.length / sample.length;
	ok('11. about a third of rings have mineral hotspots (the same ones every time): 1 to 3, in their bands (never a gap), in the plane', sample.length > 300 && share0 > 0.25 && share0 < 0.45 && withHot.every(r => r.hotspots.length >= 1 && r.hotspots.length <= 3 && r.hotspots.every(h => { const L = Rg.locate(r, h.pos); return L.band && !L.band.gap && Math.abs(L.z) < 1e-6 })) && JSON.stringify(withHot[0].hotspots) == JSON.stringify(Rg.ringOf({name: withHot[0].body, ring: withHot[0].kind, ringDensity: withHot[0].density, radius: 3e6, pos: [0, 0, 0]}, {}).hotspots), {rings: sample.length, share0});
	const E = require(path.join(DIR, 'economy.js'));
	ok('12. each is rich in one of its ring\'s rarer, dearer minerals', withHot.every(r => r.hotspots.every(h => Rg.RARE[r.kind].includes(h.good) && E.GOODS[h.good] >= 14)) && new Set(withHot.flatMap(r => r.hotspots.map(h => h.good))).size >= 5);
	const hr = withHot[0], h0 = hr.hotspots[0], hb = hr.bands[h0.band], inside = Rg.rocksAround(hr, h0.pos, 4000, {}).filter(r => r.hot == h0.id), outside = []; for (let a = 0; a < 150; a++) outside.push(...Rg.cellRocks(hr, hb, 0, (a * 37) % Rg.cellsOf(hr, hb).nA, {}).filter(r => !r.hot));
	const shareOf = rs => { let n = 0, t = 0; for (const r of rs) for (const [g, k] of Object.entries(r.comp)) { t += k; if (g == h0.good) n += k } return n / (t || 1) }, avgYield = rs => rs.reduce((t, r) => t + r.yield / r.radius, 0) / rs.length;
	ok('13. inside one, about half of what\'s mined is its mineral, and the asteroids hold half again as much', inside.length > 5 && shareOf(inside) > 0.35 && shareOf(inside) < 0.7 && shareOf(outside) < 0.2 && avgYield(inside) > avgYield(outside) * 1.3, {good: h0.good, in: shareOf(inside), out: shareOf(outside), yIn: avgYield(inside), yOut: avgYield(outside)});
	/* mining's sites */
	const rk2 = ringed.find(x => x.ring.hotspots.length) || ringed[0], fs = Mi.fields(Sc.build(rk2.s, {day: 200}), rk2.s).filter(y => y.ring && y.body == rk2.b.name), site = fs.find(y => !y.hotspot), L0 = Rg.locate(rk2.ring, site.pos), rank = {dense: 2, moderate: 1, sparse: 0};
	ok('14. a ring\'s mining site lies in its densest band, and its asteroids are the ring\'s own', L0.band && !L0.band.gap && rank[L0.band.density] == Math.max(...rk2.ring.bands.filter(b => !b.gap).map(b => rank[b.density])) && Mi.rocks(site, {}).every(r => r.id.startsWith(rk2.ring.id + '#')));
	ok('15. its hotspots are fields too, marked as hotspots (play.js shows them only with a prospecting array)', fs.filter(y => y.hotspot).length == rk2.ring.hotspots.length && fs.filter(y => y.hotspot).every(y => /hotspot/.test(y.name)));
	const O = require(path.join(DIR, 'outfit.js'));
	ok('16. the prospecting array: a utility module that shows hotspots; reading asteroids is the resource scanner\'s job', O.CAT.array && O.CAT.array.cat == 'utility' && /hotspot/.test(O.CAT.array.text) && /resource scanner reads the asteroids/.test(O.CAT.array.text) && /asteroid/.test(O.CAT.prospector.text) && O.CAT.array.price > O.CAT.prospector.price);
	/* 0.4.6 (L3.2): flying in it */
	{
		let good = true, n = 0;
		for (const x of ringed) for (let k = 0; k < 12; k++) {
			const r = x.ring, a = k * 0.53, rr = (1 + k * 0.15) * r.R, h = (k % 3 - 1) * 5000, p = Rg.worldAt(r, rr, a, h), q = Rg.nearestPoint(r, p), L = Rg.locate(r, q);
			n++; if (!(L.band && !L.band.gap && Math.abs(L.z) < 1e-3 && Math.abs(((L.a - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 1e-6)) good = false;
		}
		ok('17. a ring\'s nearest point lies in its plane, at your own angle round it, in a band that isn\'t a gap', good && n > 50);
		const r = ringed[0].ring, mid = (R.inner + R.outer) / 2 * r.R;
		ok('18. the sheet\'s distance: 0 inside it, the height above its top over it, and to its edge beyond it',
			Rg.sheetDist(r, Rg.worldAt(r, mid, 1, 100)) == 0 && Math.abs(Rg.sheetDist(r, Rg.worldAt(r, mid, 1, 5200)) - 5000) < 1e-3 && Math.abs(Rg.sheetDist(r, Rg.worldAt(r, R.outer * r.R + 3000, 2, 0)) - 3000) < 1e-3);
		const x = ringed[0], sc = Sc.build(x.s, {day: 200}), b = sc.bodies.find(y => y.name == x.b.name), up = Rg.worldAt(r, mid, 1, 30000);
		ok('19. cruise slows for rings as for worlds (it goes no faster than the distance to the sheet allows) and drops out 4 km from a ring',
			Math.abs(Sc.ringDist(b, up) - Rg.sheetDist(r, up)) < 1 && Sc.cruiseLimit(sc, up) <= Math.max(Sc.CRUISE.min, Sc.ringDist(b, up)) + 1 && Sc.dropRange({kind: 'ring', radius: 1}) == 4000 && Sc.dropLeft({kind: 'ring', radius: 1, pos: Rg.nearestPoint(r, up)}, up) > 20000,
			{ring: Sc.ringDist(b, up), sheet: Rg.sheetDist(r, up), lim: Sc.cruiseLimit(sc, up)});
	}
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
