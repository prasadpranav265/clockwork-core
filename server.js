// server.js — the web server for Clockwork Core.
// It (1) serves the files in /public and (2) provides the game API.
// All game state lives in memory in the `games` Map below.
'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const game = require('./game');

const PORT = process.env.PORT || 3000;
const GAME_TTL_MS = 2 * 60 * 60 * 1000; // forget games idle for 2 hours
const MAX_GAMES = 1000;                 // safety cap so memory can't grow forever
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Active games: id -> game object. Lost when the server restarts.
const games = new Map();

// Remove old games, and the oldest ones if we are over the cap.
function pruneGames() {
  const now = Date.now();
  for (const [id, g] of games) {
    if (now - g.lastActive > GAME_TTL_MS) games.delete(id);
  }
  while (games.size > MAX_GAMES) {
    games.delete(games.keys().next().value); // Map remembers insertion order
  }
}
setInterval(pruneGames, 10 * 60 * 1000).unref();

// The summary we send to the browser (never includes the answer).
function snapshot(g) {
  return {
    gameId: g.id,
    maxHp: game.MAX_HP,
    playerHp: g.playerHp,
    guardianHp: g.guardianHp,
    status: g.status,
    question: game.publicQuestion(g),
  };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1kb' })); // answers are tiny, so keep the limit tiny
app.use(express.static(path.join(__dirname, 'public')));

// --- GET /api/health: is the server running? ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, activeGames: games.size });
});

// --- POST /api/game/new: start a game ---
app.post('/api/game/new', (req, res) => {
  pruneGames();
  const g = game.createGame(crypto.randomUUID());
  games.set(g.id, g);
  res.status(201).json(snapshot(g));
});

// --- POST /api/game/:id/answer: submit four bits, e.g. { "bits": [1, 0, 1, 0] } ---
app.post('/api/game/:id/answer', (req, res) => {
  const g = UUID_PATTERN.test(req.params.id) ? games.get(req.params.id) : undefined;
  if (!g) {
    return res.status(404).json({ error: 'Game not found. It may have expired — start a new game.' });
  }
  if (g.status !== 'playing') {
    return res.status(409).json({ error: 'This game is already over. Start a new game.' });
  }

  const bits = req.body && req.body.bits;
  if (!game.isValidBits(bits)) {
    return res.status(400).json({ error: 'Send "bits" as an array of exactly four values, each 0 or 1.' });
  }

  // The SERVER checks the answer. The browser only reports which bits were set.
  res.json(game.submitAnswer(g, bits));
});

// Unknown /api routes get a JSON 404 instead of an HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Last-resort error handler: never leak stack traces or internals.
// (Express recognises it as an error handler because it takes four arguments.)
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  console.error(err); // details stay in the server console only
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Only start listening when run with `node server.js` (lets tests import `app`).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Clockwork Core running at http://localhost:${PORT}`);
  });
}

module.exports = app;
