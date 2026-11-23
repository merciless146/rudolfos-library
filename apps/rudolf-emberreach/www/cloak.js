/* ===== Ember Reach: the Precursor cloaking device (docs/plan-ember-reach-pilots.md, P4; 0.5.9).
   - Got only by finishing the main questline with Hardcore on (the M6 link calls award(); until M6 is built, only
     the tests do). One per pilot, for good: P.cloak marks it as theirs.
   - A utility module (outfit.js 'cloak'): fitted in any utility mount, taken out again (it stays theirs, unfitted:
     never stored, sold, traded in or recycled). In one ship at a time: fitted in a stored ship, it's aboard that one.
     Insurance gives it back with the ship (it's part of the fit).
   - Toggled on (the Cloak key, 3, or the radial menu), the ship:
     - is hidden from other ships: AI ships lose their target, missiles lose their lock, a lock being built is lost;
     - is drawn almost wholly transparent (the pilot sees their own ship as a faint ghost in third person);
     - builds heat: +0.15 a second, against the usual cooling of 0.12, so about 30 s of cloak from cold. At overheat
       the cloak fails, and the usual heat rules apply.
   - Firing, launching a missile or being hit shows the ship for 3 s.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const O = req('outfit.js', 'EmberOutfit');
const CLOAK = {heat: 0.15, reveal: 3, overheat: 1, alpha: 0.16};
const owned = P => !!(P && P.cloak);
const fitted = fit => !!fit && (fit.utility || []).some(m => m && m.id == 'cloak');
/* where it is: 'ship' (fitted in the ship flown), a stored ship's id, 'free' (theirs, unfitted), or null (not theirs) */
function where(P) {
	if (!owned(P)) return null;
	if (fitted(P.ship && P.ship.fit)) return 'ship';
	const h = (P.hangar || []).find(x => x.ship && fitted(x.ship.fit));
	return h ? h.id : 'free';
}
/* the award (the main questline finished with Hardcore on): theirs for good, fitted in a free utility mount if
   the ship flown has one. False if they have it already */
function award(P, day) {
	if (owned(P)) return false;
	P.cloak = {day: day || 0};
	const fit = P.ship && P.ship.fit, i = fit ? fit.utility.findIndex(m => !m) : -1;
	if (i >= 0) fit.utility[i] = {id: 'cloak', grade: 'P'};
	return true;
}
/* fitting it in mount i of this fit (the outfitter): it must be theirs and free; what was there goes back to the caller */
function fitInto(P, fit, i) {
	if (where(P) != 'free') return {ok: false, why: owned(P) ? 'The cloaking device is fitted already.' : 'No cloaking device.'};
	if (!fit || i < 0 || i >= fit.utility.length) return {ok: false, why: 'No such mount.'};
	const old = fit.utility[i]; fit.utility[i] = {id: 'cloak', grade: 'P'};
	return {ok: true, old};
}
/* taking it out: back to the pilot, unfitted (never into storage) */
function takeOut(fit) {
	const i = fit ? fit.utility.findIndex(m => m && m.id == 'cloak') : -1;
	if (i < 0) return false;
	fit.utility[i] = null; return true;
}
/* a ship leaving the pilot (traded in, sold from storage): the cloak stays theirs, unfitted (modules are copied in
   place: the fit given is changed) */
const strip = fit => takeOut(fit);
/* the flight state: on, and shown until (a time: firing, a launch or a hit) */
const state = () => ({on: false, until: 0});
function toggle(st, cs, fit, t) {
	if (st.on) { st.on = false; return {ok: true, on: false} }
	if (!fitted(fit)) return {ok: false, why: 'No cloaking device fitted.'};
	if (cs && (cs.hot || cs.heat >= CLOAK.overheat)) return {ok: false, why: 'Too hot to cloak.'};
	st.on = true; st.until = 0;
	return {ok: true, on: true};
}
/* every step, after combat's tick: the heat it builds; at overheat it fails. Returns 'failed' then */
function step(st, cs, fit, dt) {
	if (!st.on) return null;
	if (!fitted(fit)) { st.on = false; return 'lost' }
	cs.heat += CLOAK.heat * dt;
	if (cs.heat >= CLOAK.overheat) { st.on = false; cs.hot = true; return 'failed' }   /* (overheated: the usual rules, the guns locked until it cools) */
	return null;
}
const hidden = (st, t) => !!st && st.on && t >= st.until;
/* fired, launched or hit: shown for 3 s */
function reveal(st, t) { if (st && st.on) st.until = Math.max(st.until, t + CLOAK.reveal) }

const EmberCloak = {CLOAK, owned, fitted, where, award, fitInto, takeOut, strip, state, toggle, step, hidden, reveal};
if (isNode) module.exports = EmberCloak; else root.EmberCloak = EmberCloak;
})(typeof window != 'undefined' ? window : globalThis);
