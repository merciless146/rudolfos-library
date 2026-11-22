/* ===== Ember Reach: the Contraband Merchant (docs/plan-ember-reach-pilots.md, P3; 0.5.7).
   - Where: a contact at a great power's major starports (Contacts): its system ports and capitals (lantern, halo)
     and its large surface starports. Not outposts, settlements, colonies' ports or the Rift's anchorages.
   - Who: a pilot with Hardcore on, or finished (career.js hcPerks). Turned off by hand, the merchant is gone, and
     the pilot keeps what they bought.
   - What: contraband variants of weapons and of core and internal modules (the ones with numbers to raise), about
     a fifth stronger than the ordinary module of the same grade (outfit.js kOf: shields, hull, range, power and
     the core modules' figures; a weapon's damage), priced at 1.6 times. Never as strong as Precursor work: an A
     grade's 1.3 becomes 1.56, under the Precursor's 1.6, and a contraband gun hits under a Precursor one. A
     contraband gatling is still ballistic: no heat.
   - Stock: six pieces, drawn from the port and the week (galaxy time), each sold once a week. Core modules come
     sized for the pilot's ship, internal ones no bigger than its largest slot.
   - Bound to the pilot for good: never sold, traded in, recycled or given; fitted, taken off, stored and sent
     between the pilot's own ports like anything else. Not illegal: nobody minds carrying it.
   - Insurance: while Hardcore is on it isn't covered (left out of the ship's value); once off, its premium is
     twice its ordinary counterpart's. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy'), F = req('factions.js', 'EmberFactions'), O = req('outfit.js', 'EmberOutfit'), Ca = req('career.js', 'EmberCareer');
const CB = O.CB;   /* {k: 1.2, price: 1.6} (outfit.js: a variant's numbers and price) */
const MERCHANT = {stock: 6, week: 7, premium: 2, kinds: ['halo', 'lantern', 'starport']};
/* what the merchant can offer: weapons and the modules with figures to raise (not racks, refineries, the autopilot,
   tractors, missile racks or utilities; never ruins or Precursor work) */
const NOT = new Set(['cargo', 'refinery', 'autopilot', 'tractor', 'missile']);
const IDS = Object.keys(O.CAT).filter(id => { const c = O.CAT[id]; return c.cat != 'utility' && !c.ruins && !c.precursor && !NOT.has(id) });
const is = m => !!(m && m.cb);
/* the pilot sees the merchant */
const sees = P => Ca.hcPerks(P);
/* this port has one: a great power's major starport */
function atPort(port, holder) {
	if (!port || port.colony || port.anchorage) return false;
	const k = port.surface ? port.kind : port.cls, m = holder && F.byId(holder);
	return MERCHANT.kinds.includes(k) && !!m && m.kind == 'major';
}
const weekOf = day => Math.floor((day || 0) / MERCHANT.week);
const portKey = (starId, port) => starId + '|' + ((port && port.id) || 'orbital');
/* this week's stock here, for this ship: [{key, id, size, grade, cb: 1, price (SU), sold}] */
function offers(P, port, starId, ship, day) {
	const L = O.layout(ship), w = weekOf(day), rnd = G.rng(G.hashStr('contraband:' + portKey(starId, port) + ':' + w)), out = [];
	const bigInt = Math.max(0, ...L.internal), bigExt = Math.max(0, ...L.external);
	const fits = id => { const c = O.CAT[id]; return c.cat == 'core' ? L.core.includes(id) : c.cat == 'internal' ? c.sizes[0] <= bigInt : c.sizes[0] <= bigExt };
	const pool = IDS.filter(fits); if (!pool.length) return out;
	const bought = P.contraband && P.contraband.w == w ? P.contraband.got || [] : [];
	for (let i = 0; i < MERCHANT.stock; i++) {
		const id = pool[Math.floor(rnd() * pool.length)], c = O.CAT[id], gr = c.grades, r = rnd();
		const grade = gr.length == 1 ? gr : r < 0.3 ? 'C' : r < 0.7 ? 'B' : 'A';
		const size = c.cat == 'core' ? L.coreSize : c.cat == 'internal' ? c.sizes[0] + Math.floor(rnd() * (Math.min(c.sizes[1], bigInt) - c.sizes[0] + 1)) : c.sizes[0];
		const m = {id, size, grade, cb: 1}, key = portKey(starId, port) + '#' + i;
		out.push(Object.assign(m, {key, price: O.price(m), sold: bought.includes(key)}));
	}
	return out;
}
/* buying one: the module, bound to this pilot (by: the pilot's id), or why not. Payment is the caller's */
function take(P, offer, pilotId, day) {
	if (!sees(P)) return {ok: false, why: 'The merchant deals only with Hardcore pilots.'};
	if (!offer || offer.sold) return {ok: false, why: 'Sold this week.'};
	const w = weekOf(day); if (!P.contraband || P.contraband.w != w) P.contraband = {w, got: []};
	P.contraband.got.push(offer.key);
	return {ok: true, m: {id: offer.id, size: offer.size, grade: offer.grade, cb: 1, by: pilotId || ''}};
}
/* contraband can't leave its pilot: the reason, for a sale, a trade-in, recycling or a gift */
const BOUND = 'Contraband is bound to you for good: it can\'t be sold, traded in or recycled. Take it out and store it instead.';
/* a ship leaving the pilot (traded in, or sold from storage): its contraband taken off first, into storage at
   place. Returns the modules moved (the fit is changed in place: core slots keep an ordinary C-grade module) */
function strip(fit, place) {
	const moved = [];
	if (!fit) return moved;
	for (const k of Object.keys(fit.core || {})) { const m = fit.core[k]; if (is(m)) { moved.push(m); fit.core[k] = {id: m.id, size: m.size, grade: 'C'} } }
	for (const cat of ['internal', 'external', 'utility']) (fit[cat] || []).forEach((m, i) => { if (is(m)) { moved.push(m); fit[cat][i] = null } });
	return moved.map(m => Object.assign({}, m, {at: Object.assign({}, place), ready: 0}));
}
/* how contraband counts in a ship's value for insurance: nothing while Hardcore is on, twice its ordinary
   counterpart's after (outfit.js extra's modes) */
const insureMode = P => Ca.hcOf(P) == 'on' ? 'hc' : 'insure';

const EmberContraband = {MERCHANT, IDS, is, sees, atPort, weekOf, offers, take, BOUND, strip, insureMode};
if (isNode) module.exports = EmberContraband; else root.EmberContraband = EmberContraband;
})(typeof window != 'undefined' ? window : globalThis);
