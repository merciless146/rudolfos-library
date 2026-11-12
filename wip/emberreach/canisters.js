/* ===== Ember Reach: cargo canisters and the cargo hatch (docs/plan-ember-reach.md, "Cargo hatch and canisters").
   Goods loose in space are canisters: one tonne of one good each, drifting and tumbling. They come from wrecks
   (traders carry the most), and from a hold spilling through a broken hatch.
   - Most ships (every one with a hold) have a cargo hatch on the belly. The pilot opens and shuts it. Open, the ship
     drops into its scooping trim (flight.js: slow, with fine turning), and a canister that drifts into the hatch,
     slowly enough, is taken aboard if the hold has room.
   - In combat it's the hatch that takes hits, not the hold. A broken hatch is stuck open: the ship is held to its
     scooping trim, can't scoop (the mechanism is wrecked), and the hold spills a tonne every 8 s, as canisters
     drifting away behind.
   - Canisters last 15 minutes, then break up.
   Pure functions on plain data; deterministic given the random source. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const E = isNode ? require('./economy.js') : root.EmberEconomy;
const CAN = {life: 900, reach: 18, speed: 20, spill: 8, drift: 6, tumble: 0.8};
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], len = a => Math.hypot(a[0], a[1], a[2]);
const rv = (rnd, k) => [(rnd() * 2 - 1) * k, (rnd() * 2 - 1) * k, (rnd() * 2 - 1) * k];
let N = 0;

/* one canister of a good, at p, moving with v plus a little scatter */
function make(good, p, v, t, rnd) {
	rnd = rnd || Math.random;
	return {id: 'c' + (N++), kind: 'canister', good, name: good + ' canister', p: p.slice(), pos: p.slice(), v: add(v || [0, 0, 0], rv(rnd, CAN.drift)), radius: 1.5,
		spin: rv(rnd, CAN.tumble), angle: rnd() * 6.283, born: t || 0};
}
/* what a wreck leaves: traders their cargo, pirates some loot, navy ships munitions, depots a lot of munitions */
function wreck(role, ship, rnd) {
	rnd = rnd || Math.random;
	const goods = Object.keys(E.GOODS).filter(g => g != 'Artefacts'), pick = () => goods[Math.floor(rnd() * goods.length)];
	const room = Math.max(0, ship.cargo || 0), cap = n => Math.min(n, Math.max(0, Math.round(room / 2)) || n);
	let out = [];
	if (role == 'trader') { const g = pick(), k = cap(3 + Math.floor(rnd() * 6)); for (let i = 0; i < k; i++) out.push(rnd() < 0.7 ? g : pick()) }
	else if (role == 'pirate') { const k = Math.floor(rnd() * 4); for (let i = 0; i < k; i++) out.push(pick()) }
	else if (role == 'navy' || role == 'patrol') { if (rnd() < 0.4) out.push('Munitions') }
	else if (role == 'depot') { const k = 4 + Math.floor(rnd() * 5); for (let i = 0; i < k; i++) out.push('Munitions') }
	return out;
}
/* drift and tumble; old canisters break up */
function step(list, t, dt) {
	for (let i = list.length - 1; i >= 0; i--) {
		const c = list[i];
		if (t - c.born > CAN.life) { list.splice(i, 1); continue }
		c.p = add(c.p, mul(c.v, dt)); c.pos = c.p; c.angle += len(c.spin) * dt;
	}
}
/* where the hatch is: under the belly, a third of the way back */
function hatchAt(s, down, back) { return add(add(s.p, mul(down, s.radius * 0.35)), mul(back, s.radius * 0.3)) }
/* the scoop: with the hatch open and working, canisters near the hatch and slow enough relative to the ship come
   aboard while there's room. Returns {got: [goods], full: bool, fast: bool}. The hold: P.cargo, P.cost (SU paid per
   tonne, averaged: scooped goods cost nothing). down/back: the ship's belly and tail directions in the world */
function scoop(list, s, down, back, P, capacity) {
	const out = {got: [], full: false, fast: false}, at = hatchAt(s, down, back);
	for (let i = list.length - 1; i >= 0; i--) {
		const c = list[i];
		if (len(sub(c.p, at)) > CAN.reach + s.radius * 0.3) continue;
		if (len(sub(c.v, s.v)) > CAN.speed) { out.fast = true; continue }
		const held = Object.values(P.cargo).reduce((t, q) => t + q, 0);
		if (held + 1 > capacity) { out.full = true; continue }
		const have = P.cargo[c.good] || 0;
		P.cost[c.good] = have ? (P.cost[c.good] || 0) * have / (have + 1) : 0;
		P.cargo[c.good] = have + 1;
		out.got.push(c.good); list.splice(i, 1);
	}
	return out;
}
/* a broken hatch: a tonne slips out every 8 s (the commonest good first), as a canister drifting off behind.
   acc: {t} carried between calls. Returns the canisters made */
function spill(P, s, back, t, dt, acc, rnd) {
	acc.t = (acc.t || 0) + dt;
	const out = [];
	while (acc.t >= CAN.spill) {
		acc.t -= CAN.spill;
		const g = Object.keys(P.cargo).filter(k => P.cargo[k] > 0).sort((a, b) => P.cargo[b] - P.cargo[a])[0];
		if (!g) { acc.t = 0; break }
		P.cargo[g]--; if (!P.cargo[g]) { delete P.cargo[g]; delete P.cost[g] }
		out.push(make(g, add(s.p, mul(back, s.radius * 0.8)), add(s.v, mul(back, 4)), t, rnd));
	}
	return out;
}

const EmberCanisters = {CAN, make, wreck, step, hatchAt, scoop, spill};
if (isNode) module.exports = EmberCanisters; else root.EmberCanisters = EmberCanisters;
})(typeof window != 'undefined' ? window : this);
