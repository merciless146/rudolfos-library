/* Ember Reach's touch controls (0.5.3) in Chromium (Playwright) with touch, at a phone's sizes, as the Rudolf OS
   desktop opens the game (a sandboxed frame): a new game started, launched, flown (the stick, the yaw bar, the
   throttle), fired while flying (two fingers at once), looked round, the radial menu, a target ahead, docking asked for
   and flown in, and a purchase at the market, all by taps and drags; the controls in portrait and landscape (inside
   the screen, a finger's size, not on top of each other), their settings (size, left-handed, opacity, sensitivity,
   kept in the save), and hidden with a mouse and keyboard.
     node tests/emberreach_touch_t.js [PORT]      (needs: playwright; python3 for the file server) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8810), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh;display:block"></iframe><script>
window.SAVES={};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}});
document.getElementById('f').src='www/index.html?'+(location.hash.slice(1)||'debug');</script>`);
const errs = [];
async function frame(pg, test, tries) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < (tries || 300); i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
/* fingers, through DevTools' touch events (real touches: the page sees touch and pointer events, several at once) */
function fingers(cdp) {
	const on = new Map();
	const send = type => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type == 'touchEnd' ? [] : [...on].map(([id, p]) => ({x: p.x, y: p.y, id}))});
	return {
		down: async (id, x, y) => { on.set(id, {x, y}); await send(on.size == 1 ? 'touchStart' : 'touchStart') },
		move: async (id, x, y) => { on.set(id, {x, y}); await send('touchMove') },
		up: async id => { on.delete(id); await send(on.size ? 'touchMove' : 'touchEnd') },
		tap: async (x, y, id = 9) => { on.set(id, {x, y}); await send('touchStart'); await sleep(60); on.delete(id); await send(on.size ? 'touchMove' : 'touchEnd') }};
}
const mid = b => b.round ? {x: b.x + b.r, y: b.y + b.r} : {x: b.x + b.w / 2, y: b.y + b.h / 2};
/* the controls' boxes: inside the screen, at least 44 px each way, none on top of another */
function layoutCheck(u, w, h) {
	const boxes = [...u.buttons.map(b => ({n: b.act, x: b.x, y: b.y, w: b.w, h: b.h})), {n: 'stick', x: u.stick.x - u.stick.r, y: u.stick.y - u.stick.r, w: 2 * u.stick.r, h: 2 * u.stick.r},
		{n: 'yaw', ...u.yaw}, {n: 'thr', ...u.thr}, {n: 'vert', ...u.vert}];
	const out = boxes.filter(b => b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h).map(b => b.n);
	const small = boxes.filter(b => b.w < 44 || b.h < 44).map(b => b.n);
	const over = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) over.push(a.n + '/' + b.n) }
	return {out, small, over, n: boxes.length};
}
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		/* ---- a phone, portrait ---- */
		const ctx = await br.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
		const pg = await ctx.newPage(), cdp = await ctx.newCDPSession(pg), T = fingers(cdp);
		pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug`);
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.tap('#ovBody button[data-i="5"]');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('[data-screen="launch"]'));
		await f.tap('[data-screen="launch"]'); await sleep(300);
		await f.evaluate(() => { const b = document.querySelector('#port [data-act="launch"]'); if (b) b.scrollIntoView() });
		if (await f.$('#port [data-act="launch"]')) await f.tap('#port [data-act="launch"]');
		f = await frame(pg, () => !EmberDebug.game.docked && document.getElementById('port').hidden);
		await sleep(1500);
		const st0 = await f.evaluate(() => ({shown: EmberDebug.touchShown(), kind: EmberDebug.game.inputKind, hud: EmberDebug.game.hudData.touch && !!EmberDebug.game.hudData.touchUI, u: EmberDebug.touchLayout()}));
		const L0 = layoutCheck(st0.u, 390, 844);
		await pg.screenshot({path: path.join(W, 'touch-portrait.png')});
		ok('1. a phone (touch, no keyboard): a new game by taps, launched, and the touch controls are there without a touch on the flight view first', st0.shown && st0.kind == 'touch' && st0.hud, st0);
		ok('2. portrait 390x844: ' + L0.n + ' controls inside the screen, each at least 44 px, none on top of another', !L0.out.length && !L0.small.length && !L0.over.length, L0);
		const B = act => st0.u.buttons.find(b => b.act == act);
		/* the throttle: a finger on the slider's top sets it full; the ship speeds up */
		const v0 = await f.evaluate(() => Math.hypot(...EmberDebug.s.v));
		await T.down(1, st0.u.thr.x + st0.u.thr.w / 2, st0.u.thr.y + 4); await sleep(150);
		const thrSet = await f.evaluate(() => EmberDebug.game.throttle); await T.up(1); await sleep(1200);
		const v1 = await f.evaluate(() => ({v: Math.hypot(...EmberDebug.s.v), thr: EmberDebug.game.throttle}));
		ok('3. the throttle slider: a finger at its top sets the throttle full, it stays there let go, and the ship speeds up', thrSet > 0.95 && v1.thr > 0.95 && v1.v > v0 + 5, {thrSet, v0, v1});
		/* two fingers at once: the stick pushed up and right, and FIRE held: the ship turns and its guns fire */
		await f.evaluate(() => { const g = EmberDebug.game; g.pcs.heat = 0; g.tgt = null; EmberDebug.s.w = [0, 0, 0] });
		const q0 = await f.evaluate(() => EmberDebug.s.q.slice());
		const sk = st0.u.stick, fire = mid(B('fire'));
		await T.down(1, sk.x, sk.y); await T.move(1, sk.x + sk.r * 0.7, sk.y - sk.r * 0.7);
		await T.down(2, fire.x, fire.y);
		let shots = 0; for (let i = 0; i < 12; i++) { await sleep(100); shots = Math.max(shots, await f.evaluate(() => EmberDebug.game.shots.length + EmberDebug.game.beams.length + (EmberDebug.game.pcs.heat > 0.005 ? 1 : 0))) }   /* (lasers: beams, and the heat they make) */
		const mt = await f.evaluate(() => ({stick: !!EmberDebug.game.touch.stick, fire: EmberDebug.game.touch.fire != null, dx: EmberDebug.game.touch.dx, dy: EmberDebug.game.touch.dy, w: EmberDebug.s.w.slice(), q: EmberDebug.s.q.slice()}));
		await T.up(2); await T.up(1); await sleep(100);
		const turned = mt.q.some((v, i) => Math.abs(v - q0[i]) > 0.01);
		const rel = await f.evaluate(() => ({stick: EmberDebug.game.touch.stick, dx: EmberDebug.game.touch.dx, fire: EmberDebug.game.touch.fire}));
		ok('4. two fingers at once: the stick (pitch and roll) turns the ship while FIRE fires its guns; both let go, the stick centres and the guns stop', mt.stick && mt.fire && mt.dx > 0.5 && mt.dy < -0.5 && turned && shots > 0 && !rel.stick && rel.dx == 0 && rel.fire == null, {mt, shots, rel, turned});
		/* the yaw bar */
		await f.evaluate(() => { EmberDebug.s.w = [0, 0, 0] });
		const yb = st0.u.yaw; await T.down(3, yb.x + yb.w - 4, yb.y + yb.h / 2);
		const yw = {v: 0, w: [0, 0, 0]}; for (let i = 0; i < 10; i++) { await sleep(100); const r = await f.evaluate(() => ({v: EmberDebug.game.touch.yaw, w: EmberFlight.toBody(EmberDebug.s.q, EmberDebug.s.w)})); yw.v = Math.max(yw.v, r.v); if (Math.abs(r.w[1]) > Math.abs(yw.w[1])) yw.w = r.w }   /* (the fastest yaw seen while held) */
		await T.up(3); await sleep(50); const yw1 = await f.evaluate(() => EmberDebug.game.touch.yaw);
		ok('5. the yaw bar: a finger at its right end yaws the ship right; let go, it centres', yw.v > 0.9 && Math.abs(yw.w[1]) > 0.05 && yw1 == 0, {yw, yw1});
		/* looking round: a drag on the empty sky turns the view (not the ship), and it eases back when let go */
		const qs = await f.evaluate(() => EmberDebug.s.q.slice());
		await T.down(4, 195, 380); for (let i = 1; i <= 6; i++) { await T.move(4, 195 + i * 25, 380 - i * 8); await sleep(30) }
		const lk = await f.evaluate(() => Object.assign({}, EmberDebug.game.look));
		await T.up(4); await sleep(1500); const lk1 = await f.evaluate(() => Object.assign({}, EmberDebug.game.look));
		await pg.screenshot({path: path.join(W, 'touch-look.png')});
		ok('6. a drag anywhere else looks round (right and up), and the view eases back when the finger lifts', lk.yaw > 0.5 && lk.pitch > 0.1 && Math.abs(lk1.yaw) < 0.05 && Math.abs(lk1.pitch) < 0.05, {lk, lk1, qs});
		/* a tap is not a click: no guns fired by the mouse events a tap leaves, and the controls stay */
		await f.evaluate(() => { EmberDebug.game.shots.length = 0; EmberDebug.game.pcs.heat = 0 });
		const tg = mid(B('target')); await T.tap(tg.x, tg.y); await sleep(300);
		const tp = await f.evaluate(() => ({shown: EmberDebug.touchShown(), shots: EmberDebug.game.shots.length + EmberDebug.game.beams.length, heat: EmberDebug.game.pcs.heat, fire: RG.down('fire')}));
		ok('7. a tap on a button (TGT) leaves no mouse click behind: the guns stay quiet and the controls stay', tp.shown && tp.shots == 0 && tp.heat < 0.005 && !tp.fire, tp);
		/* the radial menu: MENU opens it, a tap on Spotlights switches them and shuts it */
		const lights0 = await f.evaluate(() => EmberDebug.game.lights);
		const mn = mid(B('radial')); await T.tap(mn.x, mn.y); await sleep(200);
		const rd = await f.evaluate(() => ({open: !!EmberDebug.game.radial, touch: EmberDebug.game.radial && EmberDebug.game.radial.touch, items: EmberDebug.game.hudData.radial && EmberDebug.game.hudData.radial.items.map(x => x.name)}));
		await pg.screenshot({path: path.join(W, 'touch-radial.png')});
		const rr = await f.evaluate(() => EmberHUD.radialRects(innerWidth, innerHeight, EmberDebug.game.hudData.radial.items.length, EmberDebug.game.settings.hud.size / 100));
		const li = rd.items.indexOf('Spotlights'), it = rr[li];
		const radOver = []; for (let i = 0; i < rr.length; i++) for (let j = i + 1; j < rr.length; j++) { const a = rr[i], b = rr[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) radOver.push(i + '/' + j) }
		await T.tap(it.cx, it.cy); await sleep(200);
		const rd1 = await f.evaluate(() => ({open: !!EmberDebug.game.radial, lights: EmberDebug.game.lights}));
		ok('8. MENU opens the radial menu (its items a finger\'s size, inside the screen, apart); a tap on Spotlights switches them and shuts it', rd.open && rd.touch && li >= 0 && !rd1.open && rd1.lights != lights0 && !radOver.length && rr.every(b => b.h >= 44 && b.x >= 0 && b.x + b.w <= 390 && b.y >= 0 && b.y + b.h <= 844), {rd, rd1, radOver});
		/* AHEAD: the ship nearest the nose */
		await f.evaluate(() => { EmberDebug.pirates(2); const g = EmberDebug.game, s = EmberDebug.s, fw = EmberFlight.forward(s); g.npcs[1].s.p = s.p.map((v, i) => v + fw[i] * 2500); g.tgt = null }); await sleep(100);
		const ah = mid(B('ahead')); await T.tap(ah.x, ah.y); await sleep(200);
		const ta = await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, fw = EmberFlight.forward(s), ang = n => { const d = n.s.p.map((v, i) => v - s.p[i]), l = Math.hypot(...d); return Math.acos(d.reduce((t, v, i) => t + v * fw[i], 0) / l) }; const best = g.npcs[1]; const r = {tgt: g.tgt && g.tgt.name, best: best && best.name, same: g.tgt == best}; g.npcs = []; g.tgt = null; return r });
		ok('9. AHEAD targets the ship nearest the nose', ta.same && !!ta.tgt, ta);
		/* docking: DOCK asks the controller for a pad; DOCK again hands her to the Autopilot Computer, which flies her in */
		await f.evaluate(() => { const g = EmberDebug.game; g.throttle = 0; EmberDebug.game.touch.thr = null });
		const dk = mid(B('dock')); await T.tap(dk.x, dk.y); await sleep(300);
		const cl = await f.evaluate(() => EmberDebug.game.clearance && {pad: EmberDebug.game.clearance.pad, queued: EmberDebug.game.clearance.queued});
		await T.tap(dk.x, dk.y); await sleep(300);
		const ap = await f.evaluate(() => EmberDebug.game.ap && EmberDebug.game.ap.mode);
		f = await frame(pg, () => EmberDebug.game.docked && !document.getElementById('port').hidden, 1500);
		const dd = await f.evaluate(() => ({docked: EmberDebug.game.docked, port: !document.getElementById('port').hidden}));
		ok('10. DOCK gets a pad, DOCK again engages the autopilot, and she docks: the port\'s screens open', cl && cl.pad && ap == 'dock' && dd.docked && dd.port, {cl, ap, dd});
		/* the market, by taps: pick a good, buy one */
		await f.tap('[data-screen="market"]'); await sleep(300);
		const good = await f.evaluate(() => { const r = [...document.querySelectorAll('#port [data-good]')].find(x => /^\d+ t$/.test(x.children[3].textContent) && parseInt(x.children[3].textContent) > 0); return r && r.dataset.good });
		const cargo0 = await f.evaluate(() => JSON.stringify(EmberDebug.game.P.cargo || {}));
		await f.tap('#port [data-good="' + good + '"]'); await sleep(200);
		await f.tap('#port [data-act="buy"][data-n="1"]'); await sleep(300);
		const cargo1 = await f.evaluate(() => JSON.stringify(EmberDebug.game.P.cargo || {}));
		await pg.screenshot({path: path.join(W, 'touch-market.png')});
		const held = await f.evaluate(g => { const c = EmberDebug.game.P.cargo || {}; return c[g] && (c[g].n || c[g].t || c[g].qty || c[g]) }, good);
		ok('11. the market by taps: a good picked and one bought (it\'s in the hold)', good && cargo1 != cargo0 && !!held, {good, cargo0, cargo1});
		/* the settings: size, left-handed, opacity, sensitivity; kept in the save */
		const sg = await f.evaluate(() => { const g = EmberDebug.game, S = g.settings.touch, u0 = EmberDebug.touchLayout(); Object.assign(S, {size: 130, left: true, opacity: 50, sens: 150}); const u1 = EmberDebug.touchLayout(); return {r0: u0.stick.r, r1: u1.stick.r, x0: u0.stick.x, x1: u1.stick.x, thr0: u0.thr.x, thr1: u1.thr.x, a1: u1.alpha, w: innerWidth} });
		const keys = await f.evaluate(() => { const s = EmberSettings.sanitise({touch: {show: 'sideways', size: 999, opacity: 5, sens: 120, left: 'yes'}}); return s.touch });
		await f.evaluate(() => { document.querySelector('#port [data-screen="launch"]').click() }); await sleep(300);
		await f.evaluate(() => { const b = document.querySelector('#port [data-act="launch"]'); b && b.click() }); await sleep(1500);
		const saved = await pg.evaluate(() => { const s = Object.values(window.SAVES)[0]; return s && s.settings && s.settings.touch });
		ok('12. Settings: bigger controls, left-handed (the stick on the right, the throttle on the left), their opacity; kept in the save, and sanitised', sg.r1 > sg.r0 && sg.x1 > sg.w / 2 && sg.thr1 < sg.w / 2 && sg.a1 == 0.5 && saved && saved.size == 130 && saved.left === true && saved.sens == 150
			&& keys.show == 'auto' && keys.size == 150 && keys.opacity == 30 && keys.sens == 120 && keys.left === false, {sg, saved, keys});
		/* the stick's sensitivity: the same push turns her faster at 150% */
		const rate = async k => f.evaluate(async k => { const g = EmberDebug.game; g.settings.touch.sens = k; g.touch.stick = {id: 99}; g.touch.dx = 0; g.touch.dy = 0.4; EmberDebug.s.w = [0, 0, 0]; await new Promise(r => setTimeout(r, 700)); const w = EmberFlight.toBody(EmberDebug.s.q, EmberDebug.s.w); g.touch.stick = null; g.touch.dy = 0; return Math.abs(w[0]) }, k);
		const r100 = await rate(100), r150 = await rate(150);
		await f.evaluate(() => Object.assign(EmberDebug.game.settings.touch, {size: 100, left: false, opacity: 80, sens: 100}));
		ok('13. the stick\'s sensitivity: the same push pitches her faster at 150% than at 100%', r150 > r100 * 1.2, {r100, r150});
		/* a key hides the controls; the next touch brings them back */
		await pg.keyboard.press('KeyT'); await sleep(200);
		const kb = await f.evaluate(() => EmberDebug.touchShown());
		await T.tap(195, 420); await sleep(200);
		const back = await f.evaluate(() => EmberDebug.touchShown());
		ok('14. a key on a keyboard hides the touch controls; the next touch brings them back', !kb && back, {kb, back});
		/* ---- landscape ---- */
		await pg.setViewportSize({width: 844, height: 390}); await sleep(600);
		const u2 = await f.evaluate(() => EmberDebug.touchLayout()), L2 = layoutCheck(u2, 844, 390);
		const rr2 = await f.evaluate(() => EmberHUD.radialRects(844, 390, 11, 1)), ro2 = []; for (let i = 0; i < rr2.length; i++) for (let j = i + 1; j < rr2.length; j++) { const a = rr2[i], b = rr2[j]; if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) ro2.push(i + '/' + j) }
		if (ro2.length || rr2.some(b => b.x < 0 || b.y < 0 || b.x + b.w > 844 || b.y + b.h > 390)) L2.over.push('radial ' + ro2.join(','));
		await pg.screenshot({path: path.join(W, 'touch-landscape.png')});
		ok('15. landscape 844x390: ' + L2.n + ' controls (and the radial menu\'s items) inside the screen, each at least 44 px, none on top of another', !L2.out.length && !L2.small.length && !L2.over.length, L2);
		/* a small phone: 360x640 */
		await pg.setViewportSize({width: 360, height: 640}); await sleep(600);
		const u3 = await f.evaluate(() => EmberDebug.touchLayout()), L3 = layoutCheck(u3, 360, 640);
		ok('16. a small phone, 360x640: the controls inside the screen, a finger\'s size, apart', !L3.out.length && !L3.small.length && !L3.over.length, L3);
		await ctx.close();
		/* ---- a computer: mouse and keyboard ---- */
		const ctx2 = await br.newContext({viewport: {width: 1280, height: 720}});
		const pg2 = await ctx2.newPage(); pg2.on('pageerror', e => errs.push(String(e)));
		await pg2.goto(`http://127.0.0.1:${PORT}/desk.html#debug&spawn`);
		let f2 = await frame(pg2, () => !!document.querySelector('#ovBody button[data-i]'));
		await f2.click('#ovBody button[data-i="2"]');
		f2 = await frame(pg2, () => window.EmberDebug && EmberDebug.s && !EmberDebug.game.docked);
		await sleep(800);
		const m0 = await f2.evaluate(() => ({shown: EmberDebug.touchShown(), ui: EmberDebug.game.hudData.touchUI}));
		await pg2.mouse.click(640, 300); await pg2.keyboard.press('KeyR'); await sleep(300);
		const m1 = await f2.evaluate(() => ({shown: EmberDebug.touchShown(), ui: EmberDebug.game.hudData.touchUI}));
		ok('17. on a computer (mouse and keyboard, no touch screen) the touch controls stay hidden, after a click and a key too', !m0.shown && !m0.ui && !m1.shown && !m1.ui, {m0, m1});
		await ctx2.close();
		ok('18. no errors', errs.length == 0, errs.slice(0, 5));
	} catch (e) { F++; console.log('FAIL (exception) ' + (e && e.stack || e)) }
	finally { await br.close(); srv.kill(); console.log('screenshots in ' + W); console.log(P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0) }
})();
