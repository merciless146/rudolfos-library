/* ===== Ember Reach: combat (docs/plan-ember-reach.md, "Combat", M4).
   Ships fight with what their hardpoints carry, guns fixed forward with a little gimbal (Oolite's way):
   - small: pulse lasers (fast bolts, heat, better against shields);
   - medium: mass drivers (slower slugs, ammunition, better against hulls), and a missile pylon each;
   - large: heavy lasers; huge: torpedo racks (slow, homing, devastating). Flagships' guns are turrets.
   Damage meets the shields first; what gets through hits the hull, and the hull's damage lands on the modules
   (modules.js), so a hit can take out the engines, the canopy or the power plant. Shields come back a few seconds
   after the last hit, if the shield generator and the power plant work. Lasers make heat: past full, the guns lock
   until it falls, and staying hot cooks the modules. Missiles lock on (2 s in a 15° cone) and home; a flare
   decoys each missile chasing you with a 70% chance.
   AI pilots fly the same flight model with flight assist, through the same controls: attack (lead the target, hold
   the range, fire when the nose is on), jink when hit, flee when badly hurt, patrol, trade, or hold station.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const Fl = isNode ? require('./flight.js') : root.EmberFlight, M = isNode ? require('./modules.js') : root.EmberModules;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.sqrt(dot(a, a)), norm = a => mul(a, 1 / (len(a) || 1));
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

/* the weapons, by hardpoint size. dmg per hit; rate per second; speed m/s; range m; heat per shot (of the ship's
   capacity); vs shields and hull multipliers; ammo (null: lasers need none) */
/* tuned so a fighter duel lasts about a minute: a Thylacine's two lasers strip a Thylacine's shields in ~6 s of hits and
   its hull in ~12 s more; a missile takes a third of a fighter's hull */
const WEAPONS = {
	pulse: {name: 'Pulse laser', size: 0, dmg: 1.2, rate: 6, speed: 4000, range: 2500, heat: 0.022, vsShield: 1.2, vsHull: 0.7, ammo: null, col: [1, 0.45, 0.25]},
	driver: {name: 'Mass driver', size: 1, dmg: 4.5, rate: 2, speed: 1500, range: 3000, heat: 0.01, vsShield: 0.6, vsHull: 1.3, ammo: 150, col: [1, 0.85, 0.4]},
	heavy: {name: 'Heavy laser', size: 2, dmg: 9, rate: 1.5, speed: 3500, range: 4000, heat: 0.08, vsShield: 1.2, vsHull: 0.8, ammo: null, col: [0.5, 0.8, 1]},
	torpedo: {name: 'Torpedo rack', size: 3, dmg: 150, rate: 0.2, speed: 400, range: 9000, heat: 0, vsShield: 0.8, vsHull: 1.6, ammo: 8, homing: 1.2, col: [1, 1, 0.9]},
	mining: {name: 'Mining laser', size: 0, dmg: 0.4, rate: 4, speed: 3000, range: 600, heat: 0.008, vsShield: 0.5, vsHull: 0.5, ammo: null, col: [0.45, 1, 0.55]},
	/* Precursor work (outfit.js): hits like the next size up, and runs cool */
	needle: {name: 'Precursor needle', size: 0, dmg: 3, rate: 6, speed: 5000, range: 3000, heat: 0.012, vsShield: 1.2, vsHull: 1.1, ammo: null, col: [0.75, 0.55, 1]},
	lance: {name: 'Precursor lance', size: 2, dmg: 26, rate: 1.5, speed: 6000, range: 5000, heat: 0.05, vsShield: 1.2, vsHull: 1.2, ammo: null, col: [0.85, 0.6, 1]},
	/* the Interstellar Marshals' (encounters.js): each hit also cuts into the shield generator itself, shields up or
	   not, a twenty-fifth of it, so a wing's disruptors put shields out in seconds */
	disruptor: {name: 'Marshal disruptor', size: 1, dmg: 5, rate: 2, speed: 3500, range: 3500, heat: 0.01, vsShield: 1, vsHull: 1, ammo: null, col: [0.4, 0.9, 1], module: 'shields', moduleShare: 0.04},
	missile: {name: 'Missile', size: -1, dmg: 30, rate: 1, speed: 600, range: 7000, heat: 0, vsShield: 1, vsHull: 1.5, ammo: 4, homing: 2.2, col: [1, 1, 1]}};
const BY_SIZE = ['pulse', 'driver', 'heavy', 'torpedo'];
const COMBAT = {gimbal: 5, lockCone: 15, lockTime: 2, flares: 6, flareChance: 0.7, regenDelay: 2.5, regenTime: 15, coolRate: 0.12, overheat: 1, cooled: 0.6, cookRate: 4, moduleShare: 0.6};

/* a ship's guns from its hardpoints [S, M, L, H]; each medium mount also carries a missile pylon */
function loadout(ship) {
	/* a fitted ship (outfit.js) carries what its external modules are; missile racks hold four missiles each */
	if (ship.guns) {
		const guns = ship.guns.filter(k => k != 'missile').map(k => ({kind: k, cool: 0, ammo: WEAPONS[k].ammo}));
		return {guns, missiles: ship.guns.filter(k => k == 'missile').length * WEAPONS.missile.ammo, flares: COMBAT.flares, turrets: ship.size == 'Capital'};
	}
	const guns = [], h = ship.hard || [0, 0, 0, 0];
	h.forEach((n, size) => { for (let k = 0; k < n; k++) guns.push({kind: BY_SIZE[size], cool: 0, ammo: WEAPONS[BY_SIZE[size]].ammo}) });
	return {guns, missiles: h[1] * WEAPONS.missile.ammo, flares: COMBAT.flares, turrets: ship.size == 'Capital'};
}
/* a ship's fighting state: shields, hull, heat, guns, modules */
function state(ship, fit) {
	return {dmgK: ship.dmgK || 1, hullMax: ship.hull, hull: ship.hull, shieldMax: ship.shield, shield: ship.shield, heat: 0, hot: false, lastHit: -1e9, fit: fit || M.fit(ship), load: loadout(ship), lock: {id: null, t: 0}, dead: false};
}
/* a hit: shields first, then the hull and its modules. Returns what it did */
function damage(cs, dmg, kind, t, rnd) {
	const W = WEAPONS[kind] || WEAPONS.pulse, out = {shield: 0, hull: 0, alerts: []};
	cs.lastHit = t;
	let left = dmg;
	/* a disruptor's hit on the module itself (it reaches through raised shields) */
	if (W.module) { const m = M.get(cs.fit, W.module); if (m && m.hp > 0) { const a = M.damage(cs.fit, W.module, m.max * W.moduleShare); if (a) out.alerts.push(a); out.module = W.module } }
	const shieldsUp = M.works(cs.fit, 'shields') && M.works(cs.fit, 'power');
	if (shieldsUp && cs.shield > 0) {
		const s = left * W.vsShield;
		if (s <= cs.shield) { cs.shield -= s; out.shield = s; return out }
		out.shield = cs.shield; left = (s - cs.shield) / W.vsShield; cs.shield = 0;
	}
	const h = left * W.vsHull;
	cs.hull = Math.max(0, cs.hull - h); out.hull = h;
	/* the hull's damage reaches the modules */
	let m = h * COMBAT.moduleShare;
	while (m > 0) { const r = M.hit(cs.fit, Math.min(m, 6), rnd ? rnd() : Math.random()); if (r.alert) out.alerts.push(r.alert); m -= 6 }
	if (cs.hull <= 0) cs.dead = true;
	return out;
}
/* every step: shields recharge after a quiet spell; heat drains; hot ships lock their guns and cook */
function tick(cs, t, dt) {
	const powered = M.works(cs.fit, 'power');
	if (powered && M.works(cs.fit, 'shields') && t - cs.lastHit > COMBAT.regenDelay) cs.shield = Math.min(cs.shieldMax, cs.shield + cs.shieldMax / COMBAT.regenTime * dt);
	cs.heat = Math.max(0, cs.heat - COMBAT.coolRate * dt);
	if (cs.heat > COMBAT.overheat) cs.hot = true; else if (cs.hot && cs.heat < COMBAT.cooled) cs.hot = false;
	if (cs.heat > COMBAT.overheat * 1.15) { const r = M.hit(cs.fit, COMBAT.cookRate * dt, Math.random()); return r.alert ? [r.alert] : [] }
	for (const g of cs.load.guns) g.cool = Math.max(0, g.cool - dt);
	return [];
}
/* where to aim: the point the target will be when a bolt of this speed gets there */
function lead(from, fromV, to, toV, speed) {
	const r = sub(to, from), v = sub(toV, fromV), a = dot(v, v) - speed * speed, b = 2 * dot(r, v), c = dot(r, r);
	let t;
	if (Math.abs(a) < 1e-9) t = -c / b; else { const d = b * b - 4 * a * c; if (d < 0) return to; const s = Math.sqrt(d), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a); t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2) }
	return t > 0 ? add(to, mul(toV, t)) : to;
}
/* fire the guns that are ready, as projectiles from a ship (s: flight state, radius), towards a target (or straight
   ahead). Guns aim along the nose, or at the target's lead within the gimbal; turrets aim anywhere */
function fire(cs, s, t, target, out) {
	if (cs.hot || !M.works(cs.fit, 'weapons') || !M.works(cs.fit, 'power')) return 0;
	const nose = Fl.forward(s); let n = 0;
	for (const g of cs.load.guns) {
		const W = WEAPONS[g.kind];
		if (g.cool > 0 || W.homing || (g.ammo != null && g.ammo <= 0)) continue;
		let dir = nose;
		if (target) {
			const L = norm(sub(lead(s.p, s.v, target.p, target.v, W.speed), s.p));
			if (cs.load.turrets || Math.acos(clamp(dot(L, nose), -1, 1)) * 180 / Math.PI < COMBAT.gimbal) dir = L;
			else if (cs.load.turrets === false && !target.forceAhead) {}
		}
		const origin = add(s.p, mul(dir, s.radius * 1.2));
		out.push({kind: g.kind, p: origin, v: add(s.v, mul(dir, W.speed)), ttl: W.range / W.speed, dmg: W.dmg * (cs.dmgK || 1), owner: cs.id, target: null});
		g.cool = 1 / W.rate; if (g.ammo != null) g.ammo--; cs.heat += W.heat; n++;
	}
	return n;
}
/* missiles: once locked (target in the 15° cone for 2 s), one per press; torpedo racks fire with them */
function updateLock(cs, s, target, dt) {
	if (!target) { cs.lock = {id: null, t: 0}; return false }
	const ang = Math.acos(clamp(dot(norm(sub(target.p, s.p)), Fl.forward(s)), -1, 1)) * 180 / Math.PI, dist = len(sub(target.p, s.p));
	if (ang < COMBAT.lockCone && dist < WEAPONS.missile.range) { if (cs.lock.id != target.id) cs.lock = {id: target.id, t: 0}; cs.lock.t += dt } else cs.lock = {id: null, t: 0};
	return cs.lock.t >= COMBAT.lockTime;
}
function launch(cs, s, target, out) {
	if (!target || cs.lock.id != target.id || cs.lock.t < COMBAT.lockTime || !M.works(cs.fit, 'weapons')) return 0;
	let n = 0;
	const torp = cs.load.guns.find(g => g.kind == 'torpedo' && g.cool <= 0 && g.ammo > 0);
	const kinds = []; if (cs.load.missiles > 0) kinds.push('missile'); if (torp) kinds.push('torpedo');
	for (const k of kinds) {
		const W = WEAPONS[k], dir = Fl.forward(s);
		out.push({kind: k, p: add(s.p, mul(dir, s.radius * 1.3)), v: add(s.v, mul(dir, W.speed * 0.5)), ttl: W.range / W.speed * 1.5, dmg: W.dmg * (cs.dmgK || 1), owner: cs.id, target: target.id});
		if (k == 'missile') cs.load.missiles--; else { torp.ammo--; torp.cool = 1 / W.rate }
		n++;
	}
	return n;
}
/* a flare: each missile chasing this ship loses it with a 70% chance */
function flare(cs, projectiles, rnd) {
	if (cs.load.flares <= 0) return 0;
	cs.load.flares--;
	let n = 0; for (const m of projectiles) if (m.target == cs.id && (rnd ? rnd() : Math.random()) < COMBAT.flareChance) { m.target = null; n++ }
	return n;
}
/* move every projectile; missiles home; returns the hits [{proj, ship}] (ships: [{id, s (p, v, radius), cs}]) */
function stepProjectiles(list, ships, dt) {
	const hits = [];
	for (let i = list.length - 1; i >= 0; i--) {
		const m = list[i], W = WEAPONS[m.kind];
		m.ttl -= dt; if (m.ttl <= 0) { list.splice(i, 1); continue }
		if (W.homing && m.target != null) {
			const tg = ships.find(x => x.id == m.target && !x.cs.dead);
			if (tg) { const want = norm(sub(lead(m.p, [0, 0, 0], tg.s.p, tg.s.v, W.speed), m.p)), cur = norm(m.v), turn = Math.min(1, W.homing * dt); m.v = mul(norm(add(mul(cur, 1 - turn), mul(want, turn))), Math.min(W.speed, len(m.v) + W.speed * dt)) }
		}
		const p0 = m.p, p1 = add(m.p, mul(m.v, dt)), seg = sub(p1, p0), sl = len(seg) || 1e-9, u = mul(seg, 1 / sl);
		let hit = null;
		for (const x of ships) {
			if (x.id == m.owner || x.cs.dead) continue;
			const r = x.s.radius * 0.85, d = sub(x.s.p, p0), along = clamp(dot(d, u), 0, sl), q = sub(d, mul(u, along));
			if (dot(q, q) < r * r) { hit = x; break }
		}
		if (hit) { hits.push({proj: m, ship: hit}); list.splice(i, 1); continue }
		m.p = p1;
	}
	return hits;
}

/* ---------- AI pilots ---------- */
/* controls that turn the nose towards a point: roll it into the pitch plane, pull up to it; yaw for the last bit */
function steer(s, point, ease) {
	const d = Fl.toBody(s.q, sub(point, s.p)), x = d[0], y = d[1], z = d[2], off = Math.atan2(Math.hypot(x, y), z), k = ease || 1;
	const rollErr = Math.atan2(x, y), roll = off > 0.08 && Math.hypot(x, y) > 1e-6 ? clamp(-rollErr * 1.5, -1, 1) : 0;
	const pitch = clamp(-Math.atan2(y, z) * 3 * k, -1, 1), yaw = clamp(Math.atan2(x, z) * 3 * k, -1, 1);
	return {pitch, yaw: off < 0.4 ? yaw : yaw * 0.3, roll: Math.abs(rollErr) > Math.PI / 2 && off < 0.3 ? 0 : roll, off};
}
/* one AI decision. me: {s, cs, ship, ai: {mode, jink, ...}}, target: {p, v, id} or null; home: a point to patrol
   or head for. Returns the controls, and whether to fire / launch */
function think(me, target, home, t, rnd) {
	const s = me.s, A = me.ai, hp = me.cs.hull / me.cs.hullMax;
	const r = rnd || Math.random;
	if (me.cs.lastHit > (A.lastHit || -1e9)) { A.lastHit = me.cs.lastHit; if (r() < 0.6) A.jinkUntil = t + 0.8 + r() * 1.2, A.jinkDir = [r() * 2 - 1, r() * 2 - 1] }
	if (A.mode == 'attack' && hp < (A.fleeAt || 0.25)) A.mode = 'flee';
	if (A.mode == 'flee' && target) {
		const away = add(s.p, mul(norm(sub(s.p, target.p)), 5000)), c = steer(s, away);
		return {pitch: c.pitch, yaw: c.yaw, roll: c.roll, throttle: 1, fire: false};
	}
	if (A.mode == 'attack' && target) {
		const W = WEAPONS[(me.cs.load.guns[0] || {kind: 'pulse'}).kind], aim = lead(s.p, s.v, target.p, target.v, W.speed), dist = len(sub(target.p, s.p));
		let c = steer(s, aim);
		/* too close: break off past them, then come round */
		if (dist < 350) { A.breakUntil = t + 2.5 }
		if (t < (A.breakUntil || 0)) { const out = add(s.p, add(mul(Fl.forward(s), 2000), mul(Fl.toWorld(s.q, [0, 1, 0]), 800))); c = steer(s, out) }
		if (t < (A.jinkUntil || 0)) { c.pitch = clamp(c.pitch + A.jinkDir[0], -1, 1); c.yaw = clamp(c.yaw + A.jinkDir[1] * 0.5, -1, 1) }
		/* far: close at full speed; near: match the target's speed, plus a little to hold about 600 m, so the turn
		   circle stays tight enough to keep the nose on it */
		const vmax = (s.spec && s.spec.vmax) || 300, want = len(target.v) + (dist - 600) * 0.25;
		const throttle = dist > 2500 ? 1 : clamp(want / vmax, 0.08, 1);
		const fire = c.off < (COMBAT.gimbal + 2) * Math.PI / 180 && dist < W.range && t >= (A.breakUntil || 0);
		return {pitch: c.pitch, yaw: c.yaw, roll: c.roll, throttle, fire, missile: dist < WEAPONS.missile.range && dist > 800};
	}
	if (A.mode == 'hold') return {pitch: 0, yaw: 0, roll: 0.05, throttle: 0, fire: !!target && me.cs.load.turrets};
	/* patrol, trade, or nothing to fight: fly towards home, slowing near it, and circle */
	if (!home) return {pitch: 0, yaw: 0, roll: 0, throttle: 0.4, fire: false};
	const d = len(sub(home, s.p)), around = d < 1500 ? add(home, mul(Fl.toWorld(s.q, [1, 0, 0]), 3000)) : home, c = steer(s, around, 0.6);
	return {pitch: c.pitch, yaw: c.yaw, roll: c.roll, throttle: A.mode == 'trade' ? 0.8 : d > 3000 ? 0.7 : 0.35, fire: false};
}

/* ---------- between flights: what a ship carries over (hull as a share, ammunition), and restocking ---------- */
function keep(cs) { return {hull: +(cs.hull / cs.hullMax).toFixed(4), ammo: cs.load.guns.map(g => g.ammo), missiles: cs.load.missiles, flares: cs.load.flares} }
function restore(cs, k) {
	if (!k) return cs;
	if (typeof k.hull == 'number') cs.hull = Math.max(1, Math.min(1, k.hull) * cs.hullMax);
	if (Array.isArray(k.ammo)) cs.load.guns.forEach((g, i) => { if (g.ammo != null && typeof k.ammo[i] == 'number') g.ammo = Math.max(0, Math.min(WEAPONS[g.kind].ammo, k.ammo[i])) });
	if (typeof k.missiles == 'number') cs.load.missiles = Math.max(0, Math.min(cs.load.missiles, k.missiles));
	if (typeof k.flares == 'number') cs.load.flares = Math.max(0, Math.min(COMBAT.flares, k.flares));
	return cs;
}
/* munitions to fill up, in tonnes: 150 mass-driver rounds a tonne, a torpedo a tonne, a missile a quarter, a flare 1/20 */
function missing(ship, k) {
	const full = loadout(ship), cur = k || {};
	let t = 0;
	full.guns.forEach((g, i) => { if (g.ammo != null) { const have = cur.ammo && typeof cur.ammo[i] == 'number' ? cur.ammo[i] : g.ammo; t += (g.ammo - have) * (g.kind == 'torpedo' ? 1 : 1 / 150) } });
	t += (full.missiles - (cur.missiles != null ? cur.missiles : full.missiles)) * 0.25 + (full.flares - (cur.flares != null ? cur.flares : full.flares)) * 0.05;
	return Math.max(0, t);
}
function refill(ship, k) { const full = loadout(ship); return {hull: k && typeof k.hull == 'number' ? k.hull : 1, ammo: full.guns.map(g => g.ammo), missiles: full.missiles, flares: full.flares} }

const EmberCombat = {keep, restore, missing, refill, WEAPONS, COMBAT, loadout, state, damage, tick, lead, fire, updateLock, launch, flare, stepProjectiles, steer, think, v: {add, sub, mul, dot, len, norm}};
if (isNode) module.exports = EmberCombat; else root.EmberCombat = EmberCombat;
})(typeof window != 'undefined' ? window : this);
