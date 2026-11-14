/* ===== Ember Reach: the renderer (docs/plan-ember-reach.md, "Technical").
   WebGL 2 where there is one; otherwise Canvas 2D (flat polygons sorted back to front, planets and stars as shaded
   discs). Positions are kept in doubles and made relative to the camera before they reach the graphics card, and
   depth is logarithmic, so a ship a few metres away and a planet an AU away draw in one pass.
   frame({cam: {p, q}, fov, items: [{id, pos, rot (3×3, column-major, with scale), light, sprite}], glows, spot, nightVision})
   spot: the ship's forward spotlights, {pos, dir, strength, cos (of the cone's edge), range}; nightVision: 0..1 (the
   image intensified and shown green).
   An item with a sprite ({radius, col, glow}) is drawn as one lit quad, not its mesh: the caller decides when
   (play.js: celestial bodies under 48 pixels across, stations beyond 500 km). The Canvas fallback draws planets
   and stars as shaded discs always.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const NEAR = 0.5, FAR = 1e14;
/* the camera's basis from a quaternion: right, up, forward */
function basis(q) {
	const [w, x, y, z] = q;
	return {r: [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)], u: [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)], f: [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)]};
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function create(canvas, opts) {
	opts = opts || {};
	let gl = null;
	if (!opts.canvas2d) try { gl = canvas.getContext('webgl2', {antialias: true, alpha: false}) } catch (e) { gl = null }
	return gl ? webgl(canvas, gl) : canvas2d(canvas);
}

/* ---------------- WebGL 2 ---------------- */
function webgl(cv, gl) {
	const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s };
	const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p };
	const head = '#version 300 es\nprecision highp float;\n';
	/* night vision: the light amplified many times over (what's dark comes up, what's bright saturates) and shown as
	   the green of an image intensifier, with a faint floor so the darkest ground still reads */
	const NV = `uniform float uNV; vec3 nightVision(vec3 c) { if (uNV <= 0.0) return c; float l = dot(c, vec3(0.3, 0.59, 0.11)); float g = 1.0 - exp(-l * 14.0) + 0.035; return mix(c, vec3(0.32, 1.0, 0.42) * g, uNV); }\n`;
	/* camera space: x right, y up, w = distance along the view; clip z puts the near plane at w = NEAR */
	const proj = `uniform vec3 uR, uU, uF; uniform vec2 uK;
vec4 project(vec3 c) { float w = dot(c, uF); return vec4(dot(c, uR) * uK.x, dot(c, uU) * uK.y, min(w - 2.0 * ${NEAR.toFixed(2)}, w * 0.999), w); }`;   /* (far off, w - 1 rounds to w in floats: keep z inside, the depth is written apart) */
	const P = {
		mesh: prog(head + proj + `
in vec3 aP, aN; in vec4 aC; uniform vec3 uOff; uniform mat3 uRot; out vec3 vN; out vec4 vC; out float vW; out vec3 vPos;
void main() { vec3 c = uOff + uRot * aP; gl_Position = project(c); vW = gl_Position.w; vN = normalize(uRot * aN); vC = aC; vPos = c; }`,
		head + NV + `in vec3 vN; in vec4 vC; in float vW; in vec3 vPos; uniform vec3 uL; uniform float uAmb; uniform vec4 uAtmo; uniform vec3 uSpotP, uSpotD; uniform vec4 uSpot; out vec4 o;
void main() { vec3 n = normalize(vN); float d = max(dot(n, uL), 0.0);
 /* the ambient isn't flat: starlight from the sky opposite the sun, so a night side's slopes still read (in night vision above all) */
 vec3 lit = vC.rgb * (uAmb * (0.35 + 0.65 * max(dot(n, -uL), 0.0)) + (1.0 - uAmb) * d);
 /* the ship's spotlights: a cone ahead of it, falling off with distance (uSpot: strength, cos of the cone's edge, range) */
 if (uSpot.x > 0.0) { vec3 L = uSpotP - vPos; float dl = length(L); vec3 l = L / max(dl, 0.001); float cone = smoothstep(uSpot.y, mix(uSpot.y, 1.0, 0.35), dot(-l, uSpotD));
  lit += vC.rgb * vec3(1.0, 0.95, 0.85) * uSpot.x * cone * max(dot(n, l), 0.0) / (1.0 + (dl / uSpot.z) * (dl / uSpot.z)); }
 o = vec4(mix(lit, vC.rgb * 1.15, vC.a), 1.0);
 /* a world's air: a rim of haze on its lit side */
 if (uAtmo.a > 0.0) { float rim = pow(1.0 - max(dot(n, -normalize(vPos)), 0.0), 3.0); o.rgb += uAtmo.rgb * uAtmo.a * rim * (0.15 + 0.85 * smoothstep(-0.2, 0.4, dot(n, uL))); }
 o.rgb = nightVision(o.rgb);
 gl_FragDepth = log2(1.0 + max(vW, 0.0)) / log2(1.0 + ${FAR.toExponential()}); }`),
		pts: prog(head + proj + `
in vec3 aP; in vec4 aC; out vec4 vC; uniform float uPx;
void main() { vec4 p = project(aP * 1e9); p.z = p.w * 0.99999; gl_Position = p; vC = aC; gl_PointSize = max(1.0, uPx * aC.a); }`,
		head + NV + `in vec4 vC; out vec4 o; void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)); o = vec4(nightVision(vC.rgb * a), 1.0); }`),
		/* a body from afar: one quad, shaded as a lit sphere (or flat bright for a star) */
		sprite: prog(head + proj + `
in vec2 aP; uniform vec3 uOff; uniform float uRad; out vec2 vQ; out float vW;
void main() { vec3 c = uOff + (uR * aP.x + uU * aP.y) * uRad; vec4 p = project(c); gl_Position = p / p.w; vW = dot(uOff, uF); vQ = aP; }`,   /* (the quad faces the camera, all at one distance: divided through here, so huge far-off ones clip cleanly) */
		head + NV + `in vec2 vQ; in float vW; uniform vec3 uCol, uLv; uniform float uGlow, uMinA; uniform vec4 uAtmo; out vec4 o;
void main() { float r = length(vQ); if (r > 1.0) discard; vec3 n = vec3(vQ.x, vQ.y, -sqrt(max(0.0, 1.0 - r * r)));
 float d = max(dot(n, uLv), 0.0); vec3 c = mix(uCol * (0.05 + 0.95 * d), uCol * 1.1, uGlow);
 c += uAtmo.rgb * uAtmo.a * pow(r, 6.0) * (0.15 + 0.85 * smoothstep(-0.2, 0.4, d));
 o = vec4(nightVision(c), 1.0); gl_FragDepth = log2(1.0 + max(vW, 0.0)) / log2(1.0 + ${FAR.toExponential()}); }`),
		glow: prog(head + `in vec2 aP; uniform vec3 uC; uniform vec2 uS; out vec2 vQ; void main() { vQ = aP; gl_Position = vec4(uC.xy + aP * uS, 0.0, 1.0); }`,
		head + `in vec2 vQ; uniform vec3 uCol; uniform float uA; out vec4 o; void main() { float r = length(vQ); float a = uA * pow(max(0.0, 1.0 - r), 2.6); o = vec4(uCol * a, 1.0); }`)
	};
	const U = {}; for (const k in P) { U[k] = {}; const n = gl.getProgramParameter(P[k], gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(P[k], i); U[k][u.name] = gl.getUniformLocation(P[k], u.name) } }
	const meshes = {};
	/* a mesh's GPU memory goes when it's replaced or the system is left (before 0.1.2 every system's meshes were kept, about
	   10 MB of memory and 8 MB of graphics memory a jump) */
	const drop = id => { const o = meshes[id]; if (!o) return; gl.deleteVertexArray(o.vao); gl.deleteBuffer(o.buf); delete meshes[id] };
	function clear() { for (const id of Object.keys(meshes)) drop(id) }
	function upload(id, m) {
		drop(id);
		const n = m.p.length / 3, buf = new Float32Array(n * 10);
		for (let i = 0; i < n; i++) { buf.set(m.p.slice(i * 3, i * 3 + 3), i * 10); buf.set(m.n.slice(i * 3, i * 3 + 3), i * 10 + 3); buf.set(m.c.slice(i * 4, i * 4 + 4), i * 10 + 6) }
		const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
		const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
		const loc = n2 => gl.getAttribLocation(P.mesh, n2);
		gl.enableVertexAttribArray(loc('aP')); gl.vertexAttribPointer(loc('aP'), 3, gl.FLOAT, false, 40, 0);
		gl.enableVertexAttribArray(loc('aN')); gl.vertexAttribPointer(loc('aN'), 3, gl.FLOAT, false, 40, 12);
		gl.enableVertexAttribArray(loc('aC')); gl.vertexAttribPointer(loc('aC'), 4, gl.FLOAT, false, 40, 24);
		gl.bindVertexArray(null);
		meshes[id] = {vao, buf: b, n};
	}
	let sky = null;
	function setSky(arr) {   /* [dx, dy, dz, r, g, b, size] per star */
		if (sky) { gl.deleteVertexArray(sky.vao); gl.deleteBuffer(sky.buf) }
		const n = arr.length / 7, buf = new Float32Array(n * 7); buf.set(arr);
		const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
		const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
		const lp = gl.getAttribLocation(P.pts, 'aP'), lc = gl.getAttribLocation(P.pts, 'aC');
		gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 28, 0);
		gl.enableVertexAttribArray(lc); gl.vertexAttribPointer(lc, 4, gl.FLOAT, false, 28, 12);
		gl.bindVertexArray(null); sky = {vao, buf: b, n};
	}
	const quadFor = pg => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW); const l = gl.getAttribLocation(pg, 'aP'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); return vao };
	const quad = quadFor(P.glow), squad = quadFor(P.sprite);
	function camUniforms(p, B, K) { gl.uniform3fv(U[p].uR, B.r); gl.uniform3fv(U[p].uU, B.u); gl.uniform3fv(U[p].uF, B.f); gl.uniform2fv(U[p].uK, K) }
	function frame(F) {
		const w = cv.width, h = cv.height; gl.viewport(0, 0, w, h);
		gl.clearColor(0.004, 0.006, 0.012, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		const B = basis(F.cam.q), fy = 1 / Math.tan((F.fov || 70) * Math.PI / 360), K = [fy * h / w, fy];
		/* the sky: stars at infinity */
		gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
		const nv = F.nightVision || 0;
		if (sky) { gl.useProgram(P.pts); camUniforms('pts', B, K); gl.uniform1f(U.pts.uNV, nv); gl.uniform1f(U.pts.uPx, Math.max(1, h / 900)); gl.bindVertexArray(sky.vao); gl.drawArrays(gl.POINTS, 0, sky.n) }
		/* glows (stars' coronae), behind the solid things */
		gl.useProgram(P.glow); gl.bindVertexArray(quad);
		for (const g of F.glows || []) {
			const d = [g.pos[0] - F.cam.p[0], g.pos[1] - F.cam.p[1], g.pos[2] - F.cam.p[2]], z = dot(d, B.f); if (z <= 0) continue;
			const sx = dot(d, B.r) * K[0] / z, sy = dot(d, B.u) * K[1] / z, s = Math.max(g.min || 0.03, g.radius / z * K[1] * (g.scale || 6));
			gl.uniform3f(U.glow.uC, sx, sy, 0); gl.uniform2f(U.glow.uS, s * h / w, s); gl.uniform3fv(U.glow.uCol, g.col); gl.uniform1f(U.glow.uA, g.alpha || 1);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
		gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE);
		/* bodies from afar, as sprites */
		gl.useProgram(P.sprite); camUniforms('sprite', B, K); gl.uniform1f(U.sprite.uNV, nv); gl.bindVertexArray(squad);
		for (const it of F.items) {
			if (!it.sprite) continue;
			const off = [it.pos[0] - F.cam.p[0], it.pos[1] - F.cam.p[1], it.pos[2] - F.cam.p[2]], z = dot(off, B.f); if (z <= 0) continue;
			/* never smaller than a pixel and a half */
			const rad = Math.max(it.sprite.radius, 1.5 * z / (K[1] * h / 2)), L = it.light || [0, 0, 1];
			gl.uniform3f(U.sprite.uOff, off[0], off[1], off[2]); gl.uniform1f(U.sprite.uRad, rad); gl.uniform3fv(U.sprite.uCol, it.sprite.col);
			gl.uniform3f(U.sprite.uLv, dot(L, B.r), dot(L, B.u), dot(L, B.f)); gl.uniform1f(U.sprite.uGlow, it.sprite.glow ? 1 : 0);
			gl.uniform4fv(U.sprite.uAtmo, it.atmo || [0, 0, 0, 0]);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
		gl.useProgram(P.mesh); camUniforms('mesh', B, K); gl.uniform1f(U.mesh.uNV, nv);
		/* the spotlights (camera-relative): F.spot = {pos, dir, strength, cos, range} */
		const sp = F.spot; if (sp) { gl.uniform3f(U.mesh.uSpotP, sp.pos[0] - F.cam.p[0], sp.pos[1] - F.cam.p[1], sp.pos[2] - F.cam.p[2]); gl.uniform3fv(U.mesh.uSpotD, sp.dir); gl.uniform4f(U.mesh.uSpot, sp.strength, sp.cos, sp.range, 0) } else gl.uniform4f(U.mesh.uSpot, 0, 0, 1, 0);
		for (const it of F.items) {
			if (it.sprite) continue;
			const m = meshes[it.id]; if (!m) continue;
			gl.uniform3f(U.mesh.uOff, it.pos[0] - F.cam.p[0], it.pos[1] - F.cam.p[1], it.pos[2] - F.cam.p[2]);
			gl.uniformMatrix3fv(U.mesh.uRot, false, it.rot); gl.uniform3fv(U.mesh.uL, it.light || [0, 0, 1]); gl.uniform1f(U.mesh.uAmb, it.amb == null ? 0.07 : it.amb);
			gl.uniform4fv(U.mesh.uAtmo, it.atmo || [0, 0, 0, 0]);
			gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n);
		}
		gl.bindVertexArray(null);
	}
	return {kind: 'webgl', upload, clear, drop, ids: () => Object.keys(meshes), setSky, frame, basis};
}

/* ---------------- Canvas 2D fallback ---------------- */
function canvas2d(cv) {
	const ctx = cv.getContext('2d'), meshes = {};
	let sky = null;
	const rgb = (c, k) => 'rgb(' + Math.min(255, c[0] * k * 255 | 0) + ',' + Math.min(255, c[1] * k * 255 | 0) + ',' + Math.min(255, c[2] * k * 255 | 0) + ')';
	function frame(F) {
		const w = cv.width, h = cv.height, B = basis(F.cam.q), fy = 1 / Math.tan((F.fov || 70) * Math.PI / 360), S = fy * h / 2;
		ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#010204'; ctx.fillRect(0, 0, w, h);
		const pr = c => { const z = dot(c, B.f); return z > NEAR ? [w / 2 + dot(c, B.r) * S / z, h / 2 - dot(c, B.u) * S / z, z] : null };
		if (sky) for (let i = 0; i < sky.length; i += 7) { const p = pr([sky[i], sky[i + 1], sky[i + 2]]); if (!p || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) continue; const s = Math.max(1, sky[i + 6] * h / 900); ctx.fillStyle = rgb([sky[i + 3], sky[i + 4], sky[i + 5]], 1); ctx.fillRect(p[0], p[1], s, s) }
		for (const g of F.glows || []) {
			const p = pr([g.pos[0] - F.cam.p[0], g.pos[1] - F.cam.p[1], g.pos[2] - F.cam.p[2]]); if (!p) continue;
			const r = Math.max((g.min || 0.03) * h / 2, g.radius / p[2] * S * (g.scale || 6)), gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
			gr.addColorStop(0, rgb(g.col, g.alpha || 1)); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(p[0] - r, p[1] - r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'source-over';
		}
		/* everything solid as a list of polygons and discs, far to near */
		const draw = [];
		for (const it of F.items) {
			const off = [it.pos[0] - F.cam.p[0], it.pos[1] - F.cam.p[1], it.pos[2] - F.cam.p[2]];
			const dsc = it.sprite || it.disc;
			if (dsc) {
				const c = pr(off); if (!c) continue;
				const r = dsc.radius / c[2] * S;
				draw.push({z: c[2], disc: true, x: c[0], y: c[1], r: Math.max(0.75, r), col: dsc.col, glow: dsc.glow, light: it.light, B, atmo: it.atmo});
				continue;
			}
			const m = meshes[it.id]; if (!m) continue;
			const R = it.rot, L = it.light || [0, 0, 1];
			if (Math.hypot(...off) > 2e6) continue;   /* a ship or port this far is under a pixel */
			for (let i = 0; i < m.p.length; i += 9) {
				const P3 = [], ok = [0, 1, 2].every(k => { const v = [m.p[i + k * 3], m.p[i + k * 3 + 1], m.p[i + k * 3 + 2]], wv = [off[0] + R[0] * v[0] + R[3] * v[1] + R[6] * v[2], off[1] + R[1] * v[0] + R[4] * v[1] + R[7] * v[2], off[2] + R[2] * v[0] + R[5] * v[1] + R[8] * v[2]], p = pr(wv); if (!p) return false; P3.push(p); return true });
				if (!ok) continue;
				const n = [m.n[i], m.n[i + 1], m.n[i + 2]], nw = [R[0] * n[0] + R[3] * n[1] + R[6] * n[2], R[1] * n[0] + R[4] * n[1] + R[7] * n[2], R[2] * n[0] + R[5] * n[1] + R[8] * n[2]], nl = Math.hypot(...nw) || 1;
				const ci = (i / 9) * 12, col = [m.c[ci], m.c[ci + 1], m.c[ci + 2]], glow = m.c[ci + 3];
				const k = glow > 0.5 ? 1.1 : 0.07 + 0.93 * Math.max(0, dot(nw, L) / nl);
				draw.push({z: (P3[0][2] + P3[1][2] + P3[2][2]) / 3, tri: P3, fill: rgb(col, k)});
			}
		}
		draw.sort((a, b) => b.z - a.z);
		for (const d of draw) {
			if (d.disc) {
				if (d.glow) { ctx.fillStyle = rgb(d.col, 1.1); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); continue }
				/* lit side towards the light, projected */
				const lx = dot(d.light, d.B.r), ly = -dot(d.light, d.B.u), gr = ctx.createRadialGradient(d.x + lx * d.r * 0.6, d.y + ly * d.r * 0.6, d.r * 0.1, d.x, d.y, d.r * 1.05);
				gr.addColorStop(0, rgb(d.col, 1.05)); gr.addColorStop(0.65, rgb(d.col, 0.45)); gr.addColorStop(1, rgb(d.col, 0.04));
				ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
				if (d.atmo && d.r > 3) { ctx.strokeStyle = 'rgba(' + (d.atmo[0] * 255 | 0) + ',' + (d.atmo[1] * 255 | 0) + ',' + (d.atmo[2] * 255 | 0) + ',' + (0.5 * d.atmo[3]).toFixed(2) + ')'; ctx.lineWidth = Math.max(1, d.r * 0.04); ctx.stroke() }
				continue;
			}
			ctx.fillStyle = d.fill; ctx.strokeStyle = d.fill; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(d.tri[0][0], d.tri[0][1]); ctx.lineTo(d.tri[1][0], d.tri[1][1]); ctx.lineTo(d.tri[2][0], d.tri[2][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
		}
	}
	return {kind: 'canvas', upload: (id, m) => { meshes[id] = m }, clear: () => { for (const id of Object.keys(meshes)) delete meshes[id] }, drop: id => { delete meshes[id] }, ids: () => Object.keys(meshes), setSky: a => { sky = a }, frame, basis};
}

const EmberRender = {create, basis, NEAR, FAR};
if (typeof module != 'undefined') module.exports = EmberRender; else root.EmberRender = EmberRender;
})(typeof window != 'undefined' ? window : this);
