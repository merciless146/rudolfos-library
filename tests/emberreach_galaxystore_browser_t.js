/* Ember Reach's galaxy over several records in Chromium (Playwright), as the Rudolf OS desktop opens it (0.5.8;
   docs/plan-ember-reach-pilots.md P2b): the head and nine parts written, then only the part that changed, the galaxy
   read back from them, an older single record read and split, the record limit the desktop says (and 256 KB from
   one that doesn't), and the game kit keeping saves in the browser's IndexedDB outside Rudolf OS.
     node tests/emberreach_galaxystore_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8239), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'kit.html'), '<!doctype html><body><script src="www/gamekit.js"></script><script>window.go = async () => { await RG.init("kit-test"); return RG.maxSave }</script>');
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES=JSON.parse(sessionStorage.getItem('saves')||'{}');window.WRITES={};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply(Object.assign({dark:true,reduceFlash:false},/max6/.test(location.hash)?{maxSave:6*1048576}:{}));else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){WRITES[m.game]=(WRITES[m.game]||0)+1;SAVES[m.game]=m.data;sessionStorage.setItem('saves',JSON.stringify(SAVES));reply({})}});
window.send=o=>document.getElementById('f').contentWindow.postMessage(Object.assign({rudolfGame:1},o),'*');
document.getElementById('f').src='www/index.html?'+(location.hash.slice(1)||'debug');</script>`);
const errs = [];
async function frame(pg, test) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 300; i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		const ctx = await br.newContext({viewport: {width: 1100, height: 720}});
		const pg = await ctx.newPage();
		pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
		/* (a page that differs only after # isn't reloaded by goto: reload it) */
		const open = async h => { await pg.goto(`http://127.0.0.1:${PORT}/desk.html#` + h); await pg.reload() };
		const S = () => pg.evaluate(() => JSON.parse(JSON.stringify(SAVES)));
		const saveNow = async f => { await f.evaluate(() => EmberDebug.persist()); await sleep(1600) };
		const pause = async () => { await pg.evaluate(() => send({op: 'pause'})); await sleep(600) };   /* (the desktop's pause, as the main test does) */
		const btn = async (f, t) => f.evaluate(t => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == t).click(), t);
		const yours = async f => { await pause(); await btn(f, 'Your pilot'); return frame(pg, () => !!document.getElementById('crHcState')) };
		const screen = f => f.evaluate(() => ({h: document.getElementById('ovT').textContent, radios: [...document.querySelectorAll('input[name=crDiff]')].map(r => r.value + (r.checked ? '*' : '') + (r.disabled ? '-' : '')).join(' '),
			why: (document.getElementById('crWhy') || {}).textContent || '', state: document.getElementById('crHcState').textContent, off: !!document.getElementById('crHcOff')}));
		const parts = sv => Array.from({length: 9}, (_, k) => sv['ember-reach-galaxy-' + (k + 1)]);
		/* a desktop that says its limit (Rudolf OS 1.6.2) */
		await open('debug&max6');
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="0"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const lim = await f.evaluate(() => [RG.maxSave, EmberSave.MAXREC]);
		await saveNow(f); let sv = await S();
		ok('1. the desktop says 6 MB a record, and the game takes it', lim[0] == 6 * 1048576 && lim[1] == 6 * 1048576, lim);
		ok('2. the galaxy is saved as a head (marked with its nine parts) and nine part records', sv['ember-reach-galaxy'].parts == 9 && !('colonies' in sv['ember-reach-galaxy'].world) && parts(sv).every(p => p && p.gp == 1), Object.keys(sv));
		/* one colony: only its part is written again */
		const where = await f.evaluate(() => { const id = '40,-12,8/#1'; EmberDebug.game.P.colonies = (EmberDebug.game.P.colonies || []).concat([{id, star: {id, name: 'Test Haven', at: [1, 2, 3]}, sponsor: null, independent: true, port: 'outpost', world: 'Test Haven b', stage: 'done', opens: 5, pop: 10, builds: [], need: {}, got: {}}]); return EmberSave.regionOf(id) });
		await pg.evaluate(() => { for (const k in WRITES) delete WRITES[k] });
		await saveNow(f); sv = await S();
		const w = await pg.evaluate(() => Object.assign({}, WRITES)), partWrites = Object.keys(w).filter(k => /galaxy-\d/.test(k));
		ok('3. a new colony: the head and only the part of its region are written again', partWrites.length == 1 && partWrites[0] == 'ember-reach-galaxy-' + (where + 1) && w['ember-reach-galaxy'] >= 1 && parts(sv)[where].colonies.some(c => c.i == '40,-12,8/#1'), {w, where});
		/* read back */
		await open('debug&max6'); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const back = await f.evaluate(() => (EmberDebug.game.P.colonies || []).find(c => c.id == '40,-12,8/#1'));
		ok('4. launched again, the galaxy is read back from its records: the colony is there, whole', back && back.star.name == 'Test Haven' && back.pop == 10 && back.port == 'outpost', back);
		/* an older single record (0.5.5–0.5.7): read, then split */
		const oldRec = await f.evaluate(() => { const g = EmberDebug.game; return JSON.parse(JSON.stringify(EmberSave.packGalaxy(g.galaxy, g.P, g.pilotId, g.day))) });
		await pg.evaluate(o => { SAVES['ember-reach-galaxy'] = o; for (let k = 1; k <= 9; k++) delete SAVES['ember-reach-galaxy-' + k]; sessionStorage.setItem('saves', JSON.stringify(SAVES)) }, oldRec);
		sv = await S();
		const was = !('parts' in sv['ember-reach-galaxy']) && sv['ember-reach-galaxy'].world.colonies.length >= 1 && parts(sv).every(p => !p);
		await open('debug&max6'); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const old = await f.evaluate(() => !!(EmberDebug.game.P.colonies || []).find(c => c.id == '40,-12,8/#1'));
		await saveNow(f); sv = await S();
		ok('5. a galaxy saved as one record is read as it is, and split into the head and parts at the next save', was && old && sv['ember-reach-galaxy'].parts == 9 && parts(sv).every(p => p && p.gp == 1) && parts(sv)[where].colonies.length >= 1, {was, old});
		/* a desktop that says nothing (Rudolf OS 1.6.1) */
		await open('debug'); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const lim2 = await f.evaluate(async () => [RG.maxSave, EmberSave.MAXREC, await RG.save({x: 'a'.repeat(300 * 1024)}, 'big').then(() => 'kept', e => e.message)]);
		ok('6. a desktop that doesn\'t say (Rudolf OS 1.6.1): 256 KB a record, and a bigger save is refused by the kit', lim2[0] == 256 * 1024 && lim2[1] == 256 * 1024 && /too large/.test(lim2[2]), lim2);
		/* outside Rudolf OS: the kit keeps saves in IndexedDB */
		const kp = await ctx.newPage(); kp.on('pageerror', e => errs.push(String(e)));
		await kp.goto(`http://127.0.0.1:${PORT}/kit.html`);
		const k1 = await kp.evaluate(async () => { const m = await go(); const ok = await RG.save({x: 'b'.repeat(1048576)}, 'big'); return {m, ok} });
		await kp.reload();
		const k2 = await kp.evaluate(async () => { await go(); const v = await RG.load('big'); return {len: v && v.x ? v.x.length : 0, ls: localStorage.getItem('rudolf-game:kit-test-big')} });
		ok('7. in a browser, outside Rudolf OS: 6 MB a record, kept in IndexedDB (a 1 MB save comes back after a reload; nothing in localStorage)', k1.m == 6 * 1048576 && k1.ok && k2.len == 1048576 && k2.ls === null, {k1, k2});
		ok('8. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
