/* Ember Reach's cargo hatch and canisters (apps/rudolf-emberreach/www/canisters.js, and the hatch's trim in flight.js), in node.
     node tests/emberreach_canisters_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Ca = require(path.join(DIR, 'canisters.js')), Fl = require(path.join(DIR, 'flight.js')), M = require(path.join(DIR, 'modules.js')), S = require(path.join(DIR, 'ships.js')), Tr = require(path.join(DIR, 'trade.js')), F = require(path.join(DIR, 'factions.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const DT = 1 / 60, len = a => Math.hypot(...a);
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
try {
	const L = S.ships(), packet = L.find(s => s.id == 'packet'), kestrel = L.find(s => s.id == 'kestrel');
	ok('1. every ship with a hold has a cargo hatch (and the hatch, not the hold, is the module that takes hits)', L.every(s => !!M.get(M.fit(s), 'hatch') == s.cargo > 0) && L.every(s => !M.get(M.fit(s), 'cargo')));
	/* the scooping trim */
	const fly = (hatch, input, secs) => { const s = Fl.create(packet); s.hatch = hatch; for (let t = 0; t < secs; t += DT) Fl.step(s, input, DT); return s };
	const fast = fly(false, {throttle: 1}, 20), trim = fly(true, {throttle: 1}, 20);
	ok('2. FA with the hatch open holds the ship to 12% of top speed', Math.abs(len(trim.v) - 0.12 * packet.speed) < 2 && len(fast.v) > 0.95 * packet.speed, len(trim.v).toFixed(1) + ' m/s');
	const s3 = Fl.create(packet, {v: [0, 0, packet.speed]}); s3.hatch = true; Fl.setAssist(s3, false); for (let t = 0; t < 3; t += DT) Fl.step(s3, {}, DT);
	ok('3. opening the hatch at speed slows the ship by drag, even with FA off', len(s3.v) < packet.speed * 0.2, len(s3.v).toFixed(1) + ' m/s after 3 s');
	const turn = h => { const s = Fl.create(packet); s.hatch = h; for (let t = 0; t < 1; t += DT) Fl.step(s, {pitch: 1, throttle: 0}, DT); return Math.abs(s.w[0]) };
	ok('4. ...and the stick turns at 40% of its rates, for fine work', Math.abs(turn(true) / turn(false) - 0.4) < 0.02);
	/* scooping */
	const pl = Tr.newPlayer(F.majors()[0].id), ship = Fl.create(packet); ship.radius = packet.length / 2;
	const down = [0, -1, 0], back = [0, 0, -1], at = Ca.hatchAt(ship, down, back);
	const cans = [Ca.make('Food', at, [0, 0, 0], 0, seeded(1)), Ca.make('Metals', [0, 0, 400], [0, 0, 0], 0, seeded(2)), Ca.make('Medicine', at, [0, 60, 0], 0, seeded(3))];
	cans.forEach(c => c.v = c.good == 'Medicine' ? [0, 60, 0] : [0, 0, 0]);
	const r = Ca.scoop(cans, ship, down, back, pl, packet.cargo);
	ok('5. a slow canister at the hatch comes aboard; one far off, or too fast, doesn\'t', r.got.join() == 'Food' && pl.cargo.Food == 1 && cans.length == 2 && r.fast);
	pl.cargo = {Machinery: packet.cargo}; const r2 = Ca.scoop([Ca.make('Food', at, [0, 0, 0], 0)].map(c => (c.v = [0, 0, 0], c)), ship, down, back, pl, packet.cargo);
	ok('6. a full hold takes nothing more', !r2.got.length && r2.full);
	pl.cargo = {Food: 2}; pl.cost = {Food: 10}; const c1 = Ca.make('Food', at, [0, 0, 0], 0); c1.v = [0, 0, 0]; Ca.scoop([c1], ship, down, back, pl, packet.cargo);
	ok('7. scooped goods cost nothing: the hold\'s average price falls', pl.cargo.Food == 3 && Math.abs(pl.cost.Food - 20 / 3) < 1e-9);
	/* spilling */
	pl.cargo = {Food: 3, Metals: 5}; pl.cost = {Food: 8, Metals: 30}; const acc = {}, spilt = [];
	for (let t = 0; t < 40; t += DT) spilt.push(...Ca.spill(pl, ship, back, t, DT, acc, seeded(4)));
	ok('8. a broken hatch spills a tonne every 8 s, the commonest good first', spilt.length == 5 && spilt[0].good == 'Metals' && pl.cargo.Metals + pl.cargo.Food == 3, spilt.length + ' in 40 s');
	ok('9. spilt canisters drift off behind the ship', spilt.every(c => c.v[2] < 0));
	const list = [Ca.make('Food', [0, 0, 0], [1, 0, 0], 0)]; Ca.step(list, 10, 10);
	ok('10. canisters drift, and break up after 15 minutes', Math.abs(list[0].p[0] - 10 * list[0].v[0]) < 1e-9 && (Ca.step(list, 901, 1), list.length == 0));
	const rnd = seeded(9), tr = [...Array(50)].map(() => Ca.wreck('trader', packet, rnd).length), pi = [...Array(50)].map(() => Ca.wreck('pirate', kestrel, rnd).length);
	ok('11. wrecks leave cargo: traders the most, pirates a little', tr.every(n => n >= 1) && tr.reduce((a, b) => a + b) > pi.reduce((a, b) => a + b) && Math.max(...pi) <= 3);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
