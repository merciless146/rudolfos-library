/* Ember Reach's colonies on the ground (0.5.1, landing L3.5) in Chromium (Playwright), as the Rudolf OS desktop opens
   the game: at a border port's colonial office, claim an airless world for a surface outpost (the planner offers the
   ground), fly there and drop the beacon, hand the goods over at the constructor over the site, and come back the
   next day to the outpost standing on its world: ask its controller for a pad, come down on it, dock, and its screens
   open with its market in the sponsor's coin; the save keeps it, docked there.
     node tests/emberreach_groundcolony_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8701), TOP = path.join(__dirname, '..');
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
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug`);
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="5"]');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('[data-screen="launch"]'));
		/* a border port of the power's with unclaimed systems within a jump, and one of them with ground for a port
		   (found as the colony test finds its office) */
		const at = await f.evaluate(() => {
			const G = EmberGalaxy, Co = EmberColonies, T = EmberTravel, Tr = EmberTrade, home = EmberFactions.majors()[5];
			for (let k = 0; k < 12; k++) { const a = k * 2.4, b = Math.sin(k * 1.7) * 0.3, dir = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
				for (let r = home.claim * 0.5; r < home.claim * 1.5; r += home.claim * 0.04) { const p = home.at.map((v, i) => v + dir[i] * r);
					for (const x of G.starsNear(p[0], p[1], p[2], 3).filter(y => y.kind == 'star').slice(0, 6)) { const pf = T.portFor(x, 200); if (!pf || pf.owner != home.id) continue;
						const c = Co.candidates(Tr.newPlayer(home.id), {star: x, owner: home.id}, 200, 6, 10).find(s => Co.groundWorlds(s, 'soutpost').length);
						if (c) { window.__office = x; window.__target = c; return {office: x.name, target: c.name, worlds: Co.groundWorlds(c, 'soutpost').map(w => w.name), code: home.currency.code} } } } }
			return null });
		ok('1. a border port of the power\'s is found, with an unclaimed system within a jump that has ground for a port', !!at, at);
		/* there, docked at its port, with money and a jump drive that reaches */
		await f.evaluate(() => { const g = EmberDebug.game; g.day = 200; EmberDebug.go(window.__office); EmberDebug.ship.jump = 6; g.P.wallet[EmberFactions.majors()[5].currency.code] = 1e9; g.P.rep[EmberFactions.majors()[5].id] = 300; EmberDebug.dock() });
		await sleep(400);
		await f.click('[data-screen="contacts"]'); await sleep(150);
		await f.click('#port [data-screen="colonies"]'); await sleep(200);
		await f.click('#port [data-col="' + (await f.evaluate(() => window.__target.id)) + '"]'); await sleep(200);
		const pl = await f.evaluate(() => { const h = document.getElementById('port'), t = h.textContent, b = h.querySelector('[data-act="claim"][data-k="soutpost"]'), sel = h.querySelector('select[data-pick="gw"]');
			return {ground: /On the ground/.test(t), world: b && b.dataset.w, worlds: sel ? [...sel.options].map(o => o.value) : [], enabled: b && !b.disabled, settle: !!h.querySelector('[data-act="claim"][data-k="ssettle"]'), indep: !!h.querySelector('[data-act="claimi"][data-k="soutpost"]'),
				plan: [...h.querySelectorAll('svg.site-plan')].map(x => ({kind: x.dataset.kind, pads: [...x.querySelectorAll('.pad')].map(p => p.dataset.size).join('')}))} });
		await f.evaluate(() => { const x = document.querySelector('#port svg.site-plan'); x && x.scrollIntoView() }); await sleep(100);
		await pg.screenshot({path: path.join(W, 'planner-ground.png')});
		ok('2. the planner offers the ground: a world to pick (airless, with room) and a surface outpost or settlement to claim on it, sponsored or independent', pl.ground && pl.enabled && pl.worlds.length == at.worlds.length && pl.worlds.includes(pl.world) && pl.settle && pl.indep, pl);
		await f.click('#port [data-act="claim"][data-k="soutpost"]'); await sleep(200);
		const cl = await f.evaluate(() => { const c = EmberDebug.game.P.colonies.find(x => x.id == window.__target.id); return c && {port: c.port, world: c.world, stage: c.stage, site: c.site, need: Object.values(c.need).reduce((a, b) => a + b, 0)} });
		ok('2b. (step 2) the planner draws the site\'s layout on that world before it\'s claimed: the outpost\'s 3 S pads and its buildings (and a settlement\'s 4 S and an M, if the world has room)', pl.plan.length >= 1 && pl.plan[0].kind == 'outpost' && pl.plan[0].pads == 'SSS' && pl.plan.every(x => x.kind == 'outpost' || x.pads.split('').sort().join('') == 'MSSSS'), pl.plan);
		ok('3. the claim is filed: a surface outpost on that world, at a site on it, 1,500 t to bring (more over 1.5 g)', cl && cl.port == 'soutpost' && cl.world == pl.world && cl.stage == 'claimed' && cl.site && typeof cl.site.lat == 'number' && cl.need >= 1500, cl);
		/* launch and jump there; the beacon near the world */
		await f.evaluate(() => { const b = document.querySelector('#port [data-screen="launch"]'); b && b.click() }); await sleep(150);
		await f.evaluate(() => { const b = document.querySelector('#port [data-act="launch"]'); b && b.click() }); await sleep(300);
		await f.evaluate(() => { const g = EmberDebug.game; EmberDebug.go(window.__target); g.npcs = []; const c = g.P.colonies.find(x => x.id == window.__target.id), w = EmberDebug.scene.bodies.find(b => b.name == c.world); EmberDebug.near(w, 6); g.npcs = [] });
		await f.focus('#hud'); await pg.keyboard.press('KeyN'); await sleep(300);
		const bc = await f.evaluate(() => { const g = EmberDebug.game, c = g.P.colonies.find(x => x.id == window.__target.id), w = EmberDebug.scene.bodies.find(b => b.name == c.world);
			const a = g.site && g.site.ground && EmberDebug.surfacePortAt(g.site.ground);
			return {stage: c.stage, ground: !!a, flats: EmberTerrain.params(w).flats.length, alt: a && Math.hypot(...g.site.pos.map((v, i) => v - a.pos[i]))} });
		ok('4. N near the world drops the beacon: the constructor holds 1.5 km over the site, which is levelled into the ground', bc.stage == 'building' && bc.ground && bc.flats >= 1 && Math.abs(bc.alt - 1500) < 1, bc);
		/* the goods aboard, handed over at the constructor (hovering with the turning ground) */
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, c = g.P.colonies.find(x => x.id == window.__target.id);
			g.P.cargo = Object.assign({}, EmberColonies.left(c)); g.P.cost = Object.fromEntries(Object.keys(g.P.cargo).map(k => [k, 1]));
			const p = g.site.pos, w = g.site.world; s.p = p.map((v, i) => v + (p[i] - w.pos[i]) / Math.hypot(...p.map((x, j) => x - w.pos[j])) * 400); s.v = EmberFlight.frameAt(EmberScene.worldFrame(w), s.p).v; s.w = [0, 0, 0]; g.throttle = 0; g.npcs = [] });
		await pg.keyboard.press('KeyN'); await sleep(300);
		const bt = await f.evaluate(() => { const g = EmberDebug.game, c = g.P.colonies.find(x => x.id == window.__target.id); return {stage: c.stage, opens: c.opens, said: g.msgs.slice(-3).map(m => m.text).join(' | ')} });
		ok('5. at the constructor, N hands over the goods from the hold: the outpost is built, and opens tomorrow', bt.stage == 'done' && /is built/.test(bt.said), bt);
		/* the next day: arriving, the outpost stands on its world, a surface port with its pads (and a nav beacon) */
		await f.evaluate(() => { const g = EmberDebug.game; g.day += 1; EmberDebug.go(window.__target); g.npcs = [] }); await sleep(300);
		const sp = await f.evaluate(() => { const g = EmberDebug.game, q = g.ports.find(x => x.colony), x = q && g.surfacePorts.find(y => y.q.id == q.id), w = q && EmberDebug.scene.bodies.find(b => b.name == q.world);
			return q && {id: q.id, kind: q.kind, owner: q.owner, name: q.name, inFlight: !!x, nav: EmberDebug.navList().some(t => t.sp && t.sp.q.id == q.id), beacon: !!g.beacon, flats: EmberTerrain.params(w).flats.length, orbital: !!g.port} });
		ok('6. the next day the outpost stands on its world as a surface port (not in orbit): a navigation target, on its levelled site, with a nav beacon for arrivals', sp && sp.id.endsWith(':colony') && sp.kind == 'outpost' && sp.inFlight && sp.nav && sp.beacon && sp.flats >= 1 && !sp.orbital && sp.owner == (await f.evaluate(() => EmberFactions.majors()[5].id)), sp);
		/* down to it: 1.5 km over the site, N for a pad, then down onto it */
		await f.evaluate(() => { EmberDebug.ship.autopilot = false; EmberDebug.game.ap = null });
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, x = g.surfacePorts.find(y => y.q.colony), a = EmberDebug.surfacePortAt(x); g.clearance = null; g.landed = null; g.gear = false; g.npcs = []; g.atc = {};
			s.p = a.pos.map((v, i) => v + a.up[i] * 1500); s.v = EmberFlight.frameAt(EmberScene.worldFrame(x.body), s.p).v; s.w = [0, 0, 0]; s.q = EmberScene.lookRotation(a.rot.slice(0, 3), a.up) });
		await sleep(400);
		await f.focus('#hud'); await pg.keyboard.press('KeyN'); await sleep(300);
		const cr = await f.evaluate(() => { const g = EmberDebug.game; return {cl: g.clearance && {pad: g.clearance.pad, port: g.clearance.port}, said: g.msgs.slice(-2).map(m => m.text).join(' | ')} });
		ok('7. its traffic controller gives a pad (an S pad: the outpost has three)', cr.cl && cr.cl.pad >= 1 && cr.cl.pad <= 3 && cr.cl.port == sp.id && /cleared to land/.test(cr.said), cr);
		/* flying down: from 150 m over the pad, gear down, sinking at 20 m/s, then 3.5 m/s (under an S pad's 4), and 1.5 m/s for the last few metres until the gear touches */
		const land = await f.evaluate(async () => {
			const g = EmberDebug.game, s = EmberDebug.s, x = g.surfacePorts.find(y => y.q.colony), a = EmberDebug.surfacePortAt(x), pad = x.layout.pads.find(p => p.n == g.clearance.pad);
			const ex = a.rot.slice(0, 3), ny = a.rot.slice(3, 6), low = EmberLanding.lowest(EmberDebug.ship, true, 0).d;
			const over = h => a.pos.map((v, i) => v + ex[i] * pad.c[0] + ny[i] * pad.c[1] + a.up[i] * h);
			g.landed = null; g.gear = true; s.fa = true; s.p = over(low + 150); s.w = [0, 0, 0]; s.q = EmberScene.lookRotation(ex, a.up); g.throttle = 0;
			const sl = ms => new Promise(r => setTimeout(r, ms)), t0 = performance.now(); let minAlt = Infinity;
			/* each frame: the ship's place over the pad kept (the ground turns), sinking at 2 m/s */
			while (!g.landed && performance.now() - t0 < 120000) {
				const b = EmberDebug.surfacePortAt(x), up = b.up, gv = EmberFlight.frameAt(EmberScene.worldFrame(x.body), s.p).v, ox = b.rot.slice(0, 3), oy = b.rot.slice(3, 6);
				const want = b.pos.map((v, i) => v + ox[i] * pad.c[0] + oy[i] * pad.c[1]), rel = s.p.map((v, i) => v - want[i]), h = rel.reduce((t, v, i) => t + v * up[i], 0), side = rel.map((v, i) => v - up[i] * h);
				minAlt = Math.min(minAlt, h - low);
				s.fa = h - low > 40;   /* (flight assist off for the last 40 m: it would hold the hover) */
				s.v = gv.map((v, i) => v - up[i] * (h - low > 40 ? 20 : h - low > 6 ? 3.5 : 1.5) - side[i] * 0.5); s.q = EmberScene.lookRotation(ox, up); s.w = [0, 0, 0];
				await sl(16);
			}
			await sl(500);
			return {landed: !!g.landed, docked: g.docked, port: !document.getElementById('port').hidden, name: (document.querySelector('#port .pt-name b') || {}).textContent, secs: Math.round((performance.now() - t0) / 1000), minAlt, gear: g.gear, alt: g.lastAlt, said: g.msgs.slice(-3).map(m => m.text).join(' | ')} });
		await pg.screenshot({path: path.join(W, 'ground-docked.png')});
		ok('8. flown down onto its pad, the clamps lock: docked, and the outpost\'s screens open', land.landed && land.docked && land.port && land.name == sp.name, land);
		await f.click('[data-screen="market"]'); await sleep(200);
		const mk = await f.evaluate(() => ({top: document.querySelector('#port .pt-top').textContent, cur: (document.querySelector('#port .pt-top').textContent.match(/[A-Z]{3}\/SU/) || [''])[0]}));
		ok('9. its market trades in the sponsor\'s coin', mk.cur == at.code + '/SU', mk);
		/* the colonial office there: the colony, planning its growth into a settlement */
		await f.click('[data-screen="contacts"]'); await sleep(150); await f.click('#port [data-screen="colonies"]'); await sleep(200);
		await f.selectOption('#port select[data-pick="fac"][data-c="' + (await f.evaluate(() => window.__target.id)) + '"]', 'usettle'); await sleep(200);
		const gr = await f.evaluate(() => { const h = document.getElementById('port'), t = h.textContent, b = h.querySelector('[data-act="startbuild"]'); return {plans: [...h.querySelectorAll('.pt-cols svg.site-plan')].map(x => x.dataset.kind + ':' + x.querySelectorAll('.pad').length).join(' '), built: /Built/.test(t), grow: /the port, where it stands/.test(t), ok: b && !b.disabled, line: (h.querySelector('[data-act="startbuild"]').closest('section').querySelector('p.small:last-of-type') || {}).textContent} });
		await f.evaluate(() => { const x = document.querySelector('#port svg.site-plan'); x && x.scrollIntoView() }); await sleep(100);
		await pg.screenshot({path: path.join(W, 'office-site.png')});
		ok('10. its colonial office offers to grow it into a settlement, where it stands (a tier 2 point, 3,000 t), drawing the site as it is and as it would be', gr.built && gr.grow && gr.ok && gr.plans == 'outpost:3 settlement:5', gr);
		/* the save: reloaded, docked at the outpost on its world */
		await f.evaluate(() => { window.__saved = false; EmberDebug.game.saving = false; });
		await sleep(1500);
		await pg.reload(); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.star && EmberDebug.scene && EmberDebug.game.ports);
		await sleep(800);
		const rs = await f.evaluate(() => { const g = EmberDebug.game; return {star: g.star.id, docked: g.docked, port: g.portId, landed: !!g.landed, open: !document.getElementById('port').hidden, colony: (g.P.colonies || []).some(c => c.port == 'soutpost' && c.stage == 'done')} });
		ok('11. the save keeps it: reloaded, still docked on the outpost\'s pad, its screens open', rs.star == (await f.evaluate(() => EmberDebug.game.star.id)) && rs.docked && rs.port == sp.id && rs.landed && rs.open && rs.colony, rs);
		/* (step 3) grown into a surface starport (where the world has room: else as a settlement), the next arrival
		   finds the bigger port at the same site, with its landing field */
		const sg = await f.evaluate(async () => { window.__target = EmberDebug.game.star; const g = EmberDebug.game, c = g.P.colonies.find(x => x.id == window.__target.id), w = EmberColonies.worldOf(window.__target, c.world), big = EmberSurface.fits('starport', w);
			c.port = big ? 'sstarport' : 'ssettle'; g.docked = false; g.landed = null; g.dockPort = null; document.getElementById('port').hidden = true; EmberDebug.go(window.__target); g.npcs = [];
			await new Promise(r => setTimeout(r, 300));
			const q = g.ports.filter(x => x.colony), sp = g.surfacePorts.find(x => x.q.id.endsWith(':colony')), b = EmberDebug.scene.bodies.find(x => x.name == c.world);
			return {big, kinds: q.map(x => x.kind).join(' '), id: sp && sp.q.id, pads: sp && EmberSurface.layout(sp.q.kind, sp.q.seed).pads.length, flats: EmberTerrain.params(b).flats.length} });
		ok('11b. (step 3) grown, the next arrival finds the bigger port at the same site under the same id (a surface starport with its landing field where the world has room, its site levelled out wider)',
			sg.id == sp.id && (sg.big ? sg.kinds == 'starport field' && sg.pads == 12 && sg.flats >= 2 : sg.kinds == 'settlement' && sg.pads == 5), sg);
		ok('12. no errors on the way', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	finally { await br.close(); srv.kill() }
	console.log('screenshots: ' + W);
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
