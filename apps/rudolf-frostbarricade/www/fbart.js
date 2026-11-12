/* ===== 25 Days (formerly Frost Barricade): the art, drawn in Canvas each frame (no image files). GPL-2.0-or-later.
   A gritty look, like the old violent Flash games: dark and washed-out colours, heavy outlines, film grain and a
   vignette, smoke and spent casings, and the corrupted elves bursting in dark ichor that stains the snow all night.
   The corrupted elves follow Night Flight's corruption: jagged dark silhouettes, dark skin and clothes, narrow glowing
   eyes without highlights, static at their edges.
   Rudolf is angular and faceted like Rudolf OS's portrait (the boot splash): a white low-poly stag with big branching
   antlers, diamond ears, narrow eyes, a shaggy ruff and the red nose. The survivors, Captain Quill and his owls stay
   soft and round.
   The scene is seen from the side: the barricade on the left, the horde coming from the right. ===== */
(function () {
'use strict';
const A = window.FBART = {};
const PI = Math.PI;
const circ = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, PI * 2) };
const oval = (x, cx, cy, rx, ry, rot) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, PI * 2) };
const fl = (x, f, s, w) => { x.fillStyle = f; x.fill(); if (s) { x.strokeStyle = s; x.lineWidth = w || 1.4; x.stroke() } };
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 };
A.hash = hash;
function mk(w, h, draw) { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const x = c.getContext('2d'); x.scale(2, 2); x.lineJoin = 'round'; x.lineCap = 'round'; draw(x, w, h); c.w = w; c.h = h; return c }
function glow(r, col) { return mk(r * 2, r * 2, x => { const g = x.createRadialGradient(r, r, 0, r, r, r); g.addColorStop(0, col); g.addColorStop(.4, col.replace(/[\d.]+\)$/, '.3)')); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2) }) }
A.warm = glow(30, 'rgba(255,200,110,1)'); A.eyeW = glow(16, 'rgba(235,240,255,1)'); A.eyeR = glow(16, 'rgba(255,50,50,1)'); A.eyeY = glow(16, 'rgba(255,210,63,1)'); A.eyeG = glow(16, 'rgba(125,255,74,1)'); A.eyeC = glow(16, 'rgba(63,240,255,1)'); A.lime = glow(16, 'rgba(214,255,74,1)'); A.pink = glow(16, 'rgba(255,79,163,1)'); A.white = glow(30, 'rgba(255,255,255,1)'); A.fire = glow(20, 'rgba(255,130,40,1)'); A.ice = glow(20, 'rgba(140,220,255,1)');

/* ---------- the night: a dark field before the workshop woods ---------- */
A.GROUND = 290;
/* fifteen lanes, far (0, higher up and smaller) to near (14); 25 Days: wider apart, on a longer field (1040 wide) */
A.LANES = 15; A.TOP = 232;
A.laneY = l => 250 + l * 11.4;
A.depth = l => .8 + l * .025;
A.scene = function (x, W, H, t, night, dawn) {
	const g = x.createLinearGradient(0, 0, 0, A.GROUND);
	const k = dawn || 0;
	g.addColorStop(0, mix('#040508', '#3a3a5a', k)); g.addColorStop(.7, mix('#11141f', '#a87a6a', k)); g.addColorStop(1, mix('#1e212c', '#d9ae84', k));
	x.fillStyle = g; x.fillRect(0, 0, W, A.GROUND);
	for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(230,235,255,${(.2 + .5 * hash(i, 3)) * (1 - k)})`; x.fillRect(hash(i, 1) * W, hash(i, 2) * 170, 1.3, 1.3) }
	/* a pale moon behind moving cloud */
	x.globalAlpha = 1 - k * .8; x.drawImage(A.white, W - 170, 20, 80, 80); circ(x, W - 130, 60, 16); x.fillStyle = '#e8e6f0'; x.fill(); x.globalAlpha = 1;
	for (let i = 0; i < 4; i++) { const cx = ((t * 6 + i * 190) % (W + 300)) - 150; x.fillStyle = `rgba(40,44,70,${.55 - k * .3})`; oval(x, cx, 50 + i * 18, 110, 14); x.fill() }
	/* far woods, and the workshop with dead windows */
	x.fillStyle = mix('#0d1120', '#4a3a55', k * .6);
	for (let i = 0; i < Math.ceil(W / 26); i++) { const px = i * 26 + hash(i, 5) * 14, ph = 50 + hash(i, 6) * 40; x.beginPath(); x.moveTo(px - 14, A.TOP + 4); x.lineTo(px, A.TOP + 4 - ph); x.lineTo(px + 14, A.TOP + 4); x.fill() }
	const wx = W * .62; x.fillStyle = mix('#151a2c', '#5a4560', k * .6); x.fillRect(wx, A.TOP - 45, 120, 50); x.beginPath(); x.moveTo(wx - 8, A.TOP - 43); x.lineTo(wx + 60, A.TOP - 80); x.lineTo(wx + 128, A.TOP - 43); x.fill();
	for (let i = 0; i < 4; i++) { const on = hash(i, Math.floor(t * 3) + night) > .7; x.fillStyle = on ? 'rgba(214,255,74,.55)' : 'rgba(40,30,60,.9)'; x.fillRect(wx + 12 + i * 27, A.TOP - 28, 10, 10) }
	/* the field */
	const gg = x.createLinearGradient(0, A.TOP, 0, H); gg.addColorStop(0, mix('#2a2e3c', '#b9aeb4', k)); gg.addColorStop(1, mix('#3a3f4e', '#ddd0c8', k));
	x.fillStyle = gg; x.beginPath(); x.moveTo(0, A.TOP); for (let X = 0; X <= W; X += 20) x.lineTo(X, A.TOP + Math.sin(X * .02) * 3); x.lineTo(W, H); x.lineTo(0, H); x.fill();
	/* faint furrows: the lanes */
	for (let l = 0; l < A.LANES; l += 2) { x.fillStyle = 'rgba(10,12,30,.07)'; x.fillRect(0, A.laneY(l) + 1, W, 2) }
	/* dead trees and broken fence posts along the woods' edge */
	x.strokeStyle = mix('#07080c', '#3a2f3a', k * .6);
	for (let i = 0; i < 9; i++) { const tx = 260 + hash(i, 31) * (W - 300), th = 40 + hash(i, 32) * 50; x.lineWidth = 3; x.beginPath(); x.moveTo(tx, A.TOP + 6); x.lineTo(tx + 3, A.TOP + 6 - th); x.stroke(); x.lineWidth = 1.6; x.beginPath(); x.moveTo(tx + 2, A.TOP + 6 - th * .6); x.lineTo(tx - 10, A.TOP - th * .9); x.moveTo(tx + 3, A.TOP + 6 - th * .8); x.lineTo(tx + 13, A.TOP - th); x.stroke() }
	for (let i = 0; i < 14; i++) { const px = 240 + i * 58 + hash(i, 33) * 10; x.fillStyle = 'rgba(20,16,14,.8)'; x.save(); x.translate(px, A.TOP + 12); x.rotate((hash(i, 34) - .5) * .5); x.fillRect(-2, -16, 4, 16); x.restore() }
	/* drifting fog */
	for (let i = 0; i < 6; i++) { const fx = ((t * (8 + i * 3) + i * 150) % (W + 260)) - 130; x.fillStyle = 'rgba(120,130,170,.08)'; oval(x, fx, A.TOP + 14 + i * 24, 160, 12); x.fill() }
};
/* grit: film grain (a few cached frames) and a dark vignette over everything */
const GRAIN = [];
A.grit = function (x, W, H, t, still) {
	if (!GRAIN.length) for (let f = 0; f < 4; f++) GRAIN.push(mk(160, 160, (g) => { for (let i = 0; i < 900; i++) { const v = hash(i, f * 7 + 1) > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${.05 + hash(i, f + 40) * .08})`; g.fillRect(hash(i, f + 11) * 160, hash(i, f + 23) * 160, 1, 1) } }));
	const fr = GRAIN[still ? 0 : Math.floor(t * 18) % 4];
	for (let gx = 0; gx < W; gx += 160) for (let gy = 0; gy < H; gy += 160) x.drawImage(fr, gx, gy, 160, 160);
	if (!A.VIG || A.VIG.w != W) { A.VIG = mk(W, H, (v) => { const g = v.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, W * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.62)'); v.fillStyle = g; v.fillRect(0, 0, W, H) }) }
	x.drawImage(A.VIG, 0, 0, W, H);
};
A.snow = function (x, W, H, t) { for (let i = 0; i < 80; i++) { const sx = (hash(i, 7) * W - t * (12 + hash(i, 8) * 20) + W * 4) % W, sy = (hash(i, 9) * H + t * (25 + hash(i, 10) * 30)) % H; x.fillStyle = 'rgba(235,240,255,.7)'; x.fillRect(sx, sy, 1.6, 1.6) } };
function mix(a, b, k) { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A_ = p(a), B = p(b); return 'rgb(' + A_.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')' }

/* ---------- the barricade: crates, a sled, sacks of snow; it loses pieces as it weakens ---------- */
A.BX = 172;
/* the wall's front edge in a lane (where the elves stop) */
A.wallX = l => A.BX + (14 - l) * 3;
A.front = l => A.wallX(l) + 56 * A.depth(l) + 4;
A.barricade = function (x, frac, t, hitT) {
	const sh = hitT > 0 ? Math.sin(t * 90) * 2 * hitT : 0;
	x.save(); x.translate(sh, 0);
	const pieces = [[0, -16, 30, 16, '#6b4a2f'], [24, -18, 26, 18, '#7a5636'], [2, -32, 24, 16, '#5c3f28'], [22, -36, 22, 18, '#6b4a2f'], [8, -50, 30, 14, '#7a5636'], [-6, -14, 12, 14, '#8d8fa8'], [44, -14, 12, 14, '#8d8fa8']];
	/* a snowbank along its foot, from the far lane to the near one */
	x.fillStyle = 'rgba(205,215,240,.55)'; x.beginPath(); x.moveTo(A.wallX(0) - 6, A.laneY(0) + 4); x.lineTo(A.front(0) + 6, A.laneY(0) + 4); x.lineTo(A.front(14) + 8, A.laneY(14) + 8); x.lineTo(A.wallX(14) - 8, A.laneY(14) + 8); x.closePath(); x.fill();
	/* segments from the far lane to the near one, each a stack of crates, sacks and boards */
	for (let k = 0; k <= 16; k++) {
		const l = k * 14 / 16, G = A.laneY(l) + 4, d = A.depth(l), X = A.wallX(l);
		const n = Math.ceil(pieces.length * Math.max(0, frac) - hash(k, 77) * 1.5);
		for (let i = 0; i < pieces.length; i++) {
			if (i >= n) continue;
			const [dx, dy, w, h, c] = pieces[(i + k) % pieces.length];
			const px = X + dx * d, py = G + dy * d, pw = w * d, ph = h * d;
			x.fillStyle = c; x.fillRect(px, py, pw, ph); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1; x.strokeRect(px + .5, py + .5, pw - 1, ph - 1);
			if (c != '#8d8fa8') { x.beginPath(); x.moveTo(px + 2, py + 2); x.lineTo(px + pw - 2, py + ph - 2); x.stroke() }
			x.fillStyle = 'rgba(240,245,255,.85)'; x.fillRect(px, py - 2, pw, 3);
			if (frac < .5) { x.strokeStyle = 'rgba(214,255,74,.35)'; x.beginPath(); x.moveTo(px + pw * .3, py); x.lineTo(px + pw * .5, py + ph * .6); x.lineTo(px + pw * .4, py + ph); x.stroke() }
		}
		/* old sleds lean against it here and there */
		if (frac > .2 && k % 4 == 2) { x.strokeStyle = '#a33a2a'; x.lineWidth = 4 * d; x.beginPath(); x.moveTo(X + 52 * d, G - 2); x.lineTo(X + 58 * d, G - 40 * d); x.stroke(); x.strokeStyle = '#c9a64a'; x.lineWidth = 2 * d; x.beginPath(); x.moveTo(X + 50 * d, G); x.quadraticCurveTo(X + 66 * d, G - 4, X + 62 * d, G - 46 * d); x.stroke() }
	}
	x.restore();
};

/* ---------- Rudolf, side view, aiming over the barricade ----------
   Angular and faceted like Rudolf OS's portrait: a white low-poly stag standing on his hind legs, big branching antlers
   with sharp tines, a diamond ear, a narrow slanted eye, a shaggy ruff, the red nose; a bandolier across his chest.
   25 Days: he moves up and down behind the barricade (at lane l, a float); his feet are on that lane's line. */
A.RX = 108;
A.rudolfScale = l => A.depth(l) * 1.05;
A.rudolfFeet = l => A.laneY(l);
/* where his shoulder (the weapon's pivot) and his nose are, at lane l */
A.rShoulder = l => { const s = A.rudolfScale(l); return {x: A.RX + 6 * s, y: A.laneY(l) - 34 * s} };
A.rNose = l => { const s = A.rudolfScale(l); return {x: A.RX + 16 * s, y: A.laneY(l) - 52 * s} };
A.rudolf = function (x, aim, weapon, t, recoil, hurtT, l, walk) {
	const s = A.rudolfScale(l), X = A.RX, Y = A.laneY(l), bob = Math.sin(t * 2) * .6, st = Math.sin(walk || 0);
	const ink = '#0a0c14', W1 = '#f2f4f8', W2 = '#c9cfdc', W3 = '#9aa3b6';
	x.save(); x.translate(X, Y); x.scale(s, s);
	if (hurtT > 0 && Math.floor(t * 20) % 2) x.globalAlpha = .6;
	const P = (pts, f, w) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); x.fillStyle = f; x.fill(); x.strokeStyle = ink; x.lineWidth = w || 1.3; x.lineJoin = 'miter'; x.stroke() };
	/* a shadow */
	x.fillStyle = 'rgba(0,0,0,.4)'; oval(x, 0, 1, 15, 3); x.fill();
	/* legs: the far one darker; thigh, shin, a dark hoof */
	const leg = (dx, ph, c) => { const k = Math.sin(ph) * 4; P([[dx - 4, -19], [dx + 3, -19], [dx + 4 + k * .4, -9], [dx + 2 + k, -2], [dx - 2 + k, -2], [dx - 3 + k * .4, -10]], c); P([[dx - 3 + k, -3], [dx + 3 + k, -3], [dx + 4 + k, 0], [dx - 3 + k, 0]], '#1c1a22', 1) };
	leg(-3, (walk || 0) + PI, W3); leg(2, walk || 0, W2);
	/* the torso: faceted, lighter at the front */
	x.translate(0, bob);
	P([[-9, -44], [5, -45], [10, -33], [8, -19], [-6, -17], [-12, -29]], W1, 1.5);
	P([[-9, -44], [-12, -29], [-6, -17], [-2, -30]], W2, .9);
	x.strokeStyle = 'rgba(10,12,20,.5)'; x.lineWidth = .8; x.beginPath(); x.moveTo(5, -45); x.lineTo(-2, -30); x.lineTo(8, -19); x.stroke();
	/* a bandolier with brass, worn and scuffed */
	x.strokeStyle = '#2e2620'; x.lineWidth = 3.2; x.beginPath(); x.moveTo(-9, -42); x.lineTo(8, -21); x.stroke();
	x.fillStyle = '#b8913a'; for (let i = 0; i < 4; i++) x.fillRect(-6 + i * 3.8, -38 + i * 4.3, 1.6, 2.6);
	x.fillStyle = 'rgba(60,50,50,.35)'; x.fillRect(-7, -26, 3, 1); x.fillRect(2, -36, 4, 1);
	/* the far antler (behind the head), grey */
	const antler = (ox, c, w) => { x.strokeStyle = ink; x.lineWidth = w + 2.2; x.lineCap = 'butt'; x.lineJoin = 'miter';
		const path = () => { x.beginPath(); x.moveTo(ox - 2, -60); x.lineTo(ox - 8, -72); x.lineTo(ox - 6, -84); x.lineTo(ox - 13, -96);
			x.moveTo(ox - 8, -72); x.lineTo(ox + 3, -78); x.moveTo(ox - 6, -84); x.lineTo(ox + 2, -92); x.moveTo(ox - 7, -80); x.lineTo(ox - 15, -84); x.moveTo(ox - 11, -93); x.lineTo(ox - 19, -98) };
		path(); x.stroke(); x.strokeStyle = c; x.lineWidth = w; path(); x.stroke() };
	antler(4, W3, 2.6);
	/* the ruff: a shaggy, spiky fringe under the chin, down the neck */
	P([[-7, -50], [8, -46], [6, -40], [3, -43], [1, -36], [-2, -42], [-5, -35], [-6, -42], [-10, -38]], W1, 1.2);
	/* the head: faceted, the muzzle to the right */
	const hx = 3, hy = -55;
	P([[hx - 8, hy - 7], [hx + 3, hy - 9], [hx + 9, hy - 5], [hx + 15, hy + 1], [hx + 13, hy + 5], [hx + 5, hy + 7], [hx - 3, hy + 7], [hx - 9, hy + 1]], W1, 1.5);
	P([[hx - 8, hy - 7], [hx + 1, hy - 1], [hx - 3, hy + 7], [hx - 9, hy + 1]], W2, .9);
	x.strokeStyle = 'rgba(10,12,20,.75)'; x.lineWidth = 1; x.beginPath(); x.moveTo(hx + 3, hy - 9); x.lineTo(hx + 1, hy - 1); x.lineTo(hx + 13, hy + 5); x.moveTo(hx + 1, hy - 1); x.lineTo(hx + 5, hy + 7); x.stroke();
	/* the diamond ear, dark inside */
	P([[hx - 6, hy - 6], [hx - 15, hy - 12], [hx - 21, hy - 8], [hx - 12, hy - 2]], W1, 1.3);
	P([[hx - 9, hy - 6], [hx - 15, hy - 10], [hx - 18, hy - 8], [hx - 12, hy - 4]], '#1a1d28', .6);
	/* the near antler, white */
	antler(0, W1, 3);
	/* a narrow, slanted eye */
	x.fillStyle = ink; x.beginPath(); x.moveTo(hx + 3, hy - 3); x.lineTo(hx + 9, hy - 2.2); x.lineTo(hx + 4, hy - .8); x.closePath(); x.fill();
	x.strokeStyle = ink; x.lineWidth = 1.2; x.beginPath(); x.moveTo(hx + 2, hy - 5.5); x.lineTo(hx + 9, hy - 4); x.stroke();   /* the brow */
	/* the red nose, glowing */
	x.drawImage(A.pink, hx + 15 - 9, hy + 2 - 9, 18, 18);
	P([[hx + 12, hy], [hx + 16, hy - .5], [hx + 18, hy + 2], [hx + 16, hy + 4.5], [hx + 12, hy + 4]], '#e3283e', 1);
	x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(hx + 14, hy + .5, 1.6, 1);
	/* the arm and the weapon, turned to the aim */
	x.translate(6, -34 - bob); x.rotate(aim); x.translate(-recoil * 4, 0);
	A.weapon(x, weapon);
	P([[-2, -3], [8, -3], [9, 3], [-1, 4]], W1, 1.1);
	x.restore();
};
/* the weapons, each its own shape and colours (drawn pointing right from the shoulder) */
A.MUZZLE = {icicle: 26, cane: 34, flurry: 32, snowplow: 38, hail: 44, bauble: 36, hearth: 38, aurora: 42, bells: 40};
A.weapon = function (x, w) {
	const R = (X, Y, ww, h, c, s) => { x.fillStyle = c; x.fillRect(X, Y, ww, h); if (s) { x.strokeStyle = s; x.lineWidth = 1; x.strokeRect(X + .5, Y + .5, ww - 1, h - 1) } };
	switch (w) {
	case 'icicle': R(6, -2, 12, 6, '#5d7a99', '#2a3a50'); x.fillStyle = '#bfe8ff'; x.beginPath(); x.moveTo(17, -2); x.lineTo(27, 1); x.lineTo(17, 3); x.closePath(); x.fill(); R(8, 3, 4, 6, '#3d4f66'); break;
	case 'cane': R(4, -2, 30, 5, '#f4f4f4', '#7a1a20'); for (let i = 0; i < 6; i++) { x.fillStyle = '#d42a35'; x.beginPath(); x.moveTo(6 + i * 5, -2); x.lineTo(9 + i * 5, -2); x.lineTo(7 + i * 5, 3); x.lineTo(4 + i * 5, 3); x.fill() } x.strokeStyle = '#d42a35'; x.lineWidth = 3; x.beginPath(); x.arc(5, 4, 4, PI * .5, PI * 1.5, false); x.stroke(); R(14, 3, 4, 6, '#7a1a20'); break;
	case 'flurry': R(4, -3, 26, 7, '#7fa9c9', '#2a3a50'); R(12, 4, 5, 9, '#2a3a50'); for (let i = 0; i < 3; i++) { x.fillStyle = '#e6f6ff'; circ(x, 10 + i * 6, 0, 1.5); x.fill() } R(28, -1, 5, 3, '#bfe8ff'); break;
	case 'snowplow': R(4, -4, 34, 8, '#c94b2a', '#4a1a10'); R(28, -5, 10, 10, '#e8e0d0', '#4a1a10'); R(6, 4, 10, 4, '#6b4a2f'); break;
	case 'hail': R(2, -2, 42, 5, '#3b4a5e', '#141c28'); R(12, -7, 14, 5, '#8fb8d8', '#141c28'); R(4, 3, 8, 5, '#5c3f28'); break;
	case 'bauble': R(4, -5, 30, 10, '#2f6b4a', '#123020'); circ(x, 36, 0, 6); fl(x, '#d4af37', '#5a4a10'); R(10, 5, 5, 7, '#123020'); break;
	case 'hearth': R(4, -4, 30, 8, '#6b4a2f', '#2a1a10'); R(30, -3, 8, 6, '#3a2a20'); x.drawImage(A.fire, 30, -10, 16, 16); R(10, -10, 8, 6, '#b5462a', '#2a1a10'); break;
	case 'aurora': R(4, -3, 34, 6, '#2a2f5a', '#0d1028'); x.fillStyle = '#7dffcf'; x.fillRect(10, -1, 26, 2); x.drawImage(A.ice, 32, -10, 20, 20); break;
	case 'bells': R(2, -5, 32, 10, '#8a6a2a', '#3a2a10'); for (let i = 0; i < 3; i++) { circ(x, 34 + i * 2, -3 + i * 3, 3); fl(x, '#e8c24a', '#5a4a10', 1) } R(10, 5, 6, 8, '#3a2a10'); break;
	}
};

/* ---------- the survivors behind the barricade (small, round, friendly) ---------- */
A.SURV = {bunny: ['#ffffff', '#f7b9cf'], badger: ['#4a4a52', '#f2f2f2'], fox: ['#e0782e', '#fff3e6'], hare: ['#d8c6a8', '#fff'], otter: ['#7a5a3a', '#e8d6bf'], owl: ['#a89276', '#f4ead8']};
A.survivor = function (x, kind, X, t, firing, Y0, armed, out) {
	if (out) { x.save(); x.globalAlpha = .45; x.translate(X, (Y0 || A.GROUND) - 6); x.rotate(-PI / 2); x.translate(-X, -((Y0 || A.GROUND) - 6)) }
	const [c1, c2] = A.SURV[kind] || A.SURV.bunny, Y = (Y0 || A.GROUND) - 16 + Math.sin(t * 3 + X) * .6;
	if (kind == 'bunny' || kind == 'hare') { oval(x, X - 3, Y - 20, 2.5, 7, -.2); fl(x, c1, '#5d4b63', 1); oval(x, X + 2, Y - 20, 2.5, 7, .2); fl(x, c1, '#5d4b63', 1) }
	if (kind == 'fox') { x.beginPath(); x.moveTo(X - 5, Y - 14); x.lineTo(X - 3, Y - 22); x.lineTo(X, Y - 15); x.moveTo(X + 1, Y - 15); x.lineTo(X + 4, Y - 22); x.lineTo(X + 6, Y - 14); fl(x, c1, '#5a3010', 1) }
	if (kind == 'owl') { x.beginPath(); x.moveTo(X - 6, Y - 16); x.lineTo(X - 5, Y - 21); x.lineTo(X - 2, Y - 17); x.moveTo(X + 2, Y - 17); x.lineTo(X + 5, Y - 21); x.lineTo(X + 6, Y - 16); fl(x, c1, '#4a3a2a', 1) }
	oval(x, X, Y, 8, 9); fl(x, c1, '#3a3040', 1.2);
	oval(x, X, Y + 2, 5, 5); x.fillStyle = c2; x.fill();
	circ(x, X, Y - 10, 7); fl(x, c1, '#3a3040', 1.2);
	if (kind == 'badger') { x.fillStyle = c2; x.fillRect(X - 1.5, Y - 17, 3, 10) }
	if (kind == 'owl') { circ(x, X - 2.6, Y - 11, 2.6); x.fillStyle = '#fff'; x.fill(); circ(x, X + 2.6, Y - 11, 2.6); x.fill() }
	circ(x, X + 2.5, Y - 11, 1.3); x.fillStyle = '#2b2230'; x.fill(); circ(x, X - 2.5, Y - 11, 1.3); x.fill();
	/* a small crossbow (unless a mugger has it) */
	if (armed !== false) { x.strokeStyle = '#6b4a2f'; x.lineWidth = 2; x.beginPath(); x.moveTo(X + 4, Y - 2); x.lineTo(X + 16, Y - 6); x.stroke() }
	if (firing) { x.drawImage(A.warm, X + 10, Y - 14, 14, 14) }
	if (out) x.restore();
};

/* ---------- corrupted elves ---------- */
/* kinds: size, skin, clothes, eye colour. The eyes say what an elf will do: white for the ordinary ones, red for
   sprinters, yellow for bloaters, green for muggers (red is kept for the wendigo too, later) */
const EYE = {white: '#eef2ff', red: '#ff3b3b', yellow: '#ffd23f', green: '#7dff4a', cyan: '#3ff0ff'};
A.EYE = EYE;
A.ELF = {
	shambler: {s: 1, skin: '#3d3448', cloth: '#1f2a24', hat: '#2a1f33', eye: EYE.white},
	crawler: {s: .95, skin: '#3d3448', cloth: '#232a1f', hat: '#2a1f33', eye: EYE.white},
	spitter: {s: 1.05, skin: '#38304a', cloth: '#1d2633', hat: '#3a1f33', eye: EYE.white},
	brute: {s: 1.5, skin: '#342c3e', cloth: '#1a1d2a', hat: '#2a1f33', eye: EYE.white},
	foreman: {s: 2.3, skin: '#2e2638', cloth: '#14161f', hat: '#2a1220', eye: EYE.white},
	sprinter: {s: .92, skin: '#3a3346', cloth: '#2a1f33', hat: '#1f2a24', eye: EYE.red},
	bloater: {s: 1.35, skin: '#3b3245', cloth: '#262014', hat: '#2a1f33', eye: EYE.yellow},
	mugger: {s: .95, skin: '#383046', cloth: '#1e2a1a', hat: '#14201a', eye: EYE.green},
	shielder: {s: 1.05, skin: '#3a3346', cloth: '#1d2630', hat: '#1a2430', eye: EYE.cyan},
	wendigo: {s: 2.5, skin: '#231c2a', cloth: '#120e16', hat: '#120e16', eye: EYE.red}};
/* hit areas (relative to the feet), scaled by size: the head is the weak spot */
A.elfHead = (kind, s) => kind == 'crawler' ? {dx: -10 * s, dy: -12 * s, r: 6.5 * s} : kind == 'wendigo' ? {dx: -4 * s, dy: -46 * s, r: 5.5 * s} : {dx: -1 * s, dy: -36 * s, r: 7 * s};
A.elfBody = (kind, s) => kind == 'crawler' ? {dx: 2 * s, dy: -8 * s, r: 9 * s} : kind == 'wendigo' ? {dx: 0, dy: -28 * s, r: 9 * s} : {dx: 0, dy: -18 * s, r: 10.5 * s};
A.elf = function (x, e, t, rf) {
	const D = A.ELF[e.kind], s = D.s * A.depth(e.lane || 0), X = e.x, Y = A.laneY(e.lane || 0) - (e.lift || 0), ph = e.walk;
	x.save(); x.translate(X, Y);
	/* a shadow */
	x.fillStyle = 'rgba(0,0,0,.35)'; oval(x, 0, 2 + (e.lift || 0), 12 * s, 3 * s); x.fill();
	if (e.chill > 0) { x.globalAlpha = .9 }
	const jit = rf ? 0 : (hash(e.id, Math.floor(t * 12)) > .93 ? (hash(e.id, 3) - .5) * 3 : 0);
	x.translate(jit, 0); x.scale(s, s);
	const lineC = e.hitT > 0 ? '#ffd8d8' : '#06030a';
	if (e.kind == 'wendigo') { wendigo(x, e, t, rf, lineC, D); x.restore(); return }
	if (e.kind == 'crawler') {
		/* dragging itself low along the snow */
		x.beginPath(); x.moveTo(-16, -6); x.lineTo(-6, -14); x.lineTo(8, -12); x.lineTo(16, -6); x.lineTo(12, -1); x.lineTo(-12, -1); x.closePath(); fl(x, D.cloth, lineC, 1.3);
		x.strokeStyle = D.skin; x.lineWidth = 3; x.beginPath(); x.moveTo(-12, -6); x.lineTo(-20, -1 + Math.sin(ph) * 2); x.moveTo(-6, -8); x.lineTo(-14, 0 - Math.sin(ph) * 2); x.stroke();
		head(x, -10, -12, D, e, t, rf, lineC);
	} else {
		const sw = Math.sin(ph) * (e.kind == 'sprinter' ? (e.sprint > 0 ? 9 : 6) : 4);
		/* legs */
		x.strokeStyle = D.cloth; x.lineWidth = 4; x.beginPath(); x.moveTo(-2, -12); x.lineTo(-3 + sw, 0); x.moveTo(2, -12); x.lineTo(3 - sw, 0); x.stroke();
		x.fillStyle = '#0d0a10'; x.fillRect(-6 + sw, -2, 6, 3); x.fillRect(-1 - sw, -2, 6, 3);
		/* a torn tunic, jagged at the hem */
		x.beginPath(); x.moveTo(-8, -28); x.lineTo(7, -28); x.lineTo(9, -14); x.lineTo(6, -10); x.lineTo(3, -13); x.lineTo(0, -9); x.lineTo(-3, -13); x.lineTo(-6, -10); x.lineTo(-9, -14); x.closePath(); fl(x, D.cloth, lineC, 1.3);
		x.strokeStyle = '#4a3a20'; x.lineWidth = 2; x.beginPath(); x.moveTo(-8, -18); x.lineTo(8, -18); x.stroke();
		/* arms reaching for the barricade */
		const reach = e.attacking ? Math.sin(t * 10 + e.id) * 4 : Math.sin(ph) * 2;
		x.strokeStyle = D.skin; x.lineWidth = 3.2; x.beginPath(); x.moveTo(-6, -26); x.lineTo(-15 + reach, -24 + reach * .3); x.moveTo(-3, -24); x.lineTo(-13 - reach, -20); x.stroke();
		x.fillStyle = D.skin; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(-15 + reach, -24 + reach * .3); x.lineTo(-19 + reach, -27 + k * 2.5); x.lineTo(-15 + reach, -23 + k); x.fill() }
		/* a bloater's swollen belly, cracked and glowing */
		if (e.kind == 'bloater') { oval(x, 1, -19, 11, 10); fl(x, '#2e2636', lineC, 1.3); x.strokeStyle = 'rgba(255,210,63,' + (rf ? .7 : .5 + .4 * Math.sin(t * 5 + e.id)) + ')'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-5, -26); x.lineTo(-1, -20); x.lineTo(-4, -14); x.moveTo(4, -25); x.lineTo(2, -19); x.lineTo(6, -13); x.stroke() }
		/* a mugger's sack; and the stolen crossbow while it runs */
		if (e.kind == 'mugger') { oval(x, 7, -24, 5, 6); fl(x, '#3a3020', lineC, 1); if (e.loot >= 0) { x.strokeStyle = '#6b4a2f'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-14, -22); x.lineTo(2, -26); x.stroke(); x.strokeStyle = '#c9a64a'; x.lineWidth = 1; x.beginPath(); x.moveTo(-11, -27); x.lineTo(-9, -18); x.stroke() } }
		if (e.kind == 'spitter') { x.fillStyle = 'rgba(176,77,255,.7)'; circ(x, -6, -32, 2); x.fill() }
		head(x, -1, -36, D, e, t, rf, lineC);
		if (e.shield) shield(x, rf);
	}
	x.restore();
	/* static at the edges */
	if (!rf) { x.fillStyle = 'rgba(176,77,255,.5)'; for (let i = 0; i < 3; i++) x.fillRect(X + (hash(e.id + i, Math.floor(t * 20)) - .5) * 22 * s, Y - hash(i, Math.floor(t * 15) + e.id) * 40 * s, 2, 2) }
	if (e.chill > 0) { x.globalAlpha = .45; x.drawImage(A.ice, X - 16 * s, Y - 40 * s, 32 * s, 40 * s); x.globalAlpha = 1 }
	if (e.burn > 0) { x.globalAlpha = .7; x.drawImage(A.fire, X - 10 * s + (hash(e.id, Math.floor(t * 10)) - .5) * 8, Y - 30 * s, 20 * s, 24 * s); x.globalAlpha = 1 }
};
/* the wendigo: an original design for this game. Gaunt and very tall, long-limbed, with a narrow skull-like face and
   sharp branching antlers (unlike Rudolf's soft round ones), in the same dark, jagged corruption as the elves; its
   eyes are always red. Frightening by shape and size, not by gore. */
function wendigo(x, e, t, rf, lineC, D) {
	const ph = e.walk, sw = Math.sin(ph) * 5;
	/* long legs, bent backwards at the knee */
	x.strokeStyle = D.skin; x.lineWidth = 3.2;
	for (const k of [1, -1]) { x.beginPath(); x.moveTo(k * 2, -22); x.lineTo(k * 2 + 4 + sw * k, -11); x.lineTo(k * 1 - 2 + sw * k, 0); x.stroke() }
	/* a narrow, ridged torso, hunched forward */
	x.beginPath(); x.moveTo(-5, -38); x.lineTo(6, -40); x.lineTo(7, -30); x.lineTo(5, -21); x.lineTo(-4, -20); x.lineTo(-7, -29); x.closePath(); fl(x, D.skin, lineC, 1);
	x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = .8; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-5, -35 + i * 3.5); x.lineTo(4, -36 + i * 3.5); x.stroke() }
	/* very long arms with long claws, reaching ahead */
	const reach = e.hold ? -8 : Math.sin(t * 2 + e.id) * 2;
	x.strokeStyle = D.skin; x.lineWidth = 2.4;
	x.beginPath(); x.moveTo(-4, -37); x.lineTo(-14, -30 + reach); x.lineTo(-24, e.hold ? -40 : -20 + reach); x.stroke();
	x.beginPath(); x.moveTo(2, -37); x.lineTo(-8, -28); x.lineTo(-18, -16 - reach); x.stroke();
	x.strokeStyle = '#0c0910'; x.lineWidth = 1; for (const [hx, hy] of [[-24, e.hold ? -40 : -20 + reach], [-18, -16 - reach]]) for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx - 4, hy - 2 + k * 2); x.stroke() }
	/* the skull-like face on a long neck */
	x.strokeStyle = D.skin; x.lineWidth = 2.6; x.beginPath(); x.moveTo(0, -39); x.lineTo(-3, -43); x.stroke();
	x.beginPath(); x.moveTo(-8, -47); x.lineTo(-4, -51); x.lineTo(1, -50); x.lineTo(2, -45); x.lineTo(-2, -41); x.lineTo(-7, -42); x.closePath(); fl(x, '#3a3240', lineC, 1);
	/* sharp branching antlers */
	x.strokeStyle = '#2a2230'; x.lineWidth = 1.6;
	for (const k of [1, -1]) { const bx = -3 + k * 2, by = -50; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + k * 6, by - 8); x.lineTo(bx + k * 9, by - 16); x.moveTo(bx + k * 6, by - 8); x.lineTo(bx + k * 12, by - 9); x.moveTo(bx + k * 8, by - 13); x.lineTo(bx + k * 4, by - 18); x.moveTo(bx + k * 10, by - 9); x.lineTo(bx + k * 14, by - 13); x.stroke() }
	/* red eyes, narrow, no highlights */
	if (!rf) x.drawImage(A.eyeR, -12, -52, 14, 10);
	x.fillStyle = D.eye; x.beginPath(); x.moveTo(-7, -47); x.lineTo(-4.5, -46.4); x.lineTo(-7, -45.6); x.closePath(); x.fill(); x.beginPath(); x.moveTo(-3.5, -47); x.lineTo(-1, -46.4); x.lineTo(-3.5, -45.6); x.closePath(); x.fill();
	/* frost breath */
	if (!rf) { x.fillStyle = 'rgba(220,230,255,.25)'; x.beginPath(); x.ellipse(-12 - (t * 8 % 6), -44, 3 + (t * 4 % 3), 1.6, 0, 0, 7); x.fill() }
}
/* a shield: an old sled-board, iron-banded and cracked, held upright from the waist to above the head; the lower legs
   and feet show beneath it */
function shield(x, rf) {
	x.beginPath(); x.moveTo(-17, -12); x.lineTo(-9, -12); x.lineTo(-9, -52); x.quadraticCurveTo(-13, -56, -17, -52); x.closePath(); fl(x, '#4a3626', '#0d0a10', 1.2);
	x.fillStyle = '#6a6e7a'; for (const y of [-20, -33, -46]) x.fillRect(-17, y, 8, 2);
	x.fillStyle = '#9aa0ae'; for (const y of [-19, -32, -45]) { x.fillRect(-15.5, y, 1.2, 1.2); x.fillRect(-11.5, y, 1.2, 1.2) }
	x.strokeStyle = rf ? 'rgba(63,240,255,.4)' : 'rgba(63,240,255,.55)'; x.lineWidth = .8; x.beginPath(); x.moveTo(-15, -40); x.lineTo(-12, -36); x.lineTo(-14, -28); x.stroke();
}
A.shieldDown = function (x, X, Y, s) { x.save(); x.translate(X, Y - 2); x.scale(s, s); x.fillStyle = 'rgba(0,0,0,.3)'; oval(x, 0, 3, 22, 3); x.fill(); x.fillStyle = '#4a3626'; x.fillRect(-20, -3, 40, 6); x.strokeStyle = '#0d0a10'; x.lineWidth = 1; x.strokeRect(-20, -3, 40, 6); x.fillStyle = '#6a6e7a'; for (const dx of [-12, 0, 12]) x.fillRect(dx, -3, 2, 6); x.restore() };
function head(x, X, Y, D, e, t, rf, lineC) {
	/* long pointed ears, a gaunt face, a drooping hat with a cracked bell */
	x.beginPath(); x.moveTo(X + 2, Y - 2); x.lineTo(X + 12, Y - 8); x.lineTo(X + 4, Y + 2); x.closePath(); fl(x, D.skin, lineC, 1.1);
	x.beginPath(); x.moveTo(X - 7, Y - 2); x.lineTo(X - 4, Y - 7); x.lineTo(X + 4, Y - 7); x.lineTo(X + 7, Y - 1); x.lineTo(X + 4, Y + 7); x.lineTo(X - 1, Y + 8); x.lineTo(X - 6, Y + 4); x.closePath(); fl(x, D.skin, lineC, 1.2);
	x.beginPath(); x.moveTo(X - 7, Y - 4); x.lineTo(X + 7, Y - 5); x.lineTo(X + 4, Y - 13); x.lineTo(X + 10, Y - 19 + Math.sin(t * 2 + e.id) * 2); x.lineTo(X - 2, Y - 12); x.closePath(); fl(x, D.hat, lineC, 1.1);
	circ(x, X + 10, Y - 19 + Math.sin(t * 2 + e.id) * 2, 2); fl(x, '#6a5a2a', lineC, .8);
	/* narrow glowing eyes, facing left */
	if (!rf) x.drawImage({[EYE.red]: A.eyeR, [EYE.yellow]: A.eyeY, [EYE.green]: A.eyeG, [EYE.cyan]: A.eyeC}[D.eye] || A.eyeW, X - 12, Y - 8, 16, 12);
	x.fillStyle = D.eye; x.beginPath(); x.moveTo(X - 6, Y - 1); x.lineTo(X - 1, Y); x.lineTo(X - 6, Y + 1.4); x.closePath(); x.fill();
	x.beginPath(); x.moveTo(X - 1, Y - 1); x.lineTo(X + 3, Y); x.lineTo(X - 1, Y + 1.3); x.closePath(); x.fill();
	x.strokeStyle = D.eye; x.lineWidth = .9; x.beginPath(); x.moveTo(X - 5, Y + 4.5); x.lineTo(X - 3, Y + 3.5); x.lineTo(X - 1, Y + 4.5); x.lineTo(X + 1, Y + 3.5); x.stroke();
}
/* what is left when one falls: a splash of dark ichor that stains the snow for the rest of the night */
A.slush = function (x, d, t) {
	const a = .85 - Math.min(.35, d.t / 120), r = d.r * Math.min(1, d.t * 4);
	x.fillStyle = `rgba(28,6,14,${a})`; oval(x, d.x, d.y, r * 1.3, 3 + d.r * .14); x.fill();
	for (let i = 0; i < 6; i++) { const sx = d.x + (hash(d.id, i) - .5) * r * 3.2, sy = d.y + (hash(i, d.id) - .5) * 6; oval(x, sx, sy, 1.5 + hash(d.id, i + 9) * 3 * Math.min(1, d.t * 4), 1 + hash(d.id, i + 3) * 1.4); x.fill() }
	x.fillStyle = `rgba(120,40,150,${.35 * a})`; for (let i = 0; i < 3; i++) x.fillRect(d.x + (hash(d.id, i) - .5) * d.r * 1.6, d.y - 1 - hash(i, d.id) * 3, 2, 2);
};
/* a chunk of a fallen elf, tumbling (fb.js moves it) */
A.gib = function (x, g) { x.save(); x.translate(g.x, g.y); x.rotate(g.a); x.fillStyle = g.col; x.strokeStyle = '#08040a'; x.lineWidth = 1; x.beginPath(); x.moveTo(-g.r, -g.r * .5); x.lineTo(g.r * .3, -g.r); x.lineTo(g.r, g.r * .2); x.lineTo(-g.r * .2, g.r * .8); x.closePath(); x.fill(); x.stroke(); x.restore() };
/* a crossbow a panicking survivor dropped */
A.dropped = function (x, X, Y) { x.strokeStyle = '#4a3220'; x.lineWidth = 2; x.beginPath(); x.moveTo(X - 7, Y - 1); x.lineTo(X + 7, Y - 3); x.stroke(); x.strokeStyle = '#8a7a5a'; x.lineWidth = 1; x.beginPath(); x.moveTo(X + 2, Y - 7); x.lineTo(X + 4, Y + 2); x.stroke() };

/* ---------- Captain Quill and his sleigh (Night 15) ---------- */
/* an original character: a rockhopper penguin (slate-blue back, spiky yellow crest, orange-red beak, pink feet) in a red
   winter coat with white fur trim, flying a red sleigh pulled by two snowy owls */
A.sleigh = function (x, X, Y, t, wave) {
	x.save(); x.translate(X, Y); x.scale(1.5, 1.5);
	/* the owls, flapping, on long reins */
	for (let k = 0; k < 2; k++) {
		const ox = 70 + k * 46, oy = -14 + Math.sin(t * 6 + k) * 3, f = Math.sin(t * 12 + k * 2);
		x.strokeStyle = '#c9a64a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(40, -6); x.lineTo(ox - 6, oy + 2); x.stroke();
		x.beginPath(); x.moveTo(ox - 2, oy - 2); x.quadraticCurveTo(ox - 16, oy - 16 - f * 12, ox - 26, oy - 4 - f * 8); x.quadraticCurveTo(ox - 14, oy + 2, ox - 2, oy + 2); fl(x, '#f4f6fa', '#6a7f9a', 1);
		oval(x, ox, oy, 9, 8); fl(x, '#ffffff', '#6a7f9a', 1.1);
		for (let i = 0; i < 4; i++) { x.fillStyle = '#8a96a8'; x.fillRect(ox - 6 + i * 3, oy + 1 + (i % 2) * 2, 1.5, 1.5) }
		circ(x, ox + 4, oy - 2, 2.4); x.fillStyle = '#ffd34d'; x.fill(); circ(x, ox + 4.5, oy - 2, 1.1); x.fillStyle = '#2b2230'; x.fill();
		x.fillStyle = '#4a4a52'; x.beginPath(); x.moveTo(ox + 8, oy); x.lineTo(ox + 11, oy + 1.5); x.lineTo(ox + 8, oy + 3); x.fill();
	}
	/* the sleigh */
	x.beginPath(); x.moveTo(-40, -20); x.lineTo(30, -20); x.quadraticCurveTo(44, -20, 42, -6); x.lineTo(-34, -4); x.quadraticCurveTo(-46, -8, -40, -20); fl(x, '#b52a2a', '#4a0f0f', 1.6);
	x.strokeStyle = '#d9b14a'; x.lineWidth = 2; x.beginPath(); x.moveTo(-38, -14); x.lineTo(34, -14); x.stroke();
	x.strokeStyle = '#d9b14a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-44, 4); x.lineTo(40, 4); x.quadraticCurveTo(52, 4, 50, -6); x.moveTo(-30, -4); x.lineTo(-30, 4); x.moveTo(20, -4); x.lineTo(20, 4); x.stroke();
	/* the captain */
	const cx = -6, cy = -30;
	oval(x, cx, cy + 4, 11, 13); fl(x, '#c42a2a', '#4a0f0f', 1.3);
	x.fillStyle = '#ffffff'; x.fillRect(cx - 2, cy - 8, 4, 22); oval(x, cx, cy + 15, 11, 2.6); x.fill();
	circ(x, cx + 1, cy - 12, 9); fl(x, '#3a4a66', '#1a2033', 1.2);
	oval(x, cx + 4, cy - 10, 5, 5.5); x.fillStyle = '#ffffff'; x.fill();
	/* the crest: spiky yellow feathers sweeping back from the brow */
	x.strokeStyle = '#ffd23f'; x.lineWidth = 1.6; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(cx + 3, cy - 16); x.lineTo(cx - 8 - i * 2, cy - 22 - i * 2 + Math.sin(t * 4 + i) * 1.2); x.stroke() }
	circ(x, cx + 5, cy - 13, 1.6); x.fillStyle = '#c42a2a'; x.fill(); circ(x, cx + 5.4, cy - 13.4, .6); x.fillStyle = '#fff'; x.fill();
	x.fillStyle = '#ff6a2a'; x.beginPath(); x.moveTo(cx + 9, cy - 11); x.lineTo(cx + 16, cy - 9); x.lineTo(cx + 9, cy - 7); x.closePath(); x.fill();
	/* a wing raised in a wave */
	x.save(); x.translate(cx + 8, cy - 2); x.rotate(-.9 + Math.sin(t * (wave ? 8 : 2)) * (wave ? .4 : .1)); oval(x, 6, 0, 8, 3); fl(x, '#c42a2a', '#4a0f0f', 1); x.fillStyle = '#fff'; oval(x, 13, 0, 2.5, 3); x.fill(); x.restore();
	x.fillStyle = '#ff9fb0'; oval(x, cx - 2, cy + 18, 3, 1.5); x.fill(); oval(x, cx + 4, cy + 18, 3, 1.5); x.fill();
	x.globalAlpha = .45; x.drawImage(A.warm, -50, -50, 100, 70); x.globalAlpha = 1;
	x.restore();
};
})();
