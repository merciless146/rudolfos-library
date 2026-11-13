/* Ember Reach's system scene (apps/rudolf-emberreach/www/scene.js): bodies, ports, docking, collisions, cruise, in node.
     node tests/emberreach_scene_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Sc = require(path.join(DIR, 'scene.js')), Fl = require(path.join(DIR, 'flight.js')), F = require(path.join(DIR, 'factions.js')), S = require(path.join(DIR, 'ships.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const {add, sub, mul, len, dot} = Sc.v, DT = 1 / 60;
try {
	const home = F.majors()[0], wren = S.ships().find(s => s.id == 'wren');
	const sc = Sc.build(home.star, {day: 200, portWorld: home.home.name});
	const pl = sc.bodies.filter(b => b.kind == 'planet'), G0 = require(path.join(DIR, 'galaxy.js'));
	const pl0 = pl.filter(b => !b.parent), mo = pl.filter(b => b.parent);
	ok('1. the real system: its star, every planet of the model on its orbit, sizes in metres', sc.bodies[0].kind == 'star' && pl0.length == G0.system(home.star).planets.length
		&& pl0.every(b => { const hostPos = b.host == 'B' ? sc.bodies.find(x => x.companion).pos : [0, 0, 0]; return Math.abs(len(sub(b.pos, hostPos)) / Sc.AU - G0.system(home.star).planets.find(x => x.name == b.name).a) < 0.01 && b.radius > 1e6 }));
	ok('1a. moons orbit their planets, at their distances', mo.every(m => { const pb = pl.find(b => b.name == m.parent); return Math.abs(len(sub(m.pos, pb.pos)) / pb.radius - m.src.dist) < 0.1 }));
	ok('1b. orbits move with the days', len(sub(Sc.build(home.star, {day: 230}).bodies.find(b => b.kind == 'planet').pos, pl[0].pos)) > 1e9);
	const st = sc.station;
	ok('2. the home port is a Halo in orbit of the home world, its mouth facing open space', st.cls == 'halo' && st.world.name == home.home.name && Math.abs(len(sub(st.c, st.world.pos)) / st.world.radius - 2) < 1e-9 && dot(st.axis, Sc.v.norm(sub(st.c, st.world.pos))) > 0.99);
	ok('3. each class spins for 1 g at its floor', ['trefoil', 'bloom', 'lantern', 'halo'].every(c => Math.abs(Sc.spinOf(c) ** 2 * Sc.STATION[c].floor - 9.81) < 1e-9));

	/* the ship at the spawn point */
	const sp = Sc.spawn(sc), s = Fl.create(wren, sp); s.radius = wren.length / 2;
	ok('4. a ship starts outside the port, facing its mouth, touching nothing', !Sc.collide(sc, s, 0) && dot(Fl.forward(s), mul(st.axis, -1)) > 0.999);
	ok('5. the port is solid: its hub, its ring, its spokes', [[0, 0, 0], [0, 900, 0], [0, 510, 0]].every(l => { const t = Fl.create(wren, {p: Sc.toWorldPt(st, l)}); t.radius = 4; return !!Sc.collide(sc, t, 0) }));
	const ringPt = Sc.toWorldPt(st, [0, 900, 0]), later = Fl.create(wren, {p: ringPt}); later.radius = 4;
	ok('6. ...and its ring turns: a point on the ring at t = 0 is clear of a spoke a few seconds later, but on the ring all the way round', !!Sc.collide(sc, later, 7) && Sc.nearestPart(st, Sc.toWorldPt(st, [0, 510, 0]), 5).d > 0);

	/* docking at the Halo: through the slot, slow, nose in, with clearance */
	const approach = (opts) => {
		const t = Fl.create(wren, {p: Sc.toWorldPt(st, [0, 0, 345]), q: Sc.lookRotation(mul(st.axis, -1), st.y), v: mul(st.axis, -(opts.speed || 20))}); t.radius = 4.5;
		let res = null; for (let k = 0; k < 300 && !res; k++) { Fl.step(t, {}, DT); t.v = mul(st.axis, -(opts.speed || 20)); const r = Sc.dockCheck(st, t, k * DT, opts.clear !== false); if (r && r.ok !== null) res = r; if (!res) { const h = Sc.collide(sc, t, k * DT); if (h) res = {hit: h} } }
		return res;
	};
	ok('7. Halo: fly through the slot slowly, nose in, with clearance, and you dock', (approach({}) || {}).ok === true);
	ok('8. no clearance, no docking', (approach({clear: false}) || {}).why == 'clearance');
	ok('9. too fast is a crash, not a docking', (approach({speed: 90}) || {}).why == 'speed');
	const t2 = Fl.create(wren, {p: Sc.toWorldPt(st, [90, 0, 300])}); t2.radius = 4.5;
	ok('10. off the slot, the dock face is solid', !!Sc.collide(sc, t2, 0));

	/* a spinning dock: a Trefoil turns, so the ship must turn with it */
	const tsc = Sc.build(home.star, {day: 200, port: 'trefoil'}), ts = tsc.station, fr = Sc.frame(ts);
	ok('11. a Trefoil\'s dock spins; a Halo\'s and a Lantern\'s don\'t', len(fr.w) > 0 && len(Sc.frame(st).w) == 0 && len(Sc.frame(Sc.build(home.star, {port: 'lantern'}).station).w) == 0);
	const flyIn = fa => {
		const t = Fl.create(wren, Object.assign(Sc.spawn(tsc, 120), {fa})); t.radius = 4.5; let res = null;
		for (let k = 0; k < 60 * 40 && !res; k++) {
			const L = Sc.toLocal(ts, t.p), close = L[2] - ts.def.dock.z;
			/* the pilot: centre on the axis, ease in, nose in */
			const lat = Fl.toBody(t.q, Sc.toWorldDir(ts, [-L[0] * 0.2, -L[1] * 0.2, 0]));
			Fl.step(t, {throttle: close > 30 ? 0.06 : 0.02, strafe: [Math.max(-1, Math.min(1, lat[0])), Math.max(-1, Math.min(1, lat[1]))], thrust: fa ? 0 : 0.02}, DT, fa ? fr : null);
			const r = Sc.dockCheck(ts, t, k * DT, true); if (r && r.ok !== null) res = r;
			if (!res && Sc.collide(tsc, t, k * DT)) res = {hit: true};
		}
		return res || {};
	};
	const withFA = flyIn(true), noFA = flyIn(false);
	ok('12. at a spinning Trefoil, flight assist matches the spin and the ship docks', withFA.ok === true, JSON.stringify(withFA).slice(0, 80));
	ok('13. ...without matching the spin, the dock turns past you and won\'t take you', noFA.ok !== true, JSON.stringify(noFA).slice(0, 80));

	/* cruise */
	ok('14. a port\'s mass lock: no cruise within 20 km', Sc.massLocked(sc, sp.p) && !Sc.massLocked(sc, Sc.toWorldPt(st, [0, 0, 30000])));
	/* a planet whose straight course from the port stays well clear of the star */
	const clearOf = (a, b) => { const d = sub(b, a), t0 = Math.max(0, Math.min(1, -dot(a, d) / dot(d, d))); return len(add(a, mul(d, t0))) };
	const far = pl.filter(b => !b.host && !b.parent && b != st.world && clearOf(st.c, b.pos) > 0.1 * Sc.AU).sort((a, b) => len(sub(b.pos, st.c)) - len(sub(a.pos, st.c)))[0], c = Fl.create(wren, {p: Sc.toWorldPt(st, [0, 0, 30000]), q: Sc.lookRotation(sub(far.pos, Sc.toWorldPt(st, [0, 0, 30000])), [0, 0, 1])}); c.radius = 4.5;
	const cz = {v: 0}; let t = 0, top = 0, hit = false, res = null;
	while (t < 600 && !res) { res = Sc.cruiseStep(sc, c, cz, {throttle: 1}, DT, far); t += DT; top = Math.max(top, cz.v); if (Sc.collide(sc, c, t)) hit = true }
	const dist = len(sub(far.pos, st.c)) / Sc.AU;
	ok('15. cruise crosses to another planet (' + dist.toFixed(2) + ' AU) in a minute or two, and drops out near it', res == 'drop' && t > 20 && t < 150 && Sc.surfaceDist(far, c.p) < Sc.dropRange(far) && Sc.surfaceDist(far, c.p) > 0 && !hit, t.toFixed(0) + ' s, top ' + (top / Sc.C).toFixed(1) + ' c');
	ok('16. cruise slows on its own near a surface: never faster than the distance to it, a second', (() => { const q = Fl.create(wren, {p: add(far.pos, [far.radius * 3, 0, 0]), q: Sc.lookRotation([-1, 0, 0], [0, 0, 1])}); const z = {v: Sc.CRUISE.cap}; for (let k = 0; k < 600; k++) { const lim = Sc.cruiseLimit(sc, q.p); Sc.cruiseStep(sc, q, z, {throttle: 1}, DT); if (z.v > lim + 1e-6) return false } return true })());
	ok('16b. a course into the star throws the ship out of cruise before it reaches the surface', (() => { const sun = sc.bodies[0], q = Fl.create(wren, {p: [0.5 * Sc.AU, 0, 0], q: Sc.lookRotation([-1, 0, 0], [0, 0, 1])}); const z = {v: 0}; for (let k = 0; k < 60 * 120; k++) if (Sc.cruiseStep(sc, q, z, {throttle: 1}, DT) == 'drop') return Sc.surfaceDist(sun, q.p) > sun.radius; return false })());
	const drop = Sc.dropOut(c, {v: 4e5});
	ok('17. dropping out keeps the heading at no more than top speed; above 300 km/s it\'s an emergency', drop.emergency && Math.abs(len(c.v) - c.spec.vmax) < 1e-6 && !Sc.dropOut(c, {v: 1000}).emergency);
	const lockedP = pl.find(b => b.locked), freeP = pl.find(b => !b.locked);
	ok('19. planets turn: locked worlds once per orbit, others in 0.3 to 3 days; tilts are kept, the orbits unchanged by them', (!lockedP || Math.abs(lockedP.period / 86400 - Math.sqrt(Math.pow(len(lockedP.pos) / Sc.AU, 3) / home.star.M) * 365.25) < 1e-6 * lockedP.period)
		&& (!freeP || (freeP.period / 86400 >= 0.3 && freeP.period / 86400 <= 3)) && pl.every(b => Math.abs(len(b.axis) - 1) < 1e-9) && Math.abs(Sc.turnOf(pl[0], 200, pl[0].period) - Sc.turnOf(pl[0], 200, 0)) < 1e-9
		&& Math.abs(dot(Sc.bodyFrame(pl[0], 1.2).x, pl[0].axis)) < 1e-9);
	const ringed = F.majors().map(m => ({m, sc: Sc.build(m.star, {portWorld: m.home.name})})).find(x => x.sc.station.world.ring);
	ok('20. every power\'s port orbits its own homeworld, and clears any rings', F.majors().slice(0, 12).every(m => Sc.build(m.star, {portWorld: m.home.name}).station.world.name == m.home.name)
		&& (!ringed || len(sub(ringed.sc.station.c, ringed.sc.station.world.pos)) - ringed.sc.station.def.radius > 2.3 * ringed.sc.station.world.radius));
	const bare = Sc.build(home.star, {port: null}), arr = Sc.arrival(bare), wa = Fl.create(wren, arr); wa.radius = 4;
	ok('21. a system with no port: no station, no mass lock, nothing to hit but its bodies; a jump arrives clear of the star, facing on', bare.station === null && !Sc.massLocked(bare, arr.p) && !Sc.collide(bare, wa, 0)
		&& len(sub(arr.p, bare.bodies[0].pos)) > 30 * bare.bodies[0].radius && Sc.cruiseLimit(bare, arr.p) > 1e9);
	ok('18. the same system every time', JSON.stringify(Sc.build(home.star, {day: 200}).bodies) == JSON.stringify(sc.bodies));
	/* years and days, as real worlds have them */
	const Gx = require(path.join(DIR, 'galaxy.js')), earth = {i: 0, a: 1, M: 1, R: 1, locked: false, gas: false, moons: [{dist: 60.3}]}; Gx.spin({id: 'sol', M: 1}, earth);
	ok('19. a world\'s year from Kepler\'s law, a moon\'s month from its planet\'s mass and distance: an Earth\'s year 365 days, a Moon at 60 Earth radii 27 days', Math.abs(earth.year - 365.25) < 0.5 && Math.abs(earth.moons[0].year - 27.3) < 0.5);
	const ws = Gx.sampleGalaxy(800, 9).filter(x => x.kind == 'star').flatMap(x => Gx.system(x).planets), rocks = ws.filter(w => !w.gas && !w.locked), gas = ws.filter(w => w.gas && !w.locked);
	ok('20. days as real worlds have them: locked worlds once a year, gas giants in 9-18 h, rocky worlds from 10 h to months (some backwards), moons locked to their months', ws.filter(w => w.locked).every(w => w.day == w.year) && gas.every(w => w.day * 24 >= 9 && w.day * 24 <= 18) && rocks.every(w => Math.abs(w.day) * 24 >= 9.99) && rocks.some(w => w.day < 0) && ws.flatMap(w => w.moons || []).every(m => m.day == m.year && m.year > 0));
	const sc2 = Sc.build(home.star, {day: 200}), moonB = sc2.bodies.find(b => b.parent), worldB = sc2.bodies.find(b => b.kind == 'planet' && !b.parent);
	ok('21. in the scene, each world turns once a day of its own and each moon goes round in its month, in real time', !moonB || (Math.abs(moonB.period - moonB.src.year * 86400) < 1 && Math.abs(worldB.period - worldB.src.day * 86400) < 1));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
