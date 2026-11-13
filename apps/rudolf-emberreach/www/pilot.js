/* ===== Ember Reach: the pilot's body under g (docs/plan-ember-reach.md, "Modules and damage", g-forces).
   While the canopy holds, the pilot feels nothing (modules.js: gForce). Once it breaks, every g the thrusters pull
   lands on the pilot, and strain builds above a threshold:
   1. the view blurs;
   2. it goes dark from the edges inward;
   3. the pilot blacks out (g-LOC). The controls stop answering: stick, throttle, everything. The stick goes
      neutral, and the throttle stays where it was, so a ship with flight assist on flies straight on at that
      speed, and one with it off keeps tumbling.
   Ease off (or let FA ease off, once the stick is neutral) and the strain falls. The pilot comes round once it has
   fallen far enough and they have been out for a few seconds; sight then clears as the strain keeps falling.
   Values are starting points for playtests.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const PILOT = {
	onset: 4,       /* g felt before strain builds */
	build: 16,      /* strain per second = (g - onset) / build: 8 g blacks out in 4 s, 12 g in 2 s, 35 g in 0.5 s */
	recover: 0.15,  /* strain lost per second below the onset: a 4 s blackout leaves the pilot waking groggy */
	blur: [0.15, 0.6],  /* strain at which blur starts and is full */
	dark: [0.35, 1],    /* strain at which the edges start to darken, and the view is black */
	wake: 0.5,      /* strain the pilot must fall below to come round */
	out: 4          /* the fewest seconds a blackout lasts */
};
const ramp = (x, [a, b]) => x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);

function create() { return {strain: 0, conscious: true, outFor: 0, held: null} }

/* one step with the g the pilot feels (modules.js gForce(...).felt); returns what the view and controls show */
function step(p, felt, dt) {
	if (felt > PILOT.onset) p.strain = Math.min(1, p.strain + (felt - PILOT.onset) / PILOT.build * dt);
	else p.strain = Math.max(0, p.strain - PILOT.recover * dt);
	if (p.conscious && p.strain >= 1) { p.conscious = false; p.outFor = 0 }
	else if (!p.conscious) { p.outFor += dt; if (p.strain < PILOT.wake && p.outFor >= PILOT.out) { p.conscious = true; p.held = null } }
	return view(p);
}
/* the view: blur 0..1, darkness from the edges 0..1 (1 = black), and whether the pilot is out */
function view(p) {
	return {blur: ramp(p.strain, PILOT.blur), dark: p.conscious ? ramp(p.strain, PILOT.dark) : 1, conscious: p.conscious, strain: p.strain};
}
/* the controls the ship actually gets: the pilot's while awake; while out, a neutral stick and the last throttle */
function controls(p, input) {
	input = input || {};
	if (p.conscious) { p.held = {throttle: input.throttle, thrust: input.thrust}; return input }
	const h = p.held || {};
	return {throttle: h.throttle, thrust: h.thrust};
}

const EmberPilot = {PILOT, create, step, view, controls};
if (typeof module != 'undefined') module.exports = EmberPilot; else root.EmberPilot = EmberPilot;
})(typeof window != 'undefined' ? window : this);
