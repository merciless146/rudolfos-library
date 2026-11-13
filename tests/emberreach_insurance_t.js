/* Ember Reach's ship insurance and respawn (insurance.js), in node.
     node tests/emberreach_insurance_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const I = req('insurance.js'), F = req('factions.js'), Tr = req('trade.js'), S = req('ships.js'), O = req('outfit.js'), E = req('economy.js'), T = req('travel.js'), Sv = req('save.js'), G = req('galaxy.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d) : '')) } };
try {
	const home = F.majors()[3], code = home.currency.code, day = 200;
	const fresh = () => { const p = Tr.newPlayer(home.id); p.ship.fit = O.stock(S.hull(p.ship.model)); return p };
	const pl = fresh(), hull = S.hull(pl.ship.model);
	I.ensure(pl, day);
	ok('1. every pilot starts covered by their home power, the first week paid', pl.insurance.provider == home.id && pl.insurance.code == code && pl.insurance.paidTo == day + 7 && pl.insurance.owed == 0);
	const wk = I.premium(pl, hull, pl.ship.fit, day);
	ok('2. the premium is 10% of the ship\'s whole value a week, in the policy\'s currency', Math.abs(wk.amount - 0.1 * S.value(hull) * E.rate(code, day)) < 1e-6 && wk.code == code);
	const fit2 = O.stock(S.hull('corsair')); fit2.internal[0] = {id: 'shield', size: fit2.internal[0] ? 3 : 3, grade: 'A'};
	ok('3. fitted modules beyond stock count in the value', I.shipValue(S.hull('corsair'), fit2) > S.value(S.hull('corsair')));
	const w0 = pl.wallet[code]; I.tick(pl, hull, pl.ship.fit, day + 7);
	ok('4. a week later the premium is taken', Math.abs(w0 - pl.wallet[code] - I.premium(pl, hull, pl.ship.fit, day + 7).amount) < 1e-6 && pl.insurance.paidTo == day + 14);
	pl.wallet[code] = 0; I.tick(pl, hull, pl.ship.fit, day + 21);
	ok('5. unpaid premiums are owed, and taken when the money comes', pl.insurance.owed > 0 && (() => { const owed = pl.insurance.owed; pl.wallet[code] = owed + 1; I.tick(pl, hull, pl.ship.fit, day + 21); return pl.insurance.owed == 0 && Math.abs(pl.wallet[code] - 1) < 1e-6 })());
	/* respawn */
	const ctx = {start: home.star, startHolder: home.id};
	const near = [home.star.x + 30, home.star.y, home.star.z], r1 = I.respawnAt(pl, near, ctx, day);
	ok('6. lost near home: the nearest port trading in the policy\'s currency, within 1,000 ly', r1.why == 'currency' && r1.d <= 1000 / 3.26156 && F.byId(T.ownerOf(r1.star, day).owner).currency.code == code, r1.why);
	const other = F.majors().find(m => F.relation(home.id, m.id) >= 0 && m.id != home.id && Math.hypot(m.star.x - home.star.x, m.star.y - home.star.y, m.star.z - home.star.z) > 700 / 3.26 * 2);
	const r2 = other && I.respawnAt(pl, [other.star.x, other.star.y, other.star.z], ctx, day);
	ok('7. lost far from any port in that currency: the nearest port whose exchange takes it', r2 && (r2.why == 'exchange' || r2.why == 'currency') && (r2.why != 'exchange' || I.exchangeTakes(r2.holder, code)), r2 && r2.why);
	const r3 = I.respawnAt(pl, [0, 0, 2000], ctx, day);
	ok('8. nothing within 1,000 ly: the starting station', r3.why == 'start' && r3.star.id == home.star.id);
	ok('9. an enemy\'s exchange won\'t take the currency', F.majors().filter(m => F.relation(home.id, m.id) < 0).every(m => !I.exchangeTakes(m.id, code)) && I.exchangeTakes(home.id, code));
	/* claims */
	const p2 = fresh(); I.ensure(p2, day); const c1 = I.claim(p2, S.hull('corsair'), fit2, near, ctx, day);
	ok('10. paid up: the ship comes back as it was, at the respawn port', !c1.starter && c1.model == 'corsair' && c1.why == 'currency');
	const p3 = fresh(); I.ensure(p3, day); p3.insurance.owed = 5000; p3.wallet = {[code]: 2000};
	const ally = F.majors().find(m => F.relation(home.id, m.id) >= 0 && m.id != home.id); p3.wallet[ally.currency.code] = 1e9;
	const c2 = I.claim(p3, S.hull('corsair'), fit2, near, ctx, day);
	ok('11. short of the policy\'s currency: the exchange changes other money to settle what\'s owed', !c2.starter && c2.paid == 5000 && c2.changed.length == 1 && c2.changed[0].from == ally.currency.code && p3.wallet[code] == 0 && p3.insurance.owed == 0, c2);
	const p4 = fresh(); I.ensure(p4, day); p4.insurance.owed = 1e12; p4.wallet = {[code]: 10};
	const c3 = I.claim(p4, S.hull('corsair'), fit2, near, ctx, day);
	ok('12. not enough money of any kind: the starting station, a starter ship, and the starter\'s cover', c3.starter && c3.star.id == home.star.id && c3.model == Tr.newPlayer(home.id).ship.model && p4.insurance.owed == 0 && p4.insurance.provider == home.id);
	const p5 = fresh(); I.cancel(p5); const c4 = I.claim(p5, S.hull('corsair'), fit2, near, ctx, day);
	ok('13. not insured: a starter ship at the starting station (with the starter\'s cover again)', c4.starter && c4.why == 'uninsured' && c4.star.id == home.star.id && p5.insurance && p5.insurance.provider == home.id);
	const p6 = fresh(); const ins = I.insure(Object.assign(p6, {wallet: {[ally.currency.code]: 1e9}}), ally.id, S.hull('corsair'), fit2, day);
	ok('14. a policy can be taken with another power at its port, the first week paid there', ins.ok && p6.insurance.provider == ally.id && p6.insurance.code == ally.currency.code && p6.insurance.paidTo == day + 7);
	const sv = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(p3))));
	const p7 = fresh(); I.cancel(p7); const sv2 = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(p7))));
	ok('15. the save keeps the policy, and a cancelled one stays cancelled', sv && sv2 && sv.insurance && sv.insurance.provider == home.id && sv2.insurance === null);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
