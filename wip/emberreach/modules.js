/* ===== Ember Reach: a ship's modules, their health and what breaks (docs/plan-ember-reach.md, "Modules and
   damage").
   Every ship carries the same core modules, each with its own health pool, shown on the internal-systems HUD.
   A module at zero health is inoperable until it's repaired:
   - power plant: everything powered goes dark (no thrust, no turning, no jump);
   - engines (main drive), RCS, ACS: that thrust is gone; flight assist flies on what's left (flight.js);
   - hyperspace drive: no jumps;
   - canopy: the pilot feels g-forces. While the canopy holds, its field takes them and the pilot feels none.
   - shields, sensors, weapons, life support, cargo hold: their own effects arrive with M4.
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
	{id: 'cargo', name: 'Cargo hold', share: 0.06, needs: s => s.cargo > 0}];
const COLORS = {warning: '#f2a33a', critical: '#e5484d'};
const G0 = 9.81;

/* a ship's modules at full health: each pool is a share of the hull's points, at least 10 */
function fit(ship) {
	return {ship: ship.id, modules: MODULES.filter(m => !m.needs || m.needs(ship)).map(m => {
		const max = Math.max(10, Math.round(ship.hull * m.share));
		return {id: m.id, name: m.name, critical: !!m.critical, hp: max, max};
	})};
}
const get = (f, id) => f.modules.find(m => m.id == id);
const works = (f, id) => { const m = get(f, id); return !m || m.hp > 0 };
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

/* g-forces: the thrust a step used (flight.js's result), and what the pilot feels: nothing while the canopy holds */
function gForce(f, stepResult) {
	const a = stepResult.aWorld, g = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) / G0;
	return {g, felt: works(f, 'canopy') ? 0 : g};
}

const EmberModules = {MODULES, COLORS, fit, get, works, inoperable, damage, hit, repair, alerts, alertFor, status, apply, gForce};
if (typeof module != 'undefined') module.exports = EmberModules; else root.EmberModules = EmberModules;
})(typeof window != 'undefined' ? window : this);
