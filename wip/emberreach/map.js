/* ===== Ember Reach: the 3D star map (docs/plan-ember-reach.md, "The map", M2).
   Drawn on the HUD canvas, over the flight view. Turn it, zoom it, and move from the whole galaxy down to the stars
   around you:
   - the galaxy: its shape, a scatter of its stars, the six clusters, and the long lanes between them;
   - a cluster: each great power's space in its colour (never shared), peaceful borders as solid grids, contested
     space as dashed grids, the front's systems in today's holder's colour linked along their supply chains (dashed
     where cut off), the powers' beacons and lanes;
   - nearby: the real stars around the view's centre, coloured by type, your jump range, and your route.
   Pick a star for its details: who holds it, its port, its planets, how far, the misjump risk; plot a route to it.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const G = window.EmberGalaxy, F = window.EmberFactions, T = window.EmberTravel;
const C = {cyan: '#6cc9e8', amber: '#f2a33a', red: '#ff6a5c', text: '#e8edf6', muted: '#9fb0cc', panel: 'rgba(8,14,26,0.86)', line: '#2a3a5c', green: '#7fd1a8'};
const SANS = 'Inter, system-ui, sans-serif', MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const at = s => s.at || [s.x, s.y, s.z], dist = T.dist;
function tColor(T0) { const t = Math.max(2400, Math.min(30000, T0 || 5800)); return t > 9000 ? [170, 195, 255] : t > 7000 ? [220, 228, 255] : t > 5600 ? [255, 244, 220] : t > 4400 ? [255, 214, 160] : t > 3300 ? [255, 176, 120] : [255, 140, 100] }
const powerHue = i => (i * 137.508 + 20) % 360;

function create() {
	const M = {open: false, yaw: 0.6, pitch: 0.5, D: 60, focus: [0, 0, 0], sel: null, here: null, route: null, range: 6, origin: null, day: 0, fuel: 1, ready: false, charting: 0, hits: []};
	const majors = F.majors(), idx = {}; majors.forEach((m, i) => idx[m.id] = i);
	const hue = (id, a) => 'hsla(' + powerHue(idx[id] || 0) + ',72%,60%,' + (a == null ? 1 : a) + ')';
	let backdrop = null; const clusterArt = {};
	/* ---- data, made when first needed ---- */
	function backdropOf() {
		if (backdrop) return backdrop;
		backdrop = G.sampleGalaxy(5000, 11).map(s => ({p: at(s), c: tColor(s.T)}));
		return backdrop;
	}
	/* a cluster's art, as in the viewer: territory, borders, fronts (a second or so the first time) */
	function art(cl) {
		if (clusterArt[cl.id]) return clusterArt[cl.id];
		const Ms = majors.filter(m => m.cluster == cl.id), c = [0, 1, 2].map(k => Ms.reduce((t, m) => t + m.at[k], 0) / Ms.length);
		const span = 2.6 * Math.max(...Ms.map(m => dist(m.at, c) + m.claim)), r = G.rng(3), cloud = [];
		for (let k = 0; k < 7000; k++) { const p = c.map(v => v + (r() - 0.5) * span), o = F.claimAt(p); if (o.owner) cloud.push([p, o.owner]) }
		const layers = [];
		for (let i = 0; i < Ms.length; i++) for (let j = i + 1; j < Ms.length; j++) {
			const a = Ms[i], b = Ms[j], enemy = F.relation(a.id, b.id) < 0;
			if (dist(a.at, b.at) > a.claim + b.claim) continue;
			if (!enemy) layers.push({g: surface(a, b, 0, p => { const o = F.claimAt(p); return o.owner == a.id || o.owner == b.id }), dash: [], col: 'rgba(210,220,235,.38)'});
			else for (const lv of [F.depthOf(a.id, b.id) * 0.999, -F.depthOf(b.id, a.id) * 0.999]) layers.push({g: surface(a, b, lv, p => { const o = F.claimAt(p); return (o.contested && o.contested.includes(a.id) && o.contested.includes(b.id)) || o.owner == a.id || o.owner == b.id }), dash: [4, 4], col: 'rgba(255,95,80,.6)'});
		}
		const fronts = F.wars().filter(w => Ms.some(m => m.id == w.a)).map(w => ({w, st: F.warState(w, M.day)}));
		return (clusterArt[cl.id] = {Ms, c, span, cloud, layers, fronts});
	}
	const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = v => { const l = Math.hypot(...v); return v.map(q => q / l) };
	function surface(a, b, level, keep) {
		const ax = a.at.map((v, k) => b.at[k] - v), d = Math.hypot(...ax), u = ax.map(v => v / d), t = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = nrm(cross(u, t)), e2 = cross(u, e1);
		const R = Math.max(a.claim, b.claim), rings = 6, spokes = 20, pts = [];
		for (let ri = 0; ri <= rings; ri++) { const row = []; for (let si = 0; si < spokes; si++) {
			const rad = R * ri / rings, ang = si / spokes * 2 * Math.PI, off = e1.map((v, k) => v * Math.cos(ang) * rad + e2[k] * Math.sin(ang) * rad);
			let lo = -R, hi = d + R, p; for (let q = 0; q < 30; q++) { const mid = (lo + hi) / 2; p = a.at.map((v, k) => v + u[k] * mid + off[k]); if (F.pull(a, p) - F.pull(b, p) > level) lo = mid; else hi = mid }
			const sa = F.pull(a, p), sb = F.pull(b, p);
			row.push((sa > 0 || sb > 0) && Math.abs(sa - sb - level) < 0.01 && keep(p) ? p : null);
		} pts.push(row) }
		return pts;
	}
	/* stars near the view's centre: a few thousand at most */
	let localCache = null;
	function localStars() {
		const n = G.numberDensity(...M.focus) + 1e-9, R = Math.min(M.D * 0.9, Math.cbrt(3500 / (n * 4.19)));
		if (localCache && dist(localCache.f, M.focus) < R * 0.25 && Math.abs(localCache.R / R - 1) < 0.3) return localCache.list;
		const list = G.starsNear(M.focus[0], M.focus[1], M.focus[2], R).slice(0, 4000);
		localCache = {f: M.focus.slice(), R, list};
		return list;
	}

	/* ---- the camera ---- */
	function cam() {
		const cy = Math.cos(M.yaw), sy = Math.sin(M.yaw), cp = Math.cos(M.pitch), sp = Math.sin(M.pitch);
		const back = [cy * cp, sy * cp, sp], pos = M.focus.map((v, i) => v + back[i] * M.D);
		const f = back.map(v => -v), r = nrm(cross(f, [0, 0, 1])), u = cross(r, f);
		return {pos, f, r, u};
	}
	let W = 1, H = 1, K = null;
	function proj(p) {
		const d = [p[0] - K.pos[0], p[1] - K.pos[1], p[2] - K.pos[2]], z = d[0] * K.f[0] + d[1] * K.f[1] + d[2] * K.f[2];
		if (z <= M.D * 0.02) return null;
		const k = H / 2 / Math.tan(30 * Math.PI / 180) / z;
		return [W / 2 + (d[0] * K.r[0] + d[1] * K.r[1] + d[2] * K.r[2]) * k, H / 2 - (d[0] * K.u[0] + d[1] * K.u[1] + d[2] * K.u[2]) * k, z, k];
	}

	/* ---- drawing ---- */
	function draw(ctx, w, h, t) {
		W = w; H = h; K = cam(); M.hits = [];
		ctx.save();
		ctx.fillStyle = '#020409'; ctx.fillRect(0, 0, W, H);
		if (M.charting) { text(ctx, '> charting the powers\' space…', W / 2, H / 2, {mono: true, col: C.muted, align: 'center'}); ctx.restore(); return }
		const D = M.D, far = D > 700, mid = D > 25;
		/* the galaxy: a scatter of its stars and its outline */
		const bA = Math.max(0.12, Math.min(0.9, (D - 60) / 900));
		if (D > 60) for (const b of backdropOf()) { const p = proj(b.p); if (!p) continue; ctx.fillStyle = 'rgba(' + b.c[0] + ',' + b.c[1] + ',' + b.c[2] + ',' + bA.toFixed(2) + ')'; ctx.fillRect(p[0], p[1], 1.3, 1.3) }
		if (far) {
			const ax = G.GAL.axes.map(a => a * G.GAL.rMax);
			ctx.strokeStyle = 'rgba(159,176,204,0.25)'; ctx.lineWidth = 1;
			for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { ctx.beginPath(); for (let k = 0; k <= 64; k++) { const a = k / 64 * 2 * Math.PI, q = [0, 0, 0]; q[i] = ax[i] * Math.cos(a); q[j] = ax[j] * Math.sin(a); const p = proj(q); if (p) k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]) } ctx.stroke() }
		}
		/* the long lanes and the clusters */
		const L = M.ready ? T.lanes() : null;
		if (L && D > 40) {
			ctx.strokeStyle = 'rgba(242,163,58,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 5]);
			for (const ch of L.chains) { ctx.beginPath(); let first = true; for (const i of ch.nodes) { const p = proj(L.nodes[i].at); if (!p) { first = true; continue } first ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); first = false } ctx.stroke() }
			ctx.setLineDash([]);
		}
		for (const cl of G.clusters()) {
			const p = proj(cl.at); if (!p) continue;
			if (far) { text(ctx, cl.name, p[0] + 8, p[1] + 4, {size: 13, weight: 600}); ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); M.hits.push({x: p[0], y: p[1], kind: 'cluster', cl}) }
		}
		/* a cluster near the centre of the view, in detail */
		if (!far && M.ready) {
			const cl = G.clusters().map(c => ({c, d: dist(c.at, M.focus)})).sort((a, b) => a.d - b.d)[0];
			if (cl && cl.d < 900) drawCluster(ctx, art(cl.c), D);
		}
		/* nearby stars */
		if (D < 80) {
			const list = localStars(), a = Math.min(1, (80 - D) / 40);
			for (const s of list) {
				const p = proj(at(s)); if (!p || p[0] < -5 || p[1] < -5 || p[0] > W + 5 || p[1] > H + 5) continue;
				const c = tColor(s.T), size = Math.max(1.2, Math.min(4, 1.4 + Math.log10(Math.max(1e-4, s.L || 1e-3)) * 0.6));
				ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(p[0], p[1], size, 0, 7); ctx.fill();
				M.hits.push({x: p[0], y: p[1], kind: 'star', s});
			}
		}
		/* you are here, your range, your route */
		if (M.here) {
			const p = proj(at(M.here));
			if (p) {
				const rr = M.range * p[3];
				if (rr > 6 && rr < W) { ctx.strokeStyle = 'rgba(108,201,232,0.6)'; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, 7); ctx.stroke(); ctx.setLineDash([]) }
				ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.stroke();
				text(ctx, 'You', p[0] + 10, p[1] - 8, {size: 11, col: C.cyan, weight: 600});
			}
			if (M.route && M.route.legs) {
				let prev = at(M.here);
				for (const l of M.route.legs) {
					const a = proj(prev), b = proj(at(l.star)); prev = at(l.star); if (!a || !b) continue;
					ctx.strokeStyle = l.kind == 'jump' ? C.cyan : C.amber; ctx.lineWidth = l.kind == 'jump' ? 1.6 : 2; ctx.setLineDash(l.kind == 'long' ? [6, 4] : []);
					ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
					ctx.fillStyle = l.kind == 'jump' ? C.cyan : C.amber; ctx.fillRect(b[0] - 1.5, b[1] - 1.5, 3, 3);
				}
				ctx.setLineDash([]);
			}
		}
		/* the selected star */
		if (M.sel) {
			const p = proj(at(M.sel));
			if (p) { ctx.strokeStyle = C.amber; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p[0], p[1], 11, 0, 7); ctx.stroke(); text(ctx, M.sel.name, p[0] + 14, p[1] - 10, {size: 12, weight: 600, col: C.amber}) }
		}
		panel(ctx, t);
		ctx.restore();
	}
	function drawCluster(ctx, A, D) {
		const ca = Math.max(0.08, Math.min(0.32, 0.32 * (1 - D / 900)));
		for (const [p, id] of A.cloud) { const q = proj(p); if (!q) continue; ctx.fillStyle = hue(id, ca); ctx.fillRect(q[0], q[1], 1.6, 1.6) }
		/* borders fade as you zoom in among the stars, so they don't swamp them */
		ctx.globalAlpha = Math.max(0.15, Math.min(1, D / 40));
		for (const Ly of A.layers) {
			ctx.strokeStyle = Ly.col; ctx.lineWidth = 0.9; ctx.setLineDash(Ly.dash); ctx.beginPath();
			const g = Ly.g;
			for (let ri = 0; ri < g.length; ri++) for (let si = 0; si < g[ri].length; si++) {
				const p = g[ri][si]; if (!p) continue; const a = proj(p); if (!a) continue;
				const n1 = g[ri][(si + 1) % g[ri].length], n2 = g[ri + 1] && g[ri + 1][si];
				if (n1 && ri) { const b = proj(n1); if (b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) } }
				if (n2) { const b = proj(n2); if (b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]) } }
			}
			ctx.stroke();
		}
		ctx.setLineDash([]); ctx.globalAlpha = 1;
		/* power lanes, faint */
		const L = T.lanes();
		if (D < 400) for (const e of L.edges) {
			if (e.kind != 'lane') continue; const na = L.nodes[e.a]; if (!A.Ms.some(m => m.id == na.power)) continue;
			const a = proj(na.at), b = proj(L.nodes[e.b].at); if (!a || !b) continue;
			ctx.strokeStyle = hue(na.power, T.laneOpen(e, M.origin) ? 0.35 : 0.12); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
		}
		/* fronts */
		for (const {w, st} of A.fronts) {
			const S = w.systems;
			S.forEach((s, i) => s.links.forEach(j => { if (j < i) return; const X = st.systems[i], Y = st.systems[j]; if (!X.holder || X.holder != Y.holder) return;
				const a = proj(s.at), b = proj(S[j].at); if (!a || !b) return; const sup = X.supplied && Y.supplied; ctx.strokeStyle = sup ? hue(X.holder, 0.9) : 'rgba(200,200,200,.8)'; ctx.setLineDash(sup ? [] : [3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke() }));
			ctx.setLineDash([]);
			S.forEach((s, i) => { const p = proj(s.at); if (!p) return; const hd = st.systems[i].holder; ctx.fillStyle = hd ? hue(hd) : '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], st.systems[i].supplied ? 2.6 : 2, 0, 7); ctx.fill(); if (!st.systems[i].supplied) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke() } });
		}
		/* capitals */
		for (const m of A.Ms) {
			const p = proj(m.at); if (!p) continue;
			ctx.fillStyle = hue(m.id); ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
			const rel = M.origin && m.id != M.origin ? F.relation(M.origin, m.id) : 0;
			text(ctx, m.name.replace(/^The /, ''), p[0] + 8, p[1] - 6, {size: 11, weight: 600, col: rel < 0 ? C.red : rel > 0 ? C.green : C.text});
			M.hits.push({x: p[0], y: p[1], kind: 'star', s: m.star});
		}
	}
	/* the info panel and buttons */
	function panel(ctx, t) {
		const small = W < 700, pw = small ? W - 32 : 340, px = 16, py = H - (small ? 230 : 214) - 16;
		box(ctx, px, py, pw, small ? 230 : 214);
		let y = py + 22;
		if (M.sel) {
			const s = M.sel, i = M.info || (M.info = describe(s));
			text(ctx, s.name, px + 12, y, {size: 17, weight: 600}); y += 20;
			text(ctx, i.kind, px + 12, y, {size: 12, col: C.muted}); y += 20;
			text(ctx, i.owner, px + 12, y, {size: 12, col: i.ownerCol}); y += 18;
			text(ctx, i.port, px + 12, y, {size: 12}); y += 18;
			text(ctx, i.planets, px + 12, y, {size: 12, col: C.muted}); y += 18;
			text(ctx, i.dist + (i.misjump ? ' · misjump risk ' + i.misjump : ''), px + 12, y, {size: 12, mono: true}); y += 22;
			const r = M.route;
			if (r && r.to == s.id) text(ctx, r.ok ? r.jumps + (r.jumps == 1 ? ' jump' : ' jumps') + ' · fuel ' + Math.round(r.fuel * 100) + '% of a tank' + (r.fuel > M.fuel ? ' (refuel on the way)' : '') : 'No route in range', px + 12, y, {size: 12, col: r.ok ? C.cyan : C.amber, weight: 600});
			else text(ctx, 'Enter: plot a route', px + 12, y, {size: 12, col: C.muted});
		} else {
			text(ctx, 'Star map', px + 12, y, {size: 17, weight: 600}); y += 22;
			for (const l of ['Drag to turn, wheel or pinch to zoom', 'Tap a star to pick it; Enter plots a route', 'Home: back to you · G: close the map', 'Long lanes: dashed amber · lanes: in each power\'s colour', 'Contested space: dashed red · borders: grey']) { text(ctx, l, px + 12, y, {size: 12, col: C.muted}); y += 18 }
		}
		/* buttons */
		const bw = 74, bh = 44, by = 16, bx = W - 16 - bw * 5 - 6 * 4;
		M.buttons = [['Close', 'close'], ['You', 'home'], ['Route', 'route'], ['−', 'out'], ['+', 'in']].map(([label, act], i) => ({label, act, x: bx + i * (bw + 6), y: by, w: bw, h: bh}));
		for (const b of M.buttons) { ctx.fillStyle = 'rgba(8,14,26,0.85)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = C.line; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); text(ctx, b.label, b.x + b.w / 2, b.y + 27, {align: 'center', size: 13, weight: 600}) }
		text(ctx, scaleText(), 16, 30, {mono: true, size: 12, col: C.muted});
	}
	function scaleText() { const D = M.D; return 'View ' + (D < 10 ? D.toFixed(1) : Math.round(D).toLocaleString('en-US')) + ' pc out' + (D > 700 ? ' · the galaxy' : D > 25 ? ' · a region' : ' · nearby stars') }
	function describe(s) {
		const Co = window.EmberColonies, col = M.player && Co ? Co.colonyAt(M.player, s.id) : null;
		const o = T.ownerOf(s, M.day), port = T.portFor(s, M.day), sys = G.system(s), live = sys.planets.filter(p => p.life || p.alive).length;
		const m = o.owner ? F.byId(o.owner) : null, rel = m && M.origin && m.id != M.origin ? F.relation(M.origin, m.id) : 0;
		const d = M.here ? dist(at(M.here), at(s)) : 0, mj = T.misjumpChance(s);
		return {kind: (s.cls || s.kind || 'star') + ' class · ' + (s.M || 0).toFixed(2) + ' suns',
			owner: o.owner ? (o.contested ? 'Contested, held by ' : '') + m.name.replace(/^The /, '') + (rel < 0 ? ' (at war with you)' : rel > 0 ? ' (allied)' : '') : 'Unclaimed space', ownerCol: rel < 0 ? C.red : rel > 0 ? C.green : C.text,
			port: col ? 'Your colony: ' + {claimed: 'claimed, beacon by day ' + col.beaconBy, building: 'building, ' + Math.round(100 * Co.progress(col)) + '%', done: col.port + ' built'}[col.stage] : port ? 'Port: ' + {halo: 'Halo (capital)', lantern: 'Lantern', trefoil: 'Trefoil outpost', bloom: 'Bloom'}[port.cls] + ' at ' + port.world : 'No port',
			planets: s.kind == 'black hole' ? 'A black hole: a wormhole to anywhere, for a ship with a dimensional phaser' : sys.planets.length + (sys.planets.length == 1 ? ' planet' : ' planets') + (live ? ' · ' + live + ' living' : '') + (M.explore && M.explore.sys[s.id] != null ? ' · charted by you' : !o.owner ? ' · uncharted' : ''),
			dist: d < 1000 ? d.toFixed(d < 10 ? 2 : 1) + ' pc' : Math.round(d).toLocaleString('en-US') + ' pc', misjump: mj > 0.005 ? Math.round(mj * 100) + '%' : null};
	}
	function box(ctx, x, y, w, h) { ctx.fillStyle = C.panel; ctx.fillRect(x, y, w, h); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1) }
	function text(ctx, s, x, y, o) { o = o || {}; ctx.font = (o.weight || 500) + ' ' + (o.size || 13) + 'px ' + (o.mono ? MONO : SANS); ctx.fillStyle = o.col || C.text; ctx.textAlign = o.align || 'left'; ctx.fillText(s, x, y) }

	/* ---- control ---- */
	function zoom(f) { M.D = Math.max(0.3, Math.min(9000, M.D * f)) }
	function turn(dx, dy) { M.yaw += dx; M.pitch = Math.max(-1.45, Math.min(1.45, M.pitch + dy)) }
	function home() { if (M.here) { M.focus = at(M.here).slice(); M.D = Math.max(3 * M.range, 12) } }
	function pick(x, y) {
		let best = null; for (const h of M.hits) { const d = Math.hypot(h.x - x, h.y - y); if (d < 16 && (!best || d < best.d)) best = {h, d} }
		if (!best) return false;
		if (best.h.kind == 'cluster') { M.focus = best.h.cl.at.slice(); M.D = 450; return true }
		M.sel = best.h.s; M.info = null; return true;
	}
	function focusSel() { if (M.sel) { M.focus = at(M.sel).slice(); if (M.D > 80) M.D = 40 } }
	/* pointer input from play.js, in HUD pixels; returns an action for buttons */
	let drag = null, pinch = null;
	const pts = new Map();
	function down(p) {
		const b = (M.buttons || []).find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
		if (b) return b.act;
		pts.set(p.id, p);
		if (pts.size == 2) { const [a, c] = [...pts.values()]; pinch = {d: Math.hypot(a.x - c.x, a.y - c.y), D: M.D}; drag = null }
		else drag = {x: p.x, y: p.y, moved: 0};
		return null;
	}
	function move(p) {
		if (pts.has(p.id)) pts.set(p.id, p);
		if (pinch && pts.size == 2) { const [a, c] = [...pts.values()], d = Math.hypot(a.x - c.x, a.y - c.y); M.D = Math.max(0.3, Math.min(9000, pinch.D * pinch.d / Math.max(10, d))); return }
		if (!drag) return;
		const dx = p.x - drag.x, dy = p.y - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = p.x; drag.y = p.y;
		turn(-dx * 0.008, dy * 0.008);
	}
	function up(p) {
		pts.delete(p.id);
		if (pinch) { if (pts.size < 2) pinch = null; return }
		if (drag && drag.moved < 6) pick(p.x, p.y);
		drag = null;
	}
	M.draw = draw; M.zoom = zoom; M.turn = turn; M.home = home; M.pick = pick; M.focusSel = focusSel; M.down = down; M.move = move; M.up = up; M.describe = describe;
	return M;
}
window.EmberMap = {create};
})();
