/* 25 Days (formerly Frost Barricade) in Chromium (Playwright), as the Rudolf OS desktop opens it: shooting (mouse, keys, a controller,
   touch), the weapons' effects, the barricade, day planning, losing and retrying a night, the weather radio and the weather, the wendigo, the last night's rescue, saves.
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
		await f.click('text=New game'); await f.click('#ovBtns button.main'); await sleep(300);
		const prep = await f.evaluate(() => ({h: document.getElementById('ovBody').textContent, radio: !!document.querySelector('.radio')}));
		ok('3a. a new game opens on the plan for Day 1, with the weather radio (tonight and tomorrow)', /Day 1 · before Night 1/.test(prep.h) && prep.radio && /Tonight, Night 1/.test(prep.h) && /Tomorrow night/.test(prep.h), prep.h.slice(0, 160));
		/* (the weather pinned clear for the checks that follow; the weather has its own) */
		await f.evaluate(() => { __fb.G.wx = Array(__fb.LAST + 1).fill('clear') });
		await f.click('text=Spend the day'); await sleep(150); await f.click('#ovBtns button.main'); await sleep(500);
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
			line(3); shoot('bauble'); __fb.run(25); out.boom = N.elves.filter(e => e.hp < 5000).length;
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
			const sample = night => { G.night = night; N.elves = []; const ks = []; for (let i = 0; i < 1200; i++) { const k = __fb.pickKind(night); ks.push(k); if (i < 600) __fb.spawn('shambler') } const nb = ks.filter(k => k != 'bloater').length; const r = {lanes: new Set(N.elves.map(e => e.lane)).size, ch: N.elves.filter(e => e.changer).length / 600, sp: ks.filter(k => k == 'sprinter' || k == 'mugger').length / nb, mug: ks.filter(k => k == 'mugger').length}; N.elves = []; return r };
			out.n1 = sample(1); out.n8 = sample(8); out.n15 = sample(15);
			out.counts = [1, 2, 8, 14].map(n => __fb.nightCount(n, {count: 1})); out.hp = [1, 2, 15].map(n => +__fb.hpMul(n).toFixed(3));
			/* a lane-changer drifts over gradually; a sprinter dashes */
			G.night = 15; N.q = [[1e9, 'shambler']]; __fb.spawn('shambler'); const e = N.elves[0]; e.changer = true; e.sprinter = false; e.lane = e.tl = 7; e.lcT = 0; e.x = 800; const lanes = []; for (let i = 0; i < 90; i++) { __fb.run(1); lanes.push(e.lane) }
			out.change = {from: 7, to: e.tl, steps: lanes.filter((v, i) => i && v != lanes[i - 1]).length, maxStep: Math.max(...lanes.map((v, i) => i ? Math.abs(v - lanes[i - 1]) : 0))};
			N.elves = []; __fb.spawn('sprinter'); const s2 = N.elves[0]; s2.changer = false; s2.spT = 0; s2.x = 800; s2.sp = 20; const x0 = s2.x; __fb.run(30); out.dash = x0 - s2.x;
			N.elves = []; __fb.spawn('shambler'); const s3 = N.elves[0]; s3.changer = s3.sprinter = false; s3.x = 800; s3.sp = 20; __fb.run(30); out.walk = 800 - s3.x;
			G.night = n0; N.elves = []; return out });
		ok('11a. fifteen lanes; on Night 1 none change lanes, sprint or mug', ln.n1.lanes == 15 && ln.n1.ch == 0 && ln.n1.sp == 0, ln.n1);
		ok('11b. on Night 15 almost half are sprinters or muggers (about 47%), about a quarter on Night 8; muggers among them', Math.abs(ln.n15.sp - .47) < .07 && Math.abs(ln.n8.sp - .235) < .06 && ln.n15.mug > 100 && Math.abs(ln.n15.ch - .47) < .07, {n8: ln.n8, n15: ln.n15});
		ok('11c. a lane change is gradual (a fraction of a lane a step), to a lane up to three away', ln.change.to != 7 && Math.abs(ln.change.to - 7) <= 3 && ln.change.steps > 10 && ln.change.maxStep < .05, ln.change);
		ok('11d. a sprinter’s dash covers ground more than twice as fast', ln.dash > ln.walk * 2, {dash: ln.dash, walk: ln.walk});
		ok('11e. each night a few more elves, a little tougher (22, 25 … 61; ×1.000, ×1.045 … ×1.63)', ln.counts.join() == '22,25,43,61' && ln.hp.join() == '1,1.045,1.63', {c: ln.counts, hp: ln.hp});
		/* eyes; bloaters; muggers */
		const ey = await f.evaluate(() => { const E = FBART.ELF, c = k => E[k].eye; return {white: ['shambler', 'crawler', 'spitter', 'brute', 'foreman'].map(c), red: c('sprinter'), yellow: c('bloater'), green: c('mugger')} });
		ok('11f. eyes: white for the ordinary elves, red sprinters, yellow bloaters, green muggers', ey.white.every(x => x == '#eef2ff') && ey.red == '#ff3b3b' && ey.yellow == '#ffd23f' && ey.green == '#7dff4a', ey);
		const bl = await f.evaluate(() => { const G = __fb.G, N = __fb.N; G.night = 6; G.hp = 100; G.bar = 1000; G.barMax = 1000;
			G.surv = [{name: 'Near', kind: 'fox', role: 'guard', hp: 40}, {name: 'Far', kind: 'owl', role: 'guard', hp: 40}];
			N.q = [[1e9, 'shambler']]; N.elves = [];
			__fb.spawn('bloater'); const b = N.elves[0]; b.lane = b.tl = 3; b.x = FBART.front(3) + 6; b.sp = 0; const big = {hp: b.hp0, s: FBART.ELF.bloater.s};
			const near = () => { __fb.spawn('shambler'); const e = N.elves.at(-1); e.lane = e.tl = 3; e.sp = 0; e.hp = e.hp0 = 1000; e.changer = false; return e };
			const e1 = near(); e1.x = b.x + 20; const e2 = near(); e2.x = b.x + 90; const e3 = near(); e3.x = b.x + 300;
			const bar0 = G.bar; b.hp = .01; b.burn = 1; __fb.run(1);
			return {big, bar: bar0 - G.bar, d1: 1000 - e1.hp, d2: 1000 - e2.hp, d3: 1000 - e3.hp, near: 40 - G.surv[0].hp, far: 40 - G.surv[1].hp, rudolf: 100 - G.hp} });
		ok('11g. bloaters are bigger and tougher than the ordinary ones', bl.big.s > 1.3 && bl.big.hp > 150, bl.big);
		ok('11h. a bloater bursts when it falls: the barricade, elves nearby (more the nearer), survivors near it', bl.bar > 100 && bl.d1 > bl.d2 && bl.d2 > 0 && bl.d3 == 0 && bl.near > bl.far && bl.near > 0, bl);
		const mg = await f.evaluate(() => { const G = __fb.G, N = __fb.N; G.bar = 1000; G.surv = [{name: 'Hazel', kind: 'bunny', role: 'guard', hp: 40}, {name: 'Moss', kind: 'badger', role: 'repair', hp: 40}];
			N.q = [[1e9, 'shambler']]; N.elves = []; __fb.spawn('mugger'); const m = N.elves[0]; m.lane = m.tl = 7; m.x = 600; const lanes = []; for (let i = 0; i < 180; i++) { __fb.run(1); lanes.push(m.lane) }
			const flips = lanes.filter((v, i) => i > 1 && Math.sign(v - lanes[i - 1]) != Math.sign(lanes[i - 1] - lanes[i - 2]) && v != lanes[i - 1]).length, span = Math.max(...lanes) - Math.min(...lanes), walked = 600 - m.x;
			m.x = FBART.front(m.lane) - 1; __fb.run(3); const stole = {loot: m.loot, hazel: G.surv[0].disarmed, moss: G.surv[1].disarmed};
			const x1 = m.x; __fb.run(30); const fled = m.x - x1;
			m.hp = .01; m.burn = 1; __fb.run(1); const back = !G.surv[0].disarmed;
			/* a second one gets away */
			N.elves = []; __fb.spawn('mugger'); const m2 = N.elves[0]; m2.lane = m2.tl = 7; m2.x = FBART.front(7) - 1; __fb.run(3); const took = G.surv[0].disarmed; m2.x = __fb.W + 20; __fb.run(20); const lost = G.surv[0].disarmed && m2.dead;
			N.elves = []; return {flips, span, walked, stole, fled, back, took, lost} });
		ok('11i. a mugger comes on slowly, shifting lanes quickly back and forth', mg.flips >= 3 && mg.span >= 2 && mg.walked < 80, mg);   /* (25 Days: elves are 30% faster) */
		ok('11j. at the barricade it steals a survivor’s weapon (a guard’s first) and runs for the woods', mg.stole.loot == 0 && mg.stole.hazel && !mg.stole.moss && mg.fled > 30, mg);
		ok('11k. brought down before it gets away: the weapon is back; if it escapes: gone for the night', mg.back && mg.took && mg.lost, mg);
		const nn = await f.evaluate(() => { __fb.G.wx = Array(26).fill('clear'); __fb.G.night = 7; __fb.startNight(); return __fb.G.surv.every(s => !s.disarmed && !s.out) });
		ok('11l. the next night every survivor is armed again', nn);
		await f.evaluate(() => { const G = __fb.G; G.night = 1; G.surv = []; __fb.startNight(); __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = [] });
		/* ---------- the weather ---------- */
		const sch = await f.evaluate(() => { const bad = [], moonDays = {}; let n = 0;
			for (let i = 0; i < 500; i++) { const w = __fb.makeWeather('seed' + i); n++;
				if (w.length != 26) bad.push('len');
				for (let d = 1; d <= 7; d++) if (w[d] != 'clear' && w[d] != 'fog') bad.push('early ' + d + ' ' + w[d]);
				if ((w[8] == 'blizzard') == (w[9] == 'blizzard')) bad.push('8/9');
				if ((w[17] == 'blizzard') == (w[18] == 'blizzard')) bad.push('17/18');
				for (const d of [8, 9, 17, 18]) if (w[d] != 'blizzard' && w[d] != 'clear' && w[d] != 'fog' && w[d] != 'moon') bad.push('other ' + d);
				if (w[23] != 'blizzard' || w[24] != 'blizzard' || w[25] != 'blizzard') bad.push('23-25');
				const moons = w.map((x, d) => x == 'moon' ? d : 0).filter(Boolean); if (moons.length != 1 || moons[0] < 8 || moons[0] > 22) bad.push('moon ' + moons);
				moonDays[moons[0]] = (moonDays[moons[0]] || 0) + 1;
				for (let d = 1; d <= 25; d++) if (w[d] == 'blizzard' && ![8, 9, 17, 18, 23, 24, 25].includes(d)) bad.push('stray blizzard ' + d);
			}
			const by = (a, b) => Object.entries(moonDays).filter(([d]) => d >= a && d <= b).reduce((s, [, c]) => s + c, 0) / n;
			return {bad: bad.slice(0, 5), early: by(8, 14), mid: by(15, 20), late: by(21, 22)} });
		ok('W1. the schedule: days 1-7 clear or fog; a blizzard on 8 or 9, on 17 or 18, and on 23-25; one full moon, days 8-22, never on a blizzard', sch.bad.length == 0, sch.bad);
		ok('W2. the full moon: most often in days 8-14 (20% a day there), then 15-20, rarely as late as 21-22', sch.early > .6 && sch.early < .9 && sch.mid > .1 && sch.late < .1, sch);
		const rad = await f.evaluate(() => { const G = __fb.G, keep = [G.night, G.wx], out = {};
			G.wx = Array(26).fill('clear'); G.wx[8] = 'blizzard'; G.wx[23] = G.wx[24] = G.wx[25] = 'blizzard'; G.wx[12] = 'fog'; G.wx[13] = 'moon';
			G.night = 7; out.d7 = __fb.radio(); G.night = 12; out.d12 = __fb.radio(); G.night = 22; out.d22 = __fb.radio(); G.night = 8; G.plan = {repair: 2, search: 6, train: 2}; __fb.dayScreen();
			out.d8 = {dis: [...document.querySelectorAll('[data-h=search]')].every(b => b.disabled), search: G.plan.search, txt: document.getElementById('ovBody').textContent};
			G.night = keep[0]; G.wx = keep[1]; return out });
		ok('W3. the radio: tonight and tomorrow; a blizzard warning the day before one', /Tonight, Night 7: Clear/.test(rad.d7) && /Tomorrow night:<\/b> a blizzard/.test(rad.d7) && /Blizzard warning for tomorrow/.test(rad.d7) && /Night 12: Fog/.test(rad.d12) && /full moon/.test(rad.d12), rad.d7);
		ok('W4. Day 22 always warns of the great blizzard', /Storm warning/.test(rad.d22) && /three nights/.test(rad.d22), rad.d22);
		ok('W5. in a blizzard nobody can search: the hours go to repairs and Search is off', rad.d8.dis && rad.d8.search == 0 && /not in a blizzard/.test(rad.d8.txt), rad.d8);
		const srch = await f.evaluate(() => { const G = __fb.G, keep = JSON.stringify(G), out = {clear: 0, fog: 0, lostC: 0, lostF: 0, bliz: ''};
			const found = t => (t.match(/Found the|Ammunition for|joins the barricade|bandages/g) || []).length;
			for (const wx of ['clear', 'fog']) for (let i = 0; i < 40; i++) { const g = JSON.parse(keep); g.seed = 's' + i; g.night = 6; g.wx = Array(26).fill(wx); g.plan = {repair: 0, search: 12, train: 0};
				g.surv = ['A', 'B', 'C', 'D', 'E', 'F'].map(n => ({name: n, kind: 'fox', role: 'scout'})); __fb.G = g; __fb.runDay(); const t = document.getElementById('ovBody').textContent; out[wx] += found(t); out[wx == 'clear' ? 'lostC' : 'lostF'] += 6 - __fb.G.surv.length }
			const g = JSON.parse(keep); g.night = 8; g.wx = Array(26).fill('blizzard'); g.plan = {repair: 6, search: 6, train: 0}; __fb.G = g; __fb.runDay(); out.bliz = document.getElementById('ovBody').textContent;
			__fb.G = JSON.parse(keep); return out });
		ok('W6. clear days find more than foggy ones (searching quicker, fog finds less)', srch.clear > srch.fog * 1.5, srch);
		ok('W7. scouts sent out in fog are more often lost', srch.lostF > srch.lostC && srch.lostF > 10, {lostC: srch.lostC, lostF: srch.lostF});
		ok('W8. a blizzard day: no searching at all', /kept everyone inside/.test(srch.bliz) && !/Found the|Ammunition for|joins the/.test(srch.bliz), srch.bliz.slice(0, 120));
		const fog = await f.evaluate(() => { const G = __fb.G, N = __fb.N, out = {}; G.wx = Array(26).fill('clear'); G.wx[G.night] = 'fog'; __fb.startNight(); __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = [];
			const N2 = __fb.N; __fb.cross.x = 700; __fb.cross.y = 280;
			__fb.spawn('shambler'); const a = N2.elves[0]; a.x = 700; a.lane = a.tl = 3; a.sp = 0; a.changer = false;
			__fb.spawn('shambler'); const b = N2.elves[1]; b.x = 330; b.lane = b.tl = 14; b.sp = 0; b.changer = false;
			out.seenA = __fb.seen(__fb.headOf(a).x, __fb.headOf(a).y); out.seenB = __fb.seen(__fb.headOf(b).x, __fb.headOf(b).y);
			const rips = []; for (let i = 0; i < 200; i++) { __fb.run(1); N2.fx.forEach(f => { if (f.k == 'rip' && f.t == 0 || f.k == 'rip' && !rips.includes(f)) rips.push(f) }) } out.ripB = rips.some(r => Math.abs(r.x - b.x) < 2 && r.y > 340); out.ripA = rips.some(r => Math.abs(r.x - a.x) < 2 && r.y < 300);
			/* the blizzard: narrower; no ripples; no sprints; the survivors' bolts go astray */
			G.wx[G.night] = 'blizzard'; G.surv = [{name: 'G1', kind: 'fox', role: 'guard'}]; __fb.startNight(); const N3 = __fb.N; N3.q = [[1e9, 'shambler']]; N3.elves = [];
			__fb.spawn('sprinter'); const sp = N3.elves[0]; sp.x = 800; sp.spT = 0; sp.hp = sp.hp0 = 1e6; let sprinted = false;
			for (let i = 0; i < 400; i++) { __fb.run(1); if (sp.sprint > 0) sprinted = true }
			out.bliz = {rips: N3.fx.filter(f => f.k == 'rip').length, sprinted, missed: G.surv[0].missed || 0, far: __fb.seen(700, 280)};
			G.surv = []; return out });
		ok('W9. fog: only what lies in the nose’s light is seen; out of it, an elf shows as ripples of sound', fog.seenA !== fog.seenB && (fog.seenA ? fog.ripB && !fog.ripA : fog.ripA && !fog.ripB), fog);
		ok('W10. a blizzard: a shorter, narrower view, no ripples, no sprinting, and bolts go astray', !fog.bliz.far && fog.bliz.rips == 0 && !fog.bliz.sprinted && fog.bliz.missed > 0, fog.bliz);
		const moon = await f.evaluate(() => { const G = __fb.G; G.wx = Array(26).fill('clear'); G.wx[12] = 'moon'; const ks = {}; for (let i = 0; i < 300; i++) { const k = __fb.pickKind(12); ks[k] = (ks[k] || 0) + 1 }
			G.night = 12; __fb.startNight(); const q = __fb.N.q.map(x => x[1]); return {ks, screech: q.includes('screech'), wend: q.filter(k => k == 'wendigo').length, order: q.indexOf('screech') < q.indexOf('wendigo')} });
		ok('W11. the full moon: no white-eyed elves (all run, red-eyed), and a wendigo comes, screeching first', !moon.ks.shambler && !moon.ks.crawler && !moon.ks.spitter && !moon.ks.brute && moon.ks.sprinter > 100 && moon.screech && moon.wend == 1 && moon.order, moon);
		const nw = await f.evaluate(() => { const G = __fb.G, keep = G.wx; G.wx = __fb.makeWeather('x'); const c = n => { G.night = n; __fb.startNight(); return __fb.N.q.filter(x => x[1] == 'wendigo').length }; const out = {n17: c(17) + c(18), n24: c(24), n25: c(25)}; G.wx = keep; return out });
		ok('W12. wendigos: one on Night 24, two on Night 25; none in the earlier blizzards', nw.n24 == 1 && nw.n25 == 2 && nw.n17 == 0, nw);
		const wg = await f.evaluate(() => { const G = __fb.G; G.wx = Array(26).fill('clear'); G.night = 12; G.hp = 100; __fb.startNight(); const N = __fb.N; N.q = [[1e9, 'shambler']]; N.elves = []; G.bar = 1000; G.barMax = 1000;
			G.surv = [{name: 'InLane', kind: 'fox', role: 'guard', hp: 40}, {name: 'Away', kind: 'owl', role: 'guard', hp: 40}];   /* (lanes 3 and 11) */
			__fb.spawn('screech'); const msg = N.msg && N.msg.text;
			__fb.spawn('wendigo'); const w = N.elves[0]; w.x = 700; w.lane = 1; w.tl = 7; w.wT = 1e9; const big = {s: FBART.ELF.wendigo.s, hp: w.hp0, eye: FBART.ELF.wendigo.eye, sp: w.sp};
			const l0 = w.lane, x0 = w.x; for (let i = 0; i < 120; i++) __fb.run(1); const drift = {lane: w.lane - l0, walked: x0 - w.x};
			/* only one at a time: a second screech waits */
			N.q = [[N.t, 'screech'], [N.t + 3.5, 'wendigo'], [1e9, 'shambler']]; for (let i = 0; i < 400; i++) __fb.run(1); const one = N.elves.filter(e => e.kind == 'wendigo').length, waiting = N.q.some(q => q[1] == 'wendigo');
			/* a charge in lane 3: 1.5 s standing still, then the screech down the lane */
			w.lane = w.tl = 3; w.x = 600; w.wT = 0; const bar0 = G.bar; __fb.run(1); const xs = w.x; let shook = false, charged = 0;
			for (let i = 0; i < 89; i++) { __fb.run(1); if (w.wmode == 'charge') charged++ }
			const still = Math.abs(w.x - xs) < .01; __fb.run(2); shook = N.shake > 0; const wave = N.waves.length;
			for (let i = 0; i < 90; i++) __fb.run(1);
			const lane3 = {inLane: 40 - G.surv[0].hp, away: 40 - G.surv[1].hp, bar: bar0 - G.bar, rudolf: N.rstun > 0 || N.deafT >= 0};
			/* now in Rudolf's lane: stunned, blurred and deafened; full for 3 s, fading after */
			w.lane = w.tl = 7; w.wT = 0; for (let i = 0; i < 200 && N.deafT < 0; i++) __fb.run(1);
			const stun = N.rstun > 0, mag = G.wp.icicle.mag; __fb.fire(); __fb.run(2); const firedWhileStunned = G.wp.icicle.mag < mag;
			for (let i = 0; i < 170; i++) __fb.run(1); const k1 = __fb.deafK(); for (let i = 0; i < 60; i++) __fb.run(1); const k2 = __fb.deafK(); for (let i = 0; i < 40; i++) __fb.run(1); const k3 = __fb.deafK();
			return {msg, big, drift, one, waiting, charged, still, shook, wave, lane3, stun, firedWhileStunned, k: [k1, +k2.toFixed(2), k3]} });
		ok('W13. a screech before a wendigo: huge, red-eyed, very tough, slow', /screech/.test(wg.msg) && wg.big.s > 2 && wg.big.hp > 2000 && wg.big.eye == '#ff3b3b' && wg.big.sp < 16, wg.big);
		ok('W14. it comes on slowly, drifting towards Rudolf’s lane; only one at a time (the next screech waits)', wg.drift.lane > .3 && wg.drift.lane < 1.2 && wg.drift.walked > 5 && wg.drift.walked < 40 && wg.one == 1 && wg.waiting, {drift: wg.drift, one: wg.one, waiting: wg.waiting});
		ok('W15. it stops for 1.5 s to charge, then screeches down its lane with the screen shaking', wg.still && wg.charged >= 88 && wg.wave == 1 && wg.shook, wg);
		ok('W16. the screech hurts survivors in its lane, not the barricade, and not those out of it', wg.lane3.inLane > 0 && wg.lane3.away == 0 && wg.lane3.bar == 0 && !wg.lane3.rudolf, wg.lane3);
		ok('W17. in Rudolf’s lane: stunned (no shooting), sight blurred and ears ringing for 3 s, then fading to nothing', wg.stun && !wg.firedWhileStunned && wg.k[0] == 1 && wg.k[1] > 0 && wg.k[1] < 1 && wg.k[2] == 0, wg);
		/* ---------- shielders ---------- */
		const sh = await f.evaluate(() => { const G = __fb.G; G.wx = Array(26).fill('clear'); G.night = 8; G.surv = []; G.skill = 30; __fb.startNight(); const N = __fb.N; N.q = [[1e9, 'shambler']]; N.elves = [];
			const mk = (k, x, lane) => { __fb.spawn(k); const e = N.elves.at(-1); e.x = x; e.lane = e.tl = lane; e.sp = 0; e.changer = false; return e };
			const a = mk('shielder', 500, 7), base = {eye: FBART.ELF.shielder.eye, hp: a.hp0, sham: (() => { const s = mk('shambler', 800, 2); const h = s.hp0; s.dead = true; return h })()};
			const shoot = (x, y, k) => { __fb.pick(k || 'icicle'); const st = G.wp[k || 'icicle']; st.have = true; st.mag = 99; __fb.cross.x = x; __fb.cross.y = y; N.cd = 0; N.reload = 0; __fb.fire(); __fb.run(1) };
			const hp0 = a.hp; const b = __fb.bodyOf(a), h = __fb.headOf(a); shoot(b.x, b.y); shoot(h.x, h.y); const blocked = a.hp == hp0;
			const lg = __fb.legsOf(a); shoot((lg.x0 + lg.x1) / 2, lg.y1 - 3); const legs = a.hp < hp0;
			/* the shield covers waist to head */
			const box = __fb.shieldBox(a); const covers = box.y1 >= b.y + 4 && box.y0 <= h.y - h.r && lg.y0 >= box.y1 - .5;
			/* a piercing shot stops at the shield */
			const c = mk('shambler', 420, 7); c.hp = c.hp0 = 500; const behind = mk('shambler', 560, 7); behind.hp = behind.hp0 = 500; const s0 = a.hp; const cb = __fb.bodyOf(c); shoot(cb.x, cb.y, 'hail'); const pierce = {front: c.hp < 500, shield: a.hp == s0, behind: behind.hp == 500};
			c.dead = true; behind.dead = true; N.run && 0;
			/* a blast knocks it loose and back */
			const x1 = a.x; G.wp.bauble.have = true; shoot(a.x - 4, __fb.bodyOf(a).y, 'bauble'); __fb.run(25); const blast = {dropped: !a.shield, back: a.x - x1, onField: N.shields.length};
			return {base, blocked, legs, covers, pierce, blast} });
		ok('S1. shielders: cyan eyes, tougher than ordinary elves', sh.base.eye == '#3ff0ff' && sh.base.hp > sh.base.sham * 1.5, sh.base);
		ok('S2. the shield stops shots at the body and head; the lower legs can be hit; it covers waist, chest and head', sh.blocked && sh.legs && sh.covers, sh);
		ok('S3. a piercing shot stops at a shield', sh.pierce.front && sh.pierce.shield && sh.pierce.behind, sh.pierce);
		ok('S4. a blast knocks the shield loose and the shielder back', sh.blast.dropped && sh.blast.back > 10 && sh.blast.onField == 1, sh.blast);
		const sb = await f.evaluate(() => { const G = __fb.G, out = {}; const setup = n => { G.night = n; G.surv = []; __fb.startNight(); const N = __fb.N; N.q = [[1e9, 'shambler']]; N.elves = []; return N };
			const mk = (N, k, x, lane) => { __fb.spawn(k); const e = N.elves.at(-1); e.x = x; e.lane = e.tl = lane; e.changer = false; return e };
			/* Bash at the barricade */
			let N = setup(8); const a = mk(N, 'shielder', FBART.front(7) - 1, 7); a.sp = 0; __fb.run(2); const bx = __fb.bodyOf(a); __fb.cross.x = bx.x; __fb.cross.y = bx.y; const x0 = a.x; const hit = __fb.bash(); out.bash = {hit, dropped: !a.shield, back: a.x - x0};
			const again = __fb.bash(); out.cooldown = again === undefined;
			/* Night 9: it does not go back for the shield; Night 10: it does */
			const pick = n => { const N = setup(n); const e = mk(N, 'shielder', 600, 7); e.sp = 20; __fb.dropShield(e, 30); let got = false; for (let i = 0; i < 300 && !got; i++) { __fb.run(1); got = e.shield } return got };
			out.n9 = pick(9); out.n10 = pick(10);
			/* Night 18: an ordinary elf may take up a dead shielder's shield; it keeps white eyes and its own health; not before 18 */
			const take = n => { let took = 0, hpOk = true; const seed = G.seed; for (let k = 0; k < 12; k++) { G.seed = 'take' + n + ':' + k; const N = setup(n); const s = mk(N, 'shielder', 600, 7); __fb.dropShield(s, 0); s.dead = true; N.elves = N.elves.filter(e => !e.dead);
				const r = mk(N, 'shambler', 640, 7); r.sp = 20; for (let i = 0; i < 200; i++) __fb.run(1); if (r.shield) { took++; if (r.hp0 != __fb.hpMul(n) * 44 * 1 && Math.abs(r.hp0 - r.hp0) > 0) hpOk = false; out.eye = FBART.ELF[r.kind].eye; out.kind = r.kind; out.hp = [r.hp0, __fb.hpMul(n) * 44 * {easy: .8, normal: 1, hard: 1.2}[G.diff]] } } G.seed = seed; return {took, hpOk} };
			out.n17 = take(17); out.n18 = take(18);
			/* a living shielder's shield is not taken */
			{ const N = setup(18); const s = mk(N, 'shielder', 900, 2); s.sp = 0; __fb.dropShield(s, 0); N.shields[0].x = 600; N.shields[0].lane = 7; const r = mk(N, 'shambler', 640, 7); r.sp = 20; for (let i = 0; i < 200; i++) __fb.run(1); out.alive = !r.shield }
			return out });
		ok('S5. Bash knocks a shield loose at the barricade and pushes the shielder back; it has a short wait', sb.bash.hit && sb.bash.dropped && sb.bash.back > 20 && sb.cooldown, sb.bash);
		ok('S6. Night 9: a shielder leaves its shield; from Night 10 it goes back for it', !sb.n9 && sb.n10, {n9: sb.n9, n10: sb.n10});
		ok('S7. from Night 18 an ordinary elf may take up a fallen shielder’s shield (white eyes, its own health); not on Night 17, not a living one’s', sb.n17.took == 0 && sb.n18.took >= 2 && sb.n18.took < 12 && sb.eye == '#eef2ff' && sb.kind == 'shambler' && sb.hp && Math.abs(sb.hp[0] - sb.hp[1]) < sb.hp[1] * .16 && sb.alive, sb);
		await f.evaluate(() => { __fb.G.skill = 0 });
		await f.evaluate(() => { const G = __fb.G; G.wx = Array(26).fill('clear'); G.night = 1; G.surv = []; __fb.startNight(); __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = [] });
		/* the night ends: the day's plan */
		await f.evaluate(() => { const N = __fb.N; N.q = []; N.elves = []; __fb.run(260) }); await sleep(300);
		const d = await f.evaluate(() => ({h: document.getElementById('ovBody').textContent, night: __fb.G.night}));
		ok('14. the night over: Day 2 before Night 2, with twelve hours to plan', /Day 2 · before Night 2/.test(d.h) && /12 hours/.test(d.h) && d.night == 2, d.h.slice(0, 120));
		const cap = await f.evaluate(() => { for (let i = 0; i < 20; i++) document.querySelector('[data-h=train][data-d="1"]').click(); const p = __fb.G.plan; return p.repair + p.search + p.train });
		ok('15. the hours cannot go past twelve', cap == 12, cap);
		const day = await f.evaluate(() => { __fb.G.plan = {repair: 2, search: 10, train: 0}; __fb.G.bar = 500; __fb.runDay(); return {txt: document.getElementById('ovBody').textContent, bar: __fb.G.bar} });
		ok('16. the day: the barricade repaired, and the search turns things up', day.bar >= 640 && /Repaired the barricade/.test(day.txt) && /(Found|Scrap|joins|Searched|bandages)/.test(day.txt) && !/Ammunition/.test(day.txt), day);
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
		const perf = await f.evaluate(() => { const N = __fb.N; N.q = [[1e9, 'shambler']]; for (let i = 0; i < 34; i++) { __fb.spawn(['shambler', 'sprinter', 'brute', 'bloater', 'mugger', 'crawler'][i % 6]); N.elves.at(-1).x = 230 + i * 18 } for (let i = 0; i < 40; i++) N.fx.push({k: 'p', x: 300, y: 250, vx: 1, vy: 1, t: 0, col: '#fff', life: 9}); let a = 0; for (let i = 0; i < 60; i++) { const s = performance.now(); window.__fbdraw && 0; document.getElementById('cv'); a += 0 } const s = performance.now(); for (let i = 0; i < 30; i++) __fb.run(1); return {step: (performance.now() - s) / 30} });
		const dr = await f.evaluate(() => new Promise(r => { let n = 0, s = performance.now(); const tick = () => { if (++n == 30) r((performance.now() - s) / 30); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) }));
		ok('20. 34 elves at once: a step ' + perf.step.toFixed(2) + ' ms, a frame every ' + dr.toFixed(1) + ' ms', perf.step < 3 && dr < 25, {perf, dr});
		await pg.screenshot({path: path.join(W, 'night.png')});
		/* the last night: the sleigh */
		const end = await f.evaluate(() => { const G = __fb.G; G.wx = __fb.makeWeather(G.seed); G.night = __fb.LAST; G.morning = JSON.parse(JSON.stringify(G)); __fb.startNight(); G.hp = 1e9; G.bar = 1e9; G.barMax = 1e9;
			let saw = null; for (let i = 0; i < 60 * 172 && !__fb.N.over; i++) { __fb.run(1); if (__fb.N.sleigh && !saw) saw = {t: Math.round(__fb.N.t), elves: __fb.N.elves.length} }
			return {saw, over: __fb.N.over, foremen: true} });
		await sleep(300);
		const et = await f.evaluate(() => ({h: document.getElementById('ovBody').textContent, wins: __fb.save().wins, run: __fb.save().run}));
		ok('21. Night 25, in the great blizzard: Captain Quill’s sleigh comes at 150 s, and the night’s elves are gone', end.saw && end.saw.t == 150 && end.over, end);
		ok('22. the ending: Dawn, "Thank you for holding the line"; the win is kept', /Dawn/.test(et.h) && /holding the line/.test(et.h) && et.wins == 1 && !et.run, et.h.slice(0, 100));
		ok('23. no errors in the console', errs.length == 0, errs.slice(0, 4).join(' | '));
		/* saves: a game in progress carries on after the page is opened again */
		await f.evaluate(() => { __fb.newRun('normal'); __fb.G.night = 4; __fb.dawn() }); await sleep(400);
		await sleep(400); await pg.reload(); const fr2 = () => pg.frames().find(x => x.url().includes('/www/index.html')); for (let i = 0; i < 60 && !(fr2() && await fr2().evaluate(() => !!window.__fb).catch(() => false)); i++) await sleep(100); const o2 = {f: fr2()}; await sleep(300);
		const carry = await o2.f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent)[0]);
		ok('24. opened again: "Carry on · Night 5"', /Carry on · Night 5/.test(carry), carry);
		/* 25 Days (1.3) */
		const d25 = await o2.f.evaluate(async () => {
			const out = {}; document.getElementById('ov').hidden = true; __fb.newRun('normal'); __fb.G.wx = Array(26).fill('clear'); __fb.startNight(); const N = __fb.N, G = __fb.G; N.q = [[1e9, 'shambler']]; N.elves = [];
			out.title = document.title; out.W = __fb.W;
			/* moving: S takes Rudolf down the lanes, smoothly */
			const r0 = N.rl; window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyS', key: 's'})); document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyS', key: 's', bubbles: true}));
			for (let i = 0; i < 30; i++) __fb.run(1);
			window.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyS', key: 's'})); document.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyS', key: 's', bubbles: true})); __fb.run(30);
			out.moved = N.rl - r0;
			/* the aim stops at 15 degrees */
			N.rl = 7; __fb.cross.x = 300; __fb.cross.y = 40; out.aimUp = __fb.aimAngle(); __fb.cross.y = 430; out.aimDown = __fb.aimAngle();
			/* a shot flies past the crosshair to an elf far behind it (Rudolf put in lane 7, the crosshair's follow reset) */
			N.rl = 7; N.rv = 0; N.lastSy = null;
			__fb.spawn('shambler'); const e = N.elves.at(-1); e.lane = e.tl = 7; e.x = 900; e.sp = 0; e.changer = e.sprinter = false; e.hp = e.hp0 = 500;
			const b = __fb.bodyOf(e), s = __fb.shoulder(); __fb.cross.x = 400; __fb.cross.y = s.y + (b.y - s.y) * (400 - s.x) / (b.x - s.x);
			__fb.pick('icicle'); N.cd = 0; N.reload = 0; G.wp.icicle.mag = 10; const sp0 = __fb.WEP.icicle.spread; __fb.WEP.icicle.spread = 0; __fb.fire(); __fb.run(1); __fb.WEP.icicle.spread = sp0; out.past = e.hp < 500;
			/* unlimited ammunition: an empty magazine reloads, and quicker than before */
			G.wp.icicle.mag = 0; N.cd = 0; __fb.run(1); out.reload = N.reload; out.inf = Object.values(__fb.WEP).every(w => w.inf);
			/* survivors fire in their own time, and miss more untrained */
			N.elves = []; for (let i = 0; i < 6; i++) { __fb.spawn('brute'); const x = N.elves.at(-1); x.x = 500 + i * 30; x.sp = 0; x.hp = x.hp0 = 1e6 }
			G.surv = [0, 1, 2].map(i => ({name: 'S' + i, kind: 'fox', role: 'guard'})); G.surv.forEach((sv, i) => { sv.cd = [.4, 1.3, 2.2][i] });
			const firstShot = []; for (let t = 0; t < 180; t++) { __fb.run(1); G.surv.forEach((sv, i) => { if (sv.fire > 0 && firstShot[i] == null) firstShot[i] = t }) }
			out.stagger = firstShot;
			G.skill = 0; G.surv.forEach(sv => { sv.missed = 0 }); let shots = 0; for (let t = 0; t < 60 * 60; t++) { G.surv.forEach(sv => { if (sv.fire == .12) shots++ }); __fb.run(1) }
			const missed0 = G.surv.reduce((a, sv) => a + (sv.missed || 0), 0);
			G.skill = 30; G.surv.forEach(sv => { sv.missed = 0 }); for (let t = 0; t < 60 * 60; t++) __fb.run(1);
			const missed30 = G.surv.reduce((a, sv) => a + (sv.missed || 0), 0); out.miss = [missed0, missed30];
			/* below 5% the survivors panic, drop their crossbows and run */
			G.bar = G.barMax * .04; __fb.run(2); out.panic = {fled: G.surv.every(sv => sv.fled), drops: N.drops.length}; __fb.run(120); out.gone = G.surv.every(sv => sv.runX < 0);
			/* faster elves, sprinters most */
			__fb.spawn('sprinter'); out.sprint = N.elves.at(-1).sp; __fb.spawn('shambler'); out.shamb = N.elves.at(-1).sp;
			return out });
		ok('27. 25 Days: the new name, a wider field', d25.title == '25 Days' && d25.W > 1000, [d25.title, d25.W]);
		ok('28. W/S move Rudolf up and down behind the barricade, quickly', d25.moved > 3, d25.moved);
		ok('29. the aim stops at 15 degrees up and down', Math.abs(Math.abs(d25.aimUp) - Math.PI / 12) < .001 && Math.abs(d25.aimDown - Math.PI / 12) < .001, [d25.aimUp, d25.aimDown]);
		ok('30. a shot flies on past the crosshair and hits an elf behind it', d25.past, d25);
		ok('31. unlimited ammunition, quicker reloads', d25.inf && d25.reload > 0 && d25.reload < 1.1 * .7, [d25.inf, d25.reload]);
		ok('32. the survivors fire each in their own time', new Set(d25.stagger).size == 3 && d25.stagger.every(v => v != null), d25.stagger);
		ok('33. untrained survivors miss much more than trained ones', d25.miss[0] > d25.miss[1] * 2, d25.miss);
		ok('34. below 5% the survivors panic: they drop their crossbows and run off', d25.panic.fled && d25.panic.drops == 3 && d25.gone, d25.panic);
		ok('35. the elves are faster, the sprinters most of all', d25.sprint > 38 * .85 && d25.shamb > 22 * .85 * 1.2, [d25.sprint, d25.shamb]);
		/* a phone on its side, and upright */
		const ph = await br.newContext({viewport: {width: 740, height: 360}, hasTouch: true, isMobile: true});
		const pp = await ph.newPage(); const m = await open(pp); await m.f.click('#ovBtns button');
		await m.f.evaluate(() => { document.getElementById('ov').hidden = true; __fb.newRun('normal'); __fb.G.wx = Array(26).fill('clear'); __fb.startNight(); __fb.N.q = [[1e9, 'shambler']]; __fb.N.elves = [] });
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
