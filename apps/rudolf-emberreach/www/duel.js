/* ===== Ember Reach: duels (0.5.0) =====
   Two pilots, one asteroid field, best of three rounds.
   - The ships: a handful of fighters built for it (ROSTER), from the ordinary yards' hulls and modules (nothing of the
     Precursors'), their guns gimballed. Each has its strengths and weaknesses; a balance factor on hull, shields and
     damage evens them out, tuned by AI duels (simulate(): every pairing within 40-60% in tests).
   - The arena: three dense asteroid swarms in a row, 45 km of them, seeded so both pilots fly the same rocks; far
     from any world. The pilots start 20 km apart, facing each other, each on the other's radar as hostile.
   - A round lasts 300 s at most (the timer at the top of the screen). It's won by destroying the other ship, or by
     having done the more damage when time runs out; level at 300 s, it goes to sudden death: the next damage done
     wins. The first to win two rounds wins the match.
   - Collisions (bump(), the single-player game's too): hitting a rock or a ship hurts in proportion to how fast you
     hit (under 5 m/s is a scrape); between ships, both take it, the lighter one more.
   The match is plain data (match(), hit(), killed(), step()), the same on either side of a network (play.js, and
   later the duel server). GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const S = req('ships.js', 'EmberShips'), O = req('outfit.js', 'EmberOutfit'), Fl = req('flight.js', 'EmberFlight'), C = req('combat.js', 'EmberCombat'), G = req('galaxy.js', 'EmberGalaxy');
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.sqrt(dot(a, a));

const DUEL = {round: 300, wins: 2, spawn: 20000, between: 6, fields: [-15000, 0, 15000], scrape: 5, perMs: 0.6, bounce: 0.3};

/* the ships: hull, a line on how it fights, and how hard it is to hit (mob: more nimble ships get a little less of
   the rest, bigger ones a little more) */
const ROSTER = [
	{id: 'shrike', role: 'Heavy fighter', text: 'Four guns and good shields: the all-rounder.', mob: 1},
	{id: 'jackal', role: 'Raider', text: 'Gatling and mass driver: hard on hulls, and a little quicker than the heavy fighter.', mob: 1.5},
	{id: 'pike', role: 'Gunship', text: 'Missiles, a mass driver and the thickest hull; slow to turn.', mob: 0.92},
	{id: 'lancet', role: 'Strike craft', text: 'A medium hull: five hardpoints and missiles, heavy shields, a wide turn.', mob: 0.87}];
const byId = id => ROSTER.find(r => r.id == id) || ROSTER[1];
/* how a ship fights, as numbers: damage a second (its guns, gimballed, half on shields and half on hulls; a mass
   driver's charge counted in), its missiles' worth (half get through the flares), and what it takes to destroy */
function rating(ship) {
	const L = C.loadout(ship);
	let dps = 0;
	for (const g of L.guns) {
		const W = C.WEAPONS[g.kind]; if (W.homing && g.kind != 'torpedo') continue;
		const per = W.charge ? 1 / (W.charge + 1 / W.rate) : W.rate, k = g.mount == 'gimbal' ? C.COMBAT.gimbalDmg : 1;
		dps += W.dmg * per * k * (W.vsShield + W.vsHull) / 2 * (ship.dmgK || 1);
	}
	const msl = L.missiles * C.WEAPONS.missile.dmg * (ship.dmgK || 1) * (C.WEAPONS.missile.vsShield + C.WEAPONS.missile.vsHull) / 2 * 0.5;
	const ehp = ship.hull + ship.shield;
	return {dps, msl, ehp, power: (dps * 60 + msl) * ehp};
}
/* the balance: every ship's fighting power (a minute's damage times what it takes) brought to the Shrike's as it
   comes from the yards, times its mob factor, by scaling its hull, shields and damage alike (the square root each way) */
const K = {};
let MARK = 0;
const mark = () => MARK || (MARK = (h => rating(O.derive(h, O.starter(h))).power)(S.hull('shrike')));
function balance(R, ship) {
	if (!K[R.id]) K[R.id] = Math.sqrt(mark() * R.mob / rating(ship).power);
	return K[R.id];
}

/* a duel ship: the hull, fitted from the yards (guns gimballed), balanced */
function build(id) {
	const R = byId(id), hull = S.hull(R.id), fit = O.starter(hull), ship = O.derive(hull, fit), k = balance(R, ship);
	ship.hull = Math.round(ship.hull * k); ship.shield = Math.round(ship.shield * k); ship.dmgK = (ship.dmgK || 1) * k;
	ship.mass = Math.pow((ship.length || 10) / 10, 3);
	return {R, hull, fit, ship, k};
}
/* the arena (centred on the origin): its swarms (mining.js fields), and where the two start, facing each other */
function arena(seed) {
	const kinds = ['rocky', 'metallic', 'icy'], kind = kinds[seed % 3];
	const fields = DUEL.fields.map((x, i) => ({id: 'duel:' + seed + ':' + i, name: 'Duel field', kind, fieldKind: kind, density: 'dense', pos: [x, 0, 0], normal: [0, 0, 1]}));
	const h = DUEL.spawn / 2, starts = [{p: [-h, 0, 0], face: [1, 0, 0]}, {p: [h, 0, 0], face: [-1, 0, 0]}];
	return {seed, kind, fields, starts};
}

/* ---------- collisions ---------- */
/* two ships, as spheres ({p, v, radius, mass}): pushed apart and bounced; the damage each takes, from the speed
   they met at (both take it, shared by weight: the lighter takes more). Null if they don't touch */
function bump(a, b) {
	const d = sub(a.p, b.p), L = len(d), min = a.radius + b.radius; if (L >= min) return null;
	const n = mul(d, 1 / (L || 1)), ma = a.mass || 1, mb = b.mass || 1, over = min - L;
	a.p = add(a.p, mul(n, over * mb / (ma + mb))); b.p = sub(b.p, mul(n, over * ma / (ma + mb)));
	const vn = dot(sub(a.v, b.v), n); if (vn >= 0) return {impact: 0, a: 0, b: 0};
	const j = -(1 + DUEL.bounce) * vn / (1 / ma + 1 / mb);
	a.v = add(a.v, mul(n, j / ma)); b.v = sub(b.v, mul(n, j / mb));
	const dmg = impactDamage(-vn);
	return {impact: -vn, a: dmg * 2 * mb / (ma + mb), b: dmg * 2 * ma / (ma + mb)};
}
/* how much an impact at this speed (m/s) hurts: nothing under 5 m/s, then 0.6 a m/s */
const impactDamage = v => Math.max(0, v - DUEL.scrape) * DUEL.perMs;
/* a ship ({p, v, radius}) against an asteroid ({pos, radius}), which doesn't move: pushed out and bounced; the damage */
function rockBump(s, r) {
	const d = sub(s.p, r.pos), L = len(d), min = r.radius * 0.9 + s.radius; if (L >= min) return null;
	const n = mul(d, 1 / (L || 1)), vn = dot(s.v, n); s.p = add(r.pos, mul(n, min));
	if (vn >= 0) return {impact: 0, dmg: 0};
	s.v = sub(s.v, mul(n, vn * (1 + DUEL.bounce)));
	return {impact: -vn, dmg: impactDamage(-vn)};
}

/* ---------- the match ---------- */
function match(seed, ships) { return {seed, ships: ships || ['shrike', 'shrike'], round: 1, wins: [0, 0], phase: 'fight', t: 0, dealt: [0, 0], wait: 0, last: null} }
const left = m => Math.max(0, DUEL.round - m.t);
/* damage done by pilot `by` (0 or 1) to the other */
function hit(m, by, amount) {
	if (!(amount > 0)) return null;
	if (m.phase == 'fight') m.dealt[by] += amount;
	else if (m.phase == 'sudden') { m.dealt[by] += amount; return end(m, by, 'sudden') }
	return null;
}
/* a pilot destroyed (both at once: the one who'd done more damage takes it) */
function killed(m, loser, both) {
	if (m.phase != 'fight' && m.phase != 'sudden') return null;
	if (both) return end(m, m.dealt[0] == m.dealt[1] ? (m.round % 2) : m.dealt[0] > m.dealt[1] ? 0 : 1, 'kill');
	return end(m, 1 - loser, 'kill');
}
function end(m, winner, how) {
	m.wins[winner]++; m.last = {winner, how, round: m.round, dealt: m.dealt.slice(), t: m.t};
	m.phase = m.wins[winner] >= DUEL.wins ? 'over' : 'between'; m.wait = 0;
	return m.last;
}
/* time passing: returns 'time' (a round just ended on time), 'sudden' (it just went to sudden death), 'next' (the
   next round starts: put the ships back), or null */
function step(m, dt) {
	if (m.phase == 'fight') {
		m.t += dt;
		if (m.t >= DUEL.round) {
			if (m.dealt[0] == m.dealt[1]) { m.phase = 'sudden'; return 'sudden' }
			end(m, m.dealt[0] > m.dealt[1] ? 0 : 1, 'time'); return 'time';
		}
	} else if (m.phase == 'sudden') m.t += dt;
	else if (m.phase == 'between') { m.wait += dt; if (m.wait >= DUEL.between) { m.round++; m.phase = 'fight'; m.t = 0; m.dealt = [0, 0]; m.wait = 0; return 'next' } }
	return null;
}

/* ---------- AI duels, for balance (and the AI opponent's own flying, which is combat.js's) ---------- */
function pilot(id, start, n) {
	const b = build(id), s = Fl.create(b.ship, {p: start.p, q: lookAt(start.face)});
	s.radius = Math.max(2, b.ship.length / 2); s.mass = b.ship.mass;
	const cs = C.state(b.ship); cs.id = 'p' + n;
	return {id: cs.id, n, b, s, cs, ai: {mode: 'attack', base: 'attack', fleeAt: 0}};
}
/* a rotation facing `f` with +y up (f along x) */
function lookAt(f) { const a = Math.atan2(f[0], f[2]) / 2; return [Math.cos(a), 0, Math.sin(a), 0] }
/* one round between two AIs: {winner, how, t, dealt} */
function simulate(idA, idB, seed, opts) {
	opts = opts || {};
	const rnd = G.rng(seed), A = arena(seed), P = [pilot(idA, A.starts[0], 0), pilot(idB, A.starts[1], 1)], shots = [], m = match(seed, [idA, idB]), dt = opts.dt || 1 / 30;
	let t = 0;
	while (m.phase == 'fight' || m.phase == 'sudden') {
		t += dt;
		for (const p of P) { C.track(p.s, dt); C.tick(p.cs, t, dt) }
		for (const p of P) {
			const o = P[1 - p.n], tgt = {p: o.s.p, v: o.s.v, a: o.s.acc, heat: o.cs.heat, id: o.id};
			const c = C.think(p, tgt, null, t, rnd);
			Fl.step(p.s, {pitch: c.pitch, yaw: c.yaw, roll: c.roll, throttle: c.throttle, strafe: [0, 0], thrust: 0}, dt, null);
			const d = len(sub(o.s.p, p.s.p));
			if (c.fire && d < 3500) C.fire(p.cs, p.s, t, tgt, shots);
			C.railStep(p.cs, p.s, t, tgt, shots, c.fire && d < 4000 && !C.railReady(p.cs), dt);
			if (C.updateLock(p.cs, p.s, tgt, dt) && c.missile && rnd() < dt * 0.12) C.launch(p.cs, p.s, tgt, shots);
		}
		const hits = C.stepProjectiles(shots, P.map(p => ({id: p.id, s: p.s, cs: p.cs})), dt, []);
		for (const h of hits) { const tgt = P.find(p => p.id == h.ship.id), out = C.damage(tgt.cs, h.proj.dmg, h.proj.kind, t, rnd); hit(m, 1 - tgt.n, out.shield + out.hull) }
		const bm = bump(P[0].s, P[1].s); if (bm && bm.impact) for (const p of P) { const out = C.damage(p.cs, p.n ? bm.b : bm.a, 'ram', t, rnd); hit(m, 1 - p.n, out.shield + out.hull) }
		const dead = P.filter(p => p.cs.dead);
		if (dead.length && (m.phase == 'fight' || m.phase == 'sudden')) killed(m, dead[0].n, dead.length == 2);
		if (m.phase == 'fight' || m.phase == 'sudden') step(m, dt);
		if (t > (opts.max || DUEL.round + 120)) { end(m, m.dealt[0] >= m.dealt[1] ? 0 : 1, 'time'); break }
	}
	return {winner: m.last.winner, how: m.last.how, t: Math.round(m.last.t), dealt: m.last.dealt.map(Math.round)};
}

const EmberDuel = {_reset: () => { for (const k in K) delete K[k] }, DUEL, ROSTER, byId, rating, mark, build, arena, bump, rockBump, impactDamage, match, left, hit, killed, step, simulate, lookAt};
if (isNode) module.exports = EmberDuel; else root.EmberDuel = EmberDuel;
})(typeof window != 'undefined' ? window : globalThis);
