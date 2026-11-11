/* ===== rudolf-gamekit: what every Rudolf OS game shares (docs/plan-games.md in RudolfOS, "Rules for every game").
   Copied into each game's www/ when the Library is built (tools/publish.sh: a game whose index.html loads gamekit.js),
   so a package has everything inside it. One global, RG.
   - Input: keyboard, mouse, touch and gamepad at once, mapped to the game's actions (RG.bind, RG.down, RG.pressed);
     pointers in the game's own coordinates (RG.pointer), with tap, long-press and right-click; RG.lastInput says
     which was used last, so on-screen controls appear only after touch.
   - Any window shape: RG.fit keeps a canvas sharp at the window's size and the screen's pixel density.
   - Saves: the desktop keeps them (a message to the Rudolf OS desktop, which stores them in its database, mirrored
     and backed up by rudolfd); in a plain browser, the browser's storage when it may be used; always export and
     import as a file.
   - Pausing: the window hidden or minimised, the desktop locked or the screen saver on (the desktop says so), focus
     elsewhere; RG.onPause / RG.onResume.
   - Settings from the desktop: dark theme, reduce flashing.
   - A fixed time step (RG.loop): 60 updates a second whatever the screen's rate, so games are deterministic.
   The page runs sandboxed (no storage of its own, no same-origin access): everything goes through messages.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const RG = window.RG = {version: '1.0.0', id: '', paused: false, lastInput: 'mouse'};
const Q = new URLSearchParams(location.search);
const mm = q => { try { return matchMedia(q).matches } catch (e) { return false } };
RG.dark = Q.get('theme') == 'dark' || (Q.get('theme') != 'light' && mm('(prefers-color-scheme: dark)'));
RG.reduceFlash = Q.get('flash') == 'reduce' || mm('(prefers-reduced-motion: reduce)');
const ev = {}; const emit = (n, a) => (ev[n] || []).slice().forEach(f => { try { f(a) } catch (e) { console.error(e) } });
RG.on = (n, f) => { (ev[n] = ev[n] || []).push(f); return f };
RG.onPause = f => RG.on('pause', f); RG.onResume = f => RG.on('resume', f);

/* ---------- the desktop (parent page) ---------- */
const inFrame = (() => { try { return window.parent && window.parent !== window } catch (e) { return false } })();
RG.inDesktop = false;   /* true once the Rudolf OS desktop answered */
let seq = 0; const wait = new Map();
function ask(op, o, ms) {
	if (!inFrame) return Promise.resolve(null);
	const id = ++seq;
	return new Promise(r => {
		wait.set(id, r);
		try { parent.postMessage(Object.assign({rudolfGame: 1, op, id, game: RG.id}, o || {}), '*') } catch (e) { wait.delete(id); r(null); return }
		setTimeout(() => { if (wait.delete(id)) r(null) }, ms || 1500);
	});
}
addEventListener('message', e => {
	if (!inFrame || e.source !== parent) return;
	const m = e.data; if (!m || m.rudolfGame !== 1 || typeof m.op != 'string') return;
	if (m.op == 'reply') { const w = wait.get(m.id); if (w) { wait.delete(m.id); RG.inDesktop = true; w(m) } return }
	if (m.op == 'pause') reason('desktop', true);
	else if (m.op == 'resume') reason('desktop', false);
	else if (m.op == 'settings') {
		if (typeof m.dark == 'boolean') RG.dark = m.dark;
		if (typeof m.reduceFlash == 'boolean') RG.reduceFlash = m.reduceFlash;
		emit('settings', RG);
	}
});

/* ---------- saves: one JSON value per game ---------- */
const MAXSAVE = 256 * 1024;
let cache; const lsKey = () => 'rudolf-game:' + RG.id;
function lsGet() { try { const s = localStorage.getItem(lsKey()); return s ? JSON.parse(s) : undefined } catch (e) { return undefined } }
function lsSet(v) { try { localStorage.setItem(lsKey(), JSON.stringify(v)); return true } catch (e) { return false } }
/* the game's saved value (undefined when there is none) */
RG.load = async function () {
	if (cache !== undefined) return clone(cache);
	const r = await ask('load', {});
	let v = r && r.ok ? r.data : undefined;
	if (v === undefined || v === null) v = lsGet();
	cache = v === null ? undefined : v;
	return clone(cache);
};
/* keeps v (anything JSON can hold, up to 256 KB); true when the desktop or the browser kept it */
RG.save = async function (v) {
	const s = JSON.stringify(v === undefined ? null : v);
	if (s.length > MAXSAVE) throw new Error('save too large');
	cache = JSON.parse(s);
	const r = await ask('save', {data: cache});
	const ls = lsSet(cache);
	return !!(r && r.ok) || ls;
};
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
/* the save as a file the person keeps (Downloads) */
RG.exportSave = async function () {
	const v = await RG.load();
	const blob = new Blob([JSON.stringify({rudolfGame: RG.id, version: 1, saved: new Date().toISOString(), data: v === undefined ? null : v}, null, 1)], {type: 'application/json'});
	const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = RG.id + '-save.json';
	document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000);
};
/* reads a file made by exportSave; resolves to the data, or rejects with a reason a person can read */
RG.importSave = function () {
	return new Promise((ok, no) => {
		const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.style.display = 'none';
		i.onchange = async () => {
			const f = i.files && i.files[0]; i.remove(); if (!f) return no(new Error('No file was chosen.'));
			try { ok(await RG.importText(await f.text())) } catch (e) { no(e) }
		};
		document.body.appendChild(i); i.click();
	});
};
RG.importText = async function (t) {
	if (t.length > MAXSAVE * 2) throw new Error('That file is too large to be a save.');
	let j; try { j = JSON.parse(t) } catch (e) { throw new Error('That file is not a save.') }
	if (!j || j.rudolfGame !== RG.id) throw new Error('That file is not a save of this game.');
	await RG.save(j.data); return clone(j.data);
};

/* ---------- pausing ---------- */
const why = new Set();
function reason(r, on) {
	const was = why.size > 0; on ? why.add(r) : why.delete(r);
	const now = why.size > 0; if (now == was) return;
	RG.paused = now; RG.pauseReasons = [...why]; emit(now ? 'pause' : 'resume', [...why]);
}
document.addEventListener('visibilitychange', () => reason('hidden', document.hidden));
addEventListener('blur', () => reason('focus', true));
addEventListener('focus', () => reason('focus', false));
/* the game's own pause (a key or a button) */
RG.pause = () => reason('player', true);
RG.resume = () => { reason('player', false); reason('focus', false) };
RG.pauseReasons = [];

/* ---------- input: actions ---------- */
/* RG.bind({left:['ArrowLeft','KeyA','pad:14','pad:axis0-'], fire:['KeyZ','pad:0']}) */
let binds = {}; const keys = new Set(), pads = new Set(), edge = new Set();
RG.bind = function (map) { binds = {}; for (const a in map) binds[a] = map[a].slice() };
RG.bindings = () => JSON.parse(JSON.stringify(binds));
/* remapping: one more key or button for an action (or in place of the others, with only) */
RG.rebind = (a, code, only) => { binds[a] = only ? [code] : (binds[a] || []).filter(c => c != code).concat(code) };
const active = c => keys.has(c) || pads.has(c);
RG.down = a => (binds[a] || []).some(active);
/* true once per press (until RG.frame) */
RG.pressed = a => (binds[a] || []).some(c => edge.has(c));
RG.frame = () => edge.clear();
const typing = e => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) };
addEventListener('keydown', e => {
	if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
	RG.lastInput = 'keyboard';
	if (!keys.has(e.code)) edge.add(e.code); keys.add(e.code);
	if (Object.values(binds).some(l => l.includes(e.code))) e.preventDefault();
	emit('key', e);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

/* gamepads: the standard mapping (0 A, 1 B, 2 X, 3 Y, 8 Back, 9 Start, 12-15 d-pad), sticks as pad:axisN- / pad:axisN+ */
RG.pollPads = function () {
	let gp = []; try { gp = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [] } catch (e) {}
	const now = new Set();
	for (const g of gp) {
		(g.buttons || []).forEach((b, i) => { if (b && (b.pressed || b.value > .5)) now.add('pad:' + i) });
		(g.axes || []).forEach((v, i) => { if (v < -.5) now.add('pad:axis' + i + '-'); else if (v > .5) now.add('pad:axis' + i + '+') });
	}
	for (const c of now) if (!pads.has(c)) { edge.add(c); RG.lastInput = 'pad' }
	pads.clear(); now.forEach(c => pads.add(c));
	return gp.length;
};
addEventListener('gamepadconnected', () => { RG.lastInput = 'pad'; emit('pad', true) });

/* ---------- the canvas: any window shape ---------- */
/* RG.fit(canvas, layout): layout(cssW, cssH) returns {w, h} (the game's own units); the canvas fills its box,
   the game's units are scaled to fit and centred. Returns the view, kept up to date: {scale, ox, oy, w, h, cw, ch} */
RG.fit = function (cv, layout) {
	const view = {scale: 1, ox: 0, oy: 0, w: 0, h: 0, cw: 0, ch: 0, dpr: 1};
	const ctx = cv.getContext('2d');
	function size() {
		const r = cv.getBoundingClientRect(), cw = Math.max(1, r.width), ch = Math.max(1, r.height);
		const dpr = Math.min(3, window.devicePixelRatio || 1);
		const L = layout(cw, ch), s = Math.min(cw / L.w, ch / L.h);
		Object.assign(view, {scale: s, w: L.w, h: L.h, cw, ch, dpr, ox: (cw - L.w * s) / 2, oy: (ch - L.h * s) / 2});
		const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
		if (cv.width != pw || cv.height != ph) { cv.width = pw; cv.height = ph }
		emit('resize', view);
	}
	view.begin = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * view.ox, view.dpr * view.oy); return ctx };
	view.toGame = (cx, cy) => { const r = cv.getBoundingClientRect(); return {x: (cx - r.left - view.ox) / view.scale, y: (cy - r.top - view.oy) / view.scale} };
	view.refit = size;
	try { new ResizeObserver(size).observe(cv) } catch (e) { addEventListener('resize', size) }
	size(); return view;
};

/* ---------- pointers: mouse, pen and touch ---------- */
/* RG.pointer(canvas, view, {tap(p), secondary(p), long(p), down(p), move(p), up(p)}): p = {x, y, touch, button} in the
   game's units. A touch held still for 450 ms is a long-press (and no tap follows); the right button is secondary. */
RG.pointer = function (cv, view, h) {
	let st = null;
	const P = (e, extra) => Object.assign(view.toGame(e.clientX, e.clientY), {touch: e.pointerType == 'touch', pen: e.pointerType == 'pen', button: e.button, id: e.pointerId}, extra || {});
	cv.style.touchAction = 'none';
	cv.addEventListener('contextmenu', e => e.preventDefault());
	cv.addEventListener('pointerdown', e => {
		RG.lastInput = e.pointerType == 'touch' ? 'touch' : 'mouse';
		try { cv.setPointerCapture(e.pointerId) } catch (x) {}
		const p = P(e); h.down && h.down(p);
		if (e.button == 2) { h.secondary && h.secondary(p); st = null; return }
		if (e.button != 0) return;
		st = {id: e.pointerId, x: e.clientX, y: e.clientY, long: false, t: 0};
		if (p.touch || p.pen) st.t = setTimeout(() => { if (st) { st.long = true; h.long ? h.long(p) : h.secondary && h.secondary(p) } }, 450);
	});
	cv.addEventListener('pointermove', e => {
		h.move && h.move(P(e));
		if (st && st.id == e.pointerId && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) { clearTimeout(st.t); st.moved = true }
	});
	const end = e => {
		h.up && h.up(P(e));
		if (!st || st.id != e.pointerId) return; clearTimeout(st.t);
		const s = st; st = null;
		if (e.type == 'pointerup' && !s.long && !s.moved) h.tap && h.tap(P(e));
	};
	cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
};

/* ---------- the loop: fixed updates, drawing at the screen's rate ---------- */
/* RG.loop(update, draw): update(dt) 60 times a game second (not while paused, unless it says so), draw(alpha) each frame */
RG.loop = function (update, draw, opt) {
	const STEP = 1 / 60; let acc = 0, last = performance.now(), on = true;
	function f(t) {
		if (!on) return;
		let d = Math.min(.25, (t - last) / 1000); last = t;
		RG.pollPads();
		if (!RG.paused || (opt && opt.whilePaused)) { acc += d; while (acc >= STEP) { update(STEP); RG.frame(); acc -= STEP } }
		else { acc = 0; RG.frame() }
		draw(acc / STEP);
		requestAnimationFrame(f);
	}
	requestAnimationFrame(f);
	return {stop() { on = false }};
};

/* ---------- a small seeded random (daily puzzles, replays) ---------- */
RG.rng = function (seed) {
	let a = typeof seed == 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
	return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
};
/* today as YYYY-MM-DD, local time (the daily puzzle changes at the person's midnight) */
RG.today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ---------- start ---------- */
/* RG.init('game-id'): says hello to the desktop (which answers with its settings) */
RG.init = async function (id) {
	if (!/^[a-z0-9-]{2,40}$/.test(id)) throw new Error('bad game id');
	RG.id = id; document.documentElement.classList.toggle('dark', RG.dark);
	const r = await ask('hello', {kit: RG.version});
	if (r && r.ok) {
		if (typeof r.dark == 'boolean') RG.dark = r.dark;
		if (typeof r.reduceFlash == 'boolean') RG.reduceFlash = r.reduceFlash;
		document.documentElement.classList.toggle('dark', RG.dark);
	}
	RG.on('settings', () => document.documentElement.classList.toggle('dark', RG.dark));
	if (document.hidden) reason('hidden', true);
	return RG;
};
})();
