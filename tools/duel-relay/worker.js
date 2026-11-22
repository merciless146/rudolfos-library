/* ===== Ember Reach's duel relay on Cloudflare Workers, with a Durable Object (docs/plan-ember-reach.md, "Duels online
   and on a LAN"). The same rules as relay.js (relay-core.js: rooms, quick match, versions, limits), the same protocol.
   The Worker sends each WebSocket at /duel to one Durable Object, "relay", which holds every room and the quick-match
   queue in memory (rooms live only while their players are connected: nothing is stored). One object is plenty for
   a game's duels; should it ever not be, rooms can be split over several by their code.
   The player's address (CF-Connecting-IP) is used only to count connections from one address; it is never passed on,
   kept or logged. Deploying: README.md here. GPL-2.0-or-later. ===== */
import core from './relay-core.js';
const {createRelay} = core;

export default {
	async fetch(req, env) {
		const url = new URL(req.url);
		if (url.pathname == '/' && req.method == 'GET') return new Response('Ember Reach duel relay\n', {headers: {'content-type': 'text/plain; charset=utf-8'}});
		if (url.pathname != '/duel') return new Response('not here\n', {status: 404});
		if ((req.headers.get('Upgrade') || '').toLowerCase() != 'websocket') return new Response('a WebSocket only\n', {status: 426});
		return env.RELAY.get(env.RELAY.idFromName('relay')).fetch(req);
	}
};

export class Relay {
	constructor(state, env) { this.state = state; this.env = env; this.relay = createRelay(); this.timer = null }
	async fetch(req) {
		const pair = new WebSocketPair(), client = pair[0], server = pair[1];
		server.accept();
		const h = this.relay.connect({send: t => server.send(t), close: () => { try { server.close(1000, 'bye') } catch (e) {} }, address: req.headers.get('CF-Connecting-IP')});
		server.addEventListener('message', e => h.message(typeof e.data == 'string' ? e.data : null));
		server.addEventListener('close', () => h.closed());
		server.addEventListener('error', () => h.closed());
		/* rooms nobody joined, and silent connections, closed every few seconds while anyone is connected */
		if (!this.timer) this.timer = setInterval(() => { this.relay.sweep(); if (!this.relay.stats().clients) { clearInterval(this.timer); this.timer = null } }, 5000);
		return new Response(null, {status: 101, webSocket: client});
	}
}
