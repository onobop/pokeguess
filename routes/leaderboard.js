const router = require('express').Router();
const auth   = require('../middleware/auth');
const User   = require('../models/User');

// GET /api/leaderboard?scope=world|friends
router.get('/', auth, async (req, res) => {
  try {
    const scope = req.query.scope || 'world';
    let query = {};

    if (scope === 'friends') {
      const me = await User.findById(req.user.id);
      const names = [...(me.friends || []), me.username];
      query = { username: { $in: names } };
    }

    const users = await User.find(query)
      .select('username level lp league stats')
      .sort({ lp: -1 })
      .limit(100);

    res.json({
      leaderboard: users.map((u, i) => ({
        rank: i + 1,
        username: u.username,
        level: u.level,
        lp: u.lp,
        leagueName: u.league?.leagueName || 'Pokéball',
        leagueIdx:  u.league?.leagueIdx  || 0,
        wins:        u.stats?.wins || 0,
        losses:      u.stats?.losses || 0,
        gamesPlayed: u.stats?.gamesPlayed || 0,
        rankedWins:  u.stats?.rankedWins || 0,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
