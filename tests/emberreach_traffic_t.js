/* Ember Reach: the traffic controller (landing L2.4, www/traffic.js): pads by size, the queue shared with NPCs,
   five minutes to dock, and NPC traffic.   node tests/emberreach_traffic_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const A = require(path.join(DIR, 'traffic.js')), S = require(path.join(DIR, 'ships.js')), Su = require(path.join(DIR, 'surface.js'));
let N = 0, P = 0; const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 400) : '')) } };
try {
	/* classes */
	const cls = id => A.classOf(S.hull(id));
	ok('1. pad classes by hull size: XS and S use S pads, M, L and XL their own, capital ships capital berths', cls('wren') == 'S' && A.classOf({size: 'S'}) == 'S' && A.classOf({size: 'M'}) == 'M' && A.classOf({size: 'L'}) == 'L' && A.classOf({size: 'XL'}) == 'XL' && A.classOf({size: 'Capital'}) == 'C');
	ok('2. a ship may be given its own class or larger, never smaller; capital ships only berths', A.allowed('S').join() == 'S,M,L,XL' && A.allowed('M').join() == 'M,L,XL' && A.allowed('XL').join() == 'XL' && A.allowed('C').join() == 'C');
	/* a quiet station: its own class first */
	const st = {id: 'orbital', cls: 'lantern'};
	let C = A.make(st, null, {busy: 0, npcRate: 0});
	ok('3. a space port has 24 pads (S to XL, no capital berth)', C.pads.length == 24 && !C.pads.some(p => p.size == 'C'), C.pads.map(p => p.size).join(''));
	const r1 = A.request(C, 'me', 'M', 0);
	ok('4. a pad of the ship\'s own class first, with five minutes to dock', r1.ok && r1.size == 'M' && r1.until == 300, r1);
	/* every M pad taken: a larger one; every S, M, L and XL taken: the queue */
	C = A.make(st, null, {busy: 0, npcRate: 0}); C.pads.filter(p => p.size == 'M').forEach((p, i) => { p.who = 'x' + i; p.docked = true; p.until = 1e9 });
	const r2 = A.request(C, 'me', 'M', 0);
	ok('5. with its class full, a smaller ship gets a larger pad', r2.ok && r2.size == 'L', r2);
	C = A.make(st, null, {busy: 0, npcRate: 0}); C.pads.filter(p => p.size == 'XL').forEach((p, i) => { p.who = 'x' + i; p.docked = true; p.until = 1e9 });
	const r3 = A.request(C, 'me', 'XL', 0), r3b = A.request(C, 'tiny', 'S', 0);
	ok('6. a larger ship is never given a smaller pad: with the XL pads full it queues, while a small ship still lands', r3.queued == 1 && r3b.ok && r3b.size == 'S', [r3, r3b]);
	ok('7. a capital ship can\'t land at a space port at all (no berth): refused', A.request(C, 'cap', 'C', 0).why == 'size');
	/* the queue: first come, first served, players and NPCs alike */
	C = A.make(st, null, {busy: 0, npcRate: 0}); C.pads.forEach((p, i) => { p.who = 'npcx' + i; p.docked = true; p.until = 100 + i });
	const qa = A.request(C, 'npcA', 'S', 1), qb = A.request(C, 'me', 'S', 2), qc = A.request(C, 'npcC', 'S', 3);
	ok('8. every pad taken: the ship joins the queue and is told its place', qa.queued == 1 && qb.queued == 2 && qc.queued == 3, [qa, qb, qc]);
	let ev = A.tick(C, 100.5);   /* pad x0 (an S pad) frees: npcA takes it */
	const after1 = A.status(C, 'me');
	ev = ev.concat(A.tick(C, 101.5));   /* the next pad frees: me */
	const mine = ev.find(e => e.who == 'me' && e.k == 'cleared');
	ok('9. pads go to the queue in order: the NPC ahead first, then you, told your place as it moves and then your pad', after1.queued == 1 && mine && mine.until == 101.5 + 300 && A.status(C, 'me').pad == mine.pad, {after1, ev});
	/* the five minutes */
	C = A.make(st, null, {busy: 0, npcRate: 0}); const r4 = A.request(C, 'me', 'S', 0);
	const before = A.tick(C, 299), late = A.tick(C, 301);
	ok('10. not down within five minutes: the clearance is revoked and the pad freed (ask again)', r4.ok && !before.length && late.some(e => e.k == 'revoked' && e.who == 'me') && A.status(C, 'me') === null && !C.pads.find(p => p.n == r4.pad).who, late);
	const r5 = A.request(C, 'me', 'S', 302); A.docked(C, 'me'); const held = A.tick(C, 2000);
	ok('11. once docked the pad is held with no clock, until the ship leaves', r5.ok && !held.some(e => e.who == 'me') && A.status(C, 'me').docked && (A.release(C, 'me'), A.status(C, 'me') === null));
	/* a revoked pad goes to the next in the queue */
	C = A.make(st, null, {busy: 0, npcRate: 0}); C.pads.forEach((p, i) => { if (p.size != 'XL') { p.who = 'x' + i; p.docked = true; p.until = 1e9 } });
	const ra = A.request(C, 'me', 'XL', 0), rb = A.request(C, 'me2', 'XL', 0), rc = A.request(C, 'me3', 'XL', 0);
	const rev = A.tick(C, 301);
	ok('12. a revoked pad goes to the next in the queue', ra.ok && rb.ok && rc.queued == 1 && rev.some(e => e.k == 'revoked' && e.who == 'me') && rev.some(e => e.k == 'cleared' && e.who == 'me3'), rev);
	/* NPC traffic */
	C = A.make(st, null, {seed: 'busy'});
	const start = C.pads.filter(p => p.who).length; let occ = []; for (let t = 0; t <= 3600; t += 5) { A.tick(C, t); occ.push(C.pads.filter(p => p.who).length) }
	ok('13. NPC traffic comes and goes: some pads taken on arrival, the count changing over an hour, never all for long', start > 3 && start < 20 && new Set(occ).size > 3 && occ.filter(x => x == 24).length < occ.length * 0.3, {start, min: Math.min(...occ), max: Math.max(...occ)});
	/* surface ports: pads from the layout */
	const camp = {id: 'surface:W b:camp', kind: 'camp', surface: true, name: 'W b Mining camp', world: 'W b', seed: 5}, Ly = Su.layout('camp', 5);
	const Cs = A.make(camp, Ly, {busy: 0, npcRate: 0});
	ok('14. a surface port\'s pads are its layout\'s (a mining camp: two S pads); a medium ship can\'t land there', Cs.pads.length == Ly.pads.length && Cs.pads.every(p => p.size == 'S') && A.request(Cs, 'm', 'M', 0).why == 'size');
	const field = {id: 'surface:W c:field', kind: 'field', surface: true, name: 'W c field', world: 'W c', seed: 7}, Cf = A.make(field, Su.layout('field', 7), {busy: 0, npcRate: 0});
	const rf = A.request(Cf, 'cap', 'C', 0), rx = A.request(Cf, 'xl', 'XL', 0), rs = A.request(Cf, 'small', 'S', 0);
	ok('15. a heavy landing field takes a capital ship on its berth and XL ships on its XL pads; a small ship gets an XL pad there', rf.ok && rf.size == 'C' && rx.ok && rx.size == 'XL' && rs.ok && rs.size == 'XL', [rf, rx, rs]);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
