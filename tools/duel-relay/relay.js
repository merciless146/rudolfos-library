#!/usr/bin/env node
/* ===== Ember Reach's duel relay on Node (no packages: its own small WebSocket server, RFC 6455 text frames).
   The rules are relay-core.js's (rooms, quick match, versions, limits); worker.js is the same relay on Cloudflare.
     node relay.js [--port 8765] [--host 127.0.0.1]
   --host 0.0.0.0 serves a whole network (a LAN duel without Rudolf OS: the other pilot gives the game
   ws://THIS-COMPUTER:PORT). Behind a TLS proxy (wss://) it serves the internet. It logs only counts, never an
   address. GPL-2.0-or-later. ===== */
'use strict';
const http = require('http'), crypto = require('crypto');
const {createRelay} = require('./relay-core.js');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* one WebSocket connection over a socket: text messages in (onText), out (send); pings answered; closed on anything
   it does not accept (binary frames, unmasked frames, a message over the limit) */
function wsConn(sock, max, onText, onClose) {
	let buf = Buffer.alloc(0), parts = [], partLen = 0, closed = false;
	const frame = (op, data) => {
		const n = data.length, h = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : null;
		if (!h || closed) return; try { sock.write(Buffer.concat([h, data])) } catch (e) {}
	};
	const C = {
		send(text) { frame(1, Buffer.from(text, 'utf8')) },
		close(code) { if (closed) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); frame(8, b); closed = true; try { sock.end() } catch (e) {} setTimeout(() => sock.destroy(), 1000).unref(); onClose() }};
	sock.on('data', d => {
		if (closed) return;
		buf = Buffer.concat([buf, d]);
		if (buf.length > max + 16 + 4096) return C.close(1009);
		while (buf.length >= 2) {
			const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let n = buf[1] & 127, o = 2;
			if (!masked) return C.close(1002);
			if (n == 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4 } else if (n == 127) return C.close(1009);
			if (n > max) return C.close(1009);
			if (buf.length < o + 4 + n) return;
			const mask = buf.subarray(o, o + 4), data = Buffer.alloc(n);
			for (let i = 0; i < n; i++) data[i] = buf[o + 4 + i] ^ mask[i & 3];
			buf = buf.subarray(o + 4 + n);
			if (op == 8) return C.close(1000);
			if (op == 9) { frame(10, data); continue }
			if (op == 10) continue;
			if (op == 2) return C.close(1003);
			if (op == 1 || op == 0) {
				if (op == 1) { parts = []; partLen = 0 }
				parts.push(data); partLen += n; if (partLen > max) return C.close(1009);
				if (fin) { const t = Buffer.concat(parts).toString('utf8'); parts = []; partLen = 0; onText(t) }
				continue;
			}
			return C.close(1002);
		}
	});
	sock.on('close', () => { if (!closed) { closed = true; onClose() } });
	sock.on('end', () => C.close(1000));   /* (the other end gone without a close frame: the HTTP server's sockets are half-open) */
	sock.on('error', () => {});
	return C;
}

function serve(o) {
	o = o || {};
	const relay = createRelay(o), max = relay.LIMITS.maxMsg;
	const srv = http.createServer((q, res) => { res.writeHead(q.url == '/' ? 200 : 404, {'Content-Type': 'text/plain; charset=utf-8'}); res.end(q.url == '/' ? 'Ember Reach duel relay\n' : 'not here\n') });
	srv.on('upgrade', (q, sock) => {
		const key = q.headers['sec-websocket-key'];
		if (!/^\/(duel)?(\?.*)?$/.test(q.url) || String(q.headers.upgrade || '').toLowerCase() != 'websocket' || !key || q.headers['sec-websocket-version'] != '13') { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return }
		const acc = crypto.createHash('sha1').update(key + GUID).digest('base64');
		sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
		sock.setNoDelay(true);
		let h = null;
		const c = wsConn(sock, max, t => h && h.message(t), () => h && h.closed());
		h = relay.connect({send: t => c.send(t), close: () => c.close(1000), address: sock.remoteAddress});
	});
	const sw = setInterval(() => relay.sweep(), 5000); sw.unref();
	srv.on('close', () => clearInterval(sw));
	srv.relay = relay;
	return srv;
}
module.exports = {serve, wsConn};

if (require.main === module) {
	const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d };
	const port = +arg('--port', 8765), host = arg('--host', '127.0.0.1');
	const srv = serve();
	srv.listen(port, host, () => console.log('Ember Reach duel relay on ws://' + host + ':' + port + '/'));
	setInterval(() => { const s = srv.relay.stats(); if (s.clients) console.log(new Date().toISOString() + ' players ' + s.clients + ' rooms ' + s.rooms + ' queued ' + s.queued) }, 60000).unref();
	process.on('SIGTERM', () => process.exit(0));
}
