const mongoose = require('mongoose');

const playerSummarySchema = new mongoose.Schema(
  { playerId: Number, color: String },
  { _id: false }
);

const gameSchema = new mongoose.Schema({
  startedAt: { type: Date, required: true },
  endedAt: Date,
  players: [playerSummarySchema],
  moves: [String],          // SAN move list, e.g. ["e4", "e5", "Nf3", ...]
  pgn: String,               // full PGN once the game ends
  result: {
    type: String,
    enum: ['in_progress', 'white', 'black', 'draw'],
    default: 'in_progress',
  },
  endReason: String,         // 'checkmate' | 'stalemate' | 'draw' | 'disconnect' | ...
});

module.exports = mongoose.model('Game', gameSchema);
