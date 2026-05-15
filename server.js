require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API-Routen ───────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api',      require('./routes/api'));

// ─── Pokémon-Daten prüfen ─────────────────────────────────────────────────────
const enrichedPath = path.join(__dirname, 'data/pokemon-enriched.json');
if (!require('fs').existsSync(enrichedPath)) {
  console.error('❌ pokemon-enriched.json fehlt! Bitte "npm run build-data" ausführen.');
  process.exit(1);
}

// ─── Socket.io Game-Handler ───────────────────────────────────────────────────
require('./socket/gameHandler')(io);

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── MongoDB + Server starten ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-guess';

mongoose.connect(MONGO)
  .then(() => {
    console.log('✅ MongoDB verbunden');
    server.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB-Fehler:', err.message);
    process.exit(1);
  });
