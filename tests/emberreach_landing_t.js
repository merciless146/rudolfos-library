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
	ok('9. hovering with flight assist, a ship holds its spot over the turning ground for a minute (the ground moves ' + Math.round(len(fr.w) * (W.radius + 2000) * 60) + ' m)', worst < 5 && Math.abs(st.alt - 2000) < 5 && st.vh < 0.5 && Math.abs(st.vz) < 0.5, worst.toFixed(2) + ' m off at worst; ' + JSON.stringify({alt: st.alt, vh: st.vh, vz: st.vz}));
	const s2 = Fl.create(ship, {p: p0, q: look([0, 1, 0], up0)}); s2.v = [0, 0, 0];   /* (no FA: held still in space) */
	const free = Sc.surfaceState(scene, s2, 0, ship);
	ok('10. held still in space, the ground slides by at the world\'s turning speed', Math.abs(free.vh - len(fr.w) * (W.radius + 2000)) < 1e-6 && Math.abs(free.vz) < 1e-9);
	/* the readout on a known setup */
	const p3 = add(W.pos, mul([0, 0, 1], W.radius + 1234)), s3 = Fl.create(ship, {p: p3, q: look([1, 0, 0], [0, 0, 1])});
	s3.v = [0, 0, -3];
	const r3 = Sc.surfaceState(scene, s3, 0, ship);
	ok('11. over the north pole: 1,234 m up, falling at 3 m/s, latitude 90°, nose level, wings level', Math.abs(r3.alt - 1234) < 1e-6 && Math.abs(r3.vz + 3) < 1e-9 && Math.abs(r3.lat - 90) < 1e-6 && Math.abs(r3.pitch) < 1e-6 && Math.abs(r3.bank) < 1e-6, r3);
	const s4 = Fl.create(ship, {p: p3, q: look([Math.cos(0.3), 0, Math.sin(0.3)], [-Math.sin(0.3), 0, Math.cos(0.3)])});
	const r4 = Sc.surfaceState(scene, s4, 0, ship), r5 = Sc.surfaceState(scene, Fl.create(ship, {p: p3, q: look([1, 0, 0], [0, Math.sin(0.4), Math.cos(0.4)])}), 0, ship);
	ok('12. pitch and bank against the local horizon (nose up 17.2°; banked 22.9°)', Math.abs(r4.pitch - 0.3 * 180 / Math.PI) < 1e-6 && Math.abs(Math.abs(r5.bank) - 0.4 * 180 / Math.PI) < 1e-6, [r4.pitch, r5.bank]);
	ok('13. above every Kármán line there is no surface readout', Sc.surfaceState(scene, Fl.create(ship, {p: add(W.pos, [W.radius + 9000, 0, 0])}), 0, ship) === null);
	/* the game's own worlds */
	const sc = Sc.build(F.majors()[0].star, {day: 200}), worlds = sc.bodies.filter(b => b.kind == 'planet');
	ok('14. every world in a system carries a frame and an answer on landing', worlds.length > 0 && worlds.every(b => Sc.worldFrame(b).w.length == 3 && typeof L.landable(b.src).ok == 'boolean'));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
