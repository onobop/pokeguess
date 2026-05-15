const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getAllPremises, getPremisesForTier, getPokemonForPremise, getMaxTierForLevel, getPokemon } = require('../engine/premiseEngine');

// GET /api/premises  – alle für den User freigeschalteten Prämissen + Pokémon-Listen
router.get('/premises', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    const maxTier = getMaxTierForLevel(user.level);
    const premises = getPremisesForTier(maxTier);

    // Für jede Prämisse: wie viele Pokémon passen rein (für Anzeige)
    const result = premises.map(p => ({
      id: p.id,
      label: p.label,
      category: p.category,
      tier: p.tier,
      hint: p.hint,
      count: getPokemonForPremise(p.id).length,
    }));
    res.json({ premises: result, maxTier });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/premises/:id/pokemon  – Pokémon-Liste für gewählte Prämisse (nur für Prämissen-Wähler!)
router.get('/premises/:id/pokemon', auth, async (req, res) => {
  try {
    const list = getPokemonForPremise(req.params.id);
    res.json({ pokemon: list.map(p => ({
      id: p.id, name: p.name, nameDE: p.nameDE, sprite: p.sprite, types: p.types,
    }))});
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/pokemon/search?q=...  – Suche für Eingabefeld
router.get('/pokemon/search', auth, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ results: [] });
  const all = getPokemon();
  const results = all
    .filter(p =>
      p.nameDE.toLowerCase().startsWith(q) ||
      p.name.toLowerCase().startsWith(q) ||
      p.nameRaw.startsWith(q)
    )
    .slice(0, 10)
    .map(p => ({ id: p.id, name: p.name, nameDE: p.nameDE, sprite: p.sprite, types: p.types }));
  res.json({ results });
});

module.exports = router;
