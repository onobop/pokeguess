/**
 * buildPokemonData.js
 * Liest pokemon.json aus dem pokemon-game Projekt und reichert es
 * mit allen nötigen Metadaten an. Erzeugt data/pokemon-enriched.json.
 */

const fs = require('fs');
const path = require('path');

// ─── Quelldaten ───────────────────────────────────────────────────────────────
const srcPath = path.join(__dirname, '../../pokemon-game/data/pokemon.json');
const outPath = path.join(__dirname, '../data/pokemon-enriched.json');

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

// ─── Generation (nach ID-Bereichen) ──────────────────────────────────────────
function getGeneration(id) {
  if (id <= 151)  return 1;
  if (id <= 251)  return 2;
  if (id <= 386)  return 3;
  if (id <= 493)  return 4;
  if (id <= 649)  return 5;
  if (id <= 721)  return 6;
  if (id <= 809)  return 7;
  if (id <= 905)  return 8;
  return 9;
}

// ─── Legendäre Pokémon ────────────────────────────────────────────────────────
const LEGENDARY_IDS = new Set([
  // Gen 1
  144, 145, 146, 150,
  // Gen 2
  243, 244, 245, 249, 250,
  // Gen 3
  377, 378, 379, 380, 381, 382, 383, 384,
  // Gen 4
  480, 481, 482, 483, 484, 485, 486, 487, 488,
  // Gen 5
  638, 639, 640, 641, 642, 643, 644, 645, 646,
  // Gen 6
  716, 717, 718,
  // Gen 7
  785, 786, 787, 788, 789, 790, 791, 792, 800,
  // Gen 8
  888, 889, 890, 891, 892, 894, 895, 896, 897, 898,
  // Gen 9
  1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015, 1016, 1017, 1024,
]);

// ─── Mysteriöse / Mythical Pokémon ────────────────────────────────────────────
const MYTHICAL_IDS = new Set([
  151,        // Mew
  251,        // Celebi
  385, 386,   // Jirachi, Deoxys
  489, 490,   // Phione, Manaphy
  491, 492,   // Darkrai, Shaymin
  493,        // Arceus
  494,        // Victini
  647, 648, 649, // Keldeo, Meloetta, Genesect
  719, 720, 721, // Diancie, Hoopa, Volcanion
  801, 802,   // Magearna, Marshadow
  807, 808, 809, // Zeraora, Meltan, Melmetal
  893,        // Zarude
  1025,       // Pecharunt
]);

// ─── Baby-Pokémon ─────────────────────────────────────────────────────────────
const BABY_IDS = new Set([
  172, 173, 174, 175, 236, 238, 239, 240,
  298, 360, 406, 433, 438, 439, 440, 446, 447, 458,
  848, // Toxel
]);

// ─── Starter-Pokémon (alle Stufen) ───────────────────────────────────────────
const STARTER_IDS = new Set([
  // Gen 1
  1,2,3, 4,5,6, 7,8,9,
  // Gen 2
  152,153,154, 155,156,157, 158,159,160,
  // Gen 3
  252,253,254, 255,256,257, 258,259,260,
  // Gen 4
  387,388,389, 390,391,392, 393,394,395,
  // Gen 5
  495,496,497, 498,499,500, 501,502,503,
  // Gen 6
  650,651,652, 653,654,655, 656,657,658,
  // Gen 7
  722,723,724, 725,726,727, 728,729,730,
  // Gen 8
  810,811,812, 813,814,815, 816,817,818,
  // Gen 9
  906,907,908, 909,910,911, 912,913,914,
]);

// ─── Ultra-Bestien ───────────────────────────────────────────────────────────
const ULTRA_BEAST_IDS = new Set([
  793, 794, 795, 796, 797, 798, 799,
  803, 804, 805, 806,
]);

// ─── Paradox-Pokémon ─────────────────────────────────────────────────────────
const PARADOX_IDS = new Set([
  // Vergangene Formen (Scarlet)
  984, 985, 986, 987, 988, 989, 1005, 1009, 1011, 1012,
  // Zukünftige Formen (Violet)
  990, 991, 992, 993, 994, 995, 1006, 1010, 1013, 1018,
]);

// ─── Mega-Entwicklungen (das Basis-Pokémon hat eine Mega-Form) ───────────────
const MEGA_IDS = new Set([
  3, 6, 9, 15, 18, 65, 80, 94, 115, 127, 130, 142, 150,
  181, 208, 212, 214, 229, 248,
  254, 257, 260,
  282, 302, 303, 306, 308, 310, 319, 323, 334,
  354, 359, 362,
  373, 376, 380, 381, 384,
  428, 445, 448, 460, 475, 531,
  719,
]);

// ─── Gigadynamax-Pokémon ─────────────────────────────────────────────────────
const GIGANTAMAX_IDS = new Set([
  3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 133, 143,
  569, 809,
  812, 815, 818,
  823, 826, 834, 839, 841, 842, 844, 849, 851, 858, 861, 869, 879, 884,
  892,
]);

// ─── Regionale Formen (das Pokémon hat mindestens eine regionale Variante) ───
const REGIONAL_FORM_IDS = new Set([
  // Alola
  19, 20, 26, 27, 28, 37, 38, 50, 51, 52, 53,
  74, 75, 76, 88, 89, 103, 105,
  // Galar
  52, 77, 78, 79, 80, 83, 110, 122,
  144, 145, 146, 199, 222, 263, 264,
  554, 555, 562, 618,
  // Hisui
  58, 59, 100, 101, 157, 211, 215,
  503, 549, 570, 571, 628, 704, 705, 713, 724,
  // Paldea
  128, 194,
]);

// ─── Entwicklung durch Stein ─────────────────────────────────────────────────
// Enthält sowohl Vorformen als auch Ergebnisse (alle die "Stein" betrifft)
const STONE_EVOLUTION_IDS = new Set([
  // Fire Stone
  37,38, 58,59, 133,136, 513,514, 840, // Capsakid→Scovillain fehlt in Gen9 base
  // Water Stone
  61,62, 90,91, 120,121, 133,134, 271,272, 515,516, 602,604,
  // Thunder Stone
  25,26, 133,135, 462, 737,738, 848,  // Tadbulb→Bellibolt
  // Leaf Stone
  44,45, 70,71, 102,103, 133,470, 274,275, 511,512,
  // Moon Stone
  30,31, 33,34, 35,36, 39,40, 300,301, 517,518,
  // Sun Stone
  44,182, 191,192, 546,547, 548,549, 694,695,
  // Shiny Stone
  176,468, 315,407, 572,573, 670,671,
  // Dusk Stone
  198,430, 200,429, 608,609, 680,681,
  // Dawn Stone
  281,475, 361,478,
  // Ice Stone
  27,28, 37,38, 739,740, 133,471, 554,555,
]);

// ─── Entwicklung durch Tausch ────────────────────────────────────────────────
const TRADE_EVOLUTION_IDS = new Set([
  64,65,     // Kadabra→Alakazam
  67,68,     // Machoke→Machamp
  74,75,76,  // Graveler→Golem (auch Alola)
  93,94,     // Haunter→Gengar
  117,118,   // Seadra→Kingdra (mit Item)
  137,233,   // Porygon→Porygon2
  233,474,   // Porygon2→Porygon-Z
  222,       // Corsola Galar (nicht durch Tausch, lass weg)
  349,350,   // Feebas→Milotic (mit Item)
  356,477,   // Dusclops→Dusknoir
  366,367,368, // Clamperl→Huntail/Gorebyss
  369,       // Relicanth – nein
  385,       // nein
  440,113,242, // Happiny→Chansey→Blissey
  // mit Item:
  112,464,   // Rhydon→Rhyperior
  125,466,   // Electabuzz→Electivire
  126,467,   // Magmar→Magmortar
  176,468,   // Togetic→Togekiss – nein das ist Shiny Stone
  182,       // nein
  186,       // Politoed via King's Rock + Trade
  61,186,    // Poliwhirl→Politoed
  79,199,    // Slowpoke→Slowking
  212,       // Scizor via Metal Coat + Trade
  123,212,   // Scyther→Scizor
  208,       // Steelix via Metal Coat + Trade
  95,208,    // Onix→Steelix
  536,       // Palpitoad – nein
  533,534,   // Gurdurr→Conkeldurr
  617,       // Accelgor – kalos
  588,589,   // Karrablast→Escavalier
  616,617,   // Shelmet→Accelgor
  682,683,   // Spritzee→Aromatisse
  684,685,   // Swirlix→Slurpuff
  708,709,   // Phantump→Trevenant
  710,711,   // Pumpkaboo→Gourgeist
  525, // Boldore→Gigalith (via TRADE_IDS weiter unten)
]);
// Tausch-IDs als sauberes Set
const TRADE_IDS = new Set([
  64,65, 67,68, 74,75,76, 93,94,
  95,208, 112,464, 123,212, 125,466, 126,467,
  137,233, 233,474, 349,350, 356,477,
  366,367,368,
  525,526,  // Boldore→Gigalith
  533,534,  // Gurdurr→Conkeldurr
  588,589,  // Karrablast→Escavalier
  616,617,  // Shelmet→Accelgor
  682,683,  // Spritzee→Aromatisse
  684,685,  // Swirlix→Slurpuff
  708,709,  // Phantump→Trevenant
  710,711,  // Pumpkaboo→Gourgeist
  61,186,   // Poliwhirl→Politoed
  79,199,   // Slowpoke→Slowking
]);

// ─── Evolutionsstufen ────────────────────────────────────────────────────────
// Wir definieren für jede Kette: [basisID, ...midIDs, finalID]
// Pokémon ohne Entwicklung: single: [id]
// Daraus leiten wir stage und chainLength ab.

const EVOLUTION_CHAINS = [
  // ── Gen 1 ──
  [1,2,3],[4,5,6],[7,8,9],
  [10,11,12],[13,14,15],[16,17,18],
  [19,20],[21,22],[23,24],
  [25,26],[27,28],[29,30,31],[32,33,34],
  [35,36],[37,38],[39,40],[41,42],
  [43,44,45],[46,47],[48,49],
  [50,51],[52,53],[54,55],[56,57],
  [58,59],[60,61,62],[63,64,65],
  [66,67,68],[69,70,71],[72,73],
  [74,75,76],[77,78],[79,80],
  [81,82],[83],[84,85],
  [86,87],[88,89],[90,91],
  [92,93,94],[95,208],[96,97],
  [98,99],[100,101],[102,103],
  [104,105],[106],[107],[108],
  [109,110],[111,112,464],[113,242],
  [114],[115],[116,117,230],[118,119],
  [120,121],[122,439],[122],[123,212],
  [124,238],[125,466],[126,467],[127],
  [128],[129,130],[131],[132],[133,134],[133,135],[133,136],[133,196],[133,197],[133,470],[133,471],[133,700],
  [134],[135],[136],[137,233,474],
  [138,139],[140,141],[142],[143,446],
  [144],[145],[146],[147,148,149],
  [150],[151],
  // ── Gen 2 ──
  [152,153,154],[155,156,157],[158,159,160],
  [161,162],[163,164],[165,166],
  [167,168],[169],[170,171],
  [172,25,26],[173,35,36],[174,39,40],
  [175,176,468],[177,178],[179,180,181],
  [182],[183,184],[185],[186],
  [187,188,189],[190,424],[191,192],
  [193,469],[194,195],[196],[197],
  [198,430],[199],[200,429],
  [201],[202],[203],[204,205],
  [206],[207],[208],[209,210],
  [211],[212],[213],[214],
  [215,461],[216,217],[218,219],
  [220,221],[222,864],[223,224],
  [225],[226],[227],[228,229],
  [230],[231,232],[233],[234],
  [235],[236,106],[236,107],[236,237],
  [238,124],[239,125,466],[240,126,467],
  [241],[242],[243],[244],[245],
  [246,247,248],[249],[250],[251],
  // ── Gen 3 ──
  [252,253,254],[255,256,257],[258,259,260],
  [261,262],[263,264],[265,266,267],[265,268,269],
  [270,271,272],[273,274,275],[276,277],
  [278,279],[280,281,282],[283,284],
  [285,286],[287,288,289],[290,291],[290,292],
  [293,294,295],[296,297],[298,183,184],
  [299,476],[300,301],[302],[303],
  [304,305,306],[307,308],[309,310],
  [311],[312],[313],[314],
  [315,407],[316,317],[318,319],
  [320,321],[322,323],[324],
  [325,326],[327],[328,329,330],
  [331,332],[333,334],[335],[336],
  [337],[338],[339,340],[341,342],
  [343,344],[345,346],[347,348],
  [349,350],[351],[352],[353,354],
  [355,356,477],[357],[358],[359],
  [360,202],[361,362],[361,478],
  [363,364,365],[366,367],[366,368],
  [369],[370],[371,372,373],
  [374,375,376],[377],[378],[379],
  [380],[381],[382],[383],[384],
  [385],[386],
  // ── Gen 4 ──
  [387,388,389],[390,391,392],[393,394,395],
  [396,397,398],[399,400],[401,402],
  [403,404,405],[406,315,407],[408,409],
  [410,411],[412,413],[414],[415,416],
  [417],[418,419],[420,421],[422,423],
  [424],[425,426],[427,428],[429],
  [430],[431,432],[433,358],[434,435],
  [436,437],[438,185],[439,122],
  [440,113,242],[441],[442],[443,444,445],
  [446,143],[447,448],[449,450],
  [451,452],[453,454],[455],[456,457],
  [458,226],[459,460],[461],[462],
  [463],[464],[465],[466],[467],
  [468],[469],[470],[471],[472],
  [473],[474],[475],[476],[477],
  [478],[479],[480],[481],[482],
  [483],[484],[485],[486],[487],
  [488],[489,490],[491],[492],[493],
  // ── Gen 5 ──
  [494],[495,496,497],[498,499,500],[501,502,503],
  [504,505],[506,507,508],[509,510],
  [511,512],[513,514],[515,516],
  [517,518],[519,520,521],[522,523],
  [524,525,526],[527,528],[529,530],
  [531],[532,533,534],[535,536,537],
  [538],[539],[540,541,542],[543,544,545],
  [546,547],[548,549],[550],[551,552,553],
  [554,555],[556],[557,558],[559,560],
  [561],[562,563],[564,565],[566,567,568],
  [569],[570,571],[572,573],[574,575,576],
  [577,578,579],[580,581],[582,583,584],
  [585,586],[587],[588,589],[590,591],
  [592,593],[594],[595,596],[597,598],
  [599,600,601],[602,603,604],[605,606],
  [607,608,609],[610,611,612],[613,614],
  [615],[616,617],[618],[619,620],
  [621],[622,623],[624,625],[626],
  [627,628],[629,630],[631],[632],
  [633,634,635],[636,637],[638],[639],
  [640],[641],[642],[643],[644],[645],
  [646],[647],[648],[649],
  // ── Gen 6 ──
  [650,651,652],[653,654,655],[656,657,658],
  [659,660],[661,662,663],[664,665,666],
  [667,668],[669,670,671],[672,673],
  [674,675],[676],[677,678],[679,680,681],
  [682,683],[684,685],[686,687],[688,689],
  [690,691],[692,693],[694,695],[696,697],
  [698,699],[700],[701],[702],[703],
  [704,705,706],[707],[708,709],[710,711],
  [712,713],[714,715],[716],[717],[718],
  [719],[720],[721],
  // ── Gen 7 ──
  [722,723,724],[725,726,727],[728,729,730],
  [731,732,733],[734,735],[736,737,738],
  [739,740],[741],[742,743],[744,745],
  [746],[747,748],[749,750],[751,752],
  [753,754],[755,756],[757,758],[759,760],
  [761,762,763],[764],[765],[766],
  [767,768],[769,770],[771],[772,773],
  [774],[775],[776],[777],[778],
  [779],[780],[781],[782,783,784],
  [785],[786],[787],[788],[789,790],
  [791],[792],[793],[794],[795],
  [796],[797],[798],[799],[800],
  [801],[802],[803,804],[805],[806],
  [807],[808,809],
  // ── Gen 8 ──
  [810,811,812],[813,814,815],[816,817,818],
  [819,820],[821,822,823],[824,825,826],
  [827,828],[829,830],[831,832],[833,834],
  [835,836],[837,838,839],[840,841],[840,842],
  [843,844],[845],[846,847],[848,849],
  [850,851],[852,853],[854,855],[856,857,858],
  [859,860,861],[862],[863],[864],
  [865],[866],[867],[868,869],
  [870],[871],[872,873],[874],
  [875,876],[877],[878,879],[880],
  [881],[882],[883],[884],[885,886,887],
  [888],[889],[890],[891,892],
  [893],[894],[895],[896],[897],[898],
  [899],[900],[901],[902],[903],[904],[905],
  // ── Gen 9 ──
  [906,907,908],[909,910,911],[912,913,914],
  [915,916],[917,918],[919,920],[921,922,923],
  [924,925],[926,927],[928],[929,930],
  [931],[932],[933,934,935],[936,937],
  [938,939],[940,941],[942,943],[944,945,946],
  [947],[948,949],[950,951],[952,953],
  [954],[955,956],[957,958,959],[960,961],
  [962,963],[964,965],[966],[967,968],
  [969],[970],[971,972],[973],[974],
  [975,976],[977],[978],[979],[980],
  [981],[982],[983],[984],[985],[986],
  [987],[988],[989],[990],[991],[992],
  [993],[994],[995],[996,997],[998,999,1000],
  [1001],[1002],[1003],[1004],[1005],[1006],
  [1007],[1008],[1009],[1010],[1011],[1012],
  [1013],[1014],[1015],[1016],[1017],
  [1018],[1019,1020],[1021,1022],[1023],[1024],[1025],
];

// Erstelle Lookup: id → { stage, chainLength }
// stage: 'none' | 'base' | 'middle' | 'final'
// chainLength: 1 | 2 | 3
function buildEvolutionLookup(chains) {
  const lookup = {};
  for (const chain of chains) {
    const len = chain.length;
    chain.forEach((id, idx) => {
      // Eevee-Sonderfall: mehrere Chains mit gleichem Pokémon
      if (!lookup[id]) {
        if (len === 1) {
          lookup[id] = { stage: 'none', chainLength: 1 };
        } else if (len === 2) {
          lookup[id] = { stage: idx === 0 ? 'base' : 'final', chainLength: 2 };
        } else {
          if (idx === 0) lookup[id] = { stage: 'base', chainLength: 3 };
          else if (idx === len - 1) lookup[id] = { stage: 'final', chainLength: 3 };
          else lookup[id] = { stage: 'middle', chainLength: 3 };
        }
      }
    });
  }
  return lookup;
}

const evoLookup = buildEvolutionLookup(EVOLUTION_CHAINS);

// ─── Haupt-Anreicherung ───────────────────────────────────────────────────────
const enriched = raw.map(p => {
  const evo = evoLookup[p.id] || { stage: 'none', chainLength: 1 };
  return {
    id: p.id,
    name: p.name,
    nameDE: p.nameDE,
    nameRaw: p.nameRaw,
    types: p.types,
    sprite: p.sprite,
    generation: getGeneration(p.id),
    isLegendary: LEGENDARY_IDS.has(p.id),
    isMythical: MYTHICAL_IDS.has(p.id),
    isBaby: BABY_IDS.has(p.id),
    isStarter: STARTER_IDS.has(p.id),
    isUltraBeast: ULTRA_BEAST_IDS.has(p.id),
    isParadox: PARADOX_IDS.has(p.id),
    hasMega: MEGA_IDS.has(p.id),
    hasGigantamax: GIGANTAMAX_IDS.has(p.id),
    hasRegionalForm: REGIONAL_FORM_IDS.has(p.id),
    evolvesWithStone: STONE_EVOLUTION_IDS.has(p.id),
    evolvesWithTrade: TRADE_IDS.has(p.id),
    evolutionStage: evo.stage,      // 'none' | 'base' | 'middle' | 'final'
    chainLength: evo.chainLength,   // 1 | 2 | 3
  };
});

fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2), 'utf8');
console.log(`✅ ${enriched.length} Pokémon angereichert → ${outPath}`);

// ─── Statistik ────────────────────────────────────────────────────────────────
const stats = {
  gesamt: enriched.length,
  legendary: enriched.filter(p => p.isLegendary).length,
  mythical: enriched.filter(p => p.isMythical).length,
  baby: enriched.filter(p => p.isBaby).length,
  starter: enriched.filter(p => p.isStarter).length,
  ultraBeast: enriched.filter(p => p.isUltraBeast).length,
  paradox: enriched.filter(p => p.isParadox).length,
  mega: enriched.filter(p => p.hasMega).length,
  gmax: enriched.filter(p => p.hasGigantamax).length,
  regional: enriched.filter(p => p.hasRegionalForm).length,
  stoneEvo: enriched.filter(p => p.evolvesWithStone).length,
  tradeEvo: enriched.filter(p => p.evolvesWithTrade).length,
  noEvo: enriched.filter(p => p.evolutionStage === 'none').length,
  base2: enriched.filter(p => p.evolutionStage === 'base' && p.chainLength === 2).length,
  base3: enriched.filter(p => p.evolutionStage === 'base' && p.chainLength === 3).length,
  middle: enriched.filter(p => p.evolutionStage === 'middle').length,
  final: enriched.filter(p => p.evolutionStage === 'final').length,
};
console.table(stats);
