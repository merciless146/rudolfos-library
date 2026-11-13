/* Ember Reach (the Single-Player Alpha Build) in Chromium (Playwright), as the Rudolf OS desktop opens it: a sandboxed
   frame, saves kept by the desktop. A new game (choosing an origin), the starport, launching and flying, the star
   map, a jump, pausing, the save and resuming from it, the Rift's Maw, losing the ship (insurance), and no errors on the way.
     node tests/emberreach_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8231), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES=JSON.parse(sessionStorage.getItem('saves')||'{}');
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;sessionStorage.setItem('saves',JSON.stringify(SAVES));reply({})}});
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
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&ship=corsair`);   /* (a new game in a Griffin: room for a phaser) */
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		const start = await f.evaluate(() => ({build: (document.querySelector('#ovBody .build') || {}).textContent, n: document.querySelectorAll('#ovBody button[data-i]').length, h: document.getElementById('ovT').textContent}));
		ok('1. a new game opens on choosing an origin, among the 46 great powers, marked as the single-player alpha', start.n == 46 && /Single-Player Alpha Build 0\.1\.0/.test(start.build) && /origin/.test(start.h), start);
		await pg.screenshot({path: path.join(W, 'origin.png')});
		await f.click('#ovBody button[data-i="5"]');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('[data-screen="launch"]'));
		const dock = await f.evaluate(() => ({docked: EmberDebug.game.docked, star: EmberDebug.game.star.id, home: EmberDebug.game.home.star.id, screens: document.querySelectorAll('[data-screen]').length}));
		ok('2. it starts docked at that power\'s capital, in the starport (nine screens)', dock.docked && dock.star == dock.home && dock.screens >= 9, dock);
		for (const sc of ['station', 'market', 'bulletin', 'shipyard', 'outfitting', 'contacts', 'carto', 'status']) { await f.click('[data-screen="' + sc + '"]'); await sleep(120) }
		ok('3. every starport screen opens', errs.length == 0, errs);
		await pg.screenshot({path: path.join(W, 'port.png')});
		await f.click('[data-screen="launch"]'); await sleep(200); await f.click('[data-act="launch"]'); await sleep(1500);
		const fly = await f.evaluate(() => ({docked: EmberDebug.game.docked, v: Math.hypot(...EmberDebug.s.v)}));
		await f.focus('#hud'); await pg.keyboard.down('KeyW'); await sleep(1500); await pg.keyboard.up('KeyW');
		const fly2 = await f.evaluate(() => ({v: Math.hypot(...EmberDebug.s.v), thr: EmberDebug.game.throttle}));
		ok('4. it launches, and the throttle flies the ship', !fly.docked && (fly2.v > fly.v || fly2.thr > 0), [fly, fly2]);
		await pg.screenshot({path: path.join(W, 'flight.png')});
		const saved = await pg.evaluate(() => SAVES['ember-reach']);
		ok('5. the desktop keeps the save (launching saves)', saved && saved.v == 3 && saved.player && saved.docked === false, saved && Object.keys(saved));
		await pg.keyboard.press('KeyG'); await sleep(1200); const mapOn = await f.evaluate(() => EmberDebug.game.mapOpen); await pg.screenshot({path: path.join(W, 'map.png')}); await pg.keyboard.press('KeyG'); await sleep(300); const mapOff = await f.evaluate(() => !EmberDebug.game.mapOpen);
		ok('6. the star map opens and closes (G)', mapOn && mapOff && errs.length == 0, {mapOn, mapOff, errs});
		/* a jump: straight to a near star with worlds (the debug hook skips the drive's charge) */
		const to = await f.evaluate(() => { const g = EmberDebug.game, h = g.star, s = EmberGalaxy.starsNear(h.x, h.y, h.z, 6).find(x => x.id != h.id && x.kind == 'star' && EmberGalaxy.system(x).planets.length); EmberDebug.go(s); return s.id });
		await sleep(1500);
		ok('7. a jump to another star builds its system', await f.evaluate(id => EmberDebug.game.star.id == id && EmberDebug.scene.bodies.length > 1, to));
		await pg.evaluate(() => send({op: 'pause'})); await sleep(400);
		const paused = await f.evaluate(() => ({ov: !document.getElementById('ov').hidden, h: document.getElementById('ovT').textContent, build: (document.querySelector('#ovBody .build') || {}).textContent}));
		ok('8. the desktop\'s pause pauses it (the alpha build named on the pause screen)', paused.ov && /Paused/.test(paused.h) && /Alpha/.test(paused.build), paused);
		await pg.evaluate(() => send({op: 'resume'})); await f.click('#ovBtns button.primary').catch(() => {}); await sleep(1200);
		/* the Maw and the Rift */
		await f.evaluate(() => { EmberDebug.go(EmberGalaxy.lookup('heart', [0, 0, 0])); EmberDebug.game.npcs = [] }); await sleep(800);
		await f.evaluate(() => { const g = EmberDebug.game, f0 = g.P.ship.fit, L = EmberOutfit.layout(EmberShips.hull(g.P.ship.model)); const i = L.internal.findIndex(z => z >= 3); if (i < 0) return; f0.internal[i] = {id: 'phaser', size: 3, grade: 'A'}; f0.core.power.grade = 'A'; EmberDebug.refit(); EmberDebug.near(EmberDebug.scene.bodies[0], 3.4) });
		await f.focus('#hud'); await pg.keyboard.press('KeyJ'); await sleep(15000);
		const rift = await f.evaluate(() => ({id: EmberDebug.game.star.id, realm: EmberGalaxy.realm(), riftborn: EmberDebug.game.npcs.filter(n => n.role == 'riftborn').length}));
		ok('9. with a phaser, the Maw takes the ship into the Rift', rift.id == 'R:heart' && rift.realm == 'rift', rift);
		await pg.screenshot({path: path.join(W, 'rift.png')});
		await f.evaluate(() => { EmberDebug.game.npcs = []; EmberDebug.settle && 0 }); await pg.evaluate(() => send({op: 'pause'})); await sleep(1200);
		/* reopen: the save takes it back where it was */
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug`); await pg.reload(); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.star && EmberDebug.scene);
		const back = await f.evaluate(() => ({id: EmberDebug.game.star.id, realm: EmberGalaxy.realm(), chooser: !!document.querySelector('#ovBody button[data-i]')}));
		ok('10. reopened, it resumes from the save (in the Rift), without asking for an origin', back.id == 'R:heart' && back.realm == 'rift' && !back.chooser, back);
		/* losing the ship: the insurer (insurance.js) brings it back, this side of the Maw */
		const lostAt = await f.evaluate(() => { EmberDebug.lose('a test'); const g = EmberDebug.game; return {star: g.star.id, realm: EmberGalaxy.realm(), ship: EmberDebug.ship.name, hull: g.pcs.hull > 0, port: !!g.port, msg: g.msgs.slice(-3).map(m => m.text).join(' | ')} });
		ok('11. lost in the Rift, the ship comes back under its insurance, at a port this side', lostAt.realm == 'normal' && !lostAt.star.startsWith('R:') && lostAt.ship == 'Griffin' && lostAt.hull && lostAt.port && /Insurance|waits at/.test(lostAt.msg), lostAt);
		ok('12. no errors on the way', errs.length == 0, errs);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
