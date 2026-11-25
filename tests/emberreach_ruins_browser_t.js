/* Ember Reach's ruin fields on the ground, in Chromium (Playwright) (0.7.2, docs/plan-ember-reach-sites.md L4.2): a
   ruin field near home, flown to; not a target until found, then found by coming near; drawn, its plazas level; a
   structure surveyed by hovering over it for 8 s, another at once with K; the vault opened by landing on its plaza
   for 20 s, its cache of Artefacts set out; the site data worth what sites.js says, and the record saved and back.
     node tests/emberreach_ruins_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8678), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'eru-'));
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
		/* a ruin field near home, on a world this ship can land on */
		const where = await A.f.evaluate(() => {
			const g = EmberDebug.game, hull = EmberShips.hull(g.P.ship.model);
			for (const k of EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 40).sort((a, b) => a.d - b.d)) {
				if (k.kind != 'star' || !EmberGalaxy.system(k).planets.some(p => p.ruins)) continue;
				const f = EmberSites.sitesAt(k, 0, {}).find(x => x.kind == 'field'); if (!f) continue;
				const w = EmberGalaxy.system(k).planets.find(p => p.name == f.world);
				if (EmberLanding.canLand(hull, w).ok && w.g < 1) return {id: k.id, site: f.id, world: f.world};
			}
			return null;
		});
		ok('0. a ruin field near home, on a world this ship can land on', !!where, where);
		await A.f.evaluate(id => { const k = EmberGalaxy.lookup(id, null); EmberRaids.under = () => false; EmberDebug.go(k) }, where.id);
		A.f = await frame(A.pg, id => EmberDebug.game.star.id == id && (EmberDebug.gsites || []).length > 0, 80, where.id);
		const s0 = await A.f.evaluate(id => ({sites: EmberDebug.gsites.map(g => g.x.id), nav: EmberDebug.navList().some(t => t.kind == 'groundsite')}), where.site);
		ok('1. the system\'s ruin field is there, and not yet a target (not found)', s0.sites.includes(where.site) && !s0.nav, s0);
		/* coming within 1.5 km: sighted, found */
		const over = (gi, c, h, pk) => A.f.evaluate(([gi, c, h, pk]) => { const G0 = EmberDebug.gsites[gi], pc = pk ? G0.pieces.find(p => p.key == pk) : null, a = EmberDebug.gsAt(G0, c, pc), s = EmberDebug.s;
			s.p = a.pos.map((v, i) => v + a.up[i] * h); s.v = EmberFlight.frameAt(EmberScene.worldFrame(G0.body), s.p).v; s.q = EmberScene.lookRotation(a.rot.slice(0, 3), a.up); if (EmberDebug.game.cruise) EmberDebug.game.cruise.on = false }, [gi, c, h, pk]);
		const gi = s0.sites.indexOf(where.site);
		await over(gi, [0, 0], 900);
		A.f = await frame(A.pg, () => EmberDebug.navList().some(t => t.kind == 'groundsite'), 40);
		const found = await A.f.evaluate(() => { const g = EmberDebug.game, x = EmberDebug.gsites[0].x; return {rec: g.P.explore.site && Object.values(g.P.explore.site)[0], drawn: [...EmberDebug.meshIds()].filter(k => k.startsWith('gsite:')).length} });
		ok('2. coming near, it\'s sighted: found (a navigation target, its record begun) and drawn, piece by piece', found.rec && found.rec.b == 0 && found.drawn >= 5, found);
		/* the plazas are level */
		const level = await A.f.evaluate(gi => { const G0 = EmberDebug.gsites[gi], b = G0.body, Lo = G0.Lo; return Lo.plazas.map(p => { const h = c => EmberTerrain.height(b, EmberDebug.gsAt(G0, c).up && (() => { const d = G0.dir, e = G0.e, n = G0.n, v = d.map((x, i) => x + e[i] * c[0] / b.radius + n[i] * c[1] / b.radius), l = Math.hypot(...v); return v.map(x => x / l) })()); return Math.abs(h(p.c) - h([p.c[0] + p.r * 0.8, p.c[1]])) }) }, gi);
		ok('3. its plazas are levelled into the ground (the height across each the same)', level.every(d => d < 0.01), level);
		/* hovering over a structure for 8 s */
		const pk = await A.f.evaluate(gi => EmberDebug.gsites[gi].pieces.find(p => p.struct && p.struct.type != 'warden').key, gi);
		const cans0 = await A.f.evaluate(() => EmberDebug.game.cans.length);
		for (let i = 0; i < 120; i++) {
			const pc = await A.f.evaluate(([gi, pk]) => { const G0 = EmberDebug.gsites[gi], pc = G0.pieces.find(p => p.key == pk); return Math.min(40, pc.struct.h) / 2 + 30 }, [gi, pk]);
			await over(gi, null, pc, pk);
			if (await A.f.evaluate(() => { const r = Object.values(EmberDebug.game.P.explore.site)[0]; return r.b != 0 })) break;
			await sleep(100);
		}
		const sv = await A.f.evaluate(([gi, pk]) => { const G0 = EmberDebug.gsites[gi], pc = G0.pieces.find(p => p.key == pk), r = Object.values(EmberDebug.game.P.explore.site)[0]; return {b: r.b, bit: EmberSites.BITS.struct(pc.struct.n), ton: EmberSites.structYield(G0.x, pc.struct.n).ton, cans: EmberDebug.game.cans.length} }, [gi, pk]);
		ok('4. hovering within 80 m of a structure for 8 s surveys it (its bit in the record; a tonne of Artefacts by it, if it held one)', sv.b == sv.bit && sv.cans - cans0 == (sv.ton ? 1 : 0), {sv, cans0});
		/* another, at once with K */
		const k = await A.f.evaluate(([gi, pk]) => { const G0 = EmberDebug.gsites[gi], pc = G0.pieces.find(p => p.struct && p.struct.type != 'warden' && p.key != pk); return pc && pc.key }, [gi, pk]);
		if (k) {
			await A.f.evaluate(([gi, k]) => { const G0 = EmberDebug.gsites[gi], pc = G0.pieces.find(p => p.key == k); return pc }, [gi, k]);
			const pc2 = await A.f.evaluate(([gi, k]) => { const G0 = EmberDebug.gsites[gi], pc = G0.pieces.find(p => p.key == k); return Math.min(40, pc.struct.h) / 2 + 30 }, [gi, k]);
			await over(gi, null, pc2, k); await sleep(100);
			const kk = await A.f.evaluate(([gi, k]) => { const G0 = EmberDebug.gsites[gi], pc = G0.pieces.find(p => p.key == k), t = EmberDebug.gsParts().find(x => x.pc == pc); EmberDebug.setTarget(t); EmberDebug.scanNow(); return {b: Object.values(EmberDebug.game.P.explore.site)[0].b, bit: EmberSites.BITS.struct(pc.struct.n)} }, [gi, k]);
			ok('5. K on a targeted structure in range surveys it at once', (kk.b & kk.bit) != 0, kk);
		} else ok('5. (one structure only)', true);
		/* the vault: landed on its plaza for 20 s */
		const pl = await A.f.evaluate(gi => { const G0 = EmberDebug.gsites[gi], V = G0.Lo.vault, pz = G0.Lo.plazas.find(p => p.n == V.plaza); return {c: [pz.c[0] + pz.r * 0.3, pz.c[1]], r: pz.r} }, gi);
		const low = await A.f.evaluate(() => EmberLanding.lowest(EmberShips.hull(EmberDebug.game.P.ship.model), true, 0).d);
		await A.f.evaluate(() => { EmberDebug.gear = true });
		await over(gi, pl.c, low - 0.05);
		A.f = await frame(A.pg, () => !!EmberDebug.landed, 40);
		const cans1 = await A.f.evaluate(() => EmberDebug.game.cans.length), bps0 = await A.f.evaluate(() => (EmberDebug.game.P.blueprints || []).length);
		A.f = await frame(A.pg, () => (Object.values(EmberDebug.game.P.explore.site)[0].b & 128) != 0, 300);
		const vt = await A.f.evaluate(gi => { const G0 = EmberDebug.gsites[gi], c = EmberSites.vaultCache(G0.x); return {tons: c.tons, bp: !!c.bp, cans: EmberDebug.game.cans.length, bps: (EmberDebug.game.P.blueprints || []).length, landed: !!EmberDebug.landed} }, gi);
		ok('6. landed on its plaza for 20 s, the vault opens: its Artefacts set out as canisters (and a blueprint, if it held one)', vt.landed && vt.cans - cans1 == vt.tons && vt.bps - bps0 == (vt.bp ? 1 : 0), {vt, cans1, bps0});
		/* the data */
		const data = await A.f.evaluate(gi => { const G0 = EmberDebug.gsites[gi], P = EmberDebug.game.P, r = Object.values(P.explore.site)[0], u = EmberExplore.unsold(P).find(x => x.kind == 'site'); return {su: u && u.su, want: EmberSites.dataWorth(G0.x, r.b) * (r.f ? 2.5 : 1), first: r.f} }, gi);
		ok('7. the site data is for sale to cartographers at what it\'s worth (4,000 SU, 800 a structure, 2,000 for the vault; ×2.5 a first)', data.su > 0 && Math.abs(data.su - data.want) < 1, data);
		const round = await A.f.evaluate(() => { const P = EmberDebug.game.P, back = EmberSave.unpackPlayer(JSON.parse(JSON.stringify(EmberSave.packPlayer(P)))); return JSON.stringify(back.explore.site) == JSON.stringify(P.explore.site) });
		ok('8. the site\'s record is saved and comes back', round);
		ok('9. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
