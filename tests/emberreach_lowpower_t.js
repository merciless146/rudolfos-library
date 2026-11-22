/* Ember Reach's low-power mode (0.5.3) in Chromium (Playwright): Auto is on for a phone (touch, a small screen) and
   off on a computer; on, the 3D view is smaller and plainer, 30 frames a second, fewer asteroids drawn and the ground's
   tiles on less; measured in a duel's asteroid field on a phone-sized screen (3 pixels to the point) with the CPU slowed
   four times (DevTools' CPU throttling): the main thread's drawing time falls, and the game keeps time.
     node tests/emberreach_lowpower_t.js [PORT]      (needs: playwright; python3 for the file server) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8816), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
const errs = [];
/* (the game on its own page, not in the desktop's frame, so the CPU throttling covers it) */
async function open(ctx, q) {
	const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(String(e)));
	await pg.goto(`http://127.0.0.1:${PORT}/www/index.html?debug&${q}`);
	for (let i = 0; i < 300; i++) { if (await pg.evaluate(() => !!document.querySelector('#ovBody input[name=duelShip]')).catch(() => false)) break; await sleep(100) }
	await pg.click('#ovBtns button.primary'); await sleep(1500);
	return pg;
}
/* over `ms`: frames drawn a second, the drawing's milliseconds a second (the main thread's share), and game seconds
   a second (60 updates a second kept) */
const measure = (pg, ms) => pg.evaluate(async ms => {
	const g = EmberDebug.game, a = {d: g.perf.draws, ms: g.perf.ms, t: g.t, w: performance.now()};
	await new Promise(r => setTimeout(r, ms));
	const b = {d: g.perf.draws, ms: g.perf.ms, t: g.t, w: performance.now()}, sec = (b.w - a.w) / 1000;
	return {fps: +((b.d - a.d) / sec).toFixed(1), drawMsPerSec: Math.round((b.ms - a.ms) / sec), msPerFrame: +((b.ms - a.ms) / Math.max(1, b.d - a.d)).toFixed(1), simRate: +((b.t - a.t) / sec).toFixed(2), rocks: g.lod.rocks, gl: [document.getElementById('gl').width, document.getElementById('gl').height]};
}, ms);
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		/* settings */
		const sn = await (async () => { const ctx = await br.newContext(); const pg = await ctx.newPage(); await pg.goto(`http://127.0.0.1:${PORT}/www/index.html?debug&duel`); await sleep(500);
			const r = await pg.evaluate(() => ({d: EmberSettings.DEFAULTS().graphics.power, bad: EmberSettings.sanitise({graphics: {power: 'max'}}).graphics.power, on: EmberSettings.sanitise({graphics: {power: 'on'}}).graphics.power})); await ctx.close(); return r })();
		ok('1. Settings: Low-power mode, Auto by default (On and Off kept; anything else is Auto)', sn.d == 'auto' && sn.bad == 'auto' && sn.on == 'on', sn);
		/* a phone: Auto is on */
		const ph = await br.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 3});
		const pg = await open(ph, 'duel');
		const cdp = await ph.newCDPSession(pg);
		const st = await pg.evaluate(() => { const g = EmberDebug.game; g.settings.graphics.autoRes = false; g.dynRes = 1; return {power: g.settings.graphics.power, low: EmberDebug.lowPower(), quality: EmberDebug.quality, rocks: g.rocks.length} });
		await pg.evaluate(() => { const g = EmberDebug.game; g.settings.graphics.power = 'off'; EmberDebug.applySettings('graphics') }); await sleep(600);
		await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4}); await sleep(800);
		const off = await measure(pg, 5000);
		await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
		await pg.evaluate(() => { const g = EmberDebug.game; g.settings.graphics.power = 'auto'; EmberDebug.applySettings('graphics') }); await sleep(600);
		const q1 = await pg.evaluate(() => EmberDebug.quality);
		await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4}); await sleep(800);
		const on = await measure(pg, 5000);
		await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
		console.log('  phone 390x844 at 3x, CPU slowed 4x, in the duel arena: low-power off ' + JSON.stringify(off) + '; on ' + JSON.stringify(on));
		ok('2. a phone (touch, 390x844): Auto turns low-power mode on: low detail', st.power == 'auto' && st.low && st.quality == 'low' && q1 == 'low', st);
		ok('3. on, the 3D view is at most 1.5 pixels to the point and 60% of that (here 351x760 against 1170x2532 off)', on.gl[0] <= Math.round(390 * 1.5 * 0.6) + 1 && off.gl[0] == 390 * 3, {on: on.gl, off: off.gl});
		ok('4. on, asteroids drawn only near (within 15 km; the small ones within 5 km): fewer than off', on.rocks < off.rocks, {on: on.rocks, off: off.rocks, field: st.rocks});
		ok('5. on, at most 30 frames a second', on.fps <= 31.5, on);
		ok('6. measured with the CPU slowed 4x: on, over half as many frames again as off, each drawn in less time, and the game keeps time (60 updates a second; off, it falls behind)', on.fps > off.fps * 1.5 && on.msPerFrame < off.msPerFrame && on.simRate > 0.95 && on.simRate >= off.simRate, {off, on});
		await ph.close();
		/* a computer: Auto is off, and nothing of it applies */
		const pc = await br.newContext({viewport: {width: 1280, height: 720}});
		const pg2 = await open(pc, 'duel');
		const d = await pg2.evaluate(async () => { const g = EmberDebug.game; g.settings.graphics.autoRes = false; g.dynRes = 1; EmberDebug.applySettings('graphics'); await new Promise(r => setTimeout(r, 400)); return {low: EmberDebug.lowPower(), quality: EmberDebug.quality, glow: g.settings.graphics.glow, capped: g.drawAt != null, gl: [document.getElementById('gl').width, document.getElementById('gl').height]} });
		const dm = await measure(pg2, 3000);
		console.log('  computer 1280x720: ' + JSON.stringify(dm));
		ok('7. a computer (1280x720, a mouse): Auto leaves it off: full resolution, high detail, every asteroid within 40 km, no frame cap', !d.low && d.quality == 'high' && d.gl[0] == 1280 && !d.capped && dm.rocks == 288, {d, dm});
		await pc.close();
		ok('8. no errors', errs.length == 0, errs.slice(0, 5));
	} catch (e) { F++; console.log('FAIL (exception) ' + (e && e.stack || e)) }
	finally { await br.close(); srv.kill(); console.log(P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0) }
})();
