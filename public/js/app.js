/* ═══════════════════════════════════════════════════════════════
   PokéGuess – app.js  (mit Ranked + Bots + Leaderboard + Freunde)
   ═══════════════════════════════════════════════════════════════ */

const API = '';
let socket = null;

const LEAGUE_NAMES   = ['Pokéball','Superball','Hyperball','Meisterball'];
const LEAGUE_STARTS  = [0, 300, 600, 900];   // LP-Einstieg je Liga

// PokeAPI Item-Sprites
const CDN = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';
const LEAGUE_SPRITES = [
  CDN + 'poke-ball.png',
  CDN + 'great-ball.png',
  CDN + 'ultra-ball.png',
  CDN + 'master-ball.png',
];
const REVIVE_SPRITE = CDN + 'revive.png';

const state = {
  token:   localStorage.getItem('pg_token'),
  user:    JSON.parse(localStorage.getItem('pg_user') || 'null'),
  roomId:  null, isRanked: false,
  gameState: null,
  premises: [],
  selectedPremise: null, confirmedPremise: null,
  guessPremise: null,
};

// ─── Turn-Timer ───────────────────────────────────────────────────────────────
const TURN_SECONDS = 20;
let   turnTimerInterval = null;
let   lastTurnOwner     = null;

// Pokémon-Pool für Auto-Vorschlag wenn Zeit abläuft
const AUTO_SUGGEST_POOL = [
  'Pikachu','Relaxo','Gengar','Turtok','Bisaflor','Glurak','Arkani',
  'Mewtu','Garados','Lapras','Raichu','Machomei','Evoli','Flareon','Aquana',
  'Ditto','Eevee','Snorlax','Mewtwo','Blastoise',
];

function startTurnTimer() {
  clearTurnTimer();
  let seconds = TURN_SECONDS;

  const fill  = document.getElementById('timer-fill');
  const count = document.getElementById('timer-count');

  // CSS-Animation neu starten
  if (fill) {
    fill.classList.remove('running');
    void fill.getBoundingClientRect(); // reflow erzwingen
    fill.classList.add('running');
  }

  function updateCount() {
    if (!count) return;
    count.textContent = `${seconds}s`;
    count.className   = seconds <= 5 ? 'timer-count danger'
                      : seconds <= 10 ? 'timer-count warn'
                      : 'timer-count';
  }
  updateCount();

  turnTimerInterval = setInterval(() => {
    seconds--;
    updateCount();
    if (seconds <= 0) {
      clearTurnTimer();
      autoSuggestOnTimeout();
    }
  }, 1000);
}

function clearTurnTimer() {
  if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
  const fill  = document.getElementById('timer-fill');
  const count = document.getElementById('timer-count');
  if (fill)  { fill.classList.remove('running'); fill.style.width = '0%'; }
  if (count) { count.textContent = ''; count.className = 'timer-count'; }
}

function autoSuggestOnTimeout() {
  if (!state.gameState || state.gameState.phase !== 'guessing') return;
  // Schon vorgeschlagene Namen herausfiltern
  const suggested = new Set(
    (state.gameState.myGuessHistory || []).filter(h => h.pokemonId).map(h => h.pokemonName)
  );
  const pool = AUTO_SUGGEST_POOL.filter(n => !suggested.has(n));
  const name = pool[Math.floor(Math.random() * pool.length)] || 'Pikachu';
  toast(`⏱ Zeit abgelaufen – Auto: ${name}`, 'info', 2500);
  lastTurnOwner = null; // Timer nach Antwort ggf. neu starten
  socket.emit('game:suggestPokemon', { pokemonName: name });
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3500) {
  const el = Object.assign(document.createElement('div'), { className: `toast ${type}`, textContent: msg });
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

const TYPE_DE = {
  normal:'Normal', fire:'Feuer', water:'Wasser', grass:'Pflanze',
  electric:'Elektro', ice:'Eis', fighting:'Kampf', poison:'Gift',
  ground:'Boden', flying:'Flug', psychic:'Psycho', bug:'Käfer',
  rock:'Gestein', ghost:'Geist', dragon:'Drache', dark:'Unlicht',
  steel:'Stahl', fairy:'Fee',
};
const typeChip = t => `<span class="type-chip tc-${t}">${TYPE_DE[t]||t}</span>`;

// ─── Liga-Anzeige ─────────────────────────────────────────────────────────────
function leagueClass(idx) {
  return ['','l1','l2','l3'][idx] || '';
}

/** Wie viele Beleber-Sterne (1–3) hat man in der aktuellen Liga? */
function getLeagueStars(lp, leagueIdx) {
  const start    = LEAGUE_STARTS[Math.min(leagueIdx, 3)];
  const lpInLeag = Math.max(0, lp - start);
  return Math.min(3, Math.floor(lpInLeag / 100) + 1);
}

/** 3 Beleber-Sprites: ausgefüllt = filled, leer = ausgegraut */
function starsHTML(filled) {
  return Array.from({ length: 3 }, (_, i) =>
    `<img src="${REVIVE_SPRITE}" class="star-img${i < filled ? '' : ' star-empty'}" alt="★" />`
  ).join('');
}

function updateLeagueUI(lp, league) {
  const idx    = league?.leagueIdx ?? 0;
  const name   = LEAGUE_NAMES[idx];
  const sprite = LEAGUE_SPRITES[idx];
  const stars  = getLeagueStars(lp, idx);
  // LP-Fortschritt innerhalb der aktuellen Liga (0–300)
  const lpInLeag = Math.max(0, lp - LEAGUE_STARTS[idx]);
  const pct      = Math.min(100, (lpInLeag / 300) * 100);

  // Topbar: kleines Ball-Icon + Liga-Badge + LP
  const iconSm = document.getElementById('ui-league-icon');
  if (iconSm) iconSm.src = sprite;
  const leagueEl = document.getElementById('ui-league');
  if (leagueEl) { leagueEl.textContent = name; leagueEl.className = `league-badge ${leagueClass(idx)}`; }
  const lpEl = document.getElementById('ui-lp');
  if (lpEl) lpEl.textContent = `${lp} LP`;

  // Ranked Card
  const riEl = document.getElementById('ranked-league-icon');
  if (riEl) riEl.src = sprite;
  const rnEl = document.getElementById('ranked-league-name');
  if (rnEl) rnEl.textContent = `${name}-Liga`;
  const rlEl = document.getElementById('ranked-lp-display');
  if (rlEl) rlEl.textContent = `${lp} LP`;
  const starsEl = document.getElementById('ranked-league-stars');
  if (starsEl) starsEl.innerHTML = starsHTML(stars);
  const rbEl = document.getElementById('ranked-lp-bar');
  if (rbEl) rbEl.style.width = `${pct}%`;
}

// ─── Shiny-Sprite URL ────────────────────────────────────────────────────────
function shinySpriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
}

// ─── User UI updaten ──────────────────────────────────────────────────────────
function updateUserUI() {
  const u = state.user;
  if (!u) return;
  ['ui-username','sel-username'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = u.username; });
  ['ui-level','sel-level'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = `Lv.${u.level}`; });
  const xpBar = document.getElementById('ui-xp-bar');
  if (xpBar) xpBar.style.width = `${Math.min(100,(u.xp/(u.xpToNext||100))*100)}%`;
  updateLeagueUI(u.lp || 0, u.league);
  // Coins
  const coinsEl  = document.getElementById('ui-coins');
  if (coinsEl) coinsEl.textContent = `🪙 ${u.coins || 0}`;
}

// ══════════════════════════════════════════════════════════════════════════════
//   AUTH
// ══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`form-${btn.dataset.tab}`).classList.add('active');
  })
);

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, user } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: document.getElementById('login-username').value.trim(), password: document.getElementById('login-password').value }),
    });
    onLogin(token, user);
  } catch (err) { document.getElementById('login-error').textContent = err.message; }
});

document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const { token, user } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: document.getElementById('reg-username').value.trim(), password: document.getElementById('reg-password').value }),
    });
    onLogin(token, user);
  } catch (err) { document.getElementById('reg-error').textContent = err.message; }
});

function onLogin(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem('pg_token', token);
  localStorage.setItem('pg_user', JSON.stringify(user));
  initSocket();
  showHome();
}

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.clear(); if (socket) socket.disconnect();
  state.token = null; state.user = null;
  showScreen('screen-auth');
});

// ══════════════════════════════════════════════════════════════════════════════
//   HOME
// ══════════════════════════════════════════════════════════════════════════════
async function showHome() {
  state.isRanked = false;
  updateUserUI();
  showScreen('screen-home');
  try {
    const { user } = await apiFetch('/api/auth/me');
    state.user = { ...state.user, ...user };
    localStorage.setItem('pg_user', JSON.stringify(state.user));
    document.getElementById('stat-wins').textContent        = user.stats?.wins || 0;
    document.getElementById('stat-losses').textContent      = user.stats?.losses || 0;
    document.getElementById('stat-ranked-wins').textContent = user.stats?.rankedWins || 0;
    document.getElementById('stat-games').textContent       = user.stats?.gamesPlayed || 0;
    updateUserUI();
    const reqs = user.friendRequests?.length || 0;
    const badge = document.getElementById('friend-badge');
    if (badge) { badge.textContent = reqs; badge.classList.toggle('hidden', reqs === 0); }
  } catch {}
  // Pokédex laden
  loadPokedex();
}

// ══════════════════════════════════════════════════════════════════════════════
//   POKÉDEX
// ══════════════════════════════════════════════════════════════════════════════
let dexData = [];    // aktuell geladene Pokédex-Einträge
let dexCoins = 0;
let dexModalEntry = null;

async function loadPokedex() {
  try {
    const data = await apiFetch('/api/pokedex');
    dexCoins = data.coins || 0;
    dexData  = data.pokedex || [];
    renderPokedex();
  } catch {}
}

function renderPokedex() {
  const grid = document.getElementById('pokedex-grid');
  const countEl = document.getElementById('dex-count-badge');
  const coinsEl = document.getElementById('dex-coins-display');
  if (countEl) countEl.textContent = `${dexData.length} gefangen`;
  if (coinsEl) coinsEl.textContent = `🪙 ${dexCoins}`;
  // Topbar Coins
  const uiCoins = document.getElementById('ui-coins');
  if (uiCoins) uiCoins.textContent = `🪙 ${dexCoins}`;

  if (!grid) return;
  if (dexData.length === 0) {
    grid.innerHTML = '<p class="muted-text dex-empty-msg">Noch keine Pokémon gefangen – spiele eine Runde!</p>';
    return;
  }

  // Sortieren: erst nach ID
  const sorted = [...dexData].sort((a, b) => a.pokemonId - b.pokemonId);

  grid.innerHTML = sorted.map(p => {
    const sprite = p.isShiny ? shinySpriteUrl(p.pokemonId) : p.sprite;
    const shinyBadge = p.isShiny ? '<span class="dex-shiny-star">✨</span>' : '';
    const legendBadge = (p.isLegendary || p.isMythical) ? '<span class="dex-legendary-crown">👑</span>' : '';
    return `<div class="dex-entry ${p.isShiny ? 'shiny-owned' : ''}" data-id="${p.pokemonId}" title="${p.pokemonName}">
      ${shinyBadge}${legendBadge}
      <img src="${sprite}" alt="${p.pokemonName}" loading="lazy"/>
      <span class="dex-name">${p.pokemonName}</span>
    </div>`;
  }).join('');

  grid.querySelectorAll('.dex-entry').forEach(el =>
    el.addEventListener('click', () => openDexModal(Number(el.dataset.id)))
  );
}

function openDexModal(pokemonId) {
  const entry = dexData.find(e => e.pokemonId === pokemonId);
  if (!entry) return;
  dexModalEntry = entry;

  document.getElementById('dex-modal-name').textContent   = entry.pokemonName;
  document.getElementById('dex-modal-normal').src         = entry.sprite;
  document.getElementById('dex-modal-normal').alt         = entry.pokemonName;
  const shinyImg = document.getElementById('dex-modal-shiny');
  shinyImg.src = shinySpriteUrl(pokemonId);
  shinyImg.className = `dex-sprite-big dex-shiny-preview${entry.isShiny ? ' unlocked' : ''}`;

  document.getElementById('dex-modal-types').innerHTML =
    (entry.types || []).map(typeChip).join('');

  const price = (entry.isLegendary || entry.isMythical) ? 100 : 50;
  const buyBtn = document.getElementById('btn-buy-shiny');

  if (entry.isShiny) {
    document.getElementById('dex-modal-owned').textContent = '✨ Shiny bereits vorhanden!';
    buyBtn.textContent = '✨ Bereits gekauft';
    buyBtn.className   = 'btn-shiny-buy already-owned';
    buyBtn.disabled    = true;
  } else {
    const affordable = dexCoins >= price;
    document.getElementById('dex-modal-owned').textContent =
      `Deine Coins: 🪙 ${dexCoins}  |  Preis: 🪙 ${price}`;
    buyBtn.textContent = `✨ Shiny kaufen – 🪙 ${price}`;
    buyBtn.className   = 'btn-shiny-buy';
    buyBtn.disabled    = !affordable;
  }

  document.getElementById('dex-modal').classList.remove('hidden');
}

document.getElementById('btn-dex-close').addEventListener('click', () => {
  document.getElementById('dex-modal').classList.add('hidden');
  dexModalEntry = null;
});
document.getElementById('dex-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('dex-modal')) {
    document.getElementById('dex-modal').classList.add('hidden');
  }
});

document.getElementById('btn-buy-shiny').addEventListener('click', async () => {
  if (!dexModalEntry) return;
  try {
    const { coins } = await apiFetch('/api/pokedex/shiny', {
      method: 'POST',
      body: JSON.stringify({ pokemonId: dexModalEntry.pokemonId }),
    });
    dexCoins = coins;
    // Lokal updaten
    const e = dexData.find(d => d.pokemonId === dexModalEntry.pokemonId);
    if (e) e.isShiny = true;
    toast(`✨ ${dexModalEntry.pokemonName} Shiny freigeschaltet!`, 'success');
    document.getElementById('dex-modal').classList.add('hidden');
    renderPokedex();
  } catch (err) { toast(err.message, 'error'); }
});

// Home Tabs
document.querySelectorAll('.home-tab').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.home-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.home-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`htab-${btn.dataset.htab}`).classList.add('active');
  })
);

// Privates Spiel
document.getElementById('btn-random-room').addEventListener('click', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  document.getElementById('room-code').value = Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
});
document.getElementById('btn-join').addEventListener('click', joinPrivate);
document.getElementById('room-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinPrivate(); });

function joinPrivate() {
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  if (!code) return toast('Bitte Raum-Code eingeben', 'error');
  state.roomId = code; state.isRanked = false;
  document.getElementById('lobby-status').classList.remove('hidden');
  document.getElementById('lobby-status-text').textContent = 'Verbinde…';
  socket.emit('lobby:join', { roomId: code, level: state.user?.level || 1, lp: state.user?.lp || 0 });
}

// Ranked
document.getElementById('btn-ranked').addEventListener('click', () => {
  state.isRanked = true;
  document.getElementById('ranked-queue-status').classList.remove('hidden');
  document.getElementById('btn-ranked').classList.add('hidden');
  socket.emit('ranked:join', { level: state.user?.level || 1, lp: state.user?.lp || 0 });

  // Punkte animieren
  let dots = 0;
  const iv = setInterval(() => {
    dots = (dots + 1) % 4;
    const el = document.getElementById('queue-dots');
    if (el) el.textContent = '.'.repeat(dots+1);
  }, 500);
  socket._queueInterval = iv;
});

document.getElementById('btn-leave-queue').addEventListener('click', () => {
  socket.emit('ranked:leave');
  clearInterval(socket._queueInterval);
  document.getElementById('ranked-queue-status').classList.add('hidden');
  document.getElementById('btn-ranked').classList.remove('hidden');
});

// Navigation
document.getElementById('btn-leaderboard').addEventListener('click', showLeaderboard);
document.getElementById('btn-friends').addEventListener('click', showFriends);
document.getElementById('btn-lb-back').addEventListener('click', showHome);
document.getElementById('btn-friends-back').addEventListener('click', showHome);

// ══════════════════════════════════════════════════════════════════════════════
//   PREMISE SELECT
// ══════════════════════════════════════════════════════════════════════════════
async function showSelectScreen(isRanked = false) {
  showScreen('screen-select');
  document.getElementById('sel-opponent-hint').textContent = 'Dein Gegner wählt auch gerade…';
  document.getElementById('premise-preview').classList.add('hidden');
  document.getElementById('btn-confirm-premise').disabled = false;
  document.getElementById('btn-confirm-premise').textContent = 'Diese Prämisse wählen ✓';
  const rb = document.getElementById('sel-ranked-badge');
  if (rb) rb.classList.toggle('hidden', !isRanked);
  state.selectedPremise = null; state.confirmedPremise = null;
  try {
    const { premises } = await apiFetch('/api/premises');
    state.premises = premises;
    renderPremises(premises, 'Alle', '');
  } catch { toast('Prämissen konnten nicht geladen werden', 'error'); }
}

function renderPremises(list, filterCat = 'Alle', searchQ = '') {
  const cats = ['Alle', ...new Set(list.map(p => p.category))];
  const catTabs = document.getElementById('category-tabs');
  catTabs.innerHTML = cats.map(c => `<button class="cat-tab ${c===filterCat?'active':''}" data-cat="${c}">${c}</button>`).join('');
  catTabs.querySelectorAll('.cat-tab').forEach(btn =>
    btn.addEventListener('click', () => renderPremises(list, btn.dataset.cat, document.getElementById('premise-search').value))
  );
  let filtered = list;
  if (filterCat !== 'Alle') filtered = filtered.filter(p => p.category === filterCat);
  if (searchQ) filtered = filtered.filter(p => p.label.toLowerCase().includes(searchQ.toLowerCase()));
  const container = document.getElementById('premise-list');
  container.innerHTML = filtered.map(p => `
    <div class="premise-item" data-id="${p.id}">
      <span class="premise-name">${p.label}</span>
      <span class="premise-count">${p.count} Pokémon</span>
    </div>`).join('');
  container.querySelectorAll('.premise-item').forEach(item =>
    item.addEventListener('click', () => selectPremise(item.dataset.id))
  );
}

document.getElementById('premise-search').addEventListener('input', e => {
  const active = document.querySelector('.cat-tab.active');
  renderPremises(state.premises, active?.dataset.cat || 'Alle', e.target.value);
});

async function selectPremise(id) {
  const premise = state.premises.find(p => p.id === id);
  if (!premise) return;
  state.selectedPremise = premise;
  document.getElementById('preview-title').textContent = premise.label;
  document.getElementById('preview-count').textContent = `${premise.count} Pokémon`;
  document.getElementById('premise-preview').classList.remove('hidden');
  document.getElementById('preview-pokemon-grid').innerHTML = '<div class="spinner" style="margin:auto"></div>';
  try {
    const { pokemon } = await apiFetch(`/api/premises/${id}/pokemon`);
    document.getElementById('preview-pokemon-grid').innerHTML = pokemon.map(p => `
      <div class="poke-chip"><img src="${p.sprite}" alt="${p.nameDE}" loading="lazy"/>${p.nameDE}</div>`).join('');
  } catch { document.getElementById('preview-pokemon-grid').innerHTML = '<span>Fehler</span>'; }
}

document.getElementById('btn-confirm-premise').addEventListener('click', () => {
  if (!state.selectedPremise) return;
  socket.emit('game:choosePremise', { premiseId: state.selectedPremise.id });
  document.getElementById('btn-confirm-premise').disabled = true;
  document.getElementById('btn-confirm-premise').textContent = 'Gewählt! Warte auf Gegner…';
  state.confirmedPremise = state.selectedPremise;
});

document.getElementById('btn-cancel-preview').addEventListener('click', () => {
  document.getElementById('premise-preview').classList.add('hidden');
  state.selectedPremise = null;
});

// ══════════════════════════════════════════════════════════════════════════════
//   GAME SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function showGameScreen() {
  showScreen('screen-game');
  document.getElementById('history-list').innerHTML = '';
  document.getElementById('opp-suggest-list').innerHTML = '';
  document.getElementById('confirmed-pokemon-list').innerHTML = '';
  document.getElementById('confirmed-count').textContent = '0';
  document.getElementById('opp-suggest-count').textContent = '0';
  if (state.confirmedPremise)
    document.getElementById('my-premise-badge').textContent = state.confirmedPremise.label;
  lastTurnOwner = null; // Timer-State zurücksetzen
  clearTurnTimer();
  initPokemonSearch();
  renderGuessPremiseList('');
}

function updateGameState(gs) {
  state.gameState = gs;
  const isMyTurn = gs.currentTurn === state.user?.id;
  const turnEl = document.getElementById('turn-indicator');
  if (gs.phase === 'finished') {
    turnEl.textContent = 'Spiel beendet'; turnEl.className = 'turn-indicator';
    clearTurnTimer(); lastTurnOwner = null;
  } else if (isMyTurn) {
    turnEl.textContent = '🟢 Du bist dran!'; turnEl.className = 'turn-indicator my-turn';
    // Timer nur starten, wenn sich der Zug wechselt
    if (lastTurnOwner !== state.user?.id) startTurnTimer();
    lastTurnOwner = state.user?.id;
  } else {
    turnEl.textContent = `⏳ ${gs.opponentName||'Gegner'} denkt…`; turnEl.className = 'turn-indicator opp-turn';
    clearTurnTimer(); lastTurnOwner = gs.currentTurn;
  }
  document.getElementById('my-mistakes').textContent  = gs.myMistakes;
  document.getElementById('opp-mistakes').textContent = gs.opponentMistakes;
  document.getElementById('input-area').classList.toggle('disabled', !isMyTurn || gs.phase !== 'guessing');

  // Bestätigte Pokémon (rechts)
  const confList = document.getElementById('confirmed-pokemon-list');
  const conf = gs.confirmedForMe || [];
  confList.innerHTML = conf.map(p => `
    <div class="confirmed-entry">
      <img src="${p.sprite}" alt="${p.name}"/>
      <span>${p.name}</span>
      <div class="type-chips">${(p.types||[]).map(typeChip).join('')}</div>
    </div>`).join('');
  document.getElementById('confirmed-count').textContent = conf.length;

  // Gegner-Vorschläge (links)
  const oppList = document.getElementById('opp-suggest-list');
  const opp = gs.oppSuggestHistory || [];
  oppList.innerHTML = opp.map(e => `
    <div class="opp-entry ${e.result}">
      <img src="${e.pokemonSprite}" alt="${e.pokemonName}"/>
      <span>${e.pokemonName}</span>
      <span class="result-dot">${e.result==='yes'?'✓':'✗'}</span>
    </div>`).join('');
  document.getElementById('opp-suggest-count').textContent = opp.length;

  renderHistory(gs.myGuessHistory || []);
}

function renderHistory(history) {
  document.getElementById('history-list').innerHTML = history.map(entry => {
    if (entry.pokemonId) {
      const cls = entry.result === 'yes' ? 'yes' : 'no';
      return `<div class="history-entry ${cls}">
        <img src="${entry.pokemonSprite}" alt="${entry.pokemonName}"/>
        <span>${entry.pokemonName}</span>
        <span class="type-chips">${(entry.pokemonTypes||[]).map(typeChip).join('')}</span>
        <span class="history-result">${entry.result==='yes'?'✓':'✗'}</span>
      </div>`;
    }
    return `<div class="history-entry ${entry.result==='correct'?'yes':'wrong-guess'}">
      <span>💡 <strong>${entry.premiseLabel}</strong></span>
      <span class="history-result">${entry.result==='correct'?'✓':'✗'}</span>
    </div>`;
  }).join('');
}

// Pokémon-Suche
function initPokemonSearch() {
  const input = document.getElementById('pokemon-search-input');
  const sugg  = document.getElementById('pokemon-suggestions');
  input.value = ''; let debounce;
  input.oninput = () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { sugg.classList.add('hidden'); return; }
    debounce = setTimeout(async () => {
      try {
        const { results } = await apiFetch(`/api/pokemon/search?q=${encodeURIComponent(q)}`);
        if (!results.length) { sugg.classList.add('hidden'); return; }
        sugg.innerHTML = results.map(p => `
          <div class="suggestion-item" data-name="${p.nameDE}">
            <img src="${p.sprite}" alt="${p.nameDE}"/>
            <span>${p.nameDE}</span>
            <div class="type-chips">${p.types.map(typeChip).join('')}</div>
          </div>`).join('');
        sugg.classList.remove('hidden');
        sugg.querySelectorAll('.suggestion-item').forEach(item =>
          item.addEventListener('click', () => {
            input.value = item.dataset.name; sugg.classList.add('hidden');
          })
        );
      } catch {}
    }, 200);
  };
  document.addEventListener('click', e => { if (!sugg.contains(e.target) && e.target !== input) sugg.classList.add('hidden'); });
}

document.getElementById('btn-suggest').addEventListener('click', () => {
  const name = document.getElementById('pokemon-search-input').value.trim();
  if (!name) return toast('Bitte ein Pokémon eingeben', 'error');
  socket.emit('game:suggestPokemon', { pokemonName: name });
  document.getElementById('pokemon-search-input').value = '';
});

// Prämissen-Raten
function renderGuessPremiseList(q) {
  const list = document.getElementById('guess-premise-list');
  const filtered = state.premises.filter(p => !q || p.label.toLowerCase().includes(q.toLowerCase()));
  list.innerHTML = filtered.map(p => `
    <div class="premise-item" data-id="${p.id}">
      <span class="premise-name">${p.label}</span>
      <span class="premise-count">${p.count} Pokémon</span>
    </div>`).join('');
  list.querySelectorAll('.premise-item').forEach(item =>
    item.addEventListener('click', () => {
      list.querySelectorAll('.premise-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected'); state.guessPremise = item.dataset.id;
      document.getElementById('btn-guess-premise').disabled = false;
    })
  );
}
document.getElementById('guess-premise-search').addEventListener('input', e => renderGuessPremiseList(e.target.value));
document.getElementById('btn-guess-premise').addEventListener('click', () => {
  if (!state.guessPremise) return;
  if (!confirm('Sicher? Falsches Raten kostet einen Fehlversuch!')) return;
  socket.emit('game:guessPremise', { premiseId: state.guessPremise });
  state.guessPremise = null;
  document.getElementById('btn-guess-premise').disabled = true;
  document.querySelectorAll('#guess-premise-list .premise-item').forEach(i => i.classList.remove('selected'));
});

// Input Tabs
document.querySelectorAll('.input-tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.mode}`).classList.add('active');
  })
);

// ══════════════════════════════════════════════════════════════════════════════
//   RESULT
// ══════════════════════════════════════════════════════════════════════════════
let _pendingRewards = null; // wird von user:statsUpdated befüllt

function showResult(data) {
  showScreen('screen-result');
  clearTurnTimer();
  const isWinner = data.winner === state.user?.id;
  document.getElementById('result-icon').textContent    = isWinner ? '🏆' : '💀';
  document.getElementById('result-title').textContent   = isWinner ? 'Sieg!' : 'Niederlage';
  document.getElementById('result-subtitle').textContent = isWinner ? 'Du hast gewonnen!' : `${data.winnerName} hat gewonnen.`;
  const reason = data.reason === 'correct_guess' ? 'Die Prämisse wurde korrekt erraten.'
               : data.reason === 'surrender'     ? (isWinner ? `${data.loserName} hat aufgegeben.` : 'Du hast aufgegeben.')
               : `${data.loserName} hatte 3 Fehlversuche.`;
  document.getElementById('result-details').innerHTML = `
    <div>${reason}</div>
    ${data.opponentPremise ? `<div style="margin-top:8px">Gegner-Prämisse: <strong>${data.opponentPremise.label}</strong></div>` : ''}
    ${data.myPremise      ? `<div>Deine Prämisse: <strong>${data.myPremise.label}</strong></div>` : ''}
  `;
  // Rewards werden von user:statsUpdated befüllt (kommt kurz nach game:over)
  document.getElementById('result-rewards').innerHTML = '';
}

function renderResultRewards(stats) {
  const chips = [];
  if (stats.lpChange !== undefined && stats.lpChange !== 0) {
    const cls = stats.lpChange > 0 ? 'lp-pos' : 'lp-neg';
    const sign = stats.lpChange > 0 ? '+' : '';
    chips.push(`<span class="reward-chip ${cls}">${sign}${stats.lpChange} LP</span>`);
  }
  if (stats.coinsEarned) chips.push(`<span class="reward-chip coins">+🪙 ${stats.coinsEarned}</span>`);
  chips.push(`<span class="reward-chip xp">+XP → Lv.${stats.level}</span>`);
  if (stats.newDexEntries?.length) chips.push(`<span class="reward-chip coins">🔴 +${stats.newDexEntries.length} Pokédex</span>`);
  const el = document.getElementById('result-rewards');
  if (el) el.innerHTML = chips.join('');
}

document.getElementById('btn-surrender').addEventListener('click', () => {
  if (!confirm('Wirklich aufgeben? Du verlierst die Runde!')) return;
  clearTurnTimer();
  socket.emit('game:surrender');
});

document.getElementById('btn-rematch').addEventListener('click', () => socket.emit('game:rematch'));
document.getElementById('btn-back-lobby').addEventListener('click', () => {
  state.roomId = null; state.gameState = null; state.confirmedPremise = null; showHome();
});

// ══════════════════════════════════════════════════════════════════════════════
//   LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════════
async function showLeaderboard(scope = 'world') {
  showScreen('screen-leaderboard');
  document.getElementById('lb-body').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px"><div class="spinner" style="margin:auto"></div></td></tr>';
  try {
    const { leaderboard } = await apiFetch(`/api/leaderboard?scope=${scope}`);
    document.getElementById('lb-body').innerHTML = leaderboard.map(u => `
      <tr class="${u.username === state.user?.username ? 'lb-me' : ''}">
        <td class="lb-rank">${u.rank <= 3 ? ['🥇','🥈','🥉'][u.rank-1] : u.rank}</td>
        <td><strong>${u.username}</strong></td>
        <td>Lv.${u.level}</td>
        <td><strong>${u.lp}</strong> LP</td>
        <td class="lb-league-cell">
          <img src="${LEAGUE_SPRITES[u.leagueIdx] || LEAGUE_SPRITES[0]}" class="lb-ball-icon" alt="${u.leagueName}" title="${u.leagueName}" />
          <span class="league-badge ${leagueClass(u.leagueIdx)}">${u.leagueName}</span>
        </td>
        <td>${u.wins}</td>
        <td>${u.rankedWins}</td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#555;padding:20px">Noch keine Einträge</td></tr>';
  } catch { toast('Fehler beim Laden', 'error'); }
}

document.querySelectorAll('.lb-tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    showLeaderboard(tab.dataset.scope);
  })
);

// ══════════════════════════════════════════════════════════════════════════════
//   FRIENDS
// ══════════════════════════════════════════════════════════════════════════════
async function showFriends() {
  showScreen('screen-friends');
  try {
    const { friends, requests } = await apiFetch('/api/friends');
    // Anfragen
    const reqList = document.getElementById('friend-requests-list');
    reqList.innerHTML = requests.length
      ? requests.map(r => `
          <div class="friend-request-item">
            <span class="fi-name">${r}</span>
            <button class="btn-primary btn-sm" onclick="acceptFriend('${r}')">✓</button>
            <button class="btn-sm" onclick="declineFriend('${r}')">✗</button>
          </div>`).join('')
      : '<p class="muted-text">Keine Anfragen</p>';
    // Liste
    const friendList = document.getElementById('friends-list');
    friendList.innerHTML = friends.length
      ? friends.map(f => `
          <div class="friend-item">
            <span class="fi-name">${f}</span>
            <button class="btn-sm" onclick="removeFriend('${f}')">Entfernen</button>
          </div>`).join('')
      : '<p class="muted-text">Noch keine Freunde</p>';
  } catch {}
}

window.acceptFriend = async (username) => {
  try { await apiFetch('/api/friends/accept', { method:'POST', body: JSON.stringify({username}) }); toast('Freund hinzugefügt!','success'); showFriends(); } catch (e) { toast(e.message,'error'); }
};
window.declineFriend = async (username) => {
  try { await apiFetch('/api/friends/decline', { method:'POST', body: JSON.stringify({username}) }); showFriends(); } catch {}
};
window.removeFriend = async (username) => {
  if (!confirm(`${username} entfernen?`)) return;
  try { await apiFetch(`/api/friends/${username}`, { method:'DELETE' }); showFriends(); } catch {}
};

document.getElementById('btn-friend-search').addEventListener('click', async () => {
  const q = document.getElementById('friend-search-input').value.trim();
  if (q.length < 2) return;
  try {
    const { results } = await apiFetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
    const el = document.getElementById('friend-search-results');
    el.classList.remove('hidden');
    el.innerHTML = results.length
      ? results.map(u => `
          <div class="friend-item">
            <span class="fi-name">${u.username}</span>
            <span class="fi-info">Lv.${u.level} · ${u.lp} LP</span>
            <button class="btn-sm" onclick="sendFriendRequest('${u.username}')">+ Anfrage</button>
          </div>`).join('')
      : '<p class="muted-text">Niemanden gefunden</p>';
  } catch {}
});

window.sendFriendRequest = async (username) => {
  try { await apiFetch('/api/friends/request', { method:'POST', body: JSON.stringify({username}) }); toast(`Anfrage an ${username} gesendet!`,'success'); } catch (e) { toast(e.message,'error'); }
};

// ══════════════════════════════════════════════════════════════════════════════
//   SOCKET.IO
// ══════════════════════════════════════════════════════════════════════════════
function initSocket() {
  if (socket) socket.disconnect();
  socket = io({ auth: { token: state.token } });

  socket.on('connect_error', err => toast(`Verbindungsfehler: ${err.message}`, 'error'));

  // Lobby
  socket.on('lobby:joined', ({ playerCount }) => {
    if (playerCount === 1) document.getElementById('lobby-status-text').textContent = 'Warte auf Mitspieler… Teile den Raum-Code!';
  });
  socket.on('lobby:waiting', ({ message }) => {
    document.getElementById('lobby-status-text').textContent = message;
  });

  // Ranked
  socket.on('ranked:queued', ({ position }) => {
    toast(`In der Warteschlange (Position ${position})…`, 'info');
  });
  socket.on('ranked:left', () => {
    clearInterval(socket._queueInterval);
    document.getElementById('ranked-queue-status').classList.add('hidden');
    document.getElementById('btn-ranked').classList.remove('hidden');
  });
  socket.on('ranked:rematch', () => {
    // Nach Bot-Match Rematch → wieder in Queue
    document.getElementById('ranked-queue-status').classList.remove('hidden');
    document.getElementById('btn-ranked').classList.add('hidden');
    socket.emit('ranked:join', { level: state.user?.level||1, lp: state.user?.lp||0 });
  });

  // Prämisse wählen
  socket.on('game:selectPremise', ({ message, isRanked }) => {
    clearInterval(socket._queueInterval);
    document.getElementById('ranked-queue-status')?.classList.add('hidden');
    document.getElementById('btn-ranked')?.classList.remove('hidden');
    state.isRanked = !!isRanked;
    toast(message, 'success');
    showSelectScreen(!!isRanked);
  });
  socket.on('game:premiseConfirmed', ({ label }) => {
    toast(`Prämisse „${label}" gewählt!`, 'success');
    document.getElementById('sel-opponent-hint').textContent = 'Deine Prämisse ist gesetzt. Warte auf Gegner…';
  });
  socket.on('game:opponentChosePremise', ({ username }) => {
    document.getElementById('sel-opponent-hint').textContent = `${username} hat gewählt. Du bist noch dran!`;
  });

  // Spiel
  socket.on('game:started', ({ currentTurnName }) => {
    toast(`Spiel gestartet! ${currentTurnName} beginnt.`, 'success');
    showGameScreen();
  });
  socket.on('game:state', gs => updateGameState(gs));
  socket.on('game:pokemonResult', ({ suggestedBy, pokemon, matches }) => {
    if (suggestedBy !== state.user?.id) {
      toast(`${pokemon.name} → ${matches ? '✓ Ja!' : '✗ Nein'}`, 'info', 2000);
    }
  });
  socket.on('game:wrongGuess', ({ premiseLabel, mistakesLeft }) => {
    toast(`❌ „${premiseLabel}" war falsch! Noch ${mistakesLeft} Versuche.`, 'error');
  });

  // Spielende
  socket.on('game:over', data => showResult(data));
  socket.on('user:statsUpdated', stats => {
    state.user = { ...state.user, ...stats };
    if (stats.coins !== undefined) state.user.coins = stats.coins;
    localStorage.setItem('pg_user', JSON.stringify(state.user));
    // Reward-Chips im Result-Screen
    renderResultRewards(stats);
    // Coins in Topbar
    const coinsEl = document.getElementById('ui-coins');
    if (coinsEl) coinsEl.textContent = `🪙 ${stats.coins ?? state.user.coins ?? 0}`;
    // Pokédex live updaten wenn neue Einträge
    if (stats.newDexEntries?.length) {
      loadPokedex();
    }
  });

  socket.on('game:opponentDisconnected', ({ username }) => toast(`${username} hat die Verbindung getrennt.`, 'error'));
  socket.on('error', ({ message }) => toast(message, 'error'));
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (state.token && state.user) { initSocket(); showHome(); }
else showScreen('screen-auth');
