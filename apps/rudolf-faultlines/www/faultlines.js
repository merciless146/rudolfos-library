/* ===== Fault Lines: a logic puzzle for Rudolf OS (docs/plan-games.md in RudolfOS). Clear the ground without opening a
   fault. Each opened cell shows how many of its eight neighbours hide a fault; mark the faults you have found.
   Three fields (Small 9×9 with 10 faults, Medium 16×16 with 40, Large 30×16 with 99, turned upright on a tall
   window), and the Daily field: the same for everyone on a day, started from its centre.
   Mouse: click to open, right-click to mark; click an opened number whose faults are all marked to open the rest
   around it. Touch: tap to open, hold to mark (or the Dig/Mark switch). Keys: arrows or WASD, Space to open, F to
   mark, N new, P pause. Controller: d-pad or stick, A open, X mark, Y new, Start pause.
   Original work. GPL-2.0-or-later. ===== */
(function () {
'use strict';
const SIZES = {small: {w: 9, h: 9, n: 10, name: 'Small'}, medium: {w: 16, h: 16, n: 40, name: 'Medium'}, large: {w: 30, h: 16, n: 99, name: 'Large'}, daily: {w: 16, h: 16, n: 40, name: 'Daily'}};
const $ = s => document.querySelector(s);
const cv = $('#cv');
let save = {v: 1, best: {}, daily: {}, played: 0, won: 0, size: 'small'};
let G = null;          /* the game: {size, w, h, n, fault[], open[], mark[], adj[], state:'ready'|'play'|'won'|'lost', t, seed, boom} */
let cur = {c: 0, r: 0, show: false}, digMode = true, fx = [];

/* ---------- the field ---------- */
const idx = (c, r) => r * G.w + c;
const inb = (c, r) => c >= 0 && r >= 0 && c < G.w && r < G.h;
function around(c, r, f) { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc || dr) && inb(c + dc, r + dr)) f(c + dc, r + dr) }
function newGame(size, opt) {
	size = SIZES[size] ? size : 'small';
	const S = SIZES[size], tall = view && view.ch > view.cw * 1.15;
	let w = S.w, h = S.h; if (w > h && tall) [w, h] = [h, w];
	const day = RG.today();
	G = {size, w, h, n: S.n, fault: new Uint8Array(w * h), open: new Uint8Array(w * h), mark: new Uint8Array(w * h), adj: new Uint8Array(w * h),
		state: 'ready', t: 0, seed: size == 'daily' ? 'fault-lines:' + day : (opt && opt.seed) || String(Math.random()), day, boom: null, opened: 0};
	cur = {c: w >> 1, r: h >> 1, show: cur.show}; fx = [];
	if (size == 'daily') { lay(w >> 1, h >> 1); openCell(w >> 1, h >> 1, true) }
	save.size = size; persist();
	if (view) view.refit();
	ui(); say(S.name + ' field, ' + w + ' by ' + h + ', ' + S.n + ' faults.');
}
/* faults placed once the first cell is opened: never on it or around it */
function lay(c0, r0) {
	const rnd = RG.rng(G.seed), free = [];
	for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) if (Math.abs(c - c0) > 1 || Math.abs(r - r0) > 1) free.push(idx(c, r));
	for (let k = 0; k < G.n && free.length; k++) { const j = k + Math.floor(rnd() * (free.length - k)); [free[k], free[j]] = [free[j], free[k]]; G.fault[free[k]] = 1 }
	for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) { let a = 0; around(c, r, (x, y) => a += G.fault[idx(x, y)]); G.adj[idx(c, r)] = a }
	G.state = 'play';
}
function openCell(c, r, quiet) {
	if (G.state == 'won' || G.state == 'lost' || !inb(c, r)) return;
	if (G.state == 'ready') lay(c, r);
	const i = idx(c, r); if (G.open[i] || G.mark[i]) return;
	if (G.fault[i]) return lose(c, r);
	const st = [[c, r]];
	while (st.length) {
		const [x, y] = st.pop(), j = idx(x, y); if (G.open[j] || G.mark[j]) continue;
		G.open[j] = 1; G.opened++;
		if (!G.adj[j]) around(x, y, (a, b) => { if (!G.open[idx(a, b)]) st.push([a, b]) });
	}
	if (!quiet) sfx('dig');
	if (G.opened == G.w * G.h - G.n) win();
	ui();
}
/* an opened number with as many marks around it: opens the rest around it */
function chord(c, r) {
	const i = idx(c, r); if (!G.open[i] || !G.adj[i]) return false;
	let m = 0; around(c, r, (x, y) => m += G.mark[idx(x, y)]);
	if (m != G.adj[i]) return false;
	around(c, r, (x, y) => { if (G.state == 'play') openCell(x, y, true) });
	if (G.state == 'play') sfx('dig');
	return true;
}
function toggleMark(c, r) {
	if (G.state != 'play' || !inb(c, r)) return;
	const i = idx(c, r); if (G.open[i]) return;
	G.mark[i] ^= 1; sfx(G.mark[i] ? 'mark' : 'unmark'); ui();
}
function act(c, r, mark) {
	if (!inb(c, r)) return;
	cur.c = c; cur.r = r;
	if (G.state == 'won' || G.state == 'lost') return;
	if (mark) return toggleMark(c, r);
	if (G.open[idx(c, r)]) chord(c, r); else openCell(c, r);
}
function lose(c, r) {
	G.state = 'lost'; G.boom = {c, r, t: 0};
	const i = idx(c, r); G.open[i] = 1;
	save.played++; persist(); sfx('lose'); ui();
	say('A fault opened. Game over.');
	setTimeout(() => G && G.state == 'lost' && dialog('<h2>The ground gave way</h2><p>A fault opened ' + fmt(G.t) + ' in.</p>', [['Try again', () => newGame(G.size), 1], ['Look at the field', null]]), 900);
}
function win() {
	G.state = 'won'; for (let i = 0; i < G.fault.length; i++) if (G.fault[i]) G.mark[i] = 1;
	const t = Math.round(G.t * 10) / 10; save.played++; save.won++;
	let best = false;
	if (G.size == 'daily') { if (!save.daily[G.day] || t < save.daily[G.day]) save.daily[G.day] = t; trimDaily() }
	else if (!save.best[G.size] || t < save.best[G.size]) { save.best[G.size] = t; best = true }
	persist(); sfx('win'); fx.push({k: 'win', t: 0}); ui();
	say('Cleared in ' + fmt(t) + '.');
	setTimeout(() => G && G.state == 'won' && dialog('<h2>Ground cleared</h2><p>' + SIZES[G.size].name + ' field in <b>' + fmt(t) + '</b>' + (best ? ', your best time.' : '.') + '</p>' + (G.size == 'daily' ? '<p>' + streakText() + '</p>' : ''), [['New game', () => newGame(G.size == 'daily' ? save.lastSize || 'medium' : G.size), 1], ['Close', null]]), 700);
}
function trimDaily() { const k = Object.keys(save.daily).sort(); while (k.length > 120) delete save.daily[k.shift()] }
function streak() { let n = 0, d = new Date(); for (;;) { if (save.daily[RG.today(d)] === undefined) break; n++; d.setDate(d.getDate() - 1) } return n }
function streakText() { const n = streak(); return n > 1 ? n + ' days in a row.' : 'Come back tomorrow for a new one.' }
const fmt = t => { t = Math.floor(t); return t < 60 ? t + ' s' : Math.floor(t / 60) + ' min ' + String(t % 60).padStart(2, '0') + ' s' };

/* ---------- drawing ---------- */
const PAL = {
	light: {closed: '#c8b48f', closedHi: '#ddcdaa', closedLo: '#a08a64', open: '#efe4cf', openLine: '#d5c6aa', grid: '#b5a27f', fault: '#3a2c22', glow: '#e07b2a', stake: '#2f5f8f', flag: '#f2c230', cursor: '#1f4f80', wrong: '#7a2bb5',
		num: ['', '#1f5fa8', '#2a7a6a', '#a0522d', '#5b3c9c', '#7a5a00', '#0f6f8f', '#3a3a3a', '#6b6b6b']},
	dark: {closed: '#544838', closedHi: '#6b5c47', closedLo: '#3a3127', open: '#2b2621', openLine: '#3a332c', grid: '#1a1714', fault: '#0d0a08', glow: '#ff9840', stake: '#7db5ea', flag: '#ffd34d', cursor: '#9cc8f2', wrong: '#c38cf0',
		num: ['', '#79b0f0', '#62c9b5', '#eda172', '#b79af0', '#e3c25b', '#6fd0ea', '#d0d0d0', '#9a9a9a']}};
let view = null;
const CELL = 32;
function layout() { return G ? {w: G.w * CELL + 8, h: G.h * CELL + 8} : {w: 100, h: 100} }
function rrect(x, c, y, w, h, r) { x.beginPath(); x.moveTo(c + r, y); x.arcTo(c + w, y, c + w, y + h, r); x.arcTo(c + w, y + h, c, y + h, r); x.arcTo(c, y + h, c, y, r); x.arcTo(c, y, c + w, y, r); x.closePath() }
function draw() {
	if (!G || !view) return;
	const x = view.begin(), P = RG.dark ? PAL.dark : PAL.light;
	x.fillStyle = P.grid; rrect(x, 0, 0, G.w * CELL + 8, G.h * CELL + 8, 8); x.fill();
	x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 19px system-ui,sans-serif';
	const shake = G.boom && !RG.reduceFlash && G.boom.t < .4 ? (Math.random() - .5) * 6 * (1 - G.boom.t / .4) : 0;
	x.save(); x.translate(4 + shake, 4);
	for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) {
		const i = idx(c, r), X = c * CELL, Y = r * CELL;
		if (G.open[i]) {
			x.fillStyle = P.open; x.fillRect(X, Y, CELL, CELL); x.strokeStyle = P.openLine; x.lineWidth = 1; x.strokeRect(X + .5, Y + .5, CELL - 1, CELL - 1);
			if (G.fault[i]) drawFault(x, X, Y, P, G.boom && G.boom.c == c && G.boom.r == r);
			else if (G.adj[i]) { x.fillStyle = P.num[G.adj[i]]; x.fillText(G.adj[i], X + CELL / 2, Y + CELL / 2 + 1) }
		} else {
			x.fillStyle = P.closed; rrect(x, X + 1, Y + 1, CELL - 2, CELL - 2, 4); x.fill();
			x.fillStyle = P.closedHi; x.fillRect(X + 3, Y + 2, CELL - 6, 3);
			x.fillStyle = P.closedLo; x.fillRect(X + 3, Y + CELL - 5, CELL - 6, 3);
			const lost = G.state == 'lost';
			if (G.mark[i]) { drawStake(x, X, Y, P); if (lost && !G.fault[i]) { x.strokeStyle = P.wrong; x.lineWidth = 3; x.beginPath(); x.moveTo(X + 6, Y + 6); x.lineTo(X + CELL - 6, Y + CELL - 6); x.moveTo(X + CELL - 6, Y + 6); x.lineTo(X + 6, Y + CELL - 6); x.stroke() } }
			else if (lost && G.fault[i]) drawFault(x, X, Y, P, false);
		}
	}
	if (cur.show && G.state != 'won') { x.strokeStyle = P.cursor; x.lineWidth = 3; rrect(x, cur.c * CELL + 1.5, cur.r * CELL + 1.5, CELL - 3, CELL - 3, 5); x.stroke() }
	/* the ground cracking open around the fault that was hit (no flash with Reduce flashing) */
	if (G.boom && G.boom.t < 1.2) {
		const k = G.boom.t / 1.2, cx = G.boom.c * CELL + CELL / 2, cy = G.boom.r * CELL + CELL / 2;
		x.strokeStyle = P.fault; x.globalAlpha = 1 - k; x.lineWidth = 2;
		const rnd = RG.rng(G.boom.c * 131 + G.boom.r);
		for (let a = 0; a < 7; a++) { const an = a / 7 * Math.PI * 2 + rnd(), L = k * CELL * 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * L * .5 + (rnd() - .5) * 8, cy + Math.sin(an) * L * .5 + (rnd() - .5) * 8); x.lineTo(cx + Math.cos(an) * L, cy + Math.sin(an) * L); x.stroke() }
		x.globalAlpha = 1;
	}
	for (const f of fx) if (f.k == 'win' && f.t < 1.5) {
		const k = f.t / 1.5; x.globalAlpha = (1 - k) * (RG.reduceFlash ? .35 : .7); x.fillStyle = P.flag;
		const rnd = RG.rng(7);
		for (let s = 0; s < 40; s++) { const px = rnd() * G.w * CELL, py = rnd() * G.h * CELL - k * 40 * (1 + rnd()); x.beginPath(); x.arc(px, py, 2 + rnd() * 2, 0, 7); x.fill() }
		x.globalAlpha = 1;
	}
	x.restore();
}
function drawFault(x, X, Y, P, hit) {
	x.fillStyle = hit ? P.glow : P.closedLo; x.fillRect(X + 1, Y + 1, CELL - 2, CELL - 2);
	x.strokeStyle = P.fault; x.lineWidth = 3; x.lineJoin = 'round';
	x.beginPath(); x.moveTo(X + 6, Y + 5); x.lineTo(X + 14, Y + 13); x.lineTo(X + 11, Y + 18); x.lineTo(X + 20, Y + 24); x.lineTo(X + 26, Y + 28); x.stroke();
	x.lineWidth = 2; x.beginPath(); x.moveTo(X + 14, Y + 13); x.lineTo(X + 24, Y + 9); x.moveTo(X + 11, Y + 18); x.lineTo(X + 5, Y + 24); x.stroke();
}
function drawStake(x, X, Y, P) {
	x.strokeStyle = P.stake; x.lineWidth = 3; x.beginPath(); x.moveTo(X + 11, Y + 7); x.lineTo(X + 11, Y + 26); x.stroke();
	x.fillStyle = P.flag; x.strokeStyle = P.stake; x.lineWidth = 1.5; x.beginPath(); x.moveTo(X + 12, Y + 7); x.lineTo(X + 25, Y + 12); x.lineTo(X + 12, Y + 17); x.closePath(); x.fill(); x.stroke();
	x.fillStyle = P.stake; x.fillRect(X + 7, Y + 25, 9, 3);
}

/* ---------- sound (short, made here; quiet) ---------- */
let AC = null;
function sfx(k) {
	try {
		AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state == 'suspended') AC.resume();
		const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination);
		const S = {dig: [220, 150, .06, 'triangle', .08], mark: [520, 640, .07, 'sine', .07], unmark: [480, 360, .06, 'sine', .05], lose: [120, 50, .5, 'sawtooth', .09], win: [523, 1046, .45, 'triangle', .08]}[k];
		if (!S) return; o.type = S[3]; o.frequency.setValueAtTime(S[0], t); o.frequency.exponentialRampToValueAtTime(S[1], t + S[2]);
		g.gain.setValueAtTime(S[4], t); g.gain.exponentialRampToValueAtTime(.0001, t + S[2] + .05); o.start(t); o.stop(t + S[2] + .08);
	} catch (e) {}
}

/* ---------- the page ---------- */
function ui() {
	if (!G) return;
	let m = 0; for (let i = 0; i < G.mark.length; i++) m += G.mark[i];
	$('#left').textContent = G.n - m; $('#time').textContent = Math.floor(G.t);
	document.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed', b.dataset.size == G.size));
	const mb = $('#mode'); mb.setAttribute('aria-pressed', !digMode); mb.textContent = digMode ? '⛏ Dig' : '⚑ Mark';
	$('[data-cmd=flash]').setAttribute('aria-pressed', !!RG.reduceFlash);
	document.documentElement.classList.toggle('touch', RG.lastInput == 'touch');
}
function say(t) { $('#sr').textContent = t }
function dialog(html, btns) {
	$('#ovBody').innerHTML = html; const B = $('#ovBtns'); B.innerHTML = '';
	btns.forEach(([t, f, main]) => { const b = document.createElement('button'); b.textContent = t; if (main) b.className = 'main'; b.onclick = () => { closeDialog(); f && f() }; B.appendChild(b) });
	$('#ov').hidden = false; (B.querySelector('.main') || B.firstChild).focus();
}
function closeDialog() { $('#ov').hidden = true; if (pausedByDialog) { pausedByDialog = false; RG.resume() } cv.focus() }
let pausedByDialog = false;
function showPause() {
	if (!$('#ov').hidden) return;
	pausedByDialog = true;
	dialog('<h2>Paused</h2><p>The field is hidden while the game is paused.</p>', [['Carry on', null, 1]]);
}
function help() {
	dialog('<h2>How to play</h2><p>Clear the ground without opening a fault. A number tells how many of the eight cells around it hide a fault.</p>' +
		'<p><b>Mouse:</b> click to open, right-click to mark a fault. Click a number whose faults are all marked to open the rest around it.</p>' +
		'<p><b>Touch:</b> tap to open, hold to mark; or switch taps to marking with ⛏/⚑.</p>' +
		'<p><b>Keys:</b> arrows or WASD to move, Space to open, F to mark, N for a new game, P to pause.</p>' +
		'<p><b>Controller:</b> d-pad or stick to move, A to open, X to mark, Y new game, Start to pause.</p>' +
		'<p>The <b>Daily</b> field is the same for everyone today and starts open in the middle.</p>', [['Play', null, 1]]);
}
function stats() {
	const row = (n, v) => '<tr><td>' + n + '</td><td>' + (v ? fmt(v) : '–') + '</td></tr>';
	dialog('<h2>Best times</h2><table>' + row('Small', save.best.small) + row('Medium', save.best.medium) + row('Large', save.best.large) + row('Daily, today', save.daily[RG.today()]) + '</table>' +
		'<p>' + save.won + ' cleared of ' + save.played + ' played. Daily: ' + streak() + ' in a row.</p>', [['Close', null, 1]]);
}
let saveT = 0;
function persist() { clearTimeout(saveT); saveT = setTimeout(() => RG.save(save).catch(() => {}), 150) }

function cellAt(p) { const c = Math.floor((p.x - 4) / CELL), r = Math.floor((p.y - 4) / CELL); return inb(c, r) ? {c, r} : null }
async function start() {
	await RG.init('fault-lines');
	const s = await RG.load();
	if (s && s.v == 1) save = Object.assign(save, s, {best: Object.assign({}, s.best), daily: Object.assign({}, s.daily)});
	if (s && typeof s.reduceFlash == 'boolean') RG.reduceFlash = s.reduceFlash;
	view = RG.fit(cv, layout);
	RG.bind({left: ['ArrowLeft', 'KeyA', 'pad:14', 'pad:axis0-'], right: ['ArrowRight', 'KeyD', 'pad:15', 'pad:axis0+'], up: ['ArrowUp', 'KeyW', 'pad:12', 'pad:axis1-'], down: ['ArrowDown', 'KeyS', 'pad:13', 'pad:axis1+'],
		open: ['Space', 'Enter', 'pad:0'], mark: ['KeyF', 'pad:2'], new: ['KeyN', 'pad:3'], pause: ['KeyP', 'Escape', 'pad:9']});
	RG.pointer(cv, view, {
		tap(p) { const k = cellAt(p); if (k) { cur.show = false; act(k.c, k.r, p.touch && !digMode) } },
		secondary(p) { const k = cellAt(p); if (k) { cur.show = false; act(k.c, k.r, true); if (p.touch && navigator.vibrate) try { navigator.vibrate(20) } catch (e) {} } },
		down() { ui() }});
	RG.onPause(() => { if (G && G.state == 'play') showPause() });
	RG.on('settings', ui);
	document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { if (b.dataset.size != 'daily') save.lastSize = b.dataset.size; newGame(b.dataset.size); cv.focus() });
	$('#mode').onclick = () => { digMode = !digMode; ui() };
	const menu = $('#menu'), mbtn = $('#menuBtn');
	const menuShow = on => { menu.hidden = !on; mbtn.setAttribute('aria-expanded', on); if (on) menu.querySelector('button').focus() };
	mbtn.onclick = e => { e.stopPropagation(); menuShow(menu.hidden) };
	document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target != mbtn) menuShow(false) });
	menu.onclick = async e => {
		const b = e.target.closest('[data-cmd]'); if (!b) return; menuShow(false);
		const k = b.dataset.cmd;
		if (k == 'new') newGame(G.size); else if (k == 'pause') RG.pause(); else if (k == 'stats') stats(); else if (k == 'help') help();
		else if (k == 'flash') { RG.reduceFlash = !RG.reduceFlash; save.reduceFlash = RG.reduceFlash; persist(); ui() }
		else if (k == 'export') RG.exportSave();
		else if (k == 'import') { try { const d = await RG.importSave(); if (d && d.v == 1) { save = Object.assign({v: 1, best: {}, daily: {}, played: 0, won: 0}, d); ui(); dialog('<h2>Save imported</h2><p>Your best times are back.</p>', [['OK', null, 1]]) } } catch (err) { dialog('<h2>Not imported</h2><p>' + String(err.message).replace(/</g, '&lt;') + '</p>', [['OK', null, 1]]) } }
	};
	addEventListener('keydown', e => { if (e.code == 'Escape' && !menu.hidden) { menuShow(false); e.stopPropagation() } }, true);
	newGame(save.size || 'small');
	if (!save.seenHelp) { save.seenHelp = 1; persist(); help() }
	RG.loop(dt => {
		if (!$('#ov').hidden) {   /* a dialog: its buttons take Enter and A */
			if (RG.pressed('open') && document.activeElement && document.activeElement.tagName == 'BUTTON' && RG.lastInput == 'pad') document.activeElement.click();
			if (RG.pressed('pause') && pausedByDialog) closeDialog();
			return;
		}
		if (RG.paused) return;
		if (G.state == 'play') { const t0 = Math.floor(G.t); G.t += dt; if (Math.floor(G.t) != t0) $('#time').textContent = Math.floor(G.t) }
		if (G.boom) G.boom.t += dt; fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < 2);
		const mv = (a, dc, dr) => { if (RG.pressed(a)) { cur.show = true; cur.c = Math.max(0, Math.min(G.w - 1, cur.c + dc)); cur.r = Math.max(0, Math.min(G.h - 1, cur.r + dr)) } };
		mv('left', -1, 0); mv('right', 1, 0); mv('up', 0, -1); mv('down', 0, 1);
		if (RG.pressed('open')) { cur.show = true; act(cur.c, cur.r, false) }
		if (RG.pressed('mark')) { cur.show = true; act(cur.c, cur.r, true) }
		if (RG.pressed('new')) newGame(G.size);
		if (RG.pressed('pause')) RG.pause();
	}, draw, {whilePaused: true});
	RG.on('resize', () => draw());
	/* for the browser tests */
	window.__fl = {get: () => G, save: () => save, newGame, cellCenter(c, r) { const b = cv.getBoundingClientRect(); return {x: b.left + view.ox + (4 + c * CELL + CELL / 2) * view.scale, y: b.top + view.oy + (4 + r * CELL + CELL / 2) * view.scale} }, view: () => view};
}
start();
})();
