import { BOARD_CONFIG } from './constants.js';

/* Player seat numbers: 1, 2, 3, 4 */
export const PLAYER_COLORS = {
  1: { solid: '#3b82f6', dim: 'rgba(59,130,246,.15)',  border: '#2563eb', name: 'Blue'   },
  2: { solid: '#dc2626', dim: 'rgba(220,38,38,.15)',   border: '#b91c1c', name: 'Red'    },
  3: { solid: '#16a34a', dim: 'rgba(22,163,74,.15)',   border: '#15803d', name: 'Green'  },
  4: { solid: '#d97706', dim: 'rgba(217,119,6,.15)',   border: '#b45309', name: 'Amber'  },
};

/**
 * N-Player Dots and Boxes Game Engine (supports 2–4 players)
 *
 * Fixed over 2-player version:
 *  - handleTimeout() cycles correctly through N players (no infinite toggle)
 *  - scores object supports up to 4 players
 *  - winner detection picks highest scorer
 */
export class DotsAndBoxesGame {
  constructor(playerCount = 2) {
    this.playerCount = Math.min(4, Math.max(2, playerCount));
    this.reset();
  }

  reset(playerCount) {
    if (playerCount !== undefined) {
      this.playerCount = Math.min(4, Math.max(2, playerCount));
    }

    // 8×7 = 56 horizontal lines
    this.horizontal = Array.from({ length: BOARD_CONFIG.DOT_ROWS },
      () => Array(BOARD_CONFIG.BOX_COLS).fill(0));

    // 7×8 = 56 vertical lines
    this.vertical = Array.from({ length: BOARD_CONFIG.BOX_ROWS },
      () => Array(BOARD_CONFIG.DOT_COLS).fill(0));

    // 7×7 = 49 boxes
    this.boxes = Array.from({ length: BOARD_CONFIG.BOX_ROWS },
      () => Array(BOARD_CONFIG.BOX_COLS).fill(0));

    // Scores indexed 1..playerCount
    this.scores = {};
    for (let p = 1; p <= this.playerCount; p++) this.scores[p] = 0;

    this.completedBoxes = 0;
    this.currentPlayer  = 1;   // always start with player 1
    this.isGameOver     = false;
    this.winner         = null;
    this.moveHistory    = [];
    this._timeoutLock   = false;  // prevent double-fire
  }

  /* ── Internal: next player seat (wraps around) ─────────────────────── */
  _nextPlayer(from = this.currentPlayer) {
    return (from % this.playerCount) + 1;
  }

  /* ── Check / award a box ─────────────────────────────────────────────── */
  checkBox(row, col) {
    if (row < 0 || row >= BOARD_CONFIG.BOX_ROWS ||
        col < 0 || col >= BOARD_CONFIG.BOX_COLS) return false;
    if (this.boxes[row][col] !== 0) return false;

    const top    = this.horizontal[row][col]     !== 0;
    const bottom = this.horizontal[row + 1][col] !== 0;
    const left   = this.vertical[row][col]       !== 0;
    const right  = this.vertical[row][col + 1]   !== 0;

    if (top && bottom && left && right) {
      this.boxes[row][col] = this.currentPlayer;
      this.scores[this.currentPlayer]++;
      this.completedBoxes++;
      return true;
    }
    return false;
  }

  /* ── Make a move ─────────────────────────────────────────────────────── */
  makeMove(type, row, col) {
    if (this.isGameOver) return { success: false, reason: 'Game over.' };

    // Validate + mark line
    if (type === 'h') {
      if (row < 0 || row >= BOARD_CONFIG.DOT_ROWS ||
          col < 0 || col >= BOARD_CONFIG.BOX_COLS)
        return { success: false, reason: 'Invalid coords.' };
      if (this.horizontal[row][col] !== 0)
        return { success: false, reason: 'Line already drawn.' };
      this.horizontal[row][col] = this.currentPlayer;
    } else if (type === 'v') {
      if (row < 0 || row >= BOARD_CONFIG.BOX_ROWS ||
          col < 0 || col >= BOARD_CONFIG.DOT_COLS)
        return { success: false, reason: 'Invalid coords.' };
      if (this.vertical[row][col] !== 0)
        return { success: false, reason: 'Line already drawn.' };
      this.vertical[row][col] = this.currentPlayer;
    } else {
      return { success: false, reason: 'Invalid type.' };
    }

    // Detect newly completed boxes
    const completed = [];
    if (type === 'h') {
      if (row > 0              && this.checkBox(row - 1, col)) completed.push({ row: row - 1, col });
      if (row < BOARD_CONFIG.BOX_ROWS && this.checkBox(row, col))     completed.push({ row, col });
    } else {
      if (col > 0              && this.checkBox(row, col - 1)) completed.push({ row, col: col - 1 });
      if (col < BOARD_CONFIG.BOX_COLS && this.checkBox(row, col))     completed.push({ row, col });
    }

    const prevPlayer = this.currentPlayer;
    const extraTurn  = completed.length > 0;

    // Turn logic: extra turn if box(es) completed, else advance to next player
    if (!extraTurn) {
      this.currentPlayer = this._nextPlayer();
    }

    // Game over?
    if (this.completedBoxes === BOARD_CONFIG.TOTAL_BOXES) {
      this.isGameOver = true;
      this.winner = this._determineWinner();
    }

    const record = {
      type, row, col,
      player: prevPlayer,
      completedBoxes: completed,
      extraTurn,
      nextPlayer: this.currentPlayer,
      isGameOver: this.isGameOver,
      winner: this.winner
    };
    this.moveHistory.push(record);

    return {
      success: true,
      move: record,
      completedBoxes: completed,
      pointsEarned: completed.length,
      extraTurn,
      currentPlayer: this.currentPlayer,
      scores: { ...this.scores },
      completedCount: this.completedBoxes,
      remainingBoxes: BOARD_CONFIG.TOTAL_BOXES - this.completedBoxes,
      isGameOver: this.isGameOver,
      winner: this.winner
    };
  }

  /* ── Handle turn timeout (safe, no double-fire) ──────────────────────── */
  handleTimeout() {
    if (this.isGameOver)      return { success: false, reason: 'Game over.' };
    if (this._timeoutLock)    return { success: false, reason: 'Timeout already processing.' };

    this._timeoutLock = true;
    const skipped = this.currentPlayer;
    this.currentPlayer = this._nextPlayer();
    // Release lock after a tick so the UI can update before any next timeout
    setTimeout(() => { this._timeoutLock = false; }, 100);

    return {
      success: true,
      skippedPlayer: skipped,
      nextPlayer: this.currentPlayer,
      scores: { ...this.scores },
      completedBoxes: this.completedBoxes
    };
  }

  /* ── Determine winner from scores ────────────────────────────────────── */
  _determineWinner() {
    let best = -1, winners = [];
    for (let p = 1; p <= this.playerCount; p++) {
      if (this.scores[p] > best) { best = this.scores[p]; winners = [p]; }
      else if (this.scores[p] === best) { winners.push(p); }
    }
    return winners.length === 1 ? winners[0] : 'DRAW';
  }

  /* ── Undo last move ──────────────────────────────────────────────────── */
  undoMove() {
    if (this.moveHistory.length === 0) return null;
    const mv = this.moveHistory.pop();

    if (mv.type === 'h') this.horizontal[mv.row][mv.col] = 0;
    else                 this.vertical[mv.row][mv.col]   = 0;

    for (const b of mv.completedBoxes) {
      this.boxes[b.row][b.col] = 0;
      this.scores[mv.player]--;
      this.completedBoxes--;
    }

    this.currentPlayer = mv.player;
    this.isGameOver    = false;
    this.winner        = null;
    return mv;
  }

  /* ── Available moves ─────────────────────────────────────────────────── */
  getAvailableMoves() {
    const moves = [];
    for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++)
      for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++)
        if (this.horizontal[r][c] === 0) moves.push({ type: 'h', row: r, col: c });
    for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++)
      for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++)
        if (this.vertical[r][c] === 0) moves.push({ type: 'v', row: r, col: c });
    return moves;
  }

  getBoxSidesCount(row, col) {
    if (row < 0 || row >= BOARD_CONFIG.BOX_ROWS ||
        col < 0 || col >= BOARD_CONFIG.BOX_COLS) return 0;
    let n = 0;
    if (this.horizontal[row][col]     !== 0) n++;
    if (this.horizontal[row + 1][col] !== 0) n++;
    if (this.vertical[row][col]       !== 0) n++;
    if (this.vertical[row][col + 1]   !== 0) n++;
    return n;
  }
}
