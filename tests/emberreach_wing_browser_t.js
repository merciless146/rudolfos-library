/* Ember Reach's co-op wing in Chromium (Playwright): FOUR pages, each the game as the Rudolf OS desktop opens it, each
   its own account (its own saves), flying as a wing through the relay (tools/duel-relay/relay.mjs, on loopback;
   0.6.1, docs/plan-ember-reach-pilots.md P5b). A Hardcore host hosts; a pilot without Hardcore is turned away; two
   Hardcore guests join: into the host's system, onto its day; everyone sees everyone; the host's pirates on the guests'
   screens; a guest's shot destroying one (the host's game decides, the guest's pilot paid); a pirate's shot on a guest
   (at the guest's own damage), none between the wing; a jump to follow; docking refused to a guest for now; a guest's
   galaxy never written; leaving, back on their own day; the host leaving ending the wing.
     node tests/emberreach_wing_browser_t.js [PORT]   (uses PORT and PORT+1) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8620), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'erw-'));
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
		const ctxs = await Promise.all([0, 1, 2, 3].map(() => br.newContext({viewport: {width: 1100, height: 700}})));
		/* the host: Hardcore, its galaxy 30 days on from the others' */
		const A = await pilot(ctxs[0], true, 0);
		await A.f.evaluate(() => { EmberDebug.game.day += 30 });
		A.f = await wing(A, 'host'); A.f = await frame(A.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.code);
		const a0 = await view(A.f);
		ok('1. the Wing screen hosts a wing online: a code', a0.state == 'ready' && a0.role == 'host' && /^[A-Z2-9]{6}$/.test(a0.code), a0);
		/* a pilot without Hardcore: turned away */
		const C = await pilot(ctxs[2], false, 1);
		const cday = (await view(C.f)).day;
		C.f = await wing(C, 'join', a0.code); C.f = await frame(C.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.end);
		const c1 = await view(C.f), cmsg = await C.f.evaluate(() => EmberDebug.game.wing.end.text);
		ok('2. a pilot without Hardcore is turned away by a Hardcore host, and told why; they stay where they were, on their own day', c1.end == 'hardcore' && /only Hardcore pilots/.test(cmsg) && c1.day == cday && c1.star != a0.star, {c1, cmsg});
		/* two Hardcore guests */
		const B = await pilot(ctxs[1], true, 1), D = await pilot(ctxs[3], true, 2);
		await sleep(2500);   /* (launching's save, and the one it may queue, done) */
		const bHome = await view(B.f);
		B.f = await wing(B, 'join', a0.code); B.f = await frame(B.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days && EmberDebug.game.star);
		const bWrites0 = await B.pg.evaluate(() => Object.assign({}, WRITES));   /* (from the moment they're in the wing: pausing to open the Wing screen saved their own game first, at home) */
		D.f = await wing(D, 'join', a0.code); D.f = await frame(D.pg, () => EmberDebug.game.wing && EmberDebug.game.wing.days);
		await sleep(1500);
		const a1 = await view(A.f), b1 = await view(B.f), d1 = await view(D.f);
		ok('3. Hardcore guests join: into the host\'s system, onto the host\'s day (30 days on from theirs), next to the host\'s ship', b1.star == a1.star && d1.star == a1.star && b1.day == a1.day && a1.day - bHome.day >= 30 && dist(b1.me, a1.me) < 5000, {a1: [a1.star, a1.day], b1: [b1.star, b1.day], d: dist(b1.me, a1.me), home: bHome.day});
		const bseen = a1.members.find(m => m.seat == b1.id);
		ok('4. everyone sees everyone: the host both guests (by name), each guest the host and the other guest, where they are', a1.members.length == 2 && b1.members.length == 2 && d1.members.length == 2 && b1.members.some(m => m.seat == 0) && b1.members.some(m => m.seat == d1.id) && bseen && dist(bseen.p, b1.me) < 300, {a: a1.members.map(m => m.seat + m.name), b: b1.members.map(m => m.seat), bseen: bseen && dist(bseen.p, b1.me)});
		/* the host's pirates */
		await A.f.evaluate(() => { EmberDebug.pirates(2); const s = EmberDebug.s; EmberDebug.game.npcs.filter(n => n.role == 'pirate').forEach((n, i) => { n.s.p = [s.p[0] + 40000, s.p[1] + i * 500, s.p[2]]; n.s.v = [0, 0, 0] }) }); await sleep(1500);   /* (40 km off: sent to the guests, but too far to fire on the wing while the test's own shots are counted) */
		const a2 = await view(A.f), b2 = await view(B.f);
		const pir = await A.f.evaluate(() => EmberDebug.game.npcs.filter(n => n.role == 'pirate' && !n.remote).map(n => n.id)), hostIds = await A.f.evaluate(() => EmberDebug.game.npcs.filter(n => !n.remote && !n.cs.dead).map(n => n.id));
		ok('5. the host\'s ships (its pirates, patrols and traders) are on the guests\' screens, flown from the host\'s game; guests spawn none of their own', pir.length == 2 && pir.every(id => b2.wnpcs.some(n => n.id == id)) && b2.wnpcs.length && b2.wnpcs.every(n => hostIds.includes(n.id)), {pir, hostIds, b: b2.wnpcs.map(n => n.id)});
		/* a guest's shot on a pirate: the host decides; the kill sent back, the guest's pilot paid */
		const bWallet0 = await B.f.evaluate(() => JSON.stringify(EmberDebug.game.P.wallet));
		await B.f.evaluate(id => { const g = EmberDebug.game, n = g.npcs.find(x => x.id == id), s = EmberDebug.s, d = n.s.p.map((v, i) => v - s.p[i]), L = Math.hypot(...d); g.shots.push({kind: 'pulse', p: n.s.p.map((v, i) => v - d[i] / L * 20), v: d.map(x => x / L * 3000), ttl: 1, dmg: 4000, owner: 'me'}) }, pir[0]);   /* (a claim is a gun's damage at most: 5,000) */
		await sleep(1200);
		const hostDead = await A.f.evaluate(id => { const n = EmberDebug.game.npcs.find(x => x.id == id); return !n || n.cs.dead }, pir[0]), b3 = await view(B.f), bWallet1 = await B.f.evaluate(() => JSON.stringify(EmberDebug.game.P.wallet));
		ok('6. a guest\'s shot on a pirate is the host\'s to decide: the pirate destroyed in the host\'s game, then on the guest\'s, and the guest\'s pilot paid the bounty', hostDead && b3.wnpcs.find(n => n.id == pir[0]) && b3.wnpcs.find(n => n.id == pir[0]).dead !== false && bWallet1 != bWallet0, {hostDead, b: b3.wnpcs, bWallet0, bWallet1});
		/* a pirate's shot on a guest, as the host's game has it: the guest's hull and shields */
		const bh0 = (await view(B.f)).hull;
		await A.f.evaluate(([id, seat]) => { const g = EmberDebug.game, n = g.npcs.find(x => x.member == seat), d = [1, 0, 0]; g.shots.push({kind: 'pulse', p: n.s.p.map((v, i) => v - d[i] * 30), v: [3000, 0, 0], ttl: 1, dmg: 6, owner: id}) }, [pir[1], b1.id]);
		await sleep(900);
		const bh1 = (await view(B.f)).hull;
		/* (what 6 of a pulse laser does to this ship at the guest's own difficulty: their game's own rules) */
		const want = await B.f.evaluate(() => { const g = EmberDebug.game, cs = EmberCombat.state(EmberOutfit.derive(EmberShips.hull(g.P.ship.model), g.P.ship.fit)); const o = EmberCombat.damage(cs, 6 * EmberCareer.takenK(g.P), 'pulse', 0); return {d: o.shield + o.hull, k: EmberCareer.takenK(g.P)} });
		ok('7. a pirate\'s shot on a guest (the host\'s game sees it hit): the guest takes it, at their own difficulty (a Hardcore Admiral\'s ×1.3)', Math.abs((bh0 - bh1) - want.d) < 0.05 && want.k == 1.3, {bh0, bh1, want});
		/* (the fight over: the host's pirates gone, so no Hardcore guest is lost to them meanwhile) */
		await A.f.evaluate(() => { for (const n of EmberDebug.game.npcs) if (n.role == 'pirate' && !n.remote) { n.cs.dead = true } }); await sleep(600);
		/* the wing can't hurt itself */
		await A.f.evaluate(seat => { const g = EmberDebug.game, n = g.npcs.find(x => x.member == seat); g.shots.push({kind: 'pulse', p: n.s.p.map((v, i) => v - (i == 0 ? 30 : 0)), v: [3000, 0, 0], ttl: 1, dmg: 50, owner: 'me'}) }, b1.id);
		await sleep(900);
		ok('8. the host\'s own shot on a guest\'s ship does nothing: no friendly fire', Math.abs((await view(B.f)).hull - bh1) < 0.5);
		/* docking: a guest asks like anyone (0.6.2: the ports test covers pads and markets) */
		await B.f.evaluate(() => EmberDebug.requestDock()); await sleep(200);
		ok('9. a guest asking to dock is answered as anyone would be (not refused for being in a wing)', !/next update|leave the wing/.test(await B.f.evaluate(() => JSON.stringify((EmberDebug.game.msgs || []).map(m => m.text)))), null);
		/* the host jumps: the guests are told, and their next jump is the host's */
		const there = await A.f.evaluate(() => { const g = EmberDebug.game, x = EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 6).find(k => k.kind == 'star' && k.id != g.star.id && !k.rift); EmberDebug.wingJumped({star: x}); return {id: x.id, name: x.name} });
		await sleep(500);
		const follow = await B.f.evaluate(() => { const W = EmberDebug.game.wing; return W.follow && W.follow.id });
		ok('10. the host jumping: the guests are told where, to follow with J', follow == there.id, {follow, there});
		/* the guest's own galaxy untouched; its pilot saved */
		await B.f.evaluate(() => EmberDebug.persist()); await sleep(1500);   /* (a save while in the wing) */
		const bWrites1 = await B.pg.evaluate(() => Object.assign({}, WRITES)), gk = Object.keys(bWrites1).filter(k => /galaxy/.test(k));
		ok('11. in the wing, a guest\'s game saves their pilot only: their galaxy\'s records are never written', gk.every(k => bWrites1[k] == bWrites0[k]) && (bWrites1['ember-reach-pilot-1'] || 0) > (bWrites0['ember-reach-pilot-1'] || 0), {bWrites0, bWrites1});
		/* a guest leaves: back on their own day (plus what they lived) */
		const b4 = await view(B.f);
		await B.f.evaluate(() => EmberDebug.game.wing.N.leave()); await sleep(1200);
		const b5 = await view(B.f), a5 = await view(A.f), bs = await B.pg.evaluate(() => SAVES['ember-reach-pilot-1'] && SAVES['ember-reach-pilot-1'].day);
		ok('12. a guest leaving: back on their own galaxy\'s day plus the days lived in the wing; the host hears it, and the wing goes on', b5.day == bHome.day + (b4.day - b1.day) && !b5.members.length && a5.members.length == 1 && a5.state == 'ready', {home: bHome.day, b4: b4.day, b5: b5.day, saved: bs, a: a5.members.length});
		/* the host leaves: the wing is over for the last guest, who's back on their own day */
		await A.f.evaluate(() => EmberDebug.game.wing.N.leave()); await sleep(1500);
		const d6 = await view(D.f), dEnd = await D.f.evaluate(() => EmberDebug.game.wing && EmberDebug.game.wing.end && EmberDebug.game.wing.end.text);
		ok('13. the host leaving ends the wing for the last guest, with the reason; they\'re back on their own day', d6.end == 'wleft' && /host left/.test(dEnd) && d6.day < a1.day && !d6.members.length && !d6.wnpcs.length, {d6, dEnd});
		await A.pg.screenshot({path: path.join(W, 'host.png')});
		ok('14. no errors on any page', errs.length == 0, errs);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill(); relay.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
