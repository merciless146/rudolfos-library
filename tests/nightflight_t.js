/* Night Flight in Chromium (Playwright), as the Rudolf OS desktop opens it (a sandboxed frame, a stand-in desktop
   answering the game kit). Plays, a deterministic replay, frame time with 600 bullets, both bosses, a rescue, the
   Glow Burst, pausing, a controller, touch on an upright phone.
     node tests/nightflight_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8196), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-nightflight/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES={};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}});
window.send=o=>document.getElementById('f').contentWindow.postMessage(Object.assign({rudolfGame:1},o),'*');
document.getElementById('f').src='www/index.html';</script>`);

async function open(ctx) {
	const pg = await ctx.newPage(); const errs = [];
	pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
	await pg.goto(`http://127.0.0.1:${PORT}/desk.html`);
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 60 && !(fr() && await fr().evaluate(() => !!window.__nf).catch(() => false)); i++) await sleep(100);
	return {pg, f: fr(), errs};
}
/* a bot that weaves (deterministic: from the frame number only) */
const BOT = `(S, i) => __nf.pack(Math.sin(i / 40) * 3, (S.P.y < 520 ? 1.5 : 0) - (S.P.y > 600 ? 1.5 : 0), true, i % 200 < 60, false)`;
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		const ctx = await br.newContext({viewport: {width: 760, height: 600}});
		const {pg, f, errs} = await open(ctx);
		ok('1. it starts in a sandboxed frame: How to play first, then the title menu', await f.evaluate(() => /How to play/.test(document.getElementById('ovBody').textContent)));
		await f.click('#ovBtns button');
		const menu = await f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent));
		ok('2. the title: Story, Practice, Score Attack, Options, How to play', ['Story', 'Practice', 'Score Attack', 'Options', 'How to play'].every(x => menu.includes(x)), menu);
		await pg.screenshot({path: path.join(W, 'title.png')});
		/* Story, Normal */
		await f.click('text=Story'); await f.click('#ovBtns button.main'); await sleep(400);
		const s0 = await f.evaluate(() => ({mode: __nf.S.mode, diff: __nf.S.diff, lives: __nf.S.lives, bombs: __nf.S.bombs, x: __nf.S.P.x}));
		ok('3. Story on Normal starts: 3 lives (2 in reserve), 3 Glow Bursts', s0.mode == 'story' && s0.diff == 'normal' && s0.lives == 2 && s0.bombs == 3, s0);
		/* the keyboard: move and fire */
		await f.focus('#cv'); await pg.keyboard.down('ArrowLeft'); await pg.keyboard.down('KeyZ'); await sleep(400); await pg.keyboard.up('ArrowLeft');
		const s1 = await f.evaluate(() => ({x: __nf.S.P.x, sh: __nf.pools().sh, ch: __nf.S.P.charge}));
		ok('4. arrows move Rudolf, Z fires nose lasers and charges', s1.x < s0.x - 40 && s1.sh > 2 && s1.ch > 0, s1);
		await sleep(1300); await pg.keyboard.up('KeyZ'); await sleep(100);
		ok('5. held until the nose pulses, then let go: the beam', await f.evaluate(() => __nf.S.beam > 0));
		await sleep(2600); await pg.screenshot({path: path.join(W, 'play.png')});
		/* the Glow Burst */
		await f.evaluate(() => { for (let i = 0; i < 40; i++) NF.bullet(180, 100, Math.PI / 2 + i * .02, 30, 'ball', 'pink') });
		const b0 = await f.evaluate(() => ({b: __nf.S.bombs, eb: __nf.pools().eb}));
		await pg.keyboard.press('KeyX'); await sleep(1100);
		const b1 = await f.evaluate(() => ({b: __nf.S.bombs, eb: __nf.pools().eb, inv: __nf.S.P.inv}));
		ok('6. X: a Glow Burst clears the bullets (one fewer left, Rudolf safe for a moment)', b1.b == b0.b - 1 && b1.eb < b0.eb && b0.eb >= 40, {b0, b1});
		/* pausing from the desktop */
		await pg.evaluate(() => send({op: 'pause'})); await sleep(150);
		const fr0 = await f.evaluate(() => __nf.S.frame); await sleep(500); const fr1 = await f.evaluate(() => __nf.S.frame);
		ok('7. the desktop pauses it: the game stops, the pause menu shows', fr0 == fr1 && await f.evaluate(() => /Paused/.test(document.getElementById('ovBody').textContent)), [fr0, fr1]);
		await pg.evaluate(() => send({op: 'resume'})); await f.click('text=Carry on'); await sleep(300);
		ok('8. ...Carry on: it runs again', await f.evaluate(f0 => __nf.S.frame > f0, fr1));
		/* a controller: A fires */
		await f.evaluate(() => { window.__pad = Array.from({length: 17}, () => ({pressed: false, value: 0})); navigator.getGamepads = () => [{id: 't', mapping: 'standard', axes: [-1, 0, 0, 0], buttons: window.__pad}] });
		const x0 = await f.evaluate(() => __nf.S.P.x);
		await f.evaluate(() => { __pad[0] = {pressed: true, value: 1} }); await sleep(300);
		const pd = await f.evaluate(() => ({sh: __nf.pools().sh, x: __nf.S.P.x})); await f.evaluate(() => { __pad[0] = {pressed: false, value: 0}; navigator.getGamepads = () => [] });
		ok('9. a controller: the stick moves, A fires', pd.sh > 0 && pd.x < x0 - 10, {x0, pd});

		/* determinism: the same seed and inputs give the same flight */
		const runA = await f.evaluate(bot => { __nf.begin('story', 'normal', 0, {seed: 'test-seed'}); const r = __nf.run(3600, eval(bot)); return {r, rec: __nf.encodeRec(__nf.S.rec)} }, BOT);
		const runB = await f.evaluate(([bot, rec]) => { __nf.begin('replay', 'normal', 0, {seed: 'test-seed', replay: __nf.decodeRec(rec)}); return __nf.run(3600) }, [BOT, runA.rec]);
		ok('10. a replay of a minute of play ends exactly the same (score, position, bullets)', JSON.stringify(runA.r) == JSON.stringify(runB) && runA.r.score > 0, {a: runA.r, b: runB});
		ok('11. the replay is small (' + runA.rec.length + ' bytes for a minute)', runA.rec.length < 30000);

		/* speed: 600 bullets on screen */
		await f.evaluate(() => { __nf.begin('practice', 'normal', 0, {seed: 'perf'}); const S = __nf.S; S.P.inv = 999; for (let i = 0; i < 600; i++) NF.bullet(20 + (i % 30) * 11, 60 + Math.floor(i / 30) * 22, (i % 7) * .9, 0, ['ball', 'rice', 'star', 'flake'][i % 4], ['pink', 'cyan', 'yellow', 'violet'][i % 4]) });
		const perf = await f.evaluate(() => { const S = __nf.S; let st = 0, dr = 0; for (let i = 0; i < 120; i++) { const a = performance.now(); __nf.step(__nf.pack(0, 0, true, false, false)); const b = performance.now(); __nf.draw(); dr += performance.now() - b; st += b - a } return {eb: __nf.pools().eb, step: st / 120, draw: dr / 120} });
		ok('12. 600 bullets: a step and a frame drawn well inside 16 ms (step ' + perf.step.toFixed(2) + ' ms, draw ' + perf.draw.toFixed(2) + ' ms)', perf.eb >= 590 && perf.step + perf.draw < 12, perf);
		await pg.screenshot({path: path.join(W, 'bullets.png')});

		/* a rescue with the beam */
		const rs = await f.evaluate(() => { __nf.begin('practice', 'normal', 0, {seed: 'r'}); const S = __nf.S; S.P.inv = 999; S.P.x = 180;
			const e = NF.enemy('bunny', 180, 200, 999, e => {}, {friend: true, r: 13});
			for (let i = 0; i < 100; i++) __nf.step(__nf.pack(0, 0, true, false, false));
			for (let i = 0; i < 10; i++) __nf.step(__nf.pack(0, 0, false, false, false));
			return {saved: e.saved, rescues: S.rescues, score: S.score} });
		ok('13. a corrupted friend is not hurt by the stream, and is saved by the beam', rs.saved && rs.rescues == 1 && rs.score >= 3000, rs);

		/* both stages and bosses (the bosses' strength taken away phase by phase) */
		const story = await f.evaluate(() => {
			__nf.begin('story', 'normal', 0, {seed: 'bosses'}); const S = __nf.S; const out = {names: [], stages: []};
			const idle = __nf.pack(0, 0, false, false, false);
			for (let st = 0; st < 2; st++) {
				out.stages.push(S.st.name); S.P.inv = 1e9;
				let n = 0; while (S.phase != 'boss' && n++ < 7000) __nf.step(idle);
				for (let k = 0; k < 200; k++) __nf.step(idle);   /* (the boss arrives) */
				for (let p = 0; p < 3; p++) { out.names.push(S.boss.def.phases[S.boss.pi].name); S.boss.hp = 0; __nf.step(idle); for (let k = 0; k < 30; k++) __nf.step(idle) }
				out.after = S.phase; n = 0; while ((S.phase == 'clear') && n++ < 400) __nf.step(idle); S.P.inv = 1e9;
			}
			return {...out, ended: S.ended, score: S.score} });
		ok('14. Stage 1 (Snowlight Village) and Stage 2 (The Whispering Pines), each to its boss', /Snowlight/.test(story.stages[0]) && /Whispering/.test(story.stages[1]), story.stages);
		ok('15. the bosses’ named phases: Holly Spiral, Bauble Rain, Wreath Crown; Pendulum Sweep, Twelve Chimes, Gear Storm', story.names.join() == 'Holly Spiral,Bauble Rain,Wreath Crown,Pendulum Sweep,Twelve Chimes,Gear Storm', story.names);
		await sleep(300);
		ok('16. after Stage 2: the story so far ends ("The night is not over"), the best score is kept by the desktop', story.ended && await f.evaluate(() => /night is not over/.test(document.getElementById('ovBody').textContent)) && (await pg.evaluate(() => SAVES['night-flight'] && SAVES['night-flight'].hi.normal)) > 0);
		await f.click('#ovBtns button.main'); await sleep(300);
		ok('17. Practice now offers both stages', await f.evaluate(() => { [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Practice').click(); return [...document.querySelectorAll('#ovBtns button')].filter(b => /^\d\./.test(b.textContent)).length == 2 }));
		ok('18. the last flight can be watched again', await f.evaluate(() => { document.querySelector('[data-back]').click(); return [...document.querySelectorAll('#ovBtns button')].some(b => /Watch your last flight/.test(b.textContent)) }));
		ok('19. no errors in the console', errs.length == 0, errs.slice(0, 4).join(' | '));

		/* an upright phone with touch: a finger steers (by how far it moves), two fingers tapped: a Glow Burst */
		const ph = await br.newContext({viewport: {width: 360, height: 640}, hasTouch: true, isMobile: true});
		const m = await open(ph);
		await m.f.click('#ovBtns button'); await m.f.evaluate(() => __nf.begin('practice', 'normal', 0, {seed: 'touch'}));
		const v = await m.f.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return {w: c.width, h: c.height, sw: document.documentElement.scrollWidth} });
		ok('20. a phone upright: the playfield fills the screen, no sideways scrolling', v.w == 360 && v.h >= 600 && v.sw <= 360, v);
		const cdp = await ph.newCDPSession(m.pg); const px = await m.f.evaluate(() => __nf.S.P.x);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 300, y: 500, id: 1}]});
		for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 300 - i * 8, y: 500, id: 1}]}); await sleep(20) }
		await sleep(100);
		const t1 = await m.f.evaluate(() => ({x: __nf.S.P.x, sh: __nf.pools().sh}));
		ok('21. touch: a finger dragged left moves Rudolf left by about as much, and he fires', t1.x < px - 50 && t1.x > px - 110 && t1.sh > 0, {px, t1});
		const bb = await m.f.evaluate(() => __nf.S.bombs);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 220, y: 500, id: 1}, {x: 120, y: 450, id: 2}]}); await sleep(60);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await sleep(200);
		ok('22. touch: a two-finger tap is a Glow Burst', await m.f.evaluate(b => __nf.S.bombs == b - 1, bb));
		await m.pg.screenshot({path: path.join(W, 'phone.png')});
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
