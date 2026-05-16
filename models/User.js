const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ─── Liga-System ──────────────────────────────────────────────────────────────
const LEAGUES = ['Pokéball', 'Superball', 'Hyperball', 'Meisterball'];
const LEAGUE_THRESHOLDS = [0, 300, 600, 900];

function lpToLeague(lp) {
  let idx = 0;
  for (let i = LEAGUE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (lp >= LEAGUE_THRESHOLDS[i]) { idx = i; break; }
  }
  return { leagueIdx: idx, leagueName: LEAGUES[idx] };
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    trim: true, minlength: 3, maxlength: 20,
  },
  password: { type: String, required: true, minlength: 6 },

  // Progression
  level: { type: Number, default: 1 },
  xp:    { type: Number, default: 0 },

  // Ranked
  lp:    { type: Number, default: 0 },
  league: {
    leagueIdx:  { type: Number, default: 0 },
    leagueName: { type: String, default: 'Pokéball' },
  },

  // RocketCoins
  coins: { type: Number, default: 0 },

  // Pokédex – bestätigte Pokémon aus Spielen
  pokedex: [{
    pokemonId:   { type: Number, required: true },
    pokemonName: { type: String },
    sprite:      { type: String },
    types:       [{ type: String }],
    isLegendary: { type: Boolean, default: false },
    isMythical:  { type: Boolean, default: false },
    isShiny:     { type: Boolean, default: false },
    obtainedAt:  { type: Date, default: Date.now },
  }],

  // Statistiken
  stats: {
    wins:        { type: Number, default: 0 },
    losses:      { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    rankedWins:  { type: Number, default: 0 },
    rankedLosses:{ type: Number, default: 0 },
  },

  // Freunde
  friends:        [{ type: String }],
  friendRequests: [{ type: String }],

}, { timestamps: true });

// ─── XP-System ────────────────────────────────────────────────────────────────
userSchema.methods.xpToNextLevel = function () {
  return this.level * 100;
};

userSchema.methods.addXp = function (amount) {
  this.xp += amount;
  while (this.xp >= this.xpToNextLevel()) {
    this.xp -= this.xpToNextLevel();
    this.level += 1;
  }
};

// ─── LP-System ────────────────────────────────────────────────────────────────
userSchema.methods.addLp = function (amount) {
  this.lp = Math.max(0, this.lp + amount);
  const league = lpToLeague(this.lp);
  this.league = league;
};

// ─── Coins ────────────────────────────────────────────────────────────────────
userSchema.methods.addCoins = function (amount) {
  this.coins = Math.max(0, (this.coins || 0) + amount);
};

// ─── Pokédex ──────────────────────────────────────────────────────────────────
/** Fügt Pokémon zum Pokédex hinzu (kein Duplikat). Gibt true zurück wenn neu. */
userSchema.methods.addToPokedex = function (entry) {
  const exists = this.pokedex.some(e => e.pokemonId === entry.pokemonId);
  if (exists) return false;
  this.pokedex.push({
    pokemonId:   entry.pokemonId,
    pokemonName: entry.pokemonName,
    sprite:      entry.sprite,
    types:       entry.types || [],
    isLegendary: entry.isLegendary || false,
    isMythical:  entry.isMythical  || false,
    isShiny:     false,
    obtainedAt:  new Date(),
  });
  return true;
};

/** Kauft Shiny-Version für ein Pokémon. Gibt { ok, reason } zurück. */
userSchema.methods.buyShiny = function (pokemonId) {
  const entry = this.pokedex.find(e => e.pokemonId === pokemonId);
  if (!entry)        return { ok: false, reason: 'Pokémon nicht im Pokédex' };
  if (entry.isShiny) return { ok: false, reason: 'Shiny bereits vorhanden' };

  const price = (entry.isLegendary || entry.isMythical) ? 100 : 50;
  if (this.coins < price) return { ok: false, reason: `Zu wenig Coins (${price} 🪙 benötigt)` };

  this.coins -= price;
  entry.isShiny = true;
  return { ok: true, price };
};

// ─── Passwort ─────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ─── Öffentliches Profil ──────────────────────────────────────────────────────
userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    username: this.username,
    level: this.level,
    xp: this.xp,
    xpToNext: this.xpToNextLevel(),
    lp: this.lp,
    league: this.league,
    coins: this.coins || 0,
    dexCount: this.pokedex?.length || 0,
    stats: this.stats,
    friends: this.friends,
    friendRequests: this.friendRequests,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.lpToLeague = lpToLeague;
module.exports.LEAGUES = LEAGUES;
module.exports.LEAGUE_THRESHOLDS = LEAGUE_THRESHOLDS;
