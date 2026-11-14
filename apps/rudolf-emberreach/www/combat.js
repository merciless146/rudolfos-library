/* ===== Ember Reach: combat (docs/plan-ember-reach.md, "Combat", M4).
   Ships fight with what their hardpoints carry (the weapons rework, 0.3.1):
   - lasers (pulse, heavy, Precursor needle and lance, mining) are hitscan: a beam that lands the instant it fires,
     out to its range, on the first thing in its way. Better against shields, and they make heat;
   - gatlings (small, medium, large): a stream of rounds, better against hulls, on ammunition;
   - the mass driver (medium): equal against shields and hulls. Holding the trigger charges it,
     letting go fires; a shot let go early is weaker, and one held past full charge heats the ship;
   - missile racks (medium) and torpedo racks (huge): homing, on a lock.
   Mounts: lasers, gatlings and needles come fixed or gimballed. Fixed guns fire along the nose: the HUD shows the
   point to aim at. Gimballed guns track a target by themselves within a circle about 40% of the screen across
   (an angle from the field of view), for 15% less damage and half again the price. Projectile guns aim where the
   target will be: its course, speed and turn (its acceleration) against the shot's flight time; lasers just aim at
   it. The mass driver, lance, missiles and torpedoes have one mount. Flagships' guns are turrets.
   Heat: a hot ship is easier to lock: missile and torpedo locks reach further and come sooner the hotter it runs.
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
	pulse: {name: 'Pulse laser', size: 0, dmg: 1.2, rate: 6, hitscan: true, range: 2500, heat: 0.022, vsShield: 1.2, vsHull: 0.7, ammo: null, col: [1, 0.45, 0.25], beam: 0.07},
	/* the mass driver: dmg at full charge (charge s); a shot let go
	   early hits for its share of the charge (at least minCharge); held past full, holdHeat a second; recover s between */
	driver: {name: 'Mass driver', size: 1, dmg: 9, rate: 4, charge: 0.6, minCharge: 0.15, holdHeat: 0.3, speed: 6000, range: 4000, heat: 0.02, vsShield: 1, vsHull: 1, ammo: 150, perTon: 150, col: [0.55, 0.85, 1]},
	heavy: {name: 'Heavy laser', size: 2, dmg: 9, rate: 1.5, hitscan: true, range: 4000, heat: 0.08, vsShield: 1.2, vsHull: 0.8, ammo: null, col: [0.5, 0.8, 1], beam: 0.12},
	/* gatlings: a stream of rounds, better against hulls */
	gatling: {name: 'Light gatling', size: 0, dmg: 0.5, rate: 14, speed: 2200, range: 2200, heat: 0.004, vsShield: 0.6, vsHull: 1.4, ammo: 1500, perTon: 1500, col: [1, 0.8, 0.45]},
	gatlingM: {name: 'Gatling', size: 1, dmg: 0.9, rate: 12, speed: 2200, range: 2600, heat: 0.005, vsShield: 0.6, vsHull: 1.4, ammo: 2000, perTon: 1000, col: [1, 0.8, 0.45]},
	gatlingL: {name: 'Heavy gatling', size: 2, dmg: 1.6, rate: 10, speed: 2400, range: 3000, heat: 0.007, vsShield: 0.6, vsHull: 1.4, ammo: 2500, perTon: 800, col: [1, 0.8, 0.45]},
	torpedo: {name: 'Torpedo rack', size: 3, dmg: 150, rate: 0.2, speed: 400, range: 9000, heat: 0, vsShield: 0.8, vsHull: 1.6, ammo: 8, perTon: 1, homing: 1.2, col: [1, 1, 0.9]},
	mining: {name: 'Mining laser', size: 0, dmg: 0.4, rate: 4, hitscan: true, beam: 0.05, range: 600, heat: 0.008, vsShield: 0.5, vsHull: 0.5, ammo: null, col: [0.45, 1, 0.55]},
	/* Precursor work (outfit.js): hits like the next size up, and runs cool */
	needle: {name: 'Precursor needle', size: 0, dmg: 3, rate: 6, hitscan: true, beam: 0.05, range: 3000, heat: 0.012, vsShield: 1.2, vsHull: 1.1, ammo: null, col: [0.75, 0.55, 1]},
	lance: {name: 'Precursor lance', size: 2, dmg: 26, rate: 1.5, hitscan: true, beam: 0.12, range: 5000, heat: 0.05, vsShield: 1.2, vsHull: 1.2, ammo: null, col: [0.85, 0.6, 1]},
	/* the Interstellar Marshals' (encounters.js): each hit also cuts into the shield generator itself, shields up or
	   not, a twenty-fifth of it, so a wing's disruptors put shields out in seconds */
	disruptor: {name: 'Marshal disruptor', size: 1, dmg: 5, rate: 2, speed: 3500, range: 3500, heat: 0.01, vsShield: 1, vsHull: 1, ammo: null, col: [0.4, 0.9, 1], module: 'shields', moduleShare: 0.04},
	missile: {name: 'Missile', size: -1, dmg: 30, rate: 1, speed: 600, range: 7000, heat: 0, vsShield: 1, vsHull: 1.5, ammo: 4, homing: 2.2, col: [1, 1, 1]}};
const BY_SIZE = ['pulse', 'driver', 'heavy', 'torpedo'];
/* gimballed mounts: their module ids (outfit.js), the gun each carries */
const GIMBALLED = {pulseG: 'pulse', heavyG: 'heavy', needleG: 'needle', gatlingG: 'gatling', gatlingMG: 'gatlingM', gatlingLG: 'gatlingL'};
const gunOf = id => GIMBALLED[id] ? {kind: GIMBALLED[id], mount: 'gimbal'} : {kind: id, mount: 'fixed'};
/* the gimbal's reach: a circle 40% of the screen's height across, as an angle (degrees) at a field of view */
const gimbalFor = fov => Math.atan(0.4 * Math.tan((fov || 70) / 2 * Math.PI / 180)) * 180 / Math.PI;
/* gimbalDmg: a gimballed gun's damage; heatLock: how much further and sooner a hot target is locked (at full heat:
   twice as far, in half the time) */
const COMBAT = {gimbalDmg: 0.85, gimbalDeg: gimbalFor(70), heatLock: 1, lockCone: 15, lockTime: 2, flares: 6, flareChance: 0.7, regenDelay: 2.5, regenTime: 15, coolRate: 0.12, overheat: 1, cooled: 0.6, cookRate: 4, moduleShare: 0.6};

/* a ship's guns from its hardpoints [S, M, L, H]; each medium mount also carries a missile pylon */
function loadout(ship) {
	/* a fitted ship (outfit.js) carries what its external modules are; missile racks hold four missiles each */
	if (ship.guns) {
		const guns = ship.guns.filter(k => k != 'missile').map(k => { const g = gunOf(k); return {kind: g.kind, mount: g.mount, cool: 0, ammo: WEAPONS[g.kind].ammo} });
		return {guns, missiles: ship.guns.filter(k => k == 'missile').length * WEAPONS.missile.ammo, flares: COMBAT.flares, turrets: ship.size == 'Capital'};
	}
	const guns = [], h = ship.hard || [0, 0, 0, 0];
	/* (unfitted AI ships: by hardpoint size, every other small and large one a gatling; their guns gimballed) */
	h.forEach((n, size) => { for (let k = 0; k < n; k++) { const kind = k % 2 && size == 0 ? 'gatling' : k % 2 && size == 2 ? 'gatlingL' : BY_SIZE[size]; guns.push({kind, mount: WEAPONS[kind].charge || kind == 'torpedo' ? 'fixed' : 'gimbal', cool: 0, ammo: WEAPONS[kind].ammo}) } });
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
/* where to aim: the point to send a shot of this speed at (it carries the shooter's own velocity) so it meets the
   target. From the distance and the relative velocity (a straight course), then, if the target's acceleration is
   known (toA: its turn and thrust, from track), along its curving path: t again from where it will be, a few times.
   No speed (a laser): the target itself */
function lead(from, fromV, to, toV, speed, toA) {
	if (!speed) return to;
	const r = sub(to, from), v = sub(toV, fromV), a = dot(v, v) - speed * speed, b = 2 * dot(r, v), c = dot(r, r);
	let t;
	if (Math.abs(a) < 1e-9) t = -c / b; else { const d = b * b - 4 * a * c; if (d < 0) return to; const s = Math.sqrt(d), t1 = (-b - s) / (2 * a), t2 = (-b + s) / (2 * a); t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2) }
	if (!(t > 0)) return to;
	const at = tt => add(add(r, mul(v, tt)), toA ? mul(toA, 0.5 * tt * tt) : [0, 0, 0]);
	if (toA && dot(toA, toA) > 1e-6) for (let k = 0; k < 4; k++) t = len(at(t)) / speed;
	return add(from, at(t));
}
/* a ship's acceleration, for others' aim: smoothed from its velocity a step at a time (capped at 30 g) */
function track(s, dt) {
	if (!s.vLast) { s.vLast = s.v.slice(); s.acc = [0, 0, 0]; return }
	let a = mul(sub(s.v, s.vLast), 1 / Math.max(dt, 1e-3)); const la = len(a); if (la > 300) a = mul(a, 300 / la);
	const k = Math.min(1, dt * 6); s.acc = add(mul(s.acc, 1 - k), mul(a, k)); s.vLast = s.v.slice();
}
/* where one gun points: along the nose (fixed), at the target's lead within the gimbal (gimballed), anywhere
   (turrets). gimbalDeg: the reach (the player's from the field of view) */
function aimOf(cs, s, g, target) {
	const nose = Fl.forward(s), W = WEAPONS[g.kind];
	if (!target || (g.mount != 'gimbal' && !cs.load.turrets)) return {dir: nose, tracking: false};
	const L = norm(sub(lead(s.p, s.v, target.p, target.v, W.hitscan ? 0 : W.speed, target.a), s.p));
	if (cs.load.turrets || Math.acos(clamp(dot(L, nose), -1, 1)) * 180 / Math.PI < (cs.gimbalDeg || COMBAT.gimbalDeg)) return {dir: L, tracking: true};
	return {dir: nose, tracking: false};
}
function shoot(cs, s, g, W, dir, out, k) {
	const origin = add(s.p, mul(dir, s.radius * 1.2)), dmg = W.dmg * (cs.dmgK || 1) * (g.mount == 'gimbal' ? COMBAT.gimbalDmg : 1) * (k == null ? 1 : k);
	/* a laser: a ray, settled in the next step (stepProjectiles); anything else flies */
	if (W.hitscan) out.push({kind: g.kind, p: origin, dir, range: W.range, ray: true, ttl: 1, dmg, owner: cs.id, target: null});
	else out.push({kind: g.kind, p: origin, v: add(s.v, mul(dir, W.speed)), ttl: W.range / W.speed, dmg, owner: cs.id, target: null});
	if (g.ammo != null) g.ammo--;
}
/* fire the guns that are ready, as projectiles from a ship (s: flight state, radius), towards a target (or straight
   ahead). Guns aim along the nose, or at the target's lead within the gimbal; turrets aim anywhere */
/* only: the kinds of gun to fire (Analysis mode: the mining lasers), all if omitted */
function fire(cs, s, t, target, out, only) {
	if (cs.hot || !M.works(cs.fit, 'weapons') || !M.works(cs.fit, 'power')) return 0;
	const nose = Fl.forward(s); let n = 0;
	for (const g of cs.load.guns) {
		if (only && !only.includes(g.kind)) continue;
		const W = WEAPONS[g.kind];
		if (g.cool > 0 || W.homing || W.charge || (g.ammo != null && g.ammo <= 0)) continue;
		shoot(cs, s, g, W, aimOf(cs, s, g, target).dir, out);
		g.cool = 1 / W.rate; cs.heat += W.heat; n++;
	}
	return n;
}
/* mass drivers, every step: holding the trigger charges them; letting go fires each charged one (its share of the
   charge, if at least minCharge); held past full, they heat the ship. A hot ship, or broken weapons, lose the charge */
function railStep(cs, s, t, target, out, holding, dt) {
	let n = 0;
	const able = !cs.hot && M.works(cs.fit, 'weapons') && M.works(cs.fit, 'power');
	for (const g of cs.load.guns) {
		const W = WEAPONS[g.kind]; if (!W.charge) continue;
		if (!able || (g.ammo != null && g.ammo <= 0)) { g.charge = 0; continue }
		if (holding && g.cool <= 0) { g.charge = (g.charge || 0) + dt; if (g.charge > W.charge) cs.heat += W.holdHeat * dt; continue }
		if (!g.charge) continue;
		const k = Math.min(1, g.charge / W.charge); g.charge = 0;
		if (k < W.minCharge) continue;
		shoot(cs, s, g, W, aimOf(cs, s, g, target).dir, out, k);
		g.cool = 1 / W.rate; cs.heat += W.heat; n++;
	}
	return n;
}
/* whether the mass drivers are at full charge (AI pilots let go then) */
const railReady = cs => cs.load.guns.some(g => WEAPONS[g.kind].charge && g.charge >= WEAPONS[g.kind].charge);
/* the heat a target runs at stretches a lock: range and speed times (1 + heat) */
const heatK = target => 1 + COMBAT.heatLock * clamp(target.heat || 0, 0, 1);
/* missiles: once locked (target in the 15° cone for 2 s), one per press; torpedo racks fire with them */
function updateLock(cs, s, target, dt) {
	if (!target) { cs.lock = {id: null, t: 0}; return false }
	const ang = Math.acos(clamp(dot(norm(sub(target.p, s.p)), Fl.forward(s)), -1, 1)) * 180 / Math.PI, dist = len(sub(target.p, s.p));
	if (ang < COMBAT.lockCone && dist < WEAPONS.missile.range * heatK(target)) { if (cs.lock.id != target.id) cs.lock = {id: target.id, t: 0}; cs.lock.t += dt * heatK(target) } else cs.lock = {id: null, t: 0};
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
/* beams: where lasers' rays went this step, for drawing ([{a, b, kind}]) */
function stepProjectiles(list, ships, dt, beams) {
	const hits = [];
	for (let i = list.length - 1; i >= 0; i--) {
		const m = list[i], W = WEAPONS[m.kind];
		/* a laser's ray: the nearest ship along it, out to its range */
		if (m.ray) {
			let hit = null, best = m.range;
			for (const x of ships) {
				if (x.id == m.owner || x.cs.dead) continue;
				const r = x.s.radius * 0.85, d = sub(x.s.p, m.p), along = dot(d, m.dir); if (along < 0 || along - r > best) continue;
				const q = sub(d, mul(m.dir, along)), q2 = dot(q, q); if (q2 >= r * r) continue;
				const at = Math.max(0, along - Math.sqrt(r * r - q2)); if (at < best) { best = at; hit = x }
			}
			const end = add(m.p, mul(m.dir, best));
			if (beams) beams.push({a: m.p, b: end, kind: m.kind});
			list.splice(i, 1);
			if (hit) { m.p = end; hits.push({proj: m, ship: hit}) }
			continue;
		}
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
/* below a world's Kármán line (landing L1.5): flight assist already holds a ship against the world's gravity; an AI
   pilot also keeps 450 m off the ground (the safety in play.js holds every ship at 300 m), lifting on its vertical
   thrusters, harder the lower, easing off the throttle and pulling up while its nose points down; falling, it
   reckons by where it could stop. Pirates chase a landed pilot
   down to there, but don't land. up: the world's up at the ship; alt: its height over the ground */
const GROUND = {keep: 450, ramp: 150};
function groundKeep(s, up, alt, c) {
	/* (falling, it looks ahead by its stopping distance on the thrusters it has, less the pull, and half a second more) */
	const vz = s.v[0] * up[0] + s.v[1] * up[1] + s.v[2] * up[2], g = s.grav ? Math.hypot(...s.grav) : 0, brake = Math.max(1, Math.max(s.spec.aRcs, s.spec.aRetro) - g);
	const ahead = alt - (vz < 0 ? vz * vz / (2 * brake) - vz * 0.5 : 0);
	if (!(ahead < GROUND.keep)) return {strafe: [0, 0], throttle: c.throttle};
	const ub = Fl.toBody(s.q, up), k = Math.min(1, (GROUND.keep - ahead) / GROUND.ramp);
	const out = {strafe: [ub[0] * k, ub[1] * k], throttle: ub[2] < 0 ? c.throttle * Math.max(0, 1 + 2 * ub[2]) : c.throttle};
	/* nose down, it pulls up toward the horizon (its retros alone may not hold it): pitch, and yaw, the nose toward up */
	if (ub[2] < 0.2) { const cl = v => Math.max(-1, Math.min(1, v)); out.pitch = -cl(Math.abs(ub[1]) < 0.05 && Math.abs(ub[0]) < 0.05 ? 1 : ub[1] * 3); out.yaw = cl(ub[0] * 3) }
	return out;
}
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
		const g0 = me.cs.load.guns.find(g => !WEAPONS[g.kind].homing) || {kind: 'pulse', mount: 'fixed'}, W = WEAPONS[g0.kind], aim = lead(s.p, s.v, target.p, target.v, W.hitscan ? 0 : W.speed, target.a), dist = len(sub(target.p, s.p));
		let c = steer(s, aim);
		/* too close: break off past them, then come round */
		if (dist < 350) { A.breakUntil = t + 2.5 }
		if (t < (A.breakUntil || 0)) { const out = add(s.p, add(mul(Fl.forward(s), 2000), mul(Fl.toWorld(s.q, [0, 1, 0]), 800))); c = steer(s, out) }
		if (t < (A.jinkUntil || 0)) { c.pitch = clamp(c.pitch + A.jinkDir[0], -1, 1); c.yaw = clamp(c.yaw + A.jinkDir[1] * 0.5, -1, 1) }
		/* far: close at full speed; near: match the target's speed, plus a little to hold about 600 m, so the turn
		   circle stays tight enough to keep the nose on it */
		const vmax = (s.spec && s.spec.vmax) || 300, want = len(target.v) + (dist - 600) * 0.25;
		const throttle = dist > 2500 ? 1 : clamp(want / vmax, 0.08, 1);
		/* (a gimballed gun fires once the target is inside its circle; a fixed one once the nose is within 2°) */
		const fire = c.off < (g0.mount == 'gimbal' ? COMBAT.gimbalDeg : 2) * Math.PI / 180 && dist < W.range && t >= (A.breakUntil || 0);
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
/* munitions to fill up, in tonnes: 150 mass-driver slugs a tonne, gatling rounds 1,500 (light) to 800 (heavy) a tonne, a
   torpedo a tonne, a missile a quarter, a flare 1/20 */
function missing(ship, k) {
	const full = loadout(ship), cur = k || {};
	let t = 0;
	full.guns.forEach((g, i) => { if (g.ammo != null) { const have = cur.ammo && typeof cur.ammo[i] == 'number' ? cur.ammo[i] : g.ammo; t += (g.ammo - have) / (WEAPONS[g.kind].perTon || 150) } });
	t += (full.missiles - (cur.missiles != null ? cur.missiles : full.missiles)) * 0.25 + (full.flares - (cur.flares != null ? cur.flares : full.flares)) * 0.05;
	return Math.max(0, t);
}
function refill(ship, k) { const full = loadout(ship); return {hull: k && typeof k.hull == 'number' ? k.hull : 1, ammo: full.guns.map(g => g.ammo), missiles: full.missiles, flares: full.flares} }

const EmberCombat = {GIMBALLED, gunOf, gimbalFor, track, aimOf, railStep, railReady, heatK, GROUND, groundKeep, keep, restore, missing, refill, WEAPONS, COMBAT, loadout, state, damage, tick, lead, fire, updateLock, launch, flare, stepProjectiles, steer, think, v: {add, sub, mul, dot, len, norm}};
if (isNode) module.exports = EmberCombat; else root.EmberCombat = EmberCombat;
})(typeof window != 'undefined' ? window : this);
