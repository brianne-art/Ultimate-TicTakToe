// mcts.js — Monte Carlo Tree Search engine

import { cloneState, getLegalMoves, makeMove, getWinner, isTerminal } from './game.js';

const C = Math.SQRT2; // UCB1 exploration constant ≈ 1.41

class Node {
  constructor(state, parent = null, move = null) {
    this.state = state;         // GameState that led to this node
    this.parent = parent;       // parent Node (null for root)
    this.move = move;           // the move that produced this state
    this.children = [];         // expanded child Nodes
    this.visits = 0;
    this.totalScore = 0;
    // Moves not yet expanded into child nodes
    this._untriedMoves = getLegalMoves(state);
  }

  /** UCB1 score from this node's parent's perspective. */
  ucb1() {
    if (this.visits === 0) return Infinity;
    return (this.totalScore / this.visits) +
           C * Math.sqrt(Math.log(this.parent.visits) / this.visits);
  }

  /** True when every legal move has been expanded. */
  isFullyExpanded() {
    return this._untriedMoves.length === 0;
  }
}

// ---------------------------------------------------------------------------
// The four MCTS stages
// ---------------------------------------------------------------------------

/** 1. Selection — descend using UCB1 until we find a node to expand. */
function select(node) {
  while (!isTerminal(node.state)) {
    if (!node.isFullyExpanded()) return node;
    // Pick child with highest UCB1
    node = node.children.reduce((best, child) =>
      child.ucb1() > best.ucb1() ? child : best
    );
  }
  return node;
}

/** 2. Expansion — add one untried child and return it. */
function expand(node) {
  const idx = Math.floor(Math.random() * node._untriedMoves.length);
  const move = node._untriedMoves.splice(idx, 1)[0];
  const childState = makeMove(node.state, move);
  const child = new Node(childState, node, move);
  node.children.push(child);
  return child;
}

/** 3. Rollout — play randomly to a terminal state; return score for the mover. */
function rollout(state) {
  let s = cloneState(state);
  while (!isTerminal(s)) {
    const moves = getLegalMoves(s);
    s = makeMove(s, moves[Math.floor(Math.random() * moves.length)]);
  }
  const winner = getWinner(s);
  // Score is from the perspective of the player who moved INTO this node,
  // i.e. the opponent of state.currentPlayer (they just moved to reach `state`).
  const justMoved = state.currentPlayer === 'X' ? 'O' : 'X';
  if (winner === justMoved) return 1;
  if (winner === 'draw') return 0;
  return -1;
}

/** 4. Backpropagation — walk up the tree, negating score at each level. */
function backpropagate(node, score) {
  let current = node;
  while (current !== null) {
    current.visits++;
    current.totalScore += score;
    score = -score; // flip perspective as we move up
    current = current.parent;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run MCTS and return the best move from the given state.
 * @param {GameState} state
 * @param {number} maxIterations
 * @returns {{board: number, cell: number}}
 */
export function getBestMove(state, maxIterations = 500) {
  const root = new Node(cloneState(state));

  for (let i = 0; i < maxIterations; i++) {
    // 1. Select
    let node = select(root);

    // 2. Expand (unless terminal)
    if (!isTerminal(node.state)) {
      node = expand(node);
    }

    // 3. Rollout
    const score = rollout(node.state);

    // 4. Backpropagate
    backpropagate(node, score);
  }

  // Pick the root child with the best average score (most reliable at fixed budgets).
  // Tiebreak: first child wins.
  const best = root.children.reduce((best, child) =>
    (child.totalScore / child.visits) > (best.totalScore / best.visits) ? child : best
  );

  return best.move;
}

/**
 * Same as getBestMove but also returns per-child stats for the debug panel.
 * @param {GameState} state
 * @param {number} maxIterations
 * @returns {{ move: {board:number,cell:number}, stats: {move,visits,avgScore}[] }}
 */
export function getBestMoveWithStats(state, maxIterations = 500) {
  const root = new Node(cloneState(state));

  for (let i = 0; i < maxIterations; i++) {
    let node = select(root);
    if (!isTerminal(node.state)) node = expand(node);
    const score = rollout(node.state);
    backpropagate(node, score);
  }

  const best = root.children.reduce((best, child) =>
    (child.totalScore / child.visits) > (best.totalScore / best.visits) ? child : best
  );

  const stats = root.children
    .map(c => ({ move: c.move, visits: c.visits, avgScore: c.totalScore / c.visits }))
    .sort((a, b) => b.avgScore - a.avgScore);

  return { move: best.move, stats };
}
