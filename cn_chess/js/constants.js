/**
 * 常量定义（无逻辑，可被任意模块依赖）
 *
 * 棋盘坐标
 *  - row 0 为上方（黑方底线），row 9 为下方（红方底线）
 *  - col 0..8 从左到右
 */
(function (global) {
  'use strict';

  const RED = 'red';
  const BLACK = 'black';

  /** 棋盘行 / 列数 */
  const ROWS = 10;
  const COLS = 9;

  /** 棋子类型 */
  const PIECE = {
    GENERAL: 'general',
    ADVISOR: 'advisor',
    ELEPHANT: 'elephant',
    HORSE: 'horse',
    CHARIOT: 'chariot',
    CANNON: 'cannon',
    PAWN: 'pawn',
  };

  /** 棋子显示字符：CHARS[color][type] */
  const CHARS = {
    red: {
      general: '帅', advisor: '仕', elephant: '相',
      horse: '马', chariot: '车', cannon: '炮', pawn: '兵',
    },
    black: {
      general: '将', advisor: '士', elephant: '象',
      horse: '马', chariot: '车', cannon: '炮', pawn: '卒',
    },
  };

  /** 棋子基础分值，用于局面评估与走法排序 */
  const PIECE_VALUES = {
    general: 100000,
    chariot: 900,
    cannon: 450,
    horse: 400,
    elephant: 200,
    advisor: 200,
    pawn: 100,
  };

  /** 将死分值（远大于任何子力总和） */
  const MATE = 100000;

  /** 难度 → 搜索深度 */
  const DIFFICULTY = {
    easy: { label: '简单', depth: 2 },
    medium: { label: '中等', depth: 3 },
    hard: { label: '困难', depth: 4 },
  };

  /** 画布几何：居中留白 + 格宽（画布尺寸由此推导） */
  const BOARD_METRICS = {
    margin: 56,
    cell: 64,
    get width() { return this.margin * 2 + 8 * this.cell; },
    get height() { return this.margin * 2 + 9 * this.cell; },
  };

  const Constants = {
    RED, BLACK, ROWS, COLS, PIECE,
    CHARS, PIECE_VALUES, MATE, DIFFICULTY, BOARD_METRICS,
  };

  global.XQ = global.XQ || {};
  global.XQ.Constants = Constants;

  if (typeof module !== 'undefined' && module.exports) module.exports = Constants;
})(typeof globalThis !== 'undefined' ? globalThis : window);
