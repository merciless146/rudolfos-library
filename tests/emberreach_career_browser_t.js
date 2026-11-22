/* Ember Reach's careers in Chromium (Playwright), as the Rudolf OS desktop opens it (0.5.6; docs/plan-ember-reach-pilots.md
   P2): a new pilot's name, difficulty and Hardcore; Your pilot from the pause menu; a Hardcore death (the pilot gone,
   the galaxy keeping their colony, independent); a difficulty changed while docked; Hardcore turned off for good.
     node tests/emberreach_career_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8237), TOP = path.join(__dirname, '..');
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
		/* a new pilot: name, difficulty, Hardcore */
		await open('debug');
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="0"]');
		f = await frame(pg, () => !!document.getElementById('crStart'));
		const dlg0 = await f.evaluate(() => ({h: document.getElementById('ovT').textContent, name: !!document.getElementById('crName'), radios: [...document.querySelectorAll('input[name=crDiff]')].map(r => r.value + (r.checked ? '*' : '')).join(' '), hc: !!document.getElementById('crHc')}));
		await f.fill('#crName', '  Ada   Vex'); await f.check('#crHc');
		const dlg1 = await f.evaluate(() => [...document.querySelectorAll('input[name=crDiff]')].map(r => r.value + (r.checked ? '*' : '') + (r.disabled ? '-' : '')).join(' '));
		ok('1. a new pilot is offered a name, Rookie / Pilot (chosen) / Admiral and Hardcore; Hardcore fixes the difficulty at Admiral', dlg0.h == 'New pilot' && dlg0.name && dlg0.hc && dlg0.radios == 'rookie pilot* admiral' && dlg1 == 'rookie- pilot- admiral*-', {dlg0, dlg1});
		await pg.screenshot({path: path.join(W, 'new-pilot.png')});
		await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const a = await f.evaluate(() => ({name: EmberDebug.game.P.name, diff: EmberDebug.game.P.diff, hc: EmberDebug.game.P.hc, id: EmberDebug.game.pilotId}));
		await f.evaluate(() => { EmberDebug.game.P.colonies = [{id: 'hc-test', star: {id: 'hc-test', name: 'Test Star', at: [0, 0, 0]}, stage: 'done', port: 'outpost', world: 'Test Star b', need: {}, got: {}}] }); await saveNow(f);
		let sv = await S();
		ok('2. the pilot flies as "Ada Vex", an Admiral with Hardcore on, and the save and the galaxy\'s slot say so', a.name == 'Ada Vex' && a.diff == 'admiral' && a.hc == 'on' && sv['ember-reach-pilot-1'].player.hc == 'on' && sv['ember-reach-galaxy'].slots[0].name == 'Ada Vex' && sv['ember-reach-galaxy'].slots[0].hc == 'on', {a, slot: sv['ember-reach-galaxy'].slots[0]});
		/* Your pilot */
		f = await yours(f); const y1 = await screen(f);
		ok('3. Your pilot (from the pause menu): the name, Admiral held while Hardcore is on (why said), Hardcore\'s state and Turn Hardcore off', y1.h == 'Ada Vex' && y1.radios == 'rookie- pilot- admiral*-' && /Admiral until Hardcore ends/.test(y1.why) && /Hardcore is on/.test(y1.state) && y1.off, y1);
		await pg.screenshot({path: path.join(W, 'your-pilot.png')});
		await btn(f, 'Done'); await sleep(300);
		await pg.evaluate(() => send({op: 'resume'})); await sleep(300);
		/* the pilots' screen marks a Hardcore pilot */
		await pause(); await btn(f, 'Pilots'); f = await frame(pg, () => !!document.querySelector('.pt-slots'));
		const row = await f.evaluate(() => { const r = document.querySelector('.pt-slot'); return {t: r.textContent, hc: r.classList.contains('hc')} });
		ok('4. the pilots\' screen shows the name, the difficulty and Hardcore', /Ada Vex/.test(row.t) && /Admiral/.test(row.t) && /Hardcore/.test(row.t) && row.hc, row);
		await f.click('[data-play="0"]'); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && EmberDebug.game.pilotId == 'p1');
		/* a Hardcore death */
		await f.evaluate(() => EmberDebug.lose('a test')); f = await frame(pg, () => !!document.getElementById('hcPilots')); await sleep(1200);
		sv = await S(); const lostT = await f.evaluate(() => document.getElementById('ovT').textContent), col = (sv['ember-reach-galaxy'].world.colonies || []).find(c => c.id == 'hc-test');
		ok('5. the ship destroyed with Hardcore on: Pilot lost; their save cleared and their slot freed; the galaxy keeps their colony, now independent', lostT == 'Pilot lost' && sv['ember-reach-pilot-1'] === null && sv['ember-reach-galaxy'].slots[0] === null && col && col.owner === '' && col.orphan, {lostT, slot: sv['ember-reach-galaxy'].slots[0], col});
		await pg.screenshot({path: path.join(W, 'pilot-lost.png')});
		/* a Rookie, then the difficulty changed while docked */
		await f.click('#hcPilots'); f = await frame(pg, () => !!document.querySelector('.pt-slots'));
		const free = await f.evaluate(() => document.querySelectorAll('[data-new]').length);
		await f.click('[data-new="0"]'); f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]')); await f.click('#ovBody button[data-i="1"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.check('input[name=crDiff][value=rookie]'); await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked);
		const b = await f.evaluate(() => ({diff: EmberDebug.game.P.diff, hc: EmberDebug.game.P.hc, name: EmberDebug.game.P.name, id: EmberDebug.game.pilotId}));
		ok('6. back on the pilots\' screen all six slots are free; a new Rookie without a name or Hardcore', free == 6 && b.diff == 'rookie' && b.hc == 'none' && b.name == '' && b.id == 'p2', {free, b});
		f = await yours(f); const y2 = await screen(f);
		await f.check('input[name=crDiff][value=admiral]'); await sleep(200);
		const d2 = await f.evaluate(() => EmberDebug.game.P.diff);
		ok('7. Your pilot for a pilot made without Hardcore: the difficulty free to change while docked (now Admiral), no Turn Hardcore off', y2.h == 'Your pilot' && y2.radios == 'rookie* pilot admiral' && !y2.why && /without Hardcore/.test(y2.state) && !y2.off && d2 == 'admiral', {y2, d2});
		await btn(f, 'Done'); await sleep(300); await pg.evaluate(() => send({op: 'resume'})); await sleep(300);
		/* a second Hardcore pilot turns it off: twice asked; then the difficulty is free and a loss is an ordinary one */
		await pause(); await btn(f, 'Pilots'); f = await frame(pg, () => !!document.querySelector('.pt-slots'));
		await f.click('[data-new="1"]'); f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]')); await f.click('#ovBody button[data-i="2"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.check('#crHc'); await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && EmberDebug.game.pilotId == 'p3');
		f = await yours(f); await f.click('#crHcOff'); await sleep(200);
		const ask = await f.evaluate(() => [document.getElementById('crHcOff').textContent, EmberDebug.game.P.hc]);
		await f.click('#crHcOff'); f = await frame(pg, () => !!document.getElementById('crHcState') && !document.getElementById('crHcOff'));
		const y3 = await screen(f);
		ok('8. Turn Hardcore off asks first (still on), then it is off for good: no button, the difficulty free again', /sure\?/.test(ask[0]) && ask[1] == 'on' && /off for good/.test(y3.state) && !y3.off && y3.radios == 'rookie pilot admiral*' && await f.evaluate(() => EmberDebug.game.P.hc) == 'off', {ask, y3});
		await btn(f, 'Done'); await sleep(300); await pg.evaluate(() => send({op: 'resume'})); await sleep(300);
		await f.evaluate(() => EmberDebug.lose('a test')); await sleep(1500);
		const after = await f.evaluate(() => ({lost: !!document.getElementById('hcPilots'), gone: !!EmberDebug.game.lostForGood, id: EmberDebug.game.pilotId})); await saveNow(f); sv = await S();
		ok('9. ...and losing that ship now is an ordinary loss: the pilot flies on', !after.lost && !after.gone && after.id == 'p3' && sv['ember-reach-pilot-2'] && sv['ember-reach-galaxy'].slots[1].id == 'p3', after);
		ok('10. no errors', errs.length == 0, errs);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
