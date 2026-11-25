/* Ember Reach's finds from the ruins at the artifact broker, in Chromium (Playwright), as the Rudolf OS desktop opens
   it (0.7.4, docs/plan-ember-reach-sites.md L4.3): at their capital, a pilot's Finds in Contacts; a relic sold to the
   broker, a device studied (the next build's fee a quarter less) and another recycled (into the hold), an inscription
   returned to the power whose space held its ruin (standing with it); another inscription sold with the data at the
   cartographers; the finds saved and back.
     node tests/emberreach_finds_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8682), TOP = path.join(__dirname, '..');
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
		const open = async h => { await pg.goto(`http://127.0.0.1:${PORT}/desk.html#` + h); await pg.reload() };
		const scr = async (f, k) => { await f.click('#port [data-screen="' + k + '"]'); await sleep(250) };
		await open('debug');
		let f = await frame(pg, () => !!document.querySelector('#ovBody button[data-i]'));
		await f.click('#ovBody button[data-i="0"]');
		f = await frame(pg, () => !!document.getElementById('crStart')); await f.click('#crStart');
		f = await frame(pg, () => window.EmberDebug && EmberDebug.game.docked && !!document.querySelector('#port [data-screen="contacts"]'));
		/* a find of each kind, and an inscription from another power's space */
		const set = await f.evaluate(() => {
			const g = EmberDebug.game, P = g.P, own = g.port.owner, other = EmberFactions.majors().find(m => m.id != own).id;
			P.artifacts = [{k: 'relic', s: 'x|site:A b:field', n: 'v', w: 'A b', h: null, v: 20000, r: 0}, {k: 'device', s: 'x|site:A b:field', n: '2', w: 'A b', h: null, v: 0, r: 0}, {k: 'device', s: 'x|site:C d:field', n: 'v', w: 'C d', h: null, v: 0, r: 0},
				{k: 'inscription', s: 'x|site:E f:field', n: 'v', w: 'E f', h: own, v: 5000, r: 0}, {k: 'inscription', s: 'x|site:G h:field', n: 'v', w: 'G h', h: other, v: 7000, r: 0}, {k: 'chart', s: 'x|site:I j:field', n: '1', w: 'I j', h: null, v: 0, r: 0, m: ['a', 'b']}];
			P.blueprints = [{id: 'alien', size: 2}];
			return {own, other, rep: P.rep[own] || 0, cur: g.home.currency.code};
		});
		await scr(f, 'station'); await scr(f, 'contacts');
		const ui = await f.evaluate(() => { const s = document.getElementById('ptFinds'); return s ? {rows: s.querySelectorAll('.pt-claim').length, sell: s.querySelectorAll('[data-act="artsell"]').length, study: s.querySelectorAll('[data-act="artstudy"]').length, ret: s.querySelectorAll('[data-act="artreturn"]').length, text: s.textContent} : null });
		ok('1. at a port with an artifact broker, Contacts has your Finds: each with what you can do with it (sell a relic, study or recycle a device, return an inscription here from this power\'s space)', ui && ui.rows == 6 && ui.sell == 1 && ui.study == 2 && ui.ret == 1 && /marked 2 ruins/.test(ui.text) && /return it at a port of/.test(ui.text), ui);
		/* a relic sold */
		const w0 = await f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, set.cur);
		await f.click('#ptFinds [data-act="artsell"]'); await sleep(250);
		const r1 = await f.evaluate(c => ({w: EmberDebug.game.P.wallet[c] || 0, n: EmberDebug.game.P.artifacts.length, relic: EmberDebug.game.P.artifacts.some(a => a.k == 'relic')}), set.cur);
		ok('2. the broker buys the relic: paid, and it\'s gone from your finds', r1.w > w0 && r1.n == 5 && !r1.relic, {r1, w0});
		/* a device studied: the build's fee a quarter less */
		const fee0 = await f.evaluate(() => (document.querySelector('[data-act="bpbuild"]') || {}).textContent || '');
		await f.click('#ptFinds [data-act="artstudy"]'); await sleep(250);
		const fee1 = await f.evaluate(() => ({t: (document.querySelector('[data-act="bpbuild"]') || {}).textContent || '', study: EmberDebug.game.P.study}));
		const num = t => +(t.match(/[\d,.]+/g) || ['0']).map(x => x.replace(/,/g, '')).find(x => +x > 0);
		ok('3. a device studied: the next build\'s fee shows a quarter less', fee1.study == 1 && /studied/.test(fee1.t) && Math.abs(num(fee1.t) / num(fee0) - 0.75) < 0.02, {fee0, fee1});
		/* the other device recycled */
		const c0 = await f.evaluate(() => ({a: EmberDebug.game.P.cargo.Artefacts || 0, e: EmberDebug.game.P.cargo.Electronics || 0}));
		await f.click('#ptFinds [data-act="artrecycle"]'); await sleep(250);
		const c1 = await f.evaluate(() => ({a: EmberDebug.game.P.cargo.Artefacts || 0, e: EmberDebug.game.P.cargo.Electronics || 0, dev: EmberDebug.game.P.artifacts.filter(x => x.k == 'device').length}));
		ok('4. a device recycled: 2 t of Artefacts and 1 t of Electronics in the hold', c1.a - c0.a == 2 && c1.e - c0.e == 1 && c1.dev == 0, {c0, c1});
		/* the inscription from this power's space, returned */
		await f.click('#ptFinds [data-act="artreturn"]'); await sleep(250);
		const r4 = await f.evaluate(o => ({rep: EmberDebug.game.P.rep[o] || 0, left: EmberDebug.game.P.artifacts.filter(a => a.k == 'inscription').map(a => a.h)}), set.own);
		ok('5. an inscription returned to the power whose space held its ruin: its standing rises, and it\'s gone', r4.rep > set.rep && r4.left.length == 1 && r4.left[0] == set.other, {r4, rep0: set.rep});
		/* the other inscription sells with the data at the cartographers */
		await scr(f, 'carto');
		const data = await f.evaluate(() => ({txt: document.getElementById('port').textContent.includes('an inscription'), btn: !!document.querySelector('[data-act="selldata"]:not([disabled])')}));
		const w1 = await f.evaluate(c => EmberDebug.game.P.wallet[c] || 0, set.cur);
		await f.click('[data-act="selldata"]'); await sleep(250);
		const r5 = await f.evaluate(c => ({w: EmberDebug.game.P.wallet[c] || 0, insc: EmberDebug.game.P.artifacts.filter(a => a.k == 'inscription').length}), set.cur);
		ok('6. the other inscription is among the data the cartographers buy: sold, paid, gone', data.txt && data.btn && r5.w > w1 && r5.insc == 0, {data, r5, w1});
		/* saved and back */
		const back = await f.evaluate(() => { const P = EmberDebug.game.P, b = EmberSave.unpackPlayer(JSON.parse(JSON.stringify(EmberSave.packPlayer(P)))); return {a: JSON.stringify(b.artifacts) == JSON.stringify(P.artifacts), study: b.study == P.study, n: b.artifacts.length} });
		ok('7. what\'s left of your finds, and the devices studied, are saved and come back', back.a && back.study && back.n == 1, back);
		ok('8. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
