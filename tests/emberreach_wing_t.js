/* Ember Reach's co-op wing, its data (0.6.1: wing.js; docs/plan-ember-reach-pilots.md P5b), in node: members and NPCs
   as they travel (and what's refused), which NPCs go out, a message kept under the relay's size, the hits a guest
   may claim, and a guest's days onto the host's and back.
     node tests/emberreach_wing_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Wg = req('wing.js'), Ne = req('net.js'), Sv = req('save.js'), Tr = req('trade.js'), F = req('factions.js'), S = req('ships.js'), O = req('outfit.js'), Fl = req('flight.js'), C = req('combat.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
try {
	const kestrel = S.ships().find(x => x.id == 'kestrel'), o = [1.2e9, -3.4e8, 5.6e8];
	const ship = (p, extra) => { const s = Fl.create(kestrel, {p, q: [0, 0, 0, 1], v: [10, 0, -5]}); return Object.assign({s, cs: C.state(O.derive(kestrel)), ship: kestrel}, extra || {}) };
	/* members */
	const a = ship([o[0] + 800, o[1], o[2] - 300]), pm = Wg.packMember(2, a.s, o, {model: 'kestrel', name: 'Ada <b>', cs: a.cs, cloak: 2, docked: false});
	const um = Wg.unpackMember(JSON.parse(JSON.stringify(pm)), o);
	ok('1. a member travels relative to the message\'s centre (small numbers, whole systems away from the star) and comes back the same; the name is cleaned', Math.abs(pm.me.p[0] - 800) < 1e-6 && Math.abs(um.me.p[0] - a.s.p[0]) < 0.01 && um.id == 2 && um.model == 'kestrel' && um.name == 'Ada b' && um.cloak == 2 && !um.docked, um);
	ok('2. refused: a seat past four, a ship too far from the centre (200 km), a bad condition', !Wg.unpackMember(Object.assign({}, pm, {id: 4}), o) && !Wg.unpackMember(Wg.packMember(1, ship([o[0] + 3e5, o[1], o[2]]).s, o, {model: 'k', name: 'x', cs: a.cs}), o) && !Wg.unpackMember(Object.assign({}, pm, {c: {sh: -1, hu: 1}}), o));
	/* NPCs */
	const pir = ship([o[0] + 2000, o[1], o[2]], {id: 'd1_5', role: 'pirate', faction: 'reavers', name: 'Reaver Kestrel', wanted: {code: 'NYA', amount: 1800}});
	const full = Wg.unpackNpc(JSON.parse(JSON.stringify(Wg.packNpc(pir, o, true, true))), o), dyn = Wg.unpackNpc(JSON.parse(JSON.stringify(Wg.packNpc(pir, o, false, false))), o);
	ok('3. an NPC: its details when first sent (ship, role, faction, name, its bounty), then only its flight state and condition', full.full && full.full.ship == 'kestrel' && full.full.role == 'pirate' && full.full.wanted.amount == 1800 && full.hostile && !dyn.full && !dyn.hostile && Math.abs(dyn.me.p[0] - pir.s.p[0]) < 0.01, {full, dyn});
	ok('4. an NPC\'s details that aren\'t sound are refused (a name too long, a bounty of a negative amount)', !Wg.unpackNpc(Object.assign(Wg.packNpc(pir, o, true, true), {nm: 'x'.repeat(200)}), o) && Wg.unpackNpc(Object.assign(Wg.packNpc(pir, o, true, true), {wa: {code: 'NYA', amount: -5}}), o).full.wanted === null);
	const many = Array.from({length: 40}, (_, i) => ship([o[0] + 1000 * (i + 1), o[1], o[2]], {id: 'n' + i})), far = ship([o[0] + 5e5, o[1], o[2]], {id: 'far'}), dead = ship([o[0] + 10, o[1], o[2]], {id: 'dead'}); dead.cs.dead = true;
	const mem = ship([o[0], o[1], o[2]], {id: 'w1', member: 1, remote: true});
	const near = Wg.nearNpcs([...many, far, dead, mem], [[o[0] + 39000, o[1], o[2]], o]);
	ok('5. the NPCs sent: alive, within reach of any member, nearest first, twenty at most (not the members\' own ships)', near.length == 20 && !near.some(n => ['far', 'dead', 'w1'].includes(n.id)) && near[0].id == 'n38' && near[1].id == 'n0', near.map(n => n.id));   /* (n38 on the first member, n0 1 km from the second) */
	/* the message's size */
	const big = {k: 'st', n: 1, star: 's', day: 1, o, ps: [pm, pm, pm, pm], np: many.map(n => Wg.packNpc(n, o, true, true)), sh: Array.from({length: 40}, () => ({k: 'pulse', p: [1, 2, 3], v: [1000, 0, 0], ttl: 1.2, dmg: 2}))};
	const fitted = Wg.fit(JSON.parse(JSON.stringify(big)));
	const huge = JSON.parse(JSON.stringify(big)); huge.np = [...huge.np, ...huge.np, ...huge.np]; const fitted2 = Wg.fit(huge);
	ok('6. a message too big for the relay (8 KB) drops shots first, then NPCs, until it fits; the members stay', fitted && JSON.stringify(fitted).length <= Wg.WING.max && fitted.ps.length == 4 && fitted.sh.length < 40 && fitted.np.length == 40 && fitted2 && JSON.stringify(fitted2).length <= Wg.WING.max && fitted2.sh.length == 0 && fitted2.np.length < 120, {a: fitted && [fitted.sh.length, fitted.np.length], b: fitted2 && [fitted2.sh.length, fitted2.np.length]});
	/* claims and states */
	ok('7. a guest\'s claimed hit: an NPC\'s id, a damage a gun could do; anything else is refused', Wg.claimOk({e: 'hitN', i: 'd1_5', dmg: 12, kind: 'pulse'}) && !Wg.claimOk({e: 'hitN', i: 'd1_5', dmg: 1e6, kind: 'pulse'}) && !Wg.claimOk({e: 'hitN', i: 5, dmg: 1, kind: 'pulse'}) && !Wg.claimOk({e: 'hit', i: 'x', dmg: 1, kind: 'pulse'}));
	ok('8. the host\'s state needs its star, a day and a centre; a guest\'s, its star, centre and ship', Wg.stOk({k: 'st', star: 's1', day: 40, o}) && !Wg.stOk({k: 'st', star: 's1', day: -1, o}) && !Wg.stOk({k: 'st', star: 's1', day: 4, o: [1, 2]}) && Wg.inOk({k: 'in', star: 's', o, me: {}}) && !Wg.inOk({k: 'in', star: 's', o}));
	/* days */
	const pl = Tr.newPlayer(F.majors()[1].id); pl.ship.fit = O.stock(S.hull(pl.ship.model)); pl.missions = [{due: 110}]; pl.insurance = {paidTo: 104}; pl.day = 100;
	const w = Wg.joinDays(pl, 100, 340, Sv.shiftDays);
	ok('9. joining a wing on day 340 from your own day 100: your deadlines move with you onto the host\'s day', pl.missions[0].due == 350 && pl.insurance.paidTo == 344 && w.home == 100 && w.joined == 340);
	const back = Wg.leaveDays(pl, w, 352, Sv.shiftDays);
	ok('10. leaving 12 days later: back on your own galaxy\'s day plus those 12 (112); your deadlines as real time had them (the mission due on day 110 is 2 days late, as 12 days went by)', back == 112 && pl.missions[0].due == 110 && pl.insurance.paidTo == 104, {back, due: pl.missions[0].due});
	const p2 = Tr.newPlayer(F.majors()[1].id); p2.missions = [{due: 90}]; const w2 = Wg.joinDays(p2, 80, 20, Sv.shiftDays), b2 = Wg.leaveDays(p2, w2, 25, Sv.shiftDays);
	ok('11. a host whose galaxy is younger: your deadlines move back with you onto its day, and on leaving onto yours again (5 days lived: day 85, the mission still due on 90)', w2.joined == 20 && b2 == 85 && p2.missions[0].due == 90, {b2, due: p2.missions[0].due});
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
