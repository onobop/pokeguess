require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routen ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api',             require('./routes/api'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/friends',     require('./routes/friends'));

// ─── Pokémon-Daten prüfen ─────────────────────────────────────────────────────
const enrichedPath = path.join(__dirname, 'data/pokemon-enriched.json');
if (!fs.existsSync(enrichedPath)) {
  console.error('❌ pokemon-enriched.json fehlt! → npm run build-data');
  process.exit(1);
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
require('./socket/gameHandler')(io);

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT  = process.env.PORT  || 3001;
const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-guess';

mongoose.connect(MONGO)
  .then(() => {
    console.log('✅ MongoDB verbunden');
    server.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
  })
  .catch(err => { console.error('❌ MongoDB Fehler:', err.message); process.exit(1); });
