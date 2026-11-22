/* Ember Reach's Contraband Merchant in Chromium (Playwright), as the Rudolf OS desktop opens it (0.5.7;
   docs/plan-ember-reach-pilots.md P3): a Hardcore pilot at their capital finds the merchant in Contacts, buys a
   piece (into storage, bound to them), fits it at the outfitter (no Sell, no Recycle), the insurer leaves it out,
   a trade-in keeps it in storage, and with Hardcore off the merchant is gone but the gear stays.
     node tests/emberreach_contraband_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8238), TOP = path.join(__dirname, '..');
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
		/* (a page that differs only after # isn't reloaded by goto: reload it) */
		const open = async h => { await pg.goto(`http://127.0.0.1:${PORT}/desk.html#` + h); await pg.reload() };
		const S = () => pg.evaluate(() => JSON.parse(JSON.stringify(SAVES)));
		const saveNow = async f => { await f.evaluate(() => EmberDebug.persist()); await sleep(1600) };
		const pause = async () => { await pg.evaluate(() => send({op: 'pause'})); await sleep(600) };   /* (the desktop's pause, as the main test does) */
		const btn = async (f, t) => f.evaluate(t => [...document.querySelectorAll('#ovBtns button')].find(b => b.textContent == t).click(), t);
		const yours = async f => { await pause(); await btn(f, 'Your pilot'); return frame(pg, () => !!document.getElementById('crHcState')) };
		const screen = f => f.evaluate(() => ({h: document.getElementById('ovT').textContent, radios: [...document.querySelectorAll('input[name=crDiff]')].map(r => r.value + (r.checked ? '*' : '') + (r.disabled ? '-' : '')).join(' '),
			why: (document.getElementById('crWhy') || {}).textContent || '', state: document.getElementById('crHcState').textContent, off: !!document.getElementById('crHcOff')}));
		const scr = async (f, k) => { await f.click('#port [data-screen="' + k + '"]'); await sleep(250) };
		/* a Hardcore pilot at their capital */
		await open('debug');
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="0"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.check('#crHc'); await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('#port [data-screen="contacts"]'));
		const code = await f.evaluate(() => { const g = EmberDebug.game, c = g.home.currency.code; g.P.wallet[c] = 5e8; return c });
		await scr(f, 'station'); await scr(f, 'contacts');
		const m0 = await f.evaluate(() => { const s = document.getElementById('cbMerchant'); return s ? {rows: s.querySelectorAll('.pt-claim').length, buy: s.querySelectorAll('[data-act="cbbuy"]').length, text: s.textContent} : null });
		ok('1. at their capital, a Hardcore pilot finds the Contraband Merchant in Contacts: six pieces, bound to the buyer, not insurable while Hardcore is on', m0 && m0.rows == 6 && m0.buy == 6 && /bound to you for good/.test(m0.text) && /Not insurable while Hardcore is on/.test(m0.text) && /Contraband /.test(m0.text), m0);
		await f.evaluate(() => document.getElementById('cbMerchant').scrollIntoView({block: 'center'})); await sleep(150);
		await pg.screenshot({path: path.join(W, 'merchant.png')});
		/* the first piece that fits a slot as the ship stands */
		const plan = await f.evaluate(() => {
			const g = EmberDebug.game, O = EmberOutfit, S = EmberShips, Cb = EmberContraband, hull = S.hull(g.P.ship.model), L = O.layout(hull), fit = g.P.ship.fit;
			const list = Cb.offers(g.P, g.dockPort || g.port, g.star.id, hull, g.day);
			for (let j = 0; j < list.length; j++) {
				const o = list[j], m = {id: o.id, size: o.size, grade: o.grade, cb: 1}, cat = O.CAT[o.id].cat;
				const slots = cat == 'core' ? [{cat, key: o.id}] : L[cat].map((z, i) => ({cat, i}));
				for (const sl of slots) if (O.install(hull, fit, sl, m).ok) return {j, cat, key: sl.key != null ? sl.key : sl.i, name: o.id};
			}
			return null;
		});
		await f.click('#cbMerchant [data-act="cbbuy"][data-j="' + plan.j + '"]'); await sleep(300);
		const b = await f.evaluate(j => { const st = EmberDebug.game.P.stored || [], m = st[st.length - 1], row = document.querySelectorAll('#cbMerchant .pt-claim')[j]; return {m, sold: /Sold this week/.test(row.textContent), id: EmberDebug.game.pilotId} }, plan.j);
		ok('2. bought: into storage here, contraband, bound to this pilot; sold for the rest of the week', b.m && b.m.cb == 1 && b.m.by == b.id && b.m.id == plan.name && b.sold, b);
		/* the outfitter */
		await scr(f, 'outfitting'); await f.click('#port [data-oftab="' + plan.cat + '"]'); await sleep(200); await f.click('#port [data-ofslot="' + plan.key + '"]'); await sleep(250);
		const st = await f.evaluate(() => { const r = [...document.querySelectorAll('#port .pt-side .pt-claim')].find(x => /^Contraband /.test(x.textContent)); return r ? {fit: !!r.querySelector('[data-act="offitstore"]'), sell: !!r.querySelector('[data-act="ofsellstore"]'), recycle: !!r.querySelector('[data-act="ofrecycle"]')} : null });
		ok('3. in storage at the outfitter it\'s marked Contraband, with Fit but no Sell or Recycle', st && st.fit && !st.sell && !st.recycle, st);
		await f.evaluate(() => [...document.querySelectorAll('#port .pt-side .pt-claim')].find(x => /^Contraband /.test(x.textContent)).querySelector('[data-act="offitstore"]').click()); await sleep(300);
		const fitted = await f.evaluate(() => { const side = document.querySelector('#port .pt-side').textContent; return {cb: EmberOutfit.modules(EmberDebug.game.P.ship.fit).filter(m => m.cb).length, bound: /bound to you, never sold/.test(side), sell: !!document.querySelector('#port [data-act="ofsell"]')} });
		ok('4. fitted: the slot says it\'s bound to you, never sold, and offers no Take out and sell', fitted.cb == 1 && fitted.bound && !fitted.sell, fitted);
		await pg.screenshot({path: path.join(W, 'outfitting.png')});
		/* the insurer */
		await scr(f, 'contacts');
		const ins = await f.evaluate(() => [...document.querySelectorAll('#port .pt-card')].find(c => /^Insurance/.test(c.querySelector('h2') && c.querySelector('h2').textContent || '')).textContent);
		ok('5. the insurer says the contraband isn\'t covered while Hardcore is on', /contraband isn.t covered while Hardcore is on/.test(ins), ins.slice(0, 300));
		/* a trade-in: the contraband stays, in storage */
		await scr(f, 'shipyard');
		const other = await f.evaluate(() => { const b = [...document.querySelectorAll('#port [data-ship]')].find(x => x.dataset.ship != EmberDebug.game.P.ship.model); return b && b.dataset.ship });
		await f.click('#port [data-ship="' + other + '"]'); await sleep(200); await f.click('#port [data-act="buyship"]'); await sleep(400);
		const ti = await f.evaluate(o => { const P = EmberDebug.game.P; return {model: P.ship.model == o, fitCb: EmberOutfit.modules(P.ship.fit || {core: {}, internal: [], external: [], utility: []}).some(m => m.cb), stored: (P.stored || []).filter(m => m.cb).length} }, other);
		ok('6. trading the ship in: the new ship has none; the contraband stays the pilot\'s, in storage here', ti.model && !ti.fitCb && ti.stored == 1, ti);
		/* Hardcore off: the merchant is gone, the gear stays */
		await f.evaluate(() => { EmberCareer.hcOff(EmberDebug.game.P) }); await scr(f, 'station'); await scr(f, 'contacts');
		const gone = await f.evaluate(() => ({merchant: !!document.getElementById('cbMerchant'), stored: (EmberDebug.game.P.stored || []).filter(m => m.cb).length}));
		ok('7. with Hardcore off, no merchant; the pilot keeps their contraband', !gone.merchant && gone.stored == 1, gone);
		ok('8. no errors', errs.length == 0, errs);
		console.log('screenshots: ' + W);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
