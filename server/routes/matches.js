const express = require('express');
const mongoose = require('mongoose');
const Match = require('../models/Match');

const router = express.Router();

// GET /api/matches — most recent completed/ongoing matches.
router.get('/', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'database not connected', matches: [] });
  }
  try {
    const matches = await Match.find().sort({ startedAt: -1 }).limit(20).lean();
    res.json({ matches });
  } catch (err) {
    console.error('GET /api/matches failed:', err.message);
    res.status(500).json({ error: 'query failed', matches: [] });
  }
});

module.exports = router;
