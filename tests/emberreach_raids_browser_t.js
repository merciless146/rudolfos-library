/* Ember Reach's raids on surface ports, in Chromium (Playwright) (0.6.6, docs/plan-ember-reach-landing-work.md L3.6):
   coming near a surface port on a day it's raided, the raiders over it; no landing clearance while it's on; driven off
   with your help, a defence reward and standing with its holder; left to it, the port looted (its stock of two goods
   down) and the raiders gone.
     node tests/emberreach_raids_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8676), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'erd-'));
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
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(900);
	const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
	try {
		const A = await pilot(await br.newContext({viewport: {width: 1000, height: 650}}), false, 0);
		/* no raid by chance while the test sets up; the reputation's acts watched; the ship 6 km over a surface port */
		const info = await A.f.evaluate(() => {
			const g = EmberDebug.game; window.__acts = []; const act = EmberReputation.act; EmberReputation.act = (P, a, f) => { window.__acts.push([a, f]); return act(P, a, f) };
			window.__under = EmberRaids.under; EmberRaids.under = () => false;
			g.npcs.filter(n => n.role == 'pirate').forEach(n => { n.gone = true });
			const sp = g.surfacePorts.find(x => !x.q.lone); if (!sp) return null;
			window.__over = (sp, h) => { const at = EmberDebug.surfacePortAt(sp), s = EmberDebug.s; s.p = [at.pos[0] + at.up[0] * h, at.pos[1] + at.up[1] * h, at.pos[2] + at.up[2] * h]; s.v = EmberFlight.frameAt(EmberScene.worldFrame(sp.body), s.p).v; if (g.cruise) g.cruise.on = false };
			window.__over(sp, 6000);
			return {n: g.surfacePorts.length, id: sp.q.id, kind: sp.q.kind, owner: sp.q.owner, name: sp.q.name, cur: Object.keys(g.P.wallet)[0]} });
		ok('0. the home system has a surface port to raid', !!info, info);
		await sleep(600);
		const key = await A.f.evaluate(id => { const g = EmberDebug.game, sp = g.surfacePorts.find(x => x.q.id == id), key = g.star.id + ':' + id + ':test1'; EmberDebug.raidStart(key, sp); return key }, info.id);
		const r1 = await A.f.evaluate(([id, key]) => { const g = EmberDebug.game, sp = g.surfacePorts.find(x => x.q.id == id), at = EmberDebug.surfacePortAt(sp), rs = g.npcs.filter(n => n.raid == key);
			const d = rs.map(n => Math.hypot(n.s.p[0] - at.pos[0], n.s.p[1] - at.pos[1], n.s.p[2] - at.pos[2]));
			return {n: rs.length, size: EmberRaids.size(sp.q), on: g.raids[key].on, maxD: Math.max(...d), minD: Math.min(...d)} }, [info.id, key]);
		ok('1. a raid: its raiders over the port (by the port\'s kind), within a few km', r1.on && r1.n == r1.size && r1.maxD < 4500 && r1.minD > 500, r1);
		A.f = await frame(A.pg, key => EmberDebug.game.npcs.some(n => n.raid == key && n.foe), 60, key);
		const foes = await A.f.evaluate(key => EmberDebug.game.npcs.filter(n => n.raid == key && n.foe).map(n => n.foe === EmberDebug.ME ? 'you' : n.foe.role || n.foe.traffic && 'traffic'), key);
		ok('1b. the raiders pick their fights there (you, the port\'s traffic, its turrets)', foes.length >= 1, foes);
		const dock = await A.f.evaluate(id => { const g = EmberDebug.game; g.clearance = null; EmberDebug.requestDock(); return {cl: g.clearance} }, info.id);
		ok('2. while it\'s on, the port gives no landing clearance', !dock.cl, dock);
		/* you destroy the raiders */
		const w0 = await A.f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, info.cur);
		await A.f.evaluate(key => { for (const n of EmberDebug.game.npcs.filter(n => n.raid == key && !n.cs.dead)) EmberDebug.destroyed(n, true) }, key);
		A.f = await frame(A.pg, key => !EmberDebug.game.raids[key].on, 60, key);
		const r2 = await A.f.evaluate(([key, c]) => ({helped: EmberDebug.game.raids[key].helped, acts: window.__acts.filter(a => a[0] == 'defendPort'), w: Object.values(EmberDebug.game.P.wallet).reduce((a, b) => a + b, 0)}), [key, info.cur]);
		ok('3. driven off with your help: a defence reward and standing with its holder' + (info.owner ? '' : ' (an independent port: the reward)'), r2.helped == r1.n && (info.owner ? r2.acts.length == 1 && r2.acts[0][1] == info.owner : r2.acts.length == 0) && r2.w > w0, {r2, w0, owner: info.owner});
		/* a second raid, left to it: the port looted */
		const before = await A.f.evaluate(id => { const g = EmberDebug.game, sp = g.surfacePorts.find(x => x.q.id == id), m = EmberEconomy.market(g.star, g.day, {port: sp.q, P: g.P}); return {key: m.key, s: Object.assign({}, ((g.P.markets || {})[m.key] || {}).s || {})} }, info.id);
		const key2 = await A.f.evaluate(id => { const g = EmberDebug.game, sp = g.surfacePorts.find(x => x.q.id == id), key = g.star.id + ':' + id + ':test2'; EmberDebug.raidStart(key, sp); return key }, info.id);
		await A.f.evaluate(id => window.__over(EmberDebug.game.surfacePorts.find(x => x.q.id == id), 40000), info.id);
		A.f = await frame(A.pg, key => !EmberDebug.game.raids[key].on, 60, key2);
		const r3 = await A.f.evaluate(([key, mk]) => { const g = EmberDebug.game; return {left: g.npcs.filter(n => n.raid == key && !n.cs.dead).length, s: ((g.P.markets || {})[mk] || {}).s || {}} }, [key2, before.key]);
		const taken = Object.keys(r3.s).filter(g => (r3.s[g] || 0) < (before.s[g] || 0));
		ok('4. left to it (you over 25 km away): the port looted, two goods\' stock down, the raiders gone', r3.left == 0 && taken.length == 2, {r3, before});
		/* a raid found by chance, coming near on a day it's raided */
		await A.f.evaluate(id => { const g = EmberDebug.game; for (const k of Object.keys(g.raids)) if (k.indexOf(':test') < 0) delete g.raids[k]; EmberRaids.under = () => true; window.__over(g.surfacePorts.find(x => x.q.id == id), 8000) }, info.id);
		A.f = await frame(A.pg, id => Object.values(EmberDebug.game.raids).some(r => r.on && r.port == id), 60, info.id);
		const r4 = await A.f.evaluate(id => { const g = EmberDebug.game, k = Object.keys(g.raids).find(k => g.raids[k].on && g.raids[k].port == id); return {k, n: g.npcs.filter(n => n.raid == k && !n.cs.dead).length} }, info.id);
		ok('5. coming within 20 km of a port on a day it\'s raided, the raid is under way (once a day: today\'s key)', r4.k && /:\d+$/.test(r4.k) && r4.n >= 2, r4);
		ok('6. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
