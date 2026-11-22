/* ===== Ember Reach: duels over a network (0.5.2) =====
   Two people's games in one duel, on a LAN or online. Both talk to a relay (a WebSocket server): online, the duel
   relay (tools/duel-relay, with room codes and a quick-match queue); on a LAN, Rudolf OS's duel service on the host's
   computer (asked for through the game kit, RG.lan, and found on the network by mDNS). It's the same protocol and the
   same code either way: only where the relay is differs. The relay passes messages between the two and never tells
   either the other's address.
   - The relay's part (docs/duel-protocol.md): {t:'hello', proto, game, ver, want: 'host' | 'join' | 'quick', code};
     back {t:'room', code} (hosting: the code to give), {t:'wait'} (in the quick-match queue), {t:'paired', role:
     'host' | 'guest'}, {t:'error', why, text} or {t:'left'} (the other went). Then {t:'g', ...} messages pass
     between the two as they are.
   - The game's part: each says hello ({k:'hi', ver, proto, ship}); both must run the same version, or the duel is
     refused with a message. The host's game decides (duel.js's match: hits, kills, collisions, the clock); 30 times
     a second the guest sends its own ship's state and controls, the shots it fired and what happened to it (a rock,
     a flare) ({k:'in'}), and flies its own ship at once; the host sends its ship, both ships' shields and hull, the
     match, its shots and what happened ({k:'st'}). Each smooths the other's ship (ghost). The arena is seeded, so
     only the ships and the shots travel, and positions go relative to the arena's centre.
   - Ending: a closed connection, 10 s without a word, a version mismatch or leaving ends the duel cleanly (end()).
   Transports are {send(o), close(), onopen, onmessage(o), onclose(why)}: ws(url) for a WebSocket, pipe() for tests.
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const NET = {proto: 1, game: 'ember-reach', rate: 30, max: 8192, quiet: 10, ping: 1, snap: 400, blend: 8, reach: 2e5, shots: 24,
	codeChars: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', codeLen: 6};
/* the online relay's address: none until the owner puts one up (docs/plan-ember-reach.md); a page's ?relay= (a ws or
   wss address: tests, or someone running their own) takes its place */
const RELAY = '';
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], len = a => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
const r2 = x => Math.round(x * 100) / 100, r4 = x => Math.round(x * 1e4) / 1e4;
const fin = x => typeof x == 'number' && isFinite(x);
const vec = (a, n, max) => Array.isArray(a) && a.length == n && a.every(x => fin(x) && Math.abs(x) <= max);
const clock = () => (typeof performance != 'undefined' ? performance.now() : Date.now()) / 1000;

/* a room code: six letters and digits, none of those easily mixed up (0/O, 1/I/L) */
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const validCode = c => typeof c == 'string' && c.length == NET.codeLen && [...c].every(x => NET.codeChars.includes(x));
function makeCode(rnd) { let c = ''; for (let i = 0; i < NET.codeLen; i++) c += NET.codeChars[Math.floor((rnd || Math.random)() * NET.codeChars.length)]; return c }
/* the relay to use online: ?relay= if it's a ws(s) address, else RELAY ('' = not set up) */
function relayUrl(search) {
	let q = null; try { q = new URLSearchParams(search || '').get('relay') } catch (e) {}
	if (q && /^wss?:\/\/[^\s/?#]+(\/[^\s]*)?$/.test(q)) return q;
	return RELAY;
}

/* ---------- transports ---------- */
/* a WebSocket (the browser's, or one given: node's) */
function ws(url, WS) {
	WS = WS || root.WebSocket;
	const t = {onopen: null, onmessage: null, onclose: null, open: false, closed: false, url};
	const done = why => { if (t.closed) return; t.closed = true; t.open = false; if (t.onclose) t.onclose(why) };
	let w = null;
	try { w = new WS(url) } catch (e) { setTimeout(() => done('unreachable'), 0) }
	if (w) {
		w.onopen = () => { t.open = true; if (t.onopen) t.onopen() };
		w.onmessage = e => { const d = e.data; if (typeof d != 'string' || d.length > NET.max) return; let o; try { o = JSON.parse(d) } catch (x) { return } if (o && typeof o == 'object' && !Array.isArray(o) && t.onmessage) t.onmessage(o) };
		w.onclose = () => done(t.open ? 'closed' : 'unreachable');
		w.onerror = () => {};
	}
	t.send = o => { if (!t.open || t.closed) return false; const s = JSON.stringify(o); if (s.length > NET.max) return false; try { w.send(s); return true } catch (e) { return false } };
	t.close = () => { const was = t.closed; t.closed = true; t.open = false; try { if (w) w.close(1000) } catch (e) {} return !was };
	return t;
}
/* two transports joined end to end (tests): each one's sends arrive at the other after `lag` ms, as JSON */
function pipe(lag) {
	const mk = () => ({onopen: null, onmessage: null, onclose: null, open: false, closed: false});
	const a = mk(), b = mk(); a.peer = b; b.peer = a;
	for (const t of [a, b]) {
		t.send = o => { if (!t.open || t.closed) return false; const s = JSON.stringify(o); if (s.length > NET.max) return false; setTimeout(() => { if (!t.peer.closed && t.peer.onmessage) t.peer.onmessage(JSON.parse(s)) }, lag || 0); return true };
		t.close = () => { if (t.closed) return false; t.open = false; t.closed = true; setTimeout(() => { if (!t.peer.closed) { t.peer.closed = true; if (t.peer.onclose) t.peer.onclose('closed') } }, lag || 0); return true };
	}
	setTimeout(() => { for (const t of [a, b]) { t.open = true; if (t.onopen) t.onopen() } }, 0);
	return [a, b];
}

/* ---------- a session: the relay's handshake, then the other pilot ---------- */
const WHY = {
	version: o => 'The other pilot runs Ember Reach ' + (o.theirs || 'another version') + ' and you run ' + o.ver + ': both need the same version to duel.',
	left: () => 'The other pilot left the duel.',
	lost: () => 'The connection to the other pilot was lost.',
	closed: () => 'The duel relay closed the connection.',
	unreachable: o => 'Could not reach the duel relay' + (o.where ? ' (' + o.where + ')' : '') + '.',
	room: () => 'There is no duel with that code (it may have ended).',
	full: () => 'That duel already has two pilots.',
	busy: () => 'The duel relay is busy: try again in a minute.',
	limit: () => 'Too many messages: the relay closed the connection.',
	bad: () => 'The duel relay did not understand this game.',
	mine: () => 'You left the duel.'};
const whyText = (why, o) => (WHY[why] || (() => String(why || 'The duel ended.')))(o || {});
/* o: {ver, want: 'host' | 'join' | 'quick', code, ship, now (seconds; a clock for tests)} */
function session(tr, o) {
	const now = o.now || clock;
	const S = {state: 'connecting', role: null, code: null, peer: null, rtt: null, heard: now(), pinged: 0, ended: null, sent: 0, got: 0, handlers: {}};
	const emit = (n, a) => { const f = S.handlers[n]; if (f) try { f(a) } catch (e) { console.error(e) } };
	S.on = (n, f) => { S.handlers[n] = f; return S };
	function end(why, more) {
		if (S.ended) return;
		S.ended = {why, text: whyText(why, Object.assign({ver: o.ver, where: tr.url}, more || {}))}; S.state = 'over';
		tr.onmessage = null; tr.onclose = null; try { tr.close() } catch (e) {}
		emit('end', S.ended);
	}
	S.end = end;
	S.send = m => { if (S.state != 'ready' && !(S.state == 'paired' && m.k == 'hi') && m.k != 'bye') return false; S.sent++; return tr.send(Object.assign({t: 'g'}, m)) };
	S.leave = () => { if (S.ended) return; if (S.state == 'paired' || S.state == 'ready') tr.send({t: 'g', k: 'bye', why: 'left'}); end('mine') };
	S.tick = () => {
		if (S.ended) return;
		const t = now();
		if ((S.state == 'paired' || S.state == 'ready') && t - S.heard > NET.quiet) return end('lost');
		if (S.state == 'ready' && t - S.pinged > NET.ping) { S.pinged = t; tr.send({t: 'g', k: 'ping', at: r4(t)}) }
	};
	tr.onopen = () => { S.state = 'relay'; S.heard = now(); tr.send({t: 'hello', proto: NET.proto, game: NET.game, ver: o.ver, want: o.want, code: o.code || undefined}) };
	tr.onclose = why => end(S.state == 'paired' || S.state == 'ready' ? 'lost' : why == 'unreachable' ? 'unreachable' : 'closed');
	tr.onmessage = m => {
		if (S.ended) return;
		S.heard = now(); S.got++;
		if (m.t == 'room' && validCode(m.code)) { S.code = m.code; S.state = 'waiting'; return emit('room', m.code) }
		if (m.t == 'wait') { S.state = 'waiting'; return emit('waiting') }
		if (m.t == 'paired' && (m.role == 'host' || m.role == 'guest')) { S.role = m.role; S.state = 'paired'; S.send({k: 'hi', proto: NET.proto, ver: o.ver, ship: o.ship}); return emit('paired', m.role) }
		if (m.t == 'error') return end(typeof m.why == 'string' && WHY[m.why] ? m.why : 'bad', {theirs: typeof m.ver == 'string' ? m.ver.slice(0, 20) : null});
		if (m.t == 'left') return end('left');
		if (m.t != 'g' || typeof m.k != 'string') return;
		if (m.k == 'hi') {
			if (m.proto !== NET.proto || m.ver !== o.ver) { tr.send({t: 'g', k: 'bye', why: 'version', ver: o.ver}); return end('version', {theirs: typeof m.ver == 'string' ? m.ver.slice(0, 20) : '?'}) }
			S.peer = {ver: m.ver, ship: typeof m.ship == 'string' ? m.ship.slice(0, 20) : null}; S.state = 'ready'; return emit('ready', S.peer);
		}
		if (m.k == 'bye') return end(m.why == 'version' ? 'version' : 'left', {theirs: typeof m.ver == 'string' ? m.ver.slice(0, 20) : null});
		if (m.k == 'ping') { tr.send({t: 'g', k: 'pong', at: m.at}); return }
		if (m.k == 'pong') { if (fin(m.at)) S.rtt = Math.max(0, now() - m.at); return }
		if (S.state == 'ready') emit('msg', m);
	};
	if (tr.open) setTimeout(() => { if (S.state == 'connecting' && tr.onopen) tr.onopen() }, 0);   /* (a transport already open) */
	return S;
}

/* ---------- what travels ---------- */
/* a ship's flight state, relative to the arena's centre c */
const packShip = (s, c) => ({p: sub(s.p, c).map(r2), v: s.v.map(r2), q: s.q.map(r4), w: (s.w || [0, 0, 0]).map(r4)});
function unpackShip(o, c) {
	if (!o || !vec(o.p, 3, NET.reach) || !vec(o.v, 3, 1e4) || !vec(o.q, 4, 2) || !vec(o.w, 3, 50)) return null;
	const ql = Math.hypot(...o.q); if (ql < 0.5) return null;
	return {p: add(o.p, c), v: o.v.slice(), q: o.q.map(x => x / ql), w: o.w.slice()};
}
/* a shot, from its shooter's side: the receiver owns it to the other ship, and a homing one's target (tg: 1, the
   receiver) mapped */
const KINDS = () => (isNode ? require('./combat.js') : root.EmberCombat).WEAPONS;
function packShot(m, c, foe) {
	const o = {k: m.kind, p: sub(m.p, c).map(r2), ttl: r4(m.ttl), dmg: r4(m.dmg)};
	if (m.ray) { o.ray = 1; o.dir = m.dir.map(r4); o.range = r2(m.range) } else o.v = m.v.map(r2);
	if (m.target != null) o.tg = m.target == foe ? 1 : 0;
	return o;
}
function unpackShot(o, c, owner, me) {
	const W = KINDS();
	if (!o || typeof o.k != 'string' || !Object.prototype.hasOwnProperty.call(W, o.k) || !vec(o.p, 3, NET.reach) || !fin(o.ttl) || !fin(o.dmg) || o.dmg < 0 || o.dmg > 5000) return null;
	const m = {kind: o.k, p: add(o.p, c), ttl: Math.min(30, Math.max(0, o.ttl)), dmg: o.dmg, owner, target: o.tg == 1 ? me : null, net: 1};
	if (o.ray) { if (!vec(o.dir, 3, 1.01) || !fin(o.range) || o.range < 0 || o.range > 2e4) return null; m.ray = true; m.dir = o.dir.slice(); m.range = o.range }
	else { if (!vec(o.v, 3, 1e5)) return null; m.v = o.v.slice() }
	return m;
}
/* the match as it travels (duel.js's match, without the seed's arena); and seen from the guest's side, swapped */
const packMatch = m => ({round: m.round, wins: m.wins.slice(), phase: m.phase, t: r2(m.t), dealt: m.dealt.map(r2), wait: r2(m.wait), ships: m.ships.slice(), seed: m.seed, last: m.last ? {winner: m.last.winner, how: m.last.how, round: m.last.round, dealt: m.last.dealt.map(r2), t: r2(m.last.t)} : null});
const sw = a => [a[1], a[0]];
const PHASES = ['fight', 'sudden', 'between', 'over'];
function mirror(p) {
	if (!p || !fin(p.round) || !Array.isArray(p.wins) || !Array.isArray(p.dealt) || !Array.isArray(p.ships) || !PHASES.includes(p.phase)) return null;
	return {round: p.round, wins: sw(p.wins), phase: p.phase, t: p.t, dealt: sw(p.dealt), wait: p.wait, ships: sw(p.ships), seed: p.seed, last: p.last ? {winner: 1 - p.last.winner, how: p.last.how, round: p.last.round, dealt: sw(p.last.dealt), t: p.last.t} : null};
}
/* a ship's shields and hull, as they travel */
const packCond = cs => ({sh: r2(cs.shield), hu: r2(cs.hull), dead: cs.dead ? 1 : 0});
const condOk = c => c && fin(c.sh) && fin(c.hu) && c.sh >= 0 && c.hu >= 0;

/* ---------- smoothing the other's ship ---------- */
/* a ghost: the last state heard (and when), which the shown ship follows: carried on by its own velocity each step,
   pulled towards where the last state says it is now (extrapolated, half a second at most), snapped there if it's
   more than 400 m off; its velocity and rotation eased the same way */
const ghost = () => ({snap: null, at: 0, n: 0});
function ghostSet(g, st, at) { if (!st) return false; g.snap = st; g.at = at; g.n++; return true }
function nlerp(a, b, k) {
	const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = d < 0 ? -1 : 1;
	const q = a.map((x, i) => x + (b[i] * s - x) * k), l = Math.hypot(...q) || 1;
	return q.map(x => x / l);
}
function ghostStep(g, s, dt, now) {
	if (!g.snap) return null;
	const age = Math.min(0.5, Math.max(0, now - g.at)), want = add(g.snap.p, mul(g.snap.v, age)), k = Math.min(1, NET.blend * dt);
	s.p = add(s.p, mul(s.v, dt));
	const err = sub(want, s.p), e = len(err);
	if (e > NET.snap || g.n == 1 && !g.placed) { s.p = want.slice(); s.v = g.snap.v.slice(); s.q = g.snap.q.slice(); g.placed = true }
	else { s.p = add(s.p, mul(err, k)); s.v = add(s.v, mul(sub(g.snap.v, s.v), k)); s.q = nlerp(s.q, g.snap.q, Math.min(1, k * 1.5)) }
	s.w = g.snap.w.slice();
	return e;
}

const EmberNet = {NET, RELAY, relayUrl, makeCode, normCode, validCode, ws, pipe, session, whyText, packShip, unpackShip, packShot, unpackShot, packMatch, mirror, packCond, condOk, ghost, ghostSet, ghostStep, nlerp};
if (isNode) module.exports = EmberNet; else root.EmberNet = EmberNet;
})(typeof window != 'undefined' ? window : globalThis);
