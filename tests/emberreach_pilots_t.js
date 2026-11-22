/* Ember Reach's pilots in one galaxy (0.5.5: save.js, explore.js, colonies.js; docs/plan-ember-reach-pilots.md P1), in
   node: the galaxy's part and the pilot's, joined and packed again; first discoveries and colonies shared; a pilot's
   deadlines moved on by the days the galaxy lived without them; a save from before 0.5.5 migrated.
     node tests/emberreach_pilots_t.js */
const path = require('path');
const req = n => require(path.join(__dirname, '..', 'apps/rudolf-emberreach/www', n));
const T = req('travel.js'), Sv = req('save.js'), F = req('factions.js'), Tr = req('trade.js'), S = req('ships.js'), O = req('outfit.js'), X = req('explore.js'), Co = req('colonies.js'), G = req('galaxy.js');
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d !== undefined ? ' - ' + JSON.stringify(d).slice(0, 600) : '')) } };
try {
	const home = F.majors()[2], code = home.currency.code;
	const pilot = () => { const p = Tr.newPlayer(home.id); p.ship.fit = O.stock(S.hull(p.ship.model)); return p };
	const state = (pl, day) => ({player: pl, power: 2, port: null, ship: pl.ship.model, day, t: 1, docked: true, pad: 1, s: {p: [0, 0, 0], v: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0], fa: true}, throttle: 0,
		fit: {modules: []}, star: Object.assign({}, home.star, {name: home.star.name}), at: 'orbital', fuel: 1, lastPort: null, routeTo: null, settings: {}, pilotOnly: true});
	const colony = (id, starId) => ({id, star: {id: starId, name: 'X', at: [1, 2, 3]}, stage: 'done', port: 'outpost', sponsor: home.id, need: {}, got: {}, opens: 10, builds: []});
	/* the galaxy starts empty; pilot A plays: markets, mining, wars and a colony go to the galaxy, the rest stays theirs */
	const gal = Sv.newGalaxy(200), A = pilot(); A.wallet[code] = 5000;
	Sv.joinGalaxy(A, gal, 'p1');
	A.markets = {'m:1': {day: 201, s: {Iron: 5}, d: {}}}; A.mined['rock:9'] = 12; A.warEvents.push({day: 201, kind: 'kill'}); A.colonies.push(colony('c1', 'S:1'));
	const cap = home.star, ruin = X.ruinsNear([cap.x, cap.y, cap.z], 30).find(x => !T.portFor(x.star, 202)), sys = ruin.star, planet = ruin.planet, sa = X.survey(A, sys, planet, null, 202);
	const named = X.rename(A, Object.keys(A.explore.pl)[0], 'Hollow Spire');
	const pa = Sv.pack(state(A, 205)), gv = Sv.packGalaxy(gal, A, 'p1', 205);
	ok('1. a pilot\'s save leaves out the galaxy\'s part (markets, mined, war events, colonies); it keeps the pilot\'s own (money, the ship, exploration)', Sv.WORLD.every(k => !(k in pa.player)) && pa.player.wallet[code] == 5000 && pa.player.explore && Object.keys(pa.player.explore.pl).length == 1, Object.keys(pa.player));
	ok('2. the galaxy keeps them: the market, the asteroid, the war event, the colony with its owner, the first survey and its name; and the day', gv.world.markets['m:1'] && gv.world.mined['rock:9'] == 12 && gv.world.warEvents.length == 1 && gv.world.colonies.length == 1 && gv.world.colonies[0].owner == 'p1'
		&& gv.world.firsts.pl[Object.keys(A.explore.pl)[0]] == 'p1' && gv.world.names[Object.keys(A.explore.pl)[0]] == 'Hollow Spire' && gv.day == 205 && sa.first && named.ok, gv.world);
	ok('3. what the pilot doesn\'t save is left out: the others\' colonies and the firsts taken by others aren\'t in the pilot\'s value', !JSON.stringify(pa).includes('"others"') && !JSON.stringify(pa).includes('"taken"'));
	/* pilot B joins the same galaxy: sees A's world, not A's money; A's first is not B's; A's colony is in the world */
	const g2 = Sv.unpackGalaxy(JSON.parse(JSON.stringify(gv))), B = pilot();
	Sv.joinGalaxy(B, g2, 'p2');
	const sb = X.survey(B, sys, planet, null, 206);
	ok('4. another pilot in the galaxy: the markets, mined asteroids and war events are the galaxy\'s; their own wallet and colonies are theirs', B.markets['m:1'] && B.mined['rock:9'] == 12 && B.warEvents.length == 1 && B.colonies.length == 0 && !(B.wallet[code] == 5000));
	ok('5. a first discovery is the galaxy\'s: the ruin pilot 1 surveyed first is no first for pilot 2 (and pays the ordinary rate, a 2.5th of pilot 1\'s); its name shows for them, and they can\'t rename it', sb.new && !sb.first && Math.abs(sb.value * X.EXPLORE.first - sa.value) < 1e-6 && X.nameOf(B, sys.id, planet.name) == 'Hollow Spire' && !X.rename(B, Object.keys(B.explore.pl)[0], 'Mine Now').ok, {sa, sb});
	ok('6. pilot 1\'s colony is in pilot 2\'s world (its port), marked another pilot\'s, and can\'t be claimed again; it isn\'t pilot 2\'s to manage', Co.worldColonyAt(B, 'S:1') && Co.worldColonyAt(B, 'S:1').foreign && !Co.colonyAt(B, 'S:1')
		&& Co.portOf(B, {id: 'S:1'}, 50) && Co.portOf(B, {id: 'S:1'}, 50).foreign === true, Co.portOf(B, {id: 'S:1'}, 50));
	/* B plays and saves: A's colony stays A's; B's own colony is B's */
	B.colonies.push(colony('c2', 'S:2'));
	const gv2 = Sv.packGalaxy(g2, B, 'p2', 210), own = Object.fromEntries(gv2.world.colonies.map(c => [c.id, c.owner]));
	ok('7. saving pilot 2 keeps pilot 1\'s colony as pilot 1\'s and adds pilot 2\'s as theirs; the first survey stays pilot 1\'s', own.c1 == 'p1' && own.c2 == 'p2' && gv2.world.colonies.length == 2 && !gv2.world.colonies.some(c => c.foreign) && gv2.world.firsts.pl[Object.keys(A.explore.pl)[0]] == 'p1', gv2.world.colonies);
	/* A comes back after the galaxy lived 30 days without them: their deadlines move on by 30 */
	const A2 = Sv.unpackPlayer(pa.player);
	A2.missions = [{id: 'm', star: {id: 'S:3', at: [0, 0, 0]}, due: 220}]; A2.hauls = [{colony: 'c1', tons: 5, eta: 215}]; A2.insurance = {provider: home.id, code, since: 200, paidTo: 212, owed: 0};
	A2.stored = [{id: 'pulse', grade: 'C', ready: 230}]; A2.policeKills = [190];
	const g3 = Sv.unpackGalaxy(JSON.parse(JSON.stringify(gv2))); Sv.joinGalaxy(A2, g3, 'p1');
	A2.colonies[0].due = 240; A2.colonies[0].opens = 205; A2.colonies[0].carrier = {until: 225};
	Sv.shiftDays(A2, 30);
	ok('8. a pilot back after 30 galaxy days: their missions, deliveries, insurance, things on their way, police record and colony\'s days all moved on 30 (the galaxy\'s own days untouched)', A2.missions[0].due == 250 && A2.hauls[0].eta == 245 && A2.insurance.paidTo == 242 && A2.stored[0].ready == 260
		&& A2.policeKills[0] == 220 && A2.colonies[0].due == 270 && A2.colonies[0].opens == 235 && A2.colonies[0].carrier.until == 255 && g3.world.markets['m:1'].day == 201, {m: A2.missions, h: A2.hauls, i: A2.insurance, c: A2.colonies[0]});
	ok('9. ...and they keep their own colony back (not marked another\'s), and see pilot 2\'s as another\'s', A2.colonies.length == 1 && A2.colonies[0].id == 'c1' && !A2.colonies[0].foreign && A2.others.length == 1 && A2.others[0].id == 'c2' && A2.others[0].foreign);
	/* a save from before 0.5.5 becomes the galaxy and pilot 1 */
	const old = pilot(); old.wallet[code] = 777; old.markets = {'m:2': {day: 150, s: {}, d: {Water: 3}}}; old.colonies = [colony('c9', 'S:9')];
	X.survey(old, sys, planet, null, 150);
	const raw = Sv.pack(Object.assign(state(old, 160), {pilotOnly: false}));
	const m = Sv.migrate(raw, {origin: 'Home', code, ship: 'Ship', star: 'Sun'});
	const ug = Sv.unpackGalaxy(JSON.parse(JSON.stringify(m.galaxy))), up = Sv.unpack(JSON.parse(JSON.stringify(m.pilot)));
	ok('10. a save from before 0.5.5: its galaxy (markets, colonies as p1\'s, the first survey) and pilot 1 (its money, no galaxy part), the slot\'s summary filled', ug && ug.cur == 0 && ug.seq == 1 && ug.slots[0].id == 'p1' && ug.slots[0].cash.n == 777 && ug.slots[0].star == 'Sun' && ug.world.markets['m:2'] && ug.world.colonies[0].owner == 'p1'
		&& Object.values(ug.world.firsts.pl)[0] == 'p1' && up && up.player.wallet[code] == 777 && !up.player.colonies.length && ug.day == 160, {g: ug && ug.slots[0], p: up && Object.keys(up.player)});
	ok('11. a damaged galaxy value is refused (a new galaxy starts) and bad slots are emptied', Sv.unpackGalaxy({gv: 1, galaxy: 1}) == null && Sv.unpackGalaxy(null) == null
		&& Sv.unpackGalaxy(Object.assign(Sv.newGalaxy(5), {slots: [{id: 'x', origin: 'a'}, {id: 'p3', origin: home.id}]})).slots.map(Boolean).join() == 'false,true,false,false,false,false');
	/* the budget: a galaxy full of mined asteroids is trimmed under 230 KB, keeping colonies, firsts and names */
	const big = Sv.newGalaxy(1); for (let i = 0; i < 20000; i++) big.world.mined['rock:' + i + ':aaaaaaaa'] = i;
	big.world.firsts.pl['S:1|b'] = 'p1'; big.world.names['S:1|b'] = 'Kept'; big.world.colonies = [Object.assign(colony('c5', 'S:5'), {owner: 'p1'})];
	const bt = Sv.packGalaxy(big, null, null, 1), bs = JSON.stringify(bt).length;
	ok('12. the galaxy is trimmed to the budget (mined asteroids go first), keeping colonies, first discoveries and names', bs <= Sv.BUDGET && bt.world.names['S:1|b'] == 'Kept' && bt.world.firsts.pl['S:1|b'] == 'p1' && bt.world.colonies.length == 1, bs);
	ok('13. six slots', Sv.SLOTS == 6 && Sv.newGalaxy(0).slots.length == 6);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
