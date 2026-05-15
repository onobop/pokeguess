const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

function makeToken(user) {
  return jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });

    const exists = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (exists)
      return res.status(409).json({ error: 'Benutzername bereits vergeben' });

    const user = await User.create({ username, password });
    res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    res.json({ user: publicUser(user) });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

function publicUser(u) {
  return {
    id: u._id,
    username: u.username,
    level: u.level,
    xp: u.xp,
    xpToNext: u.xpToNextLevel(),
    stats: u.stats,
  };
}

module.exports = router;
