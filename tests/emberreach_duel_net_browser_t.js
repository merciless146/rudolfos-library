/* Ember Reach's duels over a network (0.5.2) in Chromium (Playwright): TWO pages, each the game as the Rudolf OS
   desktop opens it (?duel), dueling through the duel relay (tools/duel-relay/relay.mjs, run here on loopback).
   Online: one hosts and gets a code, the other joins with it; the match is the host's (hits counted there, a kill,
   the next round, the clock and sudden death), the guest flies its own ship and sees the host's; the result on both,
   and a rematch. Then quick match, a LAN duel (the desktop's duel service stood in for by a relay holding one room, as
   Rudolf OS's does), a version refused, and a dropped connection ending the match cleanly on the other side.
     node tests/emberreach_duel_net_browser_t.js [PORT]   (uses PORT, PORT+1 and PORT+2) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8770), RELAY = PORT + 1, LAN = PORT + 2, TOP = path.join(__dirname, '..');
/* (the game's version, from play.js's BUILD: a duel pairs only games of the same version) */
const VER = /const BUILD = \{[^}]*version: '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', 'apps/rudolf-emberreach/www/play.js'), 'utf8'))[1], VER_RE = VER.replace(/\./g, '\\.');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'ern-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
/* the desktop's side: saves, and the duel service (lanHost / lanFind / lanStop) answered as Rudolf OS would, pointing
   at the test's one-room relay */
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
const H=new URLSearchParams(location.hash.slice(1));window.LAN={hosted:0,stopped:0};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:null});else if(m.op=='save')reply({});
 else if(m.op=='lanHost'){LAN.hosted++;reply({url:'ws://127.0.0.1:'+H.get('lan')+'/',code:H.get('code')})}
 else if(m.op=='lanFind')reply({games:H.get('find')?[{name:'the test computer',url:'ws://127.0.0.1:'+H.get('lan')+'/',code:H.get('code'),ver:H.get('find')}]:[]});
 else if(m.op=='lanStop'){LAN.stopped++;reply({})}});
document.getElementById('f').src='www/index.html?'+H.get('q');</script>`);
const errs = [];
async function open(ctx, q, extra) {
	const pg = await ctx.newPage();
	pg.on('console', m => { if (m.type() == 'error' && !/WebSocket connection to .* failed/.test(m.text())) errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
	await pg.goto(`http://127.0.0.1:${PORT}/desk.html#q=${encodeURIComponent(q)}&lan=${LAN}&code=HANDUE${extra || ''}`);
	return pg;
}
async function frame(pg, test, tries) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < (tries || 300); i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
const Q = `debug&duel&relay=ws://127.0.0.1:${RELAY}/`;
/* on a page's duel screen: a ship, an opponent and how, then Start */
async function choose(f, ship, opp, how, code) {
	await f.click('#ovBody input[value=' + ship + ']');
	await f.click('#ovBody input[name=duelOpp][value=' + opp + ']');
	if (how) await f.click('#ovBody input[name=' + (opp == 'ws' ? 'duelWs' : 'duelLan') + '][value="' + how + '"]');
	if (code) await f.fill('#duelCode', code);
	await f.click('#ovBtns button.primary');
}
const view = f => f.evaluate(() => { const g = EmberDebug.game, D = g.duel, n = g.npcs.find(x => x.remote), s = EmberDebug.s, N = D.net;
	return {state: N && N.state, role: N && N.role, m: D.m && {round: D.m.round, wins: D.m.wins.slice(), phase: D.m.phase, t: D.m.t, dealt: D.m.dealt.slice(), ships: D.m.ships.slice()}, me: s.p.map((v, i) => v - D.c[i]), them: n && n.s.p.map((v, i) => v - D.c[i]), theirCs: n && {sh: n.cs.shield, hu: n.cs.hull, dead: n.cs.dead}, mine: {sh: g.pcs.shield, hu: g.pcs.hull, dead: g.pcs.dead}, ship: EmberDebug.ship.name, rtt: N && N.rtt, hud: g.hudData && g.hudData.duel, ov: !document.getElementById('ov').hidden && document.getElementById('ovT').textContent, shots: g.shots.length} });
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	const relay = spawn('node', [path.join(TOP, 'tools/duel-relay/relay.mjs'), '--port', String(RELAY), '--host', '127.0.0.1'], {stdio: 'ignore'});
	const lan = spawn('node', [path.join(TOP, 'tools/duel-relay/relay.mjs'), '--port', String(LAN), '--host', '127.0.0.1', '--lan', 'HANDUE'], {stdio: 'ignore'});
	await sleep(900);
	const br = await chromium.launch();
	try {
		const ctx = await br.newContext({viewport: {width: 1000, height: 660}});
		/* ---- online, with a code ---- */
		const pa = await open(ctx, Q), pb = await open(ctx, Q);
		let A = await frame(pa, () => !!document.querySelector('#ovBody input[name=duelShip]')), B = await frame(pb, () => !!document.querySelector('#ovBody input[name=duelShip]'));
		const menu = await A.evaluate(() => ({ws: !document.querySelector('input[name=duelOpp][value=ws]').disabled, lan: !document.querySelector('input[name=duelOpp][value=lan]').disabled, subs: [...document.querySelectorAll('input[name=duelWs]')].map(x => x.value)}));
		ok('1. the duel screen offers the AI, LAN (host, or join one found) and Online (quick match, host with a code, join with one)', menu.ws && menu.lan && menu.subs.join() == 'quick,host,join', menu);
		await choose(A, 'shrike', 'ws', 'host');
		A = await frame(pa, () => /Your code/.test(document.getElementById('ovT').textContent));
		const code = await A.evaluate(() => document.querySelector('.duel-code').textContent);
		await pa.screenshot({path: path.join(W, 'net-code.png')});
		ok('2. hosting online gives a six-letter room code to pass on', /^[A-Z2-9]{6}$/.test(code), code);
		await choose(B, 'jackal', 'ws', 'join', code.toLowerCase());
		A = await frame(pa, () => EmberDebug.game.duel.m && EmberDebug.game.npcs.some(n => n.remote) && document.getElementById('ov').hidden);
		B = await frame(pb, () => EmberDebug.game.duel.m && EmberDebug.game.npcs.some(n => n.remote) && document.getElementById('ov').hidden);
		await sleep(1500);
		let a = await view(A), b = await view(B);
		await pa.screenshot({path: path.join(W, 'net-host.png')}); await pb.screenshot({path: path.join(W, 'net-guest.png')});
		ok('3. joined with the code (in small letters too): both games in the same match, the host\'s Shrike against the guest\'s Jackal, 20 km apart', a.role == 'host' && b.role == 'guest' && a.state == 'ready' && b.state == 'ready' && a.m.ships.join() == 'shrike,jackal' && b.m.ships.join() == 'jackal,shrike' && a.m.phase == 'fight' && Math.abs(dist(a.me, a.them) - 20000) < 400 && Math.abs(dist(b.me, b.them) - 20000) < 400, {a, b});
		ok('4. each sees the other where they are: the host\'s ship on the guest\'s screen where the host flies it, and the other way round', dist(a.me, b.them) < 200 && dist(b.me, a.them) < 200, {aMe: a.me, bThem: b.them, bMe: b.me, aThem: a.them});
		ok('5. the clock is the host\'s, on both (counting down from 5:00), and the ping shows', Math.abs(a.m.t - b.m.t) < 1 && /^4:5\d$/.test(a.hud.clock) && /^4:5\d$/.test(b.hud.clock) && b.rtt != null && / ms$/.test(b.hud.dealt), {a: a.hud, b: b.hud, ta: a.m.t, tb: b.m.t});
		/* the guest flies its own ship at once: a move there shows on the host's screen shortly after */
		await B.evaluate(() => { const s = EmberDebug.s, D = EmberDebug.game.duel; s.p = D.c.map((v, i) => v + [3000, 2000, 1000][i]); s.v = [0, 0, 0] });
		await sleep(600);
		a = await view(A); b = await view(B);
		ok('6. the guest\'s own ship moves at once (its own game), and the host sees it there within a moment, smoothed', dist(b.me, [3000, 2000, 1000]) < 30 && dist(a.them, b.me) < 60, {bMe: b.me, aThem: a.them});
		/* the host's guns on the guest, 700 m ahead: the damage counts on the host's match and the guest's shields go down on both */
		const place = async (Fa, Fb, gap) => {
			const at = await Fa.evaluate(g => { const s = EmberDebug.s, D = EmberDebug.game.duel; s.p = D.c.map((v, i) => v + [0, 0, 6000][i]); s.v = [0, 0, 0]; s.w = [0, 0, 0]; const fw = EmberFlight.forward(s); return {p: s.p.map((v, i) => v + fw[i] * g - D.c[i]), q: s.q.slice()} }, gap);
			await Fb.evaluate(at => { const s = EmberDebug.s, D = EmberDebug.game.duel; s.p = at.p.map((v, i) => v + D.c[i]); s.v = [0, 0, 0]; s.w = [0, 0, 0] }, at);
			await sleep(400);
		};
		const fire = async (Fx, ms) => { await Fx.evaluate(() => { EmberDebug.game.tgt = EmberDebug.game.npcs.find(n => n.remote); EmberDebug.game.touch.fire = EmberDebug.game.touch.fire2 = 0 }); await sleep(ms); await Fx.evaluate(() => { EmberDebug.game.touch.fire = EmberDebug.game.touch.fire2 = null }) };
		await place(A, B, 700); await fire(A, 1500); await sleep(400);
		a = await view(A); b = await view(B);
		ok('7. the host\'s hits on the guest: counted in the host\'s match, the guest\'s shields down on both screens (the host decides)', a.m.dealt[0] > 5 && Math.abs(b.m.dealt[1] - a.m.dealt[0]) < 0.5 && b.mine.sh < 0.99 * (await B.evaluate(() => EmberDebug.game.pcs.shieldMax)) && Math.abs(b.mine.sh - a.theirCs.sh) < 25, {a: a.m.dealt, b: b.m.dealt, bMine: b.mine, aTheirs: a.theirCs});
		/* the guest's shots on the host: they fly in the host's game, which counts them */
		await place(B, A, 700); const d0 = a.m.dealt[1]; await fire(B, 1500); await sleep(400);
		a = await view(A); b = await view(B);
		ok('8. the guest\'s shots reach the host\'s game, which counts their hits as the guest\'s damage (both screens agree)', a.m.dealt[1] > d0 + 5 && Math.abs(b.m.dealt[0] - a.m.dealt[1]) < 1 && a.mine.sh < a.theirCs.sh + 1e6, {a: a.m.dealt, b: b.m.dealt});
		/* a kill: the host destroys the guest; round 1 to the host on both; 6 s on, round 2 with both back at their starts */
		await A.evaluate(() => { const n = EmberDebug.game.npcs.find(x => x.remote); n.cs.shield = 0; n.cs.hull = 1 });
		await place(A, B, 700); await fire(A, 1200); await sleep(500);
		a = await view(A); b = await view(B);
		await pb.screenshot({path: path.join(W, 'net-kill-guest.png')});
		ok('9. the host destroys the guest\'s ship: round 1 to the host on both screens (a banner on each), the guest\'s ship gone', a.m.wins.join() == '1,0' && b.m.wins.join() == '0,1' && a.m.phase == 'between' && b.m.phase == 'between' && b.mine.dead && a.theirCs.dead && /ROUND 1 TO YOU/.test(a.hud.banner && a.hud.banner.text) && /ROUND 1 TO THE RIVAL/.test(b.hud.banner && b.hud.banner.text), {a: [a.m, a.hud.banner], b: [b.m, b.hud.banner, b.mine]});
		await sleep(6500);
		a = await view(A); b = await view(B);
		ok('10. round 2 on both: the ships back at their starts, 20 km apart, repaired; the damage count starts again', a.m.round == 2 && b.m.round == 2 && a.m.phase == 'fight' && b.m.phase == 'fight' && !b.mine.dead && !a.theirCs.dead && Math.abs(dist(b.me, b.them) - 20000) < 500 && Math.abs(dist(a.me, a.them) - 20000) < 500 && a.m.dealt[0] == 0, {a, b});
		/* the clock: level at 5:00, sudden death on both; the guest's next hit wins it (and the match is 1–1) */
		await A.evaluate(() => { EmberDebug.game.duel.m.t = 299.3 }); await sleep(1300);
		a = await view(A); b = await view(B);
		ok('11. level when the host\'s clock runs out: sudden death, on both screens', a.m.phase == 'sudden' && b.m.phase == 'sudden' && a.hud.clock == 'SUDDEN DEATH' && b.hud.clock == 'SUDDEN DEATH', {a: a.hud, b: b.hud});
		await place(B, A, 700); await fire(B, 900); await sleep(500);
		a = await view(A); b = await view(B);
		ok('12. the guest\'s first hit in sudden death takes the round: 1–1', a.m.wins.join() == '1,1' && b.m.wins.join() == '1,1', {a: a.m, b: b.m});
		/* round 3: the host's ship destroyed: the match to the guest, the result on both, then a rematch */
		await sleep(6500);
		await B.evaluate(() => { const n = EmberDebug.game.npcs.find(x => x.remote); n.cs.shield = 0; n.cs.hull = 1 });
		await A.evaluate(() => { const g = EmberDebug.game; g.pcs.shield = 0; g.pcs.hull = 1 });
		await place(B, A, 700); await fire(B, 1200);
		A = await frame(pa, () => /wins the duel/.test(document.getElementById('ovT').textContent), 80);
		B = await frame(pb, () => /wins the duel/.test(document.getElementById('ovT').textContent), 80);
		a = await view(A); b = await view(B);
		await pb.screenshot({path: path.join(W, 'net-over.png')});
		ok('13. the guest takes round 3: "You win the duel · 2–1" on the guest\'s screen, the other pilot\'s win on the host\'s, with Rematch', /You win the duel · 2–1/.test(b.ov) && /The other pilot wins the duel · 1–2/.test(a.ov) && (await B.evaluate(() => [...document.querySelectorAll('#ovBtns button')].map(x => x.textContent).join())) == 'Rematch,Choose ship,Leave', {a: a.ov, b: b.ov});
		await A.click('#ovBtns button.primary'); await sleep(400);
		const waitA = await A.evaluate(() => document.getElementById('ovBody').textContent);
		await B.click('#ovBtns button.primary'); await sleep(1500);
		a = await view(A); b = await view(B);
		ok('14. Rematch on both (the host waits for the guest): a new match, round 1, 0–0, on both', /Waiting for the other pilot/.test(waitA) && a.m.round == 1 && b.m.round == 1 && a.m.wins.join() == '0,0' && b.m.wins.join() == '0,0' && !a.ov && !b.ov && a.state == 'ready', {waitA, a: a.m, b: b.m, ov: [a.ov, b.ov]});
		/* a dropped connection: the guest's page closes; the host's match ends cleanly with a message */
		await pb.close();
		A = await frame(pa, () => document.getElementById('ovT').textContent == 'The duel is over', 80);
		a = await view(A);
		const endA = await A.evaluate(() => ({text: document.getElementById('ovBody').textContent, npcs: EmberDebug.game.npcs.length, m: EmberDebug.game.duel.m, btns: [...document.querySelectorAll('#ovBtns button')].map(x => x.textContent)}));
		ok('15. the guest\'s game closes mid-match: the host\'s duel ends cleanly ("The other pilot left the duel"), no ship left, back to duels', /The other pilot left the duel/.test(endA.text) && endA.npcs == 0 && endA.m == null && a.state == null && endA.btns.includes('Back to duels'), endA);
		/* ---- quick match ---- */
		await A.click('#ovBtns button.primary');
		const pc = await open(ctx, Q);
		let Cc = await frame(pc, () => !!document.querySelector('#ovBody input[name=duelShip]'));
		await choose(A, 'pike', 'ws', 'quick');
		A = await frame(pa, () => /Looking for a pilot/.test(document.getElementById('ovBody').textContent), 50);
		const looking = await A.evaluate(() => document.getElementById('ovBody').textContent);
		await choose(Cc, 'lancet', 'ws', 'quick');
		A = await frame(pa, () => EmberDebug.game.duel.m && document.getElementById('ov').hidden, 80);
		Cc = await frame(pc, () => EmberDebug.game.duel.m && document.getElementById('ov').hidden, 80);
		a = await view(A); const c = await view(Cc);
		ok('16. quick match: the first waits in the queue, the next pilot looking (same version) is paired with them', new RegExp('Looking for a pilot running Ember Reach ' + VER_RE).test(looking) && a.state == 'ready' && c.state == 'ready' && a.role != c.role && a.m.phase == 'fight' && c.m.phase == 'fight', {looking, a: [a.role, a.m], c: [c.role, c.m]});
		/* leaving: the other is told, at once */
		await Cc.evaluate(() => EmberDebug.game.duel.net.leave());
		A = await frame(pa, () => document.getElementById('ovT').textContent == 'The duel is over', 50);
		ok('17. Leave on one side ends it on the other at once, with a message', /The other pilot left the duel/.test(await A.evaluate(() => document.getElementById('ovBody').textContent)), await A.evaluate(() => document.getElementById('ovBody').textContent));
		await pc.close();
		/* ---- a LAN duel: hosted through the game kit (the desktop's duel service), found on the network and joined ---- */
		await A.click('#ovBtns button.primary');
		const pd = await open(ctx, Q, '&find=' + VER);
		let Dd = await frame(pd, () => !!document.querySelector('#ovBody input[name=duelShip]'));
		await choose(A, 'shrike', 'lan', 'host');
		A = await frame(pa, () => /Hosting a duel on this network/.test(document.getElementById('ovBody').textContent), 60);
		await Dd.click('#ovBody input[name=duelOpp][value=lan]');
		Dd = await frame(pd, () => !!document.querySelector('#duelLanList input[value="join:0"]'), 60);
		const found = await Dd.evaluate(() => document.getElementById('duelLanList').textContent);
		await Dd.click('#ovBody input[value=jackal]'); await Dd.click('#duelLanList input[value="join:0"]'); await Dd.click('#ovBtns button.primary');
		A = await frame(pa, () => EmberDebug.game.duel.m && document.getElementById('ov').hidden, 80);
		Dd = await frame(pd, () => EmberDebug.game.duel.m && document.getElementById('ov').hidden, 80);
		a = await view(A); const d = await view(Dd);
		ok('18. LAN: hosting asks the desktop for its duel service; the other finds it on the network and joins: the same duel', found.includes('Join the duel on the test computer') && a.role == 'host' && d.role == 'guest' && a.m.ships.join() == 'shrike,jackal' && (await pa.evaluate(() => LAN.hosted)) == 1, {found, a: a.m, d: d.m});
		await pd.close();
		A = await frame(pa, () => document.getElementById('ovT').textContent == 'The duel is over', 80);
		ok('19. the LAN match over (the other gone): the host\'s game asks the desktop to stop the duel service', (await pa.evaluate(() => LAN.stopped)) == 1, await pa.evaluate(() => LAN));
		/* ---- versions: a game of another version is refused, with a message ---- */
		await A.click('#ovBtns button.primary');
		await choose(A, 'shrike', 'ws', 'host');
		A = await frame(pa, () => /Your code/.test(document.getElementById('ovT').textContent));
		const code2 = await A.evaluate(() => document.querySelector('.duel-code').textContent);
		const old = await new Promise(res => { const w = new WebSocket(`ws://127.0.0.1:${RELAY}/`); w.onopen = () => w.send(JSON.stringify({t: 'hello', proto: 1, game: 'ember-reach', ver: '0.5.1', want: 'join', code: code2})); w.onmessage = e => { res(JSON.parse(e.data)); w.close() } });
		const pe = await open(ctx, Q, '&find=0.5.1');
		let Ee = await frame(pe, () => !!document.querySelector('#ovBody input[name=duelShip]'));
		await Ee.click('#ovBody input[name=duelOpp][value=lan]');
		Ee = await frame(pe, () => !!document.querySelector('#duelLanList input'), 60);
		const other = await Ee.evaluate(() => ({text: document.getElementById('duelLanList').textContent, disabled: document.querySelector('#duelLanList input').disabled}));
		ok('20. another version is refused: the relay won\'t pair a 0.5.1 game with this 0.5.2 one (it says which), and a LAN duel of another version can\'t be joined (and says why)', old.t == 'error' && old.why == 'version' && old.ver == VER && other.disabled && /0\.5\.1: both need the same version/.test(other.text), {old, other});
		ok('21. no errors on any page', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	finally { await br.close(); srv.kill(); relay.kill(); lan.kill() }
	console.log('screenshots: ' + W); console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
