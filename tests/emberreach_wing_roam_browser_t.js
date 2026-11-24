/* Ember Reach's co-op wing roaming apart, in Chromium (Playwright): TWO pages, two accounts, a host and a guest through
   the relay (0.6.4, docs/plan-ember-reach-pilots.md P6a). A guest gone to another system keeps it (its own ships,
   which it wouldn't with the host there), with the host's galaxy's records there asked for and its trades recorded in
   the host's market; each sees where the other is; the host's jumps don't take over a roaming guest's route; a
   shared mission done away is counted by the guest's game and so on the host's; the host arriving takes the system
   over, and leaving it, gives it back.
     node tests/emberreach_wing_roam_browser_t.js [PORT]   (uses PORT and PORT+1) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8668), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'err-'));
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
		const ctxs = await Promise.all([0, 1].map(() => br.newContext({viewport: {width: 1100, height: 700}})));
		const A = await pilot(ctxs[0], false, 0);
		/* two stars near the host's: X, where the guest goes; Y, where the host goes after */
		const sx = await A.f.evaluate(() => { const g = EmberDebug.game, near = EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 8).filter(k => k.kind == 'star' && k.id != g.star.id && !k.rift && !k.heart);
			const x = near[0], y = near[1], crew = EmberFactions.minors().find(m => m.type == 'criminal').id, cur = Object.keys(g.P.wallet)[0];
			EmberEconomy.record(g.P, {key: x.id + ':orbital'}, 'Iron', 30, false, g.day);   /* (a record of the host's galaxy at X) */
			g.P.missions = [{id: 't:xstrike', type: 'strike', issuer: g.P.origin, against: crew, war: EmberFactions.wars()[0].id, system: 'sys', systemName: x.name, effort: 4, currency: cur, text: 'Strike the crew at ' + x.name, reward: 5000, star: {id: x.id, name: x.name, at: [x.x, x.y, x.z]}, accepted: Math.floor(g.day), due: Math.floor(g.day) + 10, port: null, kills: 2, stay: 0, depot: false, done: false}];
			const s = EmberDebug.s; g.npcs.filter(n => n.role == 'pirate').forEach(n => { n.s.p = [s.p[0] + 60000, s.p[1], s.p[2]] });
			return {x: {id: x.id, name: x.name}, y: {id: y.id, name: y.name}, home: {id: g.star.id, name: g.star.name}, crew, cur} });
		A.f = await wing(A, 'host'); A.f = await frame(A.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.code);
		const code = await A.f.evaluate(() => EmberDebug.game.wing.code);
		await A.f.evaluate(() => { const g = EmberDebug.game; g.wing.shared.push(g.P.missions[0]) });
		const B = await pilot(ctxs[1], false, 0);
		B.f = await wing(B, 'join', code); B.f = await frame(B.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days && EmberDebug.game.wing.offers.length == 1);
		await B.f.evaluate(() => { const g = EmberDebug.game, u = g.wing.offers[0], r = EmberWing.takeShared(g.P, u, 3); g.wing.taken.set(u.m.id, r.mission) });   /* (the Wing screen's Take, as the missions test does it) */
		const before = await B.f.evaluate(() => { EmberDebug.pirates(1); return EmberDebug.game.npcs.filter(n => !n.remote).length });
		/* the guest goes to X */
		await B.f.evaluate(x => { const g = EmberDebug.game; EmberDebug.go(EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 8).find(k => k.id == x)) }, sx.x.id);
		B.f = await frame(B.pg, x => EmberDebug.game.star.id == x && EmberDebug.game.wing.kept == x, 60, sx.x.id);
		const away = await B.f.evaluate(() => { EmberDebug.pirates(1); const g = EmberDebug.game; return {kept: g.wing.kept, own: g.npcs.filter(n => !n.remote && n.role == 'pirate').map(n => n.id), star: g.star.id} });
		ok('1. in the host\'s system a guest\'s game makes no ships of its own; gone to another, it keeps that system (its own pirates)', before == 0 && away.kept == sx.x.id && away.own.length >= 1, {before, away});
		B.f = await frame(B.pg, k => !!(EmberDebug.game.P.markets || {})[k], 60, sx.x.id + ':orbital');
		const rec = await B.f.evaluate(k => EmberDebug.game.P.markets[k], sx.x.id + ':orbital');
		ok('2. away, the guest\'s game has the host\'s galaxy\'s records for that system (asked for on arriving)', rec && rec.s.Iron < -29, rec);
		await B.f.evaluate(k => EmberEconomy.record(EmberDebug.game.P, {key: k}, 'Food', 7, true, EmberDebug.game.day), sx.x.id + ':orbital');
		A.f = await frame(A.pg, k => { const r = EmberDebug.game.P.markets[k]; return r && r.d && r.d.Food }, 40, sx.x.id + ':orbital');
		const hrec = await A.f.evaluate(k => EmberDebug.game.P.markets[k], sx.x.id + ':orbital');
		ok('3. a roaming guest\'s trade is recorded in the host\'s market there, though the host is elsewhere', hrec && hrec.d && hrec.d.Food < -6, hrec);
		A.f = await frame(A.pg, x => EmberDebug.game.wing.where.get(1) == x, 60, sx.x.name);
		B.f = await frame(B.pg, x => EmberDebug.game.wing.where.get(0) == x, 60, sx.home.name);
		const fa = await wingOpen(A); const who = await fa.evaluate(() => document.getElementById('wingWho').textContent); await resume(A);
		ok('4. each sees where the other is (the Wing screen: the guest at X)', who.includes('at ' + sx.x.name), who);
		/* the host's jump doesn't take over a roaming guest's route */
		await A.f.evaluate(y => { const g = EmberDebug.game, k = EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 8).find(s => s.id == y); EmberDebug.wingJumped({star: k}) }, sx.y.id); await sleep(500);
		ok('5. the host jumping: a roaming guest is told, but their next jump stays their own', await B.f.evaluate(() => !EmberDebug.game.wing.follow));
		/* the shared strike, done away: the guest's own kill counts (its game keeps X), and so on the host's */
		const wB = await B.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, sx.cur), wA = await A.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, sx.cur);
		await B.f.evaluate(crew => { const n = EmberDebug.game.npcs.find(n => !n.remote && n.role == 'pirate' && !n.cs.dead); n.faction = crew; EmberDebug.destroyed(n, true) }, sx.crew);
		A.f = await frame(A.pg, () => !EmberDebug.game.P.missions.some(m => m.id == 't:xstrike'), 80);
		const paid = {a: await A.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, sx.cur), b: await B.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, sx.cur), bHeld: await B.f.evaluate(() => EmberDebug.game.P.missions.some(m => m.id == 't:xstrike'))};
		ok('6. a shared mission done away: the guest\'s game counts its kill there, and the host\'s mission takes it; both paid', paid.a > wA && paid.b > wB && !paid.bHeld, {paid, wA, wB});
		/* the host comes to X: the system is the host's */
		await A.f.evaluate(x => { const g = EmberDebug.game; EmberDebug.go(EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 8).find(s => s.id == x)) }, sx.x.id);
		B.f = await frame(B.pg, () => EmberDebug.game.wing.kept == null, 60);
		await sleep(600);
		const taken = await B.f.evaluate(() => ({own: EmberDebug.game.npcs.filter(n => !n.remote).length, kept: EmberDebug.game.wing.kept}));
		ok('7. the host arriving where a guest roams: the guest\'s own ships give way, the system is the host\'s', taken.own == 0 && taken.kept == null, taken);
		/* the host leaves for Y: the guest keeps X again */
		await A.f.evaluate(y => { const g = EmberDebug.game; EmberDebug.go(EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 12).find(s => s.id == y)) }, sx.y.id);
		B.f = await frame(B.pg, x => EmberDebug.game.wing.kept == x, 80, sx.x.id);
		ok('8. the host gone again: the guest\'s game keeps the system once more', await B.f.evaluate(x => EmberDebug.game.wing.kept == x, sx.x.id));
		ok('9. no errors on either page', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill(); relay.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
