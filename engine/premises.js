/**
 * premises.js
 * Alle Prämissen-Definitionen mit Label, ID, Kategorie und Stufe.
 * id wird als Schlüssel für die Engine genutzt.
 */

const TYPE_MAP = {
  normal:   'Normal',
  fire:     'Feuer',
  water:    'Wasser',
  grass:    'Pflanze',
  electric: 'Elektro',
  ice:      'Eis',
  fighting: 'Kampf',
  poison:   'Gift',
  ground:   'Boden',
  flying:   'Flug',
  psychic:  'Psycho',
  bug:      'Käfer',
  rock:     'Gestein',
  ghost:    'Geist',
  dragon:   'Drache',
  dark:     'Unlicht',
  steel:    'Stahl',
  fairy:    'Fee',
};

const TYPES = Object.keys(TYPE_MAP);

// ─── Stufe 1 ──────────────────────────────────────────────────────────────────

const TIER1_PREMISES = [
  // Einzel-Typen
  ...TYPES.map(t => ({
    id: `type_${t}`,
    label: `${TYPE_MAP[t]}-Typ`,
    category: 'Typ',
    tier: 1,
    hint: `Alle Pokémon, die den Typ ${TYPE_MAP[t]} haben (auch als Zweittyp)`,
  })),

  // Generationen
  ...[1,2,3,4,5,6,7,8,9].map(g => ({
    id: `gen_${g}`,
    label: `Generation ${g}`,
    category: 'Generation',
    tier: 1,
    hint: `Alle Pokémon aus Generation ${g}`,
  })),

  // Status
  { id: 'is_legendary',  label: 'Legendäres Pokémon',  category: 'Status', tier: 1, hint: 'Alle legendären Pokémon' },
  { id: 'is_mythical',   label: 'Mysteriöses Pokémon', category: 'Status', tier: 1, hint: 'Alle mysteriösen (Mythical) Pokémon' },
  { id: 'is_baby',       label: 'Baby-Pokémon',         category: 'Status', tier: 1, hint: 'Alle Baby-Pokémon' },
  { id: 'is_starter',    label: 'Starter-Pokémon',      category: 'Status', tier: 1, hint: 'Alle Starter-Pokémon (inkl. Entwicklungen)' },

  // Evolution
  { id: 'evo_none',   label: 'Entwickelt sich nicht',    category: 'Evolution', tier: 1, hint: 'Pokémon ohne Vorstufe und ohne Entwicklung' },
  { id: 'evo_base2',  label: 'Hat eine Entwicklung',     category: 'Evolution', tier: 1, hint: 'Basis-Pokémon einer 2-stufigen Kette' },
  { id: 'evo_base3',  label: 'Hat zwei Entwicklungen',   category: 'Evolution', tier: 1, hint: 'Basis-Pokémon einer 3-stufigen Kette' },
  { id: 'evo_middle', label: 'Ist Zwischenstufe',        category: 'Evolution', tier: 1, hint: 'Pokémon, das eine Vor- und eine Nachstufe hat' },
  { id: 'evo_final',  label: 'Ist Endform',              category: 'Evolution', tier: 1, hint: 'Pokémon ohne weitere Entwicklung (aber hat Vorstufe)' },

  // Dual-Typ-Kombinationen werden dynamisch hinzugefügt (siehe buildDualTypePremises)
];

// ─── Stufe 2 ──────────────────────────────────────────────────────────────────

const TIER2_PREMISES = [
  { id: 'is_ultra_beast',    label: 'Ultra-Bestie',             category: 'Status',    tier: 2, hint: 'Alle Ultra-Bestien (UB)' },
  { id: 'is_paradox',        label: 'Paradox-Pokémon',          category: 'Status',    tier: 2, hint: 'Alle Paradox-Pokémon aus Gen 9' },
  { id: 'has_mega',          label: 'Hat Mega-Entwicklung',     category: 'Besonderes', tier: 2, hint: 'Pokémon, die eine Mega-Entwicklung besitzen' },
  { id: 'has_gigantamax',    label: 'Hat Gigadynamax',          category: 'Besonderes', tier: 2, hint: 'Pokémon mit Gigadynamax-Form' },
  { id: 'has_regional_form', label: 'Hat regionale Form',       category: 'Besonderes', tier: 2, hint: 'Pokémon, die eine regionale Variante haben (Alola, Galar, Hisui, Paldea)' },
  { id: 'evo_stone',         label: 'Entwickelt sich durch Stein', category: 'Evolution', tier: 2, hint: 'Pokémon, die einen Evolutionsstein benötigen' },
  { id: 'evo_trade',         label: 'Entwickelt sich durch Tausch', category: 'Evolution', tier: 2, hint: 'Pokémon, die durch Tausch (evtl. mit Item) evolvieren' },
];

// ─── Dual-Typ-Prämissen dynamisch bauen ──────────────────────────────────────

function buildDualTypePremises(pokemonList) {
  const combos = new Set();
  for (const p of pokemonList) {
    if (p.types.length === 2) {
      const sorted = [...p.types].sort();
      combos.add(sorted.join('/'));
    }
  }
  return [...combos].sort().map(combo => {
    const [t1, t2] = combo.split('/');
    return {
      id: `dualtype_${combo.replace('/', '_')}`,
      label: `${TYPE_MAP[t1] || t1}/${TYPE_MAP[t2] || t2}-Typ`,
      category: 'Typ-Kombination',
      tier: 1,
      hint: `Pokémon mit genau dem Doppeltyp ${TYPE_MAP[t1] || t1}/${TYPE_MAP[t2] || t2}`,
      dualTypes: [t1, t2],
    };
  });
}

module.exports = {
  TIER1_PREMISES,
  TIER2_PREMISES,
  buildDualTypePremises,
  TYPE_MAP,
  TYPES,
};
