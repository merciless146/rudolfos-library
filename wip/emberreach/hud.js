/* ===== Ember Reach: the flight HUD (docs/plan-ember-reach.md, "Flight", "Modules and damage").
   Drawn on a 2D canvas over the 3D view, in CSS pixels:
   - centre: the reticle, the velocity marker (where you're actually going), and the target's brackets, or an
     arrow at the edge when it's off screen;
   - bottom left: speed, throttle, flight assist, cruise and mass lock;
   - bottom right: the target: name, distance, closing speed, and docking cues near a port;
   - top left: module alerts (the ship's side profile with the broken module flashing, and the console line
     "<MODULE> INOPERABLE" under an orange triangle, red for critical modules), or the console's recent messages;
   - right: the internal-systems panel (toggled);
   - with the canopy broken: felt g, the view darkening from the edges, black when the pilot blacks out (the blur is
     a filter on the 3D canvas, set by play.js).
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const C = {cyan: '#6cc9e8', amber: '#f2a33a', red: '#e5484d', text: '#e8edf6', muted: '#9fb0cc', panel: 'rgba(8,14,26,0.78)', line: '#2a3a5c', green: '#7fd1a8'};
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace', SANS = 'Inter, system-ui, sans-serif';
/* the ship's side profile (nose right), the same zones as the HUD mockup */
const PROFILE = {hull: 'M20 50 L60 34 L200 30 L250 40 L300 58 L250 74 L200 84 L60 86 L20 72 Z',
	engines: ['M6 46 L36 42 L36 80 L6 76 Z'], rcs: ['M44 36h14v8h-14z', 'M44 76h14v8h-14z'], power: ['M70 40h50v22h-50z'], jump: ['M70 65h50v17h-50z'],
	shields: ['M126 38h48v20h-48z'], weapons: ['M140 72h44v9h-44z'], cargo: ['M140 72h44v9h-44z'], life: ['M126 60h48v10h-48z', 'M180 44h24v22h-24z'],
	acs: ['M210 66h22v9h-22z', 'M210 44h16v8h-16z'], canopy: ['M198 31 C214 15 246 17 268 43 L250 41 L200 33 Z'], sensors: ['M272 50 L304 58 L272 66 Z']};
let P2 = null;
const path = d => (P2 = P2 || {}, P2[d] || (P2[d] = new Path2D(d)));

function fmtDist(m) {
	const a = Math.abs(m);
	if (a < 10000) return Math.round(m).toLocaleString('en-US') + ' m';
	if (a < 1.5e9) return Math.round(m / 1000).toLocaleString('en-US') + ' km';
	return (m / 1.495978707e11).toFixed(a < 1.5e11 ? 3 : 2) + ' AU';
}
function fmtSpeed(v) {
	const a = Math.abs(v);
	if (a < 10000) return Math.round(v) + ' m/s';
	if (a < 2.998e6) return (v / 1000).toFixed(a < 1e5 ? 1 : 0) + ' km/s';
	return (v / 2.998e8).toFixed(a < 2.998e9 ? 2 : 1) + ' c';
}
function box(ctx, x, y, w, h) { ctx.fillStyle = C.panel; ctx.fillRect(x, y, w, h); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1) }
function text(ctx, s, x, y, o) { o = o || {}; ctx.font = (o.weight || 500) + ' ' + (o.size || 13) + 'px ' + (o.mono ? MONO : SANS); ctx.fillStyle = o.col || C.text; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic'; ctx.fillText(s, x, y) }
function triangle(ctx, x, y, col) {
	ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + 11, y + 1); ctx.lineTo(x + 21, y + 19); ctx.lineTo(x + 1, y + 19); ctx.closePath(); ctx.fill();
	ctx.fillStyle = '#05080f'; ctx.fillRect(x + 10, y + 7, 2, 6); ctx.fillRect(x + 10, y + 15, 2, 2);
}

/* H: the HUD state from play.js (see draw's reads below) */
function draw(ctx, W, H, h, t) {
	ctx.save();
	const cx = W / 2, cy = H / 2, small = W < 700;
	/* ---- vision under g: the edges darken; black when out ---- */
	if (h.vision && h.vision.dark > 0) {
		if (!h.vision.conscious) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); text(ctx, 'PILOT UNCONSCIOUS · CONTROLS LOCKED', cx, cy, {mono: true, col: '#3a4660', align: 'center', size: 13}); ctx.restore(); return }
		const d = h.vision.dark, g = ctx.createRadialGradient(cx, cy, Math.max(W, H) * 0.62 * (1 - d), cx, cy, Math.max(W, H) * (0.78 - 0.35 * d));
		g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + Math.min(1, 0.55 + d) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
	}
	/* ---- a jump: the drive's tunnel, streaks racing out from the centre ---- */
	if (h.witch != null) {
		const k = h.witch;
		ctx.fillStyle = 'rgba(2,4,10,' + (0.55 + 0.4 * Math.sin(Math.PI * k)).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
		const R = Math.hypot(W, H) / 2;
		for (let i = 0; i < 140; i++) {
			const a = i * 2.39996, ph = (t * (1.2 + (i % 7) * 0.15) + i * 0.137) % 1, r0 = R * Math.pow(ph, 2.2), r1 = r0 + R * 0.08 * (0.5 + ph) * (0.6 + Math.sin(Math.PI * k));
			ctx.strokeStyle = 'rgba(' + (150 + (i % 3) * 40) + ',' + (200 + (i % 2) * 30) + ',255,' + (0.25 + 0.6 * ph).toFixed(2) + ')'; ctx.lineWidth = 1 + 1.5 * ph;
			ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
		}
		if (h.witchTo) text(ctx, 'HYPERSPACE · ' + h.witchTo.toUpperCase(), cx, H - 40, {mono: true, align: 'center', size: 13, col: C.cyan, weight: 600});
		ctx.restore(); return;
	}
	/* ---- the reticle ---- */
	ctx.strokeStyle = 'rgba(108,201,232,0.75)'; ctx.lineWidth = 1.4;
	ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.moveTo(cx - 30, cy); ctx.lineTo(cx - 22, cy); ctx.moveTo(cx + 22, cy); ctx.lineTo(cx + 30, cy); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy - 22); ctx.moveTo(cx, cy + 22); ctx.lineTo(cx, cy + 30); ctx.stroke();
	/* the velocity marker: where the ship is going, relative to the nearby frame */
	if (h.prograde && h.speed > 2) {
		const p = h.prograde;
		if (p.on) { ctx.strokeStyle = C.green; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.moveTo(p.x - 13, p.y); ctx.lineTo(p.x - 7, p.y); ctx.moveTo(p.x + 7, p.y); ctx.lineTo(p.x + 13, p.y); ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x, p.y - 12); ctx.stroke() }
	}
	/* ---- the target ---- */
	if (h.target) {
		const T = h.target;
		if (T.on) {
			const s = Math.max(14, Math.min(120, T.size)); ctx.strokeStyle = C.amber; ctx.lineWidth = 1.6; ctx.beginPath();
			for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(T.x + sx * s, T.y + sy * (s - 7)); ctx.lineTo(T.x + sx * s, T.y + sy * s); ctx.lineTo(T.x + sx * (s - 7), T.y + sy * s) }
			ctx.stroke(); text(ctx, T.name, T.x + s + 6, T.y - 2, {col: C.amber, size: 12, weight: 600}); text(ctx, fmtDist(T.dist), T.x + s + 6, T.y + 13, {col: C.text, size: 12, mono: true});
		} else {
			/* an arrow at the edge, pointing the way to turn */
			const a = Math.atan2(T.dy, T.dx), r = Math.min(W, H) * 0.42, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
			ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.lineTo(x + Math.cos(a + 2.5) * 10, y + Math.sin(a + 2.5) * 10); ctx.lineTo(x + Math.cos(a - 2.5) * 10, y + Math.sin(a - 2.5) * 10); ctx.closePath(); ctx.fill();
		}
	}
	/* ---- bottom left: flight ---- */
	const bw = small ? 240 : 290, bh = 118, bx = 16, by = H - bh - (h.touch ? 190 : 16);
	box(ctx, bx, by, bw, bh);
	text(ctx, h.cruise ? 'CRUISE' : 'SPEED', bx + 12, by + 22, {col: C.muted, size: 11, mono: true});
	text(ctx, fmtSpeed(h.speed), bx + 12, by + 50, {size: 26, weight: 600, mono: true, col: h.cruise ? C.cyan : C.text});
	/* throttle bar: FA on, a set speed (reverse below the line); FA off, thrust */
	const tx = bx + bw - 30, ty = by + 12, tH = bh - 24;
	ctx.fillStyle = '#132038'; ctx.fillRect(tx, ty, 12, tH);
	const zero = ty + tH * (1 / 1.3), thr = Math.max(-0.3, Math.min(1, h.throttle || 0));
	ctx.fillStyle = h.cruise ? C.cyan : C.amber; if (thr >= 0) ctx.fillRect(tx, zero - thr * (zero - ty), 12, thr * (zero - ty)); else ctx.fillRect(tx, zero, 12, (-thr / 0.3) * (ty + tH - zero));
	ctx.fillStyle = C.muted; ctx.fillRect(tx - 4, zero, 20, 1);
	const chips = [[h.fa ? 'FA ON' : 'FA OFF', h.fa ? C.cyan : C.amber]];
	if (h.cruise) chips.push(['CRUISE', C.cyan]); else if (h.charging) chips.push(['CHARGING ' + Math.ceil(h.charging), C.cyan]); else if (h.massLocked) chips.push(['MASS LOCKED', C.muted]);
	if (h.jumpCharge) chips.push(['JUMP ' + Math.ceil(h.jumpCharge), C.cyan]);
	if (h.fuel != null) chips.push(['FUEL ' + Math.round(h.fuel * 100) + '%', h.fuel < 0.25 ? C.amber : C.muted]);
	if (h.gFelt != null) chips.push([h.gFelt.toFixed(1) + ' g', h.gFelt > 4 ? C.amber : C.muted]);
	let chx = bx + 12;
	for (const [s, col] of chips) { ctx.font = '600 11px ' + MONO; const w = ctx.measureText(s).width + 12; ctx.strokeStyle = col; ctx.strokeRect(chx + 0.5, by + 72.5, w, 20); text(ctx, s, chx + 6, by + 86, {mono: true, size: 11, col, weight: 600}); chx += w + 6 }
	if (h.nextLeg) text(ctx, h.nextLeg, bx + 12, by + 110, {size: 11, col: C.cyan, weight: 600});
	else text(ctx, h.fa ? 'Set ' + fmtSpeed(Math.max(0, thr) * h.vmax) : (h.thrustNote || 'Thrust ' + Math.round(thr * 100) + '%'), bx + 12, by + 110, {size: 11, col: C.muted});
	/* ---- bottom right: target ---- */
	if (h.target) {
		const T = h.target, w = small ? 210 : 280, x = W - w - 16, y = H - 118 - (h.touch ? 190 : 16);
		box(ctx, x, y, w, 118);
		text(ctx, T.kind.toUpperCase(), x + 12, y + 20, {mono: true, size: 11, col: C.muted});
		text(ctx, T.name, x + 12, y + 42, {size: 16, weight: 600});
		text(ctx, fmtDist(T.dist), x + 12, y + 66, {mono: true, size: 14});
		text(ctx, (T.closing >= 0 ? '▼ ' : '▲ ') + fmtSpeed(Math.abs(T.closing)), x + w - 12, y + 66, {mono: true, size: 12, col: C.muted, align: 'right'});
		if (T.dock) { const d = T.dock; text(ctx, d.line1, x + 12, y + 90, {size: 12, col: d.col || C.text, weight: 600}); if (d.line2) text(ctx, d.line2, x + 12, y + 108, {size: 12, col: C.muted}) }
	}
	/* ---- top left: alerts, or the console ---- */
	const al = h.alerts || [];
	const lx = 16, ly = 16, lw = small ? Math.min(W - 32, 300) : 340;
	let y = ly;
	if (al.length) {
		box(ctx, lx, y, lw, 120);
		text(ctx, (h.shipName || 'SHIP').toUpperCase() + ' · SIDE PROFILE', lx + 10, y + 16, {mono: true, size: 10, col: C.muted});
		text(ctx, al.length + ' INOP', lx + lw - 10, y + 16, {mono: true, size: 10, col: C.muted, align: 'right'});
		ctx.save(); const sc = (lw - 24) / 320; ctx.translate(lx + 12, y + 18); ctx.scale(sc, sc * 0.85);
		ctx.fillStyle = '#0b1424'; ctx.strokeStyle = '#3a4d72'; ctx.lineWidth = 1.4 / sc; ctx.fill(path(PROFILE.hull)); ctx.stroke(path(PROFILE.hull));
		const blink = (Math.floor(t * 2.2) % 2 == 0) || h.reduceFlash;
		for (const z in PROFILE) {
			if (z == 'hull') continue;
			const bad = al.find(a => a.module == z), m = h.modules && h.modules.find(x => x.id == z); if (!m && !bad) continue;
			ctx.lineWidth = 1.2 / sc;
			if (bad) { ctx.fillStyle = bad.color; ctx.strokeStyle = bad.color; ctx.globalAlpha = blink ? 1 : 0.2 }
			else { ctx.fillStyle = m.hp < m.max ? 'rgba(242,163,58,0.2)' : 'rgba(108,201,232,0.14)'; ctx.strokeStyle = m.hp < m.max ? '#c9a46a' : C.cyan; ctx.globalAlpha = 1 }
			for (const d of PROFILE[z]) { ctx.fill(path(d)); ctx.stroke(path(d)) }
		}
		ctx.restore(); ctx.globalAlpha = 1;
		y += 126;
		const ch = 12 + al.length * 26;
		ctx.fillStyle = 'rgba(3,6,12,0.92)'; ctx.fillRect(lx, y, lw, ch); ctx.strokeStyle = C.line; ctx.strokeRect(lx + 0.5, y + 0.5, lw - 1, ch - 1);
		al.forEach((a, i) => { triangle(ctx, lx + 10, y + 8 + i * 26, a.color); text(ctx, '> ' + a.text.toUpperCase(), lx + 40, y + 24 + i * 26, {mono: true, size: 13, weight: 700, col: a.color}) });
		y += ch + 8;
	}
	const msgs = (h.messages || []).filter(m => t - m.t < 8).slice(-3);
	if (msgs.length) {
		const ch = 10 + msgs.length * 20;
		ctx.fillStyle = 'rgba(3,6,12,0.8)'; ctx.fillRect(lx, y, lw, ch);
		msgs.forEach((m, i) => { ctx.globalAlpha = Math.min(1, (8 - (t - m.t)) / 1.5); text(ctx, '> ' + m.text, lx + 10, y + 20 + i * 20, {mono: true, size: 12, col: m.col || C.green}) });
		ctx.globalAlpha = 1;
	}
	/* ---- right: internal systems ---- */
	if (h.showSystems && h.modules) {
		const w = 260, x = W - w - 16, y0 = 16, rows = h.modules.length, ph = 34 + rows * 26;
		box(ctx, x, y0, w, ph);
		text(ctx, 'INTERNAL SYSTEMS', x + 12, y0 + 21, {mono: true, size: 11, col: C.muted});
		h.modules.forEach((m, i) => {
			const yy = y0 + 34 + i * 26, inop = m.hp <= 0, col = inop ? (m.critical ? C.red : C.amber) : C.text;
			text(ctx, m.name, x + 12, yy + 13, {size: 12, col, weight: inop ? 700 : 500});
			ctx.fillStyle = '#1a2540'; ctx.fillRect(x + 128, yy + 6, 70, 6);
			ctx.fillStyle = m.hp < m.max ? C.amber : C.cyan; ctx.fillRect(x + 128, yy + 6, 70 * m.hp / m.max, 6);
			text(ctx, inop ? 'INOP' : Math.ceil(m.hp) + '/' + m.max, x + w - 12, yy + 13, {mono: true, size: 11, col: inop ? col : C.muted, align: 'right', weight: inop ? 700 : 400});
		});
	}
	/* ---- touch controls ---- */
	if (h.touch && h.touchUI) {
		const u = h.touchUI;
		ctx.strokeStyle = 'rgba(232,237,246,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.stick.x, u.stick.y, u.stick.r, 0, 7); ctx.stroke();
		ctx.fillStyle = 'rgba(108,201,232,0.45)'; ctx.beginPath(); ctx.arc(u.stick.x + u.stick.dx * u.stick.r, u.stick.y + u.stick.dy * u.stick.r, 26, 0, 7); ctx.fill();
		ctx.strokeStyle = 'rgba(232,237,246,0.35)'; ctx.strokeRect(u.thr.x, u.thr.y, u.thr.w, u.thr.h);
		ctx.fillStyle = 'rgba(242,163,58,0.5)'; const tv = Math.max(0, h.throttle); ctx.fillRect(u.thr.x, u.thr.y + u.thr.h * (1 - tv), u.thr.w, u.thr.h * tv);
		for (const b of u.buttons) { ctx.fillStyle = 'rgba(8,14,26,0.7)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = b.on ? C.cyan : 'rgba(232,237,246,0.35)'; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 4, {align: 'center', size: 12, weight: 600, col: b.on ? C.cyan : C.text}) }
	}
	ctx.restore();
}

const EmberHUD = {draw, fmtDist, fmtSpeed, COLORS: C, PROFILE};
if (typeof module != 'undefined') module.exports = EmberHUD; else root.EmberHUD = EmberHUD;
})(typeof window != 'undefined' ? window : this);
