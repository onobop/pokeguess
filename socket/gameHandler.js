/**
 * gameHandler.js – PokéGuess Multiplayer + Bot-Support + Ranked
 */

const jwt = require('jsonwebtoken');
const {
  pokemonMatchesPremise, findPokemonByName, getPremiseById,
  getPokemonForPremise, getPremisesForTier, getMaxTierForLevel,
} = require('../engine/premiseEngine');
const {
  getBotForLP, choosePremiseForBot, choosePokemonToSuggest, guessPremise: botGuessPremise,
} = require('../engine/botAI');

// ─── In-Memory State ──────────────────────────────────────────────────────────
const rooms   = new Map();   // roomId → RoomState
const players = new Map();   // socketId → { userId, username, roomId }
const userSockets = new Map(); // userId → socketId

// Ranked Matchmaking Queue: [{ userId, username, lp, level, socketId, joinedAt }]
let rankedQueue = [];
const QUEUE_BOT_TIMEOUT = 15_000; // 15s ohne Gegner → Bot

// ─── LP-Änderungen ────────────────────────────────────────────────────────────
const LP = {
  WIN_VS_PLAYER:  25,
  LOSS_VS_PLAYER: -20,
  WIN_VS_BOT:     15,
  LOSS_VS_BOT:    -8,
};

// ─── Coin-Belohnungen ─────────────────────────────────────────────────────────
const COINS = {
  WIN_RANKED_PLAYER:  40,
  LOSS_RANKED_PLAYER: 15,
  WIN_RANKED_BOT:     25,
  LOSS_RANKED_BOT:     8,
  WIN_PRIVATE:        20,
  LOSS_PRIVATE:        5,
};

// ─── Room erstellen ───────────────────────────────────────────────────────────
function createRoom(roomId, isRanked = false) {
  return {
    id: roomId, phase: 'waiting', isRanked,
    players: [],
    premises: {}, premisePokemon: {},
    currentTurn: null,
    guesses: {}, mistakes: {},
    confirmedPokemon: {},
    oppSuggestHistory: {}, // was der Gegner vorgeschlagen hat (sieht man)
    winner: null, startTime: null,
    hasBot: false,
  };
}

function otherPlayer(room, userId) {
  return room.players.find(p => p.userId !== userId);
}

function roomStateFor(room, userId) {
  const opp = otherPlayer(room, userId);
  return {
    id: room.id, phase: room.phase, isRanked: room.isRanked,
    currentTurn: room.currentTurn, winner: room.winner,
    hasBot: room.hasBot,
    myPremiseId: room.premises[userId] || null,
    myMistakes:  room.mistakes[userId] || 0,
    opponentMistakes: opp ? (room.mistakes[opp.userId] || 0) : 0,
    opponentName: opp ? opp.username : null,
    opponentId:   opp ? opp.userId : null,
    confirmedForMe:  room.confirmedPokemon[userId] || [],
    myGuessHistory:  room.guesses[userId] || [],
    oppSuggestHistory: room.oppSuggestHistory[userId] || [],
  };
}

function emitToRoom(io, room, event, data) {
  for (const p of room.players) {
    if (p.isBot) continue;
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit(event, data);
  }
}

function emitStateToAll(io, room) {
  for (const p of room.players) {
    if (p.isBot) continue;
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('game:state', roomStateFor(room, p.userId));
  }
}

// ─── Bot-Aktionen ─────────────────────────────────────────────────────────────
function scheduleBotAction(io, room, botPlayer) {
  if (room.phase !== 'guessing' || room.currentTurn !== botPlayer.userId) return;

  const delay = botPlayer.thinkTime + Math.random() * 2000;

  setTimeout(() => {
    if (room.phase !== 'guessing' || room.currentTurn !== botPlayer.userId) return;

    const humanPlayer = otherPlayer(room, botPlayer.userId);
    if (!humanPlayer) return;

    const confirmed    = room.confirmedPokemon[botPlayer.userId] || [];
    const suggestedIds = (room.guesses[botPlayer.userId] || [])
      .filter(g => g.pokemonId).map(g => g.pokemonId);
    const wrongGuesses = (room.guesses[botPlayer.userId] || [])
      .filter(g => g.premiseGuess && g.result === 'wrong')
      .map(g => g.premiseGuess);

    // Soll der Bot die Prämisse raten?
    const currentMistakes = room.mistakes[botPlayer.userId] || 0;
    if (confirmed.length >= botPlayer.minConfirmed && currentMistakes < 3) {
      const guess = botGuessPremise(confirmed, wrongGuesses, botPlayer.guessAccuracy);
      if (guess) {
        performGuessPremise(io, room, botPlayer.userId, guess, botPlayer);
        return;
      }
    }

    // Pokémon vorschlagen
    const pokemon = choosePokemonToSuggest(
      confirmed.map(p => p.id), suggestedIds, botPlayer.guessAccuracy
    );
    if (pokemon) {
      performSuggestPokemon(io, room, botPlayer.userId, pokemon);
    }
  }, delay);
}

// ─── Pokémon vorschlagen (shared für Mensch + Bot) ────────────────────────────
function performSuggestPokemon(io, room, userId, pokemon) {
  const opponent = otherPlayer(room, userId);
  if (!opponent) return;

  const alreadySuggested = (room.guesses[userId] || []).some(g => g.pokemonId === pokemon.id);
  if (alreadySuggested) {
    if (room.players.find(p => p.userId === userId)?.isBot) {
      scheduleBotAction(io, room, room.players.find(p => p.userId === userId));
    }
    return;
  }

  const opponentPremiseId = room.premises[opponent.userId];
  const matches = pokemonMatchesPremise(pokemon, opponentPremiseId);

  // Teilmatch bei Doppeltyp-Prämissen: einer der zwei Typen passt, aber nicht beide
  let isPartial = false;
  if (!matches && opponentPremiseId.startsWith('dualtype_')) {
    const oppPremise = getPremiseById(opponentPremiseId);
    if (oppPremise?.dualTypes) {
      isPartial = oppPremise.dualTypes.some(t => (pokemon.types || []).includes(t));
    }
  }
  const resultStr = matches ? 'yes' : (isPartial ? 'partial' : 'no');

  const entry = {
    pokemonId: pokemon.id, pokemonName: pokemon.nameDE,
    pokemonSprite: pokemon.sprite, pokemonTypes: pokemon.types,
    result: resultStr, timestamp: Date.now(),
  };
  room.guesses[userId].push(entry);

  if (matches) {
    room.confirmedPokemon[userId].push({
      id: pokemon.id, name: pokemon.nameDE,
      sprite: pokemon.sprite, types: pokemon.types,
      isLegendary: pokemon.isLegendary || false,
      isMythical:  pokemon.isMythical  || false,
    });
  }

  if (!room.oppSuggestHistory[opponent.userId]) room.oppSuggestHistory[opponent.userId] = [];
  room.oppSuggestHistory[opponent.userId].push({
    pokemonId: pokemon.id, pokemonName: pokemon.nameDE,
    pokemonSprite: pokemon.sprite, pokemonTypes: pokemon.types,
    result: resultStr,
  });

  if (!matches) room.currentTurn = opponent.userId;

  emitStateToAll(io, room);
  emitToRoom(io, room, 'game:pokemonResult', {
    suggestedBy: userId,
    pokemon: { id: pokemon.id, name: pokemon.nameDE, sprite: pokemon.sprite, types: pokemon.types },
    matches, isPartial, nextTurn: room.currentTurn,
  });

  if (!matches) {
    const nextPlayer = room.players.find(p => p.userId === room.currentTurn);
    if (nextPlayer?.isBot) scheduleBotAction(io, room, nextPlayer);
  } else {
    const cur = room.players.find(p => p.userId === userId);
    if (cur?.isBot) scheduleBotAction(io, room, cur);
  }
}

// ─── Prämisse raten (shared für Mensch + Bot) ─────────────────────────────────
function performGuessPremise(io, room, userId, premiseId, playerRef) {
  const opponent = otherPlayer(room, userId);
  if (!opponent) return;

  const correct = premiseId === room.premises[opponent.userId];
  const label   = getPremiseById(premiseId)?.label || premiseId;

  room.guesses[userId].push({
    premiseGuess: premiseId, premiseLabel: label,
    result: correct ? 'correct' : 'wrong', timestamp: Date.now(),
  });

  if (correct) {
    room.phase  = 'finished';
    room.winner = userId;
    emitStateToAll(io, room);
    emitToRoom(io, room, 'game:over', {
      winner: userId, winnerName: playerRef?.username || 'Spieler',
      loser: opponent.userId, loserName: opponent.username,
      opponentPremise: getPremiseById(room.premises[opponent.userId]),
      myPremise: getPremiseById(room.premises[userId]),
      reason: 'correct_guess',
    });
    handleGameEnd(io, room, userId, opponent.userId);
  } else {
    room.mistakes[userId] = (room.mistakes[userId] || 0) + 1;
    if (room.mistakes[userId] >= 3) {
      room.phase  = 'finished';
      room.winner = opponent.userId;
      emitStateToAll(io, room);
      emitToRoom(io, room, 'game:over', {
        winner: opponent.userId, winnerName: opponent.username,
        loser: userId, loserName: playerRef?.username || 'Spieler',
        opponentPremise: getPremiseById(room.premises[opponent.userId]),
        myPremise: getPremiseById(room.premises[userId]),
        reason: 'max_mistakes',
      });
      handleGameEnd(io, room, opponent.userId, userId);
    } else {
      room.currentTurn = opponent.userId;
      emitStateToAll(io, room);
      emitToRoom(io, room, 'game:wrongGuess', {
        guessedBy: userId,
        premiseLabel: label,
        mistakesLeft: 3 - room.mistakes[userId],
        nextTurn: room.currentTurn,
      });
      // Bot-Zug?
      const nextP = room.players.find(p => p.userId === room.currentTurn);
      if (nextP?.isBot) scheduleBotAction(io, room, nextP);
    }
  }
}

// ─── Bot-Prämisse sofort wählen (nach kurzer Verzögerung) ────────────────────
function botChoosePremise(io, room, botPlayer) {
  const delay = 1500 + Math.random() * 2000;
  setTimeout(() => {
    if (room.phase !== 'selecting') return;
    const premise = choosePremiseForBot(botPlayer.level);
    if (!premise) return;

    room.premises[botPlayer.userId] = premise.id;
    room.premisePokemon[botPlayer.userId] = getPokemonForPremise(premise.id);

    const bothChosen = room.players.every(p => room.premises[p.userId]);
    if (bothChosen) startGame(io, room);
  }, delay);
}

function startGame(io, room) {
  room.phase = 'guessing';
  room.startTime = Date.now();
  const startIdx = Math.floor(Math.random() * room.players.length);
  room.currentTurn = room.players[startIdx].userId;

  emitStateToAll(io, room);
  emitToRoom(io, room, 'game:started', {
    currentTurn: room.currentTurn,
    currentTurnName: room.players[startIdx].username,
  });

  const startPlayer = room.players[startIdx];
  if (startPlayer.isBot) scheduleBotAction(io, room, startPlayer);
}

// ─── Ranked Matchmaking ───────────────────────────────────────────────────────
function processRankedQueue(io) {
  if (rankedQueue.length < 2) return;

  rankedQueue.sort((a, b) => a.joinedAt - b.joinedAt);
  const p1 = rankedQueue.shift();
  const p2 = rankedQueue.shift();

  // LP-Prüfung: max 200 LP Unterschied (bei langer Wartezeit lockerer)
  const waitP2 = Date.now() - p2.joinedAt;
  const maxDiff = waitP2 > 10000 ? 400 : 200;
  if (Math.abs(p1.lp - p2.lp) > maxDiff) {
    rankedQueue.unshift(p2); rankedQueue.unshift(p1);
    return;
  }

  const roomId = `ranked_${Date.now()}`;
  const room   = createRoom(roomId, true);
  rooms.set(roomId, room);

  room.players.push(
    { socketId: p1.socketId, userId: p1.userId, username: p1.username, level: p1.level, lp: p1.lp, isBot: false },
    { socketId: p2.socketId, userId: p2.userId, username: p2.username, level: p2.level, lp: p2.lp, isBot: false },
  );
  [p1, p2].forEach(p => {
    players.set(p.socketId, { userId: p.userId, username: p.username, roomId });
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.join(roomId);
    room.mistakes[p.userId] = 0;
    room.guesses[p.userId]  = [];
    room.confirmedPokemon[p.userId] = [];
    room.oppSuggestHistory[p.userId] = [];
  });

  room.phase = 'selecting';
  emitToRoom(io, room, 'game:selectPremise', {
    message: '⚔ Ranked Match gefunden! Wähle deine Prämisse.',
    players: room.players.map(p => ({ username: p.username, userId: p.userId })),
    isRanked: true,
  });
}

function injectBot(io, entry) {
  // Spieler noch in Queue?
  if (!rankedQueue.find(q => q.userId === entry.userId)) return;
  rankedQueue = rankedQueue.filter(q => q.userId !== entry.userId);

  const socket = io.sockets.sockets.get(entry.socketId);
  if (!socket) return;

  const bot = getBotForLP(entry.lp);
  const roomId = `ranked_bot_${Date.now()}`;
  const room   = createRoom(roomId, true);
  rooms.set(roomId, room);
  room.hasBot = true;

  const humanPlayerEntry = { socketId: entry.socketId, userId: entry.userId, username: entry.username, level: entry.level, lp: entry.lp, isBot: false };
  const botEntry = { socketId: null, userId: bot.userId, username: bot.name, level: bot.level, lp: bot.lp, isBot: true, ...bot };

  room.players.push(humanPlayerEntry, botEntry);
  players.set(entry.socketId, { userId: entry.userId, username: entry.username, roomId });
  socket.join(roomId);

  [humanPlayerEntry, botEntry].forEach(p => {
    room.mistakes[p.userId] = 0;
    room.guesses[p.userId]  = [];
    room.confirmedPokemon[p.userId] = [];
    room.oppSuggestHistory[p.userId] = [];
  });

  room.phase = 'selecting';
  socket.emit('game:selectPremise', {
    message: '⚔ Gegner gefunden! Wähle deine Prämisse.',
    players: room.players.map(p => ({ username: p.username, userId: p.userId })),
    isRanked: true,
  });

  botChoosePremise(io, room, botEntry);
}

// ─── XP/LP/Coins/Pokédex nach Spielende ─────────────────────────────────────
async function handleGameEnd(io, room, winnerId, loserId) {
  try {
    const User = require('../models/User');
    const winnerIsBot = room.players.find(p => p.userId === winnerId)?.isBot;
    const loserIsBot  = room.players.find(p => p.userId === loserId)?.isBot;

    const lpWin  = room.isRanked ? (winnerIsBot ? 0 : (loserIsBot ? LP.WIN_VS_BOT  : LP.WIN_VS_PLAYER))  : 0;
    const lpLoss = room.isRanked ? (loserIsBot  ? 0 : (winnerIsBot ? LP.LOSS_VS_BOT : LP.LOSS_VS_PLAYER)) : 0;

    // Coin-Belohnungen bestimmen
    function calcCoins(isWinner, oppIsBot) {
      if (room.isRanked) {
        return isWinner
          ? (oppIsBot ? COINS.WIN_RANKED_BOT  : COINS.WIN_RANKED_PLAYER)
          : (oppIsBot ? COINS.LOSS_RANKED_BOT : COINS.LOSS_RANKED_PLAYER);
      }
      return isWinner ? COINS.WIN_PRIVATE : COINS.LOSS_PRIVATE;
    }

    const updates = [];
    if (!winnerIsBot) updates.push({ id: winnerId, xp: 50, lp: lpWin,  win: true,  ranked: room.isRanked, oppIsBot: loserIsBot  });
    if (!loserIsBot)  updates.push({ id: loserId,  xp: 10, lp: lpLoss, win: false, ranked: room.isRanked, oppIsBot: winnerIsBot });

    for (const u of updates) {
      const user = await User.findById(u.id);
      if (!user) continue;

      // XP + Level
      user.addXp(u.xp);

      // LP (Ranked)
      if (room.isRanked) user.addLp(u.lp);

      // Statistiken
      user.stats.gamesPlayed += 1;
      if (u.win) { user.stats.wins += 1; if (u.ranked) user.stats.rankedWins += 1; }
      else        { user.stats.losses += 1; if (u.ranked) user.stats.rankedLosses += 1; }

      // Coins
      const coinsEarned = calcCoins(u.win, u.oppIsBot);
      user.addCoins(coinsEarned);

      // Pokédex: bestätigte Pokémon (eigene, die auf Gegner-Prämisse gepasst haben)
      const confirmed = room.confirmedPokemon[u.id] || [];
      const newDexEntries = [];
      for (const p of confirmed) {
        const added = user.addToPokedex({
          pokemonId:   p.id,
          pokemonName: p.name,
          sprite:      p.sprite,
          types:       p.types,
          isLegendary: p.isLegendary || false,
          isMythical:  p.isMythical  || false,
        });
        if (added) newDexEntries.push(p.id);
      }

      await user.save();

      const sock = io.sockets.sockets.get(userSockets.get(u.id));
      if (sock) sock.emit('user:statsUpdated', {
        level: user.level, xp: user.xp, xpToNext: user.xpToNextLevel(),
        lp: user.lp, league: user.league, stats: user.stats,
        coins: user.coins, coinsEarned,
        lpChange: u.lp,
        newDexEntries,
        dexCount: user.pokedex.length,
      });
    }
  } catch (e) { console.error('handleGameEnd Fehler:', e); }
}

// ─── Socket-Handler ───────────────────────────────────────────────────────────
module.exports = function registerGameHandler(io) {
  // Auth Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Nicht authentifiziert'));
    try { socket.userData = jwt.verify(token, process.env.JWT_SECRET); next(); }
    catch { next(new Error('Token ungültig')); }
  });

  // Ranked Queue Prozessor (alle 2s)
  setInterval(() => processRankedQueue(io), 2000);

  io.on('connection', (socket) => {
    const { id: userId, username } = socket.userData;

    // Reconnect
    if (userSockets.has(userId)) {
      const old = userSockets.get(userId);
      const oldInfo = players.get(old);
      if (oldInfo) {
        const room = rooms.get(oldInfo.roomId);
        if (room) {
          const p = room.players.find(p => p.userId === userId);
          if (p) p.socketId = socket.id;
        }
        players.delete(old);
      }
    }
    userSockets.set(userId, socket.id);

    // ── Privates Spiel: Lobby beitreten ───────────────────────
    socket.on('lobby:join', ({ roomId, level, lp }) => {
      if (!roomId) return socket.emit('error', { message: 'Kein Raum-Code' });
      let room = rooms.get(roomId);
      if (!room) { room = createRoom(roomId, false); rooms.set(roomId, room); }
      if (room.players.length >= 2 && !room.players.find(p => p.userId === userId))
        return socket.emit('error', { message: 'Raum ist voll' });

      const existing = room.players.find(p => p.userId === userId);
      if (!existing) room.players.push({ socketId: socket.id, userId, username, level: level||1, lp: lp||0, isBot: false });
      else { existing.socketId = socket.id; }

      players.set(socket.id, { userId, username, roomId });
      socket.join(roomId);

      socket.emit('lobby:joined', {
        roomId, playerCount: room.players.length,
        players: room.players.map(p => ({ username: p.username, userId: p.userId })),
      });

      if (room.players.length === 2 && room.phase === 'waiting') {
        room.phase = 'selecting';
        room.players.forEach(p => {
          room.mistakes[p.userId] = 0; room.guesses[p.userId] = [];
          room.confirmedPokemon[p.userId] = []; room.oppSuggestHistory[p.userId] = [];
        });
        emitToRoom(io, room, 'game:selectPremise', {
          message: 'Gegner gefunden! Wähle deine Prämisse.',
          players: room.players.map(p => ({ username: p.username, userId: p.userId })),
        });
      } else if (room.players.length === 2) {
        emitStateToAll(io, room);
      } else {
        socket.emit('lobby:waiting', { message: 'Warte auf Mitspieler…' });
      }
    });

    // ── Ranked Queue ───────────────────────────────────────────
    socket.on('ranked:join', async ({ level, lp }) => {
      if (rankedQueue.find(q => q.userId === userId)) return;
      const entry = { userId, username, level: level||1, lp: lp||0, socketId: socket.id, joinedAt: Date.now() };
      rankedQueue.push(entry);
      socket.emit('ranked:queued', { position: rankedQueue.length });

      // Bot-Fallback nach 15s
      setTimeout(() => injectBot(io, entry), QUEUE_BOT_TIMEOUT);
    });

    socket.on('ranked:leave', () => {
      rankedQueue = rankedQueue.filter(q => q.userId !== userId);
      socket.emit('ranked:left');
    });

    // ── Prämisse wählen ───────────────────────────────────────
    socket.on('game:choosePremise', ({ premiseId }) => {
      const info = players.get(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (!room || room.phase !== 'selecting') return;

      const premise = getPremiseById(premiseId);
      if (!premise) return socket.emit('error', { message: 'Unbekannte Prämisse' });

      const player = room.players.find(p => p.userId === userId);
      const maxTier = getMaxTierForLevel(player?.level || 1);
      if (premise.tier > maxTier)
        return socket.emit('error', { message: 'Prämisse noch nicht freigeschaltet' });

      room.premises[userId] = premiseId;
      room.premisePokemon[userId] = getPokemonForPremise(premiseId);

      socket.emit('game:premiseConfirmed', {
        premiseId, label: premise.label,
        pokemon: room.premisePokemon[userId].map(p => ({
          id: p.id, name: p.name, nameDE: p.nameDE, sprite: p.sprite, types: p.types,
        })),
      });

      const opp = otherPlayer(room, userId);
      if (opp && !opp.isBot) {
        const oppSocket = io.sockets.sockets.get(opp.socketId);
        if (oppSocket) oppSocket.emit('game:opponentChosePremise', { username });
      }

      if (room.players.every(p => room.premises[p.userId])) startGame(io, room);
    });

    // ── Pokémon vorschlagen ────────────────────────────────────
    socket.on('game:suggestPokemon', ({ pokemonName }) => {
      const info = players.get(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (!room || room.phase !== 'guessing') return;
      if (room.currentTurn !== userId) return socket.emit('error', { message: 'Du bist nicht dran' });

      const pokemon = findPokemonByName(pokemonName);
      if (!pokemon) return socket.emit('error', { message: `„${pokemonName}" nicht gefunden` });

      performSuggestPokemon(io, room, userId, pokemon);
    });

    // ── Prämisse raten ─────────────────────────────────────────
    socket.on('game:guessPremise', ({ premiseId }) => {
      const info = players.get(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (!room || room.phase !== 'guessing') return;
      if (room.currentTurn !== userId) return socket.emit('error', { message: 'Du bist nicht dran' });

      const player = room.players.find(p => p.userId === userId);
      performGuessPremise(io, room, userId, premiseId, player);
    });

    // ── Zug passen (Timer abgelaufen, keine Eingabe) ──────────
    socket.on('game:passTurn', () => {
      const info = players.get(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (!room || room.phase !== 'guessing') return;
      if (room.currentTurn !== userId) return;
      const opponent = otherPlayer(room, userId);
      if (!opponent) return;
      room.currentTurn = opponent.userId;
      emitStateToAll(io, room);
      const nextP = room.players.find(p => p.userId === room.currentTurn);
      if (nextP?.isBot) scheduleBotAction(io, room, nextP);
    });

    // ── Aufgeben ───────────────────────────────────────────────
    socket.on('game:surrender', () => {
      const info = players.get(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (!room || room.phase !== 'guessing') return;

      const opponent = otherPlayer(room, userId);
      if (!opponent) return;

      const player = room.players.find(p => p.userId === userId);
      room.phase  = 'finished';
      room.winner = opponent.userId;

      emitStateToAll(io, room);
      emitToRoom(io, room, 'game:over', {
        winner: opponent.userId, winnerName: opponent.username,
        loser: userId, loserName: player?.username || 'Spieler',
        opponentPremise: getPremiseById(room.premises[opponent.userId]),
        myPremise:       getPremiseById(room.premises[userId]),
        reason: 'surrender',
      });
      handleGameEnd(io, room, opponent.userId, userId);
    });

    // ── Rematch ────────────────────────────────────────────────
    socket.on('game:rematch', () => {
      const info = players.get(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (!room || room.phase !== 'finished') return;

      // Bots raus bei Rematch → neues privates Spiel
      if (room.hasBot) {
        socket.emit('lobby:waiting', { message: 'Suche neuen Gegner…' });
        // Neues Ranked-Spiel anfragen
        const player = room.players.find(p => p.userId === userId);
        socket.emit('ranked:rematch');
        return;
      }

      room.phase = 'selecting'; room.premises = {}; room.premisePokemon = {};
      room.currentTurn = null; room.winner = null; room.startTime = null;
      room.players.forEach(p => {
        room.mistakes[p.userId] = 0; room.guesses[p.userId] = [];
        room.confirmedPokemon[p.userId] = []; room.oppSuggestHistory[p.userId] = [];
      });
      emitToRoom(io, room, 'game:selectPremise', {
        message: 'Rematch! Wähle deine neue Prämisse.',
        players: room.players.map(p => ({ username: p.username, userId: p.userId })),
        isRanked: room.isRanked,
      });
    });

    // ── Disconnect ─────────────────────────────────────────────
    socket.on('disconnect', () => {
      rankedQueue = rankedQueue.filter(q => q.userId !== userId);
      const info = players.get(socket.id);
      players.delete(socket.id);
      if (!info) return;
      const room = rooms.get(info.roomId);
      if (room && room.phase !== 'finished') {
        const opp = otherPlayer(room, userId);
        if (opp && !opp.isBot) {
          const s = io.sockets.sockets.get(opp.socketId);
          if (s) s.emit('game:opponentDisconnected', { username });
        }
      }
      setTimeout(() => {
        const r = rooms.get(info.roomId);
        if (r && r.players.every(p => p.isBot || !io.sockets.sockets.get(p.socketId)))
          rooms.delete(info.roomId);
      }, 60_000);
    });

    socket.on('error', () => {});
  });
};
