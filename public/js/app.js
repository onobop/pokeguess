/* ═══════════════════════════════════════════════════════════════
   PokéGuess – app.js  (mit Ranked + Bots + Leaderboard + Freunde)
   ═══════════════════════════════════════════════════════════════ */

const API = '';
let socket = null;

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
  premises: [],       // gefilterte (eigene Prämissenwahl)
  allPremises: [],    // alle (für Gegner-Raten)
  selectedPremise: null, confirmedPremise: null,
  guessPremise: null,
};

// ─── Prämissen-Filter (Lobby-Auswahl) ────────────────────────────────────────
let privatePremiseFilter = 'Alle';
let rankedPremiseFilter  = 'Alle';

function initFilterButtons() {
  ['private', 'ranked'].forEach(mode => {
    const group = document.getElementById(`${mode}-filter-group`);
    if (!group) return;
    group.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (mode === 'private') privatePremiseFilter = btn.dataset.filter;
        else                    rankedPremiseFilter  = btn.dataset.filter;
      });
    });
  });
}
initFilterButtons();

// ─── Turn-Timer ───────────────────────────────────────────────────────────────
const TURN_SECONDS = 20;
let   turnTimerInterval = null;
let   lastTurnOwner     = null;

function startTurnTimer() {
  clearTurnTimer();
  let seconds = TURN_SECONDS;

  const fill  = document.getElementById('timer-fill');
  const count = document.getElementById('timer-count');

  // CSS-Animation neu starten
  if (fill) {
    fill.classList.remove('running');
    void fill.getBoundingClientRect();
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
  toast(t('toast.time.up'), 'info', 2500);
  lastTurnOwner = null;
  socket.emit('game:passTurn');
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

// Type chip (uses i18n.js getTypeName)
const typeChip = type => `<span class="type-chip tc-${type}">${getTypeName(type)}</span>`;

// ─── Liga-Anzeige ─────────────────────────────────────────────────────────────
function leagueClass(idx) {
  return ['','l1','l2','l3'][idx] || '';
}

function getLeagueStars(lp, leagueIdx) {
  const start    = LEAGUE_STARTS[Math.min(leagueIdx, 3)];
  const lpInLeag = Math.max(0, lp - start);
  return Math.min(3, Math.floor(lpInLeag / 100) + 1);
}

function starsHTML(filled) {
  return Array.from({ length: 3 }, (_, i) =>
    `<img src="${REVIVE_SPRITE}" class="star-img${i < filled ? '' : ' star-empty'}" alt="★" />`
  ).join('');
}

function getLeagueName(idx) {
  return t(`league.${Math.min(idx, 3)}`);
}

function updateLeagueUI(lp, league) {
  const idx    = league?.leagueIdx ?? 0;
  const name   = getLeagueName(idx);
  const sprite = LEAGUE_SPRITES[idx];
  const stars  = getLeagueStars(lp, idx);
  const lpInLeag = Math.max(0, lp - LEAGUE_STARTS[idx]);
  const pct      = Math.min(100, (lpInLeag / 300) * 100);

  const iconSm = document.getElementById('ui-league-icon');
  if (iconSm) iconSm.src = sprite;
  const leagueEl = document.getElementById('ui-league');
  if (leagueEl) { leagueEl.textContent = name; leagueEl.className = `league-badge ${leagueClass(idx)}`; }
  const lpEl = document.getElementById('ui-lp');
  if (lpEl) lpEl.textContent = `${lp} LP`;

  const riEl = document.getElementById('ranked-league-icon');
  if (riEl) riEl.src = sprite;
  const rnEl = document.getElementById('ranked-league-name');
  if (rnEl) rnEl.textContent = `${name}${t('league.suffix')}`;
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
  const coinsEl  = document.getElementById('ui-coins');
  if (coinsEl) coinsEl.textContent = `🪙 ${u.coins || 0}`;
}

// ─── Language Toggle ──────────────────────────────────────────────────────────
function handleLangToggle() {
  const next = window.LANG === 'de' ? 'en' : 'de';
  setLanguage(next);
}

// Wire all lang toggle buttons
['btn-lang-toggle','btn-lang-toggle-auth','btn-lang-toggle-sel',
 'btn-lang-toggle-game','btn-lang-toggle-lb','btn-lang-toggle-friends'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', handleLangToggle);
});

// Re-render dynamic content on language change
document.addEventListener('langChange', () => {
  updateUserUI();
  // Re-render premises if on select screen
  if (state.premises.length) renderPremises(state.premises, currentCatFilter, document.getElementById('premise-search')?.value || '');
  // Re-render guess premise list if on game screen
  if (state.allPremises.length || state.premises.length) renderGuessPremiseList(document.getElementById('guess-premise-search')?.value || '');
  // Re-render Pokédex
  renderPokedex();
  // Update tutorial name
  const nameEl = document.getElementById('tutorial-namebox');
  if (nameEl) nameEl.textContent = t('tutorial.name');
  // Re-render tutorial step if visible
  const tutModal = document.getElementById('tutorial-modal');
  if (tutModal && !tutModal.classList.contains('hidden')) renderTutorialStep();
  // Update "my premise badge" label if set
  if (state.confirmedPremise) {
    const badge = document.getElementById('my-premise-badge');
    if (badge) badge.textContent = tPremise(state.confirmedPremise.id, state.confirmedPremise.label);
  }
  // Update turn indicator
  if (state.gameState) updateGameState(state.gameState);
});

// Track current category filter for re-render
let currentCatFilter = 'Alle';

// ══════════════════════════════════════════════════════════════════════════════
//   PROF. EICH / OAK TUTORIAL
// ══════════════════════════════════════════════════════════════════════════════
let tutorialStep = 0;

function showTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
  document.getElementById('tutorial-modal').classList.remove('hidden');
}

function renderTutorialStep() {
  const steps = getTutorialSteps();
  const total = steps.length;
  document.getElementById('tutorial-text').innerHTML = steps[tutorialStep];

  // Tutorial name
  const nameEl = document.getElementById('tutorial-namebox');
  if (nameEl) nameEl.textContent = t('tutorial.name');

  // Dots
  const dotsEl = document.getElementById('tutorial-dots');
  dotsEl.innerHTML = Array.from({ length: total }, (_, i) =>
    `<div class="tutorial-dot${i === tutorialStep ? ' active' : ''}"></div>`
  ).join('');

  // Button
  const btn = document.getElementById('btn-tutorial-next');
  const isLast = tutorialStep === total - 1;
  btn.textContent = isLast ? t('btn.tutorial.finish') : t('btn.tutorial.next');
  btn.className   = isLast ? 'btn-tutorial-next finish' : 'btn-tutorial-next';
}

document.getElementById('btn-tutorial-next').addEventListener('click', () => {
  const steps = getTutorialSteps();
  if (tutorialStep < steps.length - 1) {
    tutorialStep++;
    renderTutorialStep();
  } else {
    document.getElementById('tutorial-modal').classList.add('hidden');
    localStorage.setItem('pg_tutorial_seen', '1');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//   AUTH
// ══════════════════════════════════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(tb => tb.classList.remove('active'));
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
    onLogin(token, user, true);
  } catch (err) { document.getElementById('reg-error').textContent = err.message; }
});

function onLogin(token, user, isNewUser = false) {
  state.token = token; state.user = user;
  localStorage.setItem('pg_token', token);
  localStorage.setItem('pg_user', JSON.stringify(user));
  initSocket();
  showHome();
  if (isNewUser && !localStorage.getItem('pg_tutorial_seen')) {
    setTimeout(() => showTutorial(), 600);
  }
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
  loadPokedex();
}

// ══════════════════════════════════════════════════════════════════════════════
//   POKÉDEX
// ══════════════════════════════════════════════════════════════════════════════
let dexData = [];
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
  if (countEl) countEl.textContent = `${dexData.length} ${t('dex.caught.suffix')}`;
  if (coinsEl) coinsEl.textContent = `🪙 ${dexCoins}`;
  const uiCoins = document.getElementById('ui-coins');
  if (uiCoins) uiCoins.textContent = `🪙 ${dexCoins}`;

  if (!grid) return;
  if (dexData.length === 0) {
    grid.innerHTML = `<p class="muted-text dex-empty-msg">${t('dex.empty')}</p>`;
    return;
  }

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
    document.getElementById('dex-modal-owned').textContent = t('dex.shiny.unlocked');
    buyBtn.textContent = t('btn.already.owned');
    buyBtn.className   = 'btn-shiny-buy already-owned';
    buyBtn.disabled    = true;
  } else {
    const affordable = dexCoins >= price;
    document.getElementById('dex-modal-owned').textContent =
      t('dex.owned.info', { coins: dexCoins, price });
    buyBtn.textContent = `${t('btn.buy.shiny')} – 🪙 ${price}`;
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
    const e = dexData.find(d => d.pokemonId === dexModalEntry.pokemonId);
    if (e) e.isShiny = true;
    toast(t('toast.shiny.bought', { name: dexModalEntry.pokemonName }), 'success');
    document.getElementById('dex-modal').classList.add('hidden');
    renderPokedex();
  } catch (err) { toast(err.message, 'error'); }
});

// Home Tabs
document.querySelectorAll('.home-tab').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.home-tab').forEach(tb => tb.classList.remove('active'));
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
  if (!code) return toast(t('toast.no.code'), 'error');
  state.roomId = code; state.isRanked = false;
  document.getElementById('lobby-status').classList.remove('hidden');
  document.getElementById('lobby-status-text').textContent = t('game.wait.lobby');
  socket.emit('lobby:join', { roomId: code, level: state.user?.level || 1, lp: state.user?.lp || 0, premiseFilter: privatePremiseFilter });
}

// Ranked
document.getElementById('btn-ranked').addEventListener('click', () => {
  state.isRanked = true;
  document.getElementById('ranked-queue-status').classList.remove('hidden');
  document.getElementById('btn-ranked').classList.add('hidden');
  socket.emit('ranked:join', { level: state.user?.level || 1, lp: state.user?.lp || 0, premiseFilter: rankedPremiseFilter });

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
async function showSelectScreen(isRanked = false, premiseFilter = 'Alle') {
  showScreen('screen-select');
  document.getElementById('sel-opponent-hint').textContent = t('select.opp.hint');
  document.getElementById('premise-preview').classList.add('hidden');
  document.getElementById('btn-confirm-premise').disabled = false;
  document.getElementById('btn-confirm-premise').textContent = t('btn.confirm.premise');
  const rb = document.getElementById('sel-ranked-badge');
  if (rb) rb.classList.toggle('hidden', !isRanked);
  state.selectedPremise = null; state.confirmedPremise = null;
  currentCatFilter = 'Alle';
  try {
    const { premises } = await apiFetch('/api/premises');
    // Lobby-Filter anwenden: nur Prämissen der gewählten Kategorie anzeigen
    const filtered = (premiseFilter && premiseFilter !== 'Alle')
      ? premises.filter(p => p.category === premiseFilter)
      : premises;
    state.premises = filtered;
    // Filter-Badge anzeigen
    const badge = document.getElementById('sel-filter-badge');
    if (badge) {
      badge.textContent = premiseFilter !== 'Alle' ? `🔍 ${tCat(premiseFilter)}` : '';
      badge.classList.toggle('hidden', premiseFilter === 'Alle');
    }
    renderPremises(filtered, 'Alle', '');
  } catch { toast(t('toast.premises.fail'), 'error'); }
}

function renderPremises(list, filterCat = 'Alle', searchQ = '') {
  currentCatFilter = filterCat;
  const cats = ['Alle', ...new Set(list.map(p => p.category))];
  const catTabs = document.getElementById('category-tabs');
  catTabs.innerHTML = cats.map(c =>
    `<button class="cat-tab ${c===filterCat?'active':''}" data-cat="${c}">${tCat(c)}</button>`
  ).join('');
  catTabs.querySelectorAll('.cat-tab').forEach(btn =>
    btn.addEventListener('click', () => {
      currentCatFilter = btn.dataset.cat;
      renderPremises(list, btn.dataset.cat, document.getElementById('premise-search').value);
    })
  );
  let filtered = list;
  if (filterCat !== 'Alle') filtered = filtered.filter(p => p.category === filterCat);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    filtered = filtered.filter(p =>
      tPremise(p.id, p.label).toLowerCase().includes(q) || p.label.toLowerCase().includes(q)
    );
  }
  const container = document.getElementById('premise-list');
  container.innerHTML = filtered.map(p => `
    <div class="premise-item" data-id="${p.id}">
      <span class="premise-name">${tPremise(p.id, p.label)}</span>
      <span class="premise-count">${p.count} ${t('premise.count.suffix')}</span>
    </div>`).join('');
  container.querySelectorAll('.premise-item').forEach(item =>
    item.addEventListener('click', () => selectPremise(item.dataset.id))
  );
}

document.getElementById('premise-search').addEventListener('input', e => {
  renderPremises(state.premises, currentCatFilter, e.target.value);
});

async function selectPremise(id) {
  const premise = state.premises.find(p => p.id === id);
  if (!premise) return;
  state.selectedPremise = premise;
  document.getElementById('preview-title').textContent = tPremise(premise.id, premise.label);
  document.getElementById('preview-count').textContent = `${premise.count} ${t('premise.count.suffix')}`;
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
  document.getElementById('btn-confirm-premise').textContent = t('btn.chosen.wait');
  state.confirmedPremise = state.selectedPremise;
});

document.getElementById('btn-cancel-preview').addEventListener('click', () => {
  document.getElementById('premise-preview').classList.add('hidden');
  state.selectedPremise = null;
});

// ══════════════════════════════════════════════════════════════════════════════
//   GAME SCREEN
// ══════════════════════════════════════════════════════════════════════════════
async function showGameScreen() {
  showScreen('screen-game');
  document.getElementById('history-list').innerHTML = '';
  document.getElementById('opp-suggest-list').innerHTML = '';
  document.getElementById('confirmed-pokemon-list').innerHTML = '';
  document.getElementById('confirmed-count').textContent = '0';
  document.getElementById('opp-suggest-count').textContent = '0';
  if (state.confirmedPremise) {
    document.getElementById('my-premise-badge').textContent =
      tPremise(state.confirmedPremise.id, state.confirmedPremise.label);
  }
  lastTurnOwner = null;
  clearTurnTimer();
  initPokemonSearch();
  try {
    const { premises } = await apiFetch('/api/premises?all=true');
    state.allPremises = premises;
  } catch { state.allPremises = state.premises; }
  renderGuessPremiseList('');
}

function updateGameState(gs) {
  state.gameState = gs;
  const isMyTurn = gs.currentTurn === state.user?.id;
  const turnEl = document.getElementById('turn-indicator');
  if (gs.phase === 'finished') {
    turnEl.textContent = t('game.finished'); turnEl.className = 'turn-indicator';
    clearTurnTimer(); lastTurnOwner = null;
  } else if (isMyTurn) {
    turnEl.textContent = t('game.my.turn'); turnEl.className = 'turn-indicator my-turn';
    if (lastTurnOwner !== state.user?.id) {
      startTurnTimer();
      // Pokémon-Tab aktivieren und Eingabefeld fokussieren
      document.querySelectorAll('.input-tab').forEach(tb => tb.classList.remove('active'));
      document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('.input-tab[data-mode="pokemon"]')?.classList.add('active');
      document.getElementById('panel-pokemon')?.classList.add('active');
      setTimeout(focusPokemonInput, 80);
    }
    lastTurnOwner = state.user?.id;
  } else {
    turnEl.textContent = t('game.opp.thinking', { name: gs.opponentName || 'Opponent' });
    turnEl.className = 'turn-indicator opp-turn';
    clearTurnTimer(); lastTurnOwner = gs.currentTurn;
  }
  document.getElementById('my-mistakes').textContent  = gs.myMistakes;
  document.getElementById('opp-mistakes').textContent = gs.opponentMistakes;
  document.getElementById('input-area').classList.toggle('disabled', !isMyTurn || gs.phase !== 'guessing');

  // Bestätigte Pokémon
  const confList = document.getElementById('confirmed-pokemon-list');
  const conf = gs.confirmedForMe || [];
  confList.innerHTML = conf.map(p => `
    <div class="confirmed-entry">
      <img src="${p.sprite}" alt="${p.name}"/>
      <span>${p.name}</span>
      <div class="type-chips">${(p.types||[]).map(typeChip).join('')}</div>
    </div>`).join('');
  document.getElementById('confirmed-count').textContent = conf.length;

  // Gegner-Vorschläge
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
  const list = document.getElementById('history-list');
  list.innerHTML = history.map(entry => {
    if (entry.pokemonId) {
      const r = entry.result;
      const icon = r === 'yes' ? '✓' : '✗';
      return `<div class="history-entry ${r}">
        <span class="history-result">${icon}</span>
        <img src="${entry.pokemonSprite}" alt="${entry.pokemonName}"/>
        <span>${entry.pokemonName}</span>
        <span class="type-chips">${(entry.pokemonTypes||[]).map(typeChip).join('')}</span>
      </div>`;
    }
    const premLabel = tPremise(entry.premiseGuess, entry.premiseLabel);
    return `<div class="history-entry ${entry.result==='correct'?'yes':'wrong-guess'}">
      <span>💡 <strong>${premLabel}</strong></span>
      <span class="history-result">${entry.result==='correct'?'✓':'✗'}</span>
    </div>`;
  }).join('');

  const last = list.lastElementChild;
  if (last) requestAnimationFrame(() => last.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
}

// Pokémon-Suche mit Tastaturnavigation
function initPokemonSearch() {
  const input = document.getElementById('pokemon-search-input');
  const sugg  = document.getElementById('pokemon-suggestions');
  input.value = '';
  let debounce;
  let selectedIdx = -1;

  function getItems() { return sugg.querySelectorAll('.suggestion-item'); }

  function setSelected(idx) {
    const items = getItems();
    items.forEach(el => el.classList.remove('keyboard-selected'));
    selectedIdx = Math.max(-1, Math.min(idx, items.length - 1));
    if (selectedIdx >= 0) {
      items[selectedIdx].classList.add('keyboard-selected');
      items[selectedIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function confirmSuggestion() {
    const items = getItems();
    if (selectedIdx >= 0 && items[selectedIdx]) {
      input.value = items[selectedIdx].dataset.name;
      sugg.classList.add('hidden');
      selectedIdx = -1;
    } else if (input.value.trim()) {
      submitSuggest();
    }
  }

  input.oninput = () => {
    selectedIdx = -1;
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
        selectedIdx = -1;
        sugg.querySelectorAll('.suggestion-item').forEach(item =>
          item.addEventListener('click', () => {
            input.value = item.dataset.name;
            sugg.classList.add('hidden');
            selectedIdx = -1;
            input.focus();
          })
        );
      } catch {}
    }, 200);
  };

  input.addEventListener('keydown', e => {
    const items = getItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!sugg.classList.contains('hidden') && items.length)
        setSelected(selectedIdx + 1 < items.length ? selectedIdx + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!sugg.classList.contains('hidden') && items.length)
        setSelected(selectedIdx - 1 >= 0 ? selectedIdx - 1 : items.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmSuggestion();
    } else if (e.key === 'Escape') {
      sugg.classList.add('hidden');
      selectedIdx = -1;
    }
  });

  document.addEventListener('click', e => {
    if (!sugg.contains(e.target) && e.target !== input) {
      sugg.classList.add('hidden');
      selectedIdx = -1;
    }
  });
}

function submitSuggest() {
  const input = document.getElementById('pokemon-search-input');
  const name  = input.value.trim();
  if (!name) return toast(t('toast.pokemon.empty'), 'error');
  socket.emit('game:suggestPokemon', { pokemonName: name });
  input.value = '';
  input.focus();
}

function focusPokemonInput() {
  // Nur fokussieren wenn Pokémon-Tab aktiv ist
  const panel = document.getElementById('panel-pokemon');
  if (panel && panel.classList.contains('active')) {
    const input = document.getElementById('pokemon-search-input');
    if (input) input.focus();
  }
}

document.getElementById('btn-suggest').addEventListener('click', submitSuggest);

// Prämissen-Raten
function renderGuessPremiseList(q) {
  const list = document.getElementById('guess-premise-list');
  const source = state.allPremises.length ? state.allPremises : state.premises;
  const filtered = source.filter(p => {
    if (!q) return true;
    const label = tPremise(p.id, p.label).toLowerCase();
    return label.includes(q.toLowerCase()) || p.label.toLowerCase().includes(q.toLowerCase());
  });
  list.innerHTML = filtered.map(p => `
    <div class="premise-item" data-id="${p.id}">
      <span class="premise-name">${tPremise(p.id, p.label)}</span>
      <span class="premise-count">${p.count} ${t('premise.count.suffix')}</span>
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
  if (!confirm(t('toast.guess.confirm'))) return;
  socket.emit('game:guessPremise', { premiseId: state.guessPremise });
  state.guessPremise = null;
  document.getElementById('btn-guess-premise').disabled = true;
  document.querySelectorAll('#guess-premise-list .premise-item').forEach(i => i.classList.remove('selected'));
});

// Input Tabs
document.querySelectorAll('.input-tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.input-tab').forEach(tb => tb.classList.remove('active'));
    document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.mode}`).classList.add('active');
  })
);

// ══════════════════════════════════════════════════════════════════════════════
//   RESULT
// ══════════════════════════════════════════════════════════════════════════════
function showResult(data) {
  showScreen('screen-result');
  clearTurnTimer();
  const isWinner = data.winner === state.user?.id;
  document.getElementById('result-icon').textContent    = isWinner ? '🏆' : '💀';
  document.getElementById('result-title').textContent   = isWinner ? t('result.win') : t('result.loss');
  document.getElementById('result-subtitle').textContent = isWinner ? t('result.win.sub') : `${data.winnerName} hat gewonnen.`;

  let reason;
  if (data.reason === 'correct_guess') {
    reason = t('result.reason.guess');
  } else if (data.reason === 'surrender') {
    reason = isWinner
      ? t('result.reason.surrender.win', { name: data.loserName })
      : t('result.reason.surrender.loss');
  } else {
    reason = t('result.reason.mistakes', { name: data.loserName });
  }

  const oppLabel  = data.opponentPremise ? tPremise(data.opponentPremise.id, data.opponentPremise.label) : '';
  const myLabel   = data.myPremise       ? tPremise(data.myPremise.id, data.myPremise.label)             : '';

  document.getElementById('result-details').innerHTML = `
    <div>${reason}</div>
    ${oppLabel ? `<div style="margin-top:8px">${t('result.opp.premise')} <strong>${oppLabel}</strong></div>` : ''}
    ${myLabel  ? `<div>${t('result.my.premise')} <strong>${myLabel}</strong></div>`                          : ''}
  `;
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
  if (!confirm(t('toast.surrender.confirm'))) return;
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
          <img src="${LEAGUE_SPRITES[u.leagueIdx] || LEAGUE_SPRITES[0]}" class="lb-ball-icon" alt="${getLeagueName(u.leagueIdx)}" title="${getLeagueName(u.leagueIdx)}" />
          <span class="league-badge ${leagueClass(u.leagueIdx)}">${getLeagueName(u.leagueIdx)}</span>
        </td>
        <td>${u.wins}</td>
        <td>${u.rankedWins}</td>
      </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:#555;padding:20px">${t('lb.empty')}</td></tr>`;
  } catch { toast(t('toast.load.fail'), 'error'); }
}

document.querySelectorAll('.lb-tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(tb => tb.classList.remove('active'));
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
    const reqList = document.getElementById('friend-requests-list');
    reqList.innerHTML = requests.length
      ? requests.map(r => `
          <div class="friend-request-item">
            <span class="fi-name">${r}</span>
            <button class="btn-primary btn-sm" onclick="acceptFriend('${r}')">${t('btn.accept')}</button>
            <button class="btn-sm" onclick="declineFriend('${r}')">${t('btn.decline')}</button>
          </div>`).join('')
      : `<p class="muted-text">${t('friends.no.requests')}</p>`;
    const friendList = document.getElementById('friends-list');
    friendList.innerHTML = friends.length
      ? friends.map(f => `
          <div class="friend-item">
            <span class="fi-name">${f}</span>
            <button class="btn-sm" onclick="removeFriend('${f}')">${t('btn.remove')}</button>
          </div>`).join('')
      : `<p class="muted-text">${t('friends.no.friends')}</p>`;
  } catch {}
}

window.acceptFriend = async (username) => {
  try {
    await apiFetch('/api/friends/accept', { method:'POST', body: JSON.stringify({username}) });
    toast(t('toast.friend.added'), 'success'); showFriends();
  } catch (e) { toast(e.message, 'error'); }
};
window.declineFriend = async (username) => {
  try { await apiFetch('/api/friends/decline', { method:'POST', body: JSON.stringify({username}) }); showFriends(); } catch {}
};
window.removeFriend = async (username) => {
  if (!confirm(t('toast.remove.confirm', { name: username }))) return;
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
            <button class="btn-sm" onclick="sendFriendRequest('${u.username}')">${t('btn.send.request')}</button>
          </div>`).join('')
      : `<p class="muted-text">${t('friends.no.results')}</p>`;
  } catch {}
});

window.sendFriendRequest = async (username) => {
  try {
    await apiFetch('/api/friends/request', { method:'POST', body: JSON.stringify({username}) });
    toast(t('toast.friend.sent', { name: username }), 'success');
  } catch (e) { toast(e.message, 'error'); }
};

// ══════════════════════════════════════════════════════════════════════════════
//   SOCKET.IO
// ══════════════════════════════════════════════════════════════════════════════
function initSocket() {
  if (socket) socket.disconnect();
  socket = io({ auth: { token: state.token } });

  socket.on('connect_error', err => toast(t('game.connect.error', { msg: err.message }), 'error'));

  socket.on('lobby:joined', ({ playerCount }) => {
    if (playerCount === 1)
      document.getElementById('lobby-status-text').textContent = t('game.wait.player');
  });
  socket.on('lobby:waiting', ({ message }) => {
    document.getElementById('lobby-status-text').textContent = message;
  });

  socket.on('ranked:queued', ({ position }) => {
    toast(t('game.queue.pos', { pos: position }), 'info');
  });
  socket.on('ranked:left', () => {
    clearInterval(socket._queueInterval);
    document.getElementById('ranked-queue-status').classList.add('hidden');
    document.getElementById('btn-ranked').classList.remove('hidden');
  });
  socket.on('ranked:rematch', () => {
    document.getElementById('ranked-queue-status').classList.remove('hidden');
    document.getElementById('btn-ranked').classList.add('hidden');
    socket.emit('ranked:join', { level: state.user?.level||1, lp: state.user?.lp||0, premiseFilter: rankedPremiseFilter });
  });

  socket.on('game:selectPremise', ({ message, isRanked, premiseFilter }) => {
    clearInterval(socket._queueInterval);
    document.getElementById('ranked-queue-status')?.classList.add('hidden');
    document.getElementById('btn-ranked')?.classList.remove('hidden');
    state.isRanked = !!isRanked;
    toast(message, 'success');
    showSelectScreen(!!isRanked, premiseFilter || 'Alle');
  });
  socket.on('game:premiseConfirmed', ({ label, premiseId }) => {
    toast(t('toast.premise.chosen', { label: tPremise(premiseId, label) }), 'success');
    document.getElementById('sel-opponent-hint').textContent =
      window.LANG === 'en' ? 'Your premise is set. Waiting for opponent…' : 'Deine Prämisse ist gesetzt. Warte auf Gegner…';
  });
  socket.on('game:opponentChosePremise', ({ username }) => {
    document.getElementById('sel-opponent-hint').textContent = t('game.opp.chosen', { name: username });
  });

  socket.on('game:started', ({ currentTurnName }) => {
    toast(t('game.started', { name: currentTurnName }), 'success');
    showGameScreen();
  });
  socket.on('game:state', gs => updateGameState(gs));
  socket.on('game:pokemonResult', ({ suggestedBy, pokemon, matches }) => {
    if (suggestedBy !== state.user?.id) {
      const label = matches ? t('pokemon.result.yes') : t('pokemon.result.no');
      toast(`${pokemon.name} → ${label}`, 'info', 2000);
    }
  });
  socket.on('game:wrongGuess', ({ premiseLabel, premiseId, mistakesLeft }) => {
    toast(t('game.wrong.guess', { label: tPremise(premiseId, premiseLabel), n: mistakesLeft }), 'error');
  });

  socket.on('game:over', data => showResult(data));
  socket.on('user:statsUpdated', stats => {
    state.user = { ...state.user, ...stats };
    if (stats.coins !== undefined) state.user.coins = stats.coins;
    localStorage.setItem('pg_user', JSON.stringify(state.user));
    renderResultRewards(stats);
    const coinsEl = document.getElementById('ui-coins');
    if (coinsEl) coinsEl.textContent = `🪙 ${stats.coins ?? state.user.coins ?? 0}`;
    if (stats.newDexEntries?.length) loadPokedex();
  });

  socket.on('game:opponentDisconnected', ({ username }) =>
    toast(t('game.disconnected', { name: username }), 'error'));
  socket.on('error', ({ message }) => toast(message, 'error'));
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (state.token && state.user) { initSocket(); showHome(); }
else showScreen('screen-auth');
