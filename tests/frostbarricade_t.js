/* Frost Barricade in Chromium (Playwright), as the Rudolf OS desktop opens it: shooting (mouse, keys, a controller,
   touch), the weapons' effects, the barricade, day planning, losing and retrying a night, Night 15's rescue, saves.
     node tests/frostbarricade_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8201), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-frostbarricade/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES=JSON.parse(sessionStorage.getItem('saves')||'{}');
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;sessionStorage.setItem('saves',JSON.stringify(SAVES));reply({})}});
window.send=o=>document.getElementById('f').contentWindow.postMessage(Object.assign({rudolfGame:1},o),'*');
document.getElementById('f').src='www/index.html';</script>`);
async function open(pg) {
	const errs = []; pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
	await pg.goto(`http://127.0.0.1:${PORT}/desk.html`);
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 60 && !(fr() && await fr().evaluate(() => !!window.__fb).catch(() => false)); i++) await sleep(100);
	return {f: fr(), errs};
}
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		const ctx = await br.newContext({viewport: {width: 960, height: 600}});
		const pg = await ctx.newPage(); const {f, errs} = await open(pg);
		ok('1. it starts: How to play first', await f.evaluate(() => /How to play/.test(document.getElementById('ovBody').textContent)));
		await f.click('#ovBtns button');
		const t = await f.evaluate(() => ({b: [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent), age: document.querySelector('.age') && document.querySelector('.age').textContent}));
		ok('2. the title: New game, Options, How to play, and "for older players"', t.b.includes('New game') && t.b.includes('Options') && /older players/.test(t.age), t);
		await pg.screenshot({path: path.join(W, 'title.png')});
		await f.click('text=New game'); await f.click('#ovBtns button.main'); await sleep(500);
		const n1 = await f.evaluate(() => ({night: __fb.G.night, bar: [...document.querySelectorAll('#bar button')].map(b => b.textContent), q: __fb.N.q.length}));
		ok('3. Night 1 begins: the Icicle Pistol and Reload under the field, elves on their way', n1.night == 1 && /Icicle/.test(n1.bar[0]) && /Reload/.test(n1.bar.at(-1)) && n1.q > 10, n1);
		/* a click on an elf's eyes */
		const fb = await (await f.frameElement()).boundingBox();
		await f.evaluate(() => { __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = []; __fb.spawn('shambler'); const e = __fb.N.elves[0]; e.x = 500; e.lane = e.tl = 7; e.sp = 0 });
		const head = await f.evaluate(() => { const h = __fb.headOf(__fb.N.elves[0]); return {e: {x: h.x, y: h.y}} });
		const toPage = async (gx, gy) => f.evaluate(([gx, gy]) => { const c = document.getElementById('cv').getBoundingClientRect(), s = Math.min(c.width / __fb.W, c.height / __fb.H), ox = (c.width - __fb.W * s) / 2, oy = (c.height - __fb.H * s) / 2; return {x: c.left + ox + gx * s, y: c.top + oy + gy * s} }, [gx, gy]);
		let p = await toPage(head.e.x, head.e.y); await pg.mouse.move(fb.x + p.x, fb.y + p.y); await sleep(50);
		const cr = await f.evaluate(() => ({x: __fb.cross.x, y: __fb.cross.y}));
		ok('4. the mouse moves the crosshair', Math.abs(cr.x - head.e.x) < 2 && Math.abs(cr.y - head.e.y) < 2, cr);
		for (let i = 0; i < 4; i++) { await pg.mouse.click(fb.x + p.x, fb.y + p.y); await sleep(300) }
		const k1 = await f.evaluate(() => ({kills: __fb.G.kills, heads: __fb.G.heads, mag: __fb.G.wp.icicle.mag}));
		ok('5. clicks on its glowing eyes bring it down (shots at the eyes count as such)', k1.kills == 1 && k1.heads == 1 && k1.mag <= 8, k1);
		await f.focus('#cv'); await pg.keyboard.press('KeyR'); await sleep(1400);
		ok('6. R reloads', await f.evaluate(() => __fb.G.wp.icicle.mag == 10));
		/* the barricade, then Rudolf */
		const bh = await f.evaluate(() => { __fb.G.hp = 100; __fb.spawn('brute'); const e = __fb.N.elves.at(-1); e.x = 230; e.sp = 30; const b0 = __fb.G.bar; __fb.run(240); return {b0, b1: __fb.G.bar} });
		ok('7. elves at the barricade break it down', bh.b1 < bh.b0 - 10, bh);
		const rh = await f.evaluate(() => { __fb.G.bar = 0; __fb.run(400); return __fb.G.hp });
		ok('8. once it is down they reach Rudolf', rh < 100, rh);
		/* losing: the night can be tried again from its morning */
		await f.evaluate(() => { __fb.G.hp = 0; __fb.run(2) }); await sleep(200);
		ok('9. Rudolf falls: "The barricade fell", with Try the night again', await f.evaluate(() => /barricade fell/.test(document.getElementById('ovBody').textContent)));
		await f.click('text=Try the night again'); await sleep(200);
		const rt = await f.evaluate(() => ({night: __fb.G.night, bar: __fb.G.bar, hp: __fb.G.hp, q: __fb.N.q.length}));
		ok('10. ...the night starts again as it was that morning', rt.night == 1 && rt.bar == 1000 && rt.hp == 100 && rt.q > 10, rt);
		/* the weapons and their effects */
		const fx = await f.evaluate(() => {
			const G = __fb.G, N = __fb.N, out = {}; Object.keys(__fb.WEP).forEach(k => { G.wp[k].have = true; G.wp[k].mag = __fb.WEP[k].mag; G.wp[k].res = 100 });
			const line = (n, kind) => { N.q = [[1e9, 'shambler']]; N.elves = []; for (let i = 0; i < n; i++) { __fb.spawn(kind || 'brute'); const e = N.elves.at(-1); e.x = 400 + i * 40; e.lane = e.tl = 7; e.changer = e.sprinter = false; e.sp = 0; e.hp = e.hp0 = 5000 } const b = __fb.bodyOf(N.elves[0]); __fb.cross.x = b.x; __fb.cross.y = b.y };
			const shoot = (k, n) => { __fb.pick(k); N.cd = 0; N.reload = 0; for (let i = 0; i < (n || 1); i++) { __fb.fire(); __fb.run(1); N.cd = 0; N.burst = 0 } };
			line(4); shoot('hail'); out.hail = N.elves.filter(e => e.hp < 5000).length;
			line(4); shoot('aurora'); out.aurora = N.elves.filter(e => e.hp < 5000).length; out.stun = N.elves.every(e => e.hp == 5000 || e.stun > 0);
			line(3); shoot('bauble'); out.boom = N.elves.filter(e => e.hp < 5000).length;
			line(1); const x0 = N.elves[0].x; shoot('snowplow'); out.knock = N.elves[0].x - x0;
			line(1); __fb.pick('flurry'); N.cd = 0; __fb.hold(true); let ch = false; for (let i = 0; i < 120 && !ch; i++) { __fb.run(1); ch = N.elves[0].chill > 0 } __fb.hold(false); out.chill = ch;
			line(1); N.elves[0].x = 300; { const b = __fb.bodyOf(N.elves[0]); __fb.cross.x = b.x; __fb.cross.y = b.y } __fb.pick('hearth'); __fb.hold(true); __fb.run(20); __fb.hold(false); out.burn = N.elves[0].burn > 0;
			line(1); __fb.pick('bells'); N.cd = 0; __fb.hold(true); __fb.run(30); const early = 150 - G.wp.bells.mag; __fb.run(60); const later = 150 - G.wp.bells.mag - early; __fb.hold(false); out.spin = [early, later];
			line(1); __fb.pick('cane'); N.cd = 0; const m0 = G.wp.cane.mag; __fb.fire(); __fb.run(20); out.burst = m0 - G.wp.cane.mag;
			return out });
		ok('11. Hailstorm Rifle goes through three; Aurora Lance through the whole line, and stuns', fx.hail == 3 && fx.aurora == 4 && fx.stun, fx);
		ok('12. the Ornament Launcher catches the ones nearby; the Snowplow pushes back; the Flurry chills', fx.boom >= 2 && fx.knock > 10 && fx.chill === true, fx);
		ok('13. the Hearthfire sets them burning; the Sleigh-Bell Gatling winds up; the Carbine fires bursts of three', fx.burn && fx.spin[1] > fx.spin[0] * 1.5 && fx.burst == 3, fx);
		/* fifteen lanes; changing lanes and sprinting from none on Night 1 to almost half on Night 15 */
		const ln = await f.evaluate(() => { const G = __fb.G, N = __fb.N, n0 = G.night, out = {};
			const sample = night => { G.night = night; N.elves = []; for (let i = 0; i < 600; i++) __fb.spawn('shambler'); const r = {lanes: new Set(N.elves.map(e => e.lane)).size, ch: N.elves.filter(e => e.changer).length / 600, sp: N.elves.filter(e => e.sprinter).length / 600}; N.elves = []; return r };
			out.n1 = sample(1); out.n8 = sample(8); out.n15 = sample(15);
			out.counts = [1, 2, 8, 14].map(n => __fb.nightCount(n, {count: 1})); out.hp = [1, 2, 15].map(n => +__fb.hpMul(n).toFixed(3));
			/* a lane-changer drifts over gradually; a sprinter dashes */
			G.night = 15; N.q = [[1e9, 'shambler']]; __fb.spawn('shambler'); const e = N.elves[0]; e.changer = true; e.sprinter = false; e.lane = e.tl = 7; e.lcT = 0; e.x = 800; const lanes = []; for (let i = 0; i < 90; i++) { __fb.run(1); lanes.push(e.lane) }
			out.change = {from: 7, to: e.tl, steps: lanes.filter((v, i) => i && v != lanes[i - 1]).length, maxStep: Math.max(...lanes.map((v, i) => i ? Math.abs(v - lanes[i - 1]) : 0))};
			N.elves = []; __fb.spawn('shambler'); const s2 = N.elves[0]; s2.changer = false; s2.sprinter = true; s2.spT = 0; s2.x = 800; s2.sp = 20; const x0 = s2.x; __fb.run(30); out.dash = x0 - s2.x;
			N.elves = []; __fb.spawn('shambler'); const s3 = N.elves[0]; s3.changer = s3.sprinter = false; s3.x = 800; s3.sp = 20; __fb.run(30); out.walk = 800 - s3.x;
			G.night = n0; N.elves = []; return out });
		ok('11a. fifteen lanes; on Night 1 none change lanes or sprint', ln.n1.lanes == 15 && ln.n1.ch == 0 && ln.n1.sp == 0, ln.n1);
		ok('11b. on Night 15 almost half do (about 47%), and about a quarter on Night 8', Math.abs(ln.n15.ch - .47) < .07 && Math.abs(ln.n15.sp - .47) < .07 && Math.abs(ln.n8.ch - .235) < .06, {n8: ln.n8, n15: ln.n15});
		ok('11c. a lane change is gradual (a fraction of a lane a step), to a lane up to three away', ln.change.to != 7 && Math.abs(ln.change.to - 7) <= 3 && ln.change.steps > 10 && ln.change.maxStep < .05, ln.change);
		ok('11d. a sprint covers ground more than twice as fast', ln.dash > ln.walk * 2, {dash: ln.dash, walk: ln.walk});
		ok('11e. each night a few more elves, a little tougher (22, 25 … 61; ×1.000, ×1.045 … ×1.63)', ln.counts.join() == '22,25,43,61' && ln.hp.join() == '1,1.045,1.63', {c: ln.counts, hp: ln.hp});
		/* the night ends: the day's plan */
		await f.evaluate(() => { const N = __fb.N; N.q = []; N.elves = []; __fb.run(260) }); await sleep(300);
		const d = await f.evaluate(() => ({h: document.getElementById('ovBody').textContent, night: __fb.G.night}));
		ok('14. the night over: Day 1 before Night 2, with twelve hours to plan', /Day 1 · before Night 2/.test(d.h) && /12 hours/.test(d.h) && d.night == 2, d.h.slice(0, 120));
		const cap = await f.evaluate(() => { for (let i = 0; i < 20; i++) document.querySelector('[data-h=train][data-d="1"]').click(); const p = __fb.G.plan; return p.repair + p.search + p.train });
		ok('15. the hours cannot go past twelve', cap == 12, cap);
		const day = await f.evaluate(() => { __fb.G.plan = {repair: 2, search: 10, train: 0}; __fb.G.bar = 500; __fb.runDay(); return {txt: document.getElementById('ovBody').textContent, bar: __fb.G.bar} });
		ok('16. the day: the barricade repaired, and the search turns things up', day.bar == 640 && /Repaired the barricade/.test(day.txt) && /(Found|Ammunition|joins|Searched|bandages)/.test(day.txt), day);
		await f.click('#ovBtns button.main'); await sleep(200);
		ok('17. ...and Night 2 falls', await f.evaluate(() => __fb.N && __fb.G.night == 2 && !__fb.N.over));
		/* a controller: the right stick aims, the trigger fires */
		await f.evaluate(() => { __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = []; __fb.pick('icicle'); __fb.G.wp.icicle.mag = 10; window.__pad = Array.from({length: 17}, () => ({pressed: false, value: 0})); window.__ax = [0, 0, 1, 0]; navigator.getGamepads = () => [{id: 't', mapping: 'standard', axes: window.__ax, buttons: window.__pad}] });
		const c0 = await f.evaluate(() => __fb.cross.x); await sleep(300);
		await f.evaluate(() => { __ax[2] = 0; __pad[7] = {pressed: true, value: 1} }); await sleep(150); await f.evaluate(() => { __pad[7] = {pressed: false, value: 0} }); await sleep(100);
		const pd = await f.evaluate(() => ({x: __fb.cross.x, mag: __fb.G.wp.icicle.mag})); await f.evaluate(() => { navigator.getGamepads = () => [] });
		ok('18. a controller: the stick aims, the trigger fires', pd.x > c0 + 30 && pd.mag < 10, {c0, pd});
		/* pause from the desktop */
		await pg.evaluate(() => send({op: 'pause'})); await sleep(200);
		const t0 = await f.evaluate(() => __fb.N.t); await sleep(400); const t1 = await f.evaluate(() => __fb.N.t);
		ok('19. the desktop pauses it', t0 == t1 && await f.evaluate(() => /Paused/.test(document.getElementById('ovBody').textContent)));
		await pg.evaluate(() => send({op: 'resume'})); await f.click('text=Carry on');
		/* how fast with a crowd */
		const perf = await f.evaluate(() => { const N = __fb.N; N.q = [[1e9, 'shambler']]; for (let i = 0; i < 34; i++) { __fb.spawn(['shambler', 'runner', 'brute', 'crawler'][i % 4]); N.elves.at(-1).x = 230 + i * 18 } for (let i = 0; i < 40; i++) N.fx.push({k: 'p', x: 300, y: 250, vx: 1, vy: 1, t: 0, col: '#fff', life: 9}); let a = 0; for (let i = 0; i < 60; i++) { const s = performance.now(); window.__fbdraw && 0; document.getElementById('cv'); a += 0 } const s = performance.now(); for (let i = 0; i < 30; i++) __fb.run(1); return {step: (performance.now() - s) / 30} });
		const dr = await f.evaluate(() => new Promise(r => { let n = 0, s = performance.now(); const tick = () => { if (++n == 30) r((performance.now() - s) / 30); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) }));
		ok('20. 34 elves at once: a step ' + perf.step.toFixed(2) + ' ms, a frame every ' + dr.toFixed(1) + ' ms', perf.step < 3 && dr < 25, {perf, dr});
		await pg.screenshot({path: path.join(W, 'night.png')});
		/* the last night: the sleigh */
		const end = await f.evaluate(() => { const G = __fb.G; G.night = 15; G.morning = JSON.parse(JSON.stringify(G)); __fb.startNight(); G.hp = 1e9; G.bar = 1e9; G.barMax = 1e9;
			let saw = null; for (let i = 0; i < 60 * 172 && !__fb.N.over; i++) { __fb.run(1); if (__fb.N.sleigh && !saw) saw = {t: Math.round(__fb.N.t), elves: __fb.N.elves.length} }
			return {saw, over: __fb.N.over, foremen: true} });
		await sleep(300);
		const et = await f.evaluate(() => ({h: document.getElementById('ovBody').textContent, wins: __fb.save().wins, run: __fb.save().run}));
		ok('21. Night 15: Captain Quill’s sleigh comes at 150 s, and the night’s elves are gone', end.saw && end.saw.t == 150 && end.over, end);
		ok('22. the ending: Dawn, "Thank you for holding the line"; the win is kept', /Dawn/.test(et.h) && /holding the line/.test(et.h) && et.wins == 1 && !et.run, et.h.slice(0, 100));
		ok('23. no errors in the console', errs.length == 0, errs.slice(0, 4).join(' | '));
		/* saves: a game in progress carries on after the page is opened again */
		await f.evaluate(() => { __fb.newRun('normal'); __fb.G.night = 4; __fb.dawn() }); await sleep(400);
		await sleep(400); await pg.reload(); const fr2 = () => pg.frames().find(x => x.url().includes('/www/index.html')); for (let i = 0; i < 60 && !(fr2() && await fr2().evaluate(() => !!window.__fb).catch(() => false)); i++) await sleep(100); const o2 = {f: fr2()}; await sleep(300);
		const carry = await o2.f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent)[0]);
		ok('24. opened again: "Carry on · Night 5"', /Carry on · Night 5/.test(carry), carry);
		/* a phone on its side, and upright */
		const ph = await br.newContext({viewport: {width: 740, height: 360}, hasTouch: true, isMobile: true});
		const pp = await ph.newPage(); const m = await open(pp); await m.f.click('#ovBtns button');
		await m.f.evaluate(() => { document.getElementById('ov').hidden = true; __fb.newRun('normal'); __fb.startNight(); __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = [] });
		const fb3 = await (await m.f.frameElement()).boundingBox(), tp = await m.f.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(), s = Math.min(c.width / __fb.W, c.height / __fb.H), ox = (c.width - __fb.W * s) / 2, oy = (c.height - __fb.H * s) / 2; return {x: c.left + ox + 700 * s, y: c.top + oy + 220 * s} });
		await pp.touchscreen.tap(fb3.x + tp.x, fb3.y + tp.y); await sleep(200);
		const tt = await m.f.evaluate(() => ({x: Math.round(__fb.cross.x), y: Math.round(__fb.cross.y), mag: __fb.G.wp.icicle.mag}));
		ok('25. touch: a tap aims there and fires', Math.abs(tt.x - 700) < 3 && Math.abs(tt.y - 220) < 3 && tt.mag == 9, tt);
		await pp.screenshot({path: path.join(W, 'phone.png')});
		await pp.setViewportSize({width: 360, height: 640}); await sleep(300);
		const up = await m.f.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: innerWidth}));
		ok('26. upright: everything fits, no sideways scrolling', up.sw <= up.iw, up);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
