/* Ember Reach's Precursor cloaking device (0.5.9: cloak.js; docs/plan-ember-reach-pilots.md P4), in node: the
   award, where the device is (fitted, aboard a stored ship, or the pilot's and unfitted), that it's never sold,
   stored, made or offered, the cloaking field's heat and failure, being shown by firing or a hit, and the save.
     node tests/emberreach_cloak_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const Cl = req('cloak.js'), O = req('outfit.js'), S = req('ships.js'), Tr = req('trade.js'), F = req('factions.js'), C = req('combat.js'), Sv = req('save.js'), Ins = req('insurance.js'), Cb = req('contraband.js'), Ca = req('career.js'), St = req('settings.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 500) : '')) } };
try {
	const home = F.majors()[1];
	const pilot = () => { const p = Tr.newPlayer(home.id); p.ship.fit = O.stock(S.hull(p.ship.model)); return Ca.make(p, {hardcore: true}) };
	/* the award */
	const p = pilot(), hull = S.hull(p.ship.model), free0 = p.ship.fit.utility.length - 1; p.ship.fit.utility[free0] = null;   /* (a stock fit fills every mount: one emptied) */
	const a1 = Cl.award(p, 40), a2 = Cl.award(p, 41);
	ok('1. the award: the pilot\'s for good (once: a second award gives nothing), fitted in a free utility mount', a1 && !a2 && Cl.owned(p) && p.cloak.day == 40 && p.ship.fit.utility[free0].id == 'cloak' && Cl.where(p) == 'ship', p.cloak);
	const q = pilot(); q.ship.fit.utility = q.ship.fit.utility.map(() => ({id: 'nav', grade: 'C'})); Cl.award(q, 1);
	ok('2. with every utility mount taken, it\'s theirs but unfitted, to fit at an outfitter', Cl.owned(q) && Cl.where(q) == 'free' && !Cl.fitted(q.ship.fit));
	/* where it is */
	const r1 = Cl.fitInto(q, q.ship.fit, 0), r2 = Cl.fitInto(q, q.ship.fit, 1);
	ok('3. fitted into a mount, what was there comes back to the outfitter (to store); only one at a time', r1.ok && r1.old.id == 'nav' && q.ship.fit.utility[0].id == 'cloak' && !r2.ok && Cl.where(q) == 'ship');
	q.hangar = [{id: 'h1', ship: JSON.parse(JSON.stringify(q.ship))}]; q.ship.fit.utility[0] = null;
	ok('4. stored aboard a ship in the hangar, it\'s there (not free to fit elsewhere)', Cl.where(q) == 'h1' && !Cl.fitInto(q, q.ship.fit, 0).ok);
	q.hangar = []; const out = Cl.takeOut(p.ship.fit);
	ok('5. taken out, it stays the pilot\'s, unfitted (a ship traded in or sold leaves it so too); someone without one has nowhere to fit one from', out && Cl.where(p) == 'free' && Cl.where(pilot()) === null && !Cl.fitInto(pilot(), pilot().ship.fit, 0).ok);
	/* never sold, made or offered */
	const offers = [];
	for (const cls of ['halo', 'lantern']) for (let i = 0; i < 6; i++) for (const sl of [{cat: 'utility', i}]) offers.push(...O.offers(hull, sl, {id: 'orbital', cls, owner: home.id}, 'star-' + i));
	const cbAll = []; for (let k = 0; k < 30; k++) cbAll.push(...Cb.offers(p, {id: 'orbital', cls: 'halo'}, 'cb-' + k, hull, 7 * k));
	ok('6. no outfitter, blueprint or Contraband Merchant offers one', !offers.some(o => o.id == 'cloak') && !O.PRECURSOR_MODS.includes('cloak') && !Cb.IDS.includes('cloak') && !cbAll.some(o => o.id == 'cloak'), offers.length);
	const withC = JSON.parse(JSON.stringify(p.ship.fit)); withC.utility[free0] = {id: 'cloak', grade: 'P'}; const without = JSON.parse(JSON.stringify(p.ship.fit)); without.utility[free0] = null;
	ok('7. it\'s worth nothing in a trade-in or a premium (it isn\'t for sale; insurance gives it back as part of the fit)', O.price({id: 'cloak', grade: 'P'}) == 0 && O.extra(hull, withC) == O.extra(hull, without) && Ins.shipValue(hull, withC, p) == Ins.shipValue(hull, without, p));
	ok('8. it draws 0.8 MW from the power plant, like a module', O.drawOf({id: 'cloak', grade: 'P'}) == 0.8);
	/* the cloaking field */
	const cs = C.state(S.ships().find(s => s.id == 'kestrel')), st = Cl.state(), fit = withC;
	const none = Cl.toggle(st, cs, without, 0), up = Cl.toggle(st, cs, fit, 0);
	ok('9. raised only with the device fitted; raised, the ship is hidden', !none.ok && up.ok && st.on && Cl.hidden(st, 0));
	let t = 0, failed = null; while (t < 60 && !failed) { const dt = 0.1; C.tick(cs, t, dt); failed = Cl.step(st, cs, fit, dt); t += dt }
	ok('10. it builds heat (+0.15 a second against 0.12 of cooling) and fails at overheat after about 30 s from cold', failed == 'failed' && !st.on && t > 28 && t < 38, {t, heat: cs.heat});
	const hot = Cl.toggle(st, cs, fit, t);
	ok('11. too hot (overheated: the guns lock as usual), it can\'t be raised again until the ship cools', !hot.ok && /hot/i.test(hot.why) && cs.hot, hot);
	const cs2 = C.state(S.ships().find(s => s.id == 'kestrel')), st2 = Cl.state(); Cl.toggle(st2, cs2, fit, 10);
	Cl.reveal(st2, 10);
	ok('12. firing, a launch or a hit shows the ship for 3 s, then it\'s hidden again; lowered, a reveal does nothing', !Cl.hidden(st2, 10) && !Cl.hidden(st2, 12.9) && Cl.hidden(st2, 13.01) && (Cl.toggle(st2, cs2, fit, 14), Cl.reveal(st2, 14), st2.until == 13 && !st2.on));
	const st3 = Cl.state(); Cl.toggle(st3, cs2, fit, 0); const lost = Cl.step(st3, cs2, without, 0.1);
	ok('13. the device gone from the fit (taken out, or a new ship), the field drops', lost == 'lost' && !st3.on);
	/* the save, and the controls */
	const ps = pilot(); ps.ship.fit.utility[0] = null; Cl.award(ps, 77); const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(ps))));
	const bad = Sv.unpackPlayer(Object.assign(Sv.packPlayer(pilot()), {cloak: 'yes'}));
	ok('14. the save keeps it (fitted, and theirs); a malformed value isn\'t taken as one', Cl.owned(back) && back.cloak.day == 77 && Cl.where(back) == 'ship' && !Cl.owned(bad));
	ok('15. a Cloaking device key on the Controls page (Ship)', St.ACTION.cloak == 'Cloaking device' && St.GROUPS.find(g => g[0] == 'Ship')[1].includes('cloak'));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
