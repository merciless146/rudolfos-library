/* Fault Lines and the game kit in Chromium (Playwright), as the Rudolf OS desktop opens them: a sandboxed frame
   (allow-scripts allow-forms allow-modals allow-downloads, no storage of its own) in a page that answers the kit's
   messages like the desktop does (saves kept by the page, pause and resume sent to the game).
     node tests/faultlines_t.js [PORT]      (needs: playwright; python3 for the file server) */
const {chromium} = require('playwright');
const {spawn, execFileSync} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8193), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'fl-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* the package as tools/publish.sh lays it out: www/ with the kit copied in */
fs.cpSync(path.join(TOP, 'apps/rudolf-faultlines/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES={};window.MSGS=[];
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;MSGS.push(m.op);
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:/theme=dark/.test(location.search),reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}});
window.send=o=>document.getElementById('f').contentWindow.postMessage(Object.assign({rudolfGame:1},o),'*');
document.getElementById('f').src='www/index.html'+location.search;</script>`);

(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	const errs = [];
	try {
		const ctx = await br.newContext({viewport: {width: 760, height: 560}, acceptDownloads: true});
		const pg = await ctx.newPage();
		pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html`);
		const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
		for (let i = 0; i < 50 && !(fr() && await fr().evaluate(() => !!window.__fl).catch(() => false)); i++) await sleep(100);
		const f = fr();
		ok('1. it starts in a sandboxed frame and greets the desktop', await f.evaluate(() => !!window.__fl && RG.inDesktop) && (await pg.evaluate(() => MSGS)).includes('hello'));
		ok('2. first start: How to play shows, and closes', await f.evaluate(() => !document.getElementById('ov').hidden && /How to play/.test(document.getElementById('ovBody').textContent)));
		await f.click('#ovBtns button');
		/* the canvas is drawn (not blank) */
		const px = await f.evaluate(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i]) n++; return n });
		ok('3. the field is drawn', px > 50, px + ' samples');
		const g0 = await f.evaluate(() => { const G = __fl.get(); return {w: G.w, h: G.h, n: G.n, state: G.state} });
		ok('4. Small: 9×9, 10 faults, waiting for the first dig', g0.w == 9 && g0.h == 9 && g0.n == 10 && g0.state == 'ready', JSON.stringify(g0));

		/* the first click: never a fault, and an area opens */
		const fb = await f.frameElement().then(e => e.boundingBox());
		const at = async (c, r) => { const p = await f.evaluate(([c, r]) => __fl.cellCenter(c, r), [c, r]); return {x: fb.x + p.x, y: fb.y + p.y} };
		let p = await at(4, 4); await pg.mouse.click(p.x, p.y); await sleep(100);
		let g = await f.evaluate(() => { const G = __fl.get(); return {state: G.state, opened: G.opened, f44: G.fault[4 * 9 + 4], faults: G.fault.reduce((a, b) => a + b, 0)} });
		ok('5. the first dig is never a fault and opens ground', g.state == 'play' && g.opened >= 9 && !g.f44 && g.faults == 10, JSON.stringify(g));
		/* right-click marks a closed cell; again unmarks */
		const closed = await f.evaluate(() => { const G = __fl.get(); for (let i = 0; i < G.open.length; i++) if (!G.open[i]) return [i % G.w, Math.floor(i / G.w)] });
		p = await at(...closed); await pg.mouse.click(p.x, p.y, {button: 'right'}); await sleep(50);
		ok('6. right-click marks (the counter goes down)', await f.evaluate(([c, r]) => __fl.get().mark[r * __fl.get().w + c] == 1 && document.getElementById('left').textContent == '9', closed));
		await pg.mouse.click(p.x, p.y, {button: 'right'}); await sleep(50);
		/* the keyboard: cursor and Space; F marks */
		await f.focus('#cv'); await pg.keyboard.press('KeyF'); await sleep(50);
		const kc = await f.evaluate(() => ({c: __fl.get() && 0}));
		ok('7. keys move a cursor that marks and opens', await f.evaluate(() => { const G = __fl.get(); return G.mark.some(x => x) || G.open[(G.h >> 1) * G.w + (G.w >> 1)] }));
		/* clearing the field wins and keeps the best time with the desktop */
		await f.evaluate(() => { const G = __fl.get(); G.mark.fill(0); G.t = 12.3 });
		for (let i = 0; i < 81; i++) {
			const c = await f.evaluate(i => { const G = __fl.get(); return !G.fault[i] && !G.open[i] && G.state == 'play' }, i);
			if (c) { p = await at(i % 9, Math.floor(i / 9)); await pg.mouse.click(p.x, p.y); await sleep(15) }
		}
		await sleep(400);
		g = await f.evaluate(() => ({state: __fl.get().state, best: __fl.save().best.small}));
		const saved = await pg.evaluate(() => SAVES['fault-lines']);
		ok('8. clearing every safe cell wins; the best time is saved with the desktop', g.state == 'won' && g.best > 0 && saved && saved.best && saved.best.small == g.best, JSON.stringify({g, saved: saved && saved.best}));
		await sleep(800);
		ok('9. a win says so', await f.evaluate(() => /Ground cleared/.test(document.getElementById('ovBody').textContent)));
		await f.click('#ovBtns button.main');

		/* opening a fault ends the game */
		await f.evaluate(() => __fl.newGame('small')); p = await at(0, 0); await pg.mouse.click(p.x, p.y); await sleep(50);
		const fc = await f.evaluate(() => { const G = __fl.get(); const i = G.fault.indexOf(1); return [i % G.w, Math.floor(i / G.w)] });
		p = await at(...fc); await pg.mouse.click(p.x, p.y); await sleep(1100);
		ok('10. opening a fault loses; the field shows every fault', await f.evaluate(() => __fl.get().state == 'lost' && /gave way/.test(document.getElementById('ovBody').textContent)));
		await f.click('#ovBtns button.main');

		/* pausing: the desktop's pause stops the clock and hides the field */
		await f.evaluate(() => __fl.newGame('medium')); p = await at(8, 8); await pg.mouse.click(p.x, p.y); await sleep(300);
		await pg.evaluate(() => send({op: 'pause'})); await sleep(100);
		const t1 = await f.evaluate(() => __fl.get().t); await sleep(1200); const t2 = await f.evaluate(() => __fl.get().t);
		ok('11. the desktop pauses it (minimised, locked): the clock stops and the field is hidden', t2 == t1 && await f.evaluate(() => RG.paused && /Paused/.test(document.getElementById('ovBody').textContent)), t1 + ' ' + t2);
		await pg.evaluate(() => send({op: 'resume'})); await f.click('#ovBtns button.main'); await sleep(1200);
		ok('12. ...and resumes', await f.evaluate(t => !RG.paused && __fl.get().t > t + .5, t2));

		/* the daily field: the same layout every time */
		const d1 = await f.evaluate(() => { __fl.newGame('daily'); return Array.from(__fl.get().fault).join('') });
		const d2 = await f.evaluate(() => { __fl.newGame('daily'); return Array.from(__fl.get().fault).join('') });
		const dg = await f.evaluate(() => ({o: __fl.get().opened, s: __fl.get().state}));
		ok('13. Daily: the same field each time, opened in the middle', d1 == d2 && d1.includes('1') && dg.o > 0 && dg.s == 'play');

		/* a controller (the standard mapping): d-pad moves, A opens */
		await f.evaluate(() => { __fl.newGame('small'); let b = Array.from({length: 17}, () => ({pressed: false, value: 0})); window.__pad = b;
			navigator.getGamepads = () => [{id: 'test', mapping: 'standard', axes: [0, 0, 0, 0], buttons: window.__pad}] });
		const press = async i => { await f.evaluate(i => __pad[i] = {pressed: true, value: 1}, i); await sleep(80); await f.evaluate(i => __pad[i] = {pressed: false, value: 0}, i); await sleep(80) };
		await press(15); await press(0); await sleep(100);
		g = await f.evaluate(() => ({state: __fl.get().state, opened: __fl.get().opened}));
		ok('14. a controller: d-pad and A dig', g.state == 'play' && g.opened > 0, JSON.stringify(g));

		/* export and import */
		const [dl] = await Promise.all([pg.waitForEvent('download'), f.evaluate(() => RG.exportSave())]);
		const txt = fs.readFileSync(await dl.path(), 'utf8'); const j = JSON.parse(txt);
		ok('15. Export save: a file with the best times', j.rudolfGame == 'fault-lines' && j.data.best.small > 0);
		await f.evaluate(() => RG.save({v: 1, best: {}, daily: {}, played: 0, won: 0}));
		const back = await f.evaluate(t => RG.importText(t).then(d => d.best.small), txt);
		const bad = await f.evaluate(() => RG.importText('{"rudolfGame":"other","data":1}').then(() => 'took', e => e.message));
		ok('16. Import save brings it back; another game\'s file is refused', back == j.data.best.small && /not a save of this game/.test(bad), bad);
		ok('17. no errors in the console', errs.length == 0, errs.slice(0, 3).join(' | '));

		/* a phone, upright, with touch: the large field turns upright; tap digs, hold marks */
		const ph = await br.newContext({viewport: {width: 360, height: 640}, hasTouch: true, isMobile: true});
		const pp = await ph.newPage(); await pp.goto(`http://127.0.0.1:${PORT}/desk.html`);
		const fr2 = () => pp.frames().find(x => x.url().includes('/www/index.html'));
		for (let i = 0; i < 50 && !(fr2() && await fr2().evaluate(() => !!window.__fl).catch(() => false)); i++) await sleep(100);
		const f2 = fr2(); await f2.click('#ovBtns button');
		const lg = await f2.evaluate(() => { __fl.newGame('large'); const G = __fl.get(), v = __fl.view(); return {w: G.w, h: G.h, fits: v.w * v.scale <= v.cw + .5 && v.h * v.scale <= v.ch + .5, sw: document.documentElement.scrollWidth, iw: innerWidth} });
		ok('18. a phone upright: Large turns to 16×30 and fits the screen, no sideways scrolling', lg.w == 16 && lg.h == 30 && lg.fits && lg.sw <= lg.iw && lg.iw <= 360, JSON.stringify(lg));
		const fb2 = await f2.frameElement().then(e => e.boundingBox());
		const at2 = async (c, r) => { const q = await f2.evaluate(([c, r]) => __fl.cellCenter(c, r), [c, r]); return {x: fb2.x + q.x, y: fb2.y + q.y} };
		const s = await f2.evaluate(() => { __fl.newGame('small'); return 1 });
		let q = await at2(4, 4); await pp.touchscreen.tap(q.x, q.y); await sleep(100);
		const tg = await f2.evaluate(() => ({state: __fl.get().state, touch: document.documentElement.classList.contains('touch'), mode: getComputedStyle(document.getElementById('mode')).display}));
		ok('19. touch: a tap digs, and the Dig/Mark switch appears', tg.state == 'play' && tg.touch && tg.mode != 'none', JSON.stringify(tg));
		const cl = await f2.evaluate(() => { const G = __fl.get(); for (let i = 0; i < G.open.length; i++) if (!G.open[i]) return [i % G.w, Math.floor(i / G.w)] });
		q = await at2(...cl);
		const cdp = await ph.newCDPSession(pp);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: q.x, y: q.y}]}); await sleep(600);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await sleep(100);
		ok('20. touch: holding marks (and does not dig)', await f2.evaluate(([c, r]) => { const G = __fl.get(); return G.mark[r * G.w + c] == 1 && !G.open[r * G.w + c] }, cl));
		/* dark theme from the desktop */
		const dk = await br.newPage(); await dk.goto(`http://127.0.0.1:${PORT}/desk.html?theme=dark`);
		await sleep(1200); const f3 = dk.frames().find(x => x.url().includes('/www/index.html'));
		ok('21. dark theme', await f3.evaluate(() => document.documentElement.classList.contains('dark') && getComputedStyle(document.body).backgroundColor != 'rgb(239, 231, 216)'));
		await pg.screenshot({path: path.join(W, 'desktop.png')}); await pp.screenshot({path: path.join(W, 'phone.png')});
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
