# Phased Implementation Plan: Ultimate Tic-Tac-Toe with MCTS

## File Structure

```
/
├── index.html       # UI shell
├── game.js          # Game logic (makeMove, getLegalMoves, getWinner, isTerminal, cloneState)
├── mcts.js          # MCTS engine (getBestMove)
├── worker.js        # Web Worker wrapper around mcts.js
└── ui.js            # DOM rendering and event wiring
```

---

## Phase 1 — Game Logic Core ✅
**Goal:** A complete, bug-free game engine with no UI.

- Model the board as a 3×3 grid of 3×3 sub-boards
- Represent state as a plain JS object with these fields:
  - `boards[9][9]` — cell values (null, 'X', or 'O') for each sub-board
  - `subWinners[9]` — winner of each sub-board (null, 'X', 'O', or 'draw')
  - `activeBoard` — index of the required sub-board (null = free choice)
  - `currentPlayer` — 'X' or 'O'
- Implement the **active sub-board constraint** (the cell played determines the next active board)
- Write win-detection for sub-boards and the overall game
- Handle the **"free choice" rule**: if the required sub-board is already won OR fully drawn, the current player may play in **any cell of any unfinished sub-board**
- `isTerminal` must cover all three cases:
  - A player wins 3 sub-boards in a row on the meta-board
  - All 9 sub-boards are resolved (won or drawn) with no meta-board winner → **draw**
  - Note: a drawn sub-board counts as neither player's win on the meta-board
- Prefer a hand-written `cloneState` over `structuredClone()` — it is ~3–5× faster at high iteration counts (>1000). Clone all five fields listed above; `boards` requires a two-level copy.

**Deliverable:** `game.js` — **21/21 tests passing** (`game.test.js`)

---

## Phase 2 — MCTS Engine ✅
**Goal:** A working AI using Monte Carlo Tree Search.

- Build the tree node structure: `{state, parent, move, children, visits, totalScore, _untriedMoves}`
  - `_untriedMoves` is populated at construction from `getLegalMoves` and shrinks as children are expanded
- Implement the **4 MCTS stages**:
  1. **Selection** — traverse the tree using **UCB1**: `score/visits + C * sqrt(ln(parentVisits)/visits)`, with `C ≈ 1.41`
     - If a node has any unvisited children, stop selection and proceed to Expansion (unvisited nodes are treated as infinite UCB1 score)
     - Scores stored at each node are from **that node's player's** perspective
  2. **Expansion** — pick a random untried move, splice it from `_untriedMoves`, create and return the new child node
  3. **Rollout** — play random moves until a terminal state (win/loss/draw). Score the result from the **perspective of the player who just moved at the expanded node**: `+1` (win), `-1` (loss), `0` (draw)
  4. **Backpropagation** — walk back up the tree updating `visits` and `totalScore`.
     - **Negate the score at every level**: `score = -score` as you move up, because a win for a child node is a loss from the parent's perspective. This negation is the most common MCTS bug if missed.

- Run the loop for a configurable `maxIterations` (start with 500, test 200/1000/3000)
- After the loop, **pick the root child with the highest `totalScore/visits`** (best expected outcome from the AI's perspective). In case of an exact tie, pick the first candidate.
  - Average score (`totalScore/visits`) is preferred over most-visited at fixed iteration budgets; most-visited becomes more robust only at very high counts (>10 000).
- **Iteration budget vs. branching factor:** with `activeBoard = null` (free choice), there can be up to 61 first-level moves. At least ~10× the branching factor in iterations is needed to reliably identify the best move by average score. Keep this in mind when setting difficulty levels.

**Deliverable:** `mcts.js` — **6/6 tests passing** (`mcts.test.js`)

---

## Phase 3 — UI & Integration
**Goal:** A playable web interface.

- Render the 9×9 grid with clear visual grouping of sub-boards
- Highlight the active sub-board (where the current player must play)
- Show won sub-boards with a large X or O overlay
- Wire human clicks → `makeMove` → re-render
- After each human move, call `getBestMove` via a **Web Worker** to avoid freezing the UI:
  - `worker.js` imports `mcts.js` and `game.js`, listens for `postMessage({state, maxIterations})`, runs `getBestMove`, and replies with `postMessage({bestMove})`
  - Main thread posts the message, shows a spinner, then applies the move and hides the spinner on response
- Show a "Thinking..." indicator while AI computes
- Add a settings panel to tune `maxIterations` (e.g., a slider: 100–5000)

**Deliverable:** `index.html`, `ui.js`, and `worker.js` forming a polished, non-blocking game UI

---

## Phase 4 — Tuning & Polish ✅
**Goal:** Validate MCTS quality and improve UX.

- **Benchmark iterations:** `benchmark.js` runs AI vs. random (50 games each side) at 200/500/1000/3000 iterations. Results on a standard machine:

  | Iterations | AI as X | AI as O | Overall win% |
  |---|---|---|---|
  | 200  | 50W 0D 0L | 49W 1D 0L | 99.0% |
  | 500  | 50W 0D 0L | 50W 0D 0L | 100.0% |
  | 1000 | 50W 0D 0L | 50W 0D 0L | 100.0% |
  | 3000 | 50W 0D 0L | 50W 0D 0L | 100.0% |

  Even 200 iterations dominates random play — the difficulty levels are about AI think-time and response speed, not whether it can beat random.

- **Difficulty selector** — Easy (200), Medium (800), Hard (3000) + custom slider 100–5000
- **MCTS debug panel** — checkbox toggle; after each AI move shows the top-10 candidate moves with visit count and a score bar (avg score mapped to a visual bar). Powered by `getBestMoveWithStats` in `mcts.js` and a `debug` flag on the worker message.
- **Game-over overlay** — modal with result message and Play Again button
- **Responsive layout** — works on mobile via `clamp()` font sizes and `min(540px, 96vw)` widths

---

## Key Technical Decisions to Nail Early

| Decision | Recommendation |
|---|---|
| State representation | Plain object with a hand-written `cloneState` — faster than `structuredClone()` at scale |
| UCB1 constant C | Start at `√2 ≈ 1.41`, experiment with 0.5–2.0 |
| UCB1 unvisited nodes | Treat as infinite score — always expand before re-visiting any node |
| Score negation | Negate score at every backprop step — most common MCTS bug if missed |
| AI computation | Web Worker with `postMessage({state, maxIterations})` / `postMessage({bestMove})` |
| Move selection | Best **average score** (`totalScore/visits`) from root's children — more reliable than most-visited at the iteration counts used here; needs ~10× branching factor in iterations to converge |
| Rollout depth limit | None needed — ultimate TTT games are finite (~81 moves max) |
| Free-choice rule | Any unfinished sub-board when the target is already won or drawn |
| Draw detection | All sub-boards resolved + no 3-in-a-row on meta-board = draw |
| Tiebreaking | First child wins on exact tie — keeps behavior deterministic |
