/* ===== Ember Reach: the flight screen (M1: fly a ship in one system, and dock).
   Ties the models together: the system (scene.js), the ship (flight.js, with flight assist), its modules and the
   pilot under g (modules.js, pilot.js), the renderer (render.js) and the HUD (hud.js), on gamekit's fixed 60 Hz
   loop. Controls: keyboard, mouse, gamepad and touch, all at once.
   URL options: ?power=N (whose home system), ?port=trefoil|bloom|lantern|halo, ?ship=wren|kestrel|…, ?day=N,
   ?canvas (force the Canvas 2D fallback), ?quality=low|high, ?debug (B breaks a module, G breaks the canopy, spawn=N starts N metres off the mouth).
   Level of detail, to keep the frame rate up: planets and stars are lit sprites until they're 48 pixels across;
   stations are a detailed mesh within 20 km, a simple one to 500 km, and a sprite beyond; ships are always drawn
   in full at the graphics setting.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const G = window.EmberGalaxy, F = window.EmberFactions, S = window.EmberShips, Fl = window.EmberFlight, M = window.EmberModules,
	Pi = window.EmberPilot, Sc = window.EmberScene, Me = window.EmberMeshes, Re = window.EmberRender, H = window.EmberHUD, RG = window.RG;
const {add, sub, mul, dot, len, norm, cross} = Sc.v;
const Q = new URLSearchParams(location.search), DEBUG = Q.has('debug');
const $ = id => document.getElementById(id);
const LOD = {spritePx: 48, stationHi: 20000, stationLo: 500000};
let quality = Q.get('quality') == 'low' ? 'low' : 'high';
const gl = $('gl'), hud = $('hud');

const KEYS = {
	pitchDown: ['ArrowUp', 'KeyW'], pitchUp: ['ArrowDown', 'KeyS'], rollLeft: ['ArrowLeft'], rollRight: ['ArrowRight'],
	yawLeft: ['KeyA', 'pad:4'], yawRight: ['KeyD', 'pad:5'], faster: ['KeyR', 'Equal', 'NumpadAdd'], slower: ['KeyF', 'Minus', 'NumpadSubtract'], stop: ['KeyX', 'Backspace'],
	strafeL: ['KeyJ', 'pad:14'], strafeR: ['KeyL', 'pad:15'], strafeU: ['KeyI', 'pad:12'], strafeD: ['KeyK', 'pad:13'],
	fa: ['KeyZ', 'pad:1'], cruise: ['KeyC', 'pad:3'], target: ['KeyT', 'Tab', 'pad:2'], dock: ['KeyN', 'pad:0'], view: ['KeyV', 'pad:8'],
	systems: ['KeyO'], mouse: ['KeyM'], help: ['KeyH', 'F1'], pause: ['KeyP', 'Escape', 'pad:9'],
	dbgBreak: ['KeyB'], dbgCanopy: ['KeyG']};
const HELP = [['↑ ↓  or  W S', 'pitch (nose down / up)'], ['← →', 'roll'], ['A D', 'yaw'], ['R F', 'throttle up / down (FA on: a set speed; FA off: thrust)'], ['X', 'throttle to zero'],
	['J L I K', 'strafe left / right / up / down'], ['Z', 'flight assist on / off'], ['C', 'cruise (out of a port\'s 20 km mass lock)'], ['T  or  Tab', 'next target'],
	['N', 'request docking clearance (within 10 km of the port)'], ['V', 'cockpit / chase view'], ['O', 'internal systems'], ['M', 'mouse flight (pointer from the centre: pitch and roll)'],
	['P  or  Esc', 'pause'], ['Gamepad', 'left stick pitch and roll, right stick yaw and strafe, triggers throttle, A dock, B FA, X target, Y cruise']];

let W = 1, Hh = 1, view = null, R = null, scene = null, st = null, ship = null, s = null, fit = null, pilot = null;
const game = {t: 0, cruise: {on: false, v: 0, charge: 0}, throttle: 0, target: 0, clearance: null, docked: false, chase: false, systems: false, mouseFly: false, msgs: [], vision: null, gFelt: null, lastStep: null, axes: {pitch: 0, roll: 0, yaw: 0}, ptr: null, touch: {stick: null, dx: 0, dy: 0, thr: null}};
const say = (text, col) => { game.msgs.push({text, col, t: game.t}); if (game.msgs.length > 12) game.msgs.shift() };

/* ---------------- start ---------------- */
async function start() {
	await RG.init('ember-reach');
	RG.bind(KEYS);
	const majors = F.majors(), home = majors[Math.max(0, Math.min(majors.length - 1, +(Q.get('power') || 0)))];
	ship = S.ships().find(x => x.id == (Q.get('ship') || 'wren')) || S.ships()[0];
	scene = Sc.build(home.star, {day: +(Q.get('day') || 200), port: Sc.STATION[Q.get('port')] ? Q.get('port') : 'halo'});
	st = scene.station;
	game.home = home;
	/* renderer and meshes */
	R = Re.create(gl, {canvas2d: Q.has('canvas')});
	meshes();
	view = RG.fit(hud, (w, h) => ({w, h}));
	RG.on('resize', v => { W = v.w; Hh = v.h; const d = v.dpr; gl.width = Math.round(v.cw * d); gl.height = Math.round(v.ch * d) });
	view.refit();
	pointers();
	launch(true);
	$('load').remove();
	say('Rendering with ' + (R.kind == 'webgl' ? 'WebGL 2' : 'Canvas 2D (fallback)'), '#9fb0cc');
	say('Press H for the controls', '#9fb0cc');
	RG.onPause(() => { if (!$('ov').hidden) return; overlay('pause') });
	RG.loop(update, draw);
	hud.focus();
}
/* every mesh, at the graphics setting */
function meshes() {
	for (const b of scene.bodies) R.upload(b.name, b.kind == 'star' ? Me.star(b.T, quality) : Me.planet(b, quality));
	for (const det of ['hi', 'lo']) Me.station(st.def, st.parts, det).forEach(g => R.upload('station:' + det + ':' + g.spin, g.mesh));
	R.upload('ship', Me.ship(ship.length, quality));
	R.setSky(sky(game.home.star));
}
/* the sky: real neighbours within 30 pc, by their light (the brighter ones only on low); and the glow of the
   galaxy's core */
function sky(home) {
	const out = [];
	for (const x of G.starsNear(home.x, home.y, home.z, 30)) {
		if (x.id == home.id || x.d < 1e-6) continue;
		const flux = Math.max(1e-9, (x.L || 0.001) / (x.d * x.d)), lg = Math.log10(flux);
		if (lg < (quality == 'low' ? -5.6 : -6.3)) continue;
		const c = Me.starColour(x.T), b = Math.max(0.12, Math.min(1, (lg + 6.3) / 5)), dir = norm([x.x - home.x, x.y - home.y, x.z - home.z]);
		out.push(dir[0], dir[1], dir[2], c[0] * b, c[1] * b, c[2] * b, Math.max(1, Math.min(4, 1 + (lg + 4) * 0.8)));
	}
	game.coreDir = norm([-home.x, -home.y, -home.z]);
	return out;
}

/* a fresh ship outside the port (or just launched from it) */
function launch(first) {
	const sp = Sc.spawn(scene, first ? (DEBUG && +Q.get('spawn') || 2500) : 30);
	s = Fl.create(ship, first ? sp : {p: sp.p, q: Sc.lookRotation(st.axis, st.y), v: mul(st.axis, 40)}); s.radius = Math.max(2, ship.length / 2);
	if (!first) s.q = Sc.lookRotation(st.axis, st.y);
	fit = fit || M.fit(ship); pilot = Pi.create(); M.apply(fit, s);
	game.cruise = {on: false, v: 0, charge: 0}; game.throttle = first ? 0 : 0.2; game.docked = false; game.target = 0; game.clearance = null;
	if (!first) say('Launched from ' + st.name + '. Fly safe.');
	else say('Holding 2.5 km off ' + st.name + '. Press N for docking clearance.');
}
const targets = () => [st, ...scene.bodies.filter(b => b.kind == 'planet'), ...scene.bodies.filter(b => b.kind == 'star')];
const posOf = x => x.pos || x.c;
const radiusOf = x => x.radius || x.def.radius;

/* ---------------- input ---------------- */
function readPad() {
	let g = null; try { g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean) } catch (e) {}
	if (!g) return null;
	const ax = i => { const v = g.axes[i] || 0; return Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88 };
	const bt = i => g.buttons[i] ? g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0) : 0;
	return {roll: -ax(0), pitch: ax(1), yaw: ax(2), strafeY: -ax(3), up: bt(7), down: bt(6)};
}
function controls(dt) {
	const ease = (cur, want, k) => cur + (want - cur) * Math.min(1, k * dt);
	const d = a => RG.down(a) ? 1 : 0;
	const A = game.axes;
	A.pitch = ease(A.pitch, d('pitchDown') - d('pitchUp'), 6); A.roll = ease(A.roll, d('rollLeft') - d('rollRight'), 6); A.yaw = ease(A.yaw, d('yawRight') - d('yawLeft'), 6);
	let pitch = A.pitch, roll = A.roll, yaw = A.yaw, sx = d('strafeR') - d('strafeL'), sy = d('strafeU') - d('strafeD'), thr = 0;
	const pad = readPad();
	if (pad) { pitch += pad.pitch; roll += pad.roll; yaw += pad.yaw; sy += pad.strafeY; thr += pad.up - pad.down }
	if (game.mouseFly && game.ptr && !game.ptr.touch) { const mx = (game.ptr.x - W / 2) / (W / 2), my = (game.ptr.y - Hh / 2) / (Hh / 2), dz = v => Math.abs(v) < 0.06 ? 0 : v; roll -= dz(mx) * 1.4; pitch += dz(my) * 1.4 }
	const T = game.touch;
	if (T.stick) { pitch += T.dy; roll -= T.dx }
	thr += d('faster') - d('slower');
	if (s.fa || game.cruise.on) {
		game.throttle = Math.max(game.cruise.on ? 0 : -0.3, Math.min(1, game.throttle + thr * 0.6 * dt));
		if (T.thr != null) game.throttle = T.thr;
		if (RG.pressed('stop')) game.throttle = 0;
	} else game.throttle = Math.max(-1, Math.min(1, T.thr != null ? T.thr * 2 - 1 : thr));
	const c = v => Math.max(-1, Math.min(1, v));
	return {pitch: c(pitch), roll: c(roll), yaw: c(yaw), strafe: [c(sx), c(sy)], throttle: game.throttle, thrust: s.fa ? 0 : game.throttle};
}
function actions() {
	const T = targets();
	if (RG.pressed('help')) overlay('help');
	if (RG.pressed('pause')) { RG.pause(); return }
	if (RG.pressed('view')) game.chase = !game.chase;
	if (RG.pressed('systems')) game.systems = !game.systems;
	if (RG.pressed('mouse')) { game.mouseFly = !game.mouseFly; say('Mouse flight ' + (game.mouseFly ? 'on: point away from the centre to pitch and roll' : 'off')) }
	if (game.docked) return;
	if (!pilot.conscious) return;
	if (RG.pressed('fa')) { Fl.setAssist(s, !s.fa); game.throttle = s.fa ? Math.min(1, len(s.v) / s.spec.vmax) : 0; say('Flight assist ' + (s.fa ? 'on' : 'off'), s.fa ? '#6cc9e8' : '#f2a33a') }
	if (RG.pressed('target')) { game.target = (game.target + 1) % T.length; say('Target: ' + T[game.target].name) }
	if (RG.pressed('dock')) requestDock();
	if (RG.pressed('cruise')) toggleCruise();
	if (DEBUG && RG.pressed('dbgBreak')) { const h = M.hit(fit, 1e6, Math.random()); if (h.alert) say(h.alert.text, h.alert.color) }
	if (DEBUG && RG.pressed('dbgCanopy')) { const a = M.damage(fit, 'canopy', 1e6); if (a) say(a.text, a.color) }
}
function requestDock() {
	const d = len(sub(s.p, st.c));
	if (d > 10000) { say('Docking clearance is given within 10 km of the port (' + H.fmtDist(d) + ' now)', '#f2a33a'); return }
	if (game.clearance) { say('Clearance already granted: pad ' + game.clearance.pad); return }
	game.clearance = {pad: 1 + Math.floor(Math.random() * 24), until: game.t + 600};
	game.target = 0;
	const D = st.def.dock;
	say(st.name + ': clearance granted, pad ' + game.clearance.pad + '. Approach along the axis' + (D.spins ? ', and match our spin.' : '.'), '#7fd1a8');
}
function toggleCruise() {
	const cz = game.cruise;
	if (cz.on) { const r = Sc.dropOut(s, cz); cz.on = false; game.throttle = Math.min(1, len(s.v) / s.spec.vmax); say(r.emergency ? 'Emergency drop out: the drive took a knock' : 'Dropped out of cruise', r.emergency ? '#f2a33a' : undefined); if (r.emergency) damage(25); return }
	if (cz.charge > 0) { cz.charge = 0; say('Cruise cancelled'); return }
	if (Sc.massLocked(scene, s.p)) { say('Mass locked by ' + st.name + ': cruise needs 20 km clear', '#f2a33a'); return }
	if (!M.status(fit).output.main) { say('Cruise needs working engines', '#e5484d'); return }
	cz.charge = Sc.CRUISE.charge; say('Cruise charging…', '#6cc9e8');
}

/* ---------------- the step ---------------- */
function damage(amount) {
	let left = amount;
	while (left > 0) { const h = M.hit(fit, Math.min(left, 12), Math.random()); left -= 12; if (h.alert) say(h.alert.text, h.alert.color) }
}
function update(dt) {
	if (!s) return;
	actions();
	if (game.docked) { RG.frame && 0; return }
	game.t += dt;
	if (game.clearance && game.t > game.clearance.until) { game.clearance = null; say('Docking clearance expired') }
	M.apply(fit, s);
	const input = Pi.controls(pilot, controls(dt)), cz = game.cruise;
	let r = null;
	if (cz.charge > 0) {
		cz.charge -= dt;
		if (Sc.massLocked(scene, s.p)) { cz.charge = 0; say('Cruise interrupted: mass locked', '#f2a33a') }
		else if (cz.charge <= 0) { cz.on = true; cz.v = len(s.v); game.throttle = Math.max(game.throttle, 0.5); say('Cruise engaged') }
	}
	if (cz.on) {
		const tgt = targets()[game.target];
		const res = Sc.cruiseStep(scene, s, cz, input, dt, tgt);
		if (res == 'drop') { const d = Sc.dropOut(s, cz); cz.on = false; game.throttle = Math.min(1, len(s.v) / s.spec.vmax); say('Dropped out near ' + Sc.nearest(scene, s.p).what.name + (d.emergency ? ' (emergency)' : '')); if (d.emergency) damage(25) }
		game.gFelt = null;
	} else {
		const frame = len(sub(s.p, st.c)) < 8000 ? Sc.frame(st) : null;
		r = Fl.step(s, input, dt, frame);
		const g = M.gForce(fit, r);
		game.gFelt = M.works(fit, 'canopy') ? null : g.felt;
		game.vision = Pi.step(pilot, g.felt, dt);
		if (!pilot.conscious && !game.wasOut) say('Pilot blacked out', '#e5484d');
		if (pilot.conscious && game.wasOut) say('Pilot conscious again', '#7fd1a8');
		game.wasOut = !pilot.conscious;
		/* docking */
		const dk = Sc.dockCheck(st, s, game.t, !!game.clearance);
		if (dk && dk.ok === true) { docked(); return }
		if (dk && dk.ok === false) {
			const why = {clearance: 'no docking clearance (press N)', speed: 'too fast (' + Math.round(dk.speed) + ' m/s, under ' + Sc.DOCK.speed + ')', align: 'nose not along the axis', spin: 'not turning with the port: match its spin'}[dk.why];
			const L = Sc.toLocal(st, s.p);
			if (L[2] < st.def.dock.z + s.radius) {
				const imp = Math.max(0, -dot(sub(s.v, Sc.frame(st).w.every(v => !v) ? [0, 0, 0] : cross(Sc.frame(st).w, sub(s.p, st.c))), st.axis));
				s.p = add(s.p, mul(st.axis, st.def.dock.z + s.radius + 1 - L[2])); s.v = add(s.v, mul(st.axis, imp * 1.3));
				if (!game.lastRefuse || game.t - game.lastRefuse > 2) say('Docking refused: ' + why, '#f2a33a'); game.lastRefuse = game.t;
				if (imp > 5) damage((imp - 5) * 0.6);
			}
		}
	}
	/* collisions */
	const hit = Sc.collide(scene, s, game.t);
	if (hit) {
		if (hit.kind == 'planet' || hit.kind == 'star') { say('Ship destroyed: ' + (hit.kind == 'star' ? 'flew into ' : 'hit ') + hit.what.name, '#e5484d'); fit = M.fit(ship); launch(true); return }
		const dmg = Sc.resolve(s, hit);
		if (dmg > 0) { say('Collision with ' + st.name + ' at ' + Math.round(hit.impact) + ' m/s', '#f2a33a'); damage(dmg) }
	}
	game.lastStep = r;
}
function docked() {
	game.docked = true; s.v = [0, 0, 0];
	overlay('docked');
}

/* ---------------- drawing ---------------- */
/* a planet's average colour, for its sprite and the Canvas fallback's disc */
function avgColour(b) {
	const f = Me.planetColour(b.type, b.seed), c = [0, 0, 0], r = G.rng(7); let n = 0;
	for (let k = 0; k < 200; k++) { const z = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - z * z), v = f([q * Math.cos(a), q * Math.sin(a), z]); c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; n++ }
	return c.map(x => x / n);
}
const mat3 = (x, y, z) => [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
function draw() {
	if (!s) return;
	const B = R.basis(s.q), cam = game.chase ? {p: add(add(s.p, mul(B.f, -ship.length * 3.2)), mul(B.u, ship.length * 0.9)), q: s.q} : {p: add(s.p, mul(B.f, ship.length * 0.3)), q: s.q};
	const sun = scene.bodies[0], items = [], glows = [], CB = R.basis(cam.q), kpx = Hh / 2 / Math.tan(35 * Math.PI / 180);
	/* how many pixels across a thing of radius r at p looks */
	const px = (p, r) => { const z = dot(sub(p, cam.p), CB.f); return z > 0 ? r / z * kpx : Infinity };
	game.lod = {sprites: 0, meshes: 0, station: ''};
	for (const b of scene.bodies) {
		const lightDir = norm(sub(sun.pos, b.pos)), rot = mat3([b.radius, 0, 0], [0, b.radius, 0], [0, 0, b.radius]);
		const far = px(b.pos, b.radius) < LOD.spritePx;
		if (b.kind == 'star') {
			const c = Me.starColour(b.T);
			items.push({id: b.name, pos: b.pos, rot, light: lightDir, amb: 1, disc: {radius: b.radius, col: c, glow: true}, sprite: far ? {radius: b.radius, col: c, glow: true} : null});
			glows.push({pos: b.pos, radius: b.radius, col: c, alpha: b.companion ? 0.5 : 0.9, scale: 7, min: b.companion ? 0.015 : 0.05});
		} else {
			const pal = b.pal || (b.pal = avgColour(b));
			items.push({id: b.name, pos: b.pos, rot, light: lightDir, disc: {radius: b.radius, col: pal}, sprite: far ? {radius: b.radius, col: pal} : null});
		}
		game.lod[far ? 'sprites' : 'meshes']++;
	}
	const sl = norm(sub(sun.pos, st.c)), sd = len(sub(st.c, cam.p));
	if (sd > LOD.stationLo) { items.push({id: 'station:far', pos: st.c, light: sl, sprite: {radius: st.def.radius * 0.4, col: [0.6, 0.62, 0.66]}}); game.lod.station = 'sprite' }
	else {
		const det = sd < LOD.stationHi ? 'hi' : 'lo'; game.lod.station = det;
		for (const sp of [1, -1, 0]) {
			const a = Sc.angleAt(st, game.t, sp), c = Math.cos(a), sn = Math.sin(a);
			items.push({id: 'station:' + det + ':' + sp, pos: st.c, rot: mat3(add(mul(st.x, c), mul(st.y, sn)), add(mul(st.x, -sn), mul(st.y, c)), st.axis), light: sl, amb: 0.12});
		}
	}
	if (game.chase) items.push({id: 'ship', pos: s.p, rot: mat3(B.r, B.u, B.f), light: norm(sub(sun.pos, s.p)), amb: 0.15});
	glows.push({pos: add(cam.p, mul(game.coreDir, 1e18)), radius: 1e16, col: [1, 0.85, 0.6], alpha: 0.22, scale: 1, min: 0.6});
	R.frame({cam, fov: 70, items, glows});
	gl.style.filter = game.vision && game.vision.blur > 0.01 && pilot.conscious ? 'blur(' + (game.vision.blur * 5).toFixed(1) + 'px)' : '';
	hudDraw(cam);
}
function project(cam, p) {
	const B = R.basis(cam.q), d = sub(p, cam.p), z = dot(d, B.f), fy = 1 / Math.tan(35 * Math.PI / 180), k = fy * Hh / 2;
	return {x: W / 2 + dot(d, B.r) * k / z, y: Hh / 2 - dot(d, B.u) * k / z, z, dx: dot(d, B.r), dy: -dot(d, B.u), k};
}
function hudDraw(cam) {
	const ctx = view.begin(), T = targets()[game.target], cz = game.cruise;
	const frame = len(sub(s.p, st.c)) < 8000 ? Sc.frame(st) : null, rel = Fl.relative(s, frame), speed = cz.on ? cz.v : len(rel.v);
	/* the target */
	const tp = posOf(T), pr = project(cam, tp), dist = len(sub(tp, s.p)) - (T == st ? 0 : radiusOf(T));
	const on = pr.z > 0 && pr.x > 0 && pr.x < W && pr.y > 0 && pr.y < Hh;
	const closing = -dot(sub(s.v, frame && T == st ? [0, 0, 0] : [0, 0, 0]), norm(sub(tp, s.p))) * -1;
	const target = {name: T.name, kind: T == st ? st.def.name + ' · ' + st.def.size : T.kind == 'planet' ? T.type + ' world' : 'star, class ' + (T.cls || ''), x: pr.x, y: pr.y, on, dist: Math.max(0, dist),
		size: on ? radiusOf(T) * pr.k / pr.z : 0, dx: pr.dx, dy: pr.dy, closing: dot(cz.on ? mul(Fl.forward(s), cz.v) : s.v, norm(sub(tp, s.p)))};
	if (T == st) target.dock = dockCues(rel);
	const vm = speed > 2 ? project(cam, add(cam.p, mul(norm(cz.on ? Fl.forward(s) : rel.v), 1e6))) : null;
	H.draw(ctx, W, Hh, {
		speed, vmax: s.spec.vmax, throttle: game.throttle, fa: s.fa, cruise: cz.on, charging: cz.charge > 0 ? cz.charge : 0, massLocked: !cz.on && Sc.massLocked(scene, s.p),
		target, prograde: vm ? {x: vm.x, y: vm.y, on: vm.z > 0} : null, alerts: M.alerts(fit), modules: fit.modules, showSystems: game.systems, shipName: ship.name,
		messages: game.msgs, vision: game.vision, gFelt: game.gFelt, reduceFlash: RG.reduceFlash, thrustNote: s.fa ? null : 'Thrust ' + Math.round(game.throttle * 100) + '%',
		touch: RG.lastInput == 'touch', touchUI: touchLayout()
	}, game.t);
}
function dockCues(rel) {
	const d = len(sub(s.p, st.c));
	if (!game.clearance) return d < 10000 ? {line1: 'Press N for docking clearance', col: '#f2a33a'} : {line1: 'Docking: clearance within 10 km', col: '#9fb0cc'};
	const L = Sc.toLocal(st, s.p), off = Math.hypot(L[0], L[1]), nose = -dot(Fl.forward(s), st.axis), sp = len(rel.v), D = st.def.dock;
	const tips = [];
	if (L[2] < D.z) tips.push('get in front of the mouth');
	else { if (off > (D.iris || D.slot[1] / 2) * 0.6) tips.push('line up on the axis (' + Math.round(off) + ' m off)'); if (nose < Math.cos(Sc.DOCK.align * Math.PI / 180)) tips.push('nose into the mouth'); if (sp > Sc.DOCK.speed * 0.8 && L[2] - D.z < 1000) tips.push('slow down'); if (D.spins && !s.fa && len(rel.w) > Sc.DOCK.spin) tips.push('match spin (FA does it)') }
	return {line1: 'Pad ' + game.clearance.pad + ' · ' + (tips.length ? tips[0] : 'cleared to enter'), line2: tips[1] || (L[2] >= D.z ? 'Mouth ' + H.fmtDist(Math.max(0, L[2] - D.z)) + ' ahead' : ''), col: tips.length ? '#f2a33a' : '#7fd1a8'};
}

/* ---------------- touch and mouse ---------------- */
function touchLayout() {
	const T = game.touch, r = Math.min(80, W * 0.12);
	return {stick: {x: r + 30, y: Hh - r - 30, r, dx: T.dx, dy: T.dy},
		thr: {x: W - 70, y: Hh - 200, w: 48, h: 170},
		buttons: [['FA', 'fa', s && s.fa], ['CRUISE', 'cruise', game.cruise.on], ['TARGET', 'target'], ['DOCK', 'dock'], ['VIEW', 'view'], ['II', 'pause']].map(([label, act, onFlag], i) => ({label, act, on: !!onFlag, x: W - 140 - (i % 3) * 72 - 80, y: Hh - 90 - Math.floor(i / 3) * 56, w: 64, h: 46}))};
}
function pointers() {
	const at = e => { const p = view.toGame(e.clientX, e.clientY); return {x: p.x, y: p.y, touch: e.pointerType == 'touch', id: e.pointerId} };
	const T = game.touch;
	hud.addEventListener('pointermove', e => { game.ptr = at(e); if (T.stick && T.stick.id == e.pointerId) stickMove(game.ptr); if (T.thrId == e.pointerId) thrMove(game.ptr) });
	hud.addEventListener('pointerdown', e => {
		const p = at(e); game.ptr = p; hud.focus();
		if (e.pointerType != 'touch') { RG.lastInput = 'mouse'; return }
		RG.lastInput = 'touch'; try { hud.setPointerCapture(e.pointerId) } catch (x) {}
		const u = touchLayout();
		const b = u.buttons.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
		if (b) { if (b.act == 'fa') { Fl.setAssist(s, !s.fa); say('Flight assist ' + (s.fa ? 'on' : 'off')) } else if (b.act == 'cruise') toggleCruise(); else if (b.act == 'target') { game.target = (game.target + 1) % targets().length; say('Target: ' + targets()[game.target].name) } else if (b.act == 'dock') requestDock(); else if (b.act == 'view') game.chase = !game.chase; else if (b.act == 'pause') RG.pause(); return }
		if (Math.hypot(p.x - u.stick.x, p.y - u.stick.y) < u.stick.r * 1.6) { T.stick = {id: e.pointerId}; stickMove(p); return }
		if (p.x >= u.thr.x - 20 && p.x <= u.thr.x + u.thr.w + 20 && p.y >= u.thr.y - 20 && p.y <= u.thr.y + u.thr.h + 20) { T.thrId = e.pointerId; thrMove(p) }
	});
	const up = e => { if (T.stick && T.stick.id == e.pointerId) { T.stick = null; T.dx = T.dy = 0 } if (T.thrId == e.pointerId) T.thrId = null };
	hud.addEventListener('pointerup', up); hud.addEventListener('pointercancel', up);
	function stickMove(p) { const u = touchLayout().stick; let dx = (p.x - u.x) / u.r, dy = (p.y - u.y) / u.r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l } T.dx = dx; T.dy = dy }
	function thrMove(p) { const u = touchLayout().thr; T.thr = Math.max(0, Math.min(1, 1 - (p.y - u.y) / u.h)) }
}

/* ---------------- overlays ---------------- */
function overlay(kind) {
	const ov = $('ov'), body = $('ovBody'), btns = $('ovBtns');
	const close = () => { ov.hidden = true; RG.resume(); hud.focus() };
	btns.textContent = '';
	const button = (label, fn, primary) => { const b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'primary'; b.onclick = fn; btns.appendChild(b); return b };
	ov.hidden = false;   /* before pausing, so the pause handler sees the dialog is up */
	if (kind == 'help' || kind == 'pause') {
		RG.pause();
		body.innerHTML = '<h1 id="ovT">' + (kind == 'pause' ? 'Paused' : 'Controls') + '</h1><p>' + esc(ship.name) + ' · ' + esc(st.name) + ' · ' + esc(game.home.name.replace(/^The /, '')) + ' home system. ' + (R.kind == 'webgl' ? 'WebGL 2.' : 'Canvas 2D fallback.') + '</p><table>' + HELP.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table>';
		button('Resume', close, true).focus();
		button('Graphics: ' + (quality == 'high' ? 'High' : 'Low'), e => { quality = quality == 'high' ? 'low' : 'high'; meshes(); e.target.textContent = 'Graphics: ' + (quality == 'high' ? 'High' : 'Low') });
	} else if (kind == 'docked') {
		body.innerHTML = '<h1 id="ovT">Docked</h1><p>' + esc(st.name) + ', pad ' + (game.clearance ? game.clearance.pad : '—') + '. Welcome to the ' + esc(game.home.name.replace(/^The /, '')) + '.</p><p>The starport menu (market, bulletin board, shipyard, outfitting, contacts) arrives with trade in M3; see the design canvas for how it will look.</p>';
		button('Repair and launch', () => { M.repair(fit); ov.hidden = true; launch(false); hud.focus() }, true).focus();
		button('Launch', () => { ov.hidden = true; launch(false); hud.focus() });
	}
	ov.hidden = false;
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

start().catch(e => { console.error(e); const l = $('load'); if (l) l.textContent = '> could not start: ' + e.message });
})();
