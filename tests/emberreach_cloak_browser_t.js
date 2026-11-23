/* Ember Reach's Precursor cloaking device in Chromium (Playwright), as the Rudolf OS desktop opens it (0.5.9;
   docs/plan-ember-reach-pilots.md P4): given (the test-only award), taken out and fitted again at the outfitter,
   raised with its key, pirates losing the ship, a missile losing its lock, firing showing the ship for 3 s, a faint
   ghost in third person, overheating, and docking lowering the field.
     node tests/emberreach_cloak_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8240), TOP = path.join(__dirname, '..');
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
		/* (a page that differs only after # isn't reloaded by goto: reload it) */
		const open = async h => { await pg.goto(`http://127.0.0.1:${PORT}/desk.html#` + h); await pg.reload() };
		const S = () => pg.evaluate(() => JSON.parse(JSON.stringify(SAVES)));
		const saveNow = async f => { await f.evaluate(() => EmberDebug.persist()); await sleep(1600) };
		const pause = async () => { await pg.evaluate(() => send({op: 'pause'})); await sleep(600) };   /* (the desktop's pause, as the main test does) */
		const btn = async (f, t) => f.evaluate(t => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == t).click(), t);
		const yours = async f => { await pause(); await btn(f, 'Your pilot'); return frame(pg, () => !!document.getElementById('crHcState')) };
		const screen = f => f.evaluate(() => ({h: document.getElementById('ovT').textContent, radios: [...document.querySelectorAll('input[name=crDiff]')].map(r => r.value + (r.checked ? '*' : '') + (r.disabled ? '-' : '')).join(' '),
			why: (document.getElementById('crWhy') || {}).textContent || '', state: document.getElementById('crHcState').textContent, off: !!document.getElementById('crHcOff')}));
		const scr = async (f, k) => { await f.click('#port [data-screen="' + k + '"]'); await sleep(250) };
		const G = f => f.evaluate(() => { const g = EmberDebug.game; return {on: !!(g.cloak && g.cloak.on), until: g.cloak ? g.cloak.until : 0, t: g.t, heat: g.pcs.heat, docked: g.docked} });
		/* a Hardcore pilot, given the device (the award is the questline's end: M6; here the test-only hook) */
		await open('debug');
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="0"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.check('#crHc'); await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('#port [data-screen="outfitting"]'));
		const slot = await f.evaluate(() => { const P = EmberDebug.game.P, i = P.ship.fit.utility.length - 1; P.ship.fit.utility[i] = null; EmberCloak.award(P, EmberDebug.game.day); EmberDebug.refit && EmberDebug.refit(); return i });
		/* the outfitter */
		await scr(f, 'station'); await scr(f, 'outfitting'); await f.click('#port [data-oftab="utility"]'); await sleep(200); await f.click('#port [data-ofslot="' + slot + '"]'); await sleep(250);
		const o1 = await f.evaluate(() => { const side = document.querySelector('#port .pt-side'); return {text: side.textContent, store: [...side.querySelectorAll('[data-act="ofstore"]')].map(b => b.textContent), sell: !!side.querySelector('[data-act="ofsell"]')} });
		ok('1. fitted, the outfitter shows it as yours for good: Take out (it stays yours), no Store, no Sell', /Precursor cloaking device/.test(o1.text) && /yours for good/.test(o1.text) && o1.store.join() == 'Take out (it stays yours)' && !o1.sell, o1);
		await f.click('#port [data-act="ofstore"]'); await sleep(300);
		const o2 = await f.evaluate(() => ({where: EmberCloak.where(EmberDebug.game.P), stored: (EmberDebug.game.P.stored || []).some(m => m.id == 'cloak'), fitHere: !!document.querySelector('#port [data-act="ofcloakin"]')}));
		ok('2. taken out: the pilot\'s, unfitted (not in storage), with Fit your Precursor cloaking device here on the mount', o2.where == 'free' && !o2.stored && o2.fitHere, o2);
		await f.click('#port [data-act="ofcloakin"]'); await sleep(300);
		ok('3. fitted again from there', await f.evaluate(() => EmberCloak.where(EmberDebug.game.P) == 'ship'));
		await pg.screenshot({path: path.join(W, 'outfitter.png')});
		/* out, and raised */
		await scr(f, 'launch'); await f.click('#port [data-act="launch"]'); await sleep(1500);
		f = await frame(pg, () => window.EmberDebug && !EmberDebug.game.docked);
		await f.focus('#hud'); await pg.keyboard.press('Digit3'); await sleep(300);
		const up = await G(f), radial = await f.evaluate(() => radialMain ? 1 : 0).catch(() => 0);
		ok('4. the Cloaking device key (3) raises the field', up.on, up);
		/* pirates: they lose the ship */
		await pg.keyboard.press('Digit6'); await sleep(400);
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s; for (const n of g.npcs.filter(n => n.pirate || n.hostile || n.foe)) { n.s.p = [s.p[0] + 900, s.p[1], s.p[2] + 900]; n.foe = EmberDebug.ME || n.foe } window.__hp = g.pcs.hull + g.pcs.shield });
		await sleep(5000);
		const ph = await f.evaluate(() => { const g = EmberDebug.game; return {n: g.npcs.length, hp: g.pcs.hull + g.pcs.shield, was: window.__hp, locks: g.npcs.filter(n => n.cs.lock && n.cs.lock.id == 'me').length, at: g.shots.filter(m => m.target == 'me').length, on: g.cloak.on, heat: g.pcs.heat} });
		ok('5. pirates nearby don\'t find the ship: no damage, no lock on it, nothing homing on it', ph.n > 0 && ph.hp == ph.was && ph.locks == 0 && ph.at == 0 && ph.on, ph);
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s; g.shots.push({kind: 'missile', owner: 'x', target: 'me', p: [s.p[0] + 3000, s.p[1], s.p[2]], v: [0, 0, 0], t: g.t, life: 10, dmg: 30}) }); await sleep(300);
		ok('6. a missile homing on the ship loses its lock', await f.evaluate(() => !EmberDebug.game.shots.some(m => m.target == 'me')));
		/* firing shows the ship */
		await f.evaluate(() => { for (const n of EmberDebug.game.npcs) n.cs.dead = true });
		await f.focus('#hud'); await pg.keyboard.down('Semicolon'); await sleep(250); await pg.keyboard.up('Semicolon'); await sleep(100);
		const fired = await G(f);
		ok('7. firing shows the ship for 3 s (the HUD says SHOWN), then it\'s hidden again', fired.on && fired.until > fired.t && fired.until - fired.t <= 3.01, fired);
		await sleep(3300); const again = await G(f);
		ok('8. ...hidden again after', again.on && again.t >= again.until, again);
		/* third person: a faint ghost */
		await pg.keyboard.press('KeyV'); await sleep(800);
		await pg.screenshot({path: path.join(W, 'ghost.png')});
		await pg.keyboard.press('KeyV'); await sleep(200);
		/* overheating */
		await f.evaluate(() => { EmberDebug.game.pcs.heat = 0.97 }); await sleep(1500);
		const oh = await G(f);
		ok('9. at overheat the field fails, and won\'t go up again while hot', !oh.on && (await (async () => { await pg.keyboard.press('Digit3'); await sleep(200); return !(await G(f)).on })()), oh);
		/* docking lowers it */
		await f.evaluate(() => { EmberDebug.game.pcs.heat = 0; EmberDebug.game.pcs.hot = false }); await pg.keyboard.press('Digit3'); await sleep(200);
		const before = (await G(f)).on; await f.evaluate(() => EmberDebug.dock()); await sleep(600);
		const dk = await G(f);
		ok('10. docking lowers the field', before && dk.docked && !dk.on, {before, dk});
		ok('11. no errors', errs.length == 0, errs);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
