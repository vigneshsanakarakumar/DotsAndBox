import { GAME_MODES } from './constants.js';

/**
 * AI Opponent Logic for Dots and Boxes
 */
export class DotsAndBoxesAI {
  /**
   * Selects the next move based on current game state and AI difficulty level.
   * @param {DotsAndBoxesGame} game 
   * @param {string} mode 
   * @returns {Object|null} Move { type: 'h'|'v', row: number, col: number }
   */
  static getMove(game, mode) {
    const availableMoves = game.getAvailableMoves();
    if (availableMoves.length === 0) return null;

    if (mode === GAME_MODES.VS_AI_EASY) {
      return this.getRandomMove(availableMoves);
    }

    return this.getSmartMove(game, availableMoves);
  }

  /**
   * Random move selector for Easy mode.
   */
  static getRandomMove(availableMoves) {
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    return availableMoves[randomIndex];
  }

  /**
   * Smart AI:
   * 1. Completes any 3-sided boxes immediately (+1 or +2 points).
   * 2. Otherwise avoids moves that create a 3-sided box.
   * 3. If forced to give boxes, picks the least penalizing move.
   */
  static getSmartMove(game, availableMoves) {
    const boxCompletingMoves = [];
    const safeMoves = [];
    const riskyMoves = [];

    for (const move of availableMoves) {
      const completionCount = this.evalMoveCompletionCount(game, move);

      if (completionCount > 0) {
        boxCompletingMoves.push({ move, count: completionCount });
      } else {
        const createsThreeSidedBox = this.doesMoveCreateThreeSidedBox(game, move);
        if (!createsThreeSidedBox) {
          safeMoves.push(move);
        } else {
          riskyMoves.push(move);
        }
      }
    }

    // 1. Prioritize completing 2 boxes, then 1 box
    if (boxCompletingMoves.length > 0) {
      boxCompletingMoves.sort((a, b) => b.count - a.count);
      return boxCompletingMoves[0].move;
    }

    // 2. Make a safe move that doesn't hand the opponent a box
    if (safeMoves.length > 0) {
      const randomIndex = Math.floor(Math.random() * safeMoves.length);
      return safeMoves[randomIndex];
    }

    // 3. Forced move fallback
    if (riskyMoves.length > 0) {
      const randomIndex = Math.floor(Math.random() * riskyMoves.length);
      return riskyMoves[randomIndex];
    }

    return availableMoves[0];
  }

  /**
   * Checks how many boxes this line would complete (0, 1, or 2).
   */
  static evalMoveCompletionCount(game, move) {
    let completed = 0;

    if (move.type === 'h') {
      // Box above
      if (move.row > 0 && game.getBoxSidesCount(move.row - 1, move.col) === 3) {
        completed++;
      }
      // Box below
      if (move.row < 7 && game.getBoxSidesCount(move.row, move.col) === 3) {
        completed++;
      }
    } else {
      // Box to left
      if (move.col > 0 && game.getBoxSidesCount(move.row, move.col - 1) === 3) {
        completed++;
      }
      // Box to right
      if (move.col < 7 && game.getBoxSidesCount(move.row, move.col) === 3) {
        completed++;
      }
    }

    return completed;
  }

  /**
   * Checks if drawing this line would increase any adjacent box from 2 sides to 3 sides.
   */
  static doesMoveCreateThreeSidedBox(game, move) {
    if (move.type === 'h') {
      if (move.row > 0 && game.getBoxSidesCount(move.row - 1, move.col) === 2) return true;
      if (move.row < 7 && game.getBoxSidesCount(move.row, move.col) === 2) return true;
    } else {
      if (move.col > 0 && game.getBoxSidesCount(move.row, move.col - 1) === 2) return true;
      if (move.col < 7 && game.getBoxSidesCount(move.row, move.col) === 2) return true;
    }
    return false;
  }
}
