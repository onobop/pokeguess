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

  // Statistiken
  stats: {
    wins:        { type: Number, default: 0 },
    losses:      { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    rankedWins:  { type: Number, default: 0 },
    rankedLosses:{ type: Number, default: 0 },
  },

  // Freunde
  friends:        [{ type: String }],          // Usernames
  friendRequests: [{ type: String }],          // ausstehende Anfragen (von wem)

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
    stats: this.stats,
    friends: this.friends,
    friendRequests: this.friendRequests,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.lpToLeague = lpToLeague;
module.exports.LEAGUES = LEAGUES;
module.exports.LEAGUE_THRESHOLDS = LEAGUE_THRESHOLDS;
