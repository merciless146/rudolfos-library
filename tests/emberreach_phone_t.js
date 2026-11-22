/* Ember Reach on a phone's screen (0.5.3) in Chromium (Playwright) with touch: the HUD's panels compact and clear of
   the touch controls and the crosshair; the port's screens, the pause menu and Settings, the duel menu and the star
   map usable from 360 px wide, upright and on its side (nothing wider than the screen, every control at least 44 px,
   no text under 10 px); and nothing of it on a computer's screen.
     node tests/emberreach_phone_t.js [PORT]      (needs: playwright; python3 for the file server) */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8812), TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh;display:block"></iframe><script>
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:null});else if(m.op=='save')reply({})});
document.getElementById('f').src='www/index.html?'+(location.hash.slice(1)||'debug');</script>`);
const errs = [];
async function frame(pg, test) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 300; i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
/* in the page: what's wrong with what's shown inside root (its controls under 44 px, text under 10 px, wider than the screen) */
const AUDIT = root => {
	const el = document.querySelector(root), vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility != 'hidden' && cs.display != 'none' };
	const name = e => e.tagName.toLowerCase() + (e.dataset.screen ? '[' + e.dataset.screen + ']' : e.dataset.act ? '[' + e.dataset.act + ']' : e.className ? '.' + String(e.className).split(' ')[0] : '') + ' "' + (e.textContent || e.value || '').trim().slice(0, 16) + '"';
	const small = [...el.querySelectorAll('button, select, input:not([type=radio]):not([type=checkbox]), label:has(input[type=radio])')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5 }).map(e => name(e) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
	const tiny = [...el.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType == 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10).map(name);
	const scroller = root == '#port' ? el : el.querySelector('.card') || el;
	return {small: [...new Set(small)].slice(0, 8), tiny: [...new Set(tiny)].slice(0, 8), wide: scroller.scrollWidth > scroller.clientWidth + 1 ? scroller.scrollWidth + ' > ' + scroller.clientWidth : ''};
};
const clean = a => !a.small.length && !a.tiny.length && !a.wide;
const boxesOf = u => [...u.buttons.map(b => ({n: b.act, x: b.x, y: b.y, w: b.w, h: b.h})), {n: 'stick', x: u.stick.x - u.stick.r, y: u.stick.y - u.stick.r, w: 2 * u.stick.r, h: 2 * u.stick.r}, {n: 'yaw', ...u.yaw}, {n: 'thr', ...u.thr}, {n: 'vert', ...u.vert}];
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
(async () => {
	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	let n = 0;
	try {
		for (const [w, h] of [[390, 844], [844, 390], [360, 640]]) {
			const v = w + 'x' + h, ctx = await br.newContext({viewport: {width: w, height: h}, hasTouch: true, isMobile: true});
			const pg = await ctx.newPage(); pg.on('console', m => { if (m.type() == 'error') errs.push(m.text()) }); pg.on('pageerror', e => errs.push(String(e)));
			await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug`);
			let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
			const org = await f.evaluate(AUDIT, '#ov');
			await f.tap('#ovBody button[data-i="5"]');
			f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('[data-screen="launch"]'));
			/* the port's screens */
			const screens = await f.evaluate(() => [...new Set([...document.querySelectorAll('.pt-bar [data-screen]')].map(b => b.dataset.screen))]);
			const bad = {};
			for (const sc of screens.filter(x => x != 'launch').concat(['launch'])) {
				await f.evaluate(sc => document.querySelector('.pt-bar [data-screen="' + sc + '"]').click(), sc); await sleep(250);
				if (sc == 'market') { await f.evaluate(() => { const r = document.querySelector('#port [data-good]'); r && r.click() }); await sleep(150) }
				const a = await f.evaluate(AUDIT, '#port'); if (!clean(a)) bad[sc] = a;
				await pg.screenshot({path: path.join(W, v + '-port-' + sc + '.png')});
			}
			/* the colonial office (0.5.1), at a border port of the power's with an unclaimed system in reach (as
			   tests/emberreach_groundcolony_t.js finds it): its list, and a system picked */
			const office = await f.evaluate(() => {
				const G = EmberGalaxy, Co = EmberColonies, T = EmberTravel, Tr = EmberTrade, home = EmberFactions.majors()[5];
				for (let k = 0; k < 12; k++) { const a = k * 2.4, b = Math.sin(k * 1.7) * 0.3, dir = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
					for (let r = home.claim * 0.5; r < home.claim * 1.5; r += home.claim * 0.04) { const p = home.at.map((v, i) => v + dir[i] * r);
						for (const x of G.starsNear(p[0], p[1], p[2], 3).filter(y => y.kind == 'star').slice(0, 6)) { const pf = T.portFor(x, 200); if (!pf || pf.owner != home.id) continue;
							const c = Co.candidates(Tr.newPlayer(home.id), {star: x, owner: home.id}, 200, 6, 10).find(s => Co.groundWorlds(s, 'soutpost').length);
							if (c) { window.__target = c; const g = EmberDebug.game; g.day = 200; EmberDebug.go(x); EmberDebug.ship.jump = 6; g.P.rep[home.id] = 300; EmberDebug.dock(); return true } } } }
				return false });
			if (office) {
				await sleep(400); await f.evaluate(() => document.querySelector('.pt-bar [data-screen="contacts"]').click()); await sleep(200);
				await f.evaluate(() => { const b = document.querySelector('#port [data-screen="colonies"]'); b && b.click() }); await sleep(250);
				let a = await f.evaluate(AUDIT, '#port'); if (!clean(a)) bad.colonies = a;
				await f.evaluate(() => { const b = document.querySelector('#port [data-col="' + window.__target.id + '"]'); b && b.click() }); await sleep(250);
				a = await f.evaluate(AUDIT, '#port'); if (!clean(a)) bad['colonies (picked)'] = a;
				screens.push('colonies'); await pg.screenshot({path: path.join(W, v + '-port-colonies.png')});
			}
			ok((++n) + '. ' + v + ': the port\'s ' + screens.length + ' screens (' + screens.join(', ') + ') and the origin picker fit the screen, every control at least 44 px, no text under 10 px', office && !Object.keys(bad).length && clean(org), {office, bad, org});
			/* launched: the HUD's panels, compact, inside the screen, apart, clear of the touch controls and the crosshair */
			await f.evaluate(() => document.querySelector('.pt-bar [data-screen="launch"]').click()); await sleep(250);
			await f.evaluate(() => { const b = document.querySelector('#port [data-act="launch"]'); b && b.click() });
			f = await frame(pg, () => !EmberDebug.game.docked && document.getElementById('port').hidden); await sleep(1500);
			await f.evaluate(() => { const g = EmberDebug.game; g.tgt = null });
			const hd = await f.evaluate(() => ({panels: EmberHUD.LAST.panels, u: EmberDebug.touchLayout(), shown: EmberDebug.touchShown()}));
			await pg.screenshot({path: path.join(W, v + '-flight.png')});
			/* (the crosshair kept clear on a phone at least 700 px tall, or on its side: a 16:9 phone upright, 360x640, has
			   no room for it; checked at 360x740 too) */
			const panelProbs = (hd, w, h) => {
				const ps = hd.panels || [], bx = hd.shown ? boxesOf(hd.u) : [], cross = {x: w / 2 - 34, y: h / 2 - 34, w: 68, h: 68}, probs = [];
				for (const p of ps) { if (p.x < 0 || p.y < 0 || p.x + p.w > w || p.y + p.h > h) probs.push(p.n + ' off screen'); for (const b of bx) if (hit(p, b)) probs.push(p.n + '/' + b.n); if ((h >= 700 || w > h) && hit(p, cross)) probs.push(p.n + ' on the crosshair') }
				for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (hit(ps[i], ps[j])) probs.push(ps[i].n + '/' + ps[j].n);
				if (ps.length != 4) probs.push(ps.length + ' panels'); return probs;
			};
			const probs = panelProbs(hd, w, h);
			if (h == 640) { await pg.setViewportSize({width: 360, height: 740}); await sleep(500); const hd2 = await f.evaluate(() => ({panels: EmberHUD.LAST.panels, u: EmberDebug.touchLayout(), shown: EmberDebug.touchShown()})); probs.push(...panelProbs(hd2, 360, 740).map(x => '360x740 ' + x)); await pg.screenshot({path: path.join(W, '360x740-flight.png')}); await pg.setViewportSize({width: 360, height: 640}); await sleep(300) }
			ok((++n) + '. ' + v + ': in flight the HUD\'s panels are compact (speed, target, shields-hull-heat, scanner), inside the screen, apart, clear of the touch controls (and the crosshair)', hd.shown && !probs.length, {probs, ps: hd.panels});
			/* the pause menu and Settings */
			await f.evaluate(() => RG.pause()); await sleep(300);
			const pa = await f.evaluate(AUDIT, '#ov');
			await f.evaluate(() => { const b = [...document.querySelectorAll('#ovBtns button')].find(x => /Settings/.test(x.textContent)); b && b.click() }); await sleep(300);
			const st = [];
			for (const t of [0, 1, 2]) { await f.evaluate(t => document.querySelector('[data-tab="' + t + '"]').click(), t); await sleep(150); st.push(await f.evaluate(AUDIT, '#ov')) }
			ok((++n) + '. ' + v + ': the pause menu and the three pages of Settings fit, every control at least 44 px, no text under 10 px', clean(pa) && st.every(clean), {pa, st: st.filter(a => !clean(a))});
			await f.evaluate(() => { const b = [...document.querySelectorAll('#ovBtns button')].find(x => /Done/.test(x.textContent)); b && b.click() }); await sleep(200);
			await f.evaluate(() => { const b = [...document.querySelectorAll('#ovBtns button')].find(x => /Resume/.test(x.textContent)); b && b.click() }); await sleep(300);
			/* the star map: its buttons inside the screen and a finger's size */
			await f.evaluate(() => { const u = EmberDebug.touchLayout(), b = u.buttons.find(x => x.act == 'map'), c = EmberDebug.toClient(b.x + b.w / 2, b.y + b.h / 2), hud = document.getElementById('hud'); for (const t of ['pointerdown', 'pointerup']) hud.dispatchEvent(new PointerEvent(t, {pointerType: 'touch', pointerId: 5, clientX: c.x, clientY: c.y, bubbles: true})) });
			await frame(pg, () => EmberDebug.game.mapOpen && !!EmberDebug.map.buttons, 100);
			const mb = await f.evaluate(() => ({open: EmberDebug.game.mapOpen, b: EmberDebug.map.buttons || null}));
			await pg.screenshot({path: path.join(W, v + '-map.png')});
			const mbad = mb.b ? mb.b.filter(b => b.x < 0 || b.x + b.w > w || b.w < 44 || b.h < 44).map(b => b.act) : ['no buttons'];
			ok((++n) + '. ' + v + ': MAP opens the star map, its buttons inside the screen and at least 44 px', mb.open && !mbad.length, {mb, mbad});
			/* the duel menu */
			const pg2 = await ctx.newPage(); pg2.on('pageerror', e => errs.push(String(e)));
			await pg2.goto(`http://127.0.0.1:${PORT}/desk.html#debug&duel`); await sleep(500);
			const f2 = await frame(pg2, () => !!document.querySelector('#ovBody input[name=duelShip]'));
			const du = await f2.evaluate(AUDIT, '#ov');
			await pg2.screenshot({path: path.join(W, v + '-duel.png')});
			ok((++n) + '. ' + v + ': the duel menu fits, every control (its ships and opponents too) at least 44 px, no text under 10 px', clean(du), du);
			await ctx.close();
		}
		/* a computer's screen: none of it */
		const ctx = await br.newContext({viewport: {width: 1280, height: 720}});
		const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(String(e)));
		await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug`);
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="5"]');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('[data-screen="launch"]'));
		const css = await f.evaluate(() => ({bar: getComputedStyle(document.querySelector('.pt-bar button')).minHeight, svc: getComputedStyle(document.querySelector('.pt-svcb')).minWidth, port: getComputedStyle(document.getElementById('port')).overflow}));
		await f.evaluate(() => { const b = document.querySelector('#port [data-act="launch"]'); b && b.click() }); await sleep(300);
		await f.evaluate(() => { const b = document.querySelector('#port [data-act="launch"]'); b && b.click() });
		f = await frame(pg, () => !EmberDebug.game.docked); await sleep(800);
		const pn = await f.evaluate(() => EmberHUD.LAST.panels);
		ok((++n) + '. a computer\'s screen (1280x720): the port and the HUD as they were (no phone styles, the full panels)', css.bar == '64px' && css.svc == '190px' && css.port != 'auto' && pn === null, {css, pn});
		await ctx.close();
		ok((++n) + '. no errors', errs.length == 0, errs.slice(0, 5));
	} catch (e) { F++; console.log('FAIL (exception) ' + (e && e.stack || e)) }
	finally { await br.close(); srv.kill(); console.log('screenshots in ' + W); console.log(P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0) }
})();
