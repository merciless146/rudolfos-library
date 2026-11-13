/* Ember Reach's encounters and war missions (apps/rudolf-emberreach/www/encounters.js), in node.
     node tests/emberreach_encounters_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const En = require(path.join(DIR, 'encounters.js')), F = require(path.join(DIR, 'factions.js')), R = require(path.join(DIR, 'reputation.js')), Tr = require(path.join(DIR, 'trade.js')), T = require(path.join(DIR, 'travel.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + d : '')) } };
try {
	const home = F.majors()[0], pl = Tr.newPlayer(home.id), day = 200;
	const cap = home.star, port = T.portFor(cap, day);
	const c1 = En.cast(cap, day, pl, {port, visit: 1}), c1b = En.cast(cap, day, pl, {port, visit: 1});
	ok('1. a capital has its patrol (its own navy) and traffic, the same each time for the same visit', c1.some(n => n.role == 'patrol' && n.faction == home.id) && JSON.stringify(c1.map(n => n.ship.id)) == JSON.stringify(c1b.map(n => n.ship.id)));
	ok('2. a home patrol leaves its own pilot alone; traders never start a fight', c1.filter(n => n.role == 'patrol' || n.role == 'trader').every(n => !En.hostile(pl, n)));
	/* a war, and one of its systems */
	const w = F.wars().find(w => w.a == home.id || w.b == home.id) || F.wars()[0];
	const side = w.a, enemy = w.b, sys = w.systems[0];
	let wing = null;
	for (let v = 0; v < 40 && !wing; v++) { const c = En.cast(sys.star, day, pl, {visit: v}); if (c.some(n => n.role == 'navy' && n.faction == w.a) && c.some(n => n.role == 'navy' && n.faction == w.b)) wing = c }
	ok('3. contested systems see both sides\' war wings, and they fight each other', wing && En.enemies(wing.find(n => n.faction == w.a && n.role == 'navy'), wing.find(n => n.faction == w.b && n.role == 'navy'), pl));
	let pirates = 0, visits = 0;
	const site = F.minors().filter(m => m.type == 'nomad').flatMap(m => m.sites).find(x => !String(x.id).startsWith('deep') && !F.claimAt(x.at).owner && !F.claimAt(x.at).contested), lonely = T.starAt(site.id, site.at);
	for (let v = 0; v < 200; v++) { visits++; if (En.cast(lonely, day, pl, {visit: v}).some(n => n.role == 'pirate')) pirates++ }
	ok('4. pirates turn up in unclaimed space about half the time', Math.abs(pirates / visits - 0.5) < 0.12, pirates + '/' + visits);
	const pirate = {role: 'pirate', faction: F.minors().find(m => m.type == 'criminal').id, ship: {value: 200000}};
	ok('5. pirates attack, and patrols hunt pirates', En.hostile(pl, pirate) && En.enemies({role: 'patrol', faction: home.id}, pirate, pl));
	/* consequences */
	const before = Object.assign({}, pl.wallet), cs = Tr.newPlayer(home.id);
	const res = En.killed(pl, Object.assign({}, pirate), {star: cap, day, own: {owner: home.id}});
	ok('6. a pirate\'s death pays a bounty in the local currency and pleases the owner', res.pay.length && pl.wallet[home.currency.code] > before[home.currency.code] && pl.rep[home.id] > cs.rep[home.id]);
	const trader = c1.find(n => n.role == 'trader') || {role: 'trader', faction: home.id, ship: {value: 1}};
	En.provoke(trader, c1);
	const r7 = En.killed(pl, trader, {star: cap, day, own: {owner: home.id}});
	ok('7. murdering an unarmed trader angers its faction, puts a bounty on you, and the patrol turns on you', pl.rep[home.id] < 350 && Object.keys(pl.bounties).length && r7.msg.some(m => /bounty/i.test(m)) && c1.filter(n => n.role == 'patrol').every(n => En.hostile(pl, n)));
	ok('8. once wanted, a power\'s patrols attack you even unprovoked', (() => { const fresh = c1.find(n => n.role == 'patrol'); fresh.provoked = false; return En.hostile(pl, fresh) })());
	/* war missions */
	const p2 = Tr.newPlayer(w.a), offers = F.warMissions(w.a, day, []);
	const strike = offers.find(m => En.NEEDS[m.type] == 'kills') || offers[0];
	const acc = En.accept(p2, strike, day);
	ok('9. a war mission is taken, with its system and a 10-day deadline', acc.ok && p2.missions[0].star.id == strike.system && p2.missions[0].due == day + 10, acc.why);
	const mstar = T.starAt(p2.missions[0].star.id, p2.missions[0].star.at) || {id: p2.missions[0].star.id, at: p2.missions[0].star.at};
	const castM = En.cast(mstar, day, p2, {visit: 0}), foes = castM.filter(n => n.mission == strike.id);
	ok('10. the mission\'s system holds what it sends you after', En.NEEDS[strike.type] == 'kills' ? foes.length == En.ENC.kills && foes.every(n => n.faction == strike.against && En.hostile(p2, n)) : foes.length > 0);
	const evBefore = p2.warEvents.length, walletBefore = p2.wallet[strike.currency] || 0;
	for (const f of foes) En.killed(p2, f, {star: mstar, day, own: T.ownerOf(mstar, day)});
	if (En.NEEDS[strike.type] == 'stay') En.tick(p2, mstar.id, 31, false);
	const done = En.settle(p2, day + 1);
	ok('11. finishing it pays, and the effort reaches the front', done.length == 1 && done[0].ok && p2.wallet[strike.currency] >= walletBefore + strike.reward && p2.warEvents.length > evBefore, JSON.stringify(done.map(d => d.text)));
	const p3 = Tr.newPlayer(w.a); En.accept(p3, offers[offers.length - 1], day); const repB = p3.rep[w.a];
	const late = En.settle(p3, day + 11);
	ok('12. a mission left past its deadline fails, and the issuer minds', late.length == 1 && !late[0].ok && p3.rep[w.a] < repB && !p3.missions.length);
	const p4 = Tr.newPlayer(w.a); offers.slice(0, 3).forEach(m => En.accept(p4, Object.assign({}, m, {type: 'strike'}), day));
	ok('13. three at a time; supply runs need the munitions aboard', !En.accept(p4, Object.assign({}, offers[0], {id: 'x', type: 'strike'}), day).ok && !En.accept(Tr.newPlayer(w.a), Object.assign({}, offers[0], {type: 'supply'}), day).ok);
	/* flagships */
	let seen = null;
	for (const m of F.minors().filter(m => m.carrier && m.pattern != 'nomadic')) { const wh = F.whereIs(m, day); if (wh.site && !String(wh.site.id).startsWith('deep')) { const st = T.starAt(wh.site.id, wh.site.at); if (st) { const c = En.cast(st, day, pl, {}); if (c.some(n => n.role == 'flagship' && n.faction == m.id)) { seen = m; break } } } }
	ok('14. a small faction\'s carrier or dreadnought is where it is that season', !!seen);
} catch (e) { N++; console.log('FAIL (error) ' + (e.stack || e)) }
console.log(P + '/' + (P + N) + ' passed'); process.exit(N ? 1 : 0);
