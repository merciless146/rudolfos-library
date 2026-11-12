/* ===== Ember Reach: the save (gamekit keeps one JSON value per game: RG.save / RG.load).
   Version 1 holds where the player is (whose system, which port, the day), the ship (its design, where it is and
   how it's moving, flight assist, the throttle, each module's health), whether it's docked, and the settings.
   unpack() checks everything, and gives null for anything it can't trust (another version, a damaged file), so a
   bad save starts a new game instead of breaking one.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const VERSION = 1;
const num = x => typeof x == 'number' && isFinite(x);
const vec = (x, n) => Array.isArray(x) && x.length == n && x.every(num);

/* g: {power, port, ship (id), day, t, docked, pad, s (flight state), fa, throttle, fit (modules.js), settings} */
function pack(g) {
	const r = v => v.map(x => +x.toPrecision(15));
	return {v: VERSION, power: g.power, port: g.port, ship: g.ship, day: g.day, t: +g.t.toFixed(3), docked: !!g.docked, pad: g.pad || null,
		p: r(g.s.p), vel: r(g.s.v), q: r(g.s.q), w: r(g.s.w), fa: !!g.s.fa, throttle: +(+g.throttle || 0).toFixed(3),
		modules: Object.fromEntries(g.fit.modules.map(m => [m.id, +m.hp.toFixed(2)])),
		settings: {quality: g.settings.quality == 'low' ? 'low' : 'high', sound: g.settings.sound !== false}};
}
/* the save checked against what this game knows: ships (ids), ports (class names), powers (how many) */
function unpack(raw, known) {
	if (!raw || typeof raw != 'object' || raw.v !== VERSION) return null;
	const k = known || {};
	if (!Number.isInteger(raw.power) || raw.power < 0 || (k.powers && raw.power >= k.powers)) return null;
	if (typeof raw.port != 'string' || (k.ports && k.ports.indexOf(raw.port) < 0)) return null;
	if (typeof raw.ship != 'string' || (k.ships && k.ships.indexOf(raw.ship) < 0)) return null;
	if (!num(raw.day) || !num(raw.t) || raw.t < 0) return null;
	if (!vec(raw.p, 3) || !vec(raw.vel, 3) || !vec(raw.q, 4) || !vec(raw.w, 3)) return null;
	const qn = Math.hypot(...raw.q); if (qn < 0.5 || qn > 1.5) return null;
	if (!raw.modules || typeof raw.modules != 'object' || Object.values(raw.modules).some(h => !num(h) || h < 0)) return null;
	const set = raw.settings || {};
	return {power: raw.power, port: raw.port, ship: raw.ship, day: raw.day, t: raw.t, docked: !!raw.docked, pad: Number.isInteger(raw.pad) ? raw.pad : null,
		p: raw.p, v: raw.vel, q: raw.q.map(c => c / qn), w: raw.w, fa: raw.fa !== false, throttle: num(raw.throttle) ? Math.max(-1, Math.min(1, raw.throttle)) : 0,
		modules: raw.modules, settings: {quality: set.quality == 'low' ? 'low' : 'high', sound: set.sound !== false}};
}
/* put saved module health back on a fresh fit (unknown modules are ignored; health never above the pool) */
function restoreModules(fit, saved) {
	for (const m of fit.modules) if (saved && typeof saved[m.id] == 'number') m.hp = Math.max(0, Math.min(m.max, saved[m.id]));
	return fit;
}

const EmberSave = {VERSION, pack, unpack, restoreModules};
if (typeof module != 'undefined') module.exports = EmberSave; else root.EmberSave = EmberSave;
})(typeof window != 'undefined' ? window : this);
