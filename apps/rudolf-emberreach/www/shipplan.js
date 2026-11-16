/* ===== Ember Reach: the ship's plan on the outfitting screen (0.4.5) =====
   A 2D drawing of the ship, from the side or from above, on its own hull shape (meshes.js ship: a wedge with the
   nose forward, a ridge on top, fins at the back, pods under the wings), with every module slot where it sits:
   - core modules by what they are: the canopy on top forward, life support under it, the power plant amidships,
     the fuel tank below, the hyperdrive aft, the thrusters at the tail, manoeuvring thrusters out at the wing tips;
   - internal slots along the keel, from forward to aft;
   - hardpoints (external) where the guns are mounted (combat.js mounts: one under the nose, or pairs under the
     wings);
   - utility mounts along the ridge on top.
   Each marker is coloured by its kind, filled when something is fitted, hollow when it's empty, ringed when it's
   the slot picked. Clicking a marker picks that slot (port.js). Pure: builds positions and an SVG string.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const C = isNode ? require('./combat.js') : root.EmberCombat;
/* (each core marker carries its module's letter: P power plant, T thrusters, M manoeuvring thrusters, H hyperdrive,
   L life support, F fuel tank, C canopy) */
const CORE_LETTER = {power: 'P', thrusters: 'T', maneuver: 'M', hyperdrive: 'H', life: 'L', fuel: 'F', canopy: 'C'};
const COL = {core: '#f2c14e', internal: '#6cc9e8', external: '#f08a5d', utility: '#7fd1a8'};
const NAMES = {core: 'Core', internal: 'Internal', external: 'Hardpoints', utility: 'Utility'};
/* where each core module sits, in shares of the half-length (z), the half-span (x) and the height (y) */
const CORE_AT = {canopy: [0, 0.62, -0.12], life: [0, 0.25, 0.12], power: [0, 0, -0.38], fuel: [0, -0.45, -0.15], hyperdrive: [0, 0.35, -0.62], thrusters: [0, -0.2, -0.95], maneuver: [0.82, 0.1, -0.85]};

/* every slot's place on the ship (body axes, m: +x right, +y up, +z the nose): [{cat, key|i, p, mirror}] */
function slots(ship, layout) {
	const len = ship.length || 20, L = len / 2, W = len * 0.36, H = len * 0.14, out = [];
	for (const k of layout.core) { const a = CORE_AT[k] || [0, 0, 0]; out.push({cat: 'core', key: k, p: [a[0] * W, a[1] * H, a[2] * L], mirror: a[0] != 0}) }
	const ni = layout.internal.length;
	layout.internal.forEach((z, i) => { const t = ni == 1 ? 0.5 : i / (ni - 1); out.push({cat: 'internal', i, size: z, p: [(i % 2 ? 1 : -1) * W * 0.26, -H * 0.15, L * (0.3 - 1.0 * t)]}) });
	const mt = C.mounts(ship, layout.external.length);
	layout.external.forEach((z, i) => out.push({cat: 'external', i, size: z, p: mt[i]}));
	for (let i = 0; i < layout.utility; i++) { const t = layout.utility == 1 ? 0.5 : i / (layout.utility - 1), z = L * (0.15 - 0.65 * t); out.push({cat: 'utility', i, p: [(i % 2 ? 1 : -1) * W * 0.12, H * (0.5 + 0.5 * (0.15 - z / L) / 0.8), z]}) }
	return out;
}
/* the hull's outline in a view: 'side' (nose right, up up) or 'top' (nose right, the left wing up) */
function outline(ship, view) {
	const len = ship.length || 20, L = len / 2, W = len * 0.36, H = len * 0.14;
	if (view == 'top') return {hull: [[L, 0], [-L, W], [-L, -W]], parts: [
		{k: 'canopy', pts: [[-0.05 * L, 0], [-0.3 * L, W * 0.18], [-0.3 * L, -W * 0.18]]},
		{k: 'fin', pts: [[-0.45 * L, W * 0.62], [-0.98 * L, W * 0.62]]}, {k: 'fin', pts: [[-0.45 * L, -W * 0.62], [-0.98 * L, -W * 0.62]]},
		{k: 'pod', rect: [-0.425 * L, W * 0.42, 0.35 * L, W * 0.16]}, {k: 'pod', rect: [-0.425 * L, -W * 0.42, 0.35 * L, W * 0.16]},
		{k: 'engine', rect: [-L, W * 0.375, 0.04 * L, W * 0.35]}, {k: 'engine', rect: [-L, -W * 0.375, 0.04 * L, W * 0.35]}]};
	return {hull: [[L, 0], [-0.55 * L, H], [-L, 0.2 * H], [-L, -H]], parts: [
		{k: 'canopy', pts: [[-0.05 * L, 0.75 * H], [-0.3 * L, 0.45 * H], [0.05 * L, 0.4 * H]]},
		{k: 'fin', pts: [[-0.95 * L, 0.15 * H], [-0.98 * L, 0.95 * H], [-0.45 * L, 0.15 * H]]},
		{k: 'pod', rect: [-0.425 * L, -0.55 * H, 0.35 * L, 0.18 * H]},
		{k: 'engine', rect: [-L, -0.2 * H, 0.04 * L, 0.6 * H]}]};
}
/* a slot's place on the drawing (2D, before scaling) */
const flat = (p, view) => view == 'top' ? [p[2], -p[0]] : [p[2], p[1]];

/* the SVG. fit: the ship's fit (filled or empty); sel: {cat, key|i} picked; label(slot): the marker's title */
function svg(ship, layout, fit, view, sel, label) {
	const len = ship.length || 20, Wd = 640, Hd = view == 'top' ? 320 : 230, pad = 30, O = outline(ship, view), S = slots(ship, layout), ex = view == 'side' ? 2 : 1;
	const span = [len, view == 'top' ? len * 0.72 : len * 0.28 * ex], k = Math.min((Wd - 2 * pad) / span[0], (Hd - 2 * pad) / span[1]);
	/* (the side view's heights drawn twice over: the hull is flat, and its slots need the room) */
	const X = x => Wd / 2 + x * k, Y = y => Hd / 2 + 6 - y * k * ex, pts = a => a.map(([x, y]) => X(x).toFixed(1) + ',' + Y(y).toFixed(1)).join(' ');
	const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
	let g = '<polygon class="sp-hull" points="' + pts(O.hull) + '"/>';
	for (const p of O.parts) g += p.rect ? '<rect class="sp-' + p.k + '" x="' + X(p.rect[0] - p.rect[2] / 2).toFixed(1) + '" y="' + Y(p.rect[1] + p.rect[3] / 2).toFixed(1) + '" width="' + (p.rect[2] * k).toFixed(1) + '" height="' + (p.rect[3] * k * ex).toFixed(1) + '"/>' : p.pts.length == 2 ? '<polyline class="sp-' + p.k + '" points="' + pts(p.pts) + '"/>' : '<polygon class="sp-' + p.k + '" points="' + pts(p.pts) + '"/>';
	const has = s => { const f = fit || {}; return s.cat == 'core' ? !!(f.core && f.core[s.key]) : !!((f[s.cat] || [])[s.i]) };
	/* markers: at their slots; where they'd sit on each other, they're spread apart (a few rounds of pushing) and a
	   short line leads back to the spot */
	const M = [];
	for (const s of S) for (const p of s.mirror ? [s.p, [-s.p[0], s.p[1], s.p[2]]] : [s.p]) {
		let [x, y] = flat(p, view); if (view == 'side' && s.cat == 'external') x += (p[0] > 0 ? 1 : -1) * 0.02 * len;
		M.push({s, ax: X(x), ay: Y(y), cx: X(x), cy: Y(y)});
	}
	const gap = 21;
	for (let it = 0; it < 60; it++) for (let a = 0; a < M.length; a++) for (let b = a + 1; b < M.length; b++) {
		const A = M[a], B = M[b]; let dx = B.cx - A.cx, dy = B.cy - A.cy, d = Math.hypot(dx, dy);
		if (d >= gap) continue;
		if (d < 0.01) { dx = 0; dy = 1; d = 1 }
		const push = (gap - d) / 2; A.cx -= dx / d * push; A.cy -= dy / d * push; B.cx += dx / d * push; B.cy += dy / d * push;
	}
	for (const m of M) { m.cx = Math.max(12, Math.min(Wd - 12, m.cx)); m.cy = Math.max(28, Math.min(Hd - 12, m.cy)) }
	for (const m of M) if (Math.hypot(m.cx - m.ax, m.cy - m.ay) > 3) g += '<line x1="' + m.ax.toFixed(1) + '" y1="' + m.ay.toFixed(1) + '" x2="' + m.cx.toFixed(1) + '" y2="' + m.cy.toFixed(1) + '" stroke="' + COL[m.s.cat] + '" stroke-width="1" opacity="0.6"/><circle cx="' + m.ax.toFixed(1) + '" cy="' + m.ay.toFixed(1) + '" r="2" fill="' + COL[m.s.cat] + '"/>';
	for (const m of M) {
		const s = m.s, id = s.cat == 'core' ? s.key : s.i, on = sel && sel.cat == s.cat && (sel.key != null ? sel.key == s.key : sel.i == s.i), num = s.cat == 'core' ? CORE_LETTER[s.key] || '' : String(s.i + 1), cx = m.cx, cy = m.cy, r = on ? 10 : 8;
		g += '<g class="sp-slot' + (on ? ' on' : '') + '" data-ofpick="' + s.cat + ':' + id + '" role="button" tabindex="0"><title>' + esc(label ? label(s) : NAMES[s.cat] + ' ' + (s.key || s.i + 1)) + '</title>'
			+ (on ? '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (r + 5) + '" fill="none" stroke="#fff" stroke-width="2"/>' : '')
			+ '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="' + (has(s) ? COL[s.cat] : 'rgba(10,18,32,0.85)') + '" stroke="' + COL[s.cat] + '" stroke-width="2"/>'
			+ (num ? '<text x="' + cx.toFixed(1) + '" y="' + (cy + 3.5).toFixed(1) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + (has(s) ? '#0a1220' : COL[s.cat]) + '">' + num + '</text>' : '') + '</g>';
	}
	const tag = (view == 'top' ? 'From above' : 'From the side (heights doubled)') + ' · nose to the right';
	return '<svg class="sp-plan" viewBox="0 0 ' + Wd + ' ' + Hd + '" width="100%" role="img" aria-label="' + esc(ship.name + ': ' + tag) + '"><style>.sp-hull{fill:#1c2a40;stroke:#8fb3d9;stroke-width:1.5}.sp-canopy{fill:#2f6f9e;stroke:#8fd0ff;stroke-width:1}.sp-fin{fill:#25364f;stroke:#8fb3d9;stroke-width:1.2}.sp-pod{fill:#121c2c;stroke:#6f8fb3}.sp-engine{fill:#ff9c4a;opacity:0.85}.sp-slot{cursor:pointer}.sp-slot:hover circle{stroke-width:3}</style>'
		+ '<text x="10" y="18" font-size="11" fill="#9fb0cc">' + esc(tag) + '</text>' + g + '</svg>';
}

const EmberShipPlan = {CORE_LETTER, COL, NAMES, CORE_AT, slots, outline, flat, svg};
if (isNode) module.exports = EmberShipPlan; else root.EmberShipPlan = EmberShipPlan;
})(typeof window != 'undefined' ? window : this);
