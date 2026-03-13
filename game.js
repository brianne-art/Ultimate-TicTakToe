// game.js — Ultimate Tic-Tac-Toe game logic

// Win patterns for a single 3x3 board (indices 0-8)
const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

/**
 * Check if a player has won a single 3x3 board.
 * @param {(null|'X'|'O')[]} cells - 9-element array
 * @param {string} player
 */
function checkWinner(cells, player) {
  return WIN_PATTERNS.some(([a, b, c]) =>
    cells[a] === player && cells[b] === player && cells[c] === player
  );
}

/**
 * Check if a single 3x3 board is fully filled (no nulls).
 * @param {(null|'X'|'O')[]} cells
 */
function isBoardFull(cells) {
  return cells.every(c => c !== null);
}

/**
 * Create a fresh game state.
 * @returns {GameState}
 */
export function createInitialState() {
  return {
    // boards[b][c]: cell c of sub-board b; null | 'X' | 'O'
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    // subWinners[b]: null | 'X' | 'O' | 'draw'
    subWinners: Array(9).fill(null),
    // null means the player may play in any unfinished sub-board
    activeBoard: null,
    currentPlayer: 'X',
  };
}

/**
 * Fast hand-written clone — ~3-5x faster than structuredClone at high iteration counts.
 * @param {GameState} state
 * @returns {GameState}
 */
export function cloneState(state) {
  const boards = new Array(9);
  for (let b = 0; b < 9; b++) {
    boards[b] = state.boards[b].slice();
  }
  return {
    boards,
    subWinners: state.subWinners.slice(),
    activeBoard: state.activeBoard,
    currentPlayer: state.currentPlayer,
  };
}

/**
 * Return all legal moves as {board, cell} objects.
 * @param {GameState} state
 * @returns {{board: number, cell: number}[]}
 */
export function getLegalMoves(state) {
  const moves = [];
  const { boards, subWinners, activeBoard } = state;

  if (activeBoard !== null && subWinners[activeBoard] === null) {
    // Must play in the designated sub-board
    for (let c = 0; c < 9; c++) {
      if (boards[activeBoard][c] === null) {
        moves.push({ board: activeBoard, cell: c });
      }
    }
  } else {
    // Free choice: play in any unfinished sub-board
    for (let b = 0; b < 9; b++) {
      if (subWinners[b] === null) {
        for (let c = 0; c < 9; c++) {
          if (boards[b][c] === null) {
            moves.push({ board: b, cell: c });
          }
        }
      }
    }
  }

  return moves;
}

/**
 * Apply a move and return a new state (does not mutate the input).
 * @param {GameState} state
 * @param {{board: number, cell: number}} move
 * @returns {GameState}
 */
export function makeMove(state, move) {
  const next = cloneState(state);
  const { board, cell } = move;
  const player = next.currentPlayer;

  next.boards[board][cell] = player;

  // Update sub-board result if not already resolved
  if (next.subWinners[board] === null) {
    if (checkWinner(next.boards[board], player)) {
      next.subWinners[board] = player;
    } else if (isBoardFull(next.boards[board])) {
      next.subWinners[board] = 'draw';
    }
  }

  // The cell index determines which sub-board the opponent must play in next.
  // If that sub-board is already resolved, grant free choice (null).
  next.activeBoard = next.subWinners[cell] === null ? cell : null;

  next.currentPlayer = player === 'X' ? 'O' : 'X';
  return next;
}

/**
 * Return the meta-board winner ('X', 'O', 'draw', or null if game is ongoing).
 * A drawn sub-board counts as neither player's win on the meta-board.
 * @param {GameState} state
 * @returns {null|'X'|'O'|'draw'}
 */
export function getWinner(state) {
  const { subWinners } = state;

  for (const player of ['X', 'O']) {
    if (checkWinner(subWinners, player)) return player;
  }

  // All sub-boards resolved and no winner → draw
  if (subWinners.every(w => w !== null)) return 'draw';

  return null;
}

/**
 * Return true if the game is over.
 * @param {GameState} state
 */
export function isTerminal(state) {
  return getWinner(state) !== null;
}
