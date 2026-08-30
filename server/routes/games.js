const express = require('express');
const mongoose = require('mongoose');
const Game = require('../models/Game');

const router = express.Router();

// GET /api/games — most recent completed/in-progress games.
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'database not connected', games: [] });
  }
  try {
    const games = await Game.find().sort({ startedAt: -1 }).limit(20).lean();
    res.json({ games });
  } catch (err) {
    console.error('GET /api/games failed:', err.message);
    res.status(500).json({ error: 'query failed', games: [] });
  }
});

module.exports = router;
