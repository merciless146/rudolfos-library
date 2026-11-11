/* ===== Night Flight: the art, all drawn here in Canvas (no image files). GPL-2.0-or-later.
   Friendly characters (Rudolf, the snow bunnies) are soft and round: circles and ovals, a soft outline, one highlight
   and one shadow tone, big eyes with highlights. Corrupted ones are jagged and dark with narrow glowing eyes and no
   highlights. Each corrupted enemy also has a "restored" look (its own colours), shown while a Glow Burst lasts.
   Sprites are drawn once into small canvases at twice their size (sharp on high-density screens). ===== */
(function () {
'use strict';
const ART = window.NFART = {};
const SC = 2;
function mk(w, h, draw) {
	const c = document.createElement('canvas'); c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC);
	const x = c.getContext('2d'); x.scale(SC, SC); x.lineJoin = 'round'; x.lineCap = 'round'; draw(x, w, h);
	c.w = w; c.h = h; return c;
}
const oval = (x, cx, cy, rx, ry, rot) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2) };
const circ = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2) };
function fillLine(x, fill, line, lw) { x.fillStyle = fill; x.fill(); if (line) { x.strokeStyle = line; x.lineWidth = lw || 1.6; x.stroke() } }
/* a jagged outline: n points between r0 and r1, seeded so a sprite is always the same */
function jag(x, cx, cy, n, r0, r1, seed, sx, sy) {
	let s = seed || 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
	x.beginPath();
	for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? r0 : r1) * (.85 + rnd() * .3); x.lineTo(cx + Math.cos(a) * r * (sx || 1), cy + Math.sin(a) * r * (sy || 1)) }
	x.closePath();
}

/* ---------- Rudolf ---------- */
const FUR = '#f6eddc', FUR2 = '#e6d3b4', MUZ = '#e9c9a0', LINE = '#6b4a35', ANT = '#d9a85b', ANT2 = '#b98a42', SCARF = '#3aa7c9', SCARF2 = '#2b84a3', NOSE = '#e3283e', EYE = '#2b2230';
function rudolf(x, w, h, blink, cheer) {
	const cx = w / 2;
	/* stubby rounded antlers: two short branches each, round tips */
	const ant = s => {
		x.save(); x.translate(cx + s * 9, 13); x.scale(s, 1);
		x.strokeStyle = LINE; x.lineWidth = 6.4; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(3, -7, 9, -10); x.moveTo(3, -5); x.quadraticCurveTo(8, -4, 11, -2); x.stroke();
		x.strokeStyle = ANT; x.lineWidth = 4.4; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(3, -7, 9, -10); x.moveTo(3, -5); x.quadraticCurveTo(8, -4, 11, -2); x.stroke();
		x.fillStyle = ANT2; circ(x, 9, -10, 1.3); x.fill();
		x.restore();
	};
	ant(-1); ant(1);
	/* little legs and hooves, tucked (flying) */
	[[-7, 47], [7, 47]].forEach(([dx, y]) => { oval(x, cx + dx, y, 4, 4.5); fillLine(x, FUR2, LINE); oval(x, cx + dx, y + 3, 3.2, 1.8); fillLine(x, '#8a6a52') });
	/* chubby body */
	oval(x, cx, 39, 12.5, 11); fillLine(x, FUR, LINE);
	oval(x, cx, 41, 7.5, 7); x.fillStyle = '#fffaf0'; x.fill();
	/* a little tail */
	circ(x, cx + 11, 42, 3); fillLine(x, '#fffaf0', LINE, 1.2);
	/* scarf */
	x.beginPath(); x.moveTo(cx - 11, 27); x.quadraticCurveTo(cx, 33, cx + 11, 27); x.lineTo(cx + 11, 31); x.quadraticCurveTo(cx, 37, cx - 11, 31); x.closePath(); fillLine(x, SCARF, LINE, 1.3);
	x.beginPath(); x.moveTo(cx + 6, 31); x.lineTo(cx + 9, 40); x.lineTo(cx + 4, 40); x.lineTo(cx + 3, 32); x.closePath(); fillLine(x, SCARF2, LINE, 1.2);
	/* ears */
	[-1, 1].forEach(s => { oval(x, cx + s * 15, 17, 6, 3.4, s * .45); fillLine(x, FUR, LINE); oval(x, cx + s * 15, 17, 3.5, 1.7, s * .45); x.fillStyle = '#f2b6b8'; x.fill() });
	/* the big round head */
	circ(x, cx, 19, 13); fillLine(x, FUR, LINE);
	oval(x, cx - 5, 12, 5, 3, -.4); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill();   /* highlight */
	/* muzzle */
	oval(x, cx, 26, 7, 5); fillLine(x, MUZ, null);
	/* eyes */
	if (blink) { x.strokeStyle = EYE; x.lineWidth = 1.8; [-1, 1].forEach(s => { x.beginPath(); x.arc(cx + s * 5, 18, 2.6, Math.PI * .15, Math.PI * .85); x.stroke() }) }
	else [-1, 1].forEach(s => {
		oval(x, cx + s * 5, 18, 3, cheer ? 2.6 : 3.8); x.fillStyle = EYE; x.fill();
		circ(x, cx + s * 5 + 1, 16.6, 1.2); x.fillStyle = '#fff'; x.fill();
		circ(x, cx + s * 5 - .9, 19.6, .55); x.fill();
	});
	/* cheeks */
	[-1, 1].forEach(s => { oval(x, cx + s * 9, 23, 2.4, 1.5); x.fillStyle = 'rgba(240,140,150,.45)'; x.fill() });
	/* smile */
	x.strokeStyle = LINE; x.lineWidth = 1.3; x.beginPath(); x.arc(cx, 28, cheer ? 3 : 2.2, Math.PI * .2, Math.PI * .8); x.stroke();
	/* the nose (its glow is drawn by the game, brighter while the beam charges) */
	circ(x, cx, 24.5, 3.6); fillLine(x, NOSE, '#7a1420', 1.1);
	circ(x, cx - 1.1, 23.4, 1.1); x.fillStyle = 'rgba(255,255,255,.75)'; x.fill();
}
ART.rudolf = mk(36, 54, (x, w, h) => rudolf(x, w, h, false));
ART.rudolfBlink = mk(36, 54, (x, w, h) => rudolf(x, w, h, true));
ART.rudolfCheer = mk(36, 54, (x, w, h) => rudolf(x, w, h, false, true));
ART.noseY = 24.5 - 27;   /* the nose, from the sprite's centre */

/* ---------- glows (additive) ---------- */
function glow(r, col) { return mk(r * 2, r * 2, (x) => { const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, col); g.addColorStop(.35, col.replace(/[\d.]+\)$/, '.35)')); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2) }) }
ART.noseGlow = glow(28, 'rgba(255,90,80,1)');
ART.warmGlow = glow(24, 'rgba(255,214,120,1)');
ART.whiteGlow = glow(20, 'rgba(255,255,255,1)');
ART.purpleGlow = glow(24, 'rgba(190,80,255,1)');

/* ---------- snow bunnies: friends, and corrupted ---------- */
function bunny(x, w, h, bad) {
	const cx = w / 2;
	if (!bad) {
		[-1, 1].forEach(s => { oval(x, cx + s * 5, 7, 3.4, 8, s * .2); fillLine(x, '#ffffff', '#5d4b63', 1.4); oval(x, cx + s * 5, 7, 1.6, 5.5, s * .2); x.fillStyle = '#f7b9cf'; x.fill() });
		oval(x, cx, 25, 9.5, 8); fillLine(x, '#ffffff', '#5d4b63', 1.4);
		circ(x, cx, 16, 8.5); fillLine(x, '#ffffff', '#5d4b63', 1.4);
		[-1, 1].forEach(s => { oval(x, cx + s * 3.3, 15, 1.8, 2.4); x.fillStyle = '#2b2230'; x.fill(); circ(x, cx + s * 3.3 + .6, 14.2, .7); x.fillStyle = '#fff'; x.fill() });
		circ(x, cx, 18.4, 1.3); x.fillStyle = '#f08aa8'; x.fill();
		oval(x, cx + s0(1) * 6, 19, 1.8, 1.1); x.fillStyle = 'rgba(240,140,170,.5)'; x.fill(); oval(x, cx - 6, 19, 1.8, 1.1); x.fill();
		x.strokeStyle = '#ff8fb8'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 7, 23); x.quadraticCurveTo(cx, 26, cx + 7, 23); x.stroke();   /* a ribbon */
	} else {
		[-1, 1].forEach(s => { x.beginPath(); x.moveTo(cx + s * 3, 12); x.lineTo(cx + s * 9, 0); x.lineTo(cx + s * 6, 8); x.lineTo(cx + s * 7, 1); x.closePath(); fillLine(x, '#2a1f33', '#a64dff', 1.2) });
		jag(x, cx, 25, 7, 6, 10, 9); fillLine(x, '#2b2135', '#a64dff', 1.2);
		jag(x, cx, 16, 6, 6, 9, 4); fillLine(x, '#332640', '#a64dff', 1.2);
		[-1, 1].forEach(s => { x.beginPath(); x.moveTo(cx + s * 1.5, 15); x.lineTo(cx + s * 6, 13.5); x.lineTo(cx + s * 5, 16); x.closePath(); x.fillStyle = '#d6ff4a'; x.fill() });
		x.strokeStyle = '#d6ff4a'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx - 3, 20); x.lineTo(cx - 1, 21); x.lineTo(cx + 1, 20); x.lineTo(cx + 3, 21); x.stroke();
	}
}
function s0(v) { return v }
ART.bunny = mk(24, 34, (x, w, h) => bunny(x, w, h, false));
ART.bunnyBad = mk(24, 34, (x, w, h) => bunny(x, w, h, true));

/* ---------- corrupted enemies, each with its restored look ---------- */
const BADP = {body: '#2a1b36', body2: '#3b2850', line: '#b04dff', eye: '#d6ff4a', crack: '#ff4fa3'};
const GOODP = {body: '#ff6f91', body2: '#ffd36e', line: '#7a3b52', eye: '#2b2230', crack: '#ffffff'};
/* a shard ornament (small, comes in swarms) */
function mite(x, w, h, P, good) {
	const cx = w / 2, cy = h / 2;
	if (good) { circ(x, cx, cy + 1, 7.5); fillLine(x, P.body, P.line, 1.4); x.fillRect(cx - 2.5, cy - 9, 5, 3); circ(x, cx - 2.5, cy - 1.5, 2); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill(); return }
	jag(x, cx, cy, 6, 4, 9, 3); fillLine(x, P.body, P.line, 1.3);
	x.beginPath(); x.moveTo(cx - 5, cy - 1); x.lineTo(cx - 1, cy); x.lineTo(cx - 4, cy + 1.5); x.closePath(); x.moveTo(cx + 5, cy - 1); x.lineTo(cx + 1, cy); x.lineTo(cx + 4, cy + 1.5); x.closePath(); x.fillStyle = P.eye; x.fill();
}
/* a cracked bauble */
function bauble(x, w, h, P, good) {
	const cx = w / 2, cy = h / 2 + 2;
	circ(x, cx, cy, 11); fillLine(x, good ? '#4fb3ff' : P.body, P.line, 1.5);
	if (good) { x.fillStyle = '#ffe07a'; x.fillRect(cx - 11, cy - 2, 22, 4); circ(x, cx - 4, cy - 5, 3); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill(); }
	x.beginPath(); x.moveTo(cx - 4, cy - 12); x.lineTo(cx - 5, cy - 16); x.lineTo(cx, cy - 13); x.lineTo(cx + 5, cy - 16); x.lineTo(cx + 4, cy - 12); x.closePath(); fillLine(x, good ? '#d9b14a' : '#4a3a58', P.line, 1.2);
	if (!good) {
		x.strokeStyle = P.crack; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx - 6, cy - 8); x.lineTo(cx - 1, cy - 2); x.lineTo(cx - 4, cy + 3); x.lineTo(cx + 2, cy + 9); x.moveTo(cx - 1, cy - 2); x.lineTo(cx + 6, cy - 4); x.stroke();
		x.beginPath(); x.moveTo(cx - 7, cy + 1); x.lineTo(cx - 2, cy + 2); x.lineTo(cx - 6, cy + 4); x.closePath(); x.moveTo(cx + 7, cy + 1); x.lineTo(cx + 2, cy + 2); x.lineTo(cx + 6, cy + 4); x.closePath(); x.fillStyle = P.eye; x.fill();
	} else { [-1, 1].forEach(s => { oval(x, cx + s * 4, cy + 3, 1.6, 2.2); x.fillStyle = P.eye; x.fill() }) }
}
/* a wind-up toy gone wrong (a box with a key) */
function windup(x, w, h, P, good) {
	const cx = w / 2, cy = h / 2 + 3;
	/* the key */
	x.strokeStyle = good ? '#d9b14a' : '#6a5a78'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy - 12); x.lineTo(cx, cy - 18); x.stroke();
	oval(x, cx - 4, cy - 19, 3.5, 2.5); fillLine(x, good ? '#ffe07a' : '#4a3a58', P.line, 1.2); oval(x, cx + 4, cy - 19, 3.5, 2.5); fillLine(x, good ? '#ffe07a' : '#4a3a58', P.line, 1.2);
	if (good) { x.beginPath(); x.roundRect(cx - 13, cy - 12, 26, 24, 7); fillLine(x, '#7ad38c', P.line, 1.5); [-1, 1].forEach(s => { circ(x, cx + s * 5, cy - 2, 2.5); x.fillStyle = P.eye; x.fill(); circ(x, cx + s * 5 + .8, cy - 3, .8); x.fillStyle = '#fff'; x.fill() }); x.strokeStyle = P.line; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy + 3, 4, .2, Math.PI - .2); x.stroke(); return }
	x.beginPath(); x.moveTo(cx - 14, cy - 10); x.lineTo(cx - 6, cy - 13); x.lineTo(cx + 12, cy - 11); x.lineTo(cx + 14, cy + 2); x.lineTo(cx + 10, cy + 13); x.lineTo(cx - 3, cy + 11); x.lineTo(cx - 13, cy + 13); x.lineTo(cx - 15, cy); x.closePath(); fillLine(x, P.body2, P.line, 1.5);
	x.beginPath(); x.moveTo(cx - 9, cy - 4); x.lineTo(cx - 2, cy - 2); x.lineTo(cx - 9, cy - 1); x.closePath(); x.moveTo(cx + 9, cy - 4); x.lineTo(cx + 2, cy - 2); x.lineTo(cx + 9, cy - 1); x.closePath(); x.fillStyle = P.eye; x.fill();
	x.strokeStyle = P.eye; x.lineWidth = 1.3; x.beginPath(); x.moveTo(cx - 7, cy + 5); for (let i = 0; i < 7; i++) x.lineTo(cx - 7 + i * 2.3 + 1.1, cy + (i % 2 ? 5 : 8)); x.stroke();
	x.strokeStyle = P.crack; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx + 12, cy - 11); x.lineTo(cx + 7, cy - 6); x.lineTo(cx + 9, cy - 2); x.stroke();
}
/* a dark snow-wisp (a tattered cloak of dirty snow) */
function wisp(x, w, h, P, good) {
	const cx = w / 2, cy = h / 2;
	if (good) { circ(x, cx, cy - 2, 9); fillLine(x, '#ffffff', '#6a7f9a', 1.4); oval(x, cx, cy + 7, 7, 4); fillLine(x, '#eaf4ff', '#6a7f9a', 1.2); [-1, 1].forEach(s => { circ(x, cx + s * 3.5, cy - 3, 1.8); x.fillStyle = P.eye; x.fill() }); circ(x, cx, cy + 1, 1.4); x.fillStyle = '#ff9f43'; x.fill(); return }
	x.beginPath(); x.moveTo(cx, cy - 12); x.lineTo(cx + 10, cy - 2); x.lineTo(cx + 12, cy + 12); x.lineTo(cx + 6, cy + 7); x.lineTo(cx + 3, cy + 13); x.lineTo(cx - 1, cy + 7); x.lineTo(cx - 5, cy + 13); x.lineTo(cx - 7, cy + 6); x.lineTo(cx - 12, cy + 11); x.lineTo(cx - 10, cy - 2); x.closePath(); fillLine(x, P.body, P.line, 1.4);
	x.beginPath(); x.moveTo(cx - 6, cy - 2); x.lineTo(cx - 1, cy); x.lineTo(cx - 6, cy + 1); x.closePath(); x.moveTo(cx + 6, cy - 2); x.lineTo(cx + 1, cy); x.lineTo(cx + 6, cy + 1); x.closePath(); x.fillStyle = P.eye; x.fill();
}
const EN = {mite: [20, 20, mite], bauble: [28, 34, bauble], windup: [32, 40, windup], wisp: [28, 30, wisp]};
ART.enemy = {}; ART.enemyGood = {};
for (const k in EN) { const [w, h, f] = EN[k]; ART.enemy[k] = mk(w, h, (x, w, h) => f(x, w, h, BADP, false)); ART.enemyGood[k] = mk(w, h, (x, w, h) => f(x, w, h, GOODP, true)) }

/* ---------- bosses ---------- */
/* Grumblewreath: a wreath of thorny holly, cracked, with a scowling face in the ring */
function wreath(x, w, h, good) {
	const cx = w / 2, cy = h / 2;
	for (let i = 0; i < 14; i++) {
		const a = i / 14 * Math.PI * 2; x.save(); x.translate(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); x.rotate(a + Math.PI / 2);
		if (good) { oval(x, 0, 0, 7, 13); fillLine(x, '#3fa868', '#1f5d3a', 1.4) }
		else { jag(x, 0, 0, 5, 6, 14, i + 2, .7, 1); fillLine(x, i % 2 ? '#22182c' : '#2f2140', '#b04dff', 1.4) }
		x.restore();
	}
	for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + .3; circ(x, cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 4); fillLine(x, good ? '#ff5c5c' : '#d6ff4a', good ? '#8a1f1f' : '#5a7a00', 1) }
	/* the face */
	circ(x, cx, cy, 24); fillLine(x, good ? '#ffe9b8' : '#1c1424', good ? '#a0763a' : '#b04dff', 2);
	if (good) { [-1, 1].forEach(s => { circ(x, cx + s * 8, cy - 3, 3); x.fillStyle = '#2b2230'; x.fill() }); x.strokeStyle = '#2b2230'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy + 4, 7, .3, Math.PI - .3); x.stroke(); return }
	x.beginPath(); x.moveTo(cx - 15, cy - 9); x.lineTo(cx - 3, cy - 3); x.lineTo(cx - 14, cy - 1); x.closePath(); x.moveTo(cx + 15, cy - 9); x.lineTo(cx + 3, cy - 3); x.lineTo(cx + 14, cy - 1); x.closePath(); x.fillStyle = '#ff3b6b'; x.fill();
	x.strokeStyle = '#ff3b6b'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 10, cy + 10); for (let i = 0; i < 9; i++) x.lineTo(cx - 10 + i * 2.5 + 1.25, cy + (i % 2 ? 9 : 13)); x.stroke();
	x.strokeStyle = '#ff4fa3'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx + 4, cy - 24); x.lineTo(cx + 1, cy - 16); x.lineTo(cx + 6, cy - 12); x.stroke();
}
ART.wreath = mk(110, 110, (x, w, h) => wreath(x, w, h, false));
ART.wreathGood = mk(110, 110, (x, w, h) => wreath(x, w, h, true));
/* The Cuckoo Clockwork: a crooked clock, its door hanging open, gears showing */
function clock(x, w, h, good) {
	const cx = w / 2;
	/* roof */
	x.beginPath(); x.moveTo(cx - 52, 40); x.lineTo(cx, 4); x.lineTo(cx + 52, 40); x.closePath(); fillLine(x, good ? '#a8673a' : '#2a1b36', good ? '#5a3418' : '#b04dff', 2);
	/* body */
	x.beginPath(); if (good) x.roundRect(cx - 42, 38, 84, 82, 6); else { x.moveTo(cx - 44, 38); x.lineTo(cx + 40, 36); x.lineTo(cx + 44, 118); x.lineTo(cx - 40, 122); x.closePath() }
	fillLine(x, good ? '#d9965a' : '#35254a', good ? '#5a3418' : '#b04dff', 2);
	/* face */
	circ(x, cx, 72, 26); fillLine(x, good ? '#fff6e0' : '#1c1424', good ? '#5a3418' : '#b04dff', 2);
	for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillStyle = good ? '#5a3418' : '#d6ff4a'; circ(x, cx + Math.cos(a) * 21, 72 + Math.sin(a) * 21, 1.6); x.fill() }
	if (!good) { x.strokeStyle = '#ff4fa3'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 20, 58); x.lineTo(cx - 8, 70); x.lineTo(cx - 14, 80); x.lineTo(cx - 2, 94); x.stroke() }
	/* the cuckoo's door */
	x.beginPath(); x.roundRect(cx - 9, 16, 18, 16, 3); fillLine(x, good ? '#ffe07a' : '#0d0a12', good ? '#5a3418' : '#b04dff', 1.5);
	if (!good) { x.beginPath(); x.moveTo(cx - 6, 24); x.lineTo(cx - 1, 25); x.lineTo(cx - 6, 27); x.closePath(); x.moveTo(cx + 6, 24); x.lineTo(cx + 1, 25); x.lineTo(cx + 6, 27); x.closePath(); x.fillStyle = '#ff3b6b'; x.fill() }
	else { circ(x, cx, 24, 4); x.fillStyle = '#7ec8ff'; x.fill() }
	/* pendulum weights */
	[-18, 18].forEach(dx => { x.strokeStyle = good ? '#5a3418' : '#6a5a78'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx + dx, 120); x.lineTo(cx + dx, 138); x.stroke(); x.beginPath(); x.moveTo(cx + dx - 4, 138); x.lineTo(cx + dx + 4, 138); x.lineTo(cx + dx + 3, 150); x.lineTo(cx + dx - 3, 150); x.closePath(); fillLine(x, good ? '#d9b14a' : '#4a3a58', good ? '#5a3418' : '#b04dff', 1.2) });
}
ART.clock = mk(110, 154, (x, w, h) => clock(x, w, h, false));
ART.clockGood = mk(110, 154, (x, w, h) => clock(x, w, h, true));
/* the clock's hands, drawn turning */
ART.hand = (x, cx, cy, len, ang, col, lw) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len); x.stroke() };

/* ---------- bullets: a white core and a coloured rim, and a shape of their own (not colour alone) ---------- */
ART.COL = {pink: '#ff5fa2', cyan: '#4fd8ff', yellow: '#ffd84d', violet: '#b07cff', orange: '#ff9a3c', white: '#e8f0ff', lime: '#c6ff4a', blue: '#5f8bff'};
const BC = {};
ART.bullet = function (type, col, r) {
	const k = type + col + r; if (BC[k]) return BC[k];
	const c = ART.COL[col] || col;
	let s;
	if (type == 'ball') s = mk(r * 2 + 6, r * 2 + 6, x => { const m = r + 3; circ(x, m, m, r + 2); x.fillStyle = c.replace(/^#(..)(..)(..)$/, (z, a, b, d) => `rgba(${parseInt(a, 16)},${parseInt(b, 16)},${parseInt(d, 16)},.35)`); x.fill(); circ(x, m, m, r); x.fillStyle = c; x.fill(); circ(x, m, m, r * .55); x.fillStyle = '#fff'; x.fill() });
	else if (type == 'rice') s = mk(r * 3 + 4, r * 1.6 + 4, (x, w, h) => { oval(x, w / 2, h / 2, r * 1.5, r * .8); x.fillStyle = c; x.fill(); oval(x, w / 2, h / 2, r * 1.0, r * .4); x.fillStyle = '#fff'; x.fill() });
	else if (type == 'star') s = mk(r * 2 + 4, r * 2 + 4, (x, w, h) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .45 : r; x.lineTo(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr) } x.closePath(); x.fillStyle = c; x.fill(); circ(x, w / 2, h / 2, r * .35); x.fillStyle = '#fff'; x.fill() });
	else if (type == 'flake') s = mk(r * 2 + 4, r * 2 + 4, (x, w, h) => { x.strokeStyle = c; x.lineWidth = 2.2; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; x.beginPath(); x.moveTo(w / 2 - Math.cos(a) * r, h / 2 - Math.sin(a) * r); x.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); x.stroke() } circ(x, w / 2, h / 2, r * .4); x.fillStyle = '#fff'; x.fill() });
	else s = mk(r * 2 + 4, r * 2 + 4, (x, w, h) => { x.beginPath(); x.moveTo(w / 2, h / 2 - r); x.lineTo(w / 2 + r * .7, h / 2); x.lineTo(w / 2, h / 2 + r); x.lineTo(w / 2 - r * .7, h / 2); x.closePath(); x.fillStyle = c; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.2; x.stroke() });
	return BC[k] = s;
};
/* Rudolf's own shots: warm, soft lasers */
ART.shot = mk(6, 18, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,90,80,.2)'); x.fillStyle = g; x.beginPath(); x.roundRect(0, 0, w, h, 3); x.fill(); x.fillStyle = '#fff'; x.fillRect(2, 1, 2, h * .6) });
ART.homing = mk(10, 10, (x) => { circ(x, 5, 5, 4.5); x.fillStyle = 'rgba(120,220,255,.5)'; x.fill(); circ(x, 5, 5, 2.5); x.fillStyle = '#fff'; x.fill() });

/* ---------- items ---------- */
ART.item = {
	glow: mk(16, 16, (x) => { circ(x, 8, 8, 7); x.fillStyle = '#ff6a5a'; x.fill(); circ(x, 8, 8, 4); x.fillStyle = '#ffd7c8'; x.fill(); x.fillStyle = '#7a1420'; x.font = 'bold 8px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('G', 8, 8.5) }),
	gift: mk(16, 16, (x) => { x.fillStyle = '#4f9dff'; x.fillRect(2, 5, 12, 10); x.fillStyle = '#ffd84d'; x.fillRect(7, 5, 2, 10); x.fillRect(2, 8, 12, 2); x.strokeStyle = '#ffd84d'; x.lineWidth = 1.6; x.beginPath(); x.ellipse(5.5, 4, 2.5, 1.6, 0, 0, 7); x.ellipse(10.5, 4, 2.5, 1.6, 0, 0, 7); x.stroke() }),
	bomb: mk(18, 18, (x) => { const g = x.createRadialGradient(9, 9, 1, 9, 9, 8); g.addColorStop(0, '#fff'); g.addColorStop(.5, '#ffd36e'); g.addColorStop(1, '#ff9a3c'); circ(x, 9, 9, 8); x.fillStyle = g; x.fill(); x.fillStyle = '#7a3b00'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('B', 9, 9.5) }),
	life: mk(18, 18, (x) => { x.fillStyle = '#ff5f8f'; x.beginPath(); x.moveTo(9, 15); x.bezierCurveTo(-2, 7, 4, 0, 9, 5); x.bezierCurveTo(14, 0, 20, 7, 9, 15); x.fill(); x.fillStyle = '#fff'; circ(x, 6, 6, 1.6); x.fill() }),
	star: mk(10, 10, (x) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 2 : 4.5; x.lineTo(5 + Math.cos(a) * rr, 5 + Math.sin(a) * rr) } x.closePath(); x.fillStyle = '#ffe67a'; x.fill() })};

/* ---------- the places (backgrounds), drawn each frame from the scroll position ---------- */
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 };
ART.hash = hash;
const LIGHTS = ['#ff5f5f', '#ffd84d', '#4fd8ff', '#7dff8a', '#ff9af0', '#ffa94d'];
/* Stage 1: the village under a clear winter night, seen from above: snowy ground in the blue of night, a winding
   lane with lanterns, roofs heavy with snow and strung with lights, warm windows. dark 0..1: how far the corruption
   has drained it (0 here) */
ART.village = function (x, W, H, scroll, t, dark) {
	const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#24386e'); g.addColorStop(1, '#30508f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
	const sp = scroll * .6;
	/* drifts: soft lighter patches */
	for (let i = 0; i < 14; i++) { const y = ((hash(i, 40) * 900 + sp) % 900) - 130; x.fillStyle = 'rgba(190,215,255,.07)'; x.beginPath(); x.ellipse(hash(i, 41) * W, y, 50 + hash(i, 42) * 60, 18 + hash(i, 43) * 14, 0, 0, 7); x.fill() }
	/* the lane */
	const lane = Y => W * .5 + Math.sin((Y - sp) * .006) * 90;
	x.fillStyle = 'rgba(225,236,255,.28)'; x.beginPath(); for (let Y = -20; Y <= H + 20; Y += 16) x.lineTo(lane(Y) - 26, Y); for (let Y = H + 20; Y >= -20; Y -= 16) x.lineTo(lane(Y) + 26, Y); x.fill();
	/* lanterns along it */
	const LR = 90, lf = Math.floor(sp / LR) - 1;
	for (let r = lf; r < lf + Math.ceil(H / LR) + 3; r++) { const y = H - ((r * LR - sp) % (H + LR * 3) + LR * 3) % (H + LR * 3) + LR; for (const s of [-1, 1]) { const lx = lane(y) + s * 34; x.drawImage(ART.warmGlow, lx - 14, y - 14, 28, 28); circ(x, lx, y, 2.2); x.fillStyle = (!dark || hash(r, Math.floor(t * 4)) > dark) ? '#ffe39a' : '#4a4660'; x.fill() } }
	/* houses and pines in rows, either side of the lane */
	const ROW = 110, first = Math.floor(sp / ROW) - 1;
	for (let r = first; r < first + Math.ceil(H / ROW) + 3; r++) {
		const y = H - ((r * ROW - sp) % (H + ROW * 3) + ROW * 3) % (H + ROW * 3) + ROW, L = lane(y);
		for (let k = 0; k < 3; k++) {
			const hx = hash(r, k * 3 + 11) * (W - 70) + 5, hw = 48 + hash(r, k) * 22, hh = 34 + hash(r, k + 5) * 12;
			if (hx + hw > L - 34 && hx < L + 34) { if (hash(r, k + 50) > .4) pine(x, hx + hw / 2, y + hh / 2, 11 + hash(r, k) * 6, r * 9 + k, t, dark); continue }
			roof(x, hx, y, hw, hh, r * 13 + k, t, dark);
		}
	}
	for (let i = 0; i < 70; i++) { const fx = (hash(i, 3) * W + Math.sin(t * .7 + i) * 12 + W) % W, fy = (hash(i, 4) * H + t * (30 + hash(i, 5) * 40)) % H; x.fillStyle = 'rgba(255,255,255,.8)'; circ(x, fx, fy, .8 + hash(i, 6) * 1.6); x.fill() }
};
/* a house seen from above: a snowy roof with a ridge, coloured eaves, a chimney, lit windows below the eaves */
function roof(x, X, Y, w, h, id, t, dark) {
	x.fillStyle = 'rgba(8,14,40,.35)'; x.fillRect(X + 5, Y + 6, w, h);
	const col = ['#c86b5a', '#6f93c6', '#d9a45a', '#7fb07a', '#b07ab5'][id % 5];
	/* windows glow onto the snow */
	for (let i = 0; i < 2; i++) { const on = !dark || hash(id, i + Math.floor(t * 3)) > dark * .8; if (on) x.drawImage(ART.warmGlow, X + 6 + i * (w - 24) - 6, Y + h - 6, 30, 22) }
	x.fillStyle = col; x.fillRect(X - 3, Y - 3, w + 6, h + 6);
	x.fillStyle = '#f4f8ff'; x.fillRect(X, Y, w, h / 2 - 1); x.fillStyle = '#dbe6f7'; x.fillRect(X, Y + h / 2 + 1, w, h / 2 - 1);
	x.fillStyle = 'rgba(120,140,190,.5)'; x.fillRect(X, Y + h / 2 - 1, w, 2);
	x.fillStyle = '#7a4a3a'; x.fillRect(X + w * .7, Y + 4, 8, 8); x.fillStyle = '#f4f8ff'; x.fillRect(X + w * .7, Y + 4, 8, 2);
	/* smoke */
	for (let i = 0; i < 3; i++) { const k = (t * .6 + i / 3) % 1; x.fillStyle = 'rgba(220,230,250,' + (.35 * (1 - k)) + ')'; circ(x, X + w * .7 + 4 + Math.sin(t * 2 + i) * 3, Y + 4 - k * 22, 3 + k * 4); x.fill() }
	/* lights along the eaves */
	for (let i = 0; i <= 7; i++) for (const yy of [Y - 3, Y + h + 3]) { const lx = X - 2 + i * (w + 4) / 7, on = (Math.floor(t * 2) + i + id) % 3 != 0 && (!dark || hash(id + i, Math.floor(t * 5)) > dark); circ(x, lx, yy, 1.8); x.fillStyle = on ? LIGHTS[(i + id) % LIGHTS.length] : '#40405a'; x.fill() }
}
/* Stage 2: the pine woods by the workshop; lights begin to flicker (the corruption's first touch) */
ART.woods = function (x, W, H, scroll, t, dark) {
	/* the snowy forest floor, seen from above */
	const g2 = x.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, '#163049'); g2.addColorStop(1, '#2c5a68'); x.fillStyle = g2; x.fillRect(0, 0, W, H);
	/* paths of snow between the trees */
	x.fillStyle = 'rgba(230,242,250,.18)'; x.beginPath(); x.moveTo(W * .3, 0); for (let Y = 0; Y <= H; Y += 20) x.lineTo(W * .5 + Math.sin((Y - scroll * .7) * .01) * 60 - 40, Y); for (let Y = H; Y >= 0; Y -= 20) x.lineTo(W * .5 + Math.sin((Y - scroll * .7) * .01) * 60 + 40, Y); x.fill();
	/* pines seen from above: rows */
	const ROW = 70, sp = scroll * .7, first = Math.floor(sp / ROW) - 1;
	for (let r = first; r < first + Math.ceil(H / ROW) + 3; r++) {
		const y = H - ((r * ROW - sp) % (H + ROW * 3) + ROW * 3) % (H + ROW * 3) + ROW;
		for (let k = 0; k < 4; k++) {
			const px = hash(r, k + 20) * W, pr = 14 + hash(r, k + 30) * 12, path = W * .5 + Math.sin((y - 0) * .01) * 60;
			if (Math.abs(px - path) < 50) continue;
			pine(x, px, y, pr, r * 7 + k, t, dark);
		}
		if (hash(r, 99) > .82) workshop(x, hash(r, 98) > .5 ? 20 : W - 120, y, r, t, dark);
	}
	for (let i = 0; i < 50; i++) { const fx = (hash(i, 13) * W + Math.sin(t * .5 + i) * 10 + W) % W, fy = (hash(i, 14) * H + t * (24 + hash(i, 15) * 30)) % H; x.fillStyle = 'rgba(255,255,255,.75)'; circ(x, fx, fy, .7 + hash(i, 16) * 1.3); x.fill() }
};
function pine(x, X, Y, r, id, t, dark) {
	x.fillStyle = 'rgba(0,0,0,.2)'; circ(x, X + 4, Y + 5, r); x.fill();
	for (let i = 0; i < 3; i++) { const rr = r * (1 - i * .28); x.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, q = k % 2 ? rr * .78 : rr; x.lineTo(X + Math.cos(a) * q, Y + Math.sin(a) * q) } x.closePath(); x.fillStyle = ['#1f6a4a', '#2a8059', '#3a9a68'][i]; x.fill() }
	x.fillStyle = 'rgba(240,250,255,.85)'; circ(x, X - r * .2, Y - r * .25, r * .3); x.fill();
	if (id % 3 == 0) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + id, on = (Math.floor(t * 2) + i) % 4 != 0 && !(dark && hash(id + i, Math.floor(t * 6)) < dark * .6); circ(x, X + Math.cos(a) * r * .6, Y + Math.sin(a) * r * .6, 1.8); x.fillStyle = on ? LIGHTS[(i + id) % 6] : '#2a3040'; x.fill() }
}
function workshop(x, X, Y, id, t, dark) {
	x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(X + 5, Y + 5, 100, 56);
	x.fillStyle = '#b5604a'; x.fillRect(X, Y, 100, 56); x.fillStyle = '#f2f7fb'; x.fillRect(X, Y, 100, 24); x.fillStyle = '#d7e3ec'; x.fillRect(X, Y + 22, 100, 4);
	x.fillStyle = '#6a3a2a'; x.fillRect(X + 70, Y - 10, 12, 18);
	for (let i = 0; i < 3; i++) { const on = !(dark && hash(id + i, Math.floor(t * 4)) < dark * .7); x.fillStyle = on ? '#ffd77a' : '#353048'; x.fillRect(X + 10 + i * 30, Y + 32, 14, 12); if (on) x.drawImage(ART.warmGlow, X + 3 + i * 30, Y + 24, 28, 28) }
}
/* the title screen's sky (stage 1's place, slowly drifting) */
ART.title = function (x, W, H, t) {
	const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1740'); g.addColorStop(.7, '#24468a'); g.addColorStop(1, '#3a66ad'); x.fillStyle = g; x.fillRect(0, 0, W, H);
	for (let i = 0; i < 80; i++) { const tw = .5 + .5 * Math.sin(t * 2 + i * 1.7); x.fillStyle = `rgba(255,255,240,${.3 + .55 * tw})`; x.fillRect(hash(i, 1) * W, hash(i, 2) * H * .7, 1.6, 1.6) }
	x.drawImage(ART.warmGlow, W - 120, 20, 90, 90); circ(x, W - 75, 65, 17); x.fillStyle = '#fff8e0'; x.fill();
	/* hills, with the village's houses along the near one */
	x.fillStyle = '#9fb7e0'; x.beginPath(); x.moveTo(0, H); for (let X = 0; X <= W; X += 10) x.lineTo(X, H * .42 + Math.sin(X * .015 + 1) * 16); x.lineTo(W, H); x.fill();
	const hy = X => H * .49 + Math.sin(X * .02) * 10;
	for (let i = 0; i < 7; i++) {
		const X = 14 + i * 50 + hash(i, 9) * 10, w = 30 + hash(i, 8) * 12, h = 22 + hash(i, 7) * 10, Y = hy(X) - h + 6;
		x.fillStyle = ['#c86b5a', '#6f93c6', '#d9a45a', '#7fb07a'][i % 4]; x.fillRect(X, Y, w, h);
		x.fillStyle = '#f4f8ff'; x.beginPath(); x.moveTo(X - 4, Y + 2); x.lineTo(X + w / 2, Y - 12); x.lineTo(X + w + 4, Y + 2); x.closePath(); x.fill();
		x.fillStyle = '#ffd77a'; x.fillRect(X + w / 2 - 4, Y + 8, 8, 8); x.drawImage(ART.warmGlow, X + w / 2 - 14, Y - 2, 28, 28);
		for (let k = 0; k <= 5; k++) { circ(x, X - 2 + k * (w + 4) / 5, Y + 2 + Math.sin(k / 5 * Math.PI) * 3, 1.6); x.fillStyle = (Math.floor(t * 2) + k + i) % 3 ? LIGHTS[(k + i) % 6] : '#40405a'; x.fill() }
	}
	x.fillStyle = '#e8f0ff'; x.beginPath(); x.moveTo(0, H); for (let X = 0; X <= W; X += 10) x.lineTo(X, hy(X) + 4); x.lineTo(W, H); x.fill();
	for (let i = 0; i < 60; i++) { const fx = (hash(i, 3) * W + Math.sin(t * .7 + i) * 12 + W) % W, fy = (hash(i, 4) * H + t * (24 + hash(i, 5) * 30)) % H; x.fillStyle = 'rgba(255,255,255,.8)'; circ(x, fx, fy, .8 + hash(i, 6) * 1.4); x.fill() }
};
})();
