/* Ember Reach's low-power mode (0.5.3), measured in Chromium (Playwright) with its CPU slowed four times (DevTools'
   throttling) on a phone (390 × 844 at 3 device pixels to the CSS pixel, touch): the 3D view's pixels, the frames drawn
   and the game's own time against the clock, off and on; Auto turns it on for a phone and leaves a desktop as it was.
     node tests/emberreach_power_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8814), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-power-'));
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
async function frame(pg, test) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 400; i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
const ready = () => !!(window.EmberDebug && EmberDebug.s && !document.getElementById('load'));
/* over ms: frames the browser offered, the 3D view's frames drawn (its draw calls), and game seconds per real second */
const measure = (f, ms) => f.evaluate(ms => new Promise(res => {
	const g = EmberDebug.game, gl = document.getElementById('gl'), t0 = performance.now(), gt0 = g.t; let raf = 0, drawn = 0, last = g.fpsAt;
	const tick = () => { raf++; if (g.fpsAt != last) { drawn++; last = g.fpsAt } if (performance.now() - t0 < ms) requestAnimationFrame(tick); else { const s = (performance.now() - t0) / 1000; res({raf: raf / s, drawn: drawn / s, gameRate: (g.t - gt0) / s, px: gl.width * gl.height, w: gl.width, h: gl.height}) } };
	requestAnimationFrame(tick);
}), ms);
const setPower = (f, v) => f.evaluate(v => { EmberDebug.game.settings.graphics.power = v; EmberDebug.applySettings && EmberDebug.applySettings('graphics') }, v);

(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		/* a phone: 390 × 844, 3 device pixels to the CSS pixel, the CPU four times slower */
		const ctx = await br.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, hasTouch: true, isMobile: true});
		const pg = await ctx.newPage(), cdp = await ctx.newCDPSession(pg);
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&power=0&spawn=2500`);
		const f = await frame(pg, ready); await sleep(1500);
		const auto = await f.evaluate(() => ({power: EmberDebug.game.settings.graphics.power, phone: EmberDebug.game.phone, low: EmberDebug.lowPower()}));
		ok('1. Auto: on a phone (a touch screen, its short side under 600 px) low-power mode is on', auto.power == 'auto' && auto.phone && auto.low, auto);
		await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
		await setPower(f, 'off'); await sleep(2500);
		const off = await measure(f, 6000);
		await setPower(f, 'on'); await sleep(2500);
		const on = await measure(f, 6000);
		await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
		/* the view's size alone, without the automatic resolution */
		const size = async v => { await f.evaluate(v => { EmberDebug.game.settings.graphics.autoRes = false; EmberDebug.game.settings.graphics.power = v; EmberDebug.applySettings('graphics') }, v); await sleep(2600); return f.evaluate(() => [document.getElementById('gl').width, document.getElementById('gl').height]) };
		const szOff = await size('off'), szOn = await size('on');
		console.log('  off: ' + JSON.stringify(off) + '\n  on:  ' + JSON.stringify(on));
		ok('2. on: the 3D view at the CSS pixels times 0.8 (312 × 675, not the device\'s 1170 × 2532): a fourteenth of the pixels (the automatic resolution aside)', szOn[0] == 312 && szOn[1] == 675 && szOff[0] == 1170 && szOff[1] == 2532, {szOff, szOn});
		ok('3. with the CPU four times slower (and the automatic resolution on, as it is by default), low-power mode keeps the game running better: more of the browser\'s frames go by (the main thread has room), and the game keeps time at least as well', on.raf > off.raf * 1.2 && on.gameRate >= off.gameRate * 0.95, {off, on});
		ok('4. it draws about every other frame the browser offers', on.drawn < on.raf * 0.6 && on.drawn > on.raf * 0.4, on);
		const det = await f.evaluate(() => ({quality: EmberDebug.quality}));
		ok('5. on, the models are the low-detail ones', det.quality == 'low', det);
		await ctx.close();
		/* a desktop: Auto leaves it as it was (full resolution, every frame, the models at the Quality setting) */
		const ctx2 = await br.newContext({viewport: {width: 1280, height: 720}}), pg2 = await ctx2.newPage();
		await pg2.goto(`http://127.0.0.1:${PORT}/desk.html#debug&power=0&spawn=2500`);
		const f2 = await frame(pg2, ready); await sleep(1500);
		await f2.evaluate(() => { EmberDebug.game.settings.graphics.autoRes = false; EmberDebug.applySettings('graphics') }); await sleep(2600);
		const d = await measure(f2, 3000), dd = await f2.evaluate(() => ({low: EmberDebug.lowPower(), phone: EmberDebug.game.phone, quality: EmberDebug.quality}));
		ok('6. a desktop (1280 × 720, a mouse): Auto leaves low-power mode off; the 3D view at full resolution, drawn every frame, the models at high detail', !dd.low && !dd.phone && dd.quality == 'high' && d.w == 1280 && d.h == 720 && d.drawn > d.raf * 0.9, {d, dd});
		await ctx2.close();
	} catch (e) { ok('the run', false, String(e && e.stack || e)) }
	finally { await br.close(); srv.kill() }
	fs.rmSync(W, {recursive: true, force: true});
	console.log(`\n${P}/${P + F} passed`);
	process.exit(F ? 1 : 0);
})();
