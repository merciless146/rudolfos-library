/* The duel relay (tools/duel-relay, Ember Reach 0.5.2), in node: the Node relay over real WebSockets (room codes,
   joining, quick match, the versions checked, messages passed as they are, the other told when one goes, no address
   ever passed on, the size, rate and per-address limits, a LAN's one-room relay), the protocol's timers (a fake
   clock), and the Cloudflare Worker (worker.mjs, its Durable Objects run here on a stand-in for Workers' runtime).
   (0.6.0) Protocol 2's co-op rooms of up to four, in both.
     node tests/emberreach_duel_relay_t.js [PORT]   (uses PORT and PORT+1) */
const path = require('path');
const PORT = +(process.argv[2] || 8790), DIR = path.join(__dirname, '..', 'tools/duel-relay');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d) : '')) } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const hello = o => JSON.stringify(Object.assign({t: 'hello', proto: 1, game: 'ember-reach', ver: '0.5.2'}, o));
/* a player: a WebSocket and everything it heard */
function player(url) {
	const w = new WebSocket(url), p = {w, got: [], raw: [], closed: false};
	w.onmessage = e => { p.raw.push(e.data); try { p.got.push(JSON.parse(e.data)) } catch (x) { p.got.push(e.data) } };
	w.onclose = () => { p.closed = true };
	p.open = new Promise(res => { w.onopen = res; w.onerror = () => { p.closed = true; res() } });
	p.send = o => w.send(typeof o == 'string' ? o : JSON.stringify(o));
	p.last = () => p.got[p.got.length - 1];
	return p;
}
const IP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|::1|::ffff/;
(async () => {
	const {serve} = await import(path.join(DIR, 'relay.mjs'));
	const {Lobby, LIMITS} = await import(path.join(DIR, 'protocol.mjs'));
	const R = await serve({port: PORT, host: '127.0.0.1'}), url = `ws://127.0.0.1:${PORT}/?want=x`;
	const everyone = [];
	const pl = async () => { const p = player(url); everyone.push(p); await p.open; return p };
	try {
		/* codes */
		const a = await pl(); a.send(hello({want: 'host'})); await wait(80);
		const code = a.last().code, b = await pl(); b.send(hello({want: 'join', code})); await wait(80);
		ok('1. hosting gives a six-letter room code; joining with it pairs the two (host and guest)', a.got[0].t == 'room' && /^[A-HJKMNP-Z2-9]{6}$/.test(code) && a.last().t == 'paired' && a.last().role == 'host' && b.last().t == 'paired' && b.last().role == 'guest', {a: a.got, b: b.got});
		const msg = '{"t":"g","k":"st","n":1,"me":{"p":[1,2,3]}}';
		a.send(msg); b.send({t: 'g', k: 'in', n: 7}); await wait(80);
		ok('2. once paired, the game\'s messages pass to the other as they are', b.raw.includes(msg) && a.got.some(m => m.k == 'in' && m.n == 7), {a: a.raw, b: b.raw});
		const c = await pl(); c.send(hello({want: 'join', code})); const d = await pl(); d.send(hello({want: 'join', code: 'ZZZZZZ'})); const e = await pl(); e.send(hello({want: 'join', code: 'abc'})); await wait(100);
		ok('3. a third player can\'t join a full duel; an unknown or malformed code is "no duel with that code"; each is closed', c.got[0].why == 'full' && d.got[0].why == 'room' && e.got[0].why == 'room' && c.closed && d.closed && e.closed, [c.got, d.got, e.got]);
		b.w.close(); await wait(100);
		ok('4. one goes: the other is told ("left") and let go; the room is gone (joining it again: no such duel)', a.last().t == 'left' && a.closed && R.lobby.rooms.size == 0, a.got.slice(-2));
		/* versions */
		const f = await pl(); f.send(hello({want: 'host', ver: '0.5.2'})); await wait(60);
		const g = await pl(); g.send(hello({want: 'join', ver: '0.5.1', code: f.last().code})); await wait(60);
		ok('5. both versions checked: a 0.5.1 game can\'t join a 0.5.2 one ("version", and which the room runs)', g.got[0].t == 'error' && g.got[0].why == 'version' && g.got[0].ver == '0.5.2' && g.closed && f.last().t == 'room', g.got);
		f.w.close();
		/* quick match */
		const q1 = await pl(); q1.send(hello({want: 'quick', ver: '0.5.2'})); const q2 = await pl(); q2.send(hello({want: 'quick', ver: '0.5.1'})); await wait(60);
		const q3 = await pl(); q3.send(hello({want: 'quick', ver: '0.5.2'})); await wait(80);
		ok('6. quick match: the first waits; a game of another version doesn\'t pair with it (it waits too); the next of the same version does', q1.got[0].t == 'wait' && q2.got[0].t == 'wait' && q1.last().role == 'host' && q3.last().role == 'guest' && q2.got.length == 1, [q1.got, q2.got, q3.got]);
		q3.send({t: 'g', k: 'hi', ver: '0.5.2'}); await wait(60);
		ok('7. ... and they talk as a code\'s pair do', q1.got.some(m => m.k == 'hi'), q1.got);
		/* bad hellos */
		const h1 = await pl(); h1.send('not json'); const h2 = await pl(); h2.send(hello({want: 'host', game: 'chess'})); const h3 = await pl(); h3.send(hello({want: 'host', proto: 2})); const h4 = await pl(); h4.send(hello({want: 'host'})); await wait(40); h4.send(hello({want: 'host'})); await wait(60);
		ok('8. anything but a good hello is refused ("bad") and closed: not JSON, another game, another protocol, a second hello', [h1, h2, h3].every(h => h.got[0].why == 'bad' && h.closed) && h4.last().why == 'bad' && h4.closed, [h1.got, h2.got, h3.got, h4.got]);
		/* limits */
		const l1 = await pl(); l1.send(hello({want: 'host'})); await wait(40); l1.send('{"t":"g","x":"' + 'x'.repeat(9000) + '"}'); await wait(80);
		const l2 = await pl(); l2.send(hello({want: 'host'})); await wait(40); for (let i = 0; i < 400; i++) l2.send('{"t":"g","k":"st"}'); await wait(150);
		ok('9. limits: a message over 8 KB, or hundreds in a moment, close the connection', l1.closed && l2.closed && l2.got.some(m => m.why == 'limit'), {l1: [l1.closed, l1.got], l2: [l2.closed, l2.got.slice(-1)]});
		const many = []; for (let i = 0; i < LIMITS.perIp + 1; i++) many.push(player(url));
		await Promise.all(many.map(m => m.open)); await wait(100);
		ok('10. at most ' + LIMITS.perIp + ' connections from one address at once (the next is refused)', many.filter(m => m.closed).length >= 1 && many.filter(m => !m.closed).length <= LIMITS.perIp, many.map(m => m.closed));
		for (const m of many) m.w.close();
		await wait(100);
		/* privacy */
		const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).text(), heard = everyone.flatMap(p => p.raw).join('\n') + health;
		ok('11. no player is ever told an address (nothing any player heard, nor /health, holds one)', !IP.test(heard) && /"rooms"/.test(health), heard.match(IP));
		/* a LAN's one room */
		const L = await serve({port: PORT + 1, host: '127.0.0.1', lan: 'HANDUE'}), lurl = `ws://127.0.0.1:${PORT + 1}/`;
		const la = player(lurl), lb = player(lurl), lc = player(lurl); await Promise.all([la.open, lb.open, lc.open]);
		la.send(hello({want: 'host'})); await wait(50); lc.send(hello({want: 'host'})); lb.send(hello({want: 'join', code: 'HANDUE'})); await wait(80);
		ok('12. a LAN\'s relay holds one room, its code fixed (as Rudolf OS\'s duel service): the host gets it, a second host is turned away ("busy"), the other joins', la.got[0].code == 'HANDUE' && lc.got[0].why == 'busy' && la.last().role == 'host' && lb.last().role == 'guest', [la.got, lb.got, lc.got]);
		la.w.close(); lb.w.close(); L.server.close();
		/* the timers, on a fake clock */
		{
			let T = 0; const lob = new Lobby({now: () => T}), out = [], sock = n => ({send: t => out.push([n, t]), close: () => out.push([n, 'closed'])});
			const s1 = lob.connect(sock('mute')), s2 = lob.connect(sock('host')); lob.message(s2, hello({want: 'host'}));
			T = 11; lob.sweep();
			const s3 = lob.connect(sock('join')); lob.message(s3, hello({want: 'join', code: s2.room && s2.room.code})); const paired = !!s2.room.guest;
			T = 50; lob.message(s2, '{"t":"g"}'); T = 80; lob.sweep();
			const s4 = lob.connect(sock('lonely')); lob.message(s4, hello({want: 'quick'})); T = 80 + 601; lob.sweep();
			const said = n => out.filter(o => o[0] == n).map(o => o[1]);
			ok('13. the timers: no hello in 10 s, a paired player silent for 60 s (the other told), a room waiting 10 minutes: each closed', said('mute').some(t => /"time"/.test(t)) && paired && said('join').some(t => /"time"/.test(t)) && said('host').includes('{"t":"left"}') && said('lonely').some(t => /"time"/.test(t)) && lob.rooms.size == 0 && lob.clients.size == 0, out);
		}
		/* ---- (0.6.0) protocol 2: co-op rooms of up to four ---- */
		{
			const h2 = o => hello(Object.assign({proto: 2, ver: '0.6.0'}, o));
			const ch = await pl(); ch.send(h2({want: 'host', size: 4})); await wait(60);
			const ccode = ch.got[0].code, gs = [];
			for (let i = 0; i < 3; i++) { const g = await pl(); g.send(h2({want: 'join', code: ccode})); gs.push(g); await wait(40) }
			const g4 = await pl(); g4.send(h2({want: 'join', code: ccode})); await wait(60);
			ok('20. a co-op room (protocol 2, size 4): three guests join with ids 1, 2, 3 and the size; the host hears each join; a fourth guest is turned away ("full")', ch.got[0].t == 'room' && gs.map(g => g.last().t + g.last().id + g.last().size).join() == 'paired14,paired24,paired34'
				&& ch.got.filter(m => m.t == 'joined').map(m => m.id).join() == '1,2,3' && g4.got[0].why == 'full' && g4.closed, {host: ch.got, g4: g4.got});
			ch.send({t: 'g', k: 'st', n: 1}); ch.send('{"t":"g","to":2,"k":"dm","n":2}'); await wait(60);
			ok('21. the host\'s messages go to every guest; one beginning "to":2 goes to guest 2 only', gs.every(g => g.got.some(m => m.k == 'st')) && gs.map(g => g.got.some(m => m.k == 'dm') ? 1 : 0).join() == '0,1,0', gs.map(g => g.got));
			gs[0].send({t: 'g', k: 'in', n: 7}); gs[2].send({t: 'g', k: 'in', n: 9}); await wait(60);
			const fromHost = ch.got.filter(m => m.k == 'in');
			ok('22. a guest\'s messages go to the host only, with who sent it ("f"); the other guests don\'t hear them', fromHost.map(m => m.f + ':' + m.n).join() == '1:7,3:9' && !gs[1].got.some(m => m.k == 'in'), {fromHost, g2: gs[1].got});
			gs[1].w.close(); await wait(80);
			const g5 = await pl(); g5.send(h2({want: 'join', code: ccode})); await wait(60);
			ok('23. a guest leaving: the host is told which ({t:left, id: 2}); the room stays open, and a new guest takes the free seat (id 2)', ch.got.some(m => m.t == 'left' && m.id == 2) && !ch.closed && g5.last().id == 2 && !gs[0].closed, ch.got.filter(m => m.t != 'g'));
			ch.w.close(); await wait(80);
			ok('24. the host leaving: every guest is told and let go; the room closes', [gs[0], gs[2], g5].every(g => g.last().t == 'left' && g.closed));
			const b1 = await pl(); b1.send(h2({want: 'quick'})); const b2 = await pl(); b2.send(h2({want: 'host', size: 5})); const b3 = await pl(); b3.send(h2({want: 'host'}));
			const d1 = await pl(); d1.send(hello({want: 'host'})); await wait(60); const d2 = await pl(); d2.send(h2({want: 'join', code: d1.got[0].code})); await wait(60);
			ok('25. refused: quick match in protocol 2 (duels only), a size of 5 or none; a co-op guest can\'t join a duel\'s room', [b1, b2, b3].every(b => b.got[0].why == 'bad' && b.closed) && d2.got[0].why == 'room', [b1.got, b2.got, b3.got, d2.got]);
		}
		/* ---- the Cloudflare Worker, on a stand-in for its runtime ---- */
		{
			class FakeWS {
				constructor() { this.ls = {}; this.closed = false }
				accept() { this.accepted = true }
				addEventListener(n, f) { (this.ls[n] = this.ls[n] || []).push(f) }
				emit(n, e) { for (const f of this.ls[n] || []) f(e) }
				send(t) { if (this.closed) throw new Error('closed'); const o = this.other; setTimeout(() => o.emit('message', {data: t}), 0) }
				close() { if (this.closed) return; this.closed = true; const o = this.other; setTimeout(() => { o.closed = true; o.emit('close', {}); this.emit('close', {}) }, 0) }
			}
			globalThis.WebSocketPair = function () { const a = new FakeWS(), b = new FakeWS(); a.other = b; b.other = a; this[0] = a; this[1] = b };
			const RealResponse = Response, RealRequest = Request;
			globalThis.Response = class { constructor(body, init) { this.body = body; this.status = (init && init.status) || 200; this.webSocket = init && init.webSocket; this.headers = new Headers(init && init.headers) } async json() { return JSON.parse(this.body) } async text() { return String(this.body) } };
			globalThis.Request = class { constructor(u, init) { this.url = u; this.headers = new Headers(init && init.headers); this._b = init && init.body; this.method = (init && init.method) || 'GET' } async json() { return JSON.parse(this._b) } };
			const W = await import(path.join(DIR, 'worker.mjs'));
			const ns = Cls => { const objs = new Map(); return {idFromName: n => n, get: id => { if (!objs.has(id)) objs.set(id, new Cls({}, env)); const o = objs.get(id); return {fetch: (u, init) => o.fetch(typeof u == 'string' ? new Request(u, init) : u)} }, objs} };
			const env = {}; env.ROOMS = ns(W.DuelRoom); env.QUEUE = ns(W.DuelQueue);
			const connect = async q => {
				const res = await W.default.fetch(new Request('https://relay.example/?' + q, {headers: {Upgrade: 'websocket'}}), env);
				const ws = res.webSocket, p = {got: [], closed: false, res}; if (!ws) return p;
				ws.accept(); ws.addEventListener('message', e => p.got.push(JSON.parse(e.data))); ws.addEventListener('close', () => { p.closed = true });
				p.send = o => ws.send(typeof o == 'string' ? o : JSON.stringify(o)); p.close = () => ws.close(); p.last = () => p.got[p.got.length - 1];
				return p;
			};
			const about = await W.default.fetch(new Request('https://relay.example/'), env);
			const wa = await connect('want=host&ver=0.5.2'); wa.send(hello({want: 'host'})); await wait(20);
			const wcode = wa.last().code, wb = await connect('want=join&ver=0.5.2&code=' + wcode); wb.send(hello({want: 'join', code: wcode})); await wait(20);
			wa.send({t: 'g', k: 'st', n: 3}); await wait(20);
			ok('14. the Worker: a host\'s connection goes to a new match\'s Durable Object (its code), the guest\'s by the code to the same one; paired; messages pass (101, a WebSocket)', wa.res.status == 101 && /^[A-HJKMNP-Z2-9]{6}$/.test(wcode) && env.ROOMS.objs.has(wcode) && wb.last().k == 'st' && wa.got.some(m => m.t == 'paired' && m.role == 'host') && (await about.text()).includes('duel relay'), {a: wa.got, b: wb.got});
			const wv = await connect('want=join&ver=0.5.1&code=' + wcode); wv.send(hello({want: 'join', ver: '0.5.1', code: wcode})); await wait(20);
			const wn = await connect('want=join&ver=0.5.2&code=QQQQQQ'); wn.send(hello({want: 'join', code: 'QQQQQQ'})); await wait(20);
			ok('15. ... a third is turned away ("full"), and a code no match has is "no duel with that code"', wv.got[0].why == 'full' && wn.got[0].why == 'room', [wv.got, wn.got]);
			wb.close(); await wait(30);
			ok('16. ... one goes: the other is told and let go', wa.last().t == 'left' && wa.closed, wa.got.slice(-1));
			const k1 = await connect('want=quick&ver=0.5.2'); k1.send(hello({want: 'quick'})); await wait(20);
			const k2 = await connect('want=quick&ver=0.5.1'); k2.send(hello({want: 'quick', ver: '0.5.1'})); await wait(20);
			const k3 = await connect('want=quick&ver=0.5.2'); k3.send(hello({want: 'quick'})); await wait(30);
			ok('17. the Worker\'s quick match: the queue sends the next pilot of the same version to the waiting match (another version waits apart)', k1.got[0].t == 'wait' && k1.last().role == 'host' && k3.last().role == 'guest' && k2.got.length == 1 && k2.got[0].t == 'wait', [k1.got, k2.got, k3.got]);
			k2.close(); await wait(30);
			const k4 = await connect('want=quick&ver=0.5.1'); k4.send(hello({want: 'quick', ver: '0.5.1'})); await wait(30);
			ok('18. ... a pilot who gave up waiting leaves the queue: the next one waits in a new match, not in the empty one', k4.got[0].t == 'wait' && k4.got.length == 1, k4.got);
			const bad = await W.default.fetch(new Request('https://relay.example/?want=dance', {headers: {Upgrade: 'websocket'}}), env);
			ok('19. a connection without a hello\'s routing is refused (400)', bad.status == 400, bad.status);
			/* (0.6.0) a co-op room in the Worker: its Durable Object holds the room of four */
			const h2 = o => hello(Object.assign({proto: 2, ver: '0.6.0'}, o));
			const ca = await connect('want=host&ver=0.6.0'); ca.send(h2({want: 'host', size: 3})); await wait(20);
			const cc = ca.last().code, cg = [];
			for (let i = 0; i < 3; i++) { const g = await connect('want=join&ver=0.6.0&code=' + cc); g.send(h2({want: 'join', code: cc})); cg.push(g); await wait(20) }
			cg[1].send({t: 'g', k: 'in'}); await wait(20);
			ok('26. the Worker\'s co-op room (size 3): two guests seated (1, 2), the third turned away ("full"); a guest\'s message reaches the host with "f"', cg[0].last().id == 1 && cg[1].last().id == 2 && cg[2].got[0].why == 'full' && ca.got.some(m => m.k == 'in' && m.f == 2), {host: ca.got, g: cg.map(g => g.got)});
			globalThis.Response = RealResponse; globalThis.Request = RealRequest;
			for (const o of env.ROOMS.objs.values()) if (o.timer) clearInterval(o.timer);
		}
	} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
	for (const p of everyone) try { p.w.close() } catch (e) {}
	R.server.close();
	console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
})();
