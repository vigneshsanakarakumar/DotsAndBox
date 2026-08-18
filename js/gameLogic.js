import { BOARD_CONFIG, PLAYERS } from './constants.js';

/**
 * Core Dots and Boxes Game Engine
 * Manages board state, moves, box completions, turns, scoring, and win states.
 */
export class DotsAndBoxesGame {
  constructor() {
    this.reset();
  }

  /**
   * Initializes or resets all board matrices and game trackers.
   */
  reset() {
    // 8 rows of 7 horizontal line segments (8 x 7 = 56)
    // 0 = unselected, 1 = Player 1, 2 = Player 2
    this.horizontal = Array.from({ length: BOARD_CONFIG.DOT_ROWS }, () => 
      Array(BOARD_CONFIG.BOX_COLS).fill(0)
    );

    // 7 rows of 8 vertical line segments (7 x 8 = 56)
    // 0 = unselected, 1 = Player 1, 2 = Player 2
    this.vertical = Array.from({ length: BOARD_CONFIG.BOX_ROWS }, () => 
      Array(BOARD_CONFIG.DOT_COLS).fill(0)
    );

    // 7 x 7 grid of boxes (49 total)
    // 0 = unclaimed, 1 = Player 1, 2 = Player 2
    this.boxes = Array.from({ length: BOARD_CONFIG.BOX_ROWS }, () => 
      Array(BOARD_CONFIG.BOX_COLS).fill(0)
    );

    this.scores = {
      [PLAYERS.PLAYER_1]: 0,
      [PLAYERS.PLAYER_2]: 0
    };

    this.completedBoxes = 0;
    this.currentPlayer = PLAYERS.PLAYER_1;
    this.isGameOver = false;
    this.winner = null;
    this.moveHistory = [];
  }

  /**
   * Checks if a box has all 4 enclosing sides drawn.
   * If complete and currently unowned, assigns it to the current player.
   *
   * Box at (r, c) boundary lines:
   * Top:    horizontal[r][c]
   * Bottom: horizontal[r + 1][c]
   * Left:   vertical[r][c]
   * Right:  vertical[r][c + 1]
   *
   * @param {number} row - Box row index (0 to 6)
   * @param {number} col - Box col index (0 to 6)
   * @returns {boolean} True if the box was freshly completed by this check.
   */
  checkBox(row, col) {
    // 1. Boundary check
    if (row < 0 || row >= BOARD_CONFIG.BOX_ROWS || col < 0 || col >= BOARD_CONFIG.BOX_COLS) {
      return false;
    }

    // 2. Check if box is already claimed
    if (this.boxes[row][col] !== PLAYERS.NONE) {
      return false;
    }

    // 3-6. Check all 4 sides
    const top = this.horizontal[row][col] !== 0;
    const bottom = this.horizontal[row + 1][col] !== 0;
    const left = this.vertical[row][col] !== 0;
    const right = this.vertical[row][col + 1] !== 0;

    // 7. If all 4 sides exist, award box
    if (top && bottom && left && right) {
      this.boxes[row][col] = this.currentPlayer;
      this.scores[this.currentPlayer]++;
      this.completedBoxes++;
      return true;
    }

    return false;
  }

  /**
   * Executes a move on a horizontal or vertical line.
   *
   * @param {'h'|'v'} type - 'h' for horizontal, 'v' for vertical
   * @param {number} row - Row index
   * @param {number} col - Col index
   * @returns {Object} Move result details
   */
  makeMove(type, row, col) {
    if (this.isGameOver) {
      return { success: false, reason: 'Game is already finished.' };
    }

    // 1. Validate indices and check if line is already occupied
    if (type === 'h') {
      if (row < 0 || row >= BOARD_CONFIG.DOT_ROWS || col < 0 || col >= BOARD_CONFIG.BOX_COLS) {
        return { success: false, reason: 'Invalid horizontal line coordinates.' };
      }
      if (this.horizontal[row][col] !== 0) {
        return { success: false, reason: 'Line already drawn.' };
      }
      // Mark horizontal line
      this.horizontal[row][col] = this.currentPlayer;
    } else if (type === 'v') {
      if (row < 0 || row >= BOARD_CONFIG.BOX_ROWS || col < 0 || col >= BOARD_CONFIG.DOT_COLS) {
        return { success: false, reason: 'Invalid vertical line coordinates.' };
      }
      if (this.vertical[row][col] !== 0) {
        return { success: false, reason: 'Line already drawn.' };
      }
      // Mark vertical line
      this.vertical[row][col] = this.currentPlayer;
    } else {
      return { success: false, reason: 'Invalid line type.' };
    }

    // 2. Identify and check affected boxes
    const completedBoxesThisMove = [];

    if (type === 'h') {
      // Horizontal line affects box above (row - 1, col) and box below (row, col)
      if (row > 0) {
        if (this.checkBox(row - 1, col)) {
          completedBoxesThisMove.push({ row: row - 1, col });
        }
      }
      if (row < BOARD_CONFIG.BOX_ROWS) {
        if (this.checkBox(row, col)) {
          completedBoxesThisMove.push({ row, col });
        }
      }
    } else if (type === 'v') {
      // Vertical line affects box to the left (row, col - 1) and box to the right (row, col)
      if (col > 0) {
        if (this.checkBox(row, col - 1)) {
          completedBoxesThisMove.push({ row, col: col - 1 });
        }
      }
      if (col < BOARD_CONFIG.BOX_COLS) {
        if (this.checkBox(row, col)) {
          completedBoxesThisMove.push({ row, col });
        }
      }
    }

    const previousPlayer = this.currentPlayer;
    let extraTurn = false;

    // 3. Handle scoring and turn switching
    if (completedBoxesThisMove.length > 0) {
      // At least 1 box completed -> player keeps turn
      extraTurn = true;
    } else {
      // 0 boxes completed -> switch player
      this.currentPlayer = this.currentPlayer === PLAYERS.PLAYER_1 ? PLAYERS.PLAYER_2 : PLAYERS.PLAYER_1;
    }

    // 4. Check for Game Over (all 49 boxes claimed)
    if (this.completedBoxes === BOARD_CONFIG.TOTAL_BOXES) {
      this.isGameOver = true;
      if (this.scores[PLAYERS.PLAYER_1] > this.scores[PLAYERS.PLAYER_2]) {
        this.winner = PLAYERS.PLAYER_1;
      } else if (this.scores[PLAYERS.PLAYER_2] > this.scores[PLAYERS.PLAYER_1]) {
        this.winner = PLAYERS.PLAYER_2;
      } else {
        this.winner = 'DRAW';
      }
    }

    // 5. Record move in history
    const moveRecord = {
      type,
      row,
      col,
      player: previousPlayer,
      completedBoxes: completedBoxesThisMove,
      extraTurn,
      nextPlayer: this.currentPlayer,
      isGameOver: this.isGameOver,
      winner: this.winner
    };
    this.moveHistory.push(moveRecord);

    return {
      success: true,
      move: moveRecord,
      completedBoxes: completedBoxesThisMove,
      pointsEarned: completedBoxesThisMove.length,
      extraTurn,
      currentPlayer: this.currentPlayer,
      scores: { ...this.scores },
      completedCount: this.completedBoxes,
      remainingBoxes: BOARD_CONFIG.TOTAL_BOXES - this.completedBoxes,
      isGameOver: this.isGameOver,
      winner: this.winner
    };
  }

  /**
   * Reverts the most recent move from history.
   * @returns {Object|null} The undone move details or null if no moves to undo.
   */
  undoMove() {
    if (this.moveHistory.length === 0) {
      return null;
    }

    const lastMove = this.moveHistory.pop();

    // 1. Unmark line
    if (lastMove.type === 'h') {
      this.horizontal[lastMove.row][lastMove.col] = 0;
    } else {
      this.vertical[lastMove.row][lastMove.col] = 0;
    }

    // 2. Revert any claimed boxes
    for (const box of lastMove.completedBoxes) {
      this.boxes[box.row][box.col] = 0;
      this.scores[lastMove.player]--;
      this.completedBoxes--;
    }

    // 3. Restore state
    this.currentPlayer = lastMove.player;
    this.isGameOver = false;
    this.winner = null;

    return lastMove;
  }

  /**
   * Returns a list of all currently available (unselected) lines.
   */
  getAvailableMoves() {
    const moves = [];

    // Horizontal lines (8 rows x 7 cols)
    for (let r = 0; r < BOARD_CONFIG.DOT_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.BOX_COLS; c++) {
        if (this.horizontal[r][c] === 0) {
          moves.push({ type: 'h', row: r, col: c });
        }
      }
    }

    // Vertical lines (7 rows x 8 cols)
    for (let r = 0; r < BOARD_CONFIG.BOX_ROWS; r++) {
      for (let c = 0; c < BOARD_CONFIG.DOT_COLS; c++) {
        if (this.vertical[r][c] === 0) {
          moves.push({ type: 'v', row: r, col: c });
        }
      }
    }

    return moves;
  }

  /**
   * Counts how many drawn sides exist on a given box (0 to 4).
   */
  getBoxSidesCount(row, col) {
    if (row < 0 || row >= BOARD_CONFIG.BOX_ROWS || col < 0 || col >= BOARD_CONFIG.BOX_COLS) {
      return 0;
    }
    let count = 0;
    if (this.horizontal[row][col] !== 0) count++;
    if (this.horizontal[row + 1][col] !== 0) count++;
    if (this.vertical[row][col] !== 0) count++;
    if (this.vertical[row][col + 1] !== 0) count++;
    return count;
  }
}
