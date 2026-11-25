/* Ember Reach's mouse flight, in Chromium (Playwright) (0.7.5): with mouse flight on, the pointer to the right of the
   centre yaws the ship (its nose swings right, its up stays) by default; with the setting on Roll it rolls instead
   (its nose stays, its up turns); the pointer below the centre pitches the nose down, or up with pitch inverted.
     node tests/emberreach_mouse_browser_t.js [PORT] */
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const PORT = +(process.argv[2] || 8684), RELAY = PORT + 1, TOP = path.join(__dirname, '..');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'erms-'));
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
		/* the ship's axes, and how far each turns in a while with the pointer held off the centre */
		const turn = (dx, dy, set) => A.f.evaluate(([dx, dy, set]) => new Promise(done => {
			const g = EmberDebug.game, s = EmberDebug.s, c = g.settings.controls, ax = v => EmberFlight.toWorld(s.q, v);
			Object.assign(c, set); g.mouseFly = true; s.w = [0, 0, 0];
			const cv = document.querySelector('canvas'), W = cv.clientWidth, H = cv.clientHeight;
			g.ptr = {x: W / 2 + dx * W / 2, y: H / 2 + dy * H / 2, touch: false};
			const f0 = ax([0, 0, 1]), u0 = ax([0, 1, 0]), r0 = ax([1, 0, 0]);
			setTimeout(() => { const f1 = ax([0, 0, 1]), u1 = ax([0, 1, 0]), d = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
				g.mouseFly = false; g.ptr = null; s.w = [0, 0, 0];
				done({nose: d(f0, f1), up: d(u0, u1), right: f1[0] * r0[0] + f1[1] * r0[1] + f1[2] * r0[2], down: -(f1[0] * u0[0] + f1[1] * u0[1] + f1[2] * u0[2])}) }, 900);
		}), [dx, dy, set]);
		const yaw = await turn(0.6, 0, {mouseRoll: false, invertMouse: false});
		ok('1. by default, the pointer right of the centre yaws: the nose swings toward it, the ship\'s up stays', yaw.nose > 3 && yaw.right > 0.04 && yaw.up < yaw.nose * 0.25, yaw);
		const roll = await turn(0.6, 0, {mouseRoll: true, invertMouse: false});
		ok('2. with the setting on Roll, it rolls instead: the nose stays, the ship\'s up turns', roll.up > 3 && roll.nose < roll.up * 0.25, roll);
		const pdown = await turn(0, 0.6, {mouseRoll: false, invertMouse: false}), pinv = await turn(0, 0.6, {mouseRoll: false, invertMouse: true});
		ok('3. the pointer below the centre pitches the nose one way, and the other with pitch inverted', pdown.nose > 3 && pinv.nose > 3 && Math.sign(pdown.down) == -Math.sign(pinv.down) && Math.abs(pdown.down) > 0.04, {pdown, pinv});
		ok('4. no errors', errs.length == 0, errs);
	} catch (e) { F++; console.log('FAIL (threw) ' + (e.stack || e)) }
	await br.close(); srv.kill();
	console.log(P + '/' + (P + F) + ' passed'); process.exit(F ? 1 : 0);
})();
