/* ===== The duel relay's protocol: rooms, codes and the quick-match queue (Ember Reach duels, 0.5.2; co-op rooms, 0.6.0) =====
   The same in every relay: relay.mjs (Node, anywhere: online, or a LAN's single room), worker.mjs (Cloudflare
   Workers, a Durable Object per match) and Rudolf OS's duel service (rudolf-duel, in C, the LAN's). Described in
   docs/duel-protocol.md. The relay only pairs two players and passes their game's messages between them: it never
   tells either the other's address, keeps nothing once a match ends, and limits what it takes (size, rate, time).
   A connection is {send(text), close(code, why), ip}; the server calls connect(), message(), closed() and, now and
   then, sweep().
   (0.6.0) Protocol 2: rooms of two to four (Ember Reach's co-op wing: docs/plan-ember-reach-pilots.md P5). A host
   says {t:'hello', proto: 2, ..., want: 'host', size: 2-4}; each guest who joins gets {t:'paired', role: 'guest', id:
   1-3, size}, and the host {t:'joined', id}. The host's game messages go to every guest, or to one when they begin
   {"t":"g","to":N, (N 1-3); a guest's go to the host only, the relay adding who sent it: {"t":"g","f":N, ...}.
   A guest leaving: the host gets {t:'left', id}, and the room stays open for another. The host leaving: every guest
   gets {t:'left'}, and the room closes. Protocol 1 (duels) is as it was: two players, no ids, quick match.
   GPL-2.0-or-later. ===== */
export const PROTO = 1, PROTOS = [1, 2], MAXSIZE = 4;
export const GAMES = ['ember-reach'];
export const LIMITS = {
	msg: 8192,          /* bytes a message, at most */
	rate: 90, burst: 180,   /* messages a second (a game sends 30 and a ping), and a burst above it */
	hello: 10,          /* seconds to say hello */
	waiting: 600,       /* seconds a room or the queue waits for the second player */
	quiet: 60,          /* seconds a paired player may say nothing */
	rooms: 2000,        /* rooms at once */
	perIp: 8            /* connections from one address at once (the servers count them) */
};
export const CODE = {chars: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', len: 6};
const verOk = v => typeof v == 'string' && /^[0-9A-Za-z.+-]{1,20}$/.test(v);
export const codeOk = c => typeof c == 'string' && c.length == CODE.len && [...c].every(x => CODE.chars.includes(x));
export function makeCode(rnd) { let c = ''; for (let i = 0; i < CODE.len; i++) c += CODE.chars[Math.floor(rnd() * CODE.chars.length)]; return c }
const TEXT = {
	bad: 'That is not a duel the relay knows.', version: 'The other player runs another version of the game.', room: 'There is no duel with that code.',
	full: 'That game is full.', busy: 'The relay is busy.', limit: 'Too much, too fast.', time: 'Nothing heard in time.'};
const err = (why, more) => JSON.stringify(Object.assign({t: 'error', why, text: TEXT[why]}, more || {}));

/* opt: {now() (seconds), rnd() (0-1: crypto's), single: a code (one room only: a LAN's service, or a Durable Object's
   match), quickWait(code, ver) (the Worker: a quick-match room now waits), roomGone(room) (a room closed)} */
export class Lobby {
	constructor(opt) {
		this.opt = opt || {}; this.now = this.opt.now || (() => Date.now() / 1000); this.rnd = this.opt.rnd || Math.random;
		this.rooms = new Map(); this.clients = new Set();
	}
	connect(sock) {
		const t = this.now(), c = {sock, room: null, role: null, at: t, heard: t, tokens: LIMITS.burst, filled: t, said: false, gone: false};
		this.clients.add(c); return c;
	}
	/* a text message from a player */
	message(c, text) {
		if (c.gone) return;
		const t = this.now();
		if (typeof text != 'string' || text.length > LIMITS.msg) return this.drop(c, 'limit');
		c.tokens = Math.min(LIMITS.burst, c.tokens + (t - c.filled) * LIMITS.rate); c.filled = t;
		if (--c.tokens < 0) return this.drop(c, 'limit');
		c.heard = t;
		/* after pairing: the game's messages pass on (protocol 1: to the other, as they are; 2: see route) */
		if (c.room && c.room.guest && text.startsWith('{"t":"g"')) return this.route(c, text);
		let m; try { m = JSON.parse(text) } catch (e) { return this.drop(c, 'bad') }
		if (!m || typeof m != 'object') return this.drop(c, 'bad');
		if (m.t == 'g') return;   /* (not paired yet: nobody to pass it to) */
		if (m.t != 'hello' || c.said) return this.drop(c, 'bad');
		c.said = true;
		if (!PROTOS.includes(m.proto) || !GAMES.includes(m.game) || !verOk(m.ver) || !['host', 'join', 'quick'].includes(m.want)) return this.drop(c, 'bad');
		if (m.proto == 2 && m.want == 'quick') return this.drop(c, 'bad');   /* (quick match is for duels) */
		if (m.proto == 2 && m.want == 'host' && !(Number.isInteger(m.size) && m.size >= 2 && m.size <= MAXSIZE)) return this.drop(c, 'bad');
		c.game = m.game; c.ver = m.ver; c.proto = m.proto;
		if (m.want == 'host') return this.host(c, false, m.proto == 2 ? m.size : 2);
		if (m.want == 'join') {
			const r = codeOk(m.code) ? this.rooms.get(m.code) : null;
			if (!r || r.quick || !r.host || r.host.gone || r.proto != c.proto) return this.drop(c, 'room');
			if (r.guests.length >= r.size - 1) return this.drop(c, 'full');
			if (r.game != c.game || r.ver != c.ver) return this.drop(c, 'version', {ver: r.ver});
			return this.pair(r, c);
		}
		/* quick match: the first waiting room of the same game and version, or a new one */
		for (const r of this.rooms.values()) if (r.quick && !r.guest && r.host && !r.host.gone && r.game == c.game && r.ver == c.ver) return this.pair(r, c);
		return this.host(c, true, 2);
	}
	host(c, quick, size) {
		const S = this.opt.single;
		if (S ? this.rooms.size : this.rooms.size >= LIMITS.rooms) return this.drop(c, 'busy');
		let code = S; if (!S) { do code = makeCode(this.rnd); while (this.rooms.has(code)) }
		const r = {code, game: c.game, ver: c.ver, proto: c.proto, quick, size, host: c, guests: [], get guest() { return this.guests[0] || null }, made: this.now()};
		this.rooms.set(code, r); c.room = r; c.role = 'host';
		if (quick) { c.sock.send('{"t":"wait"}'); if (this.opt.quickWait) this.opt.quickWait(code, c.ver) }
		else c.sock.send(JSON.stringify({t: 'room', code}));
	}
	pair(r, c) {
		c.room = r; c.role = 'guest'; if (!r.paired) r.paired = this.now();
		if (r.proto == 1) { r.guests.push(c); r.host.sock.send('{"t":"paired","role":"host"}'); c.sock.send('{"t":"paired","role":"guest"}'); return }
		let id = 1; while (r.guests.some(g => g.id == id)) id++;   /* (the lowest free: a seat left is taken again) */
		c.id = id; r.guests.push(c);
		c.sock.send(JSON.stringify({t: 'paired', role: 'guest', id, size: r.size})); r.host.sock.send(JSON.stringify({t: 'joined', id}));
	}
	/* a game's message: protocol 1, to the other as it is; protocol 2, the host's to every guest (or to one: "to"),
	   a guest's to the host with "f" (who) added */
	route(c, text) {
		const r = c.room;
		if (r.proto == 1) { const o = c.role == 'host' ? r.guest : r.host; if (o && !o.gone) o.sock.send(text); return }
		if (c.role == 'guest') { if (!r.host.gone) r.host.sock.send('{"t":"g","f":' + c.id + text.slice(8)); return }
		const to = /^\{"t":"g","to":([1-3]),/.exec(text);
		for (const g of r.guests) if (!g.gone && (!to || g.id == +to[1])) g.sock.send(text);
	}
	/* a player gone (closed, or dropped): the other is told and let go; the room goes */
	closed(c) {
		if (c.gone) return; c.gone = true; this.clients.delete(c);
		const r = c.room; if (!r) return;
		/* (protocol 2) a guest gone: the host is told, the room stays open */
		if (r.proto == 2 && c.role == 'guest') { r.guests = r.guests.filter(g => g != c); if (!r.guests.length) r.emptied = this.now(); if (!r.host.gone) try { r.host.sock.send(JSON.stringify({t: 'left', id: c.id})) } catch (e) {} return }
		this.rooms.delete(r.code);
		if (this.opt.roomGone) try { this.opt.roomGone(r) } catch (e) {}
		for (const o of c.role == 'host' ? r.guests : [r.host]) if (o && !o.gone) { o.gone = true; this.clients.delete(o); try { o.sock.send('{"t":"left"}') } catch (e) {} try { o.sock.close(1000, 'left') } catch (e) {} }
	}
	drop(c, why, more) {
		if (c.gone) return;
		try { c.sock.send(err(why, more)) } catch (e) {}
		try { c.sock.close(why == 'limit' ? 1008 : 1000, why) } catch (e) {}
		this.closed(c);
	}
	/* now and then: those who never said hello, rooms waiting too long, players gone quiet */
	sweep() {
		const t = this.now();
		for (const c of [...this.clients]) {
			if (!c.said && t - c.at > LIMITS.hello) this.drop(c, 'time');
			else if (c.room && !c.room.guest && t - (c.room.emptied || c.room.made) > LIMITS.waiting) this.drop(c, 'time');
			else if (c.room && c.room.guest && t - c.heard > LIMITS.quiet) this.drop(c, 'time');
		}
	}
	stats() { let paired = 0; for (const r of this.rooms.values()) if (r.guest) paired++; return {clients: this.clients.size, rooms: this.rooms.size, paired} }
}
