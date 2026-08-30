const mongoose = require('mongoose');

const playerSummarySchema = new mongoose.Schema(
  {
    playerId: Number,
    color: String,
    finalX: Number,
    finalY: Number,
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema({
  startedAt: { type: Date, required: true },
  endedAt: Date,
  ticks: { type: Number, default: 0 },
  players: [playerSummarySchema],
});

module.exports = mongoose.model('Match', matchSchema);
