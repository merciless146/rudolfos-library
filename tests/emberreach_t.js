/* Ember Reach (the Single-Player Alpha Build) in Chromium (Playwright), as the Rudolf OS desktop opens it: a sandboxed
   frame, saves kept by the desktop. A new game (choosing an origin), the starport, launching and flying, the star
   map, a jump, pausing, the save and resuming from it, the Rift's Maw, losing the ship (insurance), and no errors on the way.
     node tests/emberreach_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8231), TOP = path.join(__dirname, '..');
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
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&ship=corsair`);   /* (a new game in a Griffin: room for a phaser) */
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		const start = await f.evaluate(() => ({build: (document.querySelector('#ovBody .build') || {}).textContent, n: document.querySelectorAll('#ovBody button[data-i]').length, h: document.getElementById('ovT').textContent}));
		ok('1. a new game opens on choosing an origin, among the 12 great powers, marked as the single-player alpha', start.n == 12 && /Single-Player Alpha Build \d+\.\d+\.\d+/.test(start.build) && /origin/.test(start.h), start);
		await pg.screenshot({path: path.join(W, 'origin.png')});
		await f.click('#ovBody button[data-i="5"]');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('[data-screen="launch"]'));
		const dock = await f.evaluate(() => ({docked: EmberDebug.game.docked, star: EmberDebug.game.star.id, home: EmberDebug.game.home.star.id, screens: document.querySelectorAll('[data-screen]').length}));
		ok('2. it starts docked at that power\'s capital, in the starport (nine screens)', dock.docked && dock.star == dock.home && dock.screens >= 9, dock);
		for (const sc of ['station', 'market', 'bulletin', 'shipyard', 'outfitting', 'contacts', 'carto', 'status']) { await f.click('[data-screen="' + sc + '"]'); await sleep(120) }
		ok('3. every starport screen opens', errs.length == 0, errs);
		await pg.screenshot({path: path.join(W, 'port.png')});
		/* 0.3.7: this port's own market: what it sells from its stock, what it wants, and a purchase taken from the stock */
		await f.click('[data-screen="market"]'); await sleep(150);
		const mk0 = await f.evaluate(() => { const rows = [...document.querySelectorAll('#port [data-good]')], head = document.querySelector('#port .pt-thead').textContent, sub = document.querySelector('#port h1 + *, #port .pt-sub') ? document.body.innerText : ''; return {rows: rows.length, first: rows[0].dataset.good, cell: rows[0].children[3].textContent, head, econ: /economy · serves/.test(document.getElementById('port').innerText)} });
		await f.click('[data-good="' + mk0.first + '"]'); await sleep(100); await f.click('[data-act="buy"][data-n="1"]'); await sleep(150);
		const mk1 = await f.evaluate(g => document.querySelector('#port [data-good="' + g + '"]').children[3].textContent, mk0.first);
		await pg.screenshot({path: path.join(W, 'market.png')});
		ok('3a. the market lists what this port sells first, with its stock and what it wants; buying takes from the stock', mk0.rows > 10 && /Stock \/ demand/.test(mk0.head) && mk0.econ && /^\d+ t$/.test(mk0.cell) && parseInt(mk1) == parseInt(mk0.cell) - 1, {mk0, mk1});
		/* 0.3.8: buy a ship and keep yours here in storage, then fly the stored one again */
		await f.evaluate(() => { const g = EmberDebug.game; g.P.wallet[EmberFactions.byId(g.P.origin).currency.code] = 1e9 });
		await f.click('[data-screen="shipyard"]'); await sleep(150);
		const sy0 = await f.evaluate(() => { const rows = [...document.querySelectorAll('#port [data-ship]')], cur = EmberDebug.game.P.ship.model, pick = rows.find(r => r.dataset.ship != cur && r.dataset.ship != 'gnat'); return {rows: rows.length, pick: pick && pick.dataset.ship, model: cur, store: !!document.querySelector('[data-act="buystore"]')} });
		await f.click('[data-ship="' + sy0.pick + '"]'); await sleep(100); await f.click('[data-act="buystore"]'); await sleep(600);
		f = await frame(pg, () => !!document.querySelector('[data-act="hgswap"]'));
		const sy1 = await f.evaluate(() => ({model: EmberDebug.game.P.ship.model, kept: (EmberDebug.game.P.hangar || []).map(h => h.ship.model), swap: !!document.querySelector('[data-act="hgswap"]')}));
		await pg.screenshot({path: path.join(W, 'shipyard.png')});
		await f.click('[data-act="hgswap"]'); await sleep(600);
		f = await frame(pg, () => !!document.querySelector('#port [data-screen]'));
		const sy2 = await f.evaluate(() => ({model: EmberDebug.game.P.ship.model, kept: (EmberDebug.game.P.hangar || []).map(h => h.ship.model), shipName: EmberDebug.ship.name}));
		ok('3b. the shipyard sells a ship and keeps yours here in storage; taking yours out stores the new one in its place', sy0.rows > 5 && sy0.store && sy1.model == sy0.pick && sy1.kept.join() == sy0.model && sy1.swap && sy2.model == sy0.model && sy2.kept.join() == sy0.pick, {sy0, sy1, sy2});
		await f.click('[data-screen="launch"]'); await sleep(200); await f.click('[data-act="launch"]'); await sleep(1500);
		const fly = await f.evaluate(() => ({docked: EmberDebug.game.docked, v: Math.hypot(...EmberDebug.s.v)}));
		await f.focus('#hud'); await pg.keyboard.down('KeyW'); await sleep(1500); await pg.keyboard.up('KeyW');
		const fly2 = await f.evaluate(() => ({v: Math.hypot(...EmberDebug.s.v), thr: EmberDebug.game.throttle}));
		ok('4. it launches, and the throttle flies the ship', !fly.docked && (fly2.v > fly.v || fly2.thr > 0), [fly, fly2]);
		await pg.screenshot({path: path.join(W, 'flight.png')});
		const saved = await pg.evaluate(() => SAVES['ember-reach']);
		ok('5. the desktop keeps the save (launching saves)', saved && saved.v == 4 && saved.player && saved.docked === false, saved && Object.keys(saved));
		const sp = await f.evaluate(() => { const g = EmberDebug.game, q = (g.ports || []).filter(x => x.surface), b = q.length && EmberDebug.scene.bodies.find(x => x.name == q[0].world); return {n: q.length, want: EmberSurface.ports(g.star, g.port && g.port.cls).length, star: g.star.name, kinds: q.map(x => x.kind), ids: q.every(x => EmberTravel.PORT_ID.test(x.id)), flats: b ? EmberTerrain.params(b).flats.length : 0, orbital: !!g.port && g.port.id == 'orbital'} });
		ok('5b. L2.2: the home system lists its surface ports (if its worlds can take any) after its space port, and their sites are levelled into their worlds', sp.n == sp.want && sp.ids && (sp.n == 0 || sp.flats >= 1) && sp.orbital, sp);
		await pg.keyboard.press('KeyG'); await sleep(1200); const mapOn = await f.evaluate(() => EmberDebug.game.mapOpen); await pg.screenshot({path: path.join(W, 'map.png')}); await pg.keyboard.press('KeyG'); await sleep(300); const mapOff = await f.evaluate(() => !EmberDebug.game.mapOpen);
		ok('6. the star map opens and closes (G)', mapOn && mapOff && errs.length == 0, {mapOn, mapOff, errs});
		/* a jump: straight to a near star with worlds (the debug hook skips the drive's charge) */
		const before = await f.evaluate(() => EmberDebug.scene.bodies.map(b => b.name));
		const to = await f.evaluate(() => { const g = EmberDebug.game, h = g.star, s = EmberGalaxy.starsNear(h.x, h.y, h.z, 6).find(x => x.id != h.id && x.kind == 'star' && EmberGalaxy.system(x).planets.length); EmberDebug.go(s); return s.id });
		await sleep(1500);
		ok('7. a jump to another star builds its system', await f.evaluate(id => EmberDebug.game.star.id == id && EmberDebug.scene.bodies.length > 1, to));
		const left = await f.evaluate(old => { const now = new Set(EmberDebug.scene.bodies.map(b => b.name)); return EmberDebug.meshIds().filter(id => old.includes(id.split(':')[0]) && !now.has(id.split(':')[0])) }, before);
		ok('7b. ...and lets the last system\'s meshes go (0.1.1 kept every system\'s, about 10 MB a jump)', before.length > 0 && left.length == 0, {before, left});
		/* 0.4.3: a new pilot's first ship has its guns gimballed */
		const first = await f.evaluate(() => ({ext: (EmberDebug.game.P.ship.fit.external || []).filter(Boolean).map(m => m.id), mounts: EmberDebug.game.pcs.load.guns.map(g => g.mount), autopilot: !!EmberDebug.ship.autopilot}));
		ok('7a. 0.4.3: a new pilot\'s first ship carries the gimballed version of every gun that has one, and (0.4.4) an Autopilot Computer', first.autopilot && first.ext.some(id => /G$/.test(id)) && !first.ext.some(id => ['pulse', 'heavy', 'needle', 'gatling', 'gatlingM', 'gatlingL'].includes(id)), first);
		await pg.evaluate(() => send({op: 'pause'})); await sleep(400);
		const paused = await f.evaluate(() => ({ov: !document.getElementById('ov').hidden, h: document.getElementById('ovT').textContent, build: (document.querySelector('#ovBody .build') || {}).textContent}));
		ok('8. the desktop\'s pause pauses it (the alpha build named on the pause screen)', paused.ov && /Paused/.test(paused.h) && /Alpha/.test(paused.build), paused);
		/* Settings, from the pause screen: Spanish, then back to English; a rebinding */
		await f.click('#ovBtns button:nth-child(2)'); await sleep(300);
		await f.click('button[data-tab="2"]'); await f.selectOption('select[data-set="lang"]', 'es'); await sleep(200);
		const es = await f.evaluate(() => document.getElementById('ovT').textContent);
		await f.click('button[data-tab="1"]'); const simpleRows = await f.evaluate(() => ({flare: !!document.querySelector('button[data-bind="flare"]'), radial: !!document.querySelector('button[data-bind="radial"]')}));
		await f.selectOption('select[data-set="controls.scheme"]', 'full'); await sleep(200);   /* (a new pilot starts on Simple: Full lists every key) */
		await f.click('button[data-bind="flare"][data-slot="1"]'); await pg.keyboard.press('KeyL'); await sleep(200);
		const bound = await f.evaluate(() => ({flare: RG.bindings().flare, gear: RG.bindings().gear}));
		await f.click('button[data-tab="2"]'); await f.selectOption('select[data-set="lang"]', 'en'); await sleep(200);
		await f.click('#ovBtns button.primary'); await sleep(300);
		/* (the save is written a moment after the screen closes: wait for it, up to 5 s, as a slower runner needs) */
		let kept = null; for (let w = 0; w < 25 && !(kept && kept.includes('KeyL')); w++) { kept = await pg.evaluate(() => SAVES['ember-reach'] && SAVES['ember-reach'].settings && SAVES['ember-reach'].settings.controls.keys.flare); if (!(kept && kept.includes('KeyL'))) await sleep(200) }
		ok('9. Settings (from the pause screen): the language changes the menus; Simple lists the core keys only, Full every one; a key rebinds (taken from the landing gear), and the save keeps it', es == 'Ajustes' && !simpleRows.flare && simpleRows.radial && bound.flare.includes('KeyL') && !bound.gear.includes('KeyL') && kept && kept.includes('KeyL'), {es, bound, kept, simpleRows});
		/* Follow Rudolf OS: the language Rudolf OS shares (in its settings messages), else the browser's */
		await f.click('#ovBtns button:nth-child(2)'); await sleep(300); await f.click('button[data-tab="2"]');
		const opt0 = await f.evaluate(() => document.querySelector('select[data-set="lang"] option[value="os"]').textContent);
		await f.selectOption('select[data-set="lang"]', 'os'); await sleep(200);
		await pg.evaluate(() => send({op: 'settings', dark: true, reduceFlash: false, lang: 'fr', locale: 'fr-FR'})); await sleep(300);
		const fr1 = await f.evaluate(() => ({lang: EmberI18n.lang(), rg: RG.lang, loc: RG.locale, t: EmberI18n.T('Settings')}));
		await pg.evaluate(() => send({op: 'settings', dark: true, reduceFlash: false})); await sleep(300);
		const en1 = await f.evaluate(() => ({lang: EmberI18n.lang(), rg: RG.lang}));
		await f.click('#ovBtns button.primary'); await sleep(300);
		const osKept = await pg.evaluate(() => SAVES['ember-reach'].settings.lang);
		ok('9b. "Follow Rudolf OS" takes the language Rudolf OS shares, and the browser\'s once it stops sharing; the save keeps the choice',
			/Follow Rudolf OS · English/.test(opt0) && fr1.lang == 'fr' && fr1.rg == 'fr' && fr1.loc == 'fr-FR' && fr1.t == 'Paramètres' && en1.lang == 'en' && en1.rg === null && osKept == 'os', {opt0, fr1, en1, osKept});
		await pg.evaluate(() => send({op: 'resume'})); await f.click('#ovBtns button.primary').catch(() => {}); await sleep(1200);
		/* the Interstellar Marshals: wanted, they come; their tractor beam holds you out of hyperspace and slows you */
		await f.evaluate(() => { const g = EmberDebug.game; g.npcs = []; g.P.bounties[g.home.currency.code] = 1e9; g.marshalsAt = g.t }); await sleep(1500);
		const mz = await f.evaluate(() => { const g = EmberDebug.game, m = g.npcs.filter(n => n.role == 'marshal'); return {n: m.length, said: g.msgs.some(x => /Interstellar Marshals/.test(x.text)), hostile: m.every(n => EmberEncounters.hostile(g.P, n))} });
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, m = g.npcs.find(n => n.role == 'marshal'); m.s.p = s.p.map((v, i) => v + (i == 0 ? 1500 : 0)); m.s.v = [0, 0, 0] }); await sleep(800);
		await f.focus('#hud'); await pg.keyboard.press('KeyJ'); await sleep(300);
		await f.evaluate(() => { const s = EmberDebug.s; s.v = [0, 0, s.spec.vmax] }); await sleep(300);
		const held = await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s; return {held: !!(g.held && g.t < g.held.until), jump: !!g.jump, v: Math.hypot(...s.v), vmax: s.spec.vmax, said: g.msgs.slice(-6).some(x => /tractor beam/i.test(x.text))} });
		ok('9c. wanted, the Interstellar Marshals arrive; within 3 km their tractor beam holds you: no hyperspace, a quarter of your speed', mz.n >= 2 && mz.said && mz.hostile && held.held && !held.jump && held.v <= held.vmax * 0.26 && held.said, {mz, held});
		await f.evaluate(() => { const g = EmberDebug.game; g.npcs = []; g.P.bounties = {}; g.held = null; g.marshalsAt = null; g.shots = [] });
		/* landing L1.1: below a world's Kármán line the HUD reads the surface, and a hover holds its spot over the turning ground */
		const wld = await f.evaluate(() => { const sc = EmberDebug.scene, b = sc.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0]; if (!b) return null; const H = Math.min(2000, 0.8 * b.karman); EmberDebug.near(b, 1 + H / b.radius); const g = EmberDebug.game; g.cruise = {on: false, v: 0, charge: 0}; g.throttle = 0; const s = EmberDebug.s, F = EmberScene.worldFrame(b); s.v = EmberFlight.frameAt(F, s.p).v; s.fa = true; return {name: b.name, H} });
		await sleep(3000);
		const sfc = await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberScene.surfaceState(EmberDebug.scene, s, g.t, EmberDebug.ship); return st && {alt: st.alt, hill: EmberScene.groundAt(EmberDebug.scene, st.body, s.p, g.t).h, vh: st.vh, vz: st.vz, world: st.world, land: EmberLanding.card(EmberDebug.ship, st.body.src).line} });
		await pg.screenshot({path: path.join(W, 'surface.png')});
		ok('9d. 2 km over a world (or under its Kármán line, if that\'s lower) (over its terrain\'s hills and craters), the surface readout holds: the hover keeps its height and its spot as the world turns', wld && sfc && Math.abs(sfc.alt + sfc.hill - wld.H) < 60 && sfc.vh < 3 && Math.abs(sfc.vz) < 3, {wld, sfc});
		/* terrain L1.3: from where tiles start (200 km, or 0.3 radii on a small world) down to 1 km, the tiles stand in for the sphere, finer the lower, within budget */
		const terr = [];
		for (const km of ['top', 10, 1]) {
			await f.evaluate(km => { const sc = EmberDebug.scene, b = sc.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0]; const s = EmberDebug.s, u = s.p.map((v, i) => v - b.pos[i]), n = Math.hypot(...u);
				s.p = b.pos.map((v, i) => v + u[i] / n * (b.radius + (km == 'top' ? 0.9 * EmberTerrain.nearOf(b) : km * 1000))); s.v = EmberFlight.frameAt(EmberScene.worldFrame(b), s.p).v; s.q = EmberScene.lookRotation(u.map(v => -v / n), [0, 0, 1]); EmberDebug.game.gear = false }, km);
			await sleep(km == 'top' ? 6000 : 4000);
			terr.push(await f.evaluate(() => Object.assign({}, EmberDebug.game.lod.terrain, {fps: EmberDebug.game.fps})));
		}
		await pg.screenshot({path: path.join(W, 'terrain.png')});
		ok('9g. terrain: drawn as tiles from 200 km down (0.3 radii on a small world), under 60,000 triangles, finer the lower', terr.every(t => t.tiles > 0 && t.tris <= 60000) && terr[2].deepest > terr[0].deepest, terr);
		/* spotlights and night vision, on the night side 150 m up */
		await f.evaluate(() => { const sc = EmberDebug.scene, b = sc.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0], sun = sc.bodies[0], g = EmberDebug.game, s = EmberDebug.s;
			const away = b.pos.map((v, i) => v - sun.pos[i]), n = Math.hypot(...away), U = away.map(v => v / n), h = EmberScene.groundAt(sc, b, b.pos.map((v, i) => v + U[i] * b.radius), g.t).h;
			s.p = b.pos.map((v, i) => v + U[i] * (b.radius + h + 150)); s.v = EmberFlight.frameAt(EmberScene.worldFrame(b), s.p).v; g.gear = false; g.lights = false; g.nv = false;
			const side = [-U[1], U[0], 0], sl = Math.hypot(...side), fwd = U.map((v, i) => -v * 0.6 + side[i] / sl * 0.4), fl = Math.hypot(...fwd); s.q = EmberScene.lookRotation(fwd.map(v => v / fl), [0, 0, 1]) });
		await sleep(3000); await pg.screenshot({path: path.join(W, 'night.png')});
		await f.focus('#hud'); await pg.keyboard.press('Digit1'); await sleep(1500); await pg.screenshot({path: path.join(W, 'night-lights.png')});
		const li = await f.evaluate(() => EmberDebug.game.lights);
		await pg.keyboard.press('Digit1'); await pg.keyboard.press('Digit2'); await sleep(1500); await pg.screenshot({path: path.join(W, 'night-vision.png')});
		const nv = await f.evaluate(() => ({nv: EmberDebug.game.nv, k: EmberDebug.game.nvK, lights: EmberDebug.game.lights}));
		await pg.keyboard.press('Digit2'); await sleep(600);
		const off = await f.evaluate(() => ({nv: EmberDebug.game.nv, k: EmberDebug.game.nvK}));
		ok('9h. 1 turns the forward spotlights on and off; 2, separately, night vision', li === true && nv.nv === true && nv.k > 0.9 && nv.lights === false && off.nv === false && off.k < 0.1, {li, nv, off});
		/* performance: antialiasing off on a software renderer (Auto); automatic resolution steps down under 28 fps */
		const pf = await f.evaluate(() => ({sw: EmberDebug.renderer.software, aa: EmberDebug.renderer.antialias, renderer: EmberDebug.renderer.renderer}));
		ok('9m. on this software renderer, Auto leaves antialiasing off', pf.sw && pf.aa === false, pf);
		/* control schemes: M switches Combat and Analysis; the radial menu on ~; Simple keeps FA on; the landing assist */
		await f.evaluate(() => { const g = EmberDebug.game; g.npcs = []; g.shots = []; g.mode = 'combat'; g.gear = false; g.lights = false; g.nv = false });
		await f.focus('#hud'); await pg.keyboard.press('KeyM'); await sleep(200);
		await pg.keyboard.down('Semicolon'); await sleep(500); await pg.keyboard.up('Semicolon');
		const an = await f.evaluate(() => ({mode: EmberDebug.game.mode, shots: EmberDebug.game.shots.filter(x => x.owner == 'me' && x.kind != 'mining').length}));
		await pg.keyboard.press('KeyM'); await sleep(200);
		await f.evaluate(() => { window.__fired = 0; const g = EmberDebug.game; window.__fw = setInterval(() => { window.__fired += g.shots.filter(x => x.owner == 'me').length + g.beams.length }, 30) });
		await pg.keyboard.down('Semicolon'); await sleep(500); await pg.keyboard.up('Semicolon');
		const cb = await f.evaluate(() => { clearInterval(window.__fw); return {mode: EmberDebug.game.mode, shots: window.__fired} });
		ok('9i. M switches Combat and Analysis mode: in Analysis the weapons are safe, in Combat they fire', an.mode == 'analysis' && an.shots == 0 && cb.mode == 'combat' && cb.shots > 0, {an, cb});
		await pg.keyboard.down('Backquote'); await sleep(250); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await sleep(250);
		const rOpen = await f.evaluate(() => ({open: !!EmberDebug.game.radial, sel: EmberDebug.game.radial && EmberDebug.game.radial.sel}));
		await pg.screenshot({path: path.join(W, 'radial.png')});
		await pg.keyboard.up('Backquote'); await sleep(300);
		const rDone = await f.evaluate(() => ({open: !!EmberDebug.game.radial, lights: EmberDebug.game.lights}));
		ok('9j. holding ~ opens the radial menu; ← → step round it (steering waits); letting go switches the one picked (the spotlights, third)', rOpen.open && rOpen.sel == 2 && !rDone.open && rDone.lights === true, {rOpen, rDone});
		await f.evaluate(() => { const g = EmberDebug.game; g.settings.controls.scheme = 'simple'; EmberDebug.s.fa = true; g.lights = false }); await pg.keyboard.press('KeyZ'); await sleep(200);
		const faHeld = await f.evaluate(() => EmberDebug.s.fa);
		await f.evaluate(() => { EmberDebug.game.settings.controls.scheme = 'full' }); await pg.keyboard.press('KeyZ'); await sleep(200);
		const faFull = await f.evaluate(() => EmberDebug.s.fa); await pg.keyboard.press('KeyZ'); await sleep(100);
		ok('9k. Simple keeps flight assist on; Full lets it go', faHeld === true && faFull === false, {faHeld, faFull});
		const la = await f.evaluate(async () => { const sc = EmberDebug.scene, b = sc.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0], g = EmberDebug.game, s = EmberDebug.s;
			g.settings.controls.landAssist = true; const u0 = s.p.map((v, i) => v - b.pos[i]), n = Math.hypot(...u0), u = u0.map(v => v / n), h = EmberScene.groundAt(sc, b, b.pos.map((v, i) => v + u[i] * b.radius), g.t).h;
			s.p = b.pos.map((v, i) => v + u[i] * (b.radius + h + 120)); const gv = EmberFlight.frameAt(EmberScene.worldFrame(b), s.p).v; s.v = gv.map((v, i) => v - u[i] * 40); s.fa = true; g.gear = true; g.throttle = 0; g.landed = null; g.lastAlt = null;
			await new Promise(r => setTimeout(r, 400)); const st = EmberScene.surfaceState(sc, s, g.t, EmberDebug.ship); return {vz: st.vz, alt: st.alt, max: Math.max(EmberLanding.TOUCH[EmberLanding.padFor(EmberDebug.ship.size)].vz * 0.75, st.alt * 0.1)} });
		ok('9l. the landing assist holds a 40 m/s plunge at 120 m to a safe descent', la.vz >= -la.max - 0.5, la);
		await f.evaluate(() => { const g = EmberDebug.game; g.gear = false; g.lights = false; g.landed = null });
		/* landing L1.2: set down on the gear, sit there as the world turns, lift off; then come down far too fast */
		const setDown = (h, vz) => f.evaluate(([h, vz]) => { const g = EmberDebug.game, sc = EmberDebug.scene, b = sc.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0]; if (!b) return null;
			const sh = EmberDebug.ship, low = EmberLanding.lowest(sh, true, 0), s = EmberDebug.s, up = s.p.map((v, i) => v - b.pos[i]), n = Math.hypot(...up), u = up.map(v => v / n);
			const gh = EmberScene.groundAt(sc, b, b.pos.map((v, i) => v + u[i] * b.radius), g.t).h;   /* (the terrain's own height there) */
			s.p = b.pos.map((v, i) => v + u[i] * (b.radius + gh + low.d + h)); const side = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], fw = [u[1] * side[2] - u[2] * side[1], u[2] * side[0] - u[0] * side[2], u[0] * side[1] - u[1] * side[0]];
			s.q = EmberScene.lookRotation(fw, u); const gv = EmberFlight.frameAt(EmberScene.worldFrame(b), s.p).v; s.v = gv.map((v, i) => v + u[i] * vz); s.w = [0, 0, 0]; s.fa = false;
			g.gear = true; g.throttle = 0; g.landed = null; g.lastAlt = null; g.cruise = {on: false, v: 0, charge: 0}; g.npcs = []; return b.name }, [h, vz]);
		const lw = await setDown(0.6, -1.5); await sleep(1500);
		const ld = await f.evaluate(() => { const g = EmberDebug.game; return {landed: g.landed && g.landed.world, said: g.msgs.slice(-4).some(m => /^Landed on/.test(m.text)), p: EmberDebug.s.p.slice()} });
		await sleep(2000);
		const ld2 = await f.evaluate(p0 => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberScene.surfaceState(EmberDebug.scene, s, g.t, EmberDebug.ship); return {still: !!g.landed, moved: Math.hypot(...s.p.map((v, i) => v - p0[i])), vz: st.vz, vh: st.vh} }, ld.p);
		await f.focus('#hud'); await pg.keyboard.down('Space'); await sleep(1200); await pg.keyboard.up('Space');
		const up1 = await f.evaluate(() => { const g = EmberDebug.game, st = EmberScene.surfaceState(EmberDebug.scene, EmberDebug.s, g.t, EmberDebug.ship); return {landed: !!g.landed, alt: st && st.alt, said: g.msgs.some(m => /Lifting off/.test(m.text))} });
		ok('9e. on the gear, a ship sets down, sits fixed to the ground as the world turns, and lifts off on vertical thrust', lw && ld.landed == lw && ld.said && ld2.still && ld2.moved > 0 && Math.abs(ld2.vz) < 0.01 && ld2.vh < 0.01 && !up1.landed && up1.said && up1.alt > 1, {lw, ld, ld2, up1});
		/* L1.4: landed, the ground scan marks deposits; first landings are recorded */
		await setDown(0.6, -1.0); await sleep(8000);
		const gs = await f.evaluate(() => { const g = EmberDebug.game; return {landed: !!g.landed, scanned: g.msgs.some(m => /^Ground scan/.test(m.text)), deps: (g.deposits || []).length, record: Object.keys((g.P.explore && g.P.explore.land) || {}).length} });
		ok('9n. landed, the ground scan runs by itself (6 s) and marks a handful of deposits within 5 km; the landing is in the record', gs.landed && gs.deps > 0 && gs.deps < 20 && gs.record >= 1, gs);
		/* cruise toward a targeted world you can land on drops out at its line, or 4.2 km up */
		await f.evaluate(() => { const g = EmberDebug.game, sc = EmberDebug.scene, b = sc.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0], s = EmberDebug.s;
			g.landed = null; const u = s.p.map((v, i) => v - b.pos[i]), n = Math.hypot(...u), U = u.map(v => v / n); s.p = b.pos.map((v, i) => v + U[i] * (b.radius + 3e5)); s.v = [0, 0, 0];
			s.q = EmberScene.lookRotation(U.map(v => -v), Math.abs(U[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); g.nav = b; g.gear = false; g.cruise = {on: true, v: 3000, charge: 0}; g.throttle = 1 });
		let cd = null; for (let i = 0; i < 60 && !cd; i++) { await sleep(500); cd = await f.evaluate(() => { const g = EmberDebug.game; if (g.cruise.on) return null; const st = EmberScene.surfaceState(EmberDebug.scene, EmberDebug.s, g.t, EmberDebug.ship); const b = EmberDebug.scene.bodies.filter(x => x.kind == 'planet' && EmberScene.landableTarget(x)).sort((p, q) => q.karman - p.karman)[0]; return {alt: EmberScene.groundAt(EmberDebug.scene, b, EmberDebug.s.p, g.t).alt, drop: EmberScene.dropRange(b), said: g.msgs.slice(-3).map(m => m.text)} }) }
		ok('9o. cruising at a targeted world you can land on drops you out above it, at its line or 4.2 km up', cd && cd.alt > 0.4 * cd.drop && cd.alt < 1.2 * cd.drop, cd);
		/* L1.5: touch has a GEAR button and a VERT slider (vertical thrust, back to the middle when let go); help has the landing controls */
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s; g.cruise = {on: false, v: 0, charge: 0}; g.throttle = 0; g.gear = false; g.landed = null; s.v = g.well ? EmberFlight.frameAt(EmberScene.worldFrame(g.well.body), s.p).v : [0, 0, 0] });
		const tp = await f.evaluate(async () => {
			const hud = document.getElementById('hud'), u = EmberDebug.touchLayout(), g = EmberDebug.game, ev = (type, x, y, id) => { const c = EmberDebug.toClient(x, y); hud.dispatchEvent(new PointerEvent(type, {pointerType: 'touch', pointerId: id, clientX: c.x, clientY: c.y, bubbles: true})) };
			const gb = u.buttons.find(b => b.act == 'gear'); if (!gb) return {gearButton: false};
			ev('pointerdown', gb.x + gb.w / 2, gb.y + gb.h / 2, 7); ev('pointerup', gb.x + gb.w / 2, gb.y + gb.h / 2, 7); const gear = g.gear;
			ev('pointerdown', u.vert.x + u.vert.w / 2, u.vert.y + 4, 8); const vUp = g.touch.vert; await new Promise(r => setTimeout(r, 1200));
			const s = EmberDebug.s, up = EmberFlight.toWorld(s.q, [0, 1, 0]), n = 1, rel = EmberFlight.relative(s, g.well ? EmberScene.worldFrame(g.well.body) : null).v, vz = rel.reduce((t, v, i) => t + v * up[i] / n, 0);
			ev('pointerup', u.vert.x + u.vert.w / 2, u.vert.y + 4, 8);
			return {gearButton: true, gear, vUp, vz, vAfter: g.touch.vert};
		});
		await pg.keyboard.press('KeyH'); await sleep(400);
		const hp = await f.evaluate(() => { const t = document.getElementById('ovBody').textContent; return {landing: /Landing: target a world/.test(t), touch: /VERT slider/.test(t), pad: /held half a second/.test(t), gearKey: /Landing gear/.test(t)} });
		await pg.keyboard.press('Escape'); await sleep(300); await f.evaluate(() => { const o = document.getElementById('ov'); if (!o.hidden) { const b = document.querySelector('#ovBtns button.primary'); b && b.click() } });
		ok('9p. touch: GEAR lowers the gear, the VERT slider fires the vertical thrusters (the ship moves along its own up) and springs back; help (H) has the landing, touch and gamepad controls', tp.gearButton && tp.gear && tp.vUp > 0.9 && tp.vz > 3 && tp.vAfter == 0 && hp.landing && hp.touch && hp.pad && hp.gearKey, {tp, hp});
		await f.evaluate(() => { EmberDebug.game.gear = false });
		/* the weapons rework (0.3.1): a gimballed gatling tracks a pirate inside its circle; the mass driver charges while
		   the trigger is held and fires when it's let go; lasers draw beams */
		await f.evaluate(async () => {
			const g = EmberDebug.game, s = EmberDebug.s, F = EmberFlight, sl = ms => new Promise(r => setTimeout(r, ms));
			g.landed = null; g.gear = false; g.mode = 'combat'; g.npcs = []; g.shots = [];
			g.pcs.hot = false; g.pcs.heat = 0;
			g.pcs.load.guns = [{kind: 'gatling', mount: 'gimbal', cool: 0, ammo: 1500}, {kind: 'driver', mount: 'fixed', cool: 0, ammo: 150}, {kind: 'pulse', mount: 'fixed', cool: 0, ammo: null}];
			EmberDebug.pirates(1); const n = g.npcs[g.npcs.length - 1], fw = F.forward(s), up = F.toWorld(s.q, [0, 1, 0]), k = Math.PI / 180 * 8;
			const place = () => { n.s.p = s.p.map((v, i) => v + (fw[i] * Math.cos(k) + up[i] * Math.sin(k)) * 1200); n.s.v = s.v.slice() };
			place(); g.tgt = n; await sl(300); place();
			const hd = g.hudData, out = {circle: hd.gimbal && hd.gimbal.r, track: !!(hd.target && hd.target.track), leads: hd.target && hd.target.leads ? hd.target.leads.length : -1};
			let charge = 0, beams = 0; (RG.mouse(0, true), RG.mouse(2, true));
			for (let i = 0; i < 8; i++) { await sl(60); place(); charge = Math.max(charge, (g.hudData.gimbal || {}).charge || 0); beams = Math.max(beams, g.beams.length) }
			window.__wp = {out, charge, beams}; return null });
		await pg.screenshot({path: path.join(W, 'weapons.png')});
		const wp = await f.evaluate(async () => { const g = EmberDebug.game, sl = ms => new Promise(r => setTimeout(r, ms)), {out, charge, beams} = window.__wp;
			out.ammoHeld = g.pcs.load.guns[1].ammo; (RG.mouse(0, false), RG.mouse(2, false)); await sl(150);
			out.ammoAfter = g.pcs.load.guns[1].ammo; out.charge = charge; out.beams = beams; out.gatling = g.pcs.load.guns[0].ammo < 1500;
			g.npcs = []; g.shots = []; (RG.mouse(0, false), RG.mouse(2, false)); return out;
		});
		ok('9q. weapons: the gimballed gatling\'s circle shows and tracks a pirate 8° off the nose; the fixed mass driver has its point of aim, charges while the trigger is held and fires on letting go; lasers draw beams', wp.circle > 50 && wp.track && wp.leads == 1 && wp.charge > 0.3 && wp.ammoHeld == 150 && wp.ammoAfter == 149 && wp.beams > 0 && wp.gatling, wp);
		/* 0.3.4: the mouse buttons as bindings: the left fires the primary guns (lasers), the right the secondary (gatlings);
		   the wheel is a binding too */
		const mb = await f.evaluate(async () => {
			const g = EmberDebug.game, hud = document.getElementById('hud'), sl = ms => new Promise(r => setTimeout(r, ms)), kinds = () => g.shots.map(x => x.kind).concat(g.beams.map(b => b.kind));
			g.mode = 'combat'; g.npcs = []; g.shots = []; g.beams = []; g.pcs.hot = false; g.pcs.heat = 0;
			g.pcs.load.guns = [{kind: 'pulse', mount: 'fixed', cool: 0, ammo: null}, {kind: 'gatling', mount: 'fixed', cool: 0, ammo: 1500}];
			const click = async b => { g.shots = []; g.beams = []; hud.dispatchEvent(new MouseEvent('mousedown', {button: b, bubbles: true})); const seen = new Set(); for (let i = 0; i < 15; i++) { await sl(20); kinds().forEach(k => seen.add(k)) } const k = [...seen]; dispatchEvent(new MouseEvent('mouseup', {button: b, bubbles: true})); await sl(100); return k };
			const left = await click(0), right = await click(2), middle = await click(1);
			const menu = !hud.dispatchEvent(new MouseEvent('contextmenu', {button: 2, bubbles: true, cancelable: true}));
			RG.rebind('dbgRoute', 'wheel:up'); RG.wheel(-120); const wheel = RG.pressed('dbgRoute') && RG.down('dbgRoute'); RG.frame(); const after = RG.down('dbgRoute');
			return {left, right, middle, menu, wheel, after, binds: {fire: RG.bindings().fire, fire2: RG.bindings().fire2}} });
		ok('9t. 0.3.4: the left mouse button fires the lasers, the right the gatling, the middle nothing (unbound); no right-click menu; the wheel works as a binding for one update', mb.left.join() == 'pulse' && mb.right.join() == 'gatling' && mb.middle.length == 0 && mb.menu && mb.wheel && !mb.after && mb.binds.fire.includes('mouse:0') && mb.binds.fire2.includes('mouse:2'), mb);
		await setDown(2, -60); await sleep(1500);
		const cr = await f.evaluate(() => { const g = EmberDebug.game; return {lost: g.msgs.some(m => /Ship destroyed: a crash on/.test(m.text)), landed: !!g.landed} });
		ok('9f. coming down at 60 m/s is a crash: the ship is lost and the insurer takes over', cr.lost && !cr.landed, cr);
		await f.evaluate(() => { const g = EmberDebug.game; g.npcs = []; g.gear = false });
		/* the Maw and the Rift */
		/* L2.2: a capital with a surface starport: its ports, and its site levelled */
		const cp = await f.evaluate(async () => { const m = EmberFactions.majors()[0]; EmberDebug.go(m.star); EmberDebug.game.npcs = []; await new Promise(r => setTimeout(r, 300)); const g = EmberDebug.game, q = g.ports.filter(x => x.surface), spt = q.find(x => x.kind == 'starport'), b = spt && EmberDebug.scene.bodies.find(x => x.name == spt.world);
			return {star: g.star.name, kinds: q.map(x => x.kind), flats: b ? EmberTerrain.params(b).flats.length : 0, owner: q.every(x => x.owner == g.port.owner)} });
		ok('9r. L2.2: at the first capital, a surface starport and its landing field among its surface ports, held by the capital\'s power, the starport\'s site levelled', cp.kinds.includes('starport') && cp.kinds.includes('field') && cp.flats >= 1 && cp.owner, cp);
		/* L2.3: the starport's model on its levelled ground: 1.5 km above it, looking down at it; then 100 km off, not drawn */
		const pv = await f.evaluate(async () => {
			const g = EmberDebug.game, s = EmberDebug.s, sp = g.surfacePorts.find(x => x.q.kind == 'starport'), at = EmberDebug.surfacePortAt(sp), up = at.up, east = at.rot.slice(0, 3);
			const sl = ms => new Promise(r => setTimeout(r, ms)), place = h => { s.p = at.pos.map((v, i) => v + up[i] * h - east[i] * h * 0.8); s.v = EmberFlight.frameAt(EmberScene.worldFrame(sp.body), s.p).v; s.q = EmberScene.lookRotation(at.pos.map((v, i) => v - s.p[i]).map((v, _, a) => v / Math.hypot(...a)), up) };
			g.landed = null; g.gear = false; g.npcs = []; g.chase = false; g.settings.hud.lead = false;
			place(1500); await sl(2500); place(1500); await sl(600);
			const near = g.lod.ports, Ly = sp.layout, R = sp.body.radius, d = sp.dir, e0 = [-d[1], d[0], 0], el = Math.hypot(...e0), e = e0.map(x => x / el), n = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]];
			const padH = Ly.pads.map(p => { const v = d.map((x, i) => x * R + e[i] * p.c[0] + n[i] * p.c[1]), l = Math.hypot(...v); return EmberTerrain.height(sp.body, v.map(x => x / l)) - sp.h });
			window.__pv = {near, pads: Ly.pads.length, level: Math.max(...padH.map(Math.abs))};
			return null });
		await pg.screenshot({path: path.join(W, 'surface-port.png')});
		const pv2 = await f.evaluate(async () => { const g = EmberDebug.game, s = EmberDebug.s, sp = g.surfacePorts.find(x => x.q.kind == 'starport'), at = EmberDebug.surfacePortAt(sp); s.p = at.pos.map((v, i) => v + at.up[i] * 1e5); await new Promise(r => setTimeout(r, 600)); return Object.assign(window.__pv, {far: g.lod.ports}) });
		ok('9s. L2.3: the surface starport\'s model is drawn from 1.5 km (and its field), every pad on level ground (within 0.5 m); from 100 km up it isn\'t drawn (the world stands in)', pv2.near >= 1 && pv2.pads >= 10 && pv2.level < 0.5 && pv2.far == 0, pv2);
		/* L2.4: at the surface starport: ask for clearance (N), get a pad; set down on someone else's pad: refused;
		   set down inside your own: docked, the port's screens open; launch: the clamps let go, and lift off */
		const sl4 = ms => new Promise(r => setTimeout(r, ms));
		/* (0.4.4: the starter's Autopilot Computer would take over once cleared: these steps are flown by hand) */
		await f.evaluate(() => { EmberDebug.ship.autopilot = false; EmberDebug.game.ap = null });
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, sp = g.surfacePorts.find(x => x.q.kind == 'starport'), at = EmberDebug.surfacePortAt(sp); g.clearance = null; g.landed = null; g.gear = false; g.npcs = []; s.p = at.pos.map((v, i) => v + at.up[i] * 1500); s.v = EmberFlight.frameAt(EmberScene.worldFrame(sp.body), s.p).v; s.q = EmberScene.lookRotation(at.rot.slice(0, 3), at.up); g.atc = {} });
		await pg.keyboard.press('KeyN'); await sl4(300);
		const set = async which => f.evaluate(async which => {
			const g = EmberDebug.game, s = EmberDebug.s, sp = g.surfacePorts.find(x => x.q.kind == 'starport'), at = EmberDebug.surfacePortAt(sp), Ly = sp.layout, cl = g.clearance;
			const pad = which == 'mine' ? Ly.pads.find(p => p.n == cl.pad) : Ly.pads.find(p => p.n != cl.pad && p.size == 'S');
			const ex = at.rot.slice(0, 3), ny = at.rot.slice(3, 6), low = EmberLanding.lowest(EmberDebug.ship, true, 0).d, gee = sp.body.g * 9.81, h = low + Math.min(1.2, 2 / gee);
			const P = at.pos.map((v, i) => v + ex[i] * pad.c[0] + ny[i] * pad.c[1] + at.up[i] * h);
			g.landed = null; g.gear = true; s.fa = false; s.p = P; s.v = EmberFlight.frameAt(EmberScene.worldFrame(sp.body), P).v; s.w = [0, 0, 0]; s.q = EmberScene.lookRotation(ex, at.up); g.throttle = 0;
			for (let i = 0; i < 100 && !g.landed; i++) await new Promise(r => setTimeout(r, 30));
			await new Promise(r => setTimeout(r, 300));
			return {landed: !!g.landed, docked: g.docked, port: !document.getElementById('port').hidden, msg: g.msgs.slice(-2).map(m => m.text).join(' | '), cl: g.clearance && {pad: g.clearance.pad, port: g.clearance.port}, pad: pad.n};
		}, which);
		const cl0 = await f.evaluate(() => EmberDebug.game.clearance);
		const other = await set('other');
		await f.evaluate(() => { const g = EmberDebug.game; g.landed = null; EmberDebug.s.fa = true });
		/* 0.3.10: a delivery due at this surface port, with the load aboard (paid on docking) */
		const dl0 = await f.evaluate(() => { const g = EmberDebug.game, P = g.P, cl = g.clearance, q = g.ports.find(x => x.id == cl.port), code = EmberFactions.byId(g.P.origin).currency.code;
			P.missions = [{id: 'test-delivery', kind: 'surface', type: 'delivery', issuer: g.P.origin, star: {id: g.star.id, name: g.star.name, at: [g.star.x, g.star.y, g.star.z]}, port: q.id, portName: q.name, world: q.world, good: 'Food', tons: 1, text: 'Deliver 1 t of Food', reward: 500, currency: code, dist: 0, accepted: Math.floor(g.day), due: Math.floor(g.day) + 12, done: false}];
			P.cargo = Object.assign({}, P.cargo, {Food: (P.cargo.Food || 0) + 1}); return {food: P.cargo.Food, wallet: P.wallet[code] || 0, code} });
		const mine = await set('mine');
		const dl1 = await f.evaluate(c => { const P = EmberDebug.game.P; return {food: P.cargo.Food || 0, wallet: P.wallet[c] || 0, left: (P.missions || []).length, said: EmberDebug.game.msgs.some(m => /^Delivered 1 t of Food/.test(m.text))} }, dl0.code);
		ok('9u2. 0.3.10: docking at a surface port hands over a delivery due there, and it pays at once', dl1.food == dl0.food - 1 && Math.abs(dl1.wallet - dl0.wallet - 500) < 1e-6 && dl1.left == 0 && dl1.said, {dl0, dl1});
		await pg.screenshot({path: path.join(W, 'surface-docked.png')});
		await f.evaluate(() => { const b = [...document.querySelectorAll('#port [data-screen]')].find(x => x.dataset.screen == 'launch'); b && b.click() }); await sl4(300);
		await f.evaluate(() => { const b = [...document.querySelectorAll('#port button')].find(x => /^Launch/.test(x.textContent) && x.dataset.act == 'launch') || document.querySelector('#port [data-act="launch"]'); b && b.click() }); await sl4(400);
		const out = await f.evaluate(async () => { const g = EmberDebug.game, r = {docked: g.docked, landed: !!g.landed, port: !document.getElementById('port').hidden, padFree: g.atc && Object.values(g.atc).every(C => !C.pads.some(p => p.who == 'me'))}; EmberDebug.s.fa = true; g.throttle = 0.5; await new Promise(r => setTimeout(r, 800)); r.lifted = !g.landed; g.throttle = 0; return r });
		ok('9u. L2.4: N at a surface starport gives a pad; setting down on another pad is refused (clamps open); inside your own the clamps lock, docked, and the port opens; Launch frees the pad and you lift off', cl0 && cl0.pad && cl0.port.startsWith('surface:') && other.landed && !other.docked && other.cl && other.cl.pad != other.pad && mine.landed && mine.docked && mine.port && !out.docked && !out.port && out.padFree && out.lifted, {cl0, other, mine, out});
		/* 0.3.6: navigation and instance targets, the 10 km port lock, lining up for a jump, the system card, a reboot */
		await f.evaluate(() => { EmberDebug.go(EmberDebug.game.home.star); EmberDebug.game.npcs = []; EmberDebug.game.cans = [] }); await sleep(800);
		const put = d => f.evaluate(d => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberDebug.scene.station; g.landed = null; g.docked = false; g.cruise = {on: false, v: 0, charge: 0}; g.jump = null; s.p = st.c.map((v, i) => v + st.axis[i] * d); s.v = [0, 0, 0]; s.w = [0, 0, 0]; g.npcs = [] }, d);
		await put(15000); await f.focus('#hud');
		const nav0 = await f.evaluate(() => EmberDebug.navTarget().name);
		await pg.keyboard.press('KeyT'); await sleep(150); const t0 = await f.evaluate(() => { const g = EmberDebug.game; return {tgt: g.tgt && g.tgt.kind, nav: EmberDebug.navTarget().name, card: g.hudData && g.hudData.target.name, mark: g.hudData && g.hudData.navMark && g.hudData.navMark.name} });
		await pg.keyboard.press('Period'); await sleep(150);
		const nav1 = await f.evaluate(() => ({name: EmberDebug.navTarget().name, kind: EmberDebug.navTarget().kind || 'port', tgt: EmberDebug.game.tgt && EmberDebug.game.tgt.kind}));
		ok('9v. T picks an instance target (the beacon here) and leaves the navigation target, which the HUD still marks; . (Period) steps through the navigation targets and leaves the instance one', ['beacon', 'ship', 'canister', 'asteroid', 'field', 'deposit', 'site'].includes(t0.tgt) && t0.nav == nav0 && t0.mark == nav0 && nav1.name != nav0 && ['planet', 'star', 'port'].includes(nav1.kind) && nav1.tgt == t0.tgt, {t0, nav0, nav1});
		await put(9000); await pg.keyboard.press('KeyC'); await sleep(150);
		const lk = await f.evaluate(() => ({charge: EmberDebug.game.cruise.charge, said: EmberDebug.game.msgs.slice(-1)[0].text}));
		await put(11000); await pg.keyboard.press('KeyC'); await sleep(150);
		const lk2 = await f.evaluate(() => EmberDebug.game.cruise.charge); await pg.keyboard.press('KeyC'); await sleep(100);
		ok('9w. a port\'s mass lock reaches 10 km: cruise is refused at 9 km and charges at 11 km', !lk.charge && /10 km clear/.test(lk.said) && lk2 > 0, {lk, lk2});
		await put(60000);
		const jl = await f.evaluate(() => { const g = EmberDebug.game, x = EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 3).find(y => y.kind == 'star' && y.id != g.star.id); g.route = {legs: [{kind: 'jump', star: x, d: Math.hypot(x.x - g.star.x, x.y - g.star.y, x.z - g.star.z)}], toStar: x}; g.fuel = 1;
			const d = EmberDebug.sysDir(x), s = EmberDebug.s; s.q = EmberScene.lookRotation(d.map(v => -v), Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); return x.name });
		await f.evaluate(() => { EmberDebug.ship.autopilot = false; EmberDebug.game.ap = null });   /* (by hand first; the autopilot after) */
		await pg.keyboard.press('KeyJ'); await sleep(300);
		const j0 = await f.evaluate(() => { const g = EmberDebug.game, h = g.hudData; return {jump: !!g.jump, said: g.msgs.slice(-1)[0].text, sys: h.system && {rows: h.system.rows, aligned: h.system.aligned, on: h.system.on}} });
		await f.evaluate(() => { const g = EmberDebug.game, d = EmberDebug.sysDir(g.route.legs[0].star), s = EmberDebug.s; s.q = EmberScene.lookRotation(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); s.w = [0, 0, 0] });
		await sleep(300); await pg.keyboard.press('KeyJ'); await sleep(300);
		const j1 = await f.evaluate(() => { const g = EmberDebug.game, h = g.hudData; return {jump: !!g.jump, sys: h.system && {aligned: h.system.aligned, on: h.system.on, x: h.system.x, y: h.system.y}} });
		await f.evaluate(() => { const s = EmberDebug.s, d = EmberDebug.sysDir(EmberDebug.game.route.legs[0].star); s.q = EmberScene.lookRotation(EmberScene.v.norm(d.map((v, i) => v + [0.05, 0.03, 0.02][i])), Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]) }); await sleep(400);
		await pg.screenshot({path: path.join(W, 'jump-aligned.png')});
		await pg.keyboard.press('KeyJ'); await sleep(150); await f.evaluate(() => { EmberDebug.game.route = null; EmberDebug.game.jump = null });
		ok('9x. a jump needs the nose on the system\'s star: refused facing away (the card gives distance, government, superpower, population), and charges once lined up, the open reticle on the star mid-screen',
			!j0.jump && /^Align with /.test(j0.said) && j0.sys && j0.sys.rows.length >= 4 && !j0.sys.aligned && !j0.sys.on && j1.jump && j1.sys.aligned && j1.sys.on, {jl, j0, j1});
		/* 0.4.4: with the starter's Autopilot Computer, J turns the ship onto the star and the jump charges by itself */
		const ja = await f.evaluate(async () => { const g = EmberDebug.game, s = EmberDebug.s, x = EmberGalaxy.starsNear(g.star.x, g.star.y, g.star.z, 3).find(y => y.kind == 'star' && y.id != g.star.id); EmberDebug.ship.autopilot = true; g.jump = null; g.ap = null;
			g.route = {legs: [{kind: 'jump', star: x, d: Math.hypot(x.x - g.star.x, x.y - g.star.y, x.z - g.star.z)}], toStar: x}; const d = EmberDebug.sysDir(x); s.q = EmberScene.lookRotation(d.map(v => -v), Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); s.w = [0, 0, 0]; return x.name });
		await f.focus('#hud'); await pg.keyboard.press('KeyJ');
		const ja1 = await f.evaluate(async () => { const g = EmberDebug.game; for (let i = 0; i < 120 && !g.jump; i++) await new Promise(r => setTimeout(r, 100)); const said = (g.msgs.slice(-4).find(m => /^Autopilot: aligning/.test(m.text)) || {text: g.msgs.slice(-1)[0].text}).text; return {said, ap: g.ap && g.ap.mode, jump: !!g.jump, off: g.hudData.system && g.hudData.system.note, aligning: g.msgs.slice(-6).filter(m => /^Autopilot: aligning/.test(m.text)).length} });
		await f.evaluate(() => { const g = EmberDebug.game; g.jump = null; g.ap = null; g.route = null });
		ok('9x2. 0.4.4: with the starter\'s Autopilot Computer, J turns the ship onto the system\'s star and the jump charges', /^Autopilot: aligning with /.test(ja1.said) && ja1.aligning == 1 && ja1.jump, {ja, ja1});
		const rb = await f.evaluate(async () => { const g = EmberDebug.game, ft = EmberDebug.fit; EmberModules.damage(ft, 'sensors', 1e6); EmberDebug.reboot(); const r = {on: ft.reboot > 0, weapons: EmberModules.status(ft).weapons, thrust: EmberModules.status(ft).output.main};
			await new Promise(z => setTimeout(z, 1500)); r.o2 = ft.o2 < ft.o2Max; r.chip = g.hudData.reboot > 0 && !!g.hudData.o2; ft.reboot = 0.2; await new Promise(z => setTimeout(z, 600));
			r.back = EmberModules.works(ft, 'sensors'); r.said = g.msgs.some(m => /^Reboot complete: Sensors back/.test(m.text)); return r });
		ok('9y. a reboot (radial menu): weapons and thrust off and the air reserve drawn while it runs; after it the broken sensors work again', rb.on && !rb.weapons && !rb.thrust && rb.o2 && rb.chip && rb.back && rb.said, rb);
		/* 0.3.11 (L2.6): traffic flown in and out of the port; a forward base's turrets */
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberDebug.scene.station; g.route = null; g.jump = null; g.npcs = []; s.p = st.c.map((v, i) => v + st.axis[i] * 3000 + st.x[i] * 2500); s.v = [0, 0, 0];
			EmberDebug.trafficEvent('orbital', {k: 'npcOut', who: 'npcT1', pad: 1, size: 'S'}); EmberDebug.trafficEvent('orbital', {k: 'npcIn', who: 'npcT2', pad: 2, size: 'S'}) });
		const tf0 = await f.evaluate(() => { const st = EmberDebug.scene.station, L = p => EmberScene.toLocal(st, p); return EmberDebug.game.npcs.filter(n => n.traffic).map(n => ({way: n.traffic.way, z: L(n.s.p)[2], d: Math.hypot(...n.s.p.map((v, i) => v - st.c[i]))})) });
		await sleep(6000);
		const tf1 = await f.evaluate(() => { const st = EmberDebug.scene.station, L = p => EmberScene.toLocal(st, p); return EmberDebug.game.npcs.filter(n => n.traffic).map(n => ({way: n.traffic.way, z: L(n.s.p)[2], d: Math.hypot(...n.s.p.map((v, i) => v - st.c[i])), name: n.name})) });
		const o0 = tf0.find(x => x.way == 'out'), o1 = tf1.find(x => x.way == 'out'), i0 = tf0.find(x => x.way == 'in'), i1 = tf1.find(x => x.way == 'in');
		ok('9z. L2.6: NPC traffic is flown: a departure comes out of the mouth along the axis, an arrival closes on the port', o0 && o1 && i0 && i1 && o1.z > o0.z + 100 && i1.d < i0.d - 50, {tf0, tf1});
		await pg.screenshot({path: path.join(W, 'traffic.png')});
		const base = await f.evaluate(async () => {
			const g = EmberDebug.game; let home = null;
			for (const m of EmberFactions.majors()) { if (EmberTravel.portsAt(m.star, Math.floor(g.day)).some(q => q.surface && q.kind == 'base')) { home = m; break } }
			if (!home) return {none: true};
			EmberDebug.go(home.star); await new Promise(r => setTimeout(r, 300));
			const sp = g.surfacePorts.find(x => x.q.kind == 'base'), at = EmberDebug.surfacePortAt(sp), s = EmberDebug.s; g.npcs = [];
			s.p = at.pos.map((v, i) => v + at.up[i] * 1500 + at.rot[i] * 600); s.v = [0, 0, 0]; s.fa = true; g.throttle = 0;
			const code = EmberFactions.byId(sp.q.owner).currency.code; g.P.bounties[code] = 5000;
			const sh0 = g.pcs.shield + g.pcs.hull;
			await new Promise(r => setTimeout(r, 5000));
			const tur = g.npcs.filter(n => n.role == 'turret');
			const r = {base: sp.q.name, turrets: tur.length, onMe: tur.filter(n => n.foe && n.foe.player).length, hurt: sh0 - (g.pcs.shield + g.pcs.hull)};
			delete g.P.bounties[code]; return r });
		ok('9z2. L2.6: a forward base has two turrets; wanted in its coin, they turn on you and fire', !base.none && (base.turrets == 2 && base.onMe == 2 && base.hurt > 0), base);
		await f.evaluate(() => { EmberDebug.game.npcs = [] });
		/* 0.4.1 (L3.1): a ring's mining site is a stretch of the ring itself, its asteroids the ring's own */
		const rg = await f.evaluate(async () => {
			const g = EmberDebug.game; let star = null;
			for (const m of EmberFactions.majors()) { for (const x of EmberGalaxy.starsNear(m.star.x, m.star.y, m.star.z, 6)) if (x.kind == 'star' && EmberGalaxy.system(x).planets.some(p => p.ring)) { star = x; break } if (star) break }
			EmberDebug.go(star); await new Promise(r => setTimeout(r, 300));
			const fd = g.fields.find(x => x.ring), s = EmberDebug.s; g.npcs = [];
			s.p = fd.pos.map((v, i) => v + fd.ring.ax[i] * 900 + fd.ring.e1[i] * 1200); s.v = [0, 0, 0]; s.q = EmberScene.lookRotation(fd.ring.e2, fd.ring.ax); g.cruise = {on: false, v: 0, charge: 0};
			await new Promise(r => setTimeout(r, 1500));
			return {ring: fd.name, rocks: g.rocks.length, own: g.rocks.every(r => r.id.startsWith(fd.ring.id + '#')), inBands: g.rocks.every(r => { const L = EmberRings.locate(fd.ring, r.pos); return L.band && !L.band.gap }), fps: Math.round(g.fps || 0)} });
		await pg.screenshot({path: path.join(W, 'ring.png')});
		ok('9z3. L3.1: at a ring\'s mining site, the asteroids are the ring\'s own, in its bands', rg.rocks >= 20 && rg.own && rg.inBands, rg);
		const hv = await f.evaluate(async () => {
			const g = EmberDebug.game; let star = null;
			for (const m of EmberFactions.majors()) { for (const x of EmberGalaxy.starsNear(m.star.x, m.star.y, m.star.z, 8)) if (x.kind == 'star' && EmberGalaxy.system(x).planets.some(p => p.ring && EmberRings.ringOf({name: p.name, ring: p.ring, ringDensity: p.ringDensity, radius: 1, pos: [0, 0, 0]}, x).hotspots.length)) { star = x; break } if (star) break }
			EmberDebug.go(star); await new Promise(r => setTimeout(r, 300));
			const u = EmberDebug.ship.utility, had = !!u.array; u.array = false;
			const without = EmberDebug.shownFields().filter(x => x.hotspot).length, all = g.fields.filter(x => x.hotspot).length;
			u.array = true; const withA = EmberDebug.shownFields().filter(x => x.hotspot).map(x => x.name);
			u.array = had; return {star: star.name, all, without, withA} });
		ok('9z4. L3.1: a ring\'s mineral hotspots show only to a ship with a prospecting array', hv.all >= 1 && hv.without == 0 && hv.withA.length == hv.all && hv.withA.every(n => /hotspot/.test(n)), hv);
		const sc5 = await f.evaluate(async () => {
			const g = EmberDebug.game, s = EmberDebug.s, fd = g.fields.find(x => x.ring && !x.hotspot), u = EmberDebug.ship.utility, keep = {p: !!u.prospector, a: !!u.array};
			s.p = fd.pos.map((v, i) => v + fd.ring.ax[i] * 900); s.v = [0, 0, 0]; g.npcs = []; await new Promise(r => setTimeout(r, 800));
			const rk = g.rocks.slice().sort((a, b) => Math.hypot(...a.pos.map((v, i) => v - s.p[i])) - Math.hypot(...b.pos.map((v, i) => v - s.p[i])))[0]; s.p = rk.pos.map((v, i) => v + fd.ring.ax[i] * (rk.radius + 400)); g.tgt = rk;
			u.prospector = false; u.array = true; EmberDebug.scanNow(); const a = {read: rk.prospected, said: g.msgs.slice(-1)[0].text};
			u.prospector = true; u.array = false; EmberDebug.scanNow(); const b = {read: rk.prospected, said: g.msgs.slice(-1)[0].text};
			u.prospector = keep.p; u.array = keep.a; g.tgt = null; return {a, b} });
		ok('9z5. 0.4.2: an asteroid is read with a resource scanner, scanning the asteroid itself; a prospecting array alone can\'t', !sc5.a.read && /No resource scanner/.test(sc5.a.said) && sc5.b.read && /^Prospected /.test(sc5.b.said), sc5);
		/* 0.4.3: third person (V): above and behind the ship, the ship drawn; and shots leave from the gun mounts */
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberDebug.scene.station; EmberDebug.go(g.home.star) }); await sleep(600);
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberDebug.scene.station; g.npcs = []; s.p = st.c.map((v, i) => v + st.axis[i] * 16000); s.v = [0, 0, 0]; g.chase = false });
		await f.focus('#hud'); await pg.keyboard.press('KeyV'); await sleep(400);
		const tpv = await f.evaluate(() => ({chase: EmberDebug.game.chase, said: EmberDebug.game.msgs.slice(-1)[0].text}));
		await f.evaluate(() => { EmberDebug.game.shots.length = 0; EmberDebug.game.wantFire = true });
		await pg.keyboard.down('Semicolon'); await sleep(250); await pg.keyboard.up('Semicolon');
		await pg.screenshot({path: path.join(W, 'third-person.png')});
		await pg.keyboard.press('KeyV'); await sleep(200);
		const tpv2 = await f.evaluate(() => EmberDebug.game.chase);
		ok('9z6. 0.4.3: V switches to a third-person view and back', tpv.chase && /Third-person/.test(tpv.said) && !tpv2, {tpv, tpv2});
		await f.evaluate(() => { EmberDebug.go(EmberGalaxy.lookup('heart', [0, 0, 0])); EmberDebug.game.npcs = [] }); await sleep(800);
		await f.evaluate(() => { const g = EmberDebug.game, f0 = g.P.ship.fit, L = EmberOutfit.layout(EmberShips.hull(g.P.ship.model)); const i = L.internal.findIndex(z => z >= 3); if (i < 0) return; f0.internal[i] = {id: 'phaser', size: 3, grade: 'A'}; f0.core.power.grade = 'A'; EmberDebug.refit(); EmberDebug.near(EmberDebug.scene.bodies[0], 3.4) });
		await f.focus('#hud'); await pg.keyboard.press('KeyJ'); await sleep(15000);
		const rift = await f.evaluate(() => ({id: EmberDebug.game.star.id, realm: EmberGalaxy.realm(), riftborn: EmberDebug.game.npcs.filter(n => n.role == 'riftborn').length}));
		ok('10. with a phaser, the Maw takes the ship into the Rift', rift.id == 'R:heart' && rift.realm == 'rift', rift);
		await pg.screenshot({path: path.join(W, 'rift.png')});
		/* the Marshals' anchorage at the Maw: guards, and a no-fire zone */
		const zone = await f.evaluate(() => { const g = EmberDebug.game, st = EmberDebug.scene.station; return {maw: !!(g.port && g.port.maw), guards: g.npcs.filter(n => n.role == 'marshal').length, st: !!st} });
		await f.evaluate(() => { const g = EmberDebug.game, s = EmberDebug.s, st = EmberDebug.scene.station; g.npcs = g.npcs.filter(n => n.role == 'marshal'); s.p = st.c.map((v, i) => v + st.axis[i] * 4000); s.v = [0, 0, 0]; g.shots = [] });
		await f.focus('#hud'); await pg.keyboard.down('Semicolon'); await sleep(900); await pg.keyboard.up('Semicolon');
		const nf = await f.evaluate(() => { const g = EmberDebug.game; return {mine: g.shots.filter(x => x.owner == 'me').length, said: g.msgs.some(x => /No-fire zone/.test(x.text))} });
		ok('10b. the Maw\'s anchorage is the Marshals\': their guards hold it, and nobody\'s guns fire within its no-fire zone', zone.maw && zone.st && zone.guards == 2 && nf.mine == 0 && nf.said, {zone, nf});
		await f.evaluate(() => { EmberDebug.game.npcs = []; EmberDebug.settle && 0 }); await pg.evaluate(() => send({op: 'pause'})); await sleep(1200);
		/* reopen: the save takes it back where it was */
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug`); await pg.reload(); f = await frame(pg, () => window.EmberDebug && EmberDebug.game.star && EmberDebug.scene);
		const back = await f.evaluate(() => ({id: EmberDebug.game.star.id, realm: EmberGalaxy.realm(), chooser: !!document.querySelector('#ovBody button[data-i]')}));
		ok('11. reopened, it resumes from the save (in the Rift), without asking for an origin', back.id == 'R:heart' && back.realm == 'rift' && !back.chooser, back);
		/* losing the ship: the insurer (insurance.js) brings it back, this side of the Maw */
		const lostAt = await f.evaluate(() => { EmberDebug.lose('a test'); const g = EmberDebug.game; return {star: g.star.id, realm: EmberGalaxy.realm(), ship: EmberDebug.ship.name, hull: g.pcs.hull > 0, port: !!g.port, msg: g.msgs.slice(-3).map(m => m.text).join(' | ')} });
		ok('12. lost in the Rift, the ship comes back under its insurance, at a port this side', lostAt.realm == 'normal' && !lostAt.star.startsWith('R:') && lostAt.ship == 'Griffin' && lostAt.hull && lostAt.port && /Insurance|waits at/.test(lostAt.msg), lostAt);
		ok('13. no errors on the way', errs.length == 0, errs);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (error) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
