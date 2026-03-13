// ui.js — DOM rendering and event wiring

import { createInitialState, makeMove, getLegalMoves, getWinner, isTerminal } from './game.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let gameState = createInitialState();
let worker = null;
let aiThinking = false;
let maxIterations = 800;
let debugMode = false;
// Human always plays X, AI plays O
const HUMAN = 'X';
const AI = 'O';

// ---------------------------------------------------------------------------
// Worker setup
// ---------------------------------------------------------------------------

function initWorker() {
  worker = new Worker('./worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    const { bestMove, stats } = e.data;
    gameState = makeMove(gameState, bestMove);
    aiThinking = false;
    render();
    if (stats) renderDebugStats(stats);
    checkGameOver();
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const winner = getWinner(gameState);
  const legalMoves = (!winner && !aiThinking) ? getLegalMoves(gameState) : [];
  const legalSet = new Set(legalMoves.map(m => `${m.board},${m.cell}`));

  for (let b = 0; b < 9; b++) {
    const subBoard = document.createElement('div');
    subBoard.className = 'sub-board';

    const subWinner = gameState.subWinners[b];
    const isActive = !winner && !aiThinking &&
      gameState.currentPlayer === HUMAN &&
      legalMoves.some(m => m.board === b);

    if (isActive) subBoard.classList.add('active');
    if (subWinner && subWinner !== 'draw') subBoard.classList.add(`won-${subWinner.toLowerCase()}`);
    if (subWinner === 'draw') subBoard.classList.add('drawn');

    // Won sub-board overlay
    if (subWinner && subWinner !== 'draw') {
      const overlay = document.createElement('div');
      overlay.className = `sub-winner-overlay player-${subWinner.toLowerCase()}`;
      overlay.textContent = subWinner;
      subBoard.appendChild(overlay);
    }

    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      const value = gameState.boards[b][c];

      if (value) {
        cell.textContent = value;
        cell.classList.add(`player-${value.toLowerCase()}`);
        cell.disabled = true;
      } else if (legalSet.has(`${b},${c}`)) {
        cell.classList.add('legal');
        cell.addEventListener('click', () => handleHumanMove(b, c));
      } else {
        cell.disabled = true;
      }

      subBoard.appendChild(cell);
    }

    board.appendChild(subBoard);
  }

  // Status bar
  const status = document.getElementById('status');
  if (winner) {
    status.textContent = winner === 'draw' ? "It's a draw!" : `${winner === HUMAN ? 'You win! 🎉' : 'AI wins!'}`;
  } else if (aiThinking) {
    status.textContent = 'AI is thinking…';
  } else {
    status.textContent = gameState.currentPlayer === HUMAN ? 'Your turn (X)' : 'AI\'s turn (O)';
  }

  document.getElementById('thinking-indicator').style.display = aiThinking ? 'flex' : 'none';
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function handleHumanMove(board, cell) {
  if (aiThinking || gameState.currentPlayer !== HUMAN) return;

  gameState = makeMove(gameState, { board, cell });
  render();

  if (checkGameOver()) return;

  // Trigger AI
  aiThinking = true;
  render();
  worker.postMessage({ state: gameState, maxIterations, debug: debugMode });
}

function checkGameOver() {
  const winner = getWinner(gameState);
  if (!winner) return false;

  const overlay = document.getElementById('game-over-overlay');
  const msg = document.getElementById('game-over-message');
  msg.textContent = winner === 'draw' ? "It's a draw!" : `${winner === HUMAN ? 'You win! 🎉' : 'AI wins!'}`;
  overlay.style.display = 'flex';
  return true;
}

function renderDebugStats(stats) {
  const panel = document.getElementById('debug-panel');
  const tbody = document.getElementById('debug-tbody');
  tbody.innerHTML = '';
  stats.slice(0, 10).forEach((s, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.classList.add('best-move');
    const score = s.avgScore.toFixed(3);
    const bar = Math.round((s.avgScore + 1) / 2 * 100); // map [-1,1] → [0,100]
    tr.innerHTML = `
      <td>B${s.move.board} C${s.move.cell}</td>
      <td>${s.visits}</td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${bar}%"></div>
          <span>${score}</span>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  panel.style.display = 'block';
}

function resetGame() {
  gameState = createInitialState();
  aiThinking = false;
  document.getElementById('game-over-overlay').style.display = 'none';
  render();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function initSettings() {
  const slider = document.getElementById('iterations-slider');
  const label = document.getElementById('iterations-label');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');

  slider.value = maxIterations;
  label.textContent = maxIterations;

  slider.addEventListener('input', () => {
    maxIterations = parseInt(slider.value, 10);
    label.textContent = maxIterations;
    // Clear active difficulty button since we're using custom value
    difficultyBtns.forEach(b => b.classList.remove('active'));
  });

  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      maxIterations = parseInt(btn.dataset.iters, 10);
      slider.value = maxIterations;
      label.textContent = maxIterations;
      difficultyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Set Medium as default active
  document.querySelector('[data-iters="800"]')?.classList.add('active');

  // Debug toggle
  const debugToggle = document.getElementById('debug-toggle');
  debugToggle.addEventListener('change', () => {
    debugMode = debugToggle.checked;
    if (!debugMode) document.getElementById('debug-panel').style.display = 'none';
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initWorker();
  initSettings();
  document.getElementById('play-again-btn').addEventListener('click', resetGame);
  document.getElementById('new-game-btn').addEventListener('click', resetGame);
  render();
});
