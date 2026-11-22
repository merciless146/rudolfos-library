/* Ember Reach on small screens (0.5.3): the HUD round the touch controls, the starport's screens (the market, the
   bulletin board, the shipyard, outfitting, contacts, the colonial office, cartographics, status, launch), the cards
   (pause, settings), the star map and the duel menu, in Chromium (Playwright) with touch emulation from 360 px wide,
   portrait and landscape: nothing wider than the screen, every tap target at least 44 px, text at least 10 px; and the
   desktop's sizes untouched (the market's full table at 1280 × 720).
     node tests/emberreach_phone_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8812), TOP = path.join(__dirname, '..');
const Tc = require(path.join(TOP, 'apps/rudolf-emberreach/www/touch.js'));
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'er-phone-'));
let P = 0, F = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { F++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)) : '')) } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.cpSync(path.join(TOP, 'apps/rudolf-emberreach/www'), path.join(W, 'www'), {recursive: true});
fs.copyFileSync(path.join(TOP, 'lib/gamekit/gamekit.js'), path.join(W, 'www/gamekit.js'));
fs.writeFileSync(path.join(W, 'desk.html'), `<!doctype html><meta name=viewport content="width=device-width, initial-scale=1"><body style="margin:0;overflow:hidden"><iframe id=f sandbox="allow-scripts allow-forms allow-modals allow-downloads" style="border:0;width:100vw;height:100vh;display:block"></iframe><script>
window.SAVES={};
addEventListener('message',e=>{const f=document.getElementById('f');if(e.source!==f.contentWindow)return;const m=e.data;if(!m||m.rudolfGame!==1)return;
 const reply=o=>f.contentWindow.postMessage(Object.assign({rudolfGame:1,op:'reply',id:m.id,ok:true},o),'*');
 if(m.op=='hello')reply({dark:true,reduceFlash:false});else if(m.op=='load')reply({data:SAVES[m.game]===undefined?null:SAVES[m.game]});else if(m.op=='save'){SAVES[m.game]=m.data;reply({})}});
document.getElementById('f').src='www/index.html?'+(location.hash.slice(1)||'debug');</script>`);
const errs = [];
async function frame(pg, test) {
	const fr = () => pg.frames().find(f => f.url().includes('/www/index.html'));
	for (let i = 0; i < 300; i++) { const f = fr(); if (f && await f.evaluate(test).catch(() => false)) return f; await sleep(100) }
	return fr();
}
const ready = () => !!(window.EmberDebug && EmberDebug.s && !document.getElementById('load'));
/* what's wrong with the page in view: wider than the screen, tap targets under 44 px, text under 10 px */
const audit = sel => {
	const vw = innerWidth, root = document.querySelector(sel), all = [...root.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 });
	const wide = all.filter(e => e.getBoundingClientRect().right > vw + 1 && !e.closest('.pt-bar')).map(e => e.tagName + '.' + e.className);
	const small = all.filter(e => e.matches('button:not([disabled]), select, input:not([type=radio])') && (e.getBoundingClientRect().height < 43.5 || e.getBoundingClientRect().width < 43.5)).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
	const tiny = all.filter(e => e.childElementCount == 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 10).map(e => e.textContent.slice(0, 20));
	return {scroll: root.scrollWidth > vw + 1, wide: [...new Set(wide)].slice(0, 5), small: [...new Set(small)].slice(0, 5), tiny: [...new Set(tiny)].slice(0, 5)};
};
const clean = a => !a.scroll && !a.wide.length && !a.small.length && !a.tiny.length;

(async () => {
	/* ---- the HUD's places round the controls, in node ---- */
	const bad = [];
	for (const [w, h] of [[360, 780], [390, 844], [412, 915], [780, 360], [844, 390], [915, 412]]) for (const left of [false, true]) {
		const U = Tc.layout(w, h, {left}), Pl = Tc.places(w, h, U, {flight: [240, 118], combat: [240, 78], target: [210, 118], scanner: [208, 74]}), B = Tc.boxes(U), ks = Object.keys(Pl);
		ks.forEach((k, i) => { const r = Pl[k]; if (r.x < 0 || r.y < 0 || r.x + r.w > w || r.y + r.h > h) bad.push(w + 'x' + h + ' off: ' + k); B.forEach(b => { if (Tc.overlap(r, b)) bad.push(w + 'x' + h + (left ? 'L' : '') + ' ' + k + '×' + b.id) }); ks.forEach((k2, j) => { if (j > i && Tc.overlap(r, Pl[k2])) bad.push(w + 'x' + h + ' ' + k + '×' + k2) }); if (Tc.overlap(r, {x: w / 2 - 30, y: h / 2 - 30, w: 60, h: 60})) bad.push(w + 'x' + h + ' ' + k + ' on the reticle') });
		for (const k of ['msgs', 'target', 'combat', 'flight']) if (!Pl[k]) bad.push(w + 'x' + h + ' no ' + k);
	}
	ok('1. on phones from 360 × 780 to 915 × 412, both hands: the console, the target, the combat and flight panels (and the scanner where it fits) each have a place clear of the controls, of each other and of the reticle', !bad.length, bad.slice(0, 8));

	const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: W, stdio: 'ignore'});
	await sleep(800);
	const br = await chromium.launch();
	try {
		let n = 2;
		for (const [vw, vh] of [[360, 780], [390, 844], [844, 390]]) {
			const ctx = await br.newContext({viewport: {width: vw, height: vh}, hasTouch: true, isMobile: true});
			const pg = await ctx.newPage();
			pg.on('pageerror', e => errs.push(String(e)));
			await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&power=0`);
			const f = await frame(pg, ready); await sleep(800);
			/* every starport screen, and the colonial office (from Contacts) */
			const res = {};
			for (const sc of ['station', 'market', 'bulletin', 'shipyard', 'outfitting', 'contacts', 'colonies', 'carto', 'status', 'launch']) {
				await f.evaluate(s => { const b = document.querySelector('#port [data-screen=' + s + ']'); if (b) b.click() }, sc); await sleep(200);
				res[sc] = await f.evaluate(audit, '#port');
			}
			if (vw == 360) await pg.screenshot({path: path.join(W, 'phone-colonies.png')});
			const badS = Object.entries(res).filter(([, a]) => !clean(a));
			ok(n++ + '. ' + vw + ' × ' + vh + ': every starport screen and the colonial office fit the width, with tap targets of 44 px or more and text of 10 px or more', !badS.length, badS.slice(0, 3));
			const mk = await f.evaluate(() => { document.querySelector('#port [data-screen=market]').click(); return [...document.querySelector('#port .pt-thead').children].filter(e => e.offsetWidth > 0).map(e => e.textContent) });
			if (vw < 600) ok(n++ + '. ' + vw + ' px: the market\'s table keeps the good, the price, stock or demand, and what you hold', mk.length == 4 && /Good/.test(mk[0]) && /Held/.test(mk[3]), mk);
			/* in flight: the HUD round the controls */
			await f.evaluate(() => { document.querySelector('#port [data-screen=launch]').click() }); await sleep(200); await f.evaluate(() => { document.querySelector('#port [data-act=launch]').click() }); await sleep(1500);
			const hd = await f.evaluate(() => ({touch: EmberDebug.game.hudData.touch, ui: !!EmberDebug.game.hudData.touchUI}));
			await pg.screenshot({path: path.join(W, 'phone-hud-' + vw + '.png')});
			ok(n++ + '. ' + vw + ' × ' + vh + ': launched, the touch controls up and the HUD laid out round them', hd.touch && hd.ui, hd);
			/* the pause card and the settings */
			await f.evaluate(() => EmberDebug.game && RG.pause()); await sleep(400);
			const pa = await f.evaluate(audit, '#ov');
			await f.evaluate(() => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == 'Settings').click()); await sleep(200);
			const st = [];
			for (const t of [0, 1, 2]) { await f.evaluate(t => document.querySelector('.st-tabs button[data-tab="' + t + '"]').click(), t); await sleep(150); st.push(await f.evaluate(audit, '#ov')) }
			ok(n++ + '. ' + vw + ' × ' + vh + ': the pause card and the three settings pages fit, tap targets 44 px or more (the sliders aside), text 10 px or more', clean(pa) && st.every(a => !a.scroll && !a.wide.length && !a.tiny.length && a.small.every(x => /^INPUT/.test(x))), {pa, st});
			await ctx.close();
		}
		/* the duel menu on a 360 px phone */
		{
			const ctx = await br.newContext({viewport: {width: 360, height: 780}, hasTouch: true, isMobile: true}), pg = await ctx.newPage();
			await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&duel`);
			const f = await frame(pg, () => !!document.querySelector('#ovBody input[name=duelShip]')); await sleep(300);
			const a = await f.evaluate(audit, '#ov'), lab = await f.evaluate(() => [...document.querySelectorAll('.duel-ship, .duel-opp label')].filter(l => l.getClientRects().length).every(l => l.getBoundingClientRect().height >= 44 && l.getBoundingClientRect().right <= innerWidth));
			await pg.screenshot({path: path.join(W, 'phone-duel.png')});
			const subs = [];
			for (const v of ['lan', 'ws']) { const r = await f.$('#ovBody input[name=duelOpp][value=' + v + ']'); if (r && await r.isEnabled()) { await r.click(); await sleep(200); subs.push(await f.evaluate(audit, '#ov')) } }
			ok(n++ + '. 360 px: the duel menu\'s LAN and Online choices (where the build has them) fit, with tap targets of 44 px or more', subs.every(a => !a.scroll && !a.wide.length && !a.small.length), subs);
			ok(n++ + '. 360 px: the duel menu fits, its ships and opponents each a tap target of 44 px or more', !a.scroll && !a.wide.length && !a.tiny.length && lab, a);
			await ctx.close();
		}
		/* the desktop as it was: the market's full table, the services in a row */
		{
			const ctx = await br.newContext({viewport: {width: 1280, height: 720}}), pg = await ctx.newPage();
			await pg.goto(`http://127.0.0.1:${PORT}/desk.html#debug&power=0`);
			const f = await frame(pg, ready); await sleep(500);
			const d = await f.evaluate(() => { document.querySelector('#port [data-screen=market]').click(); return {cols: [...document.querySelector('#port .pt-thead').children].filter(e => e.offsetWidth > 0).length, ship: getComputedStyle(document.querySelector('.pt-ship')).display, row: document.querySelector('.pt-row').getBoundingClientRect().height} });
			ok(n++ + '. 1280 × 720 (a desktop): the market keeps its six columns and the services row its ship line; rows as before (32 px)', d.cols == 6 && d.ship != 'none' && Math.round(d.row) == 32, d);
			await ctx.close();
		}
		ok(n++ + '. no errors in the page', !errs.length, errs.slice(0, 5));
	} catch (e) { ok('the run', false, String(e && e.stack || e)) }
	finally { await br.close(); srv.kill() }
	if (process.env.KEEP) console.log('screenshots in ' + W); else fs.rmSync(W, {recursive: true, force: true});
	console.log(`\n${P}/${P + F} passed`);
	process.exit(F ? 1 : 0);
})();
