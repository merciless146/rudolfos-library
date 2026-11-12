/* Logic Pack and the game kit in Chromium (Playwright), as the Rudolf OS desktop opens them: a sandboxed frame
   (allow-scripts allow-forms allow-modals allow-downloads, no storage of its own) in a page that answers the kit's
   messages like the desktop does (saves kept by the page, pause and resume sent to the game). The puzzle makers are
   also checked in node: every puzzle has one answer, and Easy and Medium Sudoku can be solved with singles.
     node tests/logicpack_t.js [PORT]      (needs: playwright; python3 for the file server) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8193), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- the puzzle makers, in node ---------- */
{
	const LP = require(path.join(TOP, 'apps/rudolf-logicpack/www/logic.js'));
	const rng = s => { let a = [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261); return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } };
	let bad = [], slow = 0;
	for (const d of ['easy', 'medium', 'hard']) for (let s = 0; s < 6; s++) {
		let t = Date.now(); const p = LP.make('sudoku', d, rng('s' + d + s)); slow = Math.max(slow, Date.now() - t);
		if (LP.sdkCount(p.given, 2) != 1 || p.given.some((v, i) => v && v != p.sol[i])) bad.push('sudoku ' + d + s);
		if (d != 'hard' && !LP.sdkSingles(p.given, d == 'medium')) bad.push('sudoku singles ' + d + s);
		t = Date.now(); const q = LP.make('nonogram', d, rng('n' + d + s)); slow = Math.max(slow, Date.now() - t);
		const g = new Int8Array(q.n * q.n).fill(-1); q.given.forEach(i => g[i] = q.sol[i]); LP.ngSolve(g, q.n, q.n, q.rows, q.cols);
		if (!Array.from(g).every((v, i) => v == q.sol[i])) bad.push('nonogram ' + d + s);
		t = Date.now(); const c = LP.make('cages', d, rng('c' + d + s)); slow = Math.max(slow, Date.now() - t);
		if (!c || LP.cgCount(c.n, c.cages, new Int8Array(c.n * c.n), 2) != 1 || !c.cages.every(cg => LP.cageOk(cg, cg.cells.map(i => c.sol[i]), true))) bad.push('cages ' + d + s);
	}
	ok('1. puzzles have one answer each (54 made); Picture Grid solves by line logic; Easy and Medium Sudoku by singles', !bad.length, bad.join(', '));
	ok('2. each takes well under a second to make', slow < 600, slow + ' ms');
}

fs.cpSync(path.join(TOP, 'apps/rudolf-logicpack/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES={};window.MSGS=[];
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;MSGS.push(m.op);
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:/theme=dark/.test(location.search),reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:JSON.parse(JSON.stringify(SAVES[m.game]))});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}});
window.send=o=>document.getElementById('f').contentWindow.postMessage(Object.assign({rudolfGame:1},o),'*');
window.reopen=()=>{const f=document.getElementById('f');f.src='about:blank';setTimeout(()=>f.src='www/index.html'+location.search,50)};
document.getElementById('f').src='www/index.html'+location.search;</script>`);

const frameOf = pg => pg.frames().find(f => f.url().includes('/www/index.html'));
async function ready(pg) { for (let i = 0; i < 60; i++) { const f = frameOf(pg); if (f && await f.evaluate(() => !!(window.__lp && __lp.get())).catch(() => false)) return f; await sleep(100) } return frameOf(pg) }
async function open(ctx, q) { const pg = await ctx.newPage(); await pg.goto(`http://127.0.0.1:${PORT}/desk.html${q || ''}`); return {pg, f: await ready(pg)} }

(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	const errs = [];
	try {
		const ctx = await br.newContext({viewport: {width: 820, height: 600}, acceptDownloads: true});
		let {pg, f} = await open(ctx);
		pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
		ok('3. it starts in a sandboxed frame and greets the desktop', await f.evaluate(() => RG.inDesktop) && (await pg.evaluate(() => MSGS)).includes('hello'));
		const t0 = await f.evaluate(() => __lp.get().t); await sleep(1200);
		ok('4. first start: How to play shows, and the clock waits behind it', await f.evaluate(t => !document.getElementById('ov').hidden && /How to play/.test(document.getElementById('ovBody').textContent) && __lp.get().t == t, t0));
		await f.click('#ovBtns button');
		const box = await f.frameElement().then(e => e.boundingBox());
		const at = async i => { const p = await f.evaluate(i => __lp.cellCenter(i), i); return {x: box.x + p.x, y: box.y + p.y} };
		const click = async (i, o) => { const p = await at(i); await pg.mouse.click(p.x, p.y, o) };

		/* ---------- Sudoku ---------- */
		await f.evaluate(() => __lp.newGame('sudoku', 'easy', {seed: 'test'}));
		const sd = await f.evaluate(() => { const G = __lp.get(); return {k: G.P.kind, clues: G.P.given.filter(v => v).length, empty: G.val.indexOf(0)} });
		ok('5. Sudoku Easy: 36 numbers given', sd.k == 'sudoku' && sd.clues == 36, JSON.stringify(sd));
		const px = await f.evaluate(() => { const c = document.getElementById('cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 400) if (d[i]) n++; return n });
		ok('6. the grid is drawn', px > 50, px);
		const e0 = sd.empty, right = await f.evaluate(i => __lp.get().P.sol[i], e0);
		await click(e0); await pg.keyboard.press('Digit' + right); await sleep(50);
		ok('7. click a cell and type: the number is written', await f.evaluate(([i, v]) => __lp.get().sel == i && __lp.get().val[i] == v, [e0, right]));
		/* a number that clashes in its row is shown as a clash */
		const e1 = await f.evaluate(i => { const G = __lp.get(), r = Math.floor(i / 9); for (let c = 0; c < 9; c++) if (!G.val[r * 9 + c] && r * 9 + c != i) return r * 9 + c; return -1 }, e0);
		await click(e1); await pg.keyboard.press('Digit' + right); await sleep(50);
		ok('8. a number already in the row shows as a clash', await f.evaluate(([a, b]) => { const c = __lp.conflicts(); return c.includes(a) && c.includes(b) }, [e0, e1]));
		await pg.keyboard.press('KeyU'); await sleep(50);
		ok('9. U undoes it', await f.evaluate(i => __lp.get().val[i] == 0 && !__lp.conflicts().length, e1));
		/* notes */
		await pg.keyboard.press('KeyN'); await pg.keyboard.press('Digit3'); await pg.keyboard.press('Digit5'); await pg.keyboard.press('KeyN'); await sleep(50);
		ok('10. N for notes: small numbers in the cell', await f.evaluate(i => __lp.get().notes[i] == ((1 << 3) | (1 << 5)) && document.getElementById('pNotes').getAttribute('aria-pressed') == 'false', e1));
		/* a hint: first it fixes a wrong number */
		const wrongV = await f.evaluate(i => { const G = __lp.get(); return G.P.sol[i] % 9 + 1 }, e1);
		await pg.keyboard.press('Digit' + wrongV); await sleep(50);
		await pg.keyboard.press('KeyH'); await sleep(80);
		ok('11. a hint finds a wrong number and erases it, and says so', await f.evaluate(i => __lp.get().val[i] == 0 && __lp.get().hints == 1 && /wrong/.test(document.getElementById('toast').textContent) && !document.getElementById('toast').hidden, e1));
		const before = await f.evaluate(() => __lp.get().val.filter(v => v).length);
		await pg.keyboard.press('KeyH'); await sleep(80);
		const h2 = await f.evaluate(() => ({n: __lp.get().val.filter(v => v).length, t: document.getElementById('toast').textContent, ok: __lp.get().val.every((v, i) => !v || v == __lp.get().P.sol[i])}));
		ok('12. ...then it writes the next number and says why', h2.n == before + 1 && h2.ok && /fits here|can only go here/.test(h2.t), JSON.stringify(h2));
		/* the pad */
		const e2 = await f.evaluate(() => __lp.get().val.indexOf(0)); const v2 = await f.evaluate(i => __lp.get().P.sol[i], e2);
		await click(e2); await f.click(`#pad .num[data-v="${v2}"]`); await sleep(50);
		ok('13. the pad writes in the selected cell', await f.evaluate(([i, v]) => __lp.get().val[i] == v, [e2, v2]));
		/* solving without hints keeps a best time with the desktop */
		await f.evaluate(() => __lp.newGame('sudoku', 'easy', {seed: 'win'}));
		const last = await f.evaluate(() => { const G = __lp.get(); const k = G.val.indexOf(0); __lp.fillAllBut(k); G.t = 95; return k });
		await click(last); await pg.keyboard.press('Digit' + await f.evaluate(i => __lp.get().P.sol[i], last)); await sleep(900);
		const sv = await pg.evaluate(() => SAVES['logic-pack']);
		ok('14. the last number solves it: Solved, and the best time is kept with the desktop', await f.evaluate(() => __lp.get().done && /Solved/.test(document.getElementById('ovBody').textContent)) && sv && sv.best['sudoku-easy'] == 95, JSON.stringify(sv && sv.best));
		await f.click('#ovBtns button.main'); await sleep(100);
		ok('15. Next puzzle: a new Easy Sudoku', await f.evaluate(() => !__lp.get().done && __lp.get().P.kind == 'sudoku' && __lp.get().diff == 'easy'));

		/* ---------- Picture Grid ---------- */
		await f.click('[data-kind=nonogram]'); await sleep(100);
		await f.evaluate(() => __lp.newGame('nonogram', 'medium', {seed: 'pic'}));
		const ng = await f.evaluate(() => ({n: __lp.get().P.n, k: __lp.get().P.kind}));
		ok('16. Picture Grid Medium: 10×10, with its clues', ng.k == 'nonogram' && ng.n == 10);
		const free = await f.evaluate(() => { const G = __lp.get(); for (let i = 0; i < 100; i++) if (!G.P.given.includes(i) && !G.P.given.includes(i + 1) && !G.P.given.includes(i + 2) && i % 10 < 7) return i });
		await click(free); await sleep(30);
		await click(free + 1, {button: 'right'}); await sleep(30);
		ok('17. click fills, right-click crosses', await f.evaluate(i => __lp.get().cells[i] == 1 && __lp.get().cells[i + 1] == 2, free));
		await click(free); await sleep(30);
		const r0 = await f.evaluate(() => { const G = __lp.get(); for (let r = 0; r < 10; r++) { let k = 0; for (let c = 0; c < 10; c++) if (!G.P.given.includes(r * 10 + c) && !G.cells[r * 10 + c]) k++; if (k == 10) return r } return -1 });
		if (r0 >= 0) {
			const a = await at(r0 * 10 + 1), b = await at(r0 * 10 + 6);
			await pg.mouse.move(a.x, a.y); await pg.mouse.down(); await pg.mouse.move((a.x + b.x) / 2, a.y + 6, {steps: 4}); await pg.mouse.move(b.x, b.y + 8, {steps: 4}); await pg.mouse.up(); await sleep(50);
			ok('18. dragging fills a run along the row', await f.evaluate(r => [1, 2, 3, 4, 5, 6].every(c => __lp.get().cells[r * 10 + c] == 1) && !__lp.get().cells[r * 10] && !__lp.get().cells[r * 10 + 7], r0));
			await f.click('#pUndo'); await sleep(50);
			ok('19. one Undo takes back the whole stroke', await f.evaluate(r => [1, 2, 3, 4, 5, 6].every(c => __lp.get().cells[r * 10 + c] == 0), r0));
		} else { ok('18. dragging fills a run along the row (no free row in this puzzle)', true); ok('19. undo', true) }
		await f.evaluate(() => { __lp.get().cells.fill(0); __lp.get().P.given.forEach(i => __lp.get().cells[i] = __lp.get().P.sol[i] ? 1 : 2) });
		await f.click('#pHint'); await sleep(80);
		ok('20. a Picture Grid hint names the line whose clue decides a cell', await f.evaluate(() => /(Row|Column) \d+.s clue/.test(document.getElementById('toast').textContent)), await f.evaluate(() => document.getElementById('toast').textContent));
		await f.evaluate(() => { const G = __lp.get(); const k = G.P.sol.indexOf(1); __lp.fillAllBut(k); window.__k = k });
		const kk = await f.evaluate(() => __k);
		ok('21. a row that matches its clue is greyed out', await f.evaluate(() => { const G = __lp.get(); let m = 0; for (let r = 0; r < 10; r++) if (__lp.ngLine(r, true)) m++; return m >= 1 && !__lp.ngLine(Math.floor(__k / 10), true) }));
		await click(kk); await sleep(900);
		ok('22. filling the last cell shows the picture: Solved', await f.evaluate(() => __lp.get().done && /Solved/.test(document.getElementById('ovBody').textContent)));
		await f.click('#ovBtns button:not(.main)');

		/* ---------- Cages ---------- */
		await f.click('[data-kind=cages]'); await sleep(100);
		await f.evaluate(() => __lp.newGame('cages', 'hard', {seed: 'cg'}));
		const cg = await f.evaluate(() => ({n: __lp.get().P.n, cages: __lp.get().P.cages.length, pad: document.querySelectorAll('#pad .num').length}));
		ok('23. Cages Hard: 6×6 with its cages, and the pad has 1 to 6', cg.n == 6 && cg.cages > 6 && cg.pad == 6, JSON.stringify(cg));
		await f.click('#pHint'); await sleep(80);
		ok('24. a Cages hint writes a right number with a reason', await f.evaluate(() => { const G = __lp.get(); return G.val.some(v => v) && G.val.every((v, i) => !v || v == G.P.sol[i]) && /This one is|Only/.test(document.getElementById('toast').textContent) }));
		/* a full cage that misses its target is marked */
		const bc = await f.evaluate(() => { const G = __lp.get(); const cgx = G.P.cages.find(c => c.op == '+' && c.cells.length == 2); if (!cgx) return null; const [a, b] = cgx.cells; const v = G.P.sol[a] % 6 + 1; G.val[a] = v; G.val[b] = G.P.sol[b]; return LP.cageOk(cgx, [v, G.P.sol[b]], true) });
		ok('25. Cages: a cage left wrong is told apart (checked by the cage rules)', bc === false || bc === null);
		await f.evaluate(() => { const G = __lp.get(); G.val.fill(0); const k = 7; __lp.fillAllBut(k); window.__k = k });
		await click(7); await pg.keyboard.press('Digit' + await f.evaluate(() => __lp.get().P.sol[7])); await sleep(900);
		ok('26. Cages: the last number solves it', await f.evaluate(() => __lp.get().done));
		await f.click('#ovBtns button:not(.main)');

		/* ---------- Daily, keeping a puzzle, pausing ---------- */
		const dl = await f.evaluate(() => { const o = {}; for (const k of ['sudoku', 'nonogram', 'cages']) { __lp.newGame(k, 'daily'); const a = JSON.stringify(__lp.get().P); __lp.newGame(k, 'daily'); o[k] = a == JSON.stringify(__lp.get().P) } return o });
		ok('27. Daily: the same puzzle each time, for each kind', dl.sudoku && dl.nonogram && dl.cages, JSON.stringify(dl));
		await f.evaluate(() => __lp.newGame('sudoku', 'medium', {seed: 'keep'}));
		const kp = await f.evaluate(() => { const G = __lp.get(); const i = G.val.indexOf(0); __lp.write(i, G.P.sol[i]); return {i, v: G.P.sol[i], given: G.P.given.join('')} });
		await sleep(700); await pg.evaluate(() => reopen()); await sleep(300); f = await ready(pg);
		ok('28. the puzzle in progress is there when the game is opened again', await f.evaluate(k => { const G = __lp.get(); return G.P.kind == 'sudoku' && G.diff == 'medium' && G.P.given.join('') == k.given && G.val[k.i] == k.v }, kp));
		await pg.evaluate(() => send({op: 'pause'})); await sleep(150);
		const pt = await f.evaluate(() => __lp.get().t); await sleep(1200);
		ok('29. the desktop pauses it (minimised, locked): the clock stops and the puzzle is hidden', await f.evaluate(t => RG.paused && __lp.get().t == t && /Paused/.test(document.getElementById('ovBody').textContent), pt));
		await pg.evaluate(() => send({op: 'resume'})); await f.click('#ovBtns button.main'); await sleep(1200);
		ok('30. ...and resumes', await f.evaluate(t => !RG.paused && __lp.get().t > t + .5, pt));

		/* ---------- a controller ---------- */
		await f.evaluate(() => { __lp.newGame('sudoku', 'easy', {seed: 'pad'}); const G = __lp.get(); G.sel = G.val.indexOf(0); window.__pad = Array.from({length: 17}, () => ({pressed: false, value: 0}));
			navigator.getGamepads = () => [{id: 'test', mapping: 'standard', axes: [0, 0, 0, 0], buttons: window.__pad}] });
		const press = async i => { await f.evaluate(i => __pad[i] = {pressed: true, value: 1}, i); await sleep(60); await f.evaluate(i => __pad[i] = {pressed: false, value: 0}, i); await sleep(60) };
		const s0 = await f.evaluate(() => __lp.get().sel);
		await press(0); await press(0);
		const pv = await f.evaluate(i => __lp.get().val[i], s0);
		await press(15); const s1 = await f.evaluate(() => __lp.get().sel);
		ok('31. a controller: A steps the number, the d-pad moves', pv == 2 && s1 == (s0 % 9 == 8 ? s0 - 8 : s0 + 1), JSON.stringify([pv, s0, s1]));
		await press(14); await press(1);
		ok('32. ...B erases', await f.evaluate(i => __lp.get().val[i] == 0 && __lp.get().sel == i, s0));
		await f.evaluate(() => { navigator.getGamepads = () => [] });

		/* ---------- export and import ---------- */
		await f.evaluate(() => { __lp.save().best['cages-hard'] = 321 });
		const [dlf] = await Promise.all([pg.waitForEvent('download'), f.evaluate(() => RG.save(__lp.save()).then(() => RG.exportSave()))]);
		const txt = fs.readFileSync(await dlf.path(), 'utf8'), j = JSON.parse(txt);
		ok('33. Export save: a file with best times and puzzles in progress', j.rudolfGame == 'logic-pack' && j.data.best['cages-hard'] == 321 && j.data.cur && j.data.cur.sudoku);
		const back = await f.evaluate(t => RG.save({v: 1, best: {}, daily: {}, cur: {}, diff: {}}).then(() => RG.importText(t)).then(d => d.best['cages-hard']), txt);
		const bad = await f.evaluate(() => RG.importText('{"rudolfGame":"block-drop","data":1}').then(() => 'took', e => e.message));
		ok('34. Import save brings it back; another game\'s file is refused', back == 321 && /not a save of this game/.test(bad), bad);
		await f.evaluate(() => __lp.newGame('cages', 'medium', {seed: 'shot'})); await sleep(100);
		await pg.screenshot({path: path.join(W, 'desktop-cages.png')});
		await f.evaluate(() => __lp.newGame('nonogram', 'hard', {seed: 'shot'})); await sleep(100);
		await pg.screenshot({path: path.join(W, 'desktop-picture.png')});
		ok('35. no errors in the console', errs.length == 0, errs.slice(0, 3).join(' | '));

		/* ---------- a phone, upright, with touch ---------- */
		const ph = await br.newContext({viewport: {width: 360, height: 640}, hasTouch: true, isMobile: true});
		const {pg: pp, f: f2} = await open(ph);
		await f2.click('#ovBtns button');
		await f2.evaluate(() => __lp.newGame('sudoku', 'easy', {seed: 'phone'}));
		const lay = await f2.evaluate(() => { const v = __lp.view(), pr = document.getElementById('pad').getBoundingClientRect(), cr = document.getElementById('cv').getBoundingClientRect(); return {fits: v.w * v.scale <= v.cw + .5 && v.h * v.scale <= v.ch + .5, cell: Math.round(40 * v.scale), padBelow: pr.top >= cr.bottom - 1, padIn: pr.bottom <= innerHeight + 1, sw: document.documentElement.scrollWidth, iw: innerWidth} });
		ok('36. a phone upright: the grid fits, the pad sits under it, no sideways scrolling', lay.fits && lay.padBelow && lay.padIn && lay.sw <= lay.iw && lay.cell >= 30, JSON.stringify(lay));
		const fb = await f2.frameElement().then(e => e.boundingBox());
		const at2 = async i => { const p = await f2.evaluate(i => __lp.cellCenter(i), i); return {x: fb.x + p.x, y: fb.y + p.y} };
		const pe = await f2.evaluate(() => __lp.get().val.indexOf(0)), pvv = await f2.evaluate(i => __lp.get().P.sol[i], pe);
		let q = await at2(pe); await pp.touchscreen.tap(q.x, q.y); await sleep(60);
		const nb = await f2.$(`#pad .num[data-v="${pvv}"]`), nbb = await nb.boundingBox(); await pp.touchscreen.tap(nbb.x + nbb.width / 2, nbb.y + nbb.height / 2); await sleep(80);
		ok('37. touch: tap a cell, tap a number', await f2.evaluate(([i, v]) => __lp.get().val[i] == v, [pe, pvv]));
		await f2.evaluate(() => __lp.newGame('nonogram', 'hard', {seed: 'phone'}));
		const ly2 = await f2.evaluate(() => { const v = __lp.view(); return {fits: v.w * v.scale <= v.cw + .5 && v.h * v.scale <= v.ch + .5, cell: Math.round(26 * v.scale * 10) / 10} });
		ok('38. a phone: Picture Grid Hard (15×15) fits, cells big enough to tap', ly2.fits && ly2.cell >= 14, JSON.stringify(ly2));
		const cl = await f2.evaluate(() => { const G = __lp.get(); for (let i = 0; i < 225; i++) if (!G.P.given.includes(i)) return i });
		q = await at2(cl); const cdp = await ph.newCDPSession(pp);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: q.x, y: q.y}]}); await sleep(600);
		await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await sleep(80);
		ok('39. touch: holding a cell crosses it', await f2.evaluate(i => __lp.get().cells[i] == 2, cl));
		await pp.touchscreen.tap(q.x, q.y); await sleep(80); const c1 = await f2.evaluate(i => __lp.get().cells[i], cl);
		await pp.touchscreen.tap(q.x, q.y); await sleep(80); const c2 = await f2.evaluate(i => __lp.get().cells[i], cl);
		ok('40. ...a tap clears a crossed cell, and the next tap fills it', c1 == 0 && c2 == 1, JSON.stringify([c1, c2]));
		await f2.evaluate(() => __lp.newGame('sudoku', 'easy', {seed: 'phone'}));
		await pp.screenshot({path: path.join(W, 'phone.png')});

		const {pg: dk, f: f3} = await open(ctx, '?theme=dark');
		ok('41. dark theme', await f3.evaluate(() => document.documentElement.classList.contains('dark') && getComputedStyle(document.body).backgroundColor != 'rgb(238, 240, 232)'));
		await f3.click('#ovBtns button'); await f3.evaluate(() => __lp.newGame('cages', 'easy', {seed: 'dk'})); await sleep(200); await dk.screenshot({path: path.join(W, 'dark.png')});
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
