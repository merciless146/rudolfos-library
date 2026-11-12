/* ===== Ember Reach: flight (docs/plan-ember-reach.md, "Flight").
   Flies like Oolite: pitch and roll on the stick, a little yaw, and a throttle that sets a speed. Underneath, the
   physics is Newtonian. Every ship, NPC or player, has the same flight assist (FA) as standard. FA drives the
   ship's RCS (linear thrusters) and ACS (attitude thrusters) so it handles as if it were swimming in a fluid:
   - let go of the stick and the turn stops;
   - the velocity follows the nose, and side-slip dies away quickly, like a keel or a fish's body;
   - throttle down and the ship slows to that speed.
   FA can't do more than the thrusters can, though. At speed it holds pitch and yaw to the turn the lateral
   thrusters can follow, so turns widen as speed rises (radius = speed² / lateral thrust). Every ship turns best at
   40% of its top speed (its "blue zone"). Turn FA off and the full turn rate is there at any speed, but the ship
   slides. The turning thrusters are strong; the main drive (speeding up) and the retros (braking) are what's short.
   FA off: the stick and throttle drive the thrusters directly. Turns keep spinning, speed keeps coasting, and the
   ship drifts where it was going. FA uses more thrust than flying off; the work is reported as `effort`
   (for heat and fuel later).
   Frames: FA can fly relative to a moving or spinning frame (a station), so docking at a spinning port means
   matching its spin. The thrusters still set the limits.
   Axes, body frame: x right, y up, z forward (the nose). Pitch is about x, yaw about y, roll about z.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const D2R = Math.PI / 180;
/* tuning: how ship size sets the thrusters (seconds, scaled by (length/10 m)^0.3) */
const TUNE = {
	reach: 4,        /* s from rest to top speed on the main drive, for a 10 m ship */
	spin: 0.3,       /* s to reach full turn rate on the ACS, for a 10 m ship */
	retro: 0.5,      /* retro thrust (braking, reversing) as a fraction of the main drive */
	blue: 0.4,       /* best turning speed, as a fraction of top speed: the lateral RCS is sized so that full pitch
	                    can be held up to here, and turns widen above it */
	grip: 0.85,      /* FA holds pitch and yaw to a turn the RCS can follow with room to spare: rate <= grip × RCS / speed */
	rates: [1, 0.5, 2], /* pitch, yaw, roll rates as multiples of the ship's agility: Oolite-like, yaw slow, roll fast */
	strafe: 0.3,     /* FA's top strafe and reverse speed, as a fraction of top speed */
	keelF: 0.25,     /* FA's time constants, as fractions of reach (speed) and spin (turns): small = firm */
	keelL: 0.08,
	keelW: 0.25
};

/* ---- vectors and quaternions (arrays) ---- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.sqrt(dot(a, a));
/* q = [w, x, y, z]; rotate a body vector into the world, and back */
function qmul(a, b) {
	return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
		a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
}
function toWorld(q, v) { const r = qmul(qmul(q, [0, v[0], v[1], v[2]]), [q[0], -q[1], -q[2], -q[3]]); return [r[1], r[2], r[3]] }
function toBody(q, v) { return toWorld([q[0], -q[1], -q[2], -q[3]], v) }
function qnorm(q) { const n = Math.hypot(q[0], q[1], q[2], q[3]); return q.map(c => c / n) }
const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;

/* the thrusters a ship has, from its stats (ships.js: speed m/s, agility °/s, length m) */
function spec(ship) {
	const k = Math.pow(Math.max(ship.length || 10, 1) / 10, 0.3), reach = TUNE.reach * k, spinT = TUNE.spin * k;
	const vmax = ship.speed, aMain = vmax / reach, aRetro = TUNE.retro * aMain;
	const rates = TUNE.rates.map(m => m * ship.agility * D2R), alpha = rates.map(r => r / spinT);
	/* lateral and vertical RCS: enough to bend the path at full pitch rate up to the best turning speed */
	const aRcs = TUNE.blue * vmax * rates[0] / TUNE.grip;
	return {vmax, aMain, aRetro, aRcs, rates, alpha, reach, spinT, vBlue: TUNE.blue * vmax, vStrafe: TUNE.strafe * vmax,
		tauF: TUNE.keelF * reach, tauL: TUNE.keelL * reach, tauW: TUNE.keelW * spinT};
}

/* a ship in flight: position (m), velocity (m/s), orientation, angular velocity (rad/s, body frame) */
function create(ship, o) {
	o = o || {};
	return {spec: spec(ship), p: (o.p || [0, 0, 0]).slice(), v: (o.v || [0, 0, 0]).slice(), q: (o.q || [1, 0, 0, 0]).slice(),
		w: (o.w || [0, 0, 0]).slice(), fa: o.fa !== false, t: 0};
}
function setAssist(s, on) { s.fa = !!on }
const forward = s => toWorld(s.q, [0, 0, 1]);

/* the frame's own velocity at a point, and its angular velocity (world): a station's drift and spin */
function frameAt(frame, p) {
	if (!frame) return {v: [0, 0, 0], w: [0, 0, 0]};
	const w = frame.w || [0, 0, 0];
	return {v: add(frame.v || [0, 0, 0], cross(w, sub(p, frame.c || [0, 0, 0]))), w};
}

/* the ship's velocity and spin relative to a frame (or to space) */
function relative(s, frame) {
	const f = frameAt(frame, s.p);
	return {v: sub(s.v, f.v), w: sub(s.w, toBody(s.q, f.w))};
}

/* one step. input: pitch, yaw, roll (-1..1); FA on: throttle (-0.3..1, a speed), strafe [x, y] (-1..1);
   FA off: thrust (-1..1: main drive forward, retro thrusters back), strafe [x, y] (-1..1).
   Returns the thrust used: linear acceleration (body and world), angular acceleration (body), effort (0..6). */
function step(s, input, dt, frame) {
	const S = s.spec, I = input || {}, st = I.strafe || [0, 0];
	const lim = [[-S.aRcs, S.aRcs], [-S.aRcs, S.aRcs], [-S.aRetro, S.aMain]];
	let aB, alpha;
	if (s.fa) {
		/* linear: the velocity FA wants (relative to the frame), approached with keel-like firmness sideways and a
		   softer hand fore and aft */
		const f = frameAt(frame, s.p), thr = clamp(I.throttle == null ? 0 : I.throttle, -TUNE.strafe, 1);
		const want = [clamp(st[0], -1, 1) * S.vStrafe, clamp(st[1], -1, 1) * S.vStrafe, thr * S.vmax];
		const err = toBody(s.q, sub(add(f.v, toWorld(s.q, want)), s.v));
		/* feed-forward: the wanted velocity turns with the nose (spin × want), and a spinning frame's velocity at
		   the ship changes at w × v; FA thrusts for both as they happen instead of waiting for the slide */
		const ff = add(toBody(s.q, cross(f.w, s.v)), cross(sub(s.w, toBody(s.q, f.w)), want));
		const tau = [S.tauL, S.tauL, S.tauF];
		aB = err.map((e, i) => clamp(e / Math.max(tau[i], dt) + ff[i], lim[i][0], lim[i][1]));
		/* angular: the turn rate the stick asks for (relative to the frame's spin), reached on the ACS and held */
		/* at speed, pitch and yaw are held to the turn the thrusters can follow (radius = speed² / lateral thrust),
		   as a swimmer can't turn on the spot at a sprint; roll doesn't bend the path, so it isn't held */
		const asked = [I.pitch || 0, I.yaw || 0, I.roll || 0].map((c, i) => clamp(c, -1, 1) * S.rates[i]);
		const vr = len(sub(s.v, f.v)), turn = Math.hypot(asked[0], asked[1]), hold = TUNE.grip * S.aRcs / Math.max(vr, 1e-6);
		if (turn > hold) { asked[0] *= hold / turn; asked[1] *= hold / turn }
		const wf = toBody(s.q, f.w), cmd = asked.map((c, i) => c + wf[i]);
		alpha = cmd.map((c, i) => clamp((c - s.w[i]) / Math.max(S.tauW, dt), -S.alpha[i], S.alpha[i]));
	} else {
		/* direct: the stick fires the ACS, the throttle the main drive or the retros, the strafe the RCS */
		const th = clamp(I.thrust || 0, -1, 1);
		aB = [clamp(st[0], -1, 1) * S.aRcs, clamp(st[1], -1, 1) * S.aRcs, th >= 0 ? th * S.aMain : th * S.aRetro];
		alpha = [I.pitch || 0, I.yaw || 0, I.roll || 0].map((c, i) => clamp(c, -1, 1) * S.alpha[i]);
	}
	/* integrate (semi-implicit Euler): a symmetric ship, so no gyroscopic coupling */
	const aW = toWorld(s.q, aB);
	s.v = add(s.v, mul(aW, dt));
	s.p = add(s.p, mul(s.v, dt));
	s.w = add(s.w, mul(alpha, dt));
	const ww = toWorld(s.q, s.w);
	s.q = qnorm(add4(s.q, qmul([0, ww[0], ww[1], ww[2]], s.q).map(c => c * dt / 2)));
	s.t += dt;
	const effort = aB.reduce((t, a, i) => t + Math.abs(a) / (i < 2 ? S.aRcs : a > 0 ? S.aMain : S.aRetro), 0) + alpha.reduce((t, a, i) => t + Math.abs(a) / S.alpha[i], 0);
	return {aBody: aB, aWorld: aW, alpha, effort};
}
function add4(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]] }

/* side-slip: the angle between the nose and the velocity (relative to a frame), in degrees */
function slip(s, frame) {
	const v = relative(s, frame).v, n = len(v);
	return n < 1e-6 ? 0 : Math.acos(clamp(dot(v, forward(s)) / n, -1, 1)) / D2R;
}

const EmberFlight = {TUNE, spec, create, step, setAssist, forward, relative, slip, frameAt, toWorld, toBody, len};
if (typeof module != 'undefined') module.exports = EmberFlight; else root.EmberFlight = EmberFlight;
})(typeof window != 'undefined' ? window : this);
