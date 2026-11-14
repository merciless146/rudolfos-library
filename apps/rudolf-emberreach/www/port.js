/* ===== Ember Reach: the starport, docked (docs/plan-ember-reach.md, M3; the design canvas's "starport menu").
   Frontier's layout, modern finish: a status strip on top (port, holder, day, the local currency's rate, cargo,
   legal standing, money here); Elite Dangerous's services row (refuel, repair, restock); one screen at a time, chosen
   from the function bar along the bottom (F1–F9, or 1–9): Launch, Station, Market, Bulletin board, Shipyard,
   Outfitting, Contacts (authority, war office, exchange), Cartographics and lounges, Status.
   Everything is real: the market (economy.js) in the holder's currency, the exchange's spreads, the yard's stock
   and part-exchange (trade.js), the war office's contracts (factions.js), your reputation (reputation.js).
   EmberPort.open(env): env = {P, ship (stats), fit, fuel(), setFuel(f), star, port, stationName, day, onLaunch(),
   onShip(id), say(text), cue(name)}. M4: restocking munitions, repairs that mend the hull too, war contracts taken at
   the bulletin board, and the missions in hand on the Status screen. M5: Universal Cartographics buys your survey
   data and lets you name your first discoveries; the bulletin board carries the cartographers' contracts.
   M5b: the colonial office (from Contacts): your colonies and their builds, haulage contracts, and the planner for
   claims within one jump. Outfitting: the ship's modules in four categories (core, internal, external, utility),
   bought, swapped and stored; linguistic decoders loaded with languages. A port whose people you can't understand
   (no decoder for their language) keeps its services closed, fuel excepted.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const G = window.EmberGalaxy, F = window.EmberFactions, E = window.EmberEconomy, S = window.EmberShips, M = window.EmberModules, R = window.EmberReputation, Tr = window.EmberTrade,
	C = window.EmberCombat, En = window.EmberEncounters, X = window.EmberExplore, Co = window.EmberColonies, O = window.EmberOutfit, Ins = window.EmberInsurance;
const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const fmt = (n, d) => (+n).toLocaleString('en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0});
const money = (n, c) => c + ' ' + fmt(n, n < 100 ? 1 : 0);
const nm = id => F.byId(id).name.replace(/^The /, '');
const SCREENS = [['launch', 'Launch'], ['station', 'Station'], ['market', 'Market'], ['bulletin', 'Bulletin'], ['shipyard', 'Shipyard'], ['outfitting', 'Outfitting'], ['contacts', 'Contacts'], ['carto', 'Carto & lounges'], ['status', 'Status']];
const ICON = {
	launch: '<path d="M12 3v13M6 9l6-6 6 6M5 21h14"/>', station: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', market: '<path d="M5 20V11M11 20V5M17 20v-7M3 20h18"/>',
	bulletin: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>', shipyard: '<path d="M12 3l7 17-7-4-7 4z"/>',
	outfitting: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
	contacts: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c3 0 5 2 5 5"/>',
	carto: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>', status: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17l4-5"/>'};
const svg = k => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>';

let env = null, root = null, screen = 'station', sel = {good: null, ship: null}, ex = {from: null, to: null, amount: ''}, mkt = null, naming = {};
function open(e) {
	env = e; root = document.getElementById('port'); root.hidden = false;
	const myCol = env.port && env.port.colony ? Co.colonyAt(env.P, env.star.id) : null;
	mkt = E.market(env.star, env.day, myCol ? {holder: env.port.owner, econ: Co.economy(myCol, env.star)} : undefined);
	screen = 'station'; sel = {good: Object.keys(mkt.prices)[0], ship: null};
	const codes = Object.keys(env.P.wallet).filter(c => env.P.wallet[c] > 0);
	ex = {from: mkt.currency != 'SU' && env.P.wallet[mkt.currency] > 0 ? mkt.currency : codes[0], to: mkt.currency != 'SU' ? mkt.currency : codes[0], amount: ''};
	root.onclick = click; root.onkeydown = key; root.oninput = input;
	render();
	const b = root.querySelector('[data-screen="station"]'); if (b) b.focus();
}
function close() { root.hidden = true; root.innerHTML = ''; env = null }
const P = () => env.P;
const holder = () => mkt.holder;
const here = () => mkt.currency;
const rel = id => !id ? 0 : id == P().origin ? 1 : F.relation(P().origin, id);

/* ---------- the screen ---------- */
function render() {
	const pl = P(), ship = env.ship, cur = here(), o = holder() ? F.byId(holder()) : null;
	const fuelCost = Tr.refuelCost(ship, env.fuel(), mkt), repCost = Tr.repairCost(ship, env.fit, mkt, env.day, hull()), stock = restockCost();
	const top = '<header class="pt-top"><div class="pt-name"><b>' + esc(env.stationName) + '</b><span>' + esc(o ? o.name.replace(/^The /, '') : env.port.anchorage ? 'Precursor anchorage · the Rift' : 'free traders') + (mkt.contested ? ' · contested' : '') + '</span></div><div class="pt-stats">'
		+ stat('Day', Math.floor(env.day)) + (cur != 'SU' ? stat(o.currency.name.split(' ').pop(), E.rate(cur, env.day).toFixed(3) + ' ' + cur + '/SU') : stat('Trade', 'SU, via free traders'))
		+ stat('Cargo', Tr.held(pl) + '/' + ship.cargo + ' t') + stat('Legal', pl.bounties && Object.keys(pl.bounties).length ? 'Wanted' : 'Clean')
		+ stat('Wallet', cur != 'SU' ? money(pl.wallet[cur] || 0, cur) : fmt(Tr.walletSU(pl, env.day)) + ' SU in all', true) + '</div></header>';
	const svc = '<div class="pt-svc">' + svcBtn('refuel', 'Refuel', fuelCost > 0.005 ? money(fuelCost, cur == 'SU' ? 'SU' : cur) + ' · tank ' + Math.round(env.fuel() * 100) + '%' : 'Tank full', fuelCost <= 0.005)
		+ svcBtn('repair', 'Repair', repCost > 0.005 ? money(repCost, cur == 'SU' ? 'SU' : cur) + ' · hull ' + Math.round(hull() * 100) + '%' : 'Hull and modules whole', repCost <= 0.005)
		+ svcBtn('restock', 'Restock', !C.loadout(ship).guns.length ? 'No weapons fitted' : stock.tons > 0.001 ? money(stock.cost, cur == 'SU' ? 'SU' : cur) + ' · ' + fmt(stock.tons, 1) + ' t munitions' : 'Magazines full', stock.tons <= 0.001) + '<div class="pt-fill"></div><span class="pt-ship">Docked · ' + esc(ship.name) + ' ' + esc(ship.size) + ' ' + esc(ship.role) + '</span></div>';
	const bar = '<nav class="pt-bar" aria-label="Starport">' + SCREENS.map(([k, label], i) => '<button data-screen="' + k + '" class="' + (k == screen ? 'on' : '') + '"' + (k == screen ? ' aria-current="page"' : '') + '><small>F' + (i + 1) + '</small>' + svg(k) + '<span>' + label + '</span></button>').join('') + '</nav>';
	root.innerHTML = '<div class="pt">' + top + svc + '<main class="pt-main">' + body() + '</main>' + bar + '</div>';
}
const hull = () => P().combat && typeof P().combat.hull == 'number' ? P().combat.hull : 1;
/* munitions at this market's price (or a war-time premium on the standard price where it has none) */
function restockCost() {
	const tons = C.missing(env.ship, P().combat), q = mkt.prices.Munitions, unit = q ? q.price : 35 * 1.5 * (mkt.currency == 'SU' ? 1 : E.rate(mkt.currency, env.day));
	return {tons, cost: tons * unit};
}
const stat = (k, v, gold) => '<div><span>' + esc(k) + '</span><b' + (gold ? ' class="gold"' : '') + '>' + esc(v) + '</b></div>';
const svcBtn = (act, label, sub, off) => '<button class="pt-svcb" data-act="' + act + '"' + (off ? ' disabled' : '') + '><b>' + label + '</b><span>' + esc(sub) + '</span></button>';
const h1 = (t, sub) => '<div class="pt-h"><h1>' + esc(t) + '</h1>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
/* can you understand this port's people? */
const lockedHere = () => { const o = holder(); return o && !O.understands(P(), env.ship, o) };
const OPEN_ANYWAY = ['launch', 'station', 'status'];
function lockedScreen() {
	const o = holder(), l = O.langOf(o);
	return h1(O.garble('Services of the port', o), 'untranslated · ' + O.langName(l)) + '<section class="pt-card pt-narrow"><p>' + esc(O.garble('Welcome, traveller. Our market, our contracts and our yards are open to all who speak with us.', o)) + '</p>'
		+ '<p>You can\'t understand the ' + esc(O.langName(l)) + '. Their market, contracts, yards and services are closed to you until you fit a <b>linguistic decoder</b> loaded with their language (at an outfitter whose people you understand). Fuel is sold by sign and dial: you can still refuel.</p></section>';
}
function body() {
	if (lockedHere() && !OPEN_ANYWAY.includes(screen)) return lockedScreen();
	switch (screen) {
	case 'launch': return h1('Launch') + '<section class="pt-card pt-narrow"><p>Leave ' + esc(env.stationName) + '. Fuel ' + Math.round(env.fuel() * 100) + '%, cargo ' + Tr.held(P()) + ' t, ' + M.alerts(env.fit).length + ' modules down.</p><button class="pt-primary" data-act="launch">Request launch</button></section>';
	case 'station': return station();
	case 'market': return market();
	case 'bulletin': return bulletin();
	case 'shipyard': return shipyard();
	case 'outfitting': return outfitting();
	case 'contacts': return contacts();
	case 'carto': return carto();
	case 'status': return status();
	case 'colonies': return colonies();
	}
	return '';
}
function station() {
	const st = env.star, sy = G.system(st), o = holder() ? F.byId(holder()) : null, me = P();
	const rows = [['Star', (st.cls || st.kind) + ' class · ' + st.M.toFixed(2) + ' suns'], ['Port', (env.port.capital ? 'Capital · ' : '') + env.stationName], ['From the centre', fmt(G.mRad(st.x, st.y, st.z)) + ' pc'],
		['Holder', o ? o.name.replace(/^The /, '') + (mkt.contested ? ' (contested)' : '') : env.port.anchorage ? 'nobody: an old Precursor dock, still working' : 'nobody: free traders'], ['Your standing', o ? R.tier(me.rep[o.id] || 0) + ' (' + Math.round(me.rep[o.id] || 0) + ')' : '—']];
	const allies = o ? F.majors().filter(m => m.id != o.id && F.relation(o.id, m.id) > 0) : [], enemies = o ? F.majors().filter(m => F.relation(o.id, m.id) < 0) : [];
	const rc = m => rel(m.id) < 0 ? ' class="bad"' : rel(m.id) > 0 ? ' class="good"' : '';
	return h1('Station', o ? (env.port.capital ? 'The ' + o.name.replace(/^The /, '') + '\'s capital' : 'A port of the ' + o.name.replace(/^The /, '')) : '')
		+ '<div class="pt-grid3"><section class="pt-card"><h2>System</h2><div class="pt-big">' + esc(st.name) + '</div><dl>' + rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl><div class="pt-chips">' + sy.planets.map(p => '<span' + (p.name == env.port.world ? ' class="on"' : '') + '>' + esc(p.type) + (p.alive ? ' · life' : '') + '</span>').join('') + '</div></section>'
		+ '<section class="pt-card"><h2>Relations</h2><h3 class="good">Allies</h3>' + (allies.map(m => '<p' + rc(m) + '>' + esc(m.name.replace(/^The /, '')) + '</p>').join('') || '<p class="muted">none</p>') + '<h3 class="bad">At war with</h3>' + (enemies.map(m => '<p' + rc(m) + '>' + esc(m.name.replace(/^The /, '')) + '</p>').join('') || '<p class="muted">none</p>') + '</section>'
		+ '<section class="pt-card"><h2>You</h2><dl><dt>Origin</dt><dd>' + esc(nm(me.origin)) + '</dd><dt>Worth</dt><dd>' + fmt(Tr.worth(me, env.day)) + ' SU</dd><dt>Fuel</dt><dd>' + Math.round(env.fuel() * 100) + '%</dd><dt>Hold</dt><dd>' + Tr.held(me) + ' / ' + env.ship.cargo + ' t</dd></dl><button class="pt-ghost" data-screen="market">Open the market</button></section></div>';
}
function market() {
	const me = P(), cur = here(), goods = Object.keys(mkt.prices), g = sel.good || goods[0], q = mkt.prices[g];
	const can = Tr.canBuy(me, env.ship, mkt, g, env.day), have = me.cargo[g] || 0;
	const rows = goods.map(k => { const x = mkt.prices[k], h = me.cargo[k] || 0; return '<button class="pt-row' + (k == g ? ' on' : '') + '" data-good="' + k + '"><span>' + k + '</span><span class="num">' + fmt(x.price, 1) + '</span><span class="num muted">' + fmt(x.su, 1) + '</span><span class="num">' + (x.buy ? 'Yes' : 'No') + '</span><span class="num">' + (h || '') + '</span><span class="num muted">' + (h && me.cost[k] ? fmt(me.cost[k], 1) : '') + '</span></button>' }).join('');
	const profit = have && me.cost[g] ? (q.su - me.cost[g]) * have : null;
	const noMoney = cur != 'SU' && !(me.wallet[cur] > 0);
	return h1('Market', cur != 'SU' ? 'Prices in ' + cur + '; SU = standard units' : env.port.anchorage ? 'The anchorage trades in SU with whoever comes, taking your coin at an 8% cut; the Rift\'s goods fetch half what they do across the Maw' : 'Fought over: free traders deal in SU, taking your coin at an 8% cut')
		+ '<div class="pt-split"><section class="pt-card pt-table" role="list"><div class="pt-thead"><span>Good</span><span class="num">Price ' + cur + '</span><span class="num">Value SU</span><span class="num">Buys</span><span class="num">Held</span><span class="num">Paid SU</span></div>' + rows + '</section>'
		+ '<aside class="pt-card pt-side"><span class="pt-label">Selected</span><div class="pt-big">' + g + '</div><dl><dt>Price</dt><dd>' + fmt(q.price, 1) + ' ' + cur + '/t</dd><dt>Value</dt><dd>' + fmt(q.su, 1) + ' SU</dd><dt>Station buys</dt><dd>' + (q.buy ? 'Yes' : 'No') + '</dd><dt>In your hold</dt><dd>' + have + ' t</dd><dt>Free space</dt><dd>' + Tr.free(me, env.ship) + ' t</dd>'
		+ (profit != null ? '<dt>If sold here</dt><dd class="' + (profit >= 0 ? 'good' : 'bad') + '">' + (profit >= 0 ? '+' : '') + fmt(profit) + ' SU</dd>' : '') + '</dl>'
		+ '<div class="pt-btns"><button class="pt-primary" data-act="buy" data-n="1"' + (can < 1 ? ' disabled' : '') + '>Buy 1 t</button><button class="pt-primary" data-act="buy" data-n="max"' + (can < 1 ? ' disabled' : '') + '>' + (can > 1 ? 'Buy ' + can + ' t' : 'Buy the most') + '</button>'
		+ '<button class="pt-ghost" data-act="sell" data-n="1"' + (!q.buy || !have ? ' disabled' : '') + '>Sell 1 t</button><button class="pt-ghost" data-act="sell" data-n="all"' + (!q.buy || !have ? ' disabled' : '') + '>Sell all</button></div>'
		+ '<p class="muted small">' + (noMoney ? 'You hold no ' + cur + ': change money at Contacts (F7).' : !q.buy ? 'This port doesn\'t buy ' + g.toLowerCase() + '.' : Tr.free(me, env.ship) <= 0 ? 'The hold is full.' : (q.none ? (env.star.rift ? 'None mined near here to sell. ' : 'Found only in the Rift: nobody this side has any to sell. ') : '') + 'Prices follow the ' + (cur == 'SU' ? 'day' : cur + ' rate') + ', local supply and the season.') + '</p></aside></div>';
}
/* the war office's contracts: take one, do it in its system within 10 days, and be paid (up to three at once) */
const pc = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const HOW = {kills: 'Destroy 3 enemy ships there', stay: 'Stay 30 s in the system', depot: 'Destroy the supply depot', deliver: 'Bring 5 t of Munitions and dock there'};
function bulletin() {
	const o = holder(), me = P();
	if (!o) return h1('Bulletin board') + '<section class="pt-card pt-narrow"><p>No great power posts here while the system is fought over.</p></section>';
	const ms = En.offers(me, env.port, env.day), xs = X.offers(me, env.star, env.port, env.day), held = (me.missions || []).length, here = [env.star.x, env.star.y, env.star.z];
	const xad = m => '<div class="pt-ad"><span class="tag">' + (m.type == 'ruin' ? 'ruin' : 'survey') + '</span><div><b>' + esc(m.text) + '</b><span class="muted">' + esc('at ' + m.systemName + ' · ' + m.dist.toFixed(1) + ' pc · due in 20 days') + '</span></div><span class="gold num">' + money(m.reward, m.currency) + '</span>'
		+ '<button class="pt-ghost" data-act="acceptx" data-m="' + esc(m.id) + '"' + (held >= En.ENC.maxMissions ? ' disabled' : '') + '>Accept</button></div>';
	const ad = m => { const st = En.missionStar(m), d = st ? pc(here, st.at) : 0; return '<div class="pt-ad"><span class="tag">' + esc(m.type) + '</span><div><b>' + esc(m.text) + '</b><span class="muted">' + esc('against the ' + nm(m.against) + ' · ' + d.toFixed(1) + ' pc · ' + HOW[En.NEEDS[m.type]]) + '</span></div><span class="gold num">' + money(m.reward, m.currency) + '</span>'
		+ '<button class="pt-ghost" data-act="accept" data-m="' + esc(m.id) + '"' + (held >= En.ENC.maxMissions ? ' disabled' : '') + '>Accept</button></div>' };
	return h1('Bulletin board', 'The ' + nm(o) + '\'s war office') + '<section class="pt-card"><div class="pt-list">' + (ms.length ? ms.map(ad).join('') : '<p class="muted">No war contracts today.</p>') + '</div><h2>Cartographers</h2><div class="pt-list">' + (xs.length ? xs.map(xad).join('') : '<p class="muted">No survey contracts today.</p>') + '</div><p class="muted small">' + (held ? 'You hold ' + held + ' of ' + En.ENC.maxMissions + ' war missions (Status, F9). ' : '') + 'Missions are due in 10 days; the work counts on the front, double with a commission. Taking one makes its enemy\'s ships fight you there.</p></section>';
}
/* Universal Cartographics: sell the data; name your first discoveries */
function carto() {
	const me = P(), items = X.unsold(me), su = items.reduce((t, x) => t + x.su, 0), cur = here(), rate = cur == 'SU' ? 0.92 : E.rate(cur, env.day);
	const X0 = me.explore || {sys: {}, pl: {}}, firsts = Object.values(X0.pl).filter(e => e.f).length;
	const list = items.slice(0, 40).map(x => '<div class="pt-rep"><span>' + esc(x.kind == 'system' ? 'System chart · ' + (X.starById(x.key) || {name: x.key}).name : x.label) + '</span><span class="num">' + fmt(x.su * rate) + '</span><span class="' + (x.first ? 'good' : 'muted') + '">' + (x.first ? 'first' : '') + '</span></div>').join('');
	const names = X.nameable(me).map(n => '<div class="pt-name-row"><span>' + esc(n.name) + ' · ' + esc(n.p.alive ? 'living world' : 'ruins') + '</span><input data-name="' + esc(n.key) + '" maxlength="24" placeholder="' + esc(n.named || 'A name') + '" value="' + esc(naming[n.key] != null ? naming[n.key] : '') + '"><button class="pt-ghost" data-act="rename" data-k="' + esc(n.key) + '">Name it</button>' + (n.named ? '<span class="good">' + esc(n.named) + '</span>' : '') + '</div>').join('');
	return h1('Cartographics & lounges', 'Universal Cartographics buys charts and surveys, once each')
		+ '<div class="pt-split"><section class="pt-card pt-table"><h2>Data to sell · ' + items.length + '</h2>' + (list || '<p class="muted">Nothing new. Arriving in a system charts it; flying close to a targeted planet surveys it.</p>') + (items.length > 40 ? '<p class="muted small">…and ' + (items.length - 40) + ' more</p>' : '')
		+ '<div class="pt-btns"><button class="pt-primary" data-act="selldata"' + (items.length ? '' : ' disabled') + '>Sell all for ' + money(su * rate, cur == 'SU' ? (F.byId(me.origin).currency.code + ' (via free traders)') : cur) + '</button></div></section>'
		+ '<aside class="pt-card pt-side"><h2>Explorer</h2><dl><dt>Systems charted</dt><dd>' + Object.keys(X0.sys).length + '</dd><dt>Planets surveyed</dt><dd>' + Object.keys(X0.pl).length + '</dd><dt>First discoveries</dt><dd>' + firsts + '</dd></dl>'
		+ '<h2>Name your discoveries</h2>' + (names || '<p class="muted small">Living worlds and ruins you are first to survey can be named here.</p>')
		+ '<h2>Lounges</h2><p class="muted small">Passengers and crew arrive with the larger ships\' needs.</p></aside></div>';
}
/* the artifact broker: builds alien modules from the blueprints you found in ruins */
function broker() {
	const me = P(), bps = me.blueprints || [];
	if (!O.broker(env.port)) return '<section class="pt-card"><h2>Artifact broker</h2><p class="muted small">No broker keeps shop at a port this small: try a lantern, bloom or halo.</p></section>';
	const rows = bps.map((bp, j) => { const rc = O.recipe(bp), have = Object.entries(rc.goods).every(([g, t]) => (me.cargo[g] || 0) >= t);
		return '<div class="pt-claim"><div><b>' + esc(O.bpName(bp)) + '</b><span class="muted small">' + Object.entries(rc.goods).map(([g, t]) => t + ' t ' + g + ((me.cargo[g] || 0) >= t ? '' : ' (have ' + (me.cargo[g] || 0) + ')')).join(', ') + '</span></div><button class="pt-primary" data-act="bpbuild" data-j="' + j + '"' + (have ? '' : ' disabled') + '>Build · ' + money(rc.fee * rateHere(), here()) + '</button></div>' }).join('');
	return '<section class="pt-card"><h2>Artifact broker</h2>' + (rows || '<p class="muted small">Bring a blueprint from a ruin (surveying one sometimes turns one up) and the goods it calls for, and the broker builds the module.</p>') + '<p class="muted small">The blueprint goes into the build. Recycle the module (at the outfitter) to get it back with half the goods. Precursor blueprints come from the Rift\'s ruins and call for its goods as well as this side\'s; a Precursor core module is made to your hull\'s size, and a Precursor hull takes your ship in part-exchange.</p></section>';
}
/* the colonial office: your colonies, haulage, and the planner */
const STAGE = {claimed: 'Claimed: drop the beacon', building: 'Building', done: 'Built', lapsed: 'Lapsed (salvage)', lost: 'Lost'};
const payCode = c => c.independent ? c.scrip : F.byId(c.sponsor).currency.code;
/* rent a carrier for a build: a season as a depot */
function carrierRow(c) {
	const d = env.day, cur = here(), r = Co.rented(c, d);
	if (r) return '<p class="small good">' + esc(r.name) + ' is parked at the site until day ' + r.until + ': haulage 30% cheaper, twice as fast.</p>';
	const list = Co.carriers(P(), d).slice(0, 3); if (!list.length) return '';
	const fee = Math.round(Co.COL.rent.fee * (cur == 'SU' ? 1 : E.rate(cur, d)));
	return '<h3>Rent a carrier</h3><div class="pt-btns pt-wrap">' + list.map(m => '<button class="pt-ghost" data-act="rent" data-c="' + esc(c.id) + '" data-m="' + esc(m.id) + '">' + esc(m.name) + ' (' + esc(m.faction.replace(/^The /, '')) + ') · ' + money(fee, cur) + '</button>').join('') + '</div>';
}
let colSel = null, pick = {};
const pct = v => Math.round(v * 100) + '%';
const ECON_NAME = {extraction: 'extraction', refinery: 'refinery', agriculture: 'agriculture', industrial: 'industrial', hightech: 'high tech', military: 'military', tourism: 'tourism', contraband: 'contraband'};
const econText = e => Object.entries(e).sort((a, b) => b[1] - a[1]).map(([k, v]) => ECON_NAME[k] + ' ' + pct(v)).join(', ') || 'none yet: the plain market';
/* a finished colony: its numbers, its builds, and planning the next */
function buildOut(c, office) {
	const me = P(), d = env.day, star = Co.starOf(c); if (!star) return '';
	const st = Co.stats(c, star), here = env.star.id == c.id && env.port.colony, sl = Co.slots(star), pk = pick[c.id] || (pick[c.id] = {fac: 'mining', at: ''});
	const opts = sl.flatMap(x => ['orbit', 'surface'].filter(w => x[w] > Co.used(c, x.body, w)).map(w => [x.body + '|' + w, x.body + ' · ' + w + ' (' + (x[w] - Co.used(c, x.body, w)) + ' free)']));
	if (!opts.some(o => o[0] == pk.at)) pk.at = opts[0] ? opts[0][0] : '';
	const [body, where] = pk.at.split('|'), ck = body ? Co.canBuild(c, star, pk.fac, body, where) : {ok: false, why: 'No free slots.'};
	let preview = '';
	if (ck.ok && Co.FAC[pk.fac].econ) { const after = Co.economy({world: c.world, builds: [...c.builds, {fac: pk.fac, body, done: true}]}, star); preview = 'Economy after: ' + econText(after) }
	const builds = c.builds.map(b => '<div class="pt-rep"><span>' + esc(Co.FAC[b.fac].name) + ' · ' + esc(b.body) + ' ' + b.where + '</span><span class="num">' + (b.done ? 'built' : pct(Co.progress(b))) + '</span><span class="muted">' + (b.done ? 'day ' + b.finished : Object.entries(Co.left(b)).map(([g, t]) => fmt(t) + ' ' + g).slice(0, 3).join(', ')) + '</span></div>').join('');
	const active = c.builds.filter(b => !b.done);
	const haul = active.length && mkt.currency != 'SU' ? active.slice(0, 2).map(b => Object.entries(Co.left(b)).filter(([g, t]) => t - ((b.coming || {})[g] || 0) > 0).slice(0, 6).map(([g, t]) => { const n = t - ((b.coming || {})[g] || 0), q = Co.haulQuote(office, mkt, c, g, n, d); return q ? '<button class="pt-ghost" data-act="haul" data-c="' + esc(c.id) + '" data-j="' + esc(b.id) + '" data-g="' + g + '" data-n="' + n + '">' + fmt(n) + ' t ' + g + ' · ' + money(q.cost, q.currency) + ' · ' + q.days + ' d</button>' : '' }).join('')).join('') : '';
	const rent = active.length ? carrierRow(c) : '';
	return '<dl><dt>Population</dt><dd>' + fmt(c.pop || 0) + ' of ' + fmt(st.cap) + '</dd><dt>Security · wealth · tech</dt><dd>' + pct(st.security) + ' · ' + pct(st.wealth) + ' · ' + pct(st.tech) + '</dd><dt>Economy</dt><dd>' + esc(econText(st.econ)) + '</dd>'
		+ '<dt>Points</dt><dd>tier 2: ' + c.points.t2 + ' · tier 3: ' + c.points.t3 + '</dd><dt>Next pay</dt><dd>day ' + (c.paid + Co.COL.seasonDays) + ' · about ' + money(Co.payment(c, star) * E.rate(payCode(c), d), payCode(c)) + (c.independent ? ' (its own scrip)' : '') + '</dd></dl>'
		+ (builds ? '<h3>Facilities</h3><div class="pt-table">' + builds + '</div>' : '')
		+ (here && active.length ? '<div class="pt-btns"><button class="pt-primary" data-act="givebuild" data-c="' + esc(c.id) + '">Hand over goods from the hold</button></div>' : active.length ? '<p class="muted small">Hand over goods docked at ' + esc(c.star.name) + '\'s own port.</p>' : '')
		+ (haul ? '<h3>Haulage from here</h3><div class="pt-btns pt-wrap">' + haul + '</div>' : '') + rent
		+ '<h3>Plan a facility</h3><div class="pt-form"><label>Facility<select data-pick="fac" data-c="' + esc(c.id) + '">' + Object.entries(Co.FAC).map(([k, f]) => '<option value="' + k + '"' + (k == pk.fac ? ' selected' : '') + '>' + esc(f.name) + ' · tier ' + f.tier + '</option>').join('') + '</select></label>'
		+ '<label>Where<select data-pick="at" data-c="' + esc(c.id) + '">' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v == pk.at ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label></div>'
		+ '<p class="small">' + (ck.ok ? fmt(Object.values(ck.goods).reduce((t, v) => t + v, 0)) + ' t of goods' + (ck.cost.t2 ? ' · 1 tier 2 point' : ck.cost.t3 ? ' · ' + ck.cost.t3 + ' tier 3 points' : ' · earns a tier ' + (Co.FAC[pk.fac].tier + 1) + ' point') + (preview ? '<br>' + esc(preview) : '') : '<span class="bad">' + esc(ck.why) + '</span>') + '</p>'
		+ '<div class="pt-btns"><button class="pt-ghost" data-act="startbuild" data-c="' + esc(c.id) + '"' + (ck.ok ? '' : ' disabled') + '>Start building</button></div>';
}
function colonies() {
	const me = P(), o = holder(), d = env.day, office = {star: env.star, owner: o}, mine = (me.colonies || []), jump = env.ship.jump || 0;
	const goodsRow = c => Object.entries(c.need).map(([g, t]) => { const got = Math.min(t, c.got[g] || 0), coming = (c.coming || {})[g] || 0; return '<div class="pt-rep"><span>' + g + '</span><span class="num">' + fmt(got) + ' / ' + fmt(t) + ' t</span><span class="muted">' + (coming ? fmt(coming) + ' t coming' : got >= t ? 'done' : (me.cargo[g] ? fmt(me.cargo[g]) + ' t aboard' : '')) + '</span></div>' }).join('');
	const haulBtns = c => Object.entries(Co.left(c)).filter(([g, t]) => t - ((c.coming || {})[g] || 0) > 0).slice(0, 8).map(([g, t]) => { const n = t - ((c.coming || {})[g] || 0), q = Co.haulQuote(office, mkt, c, g, n, d); return q ? '<button class="pt-ghost" data-act="haul" data-c="' + esc(c.id) + '" data-g="' + g + '" data-n="' + n + '">' + fmt(n) + ' t ' + g + ' · ' + money(q.cost, q.currency) + ' · ' + q.days + ' d</button>' : '' }).join('');
	const card = c => '<section class="pt-card"><h2>' + esc(c.star.name) + ' · ' + esc(Co.PORTS[c.port].name) + '</h2><dl><dt>Sponsor</dt><dd>' + (c.independent ? 'Independent · scrip ' + esc(c.scrip) : esc(nm(c.sponsor)) + (Co.PORTS[c.port].base ? ' · forward base' : '')) + '</dd><dt>Stage</dt><dd>' + STAGE[c.stage] + '</dd><dt>World</dt><dd>' + esc(c.world) + '</dd>'
		+ (c.stage == 'claimed' ? '<dt>Beacon by</dt><dd>day ' + c.beaconBy + '</dd>' : c.stage == 'building' ? '<dt>Due</dt><dd>day ' + c.due + ' · ' + Math.round(Co.progress(c) * 100) + '% built</dd>' : c.stage == 'done' ? '<dt>Opens</dt><dd>day ' + c.opens + '</dd>' : '') + '</dl>'
		+ (c.stage == 'building' || c.stage == 'claimed' ? '<div class="pt-table">' + goodsRow(c) + '</div>' : '')
		+ (c.stage == 'building' ? carrierRow(c) : '')
		+ (c.stage == 'building' ? '<h3>Haulage from here</h3>' + (mkt.currency == 'SU' ? '<p class="muted small">Haulers here want a power\'s coin.</p>' : '<div class="pt-btns pt-wrap">' + (haulBtns(c) || '<span class="muted small">Everything is delivered or on its way.</span>') + '</div><p class="muted small">10–25% over this market, more the farther they go; paid now, delivered after the days shown.</p>') : '')
		+ (c.stage == 'claimed' ? '<p class="small">Fly to ' + esc(c.star.name) + ' and press N near ' + esc(c.world) + ' to drop the beacon.</p>' : '')
		+ (c.stage == 'done' && d >= c.opens ? buildOut(c, office) : '') + '</section>';
	/* the planner */
	const rift = !!env.star.rift, cands = o || rift ? Co.candidates(me, office, d, jump, 10) : [];   /* (a Rift anchorage files independent claims) */
	if (!colSel || !cands.some(s => s.id == colSel)) colSel = cands[0] && cands[0].id;
	const s = cands.find(x => x.id == colSel), sys = s && G.system(s);
	const rows = cands.map(x => { const pl = G.system(x).planets, best = pl.slice().sort((a, b) => b.esi - a.esi)[0]; return '<button class="pt-row pt-row4' + (x.id == colSel ? ' on' : '') + '" data-col="' + esc(x.id) + '"><b>' + esc(x.name) + '</b><span>' + x.d.toFixed(1) + ' pc</span><span class="muted">' + pl.length + ' planets</span><span class="num">' + esc(best.type) + ' · ESI ' + best.esi.toFixed(2) + (pl.some(p => p.alive) ? ' · life' : '') + (pl.some(p => p.ruins) ? ' · ruins' : '') + '</span></button>' }).join('');
	let side = '<p class="muted">' + (!o && !rift ? 'No sponsor here.' : !jump ? 'Your ship has no jump drive: no systems within a jump.' : 'No claimable systems within ' + jump + ' pc.') + '</p>';
	if (s) {
		const world = Co.portWorld(s);
		const cl = rift ? {owner: null, contested: null} : F.claimAt([s.x, s.y, s.z]);
		side = '<span class="pt-label">' + (rift ? 'The Rift: nobody\'s' : cl.owner ? 'In the ' + esc(nm(o)) + '\'s space: by charter' : 'Unclaimed space') + '</span><div class="pt-big">' + esc(s.name) + '</div><dl><dt>Star</dt><dd>' + esc(s.cls || s.kind) + ' · ' + s.d.toFixed(1) + ' pc</dd><dt>Port world</dt><dd>' + esc(world) + '</dd></dl><div class="pt-chips">' + sys.planets.map(p => '<span' + (p.name == world ? ' class="on"' : '') + '>' + esc(p.type) + ' ' + p.g.toFixed(1) + ' g' + (p.alive ? ' · life' : '') + (p.ruins ? ' · ruins' : '') + (p.ring ? ' · rings' : '') + '</span>').join('') + '</div>'
			+ (rift ? [] : cl.contested ? ['base'] : ['outpost', 'station', 'great']).map(k => { const K = Co.PORTS[k], ck = Co.canClaim(me, office, s, k, d, jump); const fee = ck.fee || Math.round(K.fee * E.rate(F.byId(o).currency.code, d)); return '<div class="pt-claim"><div><b>' + K.name + '</b><span class="muted small">' + fmt(Object.values(K.goods).reduce((t, v) => t + v, 0)) + ' t of goods in a season' + (K.base ? ' · war effort each season while held' : '') + '</span></div><button class="pt-primary" data-act="claim" data-k="' + k + '"' + (ck.ok && (me.wallet[ck.currency] || 0) >= ck.fee ? '' : ' disabled') + '>Claim · ' + money(fee, F.byId(o).currency.code) + '</button>' + (ck.ok ? '' : '<span class="bad small">' + esc(ck.why) + '</span>') + '</div>' }).join('')
			+ (!cl.owner && !cl.contested ? '<h3>' + (rift ? 'Independent (the only kind in the Rift)' : 'Or independent') + '</h3><p class="muted small">No sponsor: its own scrip, a bigger share for you (10–15%), and no protection. Low security two seasons running and a syndicate takes over.</p>' + ['outpost', 'station'].map(k => { const ck = Co.canClaim(me, office, s, k, d, jump, false, true); return '<div class="pt-claim"><div><b>Independent ' + Co.PORTS[k].name.toLowerCase() + '</b></div><button class="pt-ghost" data-act="claimi" data-k="' + k + '"' + (ck.ok && Tr.walletSU(me, d) >= ck.fee * 1.1 ? '' : ' disabled') + '>Claim · ' + fmt(ck.fee || Co.PORTS[k].fee) + ' SU</button>' + (ck.ok ? '' : '<span class="bad small">' + esc(ck.why) + '</span>') + '</div>' }).join('') : '');
	}
	return h1('Colonial office', o ? 'Sponsored by the ' + nm(o) + ' · budget ' + Co.budget(me, o) + (Co.budget(me, o) == 1 ? ' colony' : ' colonies') : rift ? 'The Rift: no power files claims here; build your own, independent' : '')
		+ (mine.length ? '<div class="pt-cols">' + mine.map(card).join('') + '</div>' : '')
		+ '<div class="pt-split"><section class="pt-card pt-table" role="list"><h2>Planner · within one jump (' + jump + ' pc)</h2>' + (rows || '') + '</section><aside class="pt-card pt-side">' + side + '</aside></div>';
}
/* ---------- outfitting: four categories of modules ---------- */
let ofTab = 'core', ofSlot = null, ofLang = '';
const TABS = [['core', 'Core'], ['internal', 'Internal'], ['external', 'External'], ['utility', 'Utility']];
const HP = ['', 'small', 'medium', 'large', 'huge'];
const gname = m => !m ? 'Empty' : O.CAT[m.id].name + (m.size || O.CAT[m.id].grades.length > 1 || m.grade != 'C' ? ' ' : '') + (m.size ? m.size : '') + (O.CAT[m.id].grades.length > 1 || m.grade != 'C' ? m.grade : '') + (m.id == 'decoder' ? ' · ' + ((m.langs || []).map(l => O.langName(l)).join(', ') || 'no languages') : '');
const rateHere = () => here() == 'SU' ? 1 : E.rate(here(), env.day);
function slotsOf(tab) {
	const L = O.layout(env.hullShip), f = P().ship.fit;
	if (tab == 'core') return L.core.map(k => ({cat: 'core', key: k, label: O.CAT[k].name + ' · size ' + L.coreSize, m: f.core[k]}));
	if (tab == 'internal') return L.internal.map((z, i) => ({cat: 'internal', i, label: 'Slot ' + (i + 1) + ' · size ' + z, m: f.internal[i]}));
	if (tab == 'external') return L.external.map((z, i) => ({cat: 'external', i, label: 'Hardpoint ' + (i + 1) + ' · ' + HP[z], m: f.external[i]}));
	return f.utility.map((m, i) => ({cat: 'utility', i, label: 'Mount ' + (i + 1), m}));
}
function effect(m) {
	const sh = env.hullShip, c = O.CAT[m.id];
	if (m.id == 'cargo') return O.rack(m.size) + ' t';
	if (m.id == 'shield') return fmt(O.derive(sh, Object.assign({}, P().ship.fit, {internal: [m]})).shield) + ' shields';
	if (m.id == 'armour') return '+' + fmt(sh.hull * 0.08 * m.size * O.GRADE[m.grade].k) + ' hull';
	if (m.id == 'relay' || m.id == 'alien') return '+' + (m.id == 'alien' ? 1.5 * m.size : 0.35 * m.size * O.GRADE[m.grade].k).toFixed(2) + ' pc';
	if (m.id == 'refinery') return (m.size + 1) + ' bins';
	if (m.id == 'power') return O.powerOf(sh, m).toFixed(1) + ' MW';
	if (m.id == 'decoder') return O.DECODER[m.grade] + ' languages';
	return c.text;
}
function outfitting() {
	const me = P(), sh = env.ship, pw = sh.power, rows = slotsOf(ofTab), cur = here(), rate = rateHere();
	if (!ofSlot || ofSlot.cat != ofTab || !rows.some(r => (r.key || r.i) == (ofSlot.key || ofSlot.i))) ofSlot = rows[0] ? {cat: rows[0].cat, key: rows[0].key, i: rows[0].i} : null;
	const tabs = '<div class="pt-tabs" role="tablist">' + TABS.map(([k, t]) => '<button role="tab" data-oftab="' + k + '" class="' + (k == ofTab ? 'on' : '') + '" aria-selected="' + (k == ofTab) + '">' + t + '</button>').join('') + '</div>';
	const list = rows.map(r => '<button class="pt-row pt-row3' + (ofSlot && (r.key || r.i) == (ofSlot.key || ofSlot.i) ? ' on' : '') + '" data-ofslot="' + (r.key != null ? r.key : r.i) + '"><span class="muted">' + esc(r.label) + '</span><b>' + esc(gname(r.m)) + '</b><span class="num">' + (r.m ? fmt(O.drawOf(r.m), 1) + ' MW' : '') + '</span></button>').join('');
	let side = '<p class="muted">Pick a slot.</p>';
	if (ofSlot) {
		const cur0 = O.at(me.ship.fit, ofSlot), offers = O.offers(env.hullShip, ofSlot, env.port), stored = (me.stored || []).map((m, j) => ({m, j})).filter(x => O.CAT[x.m.id].cat == ofSlot.cat);
		side = '<span class="pt-label">' + esc(ofSlot.cat == 'core' ? 'Core' : ofSlot.cat == 'internal' ? 'Internal' : ofSlot.cat == 'external' ? 'External' : 'Utility') + '</span><div class="pt-big">' + esc(gname(cur0)) + '</div>'
			+ (cur0 ? '<p class="small">' + esc(effect(cur0)) + ' · sells for ' + money(O.price(cur0) * 0.8 * rate, cur) + '</p>' + (ofSlot.cat != 'core' ? '<div class="pt-btns"><button class="pt-ghost" data-act="ofstore">Take out (store)</button><button class="pt-ghost" data-act="ofsell">Take out and sell</button></div>' : '') : '')
			+ (cur0 && cur0.id == 'decoder' ? langLoader(cur0) : '')
			+ (stored.length ? '<h3>In storage</h3>' + stored.map(x => '<div class="pt-claim"><span>' + esc(gname(x.m)) + ' · ' + esc(effect(x.m)) + '</span><span><button class="pt-ghost" data-act="offitstore" data-j="' + x.j + '">Fit</button> ' + (O.CAT[x.m.id].ruins ? '' : '<button class="pt-ghost" data-act="ofsellstore" data-j="' + x.j + '">Sell · ' + money(O.price(x.m) * 0.8 * rate, cur) + '</button> ') + '<button class="pt-ghost" data-act="ofrecycle" data-j="' + x.j + '" title="' + esc(recycleText(x.m)) + '">Recycle</button></span></div>').join('') + '<p class="muted small">Recycling: ' + recycleNote() + '</p>' : '')
			+ '<h3>For sale here</h3>' + (offers.length ? offers.map((o, j) => { const ck = O.install(env.hullShip, me.ship.fit, ofSlot, o); return '<div class="pt-claim"><div><b>' + esc(gname(o)) + '</b><span class="muted small">' + esc(effect(o)) + ' · ' + fmt(O.drawOf(o), 1) + ' MW</span></div><button class="pt-ghost" data-act="ofbuy" data-j="' + j + '"' + (ck.ok ? '' : ' disabled title="' + esc(ck.why) + '"') + '>Buy and fit · ' + money(o.price * rate, cur) + '</button>' + (ck.ok ? '' : '<span class="bad small">' + esc(ck.why) + '</span>') + '</div>' }).join('') : '<p class="muted small">Nothing for this slot here.</p>');
	}
	return h1('Outfitting', sh.name + ' · power ' + pw.draw.toFixed(1) + ' / ' + pw.out.toFixed(1) + ' MW')
		+ '<div class="pt-chips"><span>Hold ' + fmt(sh.cargo) + ' t</span><span>Shields ' + fmt(sh.shield) + '</span><span>Hull ' + fmt(sh.hull) + '</span><span>Jump ' + (sh.jump ? sh.jump.toFixed(1) + ' pc' : 'none') + '</span><span>Tank ×' + sh.tank.toFixed(2) + '</span><span>' + (sh.guns.length ? sh.guns.length + ' weapons' : 'unarmed') + '</span>' + (sh.langs.length ? '<span>Speaks ' + sh.langs.map(O.langName).join(', ') + '</span>' : '') + '</div>'
		+ tabs + '<div class="pt-split"><section class="pt-card pt-table" role="list">' + list + '</section><aside class="pt-card pt-side">' + side + '</aside></div>';
}
const recycleText = m => { const r = O.materials(m); return Object.entries(r.goods).map(([g, t]) => t + ' t ' + g).join(', ') + (r.blueprint ? (Object.keys(r.goods).length ? ', and ' : '') + 'its blueprint' : '') };
const recycleNote = () => { const r = O.recycleRoom(P(), env.star.id, env.day); return r.left > 0 ? r.left + ' more module' + (r.left == 1 ? '' : 's') + ' here this spell (materials to the hold; alien modules give their blueprint back).' : 'this station\'s recyclers are busy until day ' + r.next + '.' };
/* a decoder's languages: load another (from the great powers you know of), or clear them */
function langLoader(m) {
	const cap = O.DECODER[m.grade], have = m.langs || [], opts = F.majors().filter(x => x.id != P().origin && !have.includes(x.id)).sort((a, b) => (F.relation(P().origin, b.id) != 0) - (F.relation(P().origin, a.id) != 0) || a.species.name.localeCompare(b.species.name));
	return '<h3>Languages · ' + have.length + ' of ' + cap + '</h3>' + (have.length ? '<div class="pt-chips">' + have.map(l => '<span>' + esc(O.langName(l)) + '</span>').join('') + '</div>' : '')
		+ (have.length < cap ? '<div class="pt-form"><label>Load<select data-oflang="1">' + opts.map(x => '<option value="' + x.id + '"' + (x.id == ofLang ? ' selected' : '') + '>' + esc(x.species.name) + ' (' + esc(x.name.replace(/^The /, '')) + ')</option>').join('') + '</select></label></div><div class="pt-btns"><button class="pt-ghost" data-act="oflang">Load · ' + money(O.LANG_PRICE * rateHere(), here()) + '</button></div>' : '<p class="muted small">Full: a better grade holds more.</p>');
}
function outfittingOld() {
	const L = C.loadout(env.ship), k = P().combat, guns = {};
	L.guns.forEach((g, i) => { const W = C.WEAPONS[g.kind]; guns[g.kind] = guns[g.kind] || {W, n: 0, ammo: 0}; guns[g.kind].n++; if (W.ammo != null) guns[g.kind].ammo += k && k.ammo && typeof k.ammo[i] == 'number' ? k.ammo[i] : W.ammo });
	const rows = Object.values(guns).map(x => '<dt>' + x.n + ' × ' + esc(x.W.name) + '</dt><dd>' + x.W.dmg + ' dmg × ' + x.W.rate + '/s · ' + fmt(x.W.range) + ' m' + (x.W.ammo != null ? ' · ' + x.ammo + ' rounds' : '') + '</dd>').join('');
	return h1('Outfitting', env.ship.name + ' · hardpoints ' + (env.ship.hard || []).join('/') + ' (S/M/L/H)') + '<div class="pt-grid3"><section class="pt-card"><h2>Weapons</h2>' + (rows ? '<dl>' + rows + '</dl>' : '<p class="muted">Unarmed.</p>') + '</section>'
		+ '<section class="pt-card"><h2>Defences</h2><dl><dt>Shields</dt><dd>' + fmt(env.ship.shield) + '</dd><dt>Hull</dt><dd>' + fmt(env.ship.hull) + ' · ' + Math.round(hull() * 100) + '%</dd><dt>Missiles</dt><dd>' + (k && k.missiles != null ? k.missiles : L.missiles) + ' / ' + L.missiles + '</dd><dt>Flares</dt><dd>' + (k && k.flares != null ? k.flares : L.flares) + ' / ' + L.flares + '</dd></dl></section>'
		+ '<section class="pt-card"><h2>Fittings</h2><p>Every hardpoint carries its size\'s standard weapon: pulse lasers (small), mass drivers with a missile pylon (medium), heavy lasers (large), torpedo racks (huge). Swapping modules arrives with the module catalogue.</p></section></div>';
}

function shipyard() {
	const list = Tr.yard(env.port.cls, env.star, env.day), cur = list[0] ? list[0].price.currency : here();
	if (!sel.ship || !list.some(x => x.ship.id == sel.ship)) sel.ship = (list.find(x => x.ship.id != env.ship.id) || list[0] || {ship: {}}).ship.id;
	const x = list.find(y => y.ship.id == sel.ship), ti = Tr.tradeIn(env.ship, env.star, env.day);
	const rows = list.map(y => '<button class="pt-row pt-row4' + (y.ship.id == sel.ship ? ' on' : '') + '" data-ship="' + y.ship.id + '"><b>' + esc(y.ship.name) + '</b><span>' + y.ship.size + ' ' + esc(y.ship.role) + '</span><span class="muted">' + esc(y.ship.makerName) + '</span><span class="num">' + fmt(y.price.low) + ' – ' + fmt(y.price.high) + '</span></button>').join('');
	let side = '<p class="muted">Nothing for sale.</p>';
	if (x) {
		const s = x.ship, cost = (x.price.low + x.price.high) / 2 - (ti.currency == x.price.currency ? ti.amount : 0), owned = s.id == env.ship.id, tooBig = Tr.held(P()) > s.cargo;
		side = '<span class="pt-label">' + esc(s.size + ' ' + s.role) + '</span><div class="pt-big">' + esc(s.name) + '</div><dl><dt>Yard</dt><dd>' + esc(s.makerName) + '</dd><dt>Quote</dt><dd>' + fmt(x.price.low) + ' – ' + fmt(x.price.high) + ' ' + x.price.currency + '</dd><dt>Hull / shields</dt><dd>' + fmt(s.hull) + ' / ' + fmt(s.shield) + '</dd><dt>Speed, turn</dt><dd>' + s.speed + ' m/s, ' + s.agility + '°/s</dd><dt>Cargo</dt><dd>' + fmt(s.cargo) + ' t</dd><dt>Jump</dt><dd>' + (s.jump ? s.jump + ' pc' : 'no drive') + '</dd><dt>Your ' + esc(env.ship.name) + '</dt><dd>' + fmt(ti.amount) + ' ' + ti.currency + ' in part-exchange</dd></dl>'
			+ '<p class="small">' + (owned ? 'This is your ship.' : tooBig ? 'Your ' + Tr.held(P()) + ' t of cargo won\'t fit its hold.' : 'You pay ' + fmt(Math.max(0, cost)) + ' ' + x.price.currency + (cost < 0 ? ' (you get ' + fmt(-cost) + ' back)' : '') + '.') + '</p>'
			+ '<button class="pt-primary" data-act="buyship"' + (owned || tooBig || (cost > 0 && (P().wallet[x.price.currency] || 0) < cost) ? ' disabled' : '') + '>Buy and transfer cargo</button>';
	}
	return h1('Shipyard', 'Showroom · prices in ' + cur + ', low to high quote') + '<div class="pt-split"><section class="pt-card pt-table" role="list"><div class="pt-thead pt-row4"><span>Ship</span><span>Class</span><span>Yard</span><span class="num">Price ' + cur + '</span></div>' + rows + '</section><aside class="pt-card pt-side">' + side + '</aside></div>';
}
function contacts() {
	const me = P(), o = holder(), d = env.day;
	const codes = F.majors().map(m => m.currency.code), heldCodes = Object.keys(me.wallet).filter(c => me.wallet[c] > 0.005);
	if (!heldCodes.includes(ex.from)) ex.from = heldCodes[0];
	const amt = +ex.amount || 0, q = ex.from && ex.to && ex.from != ex.to && o ? E.exchange(amt || 1, ex.from, ex.to, d, o) : null;
	const issuer = c => F.majors().find(m => m.currency.code == c);
	const opt = (c, s) => '<option value="' + c + '"' + (c == s ? ' selected' : '') + '>' + c + ' · ' + esc(issuer(c).currency.name) + '</option>';
	const bounty = o && me.bounties ? me.bounties[F.byId(o).currency.code] || 0 : 0;
	const fronts = o ? F.wars().filter(w => w.a == o || w.b == o) : [];
	return h1('Contacts', o ? 'The ' + nm(o) + '\'s authority, war office and exchange' : 'Free traders only')
		+ '<div class="pt-grid3"><div class="pt-col"><section class="pt-card"><h2>Authority</h2><dl><dt>Legal status</dt><dd>' + (bounty ? 'Wanted' : 'Clean') + '</dd><dt>Standing</dt><dd>' + (o ? R.tier(me.rep[o] || 0) + ' (' + Math.round(me.rep[o] || 0) + ')' : '—') + '</dd><dt>Bounty here</dt><dd>' + (bounty ? money(bounty, F.byId(o).currency.code) : 'none') + '</dd></dl><button class="pt-ghost" data-act="paybounty"' + (!bounty || (me.wallet[F.byId(o).currency.code] || 0) < bounty ? ' disabled' : '') + '>Pay the bounty</button></section>'
		+ '<section class="pt-card"><h2>War office</h2>' + (o ? fronts.map(w => { const en = w.a == o ? w.b : w.a; return '<div class="pt-front"><span>Front vs ' + esc(nm(en)) + '</span><span class="gold">' + w.systems.length + ' systems</span></div>' }).join('') || '<p class="muted">At peace.</p>' : '<p class="muted">None here.</p>')
		+ (o ? '<p class="small">' + (me.commission ? 'Commissioned with the ' + esc(nm(me.commission)) + '.' : 'A commission makes your kills on contested ground count double for this power, and its enemies\' ships fight you on sight.') + '</p><button class="pt-ghost" data-act="enlist"' + (me.commission == o || rel(o) < 0 ? ' disabled' : '') + '>' + (me.commission == o ? 'Commissioned here' : 'Enlist with the ' + esc(nm(o))) + '</button>' : '') + '</section>'
		+ insurance()
		+ broker()
		+ '<section class="pt-card"><h2>Colonial office</h2><p class="small">' + (o ? 'Claim a system within one jump and build a port there, sponsored by the ' + esc(nm(o)) + '. ' + ((me.colonies || []).length ? 'You hold ' + me.colonies.filter(c => c.stage != 'lapsed').length + '.' : '') : 'No sponsor while the system is fought over.') + '</p><button class="pt-ghost" data-screen="colonies"' + (o ? '' : ' disabled') + '>Open the colonial office</button></section></div>'
		+ '<section class="pt-card pt-span2"><h2>Exchange</h2>' + (o ? '<p class="muted small">Spread: 1.5% for the ' + esc(nm(o)) + '\'s own coin, 3% for an ally\'s, 5% for a neutral\'s; an enemy\'s coin is refused.</p>'
		+ '<div class="pt-form"><label>From<select data-ex="from">' + heldCodes.map(c => opt(c, ex.from)).join('') + '</select></label><label>To<select data-ex="to">' + codes.map(c => opt(c, ex.to)).join('') + '</select></label><label>Amount<input data-ex="amount" inputmode="decimal" value="' + esc(ex.amount) + '" placeholder="0"></label></div>'
		+ '<div class="pt-btns"><button class="pt-ghost" data-act="expct" data-n="0.25">25%</button><button class="pt-ghost" data-act="expct" data-n="0.5">50%</button><button class="pt-ghost" data-act="expct" data-n="1">All</button>'
		+ '<button class="pt-primary" data-act="exchange"' + (!q || !q.ok || !amt || amt > (me.wallet[ex.from] || 0) ? ' disabled' : '') + '>Change</button></div>'
		+ '<p class="small">' + (!q ? 'Pick two different currencies.' : !q.ok ? esc(q.why) : 'You receive ' + fmt(amt ? q.amount : 0, 2) + ' ' + ex.to + ' · rate ' + E.crossRate(ex.from, ex.to, d).toFixed(4) + ' · spread ' + (q.spread * 100).toFixed(1) + '%') + '</p>'
		+ '<div class="pt-wallet">' + Object.entries(me.wallet).filter(([, a]) => a > 0.005).map(([c, a]) => '<span><b>' + money(a, c) + '</b> ≈ ' + fmt(a / E.rate(c, d)) + ' SU</span>').join('') + '</div>' : '<p>Free traders change money at an 8% cut when you buy or sell.</p>') + '</section></div>';
}
/* the insurer's desk (insurance.js): your policy, and one from this port's power */
function insurance() {
	const me = P(), d = env.day, o = holder(), I = Ins.ensure(me, d), here = o && F.byId(o), wk = Ins.premium(me, env.hullShip, me.ship.fit, d);
	const quote = here ? Ins.INSURE.weekly * Ins.shipValue(env.hullShip, me.ship.fit) * E.rate(here.currency.code, d) : 0;
	const mine = I && here && I.provider == o;
	return '<section class="pt-card"><h2>Insurance</h2>' + (I ? '<dl><dt>Insurer</dt><dd>' + esc(nm(I.provider)) + '</dd><dt>Premium</dt><dd>' + money(wk.amount, wk.code) + ' a week</dd><dt>Paid to</dt><dd>day ' + Math.floor(I.paidTo) + '</dd>' + (I.owed > 0 ? '<dt>Owed</dt><dd class="bad">' + money(I.owed, I.code) + '</dd>' : '') + '</dl>' : '<p class="bad small">Not insured: lose the ship and you start again at home in a starter ship.</p>')
		+ '<p class="muted small">10% of your ship\'s whole value a week. Lose it and you wake at the nearest port within 1,000 ly trading in the policy\'s currency (or whose exchange takes it), with the ship as it was, once anything owed is settled; if it can\'t be, at home in a starter ship.</p>'
		+ (here && !mine ? '<button class="pt-primary" data-act="insure"' + ((me.wallet[here.currency.code] || 0) < quote || (I && I.owed > 0) ? ' disabled' : '') + '>' + (I ? 'Switch to' : 'Insure with') + ' the ' + esc(nm(o)) + ': ' + money(quote, here.currency.code) + ' a week</button>' : '')
		+ (I && I.owed > 0 ? ' <button class="pt-ghost" data-act="inspay"' + ((me.wallet[I.code] || 0) <= 0 ? ' disabled' : '') + '>Pay what\'s owed</button>' : '')
		+ (I ? ' <button class="pt-ghost" data-act="inscancel">Cancel the policy</button>' : '') + '</section>';
}
function status() {
	const me = P(), d = env.day;
	const reps = F.majors().filter(m => (me.rep[m.id] || 0) != 0 || m.id == me.origin).sort((a, b) => (me.rep[b.id] || 0) - (me.rep[a.id] || 0)).slice(0, 14);
	return h1('Commander & ship') + '<div class="pt-split"><section class="pt-card pt-side pt-wide"><h2>Commander</h2><dl><dt>Origin</dt><dd>' + esc(nm(me.origin)) + ' · ' + esc(me.species) + '</dd><dt>Worth</dt><dd>' + fmt(Tr.worth(me, d)) + ' SU</dd><dt>Lawful</dt><dd>' + me.lawful + '</dd><dt>Commission</dt><dd>' + (me.commission ? esc(nm(me.commission)) : 'none') + '</dd></dl>'
		+ '<h2>Wallet</h2><div class="pt-wallet">' + Object.entries(me.wallet).filter(([, a]) => a > 0.005).map(([c, a]) => '<span><b>' + money(a, c) + '</b> ≈ ' + fmt(a / E.rate(c, d)) + ' SU</span>').join('') + '</div>'
		+ '<h2>Hold · ' + Tr.held(me) + ' / ' + env.ship.cargo + ' t</h2><div class="pt-chips">' + (Object.entries(me.cargo).map(([g, n]) => '<span>' + n + ' t ' + g + '</span>').join('') || '<span class="muted">empty</span>') + '</div>'
		+ '<h2>Ship</h2><dl><dt>Hull</dt><dd>' + esc(env.ship.name + ' ' + env.ship.size + ' ' + env.ship.role) + '</dd><dt>Jump</dt><dd>' + (env.ship.jump ? env.ship.jump + ' pc' : 'none') + '</dd><dt>Fuel</dt><dd>' + Math.round(env.fuel() * 100) + '% of ' + Tr.tank(env.ship) + ' t</dd><dt>Hull</dt><dd>' + Math.round(hull() * 100) + '%</dd><dt>Modules down</dt><dd>' + M.alerts(env.fit).length + '</dd></dl>'
		+ (Object.keys(me.refinery || {}).length ? '<h2>Refinery bins</h2>' + Object.entries(me.refinery).map(([g, t]) => '<div class="pt-claim"><span>' + g + ' · ' + t.toFixed(2) + ' t</span><button class="pt-ghost" data-act="purge" data-g="' + g + '">Empty the bin</button></div>').join('') : '')
		+ '<h2>War missions</h2>' + ((me.missions || []).map(m => '<p><b>' + esc(m.text) + '</b><br><span class="small">' + esc(En.need(m)) + ' · due day ' + m.due + ' · ' + money(m.reward, m.currency) + '</span></p>').join('') || '<p class="muted">None. Take contracts at a bulletin board.</p>') + '</section>'
		+ '<section class="pt-card pt-table"><h2>Reputation</h2>' + reps.map(m => { const v = Math.round(me.rep[m.id] || 0), t = R.tier(v); return '<div class="pt-rep"><span>' + esc(m.name.replace(/^The /, '')) + '</span><span class="num">' + (v > 0 ? '+' : '') + v + '</span><span class="' + (v >= 100 ? 'good' : v < -100 ? 'bad' : 'muted') + '">' + t + '</span></div>' }).join('') + '</section></div>';
}

/* ---------- actions ---------- */
function click(e) {
	const t = e.target.closest('button'); if (!t || t.disabled) return;
	if (t.dataset.screen) { screen = t.dataset.screen; env.cue('tick'); if (screen == 'launch') {} render(); focusScreen(); return }
	if (t.dataset.good) { sel.good = t.dataset.good; render(); const b = root.querySelector('[data-good="' + sel.good + '"]'); if (b) b.focus(); return }
	if (t.dataset.oftab) { ofTab = t.dataset.oftab; ofSlot = null; render(); const b = root.querySelector('[data-oftab="' + ofTab + '"]'); if (b) b.focus(); return }
	if (t.dataset.ofslot != null) { const v = t.dataset.ofslot; ofSlot = ofTab == 'core' ? {cat: 'core', key: v} : {cat: ofTab, i: +v}; render(); const b = root.querySelector('[data-ofslot="' + v + '"]'); if (b) b.focus(); return }
	if (t.dataset.col) { colSel = t.dataset.col; render(); const b = root.querySelector('[data-col="' + colSel + '"]'); if (b) b.focus(); return }
	if (t.dataset.ship) { sel.ship = t.dataset.ship; render(); const b = root.querySelector('[data-ship="' + sel.ship + '"]'); if (b) b.focus(); return }
	const me = P(), act = t.dataset.act, d = env.day;
	if (act == 'launch') { const l = env.onLaunch; close(); l(); return }
	if (act == 'refuel') { const c = Tr.refuelCost(env.ship, env.fuel(), mkt), r = Tr.pay(me, c, here(), d); if (r.ok) { env.setFuel(1); env.say('Refuelled: ' + money(r.amount, r.code)); env.cue('clearance') } else env.say('Not enough ' + r.code + ' to refuel') }
	if (lockedHere() && act && !['refuel', 'launch', 'purge'].includes(act)) { env.say('Untranslated: you can\'t make yourself understood here. Fit a linguistic decoder for the ' + O.langName(O.langOf(holder())) + '.'); env.cue('refused'); return }
	if (act == 'repair') { const c = Tr.repairCost(env.ship, env.fit, mkt, d, hull()), r = Tr.pay(me, c, here(), d); if (r.ok) { M.repair(env.fit); me.combat = Object.assign(me.combat || {}, {hull: 1}); env.say('Repaired: ' + money(r.amount, r.code)); env.cue('clearance') } else env.say('Not enough ' + r.code + ' to repair') }
	if (act == 'buy') { const n = t.dataset.n == 'max' ? Tr.canBuy(me, env.ship, mkt, sel.good, d) : 1, r = Tr.buy(me, env.ship, mkt, sel.good, n, d); if (r.ok) { env.say('Bought ' + r.qty + ' t ' + sel.good + ' for ' + money(r.paid.amount, r.paid.code)); env.cue('tick') } }
	if (act == 'sell') { const n = t.dataset.n == 'all' ? me.cargo[sel.good] || 0 : 1, r = Tr.sell(me, mkt, sel.good, n, d); if (r.ok) { env.say('Sold ' + r.qty + ' t ' + sel.good + ' for ' + money(r.got.amount, r.got.code) + (Math.abs(r.profit) > 0.5 ? ' (' + (r.profit > 0 ? '+' : '') + fmt(r.profit) + ' SU)' : '')); env.cue('tick') } }
	if (act == 'buyship') { const extra = O.extra(env.hullShip, me.ship.fit), r = Tr.buyShip(me, env.ship.id, sel.ship, env.star, d); if (r.ok) { if (extra > 0) Tr.receive(me, extra * 0.8 * rateHere(), here(), d); env.onShip(sel.ship); env.say('Bought a ' + env.ship.name + ': paid ' + fmt(Math.max(0, r.cost)) + ' ' + r.currency); env.cue('docked') } else env.say(r.why == 'hold' ? 'Your cargo won\'t fit its hold' : 'Not enough ' + (r.code || '') + ' for that ship') }
	if (act == 'restock') { const c = restockCost(), r = Tr.pay(me, c.cost, here(), d); if (r.ok) { me.combat = C.refill(env.ship, me.combat); env.say('Restocked: ' + fmt(c.tons, 1) + ' t of munitions for ' + money(r.amount, r.code)); env.cue('clearance') } else env.say('Not enough ' + r.code + ' to restock') }
	if (act == 'accept') { const m = En.offers(me, env.port, d).find(x => x.id == t.dataset.m), r = m ? En.accept(me, m, d) : {ok: false, why: 'That contract has gone.'}; env.say(r.ok ? 'Mission accepted: ' + m.text + ' (due day ' + r.mission.due + ')' : r.why); env.cue(r.ok ? 'clearance' : 'refused') }
	if (act == 'acceptx') { const m = X.offers(me, env.star, env.port, d).find(x => x.id == t.dataset.m), r = m ? X.accept(me, m, d) : {ok: false, why: 'That contract has gone.'}; env.say(r.ok ? 'Contract accepted: ' + m.text + ' (due day ' + r.mission.due + ')' : r.why); env.cue(r.ok ? 'clearance' : 'refused') }
	if (act == 'selldata') { const o = holder(), r = X.sell(me, o, o ? here() : 'SU', d); env.say(r.ok ? 'Sold ' + r.items + ' charts and surveys for ' + money(r.amount, r.code) : r.why); env.cue(r.ok ? 'docked' : 'refused') }
	if (act == 'rename') { const k = t.dataset.k, r = X.rename(me, k, naming[k] || ''); env.say(r.ok ? 'Named: ' + r.name + '. The name goes in the charts.' : r.why); env.cue(r.ok ? 'clearance' : 'refused'); if (r.ok) delete naming[k] }
	if (act == 'claim') { const st = Co.candidates(me, {star: env.star, owner: holder()}, d, env.ship.jump || 0, 10).find(x => x.id == colSel), r = st ? Co.claim(me, {star: env.star, owner: holder()}, st, t.dataset.k, d, env.ship.jump || 0) : {ok: false, why: 'Pick a system.'}; env.say(r.ok ? 'Claim filed on ' + st.name + ': fly there by day ' + r.colony.beaconBy + ' and press N near ' + r.colony.world + ' to drop the beacon.' : r.why); env.cue(r.ok ? 'docked' : 'refused') }
	if (act && act.startsWith('of')) { outfitAct(act, t, me, d); }
	if (act == 'bpbuild') {
		const bp = (me.blueprints || [])[+t.dataset.j], r = bp ? O.build(me, bp, fee => Tr.pay(me, fee * rateHere(), here(), d), {coreSize: O.layout(env.hullShip).coreSize, held: Tr.held(me)}) : {ok: false, why: 'No such blueprint.'};
		if (r.ok && r.hull) {
			/* a Precursor hull: your ship (and what's fitted beyond stock) goes in part-exchange */
			const ti = Tr.tradeIn(env.hullShip, env.star, d), extra = O.extra(env.hullShip, me.ship.fit);
			Tr.receive(me, ti.amount, ti.currency, d); if (extra > 0) Tr.receive(me, extra * 0.8 * rateHere(), here(), d);
			me.ship.model = r.hull; env.onShip(r.hull);
			env.say('The broker built the ' + env.ship.name + ', a Precursor hull: your old ship went in part-exchange (' + fmt(ti.amount) + ' ' + ti.currency + ').'); env.cue('docked');
		} else { env.say(r.ok ? 'The broker built the ' + O.bpName(bp) + ': it\'s in storage, ready to fit at the outfitter.' : r.why); env.cue(r.ok ? 'docked' : 'refused') }
	}
	if (act == 'purge') { delete (me.refinery || {})[t.dataset.g]; env.say('Emptied the ' + t.dataset.g + ' bin'); env.cue('tick') }
	if (act == 'claimi') { const st = Co.candidates(me, {star: env.star, owner: holder()}, d, env.ship.jump || 0, 10).find(x => x.id == colSel), r = st ? Co.claim(me, {star: env.star, owner: holder()}, st, t.dataset.k, d, env.ship.jump || 0, true) : {ok: false, why: 'Pick a system.'}; env.say(r.ok ? 'Independent claim filed on ' + st.name + ' (scrip ' + r.colony.scrip + '): drop the beacon by day ' + r.colony.beaconBy + ' near ' + r.colony.world + '.' : r.why); env.cue(r.ok ? 'docked' : 'refused') }
	if (act == 'rent') { const c = (me.colonies || []).find(x => x.id == t.dataset.c), r = c ? Co.rent(me, c, t.dataset.m, d, here()) : {ok: false, why: 'No such colony.'}; env.say(r.ok ? r.carrier.name + ' will park at ' + c.star.name + ' until day ' + r.carrier.until : r.why); env.cue(r.ok ? 'clearance' : 'refused') }
	if (act == 'haul') { const c = (me.colonies || []).find(x => x.id == t.dataset.c), r = c ? Co.postHaul(me, {star: env.star, owner: holder()}, mkt, c, t.dataset.g, +t.dataset.n, d, t.dataset.j) : {ok: false, why: 'No such colony.'}; env.say(r.ok ? 'Haulage contracted: ' + r.quote.tons + ' t ' + r.quote.good + ' by ' + r.quote.ship + ', ' + r.quote.days + (r.quote.days == 1 ? ' day' : ' days') : r.why); env.cue(r.ok ? 'clearance' : 'refused') }
	if (act == 'startbuild') { const c = (me.colonies || []).find(x => x.id == t.dataset.c), pk = pick[c.id], [body, where] = pk.at.split('|'), r = Co.startBuild(c, Co.starOf(c), pk.fac, body, where, d); env.say(r.ok ? 'Building ' + Co.FAC[pk.fac].name + ' at ' + body + ': bring ' + fmt(Object.values(r.build.need).reduce((a, b) => a + b, 0)) + ' t of goods' : r.why); env.cue(r.ok ? 'clearance' : 'refused') }
	if (act == 'givebuild') { const c = (me.colonies || []).find(x => x.id == t.dataset.c), r = Co.deliverBuilds(me, c, d), g = Object.entries(r.gave); env.say(g.length ? 'Handed over ' + g.map(([k, v]) => v + ' t ' + k).join(', ') + (r.done.length ? '. Built: ' + r.done.map(b => Co.FAC[b.fac].name).join(', ') : '') : 'Nothing in your hold the builds need'); env.cue(g.length ? 'docked' : 'refused') }
	if (act == 'expct') { ex.amount = String(Math.floor((me.wallet[ex.from] || 0) * +t.dataset.n * 100) / 100) }
	if (act == 'insure') { const r = Ins.insure(me, holder(), env.hullShip, me.ship.fit, d); env.say(r.ok ? 'Insured with the ' + nm(holder()) + ': ' + money(r.amount, r.code) + ' paid for the first week.' : r.why); env.cue(r.ok ? 'tick' : 'refused') }
	if (act == 'inspay') { const I = me.insurance, take = Math.min(I.owed, me.wallet[I.code] || 0); me.wallet[I.code] -= take; I.owed -= take; if (I.owed < 1e-6) I.owed = 0; env.say('Paid ' + money(take, I.code) + ' on your policy' + (I.owed ? '; ' + money(I.owed, I.code) + ' still owed.' : '.')); env.cue('tick') }
	if (act == 'inscancel') { Ins.cancel(me); env.say('Policy cancelled. Lose the ship now and you start again at home in a starter ship.'); env.cue('refused') }
	if (act == 'exchange') { const r = Tr.exchange(me, +ex.amount, ex.from, ex.to, d, holder()); if (r.ok) { env.say('Changed ' + money(+ex.amount, ex.from) + ' into ' + money(r.got, ex.to)); ex.amount = ''; env.cue('tick') } else env.say(r.why || 'The exchange refused') }
	if (act == 'paybounty') { const c = F.byId(holder()).currency.code, b = me.bounties[c]; if (Tr.pay(me, b, c, d).ok) { delete me.bounties[c]; env.say('Bounty paid') } }
	if (act == 'enlist') { R.enlist(me, holder()); env.say('Commissioned with the ' + nm(holder())) }
	const keep = act; render();
	const again = root.querySelector('[data-act="' + keep + '"]:not([disabled])'); if (again) again.focus();
}
/* buying, fitting, storing and selling modules; a fit change goes back to the game (env.onRefit) */
function outfitAct(act, t, me, d) {
	const sh = env.hullShip, rate = rateHere(), cur = here(), done = (msg, fit) => { if (fit) me.ship.fit = fit; env.onRefit(); env.say(msg); env.cue('clearance') };
	const holdOk = fit => Tr.held(me) <= O.holdOf(sh, fit);
	if (act == 'ofbuy') {
		const o = O.offers(sh, ofSlot, env.port)[+t.dataset.j]; if (!o) return;
		const m = {id: o.id, size: o.size, grade: o.grade}; if (m.id == 'decoder') m.langs = [];
		const r = O.install(sh, me.ship.fit, ofSlot, m); if (!r.ok) { env.say(r.why); env.cue('refused'); return }
		if (!holdOk(r.fit)) { env.say('Your cargo wouldn\'t fit: sell some first'); env.cue('refused'); return }
		const p = Tr.pay(me, o.price * rate, cur, d); if (!p.ok) { env.say('Not enough ' + p.code + ' for it'); env.cue('refused'); return }
		if (r.old) (me.stored = me.stored || []).push(r.old);
		done('Fitted: ' + gname(m) + ' for ' + money(p.amount, p.code) + (r.old ? '. ' + gname(r.old) + ' went to storage.' : ''), r.fit);
	}
	if (act == 'ofstore' || act == 'ofsell') {
		const r = O.remove(sh, me.ship.fit, ofSlot); if (!r.ok) { env.say(r.why); env.cue('refused'); return }
		if (!holdOk(r.fit)) { env.say('Your cargo wouldn\'t fit: sell some first'); env.cue('refused'); return }
		if (act == 'ofstore') { (me.stored = me.stored || []).push(r.old); done(gname(r.old) + ' taken out and stored', r.fit) }
		else { Tr.receive(me, O.price(r.old) * 0.8 * rate, cur, d); done(gname(r.old) + ' sold for ' + money(O.price(r.old) * 0.8 * rate, cur), r.fit) }
	}
	if (act == 'offitstore') {
		const j = +t.dataset.j, m = me.stored[j], r = O.install(sh, me.ship.fit, ofSlot, m); if (!r.ok) { env.say(r.why); env.cue('refused'); return }
		if (!holdOk(r.fit)) { env.say('Your cargo wouldn\'t fit: sell some first'); env.cue('refused'); return }
		me.stored.splice(j, 1); if (r.old) me.stored.push(r.old);
		done('Fitted from storage: ' + gname(m), r.fit);
	}
	if (act == 'ofrecycle') { const r = O.recycle(me, +t.dataset.j, env.star.id, d, env.ship.cargo); if (!r.ok) { env.say(r.why); env.cue('refused'); return } done('Recycled ' + gname(r.module) + ': ' + (Object.entries(r.goods).map(([g, n]) => n + ' t ' + g).join(', ') || 'nothing worth keeping') + (r.blueprint ? ', and the blueprint back' : '')); return }
	if (act == 'ofsellstore') { const j = +t.dataset.j, m = me.stored[j]; me.stored.splice(j, 1); Tr.receive(me, O.price(m) * 0.8 * rate, cur, d); done(gname(m) + ' sold for ' + money(O.price(m) * 0.8 * rate, cur)) }
	if (act == 'oflang') {
		const m = O.at(me.ship.fit, ofSlot), l = ofLang || (root.querySelector('[data-oflang]') || {}).value; if (!m || m.id != 'decoder' || !l) return;
		if ((m.langs || []).length >= O.DECODER[m.grade]) { env.say('That decoder is full'); env.cue('refused'); return }
		const p = Tr.pay(me, O.LANG_PRICE * rate, cur, d); if (!p.ok) { env.say('Not enough ' + p.code); env.cue('refused'); return }
		m.langs = [...(m.langs || []), l]; ofLang = '';
		done('Loaded the ' + O.langName(l) + ' language into the decoder');
	}
}
function input(e) {
	if (e.target.dataset.oflang) { ofLang = e.target.value; return }
	if (e.target.dataset.pick) { const id = e.target.dataset.c, k = e.target.dataset.pick; pick[id] = pick[id] || {}; pick[id][k] = e.target.value; render(); const el = root.querySelector('[data-pick="' + k + '"][data-c="' + id + '"]'); if (el) el.focus(); return }
	if (e.target.dataset.name) { naming[e.target.dataset.name] = e.target.value; return }
	const k = e.target.dataset.ex; if (!k) return;
	ex[k] = e.target.value;
	if (k != 'amount') { render(); const s = root.querySelector('[data-ex="' + k + '"]'); if (s) s.focus() }
	else { const pos = e.target.selectionStart; render(); const i = root.querySelector('[data-ex="amount"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos) } catch (x) {} } }
}
function key(e) {
	if (e.target.tagName == 'INPUT' || e.target.tagName == 'SELECT') return;
	const n = /^F([1-9])$/.exec(e.key) || /^([1-9])$/.exec(e.key);
	if (n) { e.preventDefault(); screen = SCREENS[+n[1] - 1][0]; render(); focusScreen() }
}
function focusScreen() { const b = root.querySelector('.pt-main button:not([disabled]), .pt-main select') || root.querySelector('[data-screen="' + screen + '"]'); if (b) b.focus() }

window.EmberPort = {open, close, isOpen: () => !!env};
})();
