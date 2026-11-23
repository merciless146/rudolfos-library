/* Ember Reach's co-op wing over a network (0.6.0: net.js room(), the relay's protocol 2; docs/plan-ember-reach-pilots.md
   P5a), in node, over real WebSockets to the Node relay: a host and up to three guests, the host's rule (a Hardcore
   host takes Hardcore pilots only), versions, messages to all or one and back with who sent them, guests leaving and
   a seat taken again, a quiet guest let go, the host leaving, and a LAN's one-room relay holding a wing.
     node tests/emberreach_wing_net_t.js [PORT]   (uses PORT and PORT+1) */
const path = require('path');
const PORT = +(process.argv[2] || 8792), DIR = path.join(__dirname, '..', 'tools/duel-relay');
const Net = require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www/net.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
const wait = ms => new Promise(r => setTimeout(r, ms));
/* a member: its room session and what it heard */
function member(url, o) {
	const tr = Net.ws(url, WebSocket), log = {msgs: [], joined: [], left: [], ready: null, end: null, room: null};
	const S = Net.room(tr, Object.assign({ver: '0.6.0'}, o));
	S.on('room', c => { log.room = c }).on('ready', id => { log.ready = id }).on('joined', (id, p) => log.joined.push([id, p])).on('left', (id, why) => log.left.push([id, why]))
		.on('msg', (m, f) => log.msgs.push([f, m])).on('end', e => { log.end = e });
	return {S, log, tr};
}
(async () => {
	const {serve} = await import(path.join(DIR, 'relay.mjs'));
	const R = await serve({port: PORT, host: '127.0.0.1'}), url = `ws://127.0.0.1:${PORT}/`;
	const all = [];
	const mk = (o) => { const m = member(url, o); all.push(m); return m };
	try {
		/* a Hardcore host's wing */
		const admit = p => p.hc == 'on' ? null : {why: 'hardcore'};
		const h = mk({want: 'host', size: 4, admit}); await wait(150);
		const code = h.log.room;
		const g1 = mk({want: 'join', code, pilot: {name: 'Ada', hc: 'on'}}); await wait(120);
		const g2 = mk({want: 'join', code, pilot: {name: 'Bo', hc: 'on'}}); await wait(120);
		const gx = mk({want: 'join', code, pilot: {name: 'Cy', hc: 'none'}}); await wait(150);
		ok('1. a wing\'s host gets a code; Hardcore guests are welcomed (ids 1, 2), the host hears who (their pilots)', Net.validCode(code) && g1.log.ready == 1 && g2.log.ready == 2 && h.log.joined.map(([i, p]) => i + p.name).join() == '1Ada,2Bo', h.log.joined);
		ok('2. a guest without Hardcore is turned away by a Hardcore host, with the reason', gx.log.end && gx.log.end.why == 'hardcore' && /only Hardcore pilots/.test(gx.log.end.text) && !h.log.joined.some(([i, p]) => p.name == 'Cy'), gx.log.end);
		const gv = mk({want: 'join', code, ver: '0.5.9', pilot: {hc: 'on'}}); await wait(150);
		ok('3. a guest on another version is turned away (all must run the same)', gv.log.end && gv.log.end.why == 'wversion' && /same version/.test(gv.log.end.text), gv.log.end);
		/* messages */
		h.S.send({k: 'st', n: 1}); h.S.sendTo(2, {k: 'dm', n: 2}); g1.S.send({k: 'in', n: 3}); await wait(120);
		ok('4. the host sends to the wing, or to one guest; a guest\'s message reaches the host with who sent it', g1.log.msgs.some(([f, m]) => m.k == 'st') && g2.log.msgs.some(([f, m]) => m.k == 'st') && g2.log.msgs.some(([f, m]) => m.k == 'dm') && !g1.log.msgs.some(([f, m]) => m.k == 'dm') && h.log.msgs.some(([f, m]) => f == 1 && m.n == 3), {h: h.log.msgs, g1: g1.log.msgs});
		/* leaving, and a seat taken again */
		g2.S.leave(); await wait(150);
		const g3 = mk({want: 'join', code, pilot: {name: 'Di', hc: 'on'}}); await wait(150);
		ok('5. a guest leaving: the host hears it (id 2), the wing goes on, and a new guest takes the free seat', h.log.left.some(([i]) => i == 2) && g2.log.end.why == 'wmine' && g3.log.ready && !h.log.end, {left: h.log.left, g3: g3.log.ready});
		/* the full wing */
		const g4 = mk({want: 'join', code, pilot: {hc: 'on'}}); await wait(120); const g5 = mk({want: 'join', code, pilot: {hc: 'on'}}); await wait(150);
		ok('6. four pilots at most: the next is told the wing is full', g4.log.ready && g5.log.end && g5.log.end.why == 'wfull' && /four pilots/.test(g5.log.end.text), g5.log.end);
		/* a quiet guest (its clock: a guest that stops talking) */
		let t = 1000; const hq = mk({want: 'host', size: 2, now: () => t}); await wait(120);
		const gq = mk({want: 'join', code: hq.log.room, pilot: {}}); await wait(150);
		gq.tr.onmessage = null; gq.S.tick = () => {}; t += 11; hq.S.tick(); await wait(80);
		ok('7. a guest silent for 10 s is let go by the host', hq.log.left.some(([i, w]) => i == 1 && w == 'lost'), hq.log.left);
		/* the host leaving */
		h.S.leave(); await wait(150);
		ok('8. the host leaving ends the wing for every guest, with the reason', [g1, g3, g4].every(g => g.log.end && g.log.end.why == 'wleft' && /host left/.test(g.log.end.text)), [g1, g3, g4].map(g => g.log.end));
		/* a LAN's one-room relay holds a wing too */
		const L = await serve({port: PORT + 1, host: '127.0.0.1', lan: 'WNGHAN'}), lurl = `ws://127.0.0.1:${PORT + 1}/`;
		const lh = member(lurl, {want: 'host', size: 3}); await wait(120);
		const lg = [member(lurl, {want: 'join', code: 'WNGHAN', pilot: {}}), member(lurl, {want: 'join', code: 'WNGHAN', pilot: {}})]; await wait(200);
		ok('9. a LAN\'s one-room relay (as Rudolf OS\'s) holds a wing: its fixed code, two guests seated', lh.log.room == 'WNGHAN' && lg.every(g => g.log.ready), lg.map(g => g.log));
		for (const m of [lh, ...lg]) m.S.leave(); await wait(80); L.server.close();
		/* a duel is as it was beside it */
		const dh = Net.session(Net.ws(url, WebSocket), {ver: '0.6.0', want: 'host', ship: 'kestrel'}), dlog = {};
		dh.on('room', c => { dlog.code = c }); await wait(120);
		const dg = Net.session(Net.ws(url, WebSocket), {ver: '0.6.0', want: 'join', code: dlog.code, ship: 'kestrel'}); dg.on('ready', p => { dlog.ready = p }); await wait(200);
		ok('10. duels (protocol 1) still pair as before beside wings', dlog.ready && dlog.ready.ship == 'kestrel', dlog);
		dh.leave(); dg.leave();
	} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
	for (const m of all) try { m.S.leave() } catch (e) {}
	await wait(80); R.server.close();
	console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
})();
