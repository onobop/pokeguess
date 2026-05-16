const router = require('express').Router();
const http   = require('http');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');

// ─── Geo-Cache (in-memory) ────────────────────────────────────────────────────
const GEO = {};

function geoLookup(raw) {
  return new Promise(resolve => {
    if (!raw) return resolve(null);
    const ip = raw.replace('::ffff:', '');
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return resolve(null);
    if (GEO[ip]) return resolve(GEO[ip]);
    http.get(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const r = j.status === 'success'
            ? { country: j.country, countryCode: j.countryCode, city: j.city }
            : null;
          GEO[ip] = r;
          resolve(r);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ─── Key-Auth Middleware ──────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const key = req.query.key || req.body?.key;
  const expected = process.env.ADMIN_KEY || 'pokeguess-admin';
  if (key !== expected) return res.status(403).send('Forbidden');
  next();
}

// ─── GET /admin ───────────────────────────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('-password').lean();

    // Geo-Lookups parallel
    const geos = await Promise.all(users.map(u => geoLookup(u.lastIp)));

    const key = req.query.key;
    const now = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

    const rows = users.map((u, i) => {
      const geo = geos[i];
      const geoStr = geo
        ? `<span class="country">${geo.countryCode} ${geo.city}, ${geo.country}</span>`
        : '–';
      const ipStr = u.lastIp
        ? `<span class="ip">${u.lastIp.replace('::ffff:','')}</span>`
        : '–';
      const shinyCount = (u.pokedex || []).filter(p => p.isShiny).length;
      const date = u.createdAt
        ? new Date(u.createdAt).toLocaleDateString('de-DE')
        : '–';
      const leagueIdx = u.league?.leagueIdx ?? 0;
      const leagueNames = ['Pokéball','Superball','Hyperball','Meisterball'];
      const stars = '★'.repeat(Math.min(3, Math.max(1, Math.floor((u.lp - [0,300,600,900][leagueIdx]) / 100) + 1)));

      return `<tr>
        <td class="num">${users.length - i}</td>
        <td class="name">${u.username}</td>
        <td>Lv.${u.level}</td>
        <td>${u.lp} LP</td>
        <td>${leagueNames[leagueIdx]} <span class="stars">${stars}</span></td>
        <td>🪙${u.coins || 0}</td>
        <td>📦${(u.pokedex||[]).length} ✨${shinyCount}</td>
        <td>${date}</td>
        <td>${ipStr}<br>${geoStr}</td>
        <td>
          <form method="POST" action="/admin/reset?key=${key}" onsubmit="return confirmReset('${u.username}')">
            <input type="hidden" name="username" value="${u.username}"/>
            <input type="text" name="newPassword" placeholder="Neues PW" minlength="6" required class="pw-input"/>
            <button type="submit" class="btn-reset">🔑 Reset</button>
          </form>
        </td>
      </tr>`;
    }).join('');

    res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>PokéGuess – Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f1117; color: #e8eaf0; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; padding: 32px 24px; }
    h1 { font-size: 1.6rem; color: #ffcb05; margin-bottom: 4px; }
    h1 span { color: #3b82f6; }
    .meta { color: #7c8099; font-size: .85rem; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 10px 12px; background: #1a1d27; color: #ffcb05; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; border-bottom: 2px solid #2d3148; }
    td { padding: 10px 12px; border-bottom: 1px solid #1e2235; vertical-align: middle; }
    tr:hover td { background: rgba(255,255,255,.03); }
    .num { color: #7c8099; font-size: .85rem; }
    .name { font-weight: 700; color: #fff; }
    .stars { color: #ffcb05; font-size: .8rem; }
    .ip { font-family: monospace; font-size: .78rem; color: #aaa; }
    .country { font-size: .8rem; color: #7c8099; }
    .pw-input { background: #1a1d27; border: 1px solid #2d3148; color: #e8eaf0; border-radius: 6px; padding: 4px 8px; font-size: .8rem; width: 120px; margin-right: 6px; }
    .pw-input:focus { outline: none; border-color: #ffcb05; }
    .btn-reset { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; border-radius: 6px; padding: 4px 10px; font-size: .8rem; font-weight: 700; cursor: pointer; transition: background .15s; }
    .btn-reset:hover { background: #991b1b; }
    .success { background: #14532d; color: #86efac; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; }
    .error-msg { background: #7f1d1d; color: #fca5a5; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>🎮 PokéGuess — <span>Admin</span></h1>
  <p class="meta">${users.length} registrierte Trainer &nbsp;·&nbsp; ${now}</p>
  ${req.query.msg === 'ok'    ? '<div class="success">✅ Passwort zurückgesetzt.</div>' : ''}
  ${req.query.msg === 'error' ? '<div class="error-msg">❌ Fehler beim Zurücksetzen.</div>' : ''}
  <table>
    <thead><tr>
      <th>#</th><th>Trainer</th><th>Lvl</th><th>LP</th><th>Liga</th>
      <th>Coins</th><th>Dex/Shiny</th><th>Datum</th><th>IP / Land</th><th>PW</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="10" style="color:#555;text-align:center;padding:20px">Keine Trainer gefunden</td></tr>'}</tbody>
  </table>
  <script>
    function confirmReset(name) {
      return confirm('Passwort für ' + name + ' wirklich zurücksetzen?');
    }
  </script>
</body>
</html>`);
  } catch (err) {
    console.error('[admin]', err);
    res.status(500).send('Interner Fehler: ' + err.message);
  }
});

// ─── POST /admin/reset ────────────────────────────────────────────────────────
router.post('/reset', adminAuth, async (req, res) => {
  const key = req.query.key;
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword || newPassword.length < 6)
      return res.redirect(`/admin?key=${key}&msg=error`);

    const user = await User.findOne({ username });
    if (!user) return res.redirect(`/admin?key=${key}&msg=error`);

    user.password = newPassword; // pre-save hook hasht es
    await user.save();
    res.redirect(`/admin?key=${key}&msg=ok`);
  } catch (err) {
    console.error('[admin/reset]', err);
    res.redirect(`/admin?key=${key}&msg=error`);
  }
});

module.exports = router;
