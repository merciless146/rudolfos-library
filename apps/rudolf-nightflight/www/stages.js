/* ===== Night Flight: the stages. Stages 1-2 are bright (the corruption is only beginning); 3-6, darker, come later
   (docs/plan-games.md). A stage: its place (art.js), music, length, a list of [time, spawn] and a boss with named phases.
   Everything here uses NF's seeded random (NF.R), so a flight can be replayed exactly. GPL-2.0-or-later. ===== */
(function () {
'use strict';
const N = window.NF, ART = window.NFART, W = N.W, H = N.H, PI = Math.PI;
const fair = e => e.y > 10 && e.y < H * .62;   /* enemies do not fire from right next to Rudolf */

/* ---------- enemies ---------- */
/* a line of shard ornaments crossing on a wave, each firing once at Rudolf */
function mites(side, y, n, col) {
	for (let i = 0; i < n; i++) {
		const e = N.enemy('mite', side < 0 ? -20 - i * 26 : W + 20 + i * 26, y, 3, (e, dt) => {
			e.x += e.d.vx * dt; e.y = e.d.y0 + Math.sin(e.t * 2.6 + i) * 26 + e.t * 22;
			if (fair(e) && e.t > e.d.fire && !e.d.shot) { e.d.shot = 1; N.bullet(e.x, e.y, N.aim(e.x, e.y), 130, 'ball', col || 'pink') }
		}, {score: 100, drop: [[i % 3 ? 'gift' : 'glow', 1]]});
		e.d.vx = side < 0 ? 105 : -105; e.d.y0 = y; e.d.fire = 1.2 + N.R() * 1.8;
	}
}
/* a cracked bauble: drops in, rings out, leaves */
function bauble(x, col, rings) {
	N.enemy('bauble', x, -20, 16, (e, dt) => {
		if (e.t < 1.2) e.y += (120 - e.y) * 2.4 * dt;
		else if (e.t < 1.2 + (rings || 2) * 1.1) { if (N.every(e, 'r', 1.1)) N.ring(e.x, e.y, N.n(14), 95, 'ball', col || 'cyan', e.t) }
		else e.y -= 70 * dt;
	}, {score: 600, drop: [['glow', 2], ['gift', 1]]});
}
/* a wind-up toy marching down, firing aimed fans */
function windup(x, col) {
	N.enemy('windup', x, -24, 34, (e, dt) => {
		e.y += (e.t < 1.5 ? 70 : 22) * dt; e.x += Math.sin(e.t * 1.5) * 18 * dt;
		if (fair(e) && N.every(e, 'f', 1.3)) N.fan(e.x, e.y + 8, N.aim(e.x, e.y), N.n(5), .7, 150, 'rice', col || 'violet');
	}, {score: 1500, drop: [['glow', 3], ['gift', 2]]});
}
/* a dark snow-wisp swooping down and across, leaving slow flakes */
function wisp(x, dir, col) {
	N.enemy('wisp', x, -20, 7, (e, dt) => {
		e.y += 150 * dt * Math.max(.3, 1 - e.t * .4); e.x += dir * 120 * Math.min(1, e.t) * dt;
		if (fair(e) && N.every(e, 'f', .45)) N.bullet(e.x, e.y, PI / 2 + (N.R() - .5) * .6, 60, 'flake', col || 'white', {acc: 20, max: 110});
	}, {score: 300, drop: [['gift', 1]]});
}
/* a snow bunny, corrupted: drifts down; save it with the beam or a Glow Burst */
function bunny(x) {
	N.enemy('bunny', x, -20, 999, (e, dt) => {
		e.y += 38 * dt; e.x += Math.sin(e.t * 1.8) * 40 * dt;
		if (fair(e) && N.every(e, 'f', 2.2)) N.fan(e.x, e.y, PI / 2, 3, .5, 80, 'ball', 'violet');
	}, {friend: true, score: 0, r: 13});
}

/* ---------- stage 1: the village ---------- */
function stage1() {
	const w = [], at = (t, f) => w.push([t, f]);
	at(3, () => mites(-1, 90, 5));
	at(6, () => mites(1, 150, 5, 'cyan'));
	at(9.5, () => { bauble(W * .3); bauble(W * .7) });
	at(13, () => mites(-1, 70, 6, 'yellow'));
	at(14, () => mites(1, 130, 6, 'yellow'));
	for (let i = 0; i < 6; i++) at(18 + i * .5, () => wisp(30 + i * 22, 1));
	at(21, () => bunny(W * .5));
	at(24, () => windup(W * .5));
	at(28, () => { bauble(W * .2, 'pink', 3); bauble(W * .8, 'pink', 3) });
	for (let i = 0; i < 6; i++) at(32 + i * .5, () => wisp(W - 30 - i * 22, -1, 'yellow'));
	at(35, () => mites(-1, 60, 7)); at(36, () => mites(1, 100, 7, 'cyan'));
	at(40, () => { windup(W * .25); windup(W * .75) });
	at(44, () => bunny(W * .3));
	at(46, () => bauble(W * .5, 'violet', 3));
	for (let i = 0; i < 8; i++) at(50 + i * .4, () => wisp(20 + (i * 47) % (W - 40), i % 2 ? 1 : -1));
	at(54, () => { mites(-1, 80, 6, 'pink'); mites(1, 80, 6, 'pink') });
	at(58, () => { windup(W * .5); bauble(W * .15); bauble(W * .85) });
	at(63, () => bunny(W * .7));
	at(64, () => { mites(-1, 120, 8, 'yellow') });
	return {name: 'Stage 1 · Snowlight Village', sub: 'Something has crept in among the lights', bg: 'village', music: 's1', len: 70, waves: w, boss: grumblewreath()};
}
/* Grumblewreath: the village's wreath, gone thorny */
function grumblewreath() {
	return {name: 'Grumblewreath', freed: 'Grumblewreath is a wreath again!', art: ART.wreath, good: ART.wreathGood, r: 40, rotate: .4, phases: [
		{name: 'Holly Spiral', hp: 650, time: 36, fn(e, dt) {
			e.x = W / 2 + Math.sin(e.pt * .6) * 70; e.y = 130 + Math.sin(e.pt * 1.2) * 12;
			if (N.every(e, 's', .09)) { e.d.a = (e.d.a || 0) + .27; for (let k = 0; k < 2; k++) N.bullet(e.x, e.y, e.d.a + k * PI, 120, 'rice', 'cyan') }
			if (N.every(e, 'f', 1.6)) N.fan(e.x, e.y, N.aim(e.x, e.y), N.n(5), .8, 160, 'ball', 'pink');
		}},
		{name: 'Bauble Rain', hp: 750, time: 40, fn(e, dt) {
			N.towards(e, W / 2, 110, 2, dt);
			if (N.every(e, 'r', .14)) N.bullet(20 + N.R() * (W - 40), -10, PI / 2, 40, 'ball', ['pink', 'yellow', 'cyan', 'violet'][e.d.r % 4 || 0], {acc: 70 + N.R() * 40, max: 200, r: 5});
			if (N.every(e, 'g', 1.4)) N.ring(e.x, e.y, N.n(16), 100, 'ball', 'yellow', e.pt);
		}},
		{name: 'Wreath Crown', hp: 850, time: 45, fn(e, dt) {
			e.x = W / 2 + Math.sin(e.pt * .8) * 50;
			if (N.every(e, 'c', 1.8)) N.ring(e.x, e.y, N.n(20), 150, 'ball', 'pink', e.pt, {acc: -260, min: 0, wait: [.75, 145, true]});
			if (N.every(e, 's', .5)) N.ring(e.x, e.y, N.n(6), 90, 'star', 'yellow', e.pt * 1.7, {curve: .4});
		}}]};
}

/* ---------- stage 2: the pine woods by the workshop ---------- */
function stage2() {
	const w = [], at = (t, f) => w.push([t, f]);
	for (let i = 0; i < 6; i++) at(3 + i * .4, () => wisp(W * .5 + (i % 2 ? 1 : -1) * (20 + i * 15), i % 2 ? 1 : -1, 'cyan'));
	at(6.5, () => { mites(-1, 70, 7, 'orange'); mites(1, 110, 7, 'orange') });
	at(10, () => { windup(W * .3, 'blue'); windup(W * .7, 'blue') });
	at(14, () => bunny(W * .25)); at(15, () => bunny(W * .75));
	at(17, () => { bauble(W * .5, 'orange', 3) });
	for (let i = 0; i < 10; i++) at(21 + i * .3, () => wisp(15 + (i * 61) % (W - 30), i % 2 ? 1 : -1, 'white'));
	at(25, () => { bauble(W * .2, 'cyan', 2); bauble(W * .8, 'cyan', 2); windup(W * .5, 'violet') });
	at(30, () => { mites(-1, 60, 8, 'pink'); mites(1, 60, 8, 'pink') });
	at(32, () => { mites(-1, 140, 8, 'cyan') });
	at(36, () => { windup(W * .2, 'orange'); windup(W * .5, 'orange'); windup(W * .8, 'orange') });
	at(40, () => bunny(W * .5));
	at(43, () => { bauble(W * .35, 'violet', 3); bauble(W * .65, 'violet', 3) });
	for (let i = 0; i < 12; i++) at(48 + i * .3, () => wisp(W - 15 - (i * 53) % (W - 30), i % 2 ? -1 : 1, 'yellow'));
	at(52, () => { mites(-1, 90, 9, 'lime'); mites(1, 50, 9, 'lime') });
	at(56, () => { windup(W * .3, 'pink'); windup(W * .7, 'pink'); bunny(W * .5) });
	at(61, () => { bauble(W * .15, 'yellow', 3); bauble(W * .5, 'yellow', 3); bauble(W * .85, 'yellow', 3) });
	at(66, () => { mites(-1, 70, 10, 'orange'); mites(1, 120, 10, 'cyan') });
	at(70, () => { windup(W * .5, 'violet'); bunny(W * .2); bunny(W * .8) });
	return {name: 'Stage 2 · The Whispering Pines', sub: 'The workshop’s lights have started to flicker', bg: 'woods', dark: .25, music: 's2', len: 78, waves: w, boss: cuckoo()};
}
/* The Cuckoo Clockwork: the workshop's clock, wound wrong */
function cuckoo() {
	return {name: 'The Cuckoo Clockwork', freed: 'The clock keeps good time again!', art: ART.clock, good: ART.clockGood, r: 42,
		overlay(x, e, bob) { if (e.restored) return; const cx = e.x, cy = e.y - 5 + bob; ART.hand(x, cx, cy, 14, e.t * .5 - PI / 2, '#d6ff4a', 3); ART.hand(x, cx, cy, 20, e.t * 3 - PI / 2, '#ff4fa3', 2) },
		phases: [
		{name: 'Pendulum Sweep', hp: 750, time: 40, fn(e, dt) {
			N.towards(e, W / 2, 130, 2, dt);
			const sw = Math.sin(e.pt * 1.6) * .9;
			if (N.every(e, 'p', .07)) { N.bullet(e.x - 18, e.y + 68, PI / 2 + sw, 150, 'rice', 'orange'); N.bullet(e.x + 18, e.y + 68, PI / 2 - sw, 150, 'rice', 'orange') }
			if (N.every(e, 'a', 2)) N.fan(e.x, e.y - 50, N.aim(e.x, e.y - 50), N.n(7), .9, 170, 'ball', 'cyan');
		}},
		{name: 'Twelve Chimes', hp: 850, time: 45, fn(e, dt) {
			e.x = W / 2 + Math.sin(e.pt * .5) * 60;
			if (N.every(e, 'c', .9)) { const n = (e.d.c || 0) % 12; for (let k = 0; k < N.n(12); k++) N.bullet(e.x, e.y - 5, k / N.n(12) * PI * 2 + n * .2, 110, 'ball', n % 2 ? 'yellow' : 'violet', {curve: n % 2 ? .5 : -.5}) }
			if (N.every(e, 'd', 3)) N.fan(e.x, e.y - 52, N.aim(e.x, e.y - 52), 3, .3, 220, 'rice', 'pink');
		}},
		{name: 'Gear Storm', hp: 950, time: 50, fn(e, dt) {
			N.towards(e, W / 2, 120, 2, dt);
			if (N.every(e, 'g', .12)) { const a = e.pt * 1.3; for (let k = 0; k < 4; k++) N.bullet(e.x, e.y - 5, a + k * PI / 2, 120, 'flake', 'white', {spin: 6}) }
			if (N.every(e, 'h', .12)) { const a = -e.pt * 1.1; for (let k = 0; k < 3; k++) N.bullet(e.x, e.y - 5, a + k * PI * 2 / 3, 90, 'ball', 'blue') }
			if (N.every(e, 'k', 1.5)) N.fan(e.x, e.y - 52, N.aim(e.x, e.y - 52), N.n(5), .5, 200, 'rice', 'pink');
		}}]};
}

window.NFSTAGES = [stage1(), stage2()];
/* a fresh copy for each flight (the wave lists hold closures, not state, so sharing them is fine) */
})();
