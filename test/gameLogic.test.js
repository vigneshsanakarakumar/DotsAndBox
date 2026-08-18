import { DotsAndBoxesGame } from '../js/gameLogic.js';
import { BOARD_CONFIG, PLAYERS } from '../js/constants.js';
import { DotsAndBoxesAI } from '../js/ai.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function verifyInvariant(game, context = '') {
  const sum = game.scores[PLAYERS.PLAYER_1] + game.scores[PLAYERS.PLAYER_2];
  if (sum !== game.completedBoxes) {
    throw new Error(`INVARIANT VIOLATION (${context}): P1(${game.scores[1]}) + P2(${game.scores[2]}) = ${sum} !== completedBoxes(${game.completedBoxes})`);
  }
}

console.log('====================================================');
console.log('  DOTS AND BOXES: RIGOROUS VERIFICATION TEST SUITE  ');
console.log('====================================================\n');

// ----------------------------------------------------
// Section 1: Invariant & State Verification Across 1,000 Simulated Matches
// ----------------------------------------------------
console.log('[1. INVARIANT CHECK: 1,000 Complete Random Matches]');
let totalMovesEvaluated = 0;
for (let match = 1; match <= 1000; match++) {
  const g = new DotsAndBoxesGame();
  verifyInvariant(g, `Initial state match ${match}`);

  while (!g.isGameOver) {
    const moves = g.getAvailableMoves();
    if (moves.length === 0) break;

    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const prevPlayer = g.currentPlayer;
    const prevScoreP1 = g.scores[1];
    const prevScoreP2 = g.scores[2];
    const prevBoxes = g.completedBoxes;

    const res = g.makeMove(randomMove.type, randomMove.row, randomMove.col);
    totalMovesEvaluated++;

    if (!res.success) {
      throw new Error(`Move failed unexpectedly on available move: ${JSON.stringify(randomMove)}`);
    }

    // Invariant Check
    verifyInvariant(g, `After move in match ${match}`);

    // Extra Turn & Score Rule Check
    if (res.pointsEarned > 0) {
      if (res.extraTurn !== true) throw new Error('Failed: extraTurn should be true when pointsEarned > 0');
      if (g.currentPlayer !== prevPlayer) throw new Error('Failed: Current player changed despite completing box');
      if (prevPlayer === 1 && g.scores[1] !== prevScoreP1 + res.pointsEarned) throw new Error('Score did not increment properly for P1');
      if (prevPlayer === 2 && g.scores[2] !== prevScoreP2 + res.pointsEarned) throw new Error('Score did not increment properly for P2');
      if (g.completedBoxes !== prevBoxes + res.pointsEarned) throw new Error('completedBoxes count mismatch');
    } else {
      if (res.extraTurn !== false) throw new Error('Failed: extraTurn should be false when pointsEarned === 0');
      if (g.currentPlayer !== (3 - prevPlayer)) throw new Error('Failed: Turn did not switch on 0 points');
      if (g.scores[1] !== prevScoreP1 || g.scores[2] !== prevScoreP2) throw new Error('Scores altered on 0 points');
    }
  }

  // End of match assertions
  if (g.completedBoxes !== 49) throw new Error(`Game over with ${g.completedBoxes} instead of 49`);
  if (g.scores[1] + g.scores[2] !== 49) throw new Error(`Final score sum !== 49`);
  if (g.winner === null) throw new Error('Winner was null on game over');
}
assert(true, `Verified 1,000 matches (${totalMovesEvaluated} individual moves). Invariant P1 + P2 === completedBoxes strictly held on EVERY single move.`);

// ----------------------------------------------------
// Section 2: Exact Extra-Turn Verification
// ----------------------------------------------------
console.log('\n[2. EXACT EXTRA-TURN RULES]');
const gExtra = new DotsAndBoxesGame();

// 2A: 0 boxes completed
const res0 = gExtra.makeMove('h', 0, 0);
assert(res0.pointsEarned === 0 && res0.extraTurn === false && gExtra.currentPlayer === PLAYERS.PLAYER_2, '0 boxes -> score unchanged, turn switches to P2');
verifyInvariant(gExtra, 'After 0 box');

// 2B: 1 box completed
gExtra.reset();
gExtra.makeMove('h', 0, 0); // P1
gExtra.makeMove('v', 0, 0); // P2
gExtra.makeMove('v', 0, 1); // P1
const res1 = gExtra.makeMove('h', 1, 0); // P2 completes (0,0)
assert(res1.pointsEarned === 1 && res1.extraTurn === true && gExtra.currentPlayer === PLAYERS.PLAYER_2, '1 box -> +1 score, P2 keeps turn (1 extra move)');
verifyInvariant(gExtra, 'After 1 box');

// 2C: 2 boxes completed in 1 move
gExtra.reset();
gExtra.makeMove('h', 1, 1); // P1
gExtra.makeMove('h', 2, 1); // P2
gExtra.makeMove('v', 1, 1); // P1
gExtra.makeMove('h', 1, 2); // P2
gExtra.makeMove('h', 2, 2); // P1
gExtra.makeMove('v', 1, 3); // P2
// Now v(1,2) completes both box (1,1) and box (1,2)
const res2 = gExtra.makeMove('v', 1, 2); // P1 move
assert(res2.pointsEarned === 2, '2 boxes completed simultaneously -> +2 score');
assert(res2.extraTurn === true, 'Player gets ONE extra turn (extraTurn flag is true)');
assert(gExtra.currentPlayer === PLAYERS.PLAYER_1, 'P1 keeps the turn');
verifyInvariant(gExtra, 'After 2 boxes');

// If P1 makes the extra move without scoring, turn passes to P2
const resFollowUp = gExtra.makeMove('h', 0, 0);
assert(resFollowUp.pointsEarned === 0 && gExtra.currentPlayer === PLAYERS.PLAYER_2, 'After using the single extra turn without scoring, turn passes to P2');

// ----------------------------------------------------
// Section 3: Duplicate Move Rejection
// ----------------------------------------------------
console.log('\n[3. DUPLICATE MOVE REJECTION]');
const gDup = new DotsAndBoxesGame();
gDup.makeMove('h', 3, 3);
const preState = {
  p1: gDup.scores[1],
  p2: gDup.scores[2],
  curr: gDup.currentPlayer,
  boxes: gDup.completedBoxes
};

const dupRes = gDup.makeMove('h', 3, 3);
assert(dupRes.success === false, 'Duplicate move rejected with success = false');
assert(gDup.scores[1] === preState.p1 && gDup.scores[2] === preState.p2, 'Scores unaffected by duplicate move');
assert(gDup.currentPlayer === preState.curr, 'Current player unaffected by duplicate move');
assert(gDup.completedBoxes === preState.boxes, 'completedBoxes unaffected by duplicate move');

// ----------------------------------------------------
// Section 4: Boundary Cases & Corner Boxes
// ----------------------------------------------------
console.log('\n[4. BOUNDARY & CORNER VALIDATION]');
const gBound = new DotsAndBoxesGame();

// Top-Left corner (0,0)
gBound.reset();
gBound.makeMove('h', 0, 0);
gBound.makeMove('h', 1, 0);
gBound.makeMove('v', 0, 0);
const cTL = gBound.makeMove('v', 0, 1);
assert(cTL.completedBoxes.some(b => b.row === 0 && b.col === 0), 'Top-Left corner (0,0) completes cleanly');

// Top-Right corner (0,6)
gBound.reset();
gBound.makeMove('h', 0, 6);
gBound.makeMove('h', 1, 6);
gBound.makeMove('v', 0, 6);
const cTR = gBound.makeMove('v', 0, 7);
assert(cTR.completedBoxes.some(b => b.row === 0 && b.col === 6), 'Top-Right corner (0,6) completes cleanly');

// Bottom-Left corner (6,0)
gBound.reset();
gBound.makeMove('h', 6, 0);
gBound.makeMove('h', 7, 0);
gBound.makeMove('v', 6, 0);
const cBL = gBound.makeMove('v', 6, 1);
assert(cBL.completedBoxes.some(b => b.row === 6 && b.col === 0), 'Bottom-Left corner (6,0) completes cleanly');

// Bottom-Right corner (6,6)
gBound.reset();
gBound.makeMove('h', 6, 6);
gBound.makeMove('h', 7, 6);
gBound.makeMove('v', 6, 6);
const cBR = gBound.makeMove('v', 6, 7);
assert(cBR.completedBoxes.some(b => b.row === 6 && b.col === 6), 'Bottom-Right corner (6,6) completes cleanly');

// Out of bounds coordinate rejection
assert(gBound.makeMove('h', -1, 0).success === false, 'Horizontal negative row rejected');
assert(gBound.makeMove('h', 8, 0).success === false, 'Horizontal row >= 8 rejected');
assert(gBound.makeMove('v', 0, -1).success === false, 'Vertical negative col rejected');
assert(gBound.makeMove('v', 0, 8).success === false, 'Vertical col >= 8 rejected');

// ----------------------------------------------------
// Section 5: Game Over & Post-Game Protection
// ----------------------------------------------------
console.log('\n[5. GAME OVER BEHAVIOR]');
const gOver = new DotsAndBoxesGame();
while (!gOver.isGameOver) {
  const m = gOver.getAvailableMoves()[0];
  gOver.makeMove(m.type, m.row, m.col);
}
assert(gOver.isGameOver === true, 'isGameOver flag is set when 49th box is claimed');
assert(gOver.completedBoxes === 49, 'Total completed boxes equals exactly 49');
assert(gOver.scores[1] + gOver.scores[2] === 49, 'Sum of scores equals exactly 49');

const postMove = gOver.makeMove('h', 0, 0);
assert(postMove.success === false, 'Moves rejected after game over is reached');

// ----------------------------------------------------
// Section 6: Full Reset / New Game
// ----------------------------------------------------
console.log('\n[6. NEW GAME RESET]');
gOver.reset();
assert(gOver.scores[1] === 0 && gOver.scores[2] === 0, 'Scores reset to 0');
assert(gOver.completedBoxes === 0, 'completedBoxes reset to 0');
assert(gOver.currentPlayer === PLAYERS.PLAYER_1, 'currentPlayer reset to Player 1');
assert(gOver.isGameOver === false, 'isGameOver reset to false');
assert(gOver.winner === null, 'winner reset to null');
assert(gOver.moveHistory.length === 0, 'moveHistory reset to empty array');
assert(gOver.getAvailableMoves().length === 112, 'All 112 lines restored');

// ----------------------------------------------------
// Section 7: Undo Integrity
// ----------------------------------------------------
console.log('\n[7. UNDO INTEGRITY]');
const gUndo = new DotsAndBoxesGame();

// Test Undo on normal move
gUndo.makeMove('h', 0, 0); // P1
assert(gUndo.currentPlayer === PLAYERS.PLAYER_2, 'P2 turn before undo');
gUndo.undoMove();
assert(gUndo.currentPlayer === PLAYERS.PLAYER_1, 'Undo restored turn to P1');
assert(gUndo.horizontal[0][0] === 0, 'Undo cleared horizontal line');
verifyInvariant(gUndo, 'After normal undo');

// Test Undo on box-completing move
gUndo.makeMove('h', 0, 0); // P1
gUndo.makeMove('h', 1, 0); // P2
gUndo.makeMove('v', 0, 0); // P1
gUndo.makeMove('v', 0, 1); // P2 completes box (0,0)
assert(gUndo.scores[PLAYERS.PLAYER_2] === 1, 'P2 score is 1 before undo');
assert(gUndo.boxes[0][0] === PLAYERS.PLAYER_2, 'Box owned before undo');

gUndo.undoMove();
assert(gUndo.scores[PLAYERS.PLAYER_2] === 0, 'Undo restored P2 score to 0');
assert(gUndo.boxes[0][0] === 0, 'Undo revoked box ownership');
assert(gUndo.completedBoxes === 0, 'Undo decremented completedBoxes to 0');
assert(gUndo.currentPlayer === PLAYERS.PLAYER_2, 'Undo restored turn to P2');
verifyInvariant(gUndo, 'After box-completion undo');

// ----------------------------------------------------
// Section 8: AI Engine Compliance & Timeout Handling
// ----------------------------------------------------
console.log('\n[8. TIMEOUT TURN SKIPPING]');
const gTime = new DotsAndBoxesGame();
assert(gTime.currentPlayer === PLAYERS.PLAYER_1, 'P1 turn initially');
const toRes = gTime.handleTimeout();
assert(toRes.success === true, 'handleTimeout succeeds');
assert(toRes.skippedPlayer === PLAYERS.PLAYER_1, 'Player 1 was skipped');
assert(gTime.currentPlayer === PLAYERS.PLAYER_2, 'Turn passed to Player 2 after 20s timeout');
assert(gTime.scores[1] === 0 && gTime.scores[2] === 0, 'No points awarded on timeout');
verifyInvariant(gTime, 'After timeout skip');

console.log('\n[9. AI ENGINE COMPLIANCE]');
const gAI = new DotsAndBoxesGame();
// Test that Smart AI move is always a valid available line and passes through makeMove()
for (let step = 0; step < 20; step++) {
  const aiMove = DotsAndBoxesAI.getMove(gAI, 'vs_ai_smart');
  if (!aiMove) break;
  const result = gAI.makeMove(aiMove.type, aiMove.row, aiMove.col);
  assert(result.success === true, `AI move ${aiMove.type}(${aiMove.row},${aiMove.col}) successfully executed via official makeMove()`);
  verifyInvariant(gAI, `After AI move step ${step}`);
}

console.log('\n====================================================');
console.log(`FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
