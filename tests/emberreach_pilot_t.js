/* Ember Reach's pilot under g (wip/emberreach/pilot.js), with flight and modules, in node.
     node tests/emberreach_pilot_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const Pi = require(path.join(DIR, 'pilot.js')), M = require(path.join(DIR, 'modules.js')), Fl = require(path.join(DIR, 'flight.js')), S = require(path.join(DIR, 'ships.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const DT = 1 / 60;
/* hold a felt g for t seconds; when each stage first shows */
function hold(p, g, t) {
	const first = {};
	for (let k = 1; k <= Math.round(t / DT); k++) {
		const v = Pi.step(p, g, DT), now = k * DT;
		if (v.blur > 0 && first.blur == null) first.blur = now;
		if (v.dark > 0 && first.dark == null) first.dark = now;
		if (!v.conscious && first.out == null) first.out = now;
	}
	return first;
}
try {
	const kestrel = S.ships().find(s => s.id == 'kestrel');
	let p = Pi.create();
	hold(p, 4, 60);
	ok('1. at or below 4 g the pilot feels it but takes no harm', p.strain == 0 && p.conscious);
	p = Pi.create();
	Pi.controls(p, {throttle: 0.6, pitch: 1});
	const f8 = hold(p, 8, 6);
	ok('2. at 8 g: the view blurs first, then darkens from the edges, then the pilot blacks out (about 4 s)', f8.blur < f8.dark && f8.dark < f8.out && Math.abs(f8.out - 4) < 0.05,
		'blur ' + f8.blur.toFixed(1) + ' s, dark ' + f8.dark.toFixed(1) + ' s, out ' + f8.out.toFixed(2) + ' s');
	const f20 = hold(Pi.create(), 20, 3);
	ok('3. harder pulls black out sooner (20 g: 1 s)', Math.abs(f20.out - 1) < 0.05, f20.out.toFixed(2) + ' s');
	ok('4. while out the view is black', Pi.view(p).dark == 1 && !Pi.view(p).conscious);
	const c = Pi.controls(p, {pitch: 1, yaw: -1, roll: 1, throttle: 0.2, strafe: [1, 1], thrust: -1});
	ok('5. while out the controls don\'t answer: a neutral stick, no strafe, the throttle where it was', !c.pitch && !c.yaw && !c.roll && !c.strafe && c.throttle === 0.6);
	/* coming round */
	let t = 6 - f8.out; while (!p.conscious && t < 30) { Pi.step(p, 1, DT); t += DT }
	ok('6. ease off and the pilot comes round, after at least 4 s out', p.conscious && t >= Pi.PILOT.out - 1e-9, t.toFixed(1) + ' s out');
	const v = Pi.view(p);
	ok('7. on waking the view is still blurred and dark at the edges, and clears as the strain falls', v.blur > 0 && v.dark > 0 && v.dark < 1 && (hold(p, 1, 10), Pi.view(p).blur == 0 && Pi.view(p).dark == 0));
	/* the whole chain: a fighter in a hard turn with its canopy broken */
	const run = canopy => {
		const s = Fl.create(kestrel), f = M.fit(kestrel), pl = Pi.create(), log = {out: null, back: null, rateOut: 0, speedOut: 0};
		if (!canopy) M.damage(f, 'canopy', 1e6);
		M.apply(f, s);
		for (let k = 0; k < 15 * 60; k++) Fl.step(s, {throttle: 0.4}, DT);
		for (let k = 1; k <= 30 * 60; k++) {
			const r = Fl.step(s, Pi.controls(pl, {throttle: 0.4, pitch: 1}), DT), vw = Pi.step(pl, M.gForce(f, r).felt, DT);
			if (!vw.conscious && log.out == null) log.out = k * DT;
			if (log.out != null && log.rateOut == 0 && k * DT > log.out + 2) { log.rateOut = Math.abs(s.w[0]); log.speedOut = Fl.len(s.v) }
			if (log.out != null && vw.conscious && log.back == null) log.back = k * DT;
		}
		return log;
	};
	const intact = run(true), broken = run(false);
	ok('8. canopy intact: the same hard turn for 30 s and the pilot never blacks out', intact.out == null);
	ok('9. canopy broken: the pilot blacks out in the turn; the ship stops turning and flies on at the throttle\'s speed',
		broken.out != null && broken.out < 3 && broken.rateOut < 0.01 && Math.abs(broken.speedOut - 0.4 * 320) < 2, 'out at ' + (broken.out || 0).toFixed(1) + ' s');
	ok('10. ...and comes round once flight assist has eased the g off (then blacks out again if they keep pulling)', broken.back != null && broken.back > broken.out + Pi.PILOT.out - 1e-9, 'back at ' + (broken.back || 0).toFixed(1) + ' s');
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
