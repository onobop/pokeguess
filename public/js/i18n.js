/* ═══════════════════════════════════════════════════════════════
   PokéGuess – i18n.js  (DE / EN)
   ═══════════════════════════════════════════════════════════════ */

window.LANG = localStorage.getItem('pg_lang') || 'de';

// ─── Type name maps ───────────────────────────────────────────────────────────
const TYPE_NAMES = {
  de: { normal:'Normal', fire:'Feuer', water:'Wasser', grass:'Pflanze',
        electric:'Elektro', ice:'Eis', fighting:'Kampf', poison:'Gift',
        ground:'Boden', flying:'Flug', psychic:'Psycho', bug:'Käfer',
        rock:'Gestein', ghost:'Geist', dragon:'Drache', dark:'Unlicht',
        steel:'Stahl', fairy:'Fee' },
  en: { normal:'Normal', fire:'Fire', water:'Water', grass:'Grass',
        electric:'Electric', ice:'Ice', fighting:'Fighting', poison:'Poison',
        ground:'Ground', flying:'Flying', psychic:'Psychic', bug:'Bug',
        rock:'Rock', ghost:'Ghost', dragon:'Dragon', dark:'Dark',
        steel:'Steel', fairy:'Fairy' },
};
window.getTypeName = (type) => TYPE_NAMES[window.LANG]?.[type] || type;

// ─── Full translation tables ──────────────────────────────────────────────────
const T = {
  de: {
    /* ── Auth ── */
    'auth.tagline':           'Errate die Prämisse deines Gegners!',
    'auth.tab.login':         'Login',
    'auth.tab.register':      'Registrieren',
    'auth.login.ph.user':     'Benutzername',
    'auth.login.ph.pass':     'Passwort',
    'auth.login.submit':      'Einloggen',
    'auth.register.ph.user':  'Benutzername (3–20 Zeichen)',
    'auth.register.ph.pass':  'Passwort (min. 6 Zeichen)',
    'auth.register.submit':   'Account erstellen',

    /* ── Home topbar ── */
    'btn.logout':             'Logout',

    /* ── Home tabs ── */
    'home.tab.private':       '🔴 Privates Spiel',
    'home.tab.ranked':        '⚔ Ranked',

    /* ── Private lobby ── */
    'lobby.label.code':       'Raum-Code:',
    'lobby.ph.code':          'z.B. PIKA42',
    'btn.join':               'Beitreten / Erstellen',
    'btn.random':             'Zufälliger Code',
    'lobby.waiting':          'Warte auf Mitspieler…',

    /* ── Ranked ── */
    'btn.ranked':             '⚔ Ranked Match suchen',
    'btn.leave.queue':        'Abbrechen',
    'ranked.searching':       'Suche Gegner',

    /* ── Home nav ── */
    'btn.leaderboard':        '🏆 Bestenliste',
    'btn.friends':            '👥 Freunde',

    /* ── Stats ── */
    'stat.wins':              'Siege',
    'stat.losses':            'Niederlagen',
    'stat.ranked.wins':       'Ranked-Siege',
    'stat.games':             'Spiele',

    /* ── Pokédex ── */
    'dex.title':              'Mein Pokédex',
    'dex.hint':               'Pokémon, die du in Spielen korrekt als zur Gegner-Prämisse passend erkannt hast.',
    'dex.empty':              'Noch keine Pokémon gefangen – spiele eine Runde!',
    'dex.coins.label':        'Coins',
    'dex.modal.label.normal': 'Normal',
    'dex.modal.label.shiny':  '✨ Shiny',
    'btn.dex.close':          '✕',
    'btn.buy.shiny':          '✨ Shiny kaufen',
    'btn.already.owned':      '✨ Bereits gekauft',
    'dex.shiny.unlocked':     '✨ Shiny bereits vorhanden!',

    /* ── Other games ── */
    'games.section.label':    'WEITERE SPIELE VON PIXELPOOPER',

    /* ── Legal ── */
    'legal':                  'Pokémon and all related names are trademarks of Nintendo, Game Freak, and The Pokémon Company. Not affiliated with ©Nintendo or ©Pokémon Company. For entertainment purposes only.',

    /* ── Premise Select ── */
    'select.heading':         'Wähle deine Prämisse',
    'select.opp.hint':        'Dein Gegner wählt auch gerade…',
    'select.ph.search':       'Prämisse suchen…',
    'btn.confirm.premise':    'Diese Prämisse wählen ✓',
    'btn.cancel.preview':     'Abbrechen',
    'btn.chosen.wait':        'Gewählt! Warte auf Gegner…',
    'premise.count.suffix':   'Pokémon',

    /* ── Game ── */
    'game.waiting':           'Warte…',
    'game.my.turn':           '🟢 Du bist dran!',
    'game.opp.thinking':      '⏳ {name} denkt…',
    'game.finished':          'Spiel beendet',
    'game.my.premise':        'Meine Prämisse',
    'game.opp.asks':          'Gegner fragt mich',
    'game.ph.pokemon':        'Pokémon-Name…',
    'btn.suggest':            'Vorschlagen →',
    'tab.pokemon':            'Pokémon vorschlagen',
    'tab.premise':            'Prämisse raten',
    'game.warn.mistakes':     '⚠️ Falsch raten = Fehlversuch! (max. 3)',
    'game.ph.guess':          'Prämisse suchen…',
    'btn.guess.premise':      'Prämisse raten!',
    'game.my.guesses':        'Meine Vorschläge',
    'game.confirmed.title':   'Bestätigte Pokémon',
    'game.confirmed.hint':    'Pokémon die zum Gegner passen',
    'btn.surrender':          '🏳 Aufgeben',
    'game.mistakes.me':       'Du:',
    'game.mistakes.opp':      'Gegner:',
    'game.mistakes.suffix':   '/3 ✗',

    /* ── Result ── */
    'result.win':             'Sieg!',
    'result.win.sub':         'Du hast gewonnen!',
    'result.loss':            'Niederlage',
    'result.reason.guess':    'Die Prämisse wurde korrekt erraten.',
    'result.reason.surrender.win':  '{name} hat aufgegeben.',
    'result.reason.surrender.loss': 'Du hast aufgegeben.',
    'result.reason.mistakes': '{name} hatte 3 Fehlversuche.',
    'result.opp.premise':     'Gegner-Prämisse:',
    'result.my.premise':      'Deine Prämisse:',
    'btn.rematch':            'Rematch!',
    'btn.back.lobby':         'Hauptmenü',

    /* ── Leaderboard ── */
    'lb.title':               '🏆 Bestenliste',
    'lb.tab.world':           '🌍 Welt',
    'lb.tab.friends':         '👥 Freunde',
    'lb.col.rank':            '#',
    'lb.col.trainer':         'Trainer',
    'lb.col.lv':              'Lv',
    'lb.col.lp':              'LP',
    'lb.col.league':          'Liga',
    'lb.col.wins':            'Siege',
    'lb.col.ranked':          'Ranked',
    'lb.empty':               'Noch keine Einträge',
    'btn.lb.back':            '← Zurück',

    /* ── Friends ── */
    'friends.title':          '👥 Freunde',
    'friends.ph.search':      'Trainer suchen…',
    'btn.friend.search':      'Suchen',
    'friends.sec.requests':   'ANFRAGEN',
    'friends.sec.list':       'FREUNDESLISTE',
    'friends.no.requests':    'Keine Anfragen',
    'friends.no.friends':     'Noch keine Freunde',
    'friends.no.results':     'Niemanden gefunden',
    'btn.accept':             '✓',
    'btn.decline':            '✗',
    'btn.remove':             'Entfernen',
    'btn.send.request':       '+ Anfrage',
    'btn.friends.back':       '← Zurück',

    /* ── Tutorial ── */
    'tutorial.name':          'Prof. Eich',
    'btn.tutorial.next':      'Weiter ▶',
    'btn.tutorial.finish':    'Los geht\'s! 🎮',

    /* ── League names ── */
    'league.0': 'Pokéball',
    'league.1': 'Superball',
    'league.2': 'Hyperball',
    'league.3': 'Meisterball',
    'league.suffix': '-Liga',

    /* ── Toasts / dynamic ── */
    'toast.no.code':          'Bitte Raum-Code eingeben',
    'toast.premises.fail':    'Prämissen konnten nicht geladen werden',
    'toast.pokemon.empty':    'Bitte ein Pokémon eingeben',
    'toast.surrender.confirm':'Wirklich aufgeben? Du verlierst die Runde!',
    'toast.guess.confirm':    'Sicher? Falsches Raten kostet einen Fehlversuch!',
    'toast.time.up':          '⏱ Zeit abgelaufen – Zug weitergegeben',
    'toast.shiny.bought':     '✨ {name} Shiny freigeschaltet!',
    'toast.friend.added':     'Freund hinzugefügt!',
    'toast.friend.sent':      'Anfrage an {name} gesendet!',
    'toast.remove.confirm':   '{name} entfernen?',
    'toast.load.fail':        'Fehler beim Laden',
    'toast.premise.chosen':   'Prämisse „{label}" gewählt!',
    'game.opp.chosen':        '{name} hat gewählt. Du bist noch dran!',
    'game.started':           'Spiel gestartet! {name} beginnt.',
    'game.queue.pos':         'In der Warteschlange (Position {pos})…',
    'game.wait.player':       'Warte auf Mitspieler… Teile den Raum-Code!',
    'game.wait.lobby':        'Verbinde…',
    'game.connect.error':     'Verbindungsfehler: {msg}',
    'pokemon.result.yes':     '✓ Ja!',
    'pokemon.result.partial': '~ Ein Typ passt',
    'pokemon.result.no':      '✗ Nein',
    'game.wrong.guess':       '❌ „{label}" war falsch! Noch {n} Versuche.',
    'game.disconnected':      '{name} hat die Verbindung getrennt.',
    'history.partial.hint':   'ein Typ ✓',
    'dex.caught.suffix':      'gefangen',
    'coins.prefix':           '🪙',
    'dex.owned.info':         'Deine Coins: 🪙 {coins}  |  Preis: 🪙 {price}',

    /* ── Premise labels ── */
    'premise.type_normal':          'Normal-Typ',
    'premise.type_fire':            'Feuer-Typ',
    'premise.type_water':           'Wasser-Typ',
    'premise.type_grass':           'Pflanzen-Typ',
    'premise.type_electric':        'Elektro-Typ',
    'premise.type_ice':             'Eis-Typ',
    'premise.type_fighting':        'Kampf-Typ',
    'premise.type_poison':          'Gift-Typ',
    'premise.type_ground':          'Boden-Typ',
    'premise.type_flying':          'Flug-Typ',
    'premise.type_psychic':         'Psycho-Typ',
    'premise.type_bug':             'Käfer-Typ',
    'premise.type_rock':            'Gestein-Typ',
    'premise.type_ghost':           'Geist-Typ',
    'premise.type_dragon':          'Drachen-Typ',
    'premise.type_dark':            'Unlicht-Typ',
    'premise.type_steel':           'Stahl-Typ',
    'premise.type_fairy':           'Fee-Typ',
    'premise.gen_1':                'Generation 1',
    'premise.gen_2':                'Generation 2',
    'premise.gen_3':                'Generation 3',
    'premise.gen_4':                'Generation 4',
    'premise.gen_5':                'Generation 5',
    'premise.gen_6':                'Generation 6',
    'premise.gen_7':                'Generation 7',
    'premise.gen_8':                'Generation 8',
    'premise.gen_9':                'Generation 9',
    'premise.is_legendary':         'Legendäres Pokémon',
    'premise.is_mythical':          'Mysteriöses Pokémon',
    'premise.is_baby':              'Baby-Pokémon',
    'premise.is_starter':           'Starter-Pokémon',
    'premise.evo_none':             'Entwickelt sich nicht',
    'premise.evo_base2':            'Basis (2-stufig)',
    'premise.evo_base3':            'Basis (3-stufig)',
    'premise.evo_middle':           'Mittelstufe',
    'premise.evo_final':            'Letzte Entwicklung',
    'premise.is_ultra_beast':       'Ultra-Bestie',
    'premise.is_paradox':           'Paradox-Pokémon',
    'premise.has_mega':             'Hat Mega-Entwicklung',
    'premise.has_gigantamax':       'Hat Gigadynamax-Form',
    'premise.has_regional_form':    'Hat regionale Form',
    'premise.evo_stone':            'Entwicklung per Stein',
    'premise.evo_trade':            'Entwicklung durch Tausch',

    /* ── Category names ── */
    'cat.Alle':     'Alle',
    'cat.Typ':      'Typ',
    'cat.Spezial':  'Spezial',
    'cat.Generation': 'Generation',
    'cat.Evolution':  'Evolution',
  },

  en: {
    /* ── Auth ── */
    'auth.tagline':           'Guess your opponent\'s premise!',
    'auth.tab.login':         'Login',
    'auth.tab.register':      'Register',
    'auth.login.ph.user':     'Username',
    'auth.login.ph.pass':     'Password',
    'auth.login.submit':      'Log In',
    'auth.register.ph.user':  'Username (3–20 chars)',
    'auth.register.ph.pass':  'Password (min. 6 chars)',
    'auth.register.submit':   'Create Account',

    /* ── Home topbar ── */
    'btn.logout':             'Logout',

    /* ── Home tabs ── */
    'home.tab.private':       '🔴 Private Game',
    'home.tab.ranked':        '⚔ Ranked',

    /* ── Private lobby ── */
    'lobby.label.code':       'Room Code:',
    'lobby.ph.code':          'e.g. PIKA42',
    'btn.join':               'Join / Create',
    'btn.random':             'Random Code',
    'lobby.waiting':          'Waiting for opponent…',

    /* ── Ranked ── */
    'btn.ranked':             '⚔ Find Ranked Match',
    'btn.leave.queue':        'Cancel',
    'ranked.searching':       'Finding opponent',

    /* ── Home nav ── */
    'btn.leaderboard':        '🏆 Leaderboard',
    'btn.friends':            '👥 Friends',

    /* ── Stats ── */
    'stat.wins':              'Wins',
    'stat.losses':            'Losses',
    'stat.ranked.wins':       'Ranked Wins',
    'stat.games':             'Games',

    /* ── Pokédex ── */
    'dex.title':              'My Pokédex',
    'dex.hint':               'Pokémon you correctly identified as matching your opponent\'s premise.',
    'dex.empty':              'No Pokémon caught yet – play a round!',
    'dex.coins.label':        'Coins',
    'dex.modal.label.normal': 'Normal',
    'dex.modal.label.shiny':  '✨ Shiny',
    'btn.dex.close':          '✕',
    'btn.buy.shiny':          '✨ Buy Shiny',
    'btn.already.owned':      '✨ Already Owned',
    'dex.shiny.unlocked':     '✨ Shiny already owned!',

    /* ── Other games ── */
    'games.section.label':    'MORE GAMES BY PIXELPOOPER',

    /* ── Legal ── */
    'legal':                  'Pokémon and all related names are trademarks of Nintendo, Game Freak, and The Pokémon Company. Not affiliated with ©Nintendo or ©Pokémon Company. For entertainment purposes only.',

    /* ── Premise Select ── */
    'select.heading':         'Choose your Premise',
    'select.opp.hint':        'Your opponent is also choosing…',
    'select.ph.search':       'Search premise…',
    'btn.confirm.premise':    'Choose this Premise ✓',
    'btn.cancel.preview':     'Cancel',
    'btn.chosen.wait':        'Chosen! Waiting for opponent…',
    'premise.count.suffix':   'Pokémon',

    /* ── Game ── */
    'game.waiting':           'Waiting…',
    'game.my.turn':           '🟢 Your turn!',
    'game.opp.thinking':      '⏳ {name} is thinking…',
    'game.finished':          'Game over',
    'game.my.premise':        'My Premise',
    'game.opp.asks':          'Opponent asks me',
    'game.ph.pokemon':        'Pokémon name…',
    'btn.suggest':            'Suggest →',
    'tab.pokemon':            'Suggest Pokémon',
    'tab.premise':            'Guess Premise',
    'game.warn.mistakes':     '⚠️ Wrong guess = mistake! (max. 3)',
    'game.ph.guess':          'Search premise…',
    'btn.guess.premise':      'Guess Premise!',
    'game.my.guesses':        'My Suggestions',
    'game.confirmed.title':   'Confirmed Pokémon',
    'game.confirmed.hint':    'Pokémon that match the opponent',
    'btn.surrender':          '🏳 Surrender',
    'game.mistakes.me':       'You:',
    'game.mistakes.opp':      'Opponent:',
    'game.mistakes.suffix':   '/3 ✗',

    /* ── Result ── */
    'result.win':             'Victory!',
    'result.win.sub':         'You won!',
    'result.loss':            'Defeat',
    'result.reason.guess':    'The premise was guessed correctly.',
    'result.reason.surrender.win':  '{name} surrendered.',
    'result.reason.surrender.loss': 'You surrendered.',
    'result.reason.mistakes': '{name} had 3 wrong guesses.',
    'result.opp.premise':     'Opponent\'s Premise:',
    'result.my.premise':      'Your Premise:',
    'btn.rematch':            'Rematch!',
    'btn.back.lobby':         'Main Menu',

    /* ── Leaderboard ── */
    'lb.title':               '🏆 Leaderboard',
    'lb.tab.world':           '🌍 World',
    'lb.tab.friends':         '👥 Friends',
    'lb.col.rank':            '#',
    'lb.col.trainer':         'Trainer',
    'lb.col.lv':              'Lv',
    'lb.col.lp':              'LP',
    'lb.col.league':          'League',
    'lb.col.wins':            'Wins',
    'lb.col.ranked':          'Ranked',
    'lb.empty':               'No entries yet',
    'btn.lb.back':            '← Back',

    /* ── Friends ── */
    'friends.title':          '👥 Friends',
    'friends.ph.search':      'Search trainer…',
    'btn.friend.search':      'Search',
    'friends.sec.requests':   'REQUESTS',
    'friends.sec.list':       'FRIENDS LIST',
    'friends.no.requests':    'No requests',
    'friends.no.friends':     'No friends yet',
    'friends.no.results':     'Nobody found',
    'btn.accept':             '✓',
    'btn.decline':            '✗',
    'btn.remove':             'Remove',
    'btn.send.request':       '+ Add',
    'btn.friends.back':       '← Back',

    /* ── Tutorial ── */
    'tutorial.name':          'Prof. Oak',
    'btn.tutorial.next':      'Next ▶',
    'btn.tutorial.finish':    'Let\'s go! 🎮',

    /* ── League names ── */
    'league.0': 'Poké Ball',
    'league.1': 'Great Ball',
    'league.2': 'Ultra Ball',
    'league.3': 'Master Ball',
    'league.suffix': ' League',

    /* ── Toasts / dynamic ── */
    'toast.no.code':          'Please enter a room code',
    'toast.premises.fail':    'Could not load premises',
    'toast.pokemon.empty':    'Please enter a Pokémon',
    'toast.surrender.confirm':'Really surrender? You will lose the round!',
    'toast.guess.confirm':    'Sure? A wrong guess costs a mistake!',
    'toast.time.up':          '⏱ Time\'s up – turn passed',
    'toast.shiny.bought':     '✨ {name} Shiny unlocked!',
    'toast.friend.added':     'Friend added!',
    'toast.friend.sent':      'Request sent to {name}!',
    'toast.remove.confirm':   'Remove {name}?',
    'toast.load.fail':        'Failed to load',
    'toast.premise.chosen':   'Premise "{label}" chosen!',
    'game.opp.chosen':        '{name} has chosen. Still your turn!',
    'game.started':           'Game started! {name} goes first.',
    'game.queue.pos':         'In queue (position {pos})…',
    'game.wait.player':       'Waiting for opponent… Share the room code!',
    'game.wait.lobby':        'Connecting…',
    'game.connect.error':     'Connection error: {msg}',
    'pokemon.result.yes':     '✓ Yes!',
    'pokemon.result.partial': '~ One type matches',
    'pokemon.result.no':      '✗ No',
    'game.wrong.guess':       '❌ "{label}" was wrong! {n} tries left.',
    'game.disconnected':      '{name} disconnected.',
    'history.partial.hint':   'one type ✓',
    'dex.caught.suffix':      'caught',
    'coins.prefix':           '🪙',
    'dex.owned.info':         'Your Coins: 🪙 {coins}  |  Price: 🪙 {price}',

    /* ── Premise labels ── */
    'premise.type_normal':          'Normal Type',
    'premise.type_fire':            'Fire Type',
    'premise.type_water':           'Water Type',
    'premise.type_grass':           'Grass Type',
    'premise.type_electric':        'Electric Type',
    'premise.type_ice':             'Ice Type',
    'premise.type_fighting':        'Fighting Type',
    'premise.type_poison':          'Poison Type',
    'premise.type_ground':          'Ground Type',
    'premise.type_flying':          'Flying Type',
    'premise.type_psychic':         'Psychic Type',
    'premise.type_bug':             'Bug Type',
    'premise.type_rock':            'Rock Type',
    'premise.type_ghost':           'Ghost Type',
    'premise.type_dragon':          'Dragon Type',
    'premise.type_dark':            'Dark Type',
    'premise.type_steel':           'Steel Type',
    'premise.type_fairy':           'Fairy Type',
    'premise.gen_1':                'Generation 1',
    'premise.gen_2':                'Generation 2',
    'premise.gen_3':                'Generation 3',
    'premise.gen_4':                'Generation 4',
    'premise.gen_5':                'Generation 5',
    'premise.gen_6':                'Generation 6',
    'premise.gen_7':                'Generation 7',
    'premise.gen_8':                'Generation 8',
    'premise.gen_9':                'Generation 9',
    'premise.is_legendary':         'Legendary Pokémon',
    'premise.is_mythical':          'Mythical Pokémon',
    'premise.is_baby':              'Baby Pokémon',
    'premise.is_starter':           'Starter Pokémon',
    'premise.evo_none':             'Does Not Evolve',
    'premise.evo_base2':            'Base (2-stage)',
    'premise.evo_base3':            'Base (3-stage)',
    'premise.evo_middle':           'Middle Stage',
    'premise.evo_final':            'Final Evolution',
    'premise.is_ultra_beast':       'Ultra Beast',
    'premise.is_paradox':           'Paradox Pokémon',
    'premise.has_mega':             'Has Mega Evolution',
    'premise.has_gigantamax':       'Has Gigantamax Form',
    'premise.has_regional_form':    'Has Regional Form',
    'premise.evo_stone':            'Stone Evolution',
    'premise.evo_trade':            'Trade Evolution',

    /* ── Category names ── */
    'cat.Alle':       'All',
    'cat.Typ':        'Type',
    'cat.Spezial':    'Special',
    'cat.Generation': 'Generation',
    'cat.Evolution':  'Evolution',
  },
};

// ─── Core t() function ────────────────────────────────────────────────────────
window.t = function(key, vars = {}) {
  // Handle dualtype_ premise labels dynamically
  if (key.startsWith('premise.dualtype_')) {
    const parts = key.replace('premise.dualtype_', '').split('_');
    if (parts.length >= 2) {
      const t1 = parts[0], t2 = parts.slice(1).join('_');
      const n1 = getTypeName(t1), n2 = getTypeName(t2);
      return window.LANG === 'en' ? `${n1}/${n2} Type` : `${n1}/${n2}-Typ`;
    }
  }

  const dict = T[window.LANG] || T.de;
  let str = dict[key] ?? T.de[key] ?? key;

  // Variable substitution: {name}, {label}, etc.
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return str;
};

// Translate a premise label by ID
window.tPremise = function(id, fallbackLabel) {
  const key = `premise.${id}`;
  const result = t(key);
  // If key was not found (returned as-is), use fallback
  return (result === key) ? (fallbackLabel || id) : result;
};

// Translate a category name
window.tCat = function(cat) {
  const key = `cat.${cat}`;
  const result = t(key);
  return (result === key) ? cat : result;
};

// ─── Apply data-i18n attributes to DOM ───────────────────────────────────────
window.applyTranslations = function() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  // HTML content (for elements with data-i18n-html)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  // Placeholder
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  // Title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // Update all lang toggle buttons
  const toggleLabel = window.LANG === 'de' ? '🇬🇧 EN' : '🇩🇪 DE';
  document.querySelectorAll('[id^="btn-lang-toggle"]').forEach(btn => {
    btn.textContent = toggleLabel;
  });
};

// ─── Set language ─────────────────────────────────────────────────────────────
window.setLanguage = function(lang) {
  window.LANG = lang;
  localStorage.setItem('pg_lang', lang);
  applyTranslations();
  // Fire custom event so app.js can re-render dynamic content
  document.dispatchEvent(new CustomEvent('langChange', { detail: { lang } }));
};

// ─── Tutorial steps ───────────────────────────────────────────────────────────
window.TUTORIAL_STEPS_DE = [
  `Hallo! Willkommen in der Welt der POKÉMON!<br>Ich heiße <strong>Prof. Eich</strong>. Lass mich dir <strong>PokéGuess</strong> erklären!`,
  `Beide Spieler wählen zu Beginn geheim eine <strong>Prämisse</strong> – zum Beispiel <em>„Wasser-Typ"</em>, <em>„Legendäres Pokémon"</em> oder <em>„Nur eine Entwicklung"</em>.`,
  `Dann schlägst du abwechselnd Pokémon vor. Das Spiel antwortet automatisch:<br>
   <span class="t-yes">✓ Ja</span> – das Pokémon passt zur Gegner-Prämisse!<br>
   <span class="t-no">✗ Nein</span> – es passt nicht, der Zug wechselt.`,
  `Bei Doppeltyp-Prämissen gibt es auch ein <strong style="color:#d97706">~ Teiltreffer</strong> – einer der zwei Typen stimmt, aber nicht beide. Schlau nutzen!`,
  `<strong>Pro Zug hast du 20 Sekunden!</strong> Bestätigte Pokémon sind wertvolle Hinweise – nutze sie, um die Prämisse deines Gegners zu erraten.`,
  `Du kannst die Prämisse jederzeit direkt raten – aber <span class="t-no">3 Fehlversuche = Niederlage!</span><br>Im <strong>Ranked-Modus</strong> kämpfst du um LP und steigst durch die Ligen auf. Viel Erfolg, Trainer! 🏆`,
];

window.TUTORIAL_STEPS_EN = [
  `Hello! Welcome to the world of POKÉMON!<br>My name is <strong>Prof. Oak</strong>. Let me explain <strong>PokéGuess</strong>!`,
  `Both players secretly choose a <strong>premise</strong> at the start – for example <em>"Water Type"</em>, <em>"Legendary Pokémon"</em> or <em>"Does Not Evolve"</em>.`,
  `Then you take turns suggesting Pokémon. The game responds automatically:<br>
   <span class="t-yes">✓ Yes</span> – the Pokémon matches the opponent's premise!<br>
   <span class="t-no">✗ No</span> – it doesn't match, the turn switches.`,
  `For dual-type premises there's also a <strong style="color:#d97706">~ Partial Match</strong> – one of the two types is correct, but not both. Use it wisely!`,
  `<strong>You have 20 seconds per turn!</strong> Confirmed Pokémon are valuable clues – use them to guess your opponent's premise.`,
  `You can guess the premise at any time – but <span class="t-no">3 wrong guesses = defeat!</span><br>In <strong>Ranked mode</strong> you fight for LP and climb through the leagues. Good luck, Trainer! 🏆`,
];

window.getTutorialSteps = () =>
  window.LANG === 'en' ? window.TUTORIAL_STEPS_EN : window.TUTORIAL_STEPS_DE;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', applyTranslations);
