/* ===== Ember Reach: colonies, part 1 (docs/plan-ember-reach-colonies.md, M5b-1): claims, the beacon, the primary
   port and its goods, and haulage contracts.
   - The claim: at a great power's colonial office (any of its ports), a system within one jump of that port: one with
     planets, outside the Core, not contested, with no port of its own. Unclaimed space is open to any power you're
     at least Neutral with; inside a power's own space you need its charter (Friendly, at its own office). The fee
     depends on the primary port (outpost, station, great port), paid in the sponsor's coin at the day's rate.
   - One open claim at a time, and a colony budget by standing: one to start, one more per 100 reputation above
     Friendly with the sponsor.
   - The beacon: within 2 game days, fly there and drop it near the chosen world. A constructor ship arrives.
   - The build: deliver the port's goods to the constructor within one season (30 days). Goods come from your own
     hold, or by haulage contract: NPC haulers bring them for 10-25% over the market (more the farther they come),
     arriving after their travel time.
   - Done, the port opens the next day: a port of the sponsor's, with a market in its coin, and +150 standing with it.
   - Lapsed (beacon not dropped, or the season out): what was delivered stays as salvage, and a new claim on the
     system costs a third less.
   Part 2 (M5b-2): building out a finished colony.
   - Slots from the system's own bodies: in orbit 1 + 1 per 2 Earth radii + 1 if ringed (gas giants up to 4); on the
     surface of rocky worlds under 2.5 g, 1 to 3 by size, +1 with air and water. The primary port takes an orbital
     slot at its world.
   - Facilities in three tiers: tier 1 builds earn a tier 2 point; tier 2 builds cost one and earn a tier 3 point;
     tier 3 builds cost 4 tier 3 points, 2 more for each tier 3 build before. The primary port costs none and earns
     its tier's points. No time limit after the primary port; goods are handed over docked at the colony's own port,
     or brought by haulers.
   - Links: each facility's economy counts fully (strong link) around or on the port's world, at 5% (weak) elsewhere
     in the system, boosted or cut by its body and star (rings, life, water, ruins, metals, a dead star). The mix
     sets the port's market (economy.js): what it produces sells cheap, what it consumes sells dear and is bought.
   - Population grows each day towards a cap set by the best world and the habitats and ports; security, wealth and
     tech come from the facilities.
   - Each season (30 days from opening) the colony pays its architect a share of its trade (5-10% by wealth), in
     the sponsor's coin.
   Part 3 (M5b-3): the edges.
   - Forward bases: in contested space, for the side you're commissioned with, at its own office, where that side
     holds the system and its supply chain reaches. 2,500 t of military goods. A built base puts war effort into
     its front each season while its side holds the system; if the enemy takes it, the base is lost.
   - Raids: construction draws pirates (the flight screen adds them on arrival), and haulers can be raided on the
     way (10% of runs in unclaimed space, 5% in claimed, none past a military outpost at the colony).
   - Independent colonies: claimed with no sponsor (unclaimed space only), the fee paid through free traders. They
     mint their own scrip, pegged to the SU at first and floating with the colony's wealth; they pay their
     architect more (10-15%, no taxes) but have no protection: low security for two seasons running and a syndicate
     takes the colony over.
   - Rented carriers: a prospector guild's or nomads' fleet carrier, parked at your build for a season (if they're
     not against you), serves as a depot: haulage to that colony costs 30% less and arrives in half the days.
   The record (P.colonies, P.hauls) is plain data, kept in the save. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy'), F = req('factions.js', 'EmberFactions'), E = req('economy.js', 'EmberEconomy'), R = req('reputation.js', 'EmberReputation'), T = req('travel.js', 'EmberTravel');

/* the primary ports: fee (SU), station class when built, and the goods (tonnes, with the first port's +20% in) */
const PORTS = {
	outpost: {name: 'Outpost', cls: 'trefoil', fee: 120000, goods: {Iron: 400, Aluminum: 300, Titanium: 150, Machinery: 200, Electronics: 100, Food: 150, Water: 150, Fuel: 50}},
	station: {name: 'Station', cls: 'lantern', fee: 300000, goods: {Iron: 2000, Aluminum: 1600, Titanium: 900, Machinery: 1200, Electronics: 700, Food: 700, Water: 600, Fuel: 300}},
	great: {name: 'Great port', cls: 'halo', fee: 750000, goods: {Iron: 6000, Aluminum: 5000, Titanium: 3000, Machinery: 4000, Electronics: 2500, Food: 2000, Water: 1800, Fuel: 700}},
	base: {name: 'Forward base', cls: 'trefoil', fee: 200000, goods: {Iron: 625, Titanium: 500, Machinery: 375, Electronics: 375, Munitions: 625}, base: true}};
const COL = {claimDays: 2, seasonDays: 30, salvage: 1 / 3, core: G.REGIONS[0][2], beaconRadii: 30, deliverRange: 3000, charter: 100, neutral: -100, perRep: 100, finishRep: 150,
	raid: {unclaimed: 0.10, claimed: 0.05}, baseEffort: 5, rent: {fee: 40000, cut: 0.3}, scrip: {drift: 0.15}, takeover: 2, indep: {share: [0.10, 0.15], security: -0.15},
	haul: {over: [0.10, 0.25], perPc: 0.004, fleet: [{ship: 'Aurochs', t: 600, jump: 5}, {ship: 'Woolly-Rhino', t: 3000, jump: 6}, {ship: 'Brontosaur', t: 30000, jump: 6}]}};
const at = s => s.at || [s.x, s.y, s.z];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const total = o => Object.values(o).reduce((t, v) => t + v, 0);
const list = P => (P.colonies = P.colonies || []);
const short = id => F.byId(id).name.replace(/^The /, '');

/* the world a primary port orbits: the most Earth-like, or the biggest */
function portWorld(star) { const pl = G.system(star).planets.slice().sort((a, b) => b.esi - a.esi || b.R - a.R); return pl[0] ? pl[0].name : null }
const open = P => list(P).find(c => c.stage == 'claimed' || c.stage == 'building');
/* who claims a star's space: nobody, in the Rift (whose coordinates are its own, not the powers') */
const claimOf = s => (s.rift || /^R:/.test(s.id || '')) ? {owner: null, contested: null} : F.claimAt(at(s));
const budget = (P, sponsor) => 1 + Math.floor(Math.max(0, (P.rep[sponsor] || 0) - COL.charter) / COL.perRep);
const gone = c => c.stage == 'lapsed' || c.stage == 'lost';
const held = P => list(P).filter(c => !gone(c)).length;
const colonyAt = (P, starId) => list(P).find(c => c.star.id == starId && !gone(c)) || null;

/* can this office's sponsor claim this system for you? {ok, why, fee (sponsor's coin), salvage} */
function canClaim(P, office, star, kind, day, jumpRange, plan, independent) {
	if (star.heart) return {ok: false, why: 'Nothing can be built at the Maw.'};
	/* the Rift (0.2.0): no power files claims there, but a pilot may build an independent colony, filed at one of
	   its anchorages */
	if (star.rift) {
		if (!office.star || !office.star.rift) return {ok: false, why: 'Claims in the Rift are filed at a Rift anchorage.'};
		if (!independent) return {ok: false, why: 'No power files claims in the Rift: only independent colonies.'};
		if (!PORTS[kind]) return {ok: false, why: 'No such port.'};
		return indepClaim(P, office, star, kind, day, jumpRange, plan);
	}
	if (office.star && office.star.rift) return {ok: false, why: 'From a Rift anchorage, claims go only in the Rift.'};
	const sp = F.byId(office.owner), K = PORTS[kind];
	if (!sp || sp.kind != 'major') return {ok: false, why: 'Claims are filed at a great power\'s colonial office.'};
	if (!K) return {ok: false, why: 'No such port.'};
	if (independent) return indepClaim(P, office, star, kind, day, jumpRange, plan);
	if (K.base) return baseClaim(P, office, star, day, jumpRange, plan);
	const p = at(star);
	if (dist(p, at(office.star)) > jumpRange) return {ok: false, why: star.name + ' is more than one jump (' + jumpRange + ' pc) from here.'};
	if (G.mRad(p[0], p[1], p[2]) < COL.core) return {ok: false, why: 'Nothing can be built in the Core.'};
	if (!G.system(star).planets.length) return {ok: false, why: star.name + ' has no planets: nowhere to put a port.'};
	if (colonyAt(P, star.id)) return {ok: false, why: 'You already hold a claim there.'};
	if (F.majors().some(m => m.star.id == star.id) || T.portFor(star, day)) return {ok: false, why: star.name + ' already has a port.'};
	const c = F.claimAt(p);
	if (c.contested) return {ok: false, why: star.name + ' is contested: no civilian colonies on a front (a forward base, with a commission).'};
	if (c.owner && c.owner != sp.id) return {ok: false, why: star.name + ' is the ' + short(c.owner) + '\'s: claim it through their office.'};
	if (c.owner && (P.rep[sp.id] || 0) < COL.charter) return {ok: false, why: 'A charter in ' + short(sp.id) + ' space needs Friendly standing.'};
	if ((P.rep[sp.id] || 0) < COL.neutral) return {ok: false, why: 'The ' + short(sp.id) + ' won\'t sponsor an Unfriendly pilot.'};
	if (!plan && open(P)) return {ok: false, why: 'You already have a claim in progress at ' + open(P).star.name + '.'};
	if (!plan && held(P) >= budget(P, sp.id)) return {ok: false, why: 'Your standing with the ' + short(sp.id) + ' allows ' + budget(P, sp.id) + (budget(P, sp.id) == 1 ? ' colony' : ' colonies') + '.'};
	const old = list(P).find(x => x.star.id == star.id && x.stage == 'lapsed'), salvage = !!old;
	return {ok: true, fee: Math.round(K.fee * (salvage ? 1 - COL.salvage : 1) * E.rate(sp.currency.code, day)), currency: sp.currency.code, salvage, inside: !!c.owner};
}
/* the checks every claim shares: one jump, not the Core, planets, no port, not yours already */
function common(P, office, star, day, jumpRange) {
	const p = at(star);
	if (dist(p, at(office.star)) > jumpRange) return star.name + ' is more than one jump (' + jumpRange + ' pc) from here.';
	if (G.mRad(p[0], p[1], p[2]) < COL.core) return 'Nothing can be built in the Core.';
	if (!G.system(star).planets.length) return star.name + ' has no planets: nowhere to put a port.';
	if (colonyAt(P, star.id)) return 'You already hold a claim there.';
	if (F.majors().some(m => m.star.id == star.id) || T.portFor(star, day)) return star.name + ' already has a port.';
	return null;
}
const limits = (P, plan, b) => !plan && open(P) ? 'You already have a claim in progress at ' + open(P).star.name + '.' : !plan && held(P) >= b ? 'Your standing allows ' + b + (b == 1 ? ' colony' : ' colonies') + '.' : null;
const salvageFee = (P, star, fee) => { const old = list(P).find(x => x.star.id == star.id && x.stage == 'lapsed'); return {salvage: !!old, fee: fee * (old ? 1 - COL.salvage : 1)} };
/* a forward base: contested space your commissioned side holds, with its supply chain reaching it */
function baseClaim(P, office, star, day, jumpRange, plan) {
	const why = common(P, office, star, day, jumpRange); if (why) return {ok: false, why};
	const sp = F.byId(office.owner), c = F.claimAt(at(star));
	if (!c.contested) return {ok: false, why: 'Forward bases go only on a front, in contested space.'};
	if (P.commission != sp.id) return {ok: false, why: 'A forward base needs a commission with the ' + short(sp.id) + '.'};
	const h = F.contestedHolder(at(star), day, P.warEvents);
	if (h.holder != sp.id) return {ok: false, why: 'The ' + short(sp.id) + ' doesn\'t hold ' + star.name + ' now.'};
	if (!h.supplied) return {ok: false, why: 'The ' + short(sp.id) + '\'s supply chain doesn\'t reach ' + star.name + '.'};
	const lim = limits(P, plan, budget(P, sp.id)); if (lim) return {ok: false, why: lim};
	const f = salvageFee(P, star, PORTS.base.fee);
	return {ok: true, fee: Math.round(f.fee * E.rate(sp.currency.code, day)), currency: sp.currency.code, salvage: f.salvage, war: h.war, key: h.key};
}
/* an independent colony: unclaimed space only; the fee in SU, through free traders */
function indepClaim(P, office, star, kind, day, jumpRange, plan) {
	if (PORTS[kind].base) return {ok: false, why: 'Forward bases are a power\'s.'};
	const why = common(P, office, star, day, jumpRange); if (why) return {ok: false, why};
	const c = claimOf(star);
	if (c.owner || c.contested) return {ok: false, why: 'Independent colonies go only in unclaimed space.'};
	const best = Math.max(...F.majors().map(m => P.rep[m.id] || 0)), lim = limits(P, plan, 1 + Math.floor(Math.max(0, best - COL.charter) / COL.perRep)); if (lim) return {ok: false, why: lim};
	const f = salvageFee(P, star, PORTS[kind].fee);
	return {ok: true, fee: Math.round(f.fee), currency: 'SU', salvage: f.salvage, independent: true};
}
/* candidate systems within one jump of an office: the nearest few that could be claimed (leaving out the limits of
   one open claim and the budget, which the planner reports separately) */
function candidates(P, office, day, jumpRange, n) {
	const p = at(office.star), out = [];
	for (const s of G.starsNear(p[0], p[1], p[2], jumpRange)) {
		if (s.kind != 'star' || s.id == office.star.id) continue;
		if (canClaim(P, office, s, 'outpost', day, jumpRange, true, !!(office.star && office.star.rift)).ok || (P.commission == office.owner && canClaim(P, office, s, 'base', day, jumpRange, true).ok)) out.push(s);
		if (out.length >= (n || 12)) break;
	}
	return out.sort((a, b) => a.d - b.d);
}
/* claim: pay the fee; 2 days to drop the beacon */
function claim(P, office, star, kind, day, jumpRange, independent) {
	const ck = canClaim(P, office, star, kind, day, jumpRange, false, independent); if (!ck.ok) return ck;
	if (ck.currency == 'SU') { const Tr = req('trade.js', 'EmberTrade'), r = Tr.pay(P, ck.fee, 'SU', day); if (!r.ok) return {ok: false, why: 'The fee is ' + ck.fee.toLocaleString('en') + ' SU, through free traders.'} }
	else { if ((P.wallet[ck.currency] || 0) < ck.fee) return {ok: false, why: 'The fee is ' + ck.fee.toLocaleString('en') + ' ' + ck.currency + '.'}; P.wallet[ck.currency] -= ck.fee }
	const old = list(P).find(x => x.star.id == star.id && x.stage == 'lapsed');
	if (old) list(P).splice(list(P).indexOf(old), 1);
	const c = {id: star.id, star: {id: star.id, name: star.name, at: at(star)}, sponsor: ck.independent ? null : office.owner, independent: !!ck.independent, war: ck.war || null, key: ck.key || null, port: kind, world: portWorld(star), stage: 'claimed', claimed: Math.floor(day), beaconBy: Math.floor(day) + COL.claimDays, due: null,
		need: Object.assign({}, PORTS[kind].goods), got: old ? Object.assign({}, old.got) : {}, fee: ck.fee, currency: ck.currency};
	if (c.independent) { c.scrip = scripCode(star); registerScrips(P) }
	list(P).push(c);
	return {ok: true, colony: c};
}
/* the beacon: in the system, near the chosen world, in time */
function beacon(P, c, day) {
	if (c.stage != 'claimed') return {ok: false, why: 'The beacon is already down.'};
	if (day > c.beaconBy + 1) return {ok: false, why: 'The claim has lapsed.'};
	c.stage = 'building'; c.beacon = Math.floor(day); c.due = Math.floor(day) + COL.seasonDays;
	return {ok: true};
}
/* what's still wanted */
const left = c => Object.fromEntries(Object.entries(c.need).map(([g, t]) => [g, Math.max(0, t - (c.got[g] || 0))]).filter(([, t]) => t > 0));
const progress = c => Math.min(1, total(Object.fromEntries(Object.entries(c.need).map(([g, t]) => [g, Math.min(t, c.got[g] || 0)]))) / total(c.need));
/* hand over cargo the build needs; returns {gave: {good: t}} */
function deliver(P, c, day) {
	if (c.stage != 'building') return {gave: {}};
	const want = left(c), gave = {};
	for (const g in want) {
		const n = Math.min(want[g], P.cargo[g] || 0); if (!n) continue;
		P.cargo[g] -= n; if (!P.cargo[g]) { delete P.cargo[g]; delete P.cost[g] }
		c.got[g] = (c.got[g] || 0) + n; gave[g] = n;
	}
	finish(P, c, day);
	return {gave};
}
function finish(P, c, day) {
	if (c.stage == 'building' && !Object.keys(left(c)).length) {
		c.stage = 'done'; c.opens = Math.floor(day) + 1; c.paid = c.opens; c.last = c.opens; c.pop = 0; c.builds = c.builds || [];
		c.points = {t2: PORT_TIER[c.port] == 1 ? 1 : 0, t3: PORT_TIER[c.port] == 2 ? 1 : 0};
		if (c.sponsor) R.act(P, 'mission', c.sponsor, {amount: COL.finishRep / R.ACTIONS.mission.rep}); return true;
	}
	return false;
}
/* haulage: NPC haulers bring goods from this port to a colony site. Quote in the port's coin */
function haulQuote(office, mkt, c, good, tons, day) {
	const q = mkt.prices[good]; if (!q) return null;
	const d = dist(at(office.star), c.star.at), r = G.rng(G.hashStr('haul:' + office.star.id + ':' + good + ':' + Math.floor(day)))();
	const over = COL.haul.over[0] + (COL.haul.over[1] - COL.haul.over[0]) * r + COL.haul.perPc * d;
	const ship = COL.haul.fleet.find(f => f.t >= tons) || COL.haul.fleet[COL.haul.fleet.length - 1];
	const trips = Math.ceil(tons / ship.t), carrier = rented(c, day);
	let days = Math.max(1, Math.ceil(d / ship.jump)) + (trips - 1) * 2, cost = q.price * tons * (1 + over);
	if (carrier) { days = Math.max(1, Math.ceil(days / 2)); cost *= 1 - COL.rent.cut }
	return {good, tons, cost: Math.round(cost), currency: mkt.currency, days, ship: ship.ship, trips, over, carrier: !!carrier};
}
function postHaul(P, office, mkt, c, good, tons, day, jobId) {
	const job = jobId && jobId != 'port' ? (c.builds || []).find(b => b.id == jobId && !b.done) : c.stage == 'building' ? c : null;
	if (!job) return {ok: false, why: c.stage == 'claimed' ? 'Drop the beacon first: haulers deliver to a constructor.' : 'Nothing is being built there.'};
	tons = Math.min(Math.floor(tons), (left(job)[good] || 0) - ((job.coming || {})[good] || 0)); if (tons <= 0) return {ok: false, why: 'The build doesn\'t need more ' + good + '.'};
	const q = haulQuote(office, mkt, c, good, tons, day), code = q.currency;
	if (code == 'SU' || (P.wallet[code] || 0) < q.cost) return {ok: false, why: code == 'SU' ? 'Haulers here want a power\'s coin.' : 'The contract is ' + q.cost.toLocaleString('en') + ' ' + code + '.'};
	P.wallet[code] -= q.cost;
	(P.hauls = P.hauls || []).push({colony: c.id, job: job == c ? 'port' : job.id, good, tons, eta: Math.floor(day) + q.days, ship: q.ship});
	/* counted as promised, so you don't over-order */
	job.coming = job.coming || {}; job.coming[good] = (job.coming[good] || 0) + tons;
	return {ok: true, quote: q};
}
/* the day's turn: haulers arrive, builds finish, claims lapse. Returns news [{text, ok}] */
function turn(P, day) {
	const out = [];
	for (const h of (P.hauls || []).slice()) {
		if (day < h.eta) continue;
		P.hauls.splice(P.hauls.indexOf(h), 1);
		const c = colonyAt(P, h.colony); if (!c) continue;
		if (raided(c, h)) { if (h.job && c.builds) { const j = c.builds.find(b => b.id == h.job) || c; if (j.coming) j.coming[h.good] = Math.max(0, (j.coming[h.good] || 0) - h.tons) } else if (c.coming) c.coming[h.good] = Math.max(0, (c.coming[h.good] || 0) - h.tons);
			out.push({text: 'Pirates raided the haulers bound for ' + c.star.name + ': ' + h.tons.toLocaleString('en') + ' t of ' + h.good + ' lost', ok: false}); continue }
		const job = h.job && h.job != 'port' ? (c.builds || []).find(b => b.id == h.job && !b.done) : c.stage == 'building' ? c : null; if (!job) continue;
		job.got[h.good] = (job.got[h.good] || 0) + h.tons; if (job.coming) job.coming[h.good] = Math.max(0, (job.coming[h.good] || 0) - h.tons);
		out.push({text: 'Haulers delivered ' + h.tons.toLocaleString('en') + ' t of ' + h.good + ' to ' + c.star.name, ok: true});
		if (job == c) { if (finish(P, c, day)) out.push({text: c.star.name + ': the ' + PORTS[c.port].name.toLowerCase() + ' is built. It opens tomorrow.', ok: true}) }
		else if (finishBuild(c, job, day)) out.push({text: c.star.name + ': ' + FAC[job.fac].name + ' at ' + job.body + ' is built', ok: true});
	}
	/* finished colonies: population, and the season's payment */
	for (const c of list(P)) if (c.stage == 'done' && day >= c.opens) out.push(...grow(P, c, day));
	for (const c of list(P)) {
		if (c.stage == 'claimed' && day > c.beaconBy) { c.stage = 'lapsed'; out.push({text: 'Claim on ' + c.star.name + ' lapsed: no beacon in time', ok: false}) }
		else if (c.stage == 'building' && day > c.due) { c.stage = 'lapsed'; out.push({text: 'The season ran out at ' + c.star.name + '. What you delivered stays as salvage.', ok: false}) }
	}
	return out;
}
/* the port at a star, if it's your finished colony and open: like travel.portFor's answer */
function portOf(P, star, day) {
	const c = colonyAt(P, star.id);
	if (!c || c.stage != 'done' || day < c.opens) return null;
	return {id: 'orbital', cls: PORTS[c.port].cls, world: c.world, owner: c.sponsor, capital: false, contested: false, colony: true, independent: !!c.independent, base: !!PORTS[c.port].base};
}

/* ---------------- part 2: building out ---------------- */
const PORT_TIER = {outpost: 1, station: 2, great: 3};
/* the goods mix for a facility (shares of its tonnage) */
const MIX = {base: {Iron: .3, Aluminum: .2, Titanium: .1, Machinery: .15, Electronics: .1, Food: .05, Water: .05, Fuel: .05},
	farm: {Iron: .15, Aluminum: .15, Machinery: .2, Water: .3, Food: .1, Electronics: .1}, military: {Iron: .25, Titanium: .2, Machinery: .15, Electronics: .15, Munitions: .25},
	research: {Aluminum: .2, Titanium: .1, Electronics: .4, Machinery: .15, Medicine: .15}, habitat: {Iron: .2, Aluminum: .2, Food: .2, Water: .2, Medicine: .1, Machinery: .1}};
/* the catalogue: where (orbit, surface, either), tier, tonnes, economy, and what else it gives */
const FAC = {
	mining: {name: 'Mining installation', where: 'either', tier: 1, t: 600, econ: 'extraction'},
	refinery: {name: 'Refinery', where: 'orbit', tier: 1, t: 900, econ: 'refinery', needs: b => b.gas || !!b.ring, needsText: 'a gas giant or a ringed world'},
	farm: {name: 'Agriculture', where: 'either', tier: 1, t: 700, econ: 'agriculture', mix: 'farm', needs: (b, w) => w == 'orbit' || b.atmo, needsText: 'air, on the surface'},
	habitat: {name: 'Habitat ring', where: 'orbit', tier: 1, t: 1000, pop: 50000, mix: 'habitat'},
	tourist: {name: 'Tourist installation', where: 'either', tier: 1, t: 800, econ: 'tourism', wealth: 0.1},
	relay: {name: 'Relay beacon', where: 'orbit', tier: 1, t: 400, tech: 0.02},
	smugglers: {name: 'Smugglers\' den', where: 'surface', tier: 1, t: 600, econ: 'contraband', security: -0.2},
	industrial: {name: 'Industrial yard', where: 'orbit', tier: 2, t: 2500, econ: 'industrial', wealth: 0.05},
	research: {name: 'Research station', where: 'either', tier: 2, t: 2000, econ: 'hightech', mix: 'research', tech: 0.15},
	military: {name: 'Military outpost', where: 'orbit', tier: 2, t: 2500, econ: 'military', mix: 'military', security: 0.25},
	settlement: {name: 'Settlement', where: 'surface', tier: 2, t: 3000, pop: 200000, mix: 'habitat'},
	sport: {name: 'Surface port', where: 'surface', tier: 2, t: 6000, pop: 100000, port: true},
	station: {name: 'Station', where: 'orbit', tier: 2, t: 8000, pop: 100000, port: true},
	city: {name: 'Surface city', where: 'surface', tier: 3, t: 20000, pop: 500000, port: true, wealth: 0.1},
	great: {name: 'Great port', where: 'orbit', tier: 3, t: 25000, pop: 500000, port: true, tech: 0.1}};
/* the goods for a facility: its mix times its tonnage; surface builds on worlds over 1.5 g cost 25% more */
function facGoods(fac, body, where) {
	const F0 = FAC[fac], mix = MIX[F0.mix || 'base'], k = where == 'surface' && body.g > 1.5 ? 1.25 : 1, out = {};
	let sum = 0; for (const g in mix) { out[g] = Math.round(F0.t * mix[g] * k); sum += out[g] }
	return out;
}
/* slots per body */
function slots(star) {
	return G.system(star).planets.map(p => {
		const orbit = p.gas ? Math.min(4, 2 + (p.ring ? 1 : 0) + Math.floor(p.R / 6)) : 1 + Math.floor(p.R / 2) + (p.ring ? 1 : 0);
		const surface = p.gas || p.g >= 2.5 ? 0 : (p.R < 0.8 ? 1 : p.R < 1.5 ? 2 : 3) + (p.atmo && p.water ? 1 : 0);
		return {body: p.name, type: p.type, orbit, surface, p};
	});
}
/* what's taken: the primary port (an orbital slot at its world) and the builds */
function used(c, body, where) { return (where == 'orbit' && body == c.world ? 1 : 0) + (c.builds || []).filter(b => b.body == body && b.where == where).length }
const t3cost = c => 4 + 2 * (c.builds || []).filter(b => FAC[b.fac].tier == 3).length;
const cost = (c, fac) => FAC[fac].tier == 2 ? {t2: 1} : FAC[fac].tier == 3 ? {t3: t3cost(c)} : {};
/* can this facility go there? {ok, why, goods, cost} */
function canBuild(c, star, fac, body, where) {
	const F0 = FAC[fac]; if (!F0) return {ok: false, why: 'No such facility.'};
	if (c.stage != 'done') return {ok: false, why: 'Finish the primary port first.'};
	if (F0.where != 'either' && F0.where != where) return {ok: false, why: F0.name + ' goes ' + (F0.where == 'orbit' ? 'in orbit' : 'on the surface') + '.'};
	const sl = slots(star).find(x => x.body == body); if (!sl) return {ok: false, why: 'No such body.'};
	if (used(c, body, where) >= sl[where]) return {ok: false, why: sl[where] ? 'Every ' + where + ' slot at ' + body + ' is taken.' : body + ' has no ' + (where == 'orbit' ? 'orbital' : 'surface') + ' slots.'};
	if (F0.needs && !F0.needs(sl.p, where)) return {ok: false, why: F0.name + ' needs ' + F0.needsText + '.'};
	const k = cost(c, fac), pts = c.points || {t2: 0, t3: 0};
	if ((k.t2 || 0) > pts.t2) return {ok: false, why: 'Needs a tier 2 point: build a tier 1 facility first.'};
	if ((k.t3 || 0) > pts.t3) return {ok: false, why: 'Needs ' + k.t3 + ' tier 3 points (you have ' + pts.t3 + ').'};
	return {ok: true, goods: facGoods(fac, sl.p, where), cost: k};
}
function startBuild(c, star, fac, body, where, day) {
	const ck = canBuild(c, star, fac, body, where); if (!ck.ok) return ck;
	c.points.t2 -= ck.cost.t2 || 0; c.points.t3 -= ck.cost.t3 || 0;
	const b = {id: 'b' + (c.builds.length + 1) + '-' + fac, fac, body, where, need: ck.goods, got: {}, done: false, started: Math.floor(day)};
	c.builds.push(b);
	return {ok: true, build: b};
}
function finishBuild(c, b, day) {
	if (b.done || Object.keys(left(b)).length) return false;
	b.done = true; b.finished = Math.floor(day);
	const tier = FAC[b.fac].tier; if (tier == 1) c.points.t2 += 1; else if (tier == 2) c.points.t3 += 1;
	return true;
}
/* hand over goods to the colony's builds, in order (docked at its own port) */
function deliverBuilds(P, c, day) {
	const gave = {}, done = [];
	for (const b of (c.builds || []).filter(x => !x.done)) {
		for (const [g, t] of Object.entries(left(b))) {
			const n = Math.min(t, P.cargo[g] || 0); if (!n) continue;
			P.cargo[g] -= n; if (!P.cargo[g]) { delete P.cargo[g]; delete P.cost[g] }
			b.got[g] = (b.got[g] || 0) + n; gave[g] = (gave[g] || 0) + n;
		}
		if (finishBuild(c, b, day)) done.push(b);
	}
	return {gave, done};
}
/* ---- links and the economy ---- */
const ECONS = ['extraction', 'refinery', 'agriculture', 'industrial', 'hightech', 'military', 'tourism', 'contraband'];
function boost(econ, p, star) {
	let k = 1;
	if (p.ring && (econ == 'refinery' || econ == 'extraction')) k *= 1.3;
	if (p.alive) k *= econ == 'agriculture' || econ == 'tourism' ? 1.4 : econ == 'industrial' ? 0.8 : 1;
	if (p.water && econ == 'agriculture') k *= 1.2;
	if (p.ruins && econ == 'hightech') k *= 1.5;
	if ((star.FeH || 0) > 0.1 && econ == 'extraction') k *= 1.2;
	if (/dwarf|neutron/.test(star.kind || '')) k *= econ == 'hightech' ? 1.2 : econ == 'agriculture' ? 0.6 : 1;
	return k;
}
/* the port's economy: strong links from its own world, weak (5%) from elsewhere; shares that add to 1 (or {} with
   nothing built) */
function economy(c, star) {
	const by = {}, bodies = Object.fromEntries(G.system(star).planets.map(p => [p.name, p]));
	for (const b of (c.builds || []).filter(x => x.done)) {
		const e = FAC[b.fac].econ; if (!e) continue;
		by[e] = (by[e] || 0) + (b.body == c.world ? 1 : 0.05) * boost(e, bodies[b.body] || {}, star);
	}
	const sum = Object.values(by).reduce((t, v) => t + v, 0);
	return sum ? Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v / sum])) : {};
}
/* population cap: the best world, the habitats and ports */
function popCap(c, star) {
	const best = G.system(star).planets.reduce((m, p) => Math.max(m, p.alive ? 5e6 : p.atmo && p.esi >= 0.8 ? 1e6 : p.atmo ? 2e5 : 2e4), 0);
	const extra = (c.builds || []).filter(b => b.done).reduce((t, b) => t + (FAC[b.fac].pop || 0), 0);
	return best + extra + ({outpost: 0, station: 100000, great: 500000, base: 5000}[c.port] || 0);
}
/* ---- part 3 helpers ---- */
/* haulers raided on the way: by the space the colony is in; none past a military outpost there */
function raided(c, h) {
	if ((c.builds || []).some(b => b.done && b.fac == 'military') || PORTS[c.port].base) return false;
	const cl = claimOf(c.star), p = cl.owner ? COL.raid.claimed : COL.raid.unclaimed;
	return G.rng(G.hashStr('raid:' + c.id + ':' + h.good + ':' + h.eta + ':' + h.tons))() < p;
}
/* a colony's scrip: a code from its star, and a rate pegged to the SU at first, floating with its wealth */
function scripCode(star) { const h = G.hashStr('scrip:' + star.id), A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; return 'X' + A[h % 24] + A[Math.floor(h / 24) % 24] }
function scripRate(c, star) {
	return day => { const st = stats(c, star), r = G.rng(G.hashStr('scripfx:' + c.id)); let L = (0.5 - st.wealth) * COL.scrip.drift;
		for (let k = 0; k < 2; k++) { const Pd = 120 + r() * 240, A = 0.02 + r() * 0.04, ph = r() * 6.283; L += A * Math.sin(6.283 * (day - (c.opens || 0)) / Pd + ph) }
		return Math.exp(L) };
}
/* tell the economy about the player's colonies' scrips (on load, and when one is claimed) */
function registerScrips(P) { for (const c of list(P)) if (c.independent && c.scrip) { const s = starOf(c); if (s) E.registerScrip(c.scrip, scripRate(c, s)) } }
/* carriers: the small factions' fleet carriers that will rent to you (not against you, not on the move) */
function carriers(P, day) {
	return F.minors().filter(m => m.carrier && m.carrier.class == 'fleet carrier' && (P.rep[m.id] || 0) >= 0 && !F.whereIs(m, day).moving).map(m => ({id: m.id, name: m.carrier.name, faction: m.name, hold: m.carrier.hangar}));
}
const rented = (c, day) => c.carrier && day <= c.carrier.until ? c.carrier : null;
function rent(P, c, minorId, day, currency) {
	if (c.stage != 'building' && !(c.builds || []).some(b => !b.done)) return {ok: false, why: 'Rent a carrier while something is being built.'};
	if (rented(c, day)) return {ok: false, why: 'A carrier is already there until day ' + c.carrier.until + '.'};
	const m = carriers(P, day).find(x => x.id == minorId); if (!m) return {ok: false, why: 'That carrier isn\'t for hire.'};
	const code = currency || 'SU', fee = Math.round(COL.rent.fee * (code == 'SU' ? 1 : E.rate(code, day)));
	const Tr = req('trade.js', 'EmberTrade'), r = Tr.pay(P, fee, code, day); if (!r.ok) return {ok: false, why: 'The season\'s rent is ' + fee.toLocaleString('en') + ' ' + code + '.'};
	c.carrier = {id: m.id, name: m.name, until: Math.floor(day) + COL.seasonDays};
	return {ok: true, carrier: c.carrier, fee, code};
}
function stats(c, star) {
	const done = (c.builds || []).filter(b => b.done).map(b => FAC[b.fac]), add = k => done.reduce((t, f) => t + (f[k] || 0), 0), cl = v => Math.max(0, Math.min(1, v));
	return {security: cl(0.35 + add('security') + 0.1 * ((PORT_TIER[c.port] || 1) - 1) + (c.independent ? COL.indep.security : 0) + (PORTS[c.port].base ? 0.25 : 0)), wealth: cl(0.3 + add('wealth') + 0.02 * done.length), tech: cl(0.3 + add('tech') + 0.1 * (PORT_TIER[c.port] - 1)),
		cap: popCap(c, star), econ: economy(c, star), facilities: done.length};
}
/* a season's trade, in SU, and the architect's share (5-10% by wealth) */
function payment(c, star) { const st = stats(c, star), trade = (c.pop || 0) * 2 + 5000 * (1 + st.facilities), sh = c.independent ? COL.indep.share : [0.05, 0.10]; return Math.round(trade * (sh[0] + (sh[1] - sh[0]) * st.wealth)) }
/* the days since the last turn: population grows towards its cap (about 30% of the gap a season); each full season
   since opening pays the architect */
function grow(P, c, day) {
	const out = [], star = starOf(c); if (!star) return out;
	const days = Math.max(0, Math.floor(day) - (c.last == null ? c.opens : c.last)); c.last = Math.floor(day);
	if (days) { const cap = popCap(c, star); c.pop = Math.round(cap - (cap - (c.pop || 0)) * Math.pow(0.7, days / COL.seasonDays)) }
	while (day - c.paid >= COL.seasonDays && c.stage == 'done') {
		c.paid += COL.seasonDays;
		const st = stats(c, star);
		/* a forward base: its side's war effort while it holds; lost if the enemy takes the system */
		if (PORTS[c.port].base) {
			const h = F.contestedHolder(c.star.at, c.paid, P.warEvents);
			if (h.holder && h.holder != c.sponsor) { c.stage = 'lost'; out.push({text: 'The ' + short(h.holder) + ' has taken ' + c.star.name + ': your forward base is lost', ok: false}); break }
			if (h.holder == c.sponsor && c.war) { P.warEvents.push({war: c.war, system: c.key || h.key, side: c.sponsor, effort: COL.baseEffort * (h.supplied ? 1.1 : 1), day: c.paid}); out.push({text: 'Your forward base at ' + c.star.name + ' holds the line', ok: true}) }
		}
		/* an independent colony: no protection; low security two seasons running and a syndicate takes over */
		if (c.independent) {
			c.low = st.security < 0.3 ? (c.low || 0) + 1 : 0;
			if (c.low >= COL.takeover) { c.stage = 'lost'; out.push({text: 'A syndicate has taken over ' + c.star.name + '. The colony is lost.', ok: false}); break }
			if (c.low) out.push({text: c.star.name + '\'s security is low: build a military outpost or a bigger port, or a syndicate will move in', ok: false});
		}
		const su = payment(c, star), code = c.independent ? c.scrip : F.byId(c.sponsor).currency.code, amount = su * E.rate(code, c.paid);
		P.wallet[code] = (P.wallet[code] || 0) + amount;
		out.push({text: c.star.name + ' pays its architect: ' + Math.round(amount).toLocaleString('en') + ' ' + code + ' for the season', ok: true});
	}
	return out;
}
const STARS = new Map();
function starOf(c) {
	if (STARS.has(c.id)) return STARS.get(c.id);
	const p = c.star.at, s = G.starsNear(p[0], p[1], p[2], 0.05).find(x => x.id == c.id) || T.starAt(c.id, p);
	STARS.set(c.id, s); return s;
}

const EmberColonies = {raided, scripCode, registerScrips, carriers, rent, rented, FAC, MIX, ECONS, slots, used, canBuild, startBuild, deliverBuilds, finishBuild, economy, boost, popCap, stats, payment, grow, facGoods, t3cost, PORT_TIER, starOf,PORTS, COL, portWorld, budget, colonyAt, canClaim, candidates, claim, beacon, left, progress, deliver, haulQuote, postHaul, turn, portOf, open};
if (isNode) module.exports = EmberColonies; else root.EmberColonies = EmberColonies;
})(typeof window != 'undefined' ? window : this);
