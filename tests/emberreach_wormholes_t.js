/* Ember Reach's black holes as wormholes, the proximity safety, and alien blueprints built by an artifact broker,
   in node.
     node tests/emberreach_wormholes_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Sc = require(path.join(DIR, 'scene.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js')), O = require(path.join(DIR, 'outfit.js')),
	S = require(path.join(DIR, 'ships.js')), Tr = require(path.join(DIR, 'trade.js')), Sv = require(path.join(DIR, 'save.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
try {
	const home = F.majors()[5];
	let bh = null; for (let R = 4; !bh && R < 64; R *= 2) bh = G.starsNear(home.star.x, home.star.y, home.star.z, R).find(s => s.kind == 'black hole');
	ok('1. black holes are in the catalogue', !!bh, bh && bh.name + ', ' + bh.M.toFixed(1) + ' suns');
	const sc = Sc.build(bh, {day: 200, port: null}), b = sc.bodies[0];
	ok('2. in its system, the black hole is a body with its horizon (2.95 km a sun)', b.bh && Math.abs(b.radius - 2953 * bh.M) < 1);
	ok('3. the ship\'s safety holds it 2,000 km off a black hole, and cruise drops out short of that', Sc.safeDist(b) == 2e6 && Sc.dropRange(b) > Sc.safeDist(b));
	const star = {kind: 'star', radius: 7e8}, air = {kind: 'planet', radius: 6.4e6, atmo: true}, rock = {kind: 'planet', radius: 2e6, atmo: false};
	ok('4. stars 1.6 radii; worlds with air their atmosphere\'s top; airless worlds their surface (no landing yet)', Sc.safeDist(star) == 7e8 * 1.6 && Sc.safeDist(air) == 6.4e6 * 1.12 && Sc.safeDist(rock) == 2e6 + 300);
	/* the phaser */
	const pike = S.ships().find(s => s.id == 'pike'), f = O.stock(pike), big = f.internal.findIndex((m, i) => O.layout(pike).internal[i] >= 3);
	const r = O.install(pike, (() => { f.core.power.grade = 'A'; return f })(), {cat: 'internal', i: big}, {id: 'phaser', size: 3, grade: 'A'});
	ok('5. a dimensional phaser is an internal module (size 3) that lets the ship use wormholes', r.ok && O.derive(pike, r.fit).phaser && !O.derive(pike).phaser, r.why);
	ok('6. no outfitter sells alien modules', !O.offers(pike, {cat: 'internal', i: big}, {cls: 'halo'}).some(o => o.id == 'phaser' || o.id == 'alien'));
	/* blueprints */
	const rnd = seeded(5), got = {phaser: 0, alien: 0, none: 0}; for (let i = 0; i < 4000; i++) { const bp = O.blueprintFrom(rnd); got[bp ? bp.id : 'none']++ }
	ok('7. ruins yield blueprints: a phaser about 15% of the time, a relay booster about 30%', Math.abs(got.phaser / 4000 - 0.15) < 0.02 && Math.abs(got.alien / 4000 - 0.30) < 0.025, JSON.stringify(got));
	const pl = Tr.newPlayer(home.id), cur = home.currency.code;
	O.learn(pl, {id: 'phaser', size: 3});
	ok('8. a blueprint found goes into your materials (two finds, two blueprints)', O.learn(pl, {id: 'alien', size: 2}) && pl.blueprints.length == 2);
	const pay = fee => Tr.pay(pl, fee * 6, cur, 200);
	ok('9. the broker needs the recipe\'s goods in the hold', !O.build(pl, pl.blueprints[0], pay).ok);
	pl.cargo = {Artefacts: 12, Uranium: 6, Diamond: 2, Electronics: 5}; pl.wallet[cur] = 1e8; const w0 = pl.wallet[cur];
	const built = O.build(pl, pl.blueprints[0], pay);
	ok('10. with them, it builds the module into storage, using up the blueprint, the goods and its fee', built.ok && pl.stored.some(m => m.id == 'phaser') && pl.cargo.Electronics == 1 && !pl.cargo.Artefacts && pl.wallet[cur] < w0 && !pl.blueprints.some(b => b.id == 'phaser'));
	ok('11. brokers keep shop at lanterns, blooms and halos, not outposts', O.broker({cls: 'halo'}) && O.broker({cls: 'lantern'}) && !O.broker({cls: 'trefoil'}));
	/* recycling */
	const j = pl.stored.findIndex(m => m.id == 'phaser'), rc = O.recycle(pl, j, 'st1', 200, 100);
	ok('10b. recycling an alien module gives its blueprint back, with half its goods', rc.ok && pl.blueprints.some(b => b.id == 'phaser') && rc.goods.Artefacts == 6 && pl.cargo.Artefacts == 6 && !pl.stored.some(m => m.id == 'phaser'));
	pl.stored.push({id: 'shield', size: 3, grade: 'B'}, {id: 'pulse', size: 1, grade: 'C'}, {id: 'nav', grade: 'C'});
	const r2 = O.recycle(pl, pl.stored.length - 3, 'st1', 201, 100), r3 = O.recycle(pl, pl.stored.length - 2, 'st1', 202, 100), r4 = O.recycle(pl, pl.stored.length - 1, 'st1', 203, 100);
	ok('10c. any module recycles for materials, but a station takes only 3 in 7 days', r2.ok && r2.goods.Iron > 0 && r3.ok && !r4.ok && /busy/.test(r4.why) && O.recycle(pl, pl.stored.length - 1, 'st2', 203, 100).ok);
	ok('10d. ...and the spell passes', (pl.stored.push({id: 'nav', grade: 'C'}), O.recycle(pl, pl.stored.length - 1, 'st1', 208, 100).ok));
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(pl))));
	ok('12. blueprints and the recyclers\' records come back from the save', back.blueprints.length == pl.blueprints.length && back.blueprints.some(b => b.id == 'phaser') && back.recycled.st1.length == pl.recycled.st1.length);
	/* where wormholes lead: anywhere the galaxy has stars */
	const ends = []; for (let k = 0; k < 20; k++) { const sm = G.sampleGalaxy(1, 1000 + k)[0]; let to = null; for (let R0 = 1; !to && R0 < 200; R0 *= 2) to = G.starsNear(sm.x, sm.y, sm.z, R0).find(x => x.kind == 'star'); ends.push(to) }
	const rr = ends.map(t => Math.hypot(t.x, t.y, t.z));
	ok('13. a wormhole leads to a real star, anywhere: near the centre and far out', ends.every(Boolean) && Math.min(...rr) < 150 * G.SCALE && Math.max(...rr) > 300 * G.SCALE, rr.map(Math.round).join(','));
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
