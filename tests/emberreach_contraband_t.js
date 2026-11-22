/* Ember Reach's Contraband Merchant (0.5.7: contraband.js; docs/plan-ember-reach-pilots.md P3), in node: where the
   merchant is and who sees them, the weekly stock, what contraband does (and that Precursor work stays stronger),
   that it's bound to its pilot (never sold, traded in or recycled), insurance, and the save.
     node tests/emberreach_contraband_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Cb = req('contraband.js'), O = req('outfit.js'), Ca = req('career.js'), S = req('ships.js'), Tr = req('trade.js'), F = req('factions.js'), C = req('combat.js'), Fl = req('flight.js'), Ins = req('insurance.js'), Sv = req('save.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
try {
	const home = F.majors()[1], minor = F.all ? F.all().find(f => f.kind != 'major') : null, day = 301;   /* (the first day of week 43) */
	const pilot = o => { const p = Tr.newPlayer(home.id); p.ship.fit = O.stock(S.hull(p.ship.model)); return Ca.make(p, o) };
	/* where, and who */
	const port = (cls, o) => Object.assign({id: 'orbital', cls, owner: home.id}, o || {});
	const at = [['halo', port('halo')], ['lantern', port('lantern')], ['surface starport', {id: 'sp1', surface: true, kind: 'starport', cls: 'lantern'}], ['trefoil', port('trefoil')], ['bloom', port('bloom')],
		['a colony\'s station', port('lantern', {colony: true})], ['an anchorage', port('trefoil', {anchorage: true})], ['a settlement', {id: 's1', surface: true, kind: 'settlement', cls: 'bloom'}]].map(([n, p]) => n + ':' + Cb.atPort(p, home.id));
	ok('1. the merchant keeps shop at a great power\'s capitals, system ports and surface starports; not outposts, colony ports, settlements or anchorages', at.join() == 'halo:true,lantern:true,surface starport:true,trefoil:false,bloom:false,a colony\'s station:false,an anchorage:false,a settlement:false', at);
	ok('2. ...and only under a great power (not in a contested system, nor a minor power\'s)', !Cb.atPort(port('lantern'), null) && (!minor || !Cb.atPort(port('lantern'), minor.id)));
	const hc = pilot({hardcore: true}), plain = pilot(), off = Object.assign(pilot({hardcore: true}), {hc: 'off'}), done = Object.assign(pilot({hardcore: true}), {hc: 'done'});
	ok('3. Hardcore pilots see them (on or done); a pilot without Hardcore, or who turned it off, doesn\'t', Cb.sees(hc) && Cb.sees(done) && !Cb.sees(plain) && !Cb.sees(off));
	/* the stock */
	const ship = S.hull(hc.ship.model), L = O.layout(ship), lp = port('lantern'), star = 'test-star';
	const w1 = Cb.offers(hc, lp, star, ship, day), w1b = Cb.offers(hc, lp, star, ship, day + 1), w2 = Cb.offers(hc, lp, star, ship, day + 7), other = Cb.offers(hc, port('halo', {id: 'orbital'}), 'other-star', ship, day);
	const key = l => l.map(x => x.id + x.size + x.grade).join();
	ok('4. six pieces a week: the same all week, new the next, different at another port', w1.length == 6 && key(w1) == key(w1b) && key(w1) != key(w2) && key(w1) != key(other), [key(w1), key(w2)]);
	const big = L.internal.length ? Math.max(...L.internal) : 0, bigExt = L.external.length ? Math.max(...L.external) : 0;
	const all = []; for (let k = 0; k < 40; k++) all.push(...Cb.offers(hc, lp, 'star-' + k, ship, day));
	ok('5. what\'s offered: weapons, core and internal modules (no utilities, racks, Precursor or ruins work); cores sized for the ship, the rest fitting it', all.every(x => { const c = O.CAT[x.id]; return x.cb == 1 && c.cat != 'utility' && !c.precursor && !c.ruins && x.id != 'cargo' && (c.cat == 'core' ? x.size == L.coreSize : c.cat == 'internal' ? x.size <= big : c.sizes[0] <= bigExt) })
		&& new Set(all.map(x => O.CAT[x.id].cat)).size == 3, [...new Set(all.map(x => x.id))]);
	const x0 = w1[0], base = Object.assign({}, x0); delete base.cb; delete base.key; delete base.price; delete base.sold;
	ok('6. contraband costs 1.6 times the ordinary module', Math.abs(x0.price / O.price(base) - 1.6) < 0.001, {cb: x0.price, base: O.price(base)});
	const t1 = Cb.take(hc, w1[2], 'p3', day), again = Cb.offers(hc, lp, star, ship, day + 2)[2], t2 = Cb.take(hc, again, 'p3', day + 2), next = Cb.offers(hc, lp, star, ship, day + 7);
	ok('7. bought: bound to this pilot (by: p3), sold for the rest of the week; back the next week', t1.ok && t1.m.cb == 1 && t1.m.by == 'p3' && again.sold && !t2.ok && next.every(x => !x.sold), t1);
	ok('8. no sale to a pilot without Hardcore', !Cb.take(plain, Cb.offers(plain, lp, star, ship, day)[0], 'p1', day).ok && !Cb.take(off, Cb.offers(off, lp, star, ship, day)[0], 'p1', day).ok);
	/* what it does */
	ok('9. a contraband module is a fifth stronger than its grade; an A grade\'s (1.56) is still under Precursor work\'s (1.6)', O.kOf({grade: 'C', cb: 1}) == 1.2 && O.kOf({grade: 'A', cb: 1}) == 1.56 && O.kOf({grade: 'A', cb: 1}) < O.kOf({grade: 'P'}));
	const fitWith = (slot, m) => { const f = JSON.parse(JSON.stringify(O.stock(ship))); if (slot.cat == 'core') f.core[slot.key] = m; else f[slot.cat][slot.i] = m; return f };
	const si = O.stock(ship).internal.findIndex(m => m && m.id == 'shield'), sm = O.stock(ship).internal[si];
	const shOrd = O.derive(ship, fitWith({cat: 'internal', i: si}, Object.assign({}, sm))).shield, shCb = O.derive(ship, fitWith({cat: 'internal', i: si}, Object.assign({}, sm, {cb: 1}))).shield;
	const spOrd = O.derive(ship, fitWith({cat: 'core', key: 'thrusters'}, {id: 'thrusters', size: L.coreSize, grade: 'A'})).speed, spCb = O.derive(ship, fitWith({cat: 'core', key: 'thrusters'}, {id: 'thrusters', size: L.coreSize, grade: 'A', cb: 1})).speed, spP = ship.speed * (1 + (1.6 - 1) * 0.4);
	ok('10. a contraband shield generator gives 20% more shields; contraband A thrusters are faster than A, slower than Precursor ones', si >= 0 && Math.abs(shCb / shOrd - 1.2) < 1e-9 && spCb > spOrd && spCb < spP, {shOrd, shCb, spOrd, spCb, spP});
	/* guns: 20% more damage, the gatling still cold, under Precursor guns */
	const kestrel = S.ships().find(s => s.id == 'kestrel'), kl = O.layout(kestrel), small = kl.external.findIndex(z => z == 1);
	const gunShot = (id, cb) => { const f = JSON.parse(JSON.stringify(O.stock(kestrel))); f.external = f.external.map(() => null); f.external[small] = {id, size: 1, grade: 'C', cb: cb ? 1 : undefined}; const sh = O.derive(kestrel, f), cs = C.state(sh), s = Fl.create(sh); s.radius = 6; const out = []; const h0 = cs.heat; C.fire(cs, s, 0, null, out); return {dmg: out.length ? out[0].dmg : 0, heat: cs.heat - h0} };
	const pO = gunShot('pulse'), pC = gunShot('pulse', 1), gC = gunShot('gatling', 1), nP = gunShot('needle');
	ok('11. a contraband gun hits 20% harder; a contraband gatling still makes no heat; a Precursor needle still outhits a contraband pulse laser', pO.dmg > 0 && Math.abs(pC.dmg / pO.dmg - 1.2) < 1e-9 && gC.dmg > 0 && gC.heat == 0 && nP.dmg > pC.dmg, {pO, pC, gC, nP});
	/* bound to the pilot */
	const p2 = pilot({hardcore: true}); p2.stored = [{id: 'shield', size: 2, grade: 'B', cb: 1, by: 'p1', at: {star: 's'}, ready: 0}, {id: 'shield', size: 2, grade: 'B', at: {star: 's'}, ready: 0}];
	const rc = O.recycle(p2, 0, 's', day, 1e6);
	ok('12. contraband can\'t be recycled (it would come back as goods to sell); ordinary work still can', !rc.ok && /bound to you/.test(rc.why) && O.recycle(p2, 1, 's', day, 1e6).ok, rc);
	const fcb = fitWith({cat: 'internal', i: si}, Object.assign({}, sm, {cb: 1, by: 'p1'})); fcb.core.power = Object.assign({}, fcb.core.power, {cb: 1, by: 'p1'});
	const fpl = fitWith({cat: 'internal', i: si}, Object.assign({}, sm));
	const fexp = fitWith({cat: 'internal', i: si}, null); fexp.core.power = {id: 'power', size: L.coreSize, grade: 'C'};
	ok('13. a trade-in pays nothing for contraband (a core one counts as the plain C module standing in for it)', O.extra(ship, fcb) == O.extra(ship, fexp) && O.extra(ship, fpl) >= O.extra(ship, fcb), {cb: O.extra(ship, fcb), want: O.extra(ship, fexp)});
	const moved = Cb.strip(fcb, {star: 'here'});
	ok('14. a ship leaving the pilot first leaves its contraband in storage there: the core slot gets a plain C module, the internal slot is emptied', moved.length == 2 && moved.every(m => m.cb && m.by == 'p1' && m.at.star == 'here') && fcb.core.power.grade == 'C' && !fcb.core.power.cb && fcb.internal[si] === null, moved);
	/* insurance */
	const empty = fitWith({cat: 'internal', i: si}, null), withCb = fitWith({cat: 'internal', i: si}, Object.assign({}, sm, {grade: 'A', cb: 1})), ordA = Object.assign({}, sm, {grade: 'A'});
	const val = (p, f) => Ins.shipValue(ship, f, p);
	ok('15. while Hardcore is on, contraband isn\'t insured: it adds nothing to the value the premium is on', val(hc, withCb) == val(hc, empty));
	const withOrd = fitWith({cat: 'internal', i: si}, ordA);   /* (against the ordinary A in the same slot: an empty slot can put the fit under stock, where its worth stops at nothing) */
	ok('16. once Hardcore is off (or done), it\'s insured at twice its ordinary counterpart\'s premium', Math.abs((val(off, withCb) - val(off, withOrd)) - O.price(ordA)) < 1 && Math.abs((val(done, withCb) - val(done, withOrd)) - O.price(ordA)) < 1, {d: val(off, withCb) - val(off, withOrd), want: O.price(ordA)});
	const rk = pilot({diff: 'rookie'}), pl = pilot(), code = home.currency.code;
	ok('17. (0.5.6\'s rule, now everywhere) the quote and a new policy\'s first week carry the difficulty\'s premium', Math.abs(Ins.quote(rk, code, ship, rk.ship.fit, day) / Ins.quote(pl, code, ship, pl.ship.fit, day) - 0.6) < 1e-9
		&& (() => { rk.wallet[code] = 1e9; const w0 = rk.wallet[code], r = Ins.insure(rk, home.id, ship, rk.ship.fit, day); return r.ok && Math.abs((w0 - rk.wallet[code]) - Ins.quote(rk, code, ship, rk.ship.fit, day)) < 1e-6 })());
	/* the save */
	const ps = pilot({hardcore: true}); ps.ship.fit = withCb; ps.stored = [Object.assign({}, t1.m, {at: {star: 's', p: [0, 0, 0], port: 'orbital', name: 'Test port'}, ready: 0})];   /* (a place as hangar.js makes one: the save checks it) */ ps.contraband = {w: Cb.weekOf(day), got: ['x#1']};
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(ps))));
	ok('18. the save keeps contraband (fitted and stored, bound to its pilot) and what was bought this week', back.ship.fit.internal[si].cb == 1 && back.stored[0].cb == 1 && back.stored[0].by == 'p3' && back.contraband && back.contraband.got[0] == 'x#1', {fit: back.ship.fit.internal[si], st: back.stored[0], cb: back.contraband});
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
