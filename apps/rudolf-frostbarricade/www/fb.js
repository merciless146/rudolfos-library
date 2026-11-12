/* ===== 25 Days (formerly Frost Barricade): hold the barricade for twenty-five nights (for older players: a darker game of the Rudolf OS
   Library, docs/plan-games.md). An original game: the corrupted elves come out of the woods each night; aim and shoot
   (point and click, keys, a controller or touch); by day spend twelve hours on repairs, searching for weapons, ammo and
   survivors, and training; a weather radio tells what the night will bring. On the twenty-fifth night, in the great
   blizzard, Captain Quill's sleigh comes for everyone who held the line.
   25 Days (1.3): Rudolf moves up and down behind the barricade (W/S, the arrows, a controller's left stick, or a drag
   behind the barricade) and aims within 15 degrees of level; shots fly on past the crosshair to the end of the field
   unless an elf or a shield stops them (the Ornament Launcher still bursts at the crosshair); unlimited ammunition,
   quicker reloads, faster elves; the survivors shoot each in their own time, wild until trained, and panic below 5%.
   Uses the game kit (gamekit.js) and the art (fbart.js). GPL-2.0-or-later. ===== */
(function () {
'use strict';
const W = 1040, H = 440, DT = 1 / 60, PI = Math.PI, LAST = 25, SLEIGH_AT = 150;
const $ = s => document.querySelector(s), A = window.FBART, cv = $('#cv');
const AIM_MAX = 15 * Math.PI / 180, R_SPEED = 13, RELOAD_K = .6, ELF_SPEED = 1.3;
const DIFF = {easy: {name: 'Easy', count: .75, hp: .8, dmg: .65}, normal: {name: 'Normal', count: 1, hp: 1, dmg: 1}, hard: {name: 'Hard', count: 1.25, hp: 1.2, dmg: 1.3}};
/* the weapons: each better than the last, or with a way of its own */
const WEP = {
	icicle: {name: 'Icicle Pistol', dmg: 14, rps: 4, mag: 10, reload: 1.1, spread: .02, mode: 'semi', night: 0, desc: 'Reliable, and never runs out of shots.'},
	cane: {name: 'Candy-Cane Carbine', dmg: 17, rps: 10, mag: 24, reload: 1.6, spread: .018, mode: 'burst', night: 1, desc: 'Three-shot bursts, very steady.'},
	flurry: {name: 'Flurry SMG', dmg: 9, rps: 13, mag: 40, reload: 1.8, spread: .06, mode: 'auto', night: 2, fx: 'chill', desc: 'Fully automatic; its frost can slow them.'},
	snowplow: {name: 'Snowplow Shotgun', dmg: 11, pellets: 7, rps: 1.3, mag: 6, reload: 2.4, spread: .07, mode: 'semi', night: 3, fx: 'knock', desc: 'Seven pellets that push them back.'},
	hail: {name: 'Hailstorm Rifle', dmg: 70, rps: 1.4, mag: 5, reload: 2.2, spread: .004, mode: 'semi', night: 5, pierce: 3, desc: 'Goes through three of them.'},
	bauble: {name: 'Ornament Launcher', dmg: 80, rps: .9, mag: 4, reload: 2.8, spread: .03, mode: 'semi', night: 7, fx: 'boom', desc: 'Bursting baubles: everything nearby is caught.'},
	hearth: {name: 'Hearthfire Thrower', dmg: 6, rps: 20, mag: 80, reload: 3, spread: 0, mode: 'auto', night: 9, fx: 'fire', desc: 'A short reach of fire; they keep burning.'},
	aurora: {name: 'Aurora Lance', dmg: 150, rps: .7, mag: 3, reload: 3, spread: 0, mode: 'semi', night: 11, pierce: 99, fx: 'stun', desc: 'A beam of northern light through the whole line; it stuns.'},
	bells: {name: 'Sleigh-Bell Gatling', dmg: 15, rps: 18, mag: 150, reload: 4, spread: .05, mode: 'auto', night: 13, fx: 'spin', desc: 'Winds up, then does not stop.'}};
const ORDER = Object.keys(WEP);
for (const k of ORDER) WEP[k].inf = true;   /* (25 Days: every weapon has unlimited ammunition) */
const ELF = {
	/* white eyes: the ordinary ones */
	shambler: {hp: 44, sp: 22, dps: 7, from: 1, w: 10},
	crawler: {hp: 34, sp: 30, dps: 6, from: 4, w: 4},
	/* yellow eyes: bloaters, large, slow and tough; they burst when they fall (bloaterBlast) */
	bloater: {hp: 170, sp: 13, dps: 8, from: 4, w: 3},
	/* red eyes: sprinters, dashing for the barricade; green eyes: muggers, weaving between lanes to steal a survivor's
	   weapon (both from wildChance, below, not the weights) */
	sprinter: {hp: 34, sp: 38, dps: 6, from: 2, w: 0},
	/* cyan eyes: shielders, tougher than most, behind a shield that stops shots (not blows or blasts) */
	shielder: {hp: 80, sp: 19, dps: 7, from: 5, w: 3},
	mugger: {hp: 42, sp: 14, dps: 4, from: 3, w: 0},
	spitter: {hp: 55, sp: 20, dps: 0, from: 6, w: 3},
	brute: {hp: 260, sp: 14, dps: 20, from: 7, w: 2},
	foreman: {hp: 1600, sp: 9, dps: 45, from: 99, w: 0},
	/* red eyes, always: the wendigo (full moon, the great blizzard); it screeches before it comes */
	wendigo: {hp: 2600, sp: 12, dps: 30, from: 99, w: 0}};
/* ---------- the weather: one a day, for that day's searching and that night ---------- */
const WX = {
	clear: {name: 'Clear', icon: '☀', tonight: 'Clear skies and a still night: you will see all the way to the woods. Good weather for searching; it goes quicker today.', tomorrow: 'clear and still'},
	moon: {name: 'Full moon', icon: '🌕', tonight: 'A full moon is rising, bright as day. They are restless out there tonight: every one of them running, eyes red. And something large has been heard in the woods.', tomorrow: 'a full moon (they will be restless)'},
	fog: {name: 'Fog', icon: '🌫', tonight: 'Thick fog, day and night. Only what Rudolf’s nose lights can be seen tonight: watch for the ripples of their sounds. Searching is slow and risky today.', tomorrow: 'fog'},
	blizzard: {name: 'Blizzard', icon: '❄', tonight: 'Blizzard. Nobody can go out searching today. Tonight you will barely see past the barricade and the survivors’ aim will suffer, but nothing can run in this.', tomorrow: 'a blizzard'}};
/* the schedule, fixed when a game starts (from its seed): days 1-7 clear or fog; a blizzard on day 8 or 9 and on day 17
   or 18; the great blizzard on days 23-25; one full moon, from day 8 (20% a day to 14, 60% to 20, 80% on 21, else 22),
   never on a blizzard's day */
function makeWeather(seed) {
	const r = RG.rng(seed + ':weather'), w = [null];
	for (let d = 1; d <= LAST; d++) w.push(r() < .3 ? 'fog' : 'clear');
	w[r() < .5 ? 8 : 9] = 'blizzard'; w[r() < .5 ? 17 : 18] = 'blizzard'; w[23] = w[24] = w[25] = 'blizzard';
	for (let d = 8; d <= 22; d++) { if (w[d] == 'blizzard') continue; const p = d <= 14 ? .2 : d <= 20 ? .6 : d == 21 ? .8 : 1; if (r() < p) { w[d] = 'moon'; break } }
	return w;
}
const wxOf = n => (G.wx || (G.wx = makeWeather(G.seed)))[Math.max(1, Math.min(LAST, n))];
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
	G = {diff, night: 1, plan: {repair: 0, search: 8, train: 4}, seed: String(Date.now()) + ':' + Math.floor(Math.random() * 1e9), bar: 1000, barMax: 1000, hp: 100, wp, cur: 'icicle', skill: 0, surv: [], kills: 0, heads: 0, shots: 0, hits: 0, letter: false};
	G.wx = makeWeather(G.seed);
}
const snapshot = () => JSON.parse(JSON.stringify(G));

/* ---------- the night ---------- */
function startNight() {
	const D = DIFF[G.diff], n = G.night;
	N = {night: n, wx: wxOf(n), t: 0, rl: 7, rv: 0, rwalk: 0, drops: [], gibs: [], smoke: [], panic: false, rng: RG.rng(G.seed + ':night:' + n), shields: [], waves: [], rstun: 0, deafT: -1, bashCd: 0, elves: [], slush: [], fx: [], spits: [], q: [], over: false, won: false, id: 0, barHit: 0, hurt: 0, recoil: 0, cd: 0, burst: 0, spin: 0, reload: 0, msg: null, sleigh: null, dawn: 0, beam: 0, flame: 0};
	const total = n == LAST ? 9999 : nightCount(n, D), len = 46 + n * 3.5;
	if (n < LAST) for (let i = 0; i < total; i++) N.q.push([2 + (i / total) * len + R() * 2, pickKind(n)]);
	/* survivors come back to the barricade armed and rested each night (a stolen weapon is back by then) */
	G.surv.forEach((s, i) => { s.disarmed = false; s.out = false; s.fled = false; s.stun = 0; s.runX = null; s.hp = 40; s.cd = .6 + R() * 2.4 + i * .3 });
	if (n == 10 || n == 15 || n == 20) N.q.push([len * .6, 'foreman']);
	if (n == LAST) N.q.push([60, 'foreman'], [110, 'foreman']);
	/* wendigos: one under the full moon; one on Night 24 and two on Night 25, in the great blizzard; a screech first */
	const wend = t => N.q.push([t - 3.5, 'screech'], [t, 'wendigo']);
	if (N.wx == 'moon') wend(len * .45);
	if (n == LAST - 1) wend(50);
	if (n == LAST) { wend(40); wend(95) }
	N.q.sort((a, b) => a[0] - b[0]);
	N.total = N.q.length;
	screen = 'night'; bar(); AU.music('night');
	N.msg = {t: 0, text: 'Night ' + n + (n == LAST ? ' · the last' : '') + ' · ' + WX[N.wx].name, sub: n == LAST ? 'Hold on until the sleigh comes.' : n == 1 ? 'They are coming out of the woods.' : N.wx == 'moon' ? 'They are running tonight. All of them.' : N.wx == 'fog' ? 'Light them with your nose. Listen for them.' : N.wx == 'blizzard' ? 'Nothing runs in this. Neither will you see them coming.' : ''};
}
/* each night a few more elves, a little tougher; from Night 2 on some change lanes or sprint (none on Night 1, almost
   half on Night 15) */
function nightCount(n, D) { return Math.round((22 + (n - 1) * 3) * D.count) }
const hpMul = n => 1 + (n - 1) * .045;
const wildChance = n => .47 * Math.min(1, (n - 1) / 14);
/* which elf: from the night's weights, and then (with wildChance) a sprinter or, from Night 3, a mugger instead */
function pickKind(n) {
	const kinds = Object.keys(ELF).filter(k => ELF[k].from <= n && ELF[k].w), tw = kinds.reduce((a, k) => a + ELF[k].w, 0);
	let r = R() * tw, k = kinds[0]; for (const kk of kinds) { r -= ELF[kk].w; if (r <= 0) { k = kk; break } }
	if (k != 'bloater' && R() < wildChance(n)) k = n >= 3 && R() < .45 ? 'mugger' : 'sprinter';
	/* under the full moon every white-eyed elf runs, red-eyed */
	if (G && G.wx && wxOf(n) == 'moon' && (k == 'shambler' || k == 'crawler' || k == 'spitter' || k == 'brute')) k = 'sprinter';
	return k;
}
function spawn(kind) {
	if (kind == 'screech') { AU.sfx('screech'); N.msg = {t: 0, text: 'A screech from the woods…', sub: 'Something large is coming.'}; if (!save.set.reduceFlash) N.shake = .6; return }
	const D = DIFF[G.diff], E = ELF[kind], mul = hpMul(G.night) * D.hp, p = wildChance(G.night), lane = Math.floor(R() * A.LANES);
	const e = {id: ++N.id, kind, x: W + 20 + R() * 40, lane, tl: lane, changer: (kind == 'shambler' || kind == 'crawler') && R() < p, sprinter: kind == 'sprinter', mugger: kind == 'mugger', loot: -1, lcT: kind == 'mugger' ? R() * .4 : 1 + R() * 3, spT: 1 + R() * 2, sprint: 0, hp: E.hp * mul, hp0: E.hp * mul, sp: E.sp * (kind == 'wendigo' ? 1 : ELF_SPEED) * (.85 + R() * .3), walk: R() * 6, attacking: false, chill: 0, burn: 0, stun: 0, hitT: 0, spitT: 1 + R() * 2, stop: kind == 'spitter' ? 430 + R() * 220 : 0};
	if (kind == 'shielder') e.shield = true;
	if (N.wx == 'moon' && A.ELF[kind].eye == A.EYE.white) { e.sprinter = true; e.eye = A.EYE.red; e.changer = false }
	/* the wendigo: it drifts, slowly, towards Rudolf's lane */
	if (kind == 'wendigo') { e.lane = Math.floor(R() * A.LANES); e.tl = Math.round(N.rl); e.changer = false; e.wmode = 'walk'; e.wT = 4 + R() * 2 }
	N.elves.push(e);
	if (R() < (N.wx == 'fog' ? .45 : .25)) AU.sfx('groan');
}
function nightStep() {
	const D = DIFF[G.diff]; N.t += DT;
	/* Rudolf moves up and down behind the barricade: quickly, easing in and out */
	{ const want = rMove * R_SPEED; N.rv += (want - N.rv) * Math.min(1, DT * 14); if (N.rstun > 0) N.rv *= .8;
	  N.rl = Math.max(0, Math.min(A.LANES - 1, N.rl + N.rv * DT)); if ((N.rl <= 0 && N.rv < 0) || (N.rl >= A.LANES - 1 && N.rv > 0)) N.rv = 0;
	  N.rwalk += Math.abs(N.rv) * DT * 1.6 }
	while (N.q.length && N.q[0][0] <= N.t) {
		/* only one wendigo at a time: another's screech (and the wendigo after it) waits until the first is down */
		if (N.q[0][1] == 'screech' && N.elves.some(e => e.kind == 'wendigo' && !e.dead)) { const i = N.q.findIndex(q => q[1] == 'wendigo'); N.q[0][0] += 5; if (i >= 0) N.q[i][0] += 5; N.q.sort((a, b) => a[0] - b[0]); break }
		spawn(N.q.shift()[1]);
	}
	if (G.night == LAST && !N.sleigh) { if (N.t < SLEIGH_AT - 2) { if (Math.floor(N.t * 10) % Math.max(3, 14 - Math.floor(N.t / 12)) == 0 && N.elves.length < 34) { spawn(pickKind(LAST)) } } else if (N.t >= SLEIGH_AT) startRescue() }
	/* the weapon */
	weaponStep();
	/* elves */
	for (const e of N.elves) {
		if (e.hitT > 0) e.hitT -= DT; if (e.chill > 0) e.chill -= DT; if (e.stun > 0) e.stun -= DT;
		if (e.burn > 0) { e.burn -= DT; damage(e, 9 * DT, false, true) }
		if (e.dead) continue;
		const front = A.front(e.lane);
		/* changing lanes: now and then a new lane up to three away, crossed gradually */
		if (e.changer && !e.attacking && e.stun <= 0) { e.lcT -= DT; if (e.lcT <= 0) { e.lcT = 2 + R() * 3; e.tl = Math.max(0, Math.min(A.LANES - 1, Math.round(e.lane) + (R() < .5 ? -1 : 1) * (1 + Math.floor(R() * 3)))) } }
		/* muggers weave: back and forth across two or three lanes, quickly */
		if (e.mugger && !e.attacking && e.stun <= 0) { e.lcT -= DT; if (e.lcT <= 0) { e.lcT = .4 + R() * .3; let dir = e.wdir = -(e.wdir || 1); const step = 2 + Math.floor(R() * 2); if (Math.round(e.lane) + dir * step < 0 || Math.round(e.lane) + dir * step > A.LANES - 1) dir = e.wdir = -dir; e.tl = Math.max(0, Math.min(A.LANES - 1, Math.round(e.lane) + dir * step)) } }
		if (e.lane != e.tl && !(e.kind == 'wendigo' && e.wmode == 'charge')) { const d = e.tl - e.lane; e.lane += Math.sign(d) * Math.min(Math.abs(d), (e.mugger ? 6 : e.kind == 'wendigo' ? .3 : 1.3) * DT) }
		if (e.kind == 'wendigo') wendigoStep(e);
		/* shields: a shielder (from Night 10) goes back for its own; from Night 18 an ordinary elf may take up one whose
		   shielder has fallen */
		if (!e.shield && N.shields.length) shieldStep(e);
		/* sprinters: dashes for the barricade, again and again */
		if (e.sprint > 0) e.sprint -= DT;
		else if (e.sprinter && !e.attacking && N.wx != 'blizzard') { e.spT -= DT; if (e.spT <= 0) { e.sprint = 1.1 + R() * 1.2; e.spT = 1.6 + R() * 2.2 } }
		const sp = e.sp * (e.chill > 0 ? .45 : 1) * (e.stun > 0 ? 0 : 1) * (e.sprint > 0 ? 3.2 : 1) * (e.wmode == 'charge' || e.pickT > 0 ? 0 : 1);
		/* a mugger with a weapon runs for the woods; out of sight, the weapon is gone until the next night */
		if (e.loot >= 0) { e.x += 80 * (e.chill > 0 ? .45 : 1) * (e.stun > 0 ? 0 : 1) * DT; e.walk += DT * 5; e.attacking = false;
			if (e.x > W + 30) { e.dead = true; e.escaped = true; const sv = G.surv[e.loot]; if (sv) N.fx.push({k: 'txt', x: W - 160, y: 120, s: 'The mugger got away with ' + sv.name + '’s crossbow', t: 0, long: true}); AU.sfx('lost') }
			continue }
		if (e.kind == 'spitter' && e.x <= e.stop) {
			e.attacking = false; e.spitT -= DT;
			if (e.spitT <= 0 && e.stun <= 0) { e.spitT = 2.6 + R(); N.spits.push({x: e.x - 8, y: A.laneY(e.lane) - 40 * ELF_S(e), vx: -(e.x - front + 10) / 1.2, vy: -150, t: 0, ty: A.laneY(e.lane) - 30, fx: front}); AU.sfx('spit') }
			continue;
		}
		const stopX = G.bar > 0 ? front + (e.id % 5) * 2 : A.RX + 26;
		if (e.x > stopX) { e.x -= sp * DT; e.walk += sp * DT * .25; e.attacking = false }
		else {
			e.attacking = true; e.walk += DT * 4;
			if (e.mugger && steal(e)) continue;
			if (e.stun > 0) continue;
			if (G.bar > 0) hitBar(ELF[e.kind].dps * D.dmg * DT); else hurtRudolf(ELF[e.kind].dps * .5 * D.dmg * DT);
		}
	}
	wavesStep();
	ripples();
	/* spit arcs onto the barricade */
	for (const s of N.spits) { s.t += DT; s.x += s.vx * DT; s.vy += 260 * DT; s.y += s.vy * DT; if (s.y >= s.ty && s.x < s.fx + 10) { s.done = true; if (G.bar > 0) hitBar(12 * D.dmg); else hurtRudolf(5 * D.dmg); burst(s.x, s.y, 8, '#b04dff') } }
	N.spits = N.spits.filter(s => !s.done && s.t < 4);
	N.elves = N.elves.filter(e => !e.dead);
	/* survivors on guard: each shoots in its own time, and wildly until trained (their aim follows the training) */
	G.surv.forEach((s, i) => {
		if (s.fled) { s.runX -= 150 * DT; return }
		if (s.stun > 0) { s.stun -= DT; return }
		if (s.role != 'guard' || s.disarmed || s.out) return; s.cd = (s.cd == null ? .6 + R() * 2.4 : s.cd) - DT; s.fire = Math.max(0, (s.fire || 0) - DT);
		if (s.cd <= 0) { const tg = N.elves.filter(e => e.x < W - 10).sort((a, b) => (!!a.shield - !!b.shield) || a.x - b.x)[Math.floor(R() * 2)] || N.elves.find(e => e.x < W - 10); if (tg) { s.cd = 1.3 + R() * 1.7; s.fire = .12; const sp = survPos(i);
			/* the chance to hit: about 40% untrained, 85% fully trained; in a blizzard little more than half that; a shield stops them */
			const hitP = (.4 + .45 * G.skill / 30) * (N.wx == 'blizzard' ? .55 : 1), miss = R() > hitP;
			if (!miss && !tg.shield) damage(tg, (8 + G.night * .6), false); else if (miss) s.missed = (s.missed || 0) + 1; else s.blocked = (s.blocked || 0) + 1;
			const mx = miss ? (R() - .5) * 90 : 0, my = miss ? (R() - .5) * 70 : 0;
			N.fx.push({k: 'bolt', x0: sp.x + 16, y0: sp.y - 18, x1: tg.x + mx, y1: A.laneY(tg.lane) - 22 * ELF_S(tg) + my, t: 0}); AU.sfx('bolt') } else s.cd = .3 + R() * .5 }
	});
	/* below 5% of the barricade the survivors panic: they drop their crossbows and run, until morning */
	if (!N.panic && G.bar < G.barMax * .05 && G.surv.some(s => !s.out)) {
		N.panic = true;
		G.surv.forEach((s, i) => { if (s.out) return; const p = survPos(i); if (!s.disarmed) N.drops.push({x: p.x + 8, y: p.y}); s.fled = true; s.runX = p.x });
		N.msg = {t: 0, text: 'The survivors panic!', sub: 'They drop their weapons and run. Rudolf holds alone.'}; AU.sfx('lost');
	}
	if (N.rstun > 0) N.rstun -= DT; if (N.deafT >= 0) { N.deafT += DT; if (N.deafT > DEAF_FULL + DEAF_FADE) N.deafT = -1 } if (N.bashCd > 0) N.bashCd -= DT; if (N.bashT > 0) N.bashT -= DT;
	if (N.barHit > 0) N.barHit -= DT * 3; if (N.hurt > 0) N.hurt -= DT; if (N.recoil > 0) N.recoil = Math.max(0, N.recoil - DT * 8);
	fxStep();
	/* the end of the night */
	if (G.hp <= 0 && !N.over) { N.over = true; lose(); return }
	if (G.night < LAST && !N.q.length && !N.elves.length && !N.won) { N.won = true; N.wonT = 0 }
	if (N.won) { N.wonT += DT; N.dawn = Math.min(.6, N.wonT / 4); if (N.wonT > 3 && !N.over) { N.over = true; dawn() } }
	if (N.sleigh) rescueStep();
}
const ELF_S = e => A.ELF[e.kind].s * A.depth(e.lane);
const SURV_LANES = [3, 11, 6, 13, 1, 9];
/* the survivors hold the barricade from just behind it */
const survPos = i => ({x: 136 + (i % 3) * 10, y: A.laneY(SURV_LANES[i % 6])});
/* the wendigo: a mini-boss. It comes on slowly, drifting towards Rudolf's lane; now and then it stops and, for 1.5 s,
   draws in a screech, then lets it go down its lane. The screech does not touch the barricade: it hurts the survivors
   in its path, and if it reaches Rudolf he is stunned, his sight blurs and his ears ring for 3 s, then fade. */
const CHARGE = 1.5, DEAF_FULL = 3, DEAF_FADE = 2.5, WAVE_SPEED = 520, WAVE_REACH = 1.5;
function wendigoStep(w) {
	if (w.wmode == 'charge') {
		w.chT -= DT;
		if (w.chT <= 0) { w.wmode = 'walk'; w.wT = 5 + R() * 3; N.waves.push({lane: w.lane, x: w.x - 30 * ELF_S(w), x0: w.x - 30 * ELF_S(w), t: 0, hit: {}}); AU.sfx('wscreech'); N.shake = save.set.reduceFlash ? .2 : .55; N.shakeAmp = save.set.reduceFlash ? 2 : 9 }
		return;
	}
	w.tl = Math.round(N.rl);   /* (it keeps drifting towards wherever Rudolf is) */
	w.wT -= DT;
	if (w.wT <= 0 && w.x < W - 30) { w.wmode = 'charge'; w.chT = CHARGE; AU.sfx('wcharge') }
}
function wavesStep() {
	for (const v of N.waves) {
		v.t += DT; v.x -= WAVE_SPEED * DT;
/* a survivor in its path is stunned for a while (not hurt) */
		G.surv.forEach((s, i) => { const p = survPos(i); if (!v.hit['s' + i] && v.x <= p.x + 10 && Math.abs(SURV_LANES[i % 6] - v.lane) <= WAVE_REACH && !s.out && !s.fled) { v.hit['s' + i] = 1; s.stun = 3; N.fx.push({k: 'txt', x: p.x + 50, y: p.y - 34, s: s.name + ' is stunned by the screech', t: 0, long: true}) } });
		if (!v.hit.r && v.x <= A.RX + 10 && Math.abs(N.rl - v.lane) <= WAVE_REACH) { v.hit.r = 1; N.rstun = 1.2; N.deafT = 0; N.burst = 0; AU.sfx('ring') }
	}
	/* it dies away just past Rudolf's place */
	N.waves = N.waves.filter(v => v.x > A.RX - 40);
}
/* how deafened and blurred, 0..1: full for 3 s, then fading out */
const deafK = () => N.deafT < 0 ? 0 : N.deafT < DEAF_FULL ? 1 : Math.max(0, 1 - (N.deafT - DEAF_FULL) / DEAF_FADE);
/* shields */
const isRegular = e => e.kind == 'shambler' || e.kind == 'brute' || e.kind == 'spitter';
function dropShield(e, knock) {
	if (!e.shield) return;
	const s = ELF_S(e); e.shield = false; e.x += knock; e.stun = Math.max(e.stun, .5);
	N.shields.push({x: e.x - knock - 14 * s, lane: e.lane, owner: e.id, ownerKind: e.kind, s: A.ELF[e.kind].s});
	N.fx.push({k: 'txt', x: e.x, y: A.laneY(e.lane) - 60 * s, s: 'Shield down!', t: 0}); AU.sfx('clang');
}
function shieldStep(e) {
	const n = G.night;
	if (e.pickT > 0) { e.pickT -= DT; if (e.pickT <= 0) { const sh = N.shields.find(x => x === e.pickS); if (sh) { N.shields.splice(N.shields.indexOf(sh), 1); e.shield = true; sh.owner = e.id } e.pickS = null } return }
	for (const sh of N.shields) {
		if (Math.abs(sh.lane - e.lane) > 1 || Math.abs(sh.x - e.x) > 8) continue;
		const own = sh.owner == e.id, ownerDead = !N.elves.some(x => x.id == sh.owner && !x.dead);
		if ((own && e.kind == 'shielder' && n >= 10) || (n >= 18 && isRegular(e) && ownerDead && !(e.tried || (e.tried = {}))[sh.owner] && ((e.tried[sh.owner] = 1), R() < .5))) { e.pickT = .6; e.pickS = sh; return }
	}
	/* a shielder (from Night 10) walks to its own shield, wherever it fell */
	if (e.kind == 'shielder' && n >= 10) { const sh = N.shields.find(x => x.owner == e.id); if (sh) { e.tl = sh.lane; if (sh.x > e.x + 4) { e.x += e.sp * .8 * DT; e.walk += DT * 3 } } }
}
/* Bash: Rudolf's blow over the barricade at an elf against it (the one nearest the crosshair): it knocks a shield loose */
function bash() {
	if (!N || N.bashCd > 0 || N.rstun > 0 || N.sleigh) return;
	N.bashCd = .9; N.bashT = .25; AU.sfx('bash');
	const t = N.elves.filter(e => !e.dead && e.attacking && e.x < A.front(e.lane) + 24).map(e => ({e, d: Math.hypot(bodyOf(e).x - cross.x, bodyOf(e).y - cross.y)})).filter(o => o.d < 70).sort((a, b) => a.d - b.d)[0];
	if (!t) return false;
	const e = t.e;
	if (e.shield) dropShield(e, 34); else { damage(e, 25, false); e.x += 26; e.stun = Math.max(e.stun, .4) }
	burst(e.x - 8, A.laneY(e.lane) - 24, 10, '#e8eefc', A.laneY(e.lane));
	return true;
}
/* what Rudolf can see in fog or a blizzard: a cone of light from his nose towards the crosshair, and a little round him */
const nose = () => A.rNose(N ? N.rl : 7);
/* 25 Days: in fog a cone 25 degrees either side of the aim reaching 70% of the field; in a blizzard a much narrower one
   reaching 40% of the screen */
const VIS = {fog: {half: 25 * PI / 180, len: (W - A.RX) * .7, near: 110}, blizzard: {half: 9 * PI / 180, len: W * .4, near: 70}};
function seen(x, y) {
	const v = VIS[N.wx]; if (!v) return true;
	const o = nose(), dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
	{ const o = nose(); if (Math.hypot(x - o.x + 10, y - o.y - 20) < v.near) return true }
	let da = Math.atan2(dy, dx) - Math.atan2(cross.y - o.y, cross.x - o.x); da = Math.atan2(Math.sin(da), Math.cos(da));
	return d < v.len && Math.abs(da) < v.half;
}
/* in fog, elves out of sight show where they are by the ripples of their sounds (not in a blizzard: the wind drowns them) */
function ripples() {
	if (N.wx != 'fog') return;
	for (const e of N.elves) { if (e.dead) continue; e.rip = (e.rip == null ? Math.random() * 1.5 : e.rip) - DT; if (e.rip <= 0) { e.rip = 1.1 + Math.random() * .9; const y = A.laneY(e.lane) - 24 * ELF_S(e); if (!seen(e.x, y)) N.fx.push({k: 'rip', x: e.x, y, t: 0, big: e.kind == 'wendigo' || e.kind == 'bloater' || e.kind == 'brute'}) } }
}
let VC = null;
function drawVision(x) {
	const v = VIS[N.wx]; if (!v) return;
	if (!VC) { VC = document.createElement('canvas'); VC.width = W; VC.height = H }
	const c = VC.getContext('2d'), o = nose(), a = Math.atan2(cross.y - o.y, cross.x - o.x), fog = N.wx == 'fog';
	c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.fillStyle = fog ? 'rgba(52,60,82,.94)' : 'rgba(212,220,236,.9)'; c.fillRect(0, 0, W, H);
	c.globalCompositeOperation = 'destination-out';
	const cone = (hf, L, al) => { c.fillStyle = `rgba(0,0,0,${al})`; c.beginPath(); c.moveTo(o.x, o.y); for (let i = 0; i <= 12; i++) { const t = a - hf + (i / 12) * hf * 2; c.lineTo(o.x + Math.cos(t) * L, o.y + Math.sin(t) * L) } c.closePath(); c.fill() };
	cone(v.half * 1.4, v.len * 1.08, .35); cone(v.half * 1.15, v.len * 1.03, .5); cone(v.half, v.len, 1);
	const g = c.createRadialGradient(o.x - 10, o.y + 20, 0, o.x - 10, o.y + 20, v.near * 1.3); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.7, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
	x.drawImage(VC, 0, 0, W, H);
	/* the nose's warm light */
	x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgba(255,110,100,.05)'; x.beginPath(); x.moveTo(o.x, o.y); x.lineTo(o.x + Math.cos(a - v.half) * v.len, o.y + Math.sin(a - v.half) * v.len); x.lineTo(o.x + Math.cos(a + v.half) * v.len, o.y + Math.sin(a + v.half) * v.len); x.closePath(); x.fill(); x.globalCompositeOperation = 'source-over';
}
/* a mugger at the barricade takes a survivor's crossbow (a guard's first) */
function steal(e) {
	const order = G.surv.map((s, i) => i).filter(i => !G.surv[i].disarmed && !G.surv[i].out && !G.surv[i].fled).sort((a, b) => (G.surv[b].role == 'guard') - (G.surv[a].role == 'guard'));
	if (!order.length) return false;
	const i = order[0], s = G.surv[i]; s.disarmed = true; e.loot = i; e.attacking = false; e.tl = e.lane;
	N.fx.push({k: 'txt', x: e.x, y: A.laneY(e.lane) - 60, s: 'Stolen: ' + s.name + '’s crossbow!', t: 0, long: true}); AU.sfx('steal');
	return true;
}
/* a bloater bursting: the barricade, other elves, the survivors and Rudolf, each hurt more the nearer it is */
const BLOAT_R = 160;
function bloaterBlast(e) {
	const D = DIFF[G.diff], x = e.x, y = A.laneY(e.lane) - 24 * ELF_S(e), k = d => Math.max(0, 1 - d / BLOAT_R);
	explode(x, y, BLOAT_R, 120, e, true);
	const kb = k(Math.max(0, x - A.front(e.lane))); if (kb > 0 && G.bar > 0) hitBar(160 * kb * D.dmg);
	G.surv.forEach((s, i) => { const p = survPos(i), d = Math.hypot(p.x - x, (p.y - 14 - y) * 1.5); if (d < BLOAT_R && !s.out && !s.fled) { s.hp = (s.hp == null ? 40 : s.hp) - 70 * k(d); if (s.hp <= 0) { s.out = true; N.fx.push({k: 'txt', x: p.x + 60, y: p.y - 40, s: s.name + ' is knocked out until morning', t: 0, long: true}) } } });
	const rp = A.rShoulder(N.rl), dr = Math.hypot(rp.x - x, (rp.y + 14 - y) * 1.5); if (dr < BLOAT_R) hurtRudolf(50 * k(dr) * D.dmg);
}
function hitBar(d) { G.bar = Math.max(0, G.bar - d); N.barHit = 1; if (Math.random() < .08) AU.sfx('thud') }
function hurtRudolf(d) { G.hp = Math.max(0, G.hp - d); N.hurt = .4; if (Math.random() < .1) AU.sfx('hurt') }
function damage(e, d, head, quiet) {
	if (e.dead) return;
	e.hp -= d; if (!quiet) e.hitT = .08;
	if (e.hp <= 0) {
		e.dead = true; G.kills++; save.stats.kills++; if (head) { G.heads++; save.stats.heads++ }
		const ly = A.laneY(e.lane); if (N.slush.length > 140) N.slush.shift(); N.slush.push({x: e.x, y: ly - 2, r: 14 * ELF_S(e), t: 0, id: e.id});
		splat(e.x, ly - 20 * ELF_S(e), 18, ly); burst(e.x, ly - 20 * ELF_S(e), 8, '#b04dff', ly); gibs(e);
		if (e.kind == 'bloater') bloaterBlast(e);
		if (e.loot >= 0 && !e.escaped) { const sv = G.surv[e.loot]; if (sv) { sv.disarmed = false; N.fx.push({k: 'txt', x: e.x, y: ly - 60, s: 'Recovered ' + sv.name + '’s crossbow', t: 0, long: true}); AU.sfx('ready') } e.loot = -1 }
		AU.sfx(e.kind == 'foreman' || e.kind == 'brute' ? 'fallbig' : 'fall');
	}
}
function explode(x, y, r, dmg, src, linear) {
	if (src) src.dead = true;
	burst(x, y, 26, '#ffb03b', y + 20); burst(x, y, 18, '#d6ff4a', y + 20); N.fx.push({k: 'ring', x, y, r, t: 0});
	/* (across the lanes the blast reaches a little less far) */
	for (const e of N.elves) { if (e.dead || e === src) continue; const d = Math.hypot(e.x - x, (A.laneY(e.lane) - 18 * ELF_S(e) - y) * 1.5); if (d < r) { damage(e, dmg * (linear ? 1 - d / r : 1 - d / r * .5), false); if (e.shield && !e.dead) dropShield(e, 14 + 30 * (1 - d / r)) } }
	AU.sfx('boom'); if (!save.set.reduceFlash) { N.shake = .25; N.shakeAmp = 6 }
}

/* ---------- shooting ---------- */
const shoulder = () => A.rShoulder(N ? N.rl : 7);
/* within 15 degrees of level, either way (aim assist: towards a head near the crosshair) */
function aimAngle() { const s = shoulder(); let a = Math.atan2(cross.y - s.y, Math.max(8, cross.x - s.x)); if (save.set.assist && N) { const h = nearestHead(cross.x, cross.y, 22); if (h) a = Math.atan2(h.y - s.y, h.x - s.x) } return Math.max(-AIM_MAX, Math.min(AIM_MAX, a)) }
function weaponStep() {
	const w = WEP[G.cur], st = G.wp[G.cur];
	if (N.cd > 0) N.cd -= DT;
	if (N.rstun > 0) { firePressed = false; return }   /* (stunned by a screech) */
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
function startReload() { const w = WEP[G.cur], st = G.wp[G.cur]; if (N.reload > 0 || st.mag >= w.mag || (!w.inf && st.res <= 0)) return; N.reload = w.reload * RELOAD_K * (1 - G.skill * .01); AU.sfx('reload') }
function fire(w, st) {
	st.mag--; G.shots++; N.recoil = 1;
	const s = shoulder(), sc = A.rudolfScale(N.rl), a0 = aimAngle(), m = (A.MUZZLE[G.cur] || 30) * sc, mx = s.x + Math.cos(a0) * m, my = s.y + Math.sin(a0) * m;
	if (!save.set.reduceFlash) N.fx.push({k: 'flash', x: mx, y: my, t: 0});
	N.smoke.push({x: mx, y: my, t: 0, r: 3 + Math.random() * 3});
	if (G.cur != 'aurora' && G.cur != 'hearth' && G.cur != 'bauble') N.fx.push({k: 'case', x: s.x + 4, y: s.y - 2, vx: -40 - Math.random() * 50, vy: -90 - Math.random() * 40, fl: A.laneY(N.rl), t: 0});
	AU.sfx(G.cur);
	if (w.fx == 'fire') { flame(w, mx, my, a0); return }
	/* the Ornament Launcher lobs its bauble to burst at the crosshair (in front of the barricade) */
	if (w.fx == 'boom') { const bx = Math.max(A.BX + 70, cross.x) + (R() - .5) * w.spread * 300, by = cross.y + (R() - .5) * w.spread * 200; N.fx.push({k: 'lob', x0: mx, y0: my, x1: bx, y1: by, t: 0}); N.lobs = N.lobs || []; N.lobs.push({x: bx, y: by, t: .28, dmg: w.dmg}); return }
	const pel = w.pellets || 1, spr = w.spread * (1 - G.skill * .015);
	let hitAny = false;
	for (let p = 0; p < pel; p++) {
		/* the shot leaves along the aim, a little off by the spread, and flies on to the end of the field */
		const a = a0 + (R() + R() - 1) * spr * 1.6, dx = Math.cos(a), dy = Math.sin(a);
		const hits = rayHits(mx, my, dx, dy, w.pierce || 1);
		let endT = (W + 40 - mx) / Math.max(.2, dx);
		for (const h of hits) {
			hitAny = true; endT = h.t;
			const hx = mx + dx * h.t, hy = my + dy * h.t;
			/* a shield stops a shot, and anything that would have gone through */
			if (h.blocked) { burst(hx, hy, 6, '#bff6ff', hy + 30); N.fx.push({k: 'txt', x: hx, y: hy - 10, s: 'blocked', t: 0}); AU.sfx('clang'); break }
			damage(h.e, w.dmg * (h.head ? 2.5 : 1), h.head);
			splat(hx, hy, h.head ? 9 : 5, A.laneY(h.e.lane));
			if (h.head) N.fx.push({k: 'txt', x: h.e.x, y: A.laneY(h.e.lane) - 50 * ELF_S(h.e), s: 'eyes!', t: 0});
			if (w.fx == 'chill' && R() < .3) h.e.chill = 2;
			if (w.fx == 'knock') h.e.x += 7;
			if (w.fx == 'stun') h.e.stun = .9;
		}
		if (w.pierce > 3) endT = (W + 40 - mx) / Math.max(.2, dx);
		N.fx.push({k: w.fx == 'stun' ? 'beam' : 'tracer', x0: mx, y0: my, x1: mx + dx * endT, y1: my + dy * endT, t: 0, c: G.cur});
	}
	if (hitAny) G.hits++;
}
function lobStep() { if (!N.lobs) return; for (const l of N.lobs) { l.t -= DT; if (l.t <= 0) { l.done = true; explode(l.x, l.y, 60, l.dmg, null) } } N.lobs = N.lobs.filter(l => !l.done) }
function flame(w, mx, my, a0) {
	N.flame = .1; let hit = false;
	/* (fire licks round a shield: half as much) */
	for (const e of N.elves) { if (e.dead) continue; const b = bodyOf(e), dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy); if (d < 260 && Math.abs(Math.atan2(dy, dx) - a0) < .24) { damage(e, w.dmg * (e.shield ? .5 : 1), false, true); e.burn = e.shield ? 1.1 : 2.2; e.hitT = .05; hit = true } }
	for (let i = 0; i < 2; i++) N.fx.push({k: 'fire', x: mx, y: my, vx: Math.cos(a0 + (Math.random() - .5) * .3) * (260 + Math.random() * 80), vy: Math.sin(a0 + (Math.random() - .5) * .3) * 280, t: 0});
	if (hit) G.hits++;
}
function headOf(e) { const s = ELF_S(e), h = A.elfHead(e.kind, s); return {x: e.x + h.dx, y: A.laneY(e.lane) - (e.lift || 0) + h.dy, r: h.r + 1} }
function bodyOf(e) { const s = ELF_S(e), b = A.elfBody(e.kind, s); return {x: e.x + b.dx, y: A.laneY(e.lane) - (e.lift || 0) + b.dy, r: b.r} }
/* a shield: from the waist to above the head, in front of the elf; the lower legs and feet stay out of it */
function shieldBox(e) { const s = ELF_S(e), Y = A.laneY(e.lane) - (e.lift || 0); return {x0: e.x - 17 * s, x1: e.x + 9 * s, y0: Y - 54 * s, y1: Y - 12 * s} }
function legsOf(e) { const s = ELF_S(e), Y = A.laneY(e.lane) - (e.lift || 0); return {x0: e.x - 7 * s, x1: e.x + 7 * s, y0: Y - 12 * s, y1: Y + 1} }
const inBox = (x, y, b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
/* the elf under the point (the nearest lane wins), then for piercing shots the ones behind it in about the same lane */
function pointHits(x, y, pierce) {
	let best = null;
	for (const e of N.elves) {
		if (e.dead) continue;
		const h = headOf(e), b = bodyOf(e), head = (x - h.x) ** 2 + (y - h.y) ** 2 < h.r * h.r, body = (x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r;
		const legs = e.kind != 'crawler' && e.kind != 'wendigo' && inBox(x, y, legsOf(e)), shield = e.shield && inBox(x, y, shieldBox(e));
		if ((head || body || legs || shield) && (!best || e.lane > best.e.lane)) best = shield && !legs ? {e, head: false, blocked: true} : {e, head: head && !legs};
	}
	if (!best) return [];
	const out = [best];
	if (best.blocked) return out;
	if (pierce > 1) for (const e of N.elves.filter(e => !e.dead && e !== best.e && e.x > best.e.x && Math.abs(e.lane - best.e.lane) <= 1.2).sort((a, b) => a.x - b.x).slice(0, pierce - 1)) { out.push(e.shield ? {e, head: false, blocked: true} : {e, head: false}); if (e.shield) break }
	return out;
}
function rayCircle(ox, oy, dx, dy, c) { const fx = ox - c.x, fy = oy - c.y, b = fx * dx + fy * dy, cc = fx * fx + fy * fy - c.r * c.r, disc = b * b - cc; if (disc < 0) return -1; const t = -b - Math.sqrt(disc); return t > 0 ? t : -1 }
function rayBox(ox, oy, dx, dy, b) { let t0 = 0, t1 = 1e9; for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1]]) { if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue } let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1 } return t0 > 0 ? t0 : -1 }
/* along a shot: each elf it meets (its head, body, legs or shield, whichever first), nearest first; a shield ends it */
function rayHits(ox, oy, dx, dy, pierce) {
	const out = [];
	for (const e of N.elves) {
		if (e.dead) continue;
		const th = rayCircle(ox, oy, dx, dy, headOf(e)), tb = rayCircle(ox, oy, dx, dy, bodyOf(e)), tl = e.kind != 'crawler' && e.kind != 'wendigo' ? rayBox(ox, oy, dx, dy, legsOf(e)) : -1, ts = e.shield ? rayBox(ox, oy, dx, dy, shieldBox(e)) : -1;
		const c = [[th, 'head'], [tb, 'body'], [tl, 'legs'], [ts, 'shield']].filter(v => v[0] > 0).sort((a, b) => a[0] - b[0])[0];
		if (!c) continue;
		/* the head wins over the body if both are met close together */
		const head = c[1] == 'head' || (c[1] == 'body' && th > 0 && th <= c[0] + 4);
		out.push({e, t: c[0], head, blocked: c[1] == 'shield'});
	}
	out.sort((a, b) => a.t - b.t);
	const hits = [];
	for (const h of out) { hits.push(h); if (h.blocked || hits.length >= (pierce || 1)) break }
	return hits;
}
function nearestHead(x, y, r) { let best = null, bd = r * r; for (const e of N.elves) { if (e.dead || e.shield) continue; const h = headOf(e), d = (h.x - x) ** 2 + (h.y - y) ** 2; if (d < bd) { bd = d; best = h } } return best }

/* ---------- effects ---------- */
/* gritty: dark ichor flying from a hit, and on a fall chunks that tumble and stain */
function splat(x, y, n, floor) { burst(x, y, n, '#2a0812', floor); burst(x, y, Math.ceil(n / 2), '#5a1a3a', floor) }
function gibs(e) { const ly = A.laneY(e.lane), s = ELF_S(e), n = e.kind == 'bloater' || e.kind == 'brute' || e.kind == 'foreman' || e.kind == 'wendigo' ? 9 : 5; for (let i = 0; i < n && N.gibs.length < 80; i++) N.gibs.push({x: e.x + (Math.random() - .5) * 10 * s, y: ly - (10 + Math.random() * 30) * s, vx: (Math.random() - .3) * 160, vy: -80 - Math.random() * 160, a: Math.random() * 6, va: (Math.random() - .5) * 14, r: (2 + Math.random() * 3) * s, fl: ly + (Math.random() - .5) * 4, col: Math.random() < .5 ? A.ELF[e.kind].cloth : A.ELF[e.kind].skin, t: 0}) }
function burst(x, y, n, col, floor) { for (let i = 0; i < n && N.fx.length < 600; i++) { const a = Math.random() * PI * 2, v = 30 + Math.random() * 120; N.fx.push({k: 'p', x, y, fl: floor || y + 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, col, life: .5 + Math.random() * .6}) } }
function fxStep() {
	for (const f of N.fx) { f.t += DT; if (f.k == 'p') { f.x += f.vx * DT; f.y += f.vy * DT; f.vy += 300 * DT; if (f.y > f.fl) { f.y = f.fl; f.vy *= -.2; f.vx *= .5 } } else if (f.k == 'fire') { f.x += f.vx * DT; f.y += f.vy * DT; f.vy -= 120 * DT } }
	N.fx = N.fx.filter(f => f.t < (f.k == 'p' ? f.life : f.k == 'rip' ? .9 : f.k == 'txt' ? (f.long ? 2.6 : .9) : f.k == 'ring' ? .4 : f.k == 'fire' ? .55 : f.k == 'beam' ? .3 : f.k == 'case' ? 1.5 : f.k == 'lob' ? .28 : .12));
	for (const s of N.slush) s.t += DT;
	for (const g of N.gibs) { g.t += DT; if (!g.rest) { g.x += g.vx * DT; g.y += g.vy * DT; g.vy += 420 * DT; g.a += g.va * DT; if (g.y > g.fl) { g.y = g.fl; g.vy *= -.25; g.vx *= .4; g.va *= .4; if (Math.abs(g.vy) < 20) g.rest = true } } } N.gibs = N.gibs.filter(g => g.t < 30);
	for (const m of N.smoke) { m.t += DT; m.y -= 14 * DT; m.x += 6 * DT } N.smoke = N.smoke.filter(m => m.t < 1.2);
	for (const f of N.fx) if (f.k == 'case') { f.x += f.vx * DT; f.y += f.vy * DT; f.vy += 500 * DT; if (f.y > f.fl) { f.y = f.fl; f.vy *= -.3; f.vx *= .5 } }
	lobStep();
	if (N.shake > 0) N.shake -= DT;
}

/* ---------- the rescue (the last night) ---------- */
function startRescue() { N.sleigh = {t: 0, x: W + 80, y: 40, phase: 'in'}; AU.music('rescue'); AU.sfx('jingle'); N.msg = {t: 0, text: 'Bells in the sky…', sub: ''} }
function rescueStep() {
	const S = N.sleigh; S.t += DT;
	if (S.phase == 'in') { S.x += (300 - S.x) * 1.4 * DT; S.y += (170 - S.y) * 1.4 * DT; if (S.t > 3.5) { S.phase = 'light'; S.t = 0; for (const e of N.elves) { e.dead = true; const ly = A.laneY(e.lane); burst(e.x, ly - 20, 14, '#ffd36e', ly); burst(e.x, ly - 20, 8, '#140a1c', ly) } N.elves = []; N.q = []; N.fx.push({k: 'ring', x: S.x, y: S.y, r: 700, t: 0, slow: true}); AU.sfx('light') } }
	else if (S.phase == 'light') { N.dawn = Math.min(.35, S.t / 3); if (S.t > 1.2 && !S.said) { S.said = true; N.say = {t: 0, who: 'Captain Quill', text: 'Easy now — there’s room for every one of you. Climb aboard!'} } if (S.t > 5.5) { S.phase = 'board'; S.t = 0 } }
	else if (S.phase == 'board') { S.board = Math.min(1, S.t / 2); if (S.t > 2.6) { S.phase = 'away'; S.t = 0; N.say = {t: 0, who: 'Rudolf', text: 'We held the line. Every night of it.'} } }
	else if (S.phase == 'away') { S.x -= 70 * DT; S.y -= 34 * DT; N.dawn = Math.min(1, .35 + S.t / 6); if (S.t > 6 && !N.over) { N.over = true; ending() } }
}

/* ---------- drawing ---------- */
function draw() {
	if (!view) return;
	const x = view.begin(); x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
	const rf = save.set.reduceFlash;
	if (screen != 'night' && cv.style.filter) { cv.style.filter = ''; AU.ring(0) }
	if (screen == 'title' || !N) { A.scene(x, W, H, T, 0, 0); for (let i = 0; i < 3; i++) { const p = survPos(i); A.survivor(x, KINDS[i], p.x, T, false, p.y) } A.rudolf(x, -.1, 'icicle', T, 0, 0, 8, 0); A.barricade(x, 1, T, 0); fakeHorde(x); A.snow(x, W, H, T); A.grit(x, W, H, T, rf); titleText(x); x.restore(); return }
	if (N.shake > 0) { const a = N.shakeAmp || 6; if (!rf || a <= 2) x.translate((Math.random() - .5) * a, (Math.random() - .5) * a * .5) }
	A.scene(x, W, H, T, G.night, N.dawn);
	if (N.wx == 'moon') { x.drawImage(A.white, W - 230, -20, 200, 200); x.beginPath(); x.arc(W - 130, 70, 32, 0, 7); x.fillStyle = '#fbf8ef'; x.fill() }
	for (const s of N.slush) A.slush(x, s, T);
	for (const g of N.gibs) if (g.rest) A.gib(x, g);
	/* the survivors and Rudolf, the long barricade, then the elves (far lanes first) */
	const board = N.sleigh && N.sleigh.board || 0, away = N.sleigh && N.sleigh.phase == 'away';
	if (!away) {
		x.globalAlpha = 1 - board;
		for (const d of N.drops) A.dropped(x, d.x, d.y);
		/* the survivors and Rudolf, far to near */
		const ppl = G.surv.map((s, i) => ({l: SURV_LANES[i % 6], f: () => { const p = survPos(i); A.survivor(x, s.kind, (s.fled ? s.runX : p.x) - board * 10, s.fled ? T * 4 : T, s.fire > 0, p.y, !s.disarmed && !s.fled, s.out, s.stun > 0) }}));
		ppl.push({l: N.rl + .01, f: () => A.rudolf(x, aimAngle(), G.cur, T, N.recoil, N.hurt, N.rl, N.rwalk)});
		ppl.sort((a, b) => a.l - b.l).forEach(o => o.f());
		x.globalAlpha = 1;
	}
	A.barricade(x, G.bar / G.barMax, T, N.barHit);
	const es = N.elves.slice().sort((a, b) => a.lane - b.lane);
	for (const sh of N.shields) A.shieldDown(x, sh.x, A.laneY(sh.lane), A.depth(sh.lane) * sh.s);
	for (const e of es) {
		A.elf(x, e, T, rf);
		/* a wendigo drawing in its screech */
		if (e.kind == 'wendigo' && e.wmode == 'charge') { const h = headOf(e), k = 1 - e.chT / CHARGE; x.strokeStyle = `rgba(150,255,120,${.3 + .5 * k})`; x.lineWidth = 2; for (let i = 0; i < 3; i++) { const r = 6 + ((T * 30 + i * 9) % 26) * (1 - k * .5); x.beginPath(); x.arc(h.x - 6, h.y + 6, r, PI * .6, PI * 1.4); x.stroke() } }
	}
	for (const g of N.gibs) if (!g.rest) A.gib(x, g);
	for (const m of N.smoke) { x.fillStyle = `rgba(150,150,160,${.28 * (1 - m.t / 1.2)})`; x.beginPath(); x.arc(m.x, m.y, m.r + m.t * 10, 0, 7); x.fill() }
	for (const s of N.spits) { x.fillStyle = '#2a1036'; x.beginPath(); x.arc(s.x, s.y, 4, 0, 7); x.fill(); x.fillStyle = '#b04dff'; x.fillRect(s.x - 1, s.y - 1, 2, 2) }
	/* shots */
	for (const f of N.fx) {
		if (f.k == 'tracer') { x.strokeStyle = {icicle: 'rgba(190,232,255,.9)', cane: 'rgba(255,120,130,.9)', bauble: 'rgba(255,215,100,.9)', bells: 'rgba(255,230,140,.9)'}[f.c] || 'rgba(230,240,255,.8)'; x.lineWidth = f.c == 'hail' ? 2.4 : 1.4; x.globalAlpha = 1 - f.t / .12; x.beginPath(); x.moveTo(f.x0, f.y0); x.lineTo(f.x1, f.y1); x.stroke(); x.globalAlpha = 1 }
		else if (f.k == 'beam') { const a = 1 - f.t / .3; x.globalCompositeOperation = 'lighter'; x.strokeStyle = `rgba(125,255,207,${a})`; x.lineWidth = 10 * a + 2; x.beginPath(); x.moveTo(f.x0, f.y0); x.lineTo(f.x1, f.y1); x.stroke(); x.strokeStyle = `rgba(180,140,255,${a * .7})`; x.lineWidth = 18 * a; x.stroke(); x.globalCompositeOperation = 'source-over' }
		else if (f.k == 'bolt') { x.strokeStyle = 'rgba(255,230,180,.8)'; x.lineWidth = 1.2; const k = Math.min(1, f.t / .1); x.beginPath(); x.moveTo(f.x0 + (f.x1 - f.x0) * k * .8, f.y0 + (f.y1 - f.y0) * k * .8); x.lineTo(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k); x.stroke() }
		else if (f.k == 'case') { x.fillStyle = '#c9a24a'; x.fillRect(f.x - 1.5, f.y - .7, 3, 1.4) }
		else if (f.k == 'lob') { const k = f.t / .28, lx = f.x0 + (f.x1 - f.x0) * k, ly = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * PI) * 60; x.fillStyle = '#d4af37'; x.beginPath(); x.arc(lx, ly, 3.5, 0, 7); x.fill() }
		else if (f.k == 'flash') x.drawImage(G.cur == 'aurora' ? A.ice : A.warm, f.x - 12, f.y - 12, 24, 24);
		else if (f.k == 'fire') { x.globalAlpha = 1 - f.t / .55; x.drawImage(A.fire, f.x - 10 - f.t * 20, f.y - 10 - f.t * 20, 20 + f.t * 40, 20 + f.t * 40); x.globalAlpha = 1 }
		else if (f.k == 'p') { x.globalAlpha = 1 - f.t / f.life; x.fillStyle = f.col; x.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); x.globalAlpha = 1 }
		else if (f.k == 'ring') { const k = f.t / .4; x.strokeStyle = f.slow ? `rgba(255,214,140,${1 - k})` : `rgba(255,176,59,${1 - k})`; x.lineWidth = 4; x.beginPath(); x.arc(f.x, f.y, f.r * k, 0, 7); x.stroke() }
		else if (f.k == 'txt') { x.globalAlpha = 1 - f.t / (f.long ? 2.6 : .9); x.font = f.long ? 'bold 12px system-ui,sans-serif' : 'bold 10px system-ui,sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffe6a0'; x.fillText(f.s, f.x, f.y - f.t * 20); x.globalAlpha = 1 }
	}
	if (N.sleigh) A.sleigh(x, N.sleigh.x, N.sleigh.y, T, N.sleigh.phase == 'light');
	A.snow(x, W, H, T);
	if (N.wx == 'moon') { x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(70,78,110,.25)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over' }
	if (!N.sleigh || N.sleigh.phase == 'in') drawVision(x);
	if (N.wx == 'blizzard') { x.strokeStyle = 'rgba(245,248,255,.7)'; x.lineWidth = 1.4; x.beginPath(); for (let i = 0; i < 160; i++) { const sx = (A.hash(i, 21) * (W + 200) - T * (260 + A.hash(i, 22) * 200)) % (W + 200), px = sx < 0 ? sx + W + 200 : sx, py = (A.hash(i, 23) * H + T * (90 + A.hash(i, 24) * 60)) % H; x.moveTo(px, py); x.lineTo(px - 12, py + 4) } x.stroke() }
	/* screeches running down their lanes (seen through fog and snow) */
	for (const v of N.waves) { const y = A.laneY(v.lane) - 30; { const g = x.createLinearGradient(v.x, 0, v.x0, 0); g.addColorStop(0, 'rgba(160,255,120,.35)'); g.addColorStop(1, 'rgba(160,255,120,0)'); x.fillStyle = g; x.fillRect(v.x, y - 10, Math.max(0, v.x0 - v.x), 20) } x.strokeStyle = 'rgba(170,255,140,.8)'; x.lineWidth = 2.4; for (let i = 0; i < 4; i++) { const xx = v.x + i * 14; x.globalAlpha = 1 - i * .22; x.beginPath(); x.ellipse(xx, y, 6 + i * 2, 26 + i * 5, 0, PI * .5, PI * 1.5); x.stroke() } x.globalAlpha = 1; }
	for (const f of N.fx) if (f.k == 'rip') { const k = f.t / .9; x.strokeStyle = `rgba(225,232,255,${(1 - k) * .8})`; x.lineWidth = f.big ? 2.2 : 1.4; for (const m of [1, .6]) { x.beginPath(); x.ellipse(f.x, f.y, (f.big ? 34 : 22) * k * m + 2, (f.big ? 14 : 9) * k * m + 1, 0, 0, 7); x.stroke() } }
	/* stunned by a screech: the sight blurs (full for 3 s, then clearing) */
	const dk = deafK(); cv.style.filter = dk > 0 ? `blur(${(dk * 3.2).toFixed(2)}px)` : ''; AU.ring(dk);
	if (N.rstun > 0) { const o = nose(); x.font = 'bold 13px system-ui,sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffd0d0'; x.fillText('Stunned!', o.x - 4, o.y - 46) }
	A.grit(x, W, H, T, rf);
	if (N.hurt > 0 && !rf) { x.fillStyle = `rgba(120,0,40,${N.hurt * .4})`; x.fillRect(0, 0, W, H) }
	hud(x);
	/* the crosshair: its gap shows the spread */
	if (!N.sleigh) {
		const w = WEP[G.cur], gap = 5 + (w.spread * (1 - G.skill * .015) + (w.pellets ? .02 : 0)) * 200;
		x.strokeStyle = N.reload > 0 ? 'rgba(255,200,120,.9)' : 'rgba(255,255,255,.9)'; x.lineWidth = 1.5;
		x.beginPath(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { x.moveTo(cross.x + a * gap, cross.y + b * gap); x.lineTo(cross.x + a * (gap + 6), cross.y + b * (gap + 6)) } x.stroke();
		x.fillStyle = '#fff'; x.fillRect(cross.x - 1, cross.y - 1, 2, 2);
			/* the shot's line: where it will cross the crosshair's column (it differs when the aim is at its limit) */
			if (w.fx != 'boom') { const sh = shoulder(), a = aimAngle(), ty = sh.y + Math.tan(a) * Math.max(8, cross.x - sh.x); if (Math.abs(ty - cross.y) > 3) { x.strokeStyle = 'rgba(255,90,90,.85)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cross.x, ty, 4, 0, 7); x.stroke(); x.setLineDash([2, 4]); x.beginPath(); x.moveTo(cross.x, cross.y); x.lineTo(cross.x, ty); x.stroke(); x.setLineDash([]) } }
		if (N.reload > 0) { const k = 1 - N.reload / (w.reload * RELOAD_K * (1 - G.skill * .01)); x.strokeStyle = '#ffd36e'; x.lineWidth = 2; x.beginPath(); x.arc(cross.x, cross.y, gap + 10, -PI / 2, -PI / 2 + k * PI * 2); x.stroke() }
	}
	x.restore();
}
function hud(x) {
	x.fillStyle = 'rgba(5,6,14,.6)'; x.fillRect(0, 0, W, 28);
	x.font = 'bold 13px system-ui,sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#f1e9ff';
	x.fillText('Day ' + (N.night || G.night) + ' of ' + LAST + ' · night · ' + WX[N.wx].icon + ' ' + WX[N.wx].name, 8, 14);
	x.font = '11px system-ui,sans-serif'; x.fillStyle = '#c9c2dd';
	const left = G.night == LAST ? (N.sleigh ? 'The sleigh is here!' : 'The sleigh comes in ' + Math.max(0, Math.ceil(SLEIGH_AT - N.t)) + ' s') : (N.q.length + N.elves.length) + ' left';
	x.fillText(left, 250, 14);
	const bar = (X, label, v, max, col) => { x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(X, 9, 110, 10); x.fillStyle = col; x.fillRect(X, 9, 110 * Math.max(0, v / max), 10); x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(label, X - 4, 14); x.textAlign = 'left' };
	bar(W - 400, 'Barricade', G.bar, G.barMax, G.bar / G.barMax < .3 ? '#e0603a' : '#b98a4a'); bar(W - 150, 'Rudolf', G.hp, 100, '#ff6f91');
	/* the weapon */
	const w = WEP[G.cur], st = G.wp[G.cur];
	x.fillStyle = 'rgba(5,6,14,.55)'; x.fillRect(W - 200, H - 34, 196, 30);
	x.textAlign = 'left'; x.font = 'bold 12px system-ui,sans-serif'; x.fillStyle = '#fff'; x.fillText(w.name, W - 192, H - 25);
	x.font = '11px system-ui,sans-serif'; x.fillStyle = st.mag ? '#d8e4ff' : '#ff9f9f';
	x.fillText((N.reload > 0 ? 'Reloading… ' : '') + st.mag + ' / ' + w.mag + '  ·  ∞', W - 192, H - 12);
	/* banners and words */
	if (N.msg && N.msg.t < 3.5) { N.msg.t += DT; const a = Math.min(1, N.msg.t * 2, (3.5 - N.msg.t) * 2); x.globalAlpha = a; x.textAlign = 'center'; x.font = 'bold 26px system-ui,sans-serif'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(N.msg.text, W / 2, 120); x.fillStyle = '#f4ecff'; x.fillText(N.msg.text, W / 2, 120); if (N.msg.sub) { x.font = '13px system-ui,sans-serif'; x.strokeText(N.msg.sub, W / 2, 146); x.fillStyle = '#d6ccf0'; x.fillText(N.msg.sub, W / 2, 146) } x.globalAlpha = 1 }
	if (N.say && N.say.t < 5) { N.say.t += DT; const a = Math.min(1, N.say.t * 3, (5 - N.say.t) * 2); x.globalAlpha = a; x.fillStyle = 'rgba(10,12,30,.8)'; x.fillRect(80, 52, W - 160, 44); x.textAlign = 'left'; x.font = 'bold 11px system-ui,sans-serif'; x.fillStyle = '#ffd36e'; x.fillText(N.say.who, 92, 64); x.font = '13px system-ui,sans-serif'; x.fillStyle = '#fff'; x.fillText(N.say.text, 92, 82); x.globalAlpha = 1 }
	if (N.won && G.night < LAST) { x.textAlign = 'center'; x.font = 'bold 24px system-ui,sans-serif'; x.fillStyle = '#ffe9c8'; x.fillText('The night is over', W / 2, 150) }
}
function fakeHorde(x) { for (let i = 0; i < 6; i++) { const e = {id: i + 1, kind: ['shambler', 'sprinter', 'mugger', 'bloater', 'crawler', 'shambler'][i], x: 520 + i * 84 + Math.sin(T * .3 + i) * 6, lane: [2, 9, 5, 12, 7, 13][i], walk: T * 2 + i, chill: 0, burn: 0, hitT: 0}; A.elf(x, e, T, save.set.reduceFlash) } }
function titleText(x) {
	x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 54px Impact,"Arial Black",system-ui,sans-serif'; x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText('25 DAYS', W / 2, 66);
	const g = x.createLinearGradient(0, 40, 0, 92); g.addColorStop(0, '#e8e2d8'); g.addColorStop(1, '#8a1622'); x.fillStyle = g; x.fillText('25 DAYS', W / 2, 66);
	x.fillStyle = 'rgba(40,6,12,.8)'; for (let i = 0; i < 7; i++) { const dx = W / 2 - 100 + A.hash(i, 51) * 200, dl = 6 + A.hash(i, 52) * 16; x.fillRect(dx, 84, 2, dl); x.beginPath(); x.arc(dx + 1, 84 + dl, 1.8, 0, 7); x.fill() }
	x.font = '13px system-ui,sans-serif'; x.fillStyle = '#c9c2bd'; x.lineWidth = 5; x.strokeText('Twenty-five days. One barricade.', W / 2, 112); x.fillText('Twenty-five days. One barricade.', W / 2, 112);
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
		case 'groan': tone(out, t, 90 + Math.random() * 30, .9, 'sawtooth', N && N.wx == 'fog' ? .06 : .035, 60); break;
		case 'screech': tone(out, t, 1900, 1.6, 'sawtooth', .09, 380); tone(out, t + .05, 2300, 1.4, 'square', .04, 500); nz(out, t, 1.4, .18, 3500, 'bandpass'); break;
		case 'wcharge': { /* a long, rasping inhale: breath noise rising in pitch and loudness over 1.5 s */
			const sb = C.createBufferSource(); sb.buffer = noise; sb.loop = true; const fi = C.createBiquadFilter(); fi.type = 'bandpass'; fi.Q.value = 1.6; fi.frequency.setValueAtTime(500, t); fi.frequency.exponentialRampToValueAtTime(2600, t + 1.45);
			const a = C.createGain(); a.gain.setValueAtTime(.0001, t); a.gain.exponentialRampToValueAtTime(.32, t + 1.35); a.gain.exponentialRampToValueAtTime(.0001, t + 1.5);
			sb.connect(fi); fi.connect(a); a.connect(out); sb.start(t); sb.stop(t + 1.52); tone(out, t, 90, 1.5, 'sawtooth', .025, 140); break }
		case 'wscreech': tone(out, t, 2400, .9, 'sawtooth', .11, 900); tone(out, t, 1700, .9, 'square', .05, 600); nz(out, t, .8, .25, 3000, 'bandpass'); break;
		case 'ring': break;
		case 'clang': tone(out, t, 1200, .12, 'square', .05, 900); tone(out, t, 2600, .2, 'sine', .04); break;
		case 'bash': nz(out, t, .12, .3, 500); tone(out, t, 150, .1, 'sine', .2, 80); break;
		case 'thud': nz(out, t, .18, .25, 300); break;
		case 'hurt': tone(out, t, 300, .2, 'square', .06, 150); break;
		case 'spit': nz(out, t, .2, .15, 1200, 'bandpass'); break;
		case 'bolt': tone(out, t, 900, .05, 'triangle', .04, 500); break;
		case 'jingle': for (let i = 0; i < 10; i++) tone(out, t + i * .09, [2093, 2637, 3136][i % 3], .2, 'sine', .05); break;
		case 'steal': tone(out, t, 700, .12, 'square', .05, 1100); tone(out, t + .1, 500, .15, 'square', .05, 300); break;
		case 'lost': tone(out, t, 400, .5, 'triangle', .07, 150); break;
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
	/* the ringing after a screech (k 0..1): a high tone, and the rest muffled */
	let ringO = null, ringG = null;
	function ring(k) {
		if (!C) return;
		if (k > 0 && !ringO && save.set.sfx) { ringO = C.createOscillator(); ringG = C.createGain(); ringO.type = 'sine'; ringO.frequency.value = 6800; ringG.gain.value = 0; ringO.connect(ringG); ringG.connect(C.destination); ringO.start() }
		if (ringG) ringG.gain.setTargetAtTime(.05 * k, C.currentTime, .05);
		if (out) out.gain.setTargetAtTime(.5 * (1 - .8 * k), C.currentTime, .05);
		if (k <= 0 && ringO) { const o = ringO; setTimeout(() => { try { o.stop() } catch (e) {} }, 300); ringO = ringG = null }
	}
	return {sfx, music, ring, unlock: on, hold(v) { held = v; if (C) try { v ? C.suspend() : C.resume() } catch (e) {} }, stop() { clearInterval(timer); track = null }};
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
	const p = G.plan, wx = wxOf(G.night), noSearch = wx == 'blizzard';
	if (noSearch && p.search) { p.repair = Math.min(12, p.repair + p.search); p.search = 0 }
	const used = p.repair + p.search + p.train;
	const row = (k, label, what, off) => `<div class="hrow${off ? ' off' : ''}"><span><b>${label}</b><small>${what}</small></span><button data-h="${k}" data-d="-1" aria-label="Fewer hours for ${label}"${off ? ' disabled' : ''}>−</button><b class="hn">${p[k]} h</b><button data-h="${k}" data-d="1" aria-label="More hours for ${label}"${off ? ' disabled' : ''}>+</button></div>`;
	const owned = ORDER.filter(k => G.wp[k].have).map(k => WEP[k].name).join(', ');
	let html = `<h2>Day ${G.night} · before Night ${G.night}</h2>` + radio() + `<p>The barricade: <b>${Math.round(G.bar)} / ${G.barMax}</b>. Rudolf: <b>${Math.round(G.hp)}</b>. ${12 - used} of 12 hours left to plan.</p>` +
		row('repair', 'Repair', '+70 to the barricade an hour') +
		row('search', 'Search', noSearch ? 'not in a blizzard' : wx == 'fog' ? 'slow and risky in the fog' : wx == 'clear' ? 'weapons, scrap, survivors; quicker today' : 'weapons, scrap, survivors', noSearch) +
		row('train', 'Train', 'steadier aim and faster reloads, for Rudolf and the survivors (' + G.skill + '/30)');
	if (G.surv.length) html += '<h3>Survivors</h3>' + G.surv.map((s, i) => `<div class="hrow"><span><b>${s.name}</b><small>a ${s.kind}</small></span><button data-s="${i}" class="role">${ROLES[s.role].split(' (')[0]}</button></div>`).join('');
	html += `<p class="small">Carrying: ${owned}.</p>`;
	if (G.night == LAST - 1 && !G.letter) html += '<p class="note">A snowy owl lands on the barricade with a note tied to its leg: <i>“Hold on through the storm, to the end of the twenty-fifth night. I am coming for all of you. — Captain Quill”</i></p>';
	dialog(html, [['Spend the day', runDay, 1], ['Save and quit', toTitle, 0, 1]], 'day');
	document.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { const k = b.dataset.h, d = +b.dataset.d, u = p.repair + p.search + p.train; if (d > 0 && u >= 12) return; if (k == 'search' && noSearch) return; p[k] = Math.max(0, p[k] + d); AU.sfx('ok'); dayScreen(); const nb = document.querySelector(`[data-h="${k}"][data-d="${d}"]`); nb && nb.focus() });
	document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = G.surv[+b.dataset.s], ks = Object.keys(ROLES); s.role = ks[(ks.indexOf(s.role) + 1) % ks.length]; dayScreen(); const nb = document.querySelector(`[data-s="${b.dataset.s}"]`); nb && nb.focus() });
}
/* the weather radio: tonight, tomorrow night, and warnings */
function radio() {
	const n = G.night, t = wxOf(n), m = n < LAST ? wxOf(n + 1) : null;
	let h = `<div class="radio" role="status" aria-label="Weather radio"><b>📻 Weather radio</b><p><b>${WX[t].icon} Tonight, Night ${n}: ${WX[t].name}.</b> ${WX[t].tonight}</p>`;
	if (m) h += `<p><b>Tomorrow night:</b> ${WX[m].tomorrow}.</p>`;
	if (n == 22) h += '<p class="warn">⚠ Storm warning: a great blizzard comes in tomorrow and will not let up for three nights. No searching then; tonight and today are the last chance.</p>';
	else if (m == 'blizzard' && t != 'blizzard') h += '<p class="warn">⚠ Blizzard warning for tomorrow: nobody will be able to search. Search today if you need to.</p>';
	return h + '</div>';
}
function runDay() {
	const p = G.plan, rng = RG.rng(G.seed + ':day:' + G.night), out = [];
	if (G.night == LAST - 1) G.letter = true;
	const rep = p.repair * 70 + G.surv.filter(s => s.role == 'repair').length * 50, before = G.bar;
	G.bar = Math.min(G.barMax, G.bar + rep); if (G.bar > before) out.push('Repaired the barricade: +' + Math.round(G.bar - before) + '.');
	const wx = wxOf(G.night), scouts = G.surv.filter(s => s.role == 'scout');
	let hours = wx == 'blizzard' ? 0 : p.search + scouts.length;
	if (wx == 'blizzard') out.push('The blizzard kept everyone inside: no searching today.');
	/* clear days: searching goes quicker (about a third more done); fog: less is found, and scouts may not come back */
	if (wx == 'clear') hours += Math.floor(hours * .3 + rng());
	const f = wx == 'fog' ? .55 : 1;
	if (wx != 'blizzard') for (const sc of scouts) if (rng() < (wx == 'fog' ? .12 : .03)) { G.surv.splice(G.surv.indexOf(sc), 1); out.push('<b>' + sc.name + '</b> went out to search and did not come back' + (wx == 'fog' ? ' from the fog.' : '.')) }
	for (let h = 0; h < hours; h++) {
		const r = rng();
		const next = ORDER.find(k => !G.wp[k].have && WEP[k].night <= G.night);
		const pw = next ? (.12 + Math.min(G.night, 15) * .02) * f : 0, pa = pw + .28 * f, ps = pa + .12 * f, pb = ps + .13;
		if (next && r < pw) { G.wp[next].have = true; G.wp[next].mag = WEP[next].mag; out.push('<b>Found the ' + WEP[next].name + '!</b> ' + WEP[next].desc) }
		else if (r < pa) { const n = Math.round(30 + rng() * 40), b0 = G.bar; G.bar = Math.min(G.barMax, G.bar + n); out.push(G.bar > b0 ? 'Scrap wood and nails from the sheds: the barricade +' + Math.round(G.bar - b0) + '.' : 'Scrap from the sheds, but the barricade is whole.') }
		else if (r < ps && G.surv.length < 6) { const used = new Set(G.surv.map(s => s.name)), free = NAMES.filter(n => !used.has(n)), nm = free[Math.floor(rng() * free.length)]; const kind = KINDS[Math.floor(rng() * KINDS.length)]; G.surv.push({name: nm, kind, role: 'guard'}); out.push('<b>' + nm + '</b>, a ' + kind + ', was hiding in the old mill and joins the barricade.') }
		else if (r < pb) { G.hp = Math.min(100, G.hp + 15); out.push('Found bandages and a flask of cocoa: Rudolf +15.') }
		else out.push(wx == 'fog' ? 'Searched blind in the fog: nothing found.' : 'Searched the woods’ edge: nothing but snow.');
	}
	if (p.train) { const s0 = G.skill; G.skill = Math.min(30, G.skill + p.train); if (G.skill > s0) out.push('Practised at the barricade, everyone: aim ' + G.skill + '/30.') }
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
	dialog(`<h2>Dawn</h2><p>The sleigh climbs into a pink sky. Below, the barricade stands where Rudolf and ${G.surv.length ? G.surv.length + ' friends' : 'his friends'} kept it for twenty-five nights.</p><p>${G.kills} elves fell to the corruption’s end; ${G.heads} by the eyes. Accuracy ${acc}%.</p><p><b>Thank you for holding the line.</b></p>`, [['Title', toTitle, 1]]);
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
	const b = d => [DIFF[d].name, () => { save.set.diff = d; newRun(d); save.run = snapshot(); persist(); AU.music('day'); dayScreen() }, save.set.diff == d];
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
		'<p><b>Move:</b> W and S, or the up and down arrows (or a controller’s left stick, or drag behind the barricade) take Rudolf up and down behind the barricade. He can only aim a little up or down, so move him to the lane you want.</p><p><b>Shoot:</b> click towards where to shoot (hold for automatic weapons), or tap the field, or fire with Z, Space or a trigger; left and right (or the right stick) move the crosshair. Shots fly on past the crosshair until they hit something; the Ornament Launcher bursts at the crosshair. Their <b>glowing eyes</b> are the weak spot. Ammunition never runs out, but you still reload.</p><p><b>The eyes say what they will do:</b> white, the ordinary ones; <b style="color:#ff5a5a">red</b>, sprinters that dash for the barricade; <b style="color:#ffd23f">yellow</b>, bloaters that burst when they fall, hurting everything near (the barricade and your survivors too); <b style="color:#7dff4a">green</b>, muggers that weave between lanes and steal a survivor’s weapon: bring them down before they get back to the woods.</p>' +
		'<p><b>Reload:</b> R, right-click, X on a controller, or the Reload button. <b>Weapons:</b> 1–9, Q and E, the bumpers, or the buttons below the field.</p>' +
		'<p><b>By day</b> plan twelve hours: repair the barricade, search for weapons, scrap and survivors, or train (training steadies everyone’s aim: survivors miss a lot until they have trained). Survivors can guard, repair or scout. If the barricade falls below 5%, they panic, drop their crossbows and run until morning.</p>' +
		'<p><b>The weather radio</b> on each day’s plan tells tonight’s weather and tomorrow’s. <b>Clear:</b> searching goes quicker. <b>Fog:</b> you only see what Rudolf’s nose lights, towards the crosshair; out of the light they show as ripples of sound; searching is slow and risky. <b>Blizzard:</b> even less to see, no ripples, no searching, the survivors’ aim suffers, but nothing sprints. <b>Full moon:</b> once a game; bright, but every white-eyed elf turns red-eyed and runs, and a wendigo comes.</p>' +
		'<p><b style="color:#3ff0ff">Cyan eyes</b>: shielders, behind a shield that stops every shot; aim for their lower legs, or knock the shield loose with a blast or a <b>Bash</b> (F, Y on a controller, the middle button, or ✊ Bash) when they reach the barricade. From Night 10 they go back for their shields; from Night 18 other elves may take up a fallen shielder’s.</p>' +
		'<p>A <b>screech</b> from the woods means a <b>wendigo</b>: something like a huge, corrupted Rudolf with green eyes and a frothing mouth, very hard to bring down, slowly coming for Rudolf’s lane. When it stops and draws a long breath (about a second and a half), its screech runs down its lane to the barricade and beyond: survivors in its path are stunned, and if it reaches Rudolf his sight blurs and his ears ring for a few seconds. It does not harm the barricade. Move Rudolf out of its lane.</p>' +
		'<p>Hold out for twenty-five days and nights.</p>', [['OK', back || null, 1, 1]], 'title');
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
	const bb = document.createElement('button'); bb.textContent = '✊ Bash'; bb.className = 'rl'; bb.title = 'A blow over the barricade at an elf against it: knocks a shield loose (F)'; bb.onclick = () => { bash(); cv.focus() }; el.appendChild(bb);
	const r = document.createElement('button'); r.textContent = '⟳ Reload'; r.onclick = () => { startReload(); cv.focus() }; el.appendChild(r);
}
function pick(k) { if (!G.wp[k] || !G.wp[k].have || k == G.cur) return; G.cur = k; N.reload = 0; N.burst = 0; N.spin = 0; N.cd = Math.max(N.cd, .25); AU.sfx('reload'); bar() }
function cycle(d) { const own = ORDER.filter(k => G.wp[k].have); pick(own[(own.indexOf(G.cur) + d + own.length) % own.length]) }

/* ---------- input ---------- */
function bindings() {
	RG.bind({left: ['ArrowLeft', 'KeyA', 'pad:14'], right: ['ArrowRight', 'KeyD', 'pad:15'], up: ['ArrowUp', 'KeyW', 'pad:12'], down: ['ArrowDown', 'KeyS', 'pad:13'],
		fire: ['KeyZ', 'Space', 'pad:7', 'pad:0'], reload: ['KeyR', 'pad:2'], bash: ['KeyF', 'pad:3'], prev: ['KeyQ', 'pad:4'], next: ['KeyE', 'pad:5'], pause: ['Escape', 'KeyP', 'pad:9'],
		ok: ['KeyZ', 'pad:0'], back: ['KeyX', 'Backspace', 'pad:1'],
		w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], w4: ['Digit4'], w5: ['Digit5'], w6: ['Digit6'], w7: ['Digit7'], w8: ['Digit8'], w9: ['Digit9']});
}
let mouseDown = false, padFire = false, keyFire = false, rMove = 0, dragY = null;
function pointerSetup() {
	cv.style.touchAction = 'none';
	cv.addEventListener('contextmenu', e => e.preventDefault());
	const at = e => { const p = view.toGame(e.clientX, e.clientY); cross.x = Math.max(0, Math.min(W, p.x)); cross.y = Math.max(30, Math.min(H, p.y)) };
	cv.addEventListener('pointermove', e => { if (!view) return; if (dragY != null) { const p = view.toGame(e.clientX, e.clientY); dragY = p.y; return } at(e) });
	cv.addEventListener('pointerdown', e => {
		AU.unlock(); RG.lastInput = e.pointerType == 'touch' ? 'touch' : 'mouse'; if (!view) return; at(e);
		if (screen != 'night' || !N || N.sleigh) return;
		/* a press behind the barricade (touch, or the mouse) moves Rudolf to it instead of shooting */
		if (e.button == 0 && cross.x < A.BX - 10) { dragY = cross.y; try { cv.setPointerCapture(e.pointerId) } catch (x) {} return }
		if (e.button == 2) { startReload(); return }
		if (e.button == 1) { e.preventDefault(); bash(); return }
		if (e.button != 0) return;
		try { cv.setPointerCapture(e.pointerId) } catch (x) {}
		mouseDown = true; firePressed = true;
	});
	const up = () => { mouseDown = false; dragY = null };
	cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
	cv.addEventListener('wheel', e => { if (screen == 'night' && N) { cycle(e.deltaY > 0 ? 1 : -1); e.preventDefault() } }, {passive: false});
}
function inputStep() {
	/* W/S or the arrows (or a controller's left stick, or a drag behind the barricade) move Rudolf up and down; left and
	   right move the crosshair; the right stick moves the crosshair anywhere */
	let mv = (RG.down('down') ? 1 : 0) - (RG.down('up') ? 1 : 0), ax = (RG.down('right') ? 1 : 0) - (RG.down('left') ? 1 : 0), ay = 0;
	try { for (const g of navigator.getGamepads ? navigator.getGamepads() : []) { if (!g) continue; const lx = g.axes[0] || 0, ly = g.axes[1] || 0, rx = g.axes[2] || 0, ry = g.axes[3] || 0;
		if (Math.abs(ly) > .2) { mv += ly; RG.lastInput = 'pad' } if (Math.abs(lx) > .2) { ax += lx; RG.lastInput = 'pad' } if (Math.abs(rx) > .15 || Math.abs(ry) > .15) { ax += rx; ay += ry; RG.lastInput = 'pad' } } } catch (e) {}
	if (dragY != null) { const target = Math.max(0, Math.min(A.LANES - 1, (dragY - A.laneY(0) + 40) / (A.laneY(1) - A.laneY(0)))); mv = Math.max(-1, Math.min(1, (target - N.rl) * 1.5)) }
	rMove = Math.max(-1, Math.min(1, mv));
	/* the crosshair keeps its height relative to Rudolf as he moves (so the aim stays put) */
	const y0 = shoulder().y;
	cross.x = Math.max(0, Math.min(W, cross.x + ax * 380 * DT)); cross.y = Math.max(30, Math.min(H, cross.y + ay * 380 * DT));
	N.lastSy = N.lastSy == null ? y0 : N.lastSy;
	if (RG.lastInput != 'mouse' && RG.lastInput != 'touch') cross.y = Math.max(30, Math.min(H, cross.y + (y0 - N.lastSy)));
	N.lastSy = y0;
	const kf = RG.down('fire'); if (RG.pressed('fire')) firePressed = true;
	fireHeld = mouseDown || kf;
	if (RG.pressed('reload')) startReload();
	if (RG.pressed('bash')) bash();
	if (N.rstun > 0) { cross.x += Math.sin(T * 9) * 1.2; cross.y += Math.cos(T * 7) * .8 }
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
	window.__fb = {W, H, LAST, VIS, aimAngle, shoulder, bash, dropShield, shieldBox, legsOf, deafK, CHARGE, headOf, bodyOf, nightCount, hpMul, wildChance, pickKind, survPos, BLOAT_R, makeWeather, wxOf, seen, radio, get G() { return G }, get N() { return N }, set G(v) { G = v }, save: () => save, newRun, startNight, nightStep, dawn, runDay, dayScreen, WEP, cross, spawn: k => spawn(k), pick, fire: () => { firePressed = true }, hold: v => { mouseDown = v },
		run(n) { for (let i = 0; i < n && N && !N.over; i++) { inputStep(); nightStep() } return N && {t: N.t, elves: N.elves.length, q: N.q.length, bar: G.bar, hp: G.hp, kills: G.kills} }};
}
start();
})();
