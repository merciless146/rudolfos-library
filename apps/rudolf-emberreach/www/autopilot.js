/* ===== Ember Reach: the Autopilot Computer (0.3.6) =====
   A small internal module (size 1, light draw: outfit.js). It flies three things, each as inputs for flight assist
   (flight.js) or for cruise (scene.js cruiseStep), so it flies the ship the way a pilot would, with the same limits:
   - cruise assist: in supercruise it turns the nose onto the navigation target and sets the speed so the ship
     arrives at the edge of the target's mass lock (a port's 10 km, a world's lock height) slowly enough to drop out
     safely;
   - docking in space: with a clearance it flies out round the port if it has to, onto the axis in front of the
     mouth, and in along it, nose first, turning with the port;
   - docking on the ground: with a clearance it flies to the pad, down a glide slope to a hover above it, and lets
     down onto it under the touchdown limits (landing.js TOUCH).
   Touching the stick hands control back (play.js); N engages it again. NPC traffic flies in and out the same way
   (0.3.11: they always carry one), and leaves with departStation and departGround.
   Body axes (flight.js): +z the nose, +y up, +x right; +pitch puts the nose down, +yaw to the right, +roll left.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const Fl = typeof require != 'undefined' ? require('./flight.js') : root.EmberFlight;
const AP = {
	gain: 2.2,                    /* turn rate asked per radian off (1/s) */
	cruise: {T: 2.5, floor: 0.06, align: 0.3, slowAlign: 0.04, margin: 1.03},
	dock: {side: 1200, stand: 1500, line: 400, onAxis: 6, cone: 0.05, final: 30, through: 60, lateral: 0.6, cap: 0.45},
	ground: {hover: 350, slope: 0.2, over: 6, cap: 90, vzMax: 30, settle: 0.6}};

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a));
const norm = a => { const l = len(a) || 1; return mul(a, 1 / l) };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* turning: stick inputs that bring the nose onto fwd (and, given one, the ship's up onto up); off is the angle left */
function attitude(s, fwd, up) {
	const e = Fl.toBody(s.q, norm(fwd)), r = s.spec.rates, k = AP.gain;
	const yawA = Math.atan2(e[0], e[2]), pitchA = -Math.atan2(e[1], e[2]);
	let roll = 0;
	if (up) { const u = Fl.toBody(s.q, norm(up)); if (Math.hypot(u[0], u[1]) > 0.2) roll = clamp(-k * Math.atan2(u[0], u[1]) / r[2], -1, 1) }
	return {pitch: clamp(k * pitchA / r[0], -1, 1), yaw: clamp(k * yawA / r[1], -1, 1), roll, off: Math.acos(clamp(e[2], -1, 1))};
}
/* flight assist's inputs for a velocity wanted in space (world, m/s), in the frame flight is flying in */
function velocityInput(s, vAbs, frame) {
	const rel = sub(vAbs, Fl.frameAt(frame, s.p).v), b = Fl.toBody(s.q, rel), S = s.spec;
	return {throttle: clamp(b[2] / S.vmax, -Fl.TUNE.strafe, 1), strafe: [clamp(b[0] / S.vStrafe, -1, 1), clamp(b[1] / S.vStrafe, -1, 1)]};
}
/* the speed to fly at towards a point dist away that should be reached slowly: what braking at a share of the
   thrust allows, and no more than cap */
function approachSpeed(s, dist, cap, end) {
	const a = Math.max(1, Math.min(s.spec.aRetro, s.spec.aRcs) * 0.5);
	return Math.min(cap, (end || 0) + Math.sqrt(2 * a * Math.max(0, dist)), (end || 0) + dist * 0.5);
}

/* ---- cruise assist: steer at the target, and the speed to arrive with: rem is the distance left to the drop point
   (m), lim the cruise speed allowed here (scene.js cruiseLimit). Returns cruise inputs and the angle off */
function cruise(s, targetPos, rem, lim) {
	const A = attitude(s, sub(targetPos, s.p)), C = AP.cruise;
	let thr = clamp(Math.max(0, rem) / C.T / Math.max(1, lim), C.floor, 1);
	/* well off the line, ease off while the nose comes round (cruise turns at half rates) */
	if (A.off > C.align) thr = Math.min(thr, C.slowAlign);
	return {pitch: A.pitch, yaw: A.yaw, roll: 0, throttle: thr, off: A.off};
}

/* ---- docking in space. Sc: scene.js; st the port. Returns the inputs, the stage, and the frame to fly them in:
   space's until the run in (a spinning port's frame would drag the ship round its axis faster than the thrusters
   can hold it, far out), the port's for the run in (to turn with it through the mouth) */
function dockStation(s, st, frame0, Sc) {
	const D = st.def.dock, R = st.def.radius, P = AP.dock, L = Sc.toLocal(st, s.p), rho = Math.hypot(L[0], L[1]);
	const u = rho > 1 ? [L[0] / rho, L[1] / rho] : [1, 0], out = R + P.side;
	let stage, goal, vAbs, fwd;
	/* on the axis in front of the mouth (within a cone that narrows to it, so a little drift doesn't cut the run in
	   short): in; tucked in beside or behind the port: out clear of it; behind its face: round to the front, wide;
	   in front but off the axis: across onto it, well out */
	if (L[2] > D.z - 20 && rho <= P.onAxis + P.cone * Math.max(0, L[2] - D.z)) stage = 'final';
	else if (L[2] < D.z + 200 && rho < R + P.side * 0.5) { stage = 'clear'; goal = [u[0] * out, u[1] * out, L[2]] }
	else if (L[2] < D.z + P.line * 2) { stage = 'round'; goal = [u[0] * out, u[1] * out, D.z + P.stand] }
	else { stage = 'line'; goal = [0, 0, clamp(L[2], D.z + P.line * 2.5, D.z + P.stand)] }
	if (stage == 'final') {
		/* in along the axis at a steady speed, nulling the drift off it */
		const lat = Sc.toWorldDir(st, [-L[0] * P.lateral, -L[1] * P.lateral, 0]);
		const sp = L[2] - D.z > 300 ? Math.min(P.through, approachSpeed(s, L[2] - D.z - 250, s.spec.vmax * P.cap, P.final)) : P.final;
		vAbs = add(lat, mul(st.axis, -sp)); fwd = mul(st.axis, -1);
	} else {
		const g = Sc.toWorldPt(st, goal), d = sub(g, s.p), dist = len(d);
		vAbs = mul(norm(d), approachSpeed(s, dist, s.spec.vmax * P.cap, stage == 'line' ? 0 : 20));
		/* round the port the nose leads; on the line it already looks down the axis, and slides across */
		fwd = stage == 'line' ? mul(st.axis, -1) : dist > 30 ? d : mul(st.axis, -1);
	}
	/* (no roll: in the run in the port's frame carries the ship round with it, and a roll would fight that) */
	const frame = stage == 'final' ? Sc.frame(st) : null, A = attitude(s, fwd), V = velocityInput(s, vAbs, frame);
	return {input: {pitch: A.pitch, yaw: A.yaw, roll: 0, throttle: V.throttle, strafe: V.strafe}, stage, off: A.off, frame};
}

/* ---- docking on the ground. pad: its centre (world), up there, the ground's velocity at the ship (world: the
   world's turn), the touchdown vertical speed allowed (landing.js TOUCH), and the ship's gear height (m) */
function dockGround(s, pad, up, groundV, frame, touchVz, gearH) {
	const G = AP.ground, r = sub(s.p, pad), h = dot(r, up) - (gearH || 0), hv = sub(r, mul(up, dot(r, up))), hd = len(hv);
	let stage, vRel;
	if (hd > G.over) {
		/* across to the pad, down a glide slope to the hover height above it */
		stage = 'approach';
		const want = G.hover + G.slope * hd, vh = approachSpeed(s, hd, G.cap, 0), vz = clamp((want - h) * 0.4, -G.vzMax, G.vzMax);
		vRel = add(mul(norm(hv), -vh), mul(up, vz));
	} else {
		/* over it: down, slowing to the touchdown limit, holding the spot */
		stage = 'descend';
		const vz = -clamp(h * 0.12, touchVz * G.settle, G.vzMax);
		vRel = add(mul(hv, -0.6), mul(up, vz));
	}
	/* level, nose towards the pad while it's some way off (else the heading it has) */
	const f0 = Fl.forward(s), fl = sub(f0, mul(up, dot(f0, up))), fwd = hd > 40 ? mul(hv, -1) : len(fl) > 0.1 ? fl : [up[1], -up[0], 0];
	const A = attitude(s, sub(fwd, mul(up, dot(fwd, up))), up), V = velocityInput(s, add(groundV, vRel), frame);
	return {input: {pitch: A.pitch, yaw: A.yaw, roll: A.roll, throttle: V.throttle, strafe: V.strafe}, stage, h, hd, off: A.off};
}

/* ---- leaving (0.3.11: NPC traffic, flown by the same computer). From a space port: out of the mouth along the
   axis, turning with the port, then away in space's frame. Returns the inputs, the frame, and how far out it is */
function departStation(s, st, Sc) {
	const D = st.def.dock, L = Sc.toLocal(st, s.p), inside = L[2] < D.z + 800;
	const lat = Sc.toWorldDir(st, [-L[0] * 0.4, -L[1] * 0.4, 0]), sp = inside ? 40 : Math.min(s.spec.vmax * 0.6, 40 + (L[2] - D.z - 800) * 0.2);
	const frame = inside ? Sc.frame(st) : null, A = attitude(s, st.axis), V = velocityInput(s, add(inside ? lat : [0, 0, 0], mul(st.axis, sp)), frame);
	return {input: {pitch: A.pitch, yaw: A.yaw, roll: 0, throttle: V.throttle, strafe: V.strafe}, frame, out: L[2] - D.z};
}
/* from a pad on the ground: straight up to 250 m, then away (away: a level direction), climbing */
function departGround(s, pad, up, groundV, frame, away) {
	const r = sub(s.p, pad), h = dot(r, up), aw = norm(sub(away, mul(up, dot(away, up))));
	const vRel = h < 250 ? mul(up, 15) : add(mul(aw, Math.min(150, 20 + (h - 250) * 0.5)), mul(up, 30));
	const A = attitude(s, aw, up), V = velocityInput(s, add(groundV, vRel), frame);
	return {input: {pitch: A.pitch, yaw: A.yaw, roll: A.roll, throttle: V.throttle, strafe: V.strafe}, h};
}

/* has the pilot taken the stick? (keys, a pad, the mouse, the touch stick: what play.js's controls read) */
const touched = (c, thr) => Math.abs(c.pitch) > 0.25 || Math.abs(c.yaw) > 0.25 || Math.abs(c.roll) > 0.25 || Math.abs(c.strafe[0]) > 0.25 || Math.abs(c.strafe[1]) > 0.25 || Math.abs(thr || 0) > 0.25;

const EmberAutopilot = {AP, attitude, velocityInput, approachSpeed, cruise, dockStation, dockGround, departStation, departGround, touched};
if (typeof module != 'undefined') module.exports = EmberAutopilot; else root.EmberAutopilot = EmberAutopilot;
})(typeof window != 'undefined' ? window : this);
