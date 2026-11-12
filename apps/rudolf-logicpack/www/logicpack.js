/* ===== Logic Pack: Sudoku, Picture Grid (nonograms) and Cages for Rudolf OS (docs/plan-games.md in RudolfOS).
   Puzzles are made here without end (logic.js), each with one answer; Easy, Medium, Hard and a Daily puzzle per kind
   (the same for everyone on a day). Notes, undo, hints that explain the step (or point out a wrong entry), a timer,
   best times kept with the account, and each kind's puzzle in progress kept to come back to.
   Keys: arrows to move, 1-9 to write, 0 or Backspace to erase, N notes, H hint, U or Ctrl+Z undo, P pause;
   Picture Grid: Space fills, X crosses. Controller: d-pad, A next number (or fill), B erase (or cross), X notes,
   Y hint, LB undo, Start pause. Mouse and touch: pick a cell and use the pad; in Picture Grid click or drag to fill,
   right-click (or hold, or the Cross button) to cross.
   Original work. GPL-2.0-or-later. ===== */
(function () {
'use strict';
const KINDS = {sudoku: 'Sudoku', nonogram: 'Picture Grid', cages: 'Cages'};
const DIFFS = {easy: 'Easy', medium: 'Medium', hard: 'Hard', daily: 'Daily'};
const $ = s => document.querySelector(s);
const cv = $('#cv');
let save = {v: 1, kind: 'sudoku', diff: {}, best: {}, daily: {}, cur: {}, solved: 0};
let G = null, view = null, notesMode = false, crossMode = false, fx = [];

/* ---------- a game ---------- */
function newGame(kind, diff, opt) {
	kind = KINDS[kind] ? kind : 'sudoku'; diff = DIFFS[diff] ? diff : 'easy';
	const day = RG.today(), real = diff == 'daily' ? 'medium' : diff;
	const seed = diff == 'daily' ? 'logic-pack:' + kind + ':' + day : (opt && opt.seed) || String(Math.random());
	const P = LP.make(kind, real, RG.rng(seed));
	start({kind, diff, day: diff == 'daily' ? day : null, P, t: 0, hints: 0, done: false});
	say(KINDS[kind] + ', ' + DIFFS[diff] + '.');
}
function start(g) {
	const P = g.P, N = P.n * P.n;
	G = Object.assign({sel: P.kind == 'nonogram' ? 0 : -1, undo: []}, g);
	if (P.kind == 'nonogram') { G.cells = Int8Array.from(g.cells || new Array(N).fill(0)); P.given.forEach(i => G.cells[i] = P.sol[i] ? 1 : 2) }
	else { G.val = Int8Array.from(g.val || (P.kind == 'sudoku' ? P.given : new Array(N).fill(0))); G.notes = Int16Array.from(g.notes || new Array(N).fill(0)) }
	if (G.sel < 0) G.sel = P.kind == 'sudoku' ? Math.max(0, G.val.indexOf(0)) : 0;
	save.kind = G.kind; save.diff[G.kind] = G.diff;
	fx = []; keep(); pad(); if (view) view.refit(); ui();
}
const isGiven = i => G.P.kind == 'sudoku' ? !!G.P.given[i] : G.P.kind == 'nonogram' ? G.P.given.includes(i) : false;
/* every change goes through here, so it can be undone: [[array, index, old value], ...] */
function change(list) {
	const done = [];
	for (const [a, i, v] of list) { const A = G[a]; if (A[i] != v) { done.push([a, i, A[i]]); A[i] = v } }
	if (done.length) { G.undo.push(done); if (G.undo.length > 500) G.undo.shift(); after() }
	return done.length > 0;
}
function undo() { if (!G || G.done) return; const d = G.undo.pop(); if (!d) return; for (let k = d.length - 1; k >= 0; k--) { const [a, i, v] = d[k]; G[a][i] = v } after(); sfx('undo') }
function after() { keep(); pad(); ui(); if (solved()) win() }
function solved() {
	const P = G.P;
	if (P.kind == 'nonogram') return P.sol.every((s, i) => (G.cells[i] == 1) == !!s);
	return G.val.every((v, i) => v == P.sol[i]);
}
/* writing a number: notes in its row, column (and box) lose it */
function write(i, v) {
	if (!G || G.done || G.P.kind == 'nonogram' || isGiven(i)) return;
	if (notesMode && v) { if (!G.val[i]) change([['notes', i, G.notes[i] ^ (1 << v)]]); return }
	const ch = [['val', i, G.val[i] == v ? 0 : v]];
	if (v && G.val[i] != v) { ch.push(['notes', i, 0]); peers(i).forEach(j => { if (G.notes[j] & (1 << v)) ch.push(['notes', j, G.notes[j] & ~(1 << v)]) }) }
	if (change(ch)) sfx(v ? 'write' : 'erase');
}
function erase(i) { if (!G || G.done || G.P.kind == 'nonogram' || isGiven(i)) return; if (change([['val', i, 0], ['notes', i, 0]])) sfx('erase') }
function peers(i) {
	const n = G.P.n, r = Math.floor(i / n), c = i % n;
	if (G.P.kind == 'sudoku') return LP.PEERS[i];
	const o = []; for (let k = 0; k < n; k++) { if (k != c) o.push(r * n + k); if (k != r) o.push(k * n + c) } return o;
}
/* numbers in the same row, column (or box) */
function conflicts() {
	const bad = new Set(), n = G.P.n;
	for (let i = 0; i < n * n; i++) if (G.val[i]) for (const j of peers(i)) if (G.val[j] == G.val[i]) { bad.add(i); bad.add(j) }
	return bad;
}
/* cages whose cells are all written and do not make their target */
function badCages() { if (G.P.kind != 'cages') return new Set(); const s = new Set(); G.P.cages.forEach((cg, k) => { const v = cg.cells.map(i => G.val[i]); if (v.every(x => x) && !LP.cageOk(cg, v, true)) s.add(k) }); return s }
function win() {
	G.done = true;
	const t = Math.round(G.t), key = G.kind + '-' + (G.diff == 'daily' ? 'medium' : G.diff);
	let best = false;
	if (G.diff == 'daily') { const dk = G.kind + ':' + G.day; if (!save.daily[dk] || t < save.daily[dk].t) save.daily[dk] = {t, hints: G.hints}; trimDaily() }
	else if (!G.hints && (!save.best[key] || t < save.best[key])) { save.best[key] = t; best = true }
	save.solved++; delete save.cur[G.kind]; persist(); sfx('win'); fx.push({k: 'win', t: 0}); ui();
	say('Solved in ' + fmt(t) + '.');
	setTimeout(() => G && G.done && dialog('<h2>Solved</h2><p>' + KINDS[G.kind] + ', ' + DIFFS[G.diff] + ', in <b>' + fmt(t) + '</b>' + (best ? ', your best time' : '') + (G.hints ? ' with ' + G.hints + (G.hints == 1 ? ' hint' : ' hints') : '') + '.</p>' + (G.diff == 'daily' ? '<p>' + streakText() + '</p>' : ''),
		[['Next puzzle', () => newGame(G.kind, G.diff == 'daily' ? 'medium' : G.diff), 1], ['Close', null]]), 700);
}
function trimDaily() { const k = Object.keys(save.daily).sort((a, b) => a.split(':')[1] < b.split(':')[1] ? -1 : 1); while (k.length > 300) delete save.daily[k.shift()] }
function streak() { let n = 0, d = new Date(); for (;;) { const day = RG.today(d); if (!Object.keys(KINDS).some(k => save.daily[k + ':' + day])) break; n++; d.setDate(d.getDate() - 1) } return n }
function streakText() { const n = streak(); return n > 1 ? 'Daily puzzles: ' + n + ' days in a row.' : 'Come back tomorrow for new Daily puzzles.' }
const fmt = t => { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = String(t % 60).padStart(2, '0'); return h ? h + ':' + String(m).padStart(2, '0') + ':' + s : m + ':' + s };

/* ---------- Picture Grid: fill and cross ---------- */
/* state: 0 empty, 1 filled, 2 crossed */
/* a cell already marked the other way is cleared first (so a slip never fills a crossed cell) */
function ngTarget(i, mode) { const s = G.cells[i]; return s ? 0 : mode == 'cross' ? 2 : 1 }
let stroke = null;   /* {from state, to state, start cell, axis, list} */
function strokeStart(i, mode) {
	if (G.done || isGiven(i)) { stroke = null; return }
	stroke = {from: G.cells[i], to: ngTarget(i, mode), i0: i, axis: null, ch: []};
	strokeAt(i);
}
function strokeAt(i) {
	if (!stroke) return;
	const n = G.P.n, r0 = Math.floor(stroke.i0 / n), c0 = stroke.i0 % n, r = Math.floor(i / n), c = i % n;
	if (i != stroke.i0 && !stroke.axis) stroke.axis = r == r0 ? 'row' : c == c0 ? 'col' : Math.abs(c - c0) >= Math.abs(r - r0) ? 'row' : 'col';
	const line = stroke.axis == 'row' ? [...Array(Math.abs(c - c0) + 1)].map((_, k) => r0 * n + Math.min(c, c0) + k) : stroke.axis == 'col' ? [...Array(Math.abs(r - r0) + 1)].map((_, k) => (Math.min(r, r0) + k) * n + c0) : [i];
	for (const j of line) if (!isGiven(j) && G.cells[j] == stroke.from && !stroke.ch.some(x => x[1] == j)) { stroke.ch.push(['cells', j, G.cells[j]]); G.cells[j] = stroke.to }
	G.sel = i;
}
function strokeEnd() {
	if (!stroke) return; const s = stroke; stroke = null;
	if (s.ch.length) { G.undo.push(s.ch); sfx(s.to == 1 ? 'fill' : s.to == 2 ? 'cross' : 'erase'); after() }
}
/* the clues of a line, and whether the line already matches them */
function ngLine(k, row) { const n = G.P.n, l = []; for (let j = 0; j < n; j++) l.push(G.cells[row ? k * n + j : j * n + k] == 1 ? 1 : 0); const want = (row ? G.P.rows : G.P.cols)[k]; return LP.clueOf(l).join() == want.join() }

/* ---------- hints ---------- */
function hint() {
	if (!G || G.done) return;
	const P = G.P, n = P.n;
	let h = null;
	if (P.kind == 'nonogram') {
		const wrong = P.sol.findIndex((s, i) => G.cells[i] && (G.cells[i] == 1) != !!s);
		if (wrong >= 0) h = {i: wrong, fix: () => change([['cells', wrong, 0]]), text: 'This cell is wrong: it was cleared.'};
		else {
			/* what line logic decides from what is right so far */
			const g = new Int8Array(n * n); G.cells.forEach((s, i) => g[i] = s == 1 ? 1 : s == 2 ? 0 : -1);
			outer: for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
				const row = pass == 0, line = [...Array(n)].map((_, j) => g[row ? k * n + j : j * n + k]), s = LP.lineSolve((row ? P.rows : P.cols)[k], line);
				if (!s) continue;
				for (let j = 0; j < n; j++) if (line[j] == -1 && s[j] != -1) { const i = row ? k * n + j : j * n + k, to = s[j] ? 1 : 2; h = {i, fix: () => change([['cells', i, to]]), text: (row ? 'Row ' : 'Column ') + (k + 1) + '’s clue (' + ((row ? P.rows : P.cols)[k].join(' ') || '0') + ') decides this cell: ' + (to == 1 ? 'filled.' : 'empty.')}; break outer }
			}
			if (!h) { const i = P.sol.findIndex((s, j) => s && G.cells[j] != 1); if (i >= 0) h = {i, fix: () => change([['cells', i, 1]]), text: 'This cell is filled.'} }
		}
	} else {
		const wrong = G.val.findIndex((v, i) => v && v != P.sol[i]);
		if (wrong >= 0) h = {i: wrong, fix: () => change([['val', wrong, 0]]), text: 'This number is wrong: it was erased.'};
		else if (P.kind == 'sudoku') {
			const s = LP.sdkStep(G.val, true);
			if (s) h = {i: s.i, v: s.v, text: s.why == 'naked' ? 'Only ' + s.v + ' fits here: its row, column and box have every other number.' : 'In its ' + s.unit + ', ' + s.v + ' can only go here.'};
		} else {
			for (let i = 0; i < n * n && !h; i++) if (!G.val[i]) { const c = LP.cgCands(P, G.val, i); if (c.length == 1) h = {i, v: c[0], text: 'Only ' + c[0] + ' fits here: its row, column and cage leave nothing else.'} }
		}
		if (!h) { let i = G.sel >= 0 && !G.val[G.sel] ? G.sel : G.val.findIndex(v => !v); if (i >= 0) h = {i, v: P.sol[i], text: 'This one is ' + P.sol[i] + '.'} }
		if (h && h.v) { const {i, v} = h; h.fix = () => { const m = notesMode; notesMode = false; write(i, v); notesMode = m } }
	}
	if (!h) return;
	G.hints++; G.sel = h.i; h.fix(); fx.push({k: 'hint', i: h.i, t: 0}); keep(); ui();
	say(h.text); toast(h.text); sfx('hint');
}
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 5000) }

/* ---------- drawing ---------- */
const PAL = {
	light: {bg: '#fbfcf8', line: '#c9cfbf', thick: '#3a4339', given: '#24282b', mine: '#2f6b8f', sel: '#cfe3d2', peer: '#eef2e8', same: '#dfeadf', bad: '#f3c9c0', badMark: '#b0361f', note: '#5b6670', fill: '#2c3530', cross: '#8a948a', done: '#a5ad9f', clue: '#24282b', hint: '#f5d36b', cage: '#2a332b'},
	dark: {bg: '#1d221e', line: '#384037', thick: '#b8c4b5', given: '#e4e9e1', mine: '#8cc8ec', sel: '#2f4a37', peer: '#232a24', same: '#2b392e', bad: '#5a2a24', badMark: '#ff8a70', note: '#9ba7ae', fill: '#d5ddd2', cross: '#6d786c', done: '#5b6559', clue: '#e4e9e1', hint: '#8a6d12', cage: '#cbd6c8'}};
const B = 4;   /* margin */
function geo() {
	const P = G && G.P;
	if (!P) return {w: 100, h: 100};
	if (P.kind == 'nonogram') {
		const n = P.n, cs = n <= 5 ? 48 : n <= 10 ? 32 : 26, cu = cs * .58;
		const mr = Math.max(1, ...P.rows.map(r => r.length)), mc = Math.max(1, ...P.cols.map(c => c.length));
		const lx = B + mr * cu + 6, ly = B + mc * cu + 6;
		return {cs, cu, lx, ly, w: lx + n * cs + B, h: ly + n * cs + B};
	}
	const cs = 360 / P.n; return {cs, lx: B, ly: B, w: 360 + 2 * B, h: 360 + 2 * B};
}
function layout() { const g = geo(); return {w: g.w, h: g.h} }
function draw() {
	if (!G || !view) return;
	const x = view.begin(), P = RG.dark ? PAL.dark : PAL.light, g = geo(), n = G.P.n, cs = g.cs;
	x.textAlign = 'center'; x.textBaseline = 'middle';
	x.fillStyle = P.bg; x.fillRect(g.lx, g.ly, n * cs, n * cs);
	const hl = fx.find(f => f.k == 'hint' && f.t < 1.6);
	if (G.P.kind == 'nonogram') drawNg(x, P, g); else drawNum(x, P, g);
	if (hl) { const r = Math.floor(hl.i / n), c = hl.i % n, a = RG.reduceFlash ? .8 : .5 + .5 * Math.cos(hl.t * 8); x.strokeStyle = P.hint; x.globalAlpha = a * (1 - hl.t / 1.6); x.lineWidth = 5; x.strokeRect(g.lx + c * cs + 2.5, g.ly + r * cs + 2.5, cs - 5, cs - 5); x.globalAlpha = 1 }
	const w = fx.find(f => f.k == 'win' && f.t < 1.4);
	if (w) { x.globalAlpha = (1 - w.t / 1.4) * (RG.reduceFlash ? .25 : .5); x.fillStyle = P.hint; const k = w.t / 1.4; for (let d = 0; d < n * 2; d++) for (let r = 0; r < n; r++) { const c = d - r; if (c >= 0 && c < n && Math.abs(d / (2 * n) - k) < .12) x.fillRect(g.lx + c * cs, g.ly + r * cs, cs, cs) } x.globalAlpha = 1 }
}
function drawNum(x, P, g) {
	const n = G.P.n, cs = g.cs, sel = G.sel, bad = conflicts(), sv = G.val[sel], bc = badCages();
	const sr = Math.floor(sel / n), sc = sel % n, sb = G.P.kind == 'sudoku' ? LP.BOX(sel) : -1;
	for (let i = 0; i < n * n; i++) {
		const r = Math.floor(i / n), c = i % n, X = g.lx + c * cs, Y = g.ly + r * cs, v = G.val[i];
		let bg = null;
		if (i == sel) bg = P.sel; else if (bad.has(i)) bg = P.bad; else if (sv && v == sv) bg = P.same; else if (r == sr || c == sc || (sb >= 0 && LP.BOX(i) == sb)) bg = P.peer;
		if (bad.has(i) && i == sel) bg = P.bad;
		if (bg) { x.fillStyle = bg; x.fillRect(X, Y, cs, cs) }
		if (v) {
			x.fillStyle = isGiven(i) ? P.given : P.mine; x.font = (isGiven(i) ? '700 ' : '500 ') + Math.round(cs * .56) + 'px system-ui,sans-serif';
			x.fillText(v, X + cs / 2, Y + cs / 2 + (G.P.kind == 'cages' ? cs * .08 : 1));
			if (bad.has(i)) { x.fillStyle = P.badMark; x.fillRect(X + cs * .28, Y + cs * .84, cs * .44, 3) }   /* not by colour alone: a bar under it */
		} else if (G.notes[i]) {
			const k = G.P.kind == 'sudoku' ? 3 : Math.ceil(Math.sqrt(n)), q = cs / k * (G.P.kind == 'cages' ? .8 : 1), oy = G.P.kind == 'cages' ? cs * .2 : 0;
			x.fillStyle = P.note; x.font = Math.round(q * .62) + 'px system-ui,sans-serif';
			for (let d = 1; d <= n; d++) if (G.notes[i] & (1 << d)) x.fillText(d, X + ((d - 1) % k + .5) * (cs / k), Y + oy + (Math.floor((d - 1) / k) + .5) * q);
		}
	}
	x.strokeStyle = P.line; x.lineWidth = 1;
	for (let k = 1; k < n; k++) { x.beginPath(); x.moveTo(g.lx + k * cs, g.ly); x.lineTo(g.lx + k * cs, g.ly + n * cs); x.moveTo(g.lx, g.ly + k * cs); x.lineTo(g.lx + n * cs, g.ly + k * cs); x.stroke() }
	x.strokeStyle = P.thick; x.lineWidth = 2.5; x.lineCap = 'square';
	if (G.P.kind == 'sudoku') for (let k = 0; k <= 9; k += 3) { x.beginPath(); x.moveTo(g.lx + k * cs, g.ly); x.lineTo(g.lx + k * cs, g.ly + 9 * cs); x.moveTo(g.lx, g.ly + k * cs); x.lineTo(g.lx + 9 * cs, g.ly + k * cs); x.stroke() }
	else {
		const of = new Int16Array(n * n); G.P.cages.forEach((cg, k) => cg.cells.forEach(i => of[i] = k));
		x.strokeStyle = P.cage; x.lineWidth = 3; x.beginPath();
		for (let i = 0; i < n * n; i++) { const r = Math.floor(i / n), c = i % n, X = g.lx + c * cs, Y = g.ly + r * cs;
			if (c < n - 1 && of[i] != of[i + 1]) { x.moveTo(X + cs, Y); x.lineTo(X + cs, Y + cs) }
			if (r < n - 1 && of[i] != of[i + n]) { x.moveTo(X, Y + cs); x.lineTo(X + cs, Y + cs) } }
		x.stroke(); x.strokeRect(g.lx, g.ly, n * cs, n * cs);
		x.textAlign = 'left'; x.textBaseline = 'top'; x.font = '600 ' + Math.round(cs * .2) + 'px system-ui,sans-serif';
		G.P.cages.forEach((cg, k) => { const i = cg.cells[0], X = g.lx + (i % n) * cs, Y = g.ly + Math.floor(i / n) * cs, lab = cg.t + (cg.op == '=' ? '' : cg.op);
			x.fillStyle = bc.has(k) ? P.badMark : P.cage; x.fillText(lab, X + 5, Y + 4);
			if (bc.has(k)) { const w = x.measureText(lab).width; x.fillRect(X + 5, Y + 4 + cs * .22, w, 2) } });
		x.textAlign = 'center'; x.textBaseline = 'middle';
	}
	if (G.P.kind == 'sudoku') { x.lineWidth = 2.5; x.strokeRect(g.lx, g.ly, 9 * cs, 9 * cs) }
	if (!G.done && cur.show) { const X = g.lx + sc * cs, Y = g.ly + sr * cs; x.strokeStyle = P.mine; x.lineWidth = 3; x.strokeRect(X + 2, Y + 2, cs - 4, cs - 4) }
}
function drawNg(x, P, g) {
	const n = G.P.n, cs = g.cs, cu = g.cu, sr = Math.floor(G.sel / n), sc = G.sel % n;
	/* the selected row and column, lightly */
	x.fillStyle = P.peer; x.fillRect(g.lx, g.ly + sr * cs, n * cs, cs); x.fillRect(g.lx + sc * cs, g.ly, cs, n * cs);
	x.fillStyle = P.peer; x.fillRect(B, g.ly + sr * cs, g.lx - B - 2, cs); x.fillRect(g.lx + sc * cs, B, cs, g.ly - B - 2);
	for (let i = 0; i < n * n; i++) {
		const r = Math.floor(i / n), c = i % n, X = g.lx + c * cs, Y = g.ly + r * cs, s = G.cells[i];
		if (s == 1) { x.fillStyle = G.done ? P.fill : P.fill; x.fillRect(X + 1.5, Y + 1.5, cs - 3, cs - 3); if (isGiven(i)) { x.fillStyle = P.bg; x.beginPath(); x.arc(X + cs / 2, Y + cs / 2, cs * .1, 0, 7); x.fill() } }
		else if (s == 2 && !G.done) { x.strokeStyle = isGiven(i) ? P.given : P.cross; x.lineWidth = isGiven(i) ? 2.5 : 1.6; const m = cs * .3; x.beginPath(); x.moveTo(X + m, Y + m); x.lineTo(X + cs - m, Y + cs - m); x.moveTo(X + cs - m, Y + m); x.lineTo(X + m, Y + cs - m); x.stroke() }
	}
	x.strokeStyle = P.line; x.lineWidth = 1;
	for (let k = 0; k <= n; k++) { const th = k % 5 == 0; x.strokeStyle = th ? P.thick : P.line; x.lineWidth = th ? 2 : 1; x.beginPath(); x.moveTo(g.lx + k * cs, g.ly); x.lineTo(g.lx + k * cs, g.ly + n * cs); x.moveTo(g.lx, g.ly + k * cs); x.lineTo(g.lx + n * cs, g.ly + k * cs); x.stroke() }
	/* clues: dimmed (and struck through) when their line matches */
	x.font = '600 ' + Math.round(cu * .78) + 'px system-ui,sans-serif';
	for (let k = 0; k < n; k++) {
		const rd = ngLine(k, true), cd = ngLine(k, false), rc = G.P.rows[k].length ? G.P.rows[k] : [0], cc = G.P.cols[k].length ? G.P.cols[k] : [0];
		x.fillStyle = rd ? P.done : P.clue;
		rc.forEach((v, j) => x.fillText(v, g.lx - 6 - (rc.length - j - .5) * cu, g.ly + (k + .5) * cs));
		if (rd) { x.fillRect(g.lx - 6 - rc.length * cu, g.ly + (k + .5) * cs, rc.length * cu, 1.5) }
		x.fillStyle = cd ? P.done : P.clue;
		cc.forEach((v, j) => x.fillText(v, g.lx + (k + .5) * cs, g.ly - 6 - (cc.length - j - .5) * cu));
		if (cd) { x.fillRect(g.lx + (k + .5) * cs - .75, g.ly - 6 - cc.length * cu, 1.5, cc.length * cu) }
	}
	if (!G.done && cur.show) { x.strokeStyle = P.mine; x.lineWidth = 3; x.strokeRect(g.lx + sc * cs + 2, g.ly + sr * cs + 2, cs - 4, cs - 4) }
}

/* ---------- sound (short, made here; quiet) ---------- */
let AC = null;
function sfx(k) {
	try {
		AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state == 'suspended') AC.resume();
		const S = {write: [[520, 560, .05, 'sine', .05]], erase: [[380, 300, .05, 'sine', .04]], fill: [[300, 240, .04, 'triangle', .06]], cross: [[700, 600, .03, 'sine', .03]], undo: [[420, 360, .05, 'sine', .04]],
			hint: [[660, 880, .12, 'triangle', .05]], win: [[523, 784, .2, 'triangle', .07], [659, 1046, .3, 'triangle', .06]]}[k];
		if (!S) return;
		S.forEach(([f0, f1, d, type, v], i) => { const t = AC.currentTime + i * .1, o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d + .05); o.start(t); o.stop(t + d + .08) });
	} catch (e) {}
}

/* ---------- the page ---------- */
function pad() {
	const el = $('#pad'); if (!G) return;
	const kind = G.P.kind, sig = kind + G.P.n;
	if (el.dataset.sig != sig) {
		el.dataset.sig = sig; el.innerHTML = '';
		const btn = (html, cls, f, attrs) => { const b = document.createElement('button'); b.innerHTML = html; b.className = cls; Object.assign(b, attrs || {}); b.addEventListener('pointerdown', e => { if (e.pointerType == 'touch') RG.lastInput = 'touch' }); b.onclick = () => { f(); cv.focus({preventScroll: true}) }; el.appendChild(b); return b };
		if (kind == 'nonogram') {
			btn('■ Fill', 'tool wide', () => { crossMode = false; pad() }, {id: 'pFill'}).setAttribute('aria-pressed', 'true');
			btn('✕ Cross', 'tool wide', () => { crossMode = true; pad() }, {id: 'pCross'});
		} else for (let v = 1; v <= G.P.n; v++) btn(v + '<small></small>', 'num', () => write(G.sel, v), {title: 'Write ' + v}).dataset.v = v;
		if (kind != 'nonogram') { btn('⌫ Erase', 'tool', () => erase(G.sel), {id: 'pErase'}); btn('✎ Notes', 'tool', () => { notesMode = !notesMode; pad() }, {id: 'pNotes', title: 'Notes (N)'}) }
		btn('↶ Undo', 'tool', undo, {id: 'pUndo', title: 'Undo (U)'}); btn('💡 Hint', 'tool', hint, {id: 'pHint', title: 'Hint (H)'});
	}
	if (kind == 'nonogram') { $('#pFill').setAttribute('aria-pressed', !crossMode); $('#pCross').setAttribute('aria-pressed', crossMode) }
	else {
		$('#pNotes').setAttribute('aria-pressed', notesMode);
		el.querySelectorAll('.num').forEach(b => { const v = +b.dataset.v; let k = 0; G.val.forEach(x => k += x == v); const left = G.P.n - k; b.querySelector('small').textContent = left > 0 ? left : ''; b.disabled = G.done || (kind == 'sudoku' && left <= 0 && !notesMode) });
	}
	$('#pUndo').disabled = G.done || !G.undo.length; $('#pHint').disabled = G.done;
}
function ui() {
	if (!G) return;
	$('#time').textContent = fmt(G.t);
	document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', b.dataset.kind == G.kind));
	document.querySelectorAll('[data-diff]').forEach(b => b.setAttribute('aria-pressed', b.dataset.diff == G.diff));
	$('[data-cmd=flash]').setAttribute('aria-pressed', !!RG.reduceFlash);
}
function say(t) { $('#sr').textContent = t }
function dialog(html, btns) {
	$('#ovBody').innerHTML = html; const Bt = $('#ovBtns'); Bt.innerHTML = '';
	btns.forEach(([t, f, main]) => { const b = document.createElement('button'); b.textContent = t; if (main) b.className = 'main'; b.onclick = () => { closeDialog(); f && f() }; Bt.appendChild(b) });
	$('#ov').hidden = false; (Bt.querySelector('.main') || Bt.firstChild).focus();
}
let pausedByDialog = false;
function closeDialog() { $('#ov').hidden = true; if (pausedByDialog) { pausedByDialog = false; RG.resume() } cv.focus({preventScroll: true}) }
function showPause() { if (!$('#ov').hidden) return; pausedByDialog = true; keep(true); dialog('<h2>Paused</h2><p>The puzzle is hidden while the game is paused.</p>', [['Carry on', null, 1]]) }
function help() {
	dialog('<h2>How to play</h2>' +
		'<p><b>Sudoku:</b> fill the grid so every row, column and 3×3 box has 1 to 9 once each.</p>' +
		'<p><b>Picture Grid:</b> the numbers beside a row (and above a column) are the runs of filled cells in it, in order, with at least one empty cell between runs. Fill them in to find the picture; cross the cells you know are empty. A clue greys out when its line matches it.</p>' +
		'<p><b>Cages:</b> each number once per row and column (1 to the grid’s size). The cells of a cage make its target with its operation: 7+ adds up to 7, 2÷ divides to 2, 3− differs by 3, 12× multiplies to 12.</p>' +
		'<p><b>Keys:</b> arrows to move, 1–9 to write, 0 or Backspace to erase, N for notes, H for a hint, U or Ctrl+Z to undo, P to pause. Picture Grid: Space fills, X crosses.</p>' +
		'<p><b>Mouse and touch:</b> pick a cell, then a number on the pad. Picture Grid: click or drag to fill; right-click, hold, or switch to ✕ to cross.</p>' +
		'<p><b>Controller:</b> d-pad to move, A next number (or fill), B erase (or cross), X notes, Y hint, LB undo, Start pause.</p>' +
		'<p>A hint fixes a wrong entry first, or does the next step and says why. Best times count puzzles solved without hints.</p>', [['Play', null, 1]]);
}
function stats() {
	const row = k => '<tr><td>' + KINDS[k] + '</td>' + ['easy', 'medium', 'hard'].map(d => '<td>' + (save.best[k + '-' + d] ? fmt(save.best[k + '-' + d]) : '–') + '</td>').join('') + '<td>' + (save.daily[k + ':' + RG.today()] ? fmt(save.daily[k + ':' + RG.today()].t) : '–') + '</td></tr>';
	dialog('<h2>Best times</h2><table><tr><td></td><td>Easy</td><td>Medium</td><td>Hard</td><td>Today</td></tr>' + Object.keys(KINDS).map(row).join('') + '</table><p>' + save.solved + ' puzzles solved. ' + streakText() + '</p>', [['Close', null, 1]]);
}
/* the puzzle in progress is kept (per kind), so it is there next time */
let saveT = 0;
function keep(now) {
	if (G && !G.done) save.cur[G.kind] = {kind: G.kind, diff: G.diff, day: G.day, P: G.P, t: Math.round(G.t), hints: G.hints, val: G.val && Array.from(G.val), notes: G.notes && Array.from(G.notes), cells: G.cells && Array.from(G.cells)};
	persist(now);
}
function persist(now) { clearTimeout(saveT); saveT = setTimeout(() => RG.save(save).catch(() => {}), now ? 0 : 400) }
function resume(kind) {
	const c = save.cur[kind];
	if (c && c.P && (c.diff != 'daily' || c.day == RG.today())) { start(c); say(KINDS[kind] + ': carrying on.'); return true }
	return false;
}
function openKind(kind) { if (G && kind == G.kind) return; if (!resume(kind)) newGame(kind, (save.diff[kind] == 'daily' ? 'medium' : save.diff[kind]) || 'easy') }

/* ---------- input ---------- */
const cur = {show: false};
function cellAt(p) { const g = geo(), n = G.P.n, c = Math.floor((p.x - g.lx) / g.cs), r = Math.floor((p.y - g.ly) / g.cs); return c >= 0 && r >= 0 && c < n && r < n ? r * n + c : -1 }
function moveSel(dc, dr) { const n = G.P.n; let r = Math.floor(G.sel / n) + dr, c = G.sel % n + dc; r = (r + n) % n; c = (c + n) % n; G.sel = r * n + c; cur.show = true; announce() }
function announce() {
	const n = G.P.n, i = G.sel, r = Math.floor(i / n) + 1, c = i % n + 1;
	let s = 'Row ' + r + ', column ' + c + ': ';
	if (G.P.kind == 'nonogram') s += ['empty', 'filled', 'crossed'][G.cells[i]] + '. Row clue ' + (G.P.rows[r - 1].join(' ') || '0') + ', column clue ' + (G.P.cols[c - 1].join(' ') || '0') + '.';
	else { s += G.val[i] ? G.val[i] + (isGiven(i) ? ', given' : '') : 'empty'; if (G.P.kind == 'cages') { const cg = G.P.cages.find(x => x.cells.includes(i)); s += '. Cage ' + cg.t + (cg.op == '=' ? '' : ' ' + {'+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided'}[cg.op]) + ', ' + cg.cells.length + ' cells.' } }
	say(s);
}
function pointers() {
	let pend = null;
	RG.pointer(cv, view, {
		down(p) {
			if (!G || !$('#ov').hidden) return; const i = cellAt(p); if (i < 0) return;
			cur.show = false; G.sel = i;
			if (G.P.kind != 'nonogram') { ui(); return }
			if (p.touch || p.pen) { pend = {i, moved: false}; return }
			strokeStart(i, p.button == 2 || crossMode ? 'cross' : 'fill');
		},
		move(p) {
			if (!G || G.P.kind != 'nonogram') return; const i = cellAt(p);
			if (pend && i >= 0 && i != pend.i && !stroke) { strokeStart(pend.i, crossMode ? 'cross' : 'fill'); pend = null }
			if (stroke && i >= 0) strokeAt(i);
		},
		up() {
			if (!G || G.P.kind != 'nonogram') return;
			if (pend) { strokeStart(pend.i, crossMode ? 'cross' : 'fill'); pend = null }
			strokeEnd();
		},
		long() { if (pend) { strokeStart(pend.i, 'cross'); pend = null; if (navigator.vibrate) try { navigator.vibrate(20) } catch (e) {} } },
		secondary() {}});
	addEventListener('keydown', e => {
		if (!G || !$('#ov').hidden || !$('#menu').hidden) return;
		if ((e.ctrlKey || e.metaKey) && e.code == 'KeyZ') { e.preventDefault(); undo(); return }
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		/* straight away (not at the next frame), so N then 3 writes a note */
		if (e.code == 'KeyN' && G.P.kind != 'nonogram') { notesMode = !notesMode; pad(); say(notesMode ? 'Notes on.' : 'Notes off.'); return }
		if (e.code == 'KeyH') { hint(); return }
		if (e.code == 'KeyU') { undo(); return }
		const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
		if (m && G.P.kind != 'nonogram') { e.preventDefault(); cur.show = true; const v = +m[1]; if (!v) erase(G.sel); else if (v <= G.P.n) write(G.sel, v); return }
	});
}

async function startUp() {
	await RG.init('logic-pack');
	const s = await RG.load();
	if (s && s.v == 1) save = Object.assign(save, s, {best: Object.assign({}, s.best), daily: Object.assign({}, s.daily), cur: Object.assign({}, s.cur), diff: Object.assign({}, s.diff)});
	if (s && typeof s.reduceFlash == 'boolean') RG.reduceFlash = s.reduceFlash;
	view = RG.fit(cv, layout);
	RG.bind({left: ['ArrowLeft', 'KeyA', 'pad:14', 'pad:axis0-'], right: ['ArrowRight', 'KeyD', 'pad:15', 'pad:axis0+'], up: ['ArrowUp', 'KeyW', 'pad:12', 'pad:axis1-'], down: ['ArrowDown', 'KeyS', 'pad:13', 'pad:axis1+'],
		act: ['Space', 'Enter', 'pad:0'], alt: ['KeyX', 'Backspace', 'Delete', 'pad:1'], notes: ['pad:2'], hint: ['pad:3'], undo: ['pad:4'], pause: ['KeyP', 'Escape', 'pad:9']});
	pointers();
	RG.onPause(() => { if (G && !G.done && $('#menu').hidden) showPause() });
	RG.on('settings', () => { ui(); draw() });
	document.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { openKind(b.dataset.kind); cv.focus({preventScroll: true}) });
	document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { newGame(G.kind, b.dataset.diff); cv.focus({preventScroll: true}) });
	const menu = $('#menu'), mbtn = $('#menuBtn');
	let menuPaused = false;
	const menuShow = on => {
		menu.hidden = !on; mbtn.setAttribute('aria-expanded', on);
		if (on) { menu.querySelector('button').focus(); if (G && !G.done && !RG.paused) { menuPaused = true; RG.pause() } }
		else if (menuPaused) { menuPaused = false; if ($('#ov').hidden) RG.resume() }
	};
	const modal = f => { f(); if (G && !G.done && !RG.paused) { pausedByDialog = true; RG.pause() } };
	mbtn.onclick = e => { e.stopPropagation(); menuShow(menu.hidden) };
	document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target != mbtn) menuShow(false) });
	menu.onclick = async e => {
		const b = e.target.closest('[data-cmd]'); if (!b) return; menuShow(false);
		const k = b.dataset.cmd;
		if (k == 'new') newGame(G.kind, G.diff == 'daily' ? 'medium' : G.diff);
		else if (k == 'restart') { start({kind: G.kind, diff: G.diff, day: G.day, P: G.P, t: G.t, hints: G.hints, done: false}) }
		else if (k == 'pause') RG.pause(); else if (k == 'stats') modal(stats); else if (k == 'help') modal(help);
		else if (k == 'flash') { RG.reduceFlash = !RG.reduceFlash; save.reduceFlash = RG.reduceFlash; persist(); ui() }
		else if (k == 'export') { keep(true); RG.exportSave() }
		else if (k == 'import') { try { const d = await RG.importSave(); if (d && d.v == 1) { save = Object.assign({v: 1, best: {}, daily: {}, cur: {}, diff: {}, solved: 0}, d); G = null; if (!resume(save.kind)) newGame(save.kind, 'easy'); dialog('<h2>Save imported</h2><p>Your best times and puzzles in progress are back.</p>', [['OK', null, 1]]) } } catch (err) { dialog('<h2>Not imported</h2><p>' + String(err.message).replace(/</g, '&lt;') + '</p>', [['OK', null, 1]]) } }
	};
	addEventListener('keydown', e => { if (e.code == 'Escape' && !menu.hidden) { menuShow(false); e.stopPropagation() } }, true);
	if (!resume(save.kind || 'sudoku')) newGame(save.kind || 'sudoku', 'easy');
	if (!save.seenHelp) { save.seenHelp = 1; persist(); help(); pausedByDialog = true; RG.pause() }
	let tick = 0;
	RG.loop(dt => {
		fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < 2);
		if (!$('#ov').hidden) {
			if (RG.pressed('act') && document.activeElement && document.activeElement.tagName == 'BUTTON' && RG.lastInput == 'pad') document.activeElement.click();
			if (RG.pressed('pause') && pausedByDialog) closeDialog();
			return;
		}
		if (!menu.hidden || !G) return;
		if (RG.pressed('pause') && !G.done) { RG.pause(); return }
		if (RG.paused) return;
		if (!G.done) { const s0 = Math.floor(G.t); G.t += dt; if (Math.floor(G.t) != s0) { $('#time').textContent = fmt(G.t); if (++tick % 10 == 0) keep() } }
		if (RG.pressed('left')) moveSel(-1, 0); if (RG.pressed('right')) moveSel(1, 0); if (RG.pressed('up')) moveSel(0, -1); if (RG.pressed('down')) moveSel(0, 1);
		if (RG.pressed('hint')) hint();
		if (RG.pressed('undo')) undo();
		if (G.P.kind == 'nonogram') {
			if (RG.pressed('act')) { cur.show = true; strokeStart(G.sel, 'fill'); strokeEnd(); announce() }
			if (RG.pressed('alt')) { cur.show = true; strokeStart(G.sel, 'cross'); strokeEnd(); announce() }
		} else {
			if (RG.pressed('notes')) { notesMode = !notesMode; pad(); say(notesMode ? 'Notes on.' : 'Notes off.') }
			if (RG.pressed('alt')) { cur.show = true; erase(G.sel) }
			if (RG.pressed('act') && RG.lastInput == 'pad' && !isGiven(G.sel)) { cur.show = true; const m = notesMode; notesMode = false; write(G.sel, (G.val[G.sel] % G.P.n) + 1); notesMode = m; announce() }
		}
	}, draw, {whilePaused: true});
	RG.on('resize', () => draw());
	/* for the browser tests */
	window.__lp = {get: () => G, save: () => save, newGame, view: () => view, write, erase, hint, undo, openKind, conflicts: () => [...conflicts()], ngLine,
		cellCenter(i) { const b = cv.getBoundingClientRect(), g = geo(), n = G.P.n; return {x: b.left + view.ox + (g.lx + (i % n + .5) * g.cs) * view.scale, y: b.top + view.oy + (g.ly + (Math.floor(i / n) + .5) * g.cs) * view.scale} },
		/* everything right but one cell (for the win test) */
		fillAllBut(k) { const P = G.P; if (P.kind == 'nonogram') P.sol.forEach((s, i) => { if (i != k) G.cells[i] = s ? 1 : 2 }); else P.sol.forEach((v, i) => { if (i != k) G.val[i] = v }); pad(); ui() }};
}
startUp();
})();
