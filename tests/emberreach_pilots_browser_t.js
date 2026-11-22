/* Ember Reach's pilots in Chromium (Playwright), as the Rudolf OS desktop opens it (0.5.5; docs/plan-ember-reach-pilots.md
   P1): the first pilot in a new galaxy, the pilots' screen from the pause menu, a second pilot from another power
   sharing the galaxy but not the money, launching back into the last pilot, deleting a pilot, an old save migrated,
   a file of several saves loaded, and wiping the galaxy.
     node tests/emberreach_pilots_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8236), TOP = path.join(__dirname, '..');
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
		/* no pilots: a first launch opens on the origins, as a new game did */
		await open('debug');
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="0"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.click('#crStart');   /* (0.5.6: the new pilot's name and difficulty, as offered) */
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const a0 = await f.evaluate(() => ({slot: EmberDebug.game.slot, id: EmberDebug.game.pilotId, origin: EmberDebug.game.P.origin, code: EmberDebug.game.home.currency.code}));
		await f.evaluate(c => { EmberDebug.game.P.wallet[c] = 4321; EmberDebug.game.P.mined['rock:pilots-test'] = 9 }, a0.code); await saveNow(f);
		let sv = await S();
		ok('1. the first pilot is pilot 1 in slot 1 of a new galaxy: their save, the galaxy (with their summary) and the settings', a0.slot == 0 && a0.id == 'p1' && sv['ember-reach-pilot-1'] && sv['ember-reach-galaxy'].slots[0].id == 'p1' && sv['ember-reach-galaxy'].slots[0].cash.n == 4321
			&& sv['ember-reach-galaxy'].world.mined['rock:pilots-test'] == 9 && !('mined' in sv['ember-reach-pilot-1'].player) && sv['ember-reach'].settingsOnly, a0);
		/* the pause menu: Pilots in place of New game */
		await pause();
		const menu = await f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent));
		ok('2. the pause menu has Pilots (and no New game)', menu.includes('Pilots') && !menu.some(t => /New game/.test(t)), menu);
		await f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Pilots').click());
		f = await frame(pg, () => !!document.querySelector('.pt-slots'));
		const scr = await f.evaluate(() => ({h: document.getElementById('ovT').textContent, rows: [...document.querySelectorAll('.pt-slot')].map(r => r.textContent), play: document.querySelectorAll('[data-play]').length, nw: document.querySelectorAll('[data-new]').length, wipe: !!document.getElementById('wipeGalaxy')}));
		ok('3. the pilots\' screen: six slots, pilot 1 with their origin, ship, money and day (Play, Delete), five free (New pilot), and Wipe the galaxy', scr.h == 'Your pilots' && scr.rows.length == 6 && scr.play == 1 && scr.nw == 5 && scr.wipe && /4,321/.test(scr.rows[0]) && /Day \d+/.test(scr.rows[0]), scr);
		await pg.screenshot({path: path.join(W, 'pilots.png')});
		/* a second pilot, from another power, in slot 3 */
		await f.click('[data-new="2"]');
		f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="5"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.click('#crStart');   /* (0.5.6: the new pilot's name and difficulty, as offered) */
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const b0 = await f.evaluate(c => ({slot: EmberDebug.game.slot, id: EmberDebug.game.pilotId, origin: EmberDebug.game.P.origin, money: EmberDebug.game.P.wallet[c] || 0, mined: EmberDebug.game.P.mined['rock:pilots-test']}), a0.code);
		ok('4. a second pilot (slot 3, another origin) has their own money, and finds the galaxy pilot 1 left (the asteroid they mined)', b0.slot == 2 && b0.id == 'p2' && b0.origin != a0.origin && b0.money != 4321 && b0.mined == 9, b0);
		await f.evaluate(() => { EmberDebug.game.P.mined['rock:by-p2'] = 3 }); await saveNow(f);
		sv = await S();
		ok('5. their save is pilot 3\'s value; the galaxy has both pilots and plays pilot 2 next', sv['ember-reach-pilot-3'] && sv['ember-reach-galaxy'].slots[2].id == 'p2' && sv['ember-reach-galaxy'].slots[0].id == 'p1' && sv['ember-reach-galaxy'].cur == 2 && sv['ember-reach-galaxy'].world.mined['rock:by-p2'] == 3);
		/* launching again goes to the last pilot played; then back to pilot 1, who sees pilot 2's mining */
		await open('debug');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.P && EmberDebug.game.docked);
		const again = await f.evaluate(() => EmberDebug.game.pilotId);
		await open('debug&pilots');
		f = await frame(pg, () => !!document.querySelector('[data-play="0"]'));
		await f.click('[data-play="0"]');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.P && EmberDebug.game.docked);
		const a1 = await f.evaluate(c => ({id: EmberDebug.game.pilotId, money: EmberDebug.game.P.wallet[c], mined: EmberDebug.game.P.mined['rock:by-p2']}), a0.code);
		ok('6. launching resumes the pilot played last (pilot 2); choosing pilot 1 brings back their money, and they see what pilot 2 mined', again == 'p2' && a1.id == 'p1' && a1.money == 4321 && a1.mined == 3, {again, a1});
		/* deleting pilot 2: their slot freed, the galaxy keeps their mining */
		await open('debug&pilots');
		f = await frame(pg, () => !!document.querySelector('[data-del="2"]'));
		await f.click('[data-del="2"]'); const sure = await f.evaluate(() => document.querySelector('[data-del="2"]').textContent);
		await f.click('[data-del="2"]'); await sleep(500);
		sv = await S();
		const rows = await f.evaluate(() => ({nw: document.querySelectorAll('[data-new]').length, play: document.querySelectorAll('[data-play]').length}));
		ok('7. Delete asks first, then frees the slot (pilot 2\'s save cleared); the galaxy keeps what they did and pilot 1', /sure/.test(sure) && rows.nw == 5 && rows.play == 1 && sv['ember-reach-pilot-3'] == null && sv['ember-reach-galaxy'].slots[2] == null && sv['ember-reach-galaxy'].slots[0].id == 'p1' && sv['ember-reach-galaxy'].world.mined['rock:by-p2'] == 3, {sure, rows});
		/* a save from before 0.5.5: the old single value becomes the galaxy and pilot 1 */
		const old = Object.assign({}, sv['ember-reach-pilot-1']); old.player = Object.assign({}, old.player, {mined: {'rock:old': 4}, markets: {}, warEvents: [], colonies: []}); old.player.wallet = Object.assign({}, old.player.wallet, {[a0.code]: 999});
		await pg.evaluate(o => { for (const k of Object.keys(SAVES)) delete SAVES[k]; SAVES['ember-reach'] = o; sessionStorage.setItem('saves', JSON.stringify(SAVES)) }, old);
		await open('debug');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.P && EmberDebug.game.docked);
		const mg = await f.evaluate(c => ({id: EmberDebug.game.pilotId, money: EmberDebug.game.P.wallet[c], mined: EmberDebug.game.P.mined['rock:old']}), a0.code); sv = await S();
		ok('8. an old save (one value) is migrated: pilot 1 with its money, the galaxy with its mining; the game\'s own value keeps only the settings', mg.id == 'p1' && mg.money == 999 && mg.mined == 4 && sv['ember-reach-galaxy'] && sv['ember-reach-galaxy'].slots[0].id == 'p1' && sv['ember-reach-pilot-1'] && sv['ember-reach'].settingsOnly && !sv['ember-reach'].player, mg);
		/* a file holding the galaxy and the pilots loads them all */
		const file = JSON.stringify({rudolfGame: 'ember-reach', version: 1, data: sv['ember-reach'], slots: {galaxy: Object.assign({}, sv['ember-reach-galaxy'], {day: sv['ember-reach-galaxy'].day + 1}), 'pilot-1': sv['ember-reach-pilot-1'], 'pilot-4': sv['ember-reach-pilot-1']}});
		await f.evaluate(t => RG.importText(t), file); sv = await S();
		ok('9. a file with slots (Save to a file) loads the galaxy and every pilot in it', sv['ember-reach-pilot-4'] && sv['ember-reach-galaxy'].day == JSON.parse(file).slots.galaxy.day);
		/* wiping the galaxy: all pilots gone, the settings stay */
		await open('debug&pilots');
		f = await frame(pg, () => !!document.getElementById('wipeGalaxy'));
		await f.click('#wipeGalaxy'); const w1 = await f.evaluate(() => document.getElementById('wipeGalaxy').textContent);
		await f.click('#wipeGalaxy'); await sleep(600); sv = await S();
		const after = await f.evaluate(() => ({nw: document.querySelectorAll('[data-new]').length, play: document.querySelectorAll('[data-play]').length}));
		ok('10. Wipe the galaxy asks first, then deletes every pilot and the galaxy (the settings stay)', /all six pilots/.test(w1) && after.nw == 6 && after.play == 0 && sv['ember-reach-galaxy'] == null && [1, 2, 3, 4, 5, 6].every(i => sv['ember-reach-pilot-' + i] == null) && sv['ember-reach'] && sv['ember-reach'].settingsOnly, {w1, after});
		await f.click('[data-new="0"]');
		f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="1"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.click('#crStart');   /* (0.5.6: the new pilot's name and difficulty, as offered) */
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const fresh = await f.evaluate(() => ({id: EmberDebug.game.pilotId, mined: Object.keys(EmberDebug.game.P.mined).length}));
		ok('11. after the wipe, a new pilot starts a new galaxy (pilot 1 again, nothing mined)', fresh.id == 'p1' && fresh.mined == 0, fresh);
		ok('12. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
