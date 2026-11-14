/* Ember Reach's landing (landing.js, scene.js's world frame and surface readout), in node.
     node tests/emberreach_landing_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const req = f => require(path.join(DIR, f));
const L = req('landing.js'), Sc = req('scene.js'), Fl = req('flight.js'), S = req('ships.js'), F = req('factions.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map(v => v * k), len = a => Math.hypot(...a);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/* a ship's orientation from its nose and its top */
const look = (f, u) => Sc.lookRotation(f, u);
try {
	/* the rules, carried over from the draft */
	const rock = {g: 0.3, Ts: 200}, dodo = S.ships().find(s => s.id == 'dodo') || S.ships()[0];
	ok('1. airless, solid, not molten or frozen, at most 2.5 g: landable', L.landable(rock).ok && !L.landable({gas: true, g: 1, Ts: 100}).ok && !L.landable({atmo: true, bars: 1, g: 0.9, Ts: 288}).ok
		&& !L.landable({g: 0.4, Ts: 900}).ok && !L.landable({g: 0.4, Ts: 20}).ok && !L.landable({g: 3, Ts: 200}).ok);
	ok('2. every ship lands on light worlds; lift is its thrusters or 1.5 g, whichever is more', S.ships().every(s => L.canLand(s, rock).ok && L.lift(s) >= 1.5 * 9.81 - 1e-9));
	const heavy = {g: 2.4, Ts: 200}, weak = S.ships().filter(s => L.lift(s) < 1.5 * 2.4 * 9.81);
	ok('3. a heavy world needs half again its gravity in lift: some hulls can\'t', weak.length > 0 && weak.every(s => !L.canLand(s, heavy).ok && /Too heavy/.test(L.canLand(s, heavy).why)) && weak.every(s => L.maxG(s) < 2.4));
	ok('4. pads: XS ships use S pads, capital ships the heavy fields', L.padFor('XS') == 'S' && L.padFor('M') == 'M' && L.padFor('Capital') == 'C');
	const T = L.TOUCH.M, clean = L.touchdown('M', T.vz, T.vh, T.tilt), hard = L.touchdown('M', T.vz * 2, 0, 0), crash = L.touchdown('M', T.vz * 3, 0, 0);
	ok('5. touchdown: at the limits a clean landing; twice past them a hard one (15% of the hull per excess squared); three times a crash', clean.ok && !clean.hard && hard.ok && hard.hard && Math.abs(hard.damage - 0.15) < 1e-9 && !crash.ok && crash.crash);
	ok('6. the target card says it plainly', /^Landable · 0\.30 g · lift \d+\.\d g$/.test(L.card(dodo, rock).line) && /^Not landable: an atmosphere/.test(L.card(dodo, {atmo: true, bars: 1, g: 1, Ts: 288}).line), L.card(dodo, rock).line);
	/* a world's frame: it turns once a day about the world's axis */
	const W = {kind: 'planet', name: 'Testmoon', pos: [1e11, 0, 0], radius: 3e6, g: 0.5, M: 0.05, karman: Sc.karmanOf ? 5000 : 5000, axis: [0, 0, 1], period: 10 * 3600, phase: 0, src: {g: 0.5, Ts: 220}};
	const scene = {star: {name: 'Test'}, bodies: [{kind: 'star', name: 'Test', pos: [0, 0, 0], radius: 7e8}, W], station: null, day: 0};
	const fr = Sc.worldFrame(W);
	/* the terrain's height under a direction (world axes) at time t (L1.3: worlds have terrain) */
	const hAt = (d, t) => Sc.heightAt(W, Sc.localDir(scene, W, d.map(v => v / len(d)), t || 0));
	ok('7. a world\'s frame: centred on it, spinning about its axis once a day (a 10-hour world: 2π / 36,000 s)', fr.c == W.pos && Math.abs(len(fr.w) - 2 * Math.PI / 36000) < 1e-15 && fr.w[2] > 0);
	const back = Sc.worldFrame(Object.assign({}, W, {period: -36000}));
	ok('8. a world that turns backwards spins the other way', back.w[2] < 0);
	/* a ship hovering 2 km up with flight assist holds its spot as the world turns (a minute, on a 10-hour world) */
	const ship = dodo, up0 = [1, 0, 0], p0 = add(W.pos, mul(up0, W.radius + 2000));
	const s = Fl.create(ship, {p: p0, q: look([0, 1, 0], up0)});
	s.v = Fl.frameAt(fr, p0).v.slice();   /* (already moving with the ground) */
	const spotAt = t => { const a = 2 * Math.PI * t / 36000, c = Math.cos(a), si = Math.sin(a); return add(W.pos, mul([c, si, 0], W.radius + 2000)) };
	let worst = 0;
	for (let i = 1; i <= 60 * 60; i++) {
		s.grav = Sc.gravityAt(scene, s.p);
		Fl.step(s, {pitch: 0, yaw: 0, roll: 0, throttle: 0, strafe: [0, 0], thrust: 0}, 1 / 60, Sc.worldFrame(W));
		if (i % 60 == 0) worst = Math.max(worst, len(sub(s.p, spotAt(i / 60))));
	}
	const st = Sc.surfaceState(scene, s, 60, ship);
	ok('9. hovering with flight assist, a ship holds its spot over the turning ground for a minute (the ground moves ' + Math.round(len(fr.w) * (W.radius + 2000) * 60) + ' m)', worst < 5 && Math.abs(st.alt + hAt(sub(s.p, W.pos), 60) - 2000) < 5 && st.vh < 0.5 && Math.abs(st.vz) < 0.5, worst.toFixed(2) + ' m off at worst; ' + JSON.stringify({alt: st.alt, vh: st.vh, vz: st.vz}));
	const s2 = Fl.create(ship, {p: p0, q: look([0, 1, 0], up0)}); s2.v = [0, 0, 0];   /* (no FA: held still in space) */
	const free = Sc.surfaceState(scene, s2, 0, ship);
	ok('10. held still in space, the ground slides by at the world\'s turning speed', Math.abs(free.vh - len(fr.w) * (W.radius + 2000)) < 1e-6 && Math.abs(free.vz) < 1e-9);
	/* the readout on a known setup */
	const p3 = add(W.pos, mul([0, 0, 1], W.radius + 1234)), s3 = Fl.create(ship, {p: p3, q: look([1, 0, 0], [0, 0, 1])});
	s3.v = [0, 0, -3];
	const r3 = Sc.surfaceState(scene, s3, 0, ship);
	ok('11. over the north pole: 1,234 m from the radius (less the terrain there), falling at 3 m/s, latitude 90°, nose level, wings level', Math.abs(r3.alt + hAt([0, 0, 1]) - 1234) < 1e-6 && Math.abs(r3.vz + 3) < 1e-9 && Math.abs(r3.lat - 90) < 1e-6 && Math.abs(r3.pitch) < 1e-6 && Math.abs(r3.bank) < 1e-6, r3);
	const s4 = Fl.create(ship, {p: p3, q: look([Math.cos(0.3), 0, Math.sin(0.3)], [-Math.sin(0.3), 0, Math.cos(0.3)])});
	const r4 = Sc.surfaceState(scene, s4, 0, ship), r5 = Sc.surfaceState(scene, Fl.create(ship, {p: p3, q: look([1, 0, 0], [0, Math.sin(0.4), Math.cos(0.4)])}), 0, ship);
	ok('12. pitch and bank against the local horizon (nose up 17.2°; banked 22.9°)', Math.abs(r4.pitch - 0.3 * 180 / Math.PI) < 1e-6 && Math.abs(Math.abs(r5.bank) - 0.4 * 180 / Math.PI) < 1e-6, [r4.pitch, r5.bank]);
	ok('13. above every Kármán line there is no surface readout', Sc.surfaceState(scene, Fl.create(ship, {p: add(W.pos, [W.radius + 9000, 0, 0])}), 0, ship) === null);
	/* the game's own worlds */
	const sc = Sc.build(F.majors()[0].star, {day: 200}), worlds = sc.bodies.filter(b => b.kind == 'planet');
	ok('14. every world in a system carries a frame and an answer on landing', worlds.length > 0 && worlds.every(b => Sc.worldFrame(b).w.length == 3 && typeof L.landable(b.src).ok == 'boolean'));
	/* L1.2: gear, contact, landed */
	const Sv = req('save.js'), Mo = req('modules.js'), wren = S.ships().find(x => x.size == 'S') || dodo, Lm = wren.length;
	const g0 = L.lowest(wren, true, 0), b0 = L.lowest(wren, false, 0), n0 = L.lowest(wren, true, 70);
	ok('15. the lowest point: the gear (30% of the length down), the belly (18%) with it up, the nose when pitched past 45°', Math.abs(g0.d - 0.3 * Lm) < 1e-9 && g0.part == 'gear' && Math.abs(b0.d - 0.18 * Lm) < 1e-9 && b0.part == 'belly' && n0.part == 'nose' && n0.d > g0.d);
	const lim = L.TOUCH[L.padFor(wren.size)], sf = (vz, vh, tilt, pitch) => ({vz: -vz, vh, tilt, pitch: pitch || 0});
	const on = L.contact(wren, sf(lim.vz, lim.vh, lim.tilt), true), past = L.contact(wren, sf(lim.vz * 1.5, 0, 0), true), wreck = L.contact(wren, sf(lim.vz * 3, 0, 0), true);
	ok('16. on the gear: at the limits clean, past them hard, three times past them a crash', on.ok && !on.hard && on.part == 'gear' && past.hard && Math.abs(past.damage - 0.15 * 0.25) < 1e-9 && wreck.crash);
	const belly = L.contact(wren, sf(lim.vz * 0.5, 0, 0), false), belly2 = L.contact(wren, sf(lim.vz, 0, 0), false), nose = L.contact(wren, sf(lim.vz * 0.4, 0, 0, 60), true);
	ok('17. anything but the gear counts three times over: a gentle belly landing is a hard one, one at the gear\'s limit a crash; so is a nose-first touch', belly.hard && belly.part == 'belly' && belly2.crash && nose.part == 'nose' && nose.hard);
	ok('18. the gear: down by itself under 300 m, up above 500 m, and no faster than 100 m/s while down; it can break like any module', L.GEAR.auto.down == 300 && L.GEAR.auto.up == 500 && L.GEAR.vmax == 100 && Mo.fit(wren).modules.some(m => m.id == 'gear'));
	/* landed: fixed to the ground, turning with the world */
	const sL = Fl.create(wren, {p: add(W.pos, mul([1, 0, 0], W.radius + hAt([1, 0, 0]) + g0.d)), q: look([0.3, 1, 0], [1, 0.2, 0])});
	const land = Sc.landAt(scene, sL, W, 0, g0.d), at0 = Sc.pinLanded(scene, land, 0), at9 = Sc.pinLanded(scene, land, 9000);
	const upAt = p => sub(p, W.pos).map(v => v / len(sub(p, W.pos))), shipUp = q => Fl.toWorld(q, [0, 1, 0]), dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	ok('19. landed, the ship stands upright on its gear where it touched down', len(sub(at0.p, sL.p)) < 1e-3 && dotp(shipUp(at0.q), upAt(at0.p)) > 0.999999 && Math.abs(len(sub(at0.p, W.pos)) - W.radius - hAt([1, 0, 0]) - g0.d) < 1e-3);   /* (to a millimetre: the world is 1e11 m out) */
	ok('20. a quarter of a 10-hour day on, it has turned a quarter of the way round with the world, moving with the ground', Math.abs(dotp(upAt(at9.p), [0, 1, 0]) - 1) < 1e-9 && Math.abs(len(at9.v) - len(fr.w) * len(sub(at9.p, W.pos))) < 1e-6 && dotp(shipUp(at9.q), upAt(at9.p)) > 0.999999);
	const st9 = Sc.surfaceState(scene, Object.assign(Fl.create(wren, {p: at9.p, q: at9.q}), {v: at9.v}), 9000, wren);
	ok('21. ...and reads as standing still: no vertical or ground speed, no tilt', Math.abs(st9.vz) < 1e-6 && st9.vh < 1e-6 && st9.tilt < 1e-3, st9);
	/* saved and restored */
	const shipS = S.ships()[0], fitS = Mo.fit(shipS), sS = Fl.create(shipS, {p: at0.p, q: at0.q});
	const packed = JSON.parse(JSON.stringify(Sv.pack({power: 0, port: null, ship: shipS.id, day: 3, t: 12, docked: false, s: sS, throttle: 0, fit: fitS, star: {id: 'x', x: 0, y: 0, z: 0}, fuel: 1, landed: land, gear: true})));
	const un = Sv.unpack(packed, {});
	ok('22. a landed ship is saved with its world and its place, and comes back to it', un && un.landed && un.landed.world == 'Testmoon' && un.gear && len(sub(Sc.pinLanded(scene, un.landed, 9000).p, at9.p)) < 0.01);
	delete packed.landed; delete packed.gear;
	ok('23. a save without one (older) loads flying, as before', Sv.unpack(packed, {}).landed === null);
	/* L1.4: the approach */
	const X = req('explore.js'), G = req('galaxy.js'), Tr = req('trade.js');
	const airy = Object.assign({}, W, {name: 'Airy', atmo: true, src: {g: 0.9, Ts: 288, atmo: true, bars: 1}});
	ok('24. cruise drops out above a targeted world you could land on: at its Kármán line or 4.2 km up (50 km at full size), whichever is higher; other worlds as before', Sc.dropRange(W) == Math.max(W.karman, Sc.DROP_LAND) && Sc.dropRange(Object.assign({}, W, {karman: 9e4})) == 9e4 && Sc.dropRange(airy) == airy.radius);
	const lockA = Sc.lockAlt(W), below = add(W.pos, [W.radius + lockA - 10, 0, 0]), above = add(W.pos, [W.radius + lockA + 10, 0, 0]);
	ok('25. a world\'s surface locks cruise below half a radius up or its Kármán line, whichever is lower', lockA == Math.min(W.radius / 2, W.karman) && Sc.worldLock(scene, below) == W && !Sc.worldLock(scene, above) && Sc.massLocked(scene, below) && !Sc.massLocked(scene, above));
	/* cruising straight down at a world: targeted, a clean drop above it; untargeted with nothing else near, into the lock */
	const dive = (target, from) => { const s5 = Fl.create(ship, {p: add(W.pos, [from, 0, 0]), q: look([-1, 0, 0], [0, 0, 1])}), cz = {on: true, v: 2e4}; for (let i = 0; i < 20000; i++) { const r = Sc.cruiseStep(scene, s5, cz, {throttle: 1}, 1 / 60, target); if (r) return {r, alt: len(sub(s5.p, W.pos)) - W.radius} } return null };
	const d1 = dive(W, W.radius + 4e5), d2 = dive(null, W.radius + 1.2e5);
	ok('26. diving in cruise: with the world targeted, a drop near 4.2 km up; without, the old safety drop (15% of the radius) comes first', d1 && d1.r == 'drop' && d1.alt <= Sc.dropRange(W) && d1.alt > 0.8 * Sc.dropRange(W) && d2 && d2.r == 'drop' && d2.alt <= 0.15 * W.radius + 1, {d1, d2});
	const tiny = Object.assign({}, W, {radius: 2e5, karman: 3e5}), sceneT = {bodies: [scene.bodies[0], tiny], day: 0}, s6 = Fl.create(ship, {p: add(tiny.pos, [tiny.radius + 1.2e5, 0, 0]), q: look([-1, 0, 0], [0, 0, 1])});
	let r6 = null; const cz6 = {on: true, v: 3e4}; for (let i = 0; i < 2000 && !r6; i++) r6 = Sc.cruiseStep(sceneT, s6, cz6, {throttle: 1}, 1 / 60, null);
	const d6 = Sc.dropOut(s6, {v: 100}, true);
	ok('27. where the lock reaches past the safety drop, cruising into it is an emergency drop', r6 == 'lock' && d6.emergency);
	/* first landings */
	const pl = Tr.newPlayer(F.majors()[0].id), far = G.sampleGalaxy(60, 8).flatMap(q => G.starsNear(q.x, q.y, q.z, 3).slice(0, 5)).find(st => st.kind == 'star' && G.system(st).planets.some(p => !p.gas && !p.atmo) && !F.claimAt([st.x, st.y, st.z]).owner && !F.claimAt([st.x, st.y, st.z]).contested);   /* (a real star, found again by its id) */
	const wp = G.system(far).planets.find(p => !p.gas && !p.atmo), l1 = X.landed(pl, far, wp, null, 210), l2 = X.landed(pl, far, wp, null, 211);
	ok('28. the first landing on a world out of the powers\' charted space is a discovery: recorded once, worth half a survey, 2.5 times over', l1.new && l1.first && Math.abs(l1.value - X.worth(wp) / 2 * 2.5) < 1e-9 && !l2.new && X.landedOn(pl, far.id, wp.name));
	const items = X.unsold(pl), li = items.find(x => x.kind == 'landing');
	pl.wallet = {}; const sold = X.sell(pl, null, 'SU', 212);
	ok('29. landing data sells to cartographers with the rest, once', li && Math.abs(li.su - l1.value) < 1e-9 && sold.ok && !X.unsold(pl).some(x => x.kind == 'landing'));
	/* deposits */
	const wd = {name: 'Dep world', radius: 1.7e6}, wsrc = {res: ['Iron', 'Titanium', 'Gold']}, here = [0.6, 0.64, 0.48].map(v => v / Math.hypot(0.6, 0.64, 0.48));
	const dA = X.deposits(wd, wsrc, here, 5000), dB = X.deposits(wd, wsrc, here, 5000);
	ok('30. a ground scan marks the world\'s own resources within 5 km, the same every time, nearest first', dA.length > 0 && JSON.stringify(dA) == JSON.stringify(dB) && dA.every(d => d.dist <= 5000 && wsrc.res.includes(d.res)) && dA.every((d, i, a) => !i || a[i - 1].dist <= d.dist) && X.deposits(wd, {res: []}, here, 5000).length == 0, dA.length + ' deposits');
	/* L1.5: AI pilots below a world's line keep 450 m off the ground on their vertical thrusters */
	const Cb = req('combat.js'), Rw = 2e5, gw = 1.0, npcFly = (alt0, fwd, throttle) => {
		const n = Fl.create(S.ships().find(x => x.id == 'wren'), {p: [Rw + alt0, 0, 0], q: look(fwd, Math.abs(fwd[0]) > 0.9 ? [0, 0, 1] : [1, 0, 0])}); let lo = Infinity, hi = -Infinity;
		for (let i = 0; i < 60 * 20; i++) { const r = len(n.p), up = mul(n.p, 1 / r), alt = r - Rw; n.grav = mul(up, -gw * 9.81); const k = Cb.groundKeep(n, up, alt, {throttle}); Fl.step(n, {pitch: k.pitch || 0, yaw: k.yaw || 0, roll: 0, throttle: k.throttle, strafe: k.strafe}, 1 / 60); if (i > 60 * 5) { lo = Math.min(lo, alt); hi = Math.max(hi, alt) } else lo = Math.min(lo, alt) }
		return {lo: Math.round(lo), hi: Math.round(hi), end: Math.round(len(n.p) - Rw)} };
	const hv = npcFly(380, [0, 1, 0], 0), dv = npcFly(1500, [-1, 0, 0], 1);
	ok('31. an AI pilot below a line in 1 g holds its height: from 380 m it lifts to about 450 m and stays (no safety needed)', hv.lo > 300 && hv.end > 400 && hv.end < 520 && hv.hi < 560, hv);
	ok('32. ...and diving at the ground at full throttle, it eases off and pulls out above the 300 m safety', dv.lo > 300 && dv.end > 380, dv);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
