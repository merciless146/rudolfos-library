/* Ember Reach's terrain (terrain.js), in node: the height function, its bounds, flats, and the tiles.
     node tests/emberreach_terrain_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const req = f => require(path.join(DIR, f));
const Te = req('terrain.js'), Sc = req('scene.js'), F = req('factions.js'), L = req('landing.js'), Fl = req('flight.js'), S = req('ships.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l) }, seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
const randDir = r => nrm([r() - 0.5, r() - 0.5, r() - 0.5]);
try {
	const moon = {kind: 'planet', name: 'Test moon a', radius: 1.7e6 / 12, type: 'Barren', seed: 5}, big = {kind: 'planet', name: 'Test world b', radius: 6e6 / 12, type: 'Desert', seed: 3},
		small = {kind: 'planet', name: 'Test rock c', radius: 3e5 / 12, type: 'Barren', seed: 2}, ice = {kind: 'planet', name: 'Test ice d', radius: 1.7e6 / 12, type: 'Tundra', seed: 9};
	const r = seeded(11), dirs = [...Array(4000)].map(() => randDir(r));
	ok('1. the height is the same every time, for the same world and place', dirs.slice(0, 200).every(d => Te.height(moon, d) === Te.height(moon, d)) && Te.height(moon, dirs[0]) != Te.height(big, dirs[0]));
	const span = b => { let lo = Infinity, hi = -Infinity; for (const d of dirs) { const h = Te.height(b, d); lo = Math.min(lo, h); hi = Math.max(hi, h) } return [lo, hi] };
	const sm = span(small), mo = span(moon), bg = span(big), ic = span(ice);
	ok('2. relief grows with size: about 1 km on a small moon, up to 4 km on a large world; within the stated bound everywhere', Te.params(small).A <= 1000 && Te.params(big).A == 4000 && [[small, sm], [moon, mo], [big, bg]].every(([b, s]) => Math.max(-s[0], s[1]) <= Te.bound(b)) && bg[1] - bg[0] > mo[1] - mo[0] && mo[1] - mo[0] > sm[1] - sm[0], {sm, mo, bg});
	ok('3. icy worlds are smoother: half the relief', Te.params(ice).A == Te.params(moon).A / 2 && ic[1] - ic[0] < mo[1] - mo[0]);
	/* continuous: across the edges and corners of the cube, and at a tiny step anywhere */
	const edge = [[1, 1, 0.3], [1, -1, 0.7], [0.2, 1, 1], [1, 1, 1], [-1, 0.5, -1]].map(nrm);
	const jump = (d, e) => Math.abs(Te.height(moon, d) - Te.height(moon, nrm(d.map((v, i) => v + e[i]))));
	const steps = [[1, 0, 0], [0, -1, 0], [0, 0, 1], [-1, 1, 0]], at = k => Math.max(...edge.flatMap(d => steps.map(e => jump(d, e.map(v => v * k)))), ...dirs.slice(0, 300).map(d => jump(d, [k, k, 0])));
	const a1 = at(1e-7), a2 = at(1e-9);
	ok('4. continuous, across the cube\'s edges and corners too: a step a hundred times smaller moves the ground about a hundred times less (no jumps)', a1 < 0.15 && a2 < a1 / 30, a1.toFixed(4) + ' m at 0.17 m, ' + a2.toExponential(2) + ' m at 1.7 mm');
	/* craters: some, with bowls below their rims */
	const p = Te.params(moon);
	ok('5. craters: a world has bowls, and the deepest points are craters (below anything the relief alone reaches)', mo[0] < -p.A * 0.9, mo);
	/* flats */
	const fd = nrm([0.3, -0.5, 0.8]), fh = Te.addFlat(Object.assign({}, moon, {name: 'Flat test e'}), fd, 300, 150), fw = Object.assign({}, moon, {name: 'Flat test e'});
	const ring = [...Array(40)].map((_, k) => { const a = k / 40 * 2 * Math.PI, off = 250 / fw.radius; const t1 = nrm([fd[1], -fd[0], 0]), t2 = [fd[1] * t1[2] - fd[2] * t1[1], fd[2] * t1[0] - fd[0] * t1[2], fd[0] * t1[1] - fd[1] * t1[0]]; return nrm(fd.map((v, i) => v + off * (Math.cos(a) * t1[i] + Math.sin(a) * t2[i]))) });
	ok('6. a flat is level: every point within it at the height the ground had at its centre', ring.every(d => Math.abs(Te.height(fw, d) - fh) < 1e-6) && Math.abs(Te.height(fw, fd) - fh) < 1e-6);
	/* tiles */
	ok('7. tiles go down to about 50 m across', Math.abs(moon.radius * Math.PI / 2 / (1 << Te.maxLevel(moon)) - 50) < 50 && moon.radius * Math.PI / 2 / (1 << Te.maxLevel(moon)) <= 50);
	const T0 = {f: 2, L: 9, i: 300, j: 101}, built = Te.build(moon, T0), I = Te.tileInfo(moon, T0);
	/* a corner point of the tile: on the ground (at the tile's own octaves) */
	const corner = Te.onFace(T0.f, I.u0, I.v0), cp = corner.map(v => v * (moon.radius + Te.height(moon, corner, 2 * I.size / Te.TER.res))).map((v, i) => v - built.centre[i]);
	const has = built.mesh.p.some((_, k) => k % 3 == 0 && Math.hypot(built.mesh.p[k] - cp[0], built.mesh.p[k + 1] - cp[1], built.mesh.p[k + 2] - cp[2]) < 1e-3);
	ok('8. a tile\'s points are the height function\'s (at the octaves its grid can show)', has);
	const fine = {f: 2, L: Te.maxLevel(moon), i: 300 << (Te.maxLevel(moon) - 9), j: 101 << (Te.maxLevel(moon) - 9)}, If = Te.tileInfo(moon, fine), cf = Te.onFace(fine.f, If.u0 + If.du / 3, If.v0 + If.du / 5);
	ok('9. the finest tiles show every octave: within a metre of the full height (what\'s drawn is what\'s hit)', Math.abs(Te.height(moon, cf, 2 * If.size / Te.TER.res) - Te.height(moon, cf)) < 1, Math.abs(Te.height(moon, cf, 2 * If.size / Te.TER.res) - Te.height(moon, cf)));
	const counts = [1e3, 1e4, 1e5].map(a => { const s = Te.select(moon, [moon.radius + a, 0, 0]); return {a, tiles: s.draw.length, tris: s.tris, deepest: Math.max(...s.draw.map(t => t.L))} });
	ok('10. the tiles in view stay under 60,000 triangles at 1, 10 and 100 km up, finer the lower you are', counts.every(c => c.tris <= Te.TER.budget) && counts[0].deepest > counts[1].deepest && counts[1].deepest > counts[2].deepest, counts);
	const lowQ = Te.select(moon, [moon.radius + 1e3, 0, 0], {res: Te.TER.lowRes, budget: Te.TER.lowBudget});
	ok('11. low quality: tiles half as fine, within 30,000 triangles', lowQ.tris <= 30000 && lowQ.draw.length > 10);
	const notYet = Te.select(moon, [moon.radius + 1e3, 0, 0], {built: () => false});
	ok('12. a tile splits only once its children are built: none built, the six faces (those in view) are drawn and their children wanted, nearest first', notYet.draw.every(t => t.L == 0) && notYet.want.length > 0 && notYet.want.every((t, k, a) => !k || a[k - 1].d <= t.d));
	const back = Te.select(moon, [moon.radius + 1e3, 0, 0]), far = back.draw.filter(t => Te.tileInfo(moon, t).c[0] < -0.5);
	ok('13. tiles beyond the horizon are left out', far.length == 0);
	const t0 = Date.now(); for (let k = 0; k < 20; k++) Te.build(moon, {f: 1, L: 13, i: 4000 + k, j: 4000}); const ms = (Date.now() - t0) / 20;
	ok('14. a tile builds in a few milliseconds (the game builds them within 2 ms a frame, at least one)', ms < 12, ms.toFixed(1) + ' ms');
	/* the scene and landing use it */
	const sc = {bodies: [{kind: 'star', name: 'S', pos: [0, 0, 0], radius: 7e8}, Object.assign({}, moon, {pos: [1e11, 0, 0], g: 0.2, M: 0.02, karman: 2000, axis: [0, 0, 1], period: 86400 * 20, phase: 0.4, src: {g: 0.2, Ts: 200}})], day: 3};
	const W = sc.bodies[1], up = nrm([0.4, 0.8, -0.2]), h = Te.height(W, Sc.localDir(sc, W, up, 50)), ship = S.ships()[0];
	const s = Fl.create(ship, {p: W.pos.map((v, i) => v + up[i] * (W.radius + h + 120))});
	const ss = Sc.surfaceState(sc, s, 50, ship);
	ok('15. the altitude readout is over the terrain itself, in the world\'s turning axes', Math.abs(ss.alt - 120) < 1e-3 && Math.abs(Sc.groundAt(sc, W, s.p, 50).alt - 120) < 1e-3, ss.alt);
	const land = Sc.landAt(sc, s, W, 50, 7), pin = Sc.pinLanded(sc, land, 50);
	ok('16. a landed ship stands on the terrain where it set down', Math.abs(Sc.groundAt(sc, W, pin.p, 50).alt - 7) < 1e-3);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
