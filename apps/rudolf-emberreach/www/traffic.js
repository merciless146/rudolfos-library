/* ===== Ember Reach: the traffic controller (landing L2.4) =====
   One controller for every port, space or surface, and every ship, the player's and NPCs' alike
   (docs/plan-ember-reach-landing.md, "The traffic controller's rules"):
   - Pads by size: a ship gets a pad of its own class first (XS ships use S pads); if none of its class is free, a
     larger one; never a smaller one. Capital ships use capital berths only (at heavy landing fields).
   - The queue: with every pad it could use occupied, a ship joins a first-come, first-served queue shared by
     players and NPCs; the controller says its place, and gives it a pad when one frees.
   - Five minutes: once a pad is given, the ship has 5 minutes to dock (or land on it). Miss that and the
     clearance is revoked: the pad goes to the next in the queue, and the ship must ask again.
   - NPC traffic is simulated here (ships arriving, sitting on a pad a while, leaving), so the pads and the queue
     are shared with them. Each arrival and departure is told ('npcIn', 'npcOut'), and near the pilot it is flown. Pure functions and plain data; the game's own clock (t, seconds).
   Refusals for who the pilot is (wanted, at war) stay with the caller (play.js), as before. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const SIZES = ['S', 'M', 'L', 'XL', 'C'];
/* how long a cleared ship has to dock (s); how long an NPC sits on a pad (s, a range) */
const ATC = {window: 300, dwell: [90, 420], range: 10000};
/* a space port's pads: 24 by size (the larger stations have more large pads); no capital berths in space */
const STATION_PADS = {trefoil: {S: 10, M: 8, L: 4, XL: 2}, bloom: {S: 10, M: 8, L: 4, XL: 2}, lantern: {S: 9, M: 8, L: 5, XL: 2}, halo: {S: 8, M: 8, L: 5, XL: 3}};
/* a hull's pad class */
function classOf(hull) {
	const z = hull && hull.size;
	return z == 'XS' || z == 'S' ? 'S' : z == 'M' ? 'M' : z == 'L' ? 'L' : z == 'XL' ? 'XL' : z == 'Capital' ? 'C' : 'S';
}
/* the pads a ship of a class may be given, in the order they're tried: its own, then larger; capital: berths only */
const allowed = cls => cls == 'C' ? ['C'] : SIZES.slice(SIZES.indexOf(cls), 4);
/* the pads of a port: a surface port's from its layout (surface.js), a space port's by class; each {n, size} */
function padsOf(port, layout) {
	if (port && port.surface && layout) return layout.pads.map(p => ({n: p.n, size: p.size, c: p.c, r: p.r}));
	const counts = STATION_PADS[port && port.cls] || STATION_PADS.lantern, out = []; let n = 0;
	for (const z of SIZES) for (let i = 0; i < (counts[z] || 0); i++) out.push({n: ++n, size: z});
	return out;
}
/* a small seeded random */
function rng(seed) { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let x = h; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296 } }
/* a controller for a port: its pads (each free, or held by a ship: {who, until, docked}), the queue, and its NPC
   traffic (busy: how full it starts, 0..1; npcRate: NPC arrivals a minute, by default from the pads) */
function make(port, layout, opts) {
	const o = opts || {}, pads = padsOf(port, layout).map(p => Object.assign(p, {who: null, until: 0, docked: false}));
	const r = rng((port && (port.id || '') + '|' + (port.world || port.cls)) + '|' + (o.seed || ''));
	const C = {id: port && port.id || 'orbital', name: port && port.name || '', pads, queue: [], r, t: o.t || 0, npc: 0,
		npcRate: o.npcRate != null ? o.npcRate : pads.filter(p => p.size != 'C').length / 8, events: []};
	/* NPCs already on some of the pads when the pilot arrives */
	const busy = o.busy != null ? o.busy : 0.4;
	for (const p of pads) if (p.size != 'C' && r() < busy) hold(C, p, 'npc' + (++C.npc), C.t + dwell(C), true);
	return C;
}
const dwell = C => ATC.dwell[0] + C.r() * (ATC.dwell[1] - ATC.dwell[0]);
function hold(C, p, who, until, docked) { p.who = who; p.until = until; p.docked = !!docked }
const freePad = (C, cls) => { for (const z of allowed(cls)) { const p = C.pads.find(x => x.size == z && !x.who); if (p) return p } return null };
const canEverLand = (C, cls) => allowed(cls).some(z => C.pads.some(p => p.size == z));
/* where a ship stands: {pad} (cleared), {queued: place (1 first)}, or null */
function status(C, who) {
	const p = C.pads.find(x => x.who == who); if (p) return {pad: p.n, size: p.size, until: p.until, docked: p.docked};
	const i = C.queue.findIndex(q => q.who == who); return i >= 0 ? {queued: i + 1, of: C.queue.length} : null;
}
/* a request: a pad now ({ok, pad, size, until}), a place in the queue ({queued, of}), or refused ({why: 'size'}:
   no pad here could ever take it) */
function request(C, who, cls, t) {
	const now = status(C, who); if (now) return Object.assign({again: true}, now.pad ? {ok: true} : {}, now);
	if (!canEverLand(C, cls)) return {why: 'size'};
	/* first come, first served: the queue gets the free pads it can use first; what's left can go to the newcomer */
	C.events.push(...serve(C, t));
	const p = freePad(C, cls);
	if (p) { hold(C, p, who, t + ATC.window, false); return {ok: true, pad: p.n, size: p.size, until: p.until} }
	C.queue.push({who, cls, t}); return {queued: C.queue.length, of: C.queue.length};
}
/* the ship is down on its pad (docked or landed): it holds it, with no clock, until it leaves */
function docked(C, who) { const p = C.pads.find(x => x.who == who); if (p) { p.docked = true; p.until = Infinity } return !!p }
/* it leaves (launches, lifts off, gives up its place) */
function release(C, who) { const p = C.pads.find(x => x.who == who); if (p) { p.who = null; p.docked = false } C.queue = C.queue.filter(q => q.who != who) }
/* time passes: clearances unused for 5 minutes are revoked; NPCs leave and arrive; pads go to the queue in turn.
   Returns what happened, for the caller to tell: [{k: 'revoked'|'cleared'|'moved', who, pad, size, until, place}] */
function tick(C, t) {
	const ev = [], dt = Math.max(0, t - C.t); C.t = t;
	for (const p of C.pads) if (p.who && !p.docked && t > p.until) { ev.push({k: 'revoked', who: p.who, pad: p.n}); p.who = null }
	for (const p of C.pads) if (p.who && p.docked && String(p.who).startsWith('npc') && t > p.until) { ev.push({k: 'npcOut', who: p.who, pad: p.n, size: p.size}); p.who = null }
	/* NPC arrivals: each asks like anyone (and waits its turn); a cleared NPC is down on its pad a little later */
	let k = dt / 60 * C.npcRate; while (k > 0) { if (C.r() < Math.min(1, k)) { const cls = ['S', 'S', 'M', 'M', 'L', 'XL'][Math.floor(C.r() * 6)], who = 'npc' + (++C.npc); if (canEverLand(C, cls)) { const r = request(C, who, cls, t); if (r.ok) settleNpc(C, who, t) } } k -= 1 }
	const sv = serve(C, t); ev.push(...C.events.splice(0), ...sv);
	return ev;
}
/* the queue, in order: the first whose pad is free gets it; the rest move up */
function serve(C, t) {
	const ev = [];
	for (let i = 0; i < C.queue.length;) {
		const q = C.queue[i], p = freePad(C, q.cls);
		if (!p) { i++; continue }
		C.queue.splice(i, 1); hold(C, p, q.who, t + ATC.window, false);
		if (String(q.who).startsWith('npc')) settleNpc(C, q.who, t); else ev.push({k: 'cleared', who: q.who, pad: p.n, size: p.size, until: p.until});
	}
	C.queue.forEach((q, i) => { if (q.place != i + 1) { if (q.place && !String(q.who).startsWith('npc')) ev.push({k: 'moved', who: q.who, place: i + 1, of: C.queue.length}); q.place = i + 1 } });
	return ev;
}
/* an NPC cleared for a pad: down on it within a minute, then sits a while (0.3.11: the controller says so, and
   when it leaves, so that play.js can fly the ones near the pilot in and out: 'npcIn' and 'npcOut' events) */
function settleNpc(C, who, t) { const p = C.pads.find(x => x.who == who); if (p) { p.docked = true; p.until = t + 30 + dwell(C); C.events.push({k: 'npcIn', who, pad: p.n, size: p.size}) } }

const EmberTraffic = {ATC, SIZES, STATION_PADS, classOf, allowed, padsOf, make, request, status, docked, release, tick};
if (typeof module != 'undefined' && module.exports) module.exports = EmberTraffic; else root.EmberTraffic = EmberTraffic;
})(typeof window != 'undefined' ? window : globalThis);
