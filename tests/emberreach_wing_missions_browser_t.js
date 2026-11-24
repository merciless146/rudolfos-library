/* Ember Reach's co-op wing sharing missions, in Chromium (Playwright): TWO pages, two accounts, a host and a guest
   through the relay (0.6.3, docs/plan-ember-reach-pilots.md P5c). The host shares missions from the Wing screen; a guest
   joining later is offered them, and takes them as their own; a kill by the guest counts on the host's mission (its
   game counting it) and so on the guest's; the guest's time in a system counts on the host's; each is paid in their
   own game; a mission finished can't be taken again; leaving, the guest keeps what's left as their own.
     node tests/emberreach_wing_missions_browser_t.js [PORT]   (uses PORT and PORT+1) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8664), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'erm-'));
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
		/* the host's missions: a strike on a pirate crew here (two of three done), a recon here (30 s in the system), a
		   recon elsewhere (left undone) */
		const ids = await A.f.evaluate(() => { const g = EmberDebug.game, P = g.P, F = EmberFactions, here = {id: g.star.id, name: g.star.name, at: [g.star.x, g.star.y, g.star.z]}, w = F.wars()[0], crew = F.minors().find(m => m.type == 'criminal').id, cur = Object.keys(P.wallet)[0];
			const base = {issuer: P.origin, war: w.id, system: 'sys', systemName: g.star.name, effort: 4, currency: cur, accepted: Math.floor(g.day), due: Math.floor(g.day) + 10, port: null, kills: 0, stay: 0, depot: false, done: false};
			P.missions = [Object.assign({}, base, {id: 't:strike', type: 'strike', against: crew, text: 'Strike the crew at ' + g.star.name, reward: 5000, star: here, kills: 2}),
				Object.assign({}, base, {id: 't:recon', type: 'recon', against: w.b, text: 'Recon at ' + g.star.name, reward: 3000, star: here}),
				Object.assign({}, base, {id: 't:far', type: 'recon', against: w.b, text: 'Recon far away', reward: 2000, star: {id: 'farstar', name: 'Far', at: [here.at[0] + 5, here.at[1], here.at[2]]}})];
			return {crew, cur} });
		await A.f.evaluate(() => { const s = EmberDebug.s; EmberDebug.game.npcs.filter(n => n.role == 'pirate').forEach(n => { n.s.p = [s.p[0] + 60000, s.p[1], s.p[2]] }) });   /* (any pirates here kept out of it) */
		A.f = await wing(A, 'host'); A.f = await frame(A.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.code);
		const code = await A.f.evaluate(() => EmberDebug.game.wing.code);
		await resume(A);
		/* the host shares two from the Wing screen, before anyone joins */
		let fa = await wingOpen(A);
		const before = await fa.evaluate(() => document.querySelectorAll('#wingMs [data-wshare]').length);
		await fa.click('#wingMs [data-wshare="0"]'); await sleep(300); fa = await frame(A.pg, () => !!document.querySelector('#wingMs'));
		await fa.click('#wingMs [data-wshare="1"]'); await sleep(300); fa = await frame(A.pg, () => !!document.querySelector('#wingMs'));
		const after = await fa.evaluate(() => ({buttons: document.querySelectorAll('#wingMs [data-wshare]').length, shared: EmberDebug.game.wing.shared.map(m => m.id), text: document.getElementById('wingMs').textContent}));
		ok('1. the host\'s Wing screen lists its missions, each with Share with the wing; shared, it says so', before == 3 && after.buttons == 1 && after.shared.join() == 't:strike,t:recon' && /shared with the wing/.test(after.text), {before, after});
		await resume(A);
		/* the guest joins later: offered both */
		const B = await pilot(ctxs[1], false, 0);
		const w0 = await B.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, ids.cur);
		B.f = await wing(B, 'join', code); B.f = await frame(B.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days);
		B.f = await frame(B.pg, () => EmberDebug.game.wing.offers.length == 2, 60);
		let fb = await wingOpen(B);
		const offered = await fb.evaluate(() => ({ids: EmberDebug.game.wing.offers.map(u => u.m.id), takes: document.querySelectorAll('#wingMs [data-wtake]').length, held: (EmberDebug.game.P.missions || []).length}));
		ok('2. a guest joining after the shares is offered them on the Wing screen (nothing of theirs yet)', offered.ids.join() == 't:strike,t:recon' && offered.takes == 2 && offered.held == 0, offered);
		await fb.click('#wingMs [data-wtake="0"]'); await sleep(300); fb = await frame(B.pg, () => !!document.querySelector('#wingMs'));
		await fb.click('#wingMs [data-wtake="1"]'); await sleep(300); fb = await frame(B.pg, () => !!document.querySelector('#wingMs'));
		const took = await fb.evaluate(() => ({ms: EmberDebug.game.P.missions.map(m => [m.id, m.kills, m.due]), taken: [...EmberDebug.game.wing.taken.keys()], text: document.getElementById('wingMs').textContent}));
		const hostDue = await A.f.evaluate(() => EmberDebug.game.P.missions[0].due);
		ok('3. taken: each a copy of the guest\'s own, the work so far with it (two kills), due when the host\'s is', took.ms.length == 2 && took.ms[0][0] == 't:strike' && took.ms[0][1] == 2 && took.ms[0][2] == hostDue && took.taken.length == 2 && /yours, with the wing/.test(took.text), {took, hostDue});
		await resume(B);
		/* the guest's time in the system counts on the host's recon: the guest's copy at 31 s, the host's follows */
		await B.f.evaluate(() => { EmberDebug.game.wing.taken.get('t:recon').stay = 31 });
		await frame(A.pg, () => !EmberDebug.game.P.missions.some(m => m.id == 't:recon') && !EmberDebug.game.wing.shared.some(m => m.id == 't:recon'), 80);
		await frame(B.pg, () => EmberDebug.game.wing.over.has('t:recon'), 80);   /* (each side once a second: up to about 4 s round) */
		const recon = await A.f.evaluate(() => ({held: EmberDebug.game.P.missions.some(m => m.id == 't:recon'), shared: EmberDebug.game.wing.shared.map(m => m.id)}));
		const bRecon = await B.f.evaluate(c => ({held: EmberDebug.game.P.missions.some(m => m.id == 't:recon'), w: EmberDebug.game.P.wallet[c] || 0}), ids.cur);
		ok('4. a guest\'s time in the system counts on the host\'s recon too: both done and paid, each in their own game', !recon.held && !recon.shared.includes('t:recon') && !bRecon.held && bRecon.w > w0, {recon, bRecon, w0});
		/* a kill by the guest: counted by the host's game, on its strike, and so on the guest's */
		const wA = await A.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, ids.cur);
		const pid = await A.f.evaluate(crew => { EmberDebug.pirates(1); const s = EmberDebug.s, n = EmberDebug.game.npcs.find(n => n.role == 'pirate' && !n.remote && !n.cs.dead); n.faction = crew; n.s.p = [s.p[0] + 4000, s.p[1], s.p[2]]; n.s.v = [0, 0, 0]; return n.id }, ids.crew);
		await B.f.evaluate(() => { EmberDebug.game.npcs.filter(n => n.role == 'pirate' && !n.wingNpc).forEach(n => { n.cs.dead = true }) });   /* (the guest's game spawns none of its own; just in case) */
		B.f = await frame(B.pg, id => EmberDebug.game.npcs.some(n => n.wingNpc && n.id == id), 60, pid);
		for (let i = 0; i < 40; i++) {
			const dead = await A.f.evaluate(id => { const n = EmberDebug.game.npcs.find(n => n.id == id); return !n || n.cs.dead }, pid); if (dead) break;
			await B.f.evaluate(id => { EmberDebug.game.wing.ev.push({e: 'hitN', i: id, dmg: 4000, kind: 'pulse'}) }, pid); await sleep(150);
		}
		await frame(A.pg, () => !EmberDebug.game.P.missions.some(m => m.id == 't:strike'), 80);
		await frame(B.pg, () => EmberDebug.game.wing.over.has('t:strike'), 80);
		const strikeA = await A.f.evaluate(c => ({held: EmberDebug.game.P.missions.some(m => m.id == 't:strike'), w: EmberDebug.game.P.wallet[c] || 0}), ids.cur);
		const strikeB = await B.f.evaluate(c => ({held: EmberDebug.game.P.missions.some(m => m.id == 't:strike'), w: EmberDebug.game.P.wallet[c] || 0, over: [...EmberDebug.game.wing.over]}), ids.cur);
		ok('5. the guest destroys one of the crew: the host\'s game counts it on its strike (the third), and both are paid', !strikeA.held && strikeA.w > wA && !strikeB.held && strikeB.w > bRecon.w && strikeB.over.includes('t:strike'), {strikeA, wA, strikeB, bw: bRecon.w});
		/* a mission finished can't be taken again */
		await A.f.evaluate(() => { const g = EmberDebug.game, m = g.P.missions.find(m => m.id == 't:far'); g.wing.shared.push(m) });
		await frame(B.pg, () => EmberDebug.game.wing.offers.map(u => u.m.id).join() == 't:far', 60);
		fb = await wingOpen(B);
		const late = await fb.evaluate(() => ({ids: EmberDebug.game.wing.offers.map(u => u.m.id), takes: document.querySelectorAll('#wingMs [data-wtake]').length}));
		ok('6. finished missions are no longer offered; a new share is', late.ids.join() == 't:far' && late.takes == 1, late);
		await fb.click('#wingMs [data-wtake="0"]'); await sleep(300); fb = await frame(B.pg, () => !!document.querySelector('#wingMs')); await resume(B);
		/* the guest leaves: what's left stays theirs */
		await B.f.evaluate(() => EmberDebug.game.wing.N.leave()); await sleep(1200);
		const left = await B.f.evaluate(() => EmberDebug.game.P.missions.map(m => m.id));
		ok('7. leaving the wing, the guest keeps the mission still to do as their own', left.join() == 't:far', left);
		ok('8. no errors on either page', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill(); relay.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
