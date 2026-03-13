// worker.js — Web Worker that runs MCTS off the main thread

import { getBestMove, getBestMoveWithStats } from './mcts.js';

self.onmessage = function (e) {
  const { state, maxIterations, debug } = e.data;
  if (debug) {
    const { move: bestMove, stats } = getBestMoveWithStats(state, maxIterations);
    self.postMessage({ bestMove, stats });
  } else {
    const bestMove = getBestMove(state, maxIterations);
    self.postMessage({ bestMove });
  }
};
