/* ===== Ember Reach: raids on surface ports (docs/plan-ember-reach-landing-work.md L3.6; 0.6.6) =====
   Pirates raid surface ports, colonies' and others'. Coming within 20 km of a surface port (flying in from farther: not
   launching from it), now and then you find a raid under way: a gang's ships over the port, fighting whatever is there (its traffic, a forward base's turrets,
   you). Whether a port is raided on a day is decided by the day and the port (the same for everyone, and once a day):
   - an independent port (no holder) is raided most, a held one less, a capital system's or a great port's least; a
     forward base, with its turrets, a little more than a held port (it's on a front); a colony's by its security.
   - The raiders: two at a camp or an outpost, three at a settlement, a base or a heavy landing field, four at a
     surface starport.
   - Driven off with your help (a raider destroyed by you or your wing), the port's holder thanks you: a defence reward
     (its currency, by the raiders' number) and standing with it, on top of each raider's bounty. Driven off by the
     port alone (its turrets, its traffic), no reward.
   - Not driven off in three minutes, or left to it (you more than 25 km away), the raiders loot the port: some of its
     stock of two goods taken (its market short of them, prices up) and they leave.
   - While a raid is on, the port gives no landing clearance.
   The flight screen (play.js) places the raiders and keeps the raid; this file decides. */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy');

const RAID = {near: 20000, keep: 25000, last: 180, alt: [1200, 2600], spread: 900,
	odds: {independent: 0.2, held: 0.08, capital: 0.04, base: 0.12, colony: [0.05, 0.3]},
	ships: {camp: 2, outpost: 2, settlement: 3, base: 3, field: 3, starport: 4},
	pay: 1500, loot: {share: [0.15, 0.35], min: 5, goods: 2}};

/* the chance a surface port is raided on a day. ctx: {capital (the system is a great power's capital), security (a
   colony's, 0..1)} */
function odds(q, ctx) {
	ctx = ctx || {};
	if (q.colony) { const sec = Math.max(0, Math.min(1, ctx.security == null ? 0.35 : ctx.security)); return Math.max(RAID.odds.colony[0], RAID.odds.colony[1] * (1 - sec)) }
	if (q.kind == 'base') return RAID.odds.base;
	if (ctx.capital || q.kind == 'starport' || q.kind == 'field') return RAID.odds.capital;
	return q.owner ? RAID.odds.held : RAID.odds.independent;
}
/* is a port raided today? (the same answer all day, for everyone) */
const roll = (starId, q, day, salt) => G.rng(G.hashStr('raid:' + starId + ':' + q.id + ':' + Math.floor(day) + (salt || '')))();
function under(starId, q, day, ctx) { return roll(starId, q, day) < odds(q, ctx) }
/* how many raiders */
function size(q) { return RAID.ships[q.kind] || 2 }
/* what they carry off: [{good, tons}], from a market's prices (economy.js market): the goods it has most of */
function loot(mkt, starId, q, day) {
	const have = Object.entries((mkt && mkt.prices) || {}).filter(([, p]) => p.stock >= RAID.loot.min).sort((a, b) => b[1].stock - a[1].stock).slice(0, RAID.loot.goods);
	const r = roll(starId, q, day, ':loot'), sh = RAID.loot.share[0] + (RAID.loot.share[1] - RAID.loot.share[0]) * r;
	return have.map(([good, p]) => ({good, tons: Math.max(1, Math.floor(p.stock * sh))}));
}
/* the defence reward (before the pilot's multiplier), in SU: by the raiders' number */
function reward(n) { return RAID.pay * Math.max(1, n) }

const EmberRaids = {RAID, odds, under, size, loot, reward};
if (isNode) module.exports = EmberRaids; else root.EmberRaids = EmberRaids;
})(typeof window != 'undefined' ? window : globalThis);
