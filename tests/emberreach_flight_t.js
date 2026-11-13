/* Ember Reach's flight model (apps/rudolf-emberreach/www/flight.js), in node.
     node tests/emberreach_flight_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Fl = require(path.join(DIR, 'flight.js')), S = require(path.join(DIR, 'ships.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const DT = 1 / 60, D2R = Math.PI / 180;
/* fly for t seconds with fixed input; track the largest thrust used against the limits */
function fly(s, input, t, frame, log) {
	let e = 0, over = 0;
	for (let k = Math.round(t / DT); k > 0; k--) {
		const r = Fl.step(s, input, DT, frame), Sp = s.spec;
		e += r.effort * DT;
		r.aBody.forEach((a, i) => { const hi = i < 2 ? Sp.aRcs : a > 0 ? Sp.aMain : Sp.aRetro; over = Math.max(over, Math.abs(a) / hi) });
		r.alpha.forEach((a, i) => { over = Math.max(over, Math.abs(a) / Sp.alpha[i]) });
		if (log) log(s);
	}
	return {effort: e, over};
}
const speed = s => Fl.len(s.v), rate = s => Fl.len(s.w);
try {
	const L = S.ships(), wren = L.find(s => s.id == 'wren'), kestrel = L.find(s => s.id == 'kestrel'), mono = L.find(s => s.id == 'monolith');
	const specs = L.map(Fl.spec);
	ok('1. every one of the 40 stock ships gets thrusters: a main drive, weaker retros, RCS and ACS, all positive',
		specs.every(x => x.aMain > x.aRetro && x.aRetro > 0 && x.aRcs > 0 && x.alpha.every(a => a > 0) && x.rates.every(r => r > 0)));
	ok('1b. every ship turns best at 40% of its top speed: full pitch rate held exactly up to there', specs.every(x => Math.abs(Fl.TUNE.grip * x.aRcs / x.rates[0] / x.vmax - 0.4) < 1e-9));
	const byLen = L.slice().sort((a, b) => a.length - b.length).map(Fl.spec);
	ok('2. bigger ships answer slower: time to top speed and to full turn rate grow with length',
		byLen.every((x, i) => !i || (x.reach >= byLen[i - 1].reach && x.spinT >= byLen[i - 1].spinT)) && Fl.spec(mono).spinT > 3 * Fl.spec(wren).spinT);
	ok('3. Oolite-like controls: roll fastest, then pitch, yaw slowest, on every ship', specs.every(x => x.rates[2] > x.rates[0] && x.rates[0] > x.rates[1]));

	/* FA on: a throttle sets a speed */
	let s = Fl.create(kestrel), top = 0;
	const r4 = fly(s, {throttle: 1}, 20, null, x => { top = Math.max(top, speed(x)) });
	ok('4. FA on: full throttle settles at top speed and never overshoots it', Math.abs(speed(s) / s.spec.vmax - 1) < 0.01 && top < 1.01 * s.spec.vmax && r4.over <= 1 + 1e-9, speed(s).toFixed(1) + ' of ' + s.spec.vmax);
	fly(s, {throttle: 0}, 4 / Fl.TUNE.retro * s.spec.reach);
	ok('5. FA on: throttle to zero and the ship slows to a stop on its retros, like a swimmer letting the water hold it', speed(s) < 0.5, speed(s).toFixed(2) + ' m/s');

	/* FA on: let go of the stick and the turn stops */
	s = Fl.create(kestrel);
	fly(s, {pitch: 1}, 3 * s.spec.spinT);
	const reached = s.w[0] / s.spec.rates[0];
	fly(s, {}, 3 * s.spec.spinT);
	ok('6. FA on: the stick sets a turn rate, reached quickly; let go and the turn stops', reached > 0.95 && rate(s) < 0.01 * s.spec.rates[0], (reached * 100).toFixed(0) + '% reached, ' + (rate(s) / D2R).toFixed(2) + '°/s left');

	/* FA on: velocity follows the nose; at speed FA widens the turn rather than let the ship slide */
	const turn = (fa, thr) => { const t = Fl.create(kestrel); fly(t, {throttle: thr}, 15); Fl.setAssist(t, fa); let m = 0, n = 0, h0 = Fl.forward(t);
		fly(t, {throttle: thr, thrust: thr, pitch: 1}, 4, null, x => { m += Fl.slip(x); n++ }); return {slip: m / n, rate: t.w[0]} };
	const slow = turn(true, 0.15), fast = turn(true, 1), off = turn(false, 1);
	ok('7. FA on: in a hard turn the velocity follows the nose, at any speed (mean side-slip under 2°)', slow.slip < 2 && fast.slip < 2, slow.slip.toFixed(1) + '° slow, ' + fast.slip.toFixed(1) + '° at full');
	ok('7b. FA on: turns widen with speed; FA off keeps the full turn rate but slides', fast.rate < 0.5 * slow.rate && off.rate > 0.99 * kestrel.agility * D2R && off.slip > 3 * fast.slip,
		'FA on ' + (fast.rate / D2R).toFixed(0) + '°/s at full vs ' + (slow.rate / D2R).toFixed(0) + '°/s slow; FA off ' + (off.rate / D2R).toFixed(0) + '°/s, slip ' + off.slip.toFixed(0) + '°');
	s = Fl.create(kestrel); fly(s, {throttle: 0.6}, 15); fly(s, {throttle: 0.6, pitch: 1}, 2); fly(s, {throttle: 0.6}, 3 * s.spec.reach);
	ok('8. FA on: after the turn the side-slip dies away and the ship flies where it points', Fl.slip(s) < 1 && Math.abs(speed(s) / (0.6 * s.spec.vmax) - 1) < 0.02, Fl.slip(s).toFixed(2) + '°');

	/* FA off: Newton */
	s = Fl.create(kestrel, {fa: false});
	fly(s, {pitch: 1}, 0.5);
	const w0 = s.w.slice();
	fly(s, {}, 5);
	ok('9. FA off: a turn keeps spinning when the stick is let go', Math.abs(s.w[0] - w0[0]) < 1e-12 && w0[0] > 0);
	s = Fl.create(kestrel, {fa: false, v: [3, -4, 120]});
	fly(s, {}, 10);
	ok('10. FA off: with no thrust, velocity stays exactly as it was', Math.abs(s.v[0] - 3) + Math.abs(s.v[1] + 4) + Math.abs(s.v[2] - 120) < 1e-9);
	s = Fl.create(kestrel, {fa: false});
	fly(s, {thrust: 1}, 2);
	const v0 = s.v.slice();
	fly(s, {pitch: 1}, 0.4); fly(s, {}, 0.6); fly(s, {pitch: -1}, 0.4);
	ok('11. FA off: turn the nose and the ship keeps drifting the old way', Fl.len(Fl.toWorld([1, 0, 0, 0], v0.map((c, i) => c - s.v[i]))) < 1e-9 && Fl.slip(s) > 20, 'slip ' + Fl.slip(s).toFixed(0) + '°');

	/* switching FA back on catches a tumbling, drifting ship */
	s = Fl.create(kestrel, {fa: false, v: [80, 40, -60], w: [1.2, -0.4, 2]});
	fly(s, {}, 2);
	Fl.setAssist(s, true);
	const r12 = fly(s, {}, 5 * s.spec.reach);
	ok('12. turning FA on catches a drifting, tumbling ship and brings it to rest', speed(s) < 0.5 && rate(s) < 0.001 && r12.over <= 1 + 1e-9, speed(s).toFixed(2) + ' m/s, ' + rate(s).toFixed(4) + ' rad/s');

	/* never more than the thrusters have, in either mode */
	let over = 0;
	for (const sh of [wren, kestrel, mono]) for (const fa of [true, false]) {
		const t = Fl.create(sh, {fa, v: [50, -20, 10], w: [0.3, 0.2, -0.5]});
		for (const inp of [{throttle: 1, pitch: 1, roll: -1, strafe: [1, -1]}, {throttle: -1, yaw: 1, thrust: -1}, {thrust: 1, strafe: [-1, 1], pitch: -1}]) over = Math.max(over, fly(t, inp, 6).over);
	}
	ok('13. thrust never exceeds what the main drive, RCS and ACS can give', over <= 1 + 1e-9, over.toFixed(3));

	/* FA costs thrust: after the same turn at speed, FA keeps the thrusters busy cleaning up; FA off coasts free */
	const after = fa => { const t = Fl.create(kestrel); fly(t, {throttle: 1}, 20); Fl.setAssist(t, fa); fly(t, {throttle: 1, thrust: 0, pitch: 1}, 1); fly(t, {throttle: 1, pitch: -1}, 0.05); return fly(t, fa ? {throttle: 1} : {}, 3).effort };
	const ea = after(true), eb = after(false);
	ok('14. FA works the thrusters after a turn, where flying without it costs nothing while coasting (heat and fuel)', ea > 0.1 && eb == 0, ea.toFixed(2) + ' vs ' + eb.toFixed(2));

	/* docking at a spinning station: a Trefoil turns at 2.83 rpm about its axis */
	const spin = Math.sqrt(9.81 / 112), frame = {c: [0, 0, 0], v: [0, 0, 0], w: [0, 0, spin]};
	s = Fl.create(wren, {p: [0, 40, -150]});
	fly(s, {}, 15, frame);
	const rel = Fl.relative(s, frame);
	ok('15. FA can match a spinning station: the ship comes to rest relative to the port and turns with it', Fl.len(rel.v) < 0.5 && Fl.len(rel.w) < 0.005, Fl.len(rel.v).toFixed(2) + ' m/s, ' + Fl.len(rel.w).toFixed(4) + ' rad/s relative');
	s = Fl.create(wren, {p: [0, 40, -150], fa: false});
	fly(s, {}, 5, frame);
	ok('16. without FA the port turns past you: relative speed stays at spin × distance from the axis', Math.abs(Fl.len(Fl.relative(s, frame).v) - spin * 40) < 0.1);

	/* NPCs and players fly the same model, so it must be repeatable */
	const run = () => { const t = Fl.create(kestrel); fly(t, {throttle: 0.8, pitch: 0.6, roll: -0.3}, 5); fly(t, {yaw: 1, strafe: [0.5, 0]}, 3); return t.p.concat(t.q) };
	const r1 = run(), r2 = run();
	ok('17. the same inputs always fly the same path', r1.every((c, i) => c === r2[i]));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
