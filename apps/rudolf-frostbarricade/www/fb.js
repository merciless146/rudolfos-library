/* ===== Frost Barricade: hold the barricade for fifteen nights (for older players: a darker game of the Rudolf OS
   Library, docs/plan-games.md). An original game: the corrupted elves come out of the woods each night; aim and shoot
   (point and click, keys, a controller or touch); by day spend twelve hours on repairs, searching for weapons, ammo and
   survivors, and training. On the fifteenth night Captain Quill's sleigh comes for everyone who held the line.
   Uses the game kit (gamekit.js) and the art (fbart.js). GPL-2.0-or-later. ===== */
(function () {
'use strict';
const W = 640, H = 360, DT = 1 / 60, PI = Math.PI, LAST = 15, SLEIGH_AT = 150;
const $ = s => document.querySelector(s), A = window.FBART, cv = $('#cv');
const DIFF = {easy: {name: 'Easy', count: .75, hp: .8, dmg: .65}, normal: {name: 'Normal', count: 1, hp: 1, dmg: 1}, hard: {name: 'Hard', count: 1.25, hp: 1.2, dmg: 1.3}};
/* the weapons: each better than the last, or with a way of its own */
const WEP = {
	icicle: {name: 'Icicle Pistol', dmg: 14, rps: 4, mag: 10, reload: 1.1, spread: .02, mode: 'semi', inf: true, night: 0, desc: 'Reliable, and never runs out of shots.'},
	cane: {name: 'Candy-Cane Carbine', dmg: 17, rps: 10, mag: 24, reload: 1.6, spread: .018, mode: 'burst', find: 48, night: 1, desc: 'Three-shot bursts, very steady.'},
	flurry: {name: 'Flurry SMG', dmg: 9, rps: 13, mag: 40, reload: 1.8, spread: .06, mode: 'auto', find: 120, night: 2, fx: 'chill', desc: 'Fully automatic; its frost can slow them.'},
	snowplow: {name: 'Snowplow Shotgun', dmg: 11, pellets: 7, rps: 1.3, mag: 6, reload: 2.4, spread: .16, mode: 'semi', find: 18, night: 3, fx: 'knock', desc: 'Seven pellets that push them back.'},
	hail: {name: 'Hailstorm Rifle', dmg: 70, rps: 1.4, mag: 5, reload: 2.2, spread: .004, mode: 'semi', find: 15, night: 5, pierce: 3, desc: 'Goes through three of them.'},
	bauble: {name: 'Ornament Launcher', dmg: 80, rps: .9, mag: 4, reload: 2.8, spread: .03, mode: 'semi', find: 8, night: 7, fx: 'boom', desc: 'Bursting baubles: everything nearby is caught.'},
	hearth: {name: 'Hearthfire Thrower', dmg: 6, rps: 20, mag: 80, reload: 3, spread: 0, mode: 'auto', find: 160, night: 9, fx: 'fire', desc: 'A short reach of fire; they keep burning.'},
	aurora: {name: 'Aurora Lance', dmg: 150, rps: .7, mag: 3, reload: 3, spread: 0, mode: 'semi', find: 9, night: 11, pierce: 99, fx: 'stun', desc: 'A beam of northern light through the whole line; it stuns.'},
	bells: {name: 'Sleigh-Bell Gatling', dmg: 15, rps: 18, mag: 150, reload: 4, spread: .05, mode: 'auto', find: 300, night: 13, fx: 'spin', desc: 'Winds up, then does not stop.'}};
const ORDER = Object.keys(WEP);
const ELF = {
	shambler: {hp: 44, sp: 22, dps: 7, from: 1, w: 10},
	runner: {hp: 30, sp: 58, dps: 5, from: 2, w: 6},
	crawler: {hp: 34, sp: 30, dps: 6, from: 4, w: 4},
	tinker: {hp: 48, sp: 27, dps: 0, from: 5, w: 3},
	spitter: {hp: 55, sp: 20, dps: 0, from: 6, w: 3},
	brute: {hp: 260, sp: 14, dps: 20, from: 7, w: 2},
	foreman: {hp: 1600, sp: 9, dps: 45, from: 99, w: 0}};
const NAMES = ['Juniper', 'Bramble', 'Clove', 'Sorrel', 'Thistle', 'Hazel', 'Rowan', 'Fennel', 'Wren', 'Birch', 'Moss', 'Sleet'];
const KINDS = ['bunny', 'badger', 'fox', 'hare', 'otter', 'owl'];
const ROLES = {guard: 'Guard (shoots from the barricade)', repair: 'Repairs (+50 to the barricade a day)', scout: 'Scouts (an extra hour of searching)'};

let save = {v: 1, set: {diff: 'normal', music: true, sfx: true, reduceFlash: false, assist: false}, run: null, best: 0, wins: 0, seenHelp: 0, stats: {kills: 0, heads: 0}};
let G = null, N = null, view = null, screen = 'title', T = 0, fireHeld = false, firePressed = false;
const cross = {x: 420, y: 250};
const R = () => N.rng();

/* ---------- a run ---------- */
function newRun(diff) {
	const wp = {}; ORDER.forEach(k => wp[k] = {have: k == 'icicle', mag: WEP[k].mag, res: k == 'icicle' ? 0 : 0});
	G = {diff, night: 1, seed: String(Date.now()) + ':' + Math.floor(Math.random() * 1e9), bar: 1000, barMax: 1000, hp: 100, wp, cur: 'icicle', skill: 0, surv: [], kills: 0, heads: 0, shots: 0, hits: 0, letter: false};
}
const snapshot = () => JSON.parse(JSON.stringify(G));

/* ---------- the night ---------- */
function startNight() {
	const D = DIFF[G.diff], n = G.night;
	N = {t: 0, rng: RG.rng(G.seed + ':night:' + n), elves: [], slush: [], fx: [], spits: [], q: [], over: false, won: false, id: 0, barHit: 0, hurt: 0, recoil: 0, cd: 0, burst: 0, spin: 0, reload: 0, msg: null, sleigh: null, dawn: 0, beam: 0, flame: 0};
	const kinds = Object.keys(ELF).filter(k => ELF[k].from <= n), tw = kinds.reduce((a, k) => a + ELF[k].w, 0);
	const total = n == LAST ? 9999 : Math.round((14 + n * 6) * D.count), len = 38 + n * 4;
	if (n < LAST) for (let i = 0; i < total; i++) { let r = R() * tw, k = kinds[0]; for (const kk of kinds) { r -= ELF[kk].w; if (r <= 0) { k = kk; break } } N.q.push([2 + (i / total) * len + R() * 2, k]) }
	if (n == 10) N.q.push([len * .6, 'foreman']);
	if (n == LAST) N.q.push([60, 'foreman'], [110, 'foreman']);
	N.q.sort((a, b) => a[0] - b[0]);
	N.total = N.q.length;
	screen = 'night'; bar(); AU.music('night');
	N.msg = {t: 0, text: 'Night ' + n + (n == LAST ? ' · the last' : ''), sub: n == LAST ? 'Hold on until the sleigh comes.' : n == 1 ? 'They are coming out of the woods.' : ''};
}
function spawn(kind) {
	const D = DIFF[G.diff], E = ELF[kind], mul = (1 + (G.night - 1) * .07) * D.hp;
	const e = {id: ++N.id, kind, x: W + 20 + R() * 30, lane: Math.round((R() - .5) * 8), hp: E.hp * mul, hp0: E.hp * mul, sp: E.sp * (.85 + R() * .3), walk: R() * 6, attacking: false, chill: 0, burn: 0, stun: 0, hitT: 0, spitT: 1 + R() * 2, stop: kind == 'spitter' ? 280 + R() * 120 : 0};
	N.elves.push(e);
	if (R() < .25) AU.sfx('groan');
}
function nightStep() {
	const D = DIFF[G.diff]; N.t += DT;
	while (N.q.length && N.q[0][0] <= N.t) spawn(N.q.shift()[1]);
	if (G.night == LAST && !N.sleigh) { if (N.t < SLEIGH_AT - 2) { if (Math.floor(N.t * 10) % Math.max(3, 14 - Math.floor(N.t / 12)) == 0 && N.elves.length < 34) { const ks = ['shambler', 'shambler', 'runner', 'crawler', 'tinker', 'spitter', 'brute']; spawn(ks[Math.floor(R() * ks.length)]) } } else if (N.t >= SLEIGH_AT) startRescue() }
	/* the weapon */
	weaponStep();
	/* elves */
	const front = A.BX + 58;
	for (const e of N.elves) {
		if (e.hitT > 0) e.hitT -= DT; if (e.chill > 0) e.chill -= DT; if (e.stun > 0) e.stun -= DT;
		if (e.burn > 0) { e.burn -= DT; damage(e, 9 * DT, false, true) }
		if (e.dead) continue;
		const sp = e.sp * (e.chill > 0 ? .45 : 1) * (e.stun > 0 ? 0 : 1);
		if (e.kind == 'spitter' && e.x <= e.stop) {
			e.attacking = false; e.spitT -= DT;
			if (e.spitT <= 0 && e.stun <= 0) { e.spitT = 2.6 + R(); N.spits.push({x: e.x - 8, y: A.GROUND - 40, vx: -(e.x - front + 10) / 1.2, vy: -150, t: 0}); AU.sfx('spit') }
			continue;
		}
		const stopX = G.bar > 0 ? front + (e.lane + 4) * .8 : A.RX + 22;
		if (e.x > stopX) { e.x -= sp * DT; e.walk += sp * DT * .25; e.attacking = false }
		else {
			e.attacking = true; e.walk += DT * 4;
			if (e.kind == 'tinker') { explode(e.x, e.lane, 60, 40, e); if (G.bar > 0) hitBar(90 * D.dmg); else hurtRudolf(25 * D.dmg); continue }
			if (e.stun > 0) continue;
			if (G.bar > 0) hitBar(ELF[e.kind].dps * D.dmg * DT); else hurtRudolf(ELF[e.kind].dps * .5 * D.dmg * DT);
		}
	}
	/* spit arcs onto the barricade */
	for (const s of N.spits) { s.t += DT; s.x += s.vx * DT; s.vy += 260 * DT; s.y += s.vy * DT; if (s.y >= A.GROUND - 30 && s.x < front + 10) { s.done = true; if (G.bar > 0) hitBar(12 * D.dmg); else hurtRudolf(5 * D.dmg); burst(s.x, s.y, 8, '#b04dff') } }
	N.spits = N.spits.filter(s => !s.done && s.t < 4);
	N.elves = N.elves.filter(e => !e.dead);
	/* survivors on guard */
	G.surv.forEach((s, i) => {
		if (s.role != 'guard') return; s.cd = (s.cd || 1 + i * .2) - DT; s.fire = Math.max(0, (s.fire || 0) - DT);
		if (s.cd <= 0) { const tg = N.elves.filter(e => e.x < W - 10).sort((a, b) => a.x - b.x)[0]; if (tg) { s.cd = 1.1; s.fire = .12; damage(tg, (8 + G.night * .6), false); N.fx.push({k: 'bolt', x0: 22 + i * 10 + 16, y0: A.GROUND - 22, x1: tg.x, y1: A.GROUND - 22 * ELF_S(tg), t: 0}); AU.sfx('bolt') } }
	});
	if (N.barHit > 0) N.barHit -= DT * 3; if (N.hurt > 0) N.hurt -= DT; if (N.recoil > 0) N.recoil = Math.max(0, N.recoil - DT * 8);
	fxStep();
	/* the end of the night */
	if (G.hp <= 0 && !N.over) { N.over = true; lose(); return }
	if (G.night < LAST && !N.q.length && !N.elves.length && !N.won) { N.won = true; N.wonT = 0 }
	if (N.won) { N.wonT += DT; N.dawn = Math.min(.6, N.wonT / 4); if (N.wonT > 3 && !N.over) { N.over = true; dawn() } }
	if (N.sleigh) rescueStep();
}
const ELF_S = e => A.ELF[e.kind].s;
function hitBar(d) { G.bar = Math.max(0, G.bar - d); N.barHit = 1; if (Math.random() < .08) AU.sfx('thud') }
function hurtRudolf(d) { G.hp = Math.max(0, G.hp - d); N.hurt = .4; if (Math.random() < .1) AU.sfx('hurt') }
function damage(e, d, head, quiet) {
	if (e.dead) return;
	e.hp -= d; if (!quiet) e.hitT = .08;
	if (e.hp <= 0) {
		e.dead = true; G.kills++; save.stats.kills++; if (head) { G.heads++; save.stats.heads++ }
		N.slush.push({x: e.x, r: 14 * ELF_S(e), t: 0, id: e.id});
		burst(e.x, A.GROUND - 20 * ELF_S(e), 16, '#140a1c'); burst(e.x, A.GROUND - 20 * ELF_S(e), 10, '#b04dff');
		if (e.kind == 'tinker') explode(e.x, e.lane, 70, 70, e);
		AU.sfx(e.kind == 'foreman' || e.kind == 'brute' ? 'fallbig' : 'fall');
	}
}
function explode(x, lane, r, dmg, src) {
	if (src) src.dead = true;
	burst(x, A.GROUND - 18, 26, '#ffb03b'); burst(x, A.GROUND - 18, 18, '#d6ff4a'); N.fx.push({k: 'ring', x, y: A.GROUND - 18, r, t: 0});
	for (const e of N.elves) if (!e.dead && e !== src && Math.abs(e.x - x) < r) damage(e, dmg * (1 - Math.abs(e.x - x) / r * .5), false);
	AU.sfx('boom'); if (!save.set.reduceFlash) N.shake = .25;
}

/* ---------- shooting ---------- */
const shoulder = () => ({x: A.RX + 4, y: A.RY + 16});
function aimAngle() { const s = shoulder(); return Math.max(-.9, Math.min(.55, Math.atan2(cross.y - s.y, cross.x - s.x))) }
function weaponStep() {
	const w = WEP[G.cur], st = G.wp[G.cur];
	if (N.cd > 0) N.cd -= DT;
	if (N.reload > 0) { N.reload -= DT; if (N.reload <= 0) { const need = w.mag - st.mag, got = w.inf ? need : Math.min(need, st.res); st.mag += got; if (!w.inf) st.res -= got; AU.sfx('ready') } return }
	if (st.mag <= 0) { if (w.inf || st.res > 0) startReload(); firePressed = false; return }
	if (w.mode == 'auto') {
		if (w.fx == 'spin') N.spin = fireHeld ? Math.min(1, N.spin + DT) : Math.max(0, N.spin - DT * 2);
		const rps = w.fx == 'spin' ? 3 + w.rps * N.spin : w.rps;
		if (fireHeld && N.cd <= 0) { fire(w, st); N.cd += 1 / rps; if (N.cd < 0) N.cd = 0 }
		if (!fireHeld && N.cd < 0) N.cd = 0;
	} else if (w.mode == 'burst') {
		if (firePressed && N.cd <= 0 && N.burst <= 0) N.burst = 3;
		if (N.burst > 0 && N.cd <= 0 && st.mag > 0) { fire(w, st); N.burst--; N.cd = N.burst ? .07 : .32 }
	} else if (firePressed && N.cd <= 0) { fire(w, st); N.cd = 1 / w.rps }
	firePressed = false;
}
function startReload() { const w = WEP[G.cur], st = G.wp[G.cur]; if (N.reload > 0 || st.mag >= w.mag || (!w.inf && st.res <= 0)) return; N.reload = w.reload * (1 - G.skill * .01); AU.sfx('reload') }
function fire(w, st) {
	st.mag--; G.shots++; N.recoil = 1;
	const s = shoulder(), a0 = aimAngle(), m = A.MUZZLE[G.cur] || 30, mx = s.x + Math.cos(a0) * m, my = s.y + Math.sin(a0) * m;
	if (!save.set.reduceFlash) N.fx.push({k: 'flash', x: mx, y: my, t: 0});
	AU.sfx(G.cur);
	if (w.fx == 'fire') { flame(w, mx, my, a0); return }
	const pel = w.pellets || 1, spr = w.spread * (1 - G.skill * .015);
	let hitAny = false;
	for (let p = 0; p < pel; p++) {
		let a = a0 + (R() - .5) * 2 * spr;
		/* aim assist: the nearest head close to the crosshair */
		if (save.set.assist && pel == 1) { const h = nearestHead(cross.x, cross.y, 20); if (h) a = Math.atan2(h.y - my, h.x - mx) }
		const dx = Math.cos(a), dy = Math.sin(a), hits = rayHits(mx, my, dx, dy);
		const take = w.pierce ? Math.min(hits.length, w.pierce) : Math.min(1, hits.length);
		let endT = 700;
		for (let i = 0; i < take; i++) {
			const h = hits[i]; hitAny = true; endT = h.t;
			if (w.fx == 'boom') { explode(mx + dx * h.t, h.e.lane, 60, w.dmg, null); break }
			damage(h.e, w.dmg * (h.head ? 2.5 : 1), h.head);
			if (h.head) N.fx.push({k: 'txt', x: h.e.x, y: A.GROUND - 50 * ELF_S(h.e), s: 'eyes!', t: 0});
			if (w.fx == 'chill' && R() < .3) h.e.chill = 2;
			if (w.fx == 'knock') h.e.x += 7;
			if (w.fx == 'stun') h.e.stun = .9;
		}
		if (w.fx == 'boom' && !take) { const gy = A.GROUND - 10; const t = dy > 0 ? (gy - my) / dy : 700; explode(mx + dx * Math.min(t, 700), 0, 50, w.dmg, null); endT = t }
		N.fx.push({k: w.fx == 'stun' ? 'beam' : 'tracer', x0: mx, y0: my, x1: mx + dx * Math.min(endT, 700), y1: my + dy * Math.min(endT, 700), t: 0, c: G.cur});
	}
	if (hitAny) G.hits++;
}
function flame(w, mx, my, a0) {
	N.flame = .1; let hit = false;
	for (const e of N.elves) { if (e.dead) continue; const b = bodyOf(e), dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy); if (d < 210 && Math.abs(Math.atan2(dy, dx) - a0) < .24) { damage(e, w.dmg, false, true); e.burn = 2.2; e.hitT = .05; hit = true } }
	for (let i = 0; i < 2; i++) N.fx.push({k: 'fire', x: mx, y: my, vx: Math.cos(a0 + (Math.random() - .5) * .3) * (260 + Math.random() * 80), vy: Math.sin(a0 + (Math.random() - .5) * .3) * 280, t: 0});
	if (hit) G.hits++;
}
function headOf(e) { const s = ELF_S(e), h = A.elfHead(e.kind, s); return {x: e.x + h.dx, y: A.GROUND - 4 + e.lane + h.dy, r: h.r + 1} }
function bodyOf(e) { const s = ELF_S(e), b = A.elfBody(e.kind, s); return {x: e.x + b.dx, y: A.GROUND - 4 + e.lane + b.dy, r: b.r} }
function rayCircle(ox, oy, dx, dy, c) { const fx = ox - c.x, fy = oy - c.y, b = fx * dx + fy * dy, cc = fx * fx + fy * fy - c.r * c.r, disc = b * b - cc; if (disc < 0) return -1; const t = -b - Math.sqrt(disc); return t > 0 ? t : -1 }
function rayHits(ox, oy, dx, dy) {
	const out = [];
	for (const e of N.elves) { if (e.dead) continue; const th = rayCircle(ox, oy, dx, dy, headOf(e)), tb = rayCircle(ox, oy, dx, dy, bodyOf(e)); if (th > 0 && (tb < 0 || th <= tb + 4)) out.push({e, t: th, head: true}); else if (tb > 0) out.push({e, t: tb, head: false}) }
	return out.sort((a, b) => a.t - b.t);
}
function nearestHead(x, y, r) { let best = null, bd = r * r; for (const e of N.elves) { if (e.dead) continue; const h = headOf(e), d = (h.x - x) ** 2 + (h.y - y) ** 2; if (d < bd) { bd = d; best = h } } return best }

/* ---------- effects ---------- */
function burst(x, y, n, col) { for (let i = 0; i < n && N.fx.length < 600; i++) { const a = Math.random() * PI * 2, v = 30 + Math.random() * 120; N.fx.push({k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, col, life: .5 + Math.random() * .6}) } }
function fxStep() {
	for (const f of N.fx) { f.t += DT; if (f.k == 'p') { f.x += f.vx * DT; f.y += f.vy * DT; f.vy += 300 * DT; if (f.y > A.GROUND) { f.y = A.GROUND; f.vy *= -.2; f.vx *= .5 } } else if (f.k == 'fire') { f.x += f.vx * DT; f.y += f.vy * DT; f.vy -= 120 * DT } }
	N.fx = N.fx.filter(f => f.t < (f.k == 'p' ? f.life : f.k == 'txt' ? .9 : f.k == 'ring' ? .4 : f.k == 'fire' ? .55 : f.k == 'beam' ? .3 : .12));
	for (const s of N.slush) s.t += DT; N.slush = N.slush.filter(s => s.t < 6);
	if (N.shake > 0) N.shake -= DT;
}

/* ---------- the rescue (Night 15) ---------- */
function startRescue() { N.sleigh = {t: 0, x: W + 80, y: 40, phase: 'in'}; AU.music('rescue'); AU.sfx('jingle'); N.msg = {t: 0, text: 'Bells in the sky…', sub: ''} }
function rescueStep() {
	const S = N.sleigh; S.t += DT;
	if (S.phase == 'in') { S.x += (210 - S.x) * 1.4 * DT; S.y += (175 - S.y) * 1.4 * DT; if (S.t > 3.5) { S.phase = 'light'; S.t = 0; for (const e of N.elves) { e.dead = true; burst(e.x, A.GROUND - 20, 14, '#ffd36e'); burst(e.x, A.GROUND - 20, 8, '#140a1c') } N.elves = []; N.q = []; N.fx.push({k: 'ring', x: S.x, y: S.y, r: 700, t: 0, slow: true}); AU.sfx('light') } }
	else if (S.phase == 'light') { N.dawn = Math.min(.35, S.t / 3); if (S.t > 1.2 && !S.said) { S.said = true; N.say = {t: 0, who: 'Captain Quill', text: 'Easy now — there’s room for every one of you. Climb aboard!'} } if (S.t > 5.5) { S.phase = 'board'; S.t = 0 } }
	else if (S.phase == 'board') { S.board = Math.min(1, S.t / 2); if (S.t > 2.6) { S.phase = 'away'; S.t = 0; N.say = {t: 0, who: 'Rudolf', text: 'We held the line. Every night of it.'} } }
	else if (S.phase == 'away') { S.x -= 70 * DT; S.y -= 34 * DT; N.dawn = Math.min(1, .35 + S.t / 6); if (S.t > 6 && !N.over) { N.over = true; ending() } }
}

/* ---------- drawing ---------- */
function draw() {
	if (!view) return;
	const x = view.begin(); x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
	const rf = save.set.reduceFlash;
	if (screen == 'title' || !N) { A.scene(x, W, H, T, 0, 0); A.barricade(x, 1, T, 0); A.rudolf(x, -.15, 'icicle', T, 0, 0); for (let i = 0; i < 3; i++) A.survivor(x, KINDS[i], 22 + i * 14, T, false); fakeHorde(x); A.snow(x, W, H, T); titleText(x); x.restore(); return }
	if (N.shake > 0 && !rf) x.translate((Math.random() - .5) * 6, (Math.random() - .5) * 3);
	A.scene(x, W, H, T, G.night, N.dawn);
	for (const s of N.slush) A.slush(x, s, T);
	/* elves, far ones first */
	const es = N.elves.slice().sort((a, b) => a.lane - b.lane);
	for (const e of es) A.elf(x, e, T, rf);
	for (const s of N.spits) { x.fillStyle = '#2a1036'; x.beginPath(); x.arc(s.x, s.y, 4, 0, 7); x.fill(); x.fillStyle = '#b04dff'; x.fillRect(s.x - 1, s.y - 1, 2, 2) }
	/* the survivors and Rudolf, then the barricade in front of them */
	const board = N.sleigh && N.sleigh.board || 0, away = N.sleigh && N.sleigh.phase == 'away';
	if (!away) {
		x.globalAlpha = 1 - board;
		G.surv.forEach((s, i) => A.survivor(x, s.kind, 22 + i * 10 - board * 10, T, s.fire > 0));
		A.rudolf(x, aimAngle(), G.cur, T, N.recoil, N.hurt);
		x.globalAlpha = 1;
	}
	A.barricade(x, G.bar / G.barMax, T, N.barHit);
	/* shots */
	for (const f of N.fx) {
		if (f.k == 'tracer') { x.strokeStyle = {icicle: 'rgba(190,232,255,.9)', cane: 'rgba(255,120,130,.9)', bauble: 'rgba(255,215,100,.9)', bells: 'rgba(255,230,140,.9)'}[f.c] || 'rgba(230,240,255,.8)'; x.lineWidth = f.c == 'hail' ? 2.4 : 1.4; x.globalAlpha = 1 - f.t / .12; x.beginPath(); x.moveTo(f.x0, f.y0); x.lineTo(f.x1, f.y1); x.stroke(); x.globalAlpha = 1 }
		else if (f.k == 'beam') { const a = 1 - f.t / .3; x.globalCompositeOperation = 'lighter'; x.strokeStyle = `rgba(125,255,207,${a})`; x.lineWidth = 10 * a + 2; x.beginPath(); x.moveTo(f.x0, f.y0); x.lineTo(f.x1, f.y1); x.stroke(); x.strokeStyle = `rgba(180,140,255,${a * .7})`; x.lineWidth = 18 * a; x.stroke(); x.globalCompositeOperation = 'source-over' }
		else if (f.k == 'bolt') { x.strokeStyle = 'rgba(255,230,180,.8)'; x.lineWidth = 1.2; const k = Math.min(1, f.t / .1); x.beginPath(); x.moveTo(f.x0 + (f.x1 - f.x0) * k * .8, f.y0 + (f.y1 - f.y0) * k * .8); x.lineTo(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k); x.stroke() }
		else if (f.k == 'flash') x.drawImage(G.cur == 'aurora' ? A.ice : A.warm, f.x - 12, f.y - 12, 24, 24);
		else if (f.k == 'fire') { x.globalAlpha = 1 - f.t / .55; x.drawImage(A.fire, f.x - 10 - f.t * 20, f.y - 10 - f.t * 20, 20 + f.t * 40, 20 + f.t * 40); x.globalAlpha = 1 }
		else if (f.k == 'p') { x.globalAlpha = 1 - f.t / f.life; x.fillStyle = f.col; x.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); x.globalAlpha = 1 }
		else if (f.k == 'ring') { const k = f.t / .4; x.strokeStyle = f.slow ? `rgba(255,214,140,${1 - k})` : `rgba(255,176,59,${1 - k})`; x.lineWidth = 4; x.beginPath(); x.arc(f.x, f.y, f.r * k, 0, 7); x.stroke() }
		else if (f.k == 'txt') { x.globalAlpha = 1 - f.t / .9; x.font = 'bold 10px system-ui,sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffe6a0'; x.fillText(f.s, f.x, f.y - f.t * 20); x.globalAlpha = 1 }
	}
	if (N.sleigh) A.sleigh(x, N.sleigh.x, N.sleigh.y, T, N.sleigh.phase == 'light');
	A.snow(x, W, H, T);
	if (N.hurt > 0 && !rf) { x.fillStyle = `rgba(120,0,40,${N.hurt * .4})`; x.fillRect(0, 0, W, H) }
	hud(x);
	/* the crosshair: its gap shows the spread */
	if (!N.sleigh) {
		const w = WEP[G.cur], gap = 5 + (w.spread * (1 - G.skill * .015) + (w.pellets ? .02 : 0)) * 200;
		x.strokeStyle = N.reload > 0 ? 'rgba(255,200,120,.9)' : 'rgba(255,255,255,.9)'; x.lineWidth = 1.5;
		x.beginPath(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { x.moveTo(cross.x + a * gap, cross.y + b * gap); x.lineTo(cross.x + a * (gap + 6), cross.y + b * (gap + 6)) } x.stroke();
		x.fillStyle = '#fff'; x.fillRect(cross.x - 1, cross.y - 1, 2, 2);
		if (N.reload > 0) { const k = 1 - N.reload / (w.reload * (1 - G.skill * .01)); x.strokeStyle = '#ffd36e'; x.lineWidth = 2; x.beginPath(); x.arc(cross.x, cross.y, gap + 10, -PI / 2, -PI / 2 + k * PI * 2); x.stroke() }
	}
	x.restore();
}
function hud(x) {
	x.fillStyle = 'rgba(5,6,14,.6)'; x.fillRect(0, 0, W, 28);
	x.font = 'bold 13px system-ui,sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#f1e9ff';
	x.fillText('Night ' + G.night + ' of ' + LAST, 8, 14);
	x.font = '11px system-ui,sans-serif'; x.fillStyle = '#c9c2dd';
	const left = G.night == LAST ? (N.sleigh ? 'The sleigh is here!' : 'The sleigh comes in ' + Math.max(0, Math.ceil(SLEIGH_AT - N.t)) + ' s') : (N.q.length + N.elves.length) + ' left';
	x.fillText(left, 104, 14);
	const bar = (X, label, v, max, col) => { x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(X, 9, 110, 10); x.fillStyle = col; x.fillRect(X, 9, 110 * Math.max(0, v / max), 10); x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(label, X - 4, 14); x.textAlign = 'left' };
	bar(310, 'Barricade', G.bar, G.barMax, G.bar / G.barMax < .3 ? '#e0603a' : '#b98a4a'); bar(500, 'Rudolf', G.hp, 100, '#ff6f91');
	/* the weapon */
	const w = WEP[G.cur], st = G.wp[G.cur];
	x.fillStyle = 'rgba(5,6,14,.55)'; x.fillRect(W - 200, H - 34, 196, 30);
	x.textAlign = 'left'; x.font = 'bold 12px system-ui,sans-serif'; x.fillStyle = '#fff'; x.fillText(w.name, W - 192, H - 25);
	x.font = '11px system-ui,sans-serif'; x.fillStyle = st.mag ? '#d8e4ff' : '#ff9f9f';
	x.fillText((N.reload > 0 ? 'Reloading… ' : '') + st.mag + ' / ' + w.mag + (w.inf ? '  ·  ∞' : '  ·  ' + st.res + ' more'), W - 192, H - 12);
	/* banners and words */
	if (N.msg && N.msg.t < 3.5) { N.msg.t += DT; const a = Math.min(1, N.msg.t * 2, (3.5 - N.msg.t) * 2); x.globalAlpha = a; x.textAlign = 'center'; x.font = 'bold 26px system-ui,sans-serif'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(N.msg.text, W / 2, 120); x.fillStyle = '#f4ecff'; x.fillText(N.msg.text, W / 2, 120); if (N.msg.sub) { x.font = '13px system-ui,sans-serif'; x.strokeText(N.msg.sub, W / 2, 146); x.fillStyle = '#d6ccf0'; x.fillText(N.msg.sub, W / 2, 146) } x.globalAlpha = 1 }
	if (N.say && N.say.t < 5) { N.say.t += DT; const a = Math.min(1, N.say.t * 3, (5 - N.say.t) * 2); x.globalAlpha = a; x.fillStyle = 'rgba(10,12,30,.8)'; x.fillRect(80, 52, W - 160, 44); x.textAlign = 'left'; x.font = 'bold 11px system-ui,sans-serif'; x.fillStyle = '#ffd36e'; x.fillText(N.say.who, 92, 64); x.font = '13px system-ui,sans-serif'; x.fillStyle = '#fff'; x.fillText(N.say.text, 92, 82); x.globalAlpha = 1 }
	if (N.won && G.night < LAST) { x.textAlign = 'center'; x.font = 'bold 24px system-ui,sans-serif'; x.fillStyle = '#ffe9c8'; x.fillText('The night is over', W / 2, 150) }
}
function fakeHorde(x) { for (let i = 0; i < 6; i++) { const e = {id: i + 1, kind: ['shambler', 'runner', 'shambler', 'brute', 'crawler', 'shambler'][i], x: 330 + i * 52 + Math.sin(T * .3 + i) * 6, lane: (i % 3) * 3 - 3, walk: T * 2 + i, chill: 0, burn: 0, hitT: 0}; A.elf(x, e, T, save.set.reduceFlash) } }
function titleText(x) {
	x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 40px system-ui,sans-serif'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.75)'; x.strokeText('Frost Barricade', W / 2, 64); x.fillStyle = '#f4ecff'; x.fillText('Frost Barricade', W / 2, 64);
	x.font = '13px system-ui,sans-serif'; x.fillStyle = '#c9c2dd'; x.strokeText('Fifteen nights. One barricade.', W / 2, 96); x.fillText('Fifteen nights. One barricade.', W / 2, 96);
}

/* ---------- sound (Web Audio; no files) ---------- */
const AU = (() => {
	let C = null, out, mus, noise, track = null, timer = 0;
	const on = () => { if (C) { if (C.state == 'suspended' && !held) C.resume().catch(() => {}); return C } try { C = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { return null } out = C.createGain(); out.gain.value = .5; out.connect(C.destination); mus = C.createGain(); mus.gain.value = .3; mus.connect(out); noise = C.createBuffer(1, C.sampleRate, C.sampleRate); const d = noise.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1 } return C };
	let held = false;
	const tone = (dst, t, f, d, type, g, f2) => { const o = C.createOscillator(), a = C.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); a.gain.setValueAtTime(.0001, t); a.gain.linearRampToValueAtTime(g, t + .005); a.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(a); a.connect(dst); o.start(t); o.stop(t + d + .02) };
	const nz = (dst, t, d, g, f, type) => { const s = C.createBufferSource(); s.buffer = noise; const fi = C.createBiquadFilter(); fi.type = type || 'lowpass'; fi.frequency.value = f; const a = C.createGain(); a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(fi); fi.connect(a); a.connect(dst); s.start(t, Math.random() * .5); s.stop(t + d + .02) };
	const last = {};
	function sfx(k) {
		if (!save.set.sfx || !on() || held) return; const t = C.currentTime, now = performance.now();
		const gap = {fall: 40, thud: 120, hurt: 200, groan: 300, bolt: 60, flurry: 50, bells: 40, hearth: 90}[k] || 0; if (gap && now - (last[k] || 0) < gap) return; last[k] = now;
		switch (k) {
		case 'icicle': nz(out, t, .12, .35, 2500); tone(out, t, 1400, .08, 'triangle', .08, 600); break;
		case 'cane': nz(out, t, .1, .3, 2000); tone(out, t, 500, .06, 'square', .04, 200); break;
		case 'flurry': nz(out, t, .07, .22, 3000); break;
		case 'snowplow': nz(out, t, .35, .55, 900); tone(out, t, 120, .25, 'sine', .3, 40); break;
		case 'hail': nz(out, t, .4, .5, 1400); tone(out, t, 200, .3, 'sawtooth', .1, 50); tone(out, t + .05, 2400, .3, 'sine', .03, 1200); break;
		case 'bauble': tone(out, t, 300, .2, 'sine', .2, 120); nz(out, t, .15, .2, 800); break;
		case 'hearth': nz(out, t, .25, .12, 700, 'bandpass'); break;
		case 'aurora': tone(out, t, 300, .6, 'sawtooth', .1, 1200); tone(out, t, 600, .6, 'sine', .1, 2400); break;
		case 'bells': nz(out, t, .06, .2, 2500); tone(out, t, 2093, .12, 'sine', .03); break;
		case 'reload': tone(out, t, 700, .04, 'square', .05); tone(out, t + .12, 500, .04, 'square', .05); break;
		case 'ready': tone(out, t, 900, .05, 'square', .05); break;
		case 'boom': nz(out, t, .7, .7, 500); tone(out, t, 90, .6, 'sine', .4, 30); break;
		case 'fall': nz(out, t, .25, .12, 400); tone(out, t, 160, .25, 'sawtooth', .04, 60); break;
		case 'fallbig': nz(out, t, .6, .3, 300); tone(out, t, 90, .7, 'sawtooth', .1, 30); break;
		case 'groan': tone(out, t, 90 + Math.random() * 30, .9, 'sawtooth', .035, 60); break;
		case 'thud': nz(out, t, .18, .25, 300); break;
		case 'hurt': tone(out, t, 300, .2, 'square', .06, 150); break;
		case 'spit': nz(out, t, .2, .15, 1200, 'bandpass'); break;
		case 'bolt': tone(out, t, 900, .05, 'triangle', .04, 500); break;
		case 'jingle': for (let i = 0; i < 10; i++) tone(out, t + i * .09, [2093, 2637, 3136][i % 3], .2, 'sine', .05); break;
		case 'light': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(out, t + i * .12, f, 1.2, 'triangle', .07)); break;
		case 'ok': tone(out, t, 660, .06, 'square', .03); break;
		}
	}
	/* music: a low drone for the nights, a heartbeat that quickens as the night goes on; the rescue in warm chords */
	function music(k) {
		if (track == k) return; clearInterval(timer); track = k; if (!save.set.music || !on()) return;
		let next = C.currentTime + .1, step = 0;
		timer = setInterval(() => {
			if (held || !C) return;
			while (next < C.currentTime + .3) {
				if (track == 'night' || track == 'title') {
					const bpm = track == 'title' ? 50 : 54 + (N ? Math.min(30, N.t / 3) : 0), b = 60 / bpm;
					if (step % 8 == 0) { tone(mus, next, 55, b * 8, 'sawtooth', .05); tone(mus, next, 82.4, b * 8, 'sawtooth', .03) }
					if (track == 'night') { tone(mus, next, 60, .15, 'sine', .25, 40); tone(mus, next + .18, 55, .15, 'sine', .18, 38) }
					if (step % 16 == 12) tone(mus, next, [440, 415, 392][Math.floor(step / 16) % 3], b * 3, 'triangle', .02);
					next += b; step++;
				} else if (track == 'rescue' || track == 'day') {
					const ch = track == 'day' ? [[220, 262, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]] : [[262, 330, 392], [349, 440, 523], [392, 494, 587], [523, 659, 784]], c = ch[step % 4], b = track == 'day' ? 3 : 1.6;
					c.forEach(f => tone(mus, next, f, b * .95, 'triangle', track == 'day' ? .035 : .05)); next += b; step++;
				} else return;
			}
		}, 80);
	}
	return {sfx, music, unlock: on, hold(v) { held = v; if (C) try { v ? C.suspend() : C.resume() } catch (e) {} }, stop() { clearInterval(timer); track = null }};
})();

/* ---------- day: twelve hours ---------- */
function dawn() {
	G.night++; screen = 'day'; bar();
	if (G.night > save.best) save.best = G.night;
	G.hp = Math.min(100, G.hp + 30);
	G.plan = G.plan || {repair: 6, search: 4, train: 2};
	persist(true); AU.music('day');
	dayScreen();
}
function dayScreen() {
	screen = 'day'; bar();
	const p = G.plan, used = p.repair + p.search + p.train;
	const row = (k, label, what) => `<div class="hrow"><span><b>${label}</b><small>${what}</small></span><button data-h="${k}" data-d="-1" aria-label="Fewer hours for ${label}">−</button><b class="hn">${p[k]} h</b><button data-h="${k}" data-d="1" aria-label="More hours for ${label}">+</button></div>`;
	const owned = ORDER.filter(k => G.wp[k].have).map(k => WEP[k].name + (WEP[k].inf ? '' : ' (' + (G.wp[k].res + G.wp[k].mag) + ')')).join(', ');
	let html = `<h2>Day ${G.night - 1 || 1} · before Night ${G.night}</h2><p>The barricade: <b>${Math.round(G.bar)} / ${G.barMax}</b>. Rudolf: <b>${Math.round(G.hp)}</b>. ${12 - used} of 12 hours left to plan.</p>` +
		row('repair', 'Repair', '+70 to the barricade an hour') + row('search', 'Search', 'weapons, ammo, survivors') + row('train', 'Train', 'steadier aim, faster reloads (' + G.skill + '/30)');
	if (G.surv.length) html += '<h3>Survivors</h3>' + G.surv.map((s, i) => `<div class="hrow"><span><b>${s.name}</b><small>a ${s.kind}</small></span><button data-s="${i}" class="role">${ROLES[s.role].split(' (')[0]}</button></div>`).join('');
	html += `<p class="small">Carrying: ${owned}.</p>`;
	if (G.night == LAST - 1 && !G.letter) html += '<p class="note">A snowy owl lands on the barricade with a note tied to its leg: <i>“Hold on through the fifteenth night. I am coming for all of you. — Captain Quill”</i></p>';
	dialog(html, [['Spend the day', runDay, 1], ['Save and quit', toTitle, 0, 1]], 'day');
	document.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const k = b.dataset.h, d = +b.dataset.d, u = p.repair + p.search + p.train; if (d > 0 && u >= 12) return; p[k] = Math.max(0, p[k] + d); AU.sfx('ok'); dayScreen(); const nb = document.querySelector(`[data-h="${k}"][data-d="${d}"]`); nb && nb.focus() });
	document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = G.surv[+b.dataset.s], ks = Object.keys(ROLES); s.role = ks[(ks.indexOf(s.role) + 1) % ks.length]; dayScreen(); const nb = document.querySelector(`[data-s="${b.dataset.s}"]`); nb && nb.focus() });
}
function runDay() {
	const p = G.plan, rng = RG.rng(G.seed + ':day:' + G.night), out = [];
	if (G.night == LAST - 1) G.letter = true;
	const rep = p.repair * 70 + G.surv.filter(s => s.role == 'repair').length * 50, before = G.bar;
	G.bar = Math.min(G.barMax, G.bar + rep); if (G.bar > before) out.push('Repaired the barricade: +' + Math.round(G.bar - before) + '.');
	const hours = p.search + G.surv.filter(s => s.role == 'scout').length;
	for (let h = 0; h < hours; h++) {
		const r = rng();
		const next = ORDER.find(k => !G.wp[k].have && WEP[k].night <= G.night);
		if (next && r < .12 + G.night * .02) { G.wp[next].have = true; G.wp[next].mag = WEP[next].mag; G.wp[next].res = WEP[next].find; out.push('<b>Found the ' + WEP[next].name + '!</b> ' + WEP[next].desc) }
		else if (r < .4) { const ks = ORDER.filter(k => G.wp[k].have && !WEP[k].inf); if (ks.length) { const k = ks[Math.floor(rng() * ks.length)], n = Math.round(WEP[k].find * (.4 + rng() * .5)); G.wp[k].res += n; out.push('Ammunition for the ' + WEP[k].name + ': +' + n + '.') } else out.push('Searched the sheds: nothing useful.') }
		else if (r < .52 && G.surv.length < 6) { const used = new Set(G.surv.map(s => s.name)), free = NAMES.filter(n => !used.has(n)), nm = free[Math.floor(rng() * free.length)]; const kind = KINDS[Math.floor(rng() * KINDS.length)]; G.surv.push({name: nm, kind, role: 'guard'}); out.push('<b>' + nm + '</b>, a ' + kind + ', was hiding in the old mill and joins the barricade.') }
		else if (r < .65) { G.hp = Math.min(100, G.hp + 15); out.push('Found bandages and a flask of cocoa: Rudolf +15.') }
		else out.push('Searched the woods’ edge: nothing but snow.');
	}
	if (p.train) { const s0 = G.skill; G.skill = Math.min(30, G.skill + p.train); if (G.skill > s0) out.push('Practised at the barricade: aim ' + G.skill + '/30.') }
	G.morning = null; persist(true);
	dialog('<h2>The day</h2>' + out.map(s => '<p>' + s + '</p>').join(''), [['Night ' + G.night + ' falls…', () => { closeDialog(); G.morning = snapshot(); persist(true); startNight() }, 1]], 'day');
}

/* ---------- endings ---------- */
function lose() {
	AU.music(null); bar();
	dialog(`<h2>The barricade fell</h2><p>Night ${G.night}. ${G.kills} fell before it did.</p>`, [['Try the night again', retryNight, 1], ['Title', toTitle, 0, 1]]);
}
function retryNight() { if (G.morning) { G = JSON.parse(JSON.stringify(G.morning)); G.morning = snapshot() } else return toTitle(); closeDialog(); startNight() }
function ending() {
	save.wins++; save.run = null; persist(); screen = 'end'; bar();
	const acc = G.shots ? Math.round(G.hits / G.shots * 100) : 0;
	dialog(`<h2>Dawn</h2><p>The sleigh climbs into a pink sky. Below, the barricade stands where Rudolf and ${G.surv.length ? G.surv.length + ' friends' : 'his friends'} kept it for fifteen nights.</p><p>${G.kills} elves fell to the corruption’s end; ${G.heads} by the eyes. Accuracy ${acc}%.</p><p><b>Thank you for holding the line.</b></p>`, [['Title', toTitle, 1]]);
}

/* ---------- menus ---------- */
function dialog(html, btns, cls) {
	$('#ovBody').innerHTML = html; const B = $('#ovBtns'); B.innerHTML = '';
	btns.forEach(([t, f, main, back]) => { const b = document.createElement('button'); b.textContent = t; if (main) b.className = 'main'; if (back) b.dataset.back = 1; b.onclick = () => { AU.sfx('ok'); closeDialog(); f && f() }; B.appendChild(b) });
	const ov = $('#ov'); ov.className = cls || ''; ov.hidden = false; (B.querySelector('.main') || B.firstChild).focus();
}
function closeDialog() { $('#ov').hidden = true }
const ovOpen = () => !$('#ov').hidden;
function toTitle() {
	screen = 'title'; N = null; bar(); AU.music('title');
	const r = save.run, B = [];
	if (r) B.push(['Carry on · Night ' + r.night + ' (' + DIFF[r.diff].name + ')', () => { G = JSON.parse(JSON.stringify(r)); dayScreen() }, 1]);
	B.push(['New game', pickDiff, !r], ['Options', menuOptions], ['How to play', () => help(toTitle)]);
	dialog('<p class="age">For older players: cartoon horror and combat.</p>' + (save.wins ? '<p class="small">The line held ' + save.wins + ' time' + (save.wins > 1 ? 's' : '') + '.</p>' : save.best > 1 ? '<p class="small">Furthest: Night ' + save.best + '.</p>' : ''), B, 'title');
}
function pickDiff() {
	const b = d => [DIFF[d].name, () => { save.set.diff = d; newRun(d); G.plan = {repair: 0, search: 6, train: 2}; G.morning = snapshot(); save.run = snapshot(); persist(); closeDialog(); startNight() }, save.set.diff == d];
	dialog('<h2>New game</h2>' + (save.run ? '<p>This replaces the game you have going.</p>' : '') + '<p>Easy: fewer, weaker elves. Hard: more of them, and stronger.</p>', [b('easy'), b('normal'), b('hard'), ['Back', toTitle, 0, 1]], 'title');
}
function menuOptions() {
	const s = save.set, o = v => v ? '✓ ' : '';
	dialog('<h2>Options</h2>', [[o(s.music) + 'Music', () => { s.music = !s.music; if (!s.music) AU.stop(); else AU.music('title'); persist(); menuOptions() }, 1],
		[o(s.sfx) + 'Sounds', () => { s.sfx = !s.sfx; persist(); menuOptions() }], [o(s.reduceFlash) + 'Reduce flashing', () => { s.reduceFlash = !s.reduceFlash; RG.reduceFlash = s.reduceFlash; persist(); menuOptions() }],
		[o(s.assist) + 'Aim assist (shots find a head near the crosshair)', () => { s.assist = !s.assist; persist(); menuOptions() }],
		['Export save…', () => { RG.exportSave(); menuOptions() }], ['Import save…', async () => { try { const d = await RG.importSave(); if (d && d.v == 1) { save = Object.assign(save, d); dialog('<h2>Save imported</h2>', [['OK', toTitle, 1]], 'title') } } catch (e) { dialog('<h2>Not imported</h2><p>' + String(e.message).replace(/</g, '&lt;') + '</p>', [['OK', menuOptions, 1]], 'title') } }],
		['Back', toTitle, 0, 1]], 'title');
}
function help(back) {
	dialog('<h2>How to play</h2><p>Every night corrupted elves come out of the woods for the barricade. When it breaks, they come for Rudolf.</p>' +
		'<p><b>Shoot:</b> click where to shoot (hold for automatic weapons); or tap the field; or aim with the arrows or a controller’s stick and fire with Z, Space or a trigger. Their <b>glowing eyes</b> are the weak spot.</p>' +
		'<p><b>Reload:</b> R, right-click, X on a controller, or the Reload button. <b>Weapons:</b> 1–9, Q and E, the bumpers, or the buttons below the field.</p>' +
		'<p><b>By day</b> plan twelve hours: repair the barricade, search for weapons, ammunition and survivors, or train. Survivors can guard, repair or scout.</p>' +
		'<p>Hold out for fifteen nights.</p>', [['OK', back || null, 1, 1]], 'title');
}
function menuPause() {
	AU.hold(true);
	dialog('<h2>Paused</h2><p>Night ' + G.night + '</p>', [['Carry on', () => { RG.resume(); AU.hold(false) }, 1, 1], ['Options', () => { AU.hold(false); RG.resume(); menuOptions() }], ['Give up the night', () => { AU.hold(false); RG.resume(); retryNight() }], ['Save and quit', () => { AU.hold(false); RG.resume(); toTitle() }]]);
}
function menuNav() {
	const bs = [...document.querySelectorAll('#ov button')]; if (!bs.length) return;
	const i = bs.indexOf(document.activeElement);
	if (RG.pressed('up') || RG.pressed('left')) bs[i <= 0 ? bs.length - 1 : i - 1].focus();
	if (RG.pressed('down') || RG.pressed('right')) bs[(i + 1) % bs.length].focus();
	if (RG.pressed('ok') && i >= 0) bs[i].click();
	if (RG.pressed('back')) { const b = bs.find(b => b.dataset.back); b && b.click() }
}
/* the weapon bar under the field */
function bar() {
	const el = $('#bar'); if (screen != 'night' || !G) { el.hidden = true; return }
	el.hidden = false; el.innerHTML = '';
	ORDER.forEach((k, i) => { if (!G.wp[k].have) return; const b = document.createElement('button'); b.textContent = (i + 1) + ' ' + WEP[k].name.split(' ')[0]; b.title = WEP[k].name + ': ' + WEP[k].desc; b.setAttribute('aria-pressed', k == G.cur); b.onclick = () => { pick(k); cv.focus() }; el.appendChild(b) });
	const r = document.createElement('button'); r.textContent = '⟳ Reload'; r.className = 'rl'; r.onclick = () => { startReload(); cv.focus() }; el.appendChild(r);
}
function pick(k) { if (!G.wp[k] || !G.wp[k].have || k == G.cur) return; G.cur = k; N.reload = 0; N.burst = 0; N.spin = 0; N.cd = Math.max(N.cd, .25); AU.sfx('reload'); bar() }
function cycle(d) { const own = ORDER.filter(k => G.wp[k].have); pick(own[(own.indexOf(G.cur) + d + own.length) % own.length]) }

/* ---------- input ---------- */
function bindings() {
	RG.bind({left: ['ArrowLeft', 'KeyA', 'pad:14'], right: ['ArrowRight', 'KeyD', 'pad:15'], up: ['ArrowUp', 'KeyW', 'pad:12'], down: ['ArrowDown', 'KeyS', 'pad:13'],
		fire: ['KeyZ', 'Space', 'pad:7', 'pad:0'], reload: ['KeyR', 'pad:2'], prev: ['KeyQ', 'pad:4'], next: ['KeyE', 'pad:5'], pause: ['Escape', 'KeyP', 'pad:9'],
		ok: ['KeyZ', 'pad:0'], back: ['KeyX', 'Backspace', 'pad:1'],
		w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], w4: ['Digit4'], w5: ['Digit5'], w6: ['Digit6'], w7: ['Digit7'], w8: ['Digit8'], w9: ['Digit9']});
}
let mouseDown = false, padFire = false, keyFire = false;
function pointerSetup() {
	cv.style.touchAction = 'none';
	cv.addEventListener('contextmenu', e => e.preventDefault());
	const at = e => { const p = view.toGame(e.clientX, e.clientY); cross.x = Math.max(0, Math.min(W, p.x)); cross.y = Math.max(30, Math.min(H, p.y)) };
	cv.addEventListener('pointermove', e => { if (view) at(e) });
	cv.addEventListener('pointerdown', e => {
		AU.unlock(); RG.lastInput = e.pointerType == 'touch' ? 'touch' : 'mouse'; if (!view) return; at(e);
		if (screen != 'night' || !N || N.sleigh) return;
		if (e.button == 2) { startReload(); return }
		if (e.button != 0) return;
		try { cv.setPointerCapture(e.pointerId) } catch (x) {}
		mouseDown = true; firePressed = true;
	});
	const up = () => { mouseDown = false };
	cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
	cv.addEventListener('wheel', e => { if (screen == 'night' && N) { cycle(e.deltaY > 0 ? 1 : -1); e.preventDefault() } }, {passive: false});
}
function inputStep() {
	/* the crosshair from the keys, or a controller's sticks (either one) */
	let ax = (RG.down('right') ? 1 : 0) - (RG.down('left') ? 1 : 0), ay = (RG.down('down') ? 1 : 0) - (RG.down('up') ? 1 : 0);
	try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) { if (!g) continue; for (const [i, j] of [[2, 3], [0, 1]]) { const vx = g.axes[i] || 0, vy = g.axes[j] || 0; if (Math.abs(vx) > .15 || Math.abs(vy) > .15) { ax += vx; ay += vy; RG.lastInput = 'pad'; break } } } } catch (e) {}
	cross.x = Math.max(0, Math.min(W, cross.x + ax * 380 * DT)); cross.y = Math.max(30, Math.min(H, cross.y + ay * 380 * DT));
	const kf = RG.down('fire'); if (RG.pressed('fire')) firePressed = true;
	fireHeld = mouseDown || kf;
	if (RG.pressed('reload')) startReload();
	if (RG.pressed('next')) cycle(1); if (RG.pressed('prev')) cycle(-1);
	for (let i = 1; i <= 9; i++) if (RG.pressed('w' + i)) { const k = ORDER[i - 1]; if (G.wp[k].have) pick(k) }
}

/* ---------- the loop, saves ---------- */
let saveT = 0;
function persist(withRun) { if (withRun && G) save.run = snapshot(); clearTimeout(saveT); saveT = setTimeout(() => RG.save(save).catch(() => {}), 200) }
function update() {
	T += DT;
	if (ovOpen()) { menuNav(); return }
	if (screen != 'night' || !N || RG.paused) return;
	if (RG.pressed('pause')) { RG.pause(); return }
	inputStep(); nightStep();
}
async function start() {
	await RG.init('frost-barricade');
	const s = await RG.load(); if (s && s.v == 1) save = Object.assign(save, s, {set: Object.assign(save.set, s.set || {}), stats: Object.assign(save.stats, s.stats || {})});
	if (save.set.reduceFlash) RG.reduceFlash = true; else save.set.reduceFlash = !!RG.reduceFlash;
	bindings();
	view = RG.fit(cv, () => ({w: W, h: H}));
	pointerSetup();
	RG.onPause(() => { if (screen == 'night' && N && !ovOpen() && !N.over) menuPause() });
	addEventListener('pointerdown', () => AU.unlock(), {once: true}); addEventListener('keydown', () => AU.unlock(), {once: true});
	toTitle();
	if (!save.seenHelp) { save.seenHelp = 1; persist(); help(toTitle) }
	RG.loop(update, draw, {whilePaused: true});
	window.__fb = {get G() { return G }, get N() { return N }, set G(v) { G = v }, save: () => save, newRun, startNight, nightStep, dawn, runDay, dayScreen, WEP, cross, spawn: k => spawn(k), pick, fire: () => { firePressed = true }, hold: v => { mouseDown = v },
		run(n) { for (let i = 0; i < n && N && !N.over; i++) { inputStep(); nightStep() } return N && {t: N.t, elves: N.elves.length, q: N.q.length, bar: G.bar, hp: G.hp, kills: G.kills} }};
}
start();
})();
