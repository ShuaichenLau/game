/**
 * config.js — 全局配置常量
 * 所有魔法数字集中在此，修改游戏参数只需改这一个文件。
 */

export const CONFIG = {
  /* 画布 */
  CANVAS_SIZE: 480,      // 画布宽高（正方形），单位 px

  /* 网格 */
  GRID_COUNT: 20,        // 每行/列格子数
  get CELL_SIZE() {      // 每格像素大小（自动推导）
    return this.CANVAS_SIZE / this.GRID_COUNT;
  },

  /* 游戏速度：每隔多少毫秒前进一格 */
  INITIAL_SPEED: 150,    // 初始帧间隔 ms
  MIN_SPEED:     60,     // 最快帧间隔 ms（速度上限）
  SPEED_STEP:    5,      // 每吃 SPEED_EVERY 颗食物加速多少 ms
  SPEED_EVERY:   5,      // 每隔多少分触发一次加速

  /* 分数 */
  SCORE_PER_FOOD: 10,    // 每颗食物的基础分

  /* 蛇 */
  INITIAL_LENGTH: 3,     // 初始身体节数
  INITIAL_DIR: { x: 1, y: 0 }, // 初始方向：向右

  /* localStorage key */
  HISCORE_KEY: 'snake_hiscore',

  /* 颜色（供 Renderer 使用） */
  COLOR: {
    BG:           '#1a1a2e',   // 画布背景
    GRID:         '#16213e',   // 网格线（深色细线）
    SNAKE_HEAD:   '#00f3ff',   // 蛇头
    SNAKE_BODY:   '#0fa3b1',   // 蛇身
    SNAKE_STROKE: '#005f6b',   // 蛇边框
    FOOD:         '#ff4d6d',   // 食物主色
    FOOD_SHINE:   '#ff8fa3',   // 食物高光
    TEXT_PRIMARY: '#eaf4f4',   // 主要文字
    TEXT_DIM:     '#8ecae6',   // 次要文字
    OVERLAY:      'rgba(10,10,30,0.78)', // 遮罩
  },
};
