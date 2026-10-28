/**
 * config.js — 全局配置
 *
 * 集中管理棋盘规格、几何尺寸、颜色、以及 AI 的评分权重等常量。
 * 其他模块只读取这里的值，不在代码中散落魔法数字。
 *
 * 注意：本项目使用经典 <script> 标签加载（非 ES Module），
 * 以便双击 index.html 即可在 file:// 协议下运行。
 * 所有模块通过 window.Gomoku 命名空间共享。
 */
(function (NS) {
  'use strict';

  const BOARD_SIZE = 15;

  const CONFIG = {
    // ── 棋盘规格 ──────────────────────────────────────────────
    BOARD_SIZE: BOARD_SIZE,      // 15×15 标准棋盘

    // ── 几何尺寸（逻辑像素，与 devicePixelRatio 无关）──────────
    MARGIN: 52,                  // 棋盘边缘到第一条网格线的距离
    CELL: 52,                    // 相邻两条网格线之间的间距
    STONE_RADIUS_RATIO: 0.45,    // 棋子半径 = CELL × 此比例
    HIT_RADIUS_RATIO: 0.48,      // 落子命中容差 = CELL × 此比例
    LAST_MARK_RADIUS_RATIO: 0.12,// 最后一手标记半径 = CELL × 此比例
    STAR_POINT_RADIUS: 4.5,      // 星位点半径（固定像素）

    // ── 颜色 ──────────────────────────────────────────────────
    COLOR: {
      BOARD_BACKGROUND: '#e3b872',
      BOARD_LINE: '#7a5230',
      STAR_POINT: '#7a5230',
      STONE_BLACK_FILL: '#2b2b2b',
      STONE_BLACK_HIGHLIGHT: '#5a5a5a',
      STONE_WHITE_FILL: '#f5f5f0',
      STONE_WHITE_HIGHLIGHT: '#ffffff',
      STONE_SHADOW: 'rgba(0, 0, 0, 0.35)',
      LAST_MARK: '#e24b4b',
      WIN_LINE: 'rgba(226, 75, 75, 0.65)',
      HOVER_BLACK: 'rgba(30, 30, 30, 0.35)',
      HOVER_WHITE: 'rgba(255, 255, 255, 0.55)',
    },

    // ── 棋子颜色标识（与 Board 存储值一致）──────────────────────
    EMPTY: 0,
    BLACK: 1,
    WHITE: 2,

    // ── 星位坐标（0-based row, col）──────────────────────────
    STAR_POINTS: [
      [3, 3], [3, 11],
      [11, 3], [11, 11],
      [7, 7],
    ],

    // ── AI 配置 ───────────────────────────────────────────────
    AI: {
      // 电脑“思考”的界面延迟（毫秒）。仅用于展示“电脑思考中”的体验，
      // 不承担把计算移出主线程的职责；启发式计算本身开销很小。
      DELAY_MS: 400,

      // 评分阶段候选点搜索半径：只考虑“已有棋子周围 SEARCH_RADIUS 格内”的空位
      SEARCH_RADIUS: 2,

      // 进攻（AI 自己成棋）与防守（封堵玩家）的评分权重
      ATTACK_WEIGHT: 1.0,
      DEFENSE_WEIGHT: 0.9,

      // 棋形评分表：越大越优先。四及以上的棋形本质都是“一步获胜/一步被胜”，
      // 已在“立即获胜 / 立即封堵”阶段被穷举扫描捕获，此表主要用于
      // 三、二、一这类“发展型”棋形的评估。
      SHAPE_SCORES: {
        FIVE:        10000000, // 连五（兜底，实际由立即获胜扫描处理）
        LIVE_FOUR:    100000,  // 活四
        RUSH_FOUR:     30000,  // 冲四
        LIVE_THREE:    10000,  // 活三
        SLEEP_THREE:    1000,  // 眠三
        LIVE_TWO:        400,  // 活二
        SLEEP_TWO:        60,  // 眠二
        ONE:              8,   // 孤子
      },
    },
  };

  /**
   * 计算棋盘的逻辑像素总尺寸（正方形边长）。
   * = MARGIN × 2 + CELL × (BOARD_SIZE - 1)
   * @returns {number}
   */
  function getLogicalBoardSize() {
    return CONFIG.MARGIN * 2 + CONFIG.CELL * (CONFIG.BOARD_SIZE - 1);
  }

  NS.CONFIG = CONFIG;
  NS.getLogicalBoardSize = getLogicalBoardSize;
})(window.Gomoku = window.Gomoku || {});
