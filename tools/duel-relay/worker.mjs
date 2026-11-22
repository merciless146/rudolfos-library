/* ===== The duel relay on Cloudflare Workers (Ember Reach duels, 0.5.2) =====
   The same protocol as relay.mjs (protocol.mjs), with a Durable Object per match:
   - the Worker reads the hello's routing from the address (?want=host|join|quick&ver=&code=, net.js helloUrl) and
     sends the connection to the match's object (DuelRoom, named by the room's code): a new code for host; the code
     given for join; for quick, the queue (DuelQueue, one object) gives the code of the room waiting for that version,
     or a new one, which then waits;
   - each DuelRoom holds one room (Lobby with single: its code): it pairs the two, passes their messages, checks the
     versions and the limits, and tells the queue when its quick-match room starts or stops waiting.
   Nothing is stored (the objects keep only what's in memory while the match lasts); no address is passed on or kept.
   Deploying it (README.md) needs a Cloudflare account: that is the owner's to do.
   GPL-2.0-or-later. ===== */
import {Lobby, makeCode, codeOk, LIMITS} from './protocol.mjs';

const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const verOk = v => typeof v == 'string' && /^[0-9A-Za-z.+-]{1,20}$/.test(v);
const json = o => new Response(JSON.stringify(o), {headers: {'Content-Type': 'application/json'}});
const ABOUT = 'Ember Reach duel relay (WebSocket): docs/duel-protocol.md\n';

export default {
	async fetch(req, env) {
		const u = new URL(req.url);
		if ((req.headers.get('Upgrade') || '').toLowerCase() != 'websocket') return new Response(ABOUT, {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
		const want = u.searchParams.get('want'), ver = u.searchParams.get('ver') || '';
		let code;
		if (want == 'host') code = makeCode(rnd);
		else if (want == 'join') { code = (u.searchParams.get('code') || '').toUpperCase(); if (!codeOk(code)) code = 'NOROOM' }   /* (a room never made: it answers "no duel with that code") */
		else if (want == 'quick' && verOk(ver)) {
			const q = env.QUEUE.get(env.QUEUE.idFromName('queue'));
			code = (await (await q.fetch('https://queue/take', {method: 'POST', body: JSON.stringify({ver})})).json()).code;
		} else return new Response('A hello\'s routing is missing (?want=host|join|quick&ver=...)\n', {status: 400});
		const room = env.ROOMS.get(env.ROOMS.idFromName(code));
		return room.fetch(new Request('https://room/' + code, req));
	}
};

/* one match: its room, while it lasts */
export class DuelRoom {
	constructor(state, env) { this.state = state; this.env = env; this.lobby = null; this.timer = null }
	queue(path, o) { const q = this.env.QUEUE.get(this.env.QUEUE.idFromName('queue')); return q.fetch('https://queue' + path, {method: 'POST', body: JSON.stringify(o)}).catch(() => null) }
	async fetch(req) {
		const code = new URL(req.url).pathname.slice(1);
		if (!this.lobby) this.lobby = new Lobby({single: code, rnd,
			quickWait: (c, ver) => this.queue('/wait', {code: c, ver}),
			roomGone: r => { if (r.quick && !r.guest) this.queue('/gone', {code: r.code, ver: r.ver}) }});
		const pair = new WebSocketPair(), client = pair[0], server = pair[1];
		server.accept();
		const sock = {send: t => { try { server.send(t) } catch (e) {} }, close: (c, w) => { try { server.close(c, w) } catch (e) {} }};
		const c = this.lobby.connect(sock);
		server.addEventListener('message', e => this.lobby.message(c, typeof e.data == 'string' ? e.data : null));
		server.addEventListener('close', () => this.lobby.closed(c));
		server.addEventListener('error', () => this.lobby.closed(c));
		if (!this.timer) this.timer = setInterval(() => { this.lobby.sweep(); if (!this.lobby.clients.size) { clearInterval(this.timer); this.timer = null } }, 1000);
		return new Response(null, {status: 101, webSocket: client});
	}
}

/* the quick-match queue: for each version, the code of the room waiting (for 10 minutes at most) */
export class DuelQueue {
	constructor(state) { this.state = state; this.waiting = new Map() }
	async fetch(req) {
		const path = new URL(req.url).pathname, o = await req.json().catch(() => ({})), now = Date.now();
		if (!verOk(o.ver)) return json({error: 'bad'});
		for (const [v, w] of this.waiting) if (now - w.at > LIMITS.waiting * 1000) this.waiting.delete(v);
		if (path == '/take') {
			const w = this.waiting.get(o.ver);
			if (w) { this.waiting.delete(o.ver); return json({code: w.code}) }
			const code = makeCode(rnd); this.waiting.set(o.ver, {code, at: now}); return json({code});
		}
		if (path == '/wait' && codeOk(o.code)) { this.waiting.set(o.ver, {code: o.code, at: now}); return json({}) }
		if (path == '/gone' && codeOk(o.code)) { const w = this.waiting.get(o.ver); if (w && w.code == o.code) this.waiting.delete(o.ver); return json({}) }
		return json({error: 'bad'});
	}
}
