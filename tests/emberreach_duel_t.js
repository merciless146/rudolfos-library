/* Ember Reach's duels (apps/rudolf-emberreach/www/duel.js, 0.5.0), in node: the ships and their balance, the arena,
   the match's rules (kills, time, sudden death, best of three), and collisions by speed. (0.5.2) Duels over a network
   (net.js): what travels (ships, shots, the match seen from the guest's side), the session (the relay's handshake,
   the version check, leaving, a lost connection), smoothing the other's ship, and the relay's address.
     node tests/emberreach_duel_t.js */
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
	/* ---------- (0.5.2) over a network: net.js ---------- */
	const Ne = require(path.join(DIR, 'net.js'));
	{
		const c = [1e9, -2e9, 3e8], s = {p: [1e9 + 1234.567, -2e9 - 50.004, 3e8 + 7], v: [120.123, -3, 0], q: [0.5, 0.5, 0.5, 0.5], w: [0.1, 0, -0.2]};
		const pk = Ne.packShip(s, c), back = Ne.unpackShip(JSON.parse(JSON.stringify(pk)), c);
		const bad = [{p: [NaN, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, {p: [3e5, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, {p: [0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, {p: [0, 0, 0], v: [0, 0, 0], q: [0, 0, 0, 0], w: [0, 0, 0]}, null, 'x'];
		ok('13. a ship travels relative to the arena\'s centre (small numbers, to the centimetre) and comes back where it was; anything malformed or out of the arena is refused', Math.abs(pk.p[0] - 1234.57) < 1e-9 && len(back.p.map((v, i) => v - s.p[i])) < 0.01 && Math.abs(back.v[0] - 120.12) < 1e-9 && bad.every(b => Ne.unpackShip(b, c) == null), {pk, back});
		const shot = {kind: 'pulseG', p: [1e9 + 10, -2e9, 3e8], v: [800, 0, 0], ttl: 2.5, dmg: 9.3, owner: 'me', target: null}, ray = {kind: 'beamG', p: [1e9, -2e9, 3e8], dir: [0, 1, 0], range: 1800, ray: true, ttl: 1, dmg: 4, owner: 'me', target: null}, msl = {kind: 'missile', p: c, v: [10, 0, 0], ttl: 9, dmg: 60, owner: 'me', target: 'duelist'};
		const kinds = Object.keys(require(path.join(DIR, 'combat.js')).WEAPONS), sk = kinds.includes('pulseG') ? shot : Object.assign({}, shot, {kind: kinds.find(k => !/missile|torpedo|beam/.test(k))}), rk = kinds.includes('beamG') ? ray : Object.assign({}, ray, {kind: kinds[0]});
		const u = [sk, rk, msl].map(x => Ne.unpackShot(JSON.parse(JSON.stringify(Ne.packShot(x, c, 'duelist'))), c, 'duelist', 'me'));
		ok('14. shots travel as their kind, place, velocity (or a laser\'s ray) and damage: arriving, they\'re the other ship\'s, and a missile at you homes on you; an unknown weapon or wild damage is refused', u.every(x => x && x.owner == 'duelist') && len(u[0].p.map((v, i) => v - sk.p[i])) < 0.01 && u[0].v[0] == 800 && u[1].ray && u[1].range == 1800 && u[2].target == 'me' && u[0].target == null && Ne.unpackShot({k: 'phaser9', p: [0, 0, 0], v: [0, 0, 0], ttl: 1, dmg: 1}, c, 'x', 'me') == null && Ne.unpackShot({k: sk.kind, p: [0, 0, 0], v: [0, 0, 0], ttl: 1, dmg: 1e7}, c, 'x', 'me') == null, u);
		const m = Du.match(5, ['pike', 'jackal']); Du.hit(m, 0, 40); Du.hit(m, 1, 10); Du.killed(m, 1);
		const mm = Ne.mirror(JSON.parse(JSON.stringify(Ne.packMatch(m))));
		ok('15. the match, as the guest sees it: the host\'s match with the sides swapped (wins, damage, ships, who won the last round)', mm.wins.join() == '0,1' && mm.dealt.join() == '10,40' && mm.ships.join() == 'jackal,pike' && mm.last.winner == 1 && mm.round == 1 && mm.phase == 'between' && Ne.mirror({round: 1}) == null, mm);
	}
	/* a session through a small stand-in relay (pipes): pairs a host and a guest by code, passes their messages, and
	   tells one when the other goes */
	const relay = () => {
		const rooms = {};
		return (side, cli) => {
			side.onmessage = m => {
				if (m.t == 'hello') {
					if (m.want == 'host') { const code = 'ABC234'; rooms[code] = {host: side, ver: m.ver}; side.room = rooms[code]; side.send({t: 'room', code}) }
					else { const r = rooms[m.code]; if (!r) return side.send({t: 'error', why: 'room'}); r.guest = side; side.room = r; r.host.send({t: 'paired', role: 'host'}); side.send({t: 'paired', role: 'guest'}) }
				} else if (m.t == 'g' && side.room) { const o = side.room.host == side ? side.room.guest : side.room.host; if (o) o.send(m) }
			};
			side.onclose = () => { const r = side.room; if (!r) return; const o = r.host == side ? r.guest : r.host; if (o && !o.closed) { o.send({t: 'left'}); o.close() } };
		};
	};
	const wait = ms => new Promise(r => setTimeout(r, ms));
	const pair = async (verA, verB, clk) => {
		const R = relay(), [ah, ar] = Ne.pipe(1), [bh, br] = Ne.pipe(1); R(ar); R(br);
		const ev = {a: [], b: []}, A = Ne.session(ah, {ver: verA, want: 'host', ship: 'pike', now: clk}), log = (k, n) => x => ev[k].push([n, x]);
		for (const n of ['room', 'paired', 'ready', 'msg', 'end']) A.on(n, log('a', n));
		await wait(20);
		const B = Ne.session(bh, {ver: verB, want: 'join', code: A.code, ship: 'lancet', now: clk});
		for (const n of ['room', 'paired', 'ready', 'msg', 'end']) B.on(n, log('b', n));
		await wait(40);
		return {A, B, ev, bh};
	};
	(async () => {
		{
			const {A, B, ev} = await pair('0.5.2', '0.5.2');
			A.send({k: 'st', n: 1}); await wait(20);
			ok('16. a session: the host gets a code, the guest joins with it; each says hello (its version and ship) and they\'re ready; messages pass', A.code == 'ABC234' && A.role == 'host' && B.role == 'guest' && A.state == 'ready' && B.state == 'ready' && A.peer.ship == 'lancet' && B.peer.ship == 'pike' && ev.b.some(([n, x]) => n == 'msg' && x.k == 'st'), {a: ev.a.map(e => e[0]), b: ev.b.map(e => e[0])});
			B.leave(); await wait(30);
			const ea = ev.a.find(e => e[0] == 'end'), eb = ev.b.find(e => e[0] == 'end');
			ok('17. leaving: the other is told at once ("The other pilot left the duel") and both sessions end, cleanly, once', ea && ea[1].why == 'left' && /left the duel/.test(ea[1].text) && eb && eb[1].why == 'mine' && A.state == 'over' && B.state == 'over' && ev.a.filter(e => e[0] == 'end').length == 1, {ea, eb});
		}
		{
			const {A, B, ev} = await pair('0.5.2', '0.5.1');
			const ea = ev.a.find(e => e[0] == 'end'), eb = ev.b.find(e => e[0] == 'end');
			ok('18. both must run the same version: a 0.5.1 game and a 0.5.2 one are refused, each told which the other runs', A.state == 'over' && B.state == 'over' && !ev.a.some(e => e[0] == 'ready') && ea && ea[1].why == 'version' && /0\.5\.1/.test(ea[1].text) && /0\.5\.2/.test(ea[1].text) && eb && eb[1].why == 'version' && /Ember Reach 0\.5\.2 and you run 0\.5\.1/.test(eb[1].text), {ea, eb});
		}
		{
			let T = 100; const clk = () => T;
			const {A, B, ev, bh} = await pair('0.5.2', '0.5.2', clk);
			T += 2; A.tick(); await wait(20); const answered = A.rtt != null, was = A.state;
			/* the guest's side goes silent (its connection hangs, nothing closes): 10 s on, the host gives up */
			bh.send = () => true;
			T += 5; A.tick(); await wait(20); const mid = A.state; T += 6; A.tick(); await wait(20);
			const ea = ev.a.find(e => e[0] == 'end');
			ok('19. a connection gone quiet (nothing heard for 10 s): the duel ends cleanly, "the connection ... was lost"', was == 'ready' && mid == 'ready' && A.state == 'over' && ea && ea[1].why == 'lost' && /lost/.test(ea[1].text) && answered, ea);
			const [x, y] = Ne.pipe(0), S = Ne.session(x, {ver: '0.5.2', want: 'quick'}), got = []; S.on('end', e => got.push(e)); y.onmessage = () => {};
			await wait(10); y.close(); await wait(10);
			ok('20. the relay closing the connection before a match ends the session with a message too', got.length == 1 && got[0].why == 'closed' && S.state == 'over', got);
		}
		/* smoothing */
		{
			const g = Ne.ghost(), sh = {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]};
			let t = 0, maxErr = 0, err = 0;
			const truth = tt => [100 * tt, 50 * Math.sin(tt), 0], vel = tt => [100, 50 * Math.cos(tt), 0];
			for (let i = 0; i < 600; i++) {   /* 10 s at 60 steps, a state every 2 steps (30 a second), 60 ms late */
				t += 1 / 60;
				if (i % 2 == 0) Ne.ghostSet(g, {p: truth(t - 0.06), v: vel(t - 0.06), q: [Math.cos(t / 4), 0, Math.sin(t / 4), 0], w: [0, 0.5, 0]}, t);
				Ne.ghostStep(g, sh, 1 / 60, t);
				err = len(sh.p.map((v, k) => v - truth(t - 0.06)[k])); if (i > 60) maxErr = Math.max(maxErr, err);
			}
			const first = (() => { const g2 = Ne.ghost(), s2 = {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}; Ne.ghostSet(g2, {p: [9000, 0, 0], v: [10, 0, 0], q: [0, 1, 0, 0], w: [0, 0, 0]}, 0); Ne.ghostStep(g2, s2, 1 / 60, 0); return s2 })();
			const jump = (() => { const g3 = Ne.ghost(), s3 = {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}; Ne.ghostSet(g3, {p: [0, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, 0); Ne.ghostStep(g3, s3, 1 / 60, 0); Ne.ghostSet(g3, {p: [50, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, 0); Ne.ghostStep(g3, s3, 1 / 60, 0); const one = s3.p[0]; Ne.ghostSet(g3, {p: [2000, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0]}, 0); Ne.ghostStep(g3, s3, 1 / 60, 0); return {one, far: s3.p[0]} })();
			const ql = Math.hypot(...sh.q);
			ok('21. smoothing the other\'s ship: it follows a curving course within a metre or two (carried on by its velocity, eased to where the last state says it is now); placed at once at first, eased over a small jump, snapped over a big one; its rotation stays a rotation', maxErr < 2 && first.p[0] == 9000 && first.q[1] == 1 && jump.one > 0 && jump.one < 20 && jump.far == 2000 && Math.abs(ql - 1) < 1e-9, {maxErr, first: first.p, jump, ql});
		}
		ok('22. the online relay: none until one is set up ("not set up yet"); a page\'s ?relay= only if it\'s a ws:// or wss:// address', Ne.RELAY == '' && Ne.relayUrl('') == '' && Ne.relayUrl('?relay=wss://duel.example.org/x') == 'wss://duel.example.org/x' && Ne.relayUrl('?relay=ws://127.0.0.1:8771/') == 'ws://127.0.0.1:8771/' && Ne.relayUrl('?relay=https://evil.example/') == '' && Ne.relayUrl('?relay=javascript:alert(1)') == '' && Ne.helloUrl('wss://r.example/duel?x=1', {want: 'join', ver: '0.5.2', code: 'ABC234'}) == 'wss://r.example/duel?want=join&ver=0.5.2&code=ABC234', [Ne.helloUrl('ws://h:1/', {want: 'quick', ver: '0.5.2'}), Ne.relayUrl('?relay=wss://duel.example.org/x')]);
		ok('23. room codes: six of the letters and digits that can\'t be mixed up; typed codes cleaned up', Ne.validCode(Ne.makeCode()) && !/[01OIL]/.test([...Array(50)].map(() => Ne.makeCode()).join('')) && Ne.normCode(' abc-234 ') == 'ABC234' && !Ne.validCode('ABC10O'), Ne.makeCode());
		done();
	})().catch(e => { N++; console.log('FAIL (error) ' + (e.stack || e)); done() });
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)); done() }
function done() { console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0) }
