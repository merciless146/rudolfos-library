/* Ember Reach 0.3.8: shipyards and outfitters by port, storing ships and modules, and transfers
   (apps/rudolf-emberreach/www/hangar.js), in node.
     node tests/emberreach_hangar_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Hg = require(path.join(DIR, 'hangar.js')), Tr = require(path.join(DIR, 'trade.js')), O = require(path.join(DIR, 'outfit.js')), S = require(path.join(DIR, 'ships.js'));
const F = require(path.join(DIR, 'factions.js')), G = require(path.join(DIR, 'galaxy.js')), T = require(path.join(DIR, 'travel.js')), Sv = require(path.join(DIR, 'save.js')), I = require(path.join(DIR, 'insurance.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + JSON.stringify(d) : '')) } };
try {
	const day = 200, home = F.majors()[0];
	const port = (o) => Object.assign({id: 'orbital'}, o), sv = p => Hg.services(p);
	const trefoil = port({cls: 'trefoil'}), bloom = port({cls: 'bloom'}), lantern = port({cls: 'lantern'}), halo = port({cls: 'halo'});
	const surf = k => ({id: 'surface:x:' + k, surface: true, kind: k, cls: 'trefoil'});
	/* ---- services ---- */
	ok('1. an outpost station: no ships for sale, a few grade C modules up to size 2, and storage', !sv(trefoil).yard && sv(trefoil).outfit.maxSize == 2 && sv(trefoil).outfit.grades == 'C' && sv(trefoil).storage);
	ok('2. bigger ports, more: bloom stations and settlements up to M, surface starports L, heavy fields XL, living-world stations and capitals everything',
		Hg.yardSizes(bloom).join() == 'XS,S,M' && Hg.yardSizes(surf('settlement')).join() == 'XS,S,M' && Hg.yardSizes(surf('starport')).pop() == 'L' && Hg.yardSizes(surf('field')).pop() == 'XL' && Hg.yardSizes(lantern).pop() == 'Capital' && Hg.yardSizes(halo).pop() == 'Capital');
	ok('3. camps, surface outposts and forward bases have no shipyard, no outfitters, no storage', ['camp', 'outpost', 'base'].every(k => { const s = sv(surf(k)); return !s.yard && !s.outfit && !s.storage }));
	const wren = S.ships().find(s => s.id == 'wren'), L0 = O.layout(wren), slot = {cat: 'internal', i: 0}, ext = {cat: 'external', i: 0};
	const offers = p => [...O.offers(wren, slot, p, home.star.id), ...O.offers(wren, ext, p, home.star.id)];
	const oT = offers(trefoil), oH = offers(halo), oL = offers(lantern), oB = offers(bloom);
	ok('4. the outfitters: an outpost station stocks only some of the range, grade C, up to size 2; the most advanced (grade A) at living-world stations and capitals',
		oT.length > 0 && oT.length < oB.length && oT.every(o => o.grade == 'C' && (o.size || 1) <= 2) && oH.some(o => o.grade == 'A') && oL.some(o => o.grade == 'A') && !oB.some(o => o.grade == 'A'), {t: oT.length, b: oB.length, h: oH.length});
	const ships = p => Tr.yard(p, home.star, day);
	ok('5. ships for sale follow: none at an outpost station, up to M at a bloom station, capital ships at the great ports', !ships(trefoil).length && ships(bloom).every(x => ['XS', 'S', 'M'].includes(x.ship.size)) && ships(halo).some(x => x.ship.size == 'Capital') && ships(lantern).some(x => x.ship.size == 'Capital'));
	ok('6. an outpost station\'s half of the range is its own (another carries a different half)', (() => { const a = O.offers(wren, slot, trefoil, 'A1').map(o => o.id + o.size).join(), b = O.offers(wren, slot, trefoil, 'B2').map(o => o.id + o.size).join(); return a != b || a == '' })());

	/* ---- places ---- */
	const near = G.starsNear(home.star.x, home.star.y, home.star.z, 15).filter(x => x.kind == 'star' && !T.wildAt(x, day)), far = near.find(x => x.id != home.star.id && Hg.distPc(Hg.placeOf(x, null), Hg.placeOf(home.star, null)) > 5);
	const capHalo = Hg.placeOf(home.star, {id: 'orbital', name: 'Home Halo'}), capField = Hg.placeOf(home.star, {id: 'surface:a:field', name: 'Home field'}), away = Hg.placeOf(far, {id: 'orbital', name: far.name + ' station'});
	/* ---- ships in storage ---- */
	const pl = Tr.newPlayer(home.id); pl.wallet[home.currency.code] = 1e9; pl.cargo = {Iron: 5}; pl.cost = {Iron: 4};
	const first = pl.ship.model, state = {modules: {power: 3, engines: 9}, fuel: 0.4, o2: 600};
	const st = Hg.storeShip(pl, state, capHalo, day);
	ok('7. storing a ship keeps its fit, its modules\' health, fuel, air, its hold, where it was left', st.ok && st.item.ship.model == first && st.item.modules.power == 3 && st.item.fuel == 0.4 && st.item.o2 == 600 && st.item.cargo.Iron == 5 && Hg.samePlace(st.item.at, capHalo));
	/* (now in a new ship, empty hold) */
	pl.ship = {model: 'gnat', build: pl.ship.build, sensors: pl.ship.sensors}; pl.cargo = {}; pl.cost = {};
	const sw = Hg.swap(pl, st.item.id, {modules: {}, fuel: 1}, capHalo, day);
	ok('8. taking it out flies it again (its hold with it), and the ship you came in is stored in its place', sw.ok && pl.ship.model == first && pl.cargo.Iron == 5 && sw.fuel == 0.4 && pl.hangar.length == 1 && pl.hangar[0].ship.model == 'gnat' && Hg.samePlace(pl.hangar[0].at, capHalo));
	const g = pl.hangar[0];
	ok('9. only where it is kept', !Hg.swap(pl, g.id, {}, away, day).ok && /transfer it here/.test(Hg.swap(pl, g.id, {}, away, day).why));
	/* ---- transfers ---- */
	const local = Hg.quote('ship', g, capField, day);
	ok('10. within a system: a flat 100 SU, at once', local.ok && local.su == 100 && local.days == 0);
	const q = Hg.quote('ship', g, away, day), d = Hg.distPc(g.at, away), value = S.value(S.hull('gnat')), mass = Hg.HANGAR.mass[S.hull('gnat').size];
	ok('11. from another system: half its insurance premium plus 25 SU a parsec per size class (to the cap); a day plus a day per 5 pc', q.ok && Math.abs(q.su - Math.min(0.5 * I.INSURE.weekly * value + 25 * d * mass, 5 * I.INSURE.weekly * value)) < 1e-6 && q.days == 1 + Math.ceil(d / 5), {q, d});
	const bigQ = Hg.quote('ship', Object.assign({}, g, {ship: {model: S.ships().find(s => s.size == 'Capital').id}}), away, day);
	ok('12. a bigger ship costs more to move the same way', bigQ.ok && bigQ.su > q.su);
	/* (0.3.9) the cap: 5 weeks' insurance on the ship with its fit, or on the module; the days aren't capped */
	const farAway = {star: 'far', p: [home.star.x + 1500, home.star.y, home.star.z], port: 'orbital', name: 'far'}, fitted = Object.assign({}, g, {ship: {model: 'gnat', fit: Object.assign(O.stock(S.hull('gnat')), {})}});
	const qf = Hg.quote('ship', fitted, farAway, day), cap5 = 5 * I.shipValue(S.hull('gnat'), fitted.ship.fit) * I.INSURE.weekly, df = Hg.distPc(g.at, farAway);
	ok('11a. never more than 5 weeks\' insurance on the ship and what\'s fitted, however far; the days still grow with the distance', qf.ok && qf.capped && Math.abs(qf.su - cap5) < 1e-6 && qf.days == 1 + Math.ceil(df / 5) && qf.days > 250, {su: qf.su, cap5, days: qf.days, df});
	const full = Object.assign({}, g, {cargo: {Food: 2}});
	ok('13. never with anything in the hold (or passengers aboard)', !Hg.quote('ship', full, away, day).ok && /hold/.test(Hg.quote('ship', full, away, day).why) && !Hg.quote('ship', Object.assign({}, g, {passengers: 2}), away, day).ok);
	const tr = Hg.transfer('ship', g, away, day);
	ok('14. sent: it arrives on its day, and not before', tr.ok && g.ready == day + q.days && !Hg.swap(pl, g.id, {}, away, day + q.days - 1).ok && /arrives on day/.test(Hg.swap(pl, g.id, {}, away, day + 1).why) && !Hg.quote('ship', g, capHalo, day + 1).ok);
	ok('15. once there it can be flown', Hg.swap(pl, g.id, {modules: {}, fuel: 1}, away, day + q.days).ok && pl.ship.model == 'gnat');
	/* ---- modules ---- */
	pl.stored = [{id: 'shield', size: 2, grade: 'B'}, {id: 'pulse', size: 1, grade: 'C'}];
	ok('16. modules kept before storage had places are taken in by the first port docked at', Hg.adopt(pl, capHalo) == 2 && Hg.modulesAt(pl, capHalo, day).length == 2 && Hg.adopt(pl, away) == 0);
	const mq = Hg.moduleQuote(pl, 0, away, day), mv = O.price(pl.stored[0]);
	ok('17. a module\'s transfer: half its insurance (5% of its price) plus 25 SU a parsec per size, to 5 weeks\' insurance on it', mq.ok && Math.abs(mq.su - Math.min(0.05 * mv + 25 * mq.d * 2, 0.5 * mv)) < 1e-6 && Hg.moduleQuote(pl, 1, capField, day).su == Math.min(100, 0.5 * O.price(pl.stored[1])));
	const cheap = {id: 'cargo', size: 1, grade: 'C', at: capHalo}; pl.stored.push(cheap);
	ok('17a. the cap holds within a system too: a cheap module never costs more than half its price to move', Hg.moduleQuote(pl, pl.stored.length - 1, capField, day).su == Math.min(100, 0.5 * O.price(cheap)) && Hg.moduleQuote(pl, pl.stored.length - 1, farAway, day).su <= 0.5 * O.price(cheap) + 1e-9); pl.stored.pop();
	Hg.sendModule(pl, 0, away, day);
	ok('18. sent modules are on their way, then there', Hg.modulesAt(pl, away, day).length == 0 && Hg.modulesAt(pl, away, day + mq.days).length == 1 && Hg.modulesAt(pl, capHalo, day).length == 1);
	/* ---- the save ---- */
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pl))));
	ok('19. the save keeps stored ships and modules, where they are and when they arrive', back && back.hangar.length == pl.hangar.length && Hg.samePlace(back.hangar[0].at, pl.hangar[0].at) && back.stored[0].ready == pl.stored[0].ready && Hg.samePlace(back.stored[0].at, away) && back.hangarSeq == pl.hangarSeq);
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
