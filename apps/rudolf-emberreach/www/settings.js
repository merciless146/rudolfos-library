/* ===== Ember Reach: settings =====
   Three pages, opened from the pause screen:
   - Graphics, audio and HUD: quality, resolution, field of view, glow, the frame rate; master, engines and ambience,
     effects, alerts; the HUD's size and opacity, how many messages and for how long, the scanner and markers.
   - Controls: every action's two keys and gamepad button, rebound by pressing what you want (a key taken from
     another action is moved, and the menu says from which); mouse sensitivity and pitch, gamepad pitch and dead
     zone; a reset.
   - Language and accessibility: the languages Rudolf OS offers (i18n.js); reduced flashing (or as Rudolf OS
     says), reduced motion, a colour-blind palette, a high-contrast HUD, and captions for the sounds.
   The settings are kept in the save (save.js keeps them through a new game) and sanitised there with sanitise().
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const I = root.EmberI18n || (typeof module != 'undefined' ? require('./i18n.js') : null), T = (s, v) => I ? I.T(s, v) : s;

const DEFAULTS = () => ({
	graphics: {quality: 'high', res: 100, fov: 70, glow: true, fps: false, aa: 'auto', autoRes: true},
	audio: {on: true, master: 80, engines: 80, effects: 80, alerts: 100},
	hud: {size: 100, opacity: 100, messages: 3, msgTime: 8, scanner: true, prograde: true, lead: true},
	/* the control scheme (Simple: the core keys, the rest in the radial menu, and the assists on; Full: every key) and
	   the assists, each on or off whatever the scheme */
	controls: {keys: {}, mouseSens: 100, invertMouse: false, invertPad: false, deadzone: 12, scheme: 'simple', autoGear: true, autoLights: true, landAssist: true, autoRoute: true},
	lang: 'os',   /* follow Rudolf OS (or the browser) */
	a11y: {flash: 'os', motion: false, palette: 'off', contrast: false, captions: false}});

/* the actions on the Controls page, in groups (the debug keys aren't listed) */
const GROUPS = [
	['Flight', ['pitchDown', 'pitchUp', 'rollLeft', 'rollRight', 'yawLeft', 'yawRight', 'faster', 'slower', 'stop', 'strafeL', 'strafeR', 'strafeU', 'strafeD', 'fa', 'gear']],
	['Combat and analysis', ['mode', 'fire', 'missile', 'flare', 'target', 'hostile']],
	['Navigation', ['cruise', 'jump', 'dock', 'map', 'route', 'home']],
	['Ship', ['hatch', 'lights', 'nightVision', 'systems']],
	['Interface', ['radial', 'view', 'mouse', 'help', 'pause']]];
/* the Simple scheme lists only these; the rest are in the radial menu (~), and still work if bound */
const SIMPLE = ['pitchDown', 'pitchUp', 'rollLeft', 'rollRight', 'yawLeft', 'yawRight', 'faster', 'slower', 'stop', 'strafeL', 'strafeR', 'strafeU', 'strafeD',
	'mode', 'fire', 'missile', 'target', 'hostile', 'cruise', 'jump', 'dock', 'map', 'route', 'radial', 'view', 'help', 'pause'];
/* picking a scheme sets the assists to its defaults (each can be changed after) */
function applyScheme(S, scheme) { const on = scheme == 'simple'; Object.assign(S.controls, {scheme, autoGear: true, autoLights: on, landAssist: on, autoRoute: on}) }
const ACTION = {pitchDown: 'Pitch down', pitchUp: 'Pitch up', rollLeft: 'Roll left', rollRight: 'Roll right', yawLeft: 'Yaw left', yawRight: 'Yaw right', faster: 'Throttle up', slower: 'Throttle down', stop: 'Throttle to zero',
	strafeL: 'Strafe left', strafeR: 'Strafe right', strafeU: 'Strafe up', strafeD: 'Strafe down', fa: 'Flight assist', gear: 'Landing gear', lights: 'Spotlights', nightVision: 'Night vision', mode: 'Combat / analysis mode', radial: 'Radial menu', fire: 'Fire', missile: 'Missile', flare: 'Flare', target: 'Next target', hostile: 'Nearest hostile',
	cruise: 'Cruise', jump: 'Jump', dock: 'Request docking', map: 'Star map', route: 'Plot route', home: 'Map: back to you', hatch: 'Cargo hatch', systems: 'Internal systems', view: 'Camera view', mouse: 'Mouse flight', help: 'Controls help', pause: 'Pause'};

/* how a key or gamepad button reads */
const PAD = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L-stick', 'R-stick', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →'];
const NAMED = {ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl', AltLeft: 'L Alt', AltRight: 'R Alt',
	Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Backquote: '`', Equal: '=', Minus: '-', Escape: 'Esc', Backspace: 'Backspace', Enter: 'Enter', Tab: 'Tab',
	NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadEnter: 'Num Enter', NumpadMultiply: 'Num ×', NumpadDivide: 'Num ÷', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Insert: 'Ins', Delete: 'Del', CapsLock: 'Caps'};
function keyName(c) {
	if (!c) return '—';
	if (c.startsWith('pad:')) { const n = c.slice(4); return '🎮 ' + (/^\d+$/.test(n) ? PAD[+n] || 'B' + n : n.replace('axis', 'Axis ')) }
	if (NAMED[c]) return NAMED[c];
	if (/^Key[A-Z]$/.test(c)) return c.slice(3);
	if (/^Digit\d$/.test(c)) return c.slice(5);
	if (/^Numpad\d$/.test(c)) return 'Num ' + c.slice(6);
	return c;
}

/* ---------- keeping it sane ---------- */
const num = (v, lo, hi, d) => typeof v == 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const bool = (v, d) => typeof v == 'boolean' ? v : d;
const one = (v, list, d) => list.includes(v) ? v : d;
const CODE = /^(pad:(\d{1,2}|axis\d[+-])|[A-Za-z0-9]{1,24})$/;
/* old saves kept {quality, sound}: they carry over */
function sanitise(x, actions, langs) {
	const D = DEFAULTS(); if (!x || typeof x != 'object') return D;
	const g = x.graphics || {}, a = x.audio || {}, h = x.hud || {}, c = x.controls || {}, y = x.a11y || {};
	const keys = {};
	if (c.keys && typeof c.keys == 'object') for (const [k, v] of Object.entries(c.keys)) if ((!actions || actions.includes(k)) && Array.isArray(v)) keys[k] = v.filter(z => typeof z == 'string' && CODE.test(z)).slice(0, 3);
	return {
		graphics: {quality: one(g.quality || x.quality, ['high', 'low'], 'high'), res: num(g.res, 50, 100, 100), fov: num(g.fov, 50, 100, 70), glow: bool(g.glow, true), fps: bool(g.fps, false), aa: one(g.aa, ['auto', 'on', 'off'], 'auto'), autoRes: bool(g.autoRes, true)},
		audio: {on: bool(a.on, x.sound === undefined ? true : x.sound !== false), master: num(a.master, 0, 100, 80), engines: num(a.engines, 0, 100, 80), effects: num(a.effects, 0, 100, 80), alerts: num(a.alerts, 0, 100, 100)},
		hud: {size: num(h.size, 75, 150, 100), opacity: num(h.opacity, 30, 100, 100), messages: num(h.messages, 0, 8, 3), msgTime: num(h.msgTime, 3, 20, 8), scanner: bool(h.scanner, true), prograde: bool(h.prograde, true), lead: bool(h.lead, true)},
		controls: (() => {
			/* (a player from before the schemes keeps Full, the keys they know; a new one starts Simple) */
			const scheme = one(c.scheme, ['simple', 'full'], x.controls ? 'full' : 'simple'), on = scheme == 'simple';
			return {keys, mouseSens: num(c.mouseSens, 25, 300, 100), invertMouse: bool(c.invertMouse, false), invertPad: bool(c.invertPad, false), deadzone: num(c.deadzone, 0, 40, 12),
				scheme, autoGear: bool(c.autoGear, true), autoLights: bool(c.autoLights, on), landAssist: bool(c.landAssist, on), autoRoute: bool(c.autoRoute, on)};
		})(),
		lang: x.lang == 'os' || (langs || ['en']).includes(x.lang) ? x.lang : D.lang,
		a11y: {flash: one(y.flash, ['os', 'on', 'off'], 'os'), motion: bool(y.motion, false), palette: one(y.palette, ['off', 'rg', 'by'], 'off'), contrast: bool(y.contrast, false), captions: bool(y.captions, false)}};
}
/* the bindings in force: the defaults, with the player's changes over them */
function bindings(defaults, S) { const out = {}; for (const a in defaults) out[a] = (S.controls.keys[a] || defaults[a]).slice(); return out }
/* bind a code to an action's slot (0, 1: keys; 2: the gamepad), taking it from any other action that had it */
function rebind(defaults, S, action, slot, code) {
	const B = bindings(defaults, S), took = [];
	for (const a in B) if (a != action && B[a].includes(code)) { B[a] = B[a].filter(z => z != code); took.push(a); S.controls.keys[a] = B[a] }
	const keys = B[action].filter(z => !z.startsWith('pad:')), pads = B[action].filter(z => z.startsWith('pad:'));
	if (slot == 2) { pads.splice(0, 1, ...(code ? [code] : [])) } else { if (code) keys[slot] = code; else keys.splice(slot, 1) }
	S.controls.keys[action] = [...new Set([...keys.filter(Boolean), ...pads])];
	return took;
}

/* ---------- the menu ----------
   open(el, S, env): draws the settings into el (the pause screen's card). env: {defaults (the key map), apply(what),
   close(), langs, osLang() (Rudolf OS's shared language or null), nav (the browser's language)}. apply is told what changed ('graphics', 'audio', 'hud', 'controls', 'lang', 'a11y'). */
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function open(el, S, env) {
	let tab = 0, wait = null, note = '';
	const set = (path, v, quiet) => { const [a, b] = path.split('.'); if (path == 'controls.scheme') applyScheme(S, v); else if (b) S[a][b] = v; else S[a] = v; env.apply(a); if (!quiet) draw() };
	const onOff = (path, v) => '<select data-set="' + path + '"><option value="1"' + (v ? ' selected' : '') + '>' + esc(T('On')) + '</option><option value="0"' + (v ? '' : ' selected') + '>' + esc(T('Off')) + '</option></select>';
	const range = (path, v, lo, hi, step, unit) => '<span class="st-r"><input type="range" data-set="' + path + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + v + '"><output>' + v + (unit || '') + '</output></span>';
	const pick = (path, v, opts) => '<select data-set="' + path + '">' + opts.map(([k, l]) => '<option value="' + k + '"' + (k == v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
	const row = (label, ctl, id) => '<div class="st-row"' + (id ? ' id="' + id + '"' : '') + '><label>' + esc(T(label)) + '</label>' + ctl + '</div>';
	const head = t => '<h3>' + esc(T(t)) + '</h3>';
	function page0() {
		const g = S.graphics, a = S.audio, h = S.hud;
		return head('Graphics') + row('Quality', pick('graphics.quality', g.quality, [['high', T('High')], ['low', T('Low')]])) + row('Resolution', range('graphics.res', g.res, 50, 100, 5, '%')) + row('Field of view', range('graphics.fov', g.fov, 50, 100, 1, '°'))
			+ row('Automatic resolution', onOff('graphics.autoRes', g.autoRes)) + row('Antialiasing', pick('graphics.aa', g.aa, [['auto', T('Auto')], ['on', T('On')], ['off', T('Off')]])) + '<p class="st-note">' + esc(T('Automatic resolution lowers the resolution while the frame rate is under 30, and raises it again when there is room. Antialiasing changes take effect when the game next starts.')) + '</p>'
			+ row('Glow effects', onOff('graphics.glow', g.glow)) + row('Show frame rate', onOff('graphics.fps', g.fps))
			+ head('Audio') + row('Sound', onOff('audio.on', a.on)) + row('Master volume', range('audio.master', a.master, 0, 100, 5, '%')) + row('Engines and ambience', range('audio.engines', a.engines, 0, 100, 5, '%'))
			+ row('Effects', range('audio.effects', a.effects, 0, 100, 5, '%')) + row('Alerts and warnings', range('audio.alerts', a.alerts, 0, 100, 5, '%'))
			+ head('HUD') + row('HUD size', range('hud.size', h.size, 75, 150, 5, '%')) + row('HUD opacity', range('hud.opacity', h.opacity, 30, 100, 5, '%')) + row('Messages shown', range('hud.messages', h.messages, 0, 8, 1))
			+ row('Message time', range('hud.msgTime', h.msgTime, 3, 20, 1, ' s')) + row('Scanner', onOff('hud.scanner', h.scanner)) + row('Velocity marker', onOff('hud.prograde', h.prograde)) + row('Lead marker', onOff('hud.lead', h.lead));
	}
	function page1() {
		const B = bindings(env.defaults, S), c = S.controls, simple = c.scheme == 'simple';
		let out = head('Control scheme') + row('Control scheme', pick('controls.scheme', c.scheme, [['simple', T('Simple')], ['full', T('Full')]]))
			+ '<p class="st-note">' + esc(T(simple ? 'Simple: the core keys only, flight assist always on, and the assists below on. Everything else is in the radial menu (~).' : 'Full: every key, and flight assist yours to switch off.')) + '</p>'
			+ head('Assists') + row('Automatic landing gear', onOff('controls.autoGear', c.autoGear)) + row('Automatic spotlights', onOff('controls.autoLights', c.autoLights))
			+ row('Landing assist', onOff('controls.landAssist', c.landAssist)) + row('Automatic jumps along a route', onOff('controls.autoRoute', c.autoRoute))
			+ head('Keyboard and gamepad') + (wait ? '<p class="st-wait">' + esc(T('Press a key or gamepad button (Esc cancels)')) + '</p>' : '') + (note ? '<p class="st-note">' + esc(note) + '</p>' : '');
		for (const [g, acts] of GROUPS) {
			if (simple && !acts.some(a => SIMPLE.includes(a))) continue;
			out += '<h4>' + esc(T(g)) + '</h4><table class="st-keys"><tr><th></th><th>' + esc(T('Key')) + '</th><th>' + esc(T('Key')) + '</th><th>' + esc(T('Gamepad')) + '</th></tr>';
			for (const a of acts) {
				if (!B[a] || (simple && !SIMPLE.includes(a))) continue;
				const ks = B[a].filter(z => !z.startsWith('pad:')), pd = B[a].find(z => z.startsWith('pad:'));
				const cell = (slot, code) => '<td><button class="st-key' + (wait && wait.a == a && wait.slot == slot ? ' on' : '') + '" data-bind="' + a + '" data-slot="' + slot + '">' + esc(code ? keyName(code) : T('Unbound')) + '</button></td>';
				out += '<tr><td>' + esc(T(ACTION[a])) + '</td>' + cell(0, ks[0]) + cell(1, ks[1]) + cell(2, pd) + '</tr>';
			}
			out += '</table>';
		}
		return out + head('Controls') + row('Mouse sensitivity', range('controls.mouseSens', c.mouseSens, 25, 300, 5, '%')) + row('Invert mouse pitch', onOff('controls.invertMouse', c.invertMouse))
			+ row('Invert gamepad pitch', onOff('controls.invertPad', c.invertPad)) + row('Gamepad dead zone', range('controls.deadzone', c.deadzone, 0, 40, 1, '%'))
			+ '<p><button class="st-reset" data-reset="1">' + esc(T('Reset controls')) + '</button></p>';
	}
	function page2() {
		const y = S.a11y;
		return head('Language') + row('Language', pick('lang', S.lang, [['os', T('Follow Rudolf OS') + (I ? ' · ' + I.nameOf(I.resolve('os', env.osLang && env.osLang(), env.nav)) : '')]].concat((I ? I.LANGS : [['en', 'English']]).map(l => [l[0], l[1]])))) + '<p class="st-note">' + esc(T('The menus, the HUD and the controls are translated. The starport and flight messages are still in English.')) + '</p>'
			+ head('Accessibility') + row('Reduce flashing', pick('a11y.flash', y.flash, [['os', T('Follow Rudolf OS')], ['on', T('On')], ['off', T('Off')]])) + row('Reduce motion', onOff('a11y.motion', y.motion))
			+ row('Colour-blind palette', pick('a11y.palette', y.palette, [['off', T('Off')], ['rg', T('Red–green')], ['by', T('Blue–yellow')]])) + row('High-contrast HUD', onOff('a11y.contrast', y.contrast)) + row('Sound captions', onOff('a11y.captions', y.captions));
	}
	function draw() {
		const tabs = ['Graphics, audio and HUD', 'Controls', 'Language and accessibility'];
		el.innerHTML = '<h1 id="ovT">' + esc(T('Settings')) + '</h1><div class="st-tabs" role="tablist">' + tabs.map((t, i) => '<button role="tab" aria-selected="' + (i == tab) + '" data-tab="' + i + '"' + (i == tab ? ' class="on"' : '') + '>' + esc(T(t)) + '</button>').join('') + '</div><div class="st-page">' + [page0, page1, page2][tab]() + '</div>';
	}
	el.onclick = e => {
		const b = e.target.closest('button'); if (!b) return;
		if (b.dataset.tab) { tab = +b.dataset.tab; wait = null; note = ''; draw(); return }
		if (b.dataset.bind) { wait = {a: b.dataset.bind, slot: +b.dataset.slot}; note = ''; draw(); listen(); return }
		if (b.dataset.reset) { S.controls = DEFAULTS().controls; note = ''; env.apply('controls'); draw() }
	};
	el.oninput = e => { const t = e.target; if (t.type == 'range') { t.nextElementSibling.textContent = t.value + (t.nextElementSibling.textContent.replace(/^[\d.]+/, '')); set(t.dataset.set, +t.value, true) } };
	el.onchange = e => { const t = e.target; if (t.tagName != 'SELECT') return; const v = t.value; set(t.dataset.set, v == '1' ? true : v == '0' ? false : v) };
	/* rebinding: the next key (Esc cancels, Backspace or Delete unbinds) or gamepad button */
	let raf = 0;
	function finish(code) {
		removeEventListener('keydown', onKey, true); cancelAnimationFrame(raf);
		if (code !== undefined && wait) { const took = rebind(env.defaults, S, wait.a, wait.slot, code); note = took.length ? T('Taken from {a}', {a: took.map(a => T(ACTION[a] || a)).join(', ')}) : ''; env.apply('controls') }
		wait = null; draw();
	}
	function onKey(e) { e.preventDefault(); e.stopImmediatePropagation(); if (e.code == 'Escape') return finish(); if ((e.code == 'Backspace' || e.code == 'Delete') && wait.slot < 2) return finish(null); if (wait.slot == 2) return; finish(e.code) }
	function listen() {
		addEventListener('keydown', onKey, true);
		const held = new Set(); let first = true;
		const poll = () => {
			let g = null; try { g = [...(navigator.getGamepads ? navigator.getGamepads() : [])].find(Boolean) } catch (e) {}
			if (g) g.buttons.forEach((b, i) => { const on = b && (b.pressed || b.value > 0.5); if (on && !first && !held.has(i)) { if (wait && wait.slot == 2) return finish('pad:' + i) } on ? held.add(i) : held.delete(i) });
			first = false; if (wait) raf = requestAnimationFrame(poll);
		};
		raf = requestAnimationFrame(poll);
	}
	draw();
	return {redraw: draw};
}

const EmberSettings = {SIMPLE, applyScheme, DEFAULTS, GROUPS, ACTION, keyName, sanitise, bindings, rebind, open};
if (typeof module != 'undefined') module.exports = EmberSettings; else root.EmberSettings = EmberSettings;
})(typeof window != 'undefined' ? window : globalThis);
