/* ===== Ember Reach: where a player stands (docs/plan-ember-reach.md, "Reputation and alignment").
   - Origin: a new player picks a great power to come from. They start at its home world, with its currency, a ship
     of its species' build, and standing that follows their people's friendships and feuds.
   - Reputation: one number per faction, -1000 to 1000, in five steps (Hostile, Unfriendly, Neutral, Friendly,
     Allied). What a player does to a faction changes it; the news spreads: that faction's allies feel it the same
     way, its enemies the other way, and small factions by their own stance.
   - Alignment: where reputation says a player's loyalties lie: the great power they lean to most, how far, and a
     second axis from lawful to outlaw (bounties earned against crimes committed).
   - War: a player Friendly with a great power may take a commission with it; their war effort then counts double for
     that side, and its enemies treat them as a combatant.
   - Standing drifts slowly back towards where the player started (5% of the gap a season), so old deeds fade.
   - Crimes in a power's space earn a bounty in its currency.
   The state is plain data, kept in the save. GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const F = isNode ? require('./factions.js') : root.EmberFactions, E = isNode ? require('./economy.js') : root.EmberEconomy;
const TIERS = [[-1000, 'Hostile'], [-500, 'Unfriendly'], [-100, 'Neutral'], [100, 'Friendly'], [500, 'Allied']];
const tier = v => TIERS.filter(([lo]) => v >= lo).pop()[1];
const clamp = v => Math.max(-1000, Math.min(1000, v));

/* what actions do, to the faction they are aimed at (+ helps it, - harms it) */
const ACTIONS = {
	trade: {rep: 2, lawful: 0},              /* buying or selling at its stations (per 1,000 SU) */
	mission: {rep: 30, lawful: 1},           /* a mission done for it */
	missionFailed: {rep: -20, lawful: 0},
	warMission: {rep: 45, lawful: 1},        /* a war mission for it (the other side feels it as harm) */
	killPirate: {rep: 8, lawful: 2},         /* destroying a criminal ship in its space */
	killShip: {rep: -60, lawful: -3},        /* destroying one of its ships */
	killShipAtWar: {rep: -25, lawful: 0},    /* the same, in a contested system, for a side at war with it */
	smuggle: {rep: -15, lawful: -2},
	raidConvoy: {rep: -40, lawful: -4},
	scanRuins: {rep: 10, lawful: 0},         /* surveys sold to it */
	rescue: {rep: 25, lawful: 1}};

/* a new player, from the great power they choose */
function newPlayer(originId, opts) {
	const o = F.byId(originId);
	if (!o || o.kind != 'major') throw new Error('choose one of the great powers');
	const rep = {};
	for (const m of F.majors()) rep[m.id] = m.id == o.id ? 350 : F.relation(o.id, m.id) > 0 ? 150 : F.relation(o.id, m.id) < 0 ? -150 : 0;
	for (const m of F.minors()) rep[m.id] = m.type == 'criminal' ? (m.sponsor == o.id ? 0 : -200) : (m.parent == o.id ? 100 : 0);
	return {v: 1, origin: o.id, species: o.species.name, start: Object.assign({}, rep), rep, lawful: 0, bounties: {}, commission: null, effort: {}, day: 0,
		wallet: {[o.currency.code]: (opts && opts.credits) || 5000}, at: {star: o.star.id, home: o.home.name},
		ship: {build: o.species.build, sensors: o.species.sight}};
}
/* the news spreads: allies of the target feel it the same way (40%), enemies the other way (40%), small factions
   by their stance towards the target (25%); a commission makes harm to its enemies count for it (and against you) */
function act(P, kind, targetId, opt) {
	const A = ACTIONS[kind]; if (!A) throw new Error('no such action: ' + kind);
	const mult = (opt && opt.amount) || 1, d = A.rep * mult, out = {};
	const bump = (id, v) => { if (!v) return; P.rep[id] = clamp((P.rep[id] || 0) + v); out[id] = (out[id] || 0) + v };
	bump(targetId, d);
	const t = F.byId(targetId);
	for (const m of F.majors()) if (m.id != targetId) { const r = F.relation(targetId, m.id); if (r) bump(m.id, d * 0.4 * r) }
	for (const m of F.minors()) if (m.id != targetId) { const r = t && t.kind == 'major' ? (m.stance[targetId] || 0) : F.relation(m.id, targetId); if (r) bump(m.id, d * 0.25 * r) }
	/* criminals like crimes; the law does not */
	P.lawful = Math.max(-100, Math.min(100, P.lawful + A.lawful * mult));
	if (A.lawful < 0) for (const m of F.minors()) if (m.type == 'criminal') bump(m.id, -A.lawful * 3 * mult);
	/* a bounty, in the currency of whoever's space it happened in */
	if (A.lawful < 0 && opt && opt.where) {
		const holder = F.claimAt(opt.where).owner, h = holder && F.byId(holder);
		if (h) P.bounties[h.currency.code] = (P.bounties[h.currency.code] || 0) + Math.round(-A.lawful * 250 * mult * E.rate(h.currency.code, P.day));
	}
	return out;
}
/* a war mission done (or a kill in a contested system): reputation, and war effort on that front */
function warEffort(P, mission) {
	const sideA = F.wars().find(w => w.id == mission.war), double = P.commission == mission.issuer ? 2 : 1;
	P.effort[mission.system] = (P.effort[mission.system] || 0) + mission.effort * double;
	const out = act(P, 'warMission', mission.issuer);
	/* the other side takes it as harm, on top of the spread */
	P.rep[mission.against] = clamp(P.rep[mission.against] - ACTIONS.warMission.rep * (P.commission == mission.issuer ? 1.5 : 1));
	if (P.wallet) P.wallet[mission.currency] = (P.wallet[mission.currency] || 0) + mission.reward;
	return {rep: out, war: sideA && sideA.id, effort: P.effort[mission.system]};
}
/* a commission: Friendly or better, and not already enlisted with one of its enemies */
function enlist(P, powerId) {
	const p = F.byId(powerId);
	if (!p || p.kind != 'major') return {ok: false, why: 'Only the great powers commission pilots.'};
	if (P.commission && F.relation(P.commission, powerId) < 0) return {ok: false, why: 'You already hold a commission with its enemy.'};
	if (P.rep[powerId] < 100) return {ok: false, why: 'The ' + p.name.replace(/^The /, '') + ' will commission only pilots it counts as Friendly.'};
	P.commission = powerId;
	return {ok: true};
}
/* standing drifts back towards the start: 5% of the gap per season */
function age(P, days) {
	const k = 1 - Math.pow(0.95, days / F.SEASON_DAYS);
	for (const id in P.rep) P.rep[id] = clamp(P.rep[id] + (P.start[id] - P.rep[id]) * k);
	P.day += days;
}
/* where a player's loyalties lie */
function alignment(P) {
	const M = F.majors().map(m => ({id: m.id, name: m.name, rep: P.rep[m.id], tier: tier(P.rep[m.id])})).sort((a, b) => b.rep - a.rep);
	const pos = M.filter(m => m.rep > 0), total = pos.reduce((t, m) => t + m.rep, 0);
	const lean = pos.length ? {id: pos[0].id, name: pos[0].name, share: pos[0].rep / total} : null;
	return {lean, majors: M, lawful: P.lawful, axis: P.lawful > 40 ? 'lawful' : P.lawful < -40 ? 'outlaw' : 'grey', commission: P.commission,
		minors: F.minors().map(m => ({id: m.id, name: m.name, rep: P.rep[m.id], tier: tier(P.rep[m.id])}))};
}
/* will a faction's ships shoot? */
function hostile(P, factionId) { return P.rep[factionId] <= -500 || (P.commission && F.relation(P.commission, factionId) < 0) }

const EmberReputation = {TIERS, tier, ACTIONS, newPlayer, act, warEffort, enlist, age, alignment, hostile};
if (isNode) module.exports = EmberReputation; else root.EmberReputation = EmberReputation;
})(typeof window != 'undefined' ? window : this);
