/* ===== Block Drop: a falling-blocks puzzle for Rudolf OS (docs/plan-games.md in RudolfOS). Stack the falling blocks
   into full rows to clear them. Its own twists: an 8-wide, 16-deep well; pieces of three and four blocks; colours
   that do not follow the shape (each colour has its own mark, so colour is never the only clue); and prisms: now and
   then a piece carries one, and where it lands every block of the prism's colour bursts. The blocks above then
   tumble straight down their columns, and any rows that fill clear too, in a chain worth more each step.
   Classic (faster every 10 rows), Relaxed (one steady speed), Daily (3 minutes on the day's blocks, the same for
   everyone).
   Keys: arrows or A/D to move, Down or S to move down, Up/W/X to turn right, Z/Q to turn left, Space to drop, N new,
   P pause. Controller: d-pad or stick, A turn right, B turn left, d-pad up or Y to drop, Start pause.
   Touch and mouse: drag sideways to move, tap (or click) to turn, right-click to turn left, drag down to move down,
   flick down to drop; the touch bar's buttons do the same.
   Original work: original name, look and rules. GPL-2.0-or-later. ===== */
(function () {
'use strict';
const W = 8, H = 16, CELL = 32, PAD = 8, SIDE = 132, TOP = 70;
const MODES = {classic: 'Classic', relaxed: 'Relaxed', daily: 'Daily'};
const DAILY_TIME = 180, PRISM_EVERY = 12;
/* the pieces: three- and four-block shapes in a box of n×n (rotated as a whole) */
const SHAPES = {
	I3: {n: 3, c: [[0, 1], [1, 1], [2, 1]]},
	V3: {n: 2, c: [[0, 0], [0, 1], [1, 1]]},
	O: {n: 2, c: [[0, 0], [1, 0], [0, 1], [1, 1]]},
	T: {n: 3, c: [[0, 1], [1, 1], [2, 1], [1, 0]]},
	S: {n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]]},
	Z: {n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]]},
	L: {n: 3, c: [[0, 1], [1, 1], [2, 1], [2, 0]]},
	J: {n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]]}};
const NAMES = Object.keys(SHAPES);
const ROWPTS = [0, 100, 250, 450, 700];
const rowPts = n => n < ROWPTS.length ? ROWPTS[n] : 700 + 350 * (n - 4);
const $ = s => document.querySelector(s);
const cv = $('#cv');
let save = {v: 1, best: {}, daily: {}, played: 0, mode: 'classic'};
let G = null, view = null, fx = [], vdown = new Set(), held = {};

/* ---------- the well ---------- */
const idx = (c, r) => r * W + c;
function newGame(mode, opt) {
	mode = MODES[mode] ? mode : 'classic';
	const day = RG.today(), seed = mode == 'daily' ? 'block-drop:' + day : (opt && opt.seed) || String(Math.random());
	G = {mode, day, seed, rnd: RG.rng(seed), board: new Uint8Array(W * H), bag: [], queue: [], piece: null, count: 0,
		score: 0, rows: 0, level: 1, t: 0, fall: 0, lockT: 0, lockMoves: 0, state: 'play', clear: null, chain: 0, bursts: 0, best: false};
	fx = [];
	for (let i = 0; i < 3; i++) G.queue.push(deal());
	spawn();
	save.mode = mode; persist(); ui();
	say(MODES[mode] + ' game.');
}
/* the next piece: every shape once in each bag of eight, a colour of its own, every 12th with a prism */
function deal() {
	if (!G.bag.length) { G.bag = NAMES.slice(); for (let i = G.bag.length - 1; i > 0; i--) { const j = Math.floor(G.rnd() * (i + 1)); [G.bag[i], G.bag[j]] = [G.bag[j], G.bag[i]] } }
	const s = G.bag.pop(), S = SHAPES[s]; G.count++;
	const col = Math.floor(G.rnd() * 5), prism = G.count % PRISM_EVERY == 0 ? Math.floor(G.rnd() * S.c.length) : -1;
	return {s, n: S.n, cells: S.c.map(p => p.slice()), col, prism};
}
function spawn(p) {
	p = p || G.queue.shift(); if (G.queue.length < 3) G.queue.push(deal());
	const minR = Math.min(...p.cells.map(q => q[1]));
	G.piece = Object.assign(p, {x: Math.floor((W - p.n) / 2), y: -minR});
	G.fall = 0; G.lockT = 0; G.lockMoves = 0;
	if (hits(G.piece.cells, G.piece.x, G.piece.y)) over();
}
function hits(cells, x, y) {
	for (const [c, r] of cells) {
		const X = c + x, Y = r + y;
		if (X < 0 || X >= W || Y >= H) return true;
		if (Y >= 0 && G.board[idx(X, Y)]) return true;
	}
	return false;
}
function move(dx, dy) {
	const p = G.piece; if (!p || G.state != 'play' || G.clear) return false;
	if (hits(p.cells, p.x + dx, p.y + dy)) return false;
	p.x += dx; p.y += dy;
	if (dx) bump();
	return true;
}
/* a successful move or turn on the ground gives a little more time before it locks (15 times at most) */
function bump() { if (G.lockT > 0 && G.lockMoves < 15) { G.lockT = 0; G.lockMoves++ } }
const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];
function turn(dir) {
	const p = G.piece; if (!p || G.state != 'play' || G.clear || p.s == 'O') return false;
	const n = p.n, rc = p.cells.map(([c, r]) => dir > 0 ? [n - 1 - r, c] : [r, n - 1 - c]);
	for (const [kx, ky] of KICKS) if (!hits(rc, p.x + kx, p.y + ky)) { p.cells = rc; p.x += kx; p.y += ky; bump(); sfx('turn'); return true }
	return false;
}
function landY() { const p = G.piece; let y = p.y; while (!hits(p.cells, p.x, y + 1)) y++; return y }
function hardDrop() {
	if (!G.piece || G.state != 'play' || G.clear) return;
	const y = landY(); G.score += 2 * (y - G.piece.y); G.piece.y = y; lock();
}
function lock() {
	const p = G.piece; G.piece = null;
	let top = false;
	p.cells.forEach(([c, r]) => { const X = c + p.x, Y = r + p.y; if (Y < 0) top = true; else G.board[idx(X, Y)] = p.col + 1 });
	if (top) return over();
	sfx('lock'); G.chain = 0;
	let burst = null;
	if (p.prism >= 0) {
		burst = new Set();
		for (let i = 0; i < W * H; i++) if (G.board[i] == p.col + 1) burst.add(i);
		const [c, r] = p.cells[p.prism]; fx.push({k: 'prism', x: (c + p.x + .5) * CELL, y: (r + p.y + .5) * CELL, col: p.col, t: 0});
	}
	resolve(burst);
	ui();
}
function fullRows() { const out = []; for (let r = 0; r < H; r++) { let f = true; for (let c = 0; c < W; c++) if (!G.board[idx(c, r)]) { f = false; break } if (f) out.push(r) } return out }
/* what clears next: full rows and a prism's burst; nothing left → the next piece */
function resolve(burst) {
	const rows = fullRows();
	if (!rows.length && !(burst && burst.size)) { G.clear = null; if (G.state == 'play') spawn(); return }
	const cells = new Set(burst || []);
	rows.forEach(r => { for (let c = 0; c < W; c++) cells.add(idx(c, r)) });
	G.clear = {cells, rows, burst: !!(burst && burst.size), nb: burst ? burst.size : 0, t: 0};
	sfx(G.clear.burst ? 'burst' : 'row');
}
function finishClear() {
	const C = G.clear, lv = G.level, mult = 1 + G.chain;
	let pts = rowPts(C.rows.length) * lv * mult;
	if (C.burst) { pts += 15 * C.nb * lv; G.bursts++ }
	G.score += pts; G.rows += C.rows.length;
	if (C.rows.length || C.burst) fx.push({k: 'pts', v: pts, chain: G.chain, t: 0});
	if (C.burst || G.chain) {
		/* a burst (or a chain from one) leaves gaps: everything tumbles straight down its column */
		C.cells.forEach(i => G.board[i] = 0);
		for (let c = 0; c < W; c++) { let w = H - 1; for (let r = H - 1; r >= 0; r--) { const v = G.board[idx(c, r)]; if (v) { G.board[idx(c, r)] = 0; G.board[idx(c, w--)] = v } } }
	} else {
		/* full rows only: the rows above come down */
		const keep = []; for (let r = 0; r < H; r++) if (!C.rows.includes(r)) keep.push(G.board.slice(r * W, r * W + W));
		G.board.fill(0); const off = H - keep.length; keep.forEach((row, k) => G.board.set(row, (off + k) * W));
	}
	if (G.mode != 'relaxed') G.level = 1 + Math.floor(G.rows / 10);
	if (C.rows.length > 1 || G.chain) say((G.chain ? 'Chain ' + (G.chain + 1) + '! ' : '') + C.rows.length + ' rows.');
	G.chain++;
	G.clear = null;
	resolve(null);
	ui();
}
function over() {
	if (G.state == 'over') return;
	G.state = 'over'; G.piece = null; G.clear = null;
	save.played++;
	let best = false;
	if (G.mode == 'daily') { if (!(save.daily[G.day] >= G.score)) { save.daily[G.day] = G.score; best = true } trimDaily() }
	else if (!(save.best[G.mode] >= G.score) && G.score > 0) { save.best[G.mode] = G.score; best = true }
	G.best = best; persist(); sfx('over'); ui();
	const timeUp = G.mode == 'daily' && G.t >= DAILY_TIME;
	say((timeUp ? 'Time is up. ' : 'The well is full. ') + 'Score ' + G.score + '.');
	setTimeout(() => G && G.state == 'over' && dialog('<h2>' + (timeUp ? 'Time is up' : 'The well is full') + '</h2><p>' + MODES[G.mode] + ': <b>' + G.score.toLocaleString() + '</b> points, ' + G.rows + ' rows' + (best && G.score ? ', your best.' : '.') + '</p>' + (G.mode == 'daily' ? '<p>' + streakText() + '</p>' : ''),
		[['Play again', () => newGame(G.mode == 'daily' ? save.lastMode || 'classic' : G.mode), 1], ['Close', null]]), 600);
}
function trimDaily() { const k = Object.keys(save.daily).sort(); while (k.length > 120) delete save.daily[k.shift()] }
function streak() { let n = 0, d = new Date(); for (;;) { if (save.daily[RG.today(d)] === undefined) break; n++; d.setDate(d.getDate() - 1) } return n }
function streakText() { const n = streak(); return n > 1 ? n + ' days in a row.' : 'Come back tomorrow for new blocks.' }
const speed = () => G.mode == 'relaxed' ? 1 : Math.max(.06, .85 * Math.pow(.86, G.level - 1));

/* ---------- each step (60 a second) ---------- */
const DAS = .17, ARR = .05;
function want(a) { return RG.down(a) || vdown.has(a) }
function repeat(a, f, dt) {
	if (RG.pressed(a)) { f(); held[a] = -DAS; return }
	if (!want(a)) { held[a] = -DAS; return }
	held[a] = (held[a] || -DAS) + dt; while (held[a] >= 0) { f(); held[a] -= ARR }
}
function update(dt) {
	fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < 1.6);
	if (G.state != 'play') return;
	G.t += dt;
	if (G.mode == 'daily' && G.t >= DAILY_TIME) { G.t = DAILY_TIME; return over() }
	if (G.clear) { G.clear.t += dt; if (G.clear.t >= .3) finishClear(); return }
	if (!G.piece) return;
	repeat('left', () => move(-1, 0), dt); repeat('right', () => move(1, 0), dt);
	if (RG.pressed('cw')) turn(1); if (RG.pressed('ccw')) turn(-1);
	if (RG.pressed('drop')) return hardDrop();
	const soft = want('soft') || drag.soft;
	const g = soft ? Math.min(speed(), .035) : speed();
	if (hits(G.piece.cells, G.piece.x, G.piece.y + 1)) {
		G.lockT += dt; G.fall = 0;
		if (G.lockT >= .5 || (soft && G.lockT >= .12)) lock();
	} else {
		G.lockT = 0; G.fall += dt;
		while (G.fall >= g && G.piece) { G.fall -= g; if (move(0, 1)) { if (soft) G.score++ } else break }
	}
}

/* ---------- drawing ---------- */
const PAL = {
	light: {well: '#cdd6e3', wellLine: '#bcc7d6', frame: '#8796ad', panel: '#f4f7fb', text: '#1f2733', dim: '#5a6880', guide: 'rgba(40,60,100,.35)', flash: '#ffffff',
		cols: ['#e06a4e', '#e9b531', '#3aa58a', '#3f78c9', '#9a5cc6'], marks: 'rgba(255,255,255,.85)'},
	dark: {well: '#1b212b', wellLine: '#232b37', frame: '#3c4759', panel: '#1e242e', text: '#e3e9f2', dim: '#97a4b8', guide: 'rgba(190,210,255,.35)', flash: '#fff6d8',
		cols: ['#ef7c61', '#f1c54c', '#4fc0a2', '#5d93e2', '#b37ae0'], marks: 'rgba(15,18,24,.75)'}};
function tall() { return view && view.ch > view.cw * 1.15 }
function layout(cw, ch) { return ch > cw * 1.15 ? {w: W * CELL + PAD * 2, h: TOP + H * CELL + PAD * 2} : {w: W * CELL + PAD * 3 + SIDE, h: H * CELL + PAD * 2} }
function wellAt() { return tall() ? {x: PAD, y: TOP + PAD} : {x: PAD, y: PAD} }
function rrect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath() }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')' }
/* each colour's own mark: circle, triangle, square, diamond, cross */
function mark(x, k, cx, cy, s, P) {
	x.fillStyle = P.marks; x.strokeStyle = P.marks; x.lineWidth = s * .16; x.beginPath();
	if (k == 0) x.arc(cx, cy, s * .32, 0, 7);
	else if (k == 1) { x.moveTo(cx, cy - s * .36); x.lineTo(cx + s * .36, cy + s * .28); x.lineTo(cx - s * .36, cy + s * .28); x.closePath() }
	else if (k == 2) x.rect(cx - s * .28, cy - s * .28, s * .56, s * .56);
	else if (k == 3) { x.moveTo(cx, cy - s * .38); x.lineTo(cx + s * .34, cy); x.lineTo(cx, cy + s * .38); x.lineTo(cx - s * .34, cy); x.closePath() }
	else { x.moveTo(cx - s * .3, cy - s * .3); x.lineTo(cx + s * .3, cy + s * .3); x.moveTo(cx + s * .3, cy - s * .3); x.lineTo(cx - s * .3, cy + s * .3); x.stroke(); return }
	x.fill();
}
function block(x, X, Y, s, col, P, a) {
	const base = P.cols[col]; x.globalAlpha = a == null ? 1 : a;
	x.fillStyle = shade(base, -.28); rrect(x, X + 1, Y + 1, s - 2, s - 2, s * .22); x.fill();
	x.fillStyle = base; rrect(x, X + 1, Y + 1, s - 2, s - 5, s * .22); x.fill();
	x.fillStyle = shade(base, .35); rrect(x, X + s * .2, Y + s * .12, s * .6, s * .12, s * .06); x.fill();
	mark(x, col, X + s / 2, Y + s / 2 - 1, s * .55, P);
	x.globalAlpha = 1;
}
function prismGlint(x, X, Y, s, t) {
	const a = RG.reduceFlash ? .9 : .65 + .35 * Math.sin(t * 8);
	x.save(); x.globalAlpha = a; x.translate(X + s / 2, Y + s / 2); x.rotate(RG.reduceFlash ? 0 : t * 1.5);
	const g = x.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); ['#ff7a7a', '#ffd84a', '#5be3a6', '#6fb3ff', '#c48bff'].forEach((c, i) => g.addColorStop(i / 4, c));
	x.fillStyle = g; x.beginPath();
	for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .2 : s * .52, an = i / 8 * Math.PI * 2; x.lineTo(Math.cos(an) * r, Math.sin(an) * r) }
	x.closePath(); x.fill(); x.strokeStyle = 'rgba(20,24,32,.8)'; x.lineWidth = 3; x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); x.restore();
}
function drawPiece(x, p, ox, oy, s, P, clock) {
	p.cells.forEach(([c, r], i) => { block(x, ox + c * s, oy + r * s, s, p.col, P); if (i == p.prism) prismGlint(x, ox + c * s, oy + r * s, s, clock) });
}
let clock = 0;
function draw() {
	if (!G || !view) return;
	const x = view.begin(), P = RG.dark ? PAL.dark : PAL.light, at = wellAt();
	clock = performance.now() / 1000;
	/* the well */
	x.fillStyle = P.frame; rrect(x, at.x - 4, at.y - 4, W * CELL + 8, H * CELL + 8, 8); x.fill();
	x.fillStyle = P.well; x.fillRect(at.x, at.y, W * CELL, H * CELL);
	x.strokeStyle = P.wellLine; x.lineWidth = 1;
	for (let c = 1; c < W; c++) { x.beginPath(); x.moveTo(at.x + c * CELL + .5, at.y); x.lineTo(at.x + c * CELL + .5, at.y + H * CELL); x.stroke() }
	x.save(); x.beginPath(); x.rect(at.x, at.y, W * CELL, H * CELL); x.clip(); x.translate(at.x, at.y);
	const C = G.clear, p = G.piece, prismCol = p && p.prism >= 0 ? p.col : -1;
	for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
		const v = G.board[idx(c, r)]; if (!v) continue;
		const i = idx(c, r);
		if (C && C.cells.has(i)) {
			const k = C.t / .3;
			if (RG.reduceFlash) block(x, c * CELL, r * CELL, CELL, v - 1, P, 1 - k);
			else { const s = CELL * (1 - k * .7), o = (CELL - s) / 2; block(x, c * CELL + o, r * CELL + o, s, v - 1, P); x.globalAlpha = .7 * (1 - k); x.fillStyle = P.flash; x.fillRect(c * CELL, r * CELL, CELL, CELL); x.globalAlpha = 1 }
		} else {
			block(x, c * CELL, r * CELL, CELL, v - 1, P);
			/* the blocks a prism piece would burst, outlined */
			if (v - 1 == prismCol) { x.strokeStyle = P.text; x.globalAlpha = .75 + (RG.reduceFlash ? 0 : .25 * Math.sin(clock * 6)); x.lineWidth = 3; rrect(x, c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 4, 7); x.stroke(); x.globalAlpha = 1 }
		}
	}
	if (p && G.state == 'play') {
		/* where it will land: dashed outlines */
		const ly = landY(); x.setLineDash([4, 3]); x.strokeStyle = P.guide; x.lineWidth = 2;
		if (ly != p.y) p.cells.forEach(([c, r]) => { if (r + ly >= 0) { rrect(x, (c + p.x) * CELL + 3, (r + ly) * CELL + 3, CELL - 6, CELL - 6, 6); x.stroke() } });
		x.setLineDash([]);
		drawPiece(x, p, p.x * CELL, p.y * CELL, CELL, P, clock);
	}
	for (const f of fx) if (f.k == 'prism' && f.t < .8) {
		const k = f.t / .8; x.globalAlpha = (1 - k) * (RG.reduceFlash ? .3 : .8); x.strokeStyle = P.cols[f.col]; x.lineWidth = 4;
		x.beginPath(); x.arc(f.x, f.y, 10 + k * CELL * 5, 0, 7); x.stroke(); x.globalAlpha = 1;
	}
	if (G.state == 'over') { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, W * CELL, H * CELL) }
	x.restore();
	for (const f of fx) if (f.k == 'pts' && f.t < 1.2) {
		const k = f.t / 1.2; x.globalAlpha = 1 - k; x.fillStyle = P.text; x.textAlign = 'center'; x.textBaseline = 'middle';
		x.font = 'bold ' + (f.chain ? 22 : 18) + 'px system-ui,sans-serif';
		x.fillText((f.chain ? 'Chain ×' + (f.chain + 1) + '  ' : '') + '+' + f.v.toLocaleString(), at.x + W * CELL / 2, at.y + H * CELL * .4 - k * 30); x.globalAlpha = 1;
	}
	panel(x, P);
}
/* next pieces, score, level, rows (beside the well, or above it on a tall window) */
function panel(x, P) {
	const T = tall(), s = T ? 14 : 20;
	const box = T ? {x: PAD - 4, y: 4, w: W * CELL + 8, h: TOP - 8} : {x: PAD * 2 + W * CELL + 4, y: PAD - 4, w: SIDE, h: H * CELL + 8};
	x.fillStyle = P.panel; rrect(x, box.x, box.y, box.w, box.h, 8); x.fill();
	x.fillStyle = P.dim; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.font = '12px system-ui,sans-serif';
	const stat = (label, val, X, Y) => { x.fillStyle = P.dim; x.font = '12px system-ui,sans-serif'; x.fillText(label, X, Y); x.fillStyle = P.text; x.font = 'bold 18px system-ui,sans-serif'; x.fillText(val, X, Y + 20) };
	const tl = G.mode == 'daily' ? Math.max(0, Math.ceil(DAILY_TIME - G.t)) : null, tt = tl == null ? '' : Math.floor(tl / 60) + ':' + String(tl % 60).padStart(2, '0');
	if (T) {
		x.fillText('Next', box.x + 10, box.y + 16);
		G.queue.slice(0, 2).forEach((q, i) => drawPiece(x, q, box.x + 10 + i * 52, box.y + 22, s, P, clock));
		stat('Score', G.score.toLocaleString(), box.x + 118, box.y + 22);
		stat(tl == null ? 'Level' : 'Time', tl == null ? G.level : tt, box.x + 200, box.y + 22);
	} else {
		x.fillText('Next', box.x + 12, box.y + 22);
		G.queue.slice(0, 2).forEach((q, i) => drawPiece(x, q, box.x + 14 + (i ? 10 : 0), box.y + 32 + i * 72, i ? 16 : s, P, clock));
		let Y = box.y + 200;
		stat('Score', G.score.toLocaleString(), box.x + 12, Y); Y += 56;
		stat('Rows', G.rows, box.x + 12, Y); Y += 56;
		stat(G.mode == 'relaxed' ? 'Speed' : 'Level', G.mode == 'relaxed' ? 'Steady' : G.level, box.x + 12, Y); Y += 56;
		if (tl != null) stat('Time', tt, box.x + 12, Y), Y += 56;
		const b = G.mode == 'daily' ? save.daily[G.day] : save.best[G.mode];
		if (b) stat('Best', b.toLocaleString(), box.x + 12, Y);
	}
}

/* ---------- sound (short, made here; quiet) ---------- */
let AC = null;
function sfx(k) {
	try {
		AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state == 'suspended') AC.resume();
		const S = {turn: [[660, 700, .04, 'sine', .04]], lock: [[180, 120, .06, 'triangle', .08]], row: [[440, 660, .12, 'triangle', .07], [660, 880, .14, 'triangle', .05]],
			burst: [[300, 1200, .25, 'sawtooth', .04], [520, 1560, .3, 'triangle', .06]], over: [[330, 110, .6, 'triangle', .08]]}[k];
		if (!S) return;
		S.forEach(([f0, f1, d, type, v], i) => {
			const t = AC.currentTime + i * .06, o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination);
			o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
			g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d + .05); o.start(t); o.stop(t + d + .08);
		});
	} catch (e) {}
}

/* ---------- the page ---------- */
function ui() {
	if (!G) return;
	$('#score').textContent = G.score.toLocaleString();
	document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode == G.mode));
	$('[data-cmd=flash]').setAttribute('aria-pressed', !!RG.reduceFlash);
	const t = RG.lastInput == 'touch'; if (document.documentElement.classList.contains('touch') != t) { document.documentElement.classList.toggle('touch', t); if (view) view.refit() }
}
function say(t) { $('#sr').textContent = t }
function dialog(html, btns) {
	$('#ovBody').innerHTML = html; const B = $('#ovBtns'); B.innerHTML = '';
	btns.forEach(([t, f, main]) => { const b = document.createElement('button'); b.textContent = t; if (main) b.className = 'main'; b.onclick = () => { closeDialog(); f && f() }; B.appendChild(b) });
	$('#ov').hidden = false; (B.querySelector('.main') || B.firstChild).focus();
}
let pausedByDialog = false;
function closeDialog() { $('#ov').hidden = true; if (pausedByDialog) { pausedByDialog = false; RG.resume() } cv.focus() }
function showPause() {
	if (!$('#ov').hidden) return;
	pausedByDialog = true; vdown.clear(); drag.soft = false;
	dialog('<h2>Paused</h2><p>The well is hidden while the game is paused.</p>', [['Carry on', null, 1]]);
}
function help() {
	dialog('<h2>How to play</h2><p>Blocks fall into the well. Fill a row from side to side to clear it. The game ends when the well is full.</p>' +
		'<p><b>Prisms</b> ✦ fall now and then. Where a prism lands, every block of its colour bursts, the blocks above tumble straight down, and rows that fill clear too: a <b>chain</b>, worth more each step. While a prism falls, the blocks it would burst are outlined.</p>' +
		'<p><b>Keys:</b> ← → or A D to move, ↓ or S to move down, ↑ W or X to turn, Z or Q to turn the other way, Space to drop, P to pause, N for a new game.</p>' +
		'<p><b>Controller:</b> d-pad or stick to move, A and B to turn, d-pad up or Y to drop, Start to pause.</p>' +
		'<p><b>Touch or mouse:</b> drag sideways to move, tap to turn, drag down to move down, flick down to drop. The buttons under the well do the same.</p>' +
		'<p><b>Classic</b> gets faster every 10 rows; <b>Relaxed</b> keeps one speed; <b>Daily</b> is 3 minutes on the same blocks for everyone today.</p>', [['Play', null, 1]]);
}
function stats() {
	const row = (n, v) => '<tr><td>' + n + '</td><td>' + (v ? v.toLocaleString() : '–') + '</td></tr>';
	dialog('<h2>Best scores</h2><table>' + row('Classic', save.best.classic) + row('Relaxed', save.best.relaxed) + row('Daily, today', save.daily[RG.today()]) + '</table>' +
		'<p>' + save.played + ' games played. Daily: ' + streak() + ' in a row.</p>', [['Close', null, 1]]);
}
let saveT = 0;
function persist() { clearTimeout(saveT); saveT = setTimeout(() => RG.save(save).catch(() => {}), 150) }

/* ---------- touch and mouse: drag to move, tap to turn, flick down to drop ---------- */
const drag = {on: false, soft: false};
function pointers() {
	RG.pointer(cv, view, {
		down(p) { if (p.button) return; Object.assign(drag, {on: true, x0: p.x, y0: p.y, col: 0, soft: false, moved: false, trail: [[performance.now(), p.y]]}); ui() },
		move(p) {
			if (!drag.on || !G || G.state != 'play') return;
			const dx = p.x - drag.x0, dy = p.y - drag.y0, want = Math.trunc(dx / (CELL * .8));
			while (drag.col < want) { move(1, 0); drag.col++; drag.moved = true }
			while (drag.col > want) { move(-1, 0); drag.col--; drag.moved = true }
			drag.soft = dy > CELL * 1.2 && Math.abs(dy) > Math.abs(dx);
			drag.trail.push([performance.now(), p.y]); if (drag.trail.length > 12) drag.trail.shift();
		},
		up(p) {
			if (!drag.on) return; drag.on = false;
			const dy = p.y - drag.y0, dx = p.x - drag.x0, now = performance.now();
			/* a flick: well down, and still moving fast (over 12 cells a second) in its last tenth of a second */
			const back = drag.trail.find(q => now - q[0] <= 120) || drag.trail[drag.trail.length - 1];
			const v = (p.y - back[1]) / Math.max(16, now - back[0]) * 1000;
			if (!drag.moved && dy > CELL * 2.5 && Math.abs(dy) > Math.abs(dx) * 2 && v > CELL * 12) hardDrop();
			drag.soft = false;
		},
		tap() { if (!$('#ov').hidden) return; turn(1) },
		secondary(p) { if (!p.touch) turn(-1) },
		long() {}});
	/* the touch bar */
	document.querySelectorAll('#tbar [data-t]').forEach(b => {
		const a = b.dataset.t;
		const on = e => { e.preventDefault(); RG.lastInput = 'touch'; b.classList.add('on');
			if (a == 'cw') turn(1); else if (a == 'ccw') turn(-1); else if (a == 'drop') hardDrop();
			else { if (a == 'left') move(-1, 0); else if (a == 'right') move(1, 0); held[a] = -DAS; vdown.add(a) } };
		const off = () => { b.classList.remove('on'); vdown.delete(a) };
		b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, off));
		b.addEventListener('contextmenu', e => e.preventDefault());
	});
}

async function start() {
	await RG.init('block-drop');
	const s = await RG.load();
	if (s && s.v == 1) save = Object.assign(save, s, {best: Object.assign({}, s.best), daily: Object.assign({}, s.daily)});
	if (s && typeof s.reduceFlash == 'boolean') RG.reduceFlash = s.reduceFlash;
	view = RG.fit(cv, layout);
	RG.bind({left: ['ArrowLeft', 'KeyA', 'pad:14', 'pad:axis0-'], right: ['ArrowRight', 'KeyD', 'pad:15', 'pad:axis0+'], soft: ['ArrowDown', 'KeyS', 'pad:13', 'pad:axis1+'],
		cw: ['ArrowUp', 'KeyW', 'KeyX', 'pad:0'], ccw: ['KeyZ', 'KeyQ', 'pad:1'], drop: ['Space', 'pad:12', 'pad:3'], ok: ['Enter', 'pad:0'], new: ['KeyN'], pause: ['KeyP', 'Escape', 'pad:9']});
	pointers();
	RG.onPause(() => { if (G && G.state == 'play' && $('#menu').hidden) showPause() });
	RG.on('settings', () => { ui(); draw() });
	document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { if (b.dataset.mode != 'daily') save.lastMode = b.dataset.mode; newGame(b.dataset.mode); cv.focus() });
	const menu = $('#menu'), mbtn = $('#menuBtn');
	/* the menu holds the game while it is open (without the Paused card over it) */
	let menuPaused = false;
	const menuShow = on => {
		menu.hidden = !on; mbtn.setAttribute('aria-expanded', on);
		if (on) { menu.querySelector('button').focus(); if (G && G.state == 'play' && !RG.paused) { menuPaused = true; RG.pause() } }
		else if (menuPaused) { menuPaused = false; if ($('#ov').hidden) RG.resume() }
	};
	/* a card from the menu holds the game until it is closed */
	const modal = f => { f(); if (G && G.state == 'play' && !RG.paused) { pausedByDialog = true; RG.pause() } };
	mbtn.onclick = e => { e.stopPropagation(); menuShow(menu.hidden) };
	document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target != mbtn) menuShow(false) });
	menu.onclick = async e => {
		const b = e.target.closest('[data-cmd]'); if (!b) return; menuShow(false);
		const k = b.dataset.cmd;
		if (k == 'new') newGame(G.mode); else if (k == 'pause') RG.pause(); else if (k == 'stats') modal(stats); else if (k == 'help') modal(help);
		else if (k == 'flash') { RG.reduceFlash = !RG.reduceFlash; save.reduceFlash = RG.reduceFlash; persist(); ui() }
		else if (k == 'export') RG.exportSave();
		else if (k == 'import') { try { const d = await RG.importSave(); if (d && d.v == 1) { save = Object.assign({v: 1, best: {}, daily: {}, played: 0}, d); ui(); dialog('<h2>Save imported</h2><p>Your best scores are back.</p>', [['OK', null, 1]]) } } catch (err) { dialog('<h2>Not imported</h2><p>' + String(err.message).replace(/</g, '&lt;') + '</p>', [['OK', null, 1]]) } }
	};
	addEventListener('keydown', e => { if (e.code == 'Escape' && !menu.hidden) { menuShow(false); e.stopPropagation() } }, true);
	newGame(save.mode || 'classic');
	if (!save.seenHelp) { save.seenHelp = 1; persist(); help(); pausedByDialog = true; RG.pause() }
	RG.loop(dt => {
		if (!$('#ov').hidden) {   /* a dialog: its buttons take Enter and A */
			if (RG.pressed('ok') && document.activeElement && document.activeElement.tagName == 'BUTTON' && RG.lastInput == 'pad') document.activeElement.click();
			if (RG.pressed('pause') && pausedByDialog) closeDialog();
			return;
		}
		if (RG.pressed('pause') && G.state == 'play') { RG.pause(); return }
		if (RG.pressed('new')) { newGame(G.mode); return }
		if (RG.paused) return;
		update(dt);
		if (Math.floor(G.score) != +$('#score').dataset.v) { $('#score').dataset.v = G.score; ui() }
	}, draw, {whilePaused: true});
	RG.on('resize', () => draw());
	/* for the browser tests */
	window.__bd = {get: () => G, save: () => save, newGame, view: () => view, update, hardDrop, move, turn, deal,
		/* rows: strings from the bottom up, '.' empty, 0-4 a colour */
		setBoard(rows) { G.board.fill(0); rows.forEach((s, k) => [...s].forEach((ch, c) => { if (ch != '.') G.board[idx(c, H - 1 - k)] = +ch + 1 })) },
		setPiece(s, col, prism, x) { const S = SHAPES[s]; spawn({s, n: S.n, cells: S.c.map(p => p.slice()), col, prism: prism == null ? -1 : prism}); if (x != null) G.piece.x = x },
		wellCenter() { const b = cv.getBoundingClientRect(), a = wellAt(); return {x: b.left + view.ox + (a.x + W * CELL / 2) * view.scale, y: b.top + view.oy + (a.y + H * CELL / 2) * view.scale, cell: CELL * view.scale} }};
}
start();
})();
