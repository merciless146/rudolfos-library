/* ===== Logic Pack's puzzles: generators, solvers and hints, without the page (also loads in node for checks).
   - Sudoku: a full grid made at random, then clues taken away while the answer stays unique. Easy can be solved
     with naked singles alone, Medium with naked and hidden singles; Hard only needs to be unique.
   - Picture Grid (nonograms): a random picture whose rows and columns can be solved one line at a time; when line
     logic stalls, a cell is given (shown from the start), so every puzzle has one answer reachable by logic.
   - Cages: a Latin square (each number once per row and column) split into cages, each with a target and an
     operation (+ − × ÷); kept only when the answer is unique.
   rng: a function returning [0, 1). GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a };
const bits = m => { let n = 0; while (m) { m &= m - 1; n++ } return n };
const low = m => 31 - Math.clz32(m & -m);   /* the lowest set bit's index */

/* ---------- Sudoku ---------- */
const BOX = i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor(i % 9 / 3);
const PEERS = [];
for (let i = 0; i < 81; i++) { const s = new Set(), r = Math.floor(i / 9), c = i % 9, b = BOX(i); for (let j = 0; j < 81; j++) if (j != i && (Math.floor(j / 9) == r || j % 9 == c || BOX(j) == b)) s.add(j); PEERS.push([...s]) }
const UNITS = [];
for (let k = 0; k < 9; k++) { UNITS.push([...Array(9)].map((_, j) => k * 9 + j)); UNITS.push([...Array(9)].map((_, j) => j * 9 + k)) }
for (let b = 0; b < 9; b++) { const u = []; for (let i = 0; i < 81; i++) if (BOX(i) == b) u.push(i); UNITS.push(u) }
/* candidates (bits 1..9) of each empty cell */
function sdkCands(g) { const c = new Int16Array(81); for (let i = 0; i < 81; i++) { if (g[i]) continue; let m = 0x3fe; for (const p of PEERS[i]) if (g[p]) m &= ~(1 << g[p]); c[i] = m } return c }
/* the number of answers, counted up to limit (fills g with the first answer when out is given) */
function sdkCount(g0, limit, out) {
	const g = Int8Array.from(g0), R = new Int16Array(9), C = new Int16Array(9), B = new Int16Array(9);
	for (let i = 0; i < 81; i++) if (g[i]) { const m = 1 << g[i], r = Math.floor(i / 9), c = i % 9, b = BOX(i); if ((R[r] | C[c] | B[b]) & m) return 0; R[r] |= m; C[c] |= m; B[b] |= m }
	let n = 0;
	(function rec() {
		let best = -1, bm = 0, bc = 10;
		for (let i = 0; i < 81; i++) if (!g[i]) { const m = 0x3fe & ~(R[Math.floor(i / 9)] | C[i % 9] | B[BOX(i)]), k = bits(m); if (k < bc) { bc = k; best = i; bm = m; if (k < 2) break } }
		if (best < 0) { n++; if (out && n == 1) out.set(g); return }
		if (!bm) return;
		const r = Math.floor(best / 9), c = best % 9, b = BOX(best);
		for (let m = bm; m && n < limit; m &= m - 1) { const v = low(m), bit = 1 << v; g[best] = v; R[r] |= bit; C[c] |= bit; B[b] |= bit; rec(); R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit }
		g[best] = 0;
	})();
	return n;
}
function sdkFull(rng) {
	const g = new Int8Array(81);
	(function rec(i) {
		if (i == 81) return true;
		let m = 0x3fe; for (const p of PEERS[i]) if (g[p]) m &= ~(1 << g[p]);
		const vs = []; for (let v = 1; v <= 9; v++) if (m & (1 << v)) vs.push(v);
		for (const v of shuffle(vs, rng)) { g[i] = v; if (rec(i + 1)) return true }
		g[i] = 0; return false;
	})(0);
	return g;
}
/* the next step by singles: {i, v, why: 'naked'|'hidden', unit} or null */
function sdkStep(g, hidden) {
	const c = sdkCands(g);
	for (let i = 0; i < 81; i++) if (!g[i] && bits(c[i]) == 1) return {i, v: low(c[i]), why: 'naked'};
	if (hidden) for (let u = 0; u < 27; u++) for (let v = 1; v <= 9; v++) {
		let at = -1, k = 0, has = false;
		for (const i of UNITS[u]) { if (g[i] == v) { has = true; break } if (!g[i] && c[i] & (1 << v)) { at = i; k++ } }
		if (!has && k == 1) return {i: at, v, why: 'hidden', unit: u < 18 ? (u % 2 ? 'column' : 'row') : 'box'};
	}
	return null;
}
function sdkSingles(g0, hidden) { const g = Int8Array.from(g0); for (;;) { const s = sdkStep(g, hidden); if (!s) break; g[s.i] = s.v } return g.every(v => v) }
const SDK = {easy: {clues: 36, hidden: false}, medium: {clues: 28, hidden: true}, hard: {clues: 22, hidden: null}};
function sudoku(rng, diff) {
	const D = SDK[diff] || SDK.medium, sol = sdkFull(rng), p = Int8Array.from(sol);
	let clues = 81;
	for (const i of shuffle([...Array(81).keys()], rng)) {
		if (clues <= D.clues) break;
		const t = p[i]; p[i] = 0;
		if (sdkCount(p, 2) != 1 || (D.hidden !== null && !sdkSingles(p, D.hidden))) p[i] = t; else clues--;
	}
	return {kind: 'sudoku', n: 9, given: Array.from(p), sol: Array.from(sol)};
}

/* ---------- Picture Grid (nonograms) ---------- */
const clueOf = line => { const out = []; let k = 0; for (const v of line) { if (v == 1) k++; else if (k) { out.push(k); k = 0 } } if (k) out.push(k); return out };
/* line: -1 unknown, 1 filled, 0 empty. Returns the line with every cell its clue decides, or null (no way fits) */
function lineSolve(clue, line) {
	const n = line.length, canF = new Uint8Array(n), canE = new Uint8Array(n);
	let any = false;
	const pos = [];
	const okE = (a, b) => { for (let i = a; i < b; i++) if (line[i] == 1) return false; return true };
	const okF = (a, b) => { for (let i = a; i < b; i++) if (line[i] == 0) return false; return true };
	let guard = 0;
	(function rec(bi, from) {
		if (++guard > 200000) return;
		if (bi == clue.length) {
			if (!okE(from, n)) return;
			any = true; let k = 0;
			for (let b = 0; b < clue.length; b++) { for (; k < pos[b]; k++) canE[k] = 1; for (; k < pos[b] + clue[b]; k++) canF[k] = 1 }
			for (; k < n; k++) canE[k] = 1;
			return;
		}
		let rest = 0; for (let b = bi + 1; b < clue.length; b++) rest += clue[b] + 1;
		for (let s = from; s + clue[bi] + rest <= n; s++) {
			if (!okE(from, s)) break;
			if (!okF(s, s + clue[bi])) continue;
			if (s + clue[bi] < n && line[s + clue[bi]] == 1) continue;
			pos[bi] = s; rec(bi + 1, s + clue[bi] + 1);
		}
	})(0, 0);
	if (!any) return null;
	return line.map((v, i) => v != -1 ? v : canF[i] && !canE[i] ? 1 : canE[i] && !canF[i] ? 0 : -1);
}
/* line logic over the whole grid: g (-1/0/1, w*h) is filled in place; returns false on a contradiction */
function ngSolve(g, w, h, rows, cols) {
	for (let pass = 0, ch = true; ch && pass < 200; pass++) {
		ch = false;
		for (let r = 0; r < h; r++) { const l = Array.from(g.slice(r * w, r * w + w)), s = lineSolve(rows[r], l); if (!s) return false; s.forEach((v, c) => { if (v != l[c]) { g[r * w + c] = v; ch = true } }) }
		for (let c = 0; c < w; c++) { const l = []; for (let r = 0; r < h; r++) l.push(g[r * w + c]); const s = lineSolve(cols[c], l); if (!s) return false; s.forEach((v, r) => { if (v != l[r]) { g[r * w + c] = v; ch = true } }) }
	}
	return true;
}
const NG = {easy: 5, medium: 10, hard: 15};
function nonogram(rng, diff) {
	const n = NG[diff] || 10;
	let best = null;
	for (let tries = 0; tries < 40; tries++) {
		/* a picture: random, then smoothed once so it has shapes rather than noise */
		let sol = Array.from({length: n * n}, () => rng() < .56 ? 1 : 0);
		const sm = sol.slice();
		for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let k = 0, t = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const R = r + dr, C = c + dc; if (R >= 0 && C >= 0 && R < n && C < n) { t++; k += sol[R * n + C] } } if (rng() < .7) sm[r * n + c] = k * 2 > t ? 1 : k * 2 < t ? 0 : sol[r * n + c] }
		sol = sm;
		if (sol.reduce((a, b) => a + b) < n * n * .3) continue;
		const rows = [], cols = [];
		for (let r = 0; r < n; r++) rows.push(clueOf(sol.slice(r * n, r * n + n)));
		for (let c = 0; c < n; c++) { const l = []; for (let r = 0; r < n; r++) l.push(sol[r * n + c]); cols.push(clueOf(l)) }
		const g = new Int8Array(n * n).fill(-1), given = [];
		ngSolve(g, n, n, rows, cols);
		/* where line logic stalls, give a cell (one that is filled, where possible) and carry on */
		for (let k = 0; g.includes(-1) && k < n * n; k++) {
			const un = []; g.forEach((v, i) => { if (v == -1 && sol[i]) un.push(i) });
			const pick = un.length ? un : [...g.keys()].filter(i => g[i] == -1);
			const i = pick[Math.floor(rng() * pick.length)]; g[i] = sol[i]; given.push(i);
			ngSolve(g, n, n, rows, cols);
		}
		const p = {kind: 'nonogram', n, sol, rows, cols, given};
		if (!best || given.length < best.given.length) best = p;
		if (!given.length) break;
	}
	return best;
}

/* ---------- Cages ---------- */
const CG = {easy: 4, medium: 5, hard: 6};
function cageOk(cg, vals, full) {
	if (cg.op == '=') return !full || vals[0] == cg.t;
	if (cg.op == '+') { const s = vals.reduce((a, b) => a + b, 0); return full ? s == cg.t : s + (cg.cells.length - vals.length) <= cg.t }
	if (cg.op == '×') { const p = vals.reduce((a, b) => a * b, 1); return full ? p == cg.t : cg.t % p == 0 }
	if (!full) return true;
	const [a, b] = vals[0] > vals[1] ? vals : [vals[1], vals[0]];
	return cg.op == '−' ? a - b == cg.t : a == b * cg.t;
}
/* answers counted up to limit; g: 0 empty or a number */
function cgCount(n, cages, g0, limit, out) {
	const g = Int8Array.from(g0), R = new Int16Array(n), C = new Int16Array(n), of = new Int16Array(n * n);
	cages.forEach((cg, k) => cg.cells.forEach(i => of[i] = k));
	for (let i = 0; i < n * n; i++) if (g[i]) { const m = 1 << g[i]; if ((R[Math.floor(i / n)] | C[i % n]) & m) return 0; R[Math.floor(i / n)] |= m; C[i % n] |= m }
	const all = ((1 << (n + 1)) - 1) & ~1;
	const fits = i => { const cg = cages[of[i]], v = cg.cells.filter(j => g[j]).map(j => g[j]); return cageOk(cg, v, v.length == cg.cells.length) };
	let cnt = 0;
	(function rec() {
		let best = -1, bm = 0, bc = 99;
		for (let i = 0; i < n * n; i++) if (!g[i]) { const m = all & ~(R[Math.floor(i / n)] | C[i % n]), k = bits(m); if (k < bc) { bc = k; best = i; bm = m; if (k < 2) break } }
		if (best < 0) { cnt++; if (out && cnt == 1) out.set(g); return }
		const r = Math.floor(best / n), c = best % n;
		for (let m = bm; m && cnt < limit; m &= m - 1) { const v = low(m), bit = 1 << v; g[best] = v; if (fits(best)) { R[r] |= bit; C[c] |= bit; rec(); R[r] &= ~bit; C[c] &= ~bit } }
		g[best] = 0;
	})();
	return cnt;
}
function cages(rng, diff) {
	const n = CG[diff] || 5;
	for (let tries = 0; tries < 400; tries++) {
		/* a Latin square: rows, columns and numbers of a cyclic one shuffled */
		const rp = shuffle([...Array(n).keys()], rng), cp = shuffle([...Array(n).keys()], rng), sp = shuffle([...Array(n).keys()].map(x => x + 1), rng);
		const sol = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) sol.push(sp[(rp[r] + cp[c]) % n]);
		/* cages grown at random: mostly two or three cells */
		const of = new Int16Array(n * n).fill(-1), list = [];
		for (const i of shuffle([...Array(n * n).keys()], rng)) {
			if (of[i] >= 0) continue;
			const x = rng(), size = x < .07 ? 1 : x < .52 ? 2 : x < .86 ? 3 : 4, cells = [i]; of[i] = list.length;
			while (cells.length < size) {
				const nb = []; for (const j of cells) { const r = Math.floor(j / n), c = j % n; [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([R, C]) => { if (R >= 0 && C >= 0 && R < n && C < n && of[R * n + C] < 0) nb.push(R * n + C) }) }
				if (!nb.length) break; const j = nb[Math.floor(rng() * nb.length)]; of[j] = list.length; cells.push(j);
			}
			const v = cells.map(j => sol[j]); let op, t;
			if (cells.length == 1) { op = '='; t = v[0] }
			else if (cells.length == 2) {
				const a = Math.max(...v), b = Math.min(...v), y = rng();
				if (a % b == 0 && y < .5) { op = '÷'; t = a / b } else if (y < .75) { op = '−'; t = a - b } else if (y < .88) { op = '+'; t = a + b } else { op = '×'; t = a * b }
			} else if (rng() < .5) { op = '+'; t = v.reduce((a, b) => a + b) } else { op = '×'; t = v.reduce((a, b) => a * b) }
			list.push({cells: cells.sort((a, b) => a - b), op, t});
		}
		if (cgCount(n, list, new Int8Array(n * n), 2) == 1) return {kind: 'cages', n, sol, cages: list};
	}
	return null;
}
/* the numbers a cell can still take, given the row, column and its cage (g: the player's numbers, 0 empty) */
function cgCands(p, g, i) {
	const n = p.n, r = Math.floor(i / n), c = i % n;
	const rc = j => { let m = ((1 << (n + 1)) - 1) & ~1; for (let k = 0; k < n; k++) { if (g[r * n + k] && r * n + k != j) m &= ~(1 << g[r * n + k]) } return m };
	const cg = p.cages.find(x => x.cells.includes(i)), cells = cg.cells, ok = new Set();
	const cand = cells.map(j => { if (g[j]) return [g[j]]; const R = Math.floor(j / n), C = j % n; let m = ((1 << (n + 1)) - 1) & ~1; for (let k = 0; k < n; k++) { if (g[R * n + k]) m &= ~(1 << g[R * n + k]); if (g[k * n + C]) m &= ~(1 << g[k * n + C]) } const o = []; for (let v = 1; v <= n; v++) if (m & (1 << v)) o.push(v); return o });
	const vals = [];
	(function rec(k) {
		if (k == cells.length) { if (cageOk(cg, vals, true)) ok.add(vals[cells.indexOf(i)]); return }
		for (const v of cand[k]) {
			const j = cells[k]; let clash = false;
			for (let q = 0; q < k; q++) if (vals[q] == v && (Math.floor(cells[q] / n) == Math.floor(j / n) || cells[q] % n == j % n)) { clash = true; break }
			if (clash) continue; vals[k] = v; rec(k + 1);
		}
	})(0);
	return [...ok].sort();
}

/* ---------- making a puzzle ---------- */
function make(kind, diff, rng) { return kind == 'sudoku' ? sudoku(rng, diff) : kind == 'nonogram' ? nonogram(rng, diff) : cages(rng, diff) }
const LP = {make, sudoku, nonogram, cages, sdkCount, sdkStep, sdkCands, sdkSingles, lineSolve, ngSolve, clueOf, cgCount, cgCands, cageOk, PEERS, UNITS, BOX, shuffle};
if (typeof module != 'undefined') module.exports = LP; else root.LP = LP;
})(typeof window != 'undefined' ? window : this);
