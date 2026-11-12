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
	great: {name: 'Great port', cls: 'halo', fee: 750000, goods: {Iron: 6000, Aluminum: 5000, Titanium: 3000, Machinery: 4000, Electronics: 2500, Food: 2000, Water: 1800, Fuel: 700}}};
const COL = {claimDays: 2, seasonDays: 30, salvage: 1 / 3, core: 30, beaconRadii: 30, deliverRange: 3000, charter: 100, neutral: -100, perRep: 100, finishRep: 150,
	haul: {over: [0.10, 0.25], perPc: 0.004, fleet: [{ship: 'Drover', t: 600, jump: 5}, {ship: 'Caravel', t: 3000, jump: 6}, {ship: 'Leviathan', t: 30000, jump: 6}]}};
const at = s => s.at || [s.x, s.y, s.z];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const total = o => Object.values(o).reduce((t, v) => t + v, 0);
const list = P => (P.colonies = P.colonies || []);
const short = id => F.byId(id).name.replace(/^The /, '');

/* the world a primary port orbits: the most Earth-like, or the biggest */
function portWorld(star) { const pl = G.system(star).planets.slice().sort((a, b) => b.esi - a.esi || b.R - a.R); return pl[0] ? pl[0].name : null }
const open = P => list(P).find(c => c.stage == 'claimed' || c.stage == 'building');
const budget = (P, sponsor) => 1 + Math.floor(Math.max(0, (P.rep[sponsor] || 0) - COL.charter) / COL.perRep);
const held = P => list(P).filter(c => c.stage != 'lapsed').length;
const colonyAt = (P, starId) => list(P).find(c => c.star.id == starId && c.stage != 'lapsed') || null;

/* can this office's sponsor claim this system for you? {ok, why, fee (sponsor's coin), salvage} */
function canClaim(P, office, star, kind, day, jumpRange, plan) {
	const sp = F.byId(office.owner), K = PORTS[kind];
	if (!sp || sp.kind != 'major') return {ok: false, why: 'Only a great power\'s colonial office sponsors claims (free ports come later).'};
	if (!K) return {ok: false, why: 'No such port.'};
	const p = at(star);
	if (dist(p, at(office.star)) > jumpRange) return {ok: false, why: star.name + ' is more than one jump (' + jumpRange + ' pc) from here.'};
	if (G.mRad(p[0], p[1], p[2]) < COL.core) return {ok: false, why: 'Nothing can be built in the Core.'};
	if (!G.system(star).planets.length) return {ok: false, why: star.name + ' has no planets: nowhere to put a port.'};
	if (colonyAt(P, star.id)) return {ok: false, why: 'You already hold a claim there.'};
	if (F.majors().some(m => m.star.id == star.id) || T.portFor(star, day)) return {ok: false, why: star.name + ' already has a port.'};
	const c = F.claimAt(p);
	if (c.contested) return {ok: false, why: star.name + ' is contested: no civilian colonies on a front.'};
	if (c.owner && c.owner != sp.id) return {ok: false, why: star.name + ' is the ' + short(c.owner) + '\'s: claim it through their office.'};
	if (c.owner && (P.rep[sp.id] || 0) < COL.charter) return {ok: false, why: 'A charter in ' + short(sp.id) + ' space needs Friendly standing.'};
	if ((P.rep[sp.id] || 0) < COL.neutral) return {ok: false, why: 'The ' + short(sp.id) + ' won\'t sponsor an Unfriendly pilot.'};
	if (!plan && open(P)) return {ok: false, why: 'You already have a claim in progress at ' + open(P).star.name + '.'};
	if (!plan && held(P) >= budget(P, sp.id)) return {ok: false, why: 'Your standing with the ' + short(sp.id) + ' allows ' + budget(P, sp.id) + (budget(P, sp.id) == 1 ? ' colony' : ' colonies') + '.'};
	const old = list(P).find(x => x.star.id == star.id && x.stage == 'lapsed'), salvage = !!old;
	return {ok: true, fee: Math.round(K.fee * (salvage ? 1 - COL.salvage : 1) * E.rate(sp.currency.code, day)), currency: sp.currency.code, salvage, inside: !!c.owner};
}
/* candidate systems within one jump of an office: the nearest few that could be claimed (leaving out the limits of
   one open claim and the budget, which the planner reports separately) */
function candidates(P, office, day, jumpRange, n) {
	const p = at(office.star), out = [];
	for (const s of G.starsNear(p[0], p[1], p[2], jumpRange)) {
		if (s.kind != 'star' || s.id == office.star.id) continue;
		if (canClaim(P, office, s, 'outpost', day, jumpRange, true).ok) out.push(s);
		if (out.length >= (n || 12)) break;
	}
	return out.sort((a, b) => a.d - b.d);
}
/* claim: pay the fee; 2 days to drop the beacon */
function claim(P, office, star, kind, day, jumpRange) {
	const ck = canClaim(P, office, star, kind, day, jumpRange); if (!ck.ok) return ck;
	if ((P.wallet[ck.currency] || 0) < ck.fee) return {ok: false, why: 'The fee is ' + ck.fee.toLocaleString('en') + ' ' + ck.currency + '.'};
	P.wallet[ck.currency] -= ck.fee;
	const old = list(P).find(x => x.star.id == star.id && x.stage == 'lapsed');
	if (old) list(P).splice(list(P).indexOf(old), 1);
	const c = {id: star.id, star: {id: star.id, name: star.name, at: at(star)}, sponsor: office.owner, port: kind, world: portWorld(star), stage: 'claimed', claimed: Math.floor(day), beaconBy: Math.floor(day) + COL.claimDays, due: null,
		need: Object.assign({}, PORTS[kind].goods), got: old ? Object.assign({}, old.got) : {}, fee: ck.fee, currency: ck.currency};
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
	if (c.stage == 'building' && !Object.keys(left(c)).length) { c.stage = 'done'; c.opens = Math.floor(day) + 1; R.act(P, 'mission', c.sponsor, {amount: COL.finishRep / R.ACTIONS.mission.rep}); return true }
	return false;
}
/* haulage: NPC haulers bring goods from this port to a colony site. Quote in the port's coin */
function haulQuote(office, mkt, c, good, tons, day) {
	const q = mkt.prices[good]; if (!q) return null;
	const d = dist(at(office.star), c.star.at), r = G.rng(G.hashStr('haul:' + office.star.id + ':' + good + ':' + Math.floor(day)))();
	const over = COL.haul.over[0] + (COL.haul.over[1] - COL.haul.over[0]) * r + COL.haul.perPc * d;
	const ship = COL.haul.fleet.find(f => f.t >= tons) || COL.haul.fleet[COL.haul.fleet.length - 1];
	const trips = Math.ceil(tons / ship.t), days = Math.max(1, Math.ceil(d / ship.jump)) + (trips - 1) * 2;
	return {good, tons, cost: Math.round(q.price * tons * (1 + over)), currency: mkt.currency, days, ship: ship.ship, trips, over};
}
function postHaul(P, office, mkt, c, good, tons, day) {
	if (c.stage != 'building') return {ok: false, why: 'Drop the beacon first: haulers deliver to a constructor.'};
	tons = Math.min(Math.floor(tons), (left(c)[good] || 0) - ((c.coming || {})[good] || 0)); if (tons <= 0) return {ok: false, why: 'The build doesn\'t need more ' + good + '.'};
	const q = haulQuote(office, mkt, c, good, tons, day), code = q.currency;
	if (code == 'SU' || (P.wallet[code] || 0) < q.cost) return {ok: false, why: code == 'SU' ? 'Haulers here want a power\'s coin.' : 'The contract is ' + q.cost.toLocaleString('en') + ' ' + code + '.'};
	P.wallet[code] -= q.cost;
	(P.hauls = P.hauls || []).push({colony: c.id, good, tons, eta: Math.floor(day) + q.days, ship: q.ship});
	/* counted as promised, so you don't over-order */
	c.coming = c.coming || {}; c.coming[good] = (c.coming[good] || 0) + tons;
	return {ok: true, quote: q};
}
/* the day's turn: haulers arrive, builds finish, claims lapse. Returns news [{text, ok}] */
function turn(P, day) {
	const out = [];
	for (const h of (P.hauls || []).slice()) {
		if (day < h.eta) continue;
		P.hauls.splice(P.hauls.indexOf(h), 1);
		const c = colonyAt(P, h.colony); if (!c || c.stage != 'building') continue;
		c.got[h.good] = (c.got[h.good] || 0) + h.tons; if (c.coming) c.coming[h.good] = Math.max(0, (c.coming[h.good] || 0) - h.tons);
		out.push({text: 'Haulers delivered ' + h.tons.toLocaleString('en') + ' t of ' + h.good + ' to ' + c.star.name, ok: true});
		if (finish(P, c, day)) out.push({text: c.star.name + ': the ' + PORTS[c.port].name.toLowerCase() + ' is built. It opens tomorrow.', ok: true});
	}
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
	return {cls: PORTS[c.port].cls, world: c.world, owner: c.sponsor, capital: false, contested: false, colony: true};
}

const EmberColonies = {PORTS, COL, portWorld, budget, colonyAt, canClaim, candidates, claim, beacon, left, progress, deliver, haulQuote, postHaul, turn, portOf, open};
if (isNode) module.exports = EmberColonies; else root.EmberColonies = EmberColonies;
})(typeof window != 'undefined' ? window : this);
