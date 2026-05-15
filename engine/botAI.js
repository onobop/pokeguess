/**
 * botAI.js
 * KI-Gegenspieler für PokéGuess.
 * Bots sind nach LP eingeteilt und passen sich dem Spieler an.
 * Sie sind von echten Spielern nicht unterscheidbar.
 */

const { getAllPremises, getPokemonForPremise, pokemonMatchesPremise, getPokemon, getPremisesForTier, getMaxTierForLevel } = require('./premiseEngine');

// ─── Bot-Definitionen ─────────────────────────────────────────────────────────
// guessAccuracy: Wie gut der Bot die Prämisse aus bestätigten Pokémon deduziert (0–1)
// thinkTime:     ms Denkzeit vor einer Aktion
// minConfirmed:  Wie viele bestätigte Pokémon der Bot braucht, bevor er die Prämisse rät
// pokemonStyle:  'random' | 'diagnostic' – wie der Bot Pokémon auswählt

const BOTS = [
  // ── Pokéball-Liga (LP 0–299) ──────────────────────────────────
  { name: 'Nico',    lp:  20,  guessAccuracy: 0.15, thinkTime: 9000,  minConfirmed: 8  },
  { name: 'Emma',    lp:  55,  guessAccuracy: 0.20, thinkTime: 8500,  minConfirmed: 7  },
  { name: 'Luis',    lp:  90,  guessAccuracy: 0.25, thinkTime: 8000,  minConfirmed: 7  },
  { name: 'Mia',     lp: 130,  guessAccuracy: 0.30, thinkTime: 7500,  minConfirmed: 6  },
  { name: 'Paul',    lp: 170,  guessAccuracy: 0.35, thinkTime: 7000,  minConfirmed: 6  },
  { name: 'Lena',    lp: 215,  guessAccuracy: 0.40, thinkTime: 6500,  minConfirmed: 5  },
  { name: 'Finn',    lp: 262,  guessAccuracy: 0.44, thinkTime: 6000,  minConfirmed: 5  },

  // ── Superball-Liga (LP 300–599) ────────────────────────────────
  { name: 'Sophie',  lp: 315,  guessAccuracy: 0.50, thinkTime: 5500,  minConfirmed: 4  },
  { name: 'Tim',     lp: 355,  guessAccuracy: 0.54, thinkTime: 5200,  minConfirmed: 4  },
  { name: 'Laura',   lp: 400,  guessAccuracy: 0.58, thinkTime: 4900,  minConfirmed: 4  },
  { name: 'Maxi',    lp: 445,  guessAccuracy: 0.62, thinkTime: 4600,  minConfirmed: 3  },
  { name: 'Jana',    lp: 490,  guessAccuracy: 0.66, thinkTime: 4300,  minConfirmed: 3  },
  { name: 'Tobias',  lp: 555,  guessAccuracy: 0.70, thinkTime: 4000,  minConfirmed: 3  },

  // ── Hyperball-Liga (LP 600–899) ────────────────────────────────
  { name: 'Luisa',   lp: 620,  guessAccuracy: 0.74, thinkTime: 3600,  minConfirmed: 2  },
  { name: 'Jonas',   lp: 662,  guessAccuracy: 0.77, thinkTime: 3300,  minConfirmed: 2  },
  { name: 'Anna',    lp: 710,  guessAccuracy: 0.81, thinkTime: 3000,  minConfirmed: 2  },
  { name: 'Moritz',  lp: 755,  guessAccuracy: 0.84, thinkTime: 2800,  minConfirmed: 2  },
  { name: 'Clara',   lp: 800,  guessAccuracy: 0.87, thinkTime: 2600,  minConfirmed: 1  },
  { name: 'Erik',    lp: 858,  guessAccuracy: 0.90, thinkTime: 2300,  minConfirmed: 1  },

  // ── Meisterball-Liga (LP 900+) ─────────────────────────────────
  { name: 'Lara',    lp: 912,  guessAccuracy: 0.92, thinkTime: 2100,  minConfirmed: 1  },
  { name: 'Elias',   lp: 952,  guessAccuracy: 0.94, thinkTime: 1900,  minConfirmed: 1  },
  { name: 'Maja',    lp: 997,  guessAccuracy: 0.95, thinkTime: 1800,  minConfirmed: 1  },
  { name: 'Ben',     lp:1050,  guessAccuracy: 0.96, thinkTime: 1600,  minConfirmed: 1  },
  { name: 'Lilli',   lp:1105,  guessAccuracy: 0.97, thinkTime: 1400,  minConfirmed: 1  },
  { name: 'Xander',  lp:1172,  guessAccuracy: 0.98, thinkTime: 1200,  minConfirmed: 1  },
];

// ─── Bot nach LP auswählen ────────────────────────────────────────────────────
function getBotForLP(playerLP) {
  const sorted = [...BOTS].sort((a, b) =>
    Math.abs(a.lp - playerLP) - Math.abs(b.lp - playerLP)
  );
  // Zufällig aus den 3 ähnlichsten auswählen
  const candidates = sorted.slice(0, 3);
  const bot = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    ...bot,
    isBot: true,
    userId: `bot_${bot.name}_${Date.now()}`,
    level: lpToLevel(bot.lp),
    lp: bot.lp,
  };
}

// ─── LP → Level ───────────────────────────────────────────────────────────────
function lpToLevel(lp) {
  return Math.max(1, Math.floor(lp / 50));
}

// ─── Prämisse für Bot auswählen ───────────────────────────────────────────────
function choosePremiseForBot(botLevel) {
  const maxTier = getMaxTierForLevel(botLevel);
  const premises = getPremisesForTier(maxTier);
  // Nur Prämissen mit mindestens 5 Pokémon (nicht zu obskur)
  const valid = premises.filter(p => {
    const count = getPokemonForPremise(p.id).length;
    return count >= 5 && count <= 400; // nicht zu groß (z.B. "ist Endform" mit 339)
  });
  return valid[Math.floor(Math.random() * valid.length)];
}

// ─── Bot wählt nächstes Pokémon zum Vorschlagen ───────────────────────────────
// Strategie: Pokémon auswählen, das möglichst viele Prämissen auseinanderhält
function choosePokemonToSuggest(confirmedIds, suggestedIds, guessAccuracy) {
  const allPokemon = getPokemon();

  // Schon vorgeschlagene ausschließen
  const suggested = new Set(suggestedIds);
  const available = allPokemon.filter(p => !suggested.has(p.id));
  if (!available.length) return null;

  // Schlechte Bots: zufällig
  if (guessAccuracy < 0.5 || Math.random() > guessAccuracy) {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Gute Bots: diagnostisches Pokémon (aus möglichst vielen Prämissen)
  // Nimm eine zufällige Auswahl und prüfe wieviele Prämissen es trifft
  const sample = available
    .sort(() => Math.random() - 0.5)
    .slice(0, 50);

  const allPremises = getAllPremises();
  let best = null;
  let bestScore = -1;

  for (const p of sample) {
    let score = 0;
    for (const premise of allPremises) {
      if (pokemonMatchesPremise(p, premise.id)) score++;
    }
    // Wir wollen mittlere Scores (zu spezifisch oder zu allgemein ist nicht hilfreich)
    const normalized = Math.abs(score - allPremises.length / 2);
    if (best === null || normalized < bestScore) {
      best = p;
      bestScore = normalized;
    }
  }

  return best || available[Math.floor(Math.random() * available.length)];
}

// ─── Bot versucht Prämisse zu erraten ─────────────────────────────────────────
function guessPremise(confirmedPokemon, alreadyGuessed, guessAccuracy) {
  if (!confirmedPokemon.length) return null;

  const allPremises = getAllPremises();
  const wrongGuesses = new Set(alreadyGuessed);

  // Finde Prämissen, die ALLE bestätigten Pokémon enthalten
  const consistent = allPremises.filter(premise => {
    if (wrongGuesses.has(premise.id)) return false;
    return confirmedPokemon.every(p => pokemonMatchesPremise(p, premise.id));
  });

  if (!consistent.length) return null;

  // Wenn nur noch eine übrig → sehr sicher raten
  if (consistent.length === 1 && Math.random() < 0.95) {
    return consistent[0].id;
  }

  // Wenige übrig → mit guessAccuracy raten
  if (consistent.length <= 3 && Math.random() < guessAccuracy) {
    return consistent[Math.floor(Math.random() * consistent.length)].id;
  }

  // Viele übrig → nur raten wenn Accuracy sehr hoch
  if (Math.random() < guessAccuracy * 0.3) {
    return consistent[Math.floor(Math.random() * consistent.length)].id;
  }

  return null; // Noch nicht raten
}

module.exports = { BOTS, getBotForLP, choosePremiseForBot, choosePokemonToSuggest, guessPremise };
