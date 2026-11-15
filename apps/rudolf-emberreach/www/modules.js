/* ===== Ember Reach: a ship's modules, their health and what breaks (docs/plan-ember-reach.md, "Modules and
   damage").
   Every ship carries the same core modules, each with its own health pool, shown on the internal-systems HUD.
   A module at zero health is inoperable until it's repaired:
   - power plant: everything powered goes dark (no thrust, no turning, no jump);
   - engines (main drive), RCS, ACS: that thrust is gone; flight assist flies on what's left (flight.js);
   - hyperspace drive: no jumps;
   - canopy: the pilot feels g-forces. While the canopy holds, its field takes them and the pilot feels none.
   - shields: no shields; sensors: no scanner; weapons: no guns or missiles (combat.js, play.js);
   - cargo hatch (ships with a hold): stuck open, so the ship is held to its scooping trim and the hold spills a
     tonne at a time (canisters.js); landing gear: every touchdown a belly landing (landing.js); life support: the
     pilot breathes the unit's reserve (below).
   Oxygen (0.3.6): the life support unit keeps a reserve, 15 minutes with a stock (grade C) unit and longer with a
   better one (outfit.js lifeK: B 24 minutes, A 33). It is drawn on whenever the unit can't supply the cabin: the unit broken, the
   power plant down, a reboot under way, or the canopy broken (the air goes out of it); with the unit working and the
   canopy whole it fills again in 2 minutes. At empty the pilot is lost.
   Reboot (0.3.6, on the radial menu): 20 seconds with the weapons, the thrusters and the life support off. At the
   end every inoperable module comes back to working order (a tenth of its pool, or what can be found), paid for by
   a little health taken from many of the working ones at random: at most 4% of each one's pool (a point on the smallest), never leaving one
   at less than a point.
   A broken module raises a HUD alert: the ship's side profile, top left, with the module flashing, and a console
   line "<module> inoperable" under a warning triangle: orange, or red for the critical modules (power plant,
   engines, hyperspace drive).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
/* id, name, share of the hull's points as the module's health, critical, which ships carry it */
const MODULES = [
	{id: 'power', name: 'Power plant', share: 0.16, critical: true},
	{id: 'engines', name: 'Engines', share: 0.14, critical: true},
	{id: 'jump', name: 'Hyperspace drive', share: 0.12, critical: true},
	{id: 'canopy', name: 'Canopy', share: 0.06},
	{id: 'rcs', name: 'RCS thrusters', share: 0.08},
	{id: 'acs', name: 'ACS thrusters', share: 0.08},
	{id: 'shields', name: 'Shield generator', share: 0.1},
	{id: 'life', name: 'Life support', share: 0.08},
	{id: 'sensors', name: 'Sensors', share: 0.06},
	{id: 'weapons', name: 'Weapons', share: 0.06, needs: s => s.hard && s.hard.some(n => n > 0)},
	{id: 'hatch', name: 'Cargo hatch', share: 0.06, needs: s => s.cargo > 0},
	/* (landing L1.2) broken, every touchdown is a belly landing */
	{id: 'gear', name: 'Landing gear', share: 0.04}];
const O2 = {reserve: 900, refill: 120, warn: [300, 60]};
const COLORS = {warning: '#f2a33a', critical: '#e5484d'};
const G0 = 9.81;

/* a ship's modules at full health: each pool is a share of the hull's points, at least 10 */
function fit(ship) {
	return {ship: ship.id, modules: MODULES.filter(m => !m.needs || m.needs(ship)).map(m => {
		const max = Math.max(10, Math.round(ship.hull * m.share));
		return {id: m.id, name: m.name, critical: !!m.critical, hp: max, max};
	}), o2: O2.reserve * (ship.lifeK || 1), o2Max: O2.reserve * (ship.lifeK || 1), reboot: 0};
}
const get = (f, id) => f.modules.find(m => m.id == id);
/* (what a reboot switches off while it runs) */
const REBOOT = {time: 20, restore: 0.1, take: 0.04, off: ['weapons', 'engines', 'rcs', 'acs', 'life']};
const works = (f, id) => { if (f.reboot > 0 && REBOOT.off.includes(id)) return false; const m = get(f, id); return !m || m.hp > 0 };
const inoperable = f => f.modules.filter(m => m.hp <= 0);

/* damage a module; returns its alert if this broke it */
function damage(f, id, amount) {
	const m = get(f, id);
	if (!m || amount <= 0) return null;
	const was = m.hp > 0;
	m.hp = Math.max(0, m.hp - amount);
	return was && m.hp <= 0 ? alertFor(m) : null;
}
/* a hit on the ship: lands on one module, chosen by its size (share), from a random number in [0, 1) */
function hit(f, amount, rnd) {
	const total = f.modules.reduce((t, m) => t + m.max, 0);
	let x = (rnd == null ? Math.random() : rnd) * total;
	const m = f.modules.find(m => (x -= m.max) < 0) || f.modules[f.modules.length - 1];
	return {module: m.id, alert: damage(f, m.id, amount)};
}
function repair(f, id, amount) {
	for (const m of f.modules) if (!id || m.id == id) m.hp = Math.min(m.max, m.hp + (amount == null ? m.max : amount));
}

/* the HUD alert for a broken module */
function alertFor(m) {
	const level = m.critical ? 'critical' : 'warning';
	return {module: m.id, text: m.name + ' inoperable', level, icon: 'triangle', color: COLORS[level], flash: m.id};
}
/* every alert standing, critical first */
function alerts(f) {
	return inoperable(f).map(alertFor).sort((a, b) => (b.level == 'critical') - (a.level == 'critical'));
}

/* what the ship can still do; sets the flight state's thruster output (flight.js reads s.output) */
function status(f) {
	const power = works(f, 'power');
	return {
		output: {main: power && works(f, 'engines') ? 1 : 0, rcs: power && works(f, 'rcs') ? 1 : 0, acs: power && works(f, 'acs') ? 1 : 0},
		jump: power && works(f, 'jump'), shields: power && works(f, 'shields'), sensors: power && works(f, 'sensors'),
		weapons: power && works(f, 'weapons'), lifeSupport: power && works(f, 'life'), canopy: works(f, 'canopy')};
}
function apply(f, flightState) { const st = status(f); flightState.output = st.output; return st }

/* the reboot's bill: which inoperable modules come back, and what each working one gives for it. Critical modules
   are served first, each to a point (working), then on to a tenth of its pool; the points come a few at a time from
   working modules picked at random (rnd: [0, 1)), so the cost is spread thin. Changes nothing: apply with reboot */
function rebootPlan(f, rnd) {
	rnd = rnd || Math.random;
	const broken = f.modules.filter(m => m.hp <= 0).sort((a, b) => b.critical - a.critical);
	const donors = f.modules.filter(m => m.hp > 0).map(m => ({m, cap: Math.max(0, Math.min(Math.max(1, Math.floor(m.max * REBOOT.take)), Math.ceil(m.hp - 1)))})).filter(d => d.cap > 0);
	const got = new Map(broken.map(m => [m.id, 0])), taken = {};
	const draw = () => { const live = donors.filter(d => d.cap > 0); if (!live.length) return false; const d = live[Math.floor(rnd() * live.length) % live.length]; d.cap--; taken[d.m.id] = (taken[d.m.id] || 0) + 1; return true };
	/* a point each first (working order), then the rest of the tenth */
	for (const m of broken) { if (!draw()) break; got.set(m.id, 1) }
	for (const m of broken) { const want = Math.max(1, Math.ceil(m.max * REBOOT.restore)); while (got.get(m.id) > 0 && got.get(m.id) < want && draw()) got.set(m.id, got.get(m.id) + 1) }
	return {restored: broken.filter(m => got.get(m.id) > 0).map(m => ({id: m.id, name: m.name, hp: got.get(m.id)})), short: broken.filter(m => !got.get(m.id)).map(m => m.id), taken};
}
/* a reboot: start it (20 s), and step it; at the end the plan is paid and the modules come back */
function startReboot(f) { if (f.reboot > 0) return false; f.reboot = REBOOT.time; return true }
function stepReboot(f, dt, rnd) {
	if (!(f.reboot > 0)) return null;
	f.reboot = Math.max(0, f.reboot - dt);
	if (f.reboot > 0) return null;
	const plan = rebootPlan(f, rnd);
	for (const [id, n] of Object.entries(plan.taken)) get(f, id).hp -= n;
	for (const r of plan.restored) get(f, r.id).hp = r.hp;
	return plan;
}
/* oxygen: the reserve drawn while the unit can't supply the cabin, refilled while it can. Returns {o2, draining,
   warn (300 or 60 when it falls past one), out} */
function breathe(f, dt) {
	if (f.o2Max == null) { f.o2Max = O2.reserve; f.o2 = O2.reserve }
	const st = status(f), supply = st.lifeSupport && st.canopy, was = f.o2;
	f.o2 = supply ? Math.min(f.o2Max, f.o2 + dt * f.o2Max / O2.refill) : Math.max(0, f.o2 - dt);
	const warn = O2.warn.find(w => was > w && f.o2 <= w) || null;
	return {o2: f.o2, draining: !supply, warn, out: f.o2 <= 0};
}

/* g-forces: the thrust a step used (flight.js's result), and what the pilot feels: nothing while the canopy holds */
function gForce(f, stepResult) {
	const a = stepResult.aThrust || stepResult.aWorld, g = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) / G0;
	return {g, felt: works(f, 'canopy') ? 0 : g};
}

const EmberModules = {MODULES, COLORS, O2, REBOOT, rebootPlan, startReboot, stepReboot, breathe, fit, get, works, inoperable, damage, hit, repair, alerts, alertFor, status, apply, gForce};
if (typeof module != 'undefined') module.exports = EmberModules; else root.EmberModules = EmberModules;
})(typeof window != 'undefined' ? window : this);
