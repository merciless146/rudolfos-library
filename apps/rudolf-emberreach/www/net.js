/* ===== Ember Reach: duels over a network (0.5.2; docs/plan-ember-reach.md, "Duels online and on a LAN").
   Two pilots meet through a relay: the Library's duel relay (tools/duel-relay) online, or the same relay run on one
   computer of a home network (Rudolf OS's LAN duel service, found by mDNS through the game kit). Both are WebSocket,
   so this is the same code for either; only how the relay's address is found differs.
   - The relay pairs two players and then passes their messages on, never their addresses: host (a room code,
     "ABC123"), join (that code), or quick (the next pilot waiting, of the same version).
   - The protocol between the two games (JSON messages, `t` their kind):
       hello {proto, v}        first, both ways: the same protocol and game version, or the match is refused
       ready {ship}            this pilot has chosen and is ready (a match, or a rematch)
       start {seed, ships}     the host: the match begins (the arena's seed; ships [host's, guest's])
       st {...}                30 times a second, both ways: the sender's own ship (p, v, q, w relative to the
                               arena's centre), its controls (c), the round it is in (r); from the host also the
                               match (m), both ships' hull and shields (hp), the guest's modules (mods), the
                               missiles in flight (al) and those decoyed by flares (dc)
       shot {s}                a shot just fired by the sender's ship (the arena is seeded, so only ships and shots
                               travel)
       flare {}                the guest let a flare go (the host decides which missiles it fooled)
       ev {e, r}               the host: the match's events (end: a round won; sudden; next: the next round)
       ping {n} / pong {n}     every second: the round trip, and that the other is still there
       bye {why}               leaving
   - The host's game decides everything (duel.js's match: hits, kills, collisions, the clock); the guest flies its
     own ship at once and smooths the host's updates (smoother()). A connection silent for 5 s, closed, or a relay
     saying the other has gone ends the match cleanly.
   - Transports: {send(obj), close(), on(name, fn)} with events open, message (an object), close (a reason).
     ws(url) is a WebSocket (the browser's, or Node's); pair() two linked ones in memory (tests).
   Nothing is sent anywhere but to the relay the player picked for the match. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const NET = {proto: 1, rate: 30, timeout: 5, ping: 1, maxMsg: 8192, codeLen: 6, alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', smooth: 0.1, snap: 400, ahead: 0.25};
/* the Library's own online relay: set once it is deployed (docs/plan-ember-reach.md); empty, Online shows "not set up
   yet". A page may be given another with ?relay=wss://... (a relay of one's own, or the tests') */
const RELAY = '';

/* ---------- transports ---------- */
function emitter() {
	const ev = {};
	return {on(n, f) { (ev[n] = ev[n] || []).push(f); return this }, emit(n, a) { for (const f of (ev[n] || []).slice()) { try { f(a) } catch (e) { console.error(e) } } }};
}
/* a WebSocket to a relay (ws:// on a LAN, wss:// online) */
function ws(url) {
	const E = emitter(), W = typeof WebSocket != 'undefined' ? WebSocket : null;
	let sock = null, closed = false;
	const T = Object.assign(E, {kind: 'ws', url,
		send(o) { if (closed || !sock || sock.readyState != 1) return false; const s = JSON.stringify(o); if (s.length > NET.maxMsg) return false; sock.send(s); return true },
		close(why) { if (closed) return; closed = true; try { sock && sock.close(1000) } catch (e) {} E.emit('close', why || 'closed') }});
	if (!W || !/^wss?:\/\/[^\s/?#]+/.test(url || '')) { setTimeout(() => T.close('bad address'), 0); return T }
	try { sock = new W(url) } catch (e) { setTimeout(() => T.close('bad address'), 0); return T }
	sock.onopen = () => E.emit('open');
	sock.onmessage = e => { if (closed || typeof e.data != 'string' || e.data.length > NET.maxMsg) return; let m; try { m = JSON.parse(e.data) } catch (x) { return } if (m && typeof m.t == 'string') E.emit('message', m) };
	sock.onclose = () => { if (!closed) { closed = true; E.emit('close', 'lost') } };
	sock.onerror = () => {};
	return T;
}
/* two transports joined to each other, in memory (or each to a relay core's client: tests) */
function pair() {
	const mk = () => { const E = emitter(); E.kind = 'mem'; E.closed = false; return E };
	const a = mk(), b = mk();
	const link = (x, y) => {
		x.send = o => { if (x.closed) return false; const s = JSON.stringify(o); if (s.length > NET.maxMsg) return false; setTimeout(() => { if (!y.closed) y.emit('message', JSON.parse(s)) }, x.delay || 0); return true };
		x.close = why => { if (x.closed) return; x.closed = true; x.emit('close', why || 'closed'); setTimeout(() => { if (!y.closed) { y.closed = true; y.emit('close', 'lost') } }, 0) };
	};
	link(a, b); link(b, a);
	setTimeout(() => { a.emit('open'); b.emit('open') }, 0);
	return [a, b];
}

/* ---------- a session: through the relay to the other pilot ---------- */
/* connect(transport, {v, mode: 'host'|'join'|'quick', code}, handlers): handlers.room(code) (hosting: the code to tell
   the other), paired(role) ('host' or 'guest'), ready() (the other's hello matched: play), peer(msg), error(why, text),
   close(why). Returns {send(msg), close(why), role, rtt, state} */
const RELAYMSG = new Set(['room', 'queued', 'paired', 'error', 'gone']);
function connect(T, o, h) {
	h = h || {};
	const S = {role: null, rtt: 0, state: 'connecting', code: null, peerV: null, heard: 0, T};
	const now = () => (typeof performance != 'undefined' ? performance.now() : Date.now()) / 1000;
	let timer = null, pings = 0, done = false;
	const call = (n, ...a) => { try { h[n] && h[n](...a) } catch (e) { console.error(e) } };
	S.send = m => T.send(m);
	S.close = why => {
		if (done) return; done = true; S.state = 'closed'; clearInterval(timer); clearInterval(wait);
		if (why != 'lost' && why != 'gone') try { T.send({t: 'bye', why: why || 'left'}) } catch (e) {}
		T.close(why); call('close', why || 'left');
	};
	let wait = null;
	T.on('open', () => {
		/* (waiting for the other: a ping every 15 s keeps the place at the relay, which closes silent connections) */
		wait = setInterval(() => { if (S.state == 'hosting' || S.state == 'queued') T.send({t: 'ping', n: 0}) }, 15000);
		S.state = o.mode == 'host' ? 'hosting' : o.mode == 'join' ? 'joining' : 'queued';
		T.send(o.mode == 'join' ? {t: 'join', code: normCode(o.code), v: o.v, proto: NET.proto} : {t: o.mode == 'host' ? 'host' : 'quick', v: o.v, proto: NET.proto});
	});
	T.on('close', why => { if (!done) { done = true; S.state = 'closed'; clearInterval(timer); clearInterval(wait); call('close', why == 'closed' ? 'lost' : why) } });
	T.on('message', m => {
		if (done) return;
		S.heard = now();
		if (RELAYMSG.has(m.t)) {
			if (m.t == 'room') { S.code = String(m.code || ''); call('room', S.code) }
			else if (m.t == 'paired') { S.role = m.role == 'host' ? 'host' : 'guest'; S.state = 'paired'; T.send({t: 'hello', proto: NET.proto, v: o.v}); call('paired', S.role); start() }
			else if (m.t == 'error') { call('error', String(m.why || 'error'), String(m.text || '')); S.close('refused') }
			else if (m.t == 'gone') S.close('gone');
			return;
		}
		if (m.t == 'hello') {
			const v = check(o.v, m);
			if (!v.ok) { S.peerV = m.v; call('error', 'version', v.text); S.close('version'); return }
			S.peerV = m.v; S.state = 'ready'; call('ready'); return;
		}
		if (m.t == 'ping') { T.send({t: 'pong', n: m.n}); return }
		if (m.t == 'pong') { if (m.n === pings) S.rtt = now() - S.pingAt; return }
		if (m.t == 'bye') { S.byeWhy = String(m.why || '').slice(0, 20); S.close('gone'); return }
		if (S.state == 'ready') call('peer', m);
	});
	/* every second, a ping; nothing heard for 5 s and the other is gone */
	function start() {
		S.heard = now();
		timer = setInterval(() => {
			if (now() - S.heard > NET.timeout) { S.close('timeout'); return }
			S.pingAt = now(); T.send({t: 'ping', n: ++pings});
		}, NET.ping * 1000);
	}
	return S;
}
/* the other's hello: the same protocol and the same version of the game */
function check(mine, m) {
	if (!m || m.proto !== NET.proto) return {ok: false, text: 'The other pilot\'s game speaks a different duel protocol. Both need the same version of Ember Reach.'};
	if (m.v !== mine) return {ok: false, text: 'The other pilot runs Ember Reach ' + String(m.v).slice(0, 20) + ', and you run ' + mine + '. Both need the same version to duel.'};
	return {ok: true};
}
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, NET.codeLen);
const validCode = c => normCode(c).length == NET.codeLen && [...normCode(c)].every(x => NET.alphabet.includes(x));
function newCode(rnd) { rnd = rnd || Math.random; let s = ''; for (let i = 0; i < NET.codeLen; i++) s += NET.alphabet[Math.floor(rnd() * NET.alphabet.length)]; return s }

/* ---------- what travels ---------- */
const r = (x, k) => Math.round(x * k) / k;
const vec = (a, k) => [r(a[0], k), r(a[1], k), r(a[2], k)];
const finite = a => Array.isArray(a) && a.every(x => typeof x == 'number' && isFinite(x));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/* a ship's state, relative to the arena's centre c */
/* (ts: the sender's clock when it was sent, in seconds: the receiver tells each update's extra delay from it) */
function packShip(s, c, ts) { const o = {p: vec(sub(s.p, c), 100), v: vec(s.v, 100), q: s.q.map(x => r(x, 1e4)), w: vec(s.w || [0, 0, 0], 1e3)}; if (ts != null) o.ts = r(ts, 1e3); return o }
function unpackShip(m, c) {
	if (!m || !finite(m.p) || m.p.length != 3 || !finite(m.v) || m.v.length != 3 || !finite(m.q) || m.q.length != 4) return null;
	const n = Math.hypot(...m.q) || 1;
	return {p: add(m.p, c), v: m.v.slice(), q: m.q.map(x => x / n), w: finite(m.w) && m.w.length == 3 ? m.w.slice() : [0, 0, 0], ts: typeof m.ts == 'number' && isFinite(m.ts) ? m.ts : null};
}
/* a shot: its owner and target as the receiver sees them (each side calls itself 'me' and the other 'duelist') */
const KINDS = /^[a-zA-Z]{2,12}$/;
function packShot(m, c) {
	const o = {k: m.kind, id: m.nid, d: r(m.dmg, 1e3), ttl: r(m.ttl, 1e3), p: vec(sub(m.p, c), 100), tg: m.target == 'duelist' ? 'you' : m.target == 'me' ? 'me' : null};
	if (m.ray) { o.ray = 1; o.dir = m.dir.map(x => r(x, 1e5)); o.rg = m.range } else o.v = vec(m.v, 100);
	return o;
}
function unpackShot(o, c, ahead) {
	if (!o || !KINDS.test(o.k || '') || typeof o.id != 'string' || o.id.length > 16 || !finite(o.p) || o.p.length != 3 || !(o.d >= 0 && o.d < 1e5) || !(o.ttl > 0 && o.ttl < 120)) return null;
	const m = {kind: o.k, nid: o.id, net: true, dmg: o.d, ttl: o.ttl, p: add(o.p, c), owner: 'duelist', target: o.tg == 'you' ? 'me' : o.tg == 'me' ? 'duelist' : null};
	if (o.ray) { if (!finite(o.dir) || o.dir.length != 3 || !(o.rg > 0 && o.rg < 1e5)) return null; Object.assign(m, {ray: true, dir: o.dir, range: o.rg}) }
	else {
		if (!finite(o.v) || o.v.length != 3) return null; m.v = o.v;
		/* (it left the other's guns some time ago: half the round trip, at most a quarter second) */
		const a = Math.max(0, Math.min(NET.ahead, ahead || 0)); m.p = add(m.p, m.v.map(x => x * a)); m.ttl -= a;
	}
	return m;
}
/* the host's match, as the guest sees it: the guest is pilot 0 there, so everything swaps */
function mirror(m) {
	return {phase: m.phase, t: m.t, round: m.round, wins: [m.wins[1], m.wins[0]], dealt: [m.dealt[1], m.dealt[0]]};
}
const mirrorLast = l => l && Object.assign({}, l, {winner: 1 - l.winner, dealt: [l.dealt[1], l.dealt[0]]});
function packMatch(m) { return {ph: m.phase, t: r(m.t, 100), r: m.round, w: m.wins.slice(), d: m.dealt.map(x => r(x, 10))} }
function unpackMatch(o) {
	if (!o || !['fight', 'sudden', 'between', 'over'].includes(o.ph) || typeof o.t != 'number' || !finite(o.w) || !finite(o.d) || o.w.length != 2 || o.d.length != 2) return null;
	return {phase: o.ph, t: o.t, round: o.r | 0, wins: o.w.slice(), dealt: o.d.slice()};
}

/* ---------- smoothing the other's ship ---------- */
/* smoother(): push(state, now) as updates arrive; step(cur, now, dt) moves the shown ship (cur: {p, v, q, w}) toward
   where the last update says it is now (its position carried on by its velocity, up to a quarter second ahead), a
   tenth of a second to close the gap; more than 400 m off, it jumps there. With the sender's send times (ts), the
   delay is reckoned from the quickest of the last 60 updates, so updates that arrive late (jitter) are carried on by
   just as much more: the ship is shown where it was the network's least delay ago, moving evenly */
function smoother() {
	const S = {last: null, at: 0, n: 0, jumps: 0, base: [], ts: null};
	S.push = (st, now) => {
		if (!st) return;
		if (st.ts != null) {
			if (S.ts != null && st.ts <= S.ts) return;   /* (older than the last: out of order) */
			S.base.push(now - st.ts); if (S.base.length > 60) S.base.shift(); S.ts = st.ts;
			S.at = st.ts + Math.min(...S.base);   /* (when it would have come, at the least delay) */
		} else S.at = now;
		S.last = st; S.n++;
	};
	S.step = (cur, now, dt) => {
		const L = S.last; if (!L) return cur;
		const age = Math.max(0, Math.min(NET.ahead, now - S.at)), want = add(L.p, L.v.map(x => x * age));
		const err = sub(want, cur.p), e = Math.hypot(...err);
		if (e > NET.snap || !finite(cur.p)) { cur.p = want.slice(); cur.q = L.q.slice(); S.jumps++ }
		else {
			const k = 1 - Math.exp(-dt / NET.smooth);
			cur.p = add(add(cur.p, L.v.map(x => x * dt)), sub(want, add(cur.p, L.v.map(x => x * dt))).map(x => x * k));
			let d = 0; for (let i = 0; i < 4; i++) d += cur.q[i] * L.q[i];
			const sg = d < 0 ? -1 : 1, q = cur.q.map((x, i) => x + (sg * L.q[i] - x) * k), n = Math.hypot(...q) || 1;
			cur.q = q.map(x => x / n);
		}
		cur.v = L.v.slice(); cur.w = L.w.slice();
		return cur;
	};
	return S;
}

const EmberNet = {NET, RELAY, ws, pair, connect, check, normCode, validCode, newCode, packShip, unpackShip, packShot, unpackShot, mirror, mirrorLast, packMatch, unpackMatch, smoother};
if (isNode) module.exports = EmberNet; else root.EmberNet = EmberNet;
})(typeof window != 'undefined' ? window : globalThis);
