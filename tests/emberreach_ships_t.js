/* Ember Reach's stock ships (wip/emberreach/ships.js), in node.
     node tests/emberreach_ships_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'wip/emberreach');
const S = require(path.join(DIR, 'ships.js')), F = require(path.join(DIR, 'factions.js')), E = require(path.join(DIR, 'economy.js'));
let P = 0, Fl = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { Fl++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const L = S.ships(), M = F.majors(), sizes = S.SIZES;
	ok('1. forty stock ships, each named once, in every size from XS to Capital', L.length == 40 && new Set(L.map(s => s.name)).size == 40 && sizes.every(z => L.some(s => s.size == z)));
	ok('2. built by every great power\'s yards and by independent yards', M.every(m => L.some(s => s.maker == m.id)) && L.some(s => s.maker.startsWith('yard')));
	const mid = z => { const v = L.filter(s => s.size == z).map(s => s.priceSU[0]).sort((a, b) => a - b); return v[v.length >> 1] };
	ok('3. each size class costs more than the one below (median prices)', sizes.every((z, k) => !k || mid(z) > mid(sizes[k - 1]) * 2), sizes.map(z => z + ' ' + mid(z)).join(', '));
	ok('4. every ship costs more than every ship two size classes below it', sizes.every((z, k) => k < 2 || Math.min(...L.filter(s => s.size == z).map(s => s.priceSU[0])) > Math.max(...L.filter(s => s.size == sizes[k - 2]).map(s => s.priceSU[1]))));
	/* price follows the stats: rank correlation between price and toughness × firepower × cargo × reach × tech */
	const merit = s => (s.hull + 1.4 * s.shield) * Math.sqrt(1 + (s.hard[0] + 3 * s.hard[1] + 9 * s.hard[2] + 27 * s.hard[3]) / 20) * Math.pow(1.35, s.tech) * (1 + s.cargo / 2000) * (1 + 0.1 * s.jump);
	const rank = a => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = []; o.forEach(([, i], k) => r[i] = k); return r };
	const ra = rank(L.map(s => s.priceSU[0])), rb = rank(L.map(merit)), n = L.length, rho = 1 - 6 * ra.reduce((t, v, i) => t + (v - rb[i]) ** 2, 0) / (n * (n * n - 1));
	ok('5. prices follow the stats (rank correlation above 0.95)', rho > 0.95, rho.toFixed(3));
	const base = L.find(s => s.name == 'Corsair'), at = t => S.value(Object.assign({}, base, {tech: t}));
	ok('6. advanced ships cost more: the same ship a tech level higher costs about 35% more', [2, 3, 4, 5].every(t => Math.abs(at(t) / at(t - 1) - 1.35) < 1e-9));
	const bigger = S.value(Object.assign({}, base, {hull: base.hull * 2, shield: base.shield * 2}));
	ok('6b. twice the armour and shields costs nearly twice as much', bigger / base.value > 1.85 && bigger / base.value < 2);
	ok('7. a price range for every ship (low below high)', L.every(s => s.priceSU[0] > 0 && s.priceSU[1] > s.priceSU[0]));
	const heavy = M.find(m => m.species.build == 'heavy'), hs = L.find(s => s.maker == heavy.id), stock = S.STOCK.find(r => r[0] == hs.name);
	ok('8. a heavy-bodied species builds tougher, slower-turning ships', hs.hull > stock[4] && hs.agility < stock[7]);
	const who = new Set(L.flatMap(s => s.who));
	ok('9. ships for every kind of NPC: navies, pirates, traders, miners, explorers, nomads, couriers, passengers, prospectors, salvagers, bounty hunters, smugglers', ['navy', 'pirate', 'trader', 'miner', 'explorer', 'nomad', 'courier', 'passenger', 'prospector', 'salvager', 'bounty', 'smuggler'].every(w => who.has(w)));
	ok('10. the fleet carriers and dreadnoughts the small factions fly are in the catalogue', L.some(s => s.role == 'fleet carrier') && L.some(s => s.role == 'dreadnought') && F.minors().filter(m => m.carrier).every(m => L.some(s => s.role == m.carrier.class)));
	/* prices at stations, in local money */
	const home = M[0], own = L.find(s => s.maker == home.id), p = S.price(own.id, home.star, 100);
	ok('11. sold in the station\'s currency at the day\'s rate', p.currency == home.currency.code && Math.abs(p.low - own.priceSU[0] * E.rate(home.currency.code, 100)) <= 1);
	const enemyShip = L.find(s => s.maker == home.enemies[0]);
	ok('12. a great power\'s yards don\'t sell its enemies\' ships', !enemyShip || S.price(enemyShip.id, home.star, 100) === null);
	const indie = L.find(s => s.maker.startsWith('yard')), pi = S.price(indie.id, home.star, 100);
	ok('13. independent designs sell anywhere', pi && pi.low > 0);
	const front = F.wars()[0].systems[0].star, pf = S.price(indie.id, front, 100), pfRate = pf && (pf.currency == 'SU' ? 1 : E.rate(pf.currency, 100));
	ok('14. ships cost more near a front', pf && pf.low / pfRate > indie.priceSU[0] * 1.3);
} catch (e) { Fl++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + Fl) + ' passed'); process.exit(Fl ? 1 : 0);
