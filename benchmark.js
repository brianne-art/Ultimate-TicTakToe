// benchmark.js — AI vs random bot at various iteration counts
// Usage: node benchmark.js

import { createInitialState, makeMove, getLegalMoves, getWinner, isTerminal } from './game.js';
import { getBestMove } from './mcts.js';

const GAMES_PER_LEVEL = 50;
const ITERATION_LEVELS = [200, 500, 1000, 3000];

function randomMove(state) {
  const moves = getLegalMoves(state);
  return moves[Math.floor(Math.random() * moves.length)];
}

function playGame(aiIterations, aiPlayer) {
  let state = createInitialState();
  while (!isTerminal(state)) {
    if (state.currentPlayer === aiPlayer) {
      state = makeMove(state, getBestMove(state, aiIterations));
    } else {
      state = makeMove(state, randomMove(state));
    }
  }
  return getWinner(state);
}

console.log(`Benchmark: AI vs Random — ${GAMES_PER_LEVEL} games per configuration\n`);
console.log('Iterations | AI as X (win/draw/loss) | AI as O (win/draw/loss) | Overall win%');
console.log('-'.repeat(80));

for (const iters of ITERATION_LEVELS) {
  let xWins = 0, xDraws = 0, xLosses = 0;
  let oWins = 0, oDraws = 0, oLosses = 0;

  for (let g = 0; g < GAMES_PER_LEVEL; g++) {
    const resultAsX = playGame(iters, 'X');
    if (resultAsX === 'X') xWins++;
    else if (resultAsX === 'draw') xDraws++;
    else xLosses++;

    const resultAsO = playGame(iters, 'O');
    if (resultAsO === 'O') oWins++;
    else if (resultAsO === 'draw') oDraws++;
    else oLosses++;
  }

  const totalWins = xWins + oWins;
  const totalGames = GAMES_PER_LEVEL * 2;
  const winPct = ((totalWins / totalGames) * 100).toFixed(1);

  console.log(
    `${String(iters).padEnd(10)} | ` +
    `${String(xWins).padStart(3)}W ${String(xDraws).padStart(2)}D ${String(xLosses).padStart(2)}L       | ` +
    `${String(oWins).padStart(3)}W ${String(oDraws).padStart(2)}D ${String(oLosses).padStart(2)}L       | ` +
    `${winPct}%`
  );
}

console.log('\nDone.');
