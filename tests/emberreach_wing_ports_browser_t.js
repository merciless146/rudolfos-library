/* Ember Reach's co-op wing at the ports, in Chromium (Playwright): TWO pages, two accounts, a host and a guest through the
   relay (0.6.2, docs/plan-ember-reach-pilots.md P5b-2). The host's markets and colonies for its system on the guest's
   side; a market's change passed on; the guest's pad held in the host's controller too, the host given another; the
   guest's trade recorded in the host's market; the host docked while the guest is out, its system going on (its
   pirates kept and flying) and not replaced at its launch; leaving, the guest's own galaxy as it was.
     node tests/emberreach_wing_ports_browser_t.js [PORT]   (uses PORT and PORT+1) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8660), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-'));
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
	pg.on('console', m => { if (m.type() == 'error' && !/WebSocket connection to .* failed/.test(m.text())) errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
	await pg.goto(`http://127.0.0.1:${PORT}/desk.html#${q}`);
	return pg;
}
async function frame(pg, test, tries) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < (tries || 300); i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
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
	const relay = spawn('node', [path.join(TOP, 'tools/duel-relay/relay.mjs'), '--port', String(RELAY), '--host', '127.0.0.1'], {stdio: 'ignore'});
	await sleep(900);
	const br = await chromium.launch({args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
	try {
		const ctxs = await Promise.all([0, 1].map(() => br.newContext({viewport: {width: 1100, height: 700}})));
		/* the host: a market record and a colony of its own in its system */
		const A = await pilot(ctxs[0], false, 0);
		const key = await A.f.evaluate(() => { const g = EmberDebug.game, E = EmberEconomy, k = E.keyOf(g.star, g.port); E.record(g.P, {key: k}, 'Iron', 40, false, g.day);
			g.P.colonies = (g.P.colonies || []).concat([{id: 'wc1', star: {id: g.star.id, name: g.star.name, at: [g.star.x, g.star.y, g.star.z]}, owner: g.pilotId, port: 'outpost', world: g.star.name + ' b', stage: 'claimed', claimed: g.day, beaconBy: g.day + 30, builds: [], need: {Food: 100}, got: {}}]); return k });   /* (claimed: a colony of its own here, but no port yet: this is a capital's system) */
		A.f = await wing(A, 'host'); A.f = await frame(A.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.code);
		const code = await A.f.evaluate(() => EmberDebug.game.wing.code);
		/* the guest, with a market record and a colony of its own at home */
		const B = await pilot(ctxs[1], false, 0);   /* (the host's own power: a guest at war with the system's holder is refused docking, the game's own rule) */
		const home = await B.f.evaluate(() => { const g = EmberDebug.game; EmberEconomy.record(g.P, {key: 'home:orbital'}, 'Food', 9, true, g.day); return {mk: Object.keys(g.P.markets || {}), col: (g.P.colonies || []).length} });
		B.f = await wing(B, 'join', code); B.f = await frame(B.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days);
		await sleep(800);
		const b1 = await B.f.evaluate(k => { const P = EmberDebug.game.P; return {rec: P.markets && P.markets[k], keys: Object.keys(P.markets || {}), others: (P.others || []).map(c => c.id), own: (P.colonies || []).length} }, key);
		ok('1. in the wing, the guest\'s game has the host\'s market records for this system and its colonies here, and not their own galaxy\'s', b1.rec && b1.rec.s.Iron < -39 && !b1.keys.includes('home:orbital') && b1.others.includes('wc1') && b1.own == 0, {b1, home});
		/* a market's change, passed on */
		await A.f.evaluate(k => EmberEconomy.record(EmberDebug.game.P, {key: k}, 'Iron', 25, false, EmberDebug.game.day), key); await sleep(500);
		ok('2. the host\'s market changing (a trade there) reaches the guest', await B.f.evaluate(k => EmberDebug.game.P.markets[k].s.Iron < -64, key));
		/* pads: the guest's held in the host's controller too */
		await B.f.evaluate(() => { { const g = EmberDebug.game, c = EmberDebug.st.c, me = EmberDebug.s; me.p = [c[0] + 3000, c[1], c[2]]; me.v = [0, 0, 0]; g.cruise = {on: false, v: 0, charge: 0} } EmberDebug.requestDock() }); await sleep(600);
		const bpad = await B.f.evaluate(() => { const C = EmberDebug.game.atc && Object.values(EmberDebug.game.atc)[0]; const x = C && C.pads.find(p => p.who == 'me'); return x ? x.n : null });
		await sleep(500);
		const apads = await A.f.evaluate(() => Object.values(EmberDebug.game.atc || {}).map(C => C.pads.filter(p => p.who == 'w1').map(p => p.n)).flat());
		await A.f.evaluate(() => { { const g = EmberDebug.game, c = EmberDebug.st.c, me = EmberDebug.s; me.p = [c[0] + 3000, c[1], c[2]]; me.v = [0, 0, 0]; g.cruise = {on: false, v: 0, charge: 0} } EmberDebug.requestDock() }); await sleep(400);
		const apad = await A.f.evaluate(() => { const C = Object.values(EmberDebug.game.atc)[0]; const x = C.pads.find(p => p.who == 'me'); return x ? x.n : null });
		ok('3. a guest given a pad: the host\'s controller holds it for them too, and gives the host another', bpad != null && apads.includes(bpad) && apad != null && apad != bpad, {bpad, apads, apad});
		/* the guest docks and buys: into the host's market */
		await B.f.evaluate(() => EmberDebug.dock()); await sleep(500);
		/* (a starter ship has no hold to spare: the guest sells 5 t the port wants) */
		const bought = await B.f.evaluate(() => { const g = EmberDebug.game, P = g.P, E = EmberEconomy, T = EmberTrade, mkt = E.market(g.star, g.day, {port: g.dockPort, P}); const good = Object.keys(mkt.prices).find(k => mkt.prices[k].buy && (mkt.prices[k].demand == null || mkt.prices[k].demand > 20) && k != 'Iron'); P.cargo[good] = 5; const r = T.sell(P, mkt, good, 5, g.day); return {ok: r.ok, why: r.why, good, key: mkt.key, docked: g.docked} });
		await sleep(600);
		const hostRec = await A.f.evaluate(k => EmberDebug.game.P.markets[k], bought.key);
		ok('4. the guest docks and sells 5 t: the trade is recorded in the host\'s market there (its demand down 5)', bought.ok && bought.docked && hostRec && Math.abs((hostRec.d[bought.good] || 0) + 5) < 0.6, {bought, hostRec});
		/* the guest out again; the host docked: its system goes on */
		await B.pg.evaluate(() => 0); await B.f.click('#port [data-screen="launch"]'); await sleep(200); await B.f.click('#port [data-act="launch"]'); await sleep(800);
		await A.f.evaluate(() => { EmberDebug.pirates(1); const s = EmberDebug.s; EmberDebug.game.npcs.filter(n => n.role == 'pirate').forEach(n => { n.s.p = [s.p[0] + 30000, s.p[1], s.p[2]] }) }); await sleep(600);
		const before = await A.f.evaluate(() => EmberDebug.game.npcs.filter(n => !n.remote).map(n => n.id));
		await A.f.evaluate(() => EmberDebug.dock()); await sleep(300);
		const p0 = await A.f.evaluate(() => { const n = EmberDebug.game.npcs.find(n => n.role == 'pirate' && !n.remote); return n && n.s.p.slice() });
		await sleep(1500);
		const kept = await A.f.evaluate(() => ({docked: EmberDebug.game.docked, kept: EmberDebug.game.wingKept, ids: EmberDebug.game.npcs.filter(n => !n.remote).map(n => n.id), p: (EmberDebug.game.npcs.find(n => n.role == 'pirate' && !n.remote) || {s: {}}).s.p}));
		const seen = await B.f.evaluate(() => EmberDebug.game.npcs.filter(n => n.wingNpc && EmberDebug.game.t - n.seenAt < 1).map(n => n.id));
		ok('5. the host docked while the guest is out: the host\'s system goes on (its ships kept and flying), and the guest still sees them', kept.docked && kept.kept && p0 && kept.p && Math.hypot(...kept.p.map((v, i) => v - p0[i])) > 1 && before.every(id => kept.ids.includes(id)) && seen.length >= 1 && before.some(id => seen.includes(id)), {kept: [kept.docked, kept.kept], moved: p0 && kept.p && Math.hypot(...kept.p.map((v, i) => v - p0[i])), seen: seen.length});
		/* the host launches: its system as it was, not replaced */
		await A.f.click('#port [data-screen="launch"]'); await sleep(200); await A.f.click('#port [data-act="launch"]'); await sleep(600);
		const after = await A.f.evaluate(() => EmberDebug.game.npcs.filter(n => !n.remote && !n.cs.dead).map(n => n.id));
		ok('6. the host launching: the same ships, not a new lot', before.filter(id => after.includes(id)).length >= before.length - 1 && after.length > 0, {before, after});
		/* the guest leaves: their own galaxy as it was */
		await B.f.evaluate(() => EmberDebug.game.wing.N.leave()); await sleep(1200);
		const b9 = await B.f.evaluate(k => { const P = EmberDebug.game.P; return {keys: Object.keys(P.markets || {}), others: (P.others || []).map(c => c.id), own: (P.colonies || []).length} }, key);
		ok('7. leaving: the guest\'s own markets and colonies are back (the host\'s gone from their game)', !b9.keys.includes(key) && !b9.others.includes('wc1') && b9.own == home.col, {b9, home});
		ok('8. no errors on either page', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill(); relay.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
