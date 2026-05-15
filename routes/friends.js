const router = require('express').Router();
const auth   = require('../middleware/auth');
const User   = require('../models/User');

// GET /api/friends – eigene Freundesliste + ausstehende Anfragen
router.get('/', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('friends friendRequests');
    res.json({ friends: me.friends || [], requests: me.friendRequests || [] });
  } catch { res.status(500).json({ error: 'Serverfehler' }); }
});

// GET /api/friends/search?q=... – Spieler suchen
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });
    const users = await User.find({
      username: { $regex: q, $options: 'i' },
      _id: { $ne: req.user.id },
    }).select('username level lp league').limit(10);
    res.json({ results: users.map(u => ({
      username: u.username, level: u.level, lp: u.lp,
      leagueName: u.league?.leagueName || 'Pokéball',
    }))});
  } catch { res.status(500).json({ error: 'Serverfehler' }); }
});

// POST /api/friends/request – Freundschaftsanfrage senden
router.post('/request', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const me     = await User.findById(req.user.id);
    const target = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!target) return res.status(404).json({ error: 'Spieler nicht gefunden' });
    if (target._id.equals(me._id)) return res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen' });
    if (me.friends.includes(target.username)) return res.status(400).json({ error: 'Bereits befreundet' });
    if (target.friendRequests.includes(me.username)) return res.status(400).json({ error: 'Anfrage bereits gesendet' });

    target.friendRequests.push(me.username);
    await target.save();
    res.json({ message: 'Anfrage gesendet' });
  } catch { res.status(500).json({ error: 'Serverfehler' }); }
});

// POST /api/friends/accept
router.post('/accept', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const me   = await User.findById(req.user.id);
    const them = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (!them) return res.status(404).json({ error: 'Spieler nicht gefunden' });

    me.friendRequests = me.friendRequests.filter(r => r !== them.username);
    if (!me.friends.includes(them.username)) me.friends.push(them.username);
    if (!them.friends.includes(me.username)) them.friends.push(me.username);
    await Promise.all([me.save(), them.save()]);
    res.json({ message: 'Freund hinzugefügt' });
  } catch { res.status(500).json({ error: 'Serverfehler' }); }
});

// POST /api/friends/decline
router.post('/decline', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const me = await User.findById(req.user.id);
    me.friendRequests = me.friendRequests.filter(r => r !== username);
    await me.save();
    res.json({ message: 'Anfrage abgelehnt' });
  } catch { res.status(500).json({ error: 'Serverfehler' }); }
});

// DELETE /api/friends/:username
router.delete('/:username', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const me   = await User.findById(req.user.id);
    const them = await User.findOne({ username });
    me.friends = me.friends.filter(f => f !== username);
    if (them) { them.friends = them.friends.filter(f => f !== me.username); await them.save(); }
    await me.save();
    res.json({ message: 'Freund entfernt' });
  } catch { res.status(500).json({ error: 'Serverfehler' }); }
});

module.exports = router;
