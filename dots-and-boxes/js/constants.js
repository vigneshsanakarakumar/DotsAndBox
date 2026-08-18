/**
 * Game Configuration and Constants
 * 7x7 Boxes requires 8x8 Dots
 */
export const BOARD_CONFIG = {
  BOX_ROWS: 7,
  BOX_COLS: 7,
  DOT_ROWS: 8,
  DOT_COLS: 8,
  TOTAL_BOXES: 49,
  TOTAL_HORIZONTAL_LINES: 56, // 8 rows * 7 cols
  TOTAL_VERTICAL_LINES: 56,   // 7 rows * 8 cols
  TOTAL_LINES: 112
};

export const PLAYERS = {
  NONE: 0,
  PLAYER_1: 1,
  PLAYER_2: 2
};

export const PLAYER_CONFIG = {
  1: {
    name: 'Player 1',
    color: '#3b82f6', // Bright Royal Blue
    lightColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: '#2563eb',
    textColor: '#1d4ed8',
    avatar: 'P1',
    icon: '🟦'
  },
  2: {
    name: 'Player 2',
    color: '#f43f5e', // Vibrant Rose / Coral
    lightColor: 'rgba(244, 63, 94, 0.18)',
    borderColor: '#e11d48',
    textColor: '#be123c',
    avatar: 'P2',
    icon: '🟥'
  }
};

export const GAME_MODES = {
  PASS_AND_PLAY: 'pass_and_play',
  VS_AI_EASY: 'vs_ai_easy',
  VS_AI_SMART: 'vs_ai_smart'
};
