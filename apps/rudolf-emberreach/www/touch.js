/* ===== Ember Reach: touch flight (0.5.3; docs/plan-ember-reach.md, "Controls" and M6's phones).
   On-screen controls for a touch screen, laid out for phones (from about 360 px wide, portrait and landscape) and
   tablets, every tap target at least 44 px:
   - the stick (pitch and roll) bottom left, the YAW slider under it (back to the middle when let go);
   - the throttle (a tall slider: it stays where it's left) bottom right, the VERT slider beside it (the vertical
     thrusters: back to the middle when let go);
   - FIRE (the primary guns) and FIRE 2 (the secondary) by the throttle, MSL (missile, or scan in Analysis mode);
   - buttons: TARGET (the target nearest the crosshair), DOCK (docking request), CRUISE, GEAR, FA, MENU (the radial menu,
     tapped open and its item tapped), MAP and II (pause);
   - a drag anywhere else looks around (the view eases back when let go).
   Several fingers at once (fly and fire together). Settings (kept in the save's settings, `touch`): shown (Auto: on a
   touch screen, hidden again while a keyboard, mouse or gamepad is used; On; Off), size, left-handed (mirrored),
   opacity and sensitivity.
   play.js feeds it pointer events and reads the controls; hud.js calls draw(). Pure but for draw (a 2D context).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
const MIN = 44;   /* the smallest tap target, px */
const DEFAULTS = () => ({show: 'auto', size: 100, left: false, opacity: 70, sens: 100});
const num = (v, lo, hi, d) => typeof v == 'number' && isFinite(v) ? clamp(v, lo, hi) : d;
function sanitise(x) {
	const D = DEFAULTS(); if (!x || typeof x != 'object') return D;
	return {show: ['auto', 'on', 'off'].includes(x.show) ? x.show : D.show, size: num(x.size, 75, 150, D.size), left: typeof x.left == 'boolean' ? x.left : D.left,
		opacity: num(x.opacity, 20, 100, D.opacity), sens: num(x.sens, 25, 300, D.sens)};
}
/* shown? 'on' always; 'off' never; 'auto' while touch is what's in use (auto: play.js's own flag, set by the last input) */
const shown = (S, auto) => S.show == 'on' || (S.show == 'auto' && !!auto);

/* the buttons: [act, label] */
const BUTTONS = {fire: 'FIRE', fire2: 'FIRE 2', missile: 'MSL', target: 'TARGET', dock: 'DOCK', cruise: 'CRUISE', gear: 'GEAR', fa: 'FA', radial: 'MENU', map: 'MAP', pause: 'II'};
const rect = (x, y, w, h, extra) => Object.assign({x, y, w, h}, extra || {});
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/* every control's box (the stick's as its square; a round button's as its square) */
function boxes(U) {
	const out = [rect(U.stick.x - U.stick.r, U.stick.y - U.stick.r, 2 * U.stick.r, 2 * U.stick.r, {id: 'stick'}), Object.assign({id: 'yaw'}, U.yaw), Object.assign({id: 'thr'}, U.thr), Object.assign({id: 'vert'}, U.vert)];
	for (const b of U.buttons) out.push(Object.assign({id: b.act}, b));
	return out;
}
/* the layout for a screen W × H (CSS px). o: {size (%), left (mirrored), inset: {l, r, t, b} (the safe area)} */
function layout(W, H, o) {
	o = o || {};
	const ins = Object.assign({l: 0, r: 0, t: 0, b: 0}, o.inset || {});
	let k = (o.size || 100) / 100, U = null;
	/* (too big for the screen: smaller until it fits, never under the tap targets' size) */
	for (let i = 0; i < 12; i++) { U = build(W, H, k, ins); if (fits(U, W, H) || k <= 0.6) break; k *= 0.92 }
	if (o.left) mirror(U, W);
	U.k = k; U.W = W; U.H = H; U.left = !!o.left;
	return U;
}
function build(W, H, k, ins) {
	const land = W >= H, m = 12, L = m + ins.l, Rt = W - m - ins.r, B = H - m - ins.b, T0 = m + ins.t;
	const bs = Math.max(MIN, Math.round(46 * k)), bw = Math.max(MIN, Math.round((land ? 62 : 56) * k)), gap = Math.max(6, Math.round(8 * k));
	const r = Math.round(clamp((land ? H : W) * 0.15, 46, 84) * k);
	/* left: the stick, and the yaw slider under it */
	const yawH = Math.max(MIN, Math.round(40 * k)), yaw = rect(L, B - yawH, Math.max(2 * r + 24, 120), yawH);
	const stick = {x: yaw.x + yaw.w / 2, y: yaw.y - gap - r - 6, r};
	/* right: the throttle, and the vertical thrusters beside it */
	const sw = Math.max(MIN, Math.round(48 * k)), sh = Math.round(clamp(H * (land ? 0.42 : 0.24), 130, 210) * k);
	const thr = rect(Rt - sw, B - sh, sw, sh), vert = rect(thr.x - gap - sw, B - sh, sw, sh);
	/* the triggers: FIRE big, FIRE 2 above it, MSL beside FIRE 2 */
	const fr = Math.max(MIN / 2 + 4, Math.round(36 * k)), f2 = Math.max(MIN / 2 + 2, Math.round(28 * k));
	const fire = {act: 'fire', round: true, r: fr, x: vert.x - gap * 2 - 2 * fr, y: B - 2 * fr - 4, w: 2 * fr, h: 2 * fr};
	const fire2 = {act: 'fire2', round: true, r: f2, x: fire.x + fr - f2, y: fire.y - gap - 2 * f2, w: 2 * f2, h: 2 * f2};
	const msl = {act: 'missile', x: fire.x - gap - bw, y: fire2.y + f2 - bs / 2, w: bw, h: bs};
	const buttons = [fire, fire2, msl];
	const btn = (act, x, y) => { const b = {act, x, y, w: bw, h: bs}; buttons.push(b); return b };
	/* the flight buttons: a block of two columns above the throttle (landscape), or a row over everything (portrait) */
	const grid = ['target', 'dock', 'cruise', 'gear'];
	if (land) grid.forEach((a, i) => btn(a, Rt - (2 - i % 2) * bw - (1 - i % 2) * gap, thr.y - gap - (2 - Math.floor(i / 2)) * (bs + gap) + gap));
	else { const y = Math.min(stick.y - r, fire2.y, thr.y) - gap * 2 - bs, n = grid.length + 2, w = Math.min(bw, Math.floor((Rt - L - (n - 1) * gap) / n)), ww = Math.max(MIN, w);
		[...grid, 'fa', 'radial'].forEach((a, i) => { const b = btn(a, Rt - (n - i) * ww - (n - 1 - i) * gap, y); b.w = ww }) }
	/* MAP and II in the top right corner (and, landscape, FA and MENU beside them) */
	(land ? ['fa', 'radial', 'map', 'pause'] : ['map', 'pause']).forEach((a, i, L0) => btn(a, Rt - (L0.length - i) * bw - (L0.length - 1 - i) * gap, T0));
	for (const b of buttons) b.label = BUTTONS[b.act];
	const U = {stick, yaw, thr, vert, buttons, land, gap};
	/* what the HUD keeps clear of: the top of the controls on each side (its panels go above), px from the top */
	const top = bx => Math.min(...bx.map(b => b.y));
	const lefts = boxes(U).filter(b => b.x + b.w / 2 < W / 2 && b.y > H / 3), rights = boxes(U).filter(b => b.x + b.w / 2 >= W / 2 && b.y > H / 3);
	U.top = {left: lefts.length ? top(lefts) : H, right: rights.length ? top(rights) : H, all: Math.min(lefts.length ? top(lefts) : H, rights.length ? top(rights) : H)};
	return U;
}
/* nothing overlaps and nothing is off the screen */
function fits(U, W, H) { const B = boxes(U); return B.every((a, i) => a.x >= 0 && a.y >= 0 && a.x + a.w <= W && a.y + a.h <= H && B.every((b, j) => j <= i || !overlap(a, b))) }
function mirror(U, W) {
	const fx = b => { b.x = W - b.x - b.w };
	U.stick.x = W - U.stick.x; fx(U.yaw); fx(U.thr); fx(U.vert); U.buttons.forEach(fx);
	const t = U.top.left; U.top.left = U.top.right; U.top.right = t;
}

/* ---- the state: what each finger holds ---- */
function create() { return {stick: null, dx: 0, dy: 0, yawId: null, yaw: 0, thrId: null, thr: null, vertId: null, vert: 0, fire: null, fire2: null, look: null, lookYaw: 0, lookPitch: 0, radial: null} }
const inside = (b, p, slop) => p.x >= b.x - slop && p.x <= b.x + b.w + slop && p.y >= b.y - slop && p.y <= b.y + b.h + slop;
const hitButton = (U, p) => U.buttons.find(b => b.round ? Math.hypot(p.x - b.x - b.r, p.y - b.y - b.r) <= b.r + 6 : inside(b, p, 4));
/* a finger down at p (id: its pointer): what it takes. Returns {act} for a button tapped (FIRE and FIRE 2 are held:
   'fire', 'fire2'), {grab} for a stick or slider, {look} for the view */
function down(T, U, p, id) {
	const b = hitButton(U, p);
	if (b) { if (b.act == 'fire') T.fire = id; if (b.act == 'fire2') T.fire2 = id; return {act: b.act} }
	if (!T.stick && Math.hypot(p.x - U.stick.x, p.y - U.stick.y) < U.stick.r * 1.35) { T.stick = {id}; stickMove(T, U, p); return {grab: 'stick'} }
	if (T.yawId == null && inside(U.yaw, p, 6)) { T.yawId = id; yawMove(T, U, p); return {grab: 'yaw'} }
	if (T.vertId == null && inside(U.vert, p, 4)) { T.vertId = id; vertMove(T, U, p); return {grab: 'vert'} }
	if (T.thrId == null && inside(U.thr, p, 8)) { T.thrId = id; thrMove(T, U, p); return {grab: 'thr'} }
	if (!T.look) { T.look = {id, x: p.x, y: p.y}; return {look: true} }
	return {};
}
function move(T, U, p, id, sens) {
	if (T.stick && T.stick.id == id) stickMove(T, U, p);
	if (T.yawId == id) yawMove(T, U, p);
	if (T.vertId == id) vertMove(T, U, p);
	if (T.thrId == id) thrMove(T, U, p);
	if (T.look && T.look.id == id) {
		const k = 0.006 * (sens || 100) / 100;
		T.lookYaw = clamp(T.lookYaw + (p.x - T.look.x) * k, -2.6, 2.6); T.lookPitch = clamp(T.lookPitch + (p.y - T.look.y) * k, -1.4, 1.4);
		T.look.x = p.x; T.look.y = p.y;
	}
}
function up(T, id) {
	if (T.fire == id) T.fire = null;
	if (T.fire2 == id) T.fire2 = null;
	if (T.stick && T.stick.id == id) { T.stick = null; T.dx = T.dy = 0 }
	if (T.yawId == id) { T.yawId = null; T.yaw = 0 }
	if (T.vertId == id) { T.vertId = null; T.vert = 0 }
	if (T.thrId == id) T.thrId = null;
	if (T.look && T.look.id == id) T.look = null;
}
/* every finger off (the page hidden, a screen opened over the view) */
function release(T) { Object.assign(T, {stick: null, dx: 0, dy: 0, yawId: null, yaw: 0, thrId: null, vertId: null, vert: 0, fire: null, fire2: null, look: null}) }
function stickMove(T, U, p) { let dx = (p.x - U.stick.x) / U.stick.r, dy = (p.y - U.stick.y) / U.stick.r; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l } T.dx = dx; T.dy = dy }
function yawMove(T, U, p) { T.yaw = clamp(2 * (p.x - U.yaw.x) / U.yaw.w - 1, -1, 1) }
function vertMove(T, U, p) { T.vert = clamp(1 - 2 * (p.y - U.vert.y) / U.vert.h, -1, 1) }
function thrMove(T, U, p) { T.thr = clamp(1 - (p.y - U.thr.y) / U.thr.h, 0, 1) }
/* the view eases back once no finger holds it */
function step(T, dt) { if (!T.look) { const e = Math.exp(-dt * 5); T.lookYaw *= e; T.lookPitch *= e; if (Math.abs(T.lookYaw) < 1e-3) T.lookYaw = 0; if (Math.abs(T.lookPitch) < 1e-3) T.lookPitch = 0 } }
/* the controls' inputs: a small dead zone in the middle, then the sensitivity (%) */
function axes(T, sens) {
	const k = (sens || 100) / 100, dz = v => Math.abs(v) < 0.06 ? 0 : clamp((v - Math.sign(v) * 0.06) / 0.94 * k, -1, 1);
	return {pitch: T.stick ? dz(T.dy) : 0, roll: T.stick ? -dz(T.dx) : 0, yaw: T.yawId != null ? dz(T.yaw) : 0, vert: T.vert || 0};
}
/* the view's turn as a quaternion ([w, x, y, z]: a yaw round the ship's up, then a pitch round its right), times q */
function qmul(a, b) {
	return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
		a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
}
function lookQ(q, T) {
	if (!T.lookYaw && !T.lookPitch) return q;
	const y = T.lookYaw / 2, x = T.lookPitch / 2;
	return qmul(q, qmul([Math.cos(y), 0, Math.sin(y), 0], [Math.cos(x), Math.sin(x), 0, 0]));
}

/* ---- the radial menu by touch: its items as a sheet of buttons in the middle of the screen, tapped ---- */
function radialRects(W, H, n) {
	const cols = W >= 700 ? 3 : 2, w = Math.min(200, Math.floor((W - 32 - (cols - 1) * 8) / cols)), h = 48, rows = Math.ceil(n / cols);
	const tw = cols * w + (cols - 1) * 8, th = rows * h + (rows - 1) * 8 + 34, x0 = Math.round((W - tw) / 2), y0 = Math.round(Math.max(16, (H - th) / 2)) + 34;
	return Array.from({length: n}, (_, i) => rect(x0 + (i % cols) * (w + 8), y0 + Math.floor(i / cols) * (h + 8), w, h));
}
const radialHit = (rects, p) => rects.findIndex(r => inside(r, p, 0));

/* ---- drawing (hud.js, unscaled: where the fingers land). U: the layout; h: the HUD's data (throttle, fa, cruise,
   gear, locked, look; touchState: T); C: the HUD's colours; text(ctx, s, x, y, o): the HUD's text ---- */
function draw(ctx, U, h, C, text) {
	const T = h.touchState || {}, on = h.touchOn || {};
	ctx.save(); ctx.globalAlpha = clamp((h.touchOpacity || 70) / 100, 0.2, 1);
	const line = 'rgba(232,237,246,0.45)', fill = 'rgba(8,14,26,0.55)';
	/* the stick */
	const S = U.stick; ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 2;
	ctx.beginPath(); ctx.arc(S.x, S.y, S.r, 0, 7); ctx.fill(); ctx.stroke();
	ctx.strokeStyle = 'rgba(232,237,246,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(S.x - S.r * 0.6, S.y); ctx.lineTo(S.x + S.r * 0.6, S.y); ctx.moveTo(S.x, S.y - S.r * 0.6); ctx.lineTo(S.x, S.y + S.r * 0.6); ctx.stroke();
	ctx.fillStyle = T.stick ? 'rgba(108,201,232,0.75)' : 'rgba(108,201,232,0.45)'; ctx.beginPath(); ctx.arc(S.x + (T.dx || 0) * S.r, S.y + (T.dy || 0) * S.r, Math.max(22, S.r * 0.36), 0, 7); ctx.fill();
	/* the yaw slider */
	const Y = U.yaw, ym = Y.x + Y.w / 2; ctx.fillStyle = fill; ctx.fillRect(Y.x, Y.y, Y.w, Y.h); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(Y.x + 0.5, Y.y + 0.5, Y.w - 1, Y.h - 1);
	ctx.beginPath(); ctx.moveTo(ym, Y.y); ctx.lineTo(ym, Y.y + Y.h); ctx.stroke();
	ctx.fillStyle = 'rgba(108,201,232,0.6)'; const yv = T.yaw || 0; ctx.fillRect(Math.min(ym, ym + yv * Y.w / 2), Y.y + 4, Math.abs(yv) * Y.w / 2, Y.h - 8);
	text(ctx, '◀ YAW ▶', ym, Y.y + Y.h / 2 + 4, {align: 'center', size: 11, weight: 600, col: C.muted});
	/* the throttle: its level (the throttle now, whatever set it), and the vertical thrusters */
	const R = U.thr; ctx.fillStyle = fill; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeStyle = line; ctx.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
	const tv = clamp(h.throttle || 0, -1, 1), z0 = R.y + R.h;
	ctx.fillStyle = tv >= 0 ? 'rgba(242,163,58,0.65)' : 'rgba(108,201,232,0.55)'; ctx.fillRect(R.x + 3, tv >= 0 ? z0 - R.h * tv : z0 - 3, R.w - 6, Math.max(3, R.h * Math.abs(tv)));
	text(ctx, 'THR', R.x + R.w / 2, R.y - 6, {align: 'center', size: 10, weight: 600, col: C.muted});
	text(ctx, Math.round(tv * 100) + '%', R.x + R.w / 2, R.y + 16, {align: 'center', size: 10, mono: true, col: C.text});
	const V = U.vert, mid = V.y + V.h / 2; ctx.fillStyle = fill; ctx.fillRect(V.x, V.y, V.w, V.h); ctx.strokeStyle = line; ctx.strokeRect(V.x + 0.5, V.y + 0.5, V.w - 1, V.h - 1); ctx.beginPath(); ctx.moveTo(V.x, mid); ctx.lineTo(V.x + V.w, mid); ctx.stroke();
	ctx.fillStyle = 'rgba(108,201,232,0.6)'; const vv = T.vert || 0; ctx.fillRect(V.x + 3, Math.min(mid, mid - vv * V.h / 2), V.w - 6, Math.abs(vv) * V.h / 2);
	text(ctx, 'VERT', V.x + V.w / 2, V.y - 6, {align: 'center', size: 10, weight: 600, col: C.muted});
	/* the buttons, lit when what they switch is on (or held) */
	for (const b of U.buttons) {
		const lit = b.act == 'fire' ? T.fire != null : b.act == 'fire2' ? T.fire2 != null : !!on[b.act], col = b.act.startsWith('fire') ? C.red : C.cyan;
		ctx.fillStyle = lit ? 'rgba(108,201,232,0.25)' : fill; ctx.strokeStyle = lit ? col : line; ctx.lineWidth = lit ? 2 : 1.5;
		if (b.round) { ctx.beginPath(); ctx.arc(b.x + b.r, b.y + b.r, b.r, 0, 7); ctx.fill(); ctx.stroke() }
		else { ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1) }
		text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 4, {align: 'center', size: b.w < 52 ? 11 : 12, weight: 700, col: lit ? C.text : b.act.startsWith('fire') ? '#ffb3b5' : C.text});
	}
	ctx.restore();
}
/* the radial menu's sheet (h.radial with rects) */
function drawRadial(ctx, W, H, R, C, text, title) {
	ctx.save();
	ctx.fillStyle = 'rgba(4,8,16,0.72)'; ctx.fillRect(0, 0, W, H);
	text(ctx, title, W / 2, R.rects[0].y - 14, {align: 'center', size: 12, mono: true, col: C.muted});
	R.items.forEach((it, i) => {
		const r = R.rects[i]; ctx.fillStyle = C.panel; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = it.on ? C.cyan : C.line; ctx.lineWidth = it.on ? 2 : 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
		text(ctx, it.name, r.x + r.w / 2, r.y + (it.on != null ? 20 : 29), {align: 'center', size: 13, weight: 600, col: C.text});
		if (it.on != null) text(ctx, it.onText, r.x + r.w / 2, r.y + 37, {align: 'center', size: 10, mono: true, col: it.on ? C.green : C.muted});
	});
	ctx.restore();
}

const EmberTouch = {MIN, DEFAULTS, sanitise, shown, BUTTONS, layout, boxes, fits, overlap, create, down, move, up, release, step, axes, lookQ, radialRects, radialHit, draw, drawRadial};
if (typeof module != 'undefined') module.exports = EmberTouch; else root.EmberTouch = EmberTouch;
})(typeof window != 'undefined' ? window : globalThis);
