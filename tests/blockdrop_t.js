/* Block Drop and the game kit in Chromium (Playwright), as the Rudolf OS desktop opens them: a sandboxed frame
   (allow-scripts allow-forms allow-modals allow-downloads, no storage of its own) in a page that answers the kit's
   messages like the desktop does (saves kept by the page, pause and resume sent to the game).
     node tests/blockdrop_t.js [PORT]      (needs: playwright; python3 for the file server) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8193), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* the package as tools/publish.sh lays it out: www/ with the kit copied in */
fs.cpSync(path.join(TOP, 'apps/rudolf-blockdrop/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES={};window.MSGS=[];
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;MSGS.push(m.op);
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:/theme=dark/.test(location.search),reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}});
window.send=o=>document.getElementById('f').contentWindow.postMessage(Object.assign({rudolfGame:1},o),'*');
document.getElementById('f').src='www/index.html'+location.search;</script>`);

async function open(ctx, q) {
	const pg = await ctx.newPage();
	await pg.goto(`http://127.0.0.1:${PORT}/desk.html${q || ''}`);
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 50 && !(fr() && await fr().evaluate(() => !!window.__bd).catch(() => false)); i++) await sleep(100);
	return {pg, f: fr()};
}
const st = f => f.evaluate(() => { const G = __bd.get(); return {state: G.state, x: G.piece && G.piece.x, y: G.piece && G.piece.y, cells: G.piece && JSON.stringify(G.piece.cells), count: G.count, rows: G.rows, score: G.score, bursts: G.bursts, filled: G.board.reduce((a, b) => a + (b ? 1 : 0), 0), level: G.level, mode: G.mode} });

(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	const errs = [];
	try {
		const ctx = await br.newContext({viewport: {width: 760, height: 620}, acceptDownloads: true});
		const {pg, f} = await open(ctx);
		pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
		ok('1. it starts in a sandboxed frame and greets the desktop', await f.evaluate(() => !!window.__bd && RG.inDesktop) && (await pg.evaluate(() => MSGS)).includes('hello'));
		const y0 = (await st(f)).y; await sleep(1300); const y1 = (await st(f)).y;
		ok('2. first start: How to play shows, and nothing falls behind it', y0 == y1 && await f.evaluate(() => !document.getElementById('ov').hidden && /How to play/.test(document.getElementById('ovBody').textContent)), y0 + ' ' + y1);
		await f.click('#ovBtns button');
		const px = await f.evaluate(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i]) n++; return n });
		ok('3. the well is drawn', px > 50, px + ' samples');
		await sleep(1200);
		ok('4. pieces fall by themselves (Classic, level 1)', (await st(f)).y > y1);

		/* the keyboard */
		await f.evaluate(() => { __bd.newGame('classic', {seed: 'test'}); __bd.setPiece('T', 1, -1, 2) });
		await f.focus('#cv');
		let a = await st(f); await pg.keyboard.press('ArrowLeft'); await sleep(60); let b = await st(f);
		ok('5. ← moves the piece one column', b.x == a.x - 1, a.x + ' → ' + b.x);
		await pg.keyboard.press('ArrowUp'); await sleep(60); const c = await st(f);
		ok('6. ↑ turns it', c.cells != b.cells);
		await pg.keyboard.down('ArrowRight'); await sleep(450); await pg.keyboard.up('ArrowRight'); const d = await st(f);
		ok('7. holding → repeats to the wall', d.x >= 5, 'x ' + d.x);
		const n0 = (await st(f)).count; await pg.keyboard.press('Space'); await sleep(80); const e = await st(f);
		ok('8. Space drops it: it locks at the bottom and the next piece comes', e.filled == 4 && e.count > n0 && e.score > 0, JSON.stringify(e));

		/* a full row clears; the rows above come down */
		await f.evaluate(() => { __bd.newGame('classic', {seed: 'rows'}); __bd.setBoard(['.1234012', '..3.....']); __bd.setPiece('I3', 4, -1, -1); __bd.turn(1) });
		await f.evaluate(() => __bd.hardDrop()); await sleep(600);
		let g = await st(f); const rowv = await f.evaluate(() => { const G = __bd.get(); return [Array.from(G.board.slice(15 * 8, 16 * 8)).join(''), Array.from(G.board.slice(14 * 8, 15 * 8)).join('')] });
		ok('9. filling a row clears it and scores; the rows above come down', g.rows == 1 && g.score >= 100 && rowv[0] == '50400000' && rowv[1] == '50000000', JSON.stringify({g, rowv}));

		/* a prism: its colour bursts, the blocks above tumble down, the row that fills clears too (a chain) */
		await f.evaluate(() => { __bd.newGame('classic', {seed: 'prism'}); __bd.setBoard(['2222222.', '.......0', '.......3']); __bd.setPiece('O', 0, 0, 0) });
		const outl = await f.evaluate(() => __bd.get().piece.prism);
		await f.evaluate(() => __bd.hardDrop()); await sleep(1100);
		g = await st(f);
		ok('10. a prism bursts its colour; blocks tumble; the filled row clears in a chain', outl == 0 && g.bursts == 1 && g.rows == 1 && g.filled == 0 && g.state == 'play', JSON.stringify(g));
		ok('11. the chain scores more than a plain row', g.score > 100 * 2, g.score);
		ok('12. a prism comes with every 12th piece', await f.evaluate(() => { __bd.newGame('classic', {seed: 'p'}); let n = 0; for (let i = 0; i < 24; i++) n += __bd.deal().prism >= 0 ? 1 : 0; return n == 2 }));

		/* the well fills: game over, best score kept with the desktop */
		await f.evaluate(() => { __bd.newGame('classic', {seed: 'over'}); const r = []; for (let i = 0; i < 14; i++) r.push(i % 2 ? '1111111.' : '.2222222'); __bd.setBoard(r); __bd.get().score = 4321; __bd.setPiece('O', 3, -1, 3) });
		await f.evaluate(() => __bd.hardDrop()); await sleep(900);
		g = await st(f); const saved = await pg.evaluate(() => SAVES['block-drop']);
		ok('13. a full well ends the game and says so', g.state == 'over' && await f.evaluate(() => /well is full/.test(document.getElementById('ovBody').textContent)), JSON.stringify(g));
		ok('14. the best score is saved with the desktop', saved && saved.best && saved.best.classic >= 4321, JSON.stringify(saved && saved.best));
		await f.click('#ovBtns button.main');
		ok('15. Play again starts a new game', (await st(f)).state == 'play' && (await st(f)).score == 0);

		/* pausing */
		await pg.evaluate(() => send({op: 'pause'})); await sleep(150);
		const p1 = await st(f); await sleep(1200); const p2 = await st(f);
		ok('16. the desktop pauses it (minimised, locked): nothing falls and the well is hidden', p1.y == p2.y && await f.evaluate(() => RG.paused && /Paused/.test(document.getElementById('ovBody').textContent)), p1.y + ' ' + p2.y);
		await pg.evaluate(() => send({op: 'resume'})); await f.click('#ovBtns button.main'); await sleep(1300);
		ok('17. ...and resumes', await f.evaluate(() => !RG.paused) && (await st(f)).y > p2.y);
		await f.focus('#cv'); await pg.keyboard.press('KeyP'); await sleep(100);
		ok('18. P pauses', await f.evaluate(() => RG.paused && !document.getElementById('ov').hidden));
		await pg.keyboard.press('KeyP'); await sleep(100);
		ok('19. ...and P again carries on', await f.evaluate(() => !RG.paused && document.getElementById('ov').hidden));

		/* Relaxed keeps its speed; Classic speeds up with the rows */
		const sp = await f.evaluate(() => { __bd.newGame('relaxed'); __bd.get().rows = 39; __bd.setBoard(['.1111111']); __bd.setPiece('I3', 2, -1, -1); __bd.turn(1); __bd.hardDrop(); return 1 });
		await sleep(500); const rl = await st(f);
		await f.evaluate(() => { __bd.newGame('classic'); __bd.get().rows = 39; __bd.setBoard(['.1111111']); __bd.setPiece('I3', 2, -1, -1); __bd.turn(1); __bd.hardDrop() });
		await sleep(500); const cl = await st(f);
		ok('20. Classic: level up every 10 rows; Relaxed stays at one speed', cl.level == 5 && rl.level == 1 && rl.rows == 40, JSON.stringify([cl.level, rl.level, rl.rows]));

		/* the Daily game: the same blocks every time, three minutes */
		const d1 = await f.evaluate(() => { __bd.newGame('daily'); return JSON.stringify(__bd.get().queue.map(q => [q.s, q.col])) });
		const d2 = await f.evaluate(() => { __bd.newGame('daily'); return JSON.stringify(__bd.get().queue.map(q => [q.s, q.col])) });
		await f.evaluate(() => { const G = __bd.get(); G.t = 179.8; G.score = 777 }); await sleep(900);
		ok('21. Daily: the same blocks each time; ends after 3 minutes and keeps today\'s score', d1 == d2 && (await st(f)).state == 'over' && await f.evaluate(() => /Time is up/.test(document.getElementById('ovBody').textContent) && __bd.save().daily[RG.today()] == 777));
		await f.click('#ovBtns button:not(.main)');

		/* a controller (the standard mapping) */
		await f.evaluate(() => { __bd.newGame('classic', {seed: 'pad'}); __bd.setPiece('T', 1, -1, 2); window.__pad = Array.from({length: 17}, () => ({pressed: false, value: 0}));
			navigator.getGamepads = () => [{id: 'test', mapping: 'standard', axes: [0, 0, 0, 0], buttons: window.__pad}] });
		const press = async i => { await f.evaluate(i => __pad[i] = {pressed: true, value: 1}, i); await sleep(60); await f.evaluate(i => __pad[i] = {pressed: false, value: 0}, i); await sleep(60) };
		a = await st(f); await press(15); await press(0); b = await st(f);
		ok('22. a controller: d-pad moves, A turns', b.x == a.x + 1 && b.cells != a.cells, JSON.stringify([a.x, b.x]));
		await press(12); await sleep(60);
		ok('23. ...d-pad up drops', (await st(f)).filled == 4);
		await f.evaluate(() => { navigator.getGamepads = () => [] });

		/* Reduce flashing from the menu, kept */
		await f.click('#menuBtn'); await f.click('[data-cmd=flash]'); await sleep(300);
		if (!(await f.evaluate(() => document.getElementById('ov').hidden))) await f.click('#ovBtns button.main');
		ok('24. Reduce flashing is a setting that is kept', await f.evaluate(() => RG.reduceFlash && __bd.save().reduceFlash === true));

		/* export and import */
		await f.evaluate(() => { __bd.save().best.classic = 9000 });
		const [dl] = await Promise.all([pg.waitForEvent('download'), f.evaluate(() => RG.save(__bd.save()).then(() => RG.exportSave()))]);
		const txt = fs.readFileSync(await dl.path(), 'utf8'); const j = JSON.parse(txt);
		ok('25. Export save: a file with the best scores', j.rudolfGame == 'block-drop' && j.data.best.classic == 9000);
		await f.evaluate(() => RG.save({v: 1, best: {}, daily: {}, played: 0}));
		const back = await f.evaluate(t => RG.importText(t).then(d => d.best.classic), txt);
		const bad = await f.evaluate(() => RG.importText('{"rudolfGame":"fault-lines","data":1}').then(() => 'took', e => e.message));
		ok('26. Import save brings it back; another game\'s file is refused', back == 9000 && /not a save of this game/.test(bad), bad);
		await pg.screenshot({path: path.join(W, 'desktop.png')});
		ok('27. no errors in the console', errs.length == 0, errs.slice(0, 3).join(' | '));

		/* a phone, upright, with touch */
		const ph = await br.newContext({viewport: {width: 360, height: 640}, hasTouch: true, isMobile: true});
		const {pg: pp, f: f2} = await open(ph);
		await f2.click('#ovBtns button');
		const fb2 = await f2.frameElement().then(e => e.boundingBox());
		const wc = await f2.evaluate(() => __bd.wellCenter()); const X = fb2.x + wc.x, Y = fb2.y + wc.y;
		await f2.evaluate(() => { __bd.newGame('classic', {seed: 'touch'}); __bd.setPiece('T', 1, -1, 2) });
		a = await st(f2); await pp.touchscreen.tap(X, Y); await sleep(120); b = await st(f2);
		const lay = await f2.evaluate(() => { const v = __bd.view(); return {tall: v.h > v.w, fits: v.w * v.scale <= v.cw + .5 && v.h * v.scale <= v.ch + .5, cell: Math.round(32 * v.scale), sw: document.documentElement.scrollWidth, iw: innerWidth, tbar: getComputedStyle(document.getElementById('tbar')).display} });
		ok('28. a phone upright: the well and the panel above it fit, no sideways scrolling, cells big enough to see', lay.tall && lay.fits && lay.sw <= lay.iw && lay.cell >= 20, JSON.stringify(lay));
		ok('29. touch: a tap turns, and the touch buttons appear', b.cells != a.cells && lay.tbar != 'none', JSON.stringify(lay.tbar));
		const cdp = await ph.newCDPSession(pp);
		const tp = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type == 'touchEnd' ? [] : [{x, y}]});
		const cellPx = wc.cell;
		a = await st(f2);
		await tp('touchStart', X, Y); for (let k = 1; k <= 8; k++) { await tp('touchMove', X + k * cellPx * .3, Y); await sleep(16) } await tp('touchEnd'); await sleep(100);
		b = await st(f2);
		ok('30. touch: dragging sideways moves it column by column', b.x >= a.x + 2 && b.cells == a.cells, JSON.stringify([a.x, b.x]));
		await tp('touchStart', X, Y - cellPx * 2); for (let k = 1; k <= 2; k++) await tp('touchMove', X, Y - cellPx * 2 + k * cellPx * 2); await tp('touchEnd'); await sleep(120);
		ok('31. touch: a flick down drops it', (await st(f2)).filled == 4);
		const tb = await f2.$('#tbar [data-t=left]'); const bb = await tb.boundingBox();
		a = await st(f2); await pp.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(100); b = await st(f2);
		ok('32. the touch bar: ◀ moves left', b.x == a.x - 1, JSON.stringify([a.x, b.x]));
		await pp.screenshot({path: path.join(W, 'phone.png')});

		/* dark theme from the desktop */
		const {pg: dk, f: f3} = await open(ctx, '?theme=dark');
		ok('33. dark theme', await f3.evaluate(() => document.documentElement.classList.contains('dark') && getComputedStyle(document.body).backgroundColor != 'rgb(230, 235, 242)'));
		await f3.click('#ovBtns button'); await sleep(300); await dk.screenshot({path: path.join(W, 'dark.png')});
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
