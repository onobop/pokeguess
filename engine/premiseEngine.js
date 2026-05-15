/**
 * premiseEngine.js
 * Kernlogik: Prüft ob ein Pokémon einer Prämisse entspricht,
 * und liefert alle Pokémon zu einer Prämisse.
 */

const path = require('path');
const { TIER1_PREMISES, TIER2_PREMISES, buildDualTypePremises } = require('./premises');

// ─── Daten laden ──────────────────────────────────────────────────────────────
let _pokemon = null;
let _allPremises = null;
let _premiseMap = null;

function getPokemon() {
  if (!_pokemon) {
    _pokemon = require(path.join(__dirname, '../data/pokemon-enriched.json'));
  }
  return _pokemon;
}

function getAllPremises() {
  if (!_allPremises) {
    const pokemon = getPokemon();
    const dualTypePremises = buildDualTypePremises(pokemon);
    _allPremises = [...TIER1_PREMISES, ...dualTypePremises, ...TIER2_PREMISES];
    _premiseMap = Object.fromEntries(_allPremises.map(p => [p.id, p]));
  }
  return _allPremises;
}

function getPremiseById(id) {
  getAllPremises();
  return _premiseMap[id] || null;
}

// ─── Matching-Logik ───────────────────────────────────────────────────────────

function pokemonMatchesPremise(pokemon, premiseId) {
  const premise = getPremiseById(premiseId);
  if (!premise) return false;

  // Einzel-Typ
  if (premiseId.startsWith('type_')) {
    const type = premiseId.replace('type_', '');
    return pokemon.types.includes(type);
  }

  // Dual-Typ-Kombination (exakt beide Typen)
  if (premiseId.startsWith('dualtype_')) {
    if (pokemon.types.length !== 2) return false;
    const [t1, t2] = premise.dualTypes;
    return (
      (pokemon.types.includes(t1) && pokemon.types.includes(t2))
    );
  }

  // Generation
  if (premiseId.startsWith('gen_')) {
    const gen = parseInt(premiseId.replace('gen_', ''), 10);
    return pokemon.generation === gen;
  }

  // Status
  if (premiseId === 'is_legendary')  return pokemon.isLegendary;
  if (premiseId === 'is_mythical')   return pokemon.isMythical;
  if (premiseId === 'is_baby')       return pokemon.isBaby;
  if (premiseId === 'is_starter')    return pokemon.isStarter;

  // Ultra-Bestie / Paradox
  if (premiseId === 'is_ultra_beast')    return pokemon.isUltraBeast;
  if (premiseId === 'is_paradox')        return pokemon.isParadox;

  // Besonderes
  if (premiseId === 'has_mega')          return pokemon.hasMega;
  if (premiseId === 'has_gigantamax')    return pokemon.hasGigantamax;
  if (premiseId === 'has_regional_form') return pokemon.hasRegionalForm;

  // Evolution
  if (premiseId === 'evo_none')   return pokemon.evolutionStage === 'none';
  if (premiseId === 'evo_base2')  return pokemon.evolutionStage === 'base' && pokemon.chainLength === 2;
  if (premiseId === 'evo_base3')  return pokemon.evolutionStage === 'base' && pokemon.chainLength === 3;
  if (premiseId === 'evo_middle') return pokemon.evolutionStage === 'middle';
  if (premiseId === 'evo_final')  return pokemon.evolutionStage === 'final';
  if (premiseId === 'evo_stone')  return pokemon.evolvesWithStone;
  if (premiseId === 'evo_trade')  return pokemon.evolvesWithTrade;

  return false;
}

// ─── Alle passenden Pokémon zu einer Prämisse ─────────────────────────────────

function getPokemonForPremise(premiseId) {
  const pokemon = getPokemon();
  return pokemon.filter(p => pokemonMatchesPremise(p, premiseId));
}

// ─── Pokémon nach Name finden ─────────────────────────────────────────────────

function findPokemonByName(input) {
  const pokemon = getPokemon();
  const normalized = input.trim().toLowerCase();
  return pokemon.find(p =>
    p.nameRaw === normalized ||
    p.name.toLowerCase() === normalized ||
    p.nameDE.toLowerCase() === normalized
  ) || null;
}

// ─── Prämissen nach Stufe filtern ─────────────────────────────────────────────

function getPremisesForTier(maxTier) {
  return getAllPremises().filter(p => p.tier <= maxTier);
}

// ─── Level → freigeschaltete Stufe ───────────────────────────────────────────

function getMaxTierForLevel(level) {
  if (level >= 10) return 2;
  return 1;
}

module.exports = {
  getAllPremises,
  getPremiseById,
  pokemonMatchesPremise,
  getPokemonForPremise,
  findPokemonByName,
  getPremisesForTier,
  getMaxTierForLevel,
  getPokemon,
};
