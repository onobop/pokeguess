/**
 * gameHandler.js
 * Verwaltet alle Spielzustände und Socket-Events.
 *
 * Spielablauf:
 *  1. Beide Spieler joinen eine Lobby → ready
 *  2. Beide wählen eine Prämisse (und sehen ihre Pokémon-Liste)
 *  3. Zufällig wird Startspieler gewählt → phase: 'guessing'
 *  4. Am Zug: Pokémon vorschlagen ODER Prämisse raten
 *     - Pokémon: Auto-Check → ja/nein; nein = Zugwechsel
 *     - Prämisse raten: falsch = Fehlversuch (max 3), richtig = Sieg
 *  5. 3 Fehlversuche → Verlierer
 */

const jwt = require('jsonwebtoken');
const { pokemonMatchesPremise, findPokemonByName, getPremiseById, getPokemonForPremise } = require('../engine/premiseEngine');

// ─── In-Memory Spielzustand ────────────────────────────────────────────────────
// rooms: Map<roomId, RoomState>
const rooms = new Map();

// socketId → { userId, username, roomId }
const players = new Map();

// userId → socketId  (für Reconnect)
const userSockets = new Map();

function createRoom(roomId) {
  return {
    id: roomId,
    phase: 'waiting',   // waiting | selecting | guessing | finished
    players: [],        // [{ socketId, userId, username, level }]
    premises: {},       // { userId: premiseId }
    premisePokemon: {}, // { userId: [pokemon] }  – die gültige Pokemon-Liste zur Prämisse
    currentTurn: null,  // userId wer gerade dran ist
    guesses: {},        // { userId: [{ pokemon?, premiseGuess?, result }] }
    mistakes: {},       // { userId: number }
    confirmedPokemon: {},// { userId: [pokemon] }  – korrekt vom Gegner erraten
    winner: null,
    startTime: null,
  };
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function otherPlayer(room, userId) {
  return room.players.find(p => p.userId !== userId);
}

function roomPublicState(room, forUserId) {
  // Gibt dem Spieler seinen eigenen Prämissen-Kontext,
  // aber verbirgt die Prämisse des Gegners.
  const opponent = otherPlayer(room, forUserId);
  return {
    id: room.id,
    phase: room.phase,
    currentTurn: room.currentTurn,
    winner: room.winner,
    myPremiseId: room.premises[forUserId] || null,
    myMistakes: room.mistakes[forUserId] || 0,
    opponentMistakes: opponent ? (room.mistakes[opponent.userId] || 0) : 0,
    opponentName: opponent ? opponent.username : null,
    opponentId: opponent ? opponent.userId : null,
    // Pokémon, die mein Gegner mir korrekt als zugehörig zu seiner Prämisse vorgeschlagen hat
    confirmedForMe: room.confirmedPokemon[forUserId] || [],
    // Pokémon, die ich dem Gegner vorgeschlagen habe (mit ja/nein Antwort)
    myGuessHistory: room.guesses[forUserId] || [],
  };
}

function emitToRoom(io, room, event, data) {
  for (const p of room.players) {
    const socket = io.sockets.sockets.get(p.socketId);
    if (socket) socket.emit(event, data);
  }
}

function emitStateToAll(io, room) {
  for (const p of room.players) {
    const socket = io.sockets.sockets.get(p.socketId);
    if (socket) socket.emit('game:state', roomPublicState(room, p.userId));
  }
}

// ─── Socket-Handler registrieren ─────────────────────────────────────────────

module.exports = function registerGameHandler(io) {

  // Auth-Middleware für Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Nicht authentifiziert'));
    try {
      socket.userData = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Token ungültig'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, username } = socket.userData;

    // Alten Socket ersetzen bei Reconnect
    if (userSockets.has(userId)) {
      const oldSocketId = userSockets.get(userId);
      const oldPlayer = players.get(oldSocketId);
      if (oldPlayer) {
        const room = rooms.get(oldPlayer.roomId);
        if (room) {
          const player = room.players.find(p => p.userId === userId);
          if (player) player.socketId = socket.id;
        }
        players.delete(oldSocketId);
      }
    }
    userSockets.set(userId, socket.id);

    // ── join_lobby ─────────────────────────────────────────────────────────
    socket.on('lobby:join', ({ roomId, level }) => {
      if (!roomId) return socket.emit('error', { message: 'Kein Raum angegeben' });

      let room = rooms.get(roomId);
      if (!room) {
        room = createRoom(roomId);
        rooms.set(roomId, room);
      }

      if (room.players.length >= 2 && !room.players.find(p => p.userId === userId)) {
        return socket.emit('error', { message: 'Raum ist voll' });
      }

      // Spieler hinzufügen oder updaten
      const existing = room.players.find(p => p.userId === userId);
      if (!existing) {
        room.players.push({ socketId: socket.id, userId, username, level: level || 1 });
      } else {
        existing.socketId = socket.id;
        existing.level = level || existing.level;
      }

      players.set(socket.id, { userId, username, roomId });
      socket.join(roomId);

      socket.emit('lobby:joined', {
        roomId,
        playerCount: room.players.length,
        players: room.players.map(p => ({ username: p.username, userId: p.userId })),
      });

      // Zweiter Spieler da → Prämissen-Auswahl starten
      if (room.players.length === 2 && room.phase === 'waiting') {
        room.phase = 'selecting';
        room.mistakes = {};
        room.guesses = {};
        room.confirmedPokemon = {};
        room.premises = {};
        room.premisePokemon = {};
        room.players.forEach(p => {
          room.mistakes[p.userId] = 0;
          room.guesses[p.userId] = [];
          room.confirmedPokemon[p.userId] = [];
        });
        emitToRoom(io, room, 'game:selectPremise', {
          message: 'Beide Spieler sind da! Wähle deine Prämisse.',
          players: room.players.map(p => ({ username: p.username, userId: p.userId })),
        });
      } else if (room.players.length === 2) {
        emitStateToAll(io, room);
      } else {
        socket.emit('lobby:waiting', { message: 'Warte auf Mitspieler...' });
      }
    });

    // ── Prämisse wählen ────────────────────────────────────────────────────
    socket.on('game:choosePremise', ({ premiseId }) => {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      const room = rooms.get(playerInfo.roomId);
      if (!room || room.phase !== 'selecting') return;

      const premise = getPremiseById(premiseId);
      if (!premise) return socket.emit('error', { message: 'Unbekannte Prämisse' });

      // Tier-Check (Level des wählenden Spielers)
      const player = room.players.find(p => p.userId === userId);
      const maxTier = player.level >= 10 ? 2 : 1;
      if (premise.tier > maxTier) {
        return socket.emit('error', { message: 'Prämisse noch nicht freigeschaltet' });
      }

      room.premises[userId] = premiseId;
      const pokemonList = getPokemonForPremise(premiseId);
      room.premisePokemon[userId] = pokemonList;

      // Dem Wähler seine Pokémon-Liste schicken
      socket.emit('game:premiseConfirmed', {
        premiseId,
        label: premise.label,
        pokemon: pokemonList.map(p => ({
          id: p.id, name: p.name, nameDE: p.nameDE, sprite: p.sprite, types: p.types,
        })),
      });

      // Beide gewählt? → Spiel starten
      const bothChosen = room.players.every(p => room.premises[p.userId]);
      if (bothChosen) {
        room.phase = 'guessing';
        room.startTime = Date.now();
        // Zufälliger Startspieler
        const startIdx = Math.floor(Math.random() * room.players.length);
        room.currentTurn = room.players[startIdx].userId;
        emitStateToAll(io, room);
        emitToRoom(io, room, 'game:started', {
          currentTurn: room.currentTurn,
          currentTurnName: room.players[startIdx].username,
        });
      } else {
        // Dem anderen sagen, dass der erste gewählt hat
        const opponent = otherPlayer(room, userId);
        if (opponent) {
          const oppSocket = io.sockets.sockets.get(opponent.socketId);
          if (oppSocket) oppSocket.emit('game:opponentChosePremise', { username });
        }
      }
    });

    // ── Pokémon vorschlagen ────────────────────────────────────────────────
    socket.on('game:suggestPokemon', ({ pokemonName }) => {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      const room = rooms.get(playerInfo.roomId);
      if (!room || room.phase !== 'guessing') return;
      if (room.currentTurn !== userId) return socket.emit('error', { message: 'Du bist nicht dran' });

      const pokemon = findPokemonByName(pokemonName);
      if (!pokemon) return socket.emit('error', { message: `Pokémon "${pokemonName}" nicht gefunden` });

      const opponent = otherPlayer(room, userId);
      if (!opponent) return;

      // Wurde dieses Pokemon schon vorgeschlagen?
      const alreadySuggested = room.guesses[userId].some(g => g.pokemonId === pokemon.id);
      if (alreadySuggested) return socket.emit('error', { message: 'Dieses Pokémon hast du bereits vorgeschlagen' });

      // Auto-Check: Trifft das Pokémon die Prämisse des Gegners?
      const opponentPremiseId = room.premises[opponent.userId];
      const matches = pokemonMatchesPremise(pokemon, opponentPremiseId);

      const guessEntry = {
        pokemonId: pokemon.id,
        pokemonName: pokemon.nameDE,
        pokemonSprite: pokemon.sprite,
        pokemonTypes: pokemon.types,
        result: matches ? 'yes' : 'no',
        timestamp: Date.now(),
      };
      room.guesses[userId].push(guessEntry);

      if (matches) {
        // Bestätigtes Pokémon für den Ratenden sichtbar
        room.confirmedPokemon[userId].push({
          id: pokemon.id,
          name: pokemon.nameDE,
          sprite: pokemon.sprite,
          types: pokemon.types,
        });
        // Spieler bleibt dran
      } else {
        // Zugwechsel
        room.currentTurn = opponent.userId;
      }

      emitStateToAll(io, room);
      emitToRoom(io, room, 'game:pokemonResult', {
        suggestedBy: userId,
        suggestedByName: username,
        pokemon: { id: pokemon.id, name: pokemon.nameDE, sprite: pokemon.sprite, types: pokemon.types },
        matches,
        nextTurn: room.currentTurn,
      });
    });

    // ── Prämisse raten ─────────────────────────────────────────────────────
    socket.on('game:guessPremise', ({ premiseId }) => {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      const room = rooms.get(playerInfo.roomId);
      if (!room || room.phase !== 'guessing') return;
      if (room.currentTurn !== userId) return socket.emit('error', { message: 'Du bist nicht dran' });

      const opponent = otherPlayer(room, userId);
      if (!opponent) return;

      const opponentPremiseId = room.premises[opponent.userId];
      const correct = premiseId === opponentPremiseId;

      room.guesses[userId].push({
        premiseGuess: premiseId,
        premiseLabel: getPremiseById(premiseId)?.label || premiseId,
        result: correct ? 'correct' : 'wrong',
        timestamp: Date.now(),
      });

      if (correct) {
        // Sieg!
        room.phase = 'finished';
        room.winner = userId;
        emitStateToAll(io, room);
        emitToRoom(io, room, 'game:over', {
          winner: userId,
          winnerName: username,
          loser: opponent.userId,
          loserName: opponent.username,
          opponentPremise: getPremiseById(opponentPremiseId),
          reason: 'correct_guess',
        });
        handleGameEnd(io, room, userId, opponent.userId);
      } else {
        room.mistakes[userId] = (room.mistakes[userId] || 0) + 1;

        if (room.mistakes[userId] >= 3) {
          // Verlierer durch 3 Fehlversuche
          room.phase = 'finished';
          room.winner = opponent.userId;
          emitStateToAll(io, room);
          emitToRoom(io, room, 'game:over', {
            winner: opponent.userId,
            winnerName: opponent.username,
            loser: userId,
            loserName: username,
            opponentPremise: getPremiseById(opponentPremiseId),
            reason: 'max_mistakes',
          });
          handleGameEnd(io, room, opponent.userId, userId);
        } else {
          // Zugwechsel nach Fehlversuch
          room.currentTurn = opponent.userId;
          emitStateToAll(io, room);
          emitToRoom(io, room, 'game:wrongGuess', {
            guessedBy: userId,
            guessedByName: username,
            premiseId,
            premiseLabel: getPremiseById(premiseId)?.label,
            mistakesLeft: 3 - room.mistakes[userId],
            nextTurn: room.currentTurn,
          });
        }
      }
    });

    // ── Rematch-Anfrage ────────────────────────────────────────────────────
    socket.on('game:rematch', () => {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      const room = rooms.get(playerInfo.roomId);
      if (!room || room.phase !== 'finished') return;

      // Raum zurücksetzen
      room.phase = 'selecting';
      room.premises = {};
      room.premisePokemon = {};
      room.currentTurn = null;
      room.winner = null;
      room.startTime = null;
      room.players.forEach(p => {
        room.mistakes[p.userId] = 0;
        room.guesses[p.userId] = [];
        room.confirmedPokemon[p.userId] = [];
      });

      emitToRoom(io, room, 'game:selectPremise', {
        message: 'Rematch! Wähle deine neue Prämisse.',
        players: room.players.map(p => ({ username: p.username, userId: p.userId })),
      });
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      const room = rooms.get(playerInfo.roomId);
      players.delete(socket.id);

      if (room && room.phase !== 'finished') {
        const opponent = otherPlayer(room, userId);
        if (opponent) {
          const oppSocket = io.sockets.sockets.get(opponent.socketId);
          if (oppSocket) oppSocket.emit('game:opponentDisconnected', { username });
        }
        // Raum nach 60s aufräumen wenn niemand reconnectet
        setTimeout(() => {
          const r = rooms.get(playerInfo.roomId);
          if (r && r.players.every(p => !io.sockets.sockets.get(p.socketId))) {
            rooms.delete(playerInfo.roomId);
          }
        }, 60_000);
      }
    });
  });
};

// ─── XP nach Spielende vergeben ───────────────────────────────────────────────
async function handleGameEnd(io, room, winnerId, loserId) {
  try {
    const User = require('../models/User');
    const [winner, loser] = await Promise.all([
      User.findById(winnerId),
      User.findById(loserId),
    ]);
    if (winner) {
      winner.addXp(50);
      winner.stats.wins += 1;
      winner.stats.gamesPlayed += 1;
      await winner.save();
    }
    if (loser) {
      loser.addXp(10);
      loser.stats.losses += 1;
      loser.stats.gamesPlayed += 1;
      await loser.save();
    }
    // Aktualisierte Stats an Spieler senden
    for (const p of room.players) {
      const sock = io.sockets.sockets.get(p.socketId);
      const user = p.userId === winnerId ? winner : loser;
      if (sock && user) {
        sock.emit('user:statsUpdated', {
          level: user.level,
          xp: user.xp,
          xpToNext: user.xpToNextLevel(),
          stats: user.stats,
        });
      }
    }
  } catch (e) {
    console.error('XP-Vergabe fehlgeschlagen:', e);
  }
}
