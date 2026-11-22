/* Ember Reach's touch flight (0.5.3: touch.js) in Chromium (Playwright) with touch emulation, at a phone's sizes: the
   layout (nothing overlapping, nothing off the screen, every tap target at least 44 px, at every size, both hands,
   portrait and landscape), then a game flown by touch alone on a 390 × 844 phone: the stick, the yaw slider and the
   throttle, two fingers at once (fly and fire), looking round, the radial menu, a target, a docking request, docking,
   and a purchase at the market, all by taps; then the controls hidden with a mouse and keyboard, and the settings.
     node tests/emberreach_touch_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8810), TOP = path.join(__dirname, '..');
const Tc = require(path.join(TOP, 'apps/rudolf-emberreach/www/touch.js'));
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-touch-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh;display:block"></iframe><script>
window.SAVES=JSON.parse(sessionStorage.getItem('saves')||'{}');
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;sessionStorage.setItem('saves',JSON.stringify(SAVES));reply({})}});
document.getElementById('f').src='www/index.html?'+(location.hash.slice(1)||'debug');</script>`);
const errs = [];
async function frame(pg, test) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 300; i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
const ready = () => !!(window.EmberDebug && EmberDebug.s && !document.getElementById('load'));
const centre = b => b.round ? {x: b.x + b.r, y: b.y + b.r} : {x: b.x + b.w / 2, y: b.y + b.h / 2};

(async () => {
	/* ---- the layout, in node: every screen from a small phone to a desktop, every size, both hands ---- */
	const screens = [[360, 640], [360, 780], [390, 844], [412, 915], [640, 360], [780, 360], [844, 390], [915, 412], [768, 1024], [1024, 768], [1280, 720], [1920, 1080]], bad = [];
	for (const [w, h] of screens) for (const size of [75, 100, 125, 150]) for (const left of [false, true]) {
		const U = Tc.layout(w, h, {size, left}), B = Tc.boxes(U);
		B.forEach((a, i) => { if (a.x < 0 || a.y < 0 || a.x + a.w > w || a.y + a.h > h) bad.push(w + 'x' + h + '@' + size + (left ? 'L' : '') + ' off: ' + a.id); if (Math.min(a.w, a.h) < Tc.MIN) bad.push(w + 'x' + h + ' small: ' + a.id); B.forEach((b, j) => { if (j > i && Tc.overlap(a, b)) bad.push(w + 'x' + h + '@' + size + ' ' + a.id + '×' + b.id) }) });
	}
	ok('1. the layout fits every screen from 360 × 640 to 1920 × 1080, portrait and landscape, at 75-150% and both hands: nothing overlaps or is off the screen, every control at least 44 px', !bad.length, bad.slice(0, 8));
	const R = Tc.layout(390, 844, {}), L = Tc.layout(390, 844, {left: true});
	ok('2. left-handed, the layout is mirrored: the stick on the right, the throttle and FIRE on the left', R.stick.x < 195 && L.stick.x > 195 && R.thr.x > 195 && L.thr.x < 195 && L.buttons.find(b => b.act == 'fire').x < 195);
	const S1 = Tc.sanitise({show: 'sometimes', size: 400, left: 'yes', opacity: 5, sens: 'x'});
	ok('3. the touch settings are sanitised (a hand-edited save can\'t break them)', S1.show == 'auto' && S1.size == 150 && S1.left === false && S1.opacity == 20 && S1.sens == 100, S1);
	const T0 = Tc.create(), U0 = Tc.layout(844, 390, {});
	Tc.down(T0, U0, {x: U0.stick.x, y: U0.stick.y - U0.stick.r}, 1); Tc.down(T0, U0, centre(U0.buttons.find(b => b.act == 'fire')), 2); Tc.down(T0, U0, {x: U0.W / 2, y: 60}, 3);
	const ax = Tc.axes(T0, 100); Tc.move(T0, U0, {x: U0.W / 2 + 50, y: 60}, 3, 100);
	ok('4. three fingers at once: the stick pushed up (the nose up, as a gamepad\'s stick), FIRE held, and a drag elsewhere looking round', ax.pitch < -0.95 && T0.fire == 2 && T0.lookYaw > 0.2, {ax, fire: T0.fire, look: T0.lookYaw});
	Tc.up(T0, 1); Tc.up(T0, 2); Tc.up(T0, 3); for (let i = 0; i < 120; i++) Tc.step(T0, 1 / 60);
	ok('5. let go: the stick back to the middle, FIRE released, the view eased back to the nose', Tc.axes(T0, 100).pitch == 0 && T0.fire == null && T0.lookYaw == 0);

	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		/* ---- a phone, portrait: a new game 2.5 km off the capital's port ---- */
		const ctx = await br.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
		const pg = await ctx.newPage(), cdp = await ctx.newCDPSession(pg);
		pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&power=0&spawn=2500`);
		const f = await frame(pg, ready); await sleep(1500);
		const touches = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map(([x, y, id]) => ({x, y, id, radiusX: 4, radiusY: 4}))});
		const tap = async (x, y) => { await touches('touchStart', [[x, y, 9]]); await sleep(60); await touches('touchEnd', []); await sleep(120) };
		const U = await f.evaluate(() => EmberDebug.touchLayout()), btn = a => centre(U.buttons.find(b => b.act == a));
		const st0 = await f.evaluate(() => ({shown: EmberDebug.game.hudData.touch, ver: EmberDebug.BUILD.version, p: EmberDebug.s.p.slice(), q: EmberDebug.s.q.slice()}));
		await pg.screenshot({path: path.join(W, 'touch-portrait.png')});
		ok('6. on a phone the touch controls are up from the start (a coarse pointer, nothing else used yet); the build is 0.5.3', st0.shown === true && st0.ver == '0.5.3', st0);
		/* the throttle: dragged up to about half */
		const thrX = U.thr.x + U.thr.w / 2;
		await touches('touchStart', [[thrX, U.thr.y + U.thr.h - 4, 1]]); for (let k = 1; k <= 6; k++) { await touches('touchMove', [[thrX, U.thr.y + U.thr.h - 4 - k * (U.thr.h / 2 - 4) / 6, 1]]); await sleep(30) } await touches('touchEnd', []);
		await sleep(1500);
		const th = await f.evaluate(() => ({thr: EmberDebug.game.throttle, v: Math.hypot(...EmberDebug.s.v)}));
		ok('7. the throttle slider set by a drag (about 50%) holds where it\'s left, and the ship speeds up', Math.abs(th.thr - 0.5) < 0.08 && th.v > 10, th);
		/* the stick: held down for 2 s, the yaw slider to the right at the same time */
		const fw0 = await f.evaluate(() => EmberFlight.forward(EmberDebug.s));
		await touches('touchStart', [[U.stick.x, U.stick.y, 1]]); await touches('touchMove', [[U.stick.x, U.stick.y + U.stick.r * 0.9, 1]]);
		await touches('touchStart', [[U.stick.x, U.stick.y + U.stick.r * 0.9, 1], [U.yaw.x + U.yaw.w / 2, U.yaw.y + U.yaw.h / 2, 2]]); await touches('touchMove', [[U.stick.x, U.stick.y + U.stick.r * 0.9, 1], [U.yaw.x + U.yaw.w - 6, U.yaw.y + U.yaw.h / 2, 2]]);
		await sleep(300);
		const held = await f.evaluate(() => { const T = EmberDebug.game.touch; return EmberTouch.axes(T, 100) });
		await sleep(1700);
		const turned = await f.evaluate(fw => { const f2 = EmberFlight.forward(EmberDebug.s); return Math.acos(Math.max(-1, Math.min(1, f2[0] * fw[0] + f2[1] * fw[1] + f2[2] * fw[2]))) * 180 / Math.PI }, fw0);
		ok('8. the stick held down pitches (as a gamepad\'s stick), and the yaw slider (a second finger) yaws: the ship turns', held.pitch > 0.8 && held.yaw > 0.8 && turned > 20, {held, turned});
		/* two fingers: still turning on the stick, and FIRE held */
		const fire = btn('fire');
		const heat0 = await f.evaluate(() => ({heat: EmberDebug.game.pcs.heat, shots: EmberDebug.game.shots.length}));
		await touches('touchStart', [[U.stick.x, U.stick.y + U.stick.r * 0.9, 1], [fire.x, fire.y, 3]]);
		await sleep(1200);
		const fired = await f.evaluate(() => ({fire: EmberDebug.game.touch.fire, pitch: EmberTouch.axes(EmberDebug.game.touch, 100).pitch, shots: EmberDebug.game.shots.length, heat: EmberDebug.game.pcs.heat, said: EmberDebug.game.msgs.slice(-3).map(m => m.text)}));
		await pg.screenshot({path: path.join(W, 'touch-fire.png')});
		await touches('touchEnd', []); await sleep(200);
		const after = await f.evaluate(() => ({fire: EmberDebug.game.touch.fire, stick: !!EmberDebug.game.touch.stick, yaw: EmberDebug.game.touch.yaw}));
		ok('9. fly and fire at once: the stick held and FIRE held together fire the guns (the ship\'s heat rises)', fired.fire != null && fired.pitch > 0.8 && fired.heat > heat0.heat, {heat0, fired});
		ok('10. every finger lifted: FIRE, the stick and the yaw slider let go', after.fire == null && !after.stick && after.yaw == 0, after);
		/* looking round: a drag on the open sky, the reticle following the nose; the view eases back */
		await touches('touchStart', [[195, 300, 4]]); for (let k = 1; k <= 5; k++) { await touches('touchMove', [[195 + k * 20, 300, 4]]); await sleep(30) }
		await sleep(100);
		const look = await f.evaluate(() => ({yaw: EmberDebug.game.touch.lookYaw, nose: EmberDebug.game.hudData.nose}));
		await pg.screenshot({path: path.join(W, 'touch-look.png')});
		await touches('touchEnd', []); await sleep(1500);
		const back = await f.evaluate(() => ({yaw: EmberDebug.game.touch.lookYaw, nose: EmberDebug.game.hudData.nose}));
		ok('11. a drag on the open view looks round (the reticle moves with the nose, off the centre); let go, it eases back', look.yaw > 0.3 && look.nose && look.nose.x < 195 - 20 && back.yaw == 0 && !back.nose, {look, back});
		/* the radial menu: MENU, then an item */
		const menu = btn('radial'); await tap(menu.x, menu.y); await sleep(200);
		const rad = await f.evaluate(() => { const r = EmberDebug.game.hudData.radial; return r && {touch: r.touch, n: r.items.length, names: r.items.map(i => i.name), rects: r.rects} });
		await pg.screenshot({path: path.join(W, 'touch-radial.png')});
		ok('12. MENU opens the radial menu as a sheet of buttons (each at least 44 px), with Nearest hostile and Jump added for touch', rad && rad.touch && rad.names.includes('Nearest hostile') && rad.names.includes('Jump') && rad.names.includes('Third person') && rad.rects.every(r => r.w >= 44 && r.h >= 44 && r.x >= 0 && r.x + r.w <= 390), rad && rad.names);
		const tp = rad.rects[rad.names.indexOf('Third person')]; await tap(tp.x + tp.w / 2, tp.y + tp.h / 2); await sleep(300);
		const chase = await f.evaluate(() => ({chase: EmberDebug.game.chase, open: !!EmberDebug.game.radial}));
		await tap(menu.x, menu.y); await tap(10, 120); await sleep(200);
		const closed = await f.evaluate(() => ({chase: EmberDebug.game.chase, open: !!EmberDebug.game.radial}));
		ok('13. tapping an item runs it (Third person) and closes the menu; tapping outside closes it doing nothing', chase.chase && !chase.open && closed.chase && !closed.open, {chase, closed});
		await tap(menu.x, menu.y); { const r2 = await f.evaluate(() => EmberDebug.game.hudData.radial); const i = r2.items.findIndex(x => x.name == 'Third person'); await tap(r2.rects[i].x + 20, r2.rects[i].y + 20) }
		/* back on the axis, 2.5 km out, the nose on the port (where the game began), still */
		await f.evaluate(st0 => { const s = EmberDebug.s; s.p = st0.p; s.q = st0.q; s.v = [0, 0, 0]; s.w = [0, 0, 0]; EmberDebug.game.throttle = 0 }, st0); await sleep(300);
		/* TARGET: what's nearest the crosshair: the port */
		const tg = btn('target'); await tap(tg.x, tg.y);
		const tgt = await f.evaluate(() => ({nav: EmberDebug.game.nav && EmberDebug.game.nav.name, st: EmberDebug.st.name, tgt: EmberDebug.game.tgt && EmberDebug.game.tgt.name}));
		ok('14. TARGET picks what\'s nearest the crosshair: the port ahead', tgt.nav == tgt.st && !tgt.tgt, tgt);
		/* DOCK: clearance and a pad */
		const dk = btn('dock'); await tap(dk.x, dk.y); await sleep(300);
		const cl = await f.evaluate(() => ({cl: EmberDebug.game.clearance, said: EmberDebug.game.msgs.slice(-2).map(m => m.text), lit: EmberDebug.game.hudData.touchOn.dock}));
		ok('15. DOCK asks for docking: clearance granted, a pad assigned (and the button lit)', cl.cl && cl.cl.pad > 0 && cl.lit, cl);
		/* fly in: the throttle at about a fifth (under the mouth's 60 m/s), the stick untouched; flight assist matches the port's turn */
		await touches('touchStart', [[thrX, U.thr.y + U.thr.h - 4, 1]]); for (let k = 1; k <= 4; k++) { await touches('touchMove', [[thrX, U.thr.y + U.thr.h - 4 - k * (U.thr.h * 0.2) / 4, 1]]); await sleep(30) } await touches('touchEnd', []);
		let docked = false; for (let i = 0; i < 120 && !docked; i++) { await sleep(500); docked = await f.evaluate(() => EmberDebug.game.docked) }
		const dd = await f.evaluate(() => ({docked: EmberDebug.game.docked, port: !document.getElementById('port').hidden, said: EmberDebug.game.msgs.slice(-3).map(m => m.text), thr: EmberDebug.game.throttle}));
		ok('16. flown in on the throttle slider alone: docked, the starport\'s screens open (and the touch controls away)', dd.docked && dd.port, dd);
		/* the market, by taps: the Market screen, a good in stock, Buy 1 t */
		const box = async sel => { const r = await f.evaluate(s => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({block: 'center'}); const b = e.getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height} }, sel); return r };
		const mk = await box('#port [data-screen=market]'); await tap(mk.x, mk.y); await sleep(300);
		const good = await f.evaluate(() => { const rows = [...document.querySelectorAll('#port .pt-row[data-good]')]; const r = rows.find(r => /\d+ t/.test(r.textContent)); return r && r.dataset.good });
		const gb = await box('#port .pt-row[data-good="' + good + '"]'); await tap(gb.x, gb.y); await sleep(200);
		const cargo0 = await f.evaluate(g => EmberDebug.game.P.cargo[g] || 0, good);
		const buy = await box('#port [data-act=buy][data-n="1"]'); await tap(buy.x, buy.y); await sleep(300);
		const cargo1 = await f.evaluate(g => EmberDebug.game.P.cargo[g] || 0, good);
		await pg.screenshot({path: path.join(W, 'touch-market.png')});
		ok('17. at the market, by taps: Market, a good in stock (' + good + '), Buy 1 t: a tonne in the hold', mk && good && cargo1 == cargo0 + 1 && buy.h >= 44, {good, cargo0, cargo1, buy});
		ok('18. no errors in the page', !errs.length, errs.slice(0, 5));
		await ctx.close();

		/* ---- a laptop with a mouse and keyboard (and a touch screen): hidden; a touch shows them, a key hides them ---- */
		const ctx2 = await br.newContext({viewport: {width: 1280, height: 720}, hasTouch: true});
		const pg2 = await ctx2.newPage(), cdp2 = await ctx2.newCDPSession(pg2);
		await pg2.goto(`http://127.0.0.1:${PORT}/desk.html#debug&power=0&spawn=2500`);
		const f2 = await frame(pg2, ready); await sleep(1200);
		await pg2.mouse.move(640, 300); await pg2.mouse.down(); await pg2.mouse.up(); await pg2.keyboard.press('KeyR');
		const m1 = await f2.evaluate(() => ({touch: EmberDebug.game.hudData.touch, ui: !!EmberDebug.game.hudData.touchUI}));
		await cdp2.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 640, y: 200, id: 1}]}); await cdp2.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await sleep(200);
		const m2 = await f2.evaluate(() => EmberDebug.game.hudData.touch);
		await pg2.keyboard.press('KeyR'); await sleep(200);
		const m3 = await f2.evaluate(() => EmberDebug.game.hudData.touch);
		await pg2.mouse.click(640, 300); await sleep(200);
		const m4 = await f2.evaluate(() => EmberDebug.game.hudData.touch);
		ok('19. with a mouse and keyboard the touch controls stay hidden; a touch brings them up, a key or a click hides them again (Auto)', !m1.touch && !m1.ui && m2 === true && m3 === false && m4 === false, {m1, m2, m3, m4});
		/* the settings: On keeps them up whatever is used; they're kept in the save */
		await f2.evaluate(() => { EmberDebug.game.settings.touch.show = 'on'; EmberDebug.game.settings.touch.left = true; EmberDebug.game.settings.touch.size = 125 }); await pg2.keyboard.press('KeyR'); await sleep(200);
		const on = await f2.evaluate(() => ({touch: EmberDebug.game.hudData.touch, left: EmberDebug.game.hudData.touchUI.left, stickRight: EmberDebug.game.hudData.touchUI.stick.x > 640}));
		ok('20. Settings: On shows them with a keyboard in use; left-handed puts the stick on the right', on.touch && on.left && on.stickRight, on);
		await pg2.keyboard.press('Escape'); await sleep(300);
		await f2.click('#ovBtns button:nth-child(2)'); await sleep(200); await f2.click('.st-tabs button[data-tab="1"]'); await sleep(200);
		const page = await f2.evaluate(() => ({rows: [...document.querySelectorAll('.st-row label')].map(l => l.textContent), show: document.querySelector('select[data-set="touch.show"]').value, size: document.querySelector('input[data-set="touch.size"]').value}));
		ok('21. the Controls page has the touch controls\' settings: shown (Auto, On, Off), size, left-handed, opacity, sensitivity', ['Show touch controls', 'Touch control size', 'Left-handed layout', 'Touch control opacity', 'Touch sensitivity'].every(x => page.rows.includes(x)) && page.show == 'on' && page.size == '125', page);
		await f2.evaluate(() => { const s = document.querySelector('select[data-set="touch.show"]'); s.value = 'off'; s.dispatchEvent(new Event('change', {bubbles: true})) }); await sleep(1500);
		const saved = await pg2.evaluate(() => { const sv = window.SAVES['ember-reach']; return sv && sv.settings && sv.settings.touch });
		ok('22. the touch settings are kept in the save\'s settings', saved && saved.show == 'off' && saved.left === true && saved.size == 125, saved);
		await ctx2.close();
	} catch (e) { ok('the run', false, String(e && e.stack || e)) }
	finally { await br.close(); srv.kill() }
	if (process.env.KEEP) console.log('screenshots in ' + W); else fs.rmSync(W, {recursive: true, force: true});
	console.log(`\n${P}/${P + F} passed`);
	process.exit(F ? 1 : 0);
})();
