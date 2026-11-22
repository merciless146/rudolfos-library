/* Ember Reach's duels over a network (0.5.2) in Chromium (Playwright): TWO pages, each the game as the Rudolf OS
   desktop opens it (?duel in a sandboxed frame), dueling through the Library's relay (tools/duel-relay/relay.js) run
   here on loopback: Online with a room code, a match (both ships seen moving, hits both ways decided by the host, a
   kill, the next round, the clock and sudden death, the result on both and a rematch), quick match, the other pilot
   leaving mid-match, a relay refusing another version, and LAN through the game kit (the desktop's lanHost and
   lanFind, answered here as Rudolf OS would, pointing at the same relay).
     node tests/emberreach_duelnet_browser_t.js [PORT]   (PORT for the pages, PORT+1 for the relay) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8753), RPORT = PORT + 1, TOP = path.join(__dirname, '..');
const RELAY = 'ws://127.0.0.1:' + RPORT + '/';
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'ern-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
/* the desktop, as the tests of the other games have it, and its LAN calls (Rudolf OS 1.6.1's LAN duel service) */
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES={};window.LAN={games:[],hosted:0,stopped:0,found:0};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}
 else if(m.op=='lanHost'){LAN.hosted++;LAN.v=m.v;reply({url:'${RELAY}',code:'',name:'Test PC'})}else if(m.op=='lanFind'){LAN.found++;reply({games:LAN.games})}else if(m.op=='lanStop'){LAN.stopped++;reply({})}});
document.getElementById('f').src='www/index.html?'+(location.hash.slice(1)||'debug');</script>`);
const errs = [];
async function frame(pg, test) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 300; i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
async function until(f, test, ms, arg) { for (let t = 0; t < (ms || 8000); t += 100) { if (await f.evaluate(test, arg).catch(() => false)) return true; await sleep(100) } return false }
(async () => {
	const relay = require(path.join(TOP, 'tools/duel-relay/relay.js')).serve();
	await new Promise(r => relay.listen(RPORT, '127.0.0.1', r));
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	const open = async (name, hash) => {
		const ctx = await br.newContext({viewport: {width: 1000, height: 680}}), pg = await ctx.newPage();
		pg.on('console', m => { if (m.type() == 'error') errs.push(name + ': ' + m.text()) }); pg.on('pageerror', e => errs.push(name + ': ' + e));
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#${hash || 'debug&duel&relay=' + encodeURIComponent(RELAY)}`);
		const f = await frame(pg, () => !!document.querySelector('#ovBody input[name=duelShip]'));
		return {ctx, pg, f};
	};
	/* the state each page sees */
	const look = f => f.evaluate(() => { const g = EmberDebug.game, D = g.duel, N = D.net, m = D.m, s = EmberDebug.s, n = g.npcs.find(x => x.remote), rel = p => p.map((v, i) => Math.round(v - D.c[i]));
		return {role: N && N.role, state: N && N.S.state, ov: !document.getElementById('ov').hidden && document.getElementById('ovT').textContent, m: m && {phase: m.phase, round: m.round, wins: m.wins.slice(), dealt: m.dealt.map(Math.round), t: Math.round(m.t), ships: m.ships && m.ships.slice()},
			me: rel(s.p), them: n ? rel(n.s.p) : null, themShip: n && n.ship.name, hp: [g.pcs.hull, g.pcs.shield].map(Math.round), themHp: n ? [n.cs.hull, n.cs.shield].map(Math.round) : null, shots: g.shots.length, net: g.hudData && g.hudData.duel && g.hudData.duel.net, banner: g.hudData && g.hudData.duel && g.hudData.duel.banner && g.hudData.duel.banner.text} });
	const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
	try {
		const A = await open('A'), B = await open('B');
		/* 1. Online: A hosts and gets a room code */
		await A.f.click('#ovBody input[value=jackal]'); await A.f.click('#ovBody input[name=duelOpp][value=online]');
		const panel = await A.f.evaluate(() => ({quick: !!document.getElementById('duelQuick'), host: !!document.getElementById('duelHost'), join: !!document.getElementById('duelJoin'), start: document.querySelector('#ovBtns button.primary').disabled}));
		await A.f.click('#duelHost');
		await until(A.f, () => !!document.getElementById('duelRoom'));
		const code = await A.f.evaluate(() => document.getElementById('duelRoom').textContent);
		await A.pg.screenshot({path: path.join(W, 'net-host.png')});
		ok('1. Online with a relay address: quick match, host or join; hosting gives a six-letter room code', panel.quick && panel.host && panel.join && panel.start && /^[A-Z2-9]{6}$/.test(code), {panel, code});
		/* 2. B joins with the code: both start, the host as pilot 0 */
		await B.f.click('#ovBody input[value=shrike]'); await B.f.click('#ovBody input[name=duelOpp][value=online]');
		await B.f.fill('#duelCode', code.toLowerCase()); await B.f.click('#duelJoin');
		const both = await until(A.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.phase == 'fight', 10000) && await until(B.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.phase == 'fight', 5000);
		await sleep(600);
		let a = await look(A.f), b = await look(B.f);
		const names = await A.f.evaluate(() => ({jackal: EmberDuel.build('jackal').ship.name, shrike: EmberDuel.build('shrike').ship.name}));
		await A.pg.screenshot({path: path.join(W, 'net-start-host.png')}); await B.pg.screenshot({path: path.join(W, 'net-start-guest.png')});
		ok('2. joined with the code: the match starts on both; A hosts (its Jackal against B\'s Shrike), B is the guest (its Shrike against the Jackal); no menu open', both && a.role == 'host' && b.role == 'guest' && a.m.ships[0] == 'jackal' && a.m.ships[1] == 'shrike' && b.m.ships[0] == 'shrike' && b.m.ships[1] == 'jackal' && !a.ov && !b.ov && b.themShip == names.jackal && a.themShip == names.shrike, {a, b, names});
		ok('3. each ship where the other sees it: the host at the arena\'s first start, the guest at the second, 20 km apart', Math.abs(dist(a.me, a.them) - 20000) < 300 && dist(a.me, b.them) < 60 && dist(b.me, a.them) < 60 && a.me[0] < 0 && b.me[0] > 0, {a: [a.me, a.them], b: [b.me, b.them]});
		ok('4. the HUD says it is online, who hosts, and the round trip', /^Online · hosting · \d+ ms$/.test(a.net) && /^Online · joined · \d+ ms$/.test(b.net), [a.net, b.net]);
		/* 5. the guest flies its own ship at once, and the host sees it move (smoothed) */
		await B.f.evaluate(() => { const s = EmberDebug.s; s.v = [0, 0, 120] });
		await sleep(1500);
		a = await look(A.f); b = await look(B.f);
		const moved = await B.f.evaluate(() => { const s = EmberDebug.s; s.v = [0, 0, 0]; return true });
		ok('5. the guest\'s ship flies at once (120 m/s, flight assist slowing it); the host sees it moving the same way, within a few metres', moved && b.me[2] > 30 && dist(a.them, b.me) < 40, {guest: b.me, host: a.them});
		/* put the two 700 m apart, the guest ahead of the host's nose, still */
		const place = async () => {
			const at = await A.f.evaluate(() => { const g = EmberDebug.game, D = g.duel, s = EmberDebug.s; s.p = D.c.map((v, i) => v + [-1000, 0, 6000][i]); s.v = [0, 0, 0]; s.w = [0, 0, 0]; const fw = EmberFlight.forward(s); return {p: s.p.map((v, i) => v - D.c[i] + fw[i] * 700), q: s.q} });
			await B.f.evaluate(at => { const g = EmberDebug.game, D = g.duel, s = EmberDebug.s; s.p = D.c.map((v, i) => v + at.p[i]); s.v = [0, 0, 0]; s.w = [0, 0, 0] }, at);
			await sleep(700);
		};
		const fire = async (x, ms) => { await x.f.evaluate(() => { const g = EmberDebug.game; g.tgt = g.npcs.find(n => n.remote); g.touch.fire = 0 }); await sleep(ms); await x.f.evaluate(() => { EmberDebug.game.touch.fire = null }) };
		await place();
		a = await look(A.f);
		await fire(A, 1500); await sleep(500);
		const a1 = await look(A.f), b1 = await look(B.f);
		ok('6. the host\'s guns on the guest: the host counts the damage, and the guest\'s own shields fall by what the host says', a1.m.dealt[0] > 5 && b1.m.dealt[1] == a1.m.dealt[0] && b1.hp[0] + b1.hp[1] < b.hp[0] + b.hp[1] && Math.abs(b1.hp[1] - a1.themHp[1]) < 2, {a: a1, b: b1, before: b.hp});
		/* the guest turns to face the host and fires */
		await B.f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, n = g.npcs.find(x => x.remote); s.q = EmberScene.lookRotation(EmberScene.v.norm(EmberScene.v.sub(n.s.p, s.p)), [0, 0, 1]) });
		await sleep(300);
		await fire(B, 1500); await sleep(500);
		const a2 = await look(A.f), b2 = await look(B.f);
		ok('7. the guest\'s guns on the host: its shots reach the host\'s game, which counts them', a2.m.dealt[1] > 5 && a2.hp[0] + a2.hp[1] < a1.hp[0] + a1.hp[1] && Math.abs(b2.m.dealt[0] - a2.m.dealt[1]) < 2, {a: a2.m, ahp: [a1.hp, a2.hp], b: b2.m});
		/* 8. a kill: the host destroys the guest */
		await A.f.evaluate(() => { const n = EmberDebug.game.npcs.find(x => x.remote); n.cs.shield = 0; n.cs.hull = 1 });
		await fire(A, 1200); await sleep(600);
		const a3 = await look(A.f), b3 = await look(B.f);
		await B.pg.screenshot({path: path.join(W, 'net-kill-guest.png')});
		ok('8. the host destroys the guest: round 1 to the host on both screens (1–0 and 0–1), by a kill', a3.m.wins.join() == '1,0' && b3.m.wins.join() == '0,1' && a3.m.phase == 'between' && b3.m.phase == 'between' && /ROUND 1 TO YOU/.test(a3.banner) && /ROUND 1 TO THE RIVAL/.test(b3.banner), {a: a3, b: b3});
		/* 9. the next round, 6 s on, on both: back at the starts */
		await sleep(6200);
		const a4 = await look(A.f), b4 = await look(B.f);
		ok('9. round 2 on both, the ships back at their starts and repaired', a4.m.round == 2 && b4.m.round == 2 && a4.m.phase == 'fight' && b4.m.phase == 'fight' && Math.abs(dist(a4.me, a4.them) - 20000) < 400 && dist(b4.me, a4.them) < 100 && b4.hp[0] > 0 && b4.themHp[0] == a4.hp[0], {a: a4, b: b4});
		/* 10. the clock: level at 5:00, sudden death on both; the guest's next hit takes the round */
		await A.f.evaluate(() => { EmberDebug.game.duel.m.t = 299.4 }); await sleep(1200);
		const a5 = await look(A.f), b5 = await look(B.f);
		ok('10. the host\'s clock: level at 5:00, sudden death on both', a5.m.phase == 'sudden' && b5.m.phase == 'sudden' && b5.banner == 'SUDDEN DEATH', {a: a5.m, b: b5.m});
		await place();
		await B.f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, n = g.npcs.find(x => x.remote); s.q = EmberScene.lookRotation(EmberScene.v.norm(EmberScene.v.sub(n.s.p, s.p)), [0, 0, 1]) });
		await sleep(300); await fire(B, 900); await sleep(600);
		const a6 = await look(A.f), b6 = await look(B.f);
		ok('11. the guest\'s hit in sudden death wins it the round (1–1 on both)', a6.m.wins.join() == '1,1' && b6.m.wins.join() == '1,1' && /ROUND 2 TO THE RIVAL/.test(a6.banner) && /ROUND 2 TO YOU/.test(b6.banner), {a: a6, b: b6});
		/* 12. round 3: the host wins the match; both see the result */
		await sleep(6200);
		await A.f.evaluate(() => { const n = EmberDebug.game.npcs.find(x => x.remote); n.cs.shield = 0; n.cs.hull = 1 });
		await place(); await fire(A, 1200);
		await until(A.f, () => /win/.test(document.getElementById('ovT').textContent) && !document.getElementById('ov').hidden, 6000);
		await until(B.f, () => /win/.test(document.getElementById('ovT').textContent) && !document.getElementById('ov').hidden, 3000);
		const a7 = await look(A.f), b7 = await look(B.f);
		await A.pg.screenshot({path: path.join(W, 'net-over-host.png')}); await B.pg.screenshot({path: path.join(W, 'net-over-guest.png')});
		const btns = await B.f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].map(x => x.textContent));
		ok('12. two rounds to one: the host wins the duel, the guest sees the rival win; Rematch, Choose ship and Leave the match', a7.m.phase == 'over' && /You win the duel · 2–1/.test(a7.ov) && /The rival wins the duel · 1–2/.test(b7.ov) && ['Rematch', 'Choose ship', 'Leave the match'].every(x => btns.includes(x)), {a: a7.ov, b: b7.ov, btns});
		/* 13. a rematch: both ask, and it starts */
		await B.f.click('#ovBtns button.primary'); await sleep(400);
		const wait = await B.f.evaluate(() => document.getElementById('duelNetSt') && document.getElementById('duelNetSt').textContent);
		await A.f.click('#ovBtns button.primary');
		const re = await until(A.f, () => EmberDebug.game.duel.m.round == 1 && EmberDebug.game.duel.m.phase == 'fight' && document.getElementById('ov').hidden, 5000) && await until(B.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.round == 1 && EmberDebug.game.duel.m.wins.join() == '0,0' && document.getElementById('ov').hidden, 5000);
		ok('13. Rematch: the first to ask waits for the other; then a new match on both, 0–0', re && /Waiting for the other pilot/.test(wait), wait);
		/* 14. the guest leaves mid-match (the pause menu's Leave the match): the host's match ends cleanly */
		const leave = async x => { await x.f.evaluate(() => EmberDuelDebug.overlay('pause')); await x.f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Leave the match').click()) };
		await leave(B);
		await until(A.f, () => !document.getElementById('ov').hidden && /cut short/.test(document.getElementById('ovT').textContent), 6000);
		const gone = await A.f.evaluate(() => ({h: document.getElementById('ovT').textContent, t: document.getElementById('duelGone').textContent, net: EmberDebug.game.duel.net, m: EmberDebug.game.duel.m, npcs: EmberDebug.game.npcs.length}));
		ok('14. the other pilot leaving mid-match ends it cleanly: "the duel was cut short", no rival left, back to choosing', /cut short/.test(gone.h) && /left the duel/.test(gone.t) && gone.net == null && gone.m == null && gone.npcs == 0, gone);
		/* 15. quick match: the two paired by the relay, then the guest's page closed outright */
		await A.f.click('#ovBtns button.primary'); await sleep(300); await A.f.click('#ovBody input[name=duelOpp][value=online]'); await A.f.click('#duelQuick');
		await B.f.evaluate(() => { const g = EmberDebug.game; g.duel.m = null }); await B.f.evaluate(() => { window.EmberDuelNet = null });
		await B.pg.close(); await B.ctx.close();
		const C2 = await open('C');
		await C2.f.click('#ovBody input[name=duelOpp][value=online]'); await C2.f.click('#duelQuick');
		const qm = await until(A.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.phase == 'fight', 10000) && await until(C2.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.phase == 'fight', 5000);
		const roles = [await A.f.evaluate(() => EmberDebug.game.duel.net.role), await C2.f.evaluate(() => EmberDebug.game.duel.net.role)];
		ok('15. Quick match: two pilots waiting are paired, one hosts', qm && roles.sort().join() == 'guest,host', roles);
		await C2.pg.close(); await C2.ctx.close();
		await until(A.f, () => !document.getElementById('ov').hidden && /cut short/.test(document.getElementById('ovT').textContent), 7000);
		const drop = await A.f.evaluate(() => ({h: document.getElementById('ovT').textContent, t: document.getElementById('duelGone').textContent}));
		ok('16. the other\'s page closed mid-match: the relay says so, and the match ends cleanly', /cut short/.test(drop.h) && /left|dropped|lost/.test(drop.t), drop);
		/* 17. another version: refused, with a message */
		const N = require(path.join(TOP, 'apps/rudolf-emberreach/www/net.js'));
		const old = await new Promise(res => { const S = N.connect(N.ws(RELAY), {v: '0.4.9', mode: 'host'}, {room: c => res({S, c})}) });
		await A.f.click('#ovBtns button.primary'); await sleep(300); await A.f.click('#ovBody input[name=duelOpp][value=online]');
		await A.f.fill('#duelCode', old.c); await A.f.click('#duelJoin');
		await until(A.f, () => !document.getElementById('ov').hidden && !!document.getElementById('duelGone'), 6000);
		const ver = await A.f.evaluate(() => ({h: document.getElementById('ovT').textContent, t: document.getElementById('duelGone').textContent}));
		old.S.close();
		ok('17. a game of another version is refused with a message saying both need the same one', /0\.4\.9/.test(ver.t) && /same version/.test(ver.t) && /Couldn/.test(ver.h), ver);
		/* 18. LAN through the game kit: host on this network, found and joined from another page */
		await A.f.click('#ovBtns button.primary'); await sleep(300); await A.f.click('#ovBody input[name=duelOpp][value=lan]');
		const lanUi = await A.f.evaluate(() => ({host: !!document.getElementById('duelLanHost'), find: !!document.getElementById('duelLanFind'), addr: !!document.getElementById('duelAddr')}));
		await A.f.click('#duelLanHost');
		await until(A.f, () => !!document.getElementById('duelRoom'));
		const lanCode = await A.f.evaluate(() => document.getElementById('duelRoom').textContent), hosted = await A.pg.evaluate(() => window.LAN);
		const D2 = await open('D', 'debug&duel');
		await D2.pg.evaluate(g => { window.LAN.games = [g, {name: 'Old PC', url: g.url, code: 'ZZZZZZ', v: '0.4.0'}] }, {name: 'Test PC', url: RELAY, code: lanCode, v: hosted.v});
		await D2.f.click('#ovBody input[name=duelOpp][value=lan]'); await D2.f.click('#duelLanFind');
		await until(D2.f, () => document.querySelectorAll('#duelFound button[data-i]').length == 2);
		const found = await D2.f.evaluate(() => [...document.querySelectorAll('#duelFound li')].map(l => ({t: l.textContent, off: l.querySelector('button').disabled})));
		await D2.f.click('#duelFound button[data-i="0"]');
		const lan = await until(A.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.phase == 'fight', 8000) && await until(D2.f, () => EmberDebug.game.duel.m && EmberDebug.game.duel.m.phase == 'fight', 5000);
		await sleep(500);
		const la = await look(A.f), ld = await look(D2.f);
		await D2.pg.screenshot({path: path.join(W, 'net-lan-guest.png')});
		ok('18. LAN on Rudolf OS: Host on this network asks the desktop for the relay (this version), Find games lists the network\'s games (another version can\'t be joined), and joining starts the match', lanUi.host && lanUi.find && lanUi.addr && hosted.hosted == 1 && hosted.v == '0.5.2' && found.length == 2 && !found[0].off && found[1].off && lan && /^LAN · hosting/.test(la.net) && /^LAN · joined/.test(ld.net), {lanUi, hosted, found, la: la.net, ld: ld.net});
		/* 19. the host leaves: the service is stopped, and the guest is told */
		await leave(A);
		await until(D2.f, () => !document.getElementById('ov').hidden && !!document.getElementById('duelGone'), 6000);
		const stopped = await A.pg.evaluate(() => window.LAN.stopped), told = await D2.f.evaluate(() => document.getElementById('duelGone').textContent);
		ok('19. the host leaving stops the LAN service (lanStop) and ends the guest\'s match cleanly', stopped >= 1 && /left the duel/.test(told), {stopped, told});
		await sleep(300);
		ok('20. the relay forgets them: no players, rooms or queue left', (s => s.rooms == 0 && s.queued == 0)(relay.relay.stats()), relay.relay.stats());
		ok('21. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	finally { await br.close(); srv.kill(); relay.close() }
	console.log('screenshots: ' + W); console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
