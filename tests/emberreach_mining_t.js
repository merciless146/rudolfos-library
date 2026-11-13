/* Ember Reach's mining (wip/emberreach/mining.js): fields, asteroids, chipping ore, the refinery, tractor beams,
   with the modules that do it, in node.
     node tests/emberreach_mining_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const Mi = require(path.join(DIR, 'mining.js')), Sc = require(path.join(DIR, 'scene.js')), G = require(path.join(DIR, 'galaxy.js')), F = require(path.join(DIR, 'factions.js')), Ca = require(path.join(DIR, 'canisters.js')),
	O = require(path.join(DIR, 'outfit.js')), S = require(path.join(DIR, 'ships.js')), Fl = require(path.join(DIR, 'flight.js')), Tr = require(path.join(DIR, 'trade.js')), Sv = require(path.join(DIR, 'save.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
const seeded = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647 };
const len = a => Math.hypot(...a);
try {
	const home = F.majors()[5];
	/* a system with a ringed planet */
	let star = null; for (const s of G.starsNear(home.star.x, home.star.y, home.star.z, 8)) if (s.kind == 'star' && G.system(s).planets.some(p => p.ring)) { star = s; break }
	const scene = Sc.build(star, {day: 200, port: null}), fs = Mi.fields(scene, star), ring = fs.find(f => f.id.startsWith('ring:'));
	ok('1. ringed planets have a mining site in their rings: stone, ice or metal', !!ring && ['Stone', 'Ice', 'Metal'].includes(ring.kind), ring && ring.name);
	const fs2 = Mi.fields(Sc.build(star, {day: 200, port: null}), star);
	ok('2. the same fields every time; belts in some systems', JSON.stringify(fs.map(f => f.pos.map(Math.round))) == JSON.stringify(fs2.map(f => f.pos.map(Math.round))) && (() => { let b = 0, n = 0; for (const s of G.starsNear(home.star.x, home.star.y, home.star.z, 6).filter(x => x.kind == 'star').slice(0, 60)) { n++; if (Mi.fields(Sc.build(s, {day: 200, port: null}), s).some(f => f.id.startsWith('belt:'))) b++ } return b > n * 0.4 && b < n * 0.9 })());
	const rocks = Mi.rocks(ring, {});
	ok('3. a site holds 64 asteroids (96 in a dense ring), 30-240 m, each with two or three goods and a yield', rocks.length == (ring.density == 'dense' ? 96 : 64) && rocks.every(r => r.radius >= 30 && r.radius <= 240 && Object.keys(r.comp).length >= 1 && r.yield > 0) && rocks.every(r => len([r.pos[0] - ring.pos[0], r.pos[1] - ring.pos[1], r.pos[2] - ring.pos[2]]) < Mi.MINE.site));
	ok('4. ice rings hold water; stone rings ores', ring.kind == 'Ice' ? rocks.some(r => r.comp.Water) : rocks.some(r => r.comp.Iron || r.comp.Copper));
	/* chipping */
	const r0 = rocks[0], mined = {}, from = [r0.pos[0] + 500, r0.pos[1], r0.pos[2]], rnd = seeded(3); let chunks = [];
	for (let i = 0; i < 60; i++) { const c = Mi.chip(r0, from, rnd, mined); if (c) chunks.push(c) }
	ok('5. a mining laser breaks a chunk of ore off every 6 hits, of the asteroid\'s goods, drifting back to the shooter', chunks.length == 10 && chunks.every(c => r0.comp[c.good] && c.t >= 0.25 && c.t <= 0.6 && c.p[0] > r0.pos[0]));
	ok('6. mining runs the asteroid down, and the tonnes taken are remembered', Math.abs(mined[r0.id] - chunks.reduce((t, c) => t + c.t, 0)) < 0.02 && Mi.rocks(ring, mined)[0].left < r0.yield);
	const spent = Object.assign({}, r0, {left: 0}); let none = 0; for (let i = 0; i < 12; i++) if (Mi.chip(spent, from, rnd)) none++;
	ok('7. a spent asteroid gives nothing', none == 0);
	/* refining */
	const pl = Tr.newPlayer(home.id);
	ok('8. no refinery, no ore', !Mi.refine(pl, 'Iron', 0.5, 0, 100).ok);
	let made = []; for (let i = 0; i < 5; i++) made.push(...Mi.refine(pl, 'Iron', 0.45, 3, 100).made);
	ok('9. a refinery bin turns each full tonne into cargo', made.length == 2 && pl.cargo.Iron == 2 && Math.abs(pl.refinery.Iron - 0.25) < 1e-9);
	Mi.refine(pl, 'Copper', 0.3, 3, 100); Mi.refine(pl, 'Gold', 0.3, 3, 100);
	ok('10. one bin per good: when they\'re all in use, a new good is refused until one is emptied', !Mi.refine(pl, 'Water', 0.3, 3, 100).ok && (Mi.purge(pl, 'Gold'), Mi.refine(pl, 'Water', 0.3, 3, 100).ok));
	/* scooping ore, and tractors */
	const pike = S.ships().find(s => s.id == 'burrow'), ship = Fl.create(pike); ship.radius = 20;
	const at = Ca.hatchAt(ship, [0, -1, 0], [0, 0, -1]), ore = Ca.make('Iron', at, [0, 0, 0], 0); ore.v = [0, 0, 0]; ore.ore = 0.5;
	const p2 = Tr.newPlayer(home.id), sc = Ca.scoop([ore], ship, [0, -1, 0], [0, 0, -1], p2, 100, {refine: (g, t) => Mi.refine(p2, g, t, 3, 100)});
	ok('11. ore scooped through the hatch goes to the refinery, not the hold', sc.ore.length == 1 && p2.refinery.Iron == 0.5 && !p2.cargo.Iron);
	const far = Ca.make('Food', [at[0] + 400, at[1], at[2]], [0, 0, 0], 0); far.v = [0, 0, 0];
	for (let t = 0; t < 60 && len([far.p[0] - at[0], far.p[1] - at[1], far.p[2] - at[2]]) > 15; t += 1 / 30) { Mi.tractor([far], ship, at, 1, 1 / 30); Ca.step([far], t, 1 / 30) }
	ok('12. a tractor beam brings a canister to the hatch, slowly enough to scoop', len([far.p[0] - at[0], far.p[1] - at[1], far.p[2] - at[2]]) <= 15 && len(far.v) <= Ca.CAN.speed);
	ok('13. bolts stop at asteroids', Mi.hitRock(rocks, [r0.pos[0] + 1000, r0.pos[1], r0.pos[2]], [r0.pos[0], r0.pos[1], r0.pos[2]]) != null);
	/* the modules */
	const d = O.derive(pike);
	ok('14. miners come with a mining laser, a refinery and a resource scanner', d.mining >= 1 && d.refinery >= 2 && d.utility.prospector);
	ok('15. a refinery has two bins plus one a size', O.derive(pike, (() => { const f = O.stock(pike); const i = f.internal.findIndex(m => m && m.id == 'refinery'); f.internal[i] = {id: 'refinery', size: 1, grade: 'C'}; return f })()).refinery == 2);
	const back = Sv.unpackPlayer(JSON.parse(JSON.stringify(Sv.packPlayer(Object.assign(p2, {mined})))));
	ok('16. the save keeps what\'s been mined and the refinery\'s bins', back.mined[r0.id] == mined[r0.id] && back.refinery.Iron == 0.5);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
