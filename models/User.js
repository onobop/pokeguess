const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  level: { type: Number, default: 1 },
  xp:    { type: Number, default: 0 },
  stats: {
    wins:   { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
  },
}, { timestamps: true });

// XP zum nächsten Level
userSchema.methods.xpToNextLevel = function () {
  return this.level * 100;
};

// XP hinzufügen & ggf. Level-Up
userSchema.methods.addXp = function (amount) {
  this.xp += amount;
  while (this.xp >= this.xpToNextLevel()) {
    this.xp -= this.xpToNextLevel();
    this.level += 1;
  }
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
