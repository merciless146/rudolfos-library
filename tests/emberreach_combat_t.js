/* Ember Reach's combat (wip/emberreach/combat.js): weapons, shields, heat, projectiles, missiles, AI, in node.
     node tests/emberreach_combat_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const C = require(path.join(DIR, 'combat.js')), Fl = require(path.join(DIR, 'flight.js')), M = require(path.join(DIR, 'modules.js')), S = require(path.join(DIR, 'ships.js')), Sc = require(path.join(DIR, 'scene.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const {add, sub, mul, len} = C.v, DT = 1 / 60;
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
try {
	const L = S.ships(), kestrel = L.find(s => s.id == 'kestrel'), pike = L.find(s => s.id == 'pike'), wren = L.find(s => s.id == 'wren');
	ok('1. loadouts follow the hardpoints: a Kestrel\'s two pulse lasers; a Pike adds mass drivers and missile pylons; a Wren is unarmed', C.loadout(kestrel).guns.length == 2 && C.loadout(kestrel).guns.every(g => g.kind == 'pulse') && C.loadout(pike).guns.some(g => g.kind == 'driver') && C.loadout(pike).missiles == 8 && C.loadout(wren).guns.length == 0);
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
	const s = Fl.create(kestrel); s.radius = 6; const cs5 = C.state(kestrel); cs5.id = 'me'; let shots = 0, locked = false; const out = [];
	for (let t = 0; t < 30; t += DT) { C.tick(cs5, t, DT); shots += C.fire(cs5, s, t, null, out); if (cs5.hot) locked = true }
	ok('6. holding the trigger heats the lasers until the guns lock, then they cool and fire again', locked && shots > 0 && shots < 30 * 12, shots + ' shots in 30 s');
	ok('7. bolts leave along the nose at the weapon\'s speed', out.length && Math.abs(len(sub(out[0].v, s.v)) - C.WEAPONS.pulse.speed) < 1e-6);

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
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
