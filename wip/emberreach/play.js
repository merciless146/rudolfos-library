/* ===== Ember Reach: the flight screen (M1: fly a ship in a system and dock; M2: the star map and jumping).
   Ties the models together: the system (scene.js), the ship (flight.js, with flight assist), its modules and the
   pilot under g (modules.js, pilot.js), travel between stars (travel.js), the renderer (render.js), the HUD (hud.js)
   and the star map (map.js), on gamekit's fixed 60 Hz loop. Controls: keyboard, mouse, gamepad and touch.
   - Jumping: pick a star on the map (G) and plot a route (Enter); J charges the hyperspace drive for 5 s (out of a
     port's mass lock, with fuel for the leg), then the ship jumps and arrives near the new star, facing its port.
     Lane legs (a power's beacons, the long lanes between clusters) start from a beacon. Jumps take a day, lanes
     half a day. Where stars crowd, a jump can misjump onto a neighbour; the route is then plotted again.
   - Ports: capitals have a Halo; most claimed systems a Lantern or Trefoil; unclaimed space has none. Docked, the
     starport (port.js): market, exchange, shipyard, paid refuelling and repairs (M3). A lost ship is replaced at
     the last port you docked at, for 5% of its value.
   - A new game starts by choosing your origin among the great powers (M3); you start in its capital with 20,000 SU
     in its currency and a ship from its yards.
   URL options: ?power=N (whose home system), ?port=trefoil|bloom|lantern|halo (the home port's class), ?ship=…,
   ?day=N, ?canvas (the Canvas 2D fallback), ?quality=low|high, ?debug (9 breaks a module, 0 breaks the canopy,
   7 picks a star in range, 8 routes to an ally's capital, spawn=N starts N metres off the mouth).
   Saves (gamekit): see save.js; every 15 s, on docking, launching, jumping and pausing; a URL naming a power, port,
   ship or day starts fresh.
   Level of detail: planets and stars are lit sprites until 48 pixels across; stations are a detailed mesh within
   20 km, a simple one to 500 km, and a sprite beyond; ships are always drawn in full at the graphics setting.
   - Combat (M4): the system's cast (encounters.js) flies the same flight model under AI pilots (combat.js): port
     patrols and traders, pirates, war wings on the fronts, small factions' flagships, and what your war missions bring.
     L or the left mouse button fires (lasers heat, mass drivers use rounds), K launches a missile at a locked target,
     B drops a flare, U targets the nearest hostile. Shields soak hits and come back; the hull's damage reaches the
     modules; at no hull the ship is lost. Kills pay bounties, anger factions or count as war effort; war missions
     taken at a bulletin board are settled as you go.
   - The cargo hatch (I): open, the ship drops into its scooping trim (slow, fine turning) and scoops cargo canisters
     (canisters.js) that drift into it slowly enough; wrecks leave canisters. A broken hatch jams open and the hold
     spills a tonne every 8 s.
   - Exploration (M5, explore.js): arriving, the sensors sweep the system (8 s) and chart it; flying within 6 radii
     of a targeted planet surveys it (12 s). First discoveries out of the powers' charted space are yours, and
     living worlds and ruins you found first can be named at a port's cartographers, who buy the data. Ruins are
     guarded by old sentinels, and surveying one turns up a cache of Artefacts.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const G = window.EmberGalaxy, F = window.EmberFactions, S = window.EmberShips, Fl = window.EmberFlight, M = window.EmberModules,
	Pi = window.EmberPilot, Sc = window.EmberScene, Me = window.EmberMeshes, Re = window.EmberRender, H = window.EmberHUD, RG = window.RG,
	Snd = window.EmberSound, Sv = window.EmberSave, T = window.EmberTravel, Map = window.EmberMap, Tr = window.EmberTrade, Port = window.EmberPort,
	C = window.EmberCombat, En = window.EmberEncounters, Ca = window.EmberCanisters, X = window.EmberExplore;
const {add, sub, mul, dot, len, norm, cross} = Sc.v;
const Q = new URLSearchParams(location.search), DEBUG = Q.has('debug');
const $ = id => document.getElementById(id);
const LOD = {spritePx: 48, stationHi: 20000, stationLo: 500000};
const JUMP = {charge: 5, tunnel: 2.6};
let quality = Q.get('quality') == 'low' ? 'low' : 'high';
const gl = $('gl'), hud = $('hud');

const KEYS = {
	pitchDown: ['ArrowUp', 'KeyW'], pitchUp: ['ArrowDown', 'KeyS'], rollLeft: ['ArrowLeft'], rollRight: ['ArrowRight'],
	yawLeft: ['KeyA', 'pad:4'], yawRight: ['KeyD', 'pad:5'], faster: ['KeyR', 'Equal', 'NumpadAdd'], slower: ['KeyF', 'Minus', 'NumpadSubtract'], stop: ['KeyX', 'Backspace'],
	strafeL: ['KeyQ', 'pad:14'], strafeR: ['KeyE', 'pad:15'], strafeU: ['Space', 'pad:12'], strafeD: ['ShiftLeft', 'pad:13'],
	fa: ['KeyZ', 'pad:1'], cruise: ['KeyC', 'pad:3'], target: ['KeyT', 'Tab', 'pad:2'], dock: ['KeyN', 'pad:0'], view: ['KeyV', 'pad:11'],
	map: ['KeyG', 'pad:8'], jump: ['KeyJ', 'pad:10'], route: ['Enter', 'NumpadEnter'], home: ['Home', 'KeyY'],
	hatch: ['KeyI'], fire: ['KeyL', 'pad:7'], missile: ['KeyK', 'pad:6'], flare: ['KeyB'], hostile: ['KeyU'],
	systems: ['KeyO'], mouse: ['KeyM'], help: ['KeyH', 'F1'], pause: ['KeyP', 'Escape', 'pad:9'],
	dbgPirates: ['Digit6'], dbgBreak: ['Digit9'], dbgCanopy: ['Digit0'], dbgNear: ['Digit7'], dbgRoute: ['Digit8']};
const HELP = [['↑ ↓  or  W S', 'pitch (nose down / up)'], ['← →', 'roll'], ['A D', 'yaw'], ['R F', 'throttle up / down (FA on: a set speed; FA off: thrust)'], ['X', 'throttle to zero'],
	['Q E, Space, Left Shift', 'strafe left / right / up / down'], ['Z', 'flight assist on / off'], ['C', 'cruise (out of a port\'s 20 km mass lock)'], ['T  or  Tab', 'next target'],
	['N', 'request docking clearance (within 10 km of the port)'], ['G', 'star map: drag to turn, wheel to zoom, click a star, Enter to plot a route, Home (or Y) back to you'],
	['J', 'jump to the next star on the route (or the star picked on the map)'], ['V', 'cockpit / chase view'], ['O', 'internal systems'], ['M', 'mouse flight (pointer from the centre: pitch and roll)'],
	['L  or  left mouse button', 'fire (lasers heat up; mass drivers use rounds)'], ['K', 'missile, once locked (keep the target in your sights for 2 s)'], ['B', 'flare (shakes off missiles)'], ['U', 'target the nearest hostile'],
	['I', 'cargo hatch open / shut (open: slow, fine handling; drift onto a canister to scoop it)'],
	['P  or  Esc', 'pause'], ['Gamepad', 'left stick pitch and roll, right stick yaw and throttle, RT fire, LT missile, A dock, B FA, X target, Y cruise, d-pad strafe, Back map, left stick click jump']];

let W = 1, Hh = 1, view = null, R = null, scene = null, st = null, ship = null, s = null, fit = null, pilot = null, map = null;
const game = {t: 0, day: 200, star: null, port: null, fuel: 1, route: null, jump: null, lastPort: null, mapOpen: false,
	cruise: {on: false, v: 0, charge: 0}, throttle: 0, target: 0, clearance: null, docked: false, chase: false, systems: false, mouseFly: false, msgs: [], vision: null, gFelt: null, lastStep: null,
	axes: {pitch: 0, roll: 0, yaw: 0}, ptr: null, touch: {stick: null, dx: 0, dy: 0, thr: null, fire: null, msl: false},
	tgt: null, npcs: [], shots: [], booms: [], cans: [], hatch: false, spill: {}, sweep: 0, surveyT: 0, surveyKey: null, guarded: {}, pcs: null, visits: 0, mouseFire: false, own: null};
const say = (text, col) => { game.msgs.push({text, col, t: game.t}); if (game.msgs.length > 12) game.msgs.shift() };
const at = x => [x.x, x.y, x.z];
const owner = () => game.port ? F.byId(game.port.owner) : null;

/* ---------------- start ---------------- */
async function start() {
	await RG.init('ember-reach');
	RG.bind(KEYS);
	const majors = F.majors();
	/* the save, unless the URL asks for a particular system, port or ship */
	let sv = null;
	try { sv = Sv.unpack(await RG.load(), {powers: majors.length, ports: Object.keys(Sc.STATION), ships: S.ships().map(x => x.id)}) } catch (e) { sv = null }
	const fresh = ['power', 'port', 'ship', 'day'].some(k => Q.has(k));
	if (sv) { quality = Q.get('quality') || sv.settings.quality; Snd.setOn(sv.settings.sound) }
	if (fresh) sv = sv && {settings: sv.settings};
	const ok = sv && sv.ship;
	/* the player: from the save; or, for a new game, the origin from the URL or chosen here */
	let originIdx = ok ? sv.power : Q.has('power') ? Math.max(0, Math.min(majors.length - 1, +Q.get('power'))) : null;
	if (originIdx == null) { $('load').style.display = 'none'; originIdx = await chooseOrigin(); $('load').style.display = '' }
	game.power = originIdx;
	game.home = majors[game.power];
	game.P = ok && sv.player ? sv.player : Tr.newPlayer(game.home.id);
	if (Q.has('ship') && !ok) game.P.ship.model = Q.get('ship');
	game.homePort = !ok && Sc.STATION[Q.get('port')] ? Q.get('port') : ok && sv.version == 1 ? sv.port : 'halo';
	ship = S.ships().find(x => x.id == game.P.ship.model) || S.ships().find(x => x.id == 'wren');
	game.day = ok ? sv.day : +(Q.get('day') || 200);
	game.fuel = ok ? sv.fuel : 1;
	const here = ok && sv.star ? T.starAt(sv.star.id, sv.star.p) : null;
	game.lastPort = ok && sv.lastPort ? T.starAt(sv.lastPort.id, sv.lastPort.p) : null;
	/* renderer, then the system */
	R = Re.create(gl, {canvas2d: Q.has('canvas')});
	enterSystem(here || game.home.star);
	view = RG.fit(hud, (w, h) => ({w, h}));
	RG.on('resize', v => { W = v.w; Hh = v.h; const d = v.dpr; gl.width = Math.round(v.cw * d); gl.height = Math.round(v.ch * d) });
	view.refit();
	map = Map.create();
	pointers();
	if (ok) resume(sv);
	else {
		/* a new game starts docked at the capital, in the starport */
		launch(true); game.lastPort = game.star;
		if (st && !Q.has('spawn')) { game.docked = true; game.clearance = {pad: 1 + Math.floor(Math.random() * 24), until: Infinity}; say('Welcome to ' + st.name + '. Your ' + ship.name + ' is ready.') }
	}
	if (ok && sv.routeTo) game.pendingRoute = sv.routeTo;
	$('load').remove();
	/* sound starts on the first touch, click or key (browsers insist) */
	const unlock = () => Snd.unlock();
	addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);
	hud.addEventListener('wheel', e => { if (!game.mapOpen) return; e.preventDefault(); map.zoom(Math.exp(e.deltaY * 0.0015)) }, {passive: false});
	RG.on('pause', () => { Snd.hold(true); persist() }); RG.on('resume', () => Snd.hold(false));
	say('Rendering with ' + (R.kind == 'webgl' ? 'WebGL 2' : 'Canvas 2D (fallback)'), '#9fb0cc');
	say('Press H for the controls, G for the star map', '#9fb0cc');
	RG.onPause(() => { if (!$('ov').hidden) return; overlay('pause') });
	if (game.docked) openPort();
	RG.loop(update, draw);
	hud.focus();
}
/* a star system: its bodies, its port (if any), meshes and sky */
function enterSystem(star) {
	game.star = star;
	const capHome = star.id == game.home.star.id;
	game.port = capHome ? {cls: game.homePort, world: game.home.home.name, owner: game.home.id, capital: true} : T.portFor(star, game.day);
	scene = Sc.build(star, {day: game.day, port: game.port ? game.port.cls : null, portWorld: game.port ? game.port.world : undefined});
	st = scene.station;
	game.tgt = null; game.clearance = null; game.npcs = []; game.shots = []; game.booms = []; game.cans = [];
	game.sweep = game.P && X.isCharted(game.P, star.id) ? 0 : X.EXPLORE.sweep; game.surveyT = 0; game.surveyKey = null; game.guarded = {};
	game.own = game.port && game.port.capital ? {owner: game.port.owner, contested: false} : T.ownerOf(star, game.day);
	meshes();
}
/* every mesh, at the graphics setting */
function meshes() {
	for (const b of scene.bodies) { R.upload(b.name, b.kind == 'star' ? Me.star(b.T, quality) : Me.planet(b, quality)); if (b.ring) R.upload(b.name + ':rings', Me.rings(b.ring, b.seed, quality)) }
	if (st) for (const det of ['hi', 'lo']) Me.station(st.def, st.parts, det).forEach(g => R.upload('station:' + det + ':' + g.spin, g.mesh));
	R.upload('ship', Me.ship(ship.length, quality));
	R.upload('can', Me.box([0, 0, 0], [0.8, 0.8, 1.3], [0.86, 0.52, 0.18, 0]));
	game.npcMeshes = new Set(); for (const n of game.npcs) npcMesh(n);
	R.setSky(sky(game.star));
}
/* the sky: real neighbours by their light, out to 30 pc (closer where stars crowd: at most a few thousand); and
   the glow of the galaxy's core */
function sky(home) {
	const out = [], n = G.numberDensity(home.x, home.y, home.z) + 1e-9, Rr = Math.min(30, Math.cbrt(7000 / (n * 4.19)));
	for (const x of G.starsNear(home.x, home.y, home.z, Rr)) {
		if (x.id == home.id || x.d < 1e-6) continue;
		const flux = Math.max(1e-9, (x.L || 0.001) / (x.d * x.d)), lg = Math.log10(flux);
		if (lg < (quality == 'low' ? -5.6 : -6.3)) continue;
		const c = Me.starColour(x.T), b = Math.max(0.12, Math.min(1, (lg + 6.3) / 5)), dir = norm([x.x - home.x, x.y - home.y, x.z - home.z]);
		out.push(dir[0], dir[1], dir[2], c[0] * b, c[1] * b, c[2] * b, Math.max(1, Math.min(4, 1 + (lg + 4) * 0.8)));
	}
	game.coreDir = norm([-home.x, -home.y, -home.z]);
	return out;
}

/* a fresh ship outside the port (or just launched from it); with no port, where a jump arrives */
function launch(first) {
	if (!st) { const a = Sc.arrival(scene); s = Fl.create(ship, a) }
	else {
		const sp = Sc.spawn(scene, first ? (DEBUG && +Q.get('spawn') || 2500) : 30);
		s = Fl.create(ship, first ? sp : {p: sp.p, q: Sc.lookRotation(st.axis, st.y), v: mul(st.axis, 40)});
		if (!first) s.q = Sc.lookRotation(st.axis, st.y);
	}
	s.radius = Math.max(2, ship.length / 2);
	fit = fit || M.fit(ship); pilot = Pi.create(); M.apply(fit, s); arm();
	game.cruise = {on: false, v: 0, charge: 0}; game.throttle = first ? 0 : 0.2; game.docked = false; game.tgt = null; game.hatch = false; game.clearance = null; game.jump = null;
	populate();
	if (!first) { say('Launched from ' + st.name + '. Fly safe.'); Snd.cue('launch') }
	else if (st) say('Holding 2.5 km off ' + st.name + '. Press N for docking clearance.');
	persist();
}
/* back where the save left off */
function resume(sv) {
	s = Fl.create(ship, {p: sv.p, v: sv.v, q: sv.q, w: sv.w, fa: sv.fa}); s.radius = Math.max(2, ship.length / 2);
	fit = Sv.restoreModules(M.fit(ship), sv.modules); pilot = Pi.create(); M.apply(fit, s); arm();
	if (!sv.docked) populate();
	game.t = sv.t; game.throttle = sv.throttle; game.docked = !!(sv.docked && st); game.clearance = game.docked && sv.pad ? {pad: sv.pad, until: Infinity} : null;
	if (!game.lastPort) game.lastPort = st ? game.star : game.home.star;
	say(game.docked ? 'Welcome back: docked at ' + st.name : st ? 'Welcome back, ' + H.fmtDist(len(sub(s.p, st.c))) + ' from ' + st.name : 'Welcome back, in the ' + game.star.name + ' system');
}
/* save now (gamekit keeps it); quietly, at most once a second */
function persist() {
	if (!s || !fit || game.saving) return;
	game.saving = true; game.savedAt = game.t;
	const routeTo = game.route && game.route.toStar ? game.route.toStar : null;
	game.P.day = game.day;
	if (game.pcs && !game.docked) game.P.combat = C.keep(game.pcs);
	RG.save(Sv.pack({player: game.P, power: game.power, port: st ? st.cls : null, ship: ship.id, day: game.day, t: game.t, docked: game.docked, pad: game.clearance && game.clearance.pad, s, throttle: game.throttle, fit,
		star: game.star, fuel: game.fuel, lastPort: game.lastPort, routeTo, settings: {quality, sound: Snd.on}}))
		.catch(e => { if (!game.saveWarned) { game.saveWarned = true; say('Could not save: ' + e.message, '#f2a33a') } })
		.then(() => { setTimeout(() => { game.saving = false }, 1000) });
}
const targets = () => [...(st ? [st] : []), ...game.npcs.filter(n => !n.cs.dead), ...game.cans, ...scene.bodies.filter(b => b.kind == 'planet'), ...scene.bodies.filter(b => b.kind == 'star')];
/* the target is kept by reference (ships come and go); a lost one falls back to the port, or the first body */
function curTarget() { const L = targets(); if (!L.includes(game.tgt)) game.tgt = L[0]; return game.tgt }
const posOf = x => x.pos || x.c;
const radiusOf = x => x.radius || x.def.radius;
const frameNear = () => st && len(sub(s.p, st.c)) < 8000 ? Sc.frame(st) : null;

/* ---------------- input ---------------- */
function readPad() {
	let g = null; try { g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean) } catch (e) {}
	if (!g) return null;
	const ax = i => { const v = g.axes[i] || 0; return Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88 };
	const bt = i => g.buttons[i] ? g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0) : 0;
	/* left stick pitch and roll; right stick yaw and throttle (the triggers fire guns and missiles) */
	return {roll: -ax(0), pitch: ax(1), yaw: ax(2), thr: -ax(3)};
}
function controls(dt) {
	if (game.mapOpen) return {pitch: 0, roll: 0, yaw: 0, strafe: [0, 0], throttle: game.throttle, thrust: s.fa ? 0 : 0};
	const ease = (cur, want, k) => cur + (want - cur) * Math.min(1, k * dt);
	const d = a => RG.down(a) ? 1 : 0;
	const A = game.axes;
	A.pitch = ease(A.pitch, d('pitchDown') - d('pitchUp'), 6); A.roll = ease(A.roll, d('rollLeft') - d('rollRight'), 6); A.yaw = ease(A.yaw, d('yawRight') - d('yawLeft'), 6);
	let pitch = A.pitch, roll = A.roll, yaw = A.yaw, sx = d('strafeR') - d('strafeL'), sy = d('strafeU') - d('strafeD'), thr = 0;
	const pad = readPad();
	if (pad) { pitch += pad.pitch; roll += pad.roll; yaw += pad.yaw; thr += pad.thr }
	if (game.mouseFly && game.ptr && !game.ptr.touch) { const mx = (game.ptr.x - W / 2) / (W / 2), my = (game.ptr.y - Hh / 2) / (Hh / 2), dz = v => Math.abs(v) < 0.06 ? 0 : v; roll -= dz(mx) * 1.4; pitch += dz(my) * 1.4 }
	const Tt = game.touch;
	if (Tt.stick) { pitch += Tt.dy; roll -= Tt.dx }
	thr += d('faster') - d('slower');
	if (s.fa || game.cruise.on) {
		game.throttle = Math.max(game.cruise.on ? 0 : -0.3, Math.min(1, game.throttle + thr * 0.6 * dt));
		if (Tt.thr != null) game.throttle = Tt.thr;
		/* the hatch's trim: the set speed can't pass 12% of top speed */
		if (s.hatch && !game.cruise.on) { const k = Fl.TUNE.hatch.speed; game.throttle = Math.max(-k, Math.min(k, game.throttle)) }
		if (RG.pressed('stop')) game.throttle = 0;
	} else game.throttle = Math.max(-1, Math.min(1, Tt.thr != null ? Tt.thr * 2 - 1 : thr));
	const c = v => Math.max(-1, Math.min(1, v));
	return {pitch: c(pitch), roll: c(roll), yaw: c(yaw), strafe: [c(sx), c(sy)], throttle: game.throttle, thrust: s.fa ? 0 : game.throttle};
}
function actions(dt) {
	if (Port.isOpen()) return;   /* the starport takes the keys while docked */
	if (RG.pressed('help')) overlay('help');
	if (game.mapOpen) { mapKeys(dt); return }
	if (RG.pressed('pause')) { RG.pause(); return }
	if (RG.pressed('map')) { openMap(); return }
	if (RG.pressed('view')) game.chase = !game.chase;
	if (RG.pressed('systems')) game.systems = !game.systems;
	if (RG.pressed('mouse')) { game.mouseFly = !game.mouseFly; say('Mouse flight ' + (game.mouseFly ? 'on: point away from the centre to pitch and roll' : 'off')) }
	if (game.docked || game.jump && game.jump.tunnel != null) return;
	if (!pilot.conscious) return;
	if (RG.pressed('fa')) toggleFA();
	if (RG.pressed('target')) nextTarget();
	if (RG.pressed('hostile')) nearestHostile();
	if (RG.pressed('hatch')) toggleHatch();
	if (RG.pressed('dock')) requestDock();
	if (RG.pressed('cruise')) toggleCruise();
	if (RG.pressed('jump')) requestJump();
	if (DEBUG && RG.pressed('dbgPirates')) debugPirates(3);
	if (DEBUG && RG.pressed('dbgBreak')) { const h = M.hit(fit, 1e6, Math.random()); if (h.alert) moduleAlert(h.alert) }
	if (DEBUG && RG.pressed('dbgCanopy')) { const a = M.damage(fit, 'canopy', 1e6); if (a) moduleAlert(a) }
	/* debug: pick a star in range, or route to a neighbouring power's capital (the lanes are charted first) */
	if (DEBUG && RG.pressed('dbgNear')) { const c = G.starsNear(game.star.x, game.star.y, game.star.z, ship.jump).filter(x => x.id != game.star.id && G.system(x).planets.length); if (c.length) { map.sel = c[c.length - 1]; map.info = null; game.route = null; say('Picked ' + map.sel.name + ' (' + map.sel.d.toFixed(1) + ' pc)') } }
	if (DEBUG && RG.pressed('dbgRoute')) { T.lanes(); map.ready = true; const m = F.majors().find(x => x.cluster == game.home.cluster && x.id != game.home.id && F.relation(game.home.id, x.id) > 0) || F.majors()[1]; map.sel = m.star; plot(m.star) }
}
function toggleFA() { Fl.setAssist(s, !s.fa); game.throttle = s.fa ? Math.min(1, len(s.v) / s.spec.vmax) : 0; say('Flight assist ' + (s.fa ? 'on' : 'off'), s.fa ? '#6cc9e8' : '#f2a33a'); Snd.cue(s.fa ? 'faOn' : 'faOff') }
function nextTarget() { const L = targets(), i = L.indexOf(curTarget()); game.tgt = L[(i + 1) % L.length]; say('Target: ' + game.tgt.name); Snd.cue('tick') }
/* the cargo hatch: shut, open, or (broken) jammed open */
const hasHatch = () => !!M.get(fit, 'hatch');
const hatchOpen = () => hasHatch() && (game.hatch || !M.works(fit, 'hatch'));
function toggleHatch() {
	if (!hasHatch()) { say('The ' + ship.name + ' has no hold, so no cargo hatch', '#f2a33a'); Snd.cue('refused'); return }
	if (!M.works(fit, 'hatch')) { say('Cargo hatch jammed open: repair it at a port', '#e5484d'); Snd.cue('refused'); return }
	if (game.cruise.on) { say('Drop out of cruise to open the hatch', '#f2a33a'); Snd.cue('refused'); return }
	game.hatch = !game.hatch;
	say(game.hatch ? 'Cargo hatch open: scooping trim. Drift onto a canister under 20 m/s.' : 'Cargo hatch shut', '#6cc9e8'); Snd.cue('hatch');
}
/* the hatch shuts itself for cruise and jumps (it can't if it's jammed) */
function shutHatch(why) { if (game.hatch && M.works(fit, 'hatch')) { game.hatch = false; say('Cargo hatch shut for ' + why); Snd.cue('hatch') } }
function nearestHostile() {
	const h = game.npcs.filter(n => !n.cs.dead && isHostile(n)).sort((a, b) => len(sub(a.s.p, s.p)) - len(sub(b.s.p, s.p)))[0];
	if (!h) { say('No hostiles on the scanner'); Snd.cue('tick'); return }
	game.tgt = h; say('Target: ' + h.name + ' · ' + H.fmtDist(len(sub(h.s.p, s.p))), '#e5484d'); Snd.cue('tick');
}
function requestDock() {
	if (!st) { say('There is no port in this system', '#f2a33a'); Snd.cue('refused'); return }
	const d = len(sub(s.p, st.c));
	if (d > 10000) { say('Docking clearance is given within 10 km of the port (' + H.fmtDist(d) + ' now)', '#f2a33a'); Snd.cue('refused'); return }
	if (game.clearance) { say('Clearance already granted: pad ' + game.clearance.pad); return }
	const o = owner();
	if (o && game.P.bounties[o.currency.code] > 0 && game.npcs.some(n => n.role == 'patrol' && !n.cs.dead && n.faction == o.id)) { say(st.name + ': docking denied. You are wanted here: ' + Math.round(game.P.bounties[o.currency.code]).toLocaleString('en-US') + ' ' + o.currency.code + '.', '#e5484d'); Snd.cue('refused'); return }
	if (o && o.id != game.home.id && F.relation(game.home.id, o.id) < 0) { say(st.name + ': docking denied. ' + o.name.replace(/^The /, '') + ' is at war with you.', '#e5484d'); Snd.cue('refused'); return }
	game.clearance = {pad: 1 + Math.floor(Math.random() * 24), until: game.t + 600};
	game.tgt = st;
	const D = st.def.dock;
	say(st.name + ': clearance granted, pad ' + game.clearance.pad + '. Approach along the axis' + (D.spins ? ', and match our spin.' : '.'), '#7fd1a8'); Snd.cue('clearance');
}
function toggleCruise() {
	const cz = game.cruise;
	if (cz.on) { const r = Sc.dropOut(s, cz); cz.on = false; game.throttle = Math.min(1, len(s.v) / s.spec.vmax); say(r.emergency ? 'Emergency drop out: the drive took a knock' : 'Dropped out of cruise', r.emergency ? '#f2a33a' : undefined); Snd.cue(r.emergency ? 'emergency' : 'drop'); if (r.emergency) damage(25); return }
	if (cz.charge > 0) { cz.charge = 0; say('Cruise cancelled'); return }
	if (Sc.massLocked(scene, s.p)) { say('Mass locked by ' + st.name + ': cruise needs 20 km clear', '#f2a33a'); Snd.cue('refused'); return }
	if (shipLock()) { say('Mass locked by ' + shipLock().name + ': ships within 5 km hold you', '#f2a33a'); Snd.cue('refused'); return }
	if (!M.status(fit).output.main) { say('Cruise needs working engines', '#e5484d'); Snd.cue('refused'); return }
	shutHatch('cruise');
	cz.charge = Sc.CRUISE.charge; say('Cruise charging…', '#6cc9e8'); Snd.cue('charge');
}

/* ---------------- jumps ---------------- */
/* the leg to fly now: the route's next, or a hop to the star picked on the map */
function nextLeg() {
	if (game.route && game.route.legs.length) return game.route.legs[0];
	if (map && map.sel && map.sel.id != game.star.id) return {kind: 'jump', star: map.sel, d: T.dist(at(game.star), at(map.sel))};
	return null;
}
function requestJump() {
	if (game.jump) { game.jump = null; say('Jump cancelled'); return }
	const leg = nextLeg();
	if (!leg) { say('No destination: open the map (G), pick a star, and plot a route (Enter)', '#f2a33a'); Snd.cue('refused'); return }
	const st0 = M.status(fit);
	if (!st0.jump) { say('Hyperspace drive inoperable', '#e5484d'); Snd.cue('refused'); return }
	if (Sc.massLocked(scene, s.p)) { say('Mass locked by ' + st.name + ': jumps need 20 km clear', '#f2a33a'); Snd.cue('refused'); return }
	const can = T.canMake(leg, ship.jump, game.fuel);
	if (!can.ok) { say(can.why == 'range' ? leg.star.name + ' is ' + leg.d.toFixed(1) + ' pc away; the ' + ship.name + ' jumps ' + ship.jump + ' pc. Plot a route (Enter on the map).' : 'Not enough fuel: the jump needs ' + Math.round(can.cost * 100) + '% of a tank. Dock to refuel.', '#f2a33a'); Snd.cue('refused'); return }
	shutHatch('the jump');
	game.jump = {leg, charge: JUMP.charge, tunnel: null, cost: can.cost};
	say((leg.kind == 'jump' ? 'Hyperspace: charging for ' : leg.kind == 'long' ? 'Long lane relay: charging for ' : 'Lane beacon: charging for ') + leg.star.name + ' (' + leg.d.toFixed(1) + ' pc)', '#6cc9e8'); Snd.cue('charge');
}
function arrive() {
	const J = game.jump, leg = J.leg, a = leg.kind == 'jump' ? T.arrival(leg.star, Math.random()) : {star: leg.star, misjump: false};
	game.fuel = Math.max(0, game.fuel - J.cost); game.day += leg.kind == 'jump' ? T.TRAVEL.jumpDays : T.TRAVEL.laneDays;
	game.jump = null;
	enterSystem(a.star);
	const p = Sc.arrival(scene); s.p = p.p; s.q = p.q; s.v = [0, 0, 0]; s.w = [0, 0, 0];
	game.cruise = {on: false, v: 0, charge: 0}; game.throttle = 0;
	settle(); populate();
	const o = owner(), who = o ? (game.port && game.port.contested ? 'contested, held by ' : '') + o.name.replace(/^The /, '') : 'unclaimed space';
	if (a.misjump) say('Misjump! The drive locked onto ' + a.star.name + ', near ' + leg.star.name, '#f2a33a');
	say('Arrived: ' + a.star.name + ' · ' + who + (st ? ' · ' + st.def.name + ' at ' + game.port.world : ' · no port'), '#7fd1a8');
	Snd.cue('arrive');
	/* the route: on to the next leg, or plotted again after a misjump */
	if (game.route) {
		if (!a.misjump && game.route.legs[0] && game.route.legs[0].star.id == a.star.id) game.route.legs.shift();
		else if (game.route.toStar) plot(game.route.toStar, true);
		if (game.route && !game.route.legs.length) { say('Route complete'); game.route = null }
		else if (game.route) say('Next: ' + game.route.legs[0].star.name + ' (' + game.route.legs.length + ' to go)', '#6cc9e8');
	}
	if (map) { map.here = game.star; map.sel = null; map.info = null }
	const foes = game.npcs.filter(n => isHostile(n)).length, mis = (game.P.missions || []).filter(m => m.star.id == game.star.id);
	if (foes) say(foes + (foes == 1 ? ' hostile ship' : ' hostile ships') + ' on the scanner', '#e5484d');
	for (const m of mis) say('Mission here: ' + En.need(m), '#6cc9e8');
	persist();
}
/* plot a route to a star (needs the lanes, charted with the map) */
function plot(toStar, quiet) {
	const r = T.route(game.star, toStar, ship.jump, game.home.id);
	r.toStar = toStar; r.to = toStar.id;
	game.route = r.ok ? r : null;
	if (map) map.route = r;
	if (!quiet || !r.ok) say(r.ok ? 'Route to ' + toStar.name + ': ' + r.jumps + (r.jumps == 1 ? ' jump' : ' jumps') + ', ' + Math.round(r.fuel * 100) + '% of a tank' + (r.fuel > game.fuel ? ' (refuel on the way)' : '') + '. J to jump.' : 'No route to ' + toStar.name + ' within ' + ship.jump + ' pc jumps', r.ok ? '#6cc9e8' : '#f2a33a');
}

/* ---------------- the map ---------------- */
function openMap() {
	game.mapOpen = true;
	map.explore = game.P.explore; map.info = null;
	map.here = game.star; map.range = ship.jump; map.origin = game.home.id; map.day = game.day; map.fuel = game.fuel; map.route = game.route;
	if (!map.opened) { map.opened = true; map.home() }
	if (!map.ready) { map.charting = 1; setTimeout(() => { T.lanes(); map.ready = true; map.charting = 0; if (game.pendingRoute) { const t = T.starAt(game.pendingRoute.id, game.pendingRoute.p); game.pendingRoute = null; if (t) plot(t, true) } }, 60) }
}
function closeMap() { game.mapOpen = false; hud.focus() }
function mapAct(act) {
	if (act == 'close') closeMap();
	else if (act == 'home') map.home();
	else if (act == 'in') map.zoom(1 / 1.6);
	else if (act == 'out') map.zoom(1.6);
	else if (act == 'route') { if (map.sel && map.ready) plot(map.sel); else if (!map.sel) say('Pick a star first', '#f2a33a') }
}
function mapKeys(dt) {
	const d = a => RG.down(a) ? 1 : 0;
	map.turn((d('rollLeft') - d('rollRight')) * 1.6 * dt, (d('pitchDown') - d('pitchUp')) * 1.2 * dt);
	const z = d('slower') - d('faster'); if (z) map.zoom(Math.exp(z * 1.6 * dt));
	const pad = readPad(); if (pad) { map.turn(-pad.roll * 1.6 * dt, pad.pitch * 1.2 * dt); if (pad.thr) map.zoom(Math.exp(-pad.thr * 1.6 * dt)) }
	if (RG.pressed('map') || RG.pressed('pause')) closeMap();
	if (RG.pressed('home')) map.home();
	if (RG.pressed('route')) mapAct('route');
	if (RG.pressed('jump')) { closeMap(); requestJump() }
}

/* ---------------- the step ---------------- */
function damage(amount) {
	let left = amount;
	while (left > 0) { const h = M.hit(fit, Math.min(left, 12), Math.random()); left -= 12; if (h.alert) moduleAlert(h.alert) }
}
/* a module just broke: the console line and its alert tone */
function moduleAlert(a) { say(a.text, a.color); Snd.cue(a.level == 'critical' ? 'critical' : 'warning') }
function update(dt) {
	if (!s) return;
	actions(dt);
	if (game.docked) return;
	game.t += dt;
	if (game.clearance && game.t > game.clearance.until) { game.clearance = null; say('Docking clearance expired') }
	M.apply(fit, s);
	s.hatch = hatchOpen();
	/* a jump: charging (flying on), then the tunnel (the ship out of normal space) */
	const J = game.jump;
	if (J) {
		if (J.tunnel != null) { J.tunnel -= dt; if (J.tunnel <= 0) arrive(); return }
		J.charge -= dt;
		if (Sc.massLocked(scene, s.p)) { game.jump = null; say('Jump interrupted: mass locked', '#f2a33a'); Snd.cue('refused') }
		else if (!M.status(fit).jump) { game.jump = null; say('Jump failed: hyperspace drive inoperable', '#e5484d') }
		else if (J.charge <= 0) { J.tunnel = JUMP.tunnel; game.cruise = {on: false, v: 0, charge: 0}; Snd.cue('jump'); return }
	}
	const input = Pi.controls(pilot, controls(dt)), cz = game.cruise;
	let r = null;
	if (cz.charge > 0) {
		cz.charge -= dt;
		if (Sc.massLocked(scene, s.p)) { cz.charge = 0; say('Cruise interrupted: mass locked', '#f2a33a') }
		else if (cz.charge <= 0) { cz.on = true; cz.v = len(s.v); game.throttle = Math.max(game.throttle, 0.5); say('Cruise engaged'); Snd.cue('cruise') }
	}
	if (cz.on) {
		const tgt = curTarget();
		const res = Sc.cruiseStep(scene, s, cz, input, dt, tgt);
		if (res == 'drop') { const d = Sc.dropOut(s, cz); cz.on = false; game.throttle = Math.min(1, len(s.v) / s.spec.vmax); say('Dropped out near ' + Sc.nearest(scene, s.p).what.name + (d.emergency ? ' (emergency)' : '')); Snd.cue(d.emergency ? 'emergency' : 'drop'); if (d.emergency) damage(25) }
		game.gFelt = null;
	} else {
		r = Fl.step(s, input, dt, frameNear());
		const g = M.gForce(fit, r);
		game.gFelt = M.works(fit, 'canopy') ? null : g.felt;
		game.vision = Pi.step(pilot, g.felt, dt);
		if (!pilot.conscious && !game.wasOut) { say('Pilot blacked out', '#e5484d'); Snd.cue('blackout') }
		if (pilot.conscious && game.wasOut) { say('Pilot conscious again', '#7fd1a8'); Snd.cue('wake') }
		game.wasOut = !pilot.conscious;
		/* docking */
		if (st) {
			const dk = Sc.dockCheck(st, s, game.t, !!game.clearance);
			if (dk && dk.ok === true) { docked(); return }
			if (dk && dk.ok === false) {
				const why = {clearance: 'no docking clearance (press N)', speed: 'too fast (' + Math.round(dk.speed) + ' m/s, under ' + Sc.DOCK.speed + ')', align: 'nose not along the axis', spin: 'not turning with the port: match its spin'}[dk.why];
				const L = Sc.toLocal(st, s.p);
				if (L[2] < st.def.dock.z + s.radius) {
					const imp = Math.max(0, -dot(sub(s.v, Sc.frame(st).w.every(v => !v) ? [0, 0, 0] : cross(Sc.frame(st).w, sub(s.p, st.c))), st.axis));
					s.p = add(s.p, mul(st.axis, st.def.dock.z + s.radius + 1 - L[2])); s.v = add(s.v, mul(st.axis, imp * 1.3));
					if (!game.lastRefuse || game.t - game.lastRefuse > 2) { say('Docking refused: ' + why, '#f2a33a'); Snd.cue('refused') } game.lastRefuse = game.t;
					if (imp > 5) damage((imp - 5) * 0.6);
				}
			}
		}
	}
	/* collisions */
	const hit = Sc.collide(scene, s, game.t);
	if (hit) {
		if (hit.kind == 'planet' || hit.kind == 'star') { lost((hit.kind == 'star' ? 'flew into ' : 'hit ') + hit.what.name); return }
		const dmg = Sc.resolve(s, hit);
		if (dmg > 0) { say('Collision with ' + st.name + ' at ' + Math.round(hit.impact) + ' m/s', '#f2a33a'); Snd.cue('collide', hit.impact); damage(dmg) }
	}
	game.lastStep = r;
	cargo(dt, cz.on);
	explore(dt, cz.on);
	if (!cz.on) { const pc = game.pcs; combat(dt); if (game.pcs !== pc) return }
	/* the sound follows the thrusters */
	const Sp = s.spec, aB = r ? r.aBody : [0, 0, 0], al = r ? r.alpha : [0, 0, 0];
	Snd.update({main: Math.max(0, aB[2]) / Sp.aMain, rcs: Math.min(1, (Math.abs(aB[0]) + Math.abs(aB[1])) / Sp.aRcs + Math.max(0, -aB[2]) / Sp.aRetro + al.reduce((t, a, i) => t + Math.abs(a) / Sp.alpha[i], 0) * 0.3),
		speed: Math.min(1, len(s.v) / Sp.vmax), cruise: cz.on ? Math.max(0, Math.log10(Math.max(1, cz.v)) - 3) / (Math.log10(Sc.CRUISE.cap) - 3) : 0,
		strain: pilot.strain, conscious: pilot.conscious, docked: false, engines: M.works(fit, 'engines') && M.works(fit, 'power')});
	if (game.t - (game.savedAt || 0) > 15) persist();
}
/* ---------------- combat ---------------- */
/* the player's guns, shields and hull: a fresh fighting state on the fit, with the hull and magazines carried over */
function arm() { game.pcs = C.restore(C.state(ship, fit), game.P.combat); game.pcs.id = 'me' }
const shortName = id => { const f = F.byId(id); return f ? f.name.replace(/^The /, '') : 'Independent' };
function npcMesh(n) { const k = 'npc:' + n.ship.length; if (!game.npcMeshes.has(k)) { game.npcMeshes.add(k); R.upload(k, Me.ship(n.ship.length, quality)) } }
/* the system's cast, placed: around the port, or ahead of where you are */
function populate() {
	game.npcs = []; game.shots = []; game.booms = [];
	if (!s) return;
	place(En.cast(game.star, Math.floor(game.day), game.P, {port: game.port, visit: game.visits++}));
}
function place(list) {
	const fwd = Fl.forward(s), rnd = Math.random;
	for (const n of list) {
		if (n.id == null) n.id = 'd' + game.visits++ + '_' + Math.floor(rnd() * 1e6);
		const centre = n.where == 'port' && st ? st.c : s.p;
		let dir = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
		if (n.where != 'port') dir = norm(add(mul(fwd, 1.3), dir));
		const p = add(centre, mul(dir, n.range)), face = norm(sub(n.ai == 'attack' ? s.p : add(p, mul(dir, 1)), p));
		n.s = Fl.create(n.ship, {p, q: Sc.lookRotation(Math.abs(face[1]) > 0.99 ? norm(add(face, [0.1, 0, 0])) : face, [0, 1, 0]), v: [0, 0, 0]});
		n.s.radius = Math.max(2, n.ship.length / 2);
		n.cs = C.state(n.ship); n.cs.id = n.id;
		n.ai = {mode: n.ai, base: n.ai, fleeAt: n.role == 'pirate' ? 0.3 : n.role == 'trader' ? 2 : n.role == 'flagship' ? 0 : 0.15};
		n.home = n.where == 'port' && st ? st.c : p;
		n.pos = n.s.p; n.radius = n.s.radius; n.kind = 'ship'; n.next = 0; n.foe = null;
		n.name = (n.role == 'flagship' || n.role == 'sentinel') && n.name ? n.name : n.role == 'depot' ? shortName(n.faction) + ' supply depot' : shortName(n.faction) + ' ' + n.ship.name;
		npcMesh(n);
		game.npcs.push(n);
	}
}
const isHostile = n => !n.cs.dead && En.hostile(game.P, n);
/* hostile ships within 5 km hold you out of cruise */
const shipLock = () => game.npcs.find(n => !n.cs.dead && isHostile(n) && n.role != 'depot' && len(sub(n.s.p, s.p)) < 5000);
const ME = {player: true, id: 'me'};
function combat(dt) {
	const P = game.P, pc = game.pcs;
	/* AI pilots: pick a foe now and then, fly, fire */
	for (const n of game.npcs) {
		if (n.cs.dead) continue;
		C.tick(n.cs, game.t, dt);
		if (n.role == 'depot') continue;
		if (game.t >= n.next) {
			n.next = game.t + 0.7 + Math.random() * 0.6;
			let best = null, bd = 25000;
			if (n.role != 'trader') {
				if (En.hostile(P, n)) { const d = len(sub(s.p, n.s.p)); if (d < bd) { bd = d * 0.8; best = ME } }
				for (const o of game.npcs) if (o != n && !o.cs.dead && o.role != 'depot' && En.enemies(n, o, P)) { const d = len(sub(o.s.p, n.s.p)); if (d < bd) { bd = d; best = o } }
			} else if (n.provoked) best = ME;
			n.foe = best;
			if (best && n.ai.mode == n.ai.base && n.ai.base != 'hold') n.ai.mode = n.role == 'trader' ? 'flee' : 'attack';
			if (!best && n.ai.mode == 'attack') n.ai.mode = n.ai.base;
			if (best == ME && !n.provokedByPlayer) n.wasHostile = true;
		}
		const f = n.foe, tgt = f == ME ? {p: s.p, v: s.v, id: 'me'} : f && !f.cs.dead ? {p: f.s.p, v: f.s.v, id: f.id} : null;
		const c = C.think(n, tgt, n.home, game.t);
		Fl.step(n.s, {pitch: c.pitch, yaw: c.yaw, roll: c.roll, throttle: c.throttle, strafe: [0, 0], thrust: 0}, dt);
		n.pos = n.s.p;
		if (tgt) {
			const d = len(sub(tgt.p, n.s.p));
			if (c.fire && d < (n.cs.load.turrets ? 4000 : 3500)) { const k = C.fire(n.cs, n.s, game.t, tgt, game.shots); if (k && d < 3000) Snd.cue(n.cs.load.guns[0].kind == 'driver' ? 'driver' : 'pulse') }
			if (C.updateLock(n.cs, n.s, tgt, dt) && c.missile && Math.random() < dt * 0.12) { if (C.launch(n.cs, n.s, tgt, game.shots) && tgt.id == 'me') { say('Missile launched at you by ' + n.name + ': B for flares', '#e5484d'); Snd.cue('incoming') } }
		}
	}
	/* your guns */
	for (const a of C.tick(pc, game.t, dt)) moduleAlert(a);
	if (pc.hot && !game.wasHot) say('Weapons overheated: guns locked until they cool', '#f2a33a');
	game.wasHot = pc.hot;
	const tg = curTarget(), foe = tg && tg.kind == 'ship' && !tg.cs.dead ? {p: tg.s.p, v: tg.s.v, id: tg.id} : null;
	const hasMsl = pc.load.missiles > 0 || pc.load.guns.some(g => g.kind == 'torpedo' && g.ammo > 0);
	const wasLocked = game.locked; game.locked = hasMsl && C.updateLock(pc, s, foe, dt); if (!hasMsl) pc.lock = {id: null, t: 0};
	if (game.locked && !wasLocked) Snd.cue('lock');
	const can = pilot.conscious && !game.jump;
	if (can && (RG.down('fire') || game.mouseFire || game.touch.fire != null)) {
		if (!pc.load.guns.length) { if (!game.saidUnarmed) { game.saidUnarmed = true; say('The ' + ship.name + ' carries no weapons', '#f2a33a') } }
		else { const k = C.fire(pc, s, game.t, foe, game.shots); if (k) Snd.cue(pc.load.guns.some(g => g.kind == 'heavy') ? 'heavy' : pc.load.guns.some(g => g.kind == 'pulse') ? 'pulse' : 'driver') }
	} else game.saidUnarmed = false;
	if (can && (RG.pressed('missile') || game.touch.msl)) {
		game.touch.msl = false;
		const torp = pc.load.guns.some(g => g.kind == 'torpedo' && g.ammo > 0);
		if (!pc.load.missiles && !torp) { say('No missiles left: restock at a port', '#f2a33a'); Snd.cue('refused') }
		else if (!foe) { say('Target a ship first (T, or U for the nearest hostile)', '#f2a33a'); Snd.cue('refused') }
		else if (!game.locked) { say('No lock yet: hold ' + tg.name + ' in your sights for 2 s', '#f2a33a'); Snd.cue('refused') }
		else if (C.launch(pc, s, foe, game.shots)) { say('Missile away · ' + pc.load.missiles + ' left'); Snd.cue('missile'); if (!En.hostile(P, tg)) provoke(tg) }
	}
	if (RG.pressed('flare') || game.touch.flare) { game.touch.flare = false; if (pc.load.flares > 0) { const k = C.flare(pc, game.shots); say('Flare' + (k ? ': ' + k + (k == 1 ? ' missile' : ' missiles') + ' decoyed' : '') + ' · ' + pc.load.flares + ' left'); Snd.cue('flare') } else say('No flares left', '#f2a33a') }
	/* everything in flight */
	const ships = [{id: 'me', s, cs: pc}, ...game.npcs.filter(n => !n.cs.dead).map(n => ({id: n.id, s: n.s, cs: n.cs, n}))];
	for (const h of C.stepProjectiles(game.shots, ships, dt)) {
		const pr = h.proj, W = C.WEAPONS[pr.kind], big = pr.kind == 'missile' || pr.kind == 'torpedo';
		game.booms.push({pos: pr.p.slice(), t: game.t, r: big ? 30 : 4, col: W.col, life: big ? 0.6 : 0.2});
		if (h.ship.id == 'me') { hitMe(pr); if (game.pcs !== pc) return; continue }
		const n = h.ship.n;
		C.damage(n.cs, pr.dmg, pr.kind, game.t);
		if (pr.owner == 'me' && !n.provoked && !En.hostile(P, n)) provoke(n);
		else if (pr.owner != 'me' && n.role != 'trader') { const src = game.npcs.find(o => o.id == pr.owner); if (src && n.foe != ME) { n.foe = src; n.next = game.t + 3 } }
		if (n.cs.dead) destroyed(n, pr.owner == 'me');
	}
	game.booms = game.booms.filter(b => game.t - b.t < b.life);
	const inc = game.shots.filter(m => m.target == 'me').length;
	if (inc > (game.incoming || 0)) Snd.cue('incoming');
	game.incoming = inc;
	En.tick(P, game.star.id, dt, false);
	if (game.t - (game.settledAt || 0) > 1) settle();
}
/* debug: a pirate wing a few kilometres ahead */
function debugPirates(k) {
	const gang = F.minors().find(m => m.type == 'criminal'), hulls = S.ships().filter(x => x.who.includes('pirate') && ['XS', 'S'].includes(x.size));
	place([...Array(k)].map((_, i) => ({role: 'pirate', faction: gang.id, ship: hulls[i % hulls.length], where: 'arrival', range: 2500 + i * 300, ai: 'attack', wing: 'p', provoked: false})));
	say(k + ' pirates ahead (debug)', '#e5484d');
}
if (DEBUG) window.EmberDebug = {game, pirates: debugPirates, get s() { return s }, get ship() { return ship }, get fit() { return fit }, settle,
	/* jump straight to a star (no fuel or time), and dock at once where there's a port */
	go: star => { enterSystem(star); const p = Sc.arrival(scene); s.p = p.p; s.q = p.q; s.v = [0, 0, 0]; s.w = [0, 0, 0]; populate() }, dock: () => { if (st) docked() }, near: (b, k) => { s.p = add(b.pos, mul(norm(sub(s.p, b.pos)), b.radius * k)); s.v = [0, 0, 0]; game.tgt = b; game.cruise = {on: false, v: 0, charge: 0} },
	get scene() { return scene }};
function provoke(n) {
	En.provoke(n, game.npcs);
	say('You fired on ' + n.name + (n.role == 'trader' ? ': a crime. The patrol will come.' : '. They are returning fire.'), '#f2a33a');
}
/* a hit on you: shields, then the hull and its modules */
function hitMe(pr) {
	const out = C.damage(game.pcs, pr.dmg, pr.kind, game.t);
	game.hitAt = game.t;
	Snd.cue(out.hull > 0 ? 'hullHit' : 'shieldHit');
	for (const a of out.alerts) moduleAlert(a);
	if (game.pcs.dead) { const src = game.npcs.find(o => o.id == pr.owner); lost('destroyed by ' + (src ? src.name : 'gunfire')) }
}
function destroyed(n, byMe) {
	game.booms.push({pos: n.s.p.slice(), t: game.t, r: n.s.radius * 4, col: [1, 0.72, 0.4], life: 1.8});
	for (const g of Ca.wreck(n.role, n.ship)) game.cans.push(Ca.make(g, n.s.p, n.s.v, game.t));
	Snd.cue('boom', Math.max(0.15, Math.min(1, 3000 / (len(sub(n.s.p, s.p)) + 1))));
	if (byMe) {
		const res = En.killed(game.P, n, {star: game.star, day: game.day, own: game.own});
		say(n.name + ' destroyed', '#7fd1a8');
		for (const m of res.msg) say(m, /Crime/.test(m) ? '#e5484d' : '#7fd1a8');
		settle();
	} else say(n.name + ' destroyed', '#9fb0cc');
	if (game.tgt == n) game.tgt = null;
}
/* canisters: drifting, scooped through the open hatch, spilt through a jammed one */
function cargo(dt, cruising) {
	Ca.step(game.cans, game.t, dt);
	if (!hasHatch()) return;
	const B = R.basis(s.q), down = mul(B.u, -1), back = mul(B.f, -1);
	if (!M.works(fit, 'hatch')) {
		const out = Ca.spill(game.P, s, back, game.t, dt, game.spill);
		if (out.length) { if (!cruising) game.cans.push(...out); if (!game.saidSpill || game.t - game.saidSpill > 30) { game.saidSpill = game.t; say('Cargo spilling through the jammed hatch: ' + out[0].good, '#f2a33a') } }
		return;
	}
	if (!game.hatch || cruising) return;
	const r = Ca.scoop(game.cans, s, down, back, game.P, ship.cargo);
	for (const g of r.got) { say('Scooped 1 t ' + g + ' · hold ' + Tr.held(game.P) + '/' + ship.cargo + ' t', '#7fd1a8'); Snd.cue('scoop') }
	if ((r.full || r.fast) && (!game.saidScoop || game.t - game.saidScoop > 3)) { game.saidScoop = game.t; say(r.full ? 'Hold full: nothing more fits' : 'Too fast to scoop: under 20 m/s relative to the canister', '#f2a33a') }
}
/* ---------------- exploration ---------------- */
const pname = b => b.kind == 'planet' ? X.nameOf(game.P, game.star.id, b.name) : b.name;
const TYPE = {EarthLike: 'Earth-like', Gas: 'gas giant'};
function explore(dt, cruising) {
	const P = game.P, sensors = M.works(fit, 'sensors') && M.works(fit, 'power');
	/* the sweep: chart the system */
	if (game.sweep > 0 && sensors) {
		game.sweep -= dt;
		if (game.sweep <= 0) {
			game.sweep = 0;
			if (X.chartSystem(P, game.star, game.day)) {
				const pl = G.system(game.star).planets, by = {};
				for (const p of pl) by[TYPE[p.type] || p.type] = (by[TYPE[p.type] || p.type] || 0) + 1;
				say('System charted: ' + (pl.length ? Object.entries(by).map(([k, n]) => n + ' ' + k).join(', ') : 'no planets'), '#6cc9e8'); Snd.cue('chart');
			}
		}
	}
	/* a survey: the targeted planet, within 6 radii */
	const Tg = curTarget();
	if (Tg && Tg.kind == 'planet' && sensors && !cruising) {
		const key = X.keyOf(game.star.id, Tg.name), d = len(sub(s.p, Tg.pos));
		if (game.surveyKey != key) { game.surveyKey = key; game.surveyT = 0 }
		if (!X.surveyed(P, game.star.id, Tg.name) && d < Tg.radius * X.EXPLORE.surveyRadii) {
			game.surveyT += dt;
			if (game.surveyT >= X.EXPLORE.survey) surveyed(Tg);
		} else game.surveyT = Math.max(0, game.surveyT - dt * 0.5);
	}
	/* ruins: old sentinels rise to meet you, once a visit */
	if (!cruising) for (const b of scene.bodies) {
		if (b.kind != 'planet' || !b.src.ruins || game.guarded[b.name]) continue;
		if (len(sub(s.p, b.pos)) < b.radius * 25) { game.guarded[b.name] = 1; sentinels(b) }
	}
}
function surveyed(b) {
	const P = game.P, p = b.src, r = X.survey(P, game.star, p, game.port, game.day);
	if (!r.new) return;
	const atmo = p.atmo ? Math.round(p.bars * 10) / 10 + ' bar' : 'no air', facts = [TYPE[p.type] || p.type, p.g.toFixed(2) + ' g', Math.round(p.Ts) + ' K', atmo, 'ESI ' + p.esi.toFixed(2)];
	say('Survey of ' + pname(b) + ': ' + facts.join(' · '), '#6cc9e8');
	say((p.alive ? 'Life! ' : p.life ? 'Traces of life. ' : '') + (p.ruins ? 'Ruins of an earlier people. ' : '') + 'Resources: ' + (p.res || []).slice(0, 4).join(', ') + ' · data worth ' + Math.round(r.value) + ' SU', p.ruins || p.alive ? '#f2d36a' : '#9fb0cc');
	if (r.first) { say('First discovery: ' + pname(b) + ' is credited to you' + (p.alive || p.ruins ? '. Name it at a port\'s cartographers.' : '.'), '#7fd1a8'); Snd.cue('docked') } else Snd.cue('chart');
	X.surveyDone(P, game.star.id, p.name); settle();
	/* a ruin's cache: artefacts drift up as canisters */
	if (p.ruins) {
		const k = 2 + Math.floor(Math.random() * 3), up = norm(sub(s.p, b.pos)), f = Fl.forward(s);
		for (let i = 0; i < k; i++) game.cans.push(Ca.make('Artefacts', add(add(s.p, mul(f, 400 + i * 40)), mul(up, -60)), add(s.v, mul(up, 3)), game.t));
		say('The survey marks a cache: ' + k + ' canisters of Artefacts drift up ahead. Open the hatch (I) to scoop them.', '#f2d36a');
	}
	persist();
}
/* the old defences: two to four sentinels between you and the ruin */
function sentinels(b) {
	const k = 2 + Math.floor(Math.random() * 3), hull = S.ships().find(x => x.id == 'wisp'), toward = norm(sub(b.pos, s.p));
	place([...Array(k)].map((_, i) => ({role: 'sentinel', faction: 'ancients', ship: hull, name: 'Sentinel ' + 'αβγδ'[i], where: 'arrival', range: 3000 + i * 400, ai: 'attack'})));
	for (const n of game.npcs.filter(n => n.role == 'sentinel')) n.home = add(s.p, mul(toward, 3000));
	say('Old defences wake around ' + pname(b) + ': ' + k + ' sentinels', '#e5484d'); Snd.cue('incoming');
}
/* war missions: pay what's done, fail what's late */
function settle() {
	game.settledAt = game.t;
	for (const r of En.settle(game.P, game.day)) { say(r.text, r.ok ? '#7fd1a8' : '#e5484d'); Snd.cue(r.ok ? 'clearance' : 'warning') }
}
/* the ship is lost: a new one at the last port docked at */
function lost(how) {
	say('Ship destroyed: ' + how, '#e5484d'); Snd.cue('destroyed');
	/* the cargo goes down with her; the insurance pays for a new hull, less 5% of its value */
	const rb = Tr.rebuyCost(game.P, ship, game.day), paid = Tr.pay(game.P, rb.amount, rb.code, game.day);
	say(paid.ok ? 'Insurance: a new ' + ship.name + ' for ' + Math.round(rb.amount).toLocaleString('en-US') + ' ' + rb.code : 'Insurance: the replacement is on credit this time', '#f2a33a');
	game.P.cargo = {}; game.P.cost = {}; game.P.combat = C.refill(ship, {hull: 1}); game.cans = [];
	fit = M.fit(ship); game.fuel = 1; game.route = null;
	enterSystem(game.lastPort || game.home.star);
	launch(true);
	say('A new ' + ship.name + ' waits at ' + (st ? st.name : game.star.name));
}
function docked() {
	game.docked = true; s.v = [0, 0, 0]; s.w = [0, 0, 0]; game.lastPort = game.star;
	game.P.combat = C.keep(game.pcs); game.npcs = []; game.shots = []; game.booms = [];
	En.tick(game.P, game.star.id, 0, true); settle();
	Snd.cue('docked'); Snd.update({main: 0, rcs: 0, speed: 0, cruise: 0, strain: 0, conscious: true, docked: true});
	persist();
	openPort();
}
/* the starport, while docked */
function openPort() {
	Port.open({P: game.P, ship, fit, fuel: () => game.fuel, setFuel: f => { game.fuel = f; persist() }, star: game.star, port: game.port, stationName: st.name, day: game.day,
		onLaunch: () => { persist(); launch(false); hud.focus() },
		onShip: id => { ship = S.ships().find(x => x.id == id); fit = M.fit(ship); game.fuel = 1; game.P.combat = C.refill(ship, {hull: 1}); arm(); R.upload('ship', Me.ship(ship.length, quality)); openPortAgain(); persist() },
		say: t => say(t), cue: k => Snd.cue(k)});
}
/* after buying a ship, reopen with the new one (same screen) */
function openPortAgain() { const scr = document.querySelector('#port [aria-current="page"]'), k = scr && scr.dataset.screen; openPort(); if (k) { const b = document.querySelector('#port [data-screen="' + k + '"]'); if (b) b.click() } }
/* a new game: choose your origin among the great powers */
function chooseOrigin() {
	return new Promise(res => {
		const ov = $('ov'), body = $('ovBody'), btns = $('ovBtns'), majors = F.majors();
		btns.textContent = '';
		const K = G.clusters();
		body.innerHTML = '<h1 id="ovT">Choose your origin</h1><p>You start at your power\'s capital, with 20,000 SU in its currency and a ship from its yards. Its allies welcome you; its enemies won\'t let you dock.</p>'
			+ K.map(cl => '<h2 class="org-h">' + esc(cl.name) + '</h2><div class="org">' + majors.map((m, i) => [m, i]).filter(([m]) => m.cluster == cl.id).map(([m, i]) => {
				const al = majors.filter(x => x.id != m.id && F.relation(m.id, x.id) > 0).length, en = majors.filter(x => F.relation(m.id, x.id) < 0).length, sh = S.ships().find(x => x.id == Tr.newPlayer(m.id).ship.model);
				return '<button data-i="' + i + '"><b>' + esc(m.name.replace(/^The /, '')) + '</b><span>' + esc(m.species.name) + ' · ' + esc(m.species.build) + ' build, ' + esc(m.species.sight) + ' sight</span><span>' + esc(m.currency.name) + ' (' + m.currency.code + ') · ' + esc(m.home.name) + '</span><span>' + al + ' allies, ' + en + ' enemies · starts in a ' + esc(sh.name) + '</span></button>' }).join('') + '</div>').join('');
		ov.hidden = false;
		body.onclick = e => { const b = e.target.closest('button[data-i]'); if (!b) return; ov.hidden = true; body.onclick = null; res(+b.dataset.i) };
		const first = body.querySelector('button[data-i]'); if (first) first.focus();
	});
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
		const lightDir = norm(sub(sun.pos, b.pos)), bf = Sc.bodyFrame(b, Sc.turnOf(b, game.day, game.t)), rot = mat3(mul(bf.x, b.radius), mul(bf.y, b.radius), mul(bf.z, b.radius));
		const far = px(b.pos, b.radius * (b.ring ? 2.3 : 1)) < LOD.spritePx, atmo = b.atmo ? Me.atmosphere(b.type) : null;
		if (b.kind == 'star') {
			const c = Me.starColour(b.T);
			items.push({id: b.name, pos: b.pos, rot, light: lightDir, amb: 1, disc: {radius: b.radius, col: c, glow: true}, sprite: far ? {radius: b.radius, col: c, glow: true} : null});
			glows.push({pos: b.pos, radius: b.radius, col: c, alpha: b.companion ? 0.5 : 0.9, scale: 7, min: b.companion ? 0.015 : 0.05});
		} else {
			const pal = b.pal || (b.pal = avgColour(b));
			items.push({id: b.name, pos: b.pos, rot, light: lightDir, atmo, disc: {radius: b.radius, col: pal}, sprite: far ? {radius: b.radius, col: pal} : null});
			if (b.ring && !far) items.push({id: b.name + ':rings', pos: b.pos, rot, light: lightDir, amb: 0.45});   /* rings scatter light: lit even edge-on */
		}
		game.lod[far ? 'sprites' : 'meshes']++;
	}
	if (st) {
		const sl = norm(sub(sun.pos, st.c)), sd = len(sub(st.c, cam.p));
		if (sd > LOD.stationLo) { items.push({id: 'station:far', pos: st.c, light: sl, sprite: {radius: st.def.radius * 0.4, col: [0.6, 0.62, 0.66]}}); game.lod.station = 'sprite' }
		else {
			const det = sd < LOD.stationHi ? 'hi' : 'lo'; game.lod.station = det;
			for (const sp of [1, -1, 0]) {
				const a = Sc.angleAt(st, game.t, sp), c = Math.cos(a), sn = Math.sin(a);
				items.push({id: 'station:' + det + ':' + sp, pos: st.c, rot: mat3(add(mul(st.x, c), mul(st.y, sn)), add(mul(st.x, -sn), mul(st.y, c)), st.axis), light: sl, amb: 0.12});
			}
		}
	}
	if (game.chase) items.push({id: 'ship', pos: s.p, rot: mat3(B.r, B.u, B.f), light: norm(sub(sun.pos, s.p)), amb: 0.15});
	/* other ships, always in full; bolts and missiles as glows; explosions as growing glows */
	for (const n of game.npcs) {
		if (n.cs.dead) continue;
		const nb = R.basis(n.s.q);
		items.push({id: 'npc:' + n.ship.length, pos: n.s.p, rot: mat3(nb.r, nb.u, nb.f), light: norm(sub(sun.pos, n.s.p)), amb: 0.15});
	}
	for (const c of game.cans) {
		if (len(sub(c.p, cam.p)) > 20000) continue;
		const ax = norm(c.spin), a = c.angle, co = Math.cos(a), si = Math.sin(a), rotAx = v => add(add(mul(v, co), mul(cross(ax, v), si)), mul(ax, dot(ax, v) * (1 - co)));
		items.push({id: 'can', pos: c.p, rot: mat3(rotAx([1, 0, 0]), rotAx([0, 1, 0]), rotAx([0, 0, 1])), light: norm(sub(sun.pos, c.p)), amb: 0.2});
	}
	for (const m of game.shots) { const W = C.WEAPONS[m.kind], big = m.kind == 'missile' || m.kind == 'torpedo'; glows.push({pos: m.p, radius: big ? 6 : 2.5, col: W.col, alpha: 1, scale: 4, min: big ? 0.012 : 0.007}) }
	for (const b of game.booms) { const k = (game.t - b.t) / b.life; glows.push({pos: b.pos, radius: b.r * (0.4 + k), col: b.col, alpha: Math.max(0, 1 - k), scale: 3, min: 0.01}) }
	glows.push({pos: add(cam.p, mul(game.coreDir, 1e18)), radius: 1e16, col: [1, 0.85, 0.6], alpha: 0.22, scale: 1, min: 0.6});
	R.frame({cam, fov: 70, items, glows});
	gl.style.filter = game.vision && game.vision.blur > 0.01 && pilot.conscious ? 'blur(' + (game.vision.blur * 5).toFixed(1) + 'px)' : '';
	if (game.mapOpen) { const ctx = view.begin(); map.day = game.day; map.fuel = game.fuel; map.draw(ctx, W, Hh, game.t); return }
	hudDraw(cam);
}
function project(cam, p) {
	const B = R.basis(cam.q), d = sub(p, cam.p), z = dot(d, B.f), fy = 1 / Math.tan(35 * Math.PI / 180), k = fy * Hh / 2;
	return {x: W / 2 + dot(d, B.r) * k / z, y: Hh / 2 - dot(d, B.u) * k / z, z, dx: dot(d, B.r), dy: -dot(d, B.u), k};
}
function hudDraw(cam) {
	const ctx = view.begin(), Tg = curTarget(), cz = game.cruise;
	const frame = frameNear(), rel = Fl.relative(s, frame), speed = cz.on ? cz.v : len(rel.v);
	/* the target */
	const tp = posOf(Tg), pr = project(cam, tp), dist = len(sub(tp, s.p)) - (Tg == st ? 0 : radiusOf(Tg));
	const on = pr.z > 0 && pr.x > 0 && pr.x < W && pr.y > 0 && pr.y < Hh;
	const isShip = Tg.kind == 'ship', isCan = Tg.kind == 'canister';
	const target = {name: pname(Tg), kind: Tg == st ? st.def.name + ' · ' + st.def.size : isShip ? Tg.ship.size + ' ' + Tg.ship.role + ' · ' + Tg.role : isCan ? 'cargo canister · 1 t' : Tg.kind == 'planet' ? Tg.type + ' world' : 'star, class ' + (Tg.cls || ''), x: pr.x, y: pr.y, on, dist: Math.max(0, dist),
		size: on ? radiusOf(Tg) * pr.k / pr.z : 0, dx: pr.dx, dy: pr.dy, closing: dot(cz.on ? mul(Fl.forward(s), cz.v) : sub(s.v, isShip ? Tg.s.v : isCan ? Tg.v : [0, 0, 0]), norm(sub(tp, s.p)))};
	if (Tg == st) target.dock = dockCues(rel);
	if (Tg.kind == 'planet') {
		const done = X.surveyed(game.P, game.star.id, Tg.name), p = Tg.src, near = len(sub(s.p, Tg.pos)) < Tg.radius * X.EXPLORE.surveyRadii;
		target.dock = done ? {line1: 'Surveyed · ' + p.g.toFixed(2) + ' g · ' + Math.round(p.Ts) + ' K · ESI ' + p.esi.toFixed(2), line2: [p.alive ? 'life' : p.life ? 'traces of life' : null, p.ruins ? 'ruins' : null, p.atmo ? 'air ' + Math.round(p.bars * 10) / 10 + ' bar' : 'no air'].filter(Boolean).join(' · '), col: p.ruins || p.alive ? '#f2d36a' : '#7fd1a8'}
			: !M.works(fit, 'sensors') ? {line1: 'Sensors down: no survey', col: '#e5484d'}
			: near ? {line1: 'Surveying… ' + Math.round(100 * game.surveyT / X.EXPLORE.survey) + '%', col: '#6cc9e8'}
			: {line1: 'Survey: fly within ' + H.fmtDist(Tg.radius * X.EXPLORE.surveyRadii) + ' of the centre', col: '#9fb0cc'};
	}
	if (isCan) { const rv = len(sub(s.v, Tg.v)); target.dock = {line1: !hasHatch() ? 'No cargo hatch on this ship' : !M.works(fit, 'hatch') ? 'Hatch jammed: can\'t scoop' : !game.hatch ? 'Open the cargo hatch (I) to scoop' : rv > Ca.CAN.speed ? 'Slow down: ' + Math.round(rv) + ' m/s, under ' + Ca.CAN.speed : 'Drift it under the belly', col: game.hatch && rv <= Ca.CAN.speed ? '#7fd1a8' : '#f2a33a'} }
	if (isShip) {
		target.hostile = isHostile(Tg);
		target.bars = {what: target.hostile ? 'HOSTILE' : Tg.role == 'trader' ? 'CIVILIAN' : 'NEUTRAL', shield: Tg.cs.shield / Math.max(1, Tg.cs.shieldMax), hull: Tg.cs.hull / Tg.cs.hullMax};
		const g = game.pcs.load.guns.find(x => !C.WEAPONS[x.kind].homing);
		if (g && dist < 6000) { const lp = project(cam, C.lead(s.p, s.v, Tg.s.p, Tg.s.v, C.WEAPONS[g.kind].speed)); target.lead = {x: lp.x, y: lp.y, on: lp.z > 0} }
		const lk = game.pcs.lock; target.lock = lk.id == Tg.id ? Math.min(1, lk.t / C.COMBAT.lockTime) : 0; target.locked = !!game.locked;
	}
	/* the scanner: ships within 8 km, in the ship's frame */
	const SB = R.basis(s.q), blips = game.npcs.filter(n => !n.cs.dead).map(n => { const d = sub(n.s.p, s.p); return {x: dot(d, SB.r), y: dot(d, SB.u), z: dot(d, SB.f), col: isHostile(n) ? '#e5484d' : n.role == 'trader' ? '#9fb0cc' : n.faction == game.P.origin || F.relation(game.P.origin, n.faction) > 0 ? '#7fd1a8' : '#f2d36a', big: n.ship.length > 100, target: n == Tg} });
	for (const c of game.cans) { const d = sub(c.p, s.p); blips.push({x: dot(d, SB.r), y: dot(d, SB.u), z: dot(d, SB.f), col: '#c9a46a', target: c == Tg}) }
	for (const m of game.shots) if (m.kind == 'missile' || m.kind == 'torpedo') { const d = sub(m.p, s.p); blips.push({x: dot(d, SB.r), y: dot(d, SB.u), z: dot(d, SB.f), col: '#ffffff'}) }
	const pc = game.pcs, full = C.loadout(ship), ammoGuns = pc.load.guns.filter(g => g.ammo != null && g.kind != 'torpedo');
	const vm = speed > 2 ? project(cam, add(cam.p, mul(norm(cz.on ? Fl.forward(s) : rel.v), 1e6))) : null;
	const leg = nextLeg(), J = game.jump;
	H.draw(ctx, W, Hh, {
		speed, vmax: s.spec.vmax, throttle: game.throttle, fa: s.fa, cruise: cz.on, charging: cz.charge > 0 ? cz.charge : 0, massLocked: !cz.on && Sc.massLocked(scene, s.p),
		target, prograde: vm ? {x: vm.x, y: vm.y, on: vm.z > 0} : null, alerts: M.alerts(fit), modules: fit.modules, showSystems: game.systems, shipName: ship.name,
		messages: game.msgs, vision: game.vision, gFelt: game.gFelt, reduceFlash: RG.reduceFlash, thrustNote: s.fa ? null : 'Thrust ' + Math.round(game.throttle * 100) + '%',
		fuel: game.fuel, jumpCharge: J && J.tunnel == null ? J.charge : 0, witch: J && J.tunnel != null ? 1 - J.tunnel / JUMP.tunnel : null, witchTo: J && J.leg.star.name,
		nextLeg: leg ? 'Next: ' + leg.star.name + ' · ' + leg.d.toFixed(1) + ' pc' + (leg.kind != 'jump' ? ' (lane)' : '') + ' · J' : null,
		touch: RG.lastInput == 'touch', touchUI: touchLayout(),
		sweep: game.sweep > 0 ? 1 - game.sweep / X.EXPLORE.sweep : 0,
		hatch: !hasHatch() ? null : !M.works(fit, 'hatch') ? 'jammed' : game.hatch ? 'open' : null,
		scanner: M.works(fit, 'sensors') ? {range: 8000, blips} : null, incoming: game.incoming > 0, hitAge: game.hitAt != null ? game.t - game.hitAt : null,
		combat: {shield: pc.shield / Math.max(1, pc.shieldMax), hull: pc.hull / pc.hullMax, heat: Math.min(1, pc.heat), hot: pc.hot, armed: pc.load.guns.length > 0,
			ammo: ammoGuns.length ? ammoGuns.reduce((t, g) => t + g.ammo, 0) : null, missiles: pc.load.missiles + pc.load.guns.filter(g => g.kind == 'torpedo').reduce((t, g) => t + g.ammo, 0),
			missileMax: full.missiles + full.guns.filter(g => g.kind == 'torpedo').length, flares: pc.load.flares}
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
	const Tt = game.touch, r = Math.min(80, W * 0.12);
	const list = [['FIRE', 'fire', Tt.fire != null], ['MSL', 'missile', game.locked], ['FLARE', 'flare'], ['HOSTILE', 'hostile'], ['HATCH', 'hatch', game.hatch], ['FA', 'fa', s && s.fa], ['CRUISE', 'cruise', game.cruise.on], ['TARGET', 'target'], ['DOCK', 'dock'], ['MAP', 'map'], ['JUMP', 'jump', !!game.jump], ['VIEW', 'view'], ['II', 'pause']];
	return {stick: {x: r + 30, y: Hh - r - 30, r, dx: Tt.dx, dy: Tt.dy},
		thr: {x: W - 70, y: Hh - 200, w: 48, h: 170},
		buttons: list.map(([label, act, onFlag], i) => ({label, act, on: !!onFlag, x: W - 140 - (i % 4) * 72 - 80, y: Hh - 90 - Math.floor(i / 4) * 56, w: 64, h: 46}))};
}
function pointers() {
	const pt = e => { const p = view.toGame(e.clientX, e.clientY); return {x: p.x, y: p.y, touch: e.pointerType == 'touch', id: e.pointerId} };
	const Tt = game.touch;
	hud.addEventListener('pointermove', e => { game.ptr = pt(e); if (game.mapOpen) { map.move(game.ptr); return } if (Tt.stick && Tt.stick.id == e.pointerId) stickMove(game.ptr); if (Tt.thrId == e.pointerId) thrMove(game.ptr) });
	hud.addEventListener('pointerdown', e => {
		const p = pt(e); game.ptr = p; hud.focus();
		RG.lastInput = e.pointerType == 'touch' ? 'touch' : 'mouse';
		try { hud.setPointerCapture(e.pointerId) } catch (x) {}
		if (game.mapOpen) { const act = map.down(p); if (act) mapAct(act); return }
		if (e.pointerType != 'touch') { if (e.button == 0 && !game.docked) game.mouseFire = true; return }
		const u = touchLayout();
		const b = u.buttons.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
		if (b && b.act == 'fire') { Tt.fire = e.pointerId; return }
		if (b) { ({missile: () => { Tt.msl = true }, flare: () => { Tt.flare = true }, hostile: nearestHostile, hatch: toggleHatch, fa: toggleFA, cruise: toggleCruise, target: nextTarget, dock: requestDock, map: openMap, jump: requestJump, view: () => { game.chase = !game.chase }, pause: () => RG.pause()})[b.act](); return }
		if (Math.hypot(p.x - u.stick.x, p.y - u.stick.y) < u.stick.r * 1.6) { Tt.stick = {id: e.pointerId}; stickMove(p); return }
		if (p.x >= u.thr.x - 20 && p.x <= u.thr.x + u.thr.w + 20 && p.y >= u.thr.y - 20 && p.y <= u.thr.y + u.thr.h + 20) { Tt.thrId = e.pointerId; thrMove(p) }
	});
	const up = e => { if (e.pointerType != 'touch' && e.button == 0) game.mouseFire = false; if (Tt.fire == e.pointerId) Tt.fire = null; if (game.mapOpen) { map.up(pt(e)); return } if (Tt.stick && Tt.stick.id == e.pointerId) { Tt.stick = null; Tt.dx = Tt.dy = 0 } if (Tt.thrId == e.pointerId) Tt.thrId = null };
	hud.addEventListener('pointerup', up); hud.addEventListener('pointercancel', up);
	function stickMove(p) { const u = touchLayout().stick; let dx = (p.x - u.x) / u.r, dy = (p.y - u.y) / u.r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l } Tt.dx = dx; Tt.dy = dy }
	function thrMove(p) { const u = touchLayout().thr; Tt.thr = Math.max(0, Math.min(1, 1 - (p.y - u.y) / u.h)) }
}

/* ---------------- overlays ---------------- */
function overlay(kind) {
	const ov = $('ov'), body = $('ovBody'), btns = $('ovBtns');
	const close = () => { ov.hidden = true; RG.resume(); hud.focus() };
	btns.textContent = '';
	const button = (label, fn, primary) => { const b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'primary'; b.onclick = fn; btns.appendChild(b); return b };
	ov.hidden = false;   /* before pausing, so the pause handler sees the dialog is up */
	const o = owner(), where = game.star.name + (o ? ' · ' + o.name.replace(/^The /, '') : ' · unclaimed space');
	if (kind == 'help' || kind == 'pause') {
		RG.pause();
		body.innerHTML = '<h1 id="ovT">' + (kind == 'pause' ? 'Paused' : 'Controls') + '</h1><p>' + esc(ship.name) + ' · ' + esc(where) + ' · day ' + Math.floor(game.day) + ' · fuel ' + Math.round(game.fuel * 100) + '%. ' + (R.kind == 'webgl' ? 'WebGL 2.' : 'Canvas 2D fallback.') + '</p><table>' + HELP.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table>';
		button('Resume', close, true).focus();
		button('Graphics: ' + (quality == 'high' ? 'High' : 'Low'), e => { quality = quality == 'high' ? 'low' : 'high'; meshes(); e.target.textContent = 'Graphics: ' + (quality == 'high' ? 'High' : 'Low'); persist() });
		button('Sound: ' + (Snd.on ? 'On' : 'Off'), e => { Snd.setOn(!Snd.on); e.target.textContent = 'Sound: ' + (Snd.on ? 'On' : 'Off'); persist() });
		button('Save to a file', () => { persist(); setTimeout(() => RG.exportSave(), 300) });
		button('Load from a file', () => RG.importSave().then(() => location.reload(), e => say(e.message, '#f2a33a')));
		button('New game', e => { if (e.target.dataset.sure) { RG.save(null).then(() => { location.href = location.pathname }) } else { e.target.dataset.sure = 1; e.target.textContent = 'New game: sure? (the save is lost)' } });
	}
	ov.hidden = false;
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

start().catch(e => { console.error(e); const l = $('load'); if (l) l.textContent = '> could not start: ' + e.message });
})();
