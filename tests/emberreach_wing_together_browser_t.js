/* Ember Reach's co-op wing together away from the host, in Chromium (Playwright): THREE pages, three accounts, a host and
   two guests through the relay (0.6.5, docs/plan-ember-reach-pilots.md P6b). Two guests in a system the host isn't in:
   the first there keeps it, the second makes no ships of its own; each sees the other and the keeper's ships; the
   second's shot destroys the keeper's pirate (and pays them); the keeper's hit reaches the second through the host;
   the keeper leaving, the second keeps it; the host arriving takes it over.
     node tests/emberreach_wing_together_browser_t.js [PORT]   (uses PORT and PORT+1) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8672), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'ert-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)).slice(0, 900) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
/* the desktop's side, one account per page: saves kept, and each record's writes counted */
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh"></iframe><script>
window.SAVES={};window.WRITES={};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false,maxSave:6*1048576});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});
 else if(m.op=='save'){WRITES[m.game]=(WRITES[m.game]||0)+1;SAVES[m.game]=m.data;reply({})}else reply({})});
document.getElementById('f').src='www/index.html?'+location.hash.slice(1);</script>`);
const errs = [];
async function open(ctx, q) {
	const pg = await ctx.newPage();
	pg.on('console', m => { if (m.type() == 'error' && !/WebSocket connection to .* failed/.test(m.text())) errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e) + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
	await pg.goto(`http://127.0.0.1:${PORT}/desk.html#${q}`);
	return pg;
}
async function frame(pg, test, tries, arg) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < (tries || 300); i++) { const f = fr(); if (f && await f.evaluate(test, arg).catch(() => false)) return f; await sleep(100) }
	return fr();
}
const Q = `debug&relay=ws://127.0.0.1:${RELAY}/`;
/* a new pilot (Hardcore or not) out in space */
async function pilot(ctx, hc, origin) {
	const pg = await open(ctx, Q);
	let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
	await f.click('#ovBody button[data-i="' + (origin || 0) + '"]');
	f = await frame(pg, () => !!document.getElementById('crStart')); if (hc) await f.check('#crHc'); await f.click('#crStart');
	f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('#port [data-screen="launch"]'));
	await f.click('#port [data-screen="launch"]'); await sleep(200); await f.click('#port [data-act="launch"]');
	f = await frame(pg, () => window.EmberDebug && !EmberDebug.game.docked);
	return {pg, f};
}
const pause = f => f.evaluate(() => send({op: 'pause'})).catch(() => null);
/* the Wing screen: host online, or join with a code */
async function wing(x, how, code) {
	await x.pg.evaluate(() => { const fr = document.getElementById('f'); fr.contentWindow.postMessage({rudolfGame: 1, op: 'pause'}, '*') }); await sleep(300);
	let f = await frame(x.pg, () => !!document.getElementById('ovBtns'));
	await f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Wing').click()); await sleep(250);
	await f.click('#ovBody input[name=wingHow][value=' + how + ']');
	if (code) await f.fill('#wingCodeIn', code);
	await f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Start').click());
	return f;
}
const view = f => f.evaluate(() => { const g = EmberDebug.game, W = g.wing, N = W && W.N;
	return {state: N && N.state, role: N && N.role, id: N && N.id, code: W && W.code, star: g.star.id, day: g.day, me: EmberDebug.s.p.slice(), hull: g.pcs.hull + g.pcs.shield, members: g.npcs.filter(n => n.member != null).map(n => ({seat: n.member, name: n.name, p: n.s.p.slice()})), wnpcs: g.npcs.filter(n => n.wingNpc).map(n => ({id: n.id, dead: n.cs.dead, role: n.role})), end: W && W.end && W.end.why} });
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
/* the Wing screen open (the pause menu's Wing) */
async function wingOpen(x) {
	await x.pg.evaluate(() => { const fr = document.getElementById('f'); fr.contentWindow.postMessage({rudolfGame: 1, op: 'resume'}, '*') }); await sleep(150);   /* (the desktop's pause from before, if any, lifted first) */
	await x.pg.evaluate(() => { const fr = document.getElementById('f'); fr.contentWindow.postMessage({rudolfGame: 1, op: 'pause'}, '*') }); await sleep(300);
	const f = await frame(x.pg, () => !document.getElementById('ov').hidden && [...document.querySelectorAll('#ovBtns button')].some(b => b.textContent == 'Wing'), 50);
	await f.evaluate(() => { const b = [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Wing'); if (!b) throw new Error('no Wing button: ' + document.getElementById('ov').hidden + ' ' + [...document.querySelectorAll('#ovBtns button')].map(b => b.textContent).join('|') + ' / ' + document.getElementById('ovBody').textContent.slice(0, 200)); b.click() }); await sleep(250);
	return f;
}
/* the overlay closed and the game going again (as its own close does) */
async function resume(x) {
	await x.pg.evaluate(() => { const fr = document.getElementById('f'); fr.contentWindow.postMessage({rudolfGame: 1, op: 'resume'}, '*') });
	const f = await frame(x.pg, () => !!document.getElementById('ov')); await f.evaluate(() => { document.getElementById('ov').hidden = true; RG.resume() }); await sleep(200);
}
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	const relay = spawn('node', [path.join(TOP, 'tools/duel-relay/relay.mjs'), '--port', String(RELAY), '--host', '127.0.0.1'], {stdio: 'ignore'});
	await sleep(900);
	const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
	try {
		const ctxs = await Promise.all([0, 1, 2].map(() => br.newContext({viewport: {width: 900, height: 600}})));
		const A = await pilot(ctxs[0], false, 0);
		const sx = await A.f.evaluate(() => { const g = EmberDebug.game, near = EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 8).filter(k => k.kind == 'star' && k.id != g.star.id && !k.rift && !k.heart);
			const s = EmberDebug.s; g.npcs.filter(n => n.role == 'pirate').forEach(n => { n.s.p = [s.p[0] + 60000, s.p[1], s.p[2]] });
			return {x: {id: near[0].id, name: near[0].name}, y: {id: near[1].id}, cur: Object.keys(g.P.wallet)[0]} });
		A.f = await wing(A, 'host'); A.f = await frame(A.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.code);
		const code = await A.f.evaluate(() => EmberDebug.game.wing.code);
		const B = await pilot(ctxs[1], false, 0);
		B.f = await wing(B, 'join', code); B.f = await frame(B.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days);
		const C = await pilot(ctxs[2], false, 0);
		C.f = await wing(C, 'join', code); C.f = await frame(C.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days);
		const go = (x, id) => x.f.evaluate(id => { const g = EmberDebug.game; EmberDebug.go(EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 12).find(k => k.id == id)) }, id);
		/* B goes to X first, then C */
		await go(B, sx.x.id); B.f = await frame(B.pg, x => EmberDebug.game.wing.kept == x, 60, sx.x.id);
		await B.f.evaluate(() => { EmberDebug.pirates(1); const s = EmberDebug.s, n = EmberDebug.game.npcs.find(n => n.role == 'pirate' && !n.remote); n.s.p = [s.p[0] + 5000, s.p[1], s.p[2]]; n.s.v = [0, 0, 0] });
		await sleep(1500);
		await go(C, sx.x.id);
		A.f = await frame(A.pg, x => EmberDebug.game.wing.keepOf.get(x) === 1, 60, sx.x.id);
		C.f = await frame(C.pg, () => EmberDebug.game.wing.keep.get(EmberDebug.game.star.id) === 1 && EmberDebug.game.npcs.some(n => n.member === 1) && EmberDebug.game.npcs.some(n => n.wingNpc && n.role == 'pirate'), 80);
		const c1 = await C.f.evaluate(() => { const g = EmberDebug.game; return {keeps: EmberDebug.keeps(), own: g.npcs.filter(n => !n.remote).length, b: g.npcs.some(n => n.member === 1), pir: g.npcs.filter(n => n.wingNpc && n.role == 'pirate').map(n => n.id)} });
		ok('1. two guests in a system the host isn\'t in: the first there keeps it; the second makes no ships of its own and sees the first and its pirate', !c1.keeps && c1.own == 0 && c1.b && c1.pir.length >= 1, c1);
		B.f = await frame(B.pg, () => EmberDebug.game.npcs.some(n => n.member === 2), 60);
		ok('2. the keeper sees the second guest\'s ship (passed on by the host)', await B.f.evaluate(() => EmberDebug.keeps() && EmberDebug.game.npcs.some(n => n.member === 2)));
		/* C destroys B's pirate */
		const pid = await B.f.evaluate(() => EmberDebug.game.npcs.find(n => n.role == 'pirate' && !n.remote && !n.cs.dead).id), wC = await C.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, sx.cur);
		for (let i = 0; i < 40; i++) {
			if (await B.f.evaluate(id => { const n = EmberDebug.game.npcs.find(n => n.id == id); return !n || n.cs.dead }, pid)) break;
			await C.f.evaluate(id => { EmberDebug.game.wing.ev.push({e: 'hitN', i: id, dmg: 4000, kind: 'pulse'}) }, pid); await sleep(150);
		}
		C.f = await frame(C.pg, ([c, w]) => (EmberDebug.game.P.wallet[c] || 0) > w, 40, [sx.cur, wC]);
		const wC2 = await C.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, sx.cur), bDead = await B.f.evaluate(id => { const n = EmberDebug.game.npcs.find(n => n.id == id); return !n || n.cs.dead }, pid);
		ok('3. the second guest\'s shots destroy the keeper\'s pirate (claims through the host), and the bounty is theirs', bDead && wC2 > wC, {bDead, wC, wC2});
		/* the keeper's hit on C, through the host */
		const h0 = await C.f.evaluate(() => EmberDebug.game.pcs.hull + EmberDebug.game.pcs.shield);
		await B.f.evaluate(() => EmberDebug.wingSendTo(2, {k: 'hit', dmg: 40, kind: 'pulse'})); await sleep(700);
		const h1 = await C.f.evaluate(() => EmberDebug.game.pcs.hull + EmberDebug.game.pcs.shield);
		ok('4. a hit the keeper\'s game decides reaches the second guest through the host', h1 < h0 - 1, {h0, h1});
		/* B leaves for Y: C keeps X */
		await go(B, sx.y.id);
		C.f = await frame(C.pg, x => EmberDebug.game.wing.kept == x, 100, sx.x.id);
		ok('5. the keeper leaving: the one left keeps the system', await C.f.evaluate(x => EmberDebug.keeps() && EmberDebug.game.wing.kept == x, sx.x.id));
		/* the host comes to X */
		await go(A, sx.x.id);
		C.f = await frame(C.pg, () => EmberDebug.game.wing.kept == null && !EmberDebug.keeps(), 80); await sleep(500);
		ok('6. the host arriving takes the system over from the guest keeping it', await C.f.evaluate(() => !EmberDebug.keeps() && EmberDebug.game.npcs.filter(n => !n.remote).length == 0));
		ok('7. no errors on any page', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill(); relay.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
