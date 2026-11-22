#!/usr/bin/env node
/* ===== The duel relay, in Node (Ember Reach duels, 0.5.2) =====
   A small WebSocket server for two players' games: room codes ("join ABC123"), a quick-match queue, both versions
   checked, the players never told each other's addresses, and limits on size, rate and time (protocol.mjs). No
   packages: Node's own http and crypto, and the WebSocket framing (RFC 6455) here.
     node relay.mjs [--port 8787] [--host 0.0.0.0]          online: any number of rooms
     node relay.mjs --port P --lan CODE [--host ADDR]        one room with that code (a LAN; tests)
   It answers GET / with a line saying what it is, and /health with its counts (no addresses). It logs nothing about
   the players. Behind a TLS proxy (or Cloudflare: worker.mjs is the same protocol) it's wss://.
   GPL-2.0-or-later. ===== */
import http from 'node:http';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Lobby, LIMITS} from './protocol.mjs';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* one WebSocket connection, server side: text messages in and out, ping answered, close handled */
function wsConn(sock, onText, onClose) {
	let buf = Buffer.alloc(0), parts = [], partLen = 0, done = false;
	const frame = (op, data) => {
		const n = data.length, h = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : null;
		if (!h || done) return; try { sock.write(Buffer.concat([h, data])) } catch (e) {}
	};
	const c = {
		send: t => frame(1, Buffer.from(t, 'utf8')),
		close: (code, why) => { if (done) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); frame(8, Buffer.concat([b, Buffer.from(String(why || '').slice(0, 60))])); done = true; try { sock.end() } catch (e) {} setTimeout(() => sock.destroy(), 1000).unref(); finish() },
		ip: sock.remoteAddress
	};
	let closed = false; const finish = () => { if (closed) return; closed = true; onClose(c) };
	sock.on('data', d => {
		if (done) return;
		buf = Buffer.concat([buf, d]);
		if (buf.length > LIMITS.msg * 2 + 64) return c.close(1009, 'too big');
		for (;;) {
			if (buf.length < 2) return;
			const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let n = buf[1] & 127, o = 2;
			if (!masked || buf[0] & 0x70) return c.close(1002, 'protocol');
			if (n == 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4 } else if (n == 127) return c.close(1009, 'too big');
			if (n > LIMITS.msg) return c.close(1009, 'too big');
			if (buf.length < o + 4 + n) return;
			const mask = buf.subarray(o, o + 4), data = Buffer.alloc(n); for (let i = 0; i < n; i++) data[i] = buf[o + 4 + i] ^ mask[i & 3];
			buf = buf.subarray(o + 4 + n);
			if (op == 8) { c.close(1000, ''); return }
			if (op == 9) { frame(10, data); continue }
			if (op == 10) continue;
			if (op == 2) return c.close(1003, 'text only');
			if (op != 0 && op != 1) return c.close(1002, 'protocol');
			if (op == 1 && parts.length) return c.close(1002, 'protocol');
			if (op == 0 && !parts.length) return c.close(1002, 'protocol');
			parts.push(data); partLen += n;
			if (partLen > LIMITS.msg) return c.close(1009, 'too big');
			if (!fin) continue;
			const text = Buffer.concat(parts).toString('utf8'); parts = []; partLen = 0;
			onText(c, text);
			if (done) return;
		}
	});
	sock.on('close', finish); sock.on('error', finish); sock.on('end', finish);
	return c;
}

export function serve(opt) {
	const lobby = new Lobby({single: opt.lan || null, rnd: () => crypto.randomInt(0, 2 ** 31) / 2 ** 31});
	const perIp = new Map(), conns = new Map();
	const allowed = opt.allow || (() => true);
	const server = http.createServer((req, res) => {
		if (req.url == '/health') { res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(lobby.stats())); return }
		res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'}); res.end('Ember Reach duel relay (WebSocket): docs/duel-protocol.md\n');
	});
	server.on('upgrade', (req, sock) => {
		const key = req.headers['sec-websocket-key'], ip = sock.remoteAddress || '?';
		const no = (code, why) => { try { sock.end('HTTP/1.1 ' + code + ' ' + why + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n') } catch (e) {} sock.destroy() };
		if (String(req.headers.upgrade).toLowerCase() != 'websocket' || !key || !/^[A-Za-z0-9+/]{22}==$/.test(key) || req.headers['sec-websocket-version'] != '13') return no(400, 'Bad Request');
		if (!allowed(ip)) return no(403, 'Forbidden');
		if ((perIp.get(ip) || 0) >= LIMITS.perIp) return no(429, 'Too Many Requests');
		perIp.set(ip, (perIp.get(ip) || 0) + 1);
		const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
		sock.setNoDelay(true); sock.setTimeout(LIMITS.quiet * 1000 + 5000, () => sock.destroy());
		sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
		const c = wsConn(sock, (w, t) => lobby.message(conns.get(w), t), w => {
			const n = (perIp.get(ip) || 1) - 1; if (n > 0) perIp.set(ip, n); else perIp.delete(ip);
			const p = conns.get(w); conns.delete(w); if (p) lobby.closed(p);
			if (opt.onGone) opt.onGone(lobby);
		});
		conns.set(c, lobby.connect(c));
	});
	const sweep = setInterval(() => lobby.sweep(), 1000); sweep.unref();
	server.on('close', () => clearInterval(sweep));
	return new Promise((res, rej) => { server.once('error', rej); server.listen(opt.port, opt.host || '0.0.0.0', () => res({server, lobby, port: server.address().port})) });
}

/* run as a program */
if (process.argv[1] && import.meta.url == pathToFileURL(process.argv[1]).href) {
	const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d };
	const opt = {port: +arg('--port', 8787), host: arg('--host', '0.0.0.0'), lan: arg('--lan', null)};
	serve(opt).then(r => console.log('duel relay on ' + opt.host + ':' + r.port + (opt.lan ? ' (one room, ' + opt.lan + ')' : '')), e => { console.error(e.message); process.exit(1) });
}
