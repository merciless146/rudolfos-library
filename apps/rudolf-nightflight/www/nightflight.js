/* ===== Night Flight: a top-down bullet-hell shooter for Rudolf OS (docs/plan-games.md in RudolfOS).
   Rudolf flies up through the night and fires lasers from his glowing nose at the corruption.
   - Fire (Z, A, or a finger held down): a stream of nose lasers; held, it charges, and let go when full it fires a
     piercing beam. Glow pick-ups widen the stream, then add homing sparks.
   - Focus (Shift, a trigger, or a second finger): slow, with Rudolf's hit point (his nose's glow) shown.
   - Glow Burst (X, B, or a two-finger tap): clears the bullets, hurts every enemy, turns them back to their colours.
   - Grazing bullets fills a meter for score and extra Glow Bursts. Corrupted friends are saved with the beam or a
     Glow Burst, for bonuses and extra lives.
   The game runs in fixed steps (60 a second) from a seeded random, and every step's input is recorded: a flight can be
   watched again and ends with the same score (the replay). Art (art.js), sound (audio.js), stages (stages.js).
   Original work. GPL-2.0-or-later. ===== */
(function () {
'use strict';
const W = 360, H = 640, DT = 1 / 60;
const SPEED = 230, FOCUS_SPEED = 95, PR = 2.6, GR = 16, AUTO_Y = 170;
const $ = s => document.querySelector(s);
const cv = $('#cv'), AU = window.NFAUDIO, ART = window.NFART;
const NF = window.NF = {W, H};
const DIFF = {easy: {name: 'Easy', bs: .78, dens: .6, lives: 4, bombs: 4, aim: .6}, normal: {name: 'Normal', bs: 1, dens: 1, lives: 2, bombs: 3, aim: 1}, hard: {name: 'Hard', bs: 1.18, dens: 1.35, lives: 2, bombs: 2, aim: 1}};
let save = {v: 1, hi: {}, hiA: {}, reached: 1, set: {diff: 'normal', music: true, sfx: true, reduceFlash: false, slow: false, binds: null}, replay: null, runs: 0, rescues: 0};
let view = null, S = null, screen = 'title', titleT = 0, frameMs = 0;

/* ---------- pools (no allocation while playing) ---------- */
function pool() { return {a: [], free: []} }
const EB = pool(), SH = pool(), EN = pool(), IT = pool(), FX = pool();
function take(p) { const o = p.free.pop() || {}; p.a.push(o); return o }
function sweep(p, keep) { let w = 0; const a = p.a; for (let i = 0; i < a.length; i++) { const o = a[i]; if (keep(o)) a[w++] = o; else p.free.push(o) } a.length = w }
function clearPool(p) { for (const o of p.a) p.free.push(o); p.a.length = 0 }

/* ---------- the API the stages use ---------- */
NF.R = () => S.rng();
NF.player = () => S.P;
NF.diff = () => S.D;
NF.t = () => S.t;
NF.n = n => Math.max(1, Math.round(n * S.D.dens));          /* a count, by difficulty */
NF.aim = (x, y) => Math.atan2(S.P.y - y, S.P.x - x);
/* an enemy bullet: angle (radians, 0 = right), speed (px/s); o: {acc, curve, delay, r, wait:[secs, newSpeed]} */
NF.bullet = function (x, y, ang, spd, type, col, o) {
	if (EB.a.length > 1600) return null;
	const b = take(EB), r = o && o.r || ({ball: 4, rice: 3.4, star: 4.5, flake: 4.5, shard: 4}[type] || 4);
	b.x = x; b.y = y; b.ang = ang; b.spd = spd * S.D.bs; b.acc = (o && o.acc || 0) * S.D.bs; b.cur = o && o.curve || 0; b.delay = o && o.delay || 0;
	b.type = type; b.col = col; b.r = r; b.gz = false; b.on = true; b.spr = ART.bullet(type, col, Math.round(r));
	b.min = o && o.min !== undefined ? o.min * S.D.bs : -1e9; b.max = o && o.max !== undefined ? o.max * S.D.bs : 1e9;
	b.wait = o && o.wait ? o.wait[0] : 0; b.then = o && o.wait ? o.wait[1] * S.D.bs : 0; b.thenAim = o && o.wait && o.wait[2];
	b.spin = type == 'star' || type == 'flake' ? (o && o.spin || 4) : 0; b.rot = 0;
	return b;
};
NF.ring = (x, y, n, spd, type, col, off, o) => { for (let i = 0; i < n; i++) NF.bullet(x, y, (off || 0) + i / n * Math.PI * 2, spd, type, col, o) };
NF.fan = (x, y, ang, n, spread, spd, type, col, o) => { for (let i = 0; i < n; i++) NF.bullet(x, y, ang + (n == 1 ? 0 : (i / (n - 1) - .5) * spread), spd, type, col, o) };
/* an enemy: kind (art), hp, fn(e, dt) moves it and fires; o: {score, drop:[[item, n]], friend, r} */
NF.enemy = function (kind, x, y, hp, fn, o) {
	const e = take(EN);
	e.kind = kind; e.x = x; e.y = y; e.hp = hp; e.hp0 = hp; e.fn = fn; e.t = 0; e.on = true; e.boss = false; e.vx = 0; e.vy = 0;
	e.r = o && o.r || {mite: 9, bauble: 13, windup: 15, wisp: 12, bunny: 12}[kind] || 12;
	e.score = o && o.score || hp * 30; e.drop = o && o.drop || [['gift', 1]]; e.friend = !!(o && o.friend); e.saved = false;
	e.clean = 0; e.flash = 0; e.d = {}; e.seen = false;
	return e;
};
NF.move = (e, dt) => { e.x += e.vx * dt; e.y += e.vy * dt };
NF.towards = (e, x, y, k, dt) => { e.x += (x - e.x) * Math.min(1, k * dt); e.y += (y - e.y) * Math.min(1, k * dt) };
NF.every = (e, key, sec) => { const v = Math.floor(e.t / sec), was = e.d[key]; e.d[key] = v; return was !== undefined && v != was };

/* ---------- a flight ---------- */
function newRun(mode, diff, stage, o) {
	const D = DIFF[diff] || DIFF.normal;
	S = {mode, diff, D, stage: stage || 0, seed: o && o.seed || String(Date.now()) + ':' + Math.floor(Math.random() * 1e9), score: 0, lives: mode == 'practice' ? 99 : D.lives, bombs: D.bombs,
		power: mode == 'practice' ? 60 : 0, graze: 0, gmeter: 0, rescues: 0, extend: 0, misses: 0, frame: 0, rec: [], recOn: mode == 'story' || mode == 'attack', replay: o && o.replay || null, rp: 0,
		continues: 0, over: false, slowAcc: 0, slow: mode == 'practice' && save.set.slow, prevFire: false, totalT: 0, ended: false};
	S.P = {x: W / 2, y: H - 80, inv: 2, charge: 0, cd: 0, focus: false, vx: 0, blink: 0, cheer: 0, chargedSaid: false, alive: true};
	startStage(S.stage);
}
function startStage(i) {
	const st = window.NFSTAGES[i];
	S.stage = i; S.st = st; S.t = 0; S.wi = 0; S.phase = 'intro'; S.phaseT = 0; S.boss = null; S.beam = 0; S.bombT = 0; S.scroll = 0; S.clearT = 0; S.stageScore0 = S.score;
	S.rng = RG.rng(S.seed + ':' + i);
	clearPool(EB); clearPool(EN); clearPool(SH); clearPool(IT); clearPool(FX);
	S.P.x = W / 2; S.P.y = H - 80; S.P.inv = Math.max(S.P.inv, 1.5);
	S.banner = {t: 0, title: st.name, sub: st.sub};
	AU.play(st.music);
	if (save.reached < i + 1) { save.reached = i + 1; persist() }
}

/* ---------- input: an intent per step (recorded; a replay supplies them instead) ---------- */
const T = {ids: new Map(), dx: 0, dy: 0, down: false, two: false, bomb: false, twoAt: 0, moved: 0};
function liveIntent() {
	const focus = RG.down('focus') || T.two, sp = (focus ? FOCUS_SPEED : SPEED) * DT;
	let kx = (RG.down('right') ? 1 : 0) - (RG.down('left') ? 1 : 0), ky = (RG.down('down') ? 1 : 0) - (RG.down('up') ? 1 : 0);
	if (kx && ky) { kx *= .7071; ky *= .7071 }
	let dx = kx * sp, dy = ky * sp;
	/* a finger or the mouse steers by how far it moved (Rudolf stays where he is under it, not under the finger) */
	const k = focus ? .5 : 1; dx += T.dx * k; dy += T.dy * k; T.dx = T.dy = 0;
	const fire = RG.down('fire') || T.down, bomb = RG.pressed('bomb') || T.bomb; T.bomb = false;
	return pack(dx, dy, fire, focus, bomb);
}
const q = v => Math.max(-127, Math.min(127, Math.round(v * 4)));
function pack(dx, dy, fire, focus, bomb) { return [q(dx), q(dy), (fire ? 1 : 0) | (focus ? 2 : 0) | (bomb ? 4 : 0)] }
/* replays: three bytes a step, runs of the same step counted (base64) */
function encodeRec(rec) {
	const out = []; let i = 0;
	while (i < rec.length) { const r = rec[i]; let n = 1; while (i + n < rec.length && n < 255 && rec[i + n][0] == r[0] && rec[i + n][1] == r[1] && rec[i + n][2] == r[2]) n++; out.push(n, r[0] & 255, r[1] & 255, r[2]); i += n }
	let s = ''; for (let j = 0; j < out.length; j += 8192) s += String.fromCharCode.apply(null, out.slice(j, j + 8192)); return btoa(s);
}
function decodeRec(b64) {
	const s = atob(b64), rec = [];
	for (let i = 0; i + 3 < s.length; i += 4) { const n = s.charCodeAt(i), a = s.charCodeAt(i + 1), b = s.charCodeAt(i + 2), f = s.charCodeAt(i + 3); const v = [a > 127 ? a - 256 : a, b > 127 ? b - 256 : b, f]; for (let k = 0; k < n; k++) rec.push(v) }
	return rec;
}
function pointerSetup() {
	cv.style.touchAction = 'none';
	cv.addEventListener('contextmenu', e => e.preventDefault());
	cv.addEventListener('pointerdown', e => {
		AU.unlock(); RG.lastInput = e.pointerType == 'touch' ? 'touch' : 'mouse';
		if (screen != 'play') return;
		if (e.pointerType == 'mouse' && e.button == 2) { T.bomb = true; return }
		if (e.pointerType == 'mouse' && e.button != 0) return;
		try { cv.setPointerCapture(e.pointerId) } catch (x) {}
		T.ids.set(e.pointerId, {x: e.clientX, y: e.clientY, t: performance.now(), mv: 0});
		if (T.ids.size == 1) T.down = true;
		if (T.ids.size == 2) { T.two = true; T.twoAt = performance.now(); T.moved = 0 }
	});
	cv.addEventListener('pointermove', e => {
		const p = T.ids.get(e.pointerId); if (!p) return;
		const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.mv += Math.abs(dx) + Math.abs(dy);
		/* only the first finger steers */
		if (e.pointerId == T.ids.keys().next().value && view) { T.dx += dx / view.scale; T.dy += dy / view.scale }
		if (T.two) T.moved += Math.abs(dx) + Math.abs(dy);
	});
	const up = e => {
		if (!T.ids.has(e.pointerId)) return;
		if (T.two && T.ids.size == 2 && performance.now() - T.twoAt < 300 && T.moved < 24) T.bomb = true;
		T.ids.delete(e.pointerId);
		if (T.ids.size < 2) T.two = false;
		if (!T.ids.size) T.down = false;
	};
	cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}

/* ---------- one step of the game ---------- */
function step(I) {
	S.frame++; S.t += DT; S.totalT += DT; S.phaseT += DT; S.scroll += 60 * DT;
	const P = S.P, st = S.st;
	if (S.recOn) S.rec.push(I);
	/* Rudolf */
	const fire = !!(I[2] & 1), focus = !!(I[2] & 2), bomb = !!(I[2] & 4);
	P.focus = focus; P.vx = I[0] / 4;
	P.x = Math.max(10, Math.min(W - 10, P.x + I[0] / 4)); P.y = Math.max(40, Math.min(H - 20, P.y + I[1] / 4));
	if (P.inv > 0) P.inv -= DT; if (P.cheer > 0) P.cheer -= DT;
	if (S.phase != 'clear' && S.phase != 'done') {
		if (fire) {
			P.cd -= DT; if (P.cd <= 0) { shoot(); P.cd += 1 / 15 }
			P.charge = Math.min(1, P.charge + DT / 1.5); if (P.charge >= 1 && !P.chargedSaid) { P.chargedSaid = true; AU.sfx('charge') }
		} else {
			if (S.prevFire && P.charge >= 1) { S.beam = .7; S.beamX = P.x; AU.sfx('beam') }
			P.charge = 0; P.chargedSaid = false; P.cd = 0;
		}
		S.prevFire = fire;
		if (bomb && S.bombs > 0 && S.bombT <= 0) glowBurst();
	}
	/* the stage's script */
	if (S.phase == 'intro' && S.t > 2.5) S.phase = 'waves';
	while (st.waves[S.wi] && st.waves[S.wi][0] <= S.t) { st.waves[S.wi][1](); S.wi++ }
	if (S.phase == 'waves' && S.t >= st.len && (!EN.a.some(e => !e.friend) || S.t > st.len + 5)) { S.phase = 'warn'; S.phaseT = 0; AU.sfx('warn'); AU.stop() }
	if (S.phase == 'warn' && S.phaseT > 2.2) { S.phase = 'boss'; S.phaseT = 0; spawnBoss(st.boss); AU.play('boss') }
	if (S.phase == 'clear' && S.phaseT > 4) {
		if (S.stage + 1 < window.NFSTAGES.length && S.mode != 'practice') { S.phase = 'next'; startStage(S.stage + 1) }
		else { S.phase = 'done'; S.ended = true; endRun(true) }
	}
	/* the beam: a column from the nose */
	if (S.beam > 0) { S.beam -= DT; S.beamX += (P.x - S.beamX) * .3 }
	if (S.bombT > 0) S.bombT -= DT;
	/* enemies */
	for (const e of EN.a) {
		if (!e.on) continue;
		e.t += DT; if (e.clean > 0) e.clean -= DT; if (e.flash > 0) e.flash -= DT;
		if (e.saved) { e.y -= 90 * DT; e.x += Math.sin(e.t * 8) * 1.2; if (e.y < -40) e.on = false; continue }
		e.fn(e, DT);
		if (e.x > -30 && e.x < W + 30 && e.y > -30 && e.y < H + 30) e.seen = true;
		else if (e.seen || e.t > 12) { if (!e.boss) e.on = false }
		if (S.beam > 0 && e.y < P.y && Math.abs(e.x - S.beamX) < 15 + e.r) {
			if (e.friend) rescue(e); else hurt(e, e.boss ? 1.6 : 5);
		}
		if (S.bombT > .2 && !e.boss) { if (e.friend) rescue(e); else hurt(e, 2.5) }
		else if (S.bombT > .2 && e.boss) hurt(e, .9);
		/* touching an enemy */
		if (e.on && !e.saved && P.inv <= 0 && !e.friend) { const dx = e.x - P.x, dy = e.y - (P.y + ART.noseY); if (dx * dx + dy * dy < (e.r * .6 + PR) ** 2) miss() }
	}
	sweep(EN, e => e.on);
	/* Rudolf's shots */
	for (const s of SH.a) {
		if (s.homing) { const tg = nearest(s.x, s.y); if (tg) { const a = Math.atan2(tg.y - s.y, tg.x - s.x), cur = Math.atan2(s.vy, s.vx); let d = a - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); const na = cur + Math.max(-.2, Math.min(.2, d)); s.vx = Math.cos(na) * 600; s.vy = Math.sin(na) * 600 } }
		s.x += s.vx * DT; s.y += s.vy * DT;
		if (s.y < -20 || s.x < -20 || s.x > W + 20 || s.y > H + 20) { s.on = false; continue }
		for (const e of EN.a) { if (!e.on || e.friend || e.saved) continue; const dx = e.x - s.x, dy = e.y - s.y; if (dx * dx + dy * dy < (e.r + 4) ** 2) { hurt(e, s.dmg); s.on = false; break } }
	}
	sweep(SH, s => s.on);
	/* enemy bullets */
	const rr = (PR) ** 2, bombR = S.bombT > 0 ? (1.4 - S.bombT) / .8 * 560 : 0;
	const NY = P.y + ART.noseY;
	for (const b of EB.a) {
		if (!b.on) continue;
		if (b.delay > 0) { b.delay -= DT; continue }
		if (b.wait > 0) { b.wait -= DT; if (b.wait <= 0) { b.spd = b.then; b.acc = 0; if (b.thenAim) b.ang = Math.atan2(P.y - b.y, P.x - b.x) } }
		b.spd = Math.max(b.min, Math.min(b.max, b.spd + b.acc * DT)); b.ang += b.cur * DT; b.rot += b.spin * DT;
		b.x += Math.cos(b.ang) * b.spd * DT; b.y += Math.sin(b.ang) * b.spd * DT;
		if (b.x < -24 || b.x > W + 24 || b.y < -24 || b.y > H + 24) { b.on = false; continue }
		const dx = b.x - P.x, dy = b.y - NY, d2 = dx * dx + dy * dy;
		if (bombR && d2 < bombR * bombR) { b.on = false; item('star', b.x, b.y, true); continue }
		if (P.inv <= 0 && S.phase != 'clear') {
			if (d2 < (b.r * .75 + PR) ** 2) { miss(); continue }
			if (!b.gz && d2 < (b.r + GR) ** 2) { b.gz = true; S.graze++; S.score += 20; S.gmeter++; AU.sfx('graze'); if (S.gmeter >= 120) { S.gmeter = 0; if (S.bombs < 6) { S.bombs++; AU.sfx('power') } } }
		}
	}
	sweep(EB, b => b.on);
	/* items */
	for (const it of IT.a) {
		const dx = P.x - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy);
		if (it.auto || P.y < AUTO_Y || d < (P.focus ? 70 : 40)) { it.auto = true; const v = 520; it.x += dx / (d || 1) * v * DT; it.y += dy / (d || 1) * v * DT }
		else { it.vy = Math.min(150, it.vy + 260 * DT); it.x += it.vx * DT; it.y += it.vy * DT; it.vx *= .96 }
		if (d < 18) { collect(it); it.on = false } else if (it.y > H + 20) it.on = false;
	}
	sweep(IT, i => i.on);
	/* boss */
	if (S.boss) bossStep(S.boss);
	/* extra lives by score */
	const ext = [1e6, 3e6, 6e6]; if (S.extend < ext.length && S.score >= ext[S.extend]) { S.extend++; addLife() }
}
function nearest(x, y) { let b = null, bd = 1e9; for (const e of EN.a) { if (!e.on || e.friend || e.saved || e.y < -10) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; b = e } } return b }
function level() { const p = S.power; return p >= 80 ? 3 : p >= 48 ? 2 : p >= 20 ? 1 : 0 }
function shot(x, y, ang, dmg, homing) { const s = take(SH); s.x = x; s.y = y; s.vx = Math.cos(ang) * 760; s.vy = Math.sin(ang) * 760; s.dmg = dmg; s.homing = !!homing; s.on = true; s.ang = ang }
function shoot() {
	const P = S.P, L = level(), nx = P.x, ny = P.y + ART.noseY, up = -Math.PI / 2, f = P.focus ? .35 : 1;
	shot(nx - 4, ny, up, 1); shot(nx + 4, ny, up, 1);
	if (L >= 1) { shot(nx - 6, ny + 2, up - .14 * f, .7); shot(nx + 6, ny + 2, up + .14 * f, .7) }
	if (L >= 2) { shot(nx - 8, ny + 4, up - .28 * f, .6); shot(nx + 8, ny + 4, up + .28 * f, .6) }
	if (L >= 3 && S.frame % 8 < 4) { shot(nx - 14, ny + 10, up - .6, .8, true); shot(nx + 14, ny + 10, up + .6, .8, true) }
	AU.sfx('shot');
}
function hurt(e, d) {
	if (!e.on || e.saved) return;
	if (e.boss && (S.phase != 'boss' || e.enterT > 0)) return;
	e.hp -= d; e.flash = .05; AU.sfx('hit');
	if (e.hp <= 0 && !e.boss) kill(e);
}
function kill(e) {
	e.on = false; S.score += e.score;
	for (const [k, n] of e.drop) for (let i = 0; i < n; i++) item(k, e.x + (S.rng() - .5) * 20, e.y + (S.rng() - .5) * 14);
	burst(e.x, e.y, 14, '#d6ff4a'); burst(e.x, e.y, 10, '#ffffff'); AU.sfx(e.r > 13 ? 'big' : 'pop');
}
function rescue(e) {
	if (e.saved) return;
	e.saved = true; e.friend = false; S.rescues++; save.rescues = (save.rescues || 0) + 1; S.score += 3000;
	item(S.rescues % 3 == 0 ? 'life' : 'bomb', e.x, e.y); burst(e.x, e.y, 18, '#ff9af0'); burst(e.x, e.y, 12, '#ffffff');
	text(e.x, e.y - 18, 'Thank you!', '#ffd6ec'); S.P.cheer = 1.2; AU.sfx('rescue');
}
function item(k, x, y, auto) { if (k == 'star' && IT.a.length > 300) { S.score += 30; return } const it = take(IT); it.k = k; it.x = x; it.y = y; it.vx = (S.rng() - .5) * 80; it.vy = -120 - S.rng() * 60; it.auto = !!auto; it.on = true; it.spr = ART.item[k] }
function collect(it) {
	const P = S.P;
	if (it.k == 'glow') { const L = level(); S.power = Math.min(100, S.power + 4); if (level() > L) { AU.sfx('power'); text(P.x, P.y - 34, 'Glow up!', '#ffd2c8') } else AU.sfx('item'); S.score += 100 }
	else if (it.k == 'gift') { const v = P.y < AUTO_Y || it.auto ? 5000 : Math.round(500 + (H - it.y) * 6); S.score += v; AU.sfx('item') }
	else if (it.k == 'star') S.score += 30;
	else if (it.k == 'bomb') { if (S.bombs < 6) S.bombs++; AU.sfx('power') }
	else if (it.k == 'life') addLife();
}
function addLife() { if (S.mode == 'practice') return; S.lives = Math.min(8, S.lives + 1); AU.sfx('life'); text(S.P.x, S.P.y - 40, 'Extra life!', '#ffb3c8') }
function glowBurst() {
	S.bombs--; S.bombT = 1.4; S.P.inv = Math.max(S.P.inv, 2.6); AU.sfx('bomb');
	for (const e of EN.a) e.clean = 2.6;
	if (!save.set.reduceFlash) S.flashT = .35;
}
function miss() {
	const P = S.P; if (P.inv > 0) return;
	S.misses++; AU.sfx('miss'); burst(P.x, P.y, 30, '#ff6a5a'); burst(P.x, P.y, 20, '#ffffff');
	for (const b of EB.a) if (b.on) { b.on = false; item('star', b.x, b.y, false) }
	for (let i = 0; i < 4 && S.power > 0; i++) item('glow', P.x + (S.rng() - .5) * 60, P.y - 20);
	S.power = Math.max(0, S.power - 16);
	P.inv = 3; P.charge = 0; S.beam = 0;
	if (S.mode == 'practice') return;
	if (S.lives <= 0) { gameOver(); return }
	S.lives--; S.bombs = Math.max(S.bombs, S.D.bombs);
	if (!save.set.reduceFlash) S.flashT = .25;
}

/* ---------- bosses ---------- */
function spawnBoss(def) {
	const e = NF.enemy('boss', W / 2, -80, def.phases[0].hp, () => {}, {r: def.r, score: 0});
	e.boss = true; e.def = def; e.pi = 0; e.pt = 0; e.enterT = 1.6; e.bonus = 0; e.restored = 0;
	S.boss = e; S.bossName = def.name;
	setPhase(e, 0);
}
function setPhase(e, i) {
	const ph = e.def.phases[i]; e.pi = i; e.pt = 0; e.hp = e.hp0 = ph.hp; e.d = {};
	S.banner = {t: 0, title: ph.name, sub: e.def.name, small: true};
	if (ph.setup) ph.setup(e);
}
function bossStep(e) {
	if (e.enterT > 0) { e.enterT -= DT; NF.towards(e, W / 2, 130, 3, DT); return }
	if (e.restored) { e.restored += DT; e.y -= 30 * DT; return }
	const ph = e.def.phases[e.pi]; e.pt += DT;
	ph.fn(e, DT);
	if (e.hp <= 0 || e.pt >= ph.time) {
		const beaten = e.hp <= 0;
		for (const b of EB.a) { b.on = false; item('star', b.x, b.y, true) } sweep(EB, b => b.on);
		if (beaten) { const bonus = Math.round((ph.time - e.pt) * 1000 + 10000); S.score += bonus; text(W / 2, 200, 'Phase bonus ' + bonus.toLocaleString(), '#fff2b3') }
		burst(e.x, e.y, 24, '#d6ff4a'); AU.sfx('phase');
		for (let i = 0; i < 4; i++) item(i < 2 ? 'glow' : 'gift', e.x + (S.rng() - .5) * 60, e.y);
		if (e.pi + 1 < e.def.phases.length) setPhase(e, e.pi + 1);
		else { /* beaten: it turns back to its colours and drifts away */
			e.restored = .01; e.friend = true; S.score += 50000; burst(e.x, e.y, 50, '#ffffff'); burst(e.x, e.y, 40, '#ff9af0'); AU.sfx('rescue'); AU.play('clear');
			S.P.cheer = 3; S.phase = 'clear'; S.phaseT = 0; text(W / 2, 260, e.def.freed || 'Freed!', '#ffe6f2');
		}
	}
}

/* ---------- the end of a flight ---------- */
function gameOver() {
	S.over = true; S.lives = -1;
	if (S.mode == 'replay') return endRun(false);
	keepReplay();
	if (S.mode == 'story' && S.continues < 3) return menuContinue();
	endRun(false);
}
function endRun(won) {
	if (S.mode == 'replay') { screen = 'done'; return dialog('<h2>End of the flight</h2><p>Score <b>' + S.score.toLocaleString() + '</b></p>', [['Title', () => toTitle(), 1]]) }
	keepReplay();
	const tbl = S.mode == 'attack' ? save.hiA : save.hi, hi = tbl[S.diff] || 0, best = S.mode != 'practice' && S.continues == 0 && S.score > hi;
	if (best) tbl[S.diff] = S.score;
	save.runs++; persist(); screen = 'done';
	const head = won ? (S.mode == 'practice' ? '<h2>Stage cleared</h2>' : '<h2>The night is not over…</h2><p>Rudolf has pushed the corruption back from the village and the woods, but it runs deeper. Stages 3 to 6 come in a later update.</p>') : '<h2>Game over</h2>';
	dialog(head + '<p>Score <b>' + S.score.toLocaleString() + '</b>' + (best ? ' — a new best (' + DIFF[S.diff].name + ')' : '') + '</p><p>' + S.rescues + ' friends saved, ' + S.graze + ' grazes.</p>',
		S.mode == 'practice' ? [['Again', () => begin('practice', S.diff, S.stage), 1], ['Title', toTitle]] : [['Title', toTitle, 1], ['Play again', () => begin(S.mode, S.diff, 0)]]);
}
/* the flight as it was played, up to its first continue (so it can be watched to the same end) */
function keepReplay() {
	if (!S.recOn || S.kept) return; S.kept = true;
	const data = encodeRec(S.rec); if (data.length > 200000) return;
	save.replay = {seed: S.seed, diff: S.diff, mode: S.mode, score: S.score, stage: S.stage, date: new Date().toISOString().slice(0, 10), data}; persist();
}

/* ---------- effects (not part of the game's state: free to use Math.random) ---------- */
function burst(x, y, n, col) { if (FX.a.length > 500) return; for (let i = 0; i < n; i++) { const f = take(FX), a = Math.random() * 6.283, v = 40 + Math.random() * 160; f.x = x; f.y = y; f.vx = Math.cos(a) * v; f.vy = Math.sin(a) * v; f.t = 0; f.life = .4 + Math.random() * .5; f.col = col; f.txt = null } }
function text(x, y, s, col) { const f = take(FX); f.x = x; f.y = y; f.vx = 0; f.vy = -30; f.t = 0; f.life = 1.4; f.col = col; f.txt = s }
function fxStep(dt) { for (const f of FX.a) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .93; f.vy *= .93 } sweep(FX, f => f.t < f.life) }

/* ---------- drawing ---------- */
function draw() {
	if (!view) return;
	const t0 = performance.now(), x = view.begin(), k = view.scale * view.dpr, ox = view.ox * view.dpr, oy = view.oy * view.dpr;
	x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
	if (screen == 'title' || !S) { ART.title(x, W, H, titleT); drawTitle(x); x.restore(); return }
	const st = S.st, shake = S.flashT > 0 && !save.set.reduceFlash ? (Math.random() - .5) * 4 : 0;
	if (shake) x.translate(shake, 0);
	ART[st.bg](x, W, H, S.scroll, S.totalT, st.dark || 0);
	if (S.phase == 'warn' || S.phase == 'boss') { x.fillStyle = 'rgba(20,0,40,' + Math.min(.35, S.phaseT * .2) + ')'; x.fillRect(0, 0, W, H) }
	/* items */
	for (const it of IT.a) x.drawImage(it.spr, it.x - it.spr.w / 2, it.y - it.spr.h / 2, it.spr.w, it.spr.h);
	/* enemies */
	const rf = save.set.reduceFlash;
	for (const e of EN.a) {
		if (e.boss) { drawBoss(x, e); continue }
		const good = e.saved || e.clean > 0, spr = e.kind == 'bunny' ? (e.saved ? ART.bunny : ART.bunnyBad) : (good ? ART.enemyGood[e.kind] : ART.enemy[e.kind]);
		const wob = e.saved ? Math.sin(e.t * 14) * 3 : 0;
		if (!good && !rf && (S.frame + e.x | 0) % 23 == 0) x.globalAlpha = .6;
		x.drawImage(spr, e.x - spr.w / 2 + wob, e.y - spr.h / 2, spr.w, spr.h);
		x.globalAlpha = 1;
		if (!good && !rf) { x.fillStyle = 'rgba(176,77,255,.55)'; for (let i = 0; i < 3; i++) { const px = e.x + (ART.hash(e.t * 30 | 0, i) - .5) * e.r * 2.2, py = e.y + e.r * .6 + ART.hash(i, e.t * 20 | 0) * 8; x.fillRect(px, py, 2, 2) } }
		if (e.flash > 0 && !good) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = .4; x.drawImage(spr, e.x - spr.w / 2, e.y - spr.h / 2, spr.w, spr.h); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over' }
		if (e.kind == 'bunny' && !e.saved) { x.strokeStyle = 'rgba(255,154,240,' + (.4 + .3 * Math.sin(e.t * 6)) + ')'; x.lineWidth = 1.5; x.beginPath(); x.arc(e.x, e.y, e.r + 6, 0, 7); x.stroke() }
	}
	/* Rudolf's shots */
	for (const s of SH.a) { if (s.homing) x.drawImage(ART.homing, s.x - 5, s.y - 5, 10, 10); else { x.setTransform(Math.cos(s.ang + Math.PI / 2) * k, Math.sin(s.ang + Math.PI / 2) * k, -Math.sin(s.ang + Math.PI / 2) * k, Math.cos(s.ang + Math.PI / 2) * k, ox + s.x * k, oy + s.y * k); x.drawImage(ART.shot, -3, -9, 6, 18); x.setTransform(k, 0, 0, k, ox, oy) } }
	/* the beam */
	const P = S.P;
	if (S.beam > 0) {
		const a = Math.min(1, S.beam / .2), ny = P.y + ART.noseY;
		x.globalCompositeOperation = 'lighter';
		const g = x.createLinearGradient(S.beamX - 18, 0, S.beamX + 18, 0); g.addColorStop(0, 'rgba(255,60,60,0)'); g.addColorStop(.3, 'rgba(255,90,80,' + .6 * a + ')'); g.addColorStop(.5, 'rgba(255,255,240,' + a + ')'); g.addColorStop(.7, 'rgba(255,90,80,' + .6 * a + ')'); g.addColorStop(1, 'rgba(255,60,60,0)');
		x.fillStyle = g; x.fillRect(S.beamX - 18, 0, 36, ny); x.globalCompositeOperation = 'source-over';
	}
	/* Rudolf */
	if (!(P.inv > 0 && S.bombT <= 0 && Math.floor(P.inv * 12) % 2 && !rf)) {
		const nx = P.x, ny = P.y + ART.noseY, glowR = 14 + P.charge * 18 + (P.charge >= 1 ? Math.sin(S.totalT * 18) * 4 : 0);
		x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55 + P.charge * .45; x.drawImage(ART.noseGlow, nx - glowR, ny - glowR, glowR * 2, glowR * 2); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
		const blink = (S.totalT % 3.7) < .12, spr = P.cheer > 0 ? ART.rudolfCheer : blink ? ART.rudolfBlink : ART.rudolf;
		const tilt = Math.max(-.25, Math.min(.25, P.vx * .06)), sq = 1 + Math.abs(P.vx) * .015;
		x.setTransform(Math.cos(tilt) * k * sq, Math.sin(tilt) * k, -Math.sin(tilt) * k, Math.cos(tilt) * k / sq, ox + P.x * k, oy + (P.y + Math.sin(S.totalT * 5) * 1.5) * k);
		x.drawImage(spr, -spr.w / 2, -spr.h / 2, spr.w, spr.h); x.setTransform(k, 0, 0, k, ox, oy);
		if (P.focus) { x.fillStyle = '#fff'; x.beginPath(); x.arc(nx, ny, PR + 1.2, 0, 7); x.fill(); x.strokeStyle = '#ff3b4f'; x.lineWidth = 1.5; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(nx, ny, GR, 0, 7); x.stroke() }
	}
	/* enemy bullets: ones not yet moving are faint (a warning) */
	for (const b of EB.a) {
		const s = b.spr;
		if (b.delay > 0) x.globalAlpha = .35;
		if (b.type == 'rice' || b.spin) { const a = b.spin ? b.rot : b.ang, c = Math.cos(a) * k, si = Math.sin(a) * k; x.setTransform(c, si, -si, c, ox + b.x * k, oy + b.y * k); x.drawImage(s, -s.w / 2, -s.h / 2, s.w, s.h); x.setTransform(k, 0, 0, k, ox, oy) }
		else x.drawImage(s, b.x - s.w / 2, b.y - s.h / 2, s.w, s.h);
		if (b.delay > 0) x.globalAlpha = 1;
	}
	/* effects */
	for (const f of FX.a) {
		const a = 1 - f.t / f.life;
		if (f.txt) { x.globalAlpha = Math.min(1, a * 2); x.font = 'bold 14px system-ui,sans-serif'; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = 'rgba(30,10,40,.8)'; x.strokeText(f.txt, f.x, f.y); x.fillStyle = f.col; x.fillText(f.txt, f.x, f.y) }
		else { x.globalAlpha = a; x.fillStyle = f.col; x.fillRect(f.x - 1.5, f.y - 1.5, 3, 3) }
	}
	x.globalAlpha = 1;
	/* the Glow Burst */
	if (S.bombT > 0) {
		const r = (1.4 - S.bombT) / .8 * 560, a = Math.min(1, S.bombT);
		x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,214,120,' + a * .8 + ')'; x.lineWidth = 18; x.beginPath(); x.arc(P.x, P.y, r, 0, 7); x.stroke();
		x.strokeStyle = 'rgba(255,154,240,' + a * .5 + ')'; x.lineWidth = 8; x.beginPath(); x.arc(P.x, P.y, r * .8, 0, 7); x.stroke(); x.globalCompositeOperation = 'source-over';
	}
	if (S.flashT > 0) { x.fillStyle = 'rgba(255,240,220,' + S.flashT * 1.2 + ')'; x.fillRect(0, 0, W, H) }
	hud(x);
	x.restore();
	frameMs = frameMs * .9 + (performance.now() - t0) * .1;
}
function drawBoss(x, e) {
	const d = e.def, spr = e.restored ? d.good : d.art, sw = spr.w, sh = spr.h, bob = Math.sin(e.t * 2) * 3;
	if (!e.restored && !save.set.reduceFlash) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = .5; x.drawImage(ART.purpleGlow, e.x - sw * .8, e.y - sh * .7, sw * 1.6, sh * 1.4); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over' }
	if (d.rotate && !e.restored) { const k = view.scale * view.dpr, a = e.t * d.rotate, c = Math.cos(a) * k, s = Math.sin(a) * k; x.setTransform(c, s, -s, c, view.ox * view.dpr + e.x * k, view.oy * view.dpr + (e.y + bob) * k); x.drawImage(spr, -sw / 2, -sh / 2, sw, sh); x.setTransform(k, 0, 0, k, view.ox * view.dpr, view.oy * view.dpr) }
	else x.drawImage(spr, e.x - sw / 2, e.y - sh / 2 + bob, sw, sh);
	if (d.overlay) d.overlay(x, e, bob);
	if (e.flash > 0 && !e.restored) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = .25; x.drawImage(ART.whiteGlow, e.x - e.r, e.y - e.r, e.r * 2, e.r * 2); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over' }
}
function hud(x) {
	const P = S.P;
	x.fillStyle = 'rgba(10,14,40,.55)'; x.fillRect(0, 0, W, 34);
	x.font = 'bold 13px system-ui,sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
	x.fillText(S.score.toLocaleString(), 8, 11);
	x.font = '10px system-ui,sans-serif'; x.fillStyle = '#bcd0ff';
	const hi = Math.max((S.mode == 'attack' ? save.hiA : save.hi)[S.diff] || 0, S.score);
	x.fillText('Best ' + hi.toLocaleString() + (S.mode == 'practice' ? ' · Practice' : S.mode == 'replay' ? ' · Replay' : ''), 8, 25);
	/* lives and Glow Bursts */
	x.textAlign = 'right';
	if (S.mode == 'practice') { x.fillStyle = '#ffb3c8'; x.font = 'bold 12px system-ui,sans-serif'; x.fillText('♥ ∞', W - 8, 11) }
	else for (let i = 0; i < Math.min(S.lives, 8); i++) x.drawImage(ART.item.life, W - 18 - i * 14, 3, 13, 13);
	for (let i = 0; i < S.bombs; i++) x.drawImage(ART.item.bomb, W - 18 - i * 14, 18, 13, 13);
	/* the glow level and graze meter */
	const L = level(); x.textAlign = 'left'; x.font = '10px system-ui,sans-serif'; x.fillStyle = '#ffd2c8'; x.fillText('Glow ' + (L == 3 ? 'MAX' : L + 1), 150, 11);
	x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(150, 21, 70, 5); x.fillStyle = '#ffd36e'; x.fillRect(150, 21, 70 * S.gmeter / 120, 5);
	x.fillStyle = '#d8e4ff'; x.fillText('Graze ' + S.graze, 226, 24);
	/* the boss's strength */
	const b = S.boss;
	if (b && !b.restored && b.enterT <= 0) {
		x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(8, 40, W - 16, 6); x.fillStyle = '#c04dff'; x.fillRect(8, 40, (W - 16) * Math.max(0, b.hp / b.hp0), 6);
		x.font = '10px system-ui,sans-serif'; x.fillStyle = '#efdcff'; x.textAlign = 'left'; x.fillText(b.def.name + ' · ' + (b.def.phases.length - b.pi) + ' left', 8, 55);
		x.textAlign = 'right'; x.fillText(Math.ceil(b.def.phases[b.pi].time - b.pt) + ' s', W - 8, 55);
	}
	/* banners */
	const bn = S.banner;
	if (bn && bn.t < 3) {
		bn.t += 1 / 60; const a = Math.min(1, bn.t * 3, (3 - bn.t) * 2);
		x.globalAlpha = a; x.textAlign = 'center';
		if (bn.small) { x.fillStyle = 'rgba(30,10,50,.6)'; x.fillRect(0, 74, W, 38); x.font = 'bold 15px system-ui,sans-serif'; x.fillStyle = '#ffe6ff'; x.fillText('“' + bn.title + '”', W / 2, 88); x.font = '10px system-ui,sans-serif'; x.fillStyle = '#d7c2ff'; x.fillText(bn.sub, W / 2, 104) }
		else { x.font = 'bold 26px system-ui,sans-serif'; x.lineWidth = 4; x.strokeStyle = 'rgba(10,20,60,.8)'; x.strokeText(bn.title, W / 2, H * .38); x.fillStyle = '#fff6e0'; x.fillText(bn.title, W / 2, H * .38); x.font = '14px system-ui,sans-serif'; x.strokeText(bn.sub, W / 2, H * .38 + 28); x.fillStyle = '#cfe0ff'; x.fillText(bn.sub, W / 2, H * .38 + 28) }
		x.globalAlpha = 1;
	}
	if (S.phase == 'warn') { const a = .5 + .5 * Math.sin(S.phaseT * 8); x.globalAlpha = save.set.reduceFlash ? .9 : a; x.textAlign = 'center'; x.font = 'bold 28px system-ui,sans-serif'; x.fillStyle = '#ff9af0'; x.fillText('Something stirs…', W / 2, H * .42); x.globalAlpha = 1 }
	if (S.phase == 'clear') { x.textAlign = 'center'; x.font = 'bold 24px system-ui,sans-serif'; x.fillStyle = '#fff6e0'; x.fillText('Stage clear!', W / 2, H * .5); x.font = '13px system-ui,sans-serif'; x.fillStyle = '#d8e4ff'; x.fillText('Stage score ' + (S.score - S.stageScore0).toLocaleString(), W / 2, H * .5 + 24) }
}
function drawTitle(x) {
	const t = titleT;
	x.fillStyle = 'rgba(8,14,40,.35)'; x.fillRect(0, 0, W, H);
	x.textAlign = 'center'; x.textBaseline = 'middle';
	x.globalCompositeOperation = 'lighter'; x.globalAlpha = .6; x.drawImage(ART.warmGlow, W / 2 - 150, 60, 300, 120); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
	x.font = 'bold 44px system-ui,sans-serif'; x.lineWidth = 6; x.strokeStyle = '#1a2a6a'; x.strokeText('Night Flight', W / 2, 118); x.fillStyle = '#fff6e0'; x.fillText('Night Flight', W / 2, 118);
	x.font = '13px system-ui,sans-serif'; x.fillStyle = '#cfe0ff'; x.fillText('Rudolf and the glowing nose', W / 2, 152);
	const ry = 232 + Math.sin(t * 2) * 8, spr = (t % 4) < .12 ? ART.rudolfBlink : ART.rudolf;
	x.globalCompositeOperation = 'lighter'; x.globalAlpha = .7 + .3 * Math.sin(t * 3); x.drawImage(ART.noseGlow, W / 2 - 30, ry + ART.noseY * 2 - 30, 60, 60); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
	x.drawImage(spr, W / 2 - spr.w, ry - spr.h, spr.w * 2, spr.h * 2);
}

/* ---------- menus (HTML, so screen readers and the keyboard work; controllers move between buttons) ---------- */
function dialog(html, btns, cls) {
	$('#ovBody').innerHTML = html; const B = $('#ovBtns'); B.innerHTML = '';
	btns.forEach(([t, f, main, back]) => { const b = document.createElement('button'); b.textContent = t; if (main) b.className = 'main'; if (back) b.dataset.back = 1; b.onclick = () => { AU.sfx('ok'); closeDialog(); f && f() }; B.appendChild(b) });
	const ov = $('#ov'); ov.className = cls || ''; ov.hidden = false; (B.querySelector('.main') || B.firstChild).focus();
}
function closeDialog() { $('#ov').hidden = true }
const ovOpen = () => !$('#ov').hidden;
function menuNav() {
	const bs = [...document.querySelectorAll('#ov button')]; if (!bs.length) return;
	let i = bs.indexOf(document.activeElement);
	if (RG.pressed('up') || RG.pressed('left')) { (bs[i <= 0 ? bs.length - 1 : i - 1]).focus(); AU.sfx('select') }
	if (RG.pressed('down') || RG.pressed('right')) { (bs[(i + 1) % bs.length]).focus(); AU.sfx('select') }
	if (RG.pressed('ok') && i >= 0) bs[i].click();
	if (RG.pressed('back')) { const b = bs.find(b => b.dataset.back); b && b.click() }
}
function toTitle() {
	screen = 'title'; S = null; AU.play('title');
	const B = [['Story', () => pickDiff('story'), 1], ['Practice', menuPractice], ['Score Attack', () => pickDiff('attack')]];
	if (save.replay) B.push(['Watch your last flight', watchReplay]);
	B.push(['Options', menuOptions], ['How to play', () => help(toTitle)]);
	dialog('', B, 'title');
}
function pickDiff(mode) {
	const b = d => [DIFF[d].name + ((mode == 'attack' ? save.hiA : save.hi)[d] ? ' · best ' + (mode == 'attack' ? save.hiA : save.hi)[d].toLocaleString() : ''), () => { save.set.diff = d; persist(); begin(mode, d, 0) }, save.set.diff == d];
	dialog('<h2>' + (mode == 'attack' ? 'Score Attack' : 'Story') + '</h2><p>' + (mode == 'attack' ? 'Both stages, no continues: for the best score.' : 'Rudolf’s flight through the night. Three continues.') + '</p>', [b('easy'), b('normal'), b('hard'), ['Back', toTitle, 0, 1]], 'title');
}
function menuPractice() {
	const B = [];
	window.NFSTAGES.forEach((st, i) => { if (i < save.reached) B.push([(i + 1) + '. ' + st.name, () => begin('practice', save.set.diff, i), i == 0]) });
	B.push([(save.set.slow ? '✓ ' : '') + 'Slow motion', () => { save.set.slow = !save.set.slow; persist(); menuPractice() }], ['Back', toTitle, 0, 1]);
	dialog('<h2>Practice</h2><p>Any stage you have reached, with lives that never run out (' + DIFF[save.set.diff].name + ').</p>', B, 'title');
}
function menuOptions() {
	const s = save.set, on = v => v ? '✓ ' : '';
	dialog('<h2>Options</h2>', [
		[on(s.music) + 'Music', () => { s.music = !s.music; AU.setMusic(s.music); persist(); menuOptions() }, 1],
		[on(s.sfx) + 'Sounds', () => { s.sfx = !s.sfx; AU.sfxOn = s.sfx; persist(); menuOptions() }],
		[on(s.reduceFlash) + 'Reduce flashing', () => { s.reduceFlash = !s.reduceFlash; RG.reduceFlash = s.reduceFlash; persist(); menuOptions() }],
		['Keys…', menuKeys], ['Export save…', () => { RG.exportSave(); menuOptions() }],
		['Import save…', async () => { try { const d = await RG.importSave(); if (d && d.v == 1) { save = mergeSave(d); applySet(); dialog('<h2>Save imported</h2>', [['OK', menuOptions, 1]], 'title') } } catch (e) { dialog('<h2>Not imported</h2><p>' + String(e.message).replace(/</g, '&lt;') + '</p>', [['OK', menuOptions, 1]], 'title') } }],
		['Back', toTitle, 0, 1]], 'title');
}
const KEYNAME = c => c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'Right Shift').replace(/^pad:.*/, '');
function menuKeys() {
	const B = RG.bindings(), row = a => [a[0].toUpperCase() + a.slice(1) + ': ' + B[a].map(KEYNAME).filter(Boolean).join(', '), () => waitKey(a)];
	dialog('<h2>Keys</h2><p>Choose an action, then press the key to add. Controllers: A fire, right trigger or bumper focus, B Glow Burst, Start pause.</p>', [row('fire'), row('focus'), row('bomb'), row('pause'), ['Reset', () => { save.set.binds = null; bindDefault(); persist(); menuKeys() }], ['Back', menuOptions, 1, 1]], 'title');
}
function waitKey(a) {
	dialog('<h2>Press a key for ' + a + '</h2><p>Esc to stop.</p>', [['Cancel', menuKeys, 1, 1]], 'title');
	const f = e => { e.preventDefault(); e.stopPropagation(); removeEventListener('keydown', f, true); if (e.code != 'Escape') { RG.rebind(a, e.code); save.set.binds = RG.bindings(); persist() } menuKeys() };
	addEventListener('keydown', f, true);
}
function help(back) {
	dialog('<h2>How to play</h2><p><b>Move:</b> arrows or WASD; a controller’s stick; or drag a finger anywhere (Rudolf moves with it, not under it).</p>' +
		'<p><b>Nose laser:</b> hold Z (A, or keep a finger down). Keep holding: the nose glows brighter, and when it pulses let go for a piercing <b>beam</b>.</p>' +
		'<p><b>Focus:</b> hold Shift (a trigger, or a second finger) to fly slowly. Only the white dot at Rudolf’s glowing nose can be hit.</p>' +
		'<p><b>Glow Burst:</b> X (B, or tap with two fingers) clears the bullets and turns enemies back to their colours for a moment.</p>' +
		'<p><b>Graze</b> bullets for points; a full meter gives a Glow Burst. Fly near the top to gather everything at once.</p>' +
		'<p><b>Save corrupted friends</b> (the snow bunnies with a pink ring) with the beam or a Glow Burst: extra Glow Bursts and lives.</p>', [['OK', back || null, 1, 1]], 'title');
}
function menuPause() {
	AU.hold(true);
	const resume = () => { RG.resume(); AU.hold(false) };
	const B = [['Carry on', resume, 1, 1]];
	if (S && S.mode == 'practice') B.push(['Restart stage', () => { AU.hold(false); RG.resume(); begin('practice', S.diff, S.stage) }]);
	B.push(['Options', () => { AU.hold(false); pauseOptions() }], ['Quit to title', () => { AU.hold(false); RG.resume(); if (S && S.mode != 'replay' && S.mode != 'practice') keepReplay(); toTitle() }]);
	dialog('<h2>Paused</h2><p>' + (S ? 'Score ' + S.score.toLocaleString() : '') + '</p>', B);
}
function pauseOptions() {
	const s = save.set, on = v => v ? '✓ ' : '';
	dialog('<h2>Options</h2>', [[on(s.music) + 'Music', () => { s.music = !s.music; AU.setMusic(s.music); persist(); pauseOptions() }], [on(s.sfx) + 'Sounds', () => { s.sfx = !s.sfx; AU.sfxOn = s.sfx; persist(); pauseOptions() }],
		[on(s.reduceFlash) + 'Reduce flashing', () => { s.reduceFlash = !s.reduceFlash; RG.reduceFlash = s.reduceFlash; persist(); pauseOptions() }], ['Back', menuPause, 1, 1]]);
}
function menuContinue() {
	screen = 'continue';
	dialog('<h2>Continue?</h2><p>Your score starts again from 0 (' + (3 - S.continues) + ' continues left).</p>', [['Continue', () => { S.continues++; S.recOn = false; S.score = S.continues; S.lives = S.D.lives; S.bombs = S.D.bombs; S.over = false; S.P.inv = 3; screen = 'play' }, 1], ['Give up', () => endRun(false), 0, 1]]);
}
function begin(mode, diff, stage, o) { closeDialog(); AU.unlock(); newRun(mode, diff, stage, o); screen = 'play'; cv.focus() }
function watchReplay() {
	const r = save.replay; if (!r) return toTitle();
	let rec; try { rec = decodeRec(r.data) } catch (e) { return dialog('<h2>The replay could not be read</h2>', [['OK', toTitle, 1]]) }
	begin('replay', r.diff, 0, {seed: r.seed, replay: rec});
}

/* ---------- saves ---------- */
let saveT = 0;
function persist() { clearTimeout(saveT); saveT = setTimeout(() => RG.save(save).catch(() => {}), 200) }
function mergeSave(d) { const b = JSON.parse(JSON.stringify(save)); return Object.assign(b, d, {hi: Object.assign({}, d.hi), hiA: Object.assign({}, d.hiA), set: Object.assign(b.set, d.set || {})}) }
function bindDefault() {
	RG.bind({left: ['ArrowLeft', 'KeyA', 'pad:14', 'pad:axis0-'], right: ['ArrowRight', 'KeyD', 'pad:15', 'pad:axis0+'], up: ['ArrowUp', 'KeyW', 'pad:12', 'pad:axis1-'], down: ['ArrowDown', 'KeyS', 'pad:13', 'pad:axis1+'],
		fire: ['KeyZ', 'KeyJ', 'Space', 'pad:0'], focus: ['ShiftLeft', 'ShiftRight', 'pad:7', 'pad:5', 'pad:6', 'pad:4'], bomb: ['KeyX', 'KeyK', 'pad:1'], pause: ['Escape', 'KeyP', 'pad:9'],
		ok: ['KeyZ', 'KeyJ', 'pad:0'], back: ['KeyX', 'KeyK', 'Backspace', 'pad:1']});
}
function applySet() {
	const s = save.set; AU.musicOn = s.music !== false; AU.sfxOn = s.sfx !== false; if (typeof s.reduceFlash == 'boolean') RG.reduceFlash = s.reduceFlash; else s.reduceFlash = !!RG.reduceFlash;
	bindDefault(); if (s.binds) for (const a in s.binds) if (Array.isArray(s.binds[a])) { RG.bindings()[a] = s.binds[a]; s.binds[a].forEach(c => RG.rebind(a, c)) }
}

/* ---------- the loop ---------- */
function update() {
	titleT += DT;
	if (ovOpen()) { menuNav(); return }
	if (screen != 'play' || !S) return;
	if (RG.paused) return;
	if (RG.pressed('pause')) { RG.pause(); return }
	const n = S.slow ? ((S.slowAcc += .6) >= 1 ? (S.slowAcc -= 1, 1) : 0) : 1;
	for (let i = 0; i < n; i++) {
		if (S.over || S.ended) break;
		let I;
		if (S.mode == 'replay') { I = S.replay[S.rp++]; if (!I) { S.ended = true; endRun(false); break } if (RG.pressed('bomb') || RG.pressed('back')) { toTitle(); return } }
		else I = liveIntent();
		step(I);
	}
	if (S && S.flashT > 0) S.flashT -= DT;
	fxStep(DT);
}
async function start() {
	await RG.init('night-flight');
	const s = await RG.load(); if (s && s.v == 1) save = mergeSave(s);
	applySet();
	view = RG.fit(cv, () => ({w: W, h: H}));
	pointerSetup();
	RG.onPause(() => { if (screen == 'play' && S && !ovOpen()) menuPause() });
	RG.on('settings', () => { save.set.reduceFlash = RG.reduceFlash });
	addEventListener('pointerdown', () => AU.unlock(), {once: true}); addEventListener('keydown', () => AU.unlock(), {once: true});
	toTitle();
	if (!save.seenHelp) { save.seenHelp = 1; persist(); help(toTitle) }
	RG.loop(update, draw, {whilePaused: true});
	/* for the tests: run steps without drawing, with a bot's or a replay's input */
	window.__nf = {
		get S() { return S }, save: () => save, begin, toTitle, step, liveIntent, pack, encodeRec, decodeRec, frameMs: () => frameMs, pools: () => ({eb: EB.a.length, en: EN.a.length, sh: SH.a.length}), draw,
		run(n, bot) { for (let i = 0; i < n && S && !S.over && !S.ended; i++) { let I; if (S.mode == 'replay') { I = S.replay[S.rp++]; if (!I) break } else I = bot ? bot(S, i) : pack(0, 0, true, false, false); step(I) } return S && {score: S.score, frame: S.frame, stage: S.stage, phase: S.phase, lives: S.lives, x: S.P.x, y: S.P.y, eb: EB.a.length, graze: S.graze} }};
}
start();
})();
