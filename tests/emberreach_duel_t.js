/* Ember Reach's duels (apps/rudolf-emberreach/www/duel.js, 0.5.0), in node: the ships and their balance, the arena,
   the match's rules (kills, time, sudden death, best of three), and collisions by speed; and duels over a network
   (0.5.2, net.js and tools/duel-relay): what travels, the smoothing of the other's ship, the session through the relay
   (rooms, quick match, the version check, limits), and the connection dropping; then the real relay on a port.
     node tests/emberreach_duel_t.js [PORT] */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Du = require(path.join(DIR, 'duel.js')), O = require(path.join(DIR, 'outfit.js')), Mi = require(path.join(DIR, 'mining.js')), Fl = require(path.join(DIR, 'flight.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d) : '')) } };
const len = a => Math.hypot(...a);
try {
	/* the ships */
	const S = require(path.join(DIR, 'ships.js')), B = Du.ROSTER.map(r => Du.build(r.id)), precHulls = new Set(S.precursors().map(x => x.id));
	ok('1. four duel ships, each from the ordinary yards: no Precursor hull or module, every gun gimballed', B.length == 4 && B.every(b => !precHulls.has(b.hull.id) && O.valid(b.hull, b.fit) && [...Object.values(b.fit.core), ...b.fit.internal, ...b.fit.external, ...b.fit.utility].filter(Boolean).every(m => m.grade != 'P' && !/needle|lance|phaser|alien/.test(m.id)) && b.ship.guns.filter(g => g != 'missile' && g != 'driver').every(g => /G$/.test(g))), B.map(b => b.ship.guns));
	const mark = Du.mark(), R = B.map(b => ({id: b.R.id, power: Du.rating(b.ship).power / mark, mob: b.R.mob, speed: b.ship.speed, agility: b.ship.agility, ehp: b.ship.hull + b.ship.shield, dps: Du.rating(b.ship).dps}));
	ok('2. balanced: each one\'s fighting power (a minute\'s damage times what it takes to destroy) is the mark times its handicap, within 75-160%', R.every(r => Math.abs(r.power - r.mob) < 0.01 && r.mob >= 0.75 && r.mob <= 1.6), R);
	ok('3. different strengths: the fastest isn\'t the toughest, and the hardest-hitting isn\'t the most nimble', (f => f('speed') != f('ehp') && f('dps') != f('agility'))(k => R.slice().sort((a, b) => b[k] - a[k])[0].id), R.map(r => [r.id, r.speed, r.ehp, Math.round(r.dps), r.agility]));
	/* the arena */
	const A = Du.arena(42), A2 = Du.arena(42), rocks = A.fields.flatMap(f => Mi.rocks(Object.assign({}, f), {}));
	const near = st => rocks.filter(r => len(r.pos.map((v, i) => v - st.p[i])) < 3000).length;
	ok('4. the arena: three dense swarms, the same rocks for both (seeded); the two start 20 km apart, facing each other, among the rocks', A.fields.length == 3 && JSON.stringify(A) == JSON.stringify(A2) && Math.abs(len(A.starts[0].p.map((v, i) => v - A.starts[1].p[i])) - 20000) < 1 && A.starts[0].face[0] == 1 && A.starts[1].face[0] == -1 && rocks.length > 150 && near(A.starts[0]) > 0 && near(A.starts[1]) > 0, {rocks: rocks.length, near: A.starts.map(near)});
	/* the rules */
	{
		const m = Du.match(1, ['shrike', 'pike']);
		Du.hit(m, 0, 30); Du.hit(m, 1, 12); let ev = null; for (let i = 0; i < 3100 && !ev; i++) ev = Du.step(m, 0.1);
		ok('5. at 5:00 the round goes to whoever did more damage', ev == 'time' && m.wins[0] == 1 && m.last.how == 'time' && m.phase == 'between', m);
		for (let i = 0; i < 70 && m.phase == 'between'; i++) ev = Du.step(m, 0.1);
		ok('6. 6 s on, the next round: the clock and the damage start again', ev == 'next' && m.round == 2 && m.t == 0 && m.dealt[0] == 0 && m.phase == 'fight', m);
		Du.hit(m, 0, 10); Du.hit(m, 1, 10); for (let i = 0; i < 3100 && m.phase == 'fight'; i++) ev = Du.step(m, 0.1);
		const lvl = m.phase; Du.step(m, 5); const still = m.phase; const r = Du.hit(m, 1, 0.5);
		ok('7. level at 5:00: sudden death, however long it takes, until the next damage done, which takes the round', lvl == 'sudden' && still == 'sudden' && r && r.winner == 1 && r.how == 'sudden' && m.wins[1] == 1, {lvl, still, r});
		for (let i = 0; i < 70 && m.phase == 'between'; i++) Du.step(m, 0.1);
		const k = Du.killed(m, 1);
		ok('8. a kill takes the round at once; two rounds take the match (2–1), and nothing counts after', k.winner == 0 && k.how == 'kill' && m.phase == 'over' && m.wins[0] == 2 && m.wins[1] == 1 && Du.hit(m, 1, 50) == null && Du.step(m, 10) == null && m.round == 3, m);
		const m2 = Du.match(2); Du.hit(m2, 1, 40); const both = Du.killed(m2, 0, true);
		ok('9. both destroyed at once: the round to the one who\'d done more damage', both.winner == 1, both);
	}
	/* collisions */
	{
		const a = {p: [0, 0, 0], v: [30, 0, 0], radius: 10, mass: 8}, b = {p: [19, 0, 0], v: [-30, 0, 0], radius: 10, mass: 8}, r = Du.bump(a, b);
		const c = {p: [0, 0, 0], v: [30, 0, 0], radius: 10, mass: 2}, d = {p: [19, 0, 0], v: [0, 0, 0], radius: 10, mass: 18}, r2 = Du.bump(c, d);
		const slow = Du.bump({p: [0, 0, 0], v: [2, 0, 0], radius: 10, mass: 1}, {p: [19, 0, 0], v: [0, 0, 0], radius: 10, mass: 1});
		ok('10. two ships meeting: both take damage from the speed they met at (60 m/s: 33 each), the lighter takes more; they bounce apart; under 5 m/s, a scrape', Math.abs(r.a - 33) < 1e-9 && r.a == r.b && a.v[0] < 0 && b.v[0] > 0 && len([a.p[0] - b.p[0], 0, 0]) >= 20 - 1e-9 && r2.a > r2.b * 5 && slow.a == 0 && slow.b == 0, {r, r2, slow});
		const s = {p: [0, 0, 0], v: [40, 0, 0], radius: 10}, rk = {pos: [25, 0, 0], radius: 20}, rb = Du.rockBump(s, rk);
		ok('11. an asteroid: pushed out, bounced back, and damage by speed (40 m/s: 21)', Math.abs(rb.dmg - 21) < 1e-9 && s.v[0] < 0 && len(s.p.map((v, i) => v - rk.pos[i])) >= 28 - 1e-9 && Du.impactDamage(5) == 0 && Du.impactDamage(105) == 60, rb);
	}
	/* AI duels: no ship wins or loses most of its pairings (the AIs' own fights, for balance; noisy) */
	{
		const ids = Du.ROSTER.map(r => r.id), wr = {}; for (const x of ids) wr[x] = [];
		for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
			let w = 0; const n = 10; for (let k = 0; k < n; k++) { const sw = k % 2, r = Du.simulate(sw ? ids[j] : ids[i], sw ? ids[i] : ids[j], 700 + k * 11 + i * 3 + j); if ((r.winner == 0) != !!sw) w++ }
			wr[ids[i]].push(w / n); wr[ids[j]].push(1 - w / n);
		}
		const avg = Object.fromEntries(ids.map(x => [x, +(wr[x].reduce((t, v) => t + v, 0) / wr[x].length).toFixed(2)]));
		ok('12. AI duels: every ship wins between 20% and 80% of its fights against the others', Object.values(avg).every(v => v >= 0.2 && v <= 0.8), avg);
	}
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }

/* ---------- 0.5.2: duels over a network ---------- */
const Nt = require(path.join(DIR, 'net.js')), {createRelay} = require(path.join(__dirname, '..', 'tools/duel-relay/relay-core.js'));
const PORT = +(process.argv[2] || 8750);
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(f, ms) { for (let t = 0; t < (ms || 3000); t += 20) { if (f()) return true; await wait(20) } return false }
/* a transport to a relay core in memory (as relay.js and worker.js give it connections) */
function memRelay(R, address) {
	const E = Nt.pair()[0]; let conn = null, closed = false;
	const T = {kind: 'mem', ev: {}, on(n, f) { (this.ev[n] = this.ev[n] || []).push(f); return this }, emit(n, a) { for (const f of (this.ev[n] || []).slice()) f(a) },
		send(o) { if (closed) return false; const s = JSON.stringify(o); setTimeout(() => conn && conn.message(s), 0); return true },
		close(why) { if (closed) return; closed = true; T.emit('close', why || 'closed'); setTimeout(() => conn && conn.closed(), 0) }};
	T.raw = [];
	setTimeout(() => { conn = R.connect({address: address || '10.0.0.' + Math.floor(Math.random() * 200), send: t => { T.raw.push(t); if (!closed) setTimeout(() => T.emit('message', JSON.parse(t)), 0) }, close: () => { if (!closed) { closed = true; setTimeout(() => T.emit('close', 'lost'), 0) } }}); T.emit('open') }, 0);
	void E; return T;
}
/* a session with its events recorded */
function sess(T, o) { const ev = []; const S = Nt.connect(T, o, {room: c => ev.push(['room', c]), paired: r => ev.push(['paired', r]), ready: () => ev.push(['ready']), peer: m => ev.push(['peer', m]), error: (w, t) => ev.push(['error', w, t]), close: w => ev.push(['close', w])}); S.ev = ev; S.has = k => ev.find(e => e[0] == k); return S }
async function netTests() {
	/* what travels */
	{
		const c = [5e8, -3e8, 2e8], sh = {p: [5e8 + 1234.567, -3e8 - 10, 2e8 + 0.004], v: [120.123, -3, 0], q: [0.5, 0.5, 0.5, 0.5], w: [0.1, 0, 0]};
		const pk = Nt.packShip(sh, c), up = Nt.unpackShip(JSON.parse(JSON.stringify(pk)), c);
		const bad = [Nt.unpackShip({p: [0, 0], v: [0, 0, 0], q: [1, 0, 0, 0]}, c), Nt.unpackShip({p: [0, NaN, 0], v: [0, 0, 0], q: [1, 0, 0, 0]}, c), Nt.unpackShip({p: [0, 0, 0], v: [0, 0, 0], q: 'x'}, c), Nt.unpackShip(null, c)];
		ok('13. a ship\'s state travels relative to the arena\'s centre (small numbers, centimetres), back within a centimetre; anything malformed is dropped', len(up.p.map((v, i) => v - sh.p[i])) < 0.01 && Math.abs(pk.p[0] - 1234.57) < 1e-9 && JSON.stringify(pk).length < 140 && bad.every(x => x === null), {pk, up});
		const shot = {kind: 'gatling', nid: 'h7', dmg: 12.5, ttl: 2, p: [5e8 + 100, -3e8, 2e8], v: [800, 0, 0], owner: 'me', target: null};
		const mis = {kind: 'missile', nid: 'h8', dmg: 80, ttl: 10, p: [5e8, -3e8, 2e8], v: [200, 0, 0], owner: 'me', target: 'duelist'};
		const ray = {kind: 'pulse', nid: 'g1', dmg: 6, ttl: 1, p: [5e8, -3e8, 2e8], dir: [0, 1, 0], range: 3000, ray: true, owner: 'me', target: null};
		const s1 = Nt.unpackShot(JSON.parse(JSON.stringify(Nt.packShot(shot, c))), c, 0.05), s2 = Nt.unpackShot(Nt.packShot(mis, c), c, 0), s3 = Nt.unpackShot(Nt.packShot(ray, c), c, 0);
		const nope = [Nt.unpackShot({k: '<b>', id: 'x', d: 1, ttl: 1, p: [0, 0, 0], v: [0, 0, 0]}, c), Nt.unpackShot({k: 'pulse', id: 'x', d: 1e9, ttl: 1, p: [0, 0, 0], v: [0, 0, 0]}, c), Nt.unpackShot({k: 'pulse', id: 'x', d: 1, ttl: 1, p: [0, 0, 0], ray: 1, dir: [0, 0]}, c)];
		ok('14. a shot travels as the receiver sees it: the sender\'s ship is the rival there, a missile at the receiver homes on the receiver; it\'s carried on by its age (half the round trip); lasers as rays; malformed ones dropped', s1.owner == 'duelist' && s1.target == null && Math.abs(s1.p[0] - (5e8 + 140)) < 0.02 && Math.abs(s1.ttl - 1.95) < 1e-9 && s2.target == 'me' && s2.kind == 'missile' && s3.ray && s3.range == 3000 && s3.dir[1] == 1 && nope.every(x => x === null), {s1, s2, s3});
		const m = Du.match(5, ['jackal', 'pike']); Du.hit(m, 0, 40); Du.hit(m, 1, 7); m.t = 120.5;
		const g = Nt.mirror(Nt.unpackMatch(JSON.parse(JSON.stringify(Nt.packMatch(m))))), last = Nt.mirrorLast({winner: 0, how: 'kill', round: 1, dealt: [40, 7], t: 30});
		ok('15. the match as the guest sees it: the guest is pilot 0 there, so wins, damage and the winner swap', g.dealt[0] == 7 && g.dealt[1] == 40 && g.t == 120.5 && g.phase == 'fight' && last.winner == 1 && last.dealt[0] == 7 && Nt.unpackMatch({ph: 'x'}) === null, {g, last});
	}
	/* the smoothing of the other's ship */
	{
		const sm = Nt.smoother(), cur = {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]};
		let rnd = 7; const jit = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647 };
		/* a ship at 200 m/s, its updates 30 a second, each 0-40 ms late (and one lost in five) */
		let t = 0, next = 0, worst = 0, maxStep = 0, last = cur.p.slice();
		const truth = tt => [200 * tt, 0, 50 * Math.sin(tt)];
		for (let i = 0; i < 600; i++) {
			t += 1 / 60;
			if (t >= next) { next += 1 / 30; if (jit() > 0.2) { const sent = next - 1 / 30, lag = 0.003 + jit() * 0.04; sm.push({p: truth(sent), v: [200, 0, 50 * Math.cos(sent)], q: [1, 0, 0, 0], w: [0, 0, 0], ts: 1000 + sent}, sent + lag) } }
			sm.step(cur, t, 1 / 60);
			if (i > 60) { worst = Math.max(worst, len(cur.p.map((v, k) => v - truth(t - 0.003)[k]))); maxStep = Math.max(maxStep, len(cur.p.map((v, k) => v - last[k]))) }
			last = cur.p.slice();
		}
		/* a correction: the update says 30 m off; it's closed over a few frames, not in one jump */
		const c2 = {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, sm2 = Nt.smoother(); sm2.push({p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, 0); sm2.step(c2, 0, 1 / 60);
		sm2.push({p: [30, 0, 0], v: [0, 0, 0], q: [0, 1, 0, 0], w: [0, 0, 0]}, 0.1); const first = sm2.step(c2, 0.1 + 1 / 60, 1 / 60).p[0];
		for (let i = 0; i < 30; i++) sm2.step(c2, 0.12 + i / 60, 1 / 60);
		/* far off (a new round, a respawn): straight there */
		const c3 = {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, sm3 = Nt.smoother(); sm3.push({p: [5000, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, 0); sm3.step(c3, 0, 1 / 60);
		ok('16. smoothing: a ship at 200 m/s with updates late by 3-43 ms (their send times telling the jitter) and one in five lost is shown within 2 m of where it was 3 ms ago, moving evenly; a 30 m correction closes over a few frames (and the turn with it); 400 m off, it jumps', worst < 2 && maxStep < 4.5 && first > 2 && first < 10 && Math.abs(c2.p[0] - 30) < 0.5 && Math.abs(c2.q[1]) > 0.99 && c3.p[0] == 5000 && sm3.jumps == 1, {worst, maxStep, first, after: c2.p[0], q: c2.q});
	}
	/* the session, through the relay (in memory) */
	{
		const R = createRelay();
		const h = sess(memRelay(R), {v: '0.5.2', mode: 'host'});
		await until(() => h.has('room'));
		const code = h.has('room')[1];
		const g = sess(memRelay(R), {v: '0.5.2', mode: 'join', code: code.toLowerCase().split('').join(' ')});
		await until(() => h.has('ready') && g.has('ready'));
		ok('17. hosting gives a room code; joining with it (any case or spacing) pairs the two as host and guest, and both hellos match', /^[A-Z2-9]{6}$/.test(code) && h.role == 'host' && g.role == 'guest' && !!h.has('ready') && !!g.has('ready') && R.stats().rooms == 0, {code, h: h.ev, g: g.ev});
		h.send({t: 'st', r: 1, x: 2}); g.send({t: 'shot', s: {k: 'pulse'}});
		await until(() => h.has('peer') && g.has('peer'));
		const raw = [].concat(h.T.raw, g.T.raw).join('\n');
		ok('18. after pairing every message goes to the other as it is; nothing the relay sends carries an address', g.has('peer')[1].x == 2 && h.has('peer')[1].t == 'shot' && !/10\.0\.0\.|address|ip/i.test(raw), raw.slice(0, 300));
		/* the version check: at the relay (a room of another version), and between the two (pair: no relay) */
		const h2 = sess(memRelay(R), {v: '0.5.1', mode: 'host'}); await until(() => h2.has('room'));
		const g2 = sess(memRelay(R), {v: '0.5.2', mode: 'join', code: h2.has('room')[1]}); await until(() => g2.has('close'));
		const [a, b] = Nt.pair(), pa = sess(a, {v: '0.5.2', mode: 'host'}), pb = sess(b, {v: '0.5.3', mode: 'join', code: 'AAAAAA'});
		a.emit('message', {t: 'paired', role: 'host'}); b.emit('message', {t: 'paired', role: 'guest'});
		await until(() => pa.has('close') && pb.has('close'));
		const e1 = g2.has('error'), e2 = pa.has('error'), e3 = pb.has('error');
		ok('19. another version is refused, with a message: by the relay (the room is 0.5.1) and by the other game\'s hello (0.5.3)', e1 && e1[1] == 'version' && /0\.5\.1/.test(e1[2]) && /same version/.test(e1[2]) && e2 && e2[1] == 'version' && /0\.5\.3/.test(e2[2]) && e3 && /0\.5\.2/.test(e3[2]) && !pa.has('ready'), {e1, e2, e3});
		/* quick match: only the same version */
		const q1 = sess(memRelay(R), {v: '0.5.2', mode: 'quick'}), q2 = sess(memRelay(R), {v: '0.5.0', mode: 'quick'});
		await wait(60);
		const alone = !q1.has('paired') && !q2.has('paired');
		const q3 = sess(memRelay(R), {v: '0.5.2', mode: 'quick'}); await until(() => q1.has('ready') && q3.has('ready'));
		ok('20. quick match pairs the next two waiting with the same version (0.5.0 keeps waiting)', alone && q1.role == 'host' && q3.role == 'guest' && !q2.has('paired'), {q1: q1.ev, q2: q2.ev, q3: q3.ev});
		q2.close();
		/* leaving: the other is told at once */
		g.close('left'); await until(() => h.has('close'));
		ok('21. leaving: the other is told by the relay and its session closes ("gone")', h.has('close')[1] == 'gone' && g.has('close')[1] == 'left', {h: h.has('close'), g: g.has('close')});
		/* a connection that goes silent: closed after 5 s without a word (timeout shortened here) */
		const keep = Object.assign({}, Nt.NET); Nt.NET.timeout = 0.6; Nt.NET.ping = 0.1;
		const [x, y] = Nt.pair(), sx = sess(x, {v: '0.5.2', mode: 'host'}); sess(y, {v: '0.5.2', mode: 'join', code: 'AAAAAA'});
		x.emit('message', {t: 'paired', role: 'host'}); y.send = () => true;   /* (y hears, but nothing it says arrives) */
		await until(() => sx.has('close'), 3000);
		Object.assign(Nt.NET, keep);
		ok('22. a connection that drops silently: nothing heard for the timeout, the match ends ("timeout")', sx.has('close') && sx.has('close')[1] == 'timeout', sx.ev);
		/* limits */
		const big = sess(memRelay(R), {v: '0.5.2', mode: 'host'}); await until(() => big.has('room'));
		const f1 = sess(memRelay(R), {v: 'flood', mode: 'quick'}), f2 = sess(memRelay(R), {v: 'flood', mode: 'quick'}); await until(() => f1.has('ready') && f2.has('ready'));
		let refused = null; f1.T.on('message', m => { if (m.t == 'error') refused = m }); for (let i = 0; i < 300; i++) f1.T.send({t: 'st', i}); await until(() => refused);
		const flooded = f2.ev.filter(e => e[0] == 'peer').length;
		const T2 = memRelay(R); let r2 = null; T2.on('message', m => { if (m.t == 'error') r2 = m }); await wait(10); T2.send({t: 'host', v: '0.5.2', proto: 1, pad: 'x'.repeat(9000)}); await until(() => r2);
		const many = []; let r3 = null; for (let i = 0; i < 9; i++) { const x = memRelay(R, '192.168.1.9'); x.on('message', m => { if (m.t == 'error') r3 = Object.assign({n: i}, m) }); many.push(x) } await until(() => r3, 500);
		const T4 = memRelay(R); let r4 = null; T4.on('message', m => { if (m.t == 'error') r4 = m }); await wait(10); T4.send({t: 'join', code: 'QQQQQQ', v: '0.5.2', proto: 1}); await until(() => r4);
		ok('23. the relay\'s limits: a flood of messages (over 240 at once: the other got no more), one over 8 KB, a ninth connection from one address, and an unknown room are each refused with a reason', refused && refused.why == 'rate' && flooded <= 240 && flooded > 200 && r2 && r2.why == 'size' && r3 && r3.why == 'busy' && r3.n == 8 && r4 && r4.why == 'room', {refused, flooded, r2, r3, r4});
		for (const m of many) m.close(); big.close(); f2.close(); h2.close(); q1.close(); q3.close();
		await wait(50);
		ok('24. everyone gone: the relay keeps nothing (no rooms, queue or connections)', (st => st.rooms == 0 && st.queued == 0 && st.clients == 0)(R.stats()), R.stats());
	}
	/* the real relay, over WebSocket on a port (Node's own WebSocket client) */
	{
		const srv = require(path.join(__dirname, '..', 'tools/duel-relay/relay.js')).serve();
		await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
		const url = 'ws://127.0.0.1:' + PORT + '/';
		const h = sess(Nt.ws(url), {v: '0.5.2', mode: 'host'}); await until(() => h.has('room'), 3000);
		const g = sess(Nt.ws(url), {v: '0.5.2', mode: 'join', code: h.has('room') && h.has('room')[1]}); await until(() => h.has('ready') && g.has('ready'), 3000);
		g.send({t: 'st', r: 1, s: {p: [1, 2, 3]}}); await until(() => h.has('peer'), 2000);
		await until(() => h.rtt > 0, 2500);
		g.close('left'); await until(() => h.has('close'), 2000);
		ok('25. the relay on a port: room, join, a message through, a round trip measured, and the leaving told', !!h.has('ready') && h.has('peer') && h.has('peer')[1].s.p[2] == 3 && h.rtt > 0 && h.rtt < 0.5 && h.has('close')[1] == 'gone', {h: h.ev.map(e => e[0]), rtt: h.rtt});
		srv.close();
	}
}
(async () => {
	try { await netTests() } catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
	console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
})();
