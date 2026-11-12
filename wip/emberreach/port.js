/* ===== Ember Reach: the starport, docked (docs/plan-ember-reach.md, M3; the design canvas's "starport menu").
   Frontier's layout, modern finish: a status strip on top (port, holder, day, the local currency's rate, cargo,
   legal standing, money here); Elite Dangerous's services row (refuel, repair, restock); one screen at a time, chosen
   from the function bar along the bottom (F1–F9, or 1–9): Launch, Station, Market, Bulletin board, Shipyard,
   Outfitting, Contacts (authority, war office, exchange), Cartographics and lounges, Status.
   Everything is real: the market (economy.js) in the holder's currency, the exchange's spreads, the yard's stock
   and part-exchange (trade.js), the war office's contracts (factions.js), your reputation (reputation.js).
   EmberPort.open(env): env = {P, ship (stats), fit, fuel(), setFuel(f), star, port, stationName, day, onLaunch(),
   onShip(id), say(text), cue(name)}. M4: restocking munitions, repairs that mend the hull too, war contracts taken at
   the bulletin board, and the missions in hand on the Status screen.
   GPL-2.0-or-later. ===== */
(function () {
'use strict';
const G = window.EmberGalaxy, F = window.EmberFactions, E = window.EmberEconomy, S = window.EmberShips, M = window.EmberModules, R = window.EmberReputation, Tr = window.EmberTrade,
	C = window.EmberCombat, En = window.EmberEncounters;
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

let env = null, root = null, screen = 'station', sel = {good: null, ship: null}, ex = {from: null, to: null, amount: ''}, mkt = null;
function open(e) {
	env = e; root = document.getElementById('port'); root.hidden = false;
	mkt = E.market(env.star, env.day);
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
	const top = '<header class="pt-top"><div class="pt-name"><b>' + esc(env.stationName) + '</b><span>' + esc(o ? o.name.replace(/^The /, '') : 'free traders') + (mkt.contested ? ' · contested' : '') + '</span></div><div class="pt-stats">'
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
function body() {
	switch (screen) {
	case 'launch': return h1('Launch') + '<section class="pt-card pt-narrow"><p>Leave ' + esc(env.stationName) + '. Fuel ' + Math.round(env.fuel() * 100) + '%, cargo ' + Tr.held(P()) + ' t, ' + M.alerts(env.fit).length + ' modules down.</p><button class="pt-primary" data-act="launch">Request launch</button></section>';
	case 'station': return station();
	case 'market': return market();
	case 'bulletin': return bulletin();
	case 'shipyard': return shipyard();
	case 'outfitting': return outfitting();
	case 'contacts': return contacts();
	case 'carto': return h1('Cartographics & lounges') + '<div class="pt-grid3">' + ['Universal cartographics|Sell scans of the systems you surveyed. Exploration (scanning, surveys, ruins) arrives in M5.', 'Passenger lounge|Travellers looking for berths. Passenger contracts arrive with missions.', 'Crew lounge|Pilots and gunners for larger hulls, paid each season. Crew arrive with the larger ships\' needs.'].map(x => { const [a, b] = x.split('|'); return '<section class="pt-card"><h2>' + a + '</h2><p>' + b + '</p></section>' }).join('') + '</div>';
	case 'status': return status();
	}
	return '';
}
function station() {
	const st = env.star, sy = G.system(st), o = holder() ? F.byId(holder()) : null, me = P();
	const rows = [['Star', (st.cls || st.kind) + ' class · ' + st.M.toFixed(2) + ' suns'], ['Port', (env.port.capital ? 'Capital · ' : '') + env.stationName], ['From the centre', fmt(G.mRad(st.x, st.y, st.z)) + ' pc'],
		['Holder', o ? o.name.replace(/^The /, '') + (mkt.contested ? ' (contested)' : '') : 'nobody: free traders'], ['Your standing', o ? R.tier(me.rep[o.id] || 0) + ' (' + Math.round(me.rep[o.id] || 0) + ')' : '—']];
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
	return h1('Market', cur != 'SU' ? 'Prices in ' + cur + '; SU = standard units' : 'Fought over: free traders deal in SU, taking your coin at an 8% cut')
		+ '<div class="pt-split"><section class="pt-card pt-table" role="list"><div class="pt-thead"><span>Good</span><span class="num">Price ' + cur + '</span><span class="num">Value SU</span><span class="num">Buys</span><span class="num">Held</span><span class="num">Paid SU</span></div>' + rows + '</section>'
		+ '<aside class="pt-card pt-side"><span class="pt-label">Selected</span><div class="pt-big">' + g + '</div><dl><dt>Price</dt><dd>' + fmt(q.price, 1) + ' ' + cur + '/t</dd><dt>Value</dt><dd>' + fmt(q.su, 1) + ' SU</dd><dt>Station buys</dt><dd>' + (q.buy ? 'Yes' : 'No') + '</dd><dt>In your hold</dt><dd>' + have + ' t</dd><dt>Free space</dt><dd>' + Tr.free(me, env.ship) + ' t</dd>'
		+ (profit != null ? '<dt>If sold here</dt><dd class="' + (profit >= 0 ? 'good' : 'bad') + '">' + (profit >= 0 ? '+' : '') + fmt(profit) + ' SU</dd>' : '') + '</dl>'
		+ '<div class="pt-btns"><button class="pt-primary" data-act="buy" data-n="1"' + (can < 1 ? ' disabled' : '') + '>Buy 1 t</button><button class="pt-primary" data-act="buy" data-n="max"' + (can < 1 ? ' disabled' : '') + '>' + (can > 1 ? 'Buy ' + can + ' t' : 'Buy the most') + '</button>'
		+ '<button class="pt-ghost" data-act="sell" data-n="1"' + (!q.buy || !have ? ' disabled' : '') + '>Sell 1 t</button><button class="pt-ghost" data-act="sell" data-n="all"' + (!q.buy || !have ? ' disabled' : '') + '>Sell all</button></div>'
		+ '<p class="muted small">' + (noMoney ? 'You hold no ' + cur + ': change money at Contacts (F7).' : !q.buy ? 'This port doesn\'t buy ' + g.toLowerCase() + '.' : Tr.free(me, env.ship) <= 0 ? 'The hold is full.' : 'Prices follow the ' + (cur == 'SU' ? 'day' : cur + ' rate') + ', local supply and the season.') + '</p></aside></div>';
}
/* the war office's contracts: take one, do it in its system within 10 days, and be paid (up to three at once) */
const pc = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const HOW = {kills: 'Destroy 3 enemy ships there', stay: 'Stay 30 s in the system', depot: 'Destroy the supply depot', deliver: 'Bring 5 t of Munitions and dock there'};
function bulletin() {
	const o = holder(), me = P();
	if (!o) return h1('Bulletin board') + '<section class="pt-card pt-narrow"><p>No great power posts here while the system is fought over.</p></section>';
	const ms = En.offers(me, env.port, env.day), held = (me.missions || []).length, here = [env.star.x, env.star.y, env.star.z];
	const ad = m => { const st = En.missionStar(m), d = st ? pc(here, st.at) : 0; return '<div class="pt-ad"><span class="tag">' + esc(m.type) + '</span><div><b>' + esc(m.text) + '</b><span class="muted">' + esc('against the ' + nm(m.against) + ' · ' + d.toFixed(1) + ' pc · ' + HOW[En.NEEDS[m.type]]) + '</span></div><span class="gold num">' + money(m.reward, m.currency) + '</span>'
		+ '<button class="pt-ghost" data-act="accept" data-m="' + esc(m.id) + '"' + (held >= En.ENC.maxMissions ? ' disabled' : '') + '>Accept</button></div>' };
	return h1('Bulletin board', 'The ' + nm(o) + '\'s war office') + '<section class="pt-card"><div class="pt-list">' + (ms.length ? ms.map(ad).join('') : '<p class="muted">No war contracts today.</p>') + '</div><p class="muted small">' + (held ? 'You hold ' + held + ' of ' + En.ENC.maxMissions + ' war missions (Status, F9). ' : '') + 'Missions are due in 10 days; the work counts on the front, double with a commission. Taking one makes its enemy\'s ships fight you there.</p></section>';
}
function outfitting() {
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
		+ (o ? '<p class="small">' + (me.commission ? 'Commissioned with the ' + esc(nm(me.commission)) + '.' : 'A commission makes your kills on contested ground count double for this power, and its enemies\' ships fight you on sight.') + '</p><button class="pt-ghost" data-act="enlist"' + (me.commission == o || rel(o) < 0 ? ' disabled' : '') + '>' + (me.commission == o ? 'Commissioned here' : 'Enlist with the ' + esc(nm(o))) + '</button>' : '') + '</section></div>'
		+ '<section class="pt-card pt-span2"><h2>Exchange</h2>' + (o ? '<p class="muted small">Spread: 1.5% for the ' + esc(nm(o)) + '\'s own coin, 3% for an ally\'s, 5% for a neutral\'s; an enemy\'s coin is refused.</p>'
		+ '<div class="pt-form"><label>From<select data-ex="from">' + heldCodes.map(c => opt(c, ex.from)).join('') + '</select></label><label>To<select data-ex="to">' + codes.map(c => opt(c, ex.to)).join('') + '</select></label><label>Amount<input data-ex="amount" inputmode="decimal" value="' + esc(ex.amount) + '" placeholder="0"></label></div>'
		+ '<div class="pt-btns"><button class="pt-ghost" data-act="expct" data-n="0.25">25%</button><button class="pt-ghost" data-act="expct" data-n="0.5">50%</button><button class="pt-ghost" data-act="expct" data-n="1">All</button>'
		+ '<button class="pt-primary" data-act="exchange"' + (!q || !q.ok || !amt || amt > (me.wallet[ex.from] || 0) ? ' disabled' : '') + '>Change</button></div>'
		+ '<p class="small">' + (!q ? 'Pick two different currencies.' : !q.ok ? esc(q.why) : 'You receive ' + fmt(amt ? q.amount : 0, 2) + ' ' + ex.to + ' · rate ' + E.crossRate(ex.from, ex.to, d).toFixed(4) + ' · spread ' + (q.spread * 100).toFixed(1) + '%') + '</p>'
		+ '<div class="pt-wallet">' + Object.entries(me.wallet).filter(([, a]) => a > 0.005).map(([c, a]) => '<span><b>' + money(a, c) + '</b> ≈ ' + fmt(a / E.rate(c, d)) + ' SU</span>').join('') + '</div>' : '<p>Free traders change money at an 8% cut when you buy or sell.</p>') + '</section></div>';
}
function status() {
	const me = P(), d = env.day;
	const reps = F.majors().filter(m => (me.rep[m.id] || 0) != 0 || m.id == me.origin).sort((a, b) => (me.rep[b.id] || 0) - (me.rep[a.id] || 0)).slice(0, 14);
	return h1('Commander & ship') + '<div class="pt-split"><section class="pt-card pt-side pt-wide"><h2>Commander</h2><dl><dt>Origin</dt><dd>' + esc(nm(me.origin)) + ' · ' + esc(me.species) + '</dd><dt>Worth</dt><dd>' + fmt(Tr.worth(me, d)) + ' SU</dd><dt>Lawful</dt><dd>' + me.lawful + '</dd><dt>Commission</dt><dd>' + (me.commission ? esc(nm(me.commission)) : 'none') + '</dd></dl>'
		+ '<h2>Wallet</h2><div class="pt-wallet">' + Object.entries(me.wallet).filter(([, a]) => a > 0.005).map(([c, a]) => '<span><b>' + money(a, c) + '</b> ≈ ' + fmt(a / E.rate(c, d)) + ' SU</span>').join('') + '</div>'
		+ '<h2>Hold · ' + Tr.held(me) + ' / ' + env.ship.cargo + ' t</h2><div class="pt-chips">' + (Object.entries(me.cargo).map(([g, n]) => '<span>' + n + ' t ' + g + '</span>').join('') || '<span class="muted">empty</span>') + '</div>'
		+ '<h2>Ship</h2><dl><dt>Hull</dt><dd>' + esc(env.ship.name + ' ' + env.ship.size + ' ' + env.ship.role) + '</dd><dt>Jump</dt><dd>' + (env.ship.jump ? env.ship.jump + ' pc' : 'none') + '</dd><dt>Fuel</dt><dd>' + Math.round(env.fuel() * 100) + '% of ' + Tr.tank(env.ship) + ' t</dd><dt>Hull</dt><dd>' + Math.round(hull() * 100) + '%</dd><dt>Modules down</dt><dd>' + M.alerts(env.fit).length + '</dd></dl>'
		+ '<h2>War missions</h2>' + ((me.missions || []).map(m => '<p><b>' + esc(m.text) + '</b><br><span class="small">' + esc(En.need(m)) + ' · due day ' + m.due + ' · ' + money(m.reward, m.currency) + '</span></p>').join('') || '<p class="muted">None. Take contracts at a bulletin board.</p>') + '</section>'
		+ '<section class="pt-card pt-table"><h2>Reputation</h2>' + reps.map(m => { const v = Math.round(me.rep[m.id] || 0), t = R.tier(v); return '<div class="pt-rep"><span>' + esc(m.name.replace(/^The /, '')) + '</span><span class="num">' + (v > 0 ? '+' : '') + v + '</span><span class="' + (v >= 100 ? 'good' : v < -100 ? 'bad' : 'muted') + '">' + t + '</span></div>' }).join('') + '</section></div>';
}

/* ---------- actions ---------- */
function click(e) {
	const t = e.target.closest('button'); if (!t || t.disabled) return;
	if (t.dataset.screen) { screen = t.dataset.screen; env.cue('tick'); if (screen == 'launch') {} render(); focusScreen(); return }
	if (t.dataset.good) { sel.good = t.dataset.good; render(); const b = root.querySelector('[data-good="' + sel.good + '"]'); if (b) b.focus(); return }
	if (t.dataset.ship) { sel.ship = t.dataset.ship; render(); const b = root.querySelector('[data-ship="' + sel.ship + '"]'); if (b) b.focus(); return }
	const me = P(), act = t.dataset.act, d = env.day;
	if (act == 'launch') { const l = env.onLaunch; close(); l(); return }
	if (act == 'refuel') { const c = Tr.refuelCost(env.ship, env.fuel(), mkt), r = Tr.pay(me, c, here(), d); if (r.ok) { env.setFuel(1); env.say('Refuelled: ' + money(r.amount, r.code)); env.cue('clearance') } else env.say('Not enough ' + r.code + ' to refuel') }
	if (act == 'repair') { const c = Tr.repairCost(env.ship, env.fit, mkt, d, hull()), r = Tr.pay(me, c, here(), d); if (r.ok) { M.repair(env.fit); me.combat = Object.assign(me.combat || {}, {hull: 1}); env.say('Repaired: ' + money(r.amount, r.code)); env.cue('clearance') } else env.say('Not enough ' + r.code + ' to repair') }
	if (act == 'buy') { const n = t.dataset.n == 'max' ? Tr.canBuy(me, env.ship, mkt, sel.good, d) : 1, r = Tr.buy(me, env.ship, mkt, sel.good, n, d); if (r.ok) { env.say('Bought ' + r.qty + ' t ' + sel.good + ' for ' + money(r.paid.amount, r.paid.code)); env.cue('tick') } }
	if (act == 'sell') { const n = t.dataset.n == 'all' ? me.cargo[sel.good] || 0 : 1, r = Tr.sell(me, mkt, sel.good, n, d); if (r.ok) { env.say('Sold ' + r.qty + ' t ' + sel.good + ' for ' + money(r.got.amount, r.got.code) + (Math.abs(r.profit) > 0.5 ? ' (' + (r.profit > 0 ? '+' : '') + fmt(r.profit) + ' SU)' : '')); env.cue('tick') } }
	if (act == 'buyship') { const r = Tr.buyShip(me, env.ship.id, sel.ship, env.star, d); if (r.ok) { env.onShip(sel.ship); env.say('Bought a ' + env.ship.name + ': paid ' + fmt(Math.max(0, r.cost)) + ' ' + r.currency); env.cue('docked') } else env.say(r.why == 'hold' ? 'Your cargo won\'t fit its hold' : 'Not enough ' + (r.code || '') + ' for that ship') }
	if (act == 'restock') { const c = restockCost(), r = Tr.pay(me, c.cost, here(), d); if (r.ok) { me.combat = C.refill(env.ship, me.combat); env.say('Restocked: ' + fmt(c.tons, 1) + ' t of munitions for ' + money(r.amount, r.code)); env.cue('clearance') } else env.say('Not enough ' + r.code + ' to restock') }
	if (act == 'accept') { const m = En.offers(me, env.port, d).find(x => x.id == t.dataset.m), r = m ? En.accept(me, m, d) : {ok: false, why: 'That contract has gone.'}; env.say(r.ok ? 'Mission accepted: ' + m.text + ' (due day ' + r.mission.due + ')' : r.why); env.cue(r.ok ? 'clearance' : 'refused') }
	if (act == 'expct') { ex.amount = String(Math.floor((me.wallet[ex.from] || 0) * +t.dataset.n * 100) / 100) }
	if (act == 'exchange') { const r = Tr.exchange(me, +ex.amount, ex.from, ex.to, d, holder()); if (r.ok) { env.say('Changed ' + money(+ex.amount, ex.from) + ' into ' + money(r.got, ex.to)); ex.amount = ''; env.cue('tick') } else env.say(r.why || 'The exchange refused') }
	if (act == 'paybounty') { const c = F.byId(holder()).currency.code, b = me.bounties[c]; if (Tr.pay(me, b, c, d).ok) { delete me.bounties[c]; env.say('Bounty paid') } }
	if (act == 'enlist') { R.enlist(me, holder()); env.say('Commissioned with the ' + nm(holder())) }
	const keep = act; render();
	const again = root.querySelector('[data-act="' + keep + '"]:not([disabled])'); if (again) again.focus();
}
function input(e) {
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
