/* ===== Ember Reach: artifacts, the finds of the ruins (L4.3; docs/plan-ember-reach-sites.md) =====
   A ruin's vault always holds a find, and one structure in six does. A find is an item, not tonnes: kept with the
   ship's records as blueprints are (P.artifacts, at most 64), named from its site by the game's name generator ("the
   Htevak tablet"), the same in every save.
   - Star chart (35 in 95): read where it's found, it marks the one to three nearest ruins within 30 pc you haven't
     surveyed (their sites found: navigation targets once you're there, on the map's card).
   - Inscription (30): sells to cartographers with your data (3,000-9,000 SU), or is returned to the power whose
     space holds its ruin (at one of its ports' artifact brokers) for standing with it (+20).
   - Device (20): an artifact broker studies it (your next build's fee 25% less), or recycles it into 2 t of
     Artefacts and 1 t of Electronics.
   - Relic of note (10): the broker buys it (15,000-40,000 SU).
   Twice as much in the Rift. (Lodestones, the Precursor vaults' own, come with L4.5.)
   GPL-2.0-or-later. ===== */
(function (root) {
'use strict';
const isNode = typeof module != 'undefined';
const req = (n, g) => isNode ? require('./' + n) : root[g];
const G = req('galaxy.js', 'EmberGalaxy');

const ART = {max: 64, structure: 1 / 6, kinds: {chart: 35, inscription: 30, device: 20, relic: 10},
	inscription: [3000, 9000], relic: [15000, 40000], rift: 2, chart: {r: 30, n: [1, 3]}, returned: 20, study: 0.25, recycle: {Artefacts: 2, Electronics: 1}};
const NOUN = {chart: ['star chart', 'sky disc', 'route stone'], inscription: ['tablet', 'inscription', 'stele', 'codex'], device: ['device', 'mechanism', 'engine'], relic: ['relic', 'idol', 'crown', 'reliquary']};
const KIND_NAME = {chart: 'Star chart', inscription: 'Inscription', device: 'Device', relic: 'Relic of note'};

/* the find at a place in a site (slot: 'v' the vault, or a structure's number): null if none there */
function findAt(site, slot) {
	const r = G.rng(G.hashStr('find:' + site.id + ':' + slot + ':' + (site.seed >>> 0)));
	if (slot != 'v' && r() >= ART.structure) return null;
	const tot = Object.values(ART.kinds).reduce((a, b) => a + b, 0); let x = r() * tot, k = 'chart';
	for (const [kk, w] of Object.entries(ART.kinds)) if ((x -= w) < 0) { k = kk; break }
	const span = ([a, b]) => Math.round((a + (b - a) * r()) / 100) * 100, rift = site.rift ? ART.rift : 1;
	return {k, v: k == 'inscription' ? span(ART.inscription) * rift : k == 'relic' ? span(ART.relic) * rift : 0};
}
/* its name, from the site and slot ("the Htevak tablet") */
function nameOf(a) {
	const h = G.hashStr('art:' + a.s + ':' + a.n), nouns = NOUN[a.k] || ['find'];
	return 'the ' + G.starName(h) + ' ' + nouns[(h >>> 8) % nouns.length];
}
/* an artifact for the record: {k: kind, s: star id|site id, n: slot, w: world, h: the holder of its space then, v: worth
   (SU; inscriptions and relics), r: from the Rift} */
function make(starId, site, slot, holder) {
	const f = findAt(site, slot); if (!f) return null;
	return {k: f.k, s: starId + '|' + site.id, n: String(slot), w: site.world || '', h: holder || null, v: f.v, r: site.rift ? 1 : 0};
}
/* into the record (at most 64; one find of a place once) */
function add(P, a) {
	P.artifacts = P.artifacts || [];
	if (P.artifacts.some(x => x.s == a.s && x.n == a.n)) return false;
	if (P.artifacts.length >= ART.max) return false;
	P.artifacts.push(a); return true;
}
/* a star chart read: the 1-3 nearest ruins within 30 pc not yet surveyed (by `surveyed(starId, planet)`), from a
   place; returns [{star, planet}] */
function chartMarks(a, at, ruinsNear, surveyed) {
	const r = G.rng(G.hashStr('chart:' + a.s + ':' + a.n)), n = ART.chart.n[0] + Math.floor(r() * (ART.chart.n[1] - ART.chart.n[0] + 1));
	return ruinsNear(at, ART.chart.r).filter(x => x.d > 0.01 && !surveyed(x.star.id, x.planet.name)).slice(0, n);
}
/* a device recycled: what it gives (t) */
const recycled = () => Object.assign({}, ART.recycle);

const EmberArtifacts = {ART, KIND_NAME, findAt, nameOf, make, add, chartMarks, recycled};
if (isNode) module.exports = EmberArtifacts; else root.EmberArtifacts = EmberArtifacts;
})(typeof window != 'undefined' ? window : globalThis);
