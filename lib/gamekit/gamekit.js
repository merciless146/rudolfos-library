/* ===== rudolf-gamekit: what every Rudolf OS game shares (docs/plan-games.md in RudolfOS, "Rules for every game").
   Copied into each game's www/ when the Library is built (tools/publish.sh: a game whose index.html loads gamekit.js),
   so a package has everything inside it. One global, RG.
   - Input: keyboard, mouse, touch and gamepad at once, mapped to the game's actions (RG.bind, RG.down, RG.pressed);
     pointers in the game's own coordinates (RG.pointer), with tap, long-press and right-click; RG.lastInput says
     which was used last, so on-screen controls appear only after touch. From 1.2.0 mouse buttons and the wheel can
     be bound like keys ('mouse:0' left, 'mouse:1' middle, 'mouse:2' right, 'wheel:up', 'wheel:down'), fed by the
     game from its own canvas (RG.mouse, RG.wheel), so clicks on menus never count.
   - Any window shape: RG.fit keeps a canvas sharp at the window's size and the screen's pixel density.
   - Saves: the desktop keeps them (a message to the Rudolf OS desktop, which stores them in its database, mirrored
     and backed up by rudolfd); in a plain browser, the browser's storage when it may be used; always export and
     import as a file.
   - Pausing: the window hidden or minimised, the desktop locked or the screen saver on (the desktop says so), focus
     elsewhere; RG.onPause / RG.onResume.
   - Settings from the desktop: dark theme, reduce flashing, and Rudolf OS's language (RG.lang / RG.locale, null
     unless the person lets Rudolf OS share it with apps).
   - A fixed time step (RG.loop): 60 updates a second whatever the screen's rate, so games are deterministic.
   - (1.3.0) Games on the local network (RG.lan): Rudolf OS's duel service (1.6.1), a relay for two players' games on
     one network. RG.lan.host({ver}) starts it on this computer for one match (-> {url, code}: a WebSocket address the
     game joins, and the room's code), RG.lan.find() lists those hosted on the network (mDNS: -> {games: [{name, url,
     code, ver}]}), RG.lan.stop() stops this computer's. Each resolves to null outside Rudolf OS (or a desktop without
     the service), or {error} if the desktop refused.
   The page runs sandboxed (no storage of its own, no same-origin access): everything goes through messages.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const RG = window.RG = {version: '1.3.0', id: '', paused: false, lastInput: 'mouse'};
const Q = new URLSearchParams(location.search);
const mm = q => { try { return matchMedia(q).matches } catch (e) { return false } };
RG.dark = Q.get('theme') == 'dark' || (Q.get('theme') != 'light' && mm('(prefers-color-scheme: dark)'));
RG.reduceFlash = Q.get('flash') == 'reduce' || mm('(prefers-reduced-motion: reduce)');
/* Rudolf OS's language ('de') and locale ('de-DE'): null outside the desktop, or while it isn't shared with apps */
RG.lang = null; RG.locale = null;
const takeLang = m => { RG.lang = typeof m.lang == 'string' && /^[a-z]{2,3}$/.test(m.lang) ? m.lang : null; RG.locale = RG.lang && typeof m.locale == 'string' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(m.locale) ? m.locale : null };
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
		takeLang(m);   /* (no lang: the person stopped sharing it) */
		emit('settings', RG);
	}
});

/* ---------- saves: one JSON value per game ----------
   (Ember Reach 0.5.5) a game may keep more than one: RG.load(slot) / RG.save(v, slot), a slot being a short name
   (a-z, 0-9, -). Each slot is a value of its own, up to 256 KB, kept by the desktop under the game id "<id>-<slot>"
   (the desktop takes any id of a-z, 0-9 and -, up to 40), and in the browser under its own localStorage key.
   Without a slot, the game's one value as before. */
const MAXSAVE = 256 * 1024;
const SLOT = /^[a-z0-9][a-z0-9-]{0,19}$/;
const gid = slot => slot === undefined || slot === null || slot === '' ? RG.id : RG.id + '-' + slot;
const slotOk = slot => slot === undefined || slot === null || slot === '' || (typeof slot == 'string' && SLOT.test(slot) && gid(slot).length <= 40);
const cache = new Map(); const lsKey = g => 'rudolf-game:' + g;
function lsGet(g) { try { const s = localStorage.getItem(lsKey(g)); return s ? JSON.parse(s) : undefined } catch (e) { return undefined } }
function lsSet(g, v) { try { if (v === null) localStorage.removeItem(lsKey(g)); else localStorage.setItem(lsKey(g), JSON.stringify(v)); return true } catch (e) { return false } }
/* the game's saved value (undefined when there is none) */
RG.load = async function (slot) {
	if (!slotOk(slot)) throw new Error('bad save slot');
	const g = gid(slot);
	if (cache.has(g)) return clone(cache.get(g));
	const r = await ask('load', {game: g});
	let v = r && r.ok ? r.data : undefined;
	if (v === undefined || v === null) v = lsGet(g);
	v = v === null ? undefined : v; cache.set(g, v);
	return clone(v);
};
/* keeps v (anything JSON can hold, up to 256 KB; null clears the slot); true when the desktop or the browser kept it */
RG.save = async function (v, slot) {
	if (!slotOk(slot)) throw new Error('bad save slot');
	const g = gid(slot), s = JSON.stringify(v === undefined ? null : v);
	if (s.length > MAXSAVE) throw new Error('save too large');
	const d = JSON.parse(s); cache.set(g, d === null ? undefined : d);
	const r = await ask('save', {game: g, data: d});
	const ls = lsSet(g, d);
	return !!(r && r.ok) || ls;
};
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
/* the save as a file the person keeps (Downloads); (0.5.5) with slots: the game's value and each slot named */
RG.exportSave = async function (slots) {
	const v = await RG.load(), out = {rudolfGame: RG.id, version: 1, saved: new Date().toISOString(), data: v === undefined ? null : v};
	if (Array.isArray(slots)) { out.slots = {}; for (const k of slots.filter(slotOk).slice(0, 32)) { const x = await RG.load(k); out.slots[k] = x === undefined ? null : x } }
	const blob = new Blob([JSON.stringify(out, null, 1)], {type: 'application/json'});
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
	const slots = /"slots"\s*:/.test(t);   /* (a file with slots holds several saves) */
	if (t.length > MAXSAVE * (slots ? 34 : 2)) throw new Error('That file is too large to be a save.');
	let j; try { j = JSON.parse(t) } catch (e) { throw new Error('That file is not a save.') }
	if (!j || j.rudolfGame !== RG.id) throw new Error('That file is not a save of this game.');
	const S = j.slots && typeof j.slots == 'object' && !Array.isArray(j.slots) ? Object.entries(j.slots).filter(([k]) => k && slotOk(k)).slice(0, 32) : [];
	for (const [k, v] of S) await RG.save(v, k);
	await RG.save(j.data); return clone(j.data);
};

/* ---------- (1.3.0) the local network: Rudolf OS's duel service ---------- */
const lanErr = r => r ? {error: typeof r.error == 'string' ? r.error.slice(0, 200) : 'refused'} : null;
const wsUrl = u => typeof u == 'string' && /^wss?:\/\/[^\s/?#]+\/?[^\s]*$/.test(u) && u.length < 200;
const codeOk = c => typeof c == 'string' && /^[A-Z0-9]{4,8}$/.test(c);
RG.lan = {
	host: async o => { const r = await ask('lanHost', {ver: String((o && o.ver) || '').slice(0, 20)}, 15000); return r && r.ok && wsUrl(r.url) ? {url: r.url, code: codeOk(r.code) ? r.code : null} : lanErr(r) },
	find: async () => { const r = await ask('lanFind', {}, 10000); if (!r || !r.ok) return lanErr(r);
		return {games: (Array.isArray(r.games) ? r.games : []).filter(g => g && wsUrl(g.url) && codeOk(g.code)).slice(0, 32).map(g => ({name: String(g.name || 'a computer').slice(0, 64), url: g.url, code: g.code, ver: String(g.ver || '').slice(0, 20)}))} },
	stop: async () => { const r = await ask('lanStop', {}, 5000); return r && r.ok ? {} : lanErr(r) }
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
let binds = {}; const keys = new Set(), pads = new Set(), edge = new Set(), mice = new Set(), wheels = new Set();
RG.bind = function (map) { binds = {}; for (const a in map) binds[a] = map[a].slice() };
RG.bindings = () => JSON.parse(JSON.stringify(binds));
/* remapping: one more key or button for an action (or in place of the others, with only) */
RG.rebind = (a, code, only) => { binds[a] = only ? [code] : (binds[a] || []).filter(c => c != code).concat(code) };
const active = c => keys.has(c) || pads.has(c) || mice.has(c) || wheels.has(c);
RG.down = a => (binds[a] || []).some(active);
/* true once per press (until RG.frame) */
RG.pressed = a => (binds[a] || []).some(c => edge.has(c));
RG.frame = () => { edge.clear(); wheels.clear() };
/* 1.2.0: mouse buttons and the wheel as bindable inputs. The game feeds them from its own canvas's events (so a click
   on a menu or a button never fires): RG.mouse(e.button, true or false) from mousedown and mouseup ('mouse:0' left,
   'mouse:1' middle, 'mouse:2' right, 'mouse:3' and 'mouse:4' the side buttons); RG.wheel(e.deltaY) from wheel
   ('wheel:up' or 'wheel:down': pressed, and down, for one update) */
RG.mouse = (button, down) => { const c = 'mouse:' + button; if (down) { if (!mice.has(c)) edge.add(c); mice.add(c); RG.lastInput = 'mouse' } else mice.delete(c) };
RG.wheel = dy => { if (!dy) return; const c = dy < 0 ? 'wheel:up' : 'wheel:down'; edge.add(c); wheels.add(c) };
/* whether a code is bound to anything (a game skips the browser's own use of it then: the right-click menu) */
RG.isBound = code => Object.values(binds).some(l => l.includes(code));
const typing = e => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) };
addEventListener('keydown', e => {
	if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
	RG.lastInput = 'keyboard';
	if (!keys.has(e.code)) edge.add(e.code); keys.add(e.code);
	if (Object.values(binds).some(l => l.includes(e.code))) e.preventDefault();
	emit('key', e);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mice.clear() });

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
		takeLang(r);
		document.documentElement.classList.toggle('dark', RG.dark);
	}
	RG.on('settings', () => document.documentElement.classList.toggle('dark', RG.dark));
	if (document.hidden) reason('hidden', true);
	return RG;
};
})();
