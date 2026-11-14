/* Ember Reach's combat (apps/rudolf-emberreach/www/combat.js): weapons, shields, heat, projectiles, missiles, AI, in node.
     node tests/emberreach_combat_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const C = require(path.join(DIR, 'combat.js')), Fl = require(path.join(DIR, 'flight.js')), M = require(path.join(DIR, 'modules.js')), S = require(path.join(DIR, 'ships.js')), Sc = require(path.join(DIR, 'scene.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const {add, sub, mul, len} = C.v, DT = 1 / 60;
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
try {
	const L = S.ships(), kestrel = L.find(s => s.id == 'kestrel'), pike = L.find(s => s.id == 'pike'), wren = L.find(s => s.id == 'wren');
	ok('1. loadouts follow the hardpoints: a Kestrel\'s pulse laser and light gatling (gimballed, as AI ships have them); a Pike adds mass drivers and missile pylons; a Wren is unarmed', C.loadout(kestrel).guns.length == 2 && C.loadout(kestrel).guns.map(g => g.kind).join() == 'pulse,gatling' && C.loadout(kestrel).guns.every(g => g.mount == 'gimbal') && C.loadout(pike).guns.some(g => g.kind == 'driver') && C.loadout(pike).missiles == 8 && C.loadout(wren).guns.length == 0);
	const cs = C.state(kestrel);
	C.damage(cs, 10, 'pulse', 0);
	ok('2. shields take the hits first (lasers 1.2× against them); the hull is untouched while they hold', cs.shield == kestrel.shield - 12 && cs.hull == kestrel.hull);
	const cs2 = C.state(kestrel); const r2 = C.damage(cs2, 1000, 'driver', 0, seeded(3));
	ok('3. what breaks through hits the hull, and the hull\'s damage lands on the modules', cs2.shield == 0 && cs2.hull < kestrel.hull && cs2.fit.modules.some(m => m.hp < m.max) && cs2.dead);
	const cs3 = C.state(kestrel); cs3.shield = 0; C.damage(cs3, 5, 'pulse', 0); for (let t = 0; t < 2; t += DT) C.tick(cs3, t, DT); const early = cs3.shield; for (let t = 2; t < 20; t += DT) C.tick(cs3, t, DT);
	ok('4. shields come back after a quiet spell, to full', early == 0 && cs3.shield == cs3.shieldMax);
	const cs4 = C.state(kestrel); M.damage(cs4.fit, 'shields', 1e6); cs4.shield = 0; for (let t = 5; t < 30; t += DT) C.tick(cs4, t, DT);
	ok('5. ...unless the shield generator is down', cs4.shield == 0);

	/* heat */
	const lasers = Object.assign({}, kestrel, {guns: ['pulse', 'pulse']}), s = Fl.create(kestrel); s.radius = 6; const cs5 = C.state(lasers); cs5.id = 'me'; let shots = 0, locked = false; const out = [];
	for (let t = 0; t < 30; t += DT) { C.tick(cs5, t, DT); shots += C.fire(cs5, s, t, null, out); if (cs5.hot) locked = true }
	ok('6. holding the trigger heats the lasers until the guns lock, then they cool and fire again', locked && shots > 0 && shots < 30 * 12, shots + ' shots in 30 s');
	const gcs = C.state(Object.assign({}, kestrel, {guns: ['gatling']})); gcs.id = 'me'; const gout = []; C.fire(gcs, s, 0, null, gout);
	ok('7. lasers fire rays along the nose, out to their range; a gatling\'s rounds leave along the nose at their speed', out.length && out[0].ray && Math.abs(C.v.dot(out[0].dir, Fl.forward(s)) - 1) < 1e-9 && out[0].range == C.WEAPONS.pulse.range
		&& gout.length == 1 && Math.abs(len(sub(gout[0].v, s.v)) - C.WEAPONS.gatling.speed) < 1e-6);

	/* projectiles and lead */
	const target = {p: [0, 600, 2000], v: [80, 0, 0]}, aim = C.lead([0, 0, 0], [0, 0, 0], target.p, target.v, C.WEAPONS.driver.speed);
	const tt = len(sub(aim, [0, 0, 0])) / C.WEAPONS.driver.speed;
	ok('8. leading a moving target: the bolt and the target meet', len(sub(aim, add(target.p, mul(target.v, tt)))) < 1e-3);
	const tgtShip = {id: 'T', s: {p: target.p.slice(), v: target.v, radius: 8}, cs: C.state(kestrel)}, list = [{kind: 'driver', p: [0, 0, 0], v: mul(C.v.norm(aim), C.WEAPONS.driver.speed), ttl: 3, dmg: 22, owner: 'me'}];
	let hits = []; for (let k = 0; k < 200 && !hits.length && list.length; k++) { hits = C.stepProjectiles(list, [tgtShip], DT); tgtShip.s.p = add(tgtShip.s.p, mul(tgtShip.s.v, DT)) }
	ok('9. a led shot hits', hits.length == 1 && hits[0].ship.id == 'T');

	/* missiles and flares */
	const ms = Fl.create(pike, {p: [0, 0, 0], q: Sc.lookRotation([0, 0, 1], [0, 1, 0])}); ms.radius = 15; const mcs = C.state(pike); mcs.id = 'me';
	const prey = {id: 'P', p: [200, 100, 3000], v: [60, 20, 0]};
	let lockT = 0; for (let t = 0; t < 3; t += DT) if (C.updateLock(mcs, ms, prey, DT)) { lockT = t; break }
	ok('10. a missile lock takes 2 s with the target in the cone', lockT >= 1.95 && lockT < 2.1);
	const ml = []; const n = C.launch(mcs, ms, prey, ml);
	const preyShip = {id: 'P', s: {p: prey.p.slice(), v: prey.v, radius: 8}, cs: C.state(kestrel)};
	let mh = []; for (let k = 0; k < 60 * 30 && !mh.length && ml.length; k++) { mh = C.stepProjectiles(ml, [preyShip], DT); preyShip.s.p = add(preyShip.s.p, mul(preyShip.s.v, DT)) }
	ok('11. a missile homes in and hits a target that doesn\'t dodge', n == 1 && mh.length == 1 && mcs.load.missiles == 7);
	const many = Array.from({length: 400}, () => ({target: 'P'})), fcs = C.state(kestrel); fcs.id = 'P';
	const lost = C.flare(fcs, many, seeded(7));
	ok('12. a flare shakes off about 70% of the missiles chasing you', Math.abs(lost / 400 - 0.7) < 0.06 && fcs.load.flares == C.COMBAT.flares - 1, lost + ' of 400');

	/* AI */
	const hunter = {s: Fl.create(kestrel, {p: [0, 0, 0], q: Sc.lookRotation([1, 0, 0], [0, 0, 1])}), cs: C.state(kestrel), ai: {mode: 'attack'}}; hunter.s.radius = 6; hunter.cs.id = 'H';
	const victim = {id: 'V', s: Fl.create(wren, {p: [-1500, 2500, 800], v: [30, 0, 0]}), cs: C.state(wren)}; victim.s.radius = 4.5; victim.cs.id = 'V';
	const shots2 = []; let killedAt = null;
	for (let t = 0; t < 120 && killedAt == null; t += DT) {
		const tgt = {p: victim.s.p, v: victim.s.v, id: 'V'}, c = C.think(hunter, tgt, null, t, seeded(11));
		Fl.step(hunter.s, {pitch: c.pitch, yaw: c.yaw, roll: c.roll, throttle: c.throttle}, DT);
		Fl.step(victim.s, {throttle: 0.15}, DT);
		C.tick(hunter.cs, t, DT); C.tick(victim.cs, t, DT);
		if (c.fire) C.fire(hunter.cs, hunter.s, t, tgt, shots2);
		for (const h of C.stepProjectiles(shots2, [{id: 'V', s: victim.s, cs: victim.cs}], DT)) C.damage(victim.cs, h.proj.dmg, h.proj.kind, t);
		if (victim.cs.dead) killedAt = t;
	}
	ok('13. an AI fighter turns onto a target behind it, closes, leads and kills it', killedAt != null && killedAt < 60, killedAt == null ? 'still alive: hull ' + victim.cs.hull.toFixed(0) : killedAt.toFixed(1) + ' s');
	const coward = {s: Fl.create(kestrel), cs: C.state(kestrel), ai: {mode: 'attack', fleeAt: 0.25}}; coward.s.radius = 6; coward.cs.hull = coward.cs.hullMax * 0.2;
	ok('14. a badly hurt pilot flees: full throttle, nose away', (() => { const c = C.think(coward, {p: [0, 0, 1000], v: [0, 0, 0], id: 'x'}, null, 0); return coward.ai.mode == 'flee' && c.throttle == 1 && !c.fire })());
	ok('15. the same fight, the same result', (() => { const run = () => { const a = {s: Fl.create(kestrel), cs: C.state(kestrel), ai: {mode: 'attack'}}; a.s.radius = 6; for (let t = 0; t < 5; t += DT) { const c = C.think(a, {p: [500, 300, 2000], v: [0, 0, 0], id: 'z'}, null, t, seeded(5)); Fl.step(a.s, c, DT) } return a.s.p.join() }; return run() == run() })());

	/* the weapons rework (0.3.1) */
	const near = {id: 'A', s: {p: [0, 0, 800], v: [0, 0, 0], radius: 8}, cs: C.state(kestrel)}, far = {id: 'B', s: {p: [0, 0, 1500], v: [0, 0, 0], radius: 8}, cs: C.state(kestrel)}, gone = {id: 'Z', s: {p: [0, 0, 2600], v: [0, 0, 0], radius: 8}, cs: C.state(kestrel)};
	const rays = [{kind: 'pulse', p: [0, 0, 0], dir: [0, 0, 1], range: 2500, ray: true, ttl: 1, dmg: 1, owner: 'me'}, {kind: 'pulse', p: [0, 0, 1600], dir: [0, 0, 1], range: 900, ray: true, ttl: 1, dmg: 1, owner: 'me'}], bm = [];
	const rh = C.stepProjectiles(rays, [far, near, gone], DT, bm);
	ok('16. a laser is hitscan: in one step its ray hits the nearest ship in its way (not one behind it), and stops short of its range', rh.length == 1 && rh[0].ship.id == 'A' && Math.abs(rh[0].proj.p[2] - (800 - 8 * 0.85)) < 1e-6 && rays.length == 0 && bm.length == 2 && Math.abs(bm.find(b => b.a[2] == 1600).b[2] - 2500) < 1e-6);
	const W0 = C.WEAPONS.pulse, W1 = C.WEAPONS.gatlingM, W2 = C.WEAPONS.driver;
	ok('17. gatlings hit hulls harder than shields; the mass driver both alike; lasers shields harder', W1.vsHull > 1 && W1.vsShield < 1 && W2.vsHull == 1 && W2.vsShield == 1 && W0.vsShield > W0.vsHull && ['gatling', 'gatlingM', 'gatlingL'].every(k => C.WEAPONS[k].size == ['gatling', 'gatlingM', 'gatlingL'].indexOf(k)));
	/* the mass driver: hold to charge, let go to fire */
	const md = Object.assign({}, kestrel, {guns: ['driver']}), rs = Fl.create(kestrel); rs.radius = 6;
	const chargeShot = hold => { const c = C.state(md); c.id = 'me'; const o = []; let t = 0; for (; t < hold; t += DT) C.railStep(c, rs, t, null, o, true, DT); const heatHeld = c.heat; C.railStep(c, rs, t, null, o, false, DT); return {o, heatHeld, c} };
	const half = chargeShot(0.3), full = chargeShot(0.62), tap = chargeShot(0.05), long = chargeShot(3);
	ok('18. the mass driver: holding charges it and letting go fires; half a charge hits for half, a tap (under 15%) doesn\'t fire, a full charge for full', half.o.length == 1 && Math.abs(half.o[0].dmg / C.WEAPONS.driver.dmg - 0.5) < 0.05 && full.o.length == 1 && Math.abs(full.o[0].dmg - C.WEAPONS.driver.dmg) < 1e-9 && tap.o.length == 0 && half.heatHeld == 0,
		JSON.stringify({half: half.o.map(x => x.dmg), full: full.o.map(x => x.dmg), tap: tap.o.length}));
	ok('19. ...and held past full charge it heats the ship (and, held long enough, the guns lock)', long.heatHeld > 0.7 && full.heatHeld < 0.02, long.heatHeld.toFixed(2));
	/* mounts */
	const gim = C.state(Object.assign({}, kestrel, {guns: ['gatlingG']})), fix = C.state(Object.assign({}, kestrel, {guns: ['gatling']})), ms0 = Fl.create(kestrel, {q: Sc.lookRotation([0, 0, 1], [0, 1, 0])}); ms0.radius = 6;
	const off = deg => ({p: [Math.sin(deg * Math.PI / 180) * 1000, 0, Math.cos(deg * Math.PI / 180) * 1000], v: [0, 0, 0], id: 'x'});
	const aimG10 = C.aimOf(gim, ms0, gim.load.guns[0], off(10)), aimG25 = C.aimOf(gim, ms0, gim.load.guns[0], off(25)), aimF10 = C.aimOf(fix, ms0, fix.load.guns[0], off(10));
	ok('20. a gimballed gun tracks a target inside its circle (40% of the screen: ' + C.gimbalFor(70).toFixed(1) + '° at a 70° field of view), not outside it; a fixed one fires along the nose', Math.abs(C.gimbalFor(70) - 15.64) < 0.05 && aimG10.tracking && C.v.dot(aimG10.dir, C.v.norm(off(10).p)) > 0.9999 && !aimG25.tracking && aimG25.dir[2] > 0.9999 && !aimF10.tracking && aimF10.dir[2] > 0.9999);
	const go = [], fo = []; C.fire(gim, ms0, 0, null, go); C.fire(fix, ms0, 0, null, fo);
	ok('21. ...for 15% less damage', Math.abs(go[0].dmg / fo[0].dmg - 0.85) < 1e-9);
	/* the lead, with the target's turn: shoot at a target pulling 5 g across the line, both ways */
	const missBy = useA => { const tp = [0, 0, 2500], tv = [150, 0, 0], ta = [0, 49, 0], sp = C.WEAPONS.gatling.speed, aim = C.lead([0, 0, 0], [0, 0, 0], tp, tv, sp, useA ? ta : null), v = mul(C.v.norm(aim), sp); let best = 1e9; for (let t = 0; t < 3; t += 0.001) { const b = mul(v, t), q = add(add(tp, mul(tv, t)), mul(ta, 0.5 * t * t)); best = Math.min(best, len(sub(b, q))) } return best };
	ok('22. aiming ahead of a turning target: with its acceleration the shot meets it (within a metre); on a straight-line lead it misses by ' + missBy(false).toFixed(0) + ' m', missBy(true) < 1 && missBy(false) > 20);
	const tr = {v: [0, 0, 0]}; for (let i = 0; i < 120; i++) { tr.v = add(tr.v, [0, 20 * DT, 0]); C.track(tr, DT) }
	ok('23. a ship\'s acceleration is tracked from its velocity', Math.abs(tr.acc[1] - 20) < 0.5);
	ok('24. lasers aim at the target itself (no flight time to lead)', C.lead([0, 0, 0], [0, 0, 0], [100, 0, 1000], [200, 0, 0], 0).join() == '100,0,1000');
	/* heat makes a ship easier to lock */
	const lockAt = (heat, dist) => { const hs = Fl.create(pike, {q: Sc.lookRotation([0, 0, 1], [0, 1, 0])}); const hc = C.state(pike); hc.id = 'me'; for (let t = 0; t < 4; t += DT) if (C.updateLock(hc, hs, {id: 'h', p: [0, 0, dist], v: [0, 0, 0], heat}, DT)) return +t.toFixed(2); return null };
	ok('25. heat: a cold target locks in 2 s within 7 km and not at 10 km; a hot one (full heat) in 1 s, and at 10 km', Math.abs(lockAt(0, 5000) - 2) < 0.05 && lockAt(0, 10000) == null && Math.abs(lockAt(1, 5000) - 1) < 0.05 && lockAt(1, 10000) != null);
	const O = require(path.join(DIR, 'outfit.js'));
	ok('26. the outfitters sell each laser, gatling and needle fixed and gimballed (half again the price); the mass driver is still the mass driver', ['pulse', 'heavy', 'gatling', 'gatlingM', 'gatlingL', 'needle'].every(k => O.CAT[k + 'G'] && O.CAT[k + 'G'].price == O.CAT[k].price * 1.5 && C.gunOf(k + 'G').kind == k && C.gunOf(k + 'G').mount == 'gimbal') && O.CAT.driver.name == 'Mass driver' && !O.CAT.driverG && !O.CAT.lanceG);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
