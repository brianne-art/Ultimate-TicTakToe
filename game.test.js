import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  cloneState,
  getLegalMoves,
  makeMove,
  getWinner,
  isTerminal,
} from './game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Play a sequence of {board, cell} moves from the initial state. */
function playMoves(moves) {
  let state = createInitialState();
  for (const move of moves) {
    state = makeMove(state, move);
  }
  return state;
}

/** Fill a sub-board so that `player` wins it. Returns the move list. */
function winSubBoard(boardIndex, player, opponent) {
  // Win via top row: cells 0, 1, 2
  // Interleave opponent moves into unrelated cells so the board stays legal.
  // We assume the caller manages activeBoard externally — these are raw move objects.
  return [
    { board: boardIndex, cell: 0, _player: player },
    { board: boardIndex, cell: 3, _player: opponent },
    { board: boardIndex, cell: 1, _player: player },
    { board: boardIndex, cell: 4, _player: opponent },
    { board: boardIndex, cell: 2, _player: player },
  ];
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

test('createInitialState — all cells null', () => {
  const s = createInitialState();
  for (let b = 0; b < 9; b++) {
    assert.deepEqual(s.boards[b], Array(9).fill(null));
  }
});

test('createInitialState — subWinners all null', () => {
  const s = createInitialState();
  assert.deepEqual(s.subWinners, Array(9).fill(null));
});

test('createInitialState — X goes first, no active board constraint', () => {
  const s = createInitialState();
  assert.equal(s.currentPlayer, 'X');
  assert.equal(s.activeBoard, null);
});

// ---------------------------------------------------------------------------
// cloneState
// ---------------------------------------------------------------------------

test('cloneState — is a deep copy (mutating clone does not affect original)', () => {
  const original = createInitialState();
  const clone = cloneState(original);

  clone.boards[0][0] = 'X';
  clone.subWinners[0] = 'X';
  clone.activeBoard = 3;
  clone.currentPlayer = 'O';

  assert.equal(original.boards[0][0], null);
  assert.equal(original.subWinners[0], null);
  assert.equal(original.activeBoard, null);
  assert.equal(original.currentPlayer, 'X');
});

// ---------------------------------------------------------------------------
// getLegalMoves — initial state (free choice)
// ---------------------------------------------------------------------------

test('getLegalMoves — initial state returns all 81 moves', () => {
  const moves = getLegalMoves(createInitialState());
  assert.equal(moves.length, 81);
});

test('getLegalMoves — after first move, constrained to one sub-board (9 moves)', () => {
  // X plays board 4, cell 4 → next active board is 4
  const state = makeMove(createInitialState(), { board: 4, cell: 4 });
  const moves = getLegalMoves(state);
  assert.equal(moves.length, 8); // 9 cells minus the one just played
  assert.ok(moves.every(m => m.board === 4));
});

// ---------------------------------------------------------------------------
// makeMove — basic behaviour
// ---------------------------------------------------------------------------

test('makeMove — places the piece in the correct cell', () => {
  const state = makeMove(createInitialState(), { board: 0, cell: 5 });
  assert.equal(state.boards[0][5], 'X');
});

test('makeMove — alternates players', () => {
  let state = createInitialState();
  state = makeMove(state, { board: 0, cell: 0 }); // X plays → board 0 → cell 0 → next active = 0
  assert.equal(state.currentPlayer, 'O');
  state = makeMove(state, { board: 0, cell: 1 }); // O plays
  assert.equal(state.currentPlayer, 'X');
});

test('makeMove — sets activeBoard to the cell index', () => {
  // X plays board 0, cell 7 → next active board should be 7
  const state = makeMove(createInitialState(), { board: 0, cell: 7 });
  assert.equal(state.activeBoard, 7);
});

test('makeMove — does not mutate the input state', () => {
  const before = createInitialState();
  makeMove(before, { board: 0, cell: 0 });
  assert.equal(before.boards[0][0], null);
  assert.equal(before.currentPlayer, 'X');
});

// ---------------------------------------------------------------------------
// Sub-board win detection
// ---------------------------------------------------------------------------

test('sub-board winner recorded after 3-in-a-row', () => {
  // Force X to win sub-board 0 via the top row.
  // Each move sends us to the sub-board matching the cell played.
  // We engineer a path where we can keep returning to board 0.
  //
  // Move sequence (board, cell):
  //   X: (0,0) → activeBoard=0
  //   O: (0,3) → activeBoard=3
  //   X: (3,0) → activeBoard=0   ← back to 0
  //   O: (0,4) → activeBoard=4
  //   X: (4,0) → activeBoard=0   ← back to 0
  //   O: (0,5) → activeBoard=5
  //   X: (5,0) → activeBoard=0   ← back to 0
  //   O: (0,6) → activeBoard=6
  //   X: (6,1) → activeBoard=1   (X plays cell 1 in board 6)
  //   O: (1,0) → activeBoard=0   ← back to 0
  //   X: (0,2) → wins board 0 top row (0,1,2) — wait, we need cell 1 first

  // Simpler: engineer so X plays cells 0, 1, 2 in board 0 across the game.
  const moves = [
    { board: 0, cell: 0 }, // X → active=0
    { board: 0, cell: 3 }, // O → active=3
    { board: 3, cell: 1 }, // X → active=1
    { board: 1, cell: 3 }, // O → active=3
    { board: 3, cell: 2 }, // X → active=2
    { board: 2, cell: 3 }, // O → active=3
    { board: 3, cell: 4 }, // X → active=4
    { board: 4, cell: 1 }, // O → active=1
    { board: 1, cell: 0 }, // X → active=0
    { board: 0, cell: 4 }, // O → active=4
    { board: 4, cell: 0 }, // X → active=0
    { board: 0, cell: 1 }, // O → active=1
    { board: 1, cell: 4 }, // X → active=4
    { board: 4, cell: 2 }, // O → active=2
    { board: 2, cell: 0 }, // X → active=0
    { board: 0, cell: 2 }, // O wins board 0 top row! (cells 0 not O... let me rethink)
  ];

  // Cleaner direct approach: manually build a state where X wins board 4.
  // X: (4,0)→active=0, O:(0,0)→active=0, X:(0,1)→active=1,
  // O:(1,0)→active=0, X:(0,4)→active=4, O:(4,3)→active=3,
  // X:(3,0)→active=0, O:(0,3)→active=3, X:(3,4)→active=4,
  // O:(4,6)→active=6, X:(6,0)→active=0, O:(0,6)→active=6,
  // X:(6,4)→active=4, O:(4,1)→active=1, X:(1,4)→active=4,
  // now X needs cell 8 in board 4 to win (0,3—no wait 0,4,8 diagonal)
  // Actually let's just check via getLegalMoves that we can craft this.

  // Easiest verifiable path: use free-choice at the start.
  // Play a game where we track carefully.
  //
  // We'll use a helper that ignores activeBoard enforcement and directly
  // seeds a state to test sub-board detection.

  let s = createInitialState();
  // Give X cells 0,1,2 in board 4 (top row), interleaving O moves.
  // X(4,0)→active=0; O(0,0)→active=0; X(0,1)→active=1; O(1,0)→active=0;
  // X(0,2)→active=2; O(2,0)→active=0; X(0,5)→active=5; O(5,0)→active=0;
  // X(0,6)→active=6; O(6,0)→active=0; X(0,7)→active=7; O(7,0)→active=0;
  // X(0,8)→active=8; O(8,0)→active=0; X(0,3)→active=3; O(3,0)→active=0;
  // X(0,4)→active=4; O(4,3)→active=3; X(3,4)→active=4; O(4,6)→active=6;
  // X(6,1)→active=1; O(1,4)→active=4; X(4,1)→active=1; O(1,2)→active=2;
  // X(2,4)→active=4; O(4,0)... wait X already has 4,0.
  // This is getting complex. Use the direct state-seeding approach instead.

  const seeded = createInitialState();
  // Directly set cells so X has top row of board 4, then call makeMove for the winning move.
  seeded.boards[4][0] = 'X';
  seeded.boards[4][1] = 'X';
  seeded.currentPlayer = 'X';
  seeded.activeBoard = 4; // force play in board 4
  const after = makeMove(seeded, { board: 4, cell: 2 });
  assert.equal(after.subWinners[4], 'X', 'X should win sub-board 4');
});

// ---------------------------------------------------------------------------
// Free-choice rule
// ---------------------------------------------------------------------------

test('free choice when target sub-board is already won', () => {
  const s = createInitialState();
  // Mark board 5 as won so sending the active player there triggers free choice.
  s.subWinners[5] = 'X';
  s.activeBoard = 5; // would normally force play in 5
  const moves = getLegalMoves(s);
  // Should be able to play in any of boards 0-4, 6-8 (all unfinished)
  assert.ok(moves.every(m => m.board !== 5), 'should not allow moves in a won board');
  assert.ok(moves.length > 0);
});

test('free choice when target sub-board is drawn', () => {
  const s = createInitialState();
  s.subWinners[3] = 'draw';
  s.activeBoard = 3;
  const moves = getLegalMoves(s);
  assert.ok(moves.every(m => m.board !== 3));
});

test('makeMove sets activeBoard to null when target sub-board is resolved', () => {
  const s = createInitialState();
  s.subWinners[7] = 'O'; // board 7 already resolved
  s.activeBoard = null;  // free choice in effect
  // X plays board 0, cell 7 → normally active=7, but board 7 is resolved
  const next = makeMove(s, { board: 0, cell: 7 });
  assert.equal(next.activeBoard, null, 'activeBoard should be null when target is resolved');
});

// ---------------------------------------------------------------------------
// getWinner / isTerminal — meta-board
// ---------------------------------------------------------------------------

test('getWinner returns null on fresh board', () => {
  assert.equal(getWinner(createInitialState()), null);
});

test('getWinner detects X winning the meta-board (top row)', () => {
  const s = createInitialState();
  s.subWinners[0] = 'X';
  s.subWinners[1] = 'X';
  s.subWinners[2] = 'X';
  assert.equal(getWinner(s), 'X');
});

test('getWinner detects O winning the meta-board (diagonal)', () => {
  const s = createInitialState();
  s.subWinners[0] = 'O';
  s.subWinners[4] = 'O';
  s.subWinners[8] = 'O';
  assert.equal(getWinner(s), 'O');
});

test('getWinner returns draw when all sub-boards resolved with no winner', () => {
  const s = createInitialState();
  // Fill with a pattern that has no 3-in-a-row on the meta-board.
  // X wins: 0,2,3,5,6,8  O wins: 1,4,7  (no 3-in-a-row for either)
  const pattern = ['X','O','X','X','O','X','X','O','X'];
  // Verify: X has 0,2,3,5,6,8 — check rows: [0,1,2]=X,O,X ✗ [3,4,5]=X,O,X ✗ [6,7,8]=X,O,X ✗
  // cols: [0,3,6]=X,X,X ✓ — oops, that's a win. Use a real draw pattern.
  // Draw pattern: X=0,2,5,6  O=1,3,4,7  draw=8
  const noWinPattern = ['X','O','X','O','O','X','X','X','draw'];
  // Check: rows [0,1,2]=X,O,X ✗ [3,4,5]=O,O,X ✗ [6,7,8]=X,X,draw ✗
  // cols [0,3,6]=X,O,X ✗ [1,4,7]=O,O,X ✗ [2,5,8]=X,X,draw ✗
  // diag [0,4,8]=X,O,draw ✗ [2,4,6]=X,O,X ✗  — no winner!
  noWinPattern.forEach((v, i) => { s.subWinners[i] = v; });
  assert.equal(getWinner(s), 'draw');
});

test('isTerminal returns false on fresh board', () => {
  assert.equal(isTerminal(createInitialState()), false);
});

test('isTerminal returns true when meta-board is won', () => {
  const s = createInitialState();
  s.subWinners[0] = 'X'; s.subWinners[4] = 'X'; s.subWinners[8] = 'X';
  assert.equal(isTerminal(s), true);
});

// ---------------------------------------------------------------------------
// Sub-board draw detection
// ---------------------------------------------------------------------------

test('sub-board recorded as draw when full with no winner', () => {
  // Seed a full board with no winner:
  // X O X
  // X X O
  // O X O  → no 3-in-a-row for either player
  const cells = ['X','O','X','X','X','O','O','X','O'];
  // Verify no winner: rows X,O,X / X,X,O / O,X,O — none uniform.
  const s = createInitialState();
  // Fill board 2 with all but the last cell, then play the last cell.
  for (let i = 0; i < 8; i++) s.boards[2][i] = cells[i];
  s.currentPlayer = cells[8] === 'X' ? 'X' : 'O'; // 'O'
  s.activeBoard = 2;
  const next = makeMove(s, { board: 2, cell: 8 });
  assert.equal(next.subWinners[2], 'draw');
});
