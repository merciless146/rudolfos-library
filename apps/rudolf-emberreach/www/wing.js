/* ===== Ember Reach: the co-op wing, its data (docs/plan-ember-reach-pilots.md P5b; 0.6.1) =====
   Up to four pilots in the host's galaxy, over net.js room() (the relay's protocol 2). The host's game is the world:
   its system, its day, its NPCs (their AI, their shots, who they hit). Each pilot flies their own ship on their own
   machine and sends its state; the host passes everyone's on.
   - What travels, 15 times a second:
     - the host's 'st' to the wing: its system and day, a centre (o: the host's ship, so coordinates stay small), every
       member's ship (seat, flight state, model, name, shields and hull, cloaked, docked), the NPCs near any member
       (their details when first sent, and every 3 s for whoever joined since), the shots in flight, and events;
     - a guest's 'in' to the host: the same of its own ship, its shots, and its hits on the host's NPCs (claims, the
       host's game applies them).
   - Hits: the host's game decides. An NPC's shot on a guest's ship is sent to that guest ('hit'), who takes it at
     their own difficulty's damage. A guest's shot on an NPC is a claim; the NPC destroyed by it is sent back ('kill')
     so the guest's game pays their pilot (bounties, reputation, missions). Wing members can't hurt each other.
   - Days: a guest's pilot lives on the host's day while in the wing. Joining moves their deadlines by the
     difference; leaving moves them back onto their own galaxy's day, plus the days lived in the wing.
   - Nothing of the host's galaxy is written to a guest's: a guest's game saves only the pilot.
   - (0.6.3) Missions the host shares: taken by each guest as their own copy, the work done kept in step (below).
   This file is plain data, the same in node (tests) and the page (play.js's wing* functions). GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const Ne = req('net.js', 'EmberNet');
const WING = {rate: 15, near: 1.8e5, npcs: 20, shots: 20, full: 3, max: 7600, gone: 1.5, seats: 4};
const r2 = x => Math.round(x * 100) / 100;
const fin = x => typeof x == 'number' && isFinite(x);
const str = (x, n) => typeof x == 'string' && x.length <= n ? x : null;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(a[0], a[1], a[2]);
const vec3 = (v, m) => Array.isArray(v) && v.length == 3 && v.every(x => fin(x) && Math.abs(x) <= m);

/* ---------- members (the pilots of the wing) ---------- */
/* a member's own ship as it travels: seat, flight state (from the centre o), model, name, condition, cloak (0 none, 1
   raised and shown, 2 hidden), docked */
function packMember(seat, s, o, x) {
	return {id: seat, me: Ne.packShip(s, o), m: x.model, nm: x.name, c: Ne.packCond(x.cs), ck: x.cloak || 0, d: x.docked ? 1 : 0, pd: x.pad || null};   /* (pd, 0.6.2: [port, pad] held) */
}
function unpackMember(m, o) {
	if (!m || !Number.isInteger(m.id) || m.id < 0 || m.id >= WING.seats || !str(m.m, 40) || !Ne.condOk(m.c)) return null;
	const me = Ne.unpackShip(m.me, o); if (!me) return null;
	return {id: m.id, me, model: m.m, name: (str(m.nm, 40) || '').replace(/[<>]/g, '') || 'Wing pilot ' + (m.id + 1), cond: m.c, cloak: [0, 1, 2].includes(m.ck) ? m.ck : 0, docked: m.d === 1, pad: padOk(m.pd) ? m.pd : null};
}

/* (0.6.2) a pad held at a port of the system: [the port's id, the pad's number] */
const padOk = x => Array.isArray(x) && x.length == 2 && str(x[0], 60) && Number.isInteger(x[1]) && x[1] >= 1 && x[1] <= 64;
/* (0.6.2) the host's market records and colonies for its system, as they come: the records whole and sound, the
   colonies at that star only */
function marketsOk(mk, recordOk) { return !!mk && typeof mk == 'object' && !Array.isArray(mk) && Object.keys(mk).length <= 24 && Object.entries(mk).every(([k, e]) => k.length <= 80 && recordOk(e)) }
function coloniesOk(cl, star) { return Array.isArray(cl) && cl.length <= 8 && cl.every(c => c && typeof c == 'object' && str(c.id, 60) && c.star && c.star.id == star) }

/* ---------- the host's NPCs ---------- */
/* an NPC as it travels: always its flight state, condition and whether it's hostile to the wing; its details
   (ship, role, faction, name, wanted) when full */
function packNpc(n, o, full, hostile) {
	const x = {i: n.id, me: Ne.packShip(n.s, o), c: Ne.packCond(n.cs), h: hostile ? 1 : 0};
	if (full) {
		x.s = n.ship.id; x.r = n.role; x.f = n.faction; x.nm = n.name;
		if (n.wanted) x.wa = {code: n.wanted.code, amount: n.wanted.amount};
	}
	return x;
}
function unpackNpc(x, o) {
	if (!x || !str(x.i, 40) || !Ne.condOk(x.c)) return null;
	const me = Ne.unpackShip(x.me, o); if (!me) return null;
	const out = {id: x.i, me, cond: x.c, hostile: x.h === 1};
	if (x.s !== undefined) {
		if (!str(x.s, 40) || !str(x.r, 20) || !(x.f == null || str(x.f, 40)) || !str(x.nm, 80)) return null;
		out.full = {ship: x.s, role: x.r, faction: x.f || null, name: x.nm.replace(/[<>]/g, ''), wanted: x.wa && str(x.wa.code, 8) && fin(x.wa.amount) && x.wa.amount >= 0 && x.wa.amount < 1e10 ? {code: x.wa.code, amount: x.wa.amount} : null};
	}
	return out;
}
/* which NPCs go out: alive, within reach of a member (the host or a guest), nearest first, at most WING.npcs */
function nearNpcs(npcs, at) {
	const d = n => Math.min(...at.map(p => len(sub(n.s.p, p))));
	return npcs.filter(n => !n.cs.dead && !n.remote && !n.member && at.length && d(n) < WING.near).map(n => [d(n), n]).sort((a, b) => a[0] - b[0]).slice(0, WING.npcs).map(x => x[1]);
}

/* ---------- checks on what arrives ---------- */
/* a guest's hit claimed on an NPC: its id and the damage (as a shot of theirs could do) */
function claimOk(e) { return e && e.e == 'hitN' && str(e.i, 40) && fin(e.dmg) && e.dmg > 0 && e.dmg <= 5000 && str(e.kind, 20) }
/* the host's state: its star and day, the centre */
function stOk(m) { return m && m.k == 'st' && str(m.star, 60) && fin(m.day) && m.day >= 0 && vec3(m.o, 1e13) }
function inOk(m) { return m && m.k == 'in' && str(m.star, 60) && vec3(m.o, 1e13) && m.me }

/* ---------- days ---------- */
/* joining: the pilot onto the host's day (shift is save.js shiftDays, either way) */
function joinDays(P, homeDay, hostDay, shift) { shift(P, hostDay - homeDay); return {home: homeDay, joined: hostDay} }
/* leaving: back onto the pilot's own galaxy's day, plus the days lived in the wing */
function leaveDays(P, w, nowDay, shift) { const back = w.home + Math.max(0, nowDay - w.joined); shift(P, back - nowDay); return back }

/* ---------- (0.6.3) missions the host shares ----------
   The host's game is the world, so its missions are the ones whose ships and depots it brings (encounters.js cast). A
   mission the host shares goes to the wing; each guest may take it (a copy of their own, within their three, due when
   the host's is). The work done is the wing's: the host's game counts the kills (its NPCs, whoever destroys them); the
   rest (time in the system, a delivery, a survey) whoever does it, passed to the host and on to the wing. Each pilot is
   paid in their own game, by their own rules, when it's done; and fails it, late, as ever. */
const MTYPES = ['strike', 'blockade', 'defend', 'escort', 'recon', 'sabotage', 'supply', 'survey', 'ruin', 'delivery', 'groundsurvey'];
const MSTR = ['issuer', 'against', 'war', 'system', 'systemName', 'planet', 'port', 'portName', 'world', 'good'];
const clean = t => t.replace(/[<>]/g, '');
/* a mission as it travels: what it is, and the work done on it */
function packMission(m) {
	const x = {id: m.id, kind: m.kind || null, type: m.type, star: {id: m.star.id, name: m.star.name, at: m.star.at}, text: m.text, reward: m.reward, currency: m.currency, due: m.due, accepted: m.accepted, p: progOf(m)};
	for (const k of MSTR) if (m[k] != null) x[k] = m[k];
	if (m.tons != null) x.tons = m.tons; if (m.effort != null) x.effort = m.effort; if (m.done) x.done = 1;
	return x;
}
function unpackMission(x) {
	if (!x || !str(x.id, 120) || !(x.kind == null || x.kind == 'explore' || x.kind == 'surface') || !MTYPES.includes(x.type)) return null;
	if (!x.star || !str(x.star.id, 60) || !str(x.star.name, 80) || !vec3(x.star.at, 1e6) || !str(x.text, 200) || !str(x.currency, 8)) return null;
	if (!fin(x.reward) || x.reward < 0 || x.reward > 1e10 || !fin(x.due) || !(x.accepted == null || fin(x.accepted)) || !progOk(x.p)) return null;
	if (x.tons != null && !(Number.isInteger(x.tons) && x.tons > 0 && x.tons <= 1e4)) return null;
	if (x.effort != null && !(fin(x.effort) && x.effort >= 0 && x.effort <= 1e4)) return null;
	const m = {id: x.id, type: x.type, star: {id: x.star.id, name: clean(x.star.name), at: x.star.at.slice()}, text: clean(x.text), reward: Math.round(x.reward), currency: x.currency, due: x.due, accepted: x.accepted == null ? x.due : x.accepted, port: null};
	if (x.kind) m.kind = x.kind;
	for (const k of MSTR) { if (x[k] == null) continue; if (!str(x[k], 80)) return null; m[k] = clean(x[k]) }
	if (x.tons != null) m.tons = x.tons; if (x.effort != null) m.effort = x.effort;
	return {m, p: x.p, done: x.done === 1};
}
/* the work done: kills, seconds in the system, the depot, delivered, surveyed */
function progOf(m) { return {k: m.kills || 0, s: Math.floor(m.stay || 0), d: m.depot ? 1 : 0, v: m.delivered ? 1 : 0, u: m.surveyed ? 1 : 0} }
function progOk(p) { return !!p && Number.isInteger(p.k) && p.k >= 0 && p.k <= 99 && Number.isInteger(p.s) && p.s >= 0 && p.s <= 1e6 && [p.d, p.v, p.u].every(b => b === 0 || b === 1) }
/* work done elsewhere, into a mission (never undone; kills only as the host's game counted them). Returns whether it changed */
function mergeProg(m, p, kills) {
	let ch = false;
	if (kills && p.k > (m.kills || 0)) { m.kills = p.k; ch = true }
	if (p.s > Math.floor(m.stay || 0)) { m.stay = p.s; ch = true }
	if (p.d && !m.depot) { m.depot = true; ch = true }
	if (p.v && !m.delivered) { m.delivered = true; ch = true }
	if (p.u && !m.surveyed) { m.surveyed = true; ch = true }
	return ch;
}
/* (a guest) taking a shared mission: a copy of your own (one you hold already is linked again, as after leaving and
   coming back) */
function takeShared(P, u, max) {
	P.missions = P.missions || [];
	const had = P.missions.find(x => x.id == u.m.id && !x.done);
	if (had) { mergeProg(had, u.p, true); return {ok: true, mission: had, again: true} }
	if (u.done) return {ok: false, why: 'That mission is over.'};
	if (P.missions.filter(x => !x.done).length >= (max || 3)) return {ok: false, why: 'You can hold three missions at once.'};
	const m = Object.assign({}, u.m, {kills: 0, stay: 0, depot: false, done: false});
	mergeProg(m, u.p, true);
	P.missions.push(m);
	return {ok: true, mission: m};
}

/* a message the host sends: under the relay's size, by dropping shots, then NPCs, then their details */
function fit(m) {
	let t = JSON.stringify(m);
	while (t.length > WING.max && m.sh && m.sh.length) { m.sh.length = Math.floor(m.sh.length / 2); t = JSON.stringify(m) }
	while (t.length > WING.max && m.np && m.np.length) { m.np.length = Math.floor(m.np.length * 0.7); t = JSON.stringify(m) }
	return t.length <= WING.max ? m : null;
}

const EmberWing = {WING, padOk, marketsOk, coloniesOk, packMember, unpackMember, packNpc, unpackNpc, nearNpcs, claimOk, stOk, inOk, joinDays, leaveDays, fit, MTYPES, packMission, unpackMission, progOf, progOk, mergeProg, takeShared};
if (isNode) module.exports = EmberWing; else root.EmberWing = EmberWing;
})(typeof window != 'undefined' ? window : globalThis);
