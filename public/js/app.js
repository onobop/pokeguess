/* ═══════════════════════════════════════════════════════════════
   PokéGuess – app.js
   ═══════════════════════════════════════════════════════════════ */

const API = '';  // gleicher Origin
let socket = null;

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('pg_token'),
  user: JSON.parse(localStorage.getItem('pg_user') || 'null'),
  roomId: null,
  gameState: null,
  premises: [],      // alle verfügbaren Prämissen
  selectedPremise: null,   // im Select-Screen
  confirmedPremise: null,  // die gewählte Prämisse (nach Bestätigung)
  pokemonInput: null,      // aktuell gewähltes Pokémon im Input
  guessPremise: null,      // aktuell gewählte Prämisse im Guess-Panel
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ─── Screen-Wechsel ───────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── API-Helfer ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

// ─── Typ-Chip HTML ────────────────────────────────────────────────────────────
const TYPE_DE = {
  normal:'Normal', fire:'Feuer', water:'Wasser', grass:'Pflanze',
  electric:'Elektro', ice:'Eis', fighting:'Kampf', poison:'Gift',
  ground:'Boden', flying:'Flug', psychic:'Psycho', bug:'Käfer',
  rock:'Gestein', ghost:'Geist', dragon:'Drache', dark:'Unlicht',
  steel:'Stahl', fairy:'Fee',
};
function typeChip(t) {
  return `<span class="type-chip tc-${t}">${TYPE_DE[t] || t}</span>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//   AUTH
// ══════════════════════════════════════════════════════════════════════════════

// Tab-Wechsel
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const which = btn.dataset.tab;
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`form-${which}`).classList.add('active');
  });
});

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const { token, user } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    onLogin(token, user);
  } catch (err) {
    document.getElementById('login-error').textContent = err.message;
  }
});

document.getElementById('form-register').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  try {
    const { token, user } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    onLogin(token, user);
  } catch (err) {
    document.getElementById('reg-error').textContent = err.message;
  }
});

function onLogin(token, user) {
  state.token = token;
  state.user  = user;
  localStorage.setItem('pg_token', token);
  localStorage.setItem('pg_user', JSON.stringify(user));
  initSocket();
  showLobby();
}

document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('pg_token');
  localStorage.removeItem('pg_user');
  if (socket) socket.disconnect();
  state.token = null;
  state.user  = null;
  showScreen('screen-auth');
});

// ══════════════════════════════════════════════════════════════════════════════
//   LOBBY
// ══════════════════════════════════════════════════════════════════════════════

function showLobby() {
  updateUserUI();
  loadUserStats();
  showScreen('screen-lobby');
}

function updateUserUI() {
  const u = state.user;
  if (!u) return;
  ['ui-username', 'sel-username'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = u.username;
  });
  ['ui-level', 'sel-level'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `Lv.${u.level}`;
  });
  const xpBar = document.getElementById('ui-xp-bar');
  if (xpBar) xpBar.style.width = `${Math.min(100, (u.xp / u.xpToNext) * 100)}%`;
}

async function loadUserStats() {
  try {
    const { user } = await apiFetch('/api/auth/me');
    state.user = { ...state.user, ...user };
    localStorage.setItem('pg_user', JSON.stringify(state.user));
    document.getElementById('stat-wins').textContent   = user.stats.wins;
    document.getElementById('stat-losses').textContent = user.stats.losses;
    document.getElementById('stat-games').textContent  = user.stats.gamesPlayed;
    updateUserUI();
  } catch {}
}

// Zufälliger Raum-Code
document.getElementById('btn-random-room').addEventListener('click', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('room-code').value = code;
});

document.getElementById('btn-join').addEventListener('click', joinRoom);
document.getElementById('room-code').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinRoom();
});

function joinRoom() {
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  if (!code) return toast('Bitte einen Raum-Code eingeben', 'error');
  state.roomId = code;
  document.getElementById('lobby-status').classList.remove('hidden');
  document.getElementById('lobby-status-text').textContent = 'Verbinde…';
  socket.emit('lobby:join', { roomId: code, level: state.user?.level || 1 });
}

// ══════════════════════════════════════════════════════════════════════════════
//   PREMISE SELECT
// ══════════════════════════════════════════════════════════════════════════════

async function showSelectScreen() {
  showScreen('screen-select');
  document.getElementById('sel-opponent-hint').textContent = 'Dein Gegner wählt auch gerade…';
  document.getElementById('premise-preview').classList.add('hidden');
  state.selectedPremise = null;
  state.confirmedPremise = null;

  try {
    const { premises } = await apiFetch('/api/premises');
    state.premises = premises;
    renderPremises(premises);
  } catch {
    toast('Prämissen konnten nicht geladen werden', 'error');
  }
}

function renderPremises(list, filterCat = 'Alle', searchQ = '') {
  // Kategorien
  const cats = ['Alle', ...new Set(list.map(p => p.category))];
  const catTabs = document.getElementById('category-tabs');
  catTabs.innerHTML = cats.map(c =>
    `<button class="cat-tab ${c === filterCat ? 'active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
  catTabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      renderPremises(list, btn.dataset.cat, document.getElementById('premise-search').value);
    });
  });

  // Filter
  let filtered = list;
  if (filterCat !== 'Alle') filtered = filtered.filter(p => p.category === filterCat);
  if (searchQ) filtered = filtered.filter(p => p.label.toLowerCase().includes(searchQ.toLowerCase()));

  // Liste
  const container = document.getElementById('premise-list');
  container.innerHTML = filtered.map(p => `
    <div class="premise-item" data-id="${p.id}">
      <span class="premise-name">${p.label}</span>
      <span class="premise-count">${p.count} Pokémon</span>
    </div>
  `).join('');

  container.querySelectorAll('.premise-item').forEach(item => {
    item.addEventListener('click', () => selectPremise(item.dataset.id));
  });
}

document.getElementById('premise-search').addEventListener('input', e => {
  const active = document.querySelector('.cat-tab.active');
  renderPremises(state.premises, active?.dataset.cat || 'Alle', e.target.value);
});

async function selectPremise(premiseId) {
  const premise = state.premises.find(p => p.id === premiseId);
  if (!premise) return;
  state.selectedPremise = premise;

  // Vorschau laden
  document.getElementById('preview-title').textContent = premise.label;
  document.getElementById('preview-count').textContent = `${premise.count} Pokémon`;
  document.getElementById('premise-preview').classList.remove('hidden');
  document.getElementById('preview-pokemon-grid').innerHTML = '<div class="spinner" style="margin:auto"></div>';

  try {
    const { pokemon } = await apiFetch(`/api/premises/${premiseId}/pokemon`);
    document.getElementById('preview-pokemon-grid').innerHTML = pokemon.map(p => `
      <div class="poke-chip">
        <img src="${p.sprite}" alt="${p.nameDE}" loading="lazy" />
        ${p.nameDE}
      </div>
    `).join('');
  } catch {
    document.getElementById('preview-pokemon-grid').innerHTML = '<span>Fehler beim Laden</span>';
  }
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
  document.getElementById('opp-history-list').innerHTML = '';
  document.getElementById('confirmed-pokemon-list').innerHTML = '';
  document.getElementById('confirmed-count').textContent = '0';

  // Meine Prämisse anzeigen
  if (state.confirmedPremise) {
    document.getElementById('my-premise-badge').textContent = state.confirmedPremise.label;
  }

  // Pokémon-Suche initialisieren
  initPokemonSearch();
  // Prämissen-Raten Liste
  renderGuessPremiseList('');
}

function updateGameState(gs) {
  state.gameState = gs;

  const isMyTurn = gs.currentTurn === state.user?.id;
  const turnEl = document.getElementById('turn-indicator');
  if (gs.phase === 'finished') {
    turnEl.textContent = 'Spiel beendet';
    turnEl.className = 'turn-indicator';
  } else if (isMyTurn) {
    turnEl.textContent = '🟢 Du bist dran!';
    turnEl.className = 'turn-indicator my-turn';
  } else {
    turnEl.textContent = `⏳ ${gs.opponentName || 'Gegner'} ist dran…`;
    turnEl.className = 'turn-indicator opp-turn';
  }

  document.getElementById('my-mistakes').textContent = gs.myMistakes;
  document.getElementById('opp-mistakes').textContent = gs.opponentMistakes;
  document.getElementById('opp-mistakes-label').querySelector('span').textContent = gs.opponentMistakes;

  // Input-Bereich
  const inputArea = document.getElementById('input-area');
  if (isMyTurn && gs.phase === 'guessing') {
    inputArea.classList.remove('disabled');
  } else {
    inputArea.classList.add('disabled');
  }

  // Bestätigte Pokémon (mein Gegner hat richtig geraten → ich sehe seine Treffer)
  const confirmedList = document.getElementById('confirmed-pokemon-list');
  confirmedList.innerHTML = (gs.confirmedForMe || []).map(p => `
    <div class="confirmed-entry">
      <img src="${p.sprite}" alt="${p.name}" />
      <span>${p.name}</span>
    </div>
  `).join('');
  document.getElementById('confirmed-count').textContent = (gs.confirmedForMe || []).length;

  // Mein Vorschlagsverlauf
  renderHistory(gs.myGuessHistory || []);
}

function renderHistory(history) {
  const list = document.getElementById('history-list');
  list.innerHTML = history.map(entry => {
    if (entry.pokemonId) {
      const cls = entry.result === 'yes' ? 'yes' : 'no';
      const icon = entry.result === 'yes' ? '✓' : '✗';
      return `
        <div class="history-entry ${cls}">
          <img src="${entry.pokemonSprite}" alt="${entry.pokemonName}" />
          <span>${entry.pokemonName}</span>
          <span class="type-chips">${(entry.pokemonTypes||[]).map(typeChip).join('')}</span>
          <span class="history-result">${icon}</span>
        </div>`;
    } else {
      const cls = entry.result === 'correct' ? 'yes' : 'wrong-guess';
      const icon = entry.result === 'correct' ? '✓' : '✗';
      return `
        <div class="history-entry ${cls}">
          <span>💡 Prämisse: <strong>${entry.premiseLabel}</strong></span>
          <span class="history-result">${icon}</span>
        </div>`;
    }
  }).join('');
}

// Gegner-Vorschläge (was der Gegner mir vorgeschlagen hat → linke Spalte)
function addOpponentEntry(pokemon, matches) {
  const list = document.getElementById('opp-history-list');
  const cls = matches ? 'yes' : 'no';
  const icon = matches ? '✓' : '✗';
  const el = document.createElement('div');
  el.className = `opp-entry ${cls}`;
  el.innerHTML = `
    <img src="${pokemon.sprite}" alt="${pokemon.name}" />
    <span>${pokemon.name}</span>
    <span class="result-dot">${icon}</span>
  `;
  list.prepend(el);
}

// ─── Pokémon-Suche ────────────────────────────────────────────────────────────
function initPokemonSearch() {
  const input = document.getElementById('pokemon-search-input');
  const suggestions = document.getElementById('pokemon-suggestions');
  let debounce;

  input.value = '';
  state.pokemonInput = null;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 2) { suggestions.classList.add('hidden'); return; }
    debounce = setTimeout(async () => {
      try {
        const { results } = await apiFetch(`/api/pokemon/search?q=${encodeURIComponent(q)}`);
        if (!results.length) { suggestions.classList.add('hidden'); return; }
        suggestions.innerHTML = results.map(p => `
          <div class="suggestion-item" data-id="${p.id}" data-name="${p.nameDE}">
            <img src="${p.sprite}" alt="${p.nameDE}" />
            <span>${p.nameDE}</span>
            <div class="type-chips">${p.types.map(typeChip).join('')}</div>
          </div>
        `).join('');
        suggestions.classList.remove('hidden');
        suggestions.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', () => {
            input.value = item.dataset.name;
            state.pokemonInput = item.dataset.name;
            suggestions.classList.add('hidden');
          });
        });
      } catch {}
    }, 200);
  });

  document.addEventListener('click', e => {
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.classList.add('hidden');
    }
  });
}

document.getElementById('btn-suggest').addEventListener('click', () => {
  const name = document.getElementById('pokemon-search-input').value.trim();
  if (!name) return toast('Bitte ein Pokémon eingeben', 'error');
  socket.emit('game:suggestPokemon', { pokemonName: name });
  document.getElementById('pokemon-search-input').value = '';
  state.pokemonInput = null;
});

// ─── Prämissen-Raten ──────────────────────────────────────────────────────────
function renderGuessPremiseList(q) {
  const list = document.getElementById('guess-premise-list');
  const filtered = state.premises.filter(p =>
    !q || p.label.toLowerCase().includes(q.toLowerCase())
  );
  list.innerHTML = filtered.map(p => `
    <div class="premise-item" data-id="${p.id}">
      <span class="premise-name">${p.label}</span>
      <span class="premise-count">${p.count} Pokémon</span>
    </div>
  `).join('');
  list.querySelectorAll('.premise-item').forEach(item => {
    item.addEventListener('click', () => {
      list.querySelectorAll('.premise-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      state.guessPremise = item.dataset.id;
      document.getElementById('btn-guess-premise').disabled = false;
    });
  });
}

document.getElementById('guess-premise-search').addEventListener('input', e => {
  renderGuessPremiseList(e.target.value);
});

document.getElementById('btn-guess-premise').addEventListener('click', () => {
  if (!state.guessPremise) return;
  if (!confirm('Bist du sicher? Falsches Raten kostet einen Fehlversuch!')) return;
  socket.emit('game:guessPremise', { premiseId: state.guessPremise });
  state.guessPremise = null;
  document.getElementById('btn-guess-premise').disabled = true;
  document.querySelectorAll('#guess-premise-list .premise-item').forEach(i => i.classList.remove('selected'));
});

// ─── Input Tabs ───────────────────────────────────────────────────────────────
document.querySelectorAll('.input-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.input-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.mode}`).classList.add('active');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//   RESULT SCREEN
// ══════════════════════════════════════════════════════════════════════════════

function showResult({ winner, winnerName, loser, loserName, opponentPremise, reason, xpEarned }) {
  showScreen('screen-result');
  const isWinner = winner === state.user?.id;
  document.getElementById('result-icon').textContent    = isWinner ? '🏆' : '💀';
  document.getElementById('result-title').textContent   = isWinner ? 'Sieg!' : 'Niederlage';
  document.getElementById('result-subtitle').textContent =
    isWinner ? `Du hast gewonnen!` : `${winnerName} hat gewonnen.`;

  let reasonText = '';
  if (reason === 'correct_guess') reasonText = 'Die Prämisse wurde korrekt erraten.';
  if (reason === 'max_mistakes')  reasonText = `${loserName} hatte 3 Fehlversuche.`;

  document.getElementById('result-details').innerHTML = `
    <div>${reasonText}</div>
    ${opponentPremise ? `<div style="margin-top:8px">Die Prämisse des Gegners war: <strong>${opponentPremise.label}</strong></div>` : ''}
  `;

  if (xpEarned) {
    document.getElementById('xp-earned').textContent = `+${xpEarned} XP`;
  }
}

document.getElementById('btn-rematch').addEventListener('click', () => {
  socket.emit('game:rematch');
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
  state.roomId = null;
  state.gameState = null;
  state.confirmedPremise = null;
  showLobby();
});

// ══════════════════════════════════════════════════════════════════════════════
//   SOCKET.IO
// ══════════════════════════════════════════════════════════════════════════════

function initSocket() {
  if (socket) socket.disconnect();

  socket = io({ auth: { token: state.token } });

  socket.on('connect', () => console.log('Socket verbunden'));
  socket.on('connect_error', err => toast(`Verbindungsfehler: ${err.message}`, 'error'));

  // ── Lobby ──────────────────────────────────────────────────────
  socket.on('lobby:joined', ({ playerCount, players }) => {
    if (playerCount === 1) {
      document.getElementById('lobby-status-text').textContent =
        'Warte auf Mitspieler… Teile den Raum-Code!';
    }
  });

  socket.on('lobby:waiting', ({ message }) => {
    document.getElementById('lobby-status-text').textContent = message;
  });

  // ── Prämisse wählen ───────────────────────────────────────────
  socket.on('game:selectPremise', ({ message }) => {
    toast(message, 'info');
    showSelectScreen();
  });

  socket.on('game:premiseConfirmed', ({ label, pokemon }) => {
    toast(`Prämisse „${label}" gewählt!`, 'success');
    document.getElementById('sel-opponent-hint').textContent =
      'Deine Prämisse ist gesetzt. Warte auf deinen Gegner…';
  });

  socket.on('game:opponentChosePremise', ({ username }) => {
    document.getElementById('sel-opponent-hint').textContent =
      `${username} hat bereits gewählt. Du bist noch dran!`;
  });

  // ── Spiel läuft ───────────────────────────────────────────────
  socket.on('game:started', ({ currentTurnName }) => {
    toast(`Spiel gestartet! ${currentTurnName} beginnt.`, 'success');
    showGameScreen();
  });

  socket.on('game:state', (gs) => {
    updateGameState(gs);
  });

  socket.on('game:pokemonResult', ({ suggestedBy, pokemon, matches, nextTurn }) => {
    const isMe = suggestedBy === state.user?.id;

    if (!isMe) {
      // Gegner hat mir ein Pokémon vorgeschlagen → rechte Spalte
      addOpponentEntry(pokemon, matches);
      if (matches) {
        toast(`Dein Gegner fragt: „${pokemon.name}" → ✓ Ja!`, 'info');
      } else {
        toast(`Dein Gegner fragt: „${pokemon.name}" → ✗ Nein`, 'info');
      }
    }
  });

  socket.on('game:wrongGuess', ({ guessedByName, premiseLabel, mistakesLeft, nextTurn }) => {
    const isMe = nextTurn !== state.user?.id;
    if (isMe) {
      toast(`Falscher Versuch! „${premiseLabel}" war falsch. Noch ${mistakesLeft} Versuche.`, 'error');
    } else {
      toast(`${guessedByName} hat falsch geraten – du bist dran!`, 'info');
    }
  });

  // ── Spielende ─────────────────────────────────────────────────
  socket.on('game:over', (data) => {
    showResult(data);
  });

  socket.on('user:statsUpdated', (stats) => {
    state.user = { ...state.user, ...stats };
    localStorage.setItem('pg_user', JSON.stringify(state.user));
    const xpEarned = state.user?.id === state.gameState?.winner ? 50 : 10;
    document.getElementById('xp-earned').textContent = `+${xpEarned} XP erhalten! → Lv.${stats.level}`;
  });

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('game:opponentDisconnected', ({ username }) => {
    toast(`${username} hat die Verbindung getrennt.`, 'error');
  });

  socket.on('error', ({ message }) => {
    toast(message, 'error');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//   INIT
// ══════════════════════════════════════════════════════════════════════════════

if (state.token && state.user) {
  initSocket();
  showLobby();
} else {
  showScreen('screen-auth');
}
