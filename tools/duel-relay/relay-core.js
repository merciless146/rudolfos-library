/* ===== Ember Reach's duel relay: the rules, apart from how the connections arrive (relay.js: Node's own WebSocket
   server; worker.js: Cloudflare Workers with a Durable Object). docs/plan-ember-reach.md, "Duels online and on a LAN".
   A player's game connects and says one of:
     {t: 'host', v, proto}         a room: the relay answers {t: 'room', code} (six letters and digits, "ABC123")
     {t: 'join', code, v, proto}   that room
     {t: 'quick', v, proto}        the next player waiting with the same version ({t: 'queued'} until then)
   Paired, both get {t: 'paired', role: 'host'|'guest'}, and from then on every message one sends goes to the other as
   it is (the game's own protocol: apps/rudolf-emberreach/www/net.js). When one leaves the other gets {t: 'gone'}.
   Refusals: {t: 'error', why, text}: version (not the same version of the game), proto, room (no room waiting with that code),
   bad (not a message the relay knows), size (over 8 KB), rate (over 120 a second, 240 at once), busy (too many players,
   or too many from one address), idle (nothing for 60 s).
   While waiting a game may send {t: 'ping'} (every 15 s) to keep its place.
   Players never see each other's addresses: the relay passes on only what they send. An address is used only to
   count connections from it, and is never kept or written anywhere. GPL-2.0-or-later. ===== */
'use strict';
const LIMITS = {maxMsg: 8192, rate: 120, burst: 240, idle: 60, roomLife: 600, maxClients: 400, perAddress: 8, maxRooms: 200, protos: [1]};
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RESERVED = new Set(['room', 'queued', 'paired', 'error', 'gone']);
const TEXT = {
	version: (a, b) => 'That game runs Ember Reach ' + a + ', and you have ' + b + '. Both need the same version to duel.',
	proto: 'That relay speaks a different duel protocol: update Ember Reach.',
	room: 'No game is waiting with that code. Check it with the other pilot.',
	bad: 'The relay did not understand the game.',
	size: 'A message was too large.',
	rate: 'Too many messages.',
	busy: 'The relay is busy: try again in a minute.',
	idle: 'Nothing was heard for a minute.'};

/* createRelay({now, random, limits}): connect(client) for each connection, client = {send(text), close(), address};
   returns {message(text), closed()} for the connection's events. stats() and sweep() (call it every few seconds) */
function createRelay(o) {
	o = o || {};
	const L = Object.assign({}, LIMITS, o.limits || {}), now = o.now || (() => Date.now() / 1000), rnd = o.random || Math.random;
	const clients = new Set(), rooms = new Map(), queue = new Map(), perAddr = new Map();
	const code = () => { for (let k = 0; k < 50; k++) { let s = ''; for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)]; if (!rooms.has(s)) return s } return null };
	const out = (c, m) => { try { c.client.send(JSON.stringify(m)) } catch (e) {} };
	function refuse(c, why, text) { out(c, {t: 'error', why, text: text || TEXT[why] || why}); drop(c) }
	function drop(c) {
		if (c.gone) return; c.gone = true; clients.delete(c);
		if (c.address != null) { const n = (perAddr.get(c.address) || 1) - 1; if (n > 0) perAddr.set(c.address, n); else perAddr.delete(c.address) }
		if (c.room && rooms.get(c.room) === c) rooms.delete(c.room);
		if (c.v != null && queue.get(c.v) === c) queue.delete(c.v);
		const p = c.peer; c.peer = null;
		if (p && !p.gone) { p.peer = null; out(p, {t: 'gone'}); drop(p) }
		try { c.client.close() } catch (e) {}
	}
	function link(h, g) {
		h.peer = g; g.peer = h; h.room = g.room = null;
		out(h, {t: 'paired', role: 'host'}); out(g, {t: 'paired', role: 'guest'});
	}
	const okV = v => typeof v == 'string' && /^[0-9A-Za-z.+-]{1,20}$/.test(v);
	function connect(client) {
		const c = {client, address: client.address == null ? null : String(client.address), tokens: L.burst, at: now(), heard: now(), peer: null, room: null, v: null, gone: false};
		if (clients.size >= L.maxClients || (c.address != null && (perAddr.get(c.address) || 0) >= L.perAddress)) { c.address = null; refuse(c, 'busy'); return {message() {}, closed() {}} }
		clients.add(c); if (c.address != null) perAddr.set(c.address, (perAddr.get(c.address) || 0) + 1);
		return {
			message(text) {
				if (c.gone) return;
				const t = now(); c.tokens = Math.min(L.burst, c.tokens + (t - c.at) * L.rate); c.at = t; c.heard = t;
				if (typeof text != 'string' || text.length > L.maxMsg) return refuse(c, 'size');
				if (--c.tokens < 0) return refuse(c, 'rate');
				let m; try { m = JSON.parse(text) } catch (e) { return refuse(c, 'bad') }
				if (!m || typeof m != 'object' || typeof m.t != 'string') return refuse(c, 'bad');
				if (c.peer) { if (RESERVED.has(m.t)) return refuse(c, 'bad'); try { c.peer.client.send(text) } catch (e) {} return }
				if (m.t == 'ping' && c.v != null) return;   /* (waiting: a ping now and then keeps the place) */
				if (c.v != null) return refuse(c, 'bad');   /* (waiting: nothing more to say until paired) */
				if (!L.protos.includes(m.proto)) return refuse(c, 'proto');
				if (!okV(m.v)) return refuse(c, 'bad');
				if (m.t == 'host') {
					if (rooms.size >= L.maxRooms) return refuse(c, 'busy');
					const k = code(); if (!k) return refuse(c, 'busy');
					c.v = m.v; c.room = k; c.made = t; rooms.set(k, c); out(c, {t: 'room', code: k});
				} else if (m.t == 'join') {
					const k = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), h = rooms.get(k);
					if (!h) return refuse(c, 'room');
					if (h.v !== m.v) return refuse(c, 'version', TEXT.version(h.v, m.v));
					rooms.delete(k); c.v = m.v; c.room = k; link(h, c);
				} else if (m.t == 'quick') {
					c.v = m.v; const w = queue.get(m.v);
					if (w && !w.gone) { queue.delete(m.v); link(w, c) } else { queue.set(m.v, c); out(c, {t: 'queued'}) }
				} else refuse(c, 'bad');
			},
			closed() { drop(c) }};
	}
	/* rooms nobody joined in 10 minutes, and connections silent for a minute, are closed */
	function sweep() {
		const t = now();
		for (const c of [...clients]) {
			if (c.gone) continue;
			if (t - c.heard > L.idle) refuse(c, 'idle');
			else if (c.room && rooms.get(c.room) === c && t - c.made > L.roomLife) refuse(c, 'idle', 'Nobody joined the game in ten minutes.');
		}
	}
	const stats = () => ({clients: clients.size, rooms: rooms.size, queued: queue.size, addresses: perAddr.size});
	return {connect, sweep, stats, LIMITS: L};
}
module.exports = {createRelay, LIMITS, ALPHABET, TEXT};
