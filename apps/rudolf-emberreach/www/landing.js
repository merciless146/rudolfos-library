/* ===== Ember Reach: landing, the rules (docs/plan-ember-reach-landing.md; brought in from the draft in
   wip/emberreach-surface/surface.js in L1.1, which now takes them from here).
   - Which worlds can be landed on: airless (no heat shield, nothing to glide on), solid (no gas giants), neither
     molten nor so cold the gear won't work, and no heavier than 2.5 g. Moons count: they're most of the landable
     ground there is.
   - Which ship can manage a world: its lift is its vertical thrusters, and every hull has landing jets that hold it
     up at 1.5 g at least; it needs half again the world's gravity to land.
   - Touchdown: the gear takes it if it comes down slowly enough, upright enough. A little past the limits is a
     hard landing (hull damage growing with the excess); three times past them is a crash.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const Fl = typeof module != 'undefined' ? require('./flight.js') : root.EmberFlight;
const G0 = 9.81;
/* gMax: the heaviest world any hull lands on; tsMax / tsMin: surface temperature (K); twr: lift needed, in the
   world's gravity; lift: the landing jets' floor, in g */
const LAND = {gMax: 2.5, tsMax: 700, tsMin: 30, twr: 1.5, gear: 2.5, lift: 1.5};
/* p: a world (galaxy.js's planet or moon, or a scene body's src) */
function landable(p) {
	if (!p || p.gas || p.atmo || p.bars > 0) return {ok: false, why: p && p.gas ? 'A gas giant: no surface' : 'An atmosphere: no heat shield, no landing (yet)'};
	if (p.Ts > LAND.tsMax) return {ok: false, why: 'Molten: the surface is ' + Math.round(p.Ts) + ' K'};
	if (p.Ts < LAND.tsMin) return {ok: false, why: 'Too cold for the gear'};
	if (p.g > LAND.gMax) return {ok: false, why: 'Gravity ' + p.g.toFixed(1) + ' g: no hull lands there'};
	return {ok: true};
}
/* a ship's lift (m/s²): its vertical thrusters, or the landing jets' 1.5 g if those are stronger */
const lift = ship => Math.max(Fl.spec(ship).aRcs, LAND.lift * G0);
function canLand(ship, p) {
	const l = landable(p); if (!l.ok) return l;
	const a = lift(ship), need = LAND.twr * p.g * G0;
	if (a < need) return {ok: false, why: 'Too heavy for this world: lift ' + (a / G0).toFixed(1) + ' g against ' + (need / G0).toFixed(1) + ' g needed'};
	return {ok: true, margin: a / (p.g * G0), pad: padFor(ship.size)};
}
/* the heaviest world a ship can land on (surface gravity in g) */
const maxG = ship => Math.min(LAND.gMax, lift(ship) / G0 / LAND.twr);
/* the pad a ship uses: XS ships the S pads, capital ships the heavy fields' berths */
const padFor = size => size == 'XS' ? 'S' : size == 'Capital' ? 'C' : size;
/* the limits by pad size: vertical speed (m/s), sideways speed (m/s), tilt (degrees) */
const TOUCH = {S: {vz: 4, vh: 2.5, tilt: 12}, M: {vz: 3, vh: 2, tilt: 9}, L: {vz: 2, vh: 1.5, tilt: 6}, XL: {vz: 1.5, vh: 1, tilt: 5}, C: {vz: 1, vh: 0.8, tilt: 4}};
function touchdown(size, vz, vh, tilt) {
	const T = TOUCH[padFor(size)] || TOUCH.L, x = Math.max(Math.abs(vz) / T.vz, vh / T.vh, tilt / T.tilt);
	if (x <= 1) return {ok: true, damage: 0, x};
	if (x >= 3) return {ok: false, crash: true, x};
	return {ok: true, hard: true, damage: (x - 1) * (x - 1) * 0.15, x};   /* a share of the hull */
}
/* ---------- contact (L1.2) ----------
   The ship's lowest point below its centre (m): its gear when down and working (it stands 12% of its length below
   the belly), its belly when not, and its nose when pitched past 45° (half its length times the pitch's sine) */
const GEAR = {belly: 0.18, legs: 0.12, auto: {down: 300, up: 500}, vmax: 100};
function lowest(ship, gear, pitch) {
	const Lm = ship.length || 20, belly = GEAR.belly * Lm, onGear = !!gear;
	const nose = Math.abs(pitch) > 45 ? 0.5 * Lm * Math.sin(Math.abs(pitch) * Math.PI / 180) : 0;
	const g = onGear ? belly + GEAR.legs * Lm : belly;
	return nose > g ? {d: nose, part: 'nose'} : {d: g, part: onGear ? 'gear' : 'belly'};
}
/* first contact: how it goes. Anything but the gear touching counts as three times past the limits. sf: the
   surface state (scene.js): vz, vh, tilt (degrees off upright) */
function contact(ship, sf, gear) {
	const low = lowest(ship, gear, sf.pitch), k = low.part == 'gear' ? 1 : 3;
	const out = touchdown(ship.size, Math.abs(sf.vz) * k, sf.vh * k, sf.tilt * k);
	return Object.assign(out, {part: low.part});
}

/* the target card's line for a world: "Landable · 0.30 g · lift 9.4 g", or why not */
function card(ship, p) {
	const c = canLand(ship, p);
	return c.ok ? {ok: true, line: 'Landable · ' + p.g.toFixed(2) + ' g · lift ' + (lift(ship) / G0).toFixed(1) + ' g'} : {ok: false, line: 'Not landable: ' + c.why.replace(/^./, x => x.toLowerCase())};
}

const EmberLanding = {G0, LAND, TOUCH, GEAR, landable, lift, canLand, maxG, padFor, touchdown, card, lowest, contact};
if (typeof module != 'undefined') module.exports = EmberLanding; else root.EmberLanding = EmberLanding;
})(typeof window != 'undefined' ? window : globalThis);
