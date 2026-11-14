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
   - Colonies (M5b, colonies.js): claimed at a colonial office (Contacts); in the system, N near the chosen world
     drops the beacon, and a constructor arrives; N within 3 km of it hands over the goods in your hold. Haulers on
     contract bring the rest. Finished, the colony's port opens the next day.
   - Outfitting (outfit.js): the ship is its hull plus its modules (core, internal, external, utility); its hold,
     shields, hull, range, fuel and guns come from them. Utility mounts decide what the ship can do: the nav beacon
     receiver brings you out at a populated system's nav beacon (and takes its system data); without one (or in a
     wild system) you come out near the star. The cartographic sensor charts wild systems and surveys planets.
     Warrant and manifest scanners read a targeted ship within 3 km in 3 s. Linguistic decoders let you understand
     other species: untranslated, their comms are garbled and their ports' services closed (fuel excepted).
   - Mining (mining.js): rings and belts have mining sites (targets); at one, a mining laser (fired with the guns)
     chips ore from asteroids; ore scooped through the hatch (or pulled in by a tractor beam) goes to the refinery,
     which turns each full tonne into cargo. A resource scanner reads an asteroid's contents.
   - Proximity safety: the ship won't go dangerously close to a star, a black hole or a world with air, and stops at
     an airless world's surface (no landing yet).
   - Black holes are wormholes: with an alien dimensional phaser fitted, J within 2,000 km of one phases through to
     a random star anywhere in the galaxy. Phasers and alien relay boosters are built from blueprints found in
     ruins, by an artifact broker (a station contact).
   - The Maw, the black hole at the centre, leads into the Rift (galaxy.js): the galaxy upside down, lifeless, with
     no powers, only about 1,600 Precursor anchorages (one at the Maw) and the Riftborn (encounters.js), its own ores and the Precursors' ruins,
     whose blueprints a broker builds into Precursor modules and hulls (outfit.js, ships.js). The Maw there leads home.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const Te = window.EmberTerrain, Ld = window.EmberLanding, E = window.EmberEconomy, G = window.EmberGalaxy, F = window.EmberFactions, S = window.EmberShips, Fl = window.EmberFlight, M = window.EmberModules,
	Pi = window.EmberPilot, Sc = window.EmberScene, Me = window.EmberMeshes, Re = window.EmberRender, H = window.EmberHUD, RG = window.RG,
	Snd = window.EmberSound, St = window.EmberSettings, I18 = window.EmberI18n, Sv = window.EmberSave, T = window.EmberTravel, Map = window.EmberMap, Tr = window.EmberTrade, Port = window.EmberPort,
	C = window.EmberCombat, En = window.EmberEncounters, Ca = window.EmberCanisters, X = window.EmberExplore, Co = window.EmberColonies, O = window.EmberOutfit, Mi = window.EmberMining, Ins = window.EmberInsurance;
const {add, sub, mul, dot, len, norm, cross} = Sc.v;
const Q = new URLSearchParams(location.search), DEBUG = Q.has('debug');
/* the release: the Single-Player Alpha Build (SPAB) in the Rudolf OS Library */
const BUILD = {name: 'Single-Player Alpha Build', version: '0.3.1'};
const $ = id => document.getElementById(id);
const LOD = {spritePx: 48, stationHi: 20000, stationLo: 500000};
const JUMP = {charge: 5, tunnel: 2.6};
let quality = Q.get('quality') == 'low' ? 'low' : 'high';
const gl = $('gl'), hud = $('hud');

const KEYS = {
	pitchDown: ['ArrowUp', 'KeyW'], pitchUp: ['ArrowDown', 'KeyS'], rollLeft: ['ArrowLeft'], rollRight: ['ArrowRight'],
	yawLeft: ['KeyA', 'pad:4'], yawRight: ['KeyD', 'pad:5'], faster: ['KeyR', 'Equal', 'NumpadAdd'], slower: ['KeyF', 'Minus', 'NumpadSubtract'], stop: ['KeyX', 'Backspace'],
	strafeL: ['KeyQ', 'pad:14'], strafeR: ['KeyE', 'pad:15'], strafeU: ['Space', 'pad:12'], strafeD: ['ShiftLeft', 'pad:13'],
	fa: ['KeyZ', 'pad:1'], cruise: ['KeyC', 'pad:3'], target: ['KeyT', 'Tab', 'pad:2'], dock: ['KeyN'], view: ['KeyV', 'pad:11'],
	map: ['KeyG', 'pad:8'], jump: ['KeyJ', 'pad:10'], route: ['Enter', 'NumpadEnter'], home: ['Home', 'KeyY'],
	hatch: ['KeyI'], fire: ['Semicolon', 'pad:7'], gear: ['KeyL'], missile: ['KeyK', 'pad:6'], flare: ['KeyB'], hostile: ['KeyU'],
	systems: ['KeyO'], lights: ['Digit1'], nightVision: ['Digit2'], mode: ['KeyM'], radial: ['Backquote'], mouse: [], help: ['KeyH', 'F1'], pause: ['KeyP', 'Escape', 'pad:9'],
	dbgPirates: ['Digit6'], dbgBreak: ['Digit9'], dbgCanopy: ['Digit0'], dbgNear: ['Digit7'], dbgRoute: ['Digit8']};
/* the controls help: every action with its keys as bound now (Settings rebinds them), in the chosen language */
const tr = (t, v) => I18.T(t, v);
const helpRows = () => St.GROUPS.flatMap(([g, acts]) => acts.filter(a => KEYS[a] && (!game.settings || game.settings.controls.scheme != 'simple' || St.SIMPLE.includes(a))).map(a => [(RG.bindings()[a] || []).map(St.keyName).join(' / ') || tr('Unbound'), tr(St.ACTION[a])]));

let baseShip = null, W = 1, Hh = 1, view = null, R = null, scene = null, st = null, ship = null, s = null, fit = null, pilot = null, map = null;
const game = {t: 0, day: 200, star: null, port: null, fuel: 1, route: null, jump: null, lastPort: null, mapOpen: false,
	cruise: {on: false, v: 0, charge: 0}, throttle: 0, target: 0, clearance: null, docked: false, chase: false, systems: false, mouseFly: false, msgs: [], vision: null, gFelt: null, lastStep: null,
	axes: {pitch: 0, roll: 0, yaw: 0}, ptr: null, touch: {stick: null, dx: 0, dy: 0, thr: null, fire: null, msl: false},
	tgt: null, npcs: [], shots: [], beams: [], booms: [], cans: [], hatch: false, spill: {}, fields: [], field: null, rocks: [], sweep: 0, surveyT: 0, surveyKey: null, guarded: {}, pcs: null, visits: 0, mouseFire: false, own: null};
const say = (text, col) => { game.msgs.push({text, col, t: game.t}); if (game.msgs.length > 12) game.msgs.shift() };
const at = x => [x.x, x.y, x.z];
const owner = () => game.port ? F.byId(game.port.owner) : null;

/* ---------------- settings (settings.js) ---------------- */
const fovNow = () => game.settings ? game.settings.graphics.fov : 70;
const reduceFlash = () => { const f = game.settings.a11y.flash; return f == 'os' ? !!RG.reduceFlash : f == 'on' };
game.captions = []; game.fps = null;
/* what a sound sounds like, for the captions */
const CAPTION = {warning: 'Warning', critical: 'Critical alarm', clearance: 'Clearance granted', refused: 'Refused', docked: 'Docked', launch: 'Launched', collide: 'Collision', charge: 'Drive charging', cruise: 'Cruise', drop: 'Dropped out of cruise',
	emergency: 'Emergency drop', faOn: 'Flight assist on', faOff: 'Flight assist off', blackout: 'Blackout', wake: 'Waking', jump: 'Jump', arrive: 'Arrived', destroyed: 'Ship destroyed', pulse: 'Weapons fire', driver: 'Weapons fire', heavy: 'Weapons fire',
	missile: 'Missile launched', flare: 'Flare', shieldHit: 'Shield hit', hullHit: 'Hull hit', boom: 'Explosion', lock: 'Missile lock', chart: 'System charted', hatch: 'Cargo hatch', scoop: 'Canister scooped', incoming: 'Missile incoming'};
/* apply what changed (or everything) */
function applySettings(what) {
	const S = game.settings, all = !what;
	if (all || what == 'lang') I18.setLang(I18.resolve(S.lang, RG.lang, navigator.language));
	if (all || what == 'controls') RG.bind(St.bindings(KEYS, S));
	if (all || what == 'audio') { Snd.setOn(S.audio.on); Snd.setVolumes && Snd.setVolumes(S.audio) }
	if (all || what == 'graphics') { if (S.graphics.quality != quality) { quality = S.graphics.quality; if (R && scene) meshes() } if (game.lastView) RG.emit ? RG.emit('resize', game.lastView) : view && view.refit() }
	if (all || what == 'hud' || what == 'a11y') { H.setOptions && H.setOptions({size: S.hud.size / 100, messages: S.hud.messages, msgTime: S.hud.msgTime, palette: S.a11y.palette, contrast: S.a11y.contrast}); hud.style.opacity = S.hud.opacity / 100 }
	Snd.onCue = S.a11y.captions ? k => { if (CAPTION[k]) { const t = tr(CAPTION[k]), last = game.captions[game.captions.length - 1]; if (last && last.text == t && game.t - last.t < 1) last.t = game.t; else game.captions.push({text: t, t: game.t}); if (game.captions.length > 4) game.captions.shift() } } : null;
}
/* the settings, on the pause screen's card */
function openSettings(back) {
	const body = $('ovBody'), btns = $('ovBtns'); btns.textContent = '';
	St.open(body, game.settings, {defaults: KEYS, osLang: () => RG.lang, nav: navigator.language, apply: w => { applySettings(w); persist(); if (w == 'lang') { done.textContent = tr('Done') } }});
	const done = document.createElement('button'); done.className = 'primary'; done.textContent = tr('Done'); done.onclick = () => { body.onclick = body.oninput = body.onchange = null; back() }; btns.appendChild(done); done.focus();
}
/* ---------------- start ---------------- */
async function start() {
	await RG.init('ember-reach');
	RG.bind(KEYS);
	const majors = F.majors();
	/* the save, unless the URL asks for a particular system, port or ship */
	let sv = null;
	try { sv = Sv.unpack(await RG.load(), {powers: majors.length, ports: Object.keys(Sc.STATION), ships: [...S.ships(), ...S.precursors()].map(x => x.id)}) } catch (e) { sv = null }
	const fresh = ['power', 'port', 'ship', 'day'].some(k => Q.has(k));
	/* the settings: the save's (a first game follows Rudolf OS's language, or the browser's) */
	game.settings = St.sanitise(sv && sv.settings, Object.keys(KEYS), I18.LANGS.map(l => l[0]));
	if (Q.get('quality')) game.settings.graphics.quality = Q.get('quality') == 'low' ? 'low' : 'high';
	applySettings();
	/* Rudolf OS's language changed, or stopped being shared: follow it if that's the choice */
	RG.on('settings', () => { if (game.settings.lang == 'os') applySettings('lang') });
	if (fresh) sv = sv && {settings: sv.settings};
	const ok = sv && sv.ship;
	/* the player: from the save; or, for a new game, the origin from the URL or chosen here */
	let originIdx = ok ? sv.power : Q.has('power') ? Math.max(0, Math.min(majors.length - 1, +Q.get('power'))) : null;
	if (originIdx == null) { $('load').style.display = 'none'; originIdx = await chooseOrigin(sv && sv.oldGalaxy); $('load').style.display = '' }
	game.power = originIdx;
	game.home = majors[game.power];
	game.P = ok && sv.player ? sv.player : Tr.newPlayer(game.home.id);
	if (Q.has('ship') && !ok) game.P.ship.model = Q.get('ship');
	Co.registerScrips(game.P);
	game.homePort = !ok && Sc.STATION[Q.get('port')] ? Q.get('port') : ok && sv.version == 1 ? sv.port : 'halo';
	baseShip = S.hull(game.P.ship.model) || S.hull('wren');
	if (!O.valid(baseShip, game.P.ship.fit)) game.P.ship.fit = O.stock(baseShip);
	ship = O.derive(baseShip, game.P.ship.fit);
	game.day = ok ? sv.day : +(Q.get('day') || 200);
	game.fuel = ok ? sv.fuel : 1;
	const here = ok && sv.star ? T.starAt(sv.star.id, sv.star.p) : null;
	game.lastPort = ok && sv.lastPort ? T.starAt(sv.lastPort.id, sv.lastPort.p) : null;
	/* renderer, then the system */
	R = Re.create(gl, {canvas2d: Q.has('canvas'), antialias: game.settings.graphics.aa});
	enterSystem(here || game.home.star);
	view = RG.fit(hud, (w, h) => ({w, h}));
	/* (the 3D view's resolution: the screen's, times the Resolution setting) */
	RG.on('resize', v => { game.lastView = v; W = v.w; Hh = v.h; sizeCanvas() });
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
	G.realm(star.rift ? 'rift' : 'normal');   /* the map, routes and everything near you: in the Rift, or this side */
	const capHome = star.id == game.home.star.id;
	game.port = capHome ? {cls: game.homePort, world: game.home.home.name, owner: game.home.id, capital: true} : Co.portOf(game.P, star, game.day) || T.portFor(star, game.day);
	scene = Sc.build(star, {day: game.day, port: game.port ? game.port.cls : null, portWorld: game.port ? game.port.world : undefined});
	st = scene.station;
	game.tgt = null; game.clearance = null; game.npcs = []; game.shots = []; game.beams = []; game.booms = []; game.cans = []; game.marshalsAt = null; game.held = null; game.landed = null; game.lastAlt = null; game.autoJumpAt = null; game.deposits = []; game.gscan = null;
	game.sweep = game.P && X.isCharted(game.P, star.id) ? 0 : X.EXPLORE.sweep; game.surveyT = 0; game.surveyKey = null; game.guarded = {};
	game.own = game.port && game.port.capital ? {owner: game.port.owner, contested: false} : T.ownerOf(star, game.day);
	site(); beaconAt();
	game.fields = Mi.fields(scene, star).map(f => Object.assign(f, {kind: 'field', radius: 500, fieldKind: f.kind})); game.field = null; game.rocks = [];
	meshes();
}
/* every mesh, at the graphics setting */
function meshes() {
	R.clear();   /* (the last system's meshes, from the GPU too) */
	TILES.world = null; TILES.built.clear(); TILES.used.clear();
	for (const b of scene.bodies) { R.upload(b.name, b.kind == 'star' ? Me.star(b.T, quality) : Me.planet(b, quality)); if (b.ring) R.upload(b.name + ':rings', Me.rings(b.ring, b.seed, quality)) }
	if (st) for (const det of ['hi', 'lo']) Me.station(st.def, st.parts, det).forEach(g => R.upload('station:' + det + ':' + g.spin, g.mesh));
	R.upload('ship', Me.ship(ship.length, quality));
	R.upload('constructor', Me.ship(600, quality));
	R.upload('ore', Me.rock(1.6, 5, 'rocky'));
	R.upload('can', Me.box([0, 0, 0], [0.8, 0.8, 1.3], [0.86, 0.52, 0.18, 0]));
	game.npcMeshes = new Set(); for (const n of game.npcs) npcMesh(n); if (game.field) for (const r of game.rocks) rockMesh(r);
	R.setSky(sky(game.star));
}
/* the sky: real neighbours by their light, out to 30 pc (closer where stars crowd: at most a few thousand); and
   the glow of the galaxy's core */
function sky(home) {
	const out = [], n = G.densityHere(home.x, home.y, home.z) + 1e-9, Rr = Math.min(30, Math.cbrt(7000 / (n * 4.19)));
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
	if (!st) { const a = arrivalPoint(); s = Fl.create(ship, a) }
	else {
		const sp = Sc.spawn(scene, first ? (DEBUG && +Q.get('spawn') || 2500) : 30);
		s = Fl.create(ship, first ? sp : {p: sp.p, q: Sc.lookRotation(st.axis, st.y), v: mul(st.axis, 40)});
		if (!first) s.q = Sc.lookRotation(st.axis, st.y);
	}
	s.radius = Math.max(2, ship.length / 2);
	fit = fit || M.fit(ship); pilot = Pi.create(); M.apply(fit, s); arm();
	game.cruise = {on: false, v: 0, charge: 0}; game.throttle = first ? 0 : 0.2; game.docked = false; game.tgt = null; game.hatch = false; game.gear = false; game.clearance = null; game.jump = null;
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
	game.t = sv.t; game.throttle = sv.throttle; game.docked = !!(sv.docked && st);
	/* landed where it was (L1.2): back on the ground at its place on the turning world */
	if (sv.landed && !game.docked && scene.bodies.some(b => b.name == sv.landed.world)) { game.landed = sv.landed; game.gear = true; landedStep(null) } else game.gear = !!sv.gear; game.clearance = game.docked && sv.pad ? {pad: sv.pad, until: Infinity} : null;
	if (!game.lastPort) game.lastPort = st ? game.star : game.home.star;
	say(game.docked ? 'Welcome back: docked at ' + st.name : st ? 'Welcome back, ' + H.fmtDist(len(sub(s.p, st.c))) + ' from ' + st.name : 'Welcome back, in the ' + game.star.name + ' system');
}
/* save now (gamekit keeps it); quietly, at most once a second */
function persist() {
	if (!s || !fit) return;
	if (game.saving) { game.savePending = true; return }   /* (a save asked for meanwhile follows the one under way, so the last word is kept) */
	game.savePending = false;
	game.saving = true; game.savedAt = game.t;
	const routeTo = game.route && game.route.toStar ? game.route.toStar : null;
	game.P.day = game.day;
	if (game.pcs && !game.docked) game.P.combat = C.keep(game.pcs);
	RG.save(Sv.pack({player: game.P, power: game.power, port: st ? st.cls : null, ship: ship.id, day: game.day, t: game.t, docked: game.docked, pad: game.clearance && game.clearance.pad, s, throttle: game.throttle, fit,
		star: game.star, fuel: game.fuel, lastPort: game.lastPort, routeTo, settings: game.settings, landed: game.landed, gear: game.gear}))
		.catch(e => { if (!game.saveWarned) { game.saveWarned = true; say('Could not save: ' + e.message, '#f2a33a') } })
		.then(() => { setTimeout(() => { game.saving = false; if (game.savePending) persist() }, 1000) });
}
const nearRocks = () => game.rocks.filter(r => len(sub(r.pos, s.p)) < 5000).sort((a, b) => len(sub(a.pos, s.p)) - len(sub(b.pos, s.p))).slice(0, 5);
const targets = () => [...(st ? [st] : []), ...(game.beacon ? [game.beacon] : []), ...(game.deposits || []), ...nearRocks(), ...game.fields, ...(game.site ? [game.site] : []), ...game.npcs.filter(n => !n.cs.dead), ...game.cans, ...scene.bodies.filter(b => b.kind == 'planet'), ...scene.bodies.filter(b => b.kind == 'star')];
/* the target is kept by reference (ships come and go); a lost one falls back to the port, or the first body */
function curTarget() { const L = targets(); if (!L.includes(game.tgt)) game.tgt = L[0]; return game.tgt }
const posOf = x => x.pos || x.c;
const radiusOf = x => x.radius || x.def.radius;
/* the frame flight runs in: a station's near it, a world's below its Kármán line (so a hover holds its spot over the
   turning ground), space's otherwise */
const frameNear = () => st && len(sub(s.p, st.c)) < 8000 ? Sc.frame(st) : game.well ? Sc.worldFrame(game.well.body) : null;

/* ---------------- input ---------------- */
function readPad() {
	let g = null; try { g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean) } catch (e) {}
	if (!g) return null;
	const z = game.settings.controls.deadzone / 100, ax = i => { const v = g.axes[i] || 0; return Math.abs(v) < z ? 0 : (v - Math.sign(v) * z) / (1 - z) };
	const bt = i => g.buttons[i] ? g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0) : 0;
	/* left stick pitch and roll; right stick yaw and throttle (the triggers fire guns and missiles) */
	return {roll: -ax(0), pitch: ax(1) * (game.settings.controls.invertPad ? -1 : 1), yaw: ax(2), thr: -ax(3)};
}
function controls(dt) {
	if (game.mapOpen || game.radial) return {pitch: 0, roll: 0, yaw: 0, strafe: [0, 0], throttle: game.throttle, thrust: s.fa ? 0 : 0};
	const ease = (cur, want, k) => cur + (want - cur) * Math.min(1, k * dt);
	const d = a => RG.down(a) ? 1 : 0;
	const A = game.axes;
	A.pitch = ease(A.pitch, d('pitchDown') - d('pitchUp'), 6); A.roll = ease(A.roll, d('rollLeft') - d('rollRight'), 6); A.yaw = ease(A.yaw, d('yawRight') - d('yawLeft'), 6);
	let pitch = A.pitch, roll = A.roll, yaw = A.yaw, sx = d('strafeR') - d('strafeL'), sy = d('strafeU') - d('strafeD'), thr = 0;
	const pad = readPad();
	if (pad) { pitch += pad.pitch; roll += pad.roll; yaw += pad.yaw; thr += pad.thr }
	if (game.mouseFly && game.ptr && !game.ptr.touch) { const mx = (game.ptr.x - W / 2) / (W / 2), my = (game.ptr.y - Hh / 2) / (Hh / 2), dz = v => Math.abs(v) < 0.06 ? 0 : v; const k = 1.4 * game.settings.controls.mouseSens / 100; roll -= dz(mx) * k; pitch += dz(my) * k * (game.settings.controls.invertMouse ? -1 : 1) }
	const Tt = game.touch;
	if (Tt.stick) { pitch += Tt.dy; roll -= Tt.dx }
	if (Tt.vert) sy += Tt.vert;
	thr += d('faster') - d('slower');
	if (s.fa || game.cruise.on) {
		game.throttle = Math.max(game.cruise.on ? 0 : -0.3, Math.min(1, game.throttle + thr * 0.6 * dt));
		if (Tt.thr != null) game.throttle = Tt.thr;
		/* the hatch's trim: the set speed can't pass 12% of top speed */
		if (s.hatch && !game.cruise.on) { const k = Fl.TUNE.hatch.speed; game.throttle = Math.max(-k, Math.min(k, game.throttle)) }
		if (RG.pressed('stop')) game.throttle = 0;
		/* the landing gear down: no faster than 100 m/s */
		if (game.gear && !game.cruise.on) game.throttle = Math.min(game.throttle, GEAR.vmax / s.spec.vmax);
	} else game.throttle = Math.max(-1, Math.min(1, Tt.thr != null ? Tt.thr * 2 - 1 : thr));
	const c = v => Math.max(-1, Math.min(1, v));
	return {pitch: c(pitch), roll: c(roll), yaw: c(yaw), strafe: [c(sx), c(sy)], throttle: game.throttle, thrust: s.fa ? 0 : game.throttle};
}
/* the gamepad's A (landing L1.5): a short press asks for docking, held half a second it moves the landing gear */
function padA(dt) {
	let g = null; try { g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean) } catch (e) {}
	const on = !!(g && g.buttons[0] && (g.buttons[0].pressed || g.buttons[0].value > 0.5));
	if (on) { game.padA = (game.padA || 0) + dt; if (game.padA >= 0.5 && !game.padAGear) { game.padAGear = true; toggleGear() } return }
	if (game.padA && !game.padAGear) requestDock();
	game.padA = 0; game.padAGear = false;
}
function actions(dt) {
	if (Port.isOpen()) return;   /* the starport takes the keys while docked */
	if (RG.pressed('help')) overlay('help');
	if (game.mapOpen) { mapKeys(dt); return }
	if (RG.pressed('pause')) { RG.pause(); return }
	if (RG.pressed('map')) { openMap(); return }
	if (RG.pressed('view')) game.chase = !game.chase;
	if (RG.pressed('systems')) game.systems = !game.systems;
	if (RG.pressed('mouse')) toggleMouse();
	if (radialStep()) return;   /* (the radial menu, held on ~, takes the other keys while it's open) */
	if (game.docked || game.jump && game.jump.tunnel != null) return;
	if (!pilot.conscious) return;
	if (RG.pressed('fa')) toggleFA();
	if (RG.pressed('mode')) toggleMode();
	if (RG.pressed('target')) game.mode == 'analysis' ? nextTarget(true) : nextTarget();
	if (RG.pressed('hostile')) game.mode == 'analysis' ? nearestInterest() : nearestHostile();
	if (RG.pressed('hatch')) toggleHatch();
	if (RG.pressed('gear')) toggleGear();
	padA(dt);
	if (RG.pressed('lights')) toggleLights();
	if (RG.pressed('nightVision')) toggleNightVision();
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
/* the landing gear (L): down or up. Down, top speed is held to 100 m/s; it only goes down below that. (Landing
   itself comes in L1: docs/plan-ember-reach-landing-work.md) */
const GEAR = Ld.GEAR;   /* (landing.js: 100 m/s with the gear down; down by itself under 300 m, up above 500 m) */
function toggleGear() {
	if (game.cruise.on) return;
	if (game.landed) { say('Landed: the gear stays down until you lift off', '#f2a33a'); Snd.cue('refused'); return }
	if (!game.gear && len(Fl.relative(s, frameNear()).v) > GEAR.vmax + 1) { say(tr('Landing gear: down only below 100 m/s'), '#f2a33a'); Snd.cue('refused'); return }
	game.gear = !game.gear; say(tr(game.gear ? 'Landing gear down' : 'Landing gear up'), '#9fb0cc'); Snd.cue('hatch');
}
/* ---------------- landing (L1.2) ---------------- */
const gearWorks = () => M.works(fit, 'gear');
/* the gear by itself: down when you come under 300 m over ground you could land on, up again above 500 m */
function surfaceGear() {
	if (!game.settings.controls.autoGear) { game.lastAlt = null; return }
	const sf = Sc.surfaceState(scene, s, game.t, ship); if (!sf || !Ld.landable(sf.body.src).ok) { game.lastAlt = null; return }
	const was = game.lastAlt; game.lastAlt = sf.alt;
	if (was == null) return;
	if (!game.gear && was >= GEAR.auto.down && sf.alt < GEAR.auto.down) { game.gear = true; say(tr('Landing gear down') + (gearWorks() ? '' : ': it won\'t lock. A belly landing'), gearWorks() ? '#9fb0cc' : '#e5484d'); Snd.cue('hatch') }
	if (game.gear && was <= GEAR.auto.up && sf.alt > GEAR.auto.up) { game.gear = false; say(tr('Landing gear up'), '#9fb0cc'); Snd.cue('hatch') }
}
/* first contact with the ground: a landing, a hard landing (hull damage), or a crash (the insurer takes over) */
function touch() {
	const sf = Sc.surfaceState(scene, s, game.t, ship); if (!sf || !Ld.landable(sf.body.src).ok) return false;
	const onGear = game.gear && gearWorks(), low = Ld.lowest(ship, onGear, sf.pitch);
	if (sf.alt - low.d > 0) return false;
	const out = Ld.contact(ship, sf, onGear), what = low.part == 'gear' ? '' : low.part == 'nose' ? ' nose first' : ' on the belly';
	if (out.crash) { Snd.cue('collide', 1); lost('a crash on ' + sf.world + what); return true }
	if (out.hard) {
		const hull = game.pcs.hullMax * out.damage; game.pcs.hull = Math.max(1, game.pcs.hull - hull); damage(hull * 0.5);
		const g = M.get(fit, 'gear'); if (g) { const a = M.damage(fit, 'gear', g.max * Math.min(1, out.damage * 2)); if (a) moduleAlert(a) }
		game.hitAt = game.t; Snd.cue('collide', Math.min(1, out.x / 3));
		say('Hard landing' + what + ' on ' + sf.world + ': ' + Math.abs(sf.vz).toFixed(1) + ' m/s down, hull −' + Math.round(out.damage * 100) + '%', '#f2a33a');
	} else { Snd.cue('docked'); say('Landed on ' + sf.world + ' · ' + Math.abs(sf.vz).toFixed(1) + ' m/s down · ' + sf.lat.toFixed(2) + '°, ' + sf.lon.toFixed(2) + '°', '#7fd1a8') }
	game.landed = Sc.landAt(scene, s, sf.body, game.t, low.d);
	/* a first landing on this world: recorded, and its data sells to cartographers (L1.4) */
	const L0 = X.landed(game.P, game.star, sf.body.src, game.port, game.day);
	if (L0.new) say((L0.first ? 'First landing on ' : 'Landing recorded: ') + pname(sf.body) + ' · landing data worth ' + Math.round(L0.value).toLocaleString('en-US') + ' SU to cartographers', L0.first ? '#7fd1a8' : '#6cc9e8');
	game.cruise = {on: false, v: 0, charge: 0}; game.jump = null; game.throttle = 0;
	landedStep(null);
	persist();
	return true;
}
/* landed: fixed to the ground, turning with the world; vertical thrust (or the throttle past 10%) lifts off */
function landedStep(input) {
	const pin = Sc.pinLanded(scene, game.landed, game.t);
	if (!pin) { game.landed = null; return }
	if (input && (input.strafe[1] > 0.5 || game.throttle > 0.1)) { liftOff(pin); return }
	s.p = pin.p; s.q = pin.q; s.v = pin.v; s.w = [0, 0, 0];
	s.grav = Sc.gravityAt(scene, s.p); game.well = Sc.gravityWell(scene, s.p); game.gFelt = null;
}
function liftOff(pin) {
	const up = norm(sub(pin.p, pin.body.pos));
	game.landed = null; s.p = add(pin.p, mul(up, 0.5)); s.q = pin.q; s.v = add(pin.v, mul(up, 3)); s.w = [0, 0, 0];
	game.lastAlt = 0; say('Lifting off from ' + pin.body.name, '#6cc9e8'); Snd.cue('launch');
}
/* ---------------- the ground scan (L1.4) ----------------
   Landed or within 2 km of the ground, the sensors scan it (6 s): the deposits of the world's resources within 5 km
   are marked, and can be targeted (T). Again once you've moved 2.5 km on */
const GSCAN = {alt: 2000, time: 6, range: 5000, again: 2500};
function groundScan(dt, cruising) {
	if (cruising || !game.well) { game.gscan = null; return }
	const sf = Sc.surfaceState(scene, s, game.t, ship); if (!sf || !Ld.landable(sf.body.src).ok) { game.gscan = null; return }
	if (!game.landed && sf.alt > GSCAN.alt) { game.gscan = null; return }
	if (!M.works(fit, 'sensors')) return;
	const here = Sc.localDir(scene, sf.body, sf.up, game.t), last = game.gscanAt;
	if (last && last.world == sf.world && Math.acos(Math.max(-1, Math.min(1, here[0] * last.dir[0] + here[1] * last.dir[1] + here[2] * last.dir[2]))) * sf.body.radius < GSCAN.again) return;
	const g = game.gscan = game.gscan || {t: 0};
	g.t += dt;
	if (g.t < GSCAN.time) return;
	game.gscan = null; game.gscanAt = {world: sf.world, dir: here};
	const b = sf.body, list = X.deposits(b, b.src, here, GSCAN.range);
	game.deposits = list.map(d => ({kind: 'deposit', dep: d, world: b, radius: 30, name: d.res + ' deposit', get pos() { const bf = Sc.bodyFrame(b, Sc.turnOf(b, game.day, game.t)), w = add(add(mul(bf.x, d.dir[0]), mul(bf.y, d.dir[1])), mul(bf.z, d.dir[2])); return add(b.pos, mul(w, b.radius + Sc.heightAt(b, d.dir) + 2)) }}));
	if (!list.length) say('Ground scan of ' + pname(b) + ': no deposits within 5 km', '#9fb0cc');
	else { const by = {}; for (const d of list) by[d.res] = (by[d.res] || 0) + 1; say('Ground scan: ' + list.length + (list.length == 1 ? ' deposit' : ' deposits') + ' within 5 km (' + Object.entries(by).map(([r, n]) => r + (n > 1 ? ' ×' + n : '')).join(', ') + '). T to target them', '#c9a46a') }
	Snd.cue('chart');
}
/* ---------------- assists (Settings › Controls; on with the Simple scheme) ---------------- */
/* spotlights by themselves: on over the night side of a world you could land on, under 5 km; off again after, unless
   you switched them yourself */
function autoLights() {
	if (!game.settings.controls.autoLights) return;
	const sf = game.well && Sc.surfaceState(scene, s, game.t, ship), sun = scene.bodies[0];
	const night = sf && Ld.landable(sf.body.src).ok && sf.alt < 5000 && dot(sf.up, norm(sub(sun.pos, s.p))) < 0.05;
	if (night && !game.lights && game.lightsAuto == null && M.works(fit, 'power')) { game.lights = true; game.lightsAuto = true; say('Spotlights on by themselves: the night side', '#9fb0cc') }
	if (!night && game.lightsAuto) { game.lights = false; say('Spotlights off by themselves', '#9fb0cc') }
	if (!night) game.lightsAuto = null;
}
/* the landing assist: with the gear down and flight assist on, under 300 m the descent is held to a safe rate (three
   quarters of this ship's touchdown limit near the ground, a tenth of the height above it) */
function landAssist() {
	if (!game.settings.controls.landAssist || !game.gear || !s.fa || game.landed) return;
	const sf = Sc.surfaceState(scene, s, game.t, ship); if (!sf || sf.alt > GEAR.auto.down || !Ld.landable(sf.body.src).ok) return;
	const lim = Ld.TOUCH[Ld.padFor(ship.size)].vz, vmax = Math.max(lim * 0.75, sf.alt * 0.1);
	if (sf.vz < -vmax) s.v = add(s.v, mul(sf.up, -vmax - sf.vz));
}
/* ---------------- modes, the radial menu, analysis ---------------- */
/* M: Combat mode (weapons, missiles, flares, hostiles) or Analysis mode (weapons safe but the mining lasers; scans,
   the pulse scanner, points of interest). Steering, thrust and navigation don't change */
function toggleMode() {
	game.mode = game.mode == 'analysis' ? 'combat' : 'analysis';
	say(game.mode == 'analysis' ? 'Analysis mode: ; mining lasers only · K scan the target · B pulse scanner · T next non-ship target · U nearest point of interest' : 'Combat mode: ; weapons · K missile · B flare · T next target · U nearest hostile', game.mode == 'analysis' ? '#6cc9e8' : '#f2a33a');
	Snd.cue(game.mode == 'analysis' ? 'faOn' : 'faOff');
}
function toggleMouse() { game.mouseFly = !game.mouseFly; say('Mouse flight ' + (game.mouseFly ? 'on: point away from the centre to pitch and roll' : 'off')) }
/* the radial menu: hold ~, point at a function (or step round with ← → or A D), let go. Steering waits meanwhile */
const RADIAL = [['gear', 'Landing gear', () => toggleGear()], ['hatch', 'Cargo hatch', () => toggleHatch()], ['lights', 'Spotlights', () => toggleLights()], ['nightVision', 'Night vision', () => toggleNightVision()],
	['systems', 'Internal systems', () => { game.systems = !game.systems }], ['flare', 'Flare', () => { const pc = game.pcs; if (pc.load.flares > 0) { const k = C.flare(pc, game.shots); say('Flare' + (k ? ': ' + k + ' decoyed' : '') + ' · ' + pc.load.flares + ' left'); Snd.cue('flare') } else say('No flares left', '#f2a33a') }],
	['mouse', 'Mouse flight', () => toggleMouse()], ['fa', 'Flight assist', () => toggleFA()]];
function radialStep() {
	const R0 = game.radial;
	if (RG.down('radial')) {
		if (!R0) { game.radial = {sel: -1, at: game.t}; Snd.cue('tick') }
		const g = game.radial;
		/* pointing: the item in the pointer's direction from the centre */
		if (game.ptr && !game.ptr.touch) { const dx = game.ptr.x - W / 2, dy = game.ptr.y - Hh / 2; if (Math.hypot(dx, dy) > 40) g.sel = Math.round((Math.atan2(dx, -dy) / (2 * Math.PI)) * RADIAL.length + RADIAL.length) % RADIAL.length }
		/* or stepping round with ← → (or A D): the keyboard alone */
		if (RG.pressed('rollLeft') || RG.pressed('yawLeft')) g.sel = (Math.max(0, g.sel) - 1 + RADIAL.length) % RADIAL.length;
		if (RG.pressed('rollRight') || RG.pressed('yawRight')) g.sel = (g.sel + 1) % RADIAL.length;
		return true;
	}
	if (R0) { game.radial = null; if (R0.sel >= 0 && !R0.done) RADIAL[R0.sel][2](); return false }
	return false;
}
/* Analysis K: scan the target now. Ships with a warrant or manifest scanner (within 3 km); asteroids with a prospector
   (within its range); a world's survey goes on by itself near it */
function scanNow() {
	const Tg = curTarget();
	if (!Tg) { say('No target to scan (T)', '#f2a33a'); Snd.cue('refused'); return }
	if (!M.works(fit, 'sensors')) { say('Sensors down: no scans', '#e5484d'); Snd.cue('refused'); return }
	if (Tg.kind == 'ship') {
		if (!ship.utility.warrant && !ship.utility.manifest) { say('No warrant or manifest scanner fitted', '#f2a33a'); Snd.cue('refused'); return }
		const d = len(sub(Tg.s.p, s.p)); if (d > 3000) { say('Scan: within 3 km (' + H.fmtDist(d) + ' now)', '#f2a33a'); Snd.cue('refused'); return }
		scanned(Tg); say('Scanned ' + Tg.name + (Tg.wanted ? ': WANTED, ' + Tg.wanted.amount.toLocaleString('en') + ' ' + Tg.wanted.code : ': clean'), '#6cc9e8'); Snd.cue('chart'); return;
	}
	if (Tg.kind == 'asteroid') {
		if (!ship.utility.prospector) { say('No prospector fitted', '#f2a33a'); Snd.cue('refused'); return }
		const d = len(sub(Tg.pos, s.p)); if (d > Mi.MINE.scanRange) { say('Prospect: within ' + H.fmtDist(Mi.MINE.scanRange), '#f2a33a'); Snd.cue('refused'); return }
		Tg.prospected = true; say('Prospected ' + Tg.name + ': ' + comp(Tg), '#c9a46a'); Snd.cue('chart'); return;
	}
	if (Tg.kind == 'planet') { say(X.surveyed(game.P, game.star.id, Tg.name) ? Tg.name + ': already surveyed' : 'A survey runs by itself within ' + H.fmtDist(Tg.radius * X.EXPLORE.surveyRadii) + ' of ' + Tg.name + ' (with a cartographic sensor)', '#6cc9e8'); return }
	say('Nothing to scan on ' + (Tg.name || 'that'), '#9fb0cc');
}
/* Analysis B: the pulse scanner. The scanner reaches 25 km for 10 s, and says what's out there (every 15 s at most) */
const PULSE = {range: 25000, time: 10, every: 15};
function pulse() {
	if (!M.works(fit, 'sensors')) { say('Sensors down: no pulse', '#e5484d'); Snd.cue('refused'); return }
	if (game.t < (game.pulseAt || -1e9) + PULSE.every) { say('Pulse scanner recharging: ' + Math.ceil(game.pulseAt + PULSE.every - game.t) + ' s', '#9fb0cc'); return }
	game.pulseAt = game.t; game.pulseUntil = game.t + PULSE.time;
	const within = x => len(sub(x, s.p)) < PULSE.range, ships = game.npcs.filter(n => !n.cs.dead && within(n.s.p)), hostile = ships.filter(isHostile).length;
	const cans = game.cans.filter(c => within(c.p)).length, rocks = game.rocks.filter(r => within(r.pos)).length;
	say('Pulse: ' + ships.length + (ships.length == 1 ? ' ship' : ' ships') + (hostile ? ' (' + hostile + ' hostile)' : '') + ', ' + cans + (cans == 1 ? ' canister' : ' canisters') + (rocks ? ', ' + rocks + ' asteroids' : '') + ' within 25 km', '#6cc9e8'); Snd.cue('chart');
}
/* Analysis U: the nearest point of interest (not a ship): the port, a canister, an asteroid, a mining site, the beacon,
   a world */
function nearestInterest() {
	const L = targets().filter(x => x.kind != 'ship').map(x => ({x, d: len(sub(posOf(x), s.p)) - (x == st ? 0 : radiusOf(x) || 0)})).sort((a, b) => a.d - b.d);
	if (!L.length) { say('Nothing of interest nearby'); Snd.cue('tick'); return }
	game.tgt = L[0].x; say('Target: ' + pname(L[0].x) + ' · ' + H.fmtDist(Math.max(0, L[0].d)), '#6cc9e8'); Snd.cue('tick');
}
/* ---------------- lights ---------------- */
/* forward spotlights: a cone of light ahead of the ship (the night side of a world is otherwise dark); they need power */
const SPOT = {strength: 0.85, angle: 20, range: 300};
function toggleLights() {
	if (!game.lights && !M.works(fit, 'power')) { say('Spotlights: no power', '#e5484d'); Snd.cue('refused'); return }
	game.lights = !game.lights; game.lightsAuto = false; say('Spotlights ' + (game.lights ? 'on' : 'off'), '#9fb0cc'); Snd.cue('hatch');
}
/* night vision, a separate function: the view through the sensors, amplified and shown green; it needs working sensors */
function toggleNightVision() {
	if (!game.nv && !M.works(fit, 'sensors')) { say('Night vision: the sensors are down', '#e5484d'); Snd.cue('refused'); return }
	game.nv = !game.nv; say('Night vision ' + (game.nv ? 'on' : 'off'), '#9fb0cc'); Snd.cue(game.nv ? 'faOn' : 'faOff');
}
function toggleFA() {
	if (game.settings.controls.scheme == 'simple' && s.fa) { say('Flight assist stays on with Simple controls (Settings › Controls › Full to switch it off)', '#9fb0cc'); return } Fl.setAssist(s, !s.fa); game.throttle = s.fa ? Math.min(1, len(s.v) / s.spec.vmax) : 0; say('Flight assist ' + (s.fa ? 'on' : 'off'), s.fa ? '#6cc9e8' : '#f2a33a'); Snd.cue(s.fa ? 'faOn' : 'faOff') }
function nextTarget(noShips) { const L = targets().filter(x => !noShips || x.kind != 'ship'), i = L.indexOf(curTarget()); game.tgt = L[(i + 1) % L.length]; say('Target: ' + game.tgt.name); Snd.cue('tick') }
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
	if (!st && Co.colonyAt(game.P, game.star.id)) { colonyAct(); return }
	if (!st) { say('There is no port in this system', '#f2a33a'); Snd.cue('refused'); return }
	const d = len(sub(s.p, st.c));
	if (d > 10000) { say('Docking clearance is given within 10 km of the port (' + H.fmtDist(d) + ' now)', '#f2a33a'); Snd.cue('refused'); return }
	if (game.clearance) { say('Clearance already granted: pad ' + game.clearance.pad); return }
	const o = owner();
	if (game.port && game.port.maw && En.marshalsWant(game.P, game.day)) { say(st.name + ': Interstellar Marshals. Docking denied: you are wanted. Surrender is the only clearance we give you.', '#e5484d'); Snd.cue('refused'); return }
	if (o && game.P.bounties[o.currency.code] > 0 && game.npcs.some(n => n.role == 'patrol' && !n.cs.dead && n.faction == o.id)) { talk(o.id, st.name + ': docking denied. You are wanted here: ' + Math.round(game.P.bounties[o.currency.code]).toLocaleString('en-US') + ' ' + o.currency.code + '.', '#e5484d'); Snd.cue('refused'); return }
	if (o && o.id != game.home.id && F.relation(game.home.id, o.id) < 0) { talk(o.id, st.name + ': docking denied. ' + o.name.replace(/^The /, '') + ' is at war with you.', '#e5484d'); Snd.cue('refused'); return }
	/* the traffic controller's rule: five minutes to dock, or the clearance is revoked (ask again) */
	game.clearance = {pad: 1 + Math.floor(Math.random() * 24), until: game.t + 300};
	game.tgt = st;
	const D = st.def.dock;
	talk(owner() && owner().id, st.name + ': clearance granted, pad ' + game.clearance.pad + '. Approach along the axis' + (D.spins ? ', and match our spin.' : '.'), '#7fd1a8'); Snd.cue('clearance');
	if (owner() && !O.understands(game.P, ship, owner().id)) say('(Untranslated, but the docking computer has the pad: ' + game.clearance.pad + ')', '#9fb0cc');
}
function toggleCruise() {
	const cz = game.cruise;
	if (cz.on) { const r = Sc.dropOut(s, cz); cz.on = false; game.throttle = Math.min(1, len(s.v) / s.spec.vmax); say(r.emergency ? 'Emergency drop out: the drive took a knock' : 'Dropped out of cruise', r.emergency ? '#f2a33a' : undefined); Snd.cue(r.emergency ? 'emergency' : 'drop'); if (r.emergency) damage(25); return }
	if (cz.charge > 0) { cz.charge = 0; say('Cruise cancelled'); return }
	if (game.landed) { say('Landed: lift off first', '#f2a33a'); Snd.cue('refused'); return }
	if (Sc.massLocked(scene, s.p)) { const w = Sc.worldLock(scene, s.p); say(w ? 'Mass locked by ' + w.name + ': cruise needs ' + H.fmtDist(Sc.lockAlt(w)) + ' of height' : 'Mass locked by ' + st.name + ': cruise needs 20 km clear', '#f2a33a'); Snd.cue('refused'); return }
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
	if (game.jump) { const ph = game.jump.phase; game.jump = null; say(ph ? 'Phase cancelled' : 'Jump cancelled'); return }
	if (game.autoJumpAt != null) { game.autoJumpAt = null; say('Automatic jump stopped: J to jump on when you\'re ready', '#9fb0cc'); return }
	if (game.landed) { say('Landed: lift off first (vertical thrust, or throttle up)', '#f2a33a'); Snd.cue('refused'); return }
	const Tb = curTarget(); if (Tb && Tb.bh) { requestPhase(Tb); return }
	const leg = nextLeg();
	if (!leg) { say('No destination: open the map (G), pick a star, and plot a route (Enter)', '#f2a33a'); Snd.cue('refused'); return }
	const st0 = M.status(fit);
	if (!st0.jump) { say('Hyperspace drive inoperable', '#e5484d'); Snd.cue('refused'); return }
	if (Sc.massLocked(scene, s.p)) { const w = Sc.worldLock(scene, s.p); say(w ? 'Mass locked by ' + w.name + ': jumps need ' + H.fmtDist(Sc.lockAlt(w)) + ' of height' : 'Mass locked by ' + st.name + ': jumps need 20 km clear', '#f2a33a'); Snd.cue('refused'); return }
	if (held()) { say('Held by ' + held().by.name + '\'s tractor beam: no hyperspace until you break 3 km', '#e5484d'); Snd.cue('refused'); return }
	const can = T.canMake(leg, ship.jump, game.fuel * ship.tank);
	if (!can.ok) { say(can.why == 'range' ? leg.star.name + ' is ' + leg.d.toFixed(1) + ' pc away; the ' + ship.name + ' jumps ' + ship.jump + ' pc. Plot a route (Enter on the map).' : 'Not enough fuel: the jump needs ' + Math.round(can.cost * 100) + '% of a tank. Dock to refuel.', '#f2a33a'); Snd.cue('refused'); return }
	shutHatch('the jump');
	game.jump = {leg, charge: JUMP.charge, tunnel: null, cost: can.cost};
	say((leg.kind == 'jump' ? 'Hyperspace: charging for ' : leg.kind == 'long' ? 'Long lane relay: charging for ' : 'Lane beacon: charging for ') + leg.star.name + ' (' + leg.d.toFixed(1) + ' pc)', '#6cc9e8'); Snd.cue('charge');
}
function arrive() {
	const J = game.jump, leg = J.leg, a = leg.kind == 'jump' ? T.arrival(leg.star, Math.random()) : {star: leg.star, misjump: false};
	game.fuel = Math.max(0, game.fuel - J.cost / ship.tank); game.day += leg.kind == 'jump' ? T.TRAVEL.jumpDays : T.TRAVEL.laneDays;
	game.jump = null;
	enterSystem(a.star);
	const p = arrivalPoint(); s.p = p.p; s.q = p.q; s.v = [0, 0, 0]; s.w = [0, 0, 0];
	game.cruise = {on: false, v: 0, charge: 0}; game.throttle = 0;
	settle(); colonyTurn(); populate();
	const o = owner(), who = o ? (game.port && game.port.contested ? 'contested, held by ' : '') + o.name.replace(/^The /, '') : 'unclaimed space';
	if (a.misjump) say('Misjump! The drive locked onto ' + a.star.name + ', near ' + leg.star.name, '#f2a33a');
	say('Arrived: ' + a.star.name + ' · ' + who + (st ? ' · ' + st.def.name + ' at ' + game.port.world : ' · no port'), '#7fd1a8');
	Snd.cue('arrive');
	/* the route: on to the next leg, or plotted again after a misjump */
	if (game.route) {
		if (!a.misjump && game.route.legs[0] && game.route.legs[0].star.id == a.star.id) game.route.legs.shift();
		else if (game.route.toStar) plot(game.route.toStar, true);
		if (game.route && !game.route.legs.length) { say('Route complete'); game.route = null }
		else if (game.route) { say('Next: ' + game.route.legs[0].star.name + ' (' + game.route.legs.length + ' to go)' + (game.settings.controls.autoRoute ? ' · jumping on in 4 s (J to stop)' : ''), '#6cc9e8'); if (game.settings.controls.autoRoute) game.autoJumpAt = game.t + 4 }
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
	map.explore = game.P.explore; map.player = game.P; map.info = null;
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
	game.nvK = Math.max(0, Math.min(1, (game.nvK || 0) + (game.nv ? 1 : -1) * dt * 4));
	/* the route's next jump, by itself (an assist) */
	if (game.autoJumpAt != null && game.t >= game.autoJumpAt) { game.autoJumpAt = null; if (!game.jump && !game.landed && game.route && game.route.legs.length) requestJump() }   /* (night vision fades in and out over a quarter of a second) */
	if (game.clearance && game.t > game.clearance.until) { game.clearance = null; say('Docking clearance revoked: not docked within 5 minutes. Request again (N).', '#f2a33a') }
	M.apply(fit, s);
	s.hatch = hatchOpen();
	/* a jump: charging (flying on), then the tunnel (the ship out of normal space) */
	const J = game.jump;
	if (J) {
		if (J.tunnel != null) { J.tunnel -= dt; if (J.tunnel <= 0) { if (J.phase) phaseOut(); else arrive() } return }
		J.charge -= dt;
		if (held() && !J.phase) { game.jump = null; say('Jump interrupted: a Marshal tractor beam holds you out of hyperspace', '#e5484d'); Snd.cue('refused') }
		else if (Sc.massLocked(scene, s.p)) { game.jump = null; say('Jump interrupted: mass locked', '#f2a33a'); Snd.cue('refused') }
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
	if (game.landed) landedStep(input);
	else if (cz.on) {
		const tgt = curTarget();
		const res = Sc.cruiseStep(scene, s, cz, input, dt, tgt);
		if (res == 'drop' || res == 'lock') { const d = Sc.dropOut(s, cz, res == 'lock'); cz.on = false; game.throttle = Math.min(1, len(s.v) / s.spec.vmax); say('Dropped out near ' + Sc.nearest(scene, s.p).what.name + (d.emergency ? ' (emergency)' : '')); Snd.cue(d.emergency ? 'emergency' : 'drop'); if (d.emergency) damage(25) }
		game.gFelt = null; s.grav = null; game.well = null;
	} else {
		s.grav = Sc.gravityAt(scene, s.p); game.well = Sc.gravityWell(scene, s.p);
		r = Fl.step(s, input, dt, frameNear());
		/* a tractor beam: dragged to a quarter of top speed */
		if (held()) { const v = len(s.v), cap = s.spec.vmax * En.MARSHALS.slow; if (v > cap) s.v = mul(s.v, cap / v) }
		/* the ground: the gear by itself, and first contact */
		if (game.well) { surfaceGear(); autoLights(); landAssist(); if (touch()) return } else autoLights();
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
	/* proximity safety: held off stars, black holes and worlds with air; stopped at an airless world's surface */
	safety();
	/* collisions */
	const hit = Sc.collide(scene, s, game.t);
	if (hit) {
		if (hit.kind == 'planet' || hit.kind == 'star') { safety(); return }
		const dmg = Sc.resolve(s, hit);
		if (dmg > 0) { say('Collision with ' + st.name + ' at ' + Math.round(hit.impact) + ' m/s', '#f2a33a'); Snd.cue('collide', hit.impact); damage(dmg) }
	}
	game.lastStep = r;
	cargo(dt, cz.on);
	if (!cz.on) mine(dt);
	explore(dt, cz.on);
	groundScan(dt, cz.on);
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
const shortName = id => { if (id == 'riftborn') return 'Riftborn'; if (id == 'marshals') return 'Marshal'; const f = F.byId(id); return f ? f.name.replace(/^The /, '') : 'Independent' };
function npcMesh(n) { const k = 'npc:' + n.ship.length; if (!game.npcMeshes.has(k)) { game.npcMeshes.add(k); R.upload(k, Me.ship(n.ship.length, quality)) } }
/* the system's cast, placed: around the port, or ahead of where you are */
function populate() {
	game.npcs = []; game.shots = []; game.booms = [];
	if (!s) return;
	place(En.cast(game.star, Math.floor(game.day), game.P, {port: game.port, visit: game.visits++}));
	/* the Interstellar Marshals: in the main galaxy they find a wanted pilot more often than not, some seconds on */
	if (!game.star.rift && En.marshalsWant(game.P, game.day) && Math.random() < En.MARSHALS.odds) game.marshalsAt = game.t + En.MARSHALS.delay[0] + Math.random() * (En.MARSHALS.delay[1] - En.MARSHALS.delay[0]);
	/* a colony here: construction draws raiders; a rented carrier waits at the site */
	const c = Co.colonyAt(game.P, game.star.id);
	if (c) {
		const building = c.stage == 'building' || (c.builds || []).some(b => !b.done), guarded = (c.builds || []).some(b => b.done && b.fac == 'military') || Co.PORTS[c.port].base;
		if (building && !guarded && Math.random() < (!/^R:/.test(c.id) && F.claimAt(c.star.at).owner ? 0.25 : 0.5)) {
			const gangs = F.minors().filter(m => m.type == 'criminal'), gang = gangs[Math.floor(Math.random() * gangs.length)], hulls = S.ships().filter(x => x.who.includes('pirate') && ['XS', 'S', 'M'].includes(x.size));
			place([0, 1].map(i => ({role: 'pirate', faction: gang.id, ship: hulls[Math.floor(Math.random() * hulls.length)], where: 'arrival', range: 5000 + i * 600, ai: 'attack', wing: 'raid'})));
			say('Raiders are circling your construction at ' + c.star.name, '#e5484d');
		}
		const r = Co.rented(c, game.day);
		if (r && building) place([{role: 'flagship', faction: r.id, ship: S.ships().find(x => x.id == 'bastion'), name: r.name, where: 'arrival', range: 30000, ai: 'hold'}]);
	}
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
		n.cs = C.state(n.ship.marshal ? n.ship : O.derive(n.ship)); n.cs.id = n.id;   /* (Marshal ships are fitted as they come: their own guns, hull and shields) */
		/* who's wanted, and what's aboard (warrant and manifest scanners read these) */
		n.cargo = n.cargo || Ca.wreck(n.role, n.ship);
		if (n.wanted == null) n.wanted = n.role == 'pirate' ? wantedFor(n, 1) : ['trader', 'navy'].includes(n.role) && Math.random() < 0.08 ? wantedFor(n, 0.3) : null;
		n.scanned = null; n.scanT = 0;
		n.ai = {mode: n.ai, base: n.ai, fleeAt: n.role == 'pirate' ? 0.3 : n.role == 'trader' ? 2 : n.role == 'flagship' || n.role == 'riftborn' || n.role == 'sentinel' ? 0 : 0.15};
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
/* the Marshals' anchorage (the Rift's side of the Maw): nobody fires within its zone but the Marshals */
const inZone = p => !!(game.port && game.port.maw && st && len(sub(p, st.c)) < En.MARSHALS.zone);
/* held by a Marshal's tractor beam (speed cut, hyperspace blocked) */
const held = () => game.held && game.t < game.held.until ? game.held : null;
function marshalsArrive() {
	game.marshalsAt = null;
	const w = En.marshalWing(); place(w);
	const want = En.marshalsWant(game.P, game.day);
	say('The Interstellar Marshals: ' + w.length + ' ships dropping in, ' + H.fmtDist(Math.min(...w.map(n => n.range))) + ' off. ' + (want && want.bounty >= En.MARSHALS.bounty ? 'Your bounties come to ' + want.bounty.toLocaleString('en-US') + ' SU.' : 'You have destroyed ' + (want ? want.kills : 0) + ' police ships in ' + En.MARSHALS.window + ' days.') + ' Their disruptors cut out shield generators and their tractor beams hold ships out of hyperspace: jump now if you can.', '#e5484d');
	Snd.cue('critical');
}
function combat(dt) {
	const P = game.P, pc = game.pcs;
	if (game.marshalsAt != null && game.t >= game.marshalsAt) marshalsArrive();
	/* every ship's acceleration, for others' aim (combat.js track); the gimbal's reach from the field of view */
	C.track(s, dt); for (const n of game.npcs) if (!n.cs.dead) C.track(n.s, dt);
	pc.gimbalDeg = C.gimbalFor(fovNow());
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
			if (best == ME && !n.provokedByPlayer) { if (!n.wasHostile) hail(n); n.wasHostile = true }
		}
		const f = n.foe, tgt = f == ME ? {p: s.p, v: s.v, a: s.acc, heat: pc.heat, id: 'me'} : f && !f.cs.dead ? {p: f.s.p, v: f.s.v, a: f.s.acc, heat: f.cs.heat, id: f.id} : null;
		const c = C.think(n, tgt, n.home, game.t);
		/* below a world's line: its gravity, its turning frame (as the player's), and 450 m kept off the ground */
		n.s.grav = Sc.gravityAt(scene, n.s.p);
		const nw = n.s.grav ? Sc.gravityWell(scene, n.s.p) : null, solid = nw && !nw.body.atmo && !(nw.body.src && nw.body.src.gas);
		const gk = solid ? (gr => C.groundKeep(n.s, gr.up, gr.alt, c))(Sc.groundAt(scene, nw.body, n.s.p, game.t)) : {strafe: [0, 0], throttle: c.throttle};
		Fl.step(n.s, {pitch: gk.pitch != null ? gk.pitch : c.pitch, yaw: gk.yaw != null ? gk.yaw : c.yaw, roll: c.roll, throttle: gk.throttle, strafe: gk.strafe, thrust: 0}, dt, nw ? Sc.worldFrame(nw.body) : null);
		holdOff(n.s);   /* (the same safety keeps them off the ground) */
		n.pos = n.s.p;
		if (tgt) {
			const d = len(sub(tgt.p, n.s.p));
			/* a Marshal's tractor beam on a wanted pilot */
			if (n.role == 'marshal' && f == ME && d < En.MARSHALS.tractor) { if (!held()) { say(n.name + ': tractor beam on you. Speed cut, hyperspace blocked: get clear of 3 km, or fight', '#e5484d'); Snd.cue('lock') } game.held = {by: n, until: game.t + 0.5} }
			/* the no-fire zone: only the Marshals fire inside it */
			if (n.role != 'marshal' && (inZone(n.s.p) || inZone(tgt.p))) continue;
			if (c.fire && d < (n.cs.load.turrets ? 4000 : 3500)) { const k = C.fire(n.cs, n.s, game.t, tgt, game.shots); if (k && d < 3000) Snd.cue(gunCue(n.cs)) }
			/* their mass drivers: charged while they'd fire, let go at full charge */
			if (C.railStep(n.cs, n.s, game.t, tgt, game.shots, c.fire && d < 4000 && !C.railReady(n.cs), dt) && d < 3000) Snd.cue('driver');
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
	const zoned = inZone(s.p), can = pilot.conscious && !game.jump && !zoned, trigger = RG.down('fire') || game.mouseFire || game.touch.fire != null;
	/* the mass drivers: held, they charge; let go, they fire (combat mode only; out of it, the charge is lost) */
	if (!can || game.mode == 'analysis') { for (const g of pc.load.guns) g.charge = 0 }
	else if (C.railStep(pc, s, game.t, foe, game.shots, trigger, dt)) Snd.cue('driver');
	if (zoned && (RG.down('fire') || game.mouseFire || game.touch.fire != null || RG.pressed('missile')) && (!game.zoneSaid || game.t - game.zoneSaid > 4)) { game.zoneSaid = game.t; say('No-fire zone: the Interstellar Marshals\' anchorage. Your weapons are locked within ' + H.fmtDist(En.MARSHALS.zone) + ' of it.', '#f2a33a'); Snd.cue('refused') }
	if (can && (RG.down('fire') || game.mouseFire || game.touch.fire != null)) {
		if (!pc.load.guns.length) { if (!game.saidUnarmed) { game.saidUnarmed = true; say('The ' + ship.name + ' carries no weapons', '#f2a33a') } }
		else if (game.mode == 'analysis' && !pc.load.guns.some(g => g.kind == 'mining')) { if (!game.saidSafe2 || game.t - game.saidSafe2 > 4) { game.saidSafe2 = game.t; say('Analysis mode: weapons safe. No mining laser to fire (M for Combat mode)', '#9fb0cc') } }
		else { const k = C.fire(pc, s, game.t, foe, game.shots, game.mode == 'analysis' ? ['mining'] : null); if (k) Snd.cue(gunCue(pc)) }
	} else game.saidUnarmed = false;
	if (game.mode == 'analysis' && (RG.pressed('missile') || game.touch.msl)) { game.touch.msl = false; scanNow() }
	else if (can && (RG.pressed('missile') || game.touch.msl)) {
		game.touch.msl = false;
		const torp = pc.load.guns.some(g => g.kind == 'torpedo' && g.ammo > 0);
		if (!pc.load.missiles && !torp) { say('No missiles left: restock at a port', '#f2a33a'); Snd.cue('refused') }
		else if (!foe) { say('Target a ship first (T, or U for the nearest hostile)', '#f2a33a'); Snd.cue('refused') }
		else if (!game.locked) { say('No lock yet: hold ' + tg.name + ' in your sights for 2 s', '#f2a33a'); Snd.cue('refused') }
		else if (C.launch(pc, s, foe, game.shots)) { say('Missile away · ' + pc.load.missiles + ' left'); Snd.cue('missile'); if (!En.hostile(P, tg)) provoke(tg) }
	}
	if (game.mode == 'analysis' && (RG.pressed('flare') || game.touch.flare)) { game.touch.flare = false; pulse() }
	else if (RG.pressed('flare') || game.touch.flare) { game.touch.flare = false; if (pc.load.flares > 0) { const k = C.flare(pc, game.shots); say('Flare' + (k ? ': ' + k + (k == 1 ? ' missile' : ' missiles') + ' decoyed' : '') + ' · ' + pc.load.flares + ' left'); Snd.cue('flare') } else say('No flares left', '#f2a33a') }
	/* bolts against asteroids: mining lasers chip ore; anything else just stops */
	if (game.rocks.length) for (let i = game.shots.length - 1; i >= 0; i--) {
		const m = game.shots[i], rk = Mi.hitRock(game.rocks, m.p, m.ray ? add(m.p, mul(m.dir, m.range)) : add(m.p, mul(m.v, dt))); if (!rk) continue;
		if (m.ray) { const at = Math.max(0, dot(sub(rk.pos, m.p), m.dir) - rk.radius); game.beams.push({a: m.p, b: add(m.p, mul(m.dir, at)), kind: m.kind, t: game.t}); m.p = add(m.p, mul(m.dir, at)) }
		game.shots.splice(i, 1); game.booms.push({pos: m.p.slice(), t: game.t, r: 3, col: [0.7, 0.65, 0.55], life: 0.3});
		if (m.kind == 'mining') { const ch = Mi.chip(rk, m.owner == 'me' ? s.p : m.p, Math.random, game.P.mined = game.P.mined || {}); if (ch) { const c = Ca.make(ch.good, ch.p, ch.v, game.t); c.ore = ch.t; c.name = ch.good + ' ore'; game.cans.push(c); if (m.owner == 'me') say('Ore: ' + ch.t + ' t ' + ch.good + (rk.left <= 0 ? ' · the asteroid is spent' : ''), '#c9a46a') } }
	}
	/* everything in flight */
	const ships = [{id: 'me', s, cs: pc}, ...game.npcs.filter(n => !n.cs.dead).map(n => ({id: n.id, s: n.s, cs: n.cs, n}))];
	const beams = []; const hits = C.stepProjectiles(game.shots, ships, dt, beams); for (const b of beams) { b.t = game.t; game.beams.push(b) }
	game.beams = game.beams.filter(b => game.t - b.t < (C.WEAPONS[b.kind].beam || 0.05));
	for (const h of hits) {
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
if (DEBUG) window.EmberDebug = {touchLayout: () => touchLayout(), toClient: (x, y) => { const a = view.toGame(0, 0), b = view.toGame(1000, 1000); return {x: (x - a.x) / (b.x - a.x) * 1000, y: (y - a.y) / (b.y - a.y) * 1000} }, get renderer() { return {software: R.software, antialias: R.antialias, renderer: R.renderer} }, meshIds: () => R.ids(), lose: how => lost(how || 'a test'), BUILD, game, pirates: debugPirates, get s() { return s }, get ship() { return ship }, get fit() { return fit }, settle,
	/* jump straight to a star (no fuel or time), and dock at once where there's a port */
	go: star => { enterSystem(star); const p = arrivalPoint(); s.p = p.p; s.q = p.q; s.v = [0, 0, 0]; s.w = [0, 0, 0]; populate() }, dock: () => { if (st) docked() }, near: (b, k) => { s.p = add(b.pos, mul(norm(sub(s.p, b.pos)), b.radius * k)); s.v = [0, 0, 0]; game.tgt = b; game.cruise = {on: false, v: 0, charge: 0} },
	refit: () => { ship = O.derive(baseShip, game.P.ship.fit); fit = M.fit(ship); arm() },
	get scene() { return scene }};
function provoke(n) {
	En.provoke(n, game.npcs);
	say('You fired on ' + n.name + (n.role == 'trader' ? ': a crime. The patrol will come.' : '. They are returning fire.'), '#f2a33a');
}
/* a hit on you: shields, then the hull and its modules */
/* the sound of the guns that just fired */
const gunCue = cs => cs.load.guns.some(g => g.kind == 'heavy' || g.kind == 'lance' || g.kind == 'gatlingL') ? 'heavy' : cs.load.guns.some(g => /^gatling/.test(g.kind)) ? 'gatling' : 'pulse';
/* the mass drivers' charge, 0-1 (and over 1 held past full), for the HUD */
const railCharge = cs => { const g = cs.load.guns.find(x => C.WEAPONS[x.kind].charge && x.charge > 0); return g ? g.charge / C.WEAPONS[g.kind].charge : 0 };
function hitMe(pr) {
	const out = C.damage(game.pcs, pr.dmg, pr.kind, game.t);
	game.hitAt = game.t;
	Snd.cue(out.hull > 0 ? 'hullHit' : 'shieldHit');
	for (const a of out.alerts) moduleAlert(a);
	if (game.pcs.dead) { const src = game.npcs.find(o => o.id == pr.owner); lost('destroyed by ' + (src ? src.name : 'gunfire')) }
}
function destroyed(n, byMe) {
	game.booms.push({pos: n.s.p.slice(), t: game.t, r: n.s.radius * 4, col: [1, 0.72, 0.4], life: 1.8});
	for (const g of n.cargo || []) game.cans.push(Ca.make(g, n.s.p, n.s.v, game.t));
	Snd.cue('boom', Math.max(0.15, Math.min(1, 3000 / (len(sub(n.s.p, s.p)) + 1))));
	if (byMe) {
		const was = !!En.marshalsWant(game.P, game.day);
		const res = En.killed(game.P, n, {star: game.star, day: game.day, own: game.own});
		if (!was && En.marshalsWant(game.P, game.day) && !game.star.rift && game.marshalsAt == null && !game.npcs.some(x => x.role == 'marshal' && !x.cs.dead)) {
			game.marshalsAt = game.t + 30 + Math.random() * 30;
			say('The Interstellar Marshals have your name now. They are on their way.', '#e5484d');
		}
		say(n.name + ' destroyed', '#7fd1a8');
		for (const m of res.msg) say(m, /Crime/.test(m) ? '#e5484d' : '#7fd1a8');
		settle();
	} else say(n.name + ' destroyed', '#9fb0cc');
	if (game.tgt == n) game.tgt = null;
}
/* canisters: drifting, scooped through the open hatch, spilt through a jammed one */
function cargo(dt, cruising) {
	Ca.step(game.cans, game.t, dt, p => Sc.gravityAt(scene, p), restOnGround);
	if (!hasHatch()) return;
	const B = R.basis(s.q), down = mul(B.u, -1), back = mul(B.f, -1);
	if (!M.works(fit, 'hatch')) {
		const out = Ca.spill(game.P, s, back, game.t, dt, game.spill);
		if (out.length) { if (!cruising) game.cans.push(...out); if (!game.saidSpill || game.t - game.saidSpill > 30) { game.saidSpill = game.t; say('Cargo spilling through the jammed hatch: ' + out[0].good, '#f2a33a') } }
		return;
	}
	if (!game.hatch || cruising) return;
	if (ship.tractor && M.works(fit, 'weapons')) Mi.tractor(game.cans, s, Ca.hatchAt(s, down, back), ship.tractor, dt);
	const r = Ca.scoop(game.cans, s, down, back, game.P, ship.cargo, {refine: (g, t) => Mi.refine(game.P, g, t, ship.refinery, ship.cargo)});
	for (const o of r.ore) { say('Refinery: ' + o.t + ' t ' + o.good + ' ore · bin ' + ((game.P.refinery || {})[o.good] || 0).toFixed(2) + ' t', '#c9a46a'); Snd.cue('scoop'); for (const g of o.made) say('Refined: 1 t ' + g + ' to the hold', '#7fd1a8') }
	if ((r.noRefinery || r.binsFull) && (!game.saidOre || game.t - game.saidOre > 4)) { game.saidOre = game.t; say(r.noRefinery ? 'No refinery: ore can\'t be taken aboard' : 'Refinery bins full: empty one at a port (Status)', '#f2a33a') }
	for (const g of r.got) { say('Scooped 1 t ' + g + ' · hold ' + Tr.held(game.P) + '/' + ship.cargo + ' t', '#7fd1a8'); Snd.cue('scoop') }
	if ((r.full || r.fast) && (!game.saidScoop || game.t - game.saidScoop > 3)) { game.saidScoop = game.t; say(r.full ? 'Hold full: nothing more fits' : 'Too fast to scoop: under 20 m/s relative to the canister', '#f2a33a') }
}
/* ---------------- colonies ---------------- */
/* the claim here: the beacon site (a world), or the constructor once the beacon is down */
function site() {
	const c = game.P && Co.colonyAt(game.P, game.star.id);
	game.site = null;
	if (!c || (c.stage != 'claimed' && c.stage != 'building')) return;
	const w = scene.bodies.find(b => b.kind == 'planet' && b.name == c.world); if (!w) return;
	const out = norm(add(mul(norm(w.pos), -1), [0.2, 0.3, 0.1]));
	game.site = {kind: 'site', colony: c, world: w, name: c.stage == 'building' ? 'Constructor · ' + c.star.name : 'Beacon site · ' + pname(w), pos: c.stage == 'building' ? add(w.pos, mul(out, w.radius * 3)) : w.pos, radius: c.stage == 'building' ? 300 : w.radius};
}
/* N in a claimed system: drop the beacon near the world, or hand over goods at the constructor */
function colonyAct() {
	const c = Co.colonyAt(game.P, game.star.id), w = game.site && game.site.world;
	if (!c || !w) { say('Nothing to build here', '#f2a33a'); return }
	if (c.stage == 'claimed') {
		const d = len(sub(s.p, w.pos)), need = w.radius * Co.COL.beaconRadii;
		if (d > need) { game.tgt = game.site; say('Drop the beacon within ' + H.fmtDist(need) + ' of ' + pname(w) + ' (' + H.fmtDist(d) + ' now)', '#f2a33a'); Snd.cue('refused'); return }
		const r = Co.beacon(game.P, c, game.day); if (!r.ok) { say(r.why, '#f2a33a'); return }
		site(); game.tgt = game.site;
		say('Beacon down: you are ' + c.star.name + '\'s architect. A constructor is on station. Bring the goods by day ' + c.due + '.', '#7fd1a8'); Snd.cue('docked'); persist(); return;
	}
	if (c.stage == 'building') {
		const d = len(sub(s.p, game.site.pos)) - game.site.radius;
		if (d > Co.COL.deliverRange || len(s.v) > 60) { game.tgt = game.site; say('Deliver within ' + H.fmtDist(Co.COL.deliverRange) + ' of the constructor, under 60 m/s (' + H.fmtDist(Math.max(0, d)) + ' now)', '#f2a33a'); Snd.cue('refused'); return }
		const r = Co.deliver(game.P, c, game.day), list = Object.entries(r.gave);
		if (!list.length) { say('Nothing in your hold the build needs: ' + Object.keys(Co.left(c)).join(', '), '#f2a33a'); Snd.cue('refused'); return }
		say('Delivered ' + list.map(([g, t]) => t + ' t ' + g).join(', ') + ' · ' + Math.round(Co.progress(c) * 100) + '% built', '#7fd1a8'); Snd.cue('scoop');
		if (c.stage == 'done') { say(c.star.name + ': the ' + Co.PORTS[c.port].name.toLowerCase() + ' is built. It opens tomorrow (after your next jump).', '#7fd1a8'); Snd.cue('docked'); game.site = null }
		persist();
	}
}
/* the day's turn for colonies: haulers, finished builds, lapses */
function colonyTurn() { for (const n of Co.turn(game.P, game.day)) { say(n.text, n.ok ? '#7fd1a8' : '#e5484d'); Snd.cue(n.ok ? 'clearance' : 'warning') } site() }
/* ---------------- outfitting in flight: arrival, languages, scanners ---------------- */
/* a populated system's nav beacon, near its main planet on the sunward side */
function beaconAt() {
	game.beacon = null;
	if (!game.port || !scene) return;
	const w = scene.bodies.find(b => b.kind == 'planet' && b.name == game.port.world) || scene.bodies.find(b => b.kind == 'planet'); if (!w) return;
	const sun = scene.bodies[0], d = norm(sub(sun.pos, w.pos));
	game.beacon = {kind: 'beacon', name: 'Nav beacon · ' + w.name, pos: add(w.pos, mul(d, w.radius * 8)), radius: 30, world: w, dir: d};
}
const navWorks = () => ship.utility.nav && M.works(fit, 'sensors') && M.works(fit, 'power');
/* where a ship comes out of hyperspace: the nav beacon, if it can find one; otherwise near the star, a safe way off */
function arrivalPoint() {
	if (game.beacon && navWorks()) {
		const b = game.beacon, p = add(b.pos, mul(b.dir, 3000)), f = norm(sub(b.world.pos, p));
		if (game.P && X.chartSystem(game.P, game.star, game.day)) say('System data from the nav beacon: ' + G.system(game.star).planets.length + ' planets charted', '#6cc9e8');
		game.sweep = 0;
		return {p, q: Sc.lookRotation(f, Math.abs(f[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])};
	}
	if (game.port && !ship.utility.nav) say('No nav beacon receiver: out near the star', '#9fb0cc');
	else if (game.port) say('Nav beacon not found (sensors down): out near the star', '#f2a33a');
	return Sc.arrival(scene);
}
/* comms from a faction: plain if you understand them, garbled if not */
function talk(fid, text, col) {
	if (!fid || O.understands(game.P, ship, fid)) { say(text, col); return }
	say(O.garble(text, fid) + ' [' + O.langName(O.langOf(fid)) + ', untranslated]', '#9fb0cc');
}
/* a ship hails you as it attacks */
const HAILS = {marshal: ['Interstellar Marshals. Your record precedes you: cut your drive and stand by.', 'Marshals. There is nowhere in this galaxy you can run from us.', 'Wanted pilot: by the Marshals\' warrant, stand down.'], pirate: ['Cut your engines and dump your cargo.', 'Nice ship. It\'s ours now.', 'Nobody\'s coming for you out here.'], patrol: ['You are wanted. Power down and submit.', 'Wanted vessel: you are ordered to stand down.'], navy: ['Enemy contact. Engaging.', 'You picked the wrong side, pilot.'], sentinel: []};
function hail(n) {
	const L = HAILS[n.role]; if (!L || !L.length) return;
	talk(n.role == 'marshal' ? null : n.faction, n.name + ': ' + L[Math.floor(Math.random() * L.length)], '#e5484d');
}
/* bounties on NPCs: pirates always, a few others; in the space's coin */
function wantedFor(n, k) {
	const o = game.own && game.own.owner ? F.byId(game.own.owner) : F.byId(game.P.origin), code = o && o.kind == 'major' ? o.currency.code : F.byId(game.P.origin).currency.code;
	return {code, amount: Math.round(Math.max(200, (n.ship.priceSU ? n.ship.priceSU[0] : 50000) * 0.01 * k) * E.rate(code, game.day))};
}
function scanned(n) {
	n.scanned = {warrant: !!ship.utility.warrant, manifest: !!ship.utility.manifest};
	if (n.scanned.warrant) say('Warrant scan, ' + n.name + ': ' + (n.wanted ? 'WANTED, ' + n.wanted.amount.toLocaleString('en') + ' ' + n.wanted.code : 'clean'), n.wanted ? '#f2d36a' : '#9fb0cc');
	if (n.scanned.manifest) { const by = {}; for (const g of n.cargo || []) by[g] = (by[g] || 0) + 1; say('Manifest, ' + n.name + ': ' + (Object.keys(by).length ? Object.entries(by).map(([g, t]) => t + ' t ' + g).join(', ') : 'empty hold'), '#9fb0cc') }
	Snd.cue('chart');
}
/* ---------------- proximity safety, and wormholes ---------------- */
/* a ship or a canister below a world's surface comes to rest on it (canisters) or is held off it (NPCs: the safety) */
function holdOff(x) {
	for (const b of scene.bodies) {
		const ground = b.kind == 'planet' && !b.atmo && len(sub(x.p, b.pos)) < b.radius + Te.bound(b) + 400 ? Sc.groundAt(scene, b, x.p, game.t) : null;   /* (over the terrain) */
		const lim = ground ? b.radius + ground.h + Sc.SAFE.ground : Sc.safeDist(b), d = sub(x.p, b.pos), L = len(d); if (L >= lim) continue; const n = mul(d, 1 / (L || 1)), vn = dot(x.v, n); x.p = add(b.pos, mul(n, lim)); if (vn < 0) x.v = sub(x.v, mul(n, vn))
	}
}
function restOnGround(c) {
	for (const b of scene.bodies) { if (b.kind != 'planet') continue; const d = sub(c.p, b.pos), L = len(d), lim = b.radius + 2; if (L >= lim) continue; const n = mul(d, 1 / (L || 1)); c.p = add(b.pos, mul(n, lim)); c.v = [0, 0, 0]; c.pos = c.p }
}
function safety() {
	for (const b of scene.bodies) {
		/* with the gear down over ground that can be landed on, the safety lets go: contact decides (touch) */
		if (game.gear && b.kind == 'planet' && !b.atmo && Ld.landable(b.src).ok) continue;
		/* airless ground: held 300 m over the terrain itself (terrain.js), not the world's radius */
		const ground = b.kind == 'planet' && !b.atmo && len(sub(s.p, b.pos)) < b.radius + Te.bound(b) + 400 ? Sc.groundAt(scene, b, s.p, game.t) : null;
		const lim = ground ? b.radius + ground.h + Sc.SAFE.ground : Sc.safeDist(b), d = sub(s.p, b.pos), L = len(d); if (L >= lim) continue;
		const n = mul(d, 1 / (L || 1)), vn = dot(s.v, n);
		s.p = add(b.pos, mul(n, lim));
		if (vn < 0) s.v = sub(s.v, mul(n, vn));
		if (!game.saidSafe || game.t - game.saidSafe > 6) { game.saidSafe = game.t; say('Proximity safety: holding off ' + pname(b) + (b.bh ? ' (a black hole)' : b.kind == 'star' ? '' : b.atmo ? ': its atmosphere' : !Ld.landable(b.src).ok ? ': ' + Ld.landable(b.src).why.toLowerCase() : ': lower the landing gear (L) to land'), '#f2a33a'); Snd.cue('warning') }
	}
}
const PHASE = {range: 2.5e6, charge: 8};
/* within reach of a black hole's throat: 2,500 km, or (the Maw) a little past the safety's hold */
const phaseRange = b => Math.max(PHASE.range, Sc.bhSafe(b) * 1.25);
/* J near a black hole: phase through its wormhole, if the ship carries a dimensional phaser */
function requestPhase(b) {
	if (!ship.phaser) { say('A black hole\'s wormhole needs an alien dimensional phaser. Their blueprints lie in ruins.', '#f2a33a'); Snd.cue('refused'); return true }
	if (!M.works(fit, 'power')) { say('The phaser needs power', '#e5484d'); Snd.cue('refused'); return true }
	const d = len(sub(s.p, b.pos)); if (d > phaseRange(b)) { say('Phase within ' + H.fmtDist(phaseRange(b)) + ' of ' + b.name + ' (' + H.fmtDist(d) + ' now)', '#f2a33a'); Snd.cue('refused'); return true }
	shutHatch('the phase');
	game.jump = {phase: true, leg: {star: {name: 'somewhere'}, kind: 'phase', d: 0}, charge: PHASE.charge, tunnel: null, cost: 0};
	say(game.star.heart ? (game.star.rift ? 'Dimensional phaser: charging. The Maw leads home.' : 'Dimensional phaser: charging. The Maw leads one way only: into the Rift.') : 'Dimensional phaser: charging. Where the wormhole leads, nobody can say.', '#c9a0ff'); Snd.cue('charge');
	return true;
}
/* out of the wormhole: a random star, anywhere the galaxy has stars (by its own density) */
function phaseOut() {
	const r = Math.random, cross = !!game.star.heart, s0 = G.sampleGalaxy(1, Math.floor(r() * 1e9))[0], sample = game.star.rift ? (([x, y, z]) => ({x, y, z}))(G.toRift([s0.x, s0.y, s0.z])) : s0;   /* (in the Rift, a place in the Rift) */
	/* the Maw: through to its other side (the Rift, or home); any other black hole: a random star, in whichever
	   galaxy you're in */
	let to = null;
	if (cross) to = G.lookup(game.star.rift ? 'heart' : 'R:heart', [0, 0, 0]);
	else for (let R0 = 1; !to && R0 < 200; R0 *= 2) to = G.starsNear(sample.x, sample.y, sample.z, R0).find(x => x.kind == 'star' && x.id != game.star.id);
	game.jump = null; game.day += 1;
	enterSystem(to);
	const p = arrivalPoint(); s.p = p.p; s.q = p.q; s.v = [0, 0, 0]; s.w = [0, 0, 0];
	game.cruise = {on: false, v: 0, charge: 0}; game.throttle = 0; game.route = null;
	settle(); colonyTurn(); populate();
	const home = Math.hypot(to.x - game.home.star.x, to.y - game.home.star.y, to.z - game.home.star.z);
	if (cross && to.rift) {
		const R0 = game.P.rift = game.P.rift || {first: null, crossings: 0}; R0.crossings++;
		if (R0.first == null) { R0.first = Math.floor(game.day); say('The Rift. The galaxy, turned over: every star you know, upside down, and nothing alive on any world. What crews the ships here attacks everything.', '#c9a0ff') }
		say('Through the Maw, into the Rift. The anchorage here at the Maw is a haven: fuel, repairs and trade. Out there, about 1,600 more lie scattered, far apart; nothing else is safe but what you build. The Maw leads home.', '#c9a0ff'); Snd.cue('arrive');
	} else if (cross) { say('Through the Maw: home, at the heart of the galaxy', '#c9a0ff'); Snd.cue('arrive') }
	else say('Through the wormhole: ' + to.name + (to.rift ? ' (the Rift)' : '') + ', ' + Math.round(Math.hypot(to.x, to.y, to.z)) + ' pc from the galaxy\'s centre' + (to.rift ? '' : ', ' + Math.round(home) + ' pc from home'), '#c9a0ff'); if (!cross) Snd.cue('arrive');
	persist();
}
/* ---------------- mining ---------------- */
function mine(dt) {
	/* the site you're at: its asteroids, the same every visit */
	const f = game.fields.find(x => len(sub(x.pos, s.p)) < 25000);
	if (f && game.field != f) { game.field = f; game.rocks = Mi.rocks(f, game.P.mined); for (const r of game.rocks) rockMesh(r); say('Mining site: ' + f.name + ', ' + Mi.KINDS[f.fieldKind].name, '#c9a46a') }
	else if (!f && game.field) { game.field = null; game.rocks = [] }
	if (!game.rocks.length) return;
	/* bumping into rocks */
	for (const r of game.rocks) {
		const d = sub(s.p, r.pos), L = len(d), min = r.radius * 0.9 + s.radius; if (L >= min) continue;
		const n = mul(d, 1 / (L || 1)), vn = dot(s.v, n); s.p = add(r.pos, mul(n, min));
		if (vn < 0) { s.v = sub(s.v, mul(n, vn * 1.6)); if (-vn > 8) { say('Collision with an asteroid at ' + Math.round(-vn) + ' m/s', '#f2a33a'); Snd.cue('collide', -vn); damage(-vn * 0.6) } }
	}
	/* the resource scanner: a targeted asteroid within 3 km, for 3 s */
	const Tg = curTarget();
	if (Tg && Tg.kind == 'asteroid' && !Tg.prospected && ship.utility.prospector && M.works(fit, 'sensors')) {
		if (len(sub(s.p, Tg.pos)) < Mi.MINE.scanRange) { Tg.scanT = (Tg.scanT || 0) + dt; if (Tg.scanT >= Mi.MINE.scanTime) { Tg.prospected = true; say('Prospected ' + Tg.name + ': ' + comp(Tg) + ' · ' + Tg.left + ' t left', '#c9a46a'); Snd.cue('chart') } }
		else Tg.scanT = 0;
	}
}
const comp = r => Object.entries(r.comp).sort((a, b) => b[1] - a[1]).map(([g, k]) => g + ' ' + Math.round(k * 100) + '%').join(', ');
function rockMesh(r) { const k = 'rock:' + r.radius + ':' + r.shape + ':' + game.field.fieldKind; r.mesh = k; if (!game.npcMeshes.has(k)) { game.npcMeshes.add(k); R.upload(k, Me.rock(r.radius, 11 + r.shape * 17 + r.radius, game.field.fieldKind)) } }
/* ---------------- exploration ---------------- */
const pname = b => b.kind == 'planet' ? X.nameOf(game.P, game.star.id, b.name) : b.name;
const TYPE = {EarthLike: 'Earth-like', Gas: 'gas giant'};
function explore(dt, cruising) {
	const P = game.P, sensors = M.works(fit, 'sensors') && M.works(fit, 'power'), carto = sensors && ship.utility.carto;
	/* the sweep: chart the system */
	if (game.sweep > 0 && carto) {
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
	if (Tg && Tg.kind == 'planet' && carto && !cruising) {
		const key = X.keyOf(game.star.id, Tg.name), d = len(sub(s.p, Tg.pos));
		if (game.surveyKey != key) { game.surveyKey = key; game.surveyT = 0 }
		if (!X.surveyed(P, game.star.id, Tg.name) && d < Tg.radius * X.EXPLORE.surveyRadii) {
			game.surveyT += dt;
			if (game.surveyT >= X.EXPLORE.survey) surveyed(Tg);
		} else game.surveyT = Math.max(0, game.surveyT - dt * 0.5);
	}
	/* scanners: a targeted ship within 3 km, for 3 s */
	if (Tg && Tg.kind == 'ship' && sensors && !cruising && (ship.utility.warrant || ship.utility.manifest) && !Tg.scanned) {
		if (len(sub(s.p, Tg.s.p)) < 3000) { Tg.scanT += dt; if (Tg.scanT >= 3) scanned(Tg) } else Tg.scanT = 0;
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
		/* a Precursor ruin (in the Rift): their relics, and more often than not one of their blueprints */
		const pre = !!p.precursor, good = pre ? 'Precursor Relics' : 'Artefacts', k = pre ? 1 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3), up = norm(sub(s.p, b.pos)), f = Fl.forward(s);
		for (let i = 0; i < k; i++) game.cans.push(Ca.make(good, add(add(s.p, mul(f, 400 + i * 40)), mul(up, -60)), add(s.v, mul(up, 3)), game.t));
		const bp = pre ? O.precursorFrom(Math.random) : O.blueprintFrom(Math.random);
		if (bp && O.learn(P, bp)) say('In the ruin\'s records: a blueprint for ' + (pre ? O.bpName(bp) : bp.id == 'alien' ? 'an alien relay booster (size ' + bp.size + ')' : 'an alien dimensional phaser') + '. An artifact broker can build it' + (pre ? ', with goods from both sides of the Maw.' : '.'), '#c9a0ff');
		say('The survey marks a cache: ' + k + ' canisters of ' + good + ' drift up ahead. Open the hatch (I) to scoop them.', '#f2d36a');
	}
	persist();
}
/* the old defences: two to four sentinels between you and the ruin */
function sentinels(b) {
	/* (a Precursor ruin's guardians: Riftborn-strong, and a heavier hull) */
	const pre = !!b.src.precursor, k = 2 + Math.floor(Math.random() * 3), hull0 = S.hull(pre ? 'shrike' : 'wisp'), hull = pre ? En.riftborn(hull0) : hull0, toward = norm(sub(b.pos, s.p));
	place([...Array(k)].map((_, i) => ({role: 'sentinel', faction: 'ancients', ship: hull, rift: pre, name: (pre ? 'Guardian ' : 'Sentinel ') + 'αβγδ'[i], where: 'arrival', range: 3000 + i * 400, ai: 'attack'})));
	for (const n of game.npcs.filter(n => n.role == 'sentinel')) n.home = add(s.p, mul(toward, 3000));
	say((pre ? 'Precursor guardians wake around ' : 'Old defences wake around ') + pname(b) + ': ' + k + (pre ? ' guardians' : ' sentinels'), '#e5484d'); Snd.cue('incoming');
}
/* war missions: pay what's done, fail what's late */
function settle() {
	game.settledAt = game.t;
	for (const r of Ins.tick(game.P, baseShip, game.P.ship.fit, game.day)) { say(r.text, r.ok ? '#9fb0cc' : '#f2a33a'); if (!r.ok) Snd.cue('warning') }
	for (const r of En.settle(game.P, game.day)) { say(r.text, r.ok ? '#7fd1a8' : '#e5484d'); Snd.cue(r.ok ? 'clearance' : 'warning') }
}
/* the ship is lost: a new one at the last port docked at */
function lost(how) {
	say('Ship destroyed: ' + how, '#e5484d'); Snd.cue('destroyed');
	/* the cargo goes down with her. The insurer (insurance.js) says where you wake up, and in what: the ship as it
	   was if the policy's paid up, or a starter at home if not */
	const S0 = game.star, at = S0.rift ? [0, 0, 0] : [S0.x, S0.y, S0.z];
	const c = Ins.claim(game.P, baseShip, game.P.ship.fit, at, {start: game.home.star, startHolder: game.home.id, stars: [game.lastPort, ...(game.P.colonies || []).map(k => k.star && T.starAt(k.star.id, k.star.at))].filter(Boolean)}, game.day);
	G.realm('normal');
	if (c.starter) {
		say(c.why == 'uninsured' ? 'Not insured: you start again at ' + game.home.star.name + ' in a starter ship' : 'Insurance: ' + Math.round(c.short).toLocaleString('en-US') + ' ' + c.code + ' short of what the policy is owed. You start again at ' + game.home.star.name + ' in a starter ship, with the starter\'s cover.', '#e5484d');
		baseShip = S.hull(c.model); game.P.ship.fit = O.stock(baseShip); ship = O.derive(baseShip, game.P.ship.fit); R.upload('ship', Me.ship(ship.length, quality));
	} else {
		for (const x of c.changed) say('The exchange changed ' + Math.round(x.amount).toLocaleString('en-US') + ' ' + x.from + ' into ' + Math.round(x.got).toLocaleString('en-US') + ' ' + c.code + ' for your policy', '#9fb0cc');
		say('Insurance: a new ' + ship.name + ', fitted as before' + (c.paid > 0 ? ', once ' + Math.round(c.paid).toLocaleString('en-US') + ' ' + c.code + ' owed was settled' : '') + '.', '#f2a33a');
	}
	game.P.cargo = {}; game.P.cost = {}; game.P.combat = C.refill(ship, {hull: 1}); game.cans = [];
	fit = M.fit(ship); arm(); game.fuel = 1; game.route = null;
	enterSystem(c.star);
	launch(true);
	say((c.starter ? 'A starter ' : 'A new ') + ship.name + ' waits at ' + (st ? st.name : game.star.name) + (c.why == 'exchange' ? ' (the nearest port whose exchange takes ' + c.code + ')' : c.why == 'currency' ? ' (the nearest port trading in ' + c.code + ')' : ''));
	persist();
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
	const env = {P: game.P, ship, hullShip: baseShip, fit, fuel: () => game.fuel, setFuel: f => { game.fuel = f; persist() }, star: game.star, port: game.port, stationName: st.name, day: game.day,
		onLaunch: () => { persist(); launch(false); hud.focus() },
		onRefit: () => { const old = fit; ship = O.derive(baseShip, game.P.ship.fit); fit = M.fit(ship); for (const m of fit.modules) { const o = old.modules.find(x => x.id == m.id); if (o) m.hp = Math.min(m.max, o.hp / o.max * m.max) } env.ship = ship; arm(); persist() },
		onShip: id => { baseShip = S.hull(id); game.P.ship.fit = O.stock(baseShip); ship = O.derive(baseShip, game.P.ship.fit); fit = M.fit(ship); env.ship = ship; env.hullShip = baseShip; game.fuel = 1; game.P.combat = C.refill(ship, {hull: 1}); arm(); R.upload('ship', Me.ship(ship.length, quality)); openPortAgain(); persist() },
		say: t => say(t), cue: k => Snd.cue(k)};
	Port.open(env);
}
/* after buying a ship, reopen with the new one (same screen) */
function openPortAgain() { const scr = document.querySelector('#port [aria-current="page"]'), k = scr && scr.dataset.screen; openPort(); if (k) { const b = document.querySelector('#port [data-screen="' + k + '"]'); if (b) b.click() } }
/* a new game: choose your origin among the great powers */
function chooseOrigin(oldGalaxy) {
	return new Promise(res => {
		const ov = $('ov'), body = $('ovBody'), btns = $('ovBtns'), majors = F.majors();
		btns.textContent = '';
		const K = G.clusters();
		body.innerHTML = '<p class="build">Ember Reach · ' + BUILD.name + ' ' + BUILD.version + '</p><h1 id="ovT">' + esc(tr('Choose your origin')) + '</h1><p class="small">An alpha: the galaxy, flight, trade, combat, exploration, mining, colonies and the Rift are in; landing on planets, the Core\'s story and multiplayer are still to come. Your save carries over to later builds where it can.</p>' + (oldGalaxy ? '<p class="small"><b>0.2.0 has a new galaxy</b> (4 million stars, twelve great powers): your earlier game\'s stars and powers are no longer there, so it can\'t continue. Your settings are kept.</p>' : '') + '<p>You start at your power\'s capital, with 20,000 SU in its currency and a ship from its yards. Its allies welcome you; its enemies won\'t let you dock.</p>'
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
/* ---------------- terrain (landing L1.3) ----------------
   Within 400 km of an airless world the tiles of its terrain (terrain.js) are built, a few milliseconds a frame,
   nearest first; under 200 km, once the tiles in view are ready, they're drawn in place of the world's sphere. Tiles
   unused for 10 s are let go. On low quality the tiles are half as fine and the budget half as big. */
const TILES = {world: null, res: 0, built: new globalThis.Map(), used: new globalThis.Map(), sweep: 0};   /* (Map here is the star map) */
function terrainItems(b, items, bf, sun) {
	if (R.kind != 'webgl' || b.kind != 'planet' || b.atmo || (b.src && b.src.gas)) return false;
	const camD = sub(game.camP || s.p, b.pos), alt = len(camD) - b.radius;
	if (alt > Te.prebuildOf(b)) return false;
	const low = quality == 'low', res = low ? Te.TER.lowRes : Te.TER.res, budget = (low ? Te.TER.lowBudget : Te.TER.budget) * (game.dynTer || 1);
	if (TILES.world != b.name || TILES.res != res) { for (const k of TILES.built.keys()) R.drop(k); TILES.built.clear(); TILES.used.clear(); TILES.world = b.name; TILES.res = res }
	const id = t => 'ter:' + res + ':' + Te.key(t), camL = [dot(camD, bf.x), dot(camD, bf.y), dot(camD, bf.z)];
	const sel = Te.select(b, camL, {res, budget, built: k => TILES.built.has('ter:' + res + ':' + k)});
	/* build: what's drawn first (the six faces to start with), then the children wanted, nearest first, in about 2 ms */
	const need = sel.draw.filter(t => !TILES.built.has(id(t))).concat(sel.want), t0 = performance.now();
	for (const t of need) {
		if (TILES.built.has(id(t))) continue;
		if (performance.now() - t0 > 2) break;
		const m = Te.build(b, t, res); R.upload(id(t), m.mesh); TILES.built.set(id(t), {centre: m.centre, tris: m.tris});
	}
	/* let go of tiles unused for 10 s (once a second) */
	if (game.t - TILES.sweep > 1) { TILES.sweep = game.t; for (const [k, at] of TILES.used) if (game.t - at > 10) { R.drop(k); TILES.built.delete(k); TILES.used.delete(k) } }
	if (alt > Te.nearOf(b) || !sel.draw.every(t => TILES.built.has(id(t)))) return false;
	const rot = mat3(bf.x, bf.y, bf.z);
	let tris = 0;
	for (const t of sel.draw) {
		const k = id(t), T = TILES.built.get(k), c = T.centre, pos = add(b.pos, add(add(mul(bf.x, c[0]), mul(bf.y, c[1])), mul(bf.z, c[2])));
		items.push({id: k, pos, rot, light: norm(sub(sun.pos, pos)), amb: 0.03}); TILES.used.set(k, game.t); tris += T.tris;
	}
	game.lod.terrain = {world: b.name, tiles: sel.draw.length, tris, built: TILES.built.size, deepest: Math.max(...sel.draw.map(t => t.L))};
	return true;
}
const mat3 = (x, y, z) => [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]];
/* the 3D view's resolution: the screen's, times the Resolution setting, times the automatic resolution's scale */
function sizeCanvas() {
	const v = game.lastView; if (!v) return;
	const gl = $('gl'), d = v.dpr * game.settings.graphics.res / 100 * (game.dynRes || 1);
	gl.width = Math.max(64, Math.round(v.cw * d)); gl.height = Math.max(48, Math.round(v.ch * d));
}
/* automatic resolution: every 2 s, under 28 fps the scale steps down (to half the screen's resolution at most), and
   then, still under, the terrain's triangle budget (to a quarter at most: with antialiasing off, triangles cost as much
   as pixels on a software renderer). Above 52 the terrain comes back first, then the resolution (at most every 4 s,
   so it settles rather than swings) */
const DYN = {low: 28, high: 52, down: 0.85, up: 1.1, floor: 50, terFloor: 0.25, every: 2, upEvery: 4};
function adaptRes() {
	const now = performance.now(), D = game.dyn || (game.dyn = {t0: now, n: 0, upAt: 0});
	D.n++; if (now - D.t0 < DYN.every * 1000) return;
	const fps = D.n / ((now - D.t0) / 1000), set = game.settings.graphics.res; D.t0 = now; D.n = 0;
	if (!game.settings.graphics.autoRes) { game.dynTer = 1; if (game.dynRes != 1) { game.dynRes = 1; sizeCanvas() } return }
	const k = game.dynRes || 1, min = Math.min(1, DYN.floor / set), t = game.dynTer || 1, terrain = !!game.lod.terrain;
	let next = k;
	if (fps < DYN.low && k > min) next = Math.max(min, k * DYN.down);
	else if (fps < DYN.low && terrain && t > DYN.terFloor) game.dynTer = Math.max(DYN.terFloor, t * DYN.down);
	else if (fps > DYN.high && now - D.upAt > DYN.upEvery * 1000 && (t < 1 || k < 1)) { D.upAt = now; if (t < 1) game.dynTer = Math.min(1, t * DYN.up); else next = Math.min(1, k * DYN.up) }
	if (Math.abs(next - k) > 1e-3) { game.dynRes = next; sizeCanvas() }
}
function draw() {
	if (!s) return;
	/* docked, the port's screens cover the view: nothing to draw behind them */
	if (game.docked && Port.isOpen()) return;
	adaptRes();
	const B = R.basis(s.q), cam = game.chase ? {p: add(add(s.p, mul(B.f, -ship.length * 3.2)), mul(B.u, ship.length * 0.9)), q: s.q} : {p: add(s.p, mul(B.f, ship.length * 0.3)), q: s.q};
	const sun = scene.bodies[0], items = [], glows = [], CB = R.basis(cam.q), kpx = Hh / 2 / Math.tan(fovNow() / 2 * Math.PI / 180);
	/* how many pixels across a thing of radius r at p looks */
	/* (a thing behind the camera is out of sight, unless it's so close it reaches round: then in full) */
	const px = (p, r) => { const d = sub(p, cam.p), z = dot(d, CB.f); return z > 0 ? r / z * kpx : len(d) < 3 * r ? Infinity : 0 };
	game.lod = {sprites: 0, meshes: 0, station: '', terrain: null};
	game.camP = cam.p;
	/* the airless world nearest the camera, within reach of its terrain */
	let ground = null, gd = Infinity; for (const b of scene.bodies) { if (b.kind != 'planet' || b.atmo) continue; const a = len(sub(cam.p, b.pos)) - b.radius; if (a < Te.prebuildOf(b) && a < gd) { gd = a; ground = b } }
	for (const b of scene.bodies) {
		const lightDir = norm(sub(sun.pos, b.pos)), bf = Sc.bodyFrame(b, Sc.turnOf(b, game.day, game.t)), rot = mat3(mul(bf.x, b.radius), mul(bf.y, b.radius), mul(bf.z, b.radius));
		const far = px(b.pos, b.radius * (b.ring ? 2.3 : 1)) < LOD.spritePx, atmo = b.atmo ? Me.atmosphere(b.type) : null;
		if (b.bh) {
			/* a black hole: a dark disc in a ring of glowing accretion, far bigger than its horizon */
			/* (the Maw is a hundred thousand times as wide: its glow stays close in, and up close it's drawn as a disc only) */
			const huge = b.radius > 1e8, sh = huge ? 1.5 : 3;
			items.push({id: b.name, pos: b.pos, rot, light: lightDir, amb: 0, disc: {radius: b.radius * sh, col: [0, 0, 0]}, sprite: {radius: b.radius * sh, col: [0, 0, 0]}});
			glows.push({pos: b.pos, radius: b.radius * (huge ? 4 : 60), col: [1, 0.55, 0.25], alpha: 0.85, scale: 4, min: 0.03});
			glows.push({pos: b.pos, radius: b.radius * (huge ? 2.5 : 20), col: [0.75, 0.6, 1], alpha: 0.5 + 0.15 * Math.sin(game.t * 0.7), scale: 3, min: 0.012});
		} else if (b.kind == 'star') {
			const c = Me.starColour(b.T);
			items.push({id: b.name, pos: b.pos, rot, light: lightDir, amb: 1, disc: {radius: b.radius, col: c, glow: true}, sprite: far ? {radius: b.radius, col: c, glow: true} : null});
			glows.push({pos: b.pos, radius: b.radius, col: c, alpha: b.companion ? 0.5 : 0.9, scale: 7, min: b.companion ? 0.015 : 0.05});
		} else {
			const pal = b.pal || (b.pal = avgColour(b));
			/* close to an airless world, its terrain's tiles stand in for the sphere */
			if (b == ground && terrainItems(b, items, bf, sun)) { if (b.ring) items.push({id: b.name + ':rings', pos: b.pos, rot, light: lightDir, amb: 0.45}); game.lod.meshes++; continue }
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
	if (game.site && game.site.kind == 'site' && game.site.colony.stage == 'building') items.push({id: 'constructor', pos: game.site.pos, rot: mat3([1, 0, 0], [0, 1, 0], [0, 0, 1]), light: norm(sub(sun.pos, game.site.pos)), amb: 0.2});
	for (const r of game.rocks) { if (len(sub(r.pos, cam.p)) > 40000) continue; const a = r.radius * 0.001 + game.t * 0.02, co = Math.cos(a), si = Math.sin(a); items.push({id: r.mesh, pos: r.pos, rot: mat3([co, si, 0], [-si, co, 0], [0, 0, 1]), light: norm(sub(sun.pos, r.pos)), amb: 0.12}) }
	for (const c of game.cans) {
		if (len(sub(c.p, cam.p)) > 20000) continue;
		const ax = norm(c.spin), a = c.angle, co = Math.cos(a), si = Math.sin(a), rotAx = v => add(add(mul(v, co), mul(cross(ax, v), si)), mul(ax, dot(ax, v) * (1 - co)));
		items.push({id: c.ore ? 'ore' : 'can', pos: c.p, rot: mat3(rotAx([1, 0, 0]), rotAx([0, 1, 0]), rotAx([0, 0, 1])), light: norm(sub(sun.pos, c.p)), amb: 0.2});
	}
	if (game.beacon) glows.push({pos: game.beacon.pos, radius: 12, col: [0.45, 0.8, 1], alpha: 0.6 + 0.4 * Math.sin(game.t * 3), scale: 6, min: 0.005});
	for (const m of game.shots) { const W = C.WEAPONS[m.kind], big = m.kind == 'missile' || m.kind == 'torpedo'; glows.push({pos: m.p, radius: big ? 6 : 2.5, col: W.col, alpha: 1, scale: 4, min: big ? 0.012 : 0.007}) }
	/* lasers' beams: a line of glows, fading over the beam's moment */
	for (const b of game.beams) { const W = C.WEAPONS[b.kind], d = sub(b.b, b.a), L = len(d), n = Math.max(2, Math.min(28, Math.ceil(L / 60))), al = Math.max(0, 1 - (game.t - b.t) / (W.beam || 0.05)); for (let i = 0; i <= n; i++) glows.push({pos: add(b.a, mul(d, i / n)), radius: b.kind == "heavy" || b.kind == "lance" ? 1.8 : 1.1, col: W.col, alpha: al, scale: 3, min: 0.006}) }
	for (const b of game.booms) { const k = (game.t - b.t) / b.life; glows.push({pos: b.pos, radius: b.r * (0.4 + k), col: b.col, alpha: Math.max(0, 1 - k), scale: 3, min: 0.01}) }
	glows.push({pos: add(cam.p, mul(game.coreDir, 1e18)), radius: 1e16, col: [1, 0.85, 0.6], alpha: 0.22, scale: 1, min: 0.6});
	/* the spotlights shine from the nose along it; night vision fades in and out over a quarter of a second */
	if (game.lights && !M.works(fit, 'power')) game.lights = false;
	if (game.nv && !M.works(fit, 'sensors')) game.nv = false;
	const fw = Fl.forward(s), spot = game.lights && !game.docked ? {pos: add(s.p, mul(fw, ship.length * 0.5)), dir: fw, strength: SPOT.strength, cos: Math.cos(SPOT.angle * Math.PI / 180), range: SPOT.range} : null;
	R.frame({cam, fov: fovNow(), items, glows: game.settings.graphics.glow ? glows : [], spot, nightVision: game.nvK});
	gl.style.filter = game.vision && game.vision.blur > 0.01 && pilot.conscious ? 'blur(' + (game.vision.blur * 5).toFixed(1) + 'px)' : '';
	if (game.mapOpen) { const ctx = view.begin(); map.day = game.day; map.fuel = game.fuel; map.draw(ctx, W, Hh, game.t); return }
	hudDraw(cam);
}
function project(cam, p) {
	const B = R.basis(cam.q), d = sub(p, cam.p), z = dot(d, B.f), fy = 1 / Math.tan(fovNow() / 2 * Math.PI / 180), k = fy * Hh / 2;
	return {x: W / 2 + dot(d, B.r) * k / z, y: Hh / 2 - dot(d, B.u) * k / z, z, dx: dot(d, B.r), dy: -dot(d, B.u), k};
}
function hudDraw(cam) {
	{ const now = performance.now(); if (game.fpsAt) { const f = 1000 / Math.max(1, now - game.fpsAt); game.fps = game.fps == null ? f : game.fps * 0.95 + f * 0.05 } game.fpsAt = now }
	const ctx = view.begin(), Tg = curTarget(), cz = game.cruise;
	const frame = frameNear(), rel = Fl.relative(s, frame), speed = cz.on ? cz.v : len(rel.v);
	/* the target */
	const tp = posOf(Tg), pr = project(cam, tp), dist = len(sub(tp, s.p)) - (Tg == st ? 0 : radiusOf(Tg));
	const on = pr.z > 0 && pr.x > 0 && pr.x < W && pr.y > 0 && pr.y < Hh;
	const isShip = Tg.kind == 'ship', isCan = Tg.kind == 'canister';
	const target = {name: pname(Tg), kind: Tg == st ? st.def.name + ' · ' + st.def.size : isShip ? Tg.ship.size + ' ' + Tg.ship.role + ' · ' + Tg.role : isCan ? 'cargo canister · 1 t' : Tg.kind == 'planet' ? Tg.type + ' world' : 'star, class ' + (Tg.cls || ''), x: pr.x, y: pr.y, on, dist: Math.max(0, dist),
		size: on ? radiusOf(Tg) * pr.k / pr.z : 0, dx: pr.dx, dy: pr.dy, closing: dot(cz.on ? mul(Fl.forward(s), cz.v) : sub(s.v, isShip ? Tg.s.v : isCan ? Tg.v : [0, 0, 0]), norm(sub(tp, s.p)))};
	if (Tg == st) target.dock = dockCues(rel);
	if (Tg.kind == 'asteroid') { const d = len(sub(s.p, Tg.pos)); target.kind = 'asteroid · ' + Tg.radius * 2 + ' m'; target.dock = Tg.prospected ? {line1: comp(Tg), line2: Tg.left > 0 ? Tg.left + ' t left · fire a mining laser within 600 m' : 'Spent', col: '#c9a46a'} : !ship.utility.prospector ? {line1: 'Composition unknown', line2: 'A resource scanner reads it', col: '#9fb0cc'} : {line1: d < Mi.MINE.scanRange ? 'Prospecting… ' + Math.round((Tg.scanT || 0) / Mi.MINE.scanTime * 100) + '%' : 'Prospect within 3 km', col: '#c9a46a'} }
	if (Tg.kind == 'field') { target.kind = 'mining site · ' + Mi.KINDS[Tg.fieldKind].name; target.dock = {line1: 'Cruise here and drop out to mine', line2: (ship.mining ? ship.mining + ' mining laser' + (ship.mining > 1 ? 's' : '') : 'No mining laser') + ' · ' + (ship.refinery ? ship.refinery + ' refinery bins' : 'no refinery'), col: '#c9a46a'} }
	if (Tg.bh) { const d = len(sub(s.p, Tg.pos)), pr = phaseRange(Tg), maw = game.star.heart; target.kind = maw ? 'the Maw · ' + Math.round(game.star.M).toLocaleString('en-US') + ' suns · ' + (game.star.rift ? 'the way home' : 'the way into the Rift') : 'black hole · ' + (game.star.M || 0).toFixed(1) + ' suns · a wormhole'; target.dock = !ship.phaser ? {line1: 'No dimensional phaser: the wormhole is closed to you', line2: 'Blueprints lie in ruins; an artifact broker builds them', col: '#9fb0cc'} : {line1: d < pr ? 'Press J to phase through' : 'Phase within ' + H.fmtDist(pr), line2: maw ? (game.star.rift ? 'Home: the heart of the galaxy' : 'The Rift: the galaxy upside down') : game.star.rift ? 'To a random star in the Rift' : 'To a random star, anywhere', col: d < pr ? '#c9a0ff' : '#9fb0cc'} }
	if (Tg.kind == 'deposit') { const dd = len(sub(posOf(Tg), s.p)); target.kind = 'deposit · ' + Tg.dep.res + ' · ' + Tg.dep.tons.toLocaleString('en-US') + ' t'; target.dock = {line1: 'Marked by the ground scan', line2: 'Mining from the ground comes later (L3)', col: '#c9a46a'} }
	if (Tg.kind == 'beacon') { target.kind = 'navigation beacon'; target.dock = {line1: 'Hyperspace arrivals come out here', line2: navWorks() ? 'Receiver working' : ship.utility.nav ? 'Receiver offline' : 'No nav beacon receiver fitted', col: '#6cc9e8'} }
	if (Tg.kind == 'site') {
		const c = Tg.colony, d = len(sub(s.p, Tg.pos)) - (c.stage == 'building' ? Tg.radius : 0);
		target.kind = c.stage == 'building' ? 'constructor · ' + Co.PORTS[c.port].name.toLowerCase() : 'your claim · ' + Co.PORTS[c.port].name.toLowerCase();
		target.dock = c.stage == 'claimed' ? {line1: d < Tg.radius * Co.COL.beaconRadii ? 'Press N to drop the beacon' : 'Beacon: within ' + H.fmtDist(Tg.radius * Co.COL.beaconRadii), line2: 'Due by day ' + c.beaconBy, col: d < Tg.radius * Co.COL.beaconRadii ? '#7fd1a8' : '#f2a33a'}
			: {line1: Math.round(Co.progress(c) * 100) + '% built · due day ' + c.due, line2: d < Co.COL.deliverRange ? 'Press N to hand over goods' : 'Deliver within ' + H.fmtDist(Co.COL.deliverRange), col: d < Co.COL.deliverRange ? '#7fd1a8' : '#6cc9e8'};
	}
	if (Tg.kind == 'planet') {
		const done = X.surveyed(game.P, game.star.id, Tg.name), p = Tg.src, near = len(sub(s.p, Tg.pos)) < Tg.radius * X.EXPLORE.surveyRadii;
		target.land = Ld.card(ship, p);   /* landing: can this ship set down there? */
		target.dock = done ? {line1: 'Surveyed · ' + p.g.toFixed(2) + ' g · ' + Math.round(p.Ts) + ' K · ESI ' + p.esi.toFixed(2), line2: [p.alive ? 'life' : p.life ? 'traces of life' : null, p.ruins ? 'ruins' : null, p.atmo ? 'air ' + Math.round(p.bars * 10) / 10 + ' bar' : 'no air'].filter(Boolean).join(' · '), col: p.ruins || p.alive ? '#f2d36a' : '#7fd1a8'}
			: !M.works(fit, 'sensors') ? {line1: 'Sensors down: no survey', col: '#e5484d'}
			: !ship.utility.carto ? {line1: 'No cartographic sensor: no survey', col: '#f2a33a'}
			: near ? {line1: 'Surveying… ' + Math.round(100 * game.surveyT / X.EXPLORE.survey) + '%', col: '#6cc9e8'}
			: {line1: 'Survey: fly within ' + H.fmtDist(Tg.radius * X.EXPLORE.surveyRadii) + ' of the centre', col: '#9fb0cc'};
	}
	if (isCan) { const rv = len(sub(s.v, Tg.v)); target.dock = {line1: !hasHatch() ? 'No cargo hatch on this ship' : !M.works(fit, 'hatch') ? 'Hatch jammed: can\'t scoop' : !game.hatch ? 'Open the cargo hatch (I) to scoop' : rv > Ca.CAN.speed ? 'Slow down: ' + Math.round(rv) + ' m/s, under ' + Ca.CAN.speed : 'Drift it under the belly', col: game.hatch && rv <= Ca.CAN.speed ? '#7fd1a8' : '#f2a33a'} }
	if (isShip) {
		target.hostile = isHostile(Tg);
		const scan = Tg.scanned ? (Tg.scanned.warrant ? (Tg.wanted ? ' · WANTED ' + Tg.wanted.amount.toLocaleString('en') + ' ' + Tg.wanted.code : ' · CLEAN') : '') : (ship.utility.warrant || ship.utility.manifest) && Tg.scanT > 0 ? ' · SCANNING ' + Math.round(Tg.scanT / 3 * 100) + '%' : '';
		if (Tg.scanned && Tg.scanned.manifest) { const by = {}; for (const g of Tg.cargo || []) by[g] = (by[g] || 0) + 1; target.kind += ' · ' + (Object.keys(by).length ? Object.entries(by).map(([g, t]) => g + ' ' + t + ' t').join(', ') : 'empty hold') }
		target.bars = {what: (target.hostile ? 'HOSTILE' : Tg.role == 'trader' ? 'CIVILIAN' : 'NEUTRAL') + scan, shield: Tg.cs.shield / Math.max(1, Tg.cs.shieldMax), hull: Tg.cs.hull / Tg.cs.hullMax};
		/* fixed guns: a point of aim for each shot speed fitted (a laser's is the target itself); gimballed: whether they
		   have it in their circle now, and where they point */
		const show = game.settings.hud.lead && game.mode != 'analysis' && dist < 6000, foeT = {p: Tg.s.p, v: Tg.s.v, a: Tg.s.acc, heat: Tg.cs.heat, id: Tg.id};
		const fixedSpeeds = [...new Set(game.pcs.load.guns.filter(x => x.mount != 'gimbal' && !C.WEAPONS[x.kind].homing && !C.WEAPONS[x.kind].hitscan && C.WEAPONS[x.kind].speed).map(x => C.WEAPONS[x.kind].speed))].sort((a, b) => a - b);
		target.leads = fixedSpeeds.map((sp, i) => { const lp = project(cam, C.lead(s.p, s.v, Tg.s.p, Tg.s.v, sp, Tg.s.acc)); return {x: lp.x, y: lp.y, on: show && lp.z > 0, label: fixedSpeeds.length > 1 ? (i ? 'F' : 'S') : ''} });
		const gg = game.pcs.load.guns.find(x => x.mount == 'gimbal');
		if (gg && show) { const a = C.aimOf(game.pcs, s, gg, foeT); if (a.tracking) { const tp = project(cam, add(s.p, mul(a.dir, dist))); target.track = {x: tp.x, y: tp.y} } }
		const lk = game.pcs.lock; target.lock = lk.id == Tg.id ? Math.min(1, lk.t / C.COMBAT.lockTime) : 0; target.locked = !!game.locked;
	}
	/* the scanner: ships within 8 km, in the ship's frame */
	const SB = R.basis(s.q), blips = game.npcs.filter(n => !n.cs.dead).map(n => { const d = sub(n.s.p, s.p); return {x: dot(d, SB.r), y: dot(d, SB.u), z: dot(d, SB.f), col: isHostile(n) ? '#e5484d' : n.role == 'trader' ? '#9fb0cc' : n.faction == game.P.origin || F.relation(game.P.origin, n.faction) > 0 ? '#7fd1a8' : '#f2d36a', big: n.ship.length > 100, target: n == Tg} });
	for (const c of game.cans) { const d = sub(c.p, s.p); blips.push({x: dot(d, SB.r), y: dot(d, SB.u), z: dot(d, SB.f), col: '#c9a46a', target: c == Tg}) }
	for (const m of game.shots) if (m.kind == 'missile' || m.kind == 'torpedo') { const d = sub(m.p, s.p); blips.push({x: dot(d, SB.r), y: dot(d, SB.u), z: dot(d, SB.f), col: '#ffffff'}) }
	const pc = game.pcs, full = C.loadout(ship), ammoGuns = pc.load.guns.filter(g => g.ammo != null && g.kind != 'torpedo');
	const vm = speed > 2 ? project(cam, add(cam.p, mul(norm(cz.on ? Fl.forward(s) : rel.v), 1e6))) : null;
	const leg = nextLeg(), J = game.jump;
	H.draw(ctx, W, Hh, game.hudData = {
		speed, vmax: s.spec.vmax, throttle: game.throttle, fa: s.fa, cruise: cz.on, charging: cz.charge > 0 ? cz.charge : 0, massLocked: !cz.on && Sc.massLocked(scene, s.p),
		target, prograde: vm && game.settings.hud.prograde ? {x: vm.x, y: vm.y, on: vm.z > 0} : null, alerts: M.alerts(fit), modules: fit.modules, showSystems: game.systems, shipName: ship.name,
		messages: game.msgs, vision: game.vision, gFelt: game.gFelt, reduceFlash: reduceFlash(), reduceMotion: game.settings.a11y.motion, thrustNote: s.fa ? null : tr('Thrust') + ' ' + Math.round(game.throttle * 100) + '%',
		gear: game.gear, landed: !!game.landed, lights: !!game.lights, nv: !!game.nv, mode: game.mode || 'combat',
		radial: game.radial ? {sel: game.radial.sel, items: RADIAL.map(([id, name]) => ({name: tr(name), on: id == 'gear' ? game.gear : id == 'hatch' ? game.hatch : id == 'lights' ? game.lights : id == 'nightVision' ? game.nv : id == 'systems' ? game.systems : id == 'mouse' ? game.mouseFly : id == 'fa' ? s.fa : null}))} : null, fps: game.settings.graphics.fps ? game.fps : null, captions: game.settings.a11y.captions ? game.captions.filter(c => game.t - c.t < 3) : null,
		fuel: game.fuel, jumpCharge: J && J.tunnel == null ? J.charge : 0, witch: J && J.tunnel != null ? 1 - J.tunnel / JUMP.tunnel : null, witchTo: J && J.leg.star.name,
		nextLeg: leg ? tr('Next') + ': ' + leg.star.name + ' · ' + leg.d.toFixed(1) + ' pc' + (leg.kind != 'jump' ? ' (lane)' : '') + ' · J' : null,
		touch: RG.lastInput == 'touch', touchUI: touchLayout(),
		sweep: game.sweep > 0 ? 1 - game.sweep / X.EXPLORE.sweep : 0, gscan: game.gscan ? Math.min(1, game.gscan.t / GSCAN.time) : 0,
		refinery: Object.keys(game.P.refinery || {}).length ? Object.entries(game.P.refinery).map(([g, t]) => g + ' ' + t.toFixed(1)).join(' · ') : null,
		hatch: !hasHatch() ? null : !M.works(fit, 'hatch') ? 'jammed' : game.hatch ? 'open' : null,
		surface: !cz.on && game.well ? (() => { const ss = Sc.surfaceState(scene, s, game.t, ship); return ss && ss.alt < 30000 ? {world: ss.world, alt: ss.alt, vz: ss.vz, vh: ss.vh, pitch: ss.pitch, bank: ss.bank, limit: Ld.TOUCH[Ld.padFor(ship.size)].vz, landable: ss.landable && ss.landable.ok} : null })() : null,
		scanner: M.works(fit, 'sensors') && game.settings.hud.scanner ? {range: game.t < (game.pulseUntil || 0) ? PULSE.range : 8000, blips} : null, well: game.well ? {g: game.well.g, alt: game.well.alt, name: game.well.body.name} : null, incoming: game.incoming > 0, hitAge: game.hitAt != null ? game.t - game.hitAt : null,
		/* the gimballed guns' circle: 40% of the screen's height across */
		gimbal: pc.load.guns.some(g => g.mount == 'gimbal') && game.mode != 'analysis' && !cz.on && !game.docked ? {r: 0.2 * Hh, charge: railCharge(pc)} : railCharge(pc) ? {r: 0, charge: railCharge(pc)} : null,
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
	const list = [['FIRE', 'fire', Tt.fire != null], ['MSL', 'missile', game.locked], ['FLARE', 'flare'], ['HOSTILE', 'hostile'], ['HATCH', 'hatch', game.hatch], ['FA', 'fa', s && s.fa], ['CRUISE', 'cruise', game.cruise.on], ['TARGET', 'target'], ['DOCK', 'dock'], ['MAP', 'map'], ['JUMP', 'jump', !!game.jump], ['VIEW', 'view'], ['GEAR', 'gear', game.gear], ['II', 'pause']];
	return {stick: {x: r + 30, y: Hh - r - 30, r, dx: Tt.dx, dy: Tt.dy},
		thr: {x: W - 70, y: Hh - 200, w: 48, h: 170},
		/* the vertical thrusters: up and down from the middle, back to the middle when let go */
		vert: {x: W - 136, y: Hh - 200, w: 40, h: 170, v: Tt.vert || 0},
		buttons: list.map(([label, act, onFlag], i) => ({label, act, on: !!onFlag, x: W - 140 - (i % 4) * 72 - 80, y: Hh - 90 - Math.floor(i / 4) * 56, w: 64, h: 46}))};
}
function pointers() {
	const pt = e => { const p = view.toGame(e.clientX, e.clientY); return {x: p.x, y: p.y, touch: e.pointerType == 'touch', id: e.pointerId} };
	const Tt = game.touch;
	hud.addEventListener('pointermove', e => { game.ptr = pt(e); if (game.mapOpen) { map.move(game.ptr); return } if (Tt.stick && Tt.stick.id == e.pointerId) stickMove(game.ptr); if (Tt.vertId == e.pointerId) vertMove(game.ptr); if (Tt.thrId == e.pointerId) thrMove(game.ptr) });
	hud.addEventListener('pointerdown', e => {
		const p = pt(e); game.ptr = p; hud.focus();
		RG.lastInput = e.pointerType == 'touch' ? 'touch' : 'mouse';
		try { hud.setPointerCapture(e.pointerId) } catch (x) {}
		if (game.mapOpen) { const act = map.down(p); if (act) mapAct(act); return }
		if (e.pointerType != 'touch') { if (e.button == 0 && !game.docked) game.mouseFire = true; return }
		const u = touchLayout();
		const b = u.buttons.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
		if (b && b.act == 'fire') { Tt.fire = e.pointerId; return }
		if (b) { ({missile: () => { Tt.msl = true }, flare: () => { Tt.flare = true }, hostile: nearestHostile, hatch: toggleHatch, fa: toggleFA, cruise: toggleCruise, target: nextTarget, dock: requestDock, map: openMap, jump: requestJump, view: () => { game.chase = !game.chase }, gear: toggleGear, pause: () => RG.pause()})[b.act](); return }
		if (Math.hypot(p.x - u.stick.x, p.y - u.stick.y) < u.stick.r * 1.6) { Tt.stick = {id: e.pointerId}; stickMove(p); return }
		if (p.x >= u.vert.x - 8 && p.x <= u.vert.x + u.vert.w + 8 && p.y >= u.vert.y - 20 && p.y <= u.vert.y + u.vert.h + 20) { Tt.vertId = e.pointerId; vertMove(p); return }
		if (p.x >= u.thr.x - 20 && p.x <= u.thr.x + u.thr.w + 20 && p.y >= u.thr.y - 20 && p.y <= u.thr.y + u.thr.h + 20) { Tt.thrId = e.pointerId; thrMove(p) }
	});
	const up = e => { if (e.pointerType != 'touch' && e.button == 0) game.mouseFire = false; if (Tt.fire == e.pointerId) Tt.fire = null; if (game.mapOpen) { map.up(pt(e)); return } if (Tt.stick && Tt.stick.id == e.pointerId) { Tt.stick = null; Tt.dx = Tt.dy = 0 } if (Tt.vertId == e.pointerId) { Tt.vertId = null; Tt.vert = 0 } if (Tt.thrId == e.pointerId) Tt.thrId = null };
	hud.addEventListener('pointerup', up); hud.addEventListener('pointercancel', up);
	function stickMove(p) { const u = touchLayout().stick; let dx = (p.x - u.x) / u.r, dy = (p.y - u.y) / u.r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l } Tt.dx = dx; Tt.dy = dy }
	function vertMove(p) { const u = touchLayout().vert; Tt.vert = Math.max(-1, Math.min(1, 1 - 2 * (p.y - u.y) / u.h)) }
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
		body.innerHTML = '<p class="build">Ember Reach · ' + BUILD.name + ' ' + BUILD.version + '</p><h1 id="ovT">' + esc(tr(kind == 'pause' ? 'Paused' : 'Controls')) + '</h1><p>' + esc(ship.name) + ' · ' + esc(where) + ' · day ' + Math.floor(game.day) + ' · fuel ' + Math.round(game.fuel * 100) + '%. ' + (R.kind == 'webgl' ? 'WebGL 2.' : 'Canvas 2D fallback.') + '</p><table>' + helpRows().map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table><p class="small">' + esc(tr('Mouse: the left button fires; with mouse flight on, point away from the centre to pitch and roll.')) + ' ' + esc(tr('Gamepad sticks: the left pitches and rolls, the right yaws and sets the throttle.')) + ' ' + esc(tr('Gamepad: the d-pad strafes (up and down are the vertical thrusters). A asks for docking; held half a second, it moves the landing gear.')) + ' ' + esc(tr('Touch: the VERT slider beside the throttle works the vertical thrusters, and GEAR moves the landing gear.')) + '</p><p class="small">' + esc(tr('Landing: target a world you can land on and cruise to it, and you drop out above it. Below its Kármán line its gravity pulls, and flight assist holds you up. Lower the gear, let down on the vertical thrusters (strafe up and down), and touch down slowly on level ground.')) + '</p>';
		button(tr('Resume'), close, true).focus();
		button(tr('Settings'), () => openSettings(() => overlay(kind)));
		button(tr('Save to a file'), () => { persist(); setTimeout(() => RG.exportSave(), 300) });
		button(tr('Load from a file'), () => RG.importSave().then(() => location.reload(), e => say(e.message, '#f2a33a')));
		button(tr('New game'), e => { if (e.target.dataset.sure) { RG.save({settingsOnly: true, settings: game.settings}).then(() => { location.href = location.pathname }) } else { e.target.dataset.sure = 1; e.target.textContent = tr('New game: sure? (the save is lost)') } });
	}
	ov.hidden = false;
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

start().catch(e => { console.error(e); const l = $('load'); if (l) l.textContent = '> could not start: ' + e.message });
})();
