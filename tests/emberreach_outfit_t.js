/* Ember Reach's outfitting (apps/rudolf-emberreach/www/outfit.js): the four categories, stock loadouts, derived stats, power,
   the market, languages, scanners' effects and saves, in node.
     node tests/emberreach_outfit_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const O = require(path.join(DIR, 'outfit.js')), S = require(path.join(DIR, 'ships.js')), F = require(path.join(DIR, 'factions.js')), C = require(path.join(DIR, 'combat.js')),
	En = require(path.join(DIR, 'encounters.js')), Tr = require(path.join(DIR, 'trade.js')), Sv = require(path.join(DIR, 'save.js')), Ca = require(path.join(DIR, 'canisters.js')), Fl = require(path.join(DIR, 'flight.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const L = S.ships(), by = id => L.find(s => s.id == id), pike = by('pike'), caravel = by('caravel'), kestrel = by('kestrel');
	ok('1. four categories in the catalogue', ['core', 'internal', 'external', 'utility'].every(c => Object.values(O.CAT).some(m => m.cat == c)));
	const bad = L.filter(s => { const f = O.stock(s), d = O.derive(s, f), r = d.cargo / Math.max(1, s.cargo); return !O.valid(s, f) || !O.power(s, f).ok || Math.abs(d.shield - s.shield) > 1 || (s.cargo >= 10 && (r < 0.75 || r > 1.4)) || f.external.filter(Boolean).length != s.hard.reduce((a, b) => a + b, 0) });
	ok('2. every hull\'s stock loadout is valid, powered, and matches its shields, hold (roughly) and guns', !bad.length, bad.map(s => s.id).join(', '));
	const lay = O.layout(pike);
	ok('3. a hull\'s slots: seven core (six without a hyperdrive), internal slots by size, its hardpoints, its utility mounts', lay.core.length == 7 && O.layout(kestrel).core.length == 6 && lay.internal.length == 4 && lay.external.length == 4 && lay.utility == 3);
	ok('4. hold-built hulls get bigger bays', O.layout(caravel).internal[0] > O.layout(by('warden')).internal[0]);
	/* derive */
	const f0 = O.stock(pike), d0 = O.derive(pike, f0);
	const shieldSlot = {cat: 'internal', i: f0.internal.findIndex(m => m && m.id == 'shield')};
	const up = O.install(pike, f0, shieldSlot, {id: 'shield', size: f0.internal[shieldSlot.i].size, grade: 'A'});
	ok('5. a better shield generator: more shields; armour adds hull; relays add range', up.ok && O.derive(pike, up.fit).shield > d0.shield * 1.25 && (() => { const free = {cat: 'internal', i: up.fit.internal.findIndex(m => !m || m.id == 'cargo')}, a = O.install(pike, up.fit, free, {id: 'armour', size: 1, grade: 'C'}), r = O.install(pike, up.fit, free, {id: 'relay', size: 1, grade: 'C'}); return a.ok && O.derive(pike, a.fit).hull > d0.hull && r.ok && O.derive(pike, r.fit).jump > d0.jump })());
	const al = O.install(pike, f0, {cat: 'internal', i: 0}, {id: 'alien', size: 2, grade: 'A'});
	ok('6. an alien relay booster adds far more, and no outfitter sells one', al.ok && O.derive(pike, al.fit).jump - d0.jump >= 3 - 1e-9 && !O.offers(pike, {cat: 'internal', i: 0}, {cls: 'halo'}).some(o => o.id == 'alien'));
	ok('7. modules have to fit: size and slot type', !O.install(pike, f0, {cat: 'internal', i: 3}, {id: 'cargo', size: 3, grade: 'C'}).ok && !O.install(pike, f0, {cat: 'external', i: 0}, {id: 'heavy', size: 3, grade: 'C'}).ok && !O.install(pike, f0, {cat: 'utility', i: 0}, {id: 'cargo', size: 1, grade: 'C'}).ok);
	const heavyFit = (() => { let f = O.stock(pike); f.core.power.grade = 'C'; for (let i = 0; i < f.internal.length; i++) f.internal[i] = {id: 'relay', size: Math.min(3, O.layout(pike).internal[i]), grade: 'A'}; return f })();
	ok('8. power: the plant must cover what the modules draw', !O.power(pike, heavyFit).ok && /power/i.test(O.install(pike, (() => { const f = JSON.parse(JSON.stringify(heavyFit)); f.internal[0] = null; return f })(), {cat: 'internal', i: 0}, {id: 'relay', size: 3, grade: 'A'}).why || ''));
	ok('9. a bigger fuel tank holds more; a better hyperdrive jumps farther', (() => { const f = O.stock(pike); f.core.fuel.grade = 'A'; f.core.hyperdrive.grade = 'A'; f.core.power.grade = 'A'; const d = O.derive(pike, f); return d.tank > 1.5 && d.jump > d0.jump && Tr.tank(d) > Tr.tank(d0) })());
	/* the market */
	const tre = O.offers(caravel, {cat: 'internal', i: 0}, {cls: 'trefoil'}), halo = O.offers(caravel, {cat: 'internal', i: 0}, {cls: 'halo'});
	ok('10. outposts sell small, grade C and B; great ports everything', tre.every(o => o.grade != 'A' && (o.size <= 3 || (o.id == 'cargo' && o.size <= 4))) && halo.some(o => o.grade == 'A' && o.size >= 5));
	ok('11. utility mounts take scanners and sensors: warrant, manifest, resource, nav receiver, cartographic, decoder', ['warrant', 'manifest', 'prospector', 'nav', 'carto', 'decoder'].every(id => O.offers(pike, {cat: 'utility', i: 0}, {cls: 'halo'}).some(o => o.id == id)));
	ok('12. stock utility: the nav receiver and cartographic sensor (and a warrant scanner on warships)', O.derive(pike).utility.nav && O.derive(pike).utility.carto && O.derive(pike).utility.warrant && !O.derive(caravel).utility.warrant);
	/* languages */
	const home = F.majors()[5], other = F.majors().find(m => m.id != home.id && m.cluster == home.cluster), pl = Tr.newPlayer(home.id), spn = m => m.species.name || m.species, minor = F.minors().find(m => F.majors().some(x => x.species.name == spn(m)));
	ok('13. every power speaks its own species\' language; small factions speak their species\'', O.langOf(other.id) == other.id && O.langOf(minor.id) == F.majors().find(x => x.species.name == spn(minor)).id);
	const dP = O.derive(pike);
	ok('14. you understand your own people, not others, until a decoder carries their language', O.understands(pl, dP, home.id) && !O.understands(pl, dP, other.id) && (() => { const f = O.stock(pike); f.utility[2] = {id: 'decoder', grade: 'C', langs: [other.id]}; return O.understands(pl, O.derive(pike, f), other.id) })());
	const g1 = O.garble('Docking granted, pad 4', other.id);
	ok('15. untranslated speech is garbled, the same way each time', g1 == O.garble('Docking granted, pad 4', other.id) && g1 != 'Docking granted, pad 4' && /4/.test(g1));
	ok('16. a decoder holds 2, 4 or 8 languages by grade, and a fit that overloads one is refused', O.DECODER.C == 2 && O.DECODER.A == 8 && !O.valid(pike, (() => { const f = O.stock(pike); f.utility[2] = {id: 'decoder', grade: 'C', langs: ['a', 'b', 'c']}; return f })()));
	/* combat and scanners */
	const lo = C.loadout(O.derive(pike));
	ok('17. guns come from the external modules; a missile rack holds 4 missiles', lo.guns.length == 3 && lo.missiles == 4);
	const p2 = Tr.newPlayer(home.id), wantedTrader = {role: 'trader', faction: home.id, ship: by('packet'), wanted: {code: home.currency.code, amount: 1500}, scanned: {warrant: true}};
	const w0 = p2.wallet[home.currency.code], r1 = En.killed(p2, wantedTrader, {star: home.star, day: 200, own: {owner: home.id}});
	const p3 = Tr.newPlayer(home.id), r2 = En.killed(p3, Object.assign({}, wantedTrader, {scanned: null}), {star: home.star, day: 200, own: {owner: home.id}});
	ok('18. a wanted ship is no crime to kill; its warrant pays only if you scanned it', p2.wallet[home.currency.code] == w0 + 1500 && !Object.keys(p2.bounties).length && !Object.keys(p3.bounties).length && p3.wallet[home.currency.code] == w0 && r2.msg.some(m => /warrant scan/.test(m)));
	/* ruins: an alien relay scooped goes to storage */
	const s = Fl.create(pike); s.radius = 15; const c = Ca.make('Alien relay booster', Ca.hatchAt(s, [0, -1, 0], [0, 0, -1]), [0, 0, 0], 0); c.v = [0, 0, 0]; c.module = {id: 'alien', size: 3, grade: 'A'};
	const p4 = Tr.newPlayer(home.id); Ca.scoop([c], s, [0, -1, 0], [0, 0, -1], p4, 10);
	ok('19. a module scooped from a ruin goes to storage, not the hold', p4.stored.length == 1 && p4.stored[0].id == 'alien' && !Object.keys(p4.cargo).length);
	/* saves */
	const p5 = Tr.newPlayer(home.id); p5.ship.model = 'pike'; p5.ship.fit = up.fit; p5.stored = [{id: 'relay', size: 1, grade: 'B'}];
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(p5))));
	ok('20. the fit and storage come back from the save; a fit that doesn\'t suit the hull is dropped', JSON.stringify(back.ship.fit) == JSON.stringify(up.fit) && back.stored.length == 1 && Sv.unpackPlayer(Object.assign(JSON.parse(JSON.stringify(Sv.packPlayer(p5))), {ship: Object.assign({}, p5.ship, {model: 'caravel'})})).ship.fit === null);
	ok('21. modules beyond stock add to a ship\'s worth', O.extra(pike, up.fit) > 0 && O.extra(pike, O.stock(pike)) == 0);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
