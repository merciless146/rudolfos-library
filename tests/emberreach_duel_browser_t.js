/* Ember Reach's duels (0.5.0) in Chromium (Playwright), as the Rudolf OS desktop opens the game (?duel): picking a
   ship, a match against the AI (hits counted, rams and rocks by speed, a kill, the next round, sudden death, the
   result and a rematch), and nothing of a game saved.
     node tests/emberreach_duel_browser_t.js [PORT] */
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
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&duel`);
		let f = await frame(pg, () => !!document.querySelector('#ovBody input[name=duelShip]'));
		const pick = await f.evaluate(() => ({h: document.getElementById('ovT').textContent, ships: document.querySelectorAll('#ovBody input[name=duelShip]').length, ai: document.querySelector('input[value=ai]').checked, net: ['lan', 'online'].every(v => document.querySelector('input[name=duelOpp][value=' + v + ']')), off: /not set up yet/.test(document.querySelector('input[name=duelOpp][value=online]').parentNode.textContent)}));
		await pg.screenshot({path: path.join(W, 'duel-pick.png')});
		ok('1. ?duel opens the duel screen: four ships to pick from; the AI to fly against, or LAN, or Online (not set up yet: no relay address)', pick.h == 'Duel' && pick.ships == 4 && pick.ai && pick.net && pick.off, pick);
		await f.click('#ovBody input[value=jackal]'); await f.click('#ovBtns button.primary'); await sleep(1500);
		const st = await f.evaluate(() => { const g = EmberDebug.game, D = g.duel, s = EmberDebug.s, n = g.npcs[0], d = Math.hypot(...n.s.p.map((v, i) => v - s.p[i])); return {phase: D.m.phase, ship: EmberDebug.ship.name, me: D.m.ships[0], npcs: g.npcs.length, hostile: n.duel, d: Math.round(d), rocks: g.rocks.length, t: D.m.t, scan: g.hudData.scanner && g.hudData.scanner.range, blip: g.hudData.scanner && g.hudData.scanner.blips.some(b => b.col == '#e5484d'), clock: g.hudData.duel && g.hudData.duel.clock, open: !document.getElementById('ov').hidden} });
		await pg.screenshot({path: path.join(W, 'duel-start.png')});
		ok('2. Start: your Jackal and a rival 20 km off in an asteroid field, red on the radar; the clock at the top running down from 5:00', st.phase == 'fight' && st.me == 'jackal' && st.npcs == 1 && st.hostile && Math.abs(st.d - 20000) < 300 && st.rocks > 100 && st.scan >= 20000 && st.blip && /^4:5\d$/.test(st.clock) && !st.open, st);
		/* your guns on the rival, 700 m ahead: the damage you do counts */
		const fire = async (ms) => { await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, n = g.npcs[0]; s.p = g.duel.c.map((v, i) => v + [0, 0, 6000][i]); s.v = [0, 0, 0]; s.w = [0, 0, 0]; const fw = EmberFlight.forward(s); n.s.p = s.p.map((v, i) => v + fw[i] * 700); n.s.v = s.v.slice(); n.pos = n.s.p; g.tgt = n; g.touch.fire = 0 }); await sleep(ms); await f.evaluate(() => { EmberDebug.game.touch.fire = null }) };
		await fire(1500);
		const hit = await f.evaluate(() => ({dealt: EmberDebug.game.duel.m.dealt.slice(), sh: EmberDebug.game.npcs[0].cs.shield, max: EmberDebug.game.npcs[0].cs.shieldMax}));
		ok('3. your hits on the rival are counted as damage done', hit.dealt[0] > 5 && hit.sh < hit.max, hit);
		/* a ram: both take it */
		const ram = await f.evaluate(async () => { const g = EmberDebug.game, s = EmberDebug.s, n = g.npcs[0], fw = EmberFlight.forward(s), a0 = g.pcs.shield + g.pcs.hull, b0 = n.cs.shield + n.cs.hull;
			n.s.p = s.p.map((v, i) => v + fw[i] * (s.radius + n.s.radius + 1)); n.s.v = [0, 0, 0]; s.v = fw.map(v => v * 60); n.pos = n.s.p; await new Promise(r => setTimeout(r, 300));
			return {me: a0 - (g.pcs.shield + g.pcs.hull), them: b0 - (n.cs.shield + n.cs.hull), mMe: s.mass, mThem: n.s.mass, said: g.msgs.some(m => /^Collision with Rival/.test(m.text))} });
		ok('4. ramming the rival at 60 m/s hurts you both (speed-based: about 66 between you), the lighter ship more, and says so', ram.me > 2 && ram.them > 2 && ram.me + ram.them > 45 && ram.me + ram.them < 90 && (ram.mMe <= ram.mThem ? ram.me >= ram.them : ram.them >= ram.me) && ram.said, ram);
		/* a rock at 40 m/s */
		const rock = await f.evaluate(async () => { const g = EmberDebug.game, s = EmberDebug.s, r = g.rocks.slice().sort((a, b) => Math.hypot(...a.pos.map((v, i) => v - s.p[i])) - Math.hypot(...b.pos.map((v, i) => v - s.p[i])))[0], dir = [1, 0, 0];
			g.npcs[0].s.p = g.npcs[0].s.p.map((v, i) => v + [0, 0, 5000][i]); const a0 = g.pcs.shield + g.pcs.hull;
			s.p = r.pos.map((v, i) => v - dir[i] * (r.radius * 0.9 + s.radius + 2)); s.v = dir.map(v => v * 40); await new Promise(res => setTimeout(res, 300));
			return {lost: a0 - (g.pcs.shield + g.pcs.hull), said: g.msgs.some(m => /^Collision with an asteroid at \d+ m\/s/.test(m.text))} });
		ok('5. hitting an asteroid at 40 m/s hurts in proportion (about 21: 0.6 a m/s over 5)', rock.lost > 15 && rock.lost < 40 && rock.said, rock);
		/* destroy it: the round is yours, and the next starts 6 s on with both ships back at their starts */
		await f.evaluate(() => { const n = EmberDebug.game.npcs[0]; n.cs.shield = 0; n.cs.hull = 1 }); await fire(1200);
		const r1 = await f.evaluate(() => { const m = EmberDebug.game.duel.m; return {wins: m.wins.slice(), phase: m.phase, how: m.last && m.last.how, banner: EmberDebug.game.hudData.duel.banner && EmberDebug.game.hudData.duel.banner.text} });
		await pg.screenshot({path: path.join(W, 'duel-round.png')});
		ok('6. destroying the rival wins the round (1–0); a banner says so', r1.wins[0] == 1 && r1.wins[1] == 0 && r1.phase == 'between' && r1.how == 'kill' && /ROUND 1 TO YOU/.test(r1.banner), r1);
		await sleep(6500);
		const r2 = await f.evaluate(() => { const g = EmberDebug.game, m = g.duel.m, s = EmberDebug.s, n = g.npcs[0]; return {round: m.round, phase: m.phase, dealt: m.dealt, d: Math.round(Math.hypot(...n.s.p.map((v, i) => v - s.p[i]))), hull: g.pcs.hull == g.pcs.hullMax && n.cs.hull == n.cs.hullMax} });
		ok('7. round 2: both ships back at their starts 20 km apart, repaired; the damage count starts again', r2.round == 2 && r2.phase == 'fight' && r2.dealt[0] == 0 && r2.dealt[1] == 0 && Math.abs(r2.d - 20000) < 300 && r2.hull, r2);
		/* level at 5:00: sudden death; the next hit takes it, and the match (2–0) */
		await f.evaluate(() => { const m = EmberDebug.game.duel.m; m.t = 299.4 }); await sleep(1000);
		const sd = await f.evaluate(() => ({phase: EmberDebug.game.duel.m.phase, clock: EmberDebug.game.hudData.duel.clock}));
		await pg.screenshot({path: path.join(W, 'duel-sudden.png')});
		ok('8. level when the clock runs out: sudden death', sd.phase == 'sudden' && sd.clock == 'SUDDEN DEATH', sd);
		await fire(800);
		await sleep(4200);
		const over = await f.evaluate(() => ({wins: EmberDebug.game.duel.m.wins, phase: EmberDebug.game.duel.m.phase, h: document.getElementById('ovT').textContent, btns: [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent)}));
		await pg.screenshot({path: path.join(W, 'duel-over.png')});
		ok('9. the first hit in sudden death wins the round; two rounds win the match, with Rematch, Choose ship and Leave', over.phase == 'over' && over.wins[0] == 2 && /You win the duel · 2–0/.test(over.h) && ['Rematch', 'Choose ship', 'Leave duels'].every(b => over.btns.includes(b)), over);
		await f.click('#ovBtns button.primary'); await sleep(800);
		const re = await f.evaluate(() => ({round: EmberDebug.game.duel.m.round, wins: EmberDebug.game.duel.m.wins, open: !document.getElementById('ov').hidden}));
		ok('10. Rematch starts a new match against the same ship', re.round == 1 && re.wins[0] == 0 && re.wins[1] == 0 && !re.open, re);
		const saved = await pg.evaluate(() => { const S = window.SAVES || {}; const v = S['ember-reach']; return v == null ? 'none' : typeof v == 'string' ? (/"ship"/.test(v) ? 'game' : 'settings') : v.ship ? 'game' : 'settings' });
		ok('11. a duel saves nothing of a game (the settings at most)', saved != 'game', saved);
		ok('12. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	finally { await br.close(); srv.kill() }
	console.log('screenshots: ' + W); console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
