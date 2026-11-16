/* Ember Reach 0.4.5: the ship plan on the outfitting screen (apps/rudolf-emberreach/www/shipplan.js), in node.
     node tests/emberreach_shipplan_t.js */
const path = require('path');
const DIR = path.join(__dirname, '..', 'apps/rudolf-emberreach/www');
const Sp = require(path.join(DIR, 'shipplan.js')), O = require(path.join(DIR, 'outfit.js')), S = require(path.join(DIR, 'ships.js')), C = require(path.join(DIR, 'combat.js'));
let P = 0, N = 0;
const ok = (n, c, d) => { if (c) { P++; console.log('PASS ' + n) } else { N++; console.log('FAIL ' + n + (d ? ' - ' + JSON.stringify(d) : '')) } };
try {
	const hulls = S.ships().filter(h => !h.precursor), inside = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) != (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c } return c };
	ok('1. every slot of every hull has a place: its core modules, internal slots, hardpoints and utility mounts', hulls.every(h => { const L = O.layout(h), s = Sp.slots(h, L); return s.length == L.core.length + L.internal.length + L.external.length + L.utility }));
	const outside = [];
	for (const h of hulls) { const L = O.layout(h), len = h.length; for (const v of ['side', 'top']) { const o = Sp.outline(h, v); for (const s of Sp.slots(h, L)) { if (s.cat == 'external' && v == 'side') continue; const p = Sp.flat(s.p, v), grown = o.hull.map(([x, y]) => [x * 1.08, y * 1.08]); if (!inside(p, grown)) outside.push([h.id, v, s.cat, s.key || s.i]) } } }
	ok('2. each sits on the hull in both views (hardpoints hang under the wings, so the side view leaves them out)', !outside.length, outside.slice(0, 6));
	const k = S.hull('kestrel'), Lk = O.layout(k), mt = C.mounts(k, Lk.external.length);
	ok('3. hardpoints sit where the guns are mounted (combat.js mounts)', Sp.slots(k, Lk).filter(s => s.cat == 'external').every((s, i) => JSON.stringify(s.p) == JSON.stringify(mt[i])));
	const f = O.stock(k), side = Sp.svg(k, Lk, f, 'side', {cat: 'internal', i: 1}), top = Sp.svg(k, Lk, f, 'top', null);
	const marks = s => (s.match(/data-ofpick="/g) || []).length, mirrored = Sp.slots(k, Lk).filter(s => s.mirror).length;
	ok('4. the drawing: a marker for each slot (manoeuvring thrusters at both wing tips), each picking its slot', marks(side) == Sp.slots(k, Lk).length + mirrored && /data-ofpick="internal:1"/.test(side) && /data-ofpick="core:power"/.test(side));
	ok('5. side profile and top down are different drawings of the same ship', side != top && /From the side/.test(side) && /From above/.test(top) && marks(top) == marks(side));
	ok('6. the slot picked is ringed; fitted slots are filled, empty ones hollow', (side.match(/stroke="#fff"/g) || []).length == 1 && side.includes('fill="' + Sp.COL.core + '"') && (Lk.internal.some((z, i) => !f.internal[i]) ? side.includes('fill="rgba(10,18,32,0.85)"') : true));
	/* guns fire from their own hardpoints */
	const two = Object.assign({}, f, {external: [null, {id: 'pulse', size: 1, grade: 'C'}]}), d2 = O.derive(k, two), cs = C.state(d2);
	ok('7. a gun fires from its own hardpoint\'s mount (the second hardpoint, when the first is empty)', d2.gunSlots.join() == '1' && JSON.stringify(cs.load.guns[0].at) == JSON.stringify(mt[1]));
} catch (e) { N++; console.log('FAIL (threw) ' + e.stack) }
console.log(P + '/' + (P + N) + ' passed');
process.exit(N ? 1 : 0);
