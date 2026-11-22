/* Ember Reach's duel relay (tools/duel-relay, 0.5.2): its rules on a stand-in clock (rooms, quick match, versions, what
   is passed on, the limits, idle and unjoined rooms, leaving), relay.js over real WebSockets (bad handshakes and frames
   too), and worker.js in Cloudflare's own runtime (workerd, through Miniflare) when Miniflare can be found on NODE_PATH
   (otherwise that part is SKIP: the Library's checks don't install it). Local only: nothing is deployed.
     node tests/emberreach_relay_t.js [PORT]   (PORT for relay.js, PORT+1 for the worker) */
const path = require('path'), net = require('net'), fs = require('fs'), os = require('os');
const TOP = path.join(__dirname, '..'), R = path.join(TOP, 'tools/duel-relay');
const {createRelay, ALPHABET} = require(path.join(R, 'relay-core.js'));
const Nt = require(path.join(TOP, 'apps/rudolf-emberreach/www/net.js'));
const PORT = +(process.argv[2] || 8770);
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + (typeof d == 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')) } };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(f, ms) { for (let t = 0; t < (ms || 3000); t += 20) { if (f()) return true; await wait(20) } return false }

/* a client of the core, recording what it is sent */
function client(R, address) {
	const c = {got: [], closed: false, raw: []};
	c.h = R.connect({address: address == null ? '203.0.113.' + Math.floor(Math.random() * 250) : address, send: t => { c.raw.push(t); c.got.push(JSON.parse(t)) }, close: () => { c.closed = true }});
	c.send = o => c.h.message(typeof o == 'string' ? o : JSON.stringify(o));
	c.last = () => c.got[c.got.length - 1];
	c.err = () => (c.got.find(m => m.t == 'error') || {}).why;
	return c;
}
const V = '0.5.2';
function rules() {
	let T = 1000; const now = () => T;
	/* rooms */
	{
		const Rl = createRelay({now});
		const hs = []; for (let i = 0; i < 50; i++) { const h = client(Rl); h.send({t: 'host', v: V, proto: 1}); hs.push(h) }
		const codes = hs.map(h => h.last().code);
		ok('1. hosting: a six-letter code from the relay\'s alphabet (no 0/O, 1/I), each one different', codes.every(c => c.length == 6 && [...c].every(x => ALPHABET.includes(x))) && new Set(codes).size == 50 && !/[01IO]/.test(ALPHABET), codes.slice(0, 5));
		const g = client(Rl); g.send({t: 'join', code: codes[3].toLowerCase(), v: V, proto: 1});
		ok('2. joining with the code (any case): both told, host and guest; the room is gone from the list', hs[3].last().t == 'paired' && hs[3].last().role == 'host' && g.last().role == 'guest' && Rl.stats().rooms == 49, [hs[3].last(), g.last()]);
		const g2 = client(Rl); g2.send({t: 'join', code: codes[3], v: V, proto: 1});
		ok('3. a third pilot with the same code: no room waiting (refused, closed)', g2.err() == 'room' && g2.closed);
		const msg = '{"t":"st","r":1,"s":{"p":[1.25,2,3]},"note":"\\u00e9 ✓"}'; g.send(msg);
		ok('4. after pairing a message reaches the other exactly as it was sent', hs[3].raw[hs[3].raw.length - 1] === msg, hs[3].raw.slice(-1));
		const before = hs[3].got.length; g.send({t: 'gone'});
		ok('5. ...but not one that pretends to be the relay\'s own ("gone"): refused; the other is told the pilot has gone', g.err() == 'bad' && hs[3].got.slice(before).some(m => m.t == 'gone') && hs[3].closed && g.closed);
		const all = hs.concat([g, g2]).flatMap(c => c.raw).join('\n');
		ok('6. nothing the relay sends carries an address', !/203\.0\.113\.|address/.test(all));
		const bad = [[{t: 'join', code: codes[5], v: '0.5.1', proto: 1}, 'version'], [{t: 'host', v: V, proto: 2}, 'proto'], [{t: 'host', v: '<b>x</b>', proto: 1}, 'bad'], [{t: 'dance', v: V, proto: 1}, 'bad'], ['not json', 'bad'], [{t: 'join', code: 'ZZZZZZ', v: V, proto: 1}, 'room'], ['[1,2]', 'bad']];
		const got = bad.map(([m, w]) => { const c = client(Rl); c.send(m); return [c.err(), w, c.closed, c.got[0] && c.got[0].text] });
		ok('7. refusals with a reason and a sentence, the connection closed: another version (both named), protocol, a bad version string, an unknown message, not JSON, no such room', got.every(([a, b, cl]) => a == b && cl) && /0\.5\.2.*0\.5\.1/.test(got[0][3]), got);
		const h1 = hs[7]; h1.send({t: 'host', v: V, proto: 1});
		ok('8. a pilot waiting in a room may say nothing more but ping', h1.err() == 'bad');
		for (const c of hs) c.h.closed();
		ok('9. everyone gone: nothing kept', (s => s.clients == 0 && s.rooms == 0 && s.queued == 0 && s.addresses == 0)(Rl.stats()), Rl.stats());
	}
	/* quick match */
	{
		const Rl = createRelay({now});
		const a = client(Rl), b = client(Rl), c = client(Rl), d = client(Rl);
		a.send({t: 'quick', v: V, proto: 1}); b.send({t: 'quick', v: '0.5.1', proto: 1});
		const q = a.last().t == 'queued' && b.last().t == 'queued';
		c.send({t: 'quick', v: V, proto: 1});
		const p1 = a.last().role == 'host' && c.last().role == 'guest' && b.last().t == 'queued';
		d.send({t: 'quick', v: '0.5.1', proto: 1});
		ok('10. quick match: each waits ("queued") for the next pilot of its own version, then they are paired', q && p1 && b.last().role == 'host' && d.last().role == 'guest' && Rl.stats().queued == 0);
		const e = client(Rl); e.send({t: 'quick', v: V, proto: 1}); e.h.closed();
		const f = client(Rl); f.send({t: 'quick', v: V, proto: 1});
		ok('11. one who left the queue is not paired with', f.last().t == 'queued' && Rl.stats().queued == 1);
	}
	/* time: idle, a waiting room kept by pings, an unjoined room closed */
	{
		const Rl = createRelay({now});
		const s = client(Rl), h = client(Rl); s.send({t: 'quick', v: V, proto: 1}); h.send({t: 'host', v: V, proto: 1});
		for (let i = 0; i < 4; i++) { T += 20; h.send({t: 'ping'}); Rl.sweep() }
		ok('12. silent for over a minute: closed ("idle"); a waiting host that pings every 20 s keeps its room', s.err() == 'idle' && s.closed && !h.closed && Rl.stats().rooms == 1);
		for (let i = 0; i < 27; i++) { T += 20; h.send({t: 'ping', n: 0}); Rl.sweep() }
		ok('13. ...but a room nobody joins closes after 10 minutes', h.err() == 'idle' && /ten minutes/.test(h.got.find(m => m.t == 'error').text) && Rl.stats().rooms == 0);
	}
	/* limits */
	{
		const Rl = createRelay({now, limits: {maxClients: 5, perAddress: 2, maxRooms: 2}});
		const x1 = client(Rl, '198.51.100.1'), x2 = client(Rl, '198.51.100.1'), x3 = client(Rl, '198.51.100.1');
		ok('14. a third connection from one address (the limit here 2; 8 by default): refused ("busy")', x3.err() == 'busy' && !x1.closed && !x2.closed);
		const r1 = client(Rl), r2 = client(Rl); r1.send({t: 'host', v: V, proto: 1}); r2.send({t: 'host', v: V, proto: 1}); x1.send({t: 'host', v: V, proto: 1});
		ok('15. rooms past the limit: refused ("busy")', x1.err() == 'busy' && r1.last().t == 'room' && r2.last().t == 'room');
		const y1 = client(Rl), y2 = client(Rl), z = client(Rl);
		ok('16. connections past the relay\'s limit (5 here, 400 by default): refused ("busy")', z.err() == 'busy' && !y1.closed && !y2.closed && Rl.stats().clients == 5, Rl.stats());
		const R2 = createRelay({now}), a = client(R2), b = client(R2); a.send({t: 'quick', v: 'r', proto: 1}); b.send({t: 'quick', v: 'r', proto: 1});
		for (let i = 0; i < 238; i++) a.send({t: 'st', i});
		const fine = !a.closed; T += 1; for (let i = 0; i < 100; i++) a.send({t: 'st', i});
		const after = !a.closed; for (let i = 0; i < 200; i++) a.send({t: 'st', i});
		ok('17. rate: 240 at once, then 120 a second; past that, refused ("rate") and the other told', fine && after && a.err() == 'rate' && b.got.some(m => m.t == 'gone'));
		const c = client(R2); c.send('{"t":"host","v":"0.5.2","proto":1,"x":"' + 'y'.repeat(8200) + '"}');
		ok('18. a message over 8 KB: refused ("size")', c.err() == 'size' && c.closed);
	}
}

/* relay.js on a port */
function raw(port) {
	return new Promise(res => {
		const s = net.connect(port, '127.0.0.1'); const r = {s, data: Buffer.alloc(0), closed: false};
		s.on('data', d => { r.data = Buffer.concat([r.data, d]) }); s.on('close', () => { r.closed = true }); s.on('error', () => {});
		s.on('connect', () => res(r));
	});
}
const KEY = 'dGhlIHNhbXBsZSBub25jZQ==';
const hs = (path, extra) => 'GET ' + path + ' HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' + (extra == null ? 'Sec-WebSocket-Key: ' + KEY + '\r\nSec-WebSocket-Version: 13\r\n' : extra) + '\r\n';
function frame(op, data, o) {
	o = o || {}; const p = Buffer.from(data), n = p.length, mask = Buffer.from([1, 2, 3, 4]);
	const h = n < 126 ? Buffer.from([(o.fin === false ? 0 : 0x80) | op, (o.unmasked ? 0 : 0x80) | n]) : Buffer.from([(o.fin === false ? 0 : 0x80) | op, (o.unmasked ? 0 : 0x80) | 126, n >> 8, n & 255]);
	const b = Buffer.from(p); if (!o.unmasked) for (let i = 0; i < n; i++) b[i] ^= mask[i & 3];
	return Buffer.concat(o.unmasked ? [h, b] : [h, mask, b]);
}
/* the text frames a server sent (after its 101) */
function texts(buf) {
	const i = buf.indexOf('\r\n\r\n'); let b = buf.subarray(i + 4); const out = [];
	while (b.length >= 2) { const op = b[0] & 15; let n = b[1] & 127, o = 2; if (n == 126) { n = b.readUInt16BE(2); o = 4 } if (b.length < o + n) break; out.push({op, t: b.subarray(o, o + n).toString()}); b = b.subarray(o + n) }
	return out;
}
async function overSockets() {
	const srv = require(path.join(R, 'relay.js')).serve();
	await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
	try {
		const get = p => new Promise(res => require('http').get('http://127.0.0.1:' + PORT + p, r => { let d = ''; r.on('data', x => d += x); r.on('end', () => res([r.statusCode, d])) }));
		const [c1, b1] = await get('/'), [c2] = await get('/elsewhere');
		const a = await raw(PORT); a.s.write(hs('/other')); const b = await raw(PORT); b.s.write(hs('/duel', 'Sec-WebSocket-Version: 13\r\n'));
		await until(() => a.closed && b.closed, 2000);
		ok('19. relay.js: its page says what it is; anything but a WebSocket at / or /duel is refused (another path, no key)', c1 == 200 && /duel relay/.test(b1) && c2 == 404 && /^HTTP\/1\.1 400/.test(a.data.toString()) && /^HTTP\/1\.1 400/.test(b.data.toString()));
		const c = await raw(PORT); c.s.write(hs('/duel')); await until(() => c.data.indexOf('\r\n\r\n') > 0);
		const acc = /Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK\+xOo=/.test(c.data.toString());
		c.s.write(frame(9, 'hi')); c.s.write(frame(1, '{"t":"host","v":"0.5.', {fin: false})); c.s.write(frame(0, '2","proto":1}'));
		await until(() => texts(c.data).length >= 2);
		const tc = texts(c.data);
		ok('20. a WebSocket (RFC 6455\'s own example key accepted): a ping answered, a message in two frames put together (hosting: a room)', acc && tc[0].op == 10 && tc[0].t == 'hi' && tc[1].op == 1 && JSON.parse(tc[1].t).t == 'room', tc);
		const d = await raw(PORT); d.s.write(hs('/')); await until(() => d.data.length > 0); d.s.write(frame(1, '{"t":"quick"}', {unmasked: true}));
		const e = await raw(PORT); e.s.write(hs('/')); await until(() => e.data.length > 0); e.s.write(frame(2, 'abc'));
		const f = await raw(PORT); f.s.write(hs('/')); await until(() => f.data.length > 0); f.s.write(frame(1, 'x'.repeat(9000)));
		await until(() => d.closed && e.closed && f.closed, 3000);
		ok('21. closed: an unmasked frame (not a browser\'s), a binary one, one over 8 KB', d.closed && e.closed && f.closed);
		for (const x of [c]) x.s.destroy();
		/* two games, with the game's own net.js */
		const ev = [], h = Nt.connect(Nt.ws('ws://127.0.0.1:' + PORT + '/duel'), {v: V, mode: 'host'}, {room: k => ev.push(['room', k]), ready: () => ev.push(['ready']), peer: m => ev.push(['peer', m]), close: w => ev.push(['close', w])});
		await until(() => ev.some(e => e[0] == 'room'));
		const gv = [], g = Nt.connect(Nt.ws('ws://127.0.0.1:' + PORT + '/duel'), {v: V, mode: 'join', code: ev.find(e => e[0] == 'room')[1]}, {ready: () => gv.push('ready'), close: w => gv.push('close ' + w)});
		await until(() => gv.includes('ready') && ev.some(e => e[0] == 'ready'));
		g.send({t: 'shot', s: {k: 'pulse'}}); await until(() => ev.some(e => e[0] == 'peer'));
		g.close('left'); await until(() => ev.some(e => e[0] == 'close'));
		ok('22. two games (net.js): host, join, a shot through, the guest leaving told to the host', ev.some(e => e[0] == 'peer' && e[1].t == 'shot') && (ev.find(e => e[0] == 'close') || [])[1] == 'gone', ev);
		await wait(100);
		ok('23. relay.js forgets them', (s => s.clients == 0 && s.rooms == 0)(srv.relay.stats()), srv.relay.stats());
	} finally { srv.close() }
}

/* worker.js in workerd (Miniflare), bundled as wrangler would (esbuild) */
async function inWorkerd() {
	let Miniflare, esbuild;
	try { ({Miniflare} = require('miniflare')); esbuild = require('esbuild') } catch (e) { console.log('SKIP 24-27. worker.js in workerd: Miniflare and esbuild are not on NODE_PATH (npm i miniflare esbuild in a folder of your own)'); return }
	const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'relayw-')), 'worker.mjs');
	await esbuild.build({entryPoints: [path.join(R, 'worker.js')], bundle: true, format: 'esm', outfile: out, logLevel: 'silent'});
	const mf = new Miniflare({modules: true, script: fs.readFileSync(out, 'utf8'), durableObjects: {RELAY: 'Relay'}, compatibilityDate: '2026-08-01', host: '127.0.0.1', port: PORT + 1});
	try {
		const base = await mf.ready, url = 'ws://127.0.0.1:' + (PORT + 1) + '/duel';
		const home = await (await fetch(base.href)).text(), plain = await fetch(new URL('/duel', base)).then(r => r.status);
		ok('24. worker.js in workerd: its page, and /duel only as a WebSocket (426 otherwise)', /duel relay/.test(home) && plain == 426, [home, plain]);
		const sess = (o) => { const ev = []; const S = Nt.connect(Nt.ws(url), Object.assign({v: V}, o), {room: k => ev.push(['room', k]), paired: r => ev.push(['paired', r]), ready: () => ev.push(['ready']), peer: m => ev.push(['peer', m]), error: (w, t) => ev.push(['error', w, t]), close: w => ev.push(['close', w])}); S.ev = ev; S.has = k => ev.find(e => e[0] == k); return S };
		const h = sess({mode: 'host'}); await until(() => h.has('room'), 5000);
		const bad = sess({mode: 'join', code: h.has('room')[1], v: '0.5.1'}); await until(() => bad.has('close'), 5000);
		const g = sess({mode: 'join', code: h.has('room')[1]}); await until(() => h.has('ready') && g.has('ready'), 5000);
		h.send({t: 'st', r: 1, x: 7}); await until(() => g.has('peer'), 3000);
		ok('25. ...a room: another version refused with the message; the same version joins; a message through', bad.has('error') && bad.has('error')[1] == 'version' && /0\.5\.1/.test(bad.has('error')[2]) && g.has('peer') && g.has('peer')[1].x == 7, {h: h.ev, bad: bad.ev, g: g.ev});
		const q1 = sess({mode: 'quick'}), q2 = sess({mode: 'quick'}); await until(() => q1.has('ready') && q2.has('ready'), 5000);
		ok('26. ...quick match pairs two of the same version', q1.role && q2.role && q1.role != q2.role, [q1.ev, q2.ev]);
		g.close('left'); await until(() => h.has('close'), 5000);
		ok('27. ...one leaving: the other told ("gone")', h.has('close') && h.has('close')[1] == 'gone', h.ev);
		q1.close(); q2.close(); h.close();
	} finally { await mf.dispose() }
}

(async () => {
	try { rules(); await overSockets(); await inWorkerd() } catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
	console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
})();
