import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, makeMove, getLegalMoves, isTerminal, getWinner } from './game.js';
import { getBestMove } from './mcts.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Apply an array of {board, cell} moves from a fresh state. */
function playMoves(moves) {
  let s = createInitialState();
  for (const m of moves) s = makeMove(s, m);
  return s;
}

/** Seed a state so that `player` needs one more sub-board to win the meta-game. */
function nearMetaWin(player, opponent) {
  const s = createInitialState();
  // Give player sub-boards 0 and 1 (left two of top row).
  // If AI picks board 2, it wins. We'll verify MCTS finds that.
  s.subWinners[0] = player;
  s.subWinners[1] = player;
  s.currentPlayer = player;
  s.activeBoard = null; // free choice
  return s;
}

// ---------------------------------------------------------------------------
// Basic sanity
// ---------------------------------------------------------------------------

test('getBestMove returns a legal move on the initial board', () => {
  const s = createInitialState();
  const legal = getLegalMoves(s);
  const move = getBestMove(s, 100);
  assert.ok(legal.some(m => m.board === move.board && m.cell === move.cell),
    'returned move must be in the legal move list');
});

test('getBestMove works at various iteration counts', () => {
  const s = createInitialState();
  for (const iters of [50, 200, 500, 1000]) {
    const move = getBestMove(s, iters);
    assert.ok(typeof move.board === 'number' && typeof move.cell === 'number',
      `should return a valid move at ${iters} iterations`);
  }
});

test('getBestMove does not mutate the input state', () => {
  const s = createInitialState();
  const before = JSON.stringify(s);
  getBestMove(s, 100);
  assert.equal(JSON.stringify(s), before, 'state must not be mutated');
});

// ---------------------------------------------------------------------------
// Win/loss recognition
// ---------------------------------------------------------------------------

test('MCTS takes an immediate winning move on the meta-board', () => {
  // X has won sub-boards 0 and 1. Board 2 has X at cells 0 and 1.
  // activeBoard is forced to 2 (only 7 moves to consider), so MCTS easily
  // identifies cell 2 as the unique immediate game-winning move.
  const s = nearMetaWin('X', 'O');
  s.boards[2][0] = 'X';
  s.boards[2][1] = 'X';
  s.activeBoard = 2; // constrain search to board 2 only
  const move = getBestMove(s, 300);
  assert.equal(move.board, 2, 'should play in board 2 to win the meta-game');
  assert.equal(move.cell, 2, 'should play cell 2 to complete the winning row');
});

test('MCTS blocks an opponent meta-board win', () => {
  // O has won sub-boards 0 and 1. O has cells 0 and 1 in board 2.
  // It is X's turn, forced into board 2. X must play cell 2 to block.
  const s = nearMetaWin('O', 'X');
  s.currentPlayer = 'X';
  s.boards[2][0] = 'O';
  s.boards[2][1] = 'O';
  s.activeBoard = 2; // constrain search to board 2 only
  const move = getBestMove(s, 300);
  assert.equal(move.board, 2, 'X should block in board 2');
  assert.equal(move.cell, 2, 'X should block at cell 2');
});

// ---------------------------------------------------------------------------
// MCTS quality: AI beats a random player more than half the time
// ---------------------------------------------------------------------------

test('AI (500 iters) beats random player in majority of games', () => {
  const GAMES = 40;
  let aiWins = 0;

  for (let g = 0; g < GAMES; g++) {
    let s = createInitialState();
    // AI plays as X, random plays as O
    while (!isTerminal(s)) {
      if (s.currentPlayer === 'X') {
        s = makeMove(s, getBestMove(s, 500));
      } else {
        const moves = getLegalMoves(s);
        s = makeMove(s, moves[Math.floor(Math.random() * moves.length)]);
      }
    }
    const winner = getWinner(s);
    if (winner === 'X') aiWins++;
  }

  // Expect AI to win at least 60% of games against a random opponent
  assert.ok(aiWins / GAMES >= 0.6,
    `AI won ${aiWins}/${GAMES} games — expected >= 60%`);
});
