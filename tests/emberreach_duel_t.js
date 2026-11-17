/* Ember Reach's duels (apps/rudolf-emberreach/www/duel.js, 0.5.0), in node: the ships and their balance, the arena,
   the match's rules (kills, time, sudden death, best of three), and collisions by speed.
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
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
