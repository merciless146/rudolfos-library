/* Ember Reach 0.3.6: the Autopilot Computer (autopilot.js), the 10 km port locks and the Kármán line lock (scene.js),
   the reboot and the oxygen reserve (modules.js), and what the HUD says of another system (travel.js), in node.
     node tests/emberreach_autopilot_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Sc = require(path.join(DIR, 'scene.js')), Fl = require(path.join(DIR, 'flight.js')), F = require(path.join(DIR, 'factions.js')), S = require(path.join(DIR, 'ships.js'));
const Ap = require(path.join(DIR, 'autopilot.js')), M = require(path.join(DIR, 'modules.js')), O = require(path.join(DIR, 'outfit.js')), T = require(path.join(DIR, 'travel.js')), G = require(path.join(DIR, 'galaxy.js'));
const Ld = require(path.join(DIR, 'landing.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + JSON.stringify(d) : '')) } };
const {add, sub, mul, len, dot, norm} = Sc.v, DT = 1 / 60;
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(7);
try {
	const home = F.majors()[0], wren = S.ships().find(s => s.id == 'wren'), big = S.ships().find(s => s.size == 'L');

	/* ---- the locks ---- */
	const sc = Sc.build(home.star, {day: 200, portWorld: home.home.name}), st = sc.station;
	const at = d => Sc.toWorldPt(st, [0, 0, d]);
	ok('1. a space port locks cruise within 10 km of it, not past', Sc.CRUISE.lock == 10000 && Sc.massLocked(sc, at(9900)) && !Sc.massLocked(sc, at(10100)));
	const w = sc.bodies.find(b => b.kind == 'planet' && b.karman && !Sc.massLocked(sc, add(b.pos, [0, 0, b.radius + b.karman + 50])) && len(sub(b.pos, st.c)) > b.radius + b.karman + 3e4);
	ok('2. a world locks cruise below its Kármán line, and not above it', w && Sc.lockAlt(w) == w.karman && Sc.massLocked(sc, add(w.pos, [0, 0, w.radius + w.karman - 50])) && !Sc.massLocked(sc, add(w.pos, [0, 0, w.radius + w.karman + 50])));
	const site = add(w.pos, [w.radius, 0, 0]);
	sc.lockPoints = () => [{p: site, name: 'Test outpost'}];
	const kw = Object.assign({}, w, {karman: 3000}), sc3 = Object.assign({}, sc, {bodies: sc.bodies.map(b => b == w ? kw : b), lockPoints: () => [{p: site, name: 'Test outpost'}]});
	ok('3. a surface port locks 10 km round it too, above a Kármán line lower than that, and says what holds the ship', (Sc.lockedBy(sc3, add(site, [8000, 0, 0])) || {}).name == 'Test outpost' && (Sc.lockedBy(sc3, add(site, [2000, 0, 0])) || {}).name == w.name && !Sc.portLock(sc3, add(site, [10500, 0, 0])));
	delete sc.lockPoints;
	ok('4. cruise drops out at a port at the edge of its lock (10.3 km)', Math.abs(Sc.dropLeft(st, at(10300), false)) < 1 && Sc.dropLeft(st, at(12000), false) > 0);
	ok('5. with cruise assist a world is left at its lock edge (its Kármán line, or a landable world\'s own drop point)', (() => { const d = Sc.dropRange(w, true); return d >= w.karman && d <= Math.max(w.karman * 1.03, Sc.landableTarget(w) ? Math.max(w.karman, Sc.DROP_LAND) : 0) + 1 })());

	/* ---- cruise assist: from where a jump arrives to the port, and to a world ---- */
	const cruiseTo = (tgt, maxT) => {
		const a = Sc.arrival(sc), s = Fl.create(wren, a); s.radius = 4;
		const cz = {on: true, v: 0, charge: 0};
		/* (pointed well away first: the assist has to bring the nose round) */
		s.q = Sc.lookRotation(norm([0.3, 1, 0.2]), [0, 0, 1]);
		const pos = () => tgt.c || tgt.pos;
		for (let t = 0; t < maxT; t += DT) {
			const rem = Sc.dropLeft(tgt, s.p, true), c = Ap.cruise(s, pos(), rem, Sc.cruiseLimit(sc, s.p));
			const r = Sc.cruiseStep(sc, s, cz, {pitch: c.pitch / 0.5, yaw: c.yaw / 0.5, throttle: c.throttle}, DT, tgt, true);
			if (r) return {r, t, v: cz.v, left: Sc.dropLeft(tgt, s.p, true), d: len(sub(s.p, pos()))};
		}
		return {r: null, t: maxT};
	};
	const toPort = cruiseTo(st, 1200);
	ok('6. cruise assist turns onto the port and arrives at its lock edge, slowly enough to drop out safely', toPort.r == 'drop' && toPort.d > 9900 && toPort.d < 10600 && toPort.v < Sc.CRUISE.emergency * 0.1, toPort);
	const toWorld = cruiseTo(w, 1200), altW = toWorld.d - w.radius;
	ok('7. ...and at a world, just above its Kármán line (no emergency drop)', toWorld.r == 'drop' && altW >= w.karman && altW < Sc.dropRange(w, true) * 1.2 + 500, {r: toWorld.r, alt: altW, k: w.karman});

	/* ---- docking in space, from in front, beside and behind: classes that spin (an iris) and one that doesn't ---- */
	const dockRun = (cls, local, ship, maxT) => {
		const sc2 = Sc.build(home.star, {day: 200, port: cls, portWorld: home.home.name}), st2 = sc2.station, s = Fl.create(ship, {p: Sc.toWorldPt(st2, local)});
		s.radius = Math.max(2, ship.length / 2); s.q = Sc.lookRotation(norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), [0, 0, 1]);
		for (let t = 0; t < maxT; t += DT) {
			const r = Ap.dockStation(s, st2, null, Sc);
			Fl.step(s, r.input, DT, r.frame);
			const hit = Sc.collide(sc2, s, t); if (hit && hit.kind == 'station') return {ok: false, t, why: 'hit ' + hit.part, stage: r.stage};
			const dk = Sc.dockCheck(st2, s, t, true); if (dk && dk.ok === true) return {ok: true, t};
		}
		return {ok: false, t: maxT, why: 'time', L: Sc.toLocal(st2, s.p).map(Math.round)};
	};
	const runs = [];
	for (const cls of ['trefoil', 'bloom', 'lantern', 'halo']) for (const L of [[1500, 800, 6000], [5000, 0, 0], [300, -400, -5000]]) runs.push(Object.assign({cls, L}, dockRun(cls, L, wren, 600)));
	ok('8. the autopilot docks a cleared ship at every class of port, from in front, beside and behind, within 10 minutes and without touching the port', runs.every(r => r.ok), runs.filter(r => !r.ok));
	const bigRun = dockRun('halo', [2000, 1000, 7000], big, 900);
	ok('9. ...a large ship too, at a port with large pads', bigRun.ok, bigRun);

	/* ---- docking on the ground: a pad on flat ground, under gravity ---- */
	const groundRun = (ship, start, maxT) => {
		const up = [0, 0, 1], pad = [0, 0, 0], g = 9.81 * 0.4, s = Fl.create(ship, {p: start}); s.radius = Math.max(2, ship.length / 2);
		const touchVz = Ld.TOUCH[Ld.padFor(ship.size)].vz, lim = Ld.TOUCH[Ld.padFor(ship.size)], gearH = Ld.lowest(ship, true, 0).d;
		for (let t = 0; t < maxT; t += DT) {
			s.grav = [0, 0, -g];
			const r = Ap.dockGround(s, pad, up, [0, 0, 0], null, touchVz, gearH);
			Fl.step(s, r.input, DT, null);
			if (s.p[2] - gearH <= 0) {
				const vz = -s.v[2], vh = Math.hypot(s.v[0], s.v[1]), tilt = Math.acos(Math.min(1, dot(Fl.toWorld(s.q, [0, 1, 0]), up))) * 180 / Math.PI, off = Math.hypot(s.p[0], s.p[1]);
				return {ok: vz <= lim.vz && vh <= lim.vh && tilt <= lim.tilt && off < 10, t, vz, vh, tilt, off};
			}
		}
		return {ok: false, t: maxT};
	};
	const gr = [groundRun(wren, [6000, -3000, 2500], 600), groundRun(wren, [-200, 300, 900], 400), groundRun(big, [4000, 4000, 3000], 900)];
	ok('10. on the ground it flies to the pad, down to a hover and onto it, inside the touchdown limits (small and large ships)', gr.every(r => r.ok), gr);
	ok('11. touching the stick hands over; the autopilot\'s own small corrections don\'t count', Ap.touched({pitch: 0.6, yaw: 0, roll: 0, strafe: [0, 0]}, 0) && Ap.touched({pitch: 0, yaw: 0, roll: 0, strafe: [0, 0]}, 1) && !Ap.touched({pitch: 0.1, yaw: -0.05, roll: 0, strafe: [0, 0.1]}, 0));
	ok('12. the Autopilot Computer: an internal module, size 1, sold at ports', O.CAT.autopilot.cat == 'internal' && O.CAT.autopilot.sizes.join() == '1,1' && O.derive(wren, Object.assign(O.stock(wren), {internal: [{id: 'autopilot', size: 1, grade: 'C'}]})).autopilot === true && !O.derive(wren).autopilot);

	/* ---- reboot ---- */
	const f = M.fit(Object.assign({}, big, {hard: [1, 0, 0, 0]}));
	for (const id of ['power', 'canopy', 'weapons']) M.get(f, id).hp = 0;
	const before = Object.fromEntries(f.modules.map(m => [m.id, m.hp])), plan = M.rebootPlan(f, rnd);
	const taken = Object.entries(plan.taken), most = Math.max(...taken.map(([id, n]) => n / M.get(f, id).max));
	ok('13. a reboot plan brings every inoperable module back, critical first, from many working modules, a little from each', plan.restored.length == 3 && !plan.short.length && plan.restored[0].id == 'power' && taken.length >= 5 && most <= 0.04 + 1e-9, plan);
	M.startReboot(f);
	const during = M.status(f);
	ok('14. while it reboots: no weapons, no thrust, no life support (shields and sensors stay)', !during.weapons && !during.output.main && !during.output.rcs && !during.output.acs && !during.lifeSupport && !M.works(f, 'weapons'));
	let done = null; for (let t = 0; t < 25 && !done; t += 0.5) done = M.stepReboot(f, 0.5, rnd);
	ok('15. after 20 s the modules are working again, and the cost came off the others, none left below a point', done && f.reboot == 0 && ['power', 'canopy', 'weapons'].every(id => M.works(f, id)) && f.modules.every(m => m.hp >= 1) && f.modules.filter(m => before[m.id] > 0).every(m => m.hp >= before[m.id] - Math.max(1, Math.floor(m.max * 0.04))));
	const tiny = M.fit(wren); for (const m of tiny.modules) m.hp = m.id == 'gear' ? 2 : 0;
	const tp = M.rebootPlan(tiny, rnd);
	ok('16. with too little to spare, what can be brought back is, and the rest is reported', tp.restored.length == 1 && tp.short.length == tiny.modules.length - 2 && tp.taken.gear == 1, tp);
	/* ---- oxygen ---- */
	const o = M.fit(wren);
	ok('17. the life support keeps 15 minutes of air (a better unit longer)', o.o2 == 900 && M.fit(Object.assign({}, wren, {lifeK: 1.6})).o2Max == 1440);
	let b = M.breathe(o, 10);
	ok('18. it isn\'t drawn while the unit works and the canopy holds', o.o2 == 900 && !b.draining);
	M.get(o, 'canopy').hp = 0; const warns = [];
	for (let t = 0; t < 900 && !b.out; t++) { b = M.breathe(o, 1); if (b.warn) warns.push(b.warn) }
	ok('19. a broken canopy drains it in 15 minutes, warning at 5 minutes and 1 minute left', b.out && warns.join() == '300,60');
	M.get(o, 'canopy').hp = 5; o.o2 = 100; M.breathe(o, 60);
	ok('20. mended, it fills again (in 2 minutes)', o.o2 > 500 && !M.breathe(o, 0.1).draining);
	const r2 = M.fit(wren); M.startReboot(r2); M.breathe(r2, 30);
	ok('21. a reboot draws on it too (the unit is off)', r2.o2 == 870);

	/* ---- what the HUD says of a system ---- */
	const cap = T.government(home.star, 200), word = home.name.split(' ').pop();
	ok('22. a great power\'s system: its government (its own word) and the superpower', cap.government == word && cap.superpower == home.name.replace(/^The /, '') && !cap.anarchy);
	const wild = G.starsNear(home.star.x, home.star.y, home.star.z, 400).find(x => x.kind == 'star' && !T.ownerOf(x, 200).owner);
	const wg = wild && T.government(wild, 200);
	ok('23. nobody\'s system: Anarchy, no superpower, and nobody living there unless a port or a colony is', wg && wg.anarchy && wg.government == 'Anarchy' && !wg.superpower && (T.portsAt(wild, 200).length || T.population(wild, 200) == 0) && T.population(wild, 200, 120) >= 120, wild && wild.name);
	const inSpace = G.starsNear(home.star.x, home.star.y, home.star.z, 30).find(x => x.kind == 'star' && T.ownerOf(x, 200).owner == home.id && !T.ownerOf(x, 200).contested && T.wildAt(x, 200)), ig = inSpace && T.government(inSpace, 200);
	ok('23a. a system with no port of any kind is wild even inside a power\'s space: Anarchy, uninhabited, the superpower still named, and not open to claim', ig && ig.anarchy && ig.wild && ig.superpower == home.name.replace(/^The /, '') && T.population(inSpace, 200) == 0 && !T.colonisable(inSpace, 200), inSpace && inSpace.name);
	ok('23b. a wild system outside every power\'s space (with worlds) is open to claim; one with a port of any kind isn\'t', wild && (G.system(wild).planets.length ? T.colonisable(wild, 200) : !T.colonisable(wild, 200)) && !T.colonisable(home.star, 200));
	/* the formula: ports' bases times the worlds' multiplier */
	const withPorts = G.starsNear(home.star.x, home.star.y, home.star.z, 60).filter(x => x.kind == 'star' && !T.wildAt(x, 200)).slice(0, 40);
	const fits = withPorts.every(x => { const b = T.portsAt(x, 200).reduce((t, q) => { const v = T.POP.ports[q.anchorage ? 'maw' : q.surface ? q.kind : q.cls] || 0; return [t[0] + v * 0.7, t[1] + v * 1.3] }, [0, 0]), k = T.worldsOf(x).k, n = T.population(x, 200); return n >= b[0] * k - 1 && n <= b[1] * k + 1 });
	const one = withPorts[0], W0 = T.worldsOf(one);
	ok('23c. population: each port\'s base by its kind (within 30%), times the worlds: +0.6 a living world, +0.25 traces of life, +0.1 other habitable, +0.02 barren', fits && Math.abs(W0.k - (1 + 0.6 * W0.n.alive + 0.25 * W0.n.life + 0.1 * W0.n.habitable + 0.02 * W0.n.barren)) < 1e-9 && T.POP.ports.halo > T.POP.ports.lantern && T.POP.ports.lantern > T.POP.ports.starport && T.POP.ports.starport > T.POP.ports.settlement && T.POP.ports.outpost > T.POP.ports.camp);
	const Co = require(path.join(DIR, 'colonies.js')), surfOnly = G.starsNear(home.star.x, home.star.y, home.star.z, 200).find(x => x.kind == 'star' && !T.portFor(x, 200) && T.portsAt(x, 200).length);
	ok('23d. a colonial office won\'t file a claim on a system with only a surface port or outpost', !surfOnly || /already has a port/.test(Co.canClaim({rep: {[home.id]: 1000}, colonies: []}, {star: home.star, owner: home.id}, surfOnly, 'outpost', 200, 1e9).why || ''), surfOnly && surfOnly.name);
	const pc = T.population(home.star, 200);
	ok('24. a capital\'s population runs to billions, and the estimate stays put', pc >= 2e9 && pc == T.population(home.star, 200) && /billion$/.test(T.fmtPop(pc)) && T.fmtPop(41234) == '41,000' && T.fmtPop(380e6) == '380 million');
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
